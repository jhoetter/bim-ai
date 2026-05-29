/**
 * REF-CQ-03 — extracted drag state machine for the 3D viewport.
 *
 * Owns the mutable state previously declared as `let` bindings inside the
 * main `useEffect` in `Viewport.tsx`:
 *   - which drag mode is active (`orbit | pan | grip | tool-draft |
 *     section-box`),
 *   - last pointer position + cumulative pixel travel + threshold,
 *   - inertia velocities + decay constant,
 *   - in-progress tool draft (Direct3dAuthoringTool) bookkeeping,
 *   - active grip descriptor + scene anchor + axis indicator,
 *   - section-box face drag plane.
 *
 * The class exposes mutable fields rather than getters/setters because the
 * existing pointer handlers in `Viewport.tsx` read/write these values in
 * nested closures across `onDown`, `onMove`, `onUp`, `onPointerCancel`, and
 * the render-tick. Mirroring that surface lets the extraction be a
 * mechanical rewrite (`let dragging = …` -> `controller.dragging = …`) and
 * preserves functional behaviour, which is the WP's hard constraint.
 *
 * Pure helper methods (`accumulateMove`, `tickInertia`, `clearTransient`,
 * `clearTool`, …) collapse the most repeated bookkeeping bursts so the
 * Viewport call sites read declaratively, and so the controller is
 * unit-testable in isolation (see Drag3dController.test.ts).
 */
import * as THREE from 'three';

import type { Grip3dDescriptor } from './grip3d';
import { buildAxisIndicator, type AxisIndicatorHandle } from './grip3dRenderer';
import type { Direct3dAuthoringTool } from './ViewportOverlays';

export type DragMode = 'orbit' | 'pan' | 'grip' | 'tool-draft' | 'section-box';

export interface ActiveGripState {
  descriptor: Grip3dDescriptor;
  anchorScene: THREE.Vector3;
  indicator: AxisIndicatorHandle | null;
  lastDeltaMm: number;
}

export interface SectionBoxDragState {
  face: string;
  dragPlane: THREE.Plane;
}

/** Pixel distance the pointer must travel before a drag is treated as motion. */
export const DRAG_THRESHOLD_PX = 5;
/** Multiplier applied to orbit-inertia velocity each frame (Rhino-like glide). */
export const INERTIA_DECAY = 0.92;
/** Velocity magnitude below which orbit inertia is considered stopped. */
export const INERTIA_STOP_THRESHOLD = 0.06;

/**
 * Drag/inertia/tool-draft state machine for the 3D viewport. Plain mutable
 * fields by design — the Viewport.tsx closures assign these directly.
 */
export class Drag3dController {
  /** Active drag mode (null when idle). */
  dragging: DragMode | null = null;
  /** True once cumulative pointer travel exceeded DRAG_THRESHOLD_PX. */
  dragMoved = false;
  /** Cumulative pixel travel since the current down event. */
  cumulativeDragPx = 0;
  /** Last seen pointer X (clientX). */
  lastX = 0;
  /** Last seen pointer Y (clientY). */
  lastY = 0;

  /** Orbit-inertia velocity (raw pixel delta scaled by orbit). */
  inertiaVx = 0;
  inertiaVy = 0;

  /** Tool-draft bookkeeping — preserved across the down/move/up sequence. */
  toolDraftTool: Direct3dAuthoringTool | null = null;
  toolDraftStartedLineOnDown = false;
  toolDraftConsumedOnDown = false;

  /** Active grip descriptor + indicator (null unless dragging==='grip'). */
  activeGrip: ActiveGripState | null = null;

  /** Active section-box face drag plane (null unless dragging==='section-box'). */
  sectionBoxDrag: SectionBoxDragState | null = null;

  /**
   * Magnitude of orbit-inertia velocity. Used by the render-tick to decide
   * whether to keep animating after pointer release.
   */
  inertiaSpeed(): number {
    return Math.hypot(this.inertiaVx, this.inertiaVy);
  }

  /** True if either dragging or inertia is non-trivially active. */
  hasMotion(): boolean {
    return this.dragging !== null || this.inertiaSpeed() > INERTIA_STOP_THRESHOLD;
  }

  /**
   * Reset the per-down bookkeeping (cumulative travel, dragMoved flag,
   * lastX/Y) and seed lastX/Y to the current pointer. Used at the start of
   * every down handler.
   */
  beginDrag(mode: DragMode | null, clientX: number, clientY: number): void {
    this.dragging = mode;
    this.dragMoved = false;
    this.cumulativeDragPx = 0;
    this.lastX = clientX;
    this.lastY = clientY;
  }

  /**
   * Accumulate a pointer delta and return whether the drag is now considered
   * "moved" (i.e. crossed DRAG_THRESHOLD_PX). Side effect: updates lastX/Y,
   * cumulativeDragPx, and (latches) dragMoved.
   */
  accumulateMove(clientX: number, clientY: number): { dx: number; dy: number; moved: boolean } {
    const dx = clientX - this.lastX;
    const dy = clientY - this.lastY;
    this.lastX = clientX;
    this.lastY = clientY;
    this.cumulativeDragPx += Math.hypot(dx, dy);
    if (this.cumulativeDragPx > DRAG_THRESHOLD_PX) this.dragMoved = true;
    return { dx, dy, moved: this.dragMoved };
  }

  /** Record the latest orbit velocity so inertia can continue after release. */
  recordOrbitVelocity(dx: number, dy: number): void {
    this.inertiaVx = dx;
    this.inertiaVy = dy;
  }

  /** Clear inertia velocities (e.g. on new pointer-down). */
  resetInertia(): void {
    this.inertiaVx = 0;
    this.inertiaVy = 0;
  }

  /**
   * Apply one frame of inertia decay. Returns true if inertia is still
   * meaningfully active (caller should orbit + re-render); false when below
   * the stop threshold (caller can skip work).
   */
  tickInertia(): boolean {
    if (this.inertiaSpeed() <= INERTIA_STOP_THRESHOLD) return false;
    this.inertiaVx *= INERTIA_DECAY;
    this.inertiaVy *= INERTIA_DECAY;
    return true;
  }

  /** Clear all tool-draft bookkeeping in one place. */
  clearTool(): void {
    this.toolDraftTool = null;
    this.toolDraftStartedLineOnDown = false;
    this.toolDraftConsumedOnDown = false;
  }

  /**
   * Clear all per-down state (drag mode, transient counters, tool draft).
   * Used by pointer-up and pointer-cancel handlers. Does NOT touch inertia
   * velocities — the up handler intentionally lets the latest orbit
   * velocity continue glide after release.
   */
  clearTransient(): void {
    this.dragging = null;
    this.dragMoved = false;
    this.cumulativeDragPx = 0;
    this.clearTool();
  }

  /**
   * Anchor a new grip drag with descriptor + scene anchor + (optional) axis
   * indicator. Seeds lastDeltaMm=0.
   */
  setGrip(
    descriptor: Grip3dDescriptor,
    anchorScene: THREE.Vector3,
    indicator: AxisIndicatorHandle | null,
  ): void {
    this.activeGrip = { descriptor, anchorScene, indicator, lastDeltaMm: 0 };
  }

  /** Dispose + clear the active grip (no-op if none). */
  clearGrip(): void {
    if (this.activeGrip) {
      this.activeGrip.indicator?.dispose();
      this.activeGrip = null;
    }
  }

  /**
   * Apply an in-progress grip-drag delta. Updates lastDeltaMm, calls the
   * descriptor's live-preview hook, and updates the axis indicator. No-op
   * if no grip is active.
   */
  applyGripDelta(deltaMm: number): void {
    const grip = this.activeGrip;
    if (!grip) return;
    grip.lastDeltaMm = deltaMm;
    grip.descriptor.onDrag(deltaMm);
    grip.indicator?.update(deltaMm);
  }

  /**
   * Commit the active grip drag. Returns the grip-command spec (if any)
   * produced by the descriptor's onCommit; the caller dispatches it through
   * the engine bus. Always disposes the indicator and clears the grip.
   */
  commitGrip(): ReturnType<Grip3dDescriptor['onCommit']> | null {
    const grip = this.activeGrip;
    if (!grip) return null;
    const spec = grip.descriptor.onCommit(grip.lastDeltaMm);
    grip.indicator?.dispose();
    this.activeGrip = null;
    return spec;
  }

  /**
   * Start a `tool-draft` drag for the given Direct3D authoring tool. Resets
   * the tool-draft flags and, for line-style tools, attempts an immediate
   * tool click — recording whether that click consumed the event and
   * whether it transitioned the draft state into a started line.
   */
  beginToolDraft(
    tool: Direct3dAuthoringTool,
    ev: PointerEvent,
    ctx: {
      lineTools: ReadonlySet<Direct3dAuthoringTool>;
      hasLineDraftStart: boolean;
      currentLineDraftTool: () => Direct3dAuthoringTool | null;
      handleClick: (cx: number, cy: number) => boolean;
    },
  ): void {
    this.beginDrag('tool-draft', ev.clientX, ev.clientY);
    this.toolDraftTool = tool;
    this.toolDraftStartedLineOnDown = false;
    this.toolDraftConsumedOnDown = false;
    if (ctx.lineTools.has(tool) && !ctx.hasLineDraftStart) {
      this.toolDraftConsumedOnDown = ctx.handleClick(ev.clientX, ev.clientY);
      this.toolDraftStartedLineOnDown = ctx.currentLineDraftTool() === tool;
    }
  }

  /**
   * Try to start a grip drag at the given pointer location. The caller
   * supplies a `gripPreRaycast` closure (it owns the runtime pickable list)
   * and a `scene` for the axis-indicator mesh. Returns true if a grip drag
   * was started, false if no grip was hit.
   */
  tryBeginGrip(
    ev: PointerEvent,
    ctx: {
      scene: THREE.Scene;
      gripPreRaycast: (cx: number, cy: number) => { hit: boolean; descriptor?: Grip3dDescriptor };
    },
  ): boolean {
    const pre = ctx.gripPreRaycast(ev.clientX, ev.clientY);
    if (!pre.hit || !pre.descriptor) return false;
    const desc = pre.descriptor;
    // Scene convention: semantic-Y → scene-Z; semantic-Z → scene-Y.
    const anchorScene = new THREE.Vector3(
      desc.position.xMm / 1000,
      desc.position.zMm / 1000,
      desc.position.yMm / 1000,
    );
    const indicator =
      desc.axis === 'x' || desc.axis === 'y' || desc.axis === 'z'
        ? buildAxisIndicator(ctx.scene, desc.position, desc.axis, 1500)
        : null;
    this.setGrip(desc, anchorScene, indicator);
    this.beginDrag('grip', ev.clientX, ev.clientY);
    return true;
  }

  /**
   * Commit an in-progress section-box face drag. Clears the per-drag plane,
   * then asks the caller to persist the new extent through whatever
   * store/dispatch boundary they own. No-op when nothing is dragging or no
   * section box is supplied.
   */
  commitSectionBoxDrag<E>(
    sectionBox: { getExtent: () => E } | null,
    persistExtent: (extent: E) => void,
  ): void {
    this.sectionBoxDrag = null;
    if (sectionBox) persistExtent(sectionBox.getExtent());
  }

  /**
   * Begin an orbit/pan drag based on classified pointer intent. Encapsulates
   * the "no grip / no section-box / not locked" tail of onDown:
   *   - intent === 'pan' → pan
   *   - intent === 'orbit' → orbit
   *   - intent === 'idle' + LMB → orbit (trackpad primary)
   *   - else null
   * Also resets inertia so a new drag starts from rest. `intent` is the
   * classifyPointer() result; accepts the raw 'idle' literal so the caller
   * does not need to normalise.
   */
  beginOrbitOrPan(intent: 'pan' | 'orbit' | 'idle' | null, ev: PointerEvent): void {
    let mode: 'pan' | 'orbit' | null;
    if (intent === 'pan') mode = 'pan';
    else if (intent === 'orbit') mode = 'orbit';
    // LMB drag = orbit (trackpad primary)
    else if (ev.button === 0) mode = 'orbit';
    else mode = null;
    this.beginDrag(mode, ev.clientX, ev.clientY);
    this.resetInertia();
  }

  /**
   * Update the section-box face being dragged given the current pointer
   * position. No-op if no section-box drag is active. The caller supplies
   * the runtime context (renderer, camera, axis helpers) so the controller
   * does not need to import them transitively.
   */
  updateSectionBoxDrag(
    ev: PointerEvent,
    ctx: {
      renderer: { domElement: HTMLElement };
      raycaster: THREE.Raycaster;
      ndc: THREE.Vector2;
      camera: THREE.Camera;
      faceAxisKey: (face: string) => 'x' | 'y' | 'z';
      sectionBox: { setExtent: (extent: Record<string, number>) => void };
      onHandlesChanged?: () => void;
    },
  ): void {
    if (!this.sectionBoxDrag) return;
    const rect = ctx.renderer.domElement.getBoundingClientRect();
    ctx.ndc.set(
      ((ev.clientX - rect.left) / rect.width) * 2 - 1,
      -((ev.clientY - rect.top) / rect.height) * 2 + 1,
    );
    ctx.raycaster.setFromCamera(ctx.ndc, ctx.camera);
    const hitPt = new THREE.Vector3();
    if (!ctx.raycaster.ray.intersectPlane(this.sectionBoxDrag.dragPlane, hitPt)) return;
    const axisKey = ctx.faceAxisKey(this.sectionBoxDrag.face);
    ctx.sectionBox.setExtent({ [this.sectionBoxDrag.face]: hitPt[axisKey] });
    ctx.onHandlesChanged?.();
  }

  /**
   * Try to start a section-box face drag at the given pointer location.
   * Returns true if a face handle was hit, false otherwise. The caller
   * supplies the runtime context (renderer, camera, handle group, axis
   * helpers) so the controller does not need to import them transitively.
   */
  tryBeginSectionBoxFace(
    ev: PointerEvent,
    ctx: {
      renderer: { domElement: HTMLElement };
      raycaster: THREE.Raycaster;
      ndc: THREE.Vector2;
      camera: THREE.Camera;
      handles: readonly THREE.Object3D[];
      faceAxisNormal: (face: string) => THREE.Vector3;
    },
  ): boolean {
    const rect = ctx.renderer.domElement.getBoundingClientRect();
    ctx.ndc.set(
      ((ev.clientX - rect.left) / rect.width) * 2 - 1,
      -((ev.clientY - rect.top) / rect.height) * 2 + 1,
    );
    ctx.raycaster.setFromCamera(ctx.ndc, ctx.camera);
    const hits = ctx.raycaster.intersectObjects([...ctx.handles], false);
    if (hits.length === 0) return false;
    const hit = hits[0];
    const face = hit.object.userData.sectionBoxHandle as string;
    const normal = ctx.faceAxisNormal(face);
    const dragPlane = new THREE.Plane().setFromNormalAndCoplanarPoint(normal, hit.point.clone());
    this.sectionBoxDrag = { face, dragPlane };
    this.beginDrag('section-box', ev.clientX, ev.clientY);
    return true;
  }
}
