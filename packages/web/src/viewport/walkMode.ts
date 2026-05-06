/**
 * Walk-mode controller — spec §15.3.
 *
 * Pure-math input model for first-person walk navigation:
 *
 *   - Toggled via the walk button. Esc exits.
 *   - WASD / arrow keys move on the ground plane.
 *   - Q / E descend / ascend.
 *   - PageUp / PageDown snap to the next / previous building storey.
 *   - Mouse-look maps pointer deltas to yaw + pitch (requires pointer lock).
 *   - Shift multiplies translation speed.
 *
 * Movement uses exponential velocity smoothing so starts and stops feel
 * physically natural rather than digital/robotic.
 */

export type WalkKey = 'forward' | 'back' | 'strafeLeft' | 'strafeRight' | 'down' | 'up';

export interface WalkVec3 {
  x: number;
  y: number;
  z: number;
}

export interface WalkState {
  position: WalkVec3;
  yaw: number;
  pitch: number;
  running: boolean;
  active: boolean;
}

export interface WalkConfig {
  walkSpeed: number;       // m/s
  runMultiplier: number;
  mouseSensitivity: number; // radians per pixel
  pitchClamp: number;      // radians, ±
  damping: number;         // velocity smoothing rate (higher = snappier)
  eyeHeight: number;       // m above floor datum for level snapping
}

const DEFAULT_CONFIG: WalkConfig = {
  walkSpeed: 2.5,
  runMultiplier: 3.0,
  mouseSensitivity: 0.003,
  pitchClamp: Math.PI / 2 - 0.05,
  damping: 12,
  eyeHeight: 1.7,
};

const KEY_MAP: Record<string, WalkKey> = {
  w: 'forward',
  W: 'forward',
  ArrowUp: 'forward',
  s: 'back',
  S: 'back',
  ArrowDown: 'back',
  a: 'strafeLeft',
  A: 'strafeLeft',
  ArrowLeft: 'strafeLeft',
  d: 'strafeRight',
  D: 'strafeRight',
  ArrowRight: 'strafeRight',
  q: 'down',
  Q: 'down',
  e: 'up',
  E: 'up',
};

/** Map a keyboard event key string to a WalkKey, if any. */
export function classifyKey(eventKey: string): WalkKey | null {
  return KEY_MAP[eventKey] ?? null;
}

export class WalkController {
  private state: WalkState;
  private velocity: WalkVec3 = { x: 0, y: 0, z: 0 };
  private keys: Set<WalkKey> = new Set();
  private config: WalkConfig;
  private levels: number[] = [];

  constructor(initial?: Partial<WalkState>, config?: Partial<WalkConfig>) {
    const defaultPosition: WalkVec3 = { x: 0, y: 1.7, z: 0 };
    this.state = {
      yaw: 0,
      pitch: 0,
      running: false,
      active: false,
      ...initial,
      position: { ...defaultPosition, ...initial?.position },
    };
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  snapshot(): WalkState {
    return {
      position: { ...this.state.position },
      yaw: this.state.yaw,
      pitch: this.state.pitch,
      running: this.state.running,
      active: this.state.active,
    };
  }

  setActive(active: boolean): void {
    this.state.active = active;
    if (!active) {
      this.keys.clear();
      this.state.running = false;
      this.velocity = { x: 0, y: 0, z: 0 };
    }
  }

  /** Warp to a world position and facing direction (yaw in radians).
   * Resets pitch and velocity — use this for the orbit→walk handoff. */
  teleport(pos: WalkVec3, yaw: number): void {
    this.state.position = { ...pos };
    this.state.yaw = yaw;
    this.state.pitch = 0;
    this.velocity = { x: 0, y: 0, z: 0 };
  }

  /** Register building storey floor heights (in metres, Y-up). */
  setLevels(elevMs: number[]): void {
    this.levels = [...elevMs].sort((a, b) => a - b);
  }

  /** Snap to the next (dir=+1) or previous (dir=-1) storey. */
  jumpFloor(dir: 1 | -1): void {
    const floorY = this.state.position.y - this.config.eyeHeight;
    if (dir === 1) {
      const next = this.levels.find((l) => l > floorY + 0.2);
      if (next !== undefined) {
        this.state.position.y = next + this.config.eyeHeight;
        this.velocity.y = 0;
      }
    } else {
      const prev = [...this.levels].reverse().find((l) => l < floorY - 0.2);
      if (prev !== undefined) {
        this.state.position.y = prev + this.config.eyeHeight;
        this.velocity.y = 0;
      }
    }
  }

  /** Press / release a movement key. */
  setKey(key: WalkKey, pressed: boolean): void {
    if (pressed) this.keys.add(key);
    else this.keys.delete(key);
  }

  setRunning(running: boolean): void {
    this.state.running = running;
  }

  /** Mouse-look — apply unscaled pointer deltas to yaw and pitch. */
  mouseLook(dxPx: number, dyPx: number): void {
    if (!this.state.active) return;
    const sens = this.config.mouseSensitivity;
    this.state.yaw += dxPx * sens;
    this.state.pitch = clamp(
      this.state.pitch - dyPx * sens,
      -this.config.pitchClamp,
      this.config.pitchClamp,
    );
  }

  /** Advance position by `dt` seconds using exponential velocity smoothing.
   * Velocity approaches the target speed instantly on key press and decays
   * smoothly on release — natural without feeling floaty. */
  update(dt: number): void {
    if (!this.state.active || dt <= 0) return;

    const forward = this.keys.has('forward') ? 1 : 0;
    const back = this.keys.has('back') ? 1 : 0;
    const left = this.keys.has('strafeLeft') ? 1 : 0;
    const right = this.keys.has('strafeRight') ? 1 : 0;
    const down = this.keys.has('down') ? 1 : 0;
    const up = this.keys.has('up') ? 1 : 0;

    const speed = this.config.walkSpeed * (this.state.running ? this.config.runMultiplier : 1);
    const cosY = Math.cos(this.state.yaw);
    const sinY = Math.sin(this.state.yaw);

    // Target velocity in each axis based on active keys.
    const tvx = ((forward - back) * sinY + (right - left) * cosY) * speed;
    const tvz = ((forward - back) * cosY - (right - left) * sinY) * speed;
    const tvy = (up - down) * speed;

    // Exponential smoothing: snappy feel with no digital snap.
    const f = 1 - Math.exp(-this.config.damping * dt);
    this.velocity.x += (tvx - this.velocity.x) * f;
    this.velocity.y += (tvy - this.velocity.y) * f;
    this.velocity.z += (tvz - this.velocity.z) * f;

    this.state.position = {
      x: this.state.position.x + this.velocity.x * dt,
      y: this.state.position.y + this.velocity.y * dt,
      z: this.state.position.z + this.velocity.z * dt,
    };
  }

  /** Returns the current view direction unit vector. */
  viewDirection(): WalkVec3 {
    const cosP = Math.cos(this.state.pitch);
    return {
      x: cosP * Math.sin(this.state.yaw),
      y: Math.sin(this.state.pitch),
      z: cosP * Math.cos(this.state.yaw),
    };
  }
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}
