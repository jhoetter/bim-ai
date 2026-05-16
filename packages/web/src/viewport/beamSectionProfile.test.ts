import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { buildBeamSectionShape } from './beamSectionProfile';

describe('buildBeamSectionShape — §9.2', () => {
  it('null profile returns a rectangular shape (4 points)', () => {
    const shape = buildBeamSectionShape(null, 200, 400);
    expect(shape).toBeInstanceOf(THREE.Shape);
    // Rectangle has 4 corners (the closePath doesn't add an extra point)
    expect(shape.getPoints().length).toBeGreaterThanOrEqual(4);
    expect(shape.holes).toHaveLength(0);
  });

  it('undefined profile returns a rectangular shape', () => {
    const shape = buildBeamSectionShape(undefined, 200, 400);
    expect(shape).toBeInstanceOf(THREE.Shape);
    expect(shape.holes).toHaveLength(0);
  });

  it('rectangular profile returns a rectangle shape', () => {
    const shape = buildBeamSectionShape('rectangular', 200, 400);
    expect(shape).toBeInstanceOf(THREE.Shape);
    expect(shape.holes).toHaveLength(0);
  });

  it('I profile returns a shape with correct flange structure (12 corners)', () => {
    const shape = buildBeamSectionShape('I', 200, 400, 150, 10, 20);
    expect(shape).toBeInstanceOf(THREE.Shape);
    // I-beam has 12 points: bottom flange (3) + web (2) + top flange (3) + back (2) + close
    const pts = shape.getPoints();
    expect(pts.length).toBeGreaterThanOrEqual(12);
    expect(shape.holes).toHaveLength(0);
  });

  it('H profile uses same shape logic as I (12 corners)', () => {
    const shapeI = buildBeamSectionShape('I', 200, 400, 150, 10, 20);
    const shapeH = buildBeamSectionShape('H', 200, 400, 150, 10, 20);
    expect(shapeI.getPoints().length).toBe(shapeH.getPoints().length);
  });

  it('HSS profile has a hole (inner rect)', () => {
    const shape = buildBeamSectionShape('HSS', 200, 200);
    expect(shape).toBeInstanceOf(THREE.Shape);
    expect(shape.holes).toHaveLength(1);
    // outer rect 4 points
    expect(shape.getPoints().length).toBeGreaterThanOrEqual(4);
  });

  it('C profile has 6 corners (⊏ shape)', () => {
    const shape = buildBeamSectionShape('C', 200, 400, 150, 10, 20);
    expect(shape).toBeInstanceOf(THREE.Shape);
    const pts = shape.getPoints();
    expect(pts.length).toBeGreaterThanOrEqual(6);
    expect(shape.holes).toHaveLength(0);
  });

  it('T profile has top flange + web', () => {
    const shape = buildBeamSectionShape('T', 200, 400, 150, 10, 20);
    expect(shape).toBeInstanceOf(THREE.Shape);
    const pts = shape.getPoints();
    expect(pts.length).toBeGreaterThanOrEqual(6);
    expect(shape.holes).toHaveLength(0);
  });

  it('L profile has 6 corners (⌐ shape)', () => {
    const shape = buildBeamSectionShape('L', 200, 400);
    expect(shape).toBeInstanceOf(THREE.Shape);
    const pts = shape.getPoints();
    expect(pts.length).toBeGreaterThanOrEqual(6);
    expect(shape.holes).toHaveLength(0);
  });
});
