import type { Element } from '@bim-ai/core';
import { describe, expect, it } from 'vitest';

import {
  canonHiddenCategory,
  planViewGraphicsMatrixRows,
  planViewInheritanceSummaryLines,
  planViewProjectBrowserEvidenceLine,
  resolvePlanGraphicHints,
  resolvePlanViewDisplay,
  viewTemplateGraphicsMatrixRows,
  viewpointOrbit3dEvidenceLine,
} from './planProjection';
import { extractPlanGraphicHints } from './planProjectionWire';

describe('planProjection', () => {
  it('maps common category aliases', () => {
    expect(canonHiddenCategory('Rooms')).toBe('room');
    expect(canonHiddenCategory('grid-lines')).toBe('grid_line');
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
        planOpeningTagDefinitionId: 'tag-door',
        planRoomTagDefinitionId: 'tag-room',
      },
      'tag-door': {
        kind: 'tag_definition',
        id: 'tag-door',
        name: 'Door mark',
        tagKind: 'sill',
        planTagStyle: { labelPrefix: 'D-', textCase: 'upper' },
      },
      'tag-room': {
        kind: 'tag_definition',
        id: 'tag-room',
        name: 'Room bubble',
        tagKind: 'room',
        planTagStyle: { labelSuffix: ' R', textCase: 'preserve' },
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
    expect(lines.some((l) => l.includes('Tag catalog: opening=Door mark'))).toBe(true);
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
        planOpeningTagDefinitionId: 'tag-opening',
        planRoomTagDefinitionId: 'tag-room',
      },
      'tag-opening': {
        kind: 'tag_definition',
        id: 'tag-opening',
        name: 'Opening mark',
        tagKind: 'sill',
        planTagStyle: { labelPrefix: 'OP-', textCase: 'upper' },
      },
      'tag-room': {
        kind: 'tag_definition',
        id: 'tag-room',
        name: 'Room mark',
        tagKind: 'room',
        planTagStyle: { labelPrefix: 'RM-', textCase: 'preserve' },
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
    expect(rows.find((r) => r.label === 'Opening tag catalog')?.effective).toContain(
      'Opening mark',
    );
    expect(rows.find((r) => r.label === 'Room tag catalog')?.effective).toContain('Room mark');
    expect(planViewProjectBrowserEvidenceLine(elementsById, 'pv')).toMatch(/fill 0\.4/);
    expect(planViewProjectBrowserEvidenceLine(elementsById, 'pv')).toMatch(/tags on\/off/);
    expect(planViewProjectBrowserEvidenceLine(elementsById, 'pv')).toMatch(
      /catalog Opening mark\/Room mark/,
    );
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
        planOpeningTagDefinitionId: 'tag-door',
      },
      'tag-door': {
        kind: 'tag_definition',
        id: 'tag-door',
        name: 'Door mark',
        tagKind: 'sill',
        planTagStyle: { labelPrefix: 'D-', textCase: 'upper' },
      },
    } as Record<string, Element>;
    const rows = viewTemplateGraphicsMatrixRows(elementsById, 'vt');
    expect(rows.find((r) => r.label === 'Detail level')?.stored).toBe('fine');
    expect(rows.find((r) => r.label === 'Detail level')?.effective).toBe('fine');
    expect(rows.find((r) => r.label === 'Room fill')?.effective).toBe('0.5');
    expect(rows.find((r) => r.label === 'Opening tags')?.effective).toBe('on');
    expect(rows.find((r) => r.label === 'Room labels')?.effective).toBe('off');
    expect(rows.find((r) => r.label === 'Opening tag catalog')?.effective).toContain('Door mark');
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
    expect(viewpointOrbit3dEvidenceLine(vp)).toBe('clip cap 3000 · floor ∅ · 1 hid');

    expect(
      viewpointOrbit3dEvidenceLine({
        ...vp,
        mode: 'plan_2d',
      }),
    ).toBe('');
  });
});
