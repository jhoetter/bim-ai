import { describe, expect, it } from 'vitest';
import type { Element } from '@bim-ai/core';

import {
  materialEditableTargetLabel,
  materialKeyForInstanceTarget,
  materialSlotTargetLabel,
  resolveMaterialEditableTarget,
} from './materialTargets';

describe('materialTargets', () => {
  it('resolves wall instances through their wall type layer', () => {
    const wallType = {
      kind: 'wall_type',
      id: 'wt-1',
      name: 'Exterior Wall',
      layers: [],
    } as unknown as Element;
    const wall = {
      kind: 'wall',
      id: 'wall-1',
      name: 'Wall 1',
      wallTypeId: 'wt-1',
    } as unknown as Element;

    const target = resolveMaterialEditableTarget(wall, { 'wt-1': wallType, 'wall-1': wall });

    expect(target?.kind).toBe('type-layer');
    expect(target ? materialEditableTargetLabel(target) : '').toBe(
      'Exterior Wall · exterior layer',
    );
  });

  it('resolves instance material targets and current keys', () => {
    const topo = {
      kind: 'toposolid',
      id: 'topo-1',
      name: 'Site',
      defaultMaterialKey: 'earth',
    } as unknown as Element;
    const beam = {
      kind: 'beam',
      id: 'beam-1',
      name: 'Beam 1',
      materialKey: 'steel',
    } as unknown as Element;

    const topoTarget = resolveMaterialEditableTarget(topo, { 'topo-1': topo });
    const beamTarget = resolveMaterialEditableTarget(beam, { 'beam-1': beam });

    expect(topoTarget?.kind).toBe('instance');
    expect(beamTarget?.kind).toBe('instance');
    if (topoTarget?.kind === 'instance') {
      expect(topoTarget.property).toBe('defaultMaterialKey');
      expect(materialKeyForInstanceTarget(topoTarget)).toBe('earth');
      expect(materialEditableTargetLabel(topoTarget)).toBe('Site · default material');
    }
    if (beamTarget?.kind === 'instance') {
      expect(beamTarget.property).toBe('materialKey');
      expect(materialKeyForInstanceTarget(beamTarget)).toBe('steel');
      expect(materialEditableTargetLabel(beamTarget)).toBe('Beam 1 · instance material');
    }
  });

  it('labels explicit material slot requests', () => {
    const wall = { kind: 'wall', id: 'wall-1', name: 'Lobby Wall' } as unknown as Element;

    expect(
      materialSlotTargetLabel(
        {
          kind: 'material-slot',
          elementId: 'wall-1',
          slot: 'layers.1.materialKey',
          label: 'Layer 1',
        },
        { 'wall-1': wall },
      ),
    ).toBe('Lobby Wall · Layer 1');
  });
});
