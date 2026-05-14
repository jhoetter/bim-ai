/**
 * KRN-12 + FAM-02: window frame geometry varies with outlineKind.
 *
 * Rectangular outlines retain the original 4-box frame; non-rectangular
 * outlines build a sweep-based perimeter frame.
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import type { Element } from '@bim-ai/core';
import { buildWindowGeometry } from './windowGeometry';

type WindowElem = Extract<Element, { kind: 'window' }>;
type WallElem = Extract<Element, { kind: 'wall' }>;
type LevelElem = Extract<Element, { kind: 'level' }>;
type RoofElem = Extract<Element, { kind: 'roof' }>;

const baseLevel: LevelElem = {
  kind: 'level',
  id: 'lvl0',
  name: 'GF',
  elevationMm: 0,
};

const baseWall: WallElem = {
  kind: 'wall',
  id: 'w1',
  name: 'Wall',
  levelId: 'lvl0',
  start: { xMm: 0, yMm: 0 },
  end: { xMm: 10000, yMm: 0 },
  thicknessMm: 200,
  heightMm: 2800,
};

const els = (...extra: Element[]): Record<string, Element> => {
  const out: Record<string, Element> = {
    [baseLevel.id]: baseLevel,
    [baseWall.id]: baseWall,
  };
  for (const e of extra) out[e.id] = e;
  return out;
};

function win(over?: Partial<WindowElem>): WindowElem {
  return {
    kind: 'window',
    id: 'win1',
    name: 'Win',
    wallId: 'w1',
    alongT: 0.5,
    widthMm: 1200,
    sillHeightMm: 900,
    heightMm: 1500,
    ...over,
  };
}

function meshes(group: THREE.Group): THREE.Mesh[] {
  const out: THREE.Mesh[] = [];
  group.traverse((node) => {
    if (node instanceof THREE.Mesh) out.push(node);
  });
  return out;
}

function meshBoundingBox(meshList: THREE.Mesh[]): THREE.Box3 {
  const box = new THREE.Box3();
  for (const m of meshList) {
    m.geometry.computeBoundingBox();
    if (m.geometry.boundingBox) box.union(m.geometry.boundingBox);
  }
  return box;
}

describe('buildWindowGeometry — rectangular regression', () => {
  it('rectangular outline still builds the 4-box frame group + glass', () => {
    const grp = buildWindowGeometry({
      win: win(),
      wall: baseWall,
      elevM: 0,
      paint: null,
      familyDef: undefined,
      elementsById: els(),
    });
    // Find the inner frame Group (4 box meshes).
    let frameGroup: THREE.Group | null = null;
    grp.traverse((node) => {
      if (node instanceof THREE.Group && node !== grp) {
        const childMeshes = node.children.filter((c) => c instanceof THREE.Mesh);
        if (childMeshes.length === 4) frameGroup = node;
      }
    });
    expect(frameGroup).not.toBeNull();
    // No sweep frame in rect path: rectangular still uses BoxGeometry frames.
    let foundExtrude = false;
    grp.traverse((node) => {
      if (node instanceof THREE.Mesh && node.geometry instanceof THREE.ExtrudeGeometry) {
        foundExtrude = true;
      }
    });
    expect(foundExtrude).toBe(false);
  });

  it('keeps default glazing visible in shaded views', () => {
    const grp = buildWindowGeometry({
      win: win(),
      wall: baseWall,
      elevM: 0,
      paint: null,
      familyDef: undefined,
      elementsById: els(),
    });
    const glass = meshes(grp).find((mesh) => {
      const material = mesh.material;
      return (
        material instanceof THREE.MeshPhysicalMaterial &&
        material.userData.materialKey === 'asset_clear_glass_double'
      );
    });

    expect(glass).toBeTruthy();
    const material = glass!.material as THREE.MeshPhysicalMaterial;
    expect(material.transparent).toBe(true);
    expect(material.depthWrite).toBe(false);
    expect(material.opacity).toBeGreaterThanOrEqual(0.68);
    expect(material.transmission).toBeLessThanOrEqual(0.18);
    expect(glass!.children.some((child) => child instanceof THREE.LineSegments)).toBe(true);
  });

  it('default (no outlineKind) renders the rectangular path', () => {
    const grpA = buildWindowGeometry({
      win: win(),
      wall: baseWall,
      elevM: 0,
      paint: null,
      familyDef: undefined,
      elementsById: els(),
    });
    const grpB = buildWindowGeometry({
      win: win({ outlineKind: 'rectangle' }),
      wall: baseWall,
      elevM: 0,
      paint: null,
      familyDef: undefined,
      elementsById: els(),
    });
    expect(meshes(grpA).length).toBe(meshes(grpB).length);
  });
});

describe('buildWindowGeometry — non-rectangular frame sweep (KRN-12 + FAM-02)', () => {
  it('circle outline produces a frame mesh whose bbox follows the circle', () => {
    const grp = buildWindowGeometry({
      win: win({ outlineKind: 'circle', widthMm: 1200, heightMm: 1200 }),
      wall: baseWall,
      elevM: 0,
      paint: null,
      familyDef: undefined,
      elementsById: els(),
    });
    // Expect at least 2 meshes: glass + frame sweep.
    const all = meshes(grp);
    expect(all.length).toBeGreaterThanOrEqual(2);
    // Find the sweep mesh (ExtrudeGeometry with extrudePath produces an
    // ExtrudeGeometry too — distinguish by its bbox extent in Z which is
    // wall-thickness-scale, not the 12mm glass sliver).
    const frameLike = all.filter((m) => {
      m.geometry.computeBoundingBox();
      const bb = m.geometry.boundingBox;
      if (!bb) return false;
      return bb.max.z - bb.min.z > 0.05; // depth-scale, not glass-thin
    });
    expect(frameLike.length).toBeGreaterThanOrEqual(1);
    const bb = meshBoundingBox(frameLike);
    // Circle radius = 600mm = 0.6m; bbox roughly ±0.6m on X, 0..1.2m on Y.
    expect(bb.max.x - bb.min.x).toBeGreaterThanOrEqual(1.1);
    expect(bb.max.x - bb.min.x).toBeLessThanOrEqual(1.4);
    expect(bb.max.y - bb.min.y).toBeGreaterThanOrEqual(1.1);
    expect(bb.max.y - bb.min.y).toBeLessThanOrEqual(1.4);
  });

  it('arched_top outline produces a frame following the arch profile', () => {
    const grp = buildWindowGeometry({
      win: win({ outlineKind: 'arched_top' }),
      wall: baseWall,
      elevM: 0,
      paint: null,
      familyDef: undefined,
      elementsById: els(),
    });
    const all = meshes(grp);
    const frameLike = all.filter((m) => {
      m.geometry.computeBoundingBox();
      const bb = m.geometry.boundingBox;
      if (!bb) return false;
      return bb.max.z - bb.min.z > 0.05;
    });
    expect(frameLike.length).toBeGreaterThanOrEqual(1);
    const bb = meshBoundingBox(frameLike);
    // Arched window 1200×1500mm: bbox ≈ 1.2m wide × 1.5m tall.
    expect(bb.max.x - bb.min.x).toBeGreaterThanOrEqual(1.1);
    expect(bb.max.x - bb.min.x).toBeLessThanOrEqual(1.4);
    expect(bb.max.y - bb.min.y).toBeGreaterThanOrEqual(1.4);
    expect(bb.max.y - bb.min.y).toBeLessThanOrEqual(1.7);
  });

  it('gable_trapezoid outline produces a frame following the trapezoid', () => {
    const roof: RoofElem = {
      kind: 'roof',
      id: 'roof1',
      name: 'Roof',
      referenceLevelId: 'lvl0',
      footprintMm: [
        { xMm: 0, yMm: -3000 },
        { xMm: 10000, yMm: -3000 },
        { xMm: 10000, yMm: 3000 },
        { xMm: 0, yMm: 3000 },
      ],
      slopeDeg: 30,
      ridgeAxis: 'x',
      roofGeometryMode: 'gable_pitched_rectangle',
    };
    const grp = buildWindowGeometry({
      win: win({
        outlineKind: 'gable_trapezoid',
        attachedRoofId: 'roof1',
        sillHeightMm: 200,
        widthMm: 2000,
        alongT: 0.3,
      }),
      wall: baseWall,
      elevM: 0,
      paint: null,
      familyDef: undefined,
      elementsById: els(roof),
    });
    const all = meshes(grp);
    const frameLike = all.filter((m) => {
      m.geometry.computeBoundingBox();
      const bb = m.geometry.boundingBox;
      if (!bb) return false;
      return bb.max.z - bb.min.z > 0.05;
    });
    expect(frameLike.length).toBeGreaterThanOrEqual(1);
    const bb = meshBoundingBox(frameLike);
    // Trapezoid 2000mm wide; bbox ≈ 2m on X.
    expect(bb.max.x - bb.min.x).toBeGreaterThanOrEqual(1.9);
    expect(bb.max.x - bb.min.x).toBeLessThanOrEqual(2.2);
    // Bottom of frame at outline-Y=0 (sill-centre); top reaches the roof.
    expect(bb.min.y).toBeLessThanOrEqual(0.05);
  });

  it('octagon outline produces a frame', () => {
    const grp = buildWindowGeometry({
      win: win({ outlineKind: 'octagon', widthMm: 1000, heightMm: 1000 }),
      wall: baseWall,
      elevM: 0,
      paint: null,
      familyDef: undefined,
      elementsById: els(),
    });
    const frameLike = meshes(grp).filter((m) => {
      m.geometry.computeBoundingBox();
      const bb = m.geometry.boundingBox;
      if (!bb) return false;
      return bb.max.z - bb.min.z > 0.05;
    });
    expect(frameLike.length).toBeGreaterThanOrEqual(1);
  });
});
