/**
 * Walk-mode controller — spec §15.3.
 *
 * Pure-math input model for first-person walk navigation:
 *
 *   - Toggled by `W` (when 3D pane has focus). On exit, `Esc`.
 *   - WASD moves on the ground plane (W/S forward/back, A/D strafe).
 *   - Q/E descend/ascend.
 *   - Mouse-look maps pointer deltas to yaw + pitch (clamped).
 *   - Shift modifier multiplies translation speed (`run`).
 *
 * The controller exposes `state` (yaw, pitch, position) plus an `update(dt)`
 * step that applies the active key set against the spec'd speeds. Tests
 * drive `setKey` + `mouseLook` + `update` to assert kinematic correctness
 * without a renderer.
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
  walkSpeed: number; // m/s
  runMultiplier: number;
  mouseSensitivity: number; // radians per pixel
  pitchClamp: number; // radians, ±
}

const DEFAULT_CONFIG: WalkConfig = {
  walkSpeed: 1.4,
  runMultiplier: 2.4,
  mouseSensitivity: 0.0025,
  pitchClamp: Math.PI / 2 - 0.05,
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
  private keys: Set<WalkKey> = new Set();
  private config: WalkConfig;

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

  /** Advance position by `dt` seconds against the active keys. */
  update(dt: number): void {
    if (!this.state.active || dt <= 0) return;
    const forward = this.keys.has('forward') ? 1 : 0;
    const back = this.keys.has('back') ? 1 : 0;
    const left = this.keys.has('strafeLeft') ? 1 : 0;
    const right = this.keys.has('strafeRight') ? 1 : 0;
    const down = this.keys.has('down') ? 1 : 0;
    const up = this.keys.has('up') ? 1 : 0;

    const speed = this.config.walkSpeed * (this.state.running ? this.config.runMultiplier : 1);
    const fwd = forward - back;
    const sideways = right - left;
    const vertical = up - down;

    const cosY = Math.cos(this.state.yaw);
    const sinY = Math.sin(this.state.yaw);

    // Ground-plane forward = (sin yaw, 0, cos yaw); right = (cos yaw, 0, -sin yaw).
    const dx = (fwd * sinY + sideways * cosY) * speed * dt;
    const dz = (fwd * cosY - sideways * sinY) * speed * dt;
    const dy = vertical * speed * dt;

    this.state.position = {
      x: this.state.position.x + dx,
      y: this.state.position.y + dy,
      z: this.state.position.z + dz,
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
