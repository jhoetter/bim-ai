import type { Element } from '@bim-ai/core';
import { describe, expect, it } from 'vitest';

import {
  BUILTIN_PLAN_TAG_OPENING_ID,
  canonHiddenCategory,
  formatPlanTagStyleMatrixCell,
  planViewGraphicsMatrixRows,
  planViewInheritanceSummaryLines,
  planViewProjectBrowserEvidenceLine,
  resolvePlanGraphicHints,
  resolvePlanTagStyleLane,
  resolvePlanViewDisplay,
  resolvePhaseGraphicStyle,
  viewTemplateGraphicsMatrixRows,
  viewpointOrbit3dCutawayStyleLabel,
  viewpointOrbit3dCutawayStyleToken,
  viewpointOrbit3dEvidenceLine,
  viewpointOrbit3dHiddenKindsReadout,
} from './planProjection';
import { extractPlanGraphicHints, extractPlanTagStyleHints } from './planProjectionWire';

describe('planProjection', () => {
  it('extractPlanTagStyleHints reads server block', () => {
    const h = extractPlanTagStyleHints({
      planTagStyleHints: {
        opening: {
          resolvedStyleId: 's1',
          resolvedStyleName: 'N',
          source: 'view_template',
          textSizePt: 12,
        },
      },
    });
    expect(h?.opening?.resolvedStyleId).toBe('s1');
    expect(h?.opening?.textSizePt).toBe(12);
  });

  it('resolvePlanTagStyleLane uses plan_view then template then builtin', () => {
    const elementsById = {
      st: {
        kind: 'plan_tag_style' as const,
        id: 'st',
        name: 'Style',
        tagTarget: 'opening' as const,
        labelFields: [] as string[],
        textSizePt: 14,
        leaderVisible: true,
        badgeStyle: 'none' as const,
        colorToken: 'default',
        sortKey: 0,
      },
      vt: {
        kind: 'view_template' as const,
        id: 'vt',
        name: 'T',
        scale: 'scale_100' as const,
        planShowOpeningTags: false,
        planShowRoomLabels: false,
        defaultPlanOpeningTagStyleId: 'st',
      },
      pv: {
        kind: 'plan_view' as const,
        id: 'pv',
        name: 'P',
        levelId: 'lv',
        viewTemplateId: 'vt',
      },
      lv: { kind: 'level' as const, id: 'lv', name: 'L', elevationMm: 0 },
    } as Record<string, Element>;
    const fromTmpl = resolvePlanTagStyleLane(elementsById, 'pv', 'opening');
    expect(fromTmpl.resolvedStyleId).toBe('st');
    expect(fromTmpl.source).toBe('view_template');

    const elementsPv = {
      ...elementsById,
      pv: {
        ...elementsById.pv,
        planOpeningTagStyleId: 'st',
      },
    } as Record<string, Element>;
    const fromPv = resolvePlanTagStyleLane(elementsPv, 'pv', 'opening');
    expect(fromPv.source).toBe('plan_view');

    const none = resolvePlanTagStyleLane(elementsById, 'missing', 'opening');
    expect(none.resolvedStyleId).toBe(BUILTIN_PLAN_TAG_OPENING_ID);
  });

  it('planViewGraphicsMatrixRows includes tag style rows', () => {
    const st = {
      kind: 'plan_tag_style' as const,
      id: 'st',
      name: 'Style',
      tagTarget: 'opening' as const,
      labelFields: [] as string[],
      textSizePt: 10,
      leaderVisible: true,
      badgeStyle: 'none' as const,
      colorToken: 'default',
      sortKey: 0,
    };
    const elementsById = {
      st,
      vt: {
        kind: 'view_template' as const,
        id: 'vt',
        name: 'T',
        scale: 'scale_100' as const,
        planShowOpeningTags: true,
        planShowRoomLabels: false,
        defaultPlanOpeningTagStyleId: 'st',
      },
      pv: {
        kind: 'plan_view' as const,
        id: 'pv',
        name: 'P',
        levelId: 'lv',
        viewTemplateId: 'vt',
      },
      lv: { kind: 'level' as const, id: 'lv', name: 'L', elevationMm: 0 },
    } as Record<string, Element>;
    const rows = planViewGraphicsMatrixRows(elementsById, 'pv');
    const oRow = rows.find((r) => r.label === 'Opening tag style');
    expect(oRow).toBeDefined();
    expect(oRow?.effective).toContain('st');
    expect(oRow?.effective).toContain(
      formatPlanTagStyleMatrixCell(resolvePlanTagStyleLane(elementsById, 'pv', 'opening')),
    );
  });

  it('planViewGraphicsMatrixRows includes category transparency in effective rows', () => {
    const elementsById = {
      pv: {
        kind: 'plan_view' as const,
        id: 'pv',
        name: 'P',
        levelId: 'lv',
        categoryOverrides: {
          wall: {
            projection: { transparency: 25 },
            cut: { transparency: 60 },
          },
        },
      },
      lv: { kind: 'level' as const, id: 'lv', name: 'L', elevationMm: 0 },
    } as Record<string, Element>;
    const row = planViewGraphicsMatrixRows(elementsById, 'pv').find((r) => r.label === 'Cat wall');

    expect(row?.effective).toContain('projTrans=25%');
    expect(row?.effective).toContain('cutTrans=60%');
  });

  it('planViewProjectBrowserEvidenceLine mentions tag styles', () => {
    const elementsById = {
      pv: {
        kind: 'plan_view' as const,
        id: 'pv',
        name: 'P',
        levelId: 'lv',
      },
      lv: { kind: 'level' as const, id: 'lv', name: 'L', elevationMm: 0 },
    } as Record<string, Element>;
    expect(planViewProjectBrowserEvidenceLine(elementsById, 'pv')).toMatch(/tagStyles/);
  });

  it('planViewInheritanceSummaryLines includes tag style lines', () => {
    const elementsById = {
      pv: {
        kind: 'plan_view' as const,
        id: 'pv',
        name: 'P',
        levelId: 'lv',
      },
      lv: { kind: 'level' as const, id: 'lv', name: 'L', elevationMm: 0 },
    } as Record<string, Element>;
    const lines = planViewInheritanceSummaryLines(elementsById, 'pv');
    expect(lines.some((l) => l.startsWith('Opening tag style:'))).toBe(true);
  });

  it('maps common category aliases', () => {
    expect(canonHiddenCategory('Rooms')).toBe('room');
    expect(canonHiddenCategory('grid-lines')).toBe('grid_line');
    expect(canonHiddenCategory('Family Symbolic Lines')).toBe('family_symbolic_line');
    expect(canonHiddenCategory('Opening (Projection)')).toBe('family_opening_projection');
    expect(canonHiddenCategory('Hidden Lines (Cut)')).toBe('family_hidden_cut');
  });

  it('inherits template hiddenCategories when plan_view references template', () => {
    const elementsById: Record<string, Element> = {
      'vt-1': {
        kind: 'view_template',
        id: 'vt-1',
        name: 'T',
        scale: 'scale_100',
        hiddenCategories: ['door'],
      },
      'pv-1': {
        kind: 'plan_view',
        id: 'pv-1',
        name: 'V',
        levelId: 'lvl-1',
        viewTemplateId: 'vt-1',
        categoriesHidden: ['room'],
      },
      'lvl-1': { kind: 'level', id: 'lvl-1', name: 'EG', elevationMm: 0 },
    };
    const d = resolvePlanViewDisplay(elementsById, 'pv-1', 'lvl-99', 'default');
    expect(d.activeLevelId).toBe('lvl-1');
    expect(d.presentation).toBe('default');
    expect(d.hiddenSemanticKinds.has('room')).toBe(true);
    expect(d.hiddenSemanticKinds.has('door')).toBe(true);
  });

  it('uses global presentation fallback when plan_view inactive', () => {
    const elementsById: Record<string, Element> = {
      'lvl-1': { kind: 'level', id: 'lvl-1', name: 'EG', elevationMm: 0 },
    };
    const d = resolvePlanViewDisplay(elementsById, undefined, 'lvl-1', 'room_scheme');
    expect(d.activeLevelId).toBe('lvl-1');
    expect(d.presentation).toBe('room_scheme');
    expect(d.hiddenSemanticKinds.size).toBe(0);
  });

  it('extractPlanGraphicHints parses wire payload', () => {
    const h = extractPlanGraphicHints({
      planGraphicHints: { detailLevel: 'fine', lineWeightScale: 1.14, roomFillOpacityScale: 0.5 },
    });
    expect(h?.detailLevel).toBe('fine');
    expect(h?.lineWeightScale).toBe(1.14);
    expect(h?.roomFillOpacityScale).toBe(0.5);
  });

  it('resolvePlanGraphicHints inherits template detail and fill scale', () => {
    const elementsById = {
      vt: {
        kind: 'view_template',
        id: 'vt',
        name: 'T',
        scale: 'scale_100',
        planDetailLevel: 'fine',
        planRoomFillOpacityScale: 0.4,
      },
      pv: {
        kind: 'plan_view',
        id: 'pv',
        name: 'P',
        levelId: 'lv',
        viewTemplateId: 'vt',
      },
      lv: { kind: 'level', id: 'lv', name: 'L', elevationMm: 0 },
    } as Record<string, Element>;
    const r = resolvePlanGraphicHints(elementsById, 'pv');
    expect(r?.detailLevel).toBe('fine');
    expect(r?.roomFillOpacityScale).toBe(0.4);
    expect(r?.lineWeightScale).toBeGreaterThan(1);
  });

  it('resolvePlanGraphicHints prefers plan_view overrides', () => {
    const elementsById = {
      vt: {
        kind: 'view_template',
        id: 'vt',
        name: 'T',
        scale: 'scale_100',
        planDetailLevel: 'fine',
      },
      pv: {
        kind: 'plan_view',
        id: 'pv',
        name: 'P',
        levelId: 'lv',
        viewTemplateId: 'vt',
        planDetailLevel: 'coarse',
        planRoomFillOpacityScale: 0.2,
      },
      lv: { kind: 'level', id: 'lv', name: 'L', elevationMm: 0 },
    } as Record<string, Element>;
    const r = resolvePlanGraphicHints(elementsById, 'pv');
    expect(r?.detailLevel).toBe('coarse');
    expect(r?.roomFillOpacityScale).toBe(0.2);
  });

  it('planViewInheritanceSummaryLines reflects template defaults only', () => {
    const elementsById = {
      vt: {
        kind: 'view_template',
        id: 'vt',
        name: 'T',
        scale: 'scale_100',
        planDetailLevel: 'fine',
        planRoomFillOpacityScale: 0.4,
        planShowOpeningTags: true,
        planShowRoomLabels: false,
      },
      pv: {
        kind: 'plan_view',
        id: 'pv',
        name: 'P',
        levelId: 'lv',
        viewTemplateId: 'vt',
      },
      lv: { kind: 'level', id: 'lv', name: 'L', elevationMm: 0 },
    } as Record<string, Element>;
    const lines = planViewInheritanceSummaryLines(elementsById, 'pv');
    expect(lines.some((l) => l.includes('detail=fine'))).toBe(true);
    expect(lines.some((l) => l.includes('roomFill=0.4'))).toBe(true);
    expect(lines.some((l) => l.includes('Stored plan_view: detail=inherit'))).toBe(true);
    expect(lines.some((l) => l.includes('Opening tags: effective=on'))).toBe(true);
  });

  it('planViewInheritanceSummaryLines prefers plan_view overrides', () => {
    const elementsById = {
      vt: {
        kind: 'view_template',
        id: 'vt',
        name: 'T',
        scale: 'scale_100',
        planDetailLevel: 'fine',
        planRoomFillOpacityScale: 0.9,
        planShowOpeningTags: true,
        planShowRoomLabels: true,
      },
      pv: {
        kind: 'plan_view',
        id: 'pv',
        name: 'P',
        levelId: 'lv',
        viewTemplateId: 'vt',
        planDetailLevel: 'coarse',
        planRoomFillOpacityScale: 0.15,
        planShowOpeningTags: false,
        planShowRoomLabels: false,
      },
      lv: { kind: 'level', id: 'lv', name: 'L', elevationMm: 0 },
    } as Record<string, Element>;
    const lines = planViewInheritanceSummaryLines(elementsById, 'pv');
    expect(lines.some((l) => l.includes('detail=coarse'))).toBe(true);
    expect(lines.some((l) => l.includes('Stored plan_view: detail=coarse'))).toBe(true);
    expect(lines.some((l) => l.includes('roomFill=0.15'))).toBe(true);
    expect(lines.some((l) => l.includes('Opening tags: effective=off'))).toBe(true);
  });

  it('planViewGraphicsMatrixRows inherits template defaults and counts merged hidden kinds', () => {
    const elementsById = {
      vt: {
        kind: 'view_template',
        id: 'vt',
        name: 'T',
        scale: 'scale_100',
        planDetailLevel: 'fine',
        planRoomFillOpacityScale: 0.4,
        planShowOpeningTags: true,
        planShowRoomLabels: false,
        hiddenCategories: ['door'],
      },
      pv: {
        kind: 'plan_view',
        id: 'pv',
        name: 'P',
        levelId: 'lv',
        viewTemplateId: 'vt',
        categoriesHidden: ['room'],
      },
      lv: { kind: 'level', id: 'lv', name: 'L', elevationMm: 0 },
    } as Record<string, Element>;
    const rows = planViewGraphicsMatrixRows(elementsById, 'pv');
    const detail = rows.find((r) => r.label === 'Detail level');
    expect(detail?.template).toBe('fine');
    expect(detail?.stored).toBe('inherit');
    expect(detail?.effective).toBe('fine');
    const hidden = rows.find((r) => r.label === 'Hidden categories');
    expect(hidden?.template).toBe('1');
    expect(hidden?.stored).toBe('1');
    expect(hidden?.effective).toBe('2 kinds');
    expect(planViewProjectBrowserEvidenceLine(elementsById, 'pv')).toMatch(/fill 0\.4/);
    expect(planViewProjectBrowserEvidenceLine(elementsById, 'pv')).toMatch(/tags on\/off/);
  });

  it('planViewGraphicsMatrixRows prefers plan_view overrides and handles missing template', () => {
    const elementsById = {
      pv: {
        kind: 'plan_view',
        id: 'pv',
        name: 'P',
        levelId: 'lv',
        planDetailLevel: 'coarse',
        planRoomFillOpacityScale: 0.15,
        planShowOpeningTags: false,
        planShowRoomLabels: true,
        planPresentation: 'opening_focus',
      },
      lv: { kind: 'level', id: 'lv', name: 'L', elevationMm: 0 },
    } as Record<string, Element>;
    const rows = planViewGraphicsMatrixRows(elementsById, 'pv');
    expect(rows.find((r) => r.label === 'Presentation')?.stored).toBe('opening_focus');
    expect(rows.find((r) => r.label === 'Detail level')?.template).toBe('—');
    expect(rows.find((r) => r.label === 'Detail level')?.effective).toBe('coarse');
    expect(rows.find((r) => r.label === 'Room fill')?.stored).toBe('0.15');
    expect(rows.find((r) => r.label === 'Opening tags')?.effective).toBe('off');
    expect(rows.find((r) => r.label === 'Room labels')?.effective).toBe('on');
    expect(planViewGraphicsMatrixRows(elementsById, 'missing')).toEqual([]);
  });

  it('planViewInheritanceSummaryLines handles missing template', () => {
    const elementsById = {
      pv: {
        kind: 'plan_view',
        id: 'pv',
        name: 'P',
        levelId: 'lv',
      },
      lv: { kind: 'level', id: 'lv', name: 'L', elevationMm: 0 },
    } as Record<string, Element>;
    const lines = planViewInheritanceSummaryLines(elementsById, 'pv');
    expect(lines.some((l) => l.includes('Template: detail=—'))).toBe(true);
    expect(lines.some((l) => l.includes('detail=medium'))).toBe(true);
    expect(planViewInheritanceSummaryLines(elementsById, 'missing')).toEqual([]);
  });

  it('viewTemplateGraphicsMatrixRows matches template defaults and hidden category count', () => {
    const elementsById = {
      vt: {
        kind: 'view_template',
        id: 'vt',
        name: 'T',
        scale: 'scale_100',
        planDetailLevel: 'fine',
        planRoomFillOpacityScale: 0.5,
        planShowOpeningTags: true,
        planShowRoomLabels: false,
        hiddenCategories: ['wall', 'door'],
      },
    } as Record<string, Element>;
    const rows = viewTemplateGraphicsMatrixRows(elementsById, 'vt');
    expect(rows.find((r) => r.label === 'Detail level')?.stored).toBe('fine');
    expect(rows.find((r) => r.label === 'Detail level')?.effective).toBe('fine');
    expect(rows.find((r) => r.label === 'Room fill')?.effective).toBe('0.5');
    expect(rows.find((r) => r.label === 'Opening tags')?.effective).toBe('on');
    expect(rows.find((r) => r.label === 'Room labels')?.effective).toBe('off');
    expect(rows.find((r) => r.label === 'Hidden categories')?.effective).toBe('2 kinds');
    expect(rows.every((r) => r.template === '—')).toBe(true);
  });

  it('viewTemplateGraphicsMatrixRows inherits medium detail when null', () => {
    const elementsById = {
      vt: {
        kind: 'view_template',
        id: 'vt',
        name: 'T',
        scale: 'scale_100',
        planShowOpeningTags: false,
        planShowRoomLabels: false,
      },
    } as Record<string, Element>;
    const rows = viewTemplateGraphicsMatrixRows(elementsById, 'vt');
    expect(rows.find((r) => r.label === 'Detail level')?.stored).toBe('inherit→medium');
    expect(rows.find((r) => r.label === 'Detail level')?.effective).toBe('medium');
    expect(viewTemplateGraphicsMatrixRows(elementsById, 'missing')).toEqual([]);
  });

  it('viewpointOrbit3dEvidenceLine encodes clip and hidden kind count', () => {
    const vp = {
      kind: 'viewpoint' as const,
      id: 'v1',
      name: 'Orbit',
      camera: {
        position: { xMm: 0, yMm: 0, zMm: 0 },
        target: { xMm: 1, yMm: 0, zMm: 0 },
        up: { xMm: 0, yMm: 0, zMm: 1 },
      },
      mode: 'orbit_3d' as const,
      viewerClipCapElevMm: 3000,
      viewerClipFloorElevMm: undefined,
      hiddenSemanticKinds3d: ['roof'],
    };
    expect(viewpointOrbit3dEvidenceLine(vp)).toBe('clip cap 3000 · floor ∅ · 1 hid · cut:cap');

    expect(
      viewpointOrbit3dEvidenceLine({
        ...vp,
        mode: 'plan_2d',
      }),
    ).toBe('');
  });

  it('viewpointOrbit3dCutawayStyleToken and label cover clip combinations', () => {
    const base = {
      kind: 'viewpoint' as const,
      id: 'v1',
      name: 'V',
      camera: {
        position: { xMm: 0, yMm: 0, zMm: 0 },
        target: { xMm: 1, yMm: 0, zMm: 0 },
        up: { xMm: 0, yMm: 0, zMm: 1 },
      },
      mode: 'orbit_3d' as const,
    };
    expect(viewpointOrbit3dCutawayStyleToken({ ...base })).toBe('none');
    expect(viewpointOrbit3dCutawayStyleLabel({ ...base })).toBe('No elevation clip');

    expect(
      viewpointOrbit3dCutawayStyleToken({
        ...base,
        viewerClipCapElevMm: 4000,
      }),
    ).toBe('cap');
    expect(viewpointOrbit3dCutawayStyleLabel({ ...base, viewerClipCapElevMm: 4000 })).toBe(
      'Cap clip only',
    );

    expect(
      viewpointOrbit3dCutawayStyleToken({
        ...base,
        viewerClipFloorElevMm: 1000,
      }),
    ).toBe('floor');
    expect(viewpointOrbit3dCutawayStyleLabel({ ...base, viewerClipFloorElevMm: 1000 })).toBe(
      'Floor clip only',
    );

    expect(
      viewpointOrbit3dCutawayStyleToken({
        ...base,
        viewerClipCapElevMm: 4000,
        viewerClipFloorElevMm: 1000,
      }),
    ).toBe('box');
    expect(
      viewpointOrbit3dCutawayStyleLabel({
        ...base,
        viewerClipCapElevMm: 4000,
        viewerClipFloorElevMm: 1000,
      }),
    ).toBe('Box clip (cap + floor)');

    expect(
      viewpointOrbit3dCutawayStyleToken({
        ...base,
        viewerClipCapElevMm: 4000,
        viewerClipFloorElevMm: 1000,
        cutawayStyle: 'none',
      }),
    ).toBe('none');
    expect(
      viewpointOrbit3dEvidenceLine({
        ...base,
        viewerClipCapElevMm: 4000,
        viewerClipFloorElevMm: 1000,
        hiddenSemanticKinds3d: [],
        cutawayStyle: 'none',
      }),
    ).toBe('clip cap 4000 · floor 1000 · 0 hid · cut:none');

    expect(viewpointOrbit3dCutawayStyleToken({ ...base, mode: 'plan_2d' })).toBe('none');
  });

  it('viewpointOrbit3dEvidenceLine appends section box token when sectionBoxEnabled is set', () => {
    const base = {
      kind: 'viewpoint' as const,
      id: 'vsbox',
      name: 'SBox',
      camera: {
        position: { xMm: 0, yMm: 0, zMm: 0 },
        target: { xMm: 1, yMm: 0, zMm: 0 },
        up: { xMm: 0, yMm: 0, zMm: 1 },
      },
      mode: 'orbit_3d' as const,
      hiddenSemanticKinds3d: [] as string[],
    };
    // sectionBoxEnabled=false → sbox:off suffix
    expect(viewpointOrbit3dEvidenceLine({ ...base, sectionBoxEnabled: false })).toBe(
      'clip cap ∅ · floor ∅ · 0 hid · cut:none · sbox:off',
    );

    // sectionBoxEnabled=true without bounds → sbox:on suffix
    expect(viewpointOrbit3dEvidenceLine({ ...base, sectionBoxEnabled: true })).toBe(
      'clip cap ∅ · floor ∅ · 0 hid · cut:none · sbox:on',
    );

    // sectionBoxEnabled=true with bounds → full coordinate token
    expect(
      viewpointOrbit3dEvidenceLine({
        ...base,
        sectionBoxEnabled: true,
        sectionBoxMinMm: { xMm: -500, yMm: 0, zMm: 0 },
        sectionBoxMaxMm: { xMm: 4000, yMm: 3000, zMm: 2800 },
      }),
    ).toBe('clip cap ∅ · floor ∅ · 0 hid · cut:none · sbox[-500,0,0→4000,3000,2800]');

    // sectionBoxEnabled null (not set) → no sbox suffix
    expect(viewpointOrbit3dEvidenceLine({ ...base })).toBe(
      'clip cap ∅ · floor ∅ · 0 hid · cut:none',
    );
  });

  it('viewpointOrbit3dHiddenKindsReadout lists kinds and ellipsizes long lists', () => {
    const vp = {
      kind: 'viewpoint' as const,
      id: 'v1',
      name: 'V',
      camera: {
        position: { xMm: 0, yMm: 0, zMm: 0 },
        target: { xMm: 1, yMm: 0, zMm: 0 },
        up: { xMm: 0, yMm: 0, zMm: 1 },
      },
      mode: 'orbit_3d' as const,
    };
    expect(viewpointOrbit3dHiddenKindsReadout(vp)).toBe('—');
    expect(
      viewpointOrbit3dHiddenKindsReadout({
        ...vp,
        hiddenSemanticKinds3d: ['wall', 'door'],
      }),
    ).toBe('2: wall, door');

    const long = Array.from({ length: 20 }, (_, i) => `kind_${i}`);
    const out = viewpointOrbit3dHiddenKindsReadout({ ...vp, hiddenSemanticKinds3d: long });
    expect(out.endsWith('…')).toBe(true);
    expect(out.startsWith('20: ')).toBe(true);
  });
});

describe('F2 — resolvePhaseGraphicStyle', () => {
  const VIEW_PHASE = 'phase-new';
  const PRIOR_PHASE = 'phase-old';

  it('returns normal style when no phaseFilterMode set', () => {
    const style = resolvePhaseGraphicStyle(VIEW_PHASE, null, PRIOR_PHASE, null);
    expect(style.hidden).toBe(false);
    expect(style.opacity).toBe(1);
    expect(style.dashed).toBe(false);
    expect(style.grey).toBe(false);
  });

  it('returns normal style when no viewPhaseId', () => {
    const style = resolvePhaseGraphicStyle(null, 'new_construction', PRIOR_PHASE, null);
    expect(style.hidden).toBe(false);
    expect(style.opacity).toBe(1);
  });

  it('new_construction mode: new element shows normal', () => {
    const style = resolvePhaseGraphicStyle(VIEW_PHASE, 'new_construction', VIEW_PHASE, null);
    expect(style.hidden).toBe(false);
    expect(style.opacity).toBe(1);
    expect(style.grey).toBe(false);
  });

  it('new_construction mode: existing element gets grey reduced opacity', () => {
    const style = resolvePhaseGraphicStyle(VIEW_PHASE, 'new_construction', PRIOR_PHASE, null);
    expect(style.hidden).toBe(false);
    expect(style.grey).toBe(true);
    expect(style.opacity).toBeLessThan(1);
  });

  it('new_construction mode: demolished element is hidden', () => {
    const style = resolvePhaseGraphicStyle(VIEW_PHASE, 'new_construction', PRIOR_PHASE, VIEW_PHASE);
    expect(style.hidden).toBe(true);
  });

  it('demolition mode: demo wall gets dashed', () => {
    const style = resolvePhaseGraphicStyle(VIEW_PHASE, 'demolition', PRIOR_PHASE, VIEW_PHASE);
    expect(style.hidden).toBe(false);
    expect(style.dashed).toBe(true);
  });

  it('demolition mode: existing wall gets reduced opacity', () => {
    const style = resolvePhaseGraphicStyle(VIEW_PHASE, 'demolition', PRIOR_PHASE, null);
    expect(style.hidden).toBe(false);
    expect(style.opacity).toBeLessThan(1);
    expect(style.grey).toBe(true);
  });

  it('demolition mode: new element is hidden', () => {
    const style = resolvePhaseGraphicStyle(VIEW_PHASE, 'demolition', VIEW_PHASE, null);
    expect(style.hidden).toBe(true);
  });

  it('existing mode: existing element shows normal', () => {
    const style = resolvePhaseGraphicStyle(VIEW_PHASE, 'existing', PRIOR_PHASE, null);
    expect(style.hidden).toBe(false);
    expect(style.opacity).toBe(1);
  });

  it('existing mode: new element is hidden', () => {
    const style = resolvePhaseGraphicStyle(VIEW_PHASE, 'existing', VIEW_PHASE, null);
    expect(style.hidden).toBe(true);
  });

  it('as_built mode: all elements show normal', () => {
    const s1 = resolvePhaseGraphicStyle(VIEW_PHASE, 'as_built', VIEW_PHASE, null);
    const s2 = resolvePhaseGraphicStyle(VIEW_PHASE, 'as_built', PRIOR_PHASE, VIEW_PHASE);
    expect(s1.hidden).toBe(false);
    expect(s2.hidden).toBe(false);
    expect(s1.opacity).toBe(1);
  });
});
