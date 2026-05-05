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
    expect(Math.abs(s.position.x)).toBeLessThan(1e-6);
  });

  it('strafes along +X when yaw=0 and right pressed', () => {
    const w = new WalkController();
    w.setActive(true);
    w.setKey('strafeRight', true);
    w.update(1);
    const s = w.snapshot();
    expect(s.position.x).toBeGreaterThan(0);
    expect(Math.abs(s.position.z)).toBeLessThan(1e-6);
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

  it('setActive(false) clears keys and stops running', () => {
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
