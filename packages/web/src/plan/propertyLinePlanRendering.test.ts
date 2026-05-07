import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import type { Element } from '@bim-ai/core';

import { propertyLinePlanThree } from './planElementMeshBuilders';
import { rebuildPlanMeshes } from './symbology';

type PropLine = Extract<Element, { kind: 'property_line' }>;

const baseLine: PropLine = {
  kind: 'property_line',
  id: 'pl-1',
  startMm: { xMm: 0, yMm: 0 },
  endMm: { xMm: 10000, yMm: 0 },
} as PropLine;

describe('KRN-01 — propertyLinePlanThree', () => {
  it('emits one solid line and no dashed line when no setback', () => {
    const grp = propertyLinePlanThree(baseLine);
    const lines = grp.children.filter((c) => c instanceof THREE.Line) as THREE.Line[];
    expect(lines.length).toBe(1);
    expect(lines[0]!.material).toBeInstanceOf(THREE.LineBasicMaterial);
    expect((lines[0]!.material as THREE.LineBasicMaterial).color.getHex()).toBe(0x2a3f5a);
  });

  it('emits a parallel dashed setback line when setbackMm is positive', () => {
    const withSetback: PropLine = { ...baseLine, setbackMm: 4500 } as PropLine;
    const grp = propertyLinePlanThree(withSetback);
    const lines = grp.children.filter((c) => c instanceof THREE.Line) as THREE.Line[];
    expect(lines.length).toBe(2);
    const dashed = lines.find((l) => l.material instanceof THREE.LineDashedMaterial);
    expect(dashed).toBeTruthy();
    expect(dashed!.userData.propertyLineSetback).toBe(true);

    // Setback line is offset perpendicular: for a horizontal line along +X with
    // length 10m the +90° normal is +Z (so y-Mm direction, world z), so the dashed
    // line endpoints should be shifted in world Z by setbackMm/1000.
    const positions = (dashed!.geometry as THREE.BufferGeometry).getAttribute(
      'position',
    ) as THREE.BufferAttribute;
    const expectedOffsetWorld = 4500 / 1000;
    expect(Math.abs(positions.getZ(0) - expectedOffsetWorld)).toBeLessThan(1e-6);
    expect(Math.abs(positions.getZ(1) - expectedOffsetWorld)).toBeLessThan(1e-6);
  });

  it('exposes classification on userData when set', () => {
    const classed: PropLine = { ...baseLine, classification: 'street' } as PropLine;
    const grp = propertyLinePlanThree(classed);
    expect(grp.userData.propertyLineClassification).toBe('street');
  });

  it('integrates via rebuildPlanMeshes regardless of active level', () => {
    const elementsById: Record<string, Element> = {
      'lvl-1': {
        kind: 'level',
        id: 'lvl-1',
        name: 'Ground',
        elevationMm: 0,
      } as Element,
      'pl-1': baseLine,
    };
    const holder = new THREE.Group();
    rebuildPlanMeshes(holder, elementsById, { activeLevelId: 'lvl-1' });
    const propGroups = holder.children.filter(
      (c) => (c as THREE.Object3D).userData.bimPickId === 'pl-1',
    );
    expect(propGroups.length).toBe(1);
  });
});
