import type { Element } from '@bim-ai/core';
import { describe, expect, it } from 'vitest';

import {
  DOCUMENTATION_FIDELITY_CONTRACTS,
  evaluateAnnotationDimensionIntegrityContract,
  evaluateDocumentationExportParityContract,
  evaluatePlanViewFidelityContract,
  evaluateSectionElevationFidelityContract,
  evaluateSheetViewportFidelityContract,
  evaluateTwoDGoldenFixtureReadinessContract,
} from './documentationFidelityContracts';

const level: Element = { kind: 'level', id: 'lvl-1', name: 'Ground', elevationMm: 0 } as Element;
const planView: Element = {
  kind: 'plan_view',
  id: 'pv-ground',
  name: 'Ground floor plan',
  levelId: 'lvl-1',
  discipline: 'architecture',
  graphicsMode: 'hidden_line',
} as Element;
const sectionView: Element = {
  kind: 'section_cut',
  id: 'sec-a',
  name: 'Section A',
  lineStartMm: { xMm: 0, yMm: 0 },
  lineEndMm: { xMm: 4000, yMm: 0 },
  cropDepthMm: 3500,
} as Element;
const elevationView: Element = {
  kind: 'elevation_view',
  id: 'elev-n',
  name: 'North elevation',
  direction: 'north',
  cropMinMm: { xMm: -500, yMm: -500 },
  cropMaxMm: { xMm: 5000, yMm: 3500 },
  discipline: 'architecture',
  graphicsMode: 'hidden_line',
} as Element;
const wall: Element = {
  kind: 'wall',
  id: 'w-1',
  name: 'Wall 1',
  levelId: 'lvl-1',
  startMm: { xMm: 0, yMm: 0 },
  endMm: { xMm: 4000, yMm: 0 },
  heightMm: 3000,
  thicknessMm: 200,
  materialKey: 'mat-gypsum',
} as unknown as Element;

describe('DOCUMENTATION_FIDELITY_CONTRACTS', () => {
  it('declares deterministic evidence keys for BIR-R01 through BIR-R06', () => {
    expect(Object.keys(DOCUMENTATION_FIDELITY_CONTRACTS)).toEqual([
      'BIR-R01',
      'BIR-R02',
      'BIR-R03',
      'BIR-R04',
      'BIR-R05',
      'BIR-R06',
    ]);
    expect(DOCUMENTATION_FIDELITY_CONTRACTS['BIR-R05'].evidenceKey).toBe(
      'documentationExportParity_v1',
    );
  });
});

describe('evaluatePlanViewFidelityContract', () => {
  it('passes model-backed plan primitives and accepts diagnostics for unsupported cuts', () => {
    const result = evaluatePlanViewFidelityContract({
      elementsById: {
        'lvl-1': level,
        'w-1': wall,
        'd-1': { kind: 'door', id: 'd-1', wallId: 'w-1', t: 0.5 } as unknown as Element,
        'tag-1': {
          kind: 'placed_tag',
          id: 'tag-1',
          hostElementId: 'd-1',
          hostViewId: 'pv-ground',
          positionMm: { xMm: 0, yMm: 0 },
        } as Element,
      },
      primitiveCounts: { wall: 1, door: 1, level: 1, tag: 1 },
      diagnostics: ['hidden_cut_graphics intentionally omitted for coarse projection'],
      requiredFeatures: ['wall', 'door', 'level', 'annotation', 'hidden_cut_graphics'],
    });

    expect(result.status).toBe('pass');
    expect(result.rows.map((row) => row.scopeId)).toEqual([
      'annotation',
      'door',
      'hidden_cut_graphics',
      'level',
      'wall',
    ]);
  });

  it('fails when a covered plan feature has neither primitive nor diagnostic evidence', () => {
    const result = evaluatePlanViewFidelityContract({
      elementsById: {
        'door-1': { kind: 'door', id: 'door-1', wallId: 'w-1', t: 0.5 } as unknown as Element,
      },
      primitiveCounts: {},
      requiredFeatures: ['door'],
    });

    expect(result.status).toBe('fail');
    expect(result.issues[0].id).toBe('plan_door_missing_render_or_diagnostic');
  });
});

describe('evaluateSectionElevationFidelityContract', () => {
  it('requires cut/depth/opening/stair/roof/floor/material evidence for section and elevation views', () => {
    const elementsById: Record<string, Element> = {
      'lvl-1': level,
      'sec-a': sectionView,
      'elev-n': elevationView,
      'w-1': wall,
      'win-1': { kind: 'window', id: 'win-1', wallId: 'w-1', t: 0.25 } as unknown as Element,
      'stair-1': { kind: 'stair', id: 'stair-1', levelId: 'lvl-1' } as unknown as Element,
      'roof-1': { kind: 'roof', id: 'roof-1', levelId: 'lvl-1' } as unknown as Element,
      'floor-1': { kind: 'floor', id: 'floor-1', levelId: 'lvl-1' } as unknown as Element,
    };
    const result = evaluateSectionElevationFidelityContract({
      elementsById,
      evidenceRows: [
        {
          viewId: 'sec-a',
          viewKind: 'section',
          cutPlanePresent: true,
          viewDepthMm: 3500,
          sectionBoxPresent: true,
          hiddenLineCount: 2,
          openingCutCount: 1,
          stairProjectionCount: 1,
          roofProjectionCount: 1,
          floorProjectionCount: 1,
          materialHatchCount: 1,
        },
        {
          viewId: 'elev-n',
          viewKind: 'elevation',
          viewDepthMm: 5000,
          sectionBoxPresent: true,
          hiddenLineCount: 1,
          openingCutCount: 1,
          stairProjectionCount: 1,
          roofProjectionCount: 1,
          floorProjectionCount: 1,
          materialHatchCount: 1,
        },
      ],
    });

    expect(result.status).toBe('pass');
    expect(result.rows).toHaveLength(2);
  });

  it('reports the exact failed section/elevation check', () => {
    const result = evaluateSectionElevationFidelityContract({
      elementsById: { 'sec-a': sectionView, 'w-1': wall },
      evidenceRows: [{ viewId: 'sec-a', viewKind: 'section', viewDepthMm: 1000 }],
    });

    expect(result.status).toBe('fail');
    expect(result.issues.map((issue) => issue.id)).toContain('section_elevation_cutPlanePresent');
    expect(result.issues.map((issue) => issue.id)).toContain('section_elevation_materialsHandled');
  });
});

describe('evaluateSheetViewportFidelityContract', () => {
  it('passes plan, section, and schedule viewports with metadata and evidence links', () => {
    const schedule: Element = {
      kind: 'schedule',
      id: 'sch-room',
      name: 'Room Schedule',
    } as Element;
    const sheet: Element = {
      kind: 'sheet',
      id: 'sheet-a101',
      name: 'A101',
      viewportsMm: [
        {
          viewportId: 'vp-plan',
          viewRef: 'plan:pv-ground',
          label: 'Ground floor plan',
          scale: '1:100',
          cropMinMm: { xMm: 0, yMm: 0 },
          cropMaxMm: { xMm: 1000, yMm: 1000 },
          widthMm: 18000,
          heightMm: 12000,
          discipline: 'architecture',
          graphicsMode: 'hidden_line',
        },
        {
          viewportId: 'vp-sec',
          viewRef: 'section:sec-a',
          label: 'Section A',
          scale: '1:100',
          cropMinMm: { xMm: 0, yMm: 0 },
          cropMaxMm: { xMm: 1000, yMm: 1000 },
          widthMm: 12000,
          heightMm: 9000,
          discipline: 'architecture',
          graphicsMode: 'hidden_line',
        },
        {
          viewportId: 'vp-sch',
          viewRef: 'schedule:sch-room',
          label: 'Room Schedule',
          widthMm: 9000,
          heightMm: 5000,
          discipline: 'architecture',
          graphicsMode: 'table',
        },
      ],
    } as Element;

    const result = evaluateSheetViewportFidelityContract({
      elementsById: {
        'sheet-a101': sheet,
        'pv-ground': planView,
        'sec-a': sectionView,
        'sch-room': schedule,
      },
      sheetId: 'sheet-a101',
      evidenceHints: [
        { viewportId: 'vp-plan', planProjectionSegment: 'planPrim[wall=4]' },
        { viewportId: 'vp-sec', sectionDocumentationSegment: 'secDoc[z=0..3000]' },
        { viewportId: 'vp-sch', scheduleDocumentationSegment: 'schDoc[id=sch-room rows=3]' },
      ],
    });

    expect(result.status).toBe('pass');
    expect(result.rows.map((row) => row.scopeId)).toEqual(['vp-plan', 'vp-sch', 'vp-sec']);
  });

  it('fails unresolved refs and zero extents deterministically', () => {
    const sheet: Element = {
      kind: 'sheet',
      id: 'sheet-a101',
      name: 'A101',
      viewportsMm: [{ viewportId: 'vp-bad', viewRef: 'plan:missing', widthMm: 0, heightMm: 100 }],
    } as Element;
    const result = evaluateSheetViewportFidelityContract({
      elementsById: { 'sheet-a101': sheet },
      sheetId: 'sheet-a101',
    });

    expect(result.status).toBe('fail');
    expect(result.issues.map((issue) => issue.id)).toContain('sheet_viewport_viewRefResolved');
    expect(result.issues.map((issue) => issue.id)).toContain('sheet_viewport_positiveExtent');
  });
});

describe('evaluateAnnotationDimensionIntegrityContract', () => {
  it('passes live tags and permanent dimensions with resolved witness references', () => {
    const result = evaluateAnnotationDimensionIntegrityContract({
      elementsById: {
        'lvl-1': level,
        'pv-ground': planView,
        'w-1': wall,
        'tag-1': {
          kind: 'placed_tag',
          id: 'tag-1',
          hostElementId: 'w-1',
          hostViewId: 'pv-ground',
          positionMm: { xMm: 500, yMm: 300 },
        } as Element,
        'dim-1': {
          kind: 'permanent_dimension',
          id: 'dim-1',
          levelId: 'lvl-1',
          witnessPointsMm: [
            { xMm: 0, yMm: 0, referencedElementId: 'w-1', referenceEdge: 'start' },
            { xMm: 4000, yMm: 0, referencedElementId: 'w-1', referenceEdge: 'end' },
          ],
          offsetMm: { xMm: 0, yMm: 500 },
        } as Element,
      },
    });

    expect(result.status).toBe('pass');
    expect(result.rows.map((row) => row.scopeId)).toEqual(['dim-1', 'tag-1']);
  });

  it('fails stale linked dimensions and orphan tags', () => {
    const result = evaluateAnnotationDimensionIntegrityContract({
      elementsById: {
        'lvl-1': level,
        'dim-stale': {
          kind: 'dimension',
          id: 'dim-stale',
          name: 'bad dimension',
          levelId: 'lvl-1',
          aMm: { xMm: 0, yMm: 0 },
          bMm: { xMm: 1000, yMm: 0 },
          offsetMm: { xMm: 0, yMm: 100 },
          refElementIdA: 'missing-a',
          refElementIdB: 'missing-b',
          state: 'linked',
        } as Element,
        'tag-orphan': {
          kind: 'placed_tag',
          id: 'tag-orphan',
          hostElementId: 'missing-host',
          hostViewId: 'missing-view',
          positionMm: { xMm: 0, yMm: 0 },
        } as Element,
      },
    });

    expect(result.status).toBe('fail');
    expect(result.issues.map((issue) => issue.id)).toContain(
      'annotation_dimension_dimensionStateMatchesRefs',
    );
    expect(result.issues.map((issue) => issue.id)).toContain(
      'annotation_dimension_hostElementResolved',
    );
  });
});

describe('evaluateDocumentationExportParityContract', () => {
  it('passes matching digests and warns only when divergence is fully listed as unsupported', () => {
    const result = evaluateDocumentationExportParityContract({
      rows: [
        {
          scopeId: 'sheet-a101:pdf',
          exportType: 'pdf',
          savedViewDigest: 'a',
          exportDigest: 'a',
        },
        {
          scopeId: 'sheet-a101:render',
          exportType: 'render_bundle',
          savedViewDigest: 'a',
          exportDigest: 'b',
          unsupportedFeatures: ['gradient-fill'],
          listedUnsupportedFeatures: ['gradient-fill'],
        },
      ],
    });

    expect(result.status).toBe('warn');
    expect(result.issues[0].id).toBe('documentation_export_digest_mismatch_supported_by_evidence');
  });

  it('fails digest divergence without unsupported-feature evidence', () => {
    const result = evaluateDocumentationExportParityContract({
      rows: [
        {
          scopeId: 'sheet-a101:svg',
          exportType: 'sheet_svg',
          savedViewDigest: 'a',
          exportDigest: 'b',
        },
      ],
    });

    expect(result.status).toBe('fail');
    expect(result.issues[0].id).toBe('documentation_export_digest_mismatch');
  });
});

describe('evaluateTwoDGoldenFixtureReadinessContract', () => {
  it('passes when plan, section, elevation, and sheet goldens cover required 2D features', () => {
    const allFeatures = [
      'hosted_openings',
      'roof_cuts',
      'stairs',
      'rooms',
      'annotations',
      'lens_modes',
    ] as const;
    const result = evaluateTwoDGoldenFixtureReadinessContract({
      fixtures: [
        { id: 'golden-plan', surface: 'plan', features: [...allFeatures] },
        { id: 'golden-section', surface: 'section', features: [...allFeatures] },
        { id: 'golden-elevation', surface: 'elevation', features: [...allFeatures] },
        { id: 'golden-sheet', surface: 'sheet', features: [...allFeatures] },
      ],
    });

    expect(result.status).toBe('pass');
    expect(result.rows.map((row) => row.scopeId)).toEqual([
      'elevation',
      'plan',
      'section',
      'sheet',
    ]);
  });

  it('fails missing surfaces and feature gaps with stable issue ids', () => {
    const result = evaluateTwoDGoldenFixtureReadinessContract({
      fixtures: [{ id: 'golden-plan', surface: 'plan', features: ['hosted_openings'] }],
    });

    expect(result.status).toBe('fail');
    expect(result.issues.map((issue) => issue.id)).toEqual([
      'golden_fixture_elevation_missing_features',
      'golden_fixture_plan_missing_features',
      'golden_fixture_section_missing_features',
      'golden_fixture_sheet_missing_features',
    ]);
  });
});
