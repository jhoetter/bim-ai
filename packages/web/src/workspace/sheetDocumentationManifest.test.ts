import type { Element } from '@bim-ai/core';
import { describe, expect, it } from 'vitest';

import {
  extractPlanSheetViewportPlacementEvidence,
  indexViewportEvidenceHints,
  planOnSheetTokenLabel,
  sheetExportHrefTriple,
  viewportCropExtentsMm,
} from './sheetDocumentationManifestHelpers';
import {
  formatSheetRevIssExportListingSegmentV1,
  normalizeTitleblockRevisionIssueV1,
} from './sheetRevisionIssueManifestV1';
import { scheduleTableRendererV1SheetReadout } from '../schedules/scheduleTableRendererV1';

describe('viewportCropExtentsMm', () => {
  it('returns absolute span between corners', () => {
    expect(viewportCropExtentsMm({ xMm: 1, yMm: 2 }, { xMm: 5, yMm: 10 })).toEqual({
      widthMm: 4,
      heightMm: 8,
    });
    expect(viewportCropExtentsMm({ xMm: 9, yMm: 9 }, { xMm: 1, yMm: 1 })).toEqual({
      widthMm: 8,
      heightMm: 8,
    });
  });

  it('returns null when corners missing', () => {
    expect(viewportCropExtentsMm(null, { xMm: 1, yMm: 1 })).toBeNull();
    expect(viewportCropExtentsMm({ xMm: 1, yMm: 1 }, null)).toBeNull();
  });
});

describe('sheetExportHrefTriple', () => {
  it('matches deterministic manifest URL shape', () => {
    expect(sheetExportHrefTriple('mid', 'hf-sheet-ga01')).toEqual({
      svgHref: '/api/models/mid/exports/sheet-preview.svg?sheetId=hf-sheet-ga01',
      pdfHref: '/api/models/mid/exports/sheet-preview.pdf?sheetId=hf-sheet-ga01',
      printRasterPngHref: '/api/models/mid/exports/sheet-print-raster.png?sheetId=hf-sheet-ga01',
    });
  });

  it('encodes ids', () => {
    const h = sheetExportHrefTriple('a/b', 'id with space');
    expect(h.svgHref).toContain(encodeURIComponent('a/b'));
    expect(h.svgHref).toContain(encodeURIComponent('id with space'));
  });
});

describe('indexViewportEvidenceHints', () => {
  it('indexes room programme legend documentation segment', () => {
    const m = indexViewportEvidenceHints([
      {
        viewportId: 'vp-leg',
        crop: 'omit',
        roomProgrammeLegendDocumentationSegment: 'roomLegDoc[n=1 sha=a]',
      },
    ]);
    expect(String(m.get('vp-leg')?.roomProgrammeLegendDocumentationSegment)).toContain('roomLegDoc');
  });

  it('indexes detail callout documentation segment', () => {
    const m = indexViewportEvidenceHints([
      {
        viewportId: 'vp-dc',
        crop: 'omit',
        detailCalloutDocumentationSegment: 'detailCo[vp=vp-dc ref=plan:x status=ok ttl=y]',
      },
    ]);
    expect(String(m.get('vp-dc')?.detailCalloutDocumentationSegment)).toContain('detailCo');
  });

  it('indexes hints by viewportId', () => {
    const m = indexViewportEvidenceHints([
      { viewportId: 'vp-a', crop: 'omit', planProjectionSegment: 'planPrim[x]' },
      { viewportId: 'vp-b', sectionDocumentationSegment: 'secDoc[y]' },
    ]);
    expect(m.get('vp-a')?.crop).toBe('omit');
    expect(m.get('vp-b')?.sectionDocumentationSegment).toBe('secDoc[y]');
  });

  it('handles mixed viewport evidence rows like deterministic_sheet_evidence_manifest', () => {
    const hints = [
      {
        viewportId: 'vp-plan',
        geom: '[0,0] 100×100 mm',
        crop: 'x0 y0',
        planProjectionSegment: 'planPrim[…]',
        sectionDocumentationSegment: '',
      },
      {
        viewportId: 'vp-sch',
        geom: '[10,10] 50×50 mm',
        crop: 'omit',
        planProjectionSegment: '',
        sectionDocumentationSegment: '',
        scheduleDocumentationSegment: 'schDoc[id=s1 rows=0 cols=3 cat=door]',
      },
    ];
    const m = indexViewportEvidenceHints(hints);
    expect(m.size).toBe(2);
    expect(String(m.get('vp-plan')?.planProjectionSegment)).toContain('planPrim');
    expect(String(m.get('vp-sch')?.scheduleDocumentationSegment)).toContain('schDoc');
  });
});

describe('titleblockRevisionIssueSegmentsV1', () => {
  it('formats listing segment with deterministic inner token ordering', () => {
    const norm = normalizeTitleblockRevisionIssueV1({
      revisionId: 'R-1',
      revisionCode: 'B',
      revisionDate: '2026-05-05',
      issueStatus: 'issued',
      revisionDescription: 'x',
    });
    expect(formatSheetRevIssExportListingSegmentV1(norm)).toMatch(/^sheetRevIssList\[/);
    expect(formatSheetRevIssExportListingSegmentV1(norm)).toContain('id=R-1');
    expect(formatSheetRevIssExportListingSegmentV1(norm)).toContain('code=B');
  });
});

describe('extractPlanSheetViewportPlacementEvidence', () => {
  const makeRow = (overrides: Record<string, unknown> = {}) => ({
    format: 'planSheetViewportPlacementEvidence_v1',
    viewportId: 'vp-1',
    planViewId: 'pv-1',
    sheetViewportMmBox: { xMm: 10, yMm: 10, widthMm: 200, heightMm: 150 },
    resolvedPlanCropMmBox: { xMinMm: 0, yMinMm: 0, xMaxMm: 5000, yMaxMm: 4000 },
    intersectClampToken: 'inside',
    primitiveCounts: { inBox: { wall: 5, room: 2 }, clipped: { wall: 3 } },
    planOnSheetSegmentDigestSha256: 'a'.repeat(64),
    ...overrides,
  });

  it('parses valid rows and sorts by viewportId', () => {
    const rows = extractPlanSheetViewportPlacementEvidence([
      makeRow({ viewportId: 'vp-z' }),
      makeRow({ viewportId: 'vp-a' }),
    ]);
    expect(rows).toHaveLength(2);
    expect(rows[0].viewportId).toBe('vp-a');
    expect(rows[1].viewportId).toBe('vp-z');
  });

  it('returns empty for non-array input', () => {
    expect(extractPlanSheetViewportPlacementEvidence(null)).toEqual([]);
    expect(extractPlanSheetViewportPlacementEvidence({})).toEqual([]);
  });

  it('skips rows with wrong format', () => {
    const rows = extractPlanSheetViewportPlacementEvidence([
      makeRow({ format: 'other_format' }),
    ]);
    expect(rows).toEqual([]);
  });

  it('extracts inBox and clipped primitive counts', () => {
    const rows = extractPlanSheetViewportPlacementEvidence([makeRow()]);
    expect(rows[0].primitiveCounts.inBox).toEqual({ wall: 5, room: 2 });
    expect(rows[0].primitiveCounts.clipped).toEqual({ wall: 3 });
  });

  it('handles null resolvedPlanCropMmBox', () => {
    const rows = extractPlanSheetViewportPlacementEvidence([
      makeRow({ resolvedPlanCropMmBox: null }),
    ]);
    expect(rows[0].resolvedPlanCropMmBox).toBeNull();
  });

  it('extracts sheetViewportMmBox', () => {
    const rows = extractPlanSheetViewportPlacementEvidence([makeRow()]);
    expect(rows[0].sheetViewportMmBox).toEqual({ xMm: 10, yMm: 10, widthMm: 200, heightMm: 150 });
  });

  it('includes segment digest', () => {
    const rows = extractPlanSheetViewportPlacementEvidence([makeRow()]);
    expect(rows[0].planOnSheetSegmentDigestSha256).toBe('a'.repeat(64));
  });

  it('returns intersectClampToken', () => {
    const rows = extractPlanSheetViewportPlacementEvidence([makeRow({ intersectClampToken: 'clamped' })]);
    expect(rows[0].intersectClampToken).toBe('clamped');
  });
});

describe('planOnSheetTokenLabel', () => {
  it('returns human-readable labels for all tokens', () => {
    expect(planOnSheetTokenLabel('inside')).toBe('inside');
    expect(planOnSheetTokenLabel('clamped')).toBe('clamped');
    expect(planOnSheetTokenLabel('crop_missing')).toBe('crop missing');
    expect(planOnSheetTokenLabel('viewport_zero_extent')).toBe('viewport zero extent');
    expect(planOnSheetTokenLabel('crop_inverted')).toBe('crop inverted');
  });

  it('passes through unknown tokens', () => {
    expect(planOnSheetTokenLabel('unknown_token')).toBe('unknown_token');
  });
});

describe('scheduleTableRendererV1SheetReadout', () => {
  it('adds tblV1 token with resolved schedule name for sheet manifest hints', () => {
    const elementsById = {
      s1: { kind: 'schedule', id: 's1', name: 'Room Schedule' },
    } as Record<string, Element>;
    expect(
      scheduleTableRendererV1SheetReadout('schDoc[id=s1 rows=0 cols=3 cat=room]', elementsById),
    ).toBe('tblV1[id=s1 name=Room Schedule rows=0 cols=3 cat=room]');
  });
});
