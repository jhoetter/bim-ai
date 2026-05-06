import { describe, expect, it } from 'vitest';
import { classifyHotkey, classifyPointer, createCameraRig, wheelDelta } from './cameraRig';

describe('CameraRig — spec §15.3', () => {
  it('places the camera on the target+azimuth+elevation+radius sphere', () => {
    const rig = createCameraRig({
      target: { x: 0, y: 1, z: 0 },
      azimuth: 0,
      elevation: 0,
      radius: 10,
    });
    const snap = rig.snapshot();
    expect(snap.position.x).toBeCloseTo(0, 6);
    expect(snap.position.y).toBeCloseTo(1, 6);
    expect(snap.position.z).toBeCloseTo(10, 6);
  });

  it('orbits the camera within elevation bounds', () => {
    const rig = createCameraRig({ azimuth: 0, elevation: 0.5, radius: 10 });
    rig.orbit(100, 0); // azimuth +
    rig.orbit(0, -10000); // elevation toward max — should clamp
    const snap = rig.snapshot();
    expect(snap.azimuth).toBeGreaterThan(0);
    expect(snap.elevation).toBeLessThanOrEqual(Math.PI / 2);
  });

  it('dollies within min/max radius', () => {
    const rig = createCameraRig({ radius: 10, minRadius: 1, maxRadius: 100 });
    rig.dolly(99999);
    expect(rig.snapshot().radius).toBe(100);
    rig.dolly(-99999);
    expect(rig.snapshot().radius).toBe(1);
  });

  it('zoomBy applies a multiplicative factor', () => {
    const rig = createCameraRig({ radius: 10 });
    rig.zoomBy(0.5);
    expect(rig.snapshot().radius).toBeCloseTo(5, 6);
    rig.zoomBy(4);
    expect(rig.snapshot().radius).toBeCloseTo(20, 6);
  });

  it('pan moves target perpendicular to view, scaled by radius', () => {
    const rig = createCameraRig({ azimuth: 0, elevation: 0, radius: 10 });
    rig.pan(100, 0);
    const snap = rig.snapshot();
    // Azimuth=0 looks toward +Z, so right is -X. Panning +dx should move
    // target toward -right, i.e. toward -(-X) = +X.
    expect(Math.abs(snap.target.x)).toBeGreaterThan(0);
  });

  it('frame fits a bounding box and centers the target', () => {
    const rig = createCameraRig({ radius: 10 });
    rig.frame({ min: { x: -5, y: 0, z: -10 }, max: { x: 5, y: 6, z: 10 } });
    const snap = rig.snapshot();
    expect(snap.target.x).toBeCloseTo(0, 6);
    expect(snap.target.y).toBeCloseTo(3, 6);
    expect(snap.target.z).toBeCloseTo(0, 6);
    expect(snap.radius).toBeGreaterThan(10);
  });

  it('reset returns to the home view', () => {
    const rig = createCameraRig({ azimuth: 0.1, radius: 10 });
    rig.orbit(500, 200);
    rig.reset();
    expect(rig.snapshot().azimuth).toBe(0.1);
  });

  it('setHome updates the saved view', () => {
    const rig = createCameraRig({ azimuth: 0, radius: 10 });
    rig.orbit(50, 50);
    rig.setHome();
    rig.orbit(500, 500);
    rig.reset();
    const snap = rig.snapshot();
    expect(snap.azimuth).toBeGreaterThan(0);
  });

  it('applyViewpoint sets target + computes radius/azimuth/elevation', () => {
    const rig = createCameraRig();
    rig.applyViewpoint({ x: 10, y: 0, z: 10 }, { x: 0, y: 0, z: 0 }, { x: 0, y: 1, z: 0 });
    const snap = rig.snapshot();
    expect(snap.target).toEqual({ x: 0, y: 0, z: 0 });
    expect(snap.radius).toBeCloseTo(Math.hypot(10, 0, 10), 6);
  });
});

describe('classifyPointer', () => {
  it('Alt + LMB → orbit', () => {
    expect(classifyPointer({ button: 0, altKey: true })).toBe('orbit');
  });
  it('Middle mouse → pan', () => {
    expect(classifyPointer({ button: 1 })).toBe('pan');
  });
  it('Right mouse → pan', () => {
    expect(classifyPointer({ button: 2 })).toBe('pan');
  });
  it('Shift + LMB → pan', () => {
    expect(classifyPointer({ button: 0, shiftKey: true })).toBe('pan');
  });
  it('Shift + Middle mouse → pan', () => {
    expect(classifyPointer({ button: 1, shiftKey: true })).toBe('pan');
  });
  it('plain LMB → idle', () => {
    expect(classifyPointer({ button: 0 })).toBe('idle');
  });
});

describe('wheelDelta', () => {
  it('passes through plain wheel deltas', () => {
    expect(wheelDelta({ deltaY: 24 })).toBe(24);
  });
  it('dampens pinch (ctrl-modified)', () => {
    expect(wheelDelta({ deltaY: 24, ctrlKey: true })).toBe(12);
  });
  it('normalises deltaMode=1 (line scroll)', () => {
    expect(wheelDelta({ deltaY: 3, deltaMode: 1 })).toBe(60);
  });
  it('normalises deltaMode=2 (page scroll)', () => {
    expect(wheelDelta({ deltaY: 1, deltaMode: 2 })).toBe(600);
  });
});

describe('classifyHotkey', () => {
  it('F → frame-all', () => {
    expect(classifyHotkey({ key: 'F' })?.kind).toBe('frame-all');
  });
  it('⌘F → frame-selection', () => {
    expect(classifyHotkey({ key: 'f', metaKey: true })?.kind).toBe('frame-selection');
  });
  it('⌘= → zoom-in', () => {
    expect(classifyHotkey({ key: '=', metaKey: true })?.kind).toBe('zoom-in');
  });
  it('⌘- → zoom-out', () => {
    expect(classifyHotkey({ key: '-', metaKey: true })?.kind).toBe('zoom-out');
  });
  it('Home → reset', () => {
    expect(classifyHotkey({ key: 'Home' })?.kind).toBe('reset');
  });
  it('unrelated → null', () => {
    expect(classifyHotkey({ key: 'A' })).toBeNull();
  });
});
