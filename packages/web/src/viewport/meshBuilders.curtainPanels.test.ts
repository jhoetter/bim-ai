/**
 * KRN-09 — vitest for `makeCurtainWallMesh` panel overrides.
 *
 * Verifies the empty / system / family_instance override behaviours, the
 * deterministic gridCellId, and that mullions stay regardless of override.
 */
import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';

import { curtainGridCellId, type Element } from '@bim-ai/core';

import { makeCurtainWallMesh } from './meshBuilders';
import * as familyCatalogModule from '../families/familyCatalog';
import type { FamilyDefinition, SketchLine } from '../families/types';

type WallElem = Extract<Element, { kind: 'wall' }>;

const baseCurtainWall: WallElem = {
  kind: 'wall',
  id: 'cw1',
  name: 'Curtain wall',
  levelId: 'lvl0',
  start: { xMm: 0, yMm: 0 },
  end: { xMm: 6000, yMm: 0 },
  thicknessMm: 80,
  heightMm: 3000,
  isCurtainWall: true,
  curtainWallVCount: 4,
  curtainWallHCount: 2,
};

function panes(group: THREE.Group): THREE.Mesh[] {
  const out: THREE.Mesh[] = [];
  group.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.isMesh && mesh.geometry instanceof THREE.PlaneGeometry) {
      out.push(mesh);
    }
  });
  return out;
}

function paneById(group: THREE.Group, cellId: string): THREE.Mesh | null {
  return panes(group).find((m) => m.userData.curtainCellId === cellId) ?? null;
}

function mullions(group: THREE.Group): THREE.Mesh[] {
  const out: THREE.Mesh[] = [];
  group.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.isMesh && mesh.geometry instanceof THREE.BoxGeometry) out.push(mesh);
  });
  return out;
}

describe('KRN-09 — curtain wall panel grid', () => {
  it('emits one PlaneGeometry pane per grid cell (default = glass)', () => {
    const group = makeCurtainWallMesh(baseCurtainWall, 0, null);
    expect(panes(group).length).toBe(4 * 2);
  });

  it('uses deterministic v<col>h<row> cell ids', () => {
    const group = makeCurtainWallMesh(baseCurtainWall, 0, null);
    expect(paneById(group, curtainGridCellId(0, 0))).not.toBeNull();
    expect(paneById(group, curtainGridCellId(3, 1))).not.toBeNull();
    expect(paneById(group, 'v0h0')).not.toBeNull();
  });
});

describe('KRN-09 — kind: empty', () => {
  it('skips the glass pane in the overridden cell, keeping mullions present', () => {
    const wall: WallElem = {
      ...baseCurtainWall,
      curtainPanelOverrides: {
        v0h0: { kind: 'empty' },
      },
    };
    const group = makeCurtainWallMesh(wall, 0, null);
    expect(paneById(group, 'v0h0')).toBeNull();
    expect(panes(group).length).toBe(4 * 2 - 1);
    // Mullions: 5 vertical + 3 horizontal = 8 (vCount+1 + hCount+1).
    expect(mullions(group).length).toBe(5 + 3);
  });

  it('multiple empty cells leave matching gaps in the grid', () => {
    const wall: WallElem = {
      ...baseCurtainWall,
      curtainPanelOverrides: {
        v0h0: { kind: 'empty' },
        v3h1: { kind: 'empty' },
      },
    };
    const group = makeCurtainWallMesh(wall, 0, null);
    expect(panes(group).length).toBe(4 * 2 - 2);
    expect(paneById(group, 'v0h0')).toBeNull();
    expect(paneById(group, 'v3h1')).toBeNull();
    expect(paneById(group, 'v1h0')).not.toBeNull();
  });
});

describe('KRN-09 — kind: system', () => {
  it('renders a solid panel using the supplied materialKey', () => {
    const wall: WallElem = {
      ...baseCurtainWall,
      curtainPanelOverrides: {
        v1h0: { kind: 'system', materialKey: 'cladding_warm_wood' },
      },
    };
    const group = makeCurtainWallMesh(wall, 0, null);
    const pane = paneById(group, 'v1h0');
    expect(pane).not.toBeNull();
    expect(pane!.userData.curtainPanelKind).toBe('system');
    expect(pane!.userData.curtainPanelMaterialKey).toBe('cladding_warm_wood');
    const mat = pane!.material as THREE.MeshStandardMaterial;
    expect(mat).toBeInstanceOf(THREE.MeshStandardMaterial);
    expect(mat.userData.materialKey).toBe('cladding_warm_wood');
    // Procedural albedo now carries the base color; material.color remains white to avoid double tinting.
    expect(mat.map).toBeTruthy();
    expect(`#${mat.color.getHexString()}`).toBe('#ffffff');
  });

  it('falls back to glass when system override has no materialKey', () => {
    const wall: WallElem = {
      ...baseCurtainWall,
      curtainPanelOverrides: {
        v0h1: { kind: 'system' },
      },
    };
    const group = makeCurtainWallMesh(wall, 0, null);
    const pane = paneById(group, 'v0h1');
    expect(pane).not.toBeNull();
    // Default glass = MeshPhysicalMaterial; system without materialKey reuses it.
    expect(pane!.material).toBeInstanceOf(THREE.MeshPhysicalMaterial);
  });

  it('falls back to glass when system override references an unknown materialKey', () => {
    const wall: WallElem = {
      ...baseCurtainWall,
      curtainPanelOverrides: {
        v2h0: { kind: 'system', materialKey: 'definitely_not_a_real_key' },
      },
    };
    const group = makeCurtainWallMesh(wall, 0, null);
    const pane = paneById(group, 'v2h0');
    expect(pane).not.toBeNull();
    expect(pane!.material).toBeInstanceOf(THREE.MeshPhysicalMaterial);
  });
});

describe('KRN-09 — kind: family_instance', () => {
  it('renders a placeholder panel and tags the cell with FAM-01 metadata when family unknown', () => {
    const wall: WallElem = {
      ...baseCurtainWall,
      curtainPanelOverrides: {
        v2h1: { kind: 'family_instance', familyTypeId: 'ft-slat-screen-v1' },
      },
    };
    const group = makeCurtainWallMesh(wall, 0, null);
    const pane = paneById(group, 'v2h1');
    expect(pane).not.toBeNull();
    expect(pane!.userData.curtainPanelKind).toBe('family_instance');
    expect(pane!.userData.curtainPanelFamilyTypeId).toBe('ft-slat-screen-v1');
    const mat = pane!.material as THREE.MeshStandardMaterial;
    expect(mat).toBeInstanceOf(THREE.MeshStandardMaterial);
    expect(mat.userData.materialKey).toBe('placeholder_unloaded');
    // Procedural albedo now carries the placeholder magenta; material.color stays white.
    expect(mat.map).toBeTruthy();
    expect(`#${mat.color.getHexString()}`).toBe('#ffffff');
  });

  it('renders the resolved FAM-01 family geometry when the family has authored geometry', () => {
    // Stub the catalog with a unit-cube test family that has a single
    // sweep node — proving that a `family_instance` override now hits
    // the FAM-01 resolver path instead of the magenta placeholder.
    const profile: SketchLine[] = (() => {
      const halfMm = 100; // 100mm × 100mm cross section
      return [
        {
          startMm: { xMm: -halfMm, yMm: halfMm },
          endMm: { xMm: halfMm, yMm: halfMm },
        },
        {
          startMm: { xMm: halfMm, yMm: halfMm },
          endMm: { xMm: halfMm, yMm: -halfMm },
        },
        {
          startMm: { xMm: halfMm, yMm: -halfMm },
          endMm: { xMm: -halfMm, yMm: -halfMm },
        },
        {
          startMm: { xMm: -halfMm, yMm: -halfMm },
          endMm: { xMm: -halfMm, yMm: halfMm },
        },
      ];
    })();
    const path: SketchLine[] = [{ startMm: { xMm: 0, yMm: 0 }, endMm: { xMm: 200, yMm: 0 } }];
    const TEST_FAMILY: FamilyDefinition = {
      id: 'test:unit-cube-family',
      name: 'Unit Cube',
      discipline: 'door',
      params: [],
      defaultTypes: [
        {
          id: 'test:unit-cube-type',
          name: 'Unit Cube',
          familyId: 'test:unit-cube-family',
          discipline: 'door',
          parameters: {},
          isBuiltIn: true,
        },
      ],
      geometry: [
        {
          kind: 'sweep',
          pathLines: path,
          profile,
          profilePlane: 'normal_to_path_start',
        },
      ],
    };
    const getTypeSpy = vi.spyOn(familyCatalogModule, 'getTypeById').mockImplementation((id) => {
      if (id === 'test:unit-cube-type') return TEST_FAMILY.defaultTypes[0];
      return undefined;
    });
    const getFamilySpy = vi.spyOn(familyCatalogModule, 'getFamilyById').mockImplementation((id) => {
      if (id === 'test:unit-cube-family') return TEST_FAMILY;
      return undefined;
    });
    try {
      const wall: WallElem = {
        ...baseCurtainWall,
        curtainPanelOverrides: {
          v0h0: { kind: 'family_instance', familyTypeId: 'test:unit-cube-type' },
        },
      };
      const group = makeCurtainWallMesh(wall, 0, null);
      // The placeholder pane (PlaneGeometry) for v0h0 should NOT be present —
      // the resolver replaced it with a real Group of meshes.
      expect(paneById(group, 'v0h0')).toBeNull();
      // Find the resolved family group: it carries our FAM-01 metadata.
      let resolvedGroup: THREE.Group | null = null;
      group.traverse((node) => {
        if (
          node instanceof THREE.Group &&
          node.userData.curtainCellId === 'v0h0' &&
          node.userData.curtainPanelKind === 'family_instance'
        ) {
          resolvedGroup = node;
        }
      });
      expect(resolvedGroup).not.toBeNull();
      // ExtrudeGeometry meshes inside the resolved group prove the
      // sweep was actually instantiated.
      let foundExtrude = false;
      resolvedGroup!.traverse((node) => {
        if (node instanceof THREE.Mesh && node.geometry instanceof THREE.ExtrudeGeometry) {
          foundExtrude = true;
        }
      });
      expect(foundExtrude).toBe(true);
      expect((resolvedGroup as unknown as THREE.Group).userData.curtainPanelFamilyTypeId).toBe(
        'test:unit-cube-type',
      );
    } finally {
      getTypeSpy.mockRestore();
      getFamilySpy.mockRestore();
    }
  });
});

describe('KRN-09 — mullions stay regardless of overrides', () => {
  it('vertical and horizontal mullion counts match the grid even with mixed overrides', () => {
    const wall: WallElem = {
      ...baseCurtainWall,
      curtainPanelOverrides: {
        v0h0: { kind: 'empty' },
        v1h0: { kind: 'system', materialKey: 'cladding_warm_wood' },
        v2h1: { kind: 'family_instance', familyTypeId: 'ft' },
      },
    };
    const group = makeCurtainWallMesh(wall, 0, null);
    // 5 vertical + 3 horizontal = 8 mullions
    expect(mullions(group).length).toBe(5 + 3);
  });
});
