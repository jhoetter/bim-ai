import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import type { Element } from '@bim-ai/core';

import { referencePlanePlanThree } from './planElementMeshBuilders';
import { rebuildPlanMeshes } from './symbology';

type ProjectRefPlane = Extract<Element, { kind: 'reference_plane' }>;

const projectPlane: ProjectRefPlane = {
  kind: 'reference_plane',
  id: 'rp-1',
  name: 'Symmetry',
  levelId: 'lvl-1',
  startMm: { xMm: 0, yMm: 1000 },
  endMm: { xMm: 6000, yMm: 1000 },
} as ProjectRefPlane;

const workPlane: ProjectRefPlane = {
  ...projectPlane,
  id: 'rp-2',
  isWorkPlane: true,
} as ProjectRefPlane;

describe('KRN-05 — referencePlanePlanThree', () => {
  it('emits a dashed Line for the plane segment with the reference plane id pickable', () => {
    const grp = referencePlanePlanThree(projectPlane);
    expect(grp).toBeInstanceOf(THREE.Group);
    expect(grp.userData.bimPickId).toBe('rp-1');

    const line = grp.children.find((c) => c instanceof THREE.Line) as THREE.Line | undefined;
    expect(line).toBeTruthy();
    const mat = (line as THREE.Line).material as THREE.LineDashedMaterial;
    expect(mat).toBeInstanceOf(THREE.LineDashedMaterial);
    expect(mat.dashSize).toBeGreaterThan(0);
    expect(mat.gapSize).toBeGreaterThan(0);
  });

  it('uses the work-plane accent color when isWorkPlane is true', () => {
    const grpInactive = referencePlanePlanThree(projectPlane);
    const grpActive = referencePlanePlanThree(workPlane);

    const inactiveLine = grpInactive.children.find((c) => c instanceof THREE.Line) as THREE.Line;
    const activeLine = grpActive.children.find((c) => c instanceof THREE.Line) as THREE.Line;
    const inactiveMat = inactiveLine.material as THREE.LineDashedMaterial;
    const activeMat = activeLine.material as THREE.LineDashedMaterial;
    expect(inactiveMat.color.getHex()).not.toBe(activeMat.color.getHex());
  });

  it('emits a label sprite carrying the plane name (or fallback)', () => {
    const grp = referencePlanePlanThree(projectPlane);
    const sprites = grp.children.filter((c) => c.userData.referencePlaneLabelSprite);
    expect(sprites.length).toBe(1);
    expect(grp.userData.referencePlaneLabel).toBe('Symmetry');
  });

  it('falls back to the auto-numbered label when name is empty', () => {
    const unnamed: ProjectRefPlane = {
      ...projectPlane,
      id: 'rp-3',
      name: '',
    } as ProjectRefPlane;
    const grp = referencePlanePlanThree(unnamed, 'RP-7');
    expect(grp.userData.referencePlaneLabel).toBe('RP-7');
  });
});

describe('KRN-05 — rebuildPlanMeshes integration', () => {
  it('renders project ref planes for the active level only', () => {
    const elementsById: Record<string, Element> = {
      'lvl-1': {
        kind: 'level',
        id: 'lvl-1',
        name: 'Ground',
        elevationMm: 0,
      } as Element,
      'lvl-2': {
        kind: 'level',
        id: 'lvl-2',
        name: 'L1',
        elevationMm: 3000,
      } as Element,
      'rp-a': { ...projectPlane, id: 'rp-a' } as ProjectRefPlane,
      'rp-b': { ...projectPlane, id: 'rp-b', levelId: 'lvl-2' } as ProjectRefPlane,
    };
    const holder = new THREE.Group();
    rebuildPlanMeshes(holder, elementsById, { activeLevelId: 'lvl-1' });
    const refPlaneGroups = holder.children.filter((c) => c.userData.referencePlaneLabel);
    expect(refPlaneGroups.length).toBe(1);
    expect(refPlaneGroups[0]!.userData.bimPickId).toBe('rp-a');
  });

  it('skips the family-editor reference_plane variant', () => {
    const familyVariant = {
      kind: 'reference_plane',
      id: 'fam-rp',
      name: 'Center',
      familyEditorId: 'fam-1',
      isVertical: true,
      offsetMm: 0,
    } as Element;
    const elementsById: Record<string, Element> = {
      'lvl-1': {
        kind: 'level',
        id: 'lvl-1',
        name: 'Ground',
        elevationMm: 0,
      } as Element,
      'fam-rp': familyVariant,
    };
    const holder = new THREE.Group();
    rebuildPlanMeshes(holder, elementsById, { activeLevelId: 'lvl-1' });
    const refPlaneGroups = holder.children.filter((c) => c.userData.referencePlaneLabel);
    expect(refPlaneGroups.length).toBe(0);
  });
});
