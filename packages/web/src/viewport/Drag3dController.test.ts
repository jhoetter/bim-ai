/**
 * REF-CQ-03 — direct unit tests for the extracted Drag3dController.
 *
 * Covers: drag-threshold accumulation, inertia decay, tool-draft
 * consumption bookkeeping, grip anchoring + live-preview wiring, and the
 * orbit/pan mode classifier tail of onDown.
 */
import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';

import {
  Drag3dController,
  DRAG_THRESHOLD_PX,
  INERTIA_DECAY,
  INERTIA_STOP_THRESHOLD,
} from './Drag3dController';
import type { Grip3dDescriptor } from './grip3d';

function makePointerEvent(overrides: Partial<PointerEvent>): PointerEvent {
  // Minimal shape — handlers only read button/clientX/clientY.
  return {
    button: 0,
    clientX: 0,
    clientY: 0,
    ...overrides,
  } as unknown as PointerEvent;
}

function makeGrip(overrides: Partial<Grip3dDescriptor> = {}): {
  descriptor: Grip3dDescriptor;
  onDrag: ReturnType<typeof vi.fn>;
  onCommit: ReturnType<typeof vi.fn>;
} {
  const onDrag = vi.fn();
  const onCommit = vi.fn(() => ({ type: 'test/commit', payload: {} }));
  const descriptor: Grip3dDescriptor = {
    id: 'grip-1',
    role: 'wallHeight',
    position: { xMm: 1000, yMm: 2000, zMm: 3000 },
    axis: 'z',
    rangeMm: { minMm: -500, maxMm: 500 },
    onDrag,
    onCommit,
    ...overrides,
  };
  return { descriptor, onDrag, onCommit };
}

describe('Drag3dController', () => {
  describe('drag threshold', () => {
    it('does not latch dragMoved until cumulative travel exceeds DRAG_THRESHOLD_PX', () => {
      const ctl = new Drag3dController();
      ctl.beginDrag('orbit', 100, 100);
      // 4 px diagonal — below threshold (≈5.66 > 5)? hypot(4,4)≈5.66 > 5 -> moved.
      // Use 2px diagonal to stay under threshold (hypot(2,2)≈2.83).
      const a = ctl.accumulateMove(102, 102);
      expect(a.moved).toBe(false);
      expect(ctl.dragMoved).toBe(false);
    });

    it('latches dragMoved as soon as cumulative travel exceeds DRAG_THRESHOLD_PX', () => {
      const ctl = new Drag3dController();
      ctl.beginDrag('orbit', 0, 0);
      // 3 + 3 = 6 px straight-line == hypot(3,0)+hypot(3,0) accumulates to 6 > 5.
      ctl.accumulateMove(3, 0);
      expect(ctl.cumulativeDragPx).toBeCloseTo(3);
      const second = ctl.accumulateMove(6, 0);
      expect(ctl.cumulativeDragPx).toBeCloseTo(6);
      expect(second.moved).toBe(true);
      expect(ctl.dragMoved).toBe(true);
    });

    it('beginDrag resets cumulativeDragPx and dragMoved', () => {
      const ctl = new Drag3dController();
      ctl.beginDrag('orbit', 0, 0);
      ctl.accumulateMove(20, 0);
      expect(ctl.dragMoved).toBe(true);
      ctl.beginDrag('pan', 50, 60);
      expect(ctl.dragMoved).toBe(false);
      expect(ctl.cumulativeDragPx).toBe(0);
      expect(ctl.lastX).toBe(50);
      expect(ctl.lastY).toBe(60);
    });

    it('exposes DRAG_THRESHOLD_PX = 5 (regression guard)', () => {
      expect(DRAG_THRESHOLD_PX).toBe(5);
    });
  });

  describe('inertia decay', () => {
    it('tickInertia returns false when velocity is at rest', () => {
      const ctl = new Drag3dController();
      expect(ctl.tickInertia()).toBe(false);
    });

    it('multiplies velocity by INERTIA_DECAY each frame and stops below threshold', () => {
      const ctl = new Drag3dController();
      ctl.recordOrbitVelocity(10, 0);
      expect(ctl.inertiaSpeed()).toBeCloseTo(10);
      const decayed = ctl.tickInertia();
      expect(decayed).toBe(true);
      expect(ctl.inertiaVx).toBeCloseTo(10 * INERTIA_DECAY);
      // After enough frames the velocity drops below the stop threshold.
      for (let i = 0; i < 200; i++) ctl.tickInertia();
      expect(ctl.inertiaSpeed()).toBeLessThan(INERTIA_STOP_THRESHOLD);
      expect(ctl.tickInertia()).toBe(false);
    });

    it('resetInertia zeroes the velocity', () => {
      const ctl = new Drag3dController();
      ctl.recordOrbitVelocity(5, 7);
      ctl.resetInertia();
      expect(ctl.inertiaVx).toBe(0);
      expect(ctl.inertiaVy).toBe(0);
      expect(ctl.inertiaSpeed()).toBe(0);
    });

    it('hasMotion is true while dragging or while inertia is above threshold', () => {
      const ctl = new Drag3dController();
      expect(ctl.hasMotion()).toBe(false);
      ctl.dragging = 'orbit';
      expect(ctl.hasMotion()).toBe(true);
      ctl.dragging = null;
      ctl.recordOrbitVelocity(2, 0);
      expect(ctl.hasMotion()).toBe(true);
      ctl.resetInertia();
      expect(ctl.hasMotion()).toBe(false);
    });

    it('exposes INERTIA_DECAY = 0.92 (Rhino-like glide; regression guard)', () => {
      expect(INERTIA_DECAY).toBe(0.92);
    });
  });

  describe('tool-draft consumption bookkeeping', () => {
    it('clearTool resets all three tool-draft flags', () => {
      const ctl = new Drag3dController();
      ctl.toolDraftTool = 'wall';
      ctl.toolDraftStartedLineOnDown = true;
      ctl.toolDraftConsumedOnDown = true;
      ctl.clearTool();
      expect(ctl.toolDraftTool).toBeNull();
      expect(ctl.toolDraftStartedLineOnDown).toBe(false);
      expect(ctl.toolDraftConsumedOnDown).toBe(false);
    });

    it('clearTransient clears drag bookkeeping AND tool-draft state, but not inertia', () => {
      const ctl = new Drag3dController();
      ctl.beginDrag('tool-draft', 0, 0);
      ctl.toolDraftTool = 'wall';
      ctl.toolDraftStartedLineOnDown = true;
      ctl.recordOrbitVelocity(3, 4);
      ctl.dragMoved = true;
      ctl.cumulativeDragPx = 99;
      ctl.clearTransient();
      expect(ctl.dragging).toBeNull();
      expect(ctl.dragMoved).toBe(false);
      expect(ctl.cumulativeDragPx).toBe(0);
      expect(ctl.toolDraftTool).toBeNull();
      expect(ctl.toolDraftStartedLineOnDown).toBe(false);
      // Inertia preserved deliberately so the render loop can glide after release.
      expect(ctl.inertiaVx).toBe(3);
      expect(ctl.inertiaVy).toBe(4);
    });
  });

  describe('grip anchoring', () => {
    it('setGrip stores descriptor + scene anchor + indicator with zero initial delta', () => {
      const ctl = new Drag3dController();
      const { descriptor } = makeGrip();
      const anchor = new THREE.Vector3(1, 2, 3);
      const indicator = { update: vi.fn(), dispose: vi.fn() };
      ctl.setGrip(descriptor, anchor, indicator);
      expect(ctl.activeGrip).not.toBeNull();
      expect(ctl.activeGrip?.descriptor).toBe(descriptor);
      expect(ctl.activeGrip?.anchorScene).toBe(anchor);
      expect(ctl.activeGrip?.indicator).toBe(indicator);
      expect(ctl.activeGrip?.lastDeltaMm).toBe(0);
    });

    it('applyGripDelta updates lastDeltaMm and fires descriptor.onDrag + indicator.update', () => {
      const ctl = new Drag3dController();
      const { descriptor, onDrag } = makeGrip();
      const indicator = { update: vi.fn(), dispose: vi.fn() };
      ctl.setGrip(descriptor, new THREE.Vector3(), indicator);
      ctl.applyGripDelta(125);
      expect(ctl.activeGrip?.lastDeltaMm).toBe(125);
      expect(onDrag).toHaveBeenCalledWith(125);
      expect(indicator.update).toHaveBeenCalledWith(125);
    });

    it('applyGripDelta is a no-op when no grip is active', () => {
      const ctl = new Drag3dController();
      expect(() => ctl.applyGripDelta(50)).not.toThrow();
    });

    it('commitGrip returns the descriptor onCommit result, disposes indicator, and clears the grip', () => {
      const ctl = new Drag3dController();
      const { descriptor, onCommit } = makeGrip();
      const indicator = { update: vi.fn(), dispose: vi.fn() };
      ctl.setGrip(descriptor, new THREE.Vector3(), indicator);
      ctl.applyGripDelta(40);
      const spec = ctl.commitGrip();
      expect(onCommit).toHaveBeenCalledWith(40);
      expect(spec).toEqual({ type: 'test/commit', payload: {} });
      expect(indicator.dispose).toHaveBeenCalled();
      expect(ctl.activeGrip).toBeNull();
    });

    it('clearGrip disposes the axis indicator and clears the grip', () => {
      const ctl = new Drag3dController();
      const { descriptor } = makeGrip();
      const indicator = { update: vi.fn(), dispose: vi.fn() };
      ctl.setGrip(descriptor, new THREE.Vector3(), indicator);
      ctl.clearGrip();
      expect(indicator.dispose).toHaveBeenCalled();
      expect(ctl.activeGrip).toBeNull();
    });

    it('tryBeginGrip seeds activeGrip, latches dragging="grip", and resets per-down bookkeeping', () => {
      const ctl = new Drag3dController();
      const { descriptor } = makeGrip();
      const scene = new THREE.Scene();
      const gripPreRaycast = vi.fn(() => ({ hit: true, descriptor }));
      const started = ctl.tryBeginGrip(makePointerEvent({ clientX: 50, clientY: 60 }), {
        scene,
        gripPreRaycast,
      });
      expect(started).toBe(true);
      expect(ctl.dragging).toBe('grip');
      expect(ctl.activeGrip?.descriptor).toBe(descriptor);
      // Scene convention: semantic-Y → scene-Z; semantic-Z → scene-Y.
      // descriptor.position is {xMm:1000, yMm:2000, zMm:3000}.
      expect(ctl.activeGrip?.anchorScene.x).toBeCloseTo(1);
      expect(ctl.activeGrip?.anchorScene.y).toBeCloseTo(3);
      expect(ctl.activeGrip?.anchorScene.z).toBeCloseTo(2);
      expect(ctl.lastX).toBe(50);
      expect(ctl.lastY).toBe(60);
      expect(ctl.dragMoved).toBe(false);
      expect(ctl.cumulativeDragPx).toBe(0);
    });

    it('tryBeginGrip returns false when no grip is hit', () => {
      const ctl = new Drag3dController();
      const scene = new THREE.Scene();
      const started = ctl.tryBeginGrip(makePointerEvent({}), {
        scene,
        gripPreRaycast: () => ({ hit: false }),
      });
      expect(started).toBe(false);
      expect(ctl.dragging).toBeNull();
      expect(ctl.activeGrip).toBeNull();
    });
  });

  describe('beginOrbitOrPan classification tail', () => {
    it('intent="pan" wins regardless of button', () => {
      const ctl = new Drag3dController();
      ctl.beginOrbitOrPan('pan', makePointerEvent({ button: 2, clientX: 1, clientY: 2 }));
      expect(ctl.dragging).toBe('pan');
    });

    it('intent="orbit" → orbit', () => {
      const ctl = new Drag3dController();
      ctl.beginOrbitOrPan('orbit', makePointerEvent({ button: 1, clientX: 3, clientY: 4 }));
      expect(ctl.dragging).toBe('orbit');
    });

    it('intent=null with LMB falls back to orbit (trackpad primary)', () => {
      const ctl = new Drag3dController();
      ctl.beginOrbitOrPan(null, makePointerEvent({ button: 0, clientX: 5, clientY: 6 }));
      expect(ctl.dragging).toBe('orbit');
    });

    it('intent=null with non-LMB → no drag', () => {
      const ctl = new Drag3dController();
      ctl.beginOrbitOrPan(null, makePointerEvent({ button: 2, clientX: 5, clientY: 6 }));
      expect(ctl.dragging).toBeNull();
    });

    it('resets inertia so each new drag starts from rest', () => {
      const ctl = new Drag3dController();
      ctl.recordOrbitVelocity(10, 10);
      ctl.beginOrbitOrPan('orbit', makePointerEvent({ button: 0 }));
      expect(ctl.inertiaVx).toBe(0);
      expect(ctl.inertiaVy).toBe(0);
    });
  });

  describe('section-box face drag', () => {
    it('updateSectionBoxDrag is a no-op when no section-box drag is active', () => {
      const ctl = new Drag3dController();
      const setExtent = vi.fn();
      const onHandlesChanged = vi.fn();
      ctl.updateSectionBoxDrag(makePointerEvent({ clientX: 0, clientY: 0 }), {
        renderer: { domElement: document.createElement('div') },
        raycaster: new THREE.Raycaster(),
        ndc: new THREE.Vector2(),
        camera: new THREE.PerspectiveCamera(),
        faceAxisKey: () => 'x',
        sectionBox: { setExtent },
        onHandlesChanged,
      });
      expect(setExtent).not.toHaveBeenCalled();
      expect(onHandlesChanged).not.toHaveBeenCalled();
    });
  });
});
