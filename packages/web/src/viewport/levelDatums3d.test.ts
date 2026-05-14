import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import type { Element } from '@bim-ai/core';
import {
  levelDatumBoundsFromBox,
  makeLevelDatum3dGroup,
  resolveLevelDatum3dRows,
  selectableLevelDatumId,
} from './levelDatums3d';

const levels: Record<string, Element> = {
  'lvl-ground': { kind: 'level', id: 'lvl-ground', name: 'Ground floor', elevationMm: 0 },
  'lvl-first': { kind: 'level', id: 'lvl-first', name: 'First floor', elevationMm: 3000 },
  'lvl-roof': { kind: 'level', id: 'lvl-roof', name: 'Roof', elevationMm: 6200 },
};

describe('3D level datums', () => {
  it('marks the active authoring level and preserves elevation order', () => {
    const rows = resolveLevelDatum3dRows(levels, 'lvl-first', { 'lvl-roof': true });

    expect(rows.map((row) => row.id)).toEqual(['lvl-ground', 'lvl-first', 'lvl-roof']);
    expect(rows.find((row) => row.id === 'lvl-first')?.active).toBe(true);
    expect(rows.find((row) => row.id === 'lvl-roof')?.hidden).toBe(true);
  });

  it('falls back to the lowest level when the active store id is missing', () => {
    const rows = resolveLevelDatum3dRows(levels, 'missing', {});

    expect(rows.find((row) => row.active)?.id).toBe('lvl-ground');
  });

  it('pads model extents so level heads sit outside the building footprint', () => {
    const bounds = levelDatumBoundsFromBox({
      min: { x: 2, z: -1 },
      max: { x: 8, z: 5 },
    });

    expect(bounds.min.x).toBeLessThan(2);
    expect(bounds.max.x).toBeGreaterThan(8);
    expect(bounds.min.z).toBeLessThan(-1);
    expect(bounds.max.z).toBeGreaterThan(5);
  });

  it('builds Revit-like level lines and an active blue work plane', () => {
    const rows = resolveLevelDatum3dRows(levels, 'lvl-first', { 'lvl-roof': true });
    const group = makeLevelDatum3dGroup(rows, {
      min: { x: -4, z: -3 },
      max: { x: 7, z: 5 },
    });

    const activePlane = group.children.find(
      (child) => child.userData.levelDatumKind === 'active-plane',
    );
    const hiddenRoofExtent = group.children.find(
      (child) =>
        child.userData.levelDatumKind === 'extent' && child.userData.levelDatumId === 'lvl-roof',
    );
    const activeExtent = group.children.find(
      (child) =>
        child.userData.levelDatumKind === 'extent' && child.userData.levelDatumId === 'lvl-first',
    );

    expect(group.userData.revitLevelDatum3d).toBe(true);
    expect(activePlane).toBeInstanceOf(THREE.Mesh);
    expect(activePlane?.position.y).toBe(3);
    expect(hiddenRoofExtent).toBeUndefined();
    expect(activeExtent).toBeInstanceOf(THREE.Line);
  });

  it('allows selecting level heads and lines without making the active plane a click target', () => {
    const rows = resolveLevelDatum3dRows(levels, 'lvl-first', {});
    const group = makeLevelDatum3dGroup(rows, {
      min: { x: -4, z: -3 },
      max: { x: 7, z: 5 },
    });
    const activePlane = group.children.find(
      (child) => child.userData.levelDatumKind === 'active-plane',
    );
    const activeHead = group.children.find(
      (child) =>
        child.userData.levelDatumKind === 'head' && child.userData.levelDatumId === 'lvl-first',
    );
    const activeHeadHitTarget = group.children.find(
      (child) =>
        child.userData.levelDatumKind === 'head-hit-target' &&
        child.userData.levelDatumId === 'lvl-first',
    );

    expect(selectableLevelDatumId(activeHead!)).toBe('lvl-first');
    expect(selectableLevelDatumId(activeHeadHitTarget!)).toBe('lvl-first');
    expect(selectableLevelDatumId(activePlane!)).toBeNull();
  });
});
