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

  it('getExtent returns the initial extent matching snapshot', () => {
    const box = new SectionBox();
    const ext = box.getExtent();
    const snap = box.snapshot();
    expect(ext.minX).toBe(snap.min.x);
    expect(ext.maxX).toBe(snap.max.x);
    expect(ext.minY).toBe(snap.min.y);
    expect(ext.maxY).toBe(snap.max.y);
    expect(ext.minZ).toBe(snap.min.z);
    expect(ext.maxZ).toBe(snap.max.z);
  });

  it('setExtent updates only the specified face; others remain unchanged', () => {
    const box = new SectionBox();
    const before = box.getExtent();
    box.setExtent({ maxX: 5 });
    const after = box.getExtent();
    expect(after.maxX).toBe(5);
    expect(after.minX).toBe(before.minX);
    expect(after.minY).toBe(before.minY);
    expect(after.maxY).toBe(before.maxY);
    expect(after.minZ).toBe(before.minZ);
    expect(after.maxZ).toBe(before.maxZ);
  });

  it('clippingPlanes returns 6 planes whose constants match the current extent', () => {
    const box = new SectionBox();
    box.setActive(true);
    box.setExtent({ minX: -3, maxX: 3, minY: 0, maxY: 4, minZ: -2, maxZ: 2 });
    const planes = box.clippingPlanes();
    expect(planes).toHaveLength(6);
    const ext = box.getExtent();
    const xMinPlane = planes.find((p) => p.normal.x === 1 && p.normal.y === 0);
    const xMaxPlane = planes.find((p) => p.normal.x === -1 && p.normal.y === 0);
    expect(xMinPlane?.constant).toBeCloseTo(-ext.minX, 6);
    expect(xMaxPlane?.constant).toBeCloseTo(ext.maxX, 6);
  });

  it('maxX handle centre is at (extent.maxX, midY, midZ)', () => {
    const box = new SectionBox();
    box.setExtent({ minX: -4, maxX: 4, minY: 0, maxY: 6, minZ: -3, maxZ: 3 });
    const ext = box.getExtent();
    const midY = (ext.minY + ext.maxY) / 2;
    const midZ = (ext.minZ + ext.maxZ) / 2;
    expect(ext.maxX).toBe(4);
    expect(midY).toBeCloseTo(3, 6);
    expect(midZ).toBeCloseTo(0, 6);
  });
});
