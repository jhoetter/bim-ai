import { describe, expect, it } from 'vitest';
import * as THREE from 'three';

import type { Element } from '@bim-ai/core';

import { rebuildPlanMeshes } from './symbology';
import type { PlanProjectionPrimitivesV1Wire } from './planProjectionWire';

function countLineNodes(root: THREE.Object3D): number {
  let n = 0;
  if (root instanceof THREE.Line) n += 1;
  for (const c of root.children) n += countLineNodes(c);
  return n;
}

function countLineLoopNodes(root: THREE.Object3D): number {
  let n = 0;
  if (root instanceof THREE.LineLoop) n += 1;
  for (const c of root.children) n += countLineLoopNodes(c);
  return n;
}

function someLineHasDashedMaterial(root: THREE.Object3D): boolean {
  let found = false;
  root.traverse((o) => {
    if (!(o instanceof THREE.Line)) return;
    const m = o.material;
    const mm = Array.isArray(m) ? m[0] : m;
    if (mm instanceof THREE.LineDashedMaterial) found = true;
  });
  return found;
}

function countAnnotationOverlaySprites(root: THREE.Object3D): number {
  let n = 0;
  const u = root.userData as { planAnnotationOverlay?: unknown };
  if (root instanceof THREE.Sprite && u.planAnnotationOverlay) n += 1;
  for (const c of root.children) n += countAnnotationOverlaySprites(c);
  return n;
}

function countLinesForPick(root: THREE.Object3D, pickId: string): number {
  let n = 0;
  root.traverse((o) => {
    if (o instanceof THREE.Line && o.userData.bimPickId === pickId) n += 1;
  });
  return n;
}

function assetLinesRenderAbovePlanFill(root: THREE.Object3D, pickId: string): boolean {
  let ok = true;
  root.traverse((o) => {
    if (!(o instanceof THREE.Line) || o.userData.bimPickId !== pickId) return;
    const mat = Array.isArray(o.material) ? o.material[0] : o.material;
    if (!(mat instanceof THREE.LineBasicMaterial)) ok = false;
    if ((mat as THREE.LineBasicMaterial).depthTest !== false) ok = false;
    if (o.renderOrder < 900) ok = false;
  });
  return ok;
}

function hasMeshNode(root: THREE.Object3D): boolean {
  let found = false;
  root.traverse((o) => {
    if ('isMesh' in o && (o as THREE.Mesh).isMesh) found = true;
  });
  return found;
}

function meshColorHexForPick(root: THREE.Object3D, pickId: string): string | null {
  let out: string | null = null;
  root.traverse((o) => {
    if (out || !(o instanceof THREE.Mesh) || o.userData.bimPickId !== pickId) return;
    const mat = Array.isArray(o.material) ? o.material[0] : o.material;
    if (mat instanceof THREE.MeshBasicMaterial) out = `#${mat.color.getHexString()}`;
  });
  return out;
}

describe('PlanCanvas server wire primitives path (WP-C03)', () => {
  it('builds at least one mesh from planProjectionPrimitives_v1 walls', () => {
    const wall: Extract<Element, { kind: 'wall' }> = {
      kind: 'wall',
      id: 'w1',
      name: 'W',
      levelId: 'lvl',
      start: { xMm: 0, yMm: 0 },
      end: { xMm: 3000, yMm: 0 },
      thicknessMm: 200,
      heightMm: 2800,
    };

    const primitives = {
      format: 'planProjectionPrimitives_v1',
      walls: [
        {
          id: 'w1',
          levelId: 'lvl',
          startMm: { x: 0, y: 0 },
          endMm: { x: 3000, y: 0 },
          thicknessMm: 200,
          heightMm: 2800,
        },
      ],
      floors: [],
      rooms: [],
      doors: [],
      windows: [],
      stairs: [],
      roofs: [],
      gridLines: [],
      roomSeparations: [],
      dimensions: [],
    } as const;

    const grp = new THREE.Group();

    rebuildPlanMeshes(
      grp,
      { w1: wall },
      {
        activeLevelId: 'lvl',
        wirePrimitives: primitives as unknown as PlanProjectionPrimitivesV1Wire,
      },
    );

    expect(hasMeshNode(grp)).toBe(true);
  });

  it('exposes bimAiRoofGeometrySupportToken on roof outline group userData when server sends roofGeometrySupportToken', () => {
    const primitives = {
      format: 'planProjectionPrimitives_v1',
      walls: [],
      floors: [],
      rooms: [],
      doors: [],
      windows: [],
      stairs: [],
      roofs: [
        {
          id: 'r-skip',
          footprintMm: [
            [0, 0],
            [3000, 0],
            [3000, 2000],
            [0, 2000],
          ],
          roofGeometrySupportToken: 'valley_candidate_deferred',
          lineWeightHint: 1,
          linePatternToken: 'solid',
        },
      ],
      gridLines: [],
      roomSeparations: [],
      dimensions: [],
    } as const;

    const grp = new THREE.Group();
    rebuildPlanMeshes(
      grp,
      {},
      {
        activeLevelId: 'lvl',
        wirePrimitives: primitives as unknown as PlanProjectionPrimitivesV1Wire,
      },
    );

    const matches: string[] = [];
    grp.traverse((o) => {
      const tok = (o.userData as { bimAiRoofGeometrySupportToken?: unknown })
        .bimAiRoofGeometrySupportToken;
      if (typeof tok === 'string') matches.push(tok);
    });
    expect(matches).toContain('valley_candidate_deferred');
  });

  it('adds dashed Line instances for wire roomSeparations', () => {
    const wall: Extract<Element, { kind: 'wall' }> = {
      kind: 'wall',
      id: 'w1',
      name: 'W',
      levelId: 'lvl',
      start: { xMm: 0, yMm: 0 },
      end: { xMm: 3000, yMm: 0 },
      thicknessMm: 200,
      heightMm: 2800,
    };

    const primitives = {
      format: 'planProjectionPrimitives_v1',
      walls: [
        {
          id: 'w1',
          levelId: 'lvl',
          startMm: { x: 0, y: 0 },
          endMm: { x: 3000, y: 0 },
          thicknessMm: 200,
          heightMm: 2800,
        },
      ],
      floors: [],
      rooms: [],
      doors: [],
      windows: [],
      stairs: [],
      roofs: [],
      gridLines: [],
      roomSeparations: [
        {
          id: 'rs-mid',
          levelId: 'lvl',
          startMm: { x: 1500, y: 0 },
          endMm: { x: 1500, y: 2500 },
        },
      ],
      dimensions: [],
    } as const;

    const grp = new THREE.Group();
    rebuildPlanMeshes(
      grp,
      { w1: wall },
      {
        activeLevelId: 'lvl',
        wirePrimitives: primitives as unknown as PlanProjectionPrimitivesV1Wire,
      },
    );

    const lines = grp.children.filter((c): c is THREE.Line => c instanceof THREE.Line);
    expect(lines.some((ln) => ln.userData.bimPickId === 'rs-mid')).toBe(true);
    expect(
      lines.some((ln) => {
        const m = ln.material;
        const mm = Array.isArray(m) ? m[0] : m;
        return mm instanceof THREE.LineDashedMaterial;
      }),
    ).toBe(true);
  });

  it('uses dashed Line for wire floor outline when linePatternToken is non-solid', () => {
    const primitives = {
      format: 'planProjectionPrimitives_v1',
      walls: [],
      floors: [
        {
          id: 'fl1',
          levelId: 'lvl',
          outlineMm: [
            [0, 0],
            [3000, 0],
            [3000, 2000],
            [0, 2000],
          ],
          lineWeightHint: 1,
          linePatternToken: 'dash_short',
        },
      ],
      rooms: [],
      doors: [],
      windows: [],
      stairs: [],
      roofs: [],
      gridLines: [],
      roomSeparations: [],
      dimensions: [],
    } as const;

    const grp = new THREE.Group();
    rebuildPlanMeshes(
      grp,
      {},
      {
        activeLevelId: 'lvl',
        wirePrimitives: primitives as unknown as PlanProjectionPrimitivesV1Wire,
      },
    );

    let mesh = false;
    grp.traverse((o) => {
      if (o instanceof THREE.Mesh) mesh = true;
    });
    expect(mesh).toBe(true);
    expect(someLineHasDashedMaterial(grp)).toBe(true);
    expect(countLineLoopNodes(grp)).toBe(0);
  });

  it('uses LineLoop for wire floor outline when linePatternToken is solid', () => {
    const primitives = {
      format: 'planProjectionPrimitives_v1',
      walls: [],
      floors: [
        {
          id: 'fl1',
          levelId: 'lvl',
          outlineMm: [
            [0, 0],
            [3000, 0],
            [3000, 2000],
            [0, 2000],
          ],
          lineWeightHint: 1,
          linePatternToken: 'solid',
        },
      ],
      rooms: [],
      doors: [],
      windows: [],
      stairs: [],
      roofs: [],
      gridLines: [],
      roomSeparations: [],
      dimensions: [],
    } as const;

    const grp = new THREE.Group();
    rebuildPlanMeshes(
      grp,
      {},
      {
        activeLevelId: 'lvl',
        wirePrimitives: primitives as unknown as PlanProjectionPrimitivesV1Wire,
      },
    );

    expect(countLineLoopNodes(grp)).toBeGreaterThan(0);
    expect(someLineHasDashedMaterial(grp)).toBe(false);
  });

  it('uses level rise for stair tread divisions when levels are in elementsById', () => {
    const l0: Extract<Element, { kind: 'level' }> = {
      kind: 'level',
      id: 'l0',
      name: 'G',
      elevationMm: 0,
    };
    const l1: Extract<Element, { kind: 'level' }> = {
      kind: 'level',
      id: 'l1',
      name: 'OG',
      elevationMm: 2800,
    };
    const stair: Extract<Element, { kind: 'stair' }> = {
      kind: 'stair',
      id: 'st1',
      name: 'S',
      baseLevelId: 'l0',
      topLevelId: 'l1',
      runStartMm: { xMm: 1000, yMm: 500 },
      runEndMm: { xMm: 1000, yMm: 3500 },
      widthMm: 1100,
      riserMm: 175,
      treadMm: 275,
    };
    const wall: Extract<Element, { kind: 'wall' }> = {
      kind: 'wall',
      id: 'w1',
      name: 'W',
      levelId: 'l0',
      start: { xMm: 0, yMm: 0 },
      end: { xMm: 3000, yMm: 0 },
      thicknessMm: 200,
      heightMm: 2800,
    };

    const primitives = {
      format: 'planProjectionPrimitives_v1',
      walls: [
        {
          id: 'w1',
          levelId: 'l0',
          startMm: { x: 0, y: 0 },
          endMm: { x: 3000, y: 0 },
          thicknessMm: 200,
          heightMm: 2800,
        },
      ],
      floors: [],
      rooms: [],
      doors: [],
      windows: [],
      stairs: [
        {
          id: 'st1',
          baseLevelId: 'l0',
          topLevelId: 'l1',
          riserMm: 175,
          treadMm: 275,
          runStartMm: { x: 1000, y: 500 },
          runEndMm: { x: 1000, y: 3500 },
          widthMm: 1100,
          riserCountPlanProxy: 16,
          runBearingDegCcFromPlanX: 90,
          planUpDownLabel: 'UP',
          stairPlanBreakVisibilityToken: 'cutSplitsSpan',
          stairPlanSectionDocumentationLabel: 'UP·R16·T15·W1100',
          stairDocumentationPlaceholders_v0: {
            bottomLandingFootprintBoundsMm: {
              minXmMm: 450,
              maxXmMm: 1550,
              minYmMm: -50,
              maxYmMm: 500,
            },
            topLandingFootprintBoundsMm: {
              minXmMm: 450,
              maxXmMm: 1550,
              minYmMm: 3500,
              maxYmMm: 4050,
            },
          },
        },
      ],
      roofs: [],
      gridLines: [],
      roomSeparations: [],
      dimensions: [],
    } as const;

    const grp = new THREE.Group();
    const byId: Record<string, Element> = { l0, l1, st1: stair, w1: wall };

    rebuildPlanMeshes(grp, byId, {
      activeLevelId: 'l0',
      wirePrimitives: primitives as unknown as PlanProjectionPrimitivesV1Wire,
    });

    const stairGrp = grp.children.find((c) => c.userData?.bimPickId === 'st1');
    expect(stairGrp).toBeTruthy();
    const lineCount = countLineNodes(stairGrp!);
    // nSteps=16 → outline 1 + 17 cross + 16 diag = 34; + run arrow (3) + break zigzag (2) +
    // landing placeholder outlines (2) when placeholders present → 41
    expect(lineCount).toBeGreaterThan(28);
    expect(lineCount).toBe(41);
  });

  it('adds sprite overlays only when planAnnotationHints and planTagLabel are set', () => {
    const wall: Extract<Element, { kind: 'wall' }> = {
      kind: 'wall',
      id: 'w1',
      name: 'W',
      levelId: 'lvl',
      start: { xMm: 0, yMm: 0 },
      end: { xMm: 3000, yMm: 0 },
      thicknessMm: 200,
      heightMm: 2800,
    };
    const door: Extract<Element, { kind: 'door' }> = {
      kind: 'door',
      id: 'd1',
      name: 'D1',
      wallId: 'w1',
      alongT: 0.5,
      widthMm: 900,
    };
    const room: Extract<Element, { kind: 'room' }> = {
      kind: 'room',
      id: 'r1',
      name: 'Living',
      levelId: 'lvl',
      outlineMm: [
        { xMm: 0, yMm: 0 },
        { xMm: 3000, yMm: 0 },
        { xMm: 3000, yMm: 2000 },
        { xMm: 0, yMm: 2000 },
      ],
    };
    const primitives = {
      format: 'planProjectionPrimitives_v1',
      walls: [
        {
          id: 'w1',
          levelId: 'lvl',
          startMm: { x: 0, y: 0 },
          endMm: { x: 3000, y: 0 },
          thicknessMm: 200,
          heightMm: 2800,
        },
      ],
      floors: [],
      rooms: [
        {
          id: 'r1',
          levelId: 'lvl',
          outlineMm: [
            [0, 0],
            [3000, 0],
            [3000, 2000],
            [0, 2000],
          ],
          planTagLabel: 'R-Liv',
        },
      ],
      doors: [
        {
          id: 'd1',
          wallId: 'w1',
          alongT: 0.5,
          widthMm: 900,
          planTagLabel: 'D-101',
        },
      ],
      windows: [],
      stairs: [],
      roofs: [],
      gridLines: [],
      roomSeparations: [],
      dimensions: [],
    } as const;

    const byId: Record<string, Element> = { w1: wall, d1: door, r1: room };
    const wire = primitives as unknown as PlanProjectionPrimitivesV1Wire;

    const grpOff = new THREE.Group();
    rebuildPlanMeshes(grpOff, byId, {
      activeLevelId: 'lvl',
      wirePrimitives: wire,
      planAnnotationHints: { openingTagsVisible: false, roomLabelsVisible: false },
    });
    expect(countAnnotationOverlaySprites(grpOff)).toBe(0);

    const grpOn = new THREE.Group();
    rebuildPlanMeshes(grpOn, byId, {
      activeLevelId: 'lvl',
      wirePrimitives: wire,
      planAnnotationHints: { openingTagsVisible: true, roomLabelsVisible: true },
    });
    expect(countAnnotationOverlaySprites(grpOn)).toBe(2);
  });

  it('uses per-room fill override ahead of room scheme color in wire rendering', () => {
    const room: Extract<Element, { kind: 'room' }> = {
      kind: 'room',
      id: 'r-override',
      name: 'Focus',
      levelId: 'lvl',
      roomFillOverrideHex: '#123456',
      outlineMm: [
        { xMm: 0, yMm: 0 },
        { xMm: 3000, yMm: 0 },
        { xMm: 3000, yMm: 2000 },
        { xMm: 0, yMm: 2000 },
      ],
    };
    const wire = {
      format: 'planProjectionPrimitives_v1',
      walls: [],
      floors: [],
      rooms: [
        {
          id: 'r-override',
          levelId: 'lvl',
          outlineMm: [
            [0, 0],
            [3000, 0],
            [3000, 2000],
            [0, 2000],
          ],
          schemeColorHex: '#abcdef',
          roomFillOverrideHex: '#123456',
        },
      ],
      doors: [],
      windows: [],
      stairs: [],
      roofs: [],
      gridLines: [],
      roomSeparations: [],
      dimensions: [],
    } as unknown as PlanProjectionPrimitivesV1Wire;

    const grp = new THREE.Group();
    rebuildPlanMeshes(grp, { [room.id]: room }, { activeLevelId: 'lvl', wirePrimitives: wire });
    expect(meshColorHexForPick(grp, 'r-override')).toBe('#123456');
  });

  it('draws placed asset symbols while server wire primitives are active', () => {
    const assetEntry: Extract<Element, { kind: 'asset_library_entry' }> = {
      kind: 'asset_library_entry',
      id: 'asset-sofa',
      assetKind: 'block_2d',
      name: 'Sofa',
      category: 'furniture',
      tags: [],
      disciplineTags: [],
      thumbnailKind: 'schematic_plan',
      thumbnailWidthMm: 2200,
      thumbnailHeightMm: 900,
    };
    const placedAsset: Extract<Element, { kind: 'placed_asset' }> = {
      kind: 'placed_asset',
      id: 'pa-sofa',
      name: 'Living sofa',
      assetId: 'asset-sofa',
      levelId: 'lvl',
      positionMm: { xMm: 1500, yMm: 1200 },
      rotationDeg: 90,
      paramValues: {},
    };
    const primitives = {
      format: 'planProjectionPrimitives_v1',
      walls: [],
      floors: [],
      rooms: [],
      doors: [],
      windows: [],
      stairs: [],
      roofs: [],
      gridLines: [],
      roomSeparations: [],
      dimensions: [],
    } as const;

    const grp = new THREE.Group();
    rebuildPlanMeshes(
      grp,
      { 'asset-sofa': assetEntry, 'pa-sofa': placedAsset },
      {
        activeLevelId: 'lvl',
        wirePrimitives: primitives as unknown as PlanProjectionPrimitivesV1Wire,
      },
    );

    expect(countLinesForPick(grp, 'pa-sofa')).toBeGreaterThanOrEqual(2);
    expect(assetLinesRenderAbovePlanFill(grp, 'pa-sofa')).toBe(true);
  });

  it('draws a fridge as appliance linework instead of a generic rectangle', () => {
    const assetEntry: Extract<Element, { kind: 'asset_library_entry' }> = {
      kind: 'asset_library_entry',
      id: 'asset-fridge',
      assetKind: 'block_2d',
      name: 'Tall Fridge',
      category: 'kitchen',
      tags: ['fridge', 'refrigerator'],
      disciplineTags: [],
      thumbnailKind: 'schematic_plan',
      thumbnailWidthMm: 600,
      thumbnailHeightMm: 650,
      planSymbolKind: 'fridge',
      renderProxyKind: 'fridge',
    };
    const placedAsset: Extract<Element, { kind: 'placed_asset' }> = {
      kind: 'placed_asset',
      id: 'pa-fridge',
      name: 'Kitchen fridge',
      assetId: 'asset-fridge',
      levelId: 'lvl',
      positionMm: { xMm: 1500, yMm: 1200 },
      rotationDeg: 0,
      paramValues: {},
    };

    const grp = new THREE.Group();
    rebuildPlanMeshes(
      grp,
      { 'asset-fridge': assetEntry, 'pa-fridge': placedAsset },
      {
        activeLevelId: 'lvl',
        wirePrimitives: {
          format: 'planProjectionPrimitives_v1',
          walls: [],
          floors: [],
          rooms: [],
          doors: [],
          windows: [],
          stairs: [],
          roofs: [],
          gridLines: [],
          roomSeparations: [],
          dimensions: [],
        } as unknown as PlanProjectionPrimitivesV1Wire,
      },
    );

    expect(countLinesForPick(grp, 'pa-fridge')).toBeGreaterThan(3);
    let symbolKind: unknown;
    grp.traverse((o) => {
      if (o.userData.bimPickId === 'pa-fridge' && o.userData.assetSymbolKind) {
        symbolKind = o.userData.assetSymbolKind;
      }
    });
    expect(symbolKind).toBe('fridge');
  });
});
