/**
 * Section box & clipping — spec §15.6.
 *
 * Pure-math controller for a draggable axis-aligned bounding box that
 * defines the visible region of a 3D view. Six face handles drive
 * `min`/`max` per axis. Caller (Viewport.tsx) translates the resulting
 * 6-tuple of clip planes into `Material.clippingPlanes`.
 *
 * Coordinate frame matches the rest of the 3D viewport: world (m).
 */

import type { Vec3 } from './cameraRig';

export type SectionBoxAxis = 'x' | 'y' | 'z';
export type SectionBoxSide = 'min' | 'max';
export type SectionBoxHandle = `${SectionBoxAxis}-${SectionBoxSide}`;

export type SectionBoxExtent = {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
};

export interface SectionBoxState {
  active: boolean;
  min: Vec3;
  max: Vec3;
}

export interface ClippingPlane {
  normal: Vec3;
  /** Constant `d` such that `normal · point + d ≥ 0` is inside. */
  constant: number;
}

/** Default box: 12 m × 8.4 m × 6.5 m centered at origin (the spec's
 * sample readout). */
const DEFAULT_BOX: SectionBoxState = {
  active: false,
  min: { x: -6, y: 0, z: -4.2 },
  max: { x: 6, y: 6.5, z: 4.2 },
};

export class SectionBox {
  private state: SectionBoxState;

  constructor(initial?: Partial<SectionBoxState>) {
    this.state = {
      active: initial?.active ?? DEFAULT_BOX.active,
      min: { ...DEFAULT_BOX.min, ...initial?.min },
      max: { ...DEFAULT_BOX.max, ...initial?.max },
    };
  }

  snapshot(): SectionBoxState {
    return {
      active: this.state.active,
      min: { ...this.state.min },
      max: { ...this.state.max },
    };
  }

  toggle(): void {
    this.state.active = !this.state.active;
  }

  setActive(active: boolean): void {
    this.state.active = active;
  }

  /** Update one face by `delta` (m). The opposite face is not affected;
   * if it would invert the box, the handle is clamped against the
   * opposite face minus a 0.1 m epsilon. */
  dragHandle(handle: SectionBoxHandle, delta: number): void {
    const [axis, side] = handle.split('-') as [SectionBoxAxis, SectionBoxSide];
    const next = { ...this.state[side] };
    next[axis] = clampHandle(this.state, axis, side, this.state[side][axis] + delta);
    this.state = { ...this.state, [side]: next };
  }

  /** Set the entire box from a min + max pair (clamps invariants). */
  setBox(min: Vec3, max: Vec3): void {
    const fixed = ensureValidBox(min, max);
    this.state = { ...this.state, min: fixed.min, max: fixed.max };
  }

  /** Return current extent as a flat object for store persistence. */
  getExtent(): SectionBoxExtent {
    const { min, max } = this.state;
    return {
      minX: min.x,
      maxX: max.x,
      minY: min.y,
      maxY: max.y,
      minZ: min.z,
      maxZ: max.z,
    };
  }

  /** Merge partial extent into current state, clamping box invariants. */
  setExtent(ext: Partial<SectionBoxExtent>): void {
    const cur = this.getExtent();
    const merged = { ...cur, ...ext };
    this.setBox(
      { x: merged.minX, y: merged.minY, z: merged.minZ },
      { x: merged.maxX, y: merged.maxY, z: merged.maxZ },
    );
  }

  /** Render summary for the chip in the bottom-left of the canvas. */
  summary(): string {
    const sx = this.state.max.x - this.state.min.x;
    const sy = this.state.max.y - this.state.min.y;
    const sz = this.state.max.z - this.state.min.z;
    return `Section box: ${sx.toFixed(1)} m × ${sy.toFixed(1)} m × ${sz.toFixed(1)} m`;
  }

  /** Six clip planes: one per face, normals pointing inward. */
  clippingPlanes(): ClippingPlane[] {
    if (!this.state.active) return [];
    const { min, max } = this.state;
    return [
      { normal: { x: 1, y: 0, z: 0 }, constant: -min.x }, // x ≥ min.x
      { normal: { x: -1, y: 0, z: 0 }, constant: max.x }, // x ≤ max.x
      { normal: { x: 0, y: 1, z: 0 }, constant: -min.y },
      { normal: { x: 0, y: -1, z: 0 }, constant: max.y },
      { normal: { x: 0, y: 0, z: 1 }, constant: -min.z },
      { normal: { x: 0, y: 0, z: -1 }, constant: max.z },
    ];
  }

  /** Test if a world-space point is inside the active box. When the box
   * is inactive, every point is "inside". */
  contains(point: Vec3): boolean {
    if (!this.state.active) return true;
    const { min, max } = this.state;
    return (
      point.x >= min.x &&
      point.x <= max.x &&
      point.y >= min.y &&
      point.y <= max.y &&
      point.z >= min.z &&
      point.z <= max.z
    );
  }
}

function clampHandle(
  state: SectionBoxState,
  axis: SectionBoxAxis,
  side: SectionBoxSide,
  proposed: number,
): number {
  const epsilon = 0.1;
  if (side === 'min') {
    return Math.min(proposed, state.max[axis] - epsilon);
  }
  return Math.max(proposed, state.min[axis] + epsilon);
}

function ensureValidBox(min: Vec3, max: Vec3): { min: Vec3; max: Vec3 } {
  return {
    min: {
      x: Math.min(min.x, max.x),
      y: Math.min(min.y, max.y),
      z: Math.min(min.z, max.z),
    },
    max: {
      x: Math.max(min.x, max.x),
      y: Math.max(min.y, max.y),
      z: Math.max(min.z, max.z),
    },
  };
}
