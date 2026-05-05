import { describe, expect, it } from 'vitest';

import {
  indexViewportEvidenceHints,
  sheetExportHrefTriple,
  viewportCropExtentsMm,
} from './sheetDocumentationManifestHelpers';

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
      },
    ];
    const m = indexViewportEvidenceHints(hints);
    expect(m.size).toBe(2);
    expect(String(m.get('vp-plan')?.planProjectionSegment)).toContain('planPrim');
  });
});
