import type { Element } from '@bim-ai/core';
import { describe, expect, it } from 'vitest';

import {
  diagnoseRendererStressBudgets,
  profileRendererCost,
  RENDERER_WORKLOAD_KINDS,
} from './rendererCostProfile';

function wall(id: string): Element {
  return {
    kind: 'wall',
    id,
    name: id,
    levelId: 'level-1',
    start: { x: 0, y: 0 },
    end: { x: 5000, y: 0 },
    thicknessMm: 200,
    heightMm: 3000,
  };
}

function room(id: string): Element {
  return {
    kind: 'room',
    id,
    name: id,
    levelId: 'level-1',
    outlineMm: [
      { x: 0, y: 0 },
      { x: 1000, y: 0 },
      { x: 1000, y: 1000 },
      { x: 0, y: 1000 },
    ],
  };
}

function door(id: string, wallId = 'wall-1'): Element {
  return {
    kind: 'door',
    id,
    name: id,
    wallId,
    alongT: 0.5,
    widthMm: 900,
  };
}

function linkIfc(id: string, linkedElements: Element[]): Element {
  return {
    kind: 'link_ifc',
    id,
    name: id,
    ifcContent: 'ISO-10303-21;',
    linkedElements,
    visible: true,
  };
}

describe('renderer cost profile — BIR-L02/BIR-J10', () => {
  it('profiles orbit/select/lens-switch/advisor/update workloads deterministically', () => {
    const elements: Element[] = [
      wall('wall-1'),
      door('door-1'),
      room('room-1'),
      {
        kind: 'viewpoint',
        id: 'view-3d',
        name: 'Main 3D',
        mode: 'orbit_3d',
      } as Element,
    ];

    const profile = profileRendererCost({
      elements,
      selectedElementIds: ['door-1'],
      changedElementIds: ['door-1'],
      previousLensMode: 'architecture',
      lensMode: 'structure',
      advisorOpen: true,
      advisorFindingCount: 2,
      viewId: 'view-3d',
    });

    expect(profile.format).toBe('rendererCostProfile_v1');
    expect(Object.keys(profile.workloads).sort()).toEqual([...RENDERER_WORKLOAD_KINDS].sort());
    expect(profile.counts).toMatchObject({
      elementCount: 4,
      renderedElementCount: 4,
      openingCount: 1,
      roomCount: 1,
      evidenceViewCount: 1,
    });
    expect(profile.workloads.orbit.status).toBe('within_budget');
    expect(profile.workloads.select.dominantFactors).toContain('pick candidates:4');
    expect(profile.workloads['lens-switch'].estimatedMs).toBeGreaterThan(4);
    expect(profile.workloads.update.dominantFactors).toContain('changed elements:1');
    expect(profile.context).toMatchObject({
      viewId: 'view-3d',
      previousLensMode: 'architecture',
      lensMode: 'structure',
      advisorOpen: true,
    });
  });

  it('emits stress diagnostics for large opening and linked-model budgets', () => {
    const openings = Array.from({ length: 8 }, (_, index) => door(`door-${index}`, 'wall-1'));
    const elements: Element[] = [
      wall('wall-1'),
      ...openings,
      linkIfc('ifc-1', [wall('linked-wall-1'), door('linked-door-1')]),
      {
        kind: 'link_model',
        id: 'model-link-1',
        name: 'Core link',
        sourceModelId: 'source-1',
        positionMm: { x: 0, y: 0, z: 0 },
        rotationDeg: 0,
        originAlignmentMode: 'origin_to_origin',
      },
      { ...wall('model-link-1::linked-wall-2'), id: 'model-link-1::linked-wall-2' },
    ];

    const diagnostics = diagnoseRendererStressBudgets(
      {
        elements,
        budgetsMs: { orbit: 3 },
        viewId: 'view-3d',
        evidence: { rendererBuild: 'viewport-test', source: 'test' },
      },
      {
        stressBudgets: {
          warningElementCount: 5,
          errorElementCount: 20,
          warningOpeningCount: 4,
          errorOpeningCount: 20,
          warningLinkedModelCount: 2,
          errorLinkedModelCount: 5,
          warningLinkedElementCount: 3,
          errorLinkedElementCount: 10,
          workloadWarningBudgetRatio: 0.5,
        },
      },
    );

    const codes = diagnostics.map((diagnostic) => diagnostic.code);
    expect(codes).toEqual(
      expect.arrayContaining([
        'renderer.stress.element_count.near_limit',
        'renderer.stress.opening_count.near_limit',
        'renderer.stress.linked_model_count.near_limit',
        'renderer.stress.linked_element_count.near_limit',
        'renderer.profile.orbit.budget_exceeded',
      ]),
    );
    for (const diagnostic of diagnostics) {
      expect(diagnostic.feature).toBe('renderer-performance');
      expect(diagnostic.issueClass).toBe('renderer-degraded');
      expect(diagnostic.rendererArea).toBe('viewport-3d');
      expect(diagnostic.trackerItems).toEqual(['BIR-J10', 'BIR-L02']);
      expect(diagnostic.evidence?.source).toBe('test');
    }
  });

  it('keeps update estimates proportional to changed elements instead of full scene size', () => {
    const elements = [
      ...Array.from({ length: 40 }, (_, index) => wall(`wall-${index}`)),
      ...Array.from({ length: 40 }, (_, index) => room(`room-${index}`)),
      door('door-1', 'wall-1'),
    ];

    const focused = profileRendererCost({
      elements,
      changedElementIds: ['door-1'],
    });
    const fullScene = profileRendererCost({ elements });

    expect(focused.workloads.update.estimatedMs).toBeLessThan(
      fullScene.workloads.update.estimatedMs,
    );
    expect(focused.workloads.update.dominantFactors).toContain('changed elements:1');
    expect(fullScene.workloads.update.dominantFactors).toContain('full-scene elements:81');
  });
});
