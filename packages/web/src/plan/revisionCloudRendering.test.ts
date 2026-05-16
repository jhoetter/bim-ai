import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import type { Element } from '@bim-ai/core';

import { revisionCloudPlanThree } from './planElementMeshBuilders';
import { rebuildPlanMeshes } from './symbology';

type RevisionCloud = Extract<Element, { kind: 'revision_cloud' }>;

const baseCloud: RevisionCloud = {
  kind: 'revision_cloud',
  id: 'rc-1',
  hostViewId: 'view-1',
  boundaryMm: [
    { xMm: 0, yMm: 0 },
    { xMm: 5000, yMm: 0 },
    { xMm: 5000, yMm: 3000 },
    { xMm: 0, yMm: 3000 },
  ],
} as RevisionCloud;

describe('revisionCloudPlanThree', () => {
  it('4 points produces a closed polygon with 5 vertices (n+1)', () => {
    const grp = revisionCloudPlanThree(baseCloud);
    const line = grp.children[0] as THREE.Line;
    expect(line).toBeInstanceOf(THREE.Line);
    const positions = line.geometry.getAttribute('position') as THREE.BufferAttribute;
    expect(positions.count).toBe(5);
  });

  it('uses LineDashedMaterial', () => {
    const grp = revisionCloudPlanThree(baseCloud);
    const line = grp.children[0] as THREE.Line;
    expect(line.material).toBeInstanceOf(THREE.LineDashedMaterial);
  });

  it('applies default orange colour when no colour set', () => {
    const grp = revisionCloudPlanThree(baseCloud);
    const line = grp.children[0] as THREE.Line;
    const mat = line.material as THREE.LineDashedMaterial;
    expect(mat.color.getHexString()).toBe('e05000');
  });

  it('applies custom colour when provided', () => {
    const custom = { ...baseCloud, colour: '#0000ff' } as RevisionCloud;
    const grp = revisionCloudPlanThree(custom);
    const mat = (grp.children[0] as THREE.Line).material as THREE.LineDashedMaterial;
    expect(mat.color.getHexString()).toBe('0000ff');
  });

  it('sets bimPickId on group and line', () => {
    const grp = revisionCloudPlanThree(baseCloud);
    expect(grp.userData.bimPickId).toBe('rc-1');
    expect((grp.children[0] as THREE.Line).userData.bimPickId).toBe('rc-1');
  });

  it('returns empty group for fewer than 2 points', () => {
    const empty = { ...baseCloud, boundaryMm: [{ xMm: 0, yMm: 0 }] } as RevisionCloud;
    const grp = revisionCloudPlanThree(empty);
    expect(grp.children).toHaveLength(0);
  });

  it('integrates via rebuildPlanMeshes scoped to the correct view', () => {
    const elementsById: Record<string, Element> = {
      'lvl-1': { kind: 'level', id: 'lvl-1', name: 'L1', elevationMm: 0 } as Element,
      'rc-1': baseCloud,
      'rc-2': { ...baseCloud, id: 'rc-2', hostViewId: 'view-2' } as RevisionCloud,
    };
    const holder = new THREE.Group();
    rebuildPlanMeshes(holder, elementsById, { activeLevelId: 'lvl-1', activeViewId: 'view-1' });
    const hits = holder.children.filter((c) => c.userData.bimPickId?.startsWith('rc-'));
    expect(hits).toHaveLength(1);
    expect(hits[0]!.userData.bimPickId).toBe('rc-1');
  });
});
