/**
 * Camera rig for the 3D viewport — spec §15.3.
 *
 * Pure (testable) spherical-coordinate rig that supports the documented
 * grammar:
 *
 *   - Orbit:  `Alt + LMB drag` or middle-mouse drag.
 *   - Pan:    `Shift + middle-mouse drag` (or two-finger trackpad).
 *   - Dolly:  mouse wheel anchored at cursor; pinch.
 *   - Free zoom: `⌘=` / `⌘-` (delegated to `dollyBy(±k)`).
 *   - Frame all (`F`) and Reset (`Home`/`H`) via `frame(box)` /
 *     `reset(home)`.
 *
 * The rig holds: target (Vec3), radius, azimuth (theta), elevation (phi),
 * and an up-vector. `compose()` returns the composed camera position.
 *
 * This module is deliberately framework-free so it can be unit-tested
 * without a renderer; Viewport.tsx wires it to a `THREE.PerspectiveCamera`.
 */

export type Vec3 = { x: number; y: number; z: number };

export interface CameraRigSnapshot {
  target: Vec3;
  position: Vec3;
  up: Vec3;
  azimuth: number;
  elevation: number;
  radius: number;
}

export interface CameraRigState {
  target: Vec3;
  up: Vec3;
  azimuth: number;
  elevation: number;
  radius: number;
  /** Bounds for `radius` (m). */
  minRadius: number;
  maxRadius: number;
  /** Bounds for `elevation` (radians). Spec uses [0.12, π/2 - 0.08]. */
  minElevation: number;
  maxElevation: number;
}

const DEFAULT_HOME: CameraRigState = {
  target: { x: 0, y: 1.35, z: 0 },
  up: { x: 0, y: 1, z: 0 },
  azimuth: Math.PI / 4,
  elevation: 0.45,
  radius: 16,
  minRadius: 1,
  maxRadius: 120,
  minElevation: 0.12,
  maxElevation: Math.PI / 2 - 0.08,
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function add(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

function sub(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

function scale(v: Vec3, k: number): Vec3 {
  return { x: v.x * k, y: v.y * k, z: v.z * k };
}

function length(v: Vec3): number {
  return Math.hypot(v.x, v.y, v.z);
}

function normalize(v: Vec3): Vec3 {
  const l = length(v);
  return l === 0 ? { ...v } : scale(v, 1 / l);
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

function composePosition(state: CameraRigState): Vec3 {
  const { target, radius, azimuth, elevation } = state;
  return {
    x: target.x + radius * Math.cos(elevation) * Math.sin(azimuth),
    y: target.y + radius * Math.sin(elevation),
    z: target.z + radius * Math.cos(elevation) * Math.cos(azimuth),
  };
}

export function createCameraRig(initial?: Partial<CameraRigState>): CameraRig {
  const state: CameraRigState = {
    ...DEFAULT_HOME,
    ...initial,
    target: { ...(initial?.target ?? DEFAULT_HOME.target) },
    up: { ...(initial?.up ?? DEFAULT_HOME.up) },
  };
  return new CameraRig(state, { ...DEFAULT_HOME, ...initial });
}

export class CameraRig {
  private state: CameraRigState;
  private home: CameraRigState;

  constructor(state: CameraRigState, home: CameraRigState) {
    this.state = state;
    this.home = home;
  }

  /** Current immutable snapshot, including derived `position`. */
  snapshot(): CameraRigSnapshot {
    return {
      target: { ...this.state.target },
      position: composePosition(this.state),
      up: { ...this.state.up },
      azimuth: this.state.azimuth,
      elevation: this.state.elevation,
      radius: this.state.radius,
    };
  }

  /** Orbit the camera around the target. `dxPx` and `dyPx` are unscaled
   * pointer deltas; the rig applies a pixel→radian factor. */
  orbit(dxPx: number, dyPx: number, sensitivity = 0.006): void {
    this.state.azimuth += dxPx * sensitivity;
    this.state.elevation = clamp(
      this.state.elevation - dyPx * sensitivity,
      this.state.minElevation,
      this.state.maxElevation,
    );
  }

  /** Pan the rig (target + camera move together along screen-space basis). */
  pan(dxPx: number, dyPx: number, sensitivity = 0.005): void {
    const position = composePosition(this.state);
    const view = normalize(sub(this.state.target, position));
    const right = normalize(cross(view, this.state.up));
    const upInPlane = normalize(cross(right, view));
    const distance = this.state.radius * sensitivity;
    const delta = add(scale(right, -dxPx * distance), scale(upInPlane, dyPx * distance));
    this.state.target = add(this.state.target, delta);
  }

  /** Dolly (zoom along the view direction). Positive `delta` moves away. */
  dolly(delta: number, sensitivity = 0.012): void {
    this.state.radius = clamp(
      this.state.radius + delta * sensitivity,
      this.state.minRadius,
      this.state.maxRadius,
    );
  }

  /** Free zoom by a discrete factor (`⌘=` / `⌘-`). `factor < 1` zooms in. */
  zoomBy(factor: number): void {
    this.state.radius = clamp(
      this.state.radius * factor,
      this.state.minRadius,
      this.state.maxRadius,
    );
  }

  /** Replace the target and recompute radius from the supplied position. */
  applyViewpoint(position: Vec3, target: Vec3, up: Vec3): void {
    this.state.target = { ...target };
    const safeUp = length(up) === 0 ? this.state.up : normalize(up);
    this.state.up = safeUp;
    const offset = sub(position, target);
    this.state.radius = Math.max(this.state.minRadius, length(offset));
    this.state.elevation = clamp(
      Math.asin(offset.y / this.state.radius),
      this.state.minElevation,
      this.state.maxElevation,
    );
    this.state.azimuth = Math.atan2(offset.x, offset.z);
  }

  /** Frame an axis-aligned bounding box (`fitFactor` * span / 2 puts the
   * camera back so the box just fits in view). */
  frame(box: { min: Vec3; max: Vec3 }, fitFactor = 1.4): void {
    const cx = (box.min.x + box.max.x) / 2;
    const cy = (box.min.y + box.max.y) / 2;
    const cz = (box.min.z + box.max.z) / 2;
    const spanX = Math.max(box.max.x - box.min.x, 1);
    const spanY = Math.max(box.max.y - box.min.y, 1);
    const spanZ = Math.max(box.max.z - box.min.z, 1);
    const span = Math.max(spanX, spanY, spanZ);
    this.state.target = { x: cx, y: cy, z: cz };
    this.state.radius = clamp(span * fitFactor, this.state.minRadius, this.state.maxRadius);
  }

  /** Snap to the saved home view. */
  reset(): void {
    this.state = {
      ...this.home,
      target: { ...this.home.target },
      up: { ...this.home.up },
    };
  }

  /** Persist the current state as the rig's home view (for `H`). */
  setHome(): void {
    this.home = {
      ...this.state,
      target: { ...this.state.target },
      up: { ...this.state.up },
    };
  }
}

/* ────────────────────────────────────────────────────────────────────── */
/* Pointer grammar — spec §15.3                                            */
/* ────────────────────────────────────────────────────────────────────── */

export type PointerIntent = 'orbit' | 'pan' | 'idle';

export interface PointerEventLike {
  button: number;
  buttons?: number;
  altKey?: boolean;
  shiftKey?: boolean;
  metaKey?: boolean;
  ctrlKey?: boolean;
}

/** Map a pointer event to the documented intent.
 *
 *   - Alt + LMB      → orbit
 *   - Middle button  → orbit (no modifier) / pan with Shift
 *   - Shift + MMB    → pan
 *   - Two-finger trackpad scroll arrives as wheel (handled separately)
 */
export function classifyPointer(event: PointerEventLike): PointerIntent {
  const isLmb = event.button === 0;
  const isMmb = event.button === 1;
  if (isMmb && event.shiftKey) return 'pan';
  if (isMmb) return 'orbit';
  if (isLmb && event.altKey) return 'orbit';
  return 'idle';
}

export type WheelEventLike = {
  deltaY: number;
  metaKey?: boolean;
  ctrlKey?: boolean;
};

/** Map a wheel event to a dolly delta (positive = zoom out). */
export function wheelDelta(event: WheelEventLike): number {
  // Trackpad pinch arrives as ctrl+wheel on most browsers.
  if (event.metaKey || event.ctrlKey) return event.deltaY * 0.5;
  return event.deltaY;
}

/* Hotkey resolution for §15.3. */
export type CameraHotkey =
  | { kind: 'frame-all' }
  | { kind: 'frame-selection' }
  | { kind: 'reset' }
  | { kind: 'zoom-in' }
  | { kind: 'zoom-out' }
  | null;

export interface KeyEventLike {
  key: string;
  metaKey?: boolean;
  ctrlKey?: boolean;
}

export function classifyHotkey(event: KeyEventLike): CameraHotkey {
  const cmd = event.metaKey || event.ctrlKey;
  if (cmd && event.key === '=') return { kind: 'zoom-in' };
  if (cmd && event.key === '-') return { kind: 'zoom-out' };
  if (cmd && (event.key === 'f' || event.key === 'F')) return { kind: 'frame-selection' };
  if (event.key === 'f' || event.key === 'F') return { kind: 'frame-all' };
  if (event.key === 'h' || event.key === 'H' || event.key === 'Home') return { kind: 'reset' };
  return null;
}
