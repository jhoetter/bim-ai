import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import type { Element } from '@bim-ai/core';

import {
  applyCsgWallFaceMaterialGroups,
  CSG_WALL_FACE_MATERIAL_INDEX,
  makeCsgWallMaterial,
  summarizeCsgWallMaterialGoldenStatus,
} from './csgWallMaterial';

describe('CSG wall material replacement', () => {
  it('preserves procedural material maps for realistic mode', () => {
    const { material } = makeCsgWallMaterial({
      materialKey: 'masonry_brick',
      paint: null,
      elementsById: {},
      lenM: 4,
      heightM: 3,
      textureMapsVisible: true,
    });

    expect(material).toBeInstanceOf(THREE.MeshStandardMaterial);
    const standard = material as THREE.MeshStandardMaterial;
    expect(standard.userData.materialKey).toBe('masonry_brick');
    expect(standard.map?.name).toBe('masonry_brick:procedural:albedo');
    expect(standard.bumpMap?.name).toBe('masonry_brick:procedural:bump');
  });

  it('hides texture maps immediately for shaded mode', () => {
    const { material } = makeCsgWallMaterial({
      materialKey: 'masonry_brick',
      paint: null,
      elementsById: {},
      lenM: 4,
      heightM: 3,
      textureMapsVisible: false,
    });

    const standard = material as THREE.MeshStandardMaterial;
    expect(standard.map).toBeNull();
    expect(standard.bumpMap).toBeNull();
  });

  it('builds exterior, interior, and generated cut materials for CSG replacement walls', () => {
    const wallType: Extract<Element, { kind: 'wall_type' }> = {
      kind: 'wall_type',
      id: 'wt-csg',
      name: 'CSG masonry wall',
      layers: [
        { function: 'finish', materialKey: 'masonry_brick', thicknessMm: 102 },
        { function: 'structure', materialKey: 'masonry_block', thicknessMm: 100 },
        { function: 'finish', materialKey: 'plaster', thicknessMm: 13 },
      ],
    };
    const wall: Extract<Element, { kind: 'wall' }> = {
      kind: 'wall',
      id: 'w-csg',
      name: 'CSG wall',
      levelId: 'l1',
      start: { xMm: 0, yMm: 0 },
      end: { xMm: 4000, yMm: 0 },
      thicknessMm: 215,
      heightMm: 3000,
      wallTypeId: wallType.id,
    };

    const { material } = makeCsgWallMaterial({
      materialKey: 'white_render',
      wall,
      paint: null,
      elementsById: { [wallType.id]: wallType },
      lenM: 4,
      heightM: 3,
      textureMapsVisible: true,
    });

    expect(Array.isArray(material)).toBe(true);
    const materials = material as THREE.Material[];
    expect(materials[CSG_WALL_FACE_MATERIAL_INDEX.exterior]?.userData.materialKey).toBe(
      'masonry_brick',
    );
    expect(materials[CSG_WALL_FACE_MATERIAL_INDEX.interior]?.userData.materialKey).toBe('plaster');
    expect(materials[CSG_WALL_FACE_MATERIAL_INDEX.generatedCut]?.userData.materialKey).toBe(
      'masonry_block',
    );
  });

  it('assigns material groups to exterior/interior boundary faces and generated opening cuts', () => {
    const wallGeom = new THREE.BoxGeometry(4, 3, 0.2);
    applyCsgWallFaceMaterialGroups(wallGeom, { lenM: 4, heightM: 3, thickM: 0.2 });
    const groupIndexes = new Set(wallGeom.groups.map((group) => group.materialIndex));
    expect(groupIndexes.has(CSG_WALL_FACE_MATERIAL_INDEX.exterior)).toBe(true);
    expect(groupIndexes.has(CSG_WALL_FACE_MATERIAL_INDEX.interior)).toBe(true);
    expect(groupIndexes.has(CSG_WALL_FACE_MATERIAL_INDEX.top)).toBe(true);
    expect(groupIndexes.has(CSG_WALL_FACE_MATERIAL_INDEX.bottom)).toBe(true);

    const cutFaceGeom = new THREE.BufferGeometry();
    cutFaceGeom.setAttribute(
      'position',
      new THREE.Float32BufferAttribute([0, -1, -0.08, 0, 1, -0.08, 0, 1, 0.08], 3),
    );
    applyCsgWallFaceMaterialGroups(cutFaceGeom, { lenM: 4, heightM: 3, thickM: 0.2 });
    expect(cutFaceGeom.groups).toEqual([
      { start: 0, count: 3, materialIndex: CSG_WALL_FACE_MATERIAL_INDEX.generatedCut },
    ]);
  });

  it('emits structured golden status for generated CSG cut-face material coverage', () => {
    const wall: Extract<Element, { kind: 'wall' }> = {
      kind: 'wall',
      id: 'w-csg-status',
      name: 'CSG wall status',
      levelId: 'l1',
      start: { xMm: 0, yMm: 0 },
      end: { xMm: 4000, yMm: 0 },
      thicknessMm: 215,
      heightMm: 3000,
      materialKey: 'masonry_brick',
    };
    const cutFaceGeom = new THREE.BufferGeometry();
    cutFaceGeom.setAttribute(
      'position',
      new THREE.Float32BufferAttribute([0, -1, -0.08, 0, 1, -0.08, 0, 1, 0.08], 3),
    );
    applyCsgWallFaceMaterialGroups(cutFaceGeom, { lenM: 4, heightM: 3, thickM: 0.2 });
    const { material } = makeCsgWallMaterial({
      materialKey: 'masonry_brick',
      wall,
      paint: null,
      elementsById: {},
      lenM: 4,
      heightM: 3,
      textureMapsVisible: true,
    });

    const status = summarizeCsgWallMaterialGoldenStatus(cutFaceGeom, material);

    expect(status).toMatchObject({
      format: 'csgWallMaterialGoldenStatus_v1',
      ok: true,
      triangleCount: 1,
      materialKeysByRole: {
        generatedCut: 'masonry_brick',
      },
    });
    expect(status.materialGroupTriangleCounts.generatedCut).toBe(1);
    expect(status.diagnostics).toEqual([]);
  });
});
