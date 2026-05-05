import { describe, expect, it } from 'vitest';
import { SectionBox } from './sectionBox';

describe('SectionBox — spec §15.6', () => {
  it('starts inactive with the documented default extents', () => {
    const box = new SectionBox();
    const snap = box.snapshot();
    expect(snap.active).toBe(false);
    expect(snap.max.x - snap.min.x).toBeCloseTo(12, 5);
    expect(snap.max.y - snap.min.y).toBeCloseTo(6.5, 5);
    expect(snap.max.z - snap.min.z).toBeCloseTo(8.4, 5);
  });

  it('toggle flips active', () => {
    const box = new SectionBox();
    box.toggle();
    expect(box.snapshot().active).toBe(true);
    box.toggle();
    expect(box.snapshot().active).toBe(false);
  });

  it('dragHandle moves a face but cannot invert the box', () => {
    const box = new SectionBox();
    box.dragHandle('x-min', 100); // would push min past max
    const snap = box.snapshot();
    expect(snap.min.x).toBeLessThan(snap.max.x);
  });

  it('summary renders dimensions per spec sample', () => {
    const box = new SectionBox();
    expect(box.summary()).toBe('Section box: 12.0 m × 6.5 m × 8.4 m');
  });

  it('clippingPlanes is empty when inactive', () => {
    expect(new SectionBox().clippingPlanes()).toHaveLength(0);
  });

  it('clippingPlanes returns 6 inward normals when active', () => {
    const box = new SectionBox();
    box.setActive(true);
    const planes = box.clippingPlanes();
    expect(planes).toHaveLength(6);
    // Each axis should have a +1 and a -1 normal.
    const xs = planes.filter((p) => Math.abs(p.normal.x) === 1);
    expect(xs.map((p) => p.normal.x).sort()).toEqual([-1, 1]);
  });

  it('contains tests world-space membership', () => {
    const box = new SectionBox();
    box.setActive(true);
    expect(box.contains({ x: 0, y: 1, z: 0 })).toBe(true);
    expect(box.contains({ x: 100, y: 0, z: 0 })).toBe(false);
  });

  it('contains returns true for all points when inactive', () => {
    const box = new SectionBox();
    expect(box.contains({ x: 9999, y: -9999, z: 0 })).toBe(true);
  });

  it('setBox normalizes swapped min/max input', () => {
    const box = new SectionBox();
    box.setBox({ x: 5, y: 5, z: 5 }, { x: -5, y: -5, z: -5 });
    const snap = box.snapshot();
    expect(snap.min.x).toBe(-5);
    expect(snap.max.x).toBe(5);
  });
});
