import { describe, expect, it } from 'vitest';
import { classifyKey, WalkController } from './walkMode';

describe('classifyKey', () => {
  it('maps WASD + QE to walk keys', () => {
    expect(classifyKey('w')).toBe('forward');
    expect(classifyKey('a')).toBe('strafeLeft');
    expect(classifyKey('s')).toBe('back');
    expect(classifyKey('d')).toBe('strafeRight');
    expect(classifyKey('q')).toBe('down');
    expect(classifyKey('e')).toBe('up');
  });
  it('maps arrow keys to walk equivalents', () => {
    expect(classifyKey('ArrowUp')).toBe('forward');
    expect(classifyKey('ArrowLeft')).toBe('strafeLeft');
  });
  it('returns null for unrelated keys', () => {
    expect(classifyKey('x')).toBeNull();
  });
});

describe('WalkController — spec §15.3', () => {
  it('does not move while inactive', () => {
    const w = new WalkController();
    w.setKey('forward', true);
    w.update(1);
    const s = w.snapshot();
    expect(s.position).toEqual({ x: 0, y: 1.7, z: 0 });
  });

  it('moves forward along +Z when yaw=0', () => {
    const w = new WalkController();
    w.setActive(true);
    w.setKey('forward', true);
    w.update(1);
    const s = w.snapshot();
    expect(s.position.z).toBeGreaterThan(0);
    expect(Math.abs(s.position.x)).toBeLessThan(1e-4);
  });

  it('strafes along +X when yaw=0 and right pressed', () => {
    const w = new WalkController();
    w.setActive(true);
    w.setKey('strafeRight', true);
    w.update(1);
    const s = w.snapshot();
    expect(s.position.x).toBeGreaterThan(0);
    expect(Math.abs(s.position.z)).toBeLessThan(1e-4);
  });

  it('Q/E lower / raise position', () => {
    const w = new WalkController();
    w.setActive(true);
    w.setKey('up', true);
    w.update(1);
    expect(w.snapshot().position.y).toBeGreaterThan(1.7);
    w.setKey('up', false);
    w.setKey('down', true);
    w.update(2);
    expect(w.snapshot().position.y).toBeLessThan(1.7);
  });

  it('Shift / running multiplies translation', () => {
    const slow = new WalkController();
    slow.setActive(true);
    slow.setKey('forward', true);
    slow.update(1);

    const fast = new WalkController();
    fast.setActive(true);
    fast.setKey('forward', true);
    fast.setRunning(true);
    fast.update(1);

    expect(fast.snapshot().position.z).toBeGreaterThan(slow.snapshot().position.z);
  });

  it('velocity smoothing: movement decays after key release', () => {
    const w = new WalkController();
    w.setActive(true);
    w.setKey('forward', true);
    w.update(0.5);
    const midZ = w.snapshot().position.z;
    w.setKey('forward', false);
    w.update(0.5); // coast with decaying velocity
    const finalZ = w.snapshot().position.z;
    // Must have moved further (coasting), but less than if key stayed down
    expect(finalZ).toBeGreaterThan(midZ);
    w.update(2); // velocity should fully decay
    const afterDecayZ = w.snapshot().position.z;
    // Should have barely moved compared to a fresh 2s with no key
    expect(afterDecayZ - finalZ).toBeLessThan(0.05);
  });

  it('teleport sets position and yaw, resets pitch and velocity', () => {
    const w = new WalkController();
    w.setActive(true);
    w.setKey('forward', true);
    w.update(1);
    w.teleport({ x: 10, y: 2, z: 20 }, Math.PI);
    const s = w.snapshot();
    expect(s.position).toEqual({ x: 10, y: 2, z: 20 });
    expect(s.yaw).toBe(Math.PI);
    expect(s.pitch).toBe(0);
    // velocity zeroed — no movement after teleport without key
    w.setKey('forward', false);
    w.update(0.1);
    expect(Math.abs(w.snapshot().position.z - 20)).toBeLessThan(0.01);
  });

  it('jumpFloor snaps to next storey above', () => {
    const w = new WalkController({ position: { x: 0, y: 1.7, z: 0 } });
    w.setActive(true);
    w.setLevels([0, 3.0, 6.0]);
    w.jumpFloor(1);
    // eye height above floor 3.0 = 3.0 + 1.7 = 4.7
    expect(w.snapshot().position.y).toBeCloseTo(4.7, 5);
  });

  it('jumpFloor snaps to previous storey below', () => {
    const w = new WalkController({ position: { x: 0, y: 4.7, z: 0 } });
    w.setActive(true);
    w.setLevels([0, 3.0, 6.0]);
    w.jumpFloor(-1);
    // floor below eye at 4.7 - 1.7 = 3.0 is floor 0; eye = 0 + 1.7 = 1.7
    expect(w.snapshot().position.y).toBeCloseTo(1.7, 5);
  });

  it('jumpFloor does nothing at top/bottom boundary', () => {
    const w = new WalkController({ position: { x: 0, y: 1.7, z: 0 } });
    w.setActive(true);
    w.setLevels([0, 3.0]);
    w.jumpFloor(-1); // already at ground
    expect(w.snapshot().position.y).toBeCloseTo(1.7, 5);
    w.jumpFloor(1); // up to floor 1
    w.jumpFloor(1); // already at top
    expect(w.snapshot().position.y).toBeCloseTo(3.0 + 1.7, 5);
  });

  it('mouseLook clamps pitch to ±π/2 range', () => {
    const w = new WalkController();
    w.setActive(true);
    w.mouseLook(0, -100000);
    expect(w.snapshot().pitch).toBeLessThan(Math.PI / 2);
    w.mouseLook(0, 200000);
    expect(w.snapshot().pitch).toBeGreaterThan(-Math.PI / 2);
  });

  it('mouseLook is ignored when inactive', () => {
    const w = new WalkController();
    w.mouseLook(100, 100);
    expect(w.snapshot().yaw).toBe(0);
  });

  it('viewDirection points along yaw/pitch', () => {
    const w = new WalkController();
    w.setActive(true);
    const d = w.viewDirection();
    expect(d.x).toBeCloseTo(0, 6);
    expect(d.y).toBeCloseTo(0, 6);
    expect(d.z).toBeCloseTo(1, 6);
  });

  it('setActive(false) clears keys, stops running, zeros velocity', () => {
    const w = new WalkController();
    w.setActive(true);
    w.setKey('forward', true);
    w.setRunning(true);
    w.setActive(false);
    w.setActive(true);
    w.update(1);
    const s = w.snapshot();
    expect(s.position).toEqual({ x: 0, y: 1.7, z: 0 });
    expect(s.running).toBe(false);
  });
});
