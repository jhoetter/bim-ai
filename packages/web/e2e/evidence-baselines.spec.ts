import { createHash } from 'node:crypto';

import { expect, test, type Page } from '@playwright/test';

/** Visual baselines for Revit-parity Phase A evidence (sheet + schedules + split plan / 3D regions). */

const MODEL_ID = '00000000-0000-4000-a000-00000000e2e';

/** Mock evidence-package semantic tokens (stable; aligns with deterministicSheetEvidence[].playwright PNG stem). */

const MOCK_SEMANTIC_DIGEST_SHA256 =
  'e2efe2e0e2efe2e000000000000000000000000000000000000000000000000';

const MOCK_SEMANTIC_PREFIX16 = MOCK_SEMANTIC_DIGEST_SHA256.slice(0, 16);

const MOCK_EVIDENCE_BASENAME = `bim-ai-evidence-${MOCK_SEMANTIC_PREFIX16}-r3`;

/** Expected Playwright PNG filename for GA-01 sheet canvas (deterministicSheetEvidence stub). */

const MOCK_SHEET_VIEWPORT_PNG_FROM_MANIFEST = `${MOCK_EVIDENCE_BASENAME}-sheet-hf-sheet-ga01-viewport.png`;

const MOCK_SHEET_FULL_PNG_FROM_MANIFEST = `${MOCK_EVIDENCE_BASENAME}-sheet-hf-sheet-ga01-full.png`;

const MOCK_SHEET_RASTER_PLACEHOLDER_PROBE = `${MOCK_EVIDENCE_BASENAME}-sheet-hf-sheet-ga01.raster-placeholder.png`;

/** Print-surrogate v2 PNG bytes for mocked `sheet-print-raster` (matches server `sheetPrintRasterPrintSurrogate_v2`). */
const MOCK_SHEET_PRINT_RASTER_PNG_B64 =
  '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';

const MOCK_SHEET_PRINT_RASTER_PNG_BYTES = Uint8Array.from(
  Buffer.from(MOCK_SHEET_PRINT_RASTER_PNG_B64, 'base64'),
);

/** Sorted like server `evidenceClosureReview_v1.expectedDeterministicPngBasenames` for mock + assertions. */
const MOCK_CLOSURE_DETERMINISTIC_PNG_BASENAMES = [
  `${MOCK_EVIDENCE_BASENAME}-plan-pv-eg.png`,
  `${MOCK_EVIDENCE_BASENAME}-section-hf-sec-demo.png`,
  MOCK_SHEET_FULL_PNG_FROM_MANIFEST,
  MOCK_SHEET_VIEWPORT_PNG_FROM_MANIFEST,
].sort();

/** Canonical ingest pairs (sorted like `artifact_ingest_correlation_v1` in `evidence_manifest.py`). */
const MOCK_INGEST_PAIRS_SORTED = MOCK_CLOSURE_DETERMINISTIC_PNG_BASENAMES.filter((bn) =>
  bn.endsWith('.png'),
)
  .map((bn) => ({
    baselinePngBasename: bn,
    expectedDiffBasename: `${bn.replace(/\.png$/, '')}-diff.png`,
  }))
  .sort(
    (a, b) =>
      a.baselinePngBasename.localeCompare(b.baselinePngBasename) ||
      a.expectedDiffBasename.localeCompare(b.expectedDiffBasename),
  );

const MOCK_ARTIFACT_INGEST_DIGEST = createHash('sha256')
  .update(JSON.stringify(MOCK_INGEST_PAIRS_SORTED))
  .digest('hex');

async function sharedRoutes(page: Page, layoutPreset: string) {
  await page.addInitScript((preset: string) => {
    localStorage.setItem('bim.welcome.dismissed', '1');
    localStorage.setItem('bim.workspaceLayout', preset);
  }, layoutPreset);

  await page.route(`**/api/models/*/exports/sheet-print-raster.png**`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'image/png',
      body: Buffer.from(MOCK_SHEET_PRINT_RASTER_PNG_BYTES),
      headers: {
        'X-Bim-Ai-Sheet-Print-Raster-Contract': 'sheetPrintRasterPrintSurrogate_v2',
        'X-Bim-Ai-Sheet-Svg-Sha256':
          'f13a0871bd04a7cb933cf2fa97b0e49574275df627a64e8fcca695d8f44b9f86',
        'X-Bim-Ai-Sheet-Print-Raster-Width': '128',
        'X-Bim-Ai-Sheet-Print-Raster-Height': '112',
        'X-Bim-Ai-Sheet-Print-Raster-Png-Sha256':
          '769c7b0d8a5a6c623b6dfa9886352a594ee4b54ae2013dbc5d5d3707754ddfa2',
      },
    });
  });

  await page.route(`**/api/models/*/projection/plan**`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        format: 'planProjectionWire_v1',
        primitives: {
          format: 'planProjectionPrimitives_v1',
          walls: [],
          floors: [],
          rooms: [],
          doors: [],
          windows: [],
          stairs: [],
          roofs: [],
          gridLines: [],
          dimensions: [],
        },
      }),
    });
  });

  await page.route(`**/api/models/*/projection/section/**`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        format: 'sectionProjectionWire_v1',
        primitives: {
          format: 'sectionProjectionPrimitives_v1',
          walls: [{ uStartMm: 600, uEndMm: 7200, zBottomMm: 0, zTopMm: 5600 }],
          levelMarkers: [
            { id: 'hf-lvl-1', name: 'EG', elevationMm: 0 },
            { id: 'hf-lvl-2', name: 'OG', elevationMm: 2800 },
          ],
        },
      }),
    });
  });

  await page.route('**/api/bootstrap', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        projects: [
          {
            id: 'p-e2e',
            slug: 'e2e',
            title: 'E2E',
            models: [{ id: MODEL_ID, slug: 'm1', revision: 3 }],
          },
        ],
      }),
    });
  });

  await page.route(`**/api/models/${encodeURIComponent(MODEL_ID)}/snapshot`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        modelId: MODEL_ID,
        revision: 3,
        elements: {
          'hf-lvl-1': { kind: 'level', id: 'hf-lvl-1', name: 'EG', elevationMm: 0 },
          'hf-lvl-2': { kind: 'level', id: 'hf-lvl-2', name: 'OG', elevationMm: 2800 },
          'hf-wall-main': {
            kind: 'wall',
            id: 'hf-wall-main',
            name: 'Party wall',
            levelId: 'hf-lvl-1',
            start: { xMm: 0, yMm: 4000 },
            end: { xMm: 8000, yMm: 4000 },
            thicknessMm: 240,
            heightMm: 2800,
          },
          'hf-door-demo': {
            kind: 'door',
            id: 'hf-door-demo',
            name: 'Entry',
            wallId: 'hf-wall-main',
            alongT: 0.5,
            widthMm: 980,
          },
          'hf-win-demo': {
            kind: 'window',
            id: 'hf-win-demo',
            name: 'Living ribbon',
            wallId: 'hf-wall-main',
            alongT: 0.22,
            widthMm: 1200,
            sillHeightMm: 900,
            heightMm: 1400,
          },
          'rm-eg': {
            kind: 'room',
            id: 'rm-eg',
            name: 'Living',
            levelId: 'hf-lvl-1',
            outlineMm: [
              { xMm: 0, yMm: 0 },
              { xMm: 5000, yMm: 0 },
              { xMm: 5000, yMm: 4000 },
              { xMm: 0, yMm: 4000 },
            ],
          },
          'rm-og': {
            kind: 'room',
            id: 'rm-og',
            name: 'Loft east',
            levelId: 'hf-lvl-2',
            outlineMm: [
              { xMm: 2000, yMm: 2000 },
              { xMm: 6000, yMm: 2000 },
              { xMm: 6000, yMm: 5000 },
              { xMm: 2000, yMm: 5000 },
            ],
          },
          'hf-grid-a': {
            kind: 'grid_line',
            id: 'hf-grid-a',
            name: 'Axis A',
            levelId: 'hf-lvl-1',
            start: { xMm: 4000, yMm: 0 },
            end: { xMm: 4000, yMm: 8000 },
          },
          'hf-dim-span': {
            kind: 'dimension',
            id: 'hf-dim-span',
            name: 'Demo dim',
            levelId: 'hf-lvl-1',
            aMm: { xMm: 500, yMm: 500 },
            bMm: { xMm: 4500, yMm: 500 },
            offsetMm: { xMm: 0, yMm: 400 },
          },
          'pv-eg': {
            kind: 'plan_view',
            id: 'pv-eg',
            name: 'EG — openings',
            levelId: 'hf-lvl-1',
            planPresentation: 'opening_focus',
            categoriesHidden: ['room'],
          },
          'pv-og': {
            kind: 'plan_view',
            id: 'pv-og',
            name: 'OG — rooms',
            levelId: 'hf-lvl-2',
            planPresentation: 'room_scheme',
          },
          'hf-sec-demo': {
            kind: 'section_cut',
            id: 'hf-sec-demo',
            name: 'Demo section',
            lineStartMm: { xMm: 2000, yMm: 2000 },
            lineEndMm: { xMm: 2000, yMm: 7000 },
            cropDepthMm: 9000,
          },
          'hf-sch-room': {
            kind: 'schedule',
            id: 'hf-sch-room',
            name: 'Rooms',
            sheetId: null,
            filters: { category: 'room' },
          },
          'hf-sch-window': {
            kind: 'schedule',
            id: 'hf-sch-window',
            name: 'Windows',
            sheetId: null,
            filters: { category: 'window', groupingHint: ['levelId'] },
          },
          'hf-sheet-ga01': {
            kind: 'sheet',
            id: 'hf-sheet-ga01',
            name: 'GA-01 — Evidence',
            titleBlock: 'A1-Golden',
            paperWidthMm: 42000,
            paperHeightMm: 29700,
            titleblockParameters: {
              sheetNumber: 'GA-01',
              revision: 'P01',
              projectName: 'Evidence tower',
              drawnBy: 'AU',
              checkedBy: 'RV',
              issueDate: '2026-05-04',
            },
            viewportsMm: [
              {
                viewportId: 'vp-plan',
                label: 'EG plan',
                viewRef: 'plan:pv-eg',
                xMm: 1200,
                yMm: 1800,
                widthMm: 7000,
                heightMm: 7000,
              },
              {
                viewportId: 'vp-sch',
                label: 'Windows',
                viewRef: 'schedule:hf-sch-window',
                xMm: 9200,
                yMm: 1800,
                widthMm: 4000,
                heightMm: 7000,
              },
              {
                viewportId: 'vp-sec',
                label: 'Section',
                viewRef: 'section:hf-sec-demo',
                xMm: 2200,
                yMm: 9800,
                widthMm: 9000,
                heightMm: 3200,
              },
            ],
          },
        },
        violations: [
          {
            ruleId: 'room_outline_degenerate',
            severity: 'warning',
            message: 'Tiny room',
            discipline: 'architecture',
          },
        ],
      }),
    });
  });

  await page.route(`**/api/models/${encodeURIComponent(MODEL_ID)}/validate`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        modelId: MODEL_ID,
        revision: 3,
        violations: [
          {
            ruleId: 'room_outline_degenerate',
            severity: 'warning',
            message: 'Tiny room',
            discipline: 'architecture',
          },
        ],
        summary: {},
        checks: { errorViolationCount: 0, blockingViolationCount: 0 },
      }),
    });
  });

  await page.route(`**/api/models/*/schedules/*/table`, async (route) => {
    const url = new URL(route.request().url());
    const segs = url.pathname.split('/').filter(Boolean);
    const idx = segs.indexOf('schedules');
    const sid = idx >= 0 ? segs[idx + 1] : '';
    if (sid === 'hf-sch-window') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          scheduleId: sid,
          name: 'Windows',
          category: 'window',
          groupedSections: {
            'Ground / ribbon': [
              {
                elementId: 'hf-win-demo',
                name: 'Living ribbon',
                level: 'EG',
                widthMm: 1200,
                heightMm: 1400,
                sillMm: 900,
                familyTypeId: 'ft-a',
              },
            ],
          },
          totals: { kind: 'window', rowCount: 1, averageWidthMm: 1200 },
        }),
      });
      return;
    }
    if (sid === 'hf-sch-room') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          scheduleId: sid,
          name: 'Rooms',
          category: 'room',
          rows: [
            {
              elementId: 'rm-eg',
              name: 'Living',
              level: 'EG',
              areaM2: 18.5,
              perimeterM: 18.0,
              familyTypeId: '',
            },
          ],
          totals: { kind: 'room', rowCount: 1, areaM2: 18.5, perimeterM: 18 },
        }),
      });
      return;
    }
    await route.fulfill({ status: 404, body: JSON.stringify({ detail: 'unknown schedule' }) });
  });

  await page.route(
    `**/api/models/${encodeURIComponent(MODEL_ID)}/evidence-package`,
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          format: 'evidencePackage_v1',
          generatedAt: new Date().toISOString(),
          modelId: MODEL_ID,
          revision: 3,
          elementCount: 42,
          countsByKind: { level: 2, wall: 1, sheet: 1, plan_view: 2 },
          semanticDigestSha256: MOCK_SEMANTIC_DIGEST_SHA256,
          semanticDigestPrefix16: MOCK_SEMANTIC_PREFIX16,
          suggestedEvidenceArtifactBasename: MOCK_EVIDENCE_BASENAME,
          suggestedEvidenceBundleFilenames: {
            format: 'evidenceBundleFilenames_v1',
            evidencePackageJson: `${MOCK_EVIDENCE_BASENAME}-evidence-package.json`,
          },
          recommendedPngEvidenceBackend: 'playwright_ci',
          validate: {
            violations: [],
            checks: { errorViolationCount: 0, blockingViolationCount: 0 },
          },
          exportLinks: {
            snapshot: `/api/models/${MODEL_ID}/snapshot`,
            validate: `/api/models/${MODEL_ID}/validate`,
            evidencePackage: `/api/models/${MODEL_ID}/evidence-package`,
            sheetPreviewSvg: `/api/models/${MODEL_ID}/exports/sheet-preview.svg`,
            sheetPreviewPdf: `/api/models/${MODEL_ID}/exports/sheet-preview.pdf`,
            sheetPrintRasterPng: `/api/models/${MODEL_ID}/exports/sheet-print-raster.png`,
          },
          deterministicSheetEvidence: [
            {
              sheetId: 'hf-sheet-ga01',
              sheetName: 'GA-01 — Evidence',
              svgHref: `/api/models/${MODEL_ID}/exports/sheet-preview.svg?sheetId=hf-sheet-ga01`,
              pdfHref: `/api/models/${MODEL_ID}/exports/sheet-preview.pdf?sheetId=hf-sheet-ga01`,
              printRasterPngHref: `/api/models/${MODEL_ID}/exports/sheet-print-raster.png?sheetId=hf-sheet-ga01`,
              sheetPrintRasterIngest_v1: {
                format: 'sheetPrintRasterIngest_v1',
                contract: 'sheetPrintRasterPrintSurrogate_v2',
                svgContentSha256:
                  'f13a0871bd04a7cb933cf2fa97b0e49574275df627a64e8fcca695d8f44b9f86',
                placeholderPngSha256:
                  '769c7b0d8a5a6c623b6dfa9886352a594ee4b54ae2013dbc5d5d3707754ddfa2',
                diffCorrelation: {
                  format: 'sheetPrintRasterDiffCorrelation_v1',
                  playwrightBaselineSlot: 'pngFullSheet',
                  notes:
                    'mock ingest — v2 print-surrogate hash; correlate vs Playwright baselines in CI only.',
                },
              },
              sheetPrintRasterPrintContract_v3: {
                format: 'sheetPrintRasterPrintContract_v3',
                artifactName: 'sheet-print-raster.png',
                surrogateVersion: 'sheetPrintRasterPrintSurrogate_v2',
                widthPx: 128,
                heightPx: 112,
                colorMode: 'rgb8',
                paperWidthMm: 42000,
                paperHeightMm: 29700,
                paperSizeKey: '42000x29700mm',
                titleblockSymbol: 'title_block',
                titleblockParameterDigestSha256:
                  '7eda93fefb613a27e2fe901617fb18336fa40a50628205ac9139b94fae44eeac',
                layoutBandsMm: [],
                viewportSegmentCorrelation: [],
                pdfListingSegmentsDigestSha256:
                  'ee0638e0f781a0de01c8cf3e5135dcd3ac969e09cdbabd47e1276b033cff71c0',
                svgContentSha256:
                  'f13a0871bd04a7cb933cf2fa97b0e49574275df627a64e8fcca695d8f44b9f86',
                pngByteSha256: '769c7b0d8a5a6c623b6dfa9886352a594ee4b54ae2013dbc5d5d3707754ddfa2',
                checks: [
                  { id: 'png_ihdr_wh', ok: true },
                  { id: 'png_wh_surrogate_v2', ok: true },
                  { id: 'png_rgb8', ok: true },
                  { id: 'png_sha256', ok: true },
                  { id: 'surrogate_png_bytes_match_v2', ok: true },
                  { id: 'segments_recomputed', ok: true },
                ],
                valid: true,
              },
              playwrightSuggestedFilenames: {
                svgProbe: `${MOCK_EVIDENCE_BASENAME}-sheet-hf-sheet-ga01.svg.probe.txt`,
                pdfProbe: `${MOCK_EVIDENCE_BASENAME}-sheet-hf-sheet-ga01.pdf.probe.bin`,
                pngViewport: MOCK_SHEET_VIEWPORT_PNG_FROM_MANIFEST,
                pngFullSheet: MOCK_SHEET_FULL_PNG_FROM_MANIFEST,
                rasterPlaceholderProbe: MOCK_SHEET_RASTER_PLACEHOLDER_PROBE,
              },
              correlation: {
                format: 'evidenceSheetCorrelation_v1',
                semanticDigestSha256: MOCK_SEMANTIC_DIGEST_SHA256,
                semanticDigestPrefix16: MOCK_SEMANTIC_PREFIX16,
                modelRevision: 3,
                modelId: MODEL_ID,
                suggestedEvidenceBundleEvidencePackageJson: `${MOCK_EVIDENCE_BASENAME}-evidence-package.json`,
              },
            },
          ],
          deterministicPlanViewEvidence: [
            {
              planViewId: 'pv-eg',
              name: 'EG — openings',
              levelId: 'hf-lvl-1',
              planPresentation: 'opening_focus',
              playwrightSuggestedFilenames: {
                pngPlanCanvas: `${MOCK_EVIDENCE_BASENAME}-plan-pv-eg.png`,
              },
              correlation: {
                format: 'evidencePlanViewCorrelation_v1',
                semanticDigestSha256: MOCK_SEMANTIC_DIGEST_SHA256,
                semanticDigestPrefix16: MOCK_SEMANTIC_PREFIX16,
                modelRevision: 3,
                modelId: MODEL_ID,
                suggestedEvidenceBundleEvidencePackageJson: `${MOCK_EVIDENCE_BASENAME}-evidence-package.json`,
              },
            },
          ],
          deterministicSectionCutEvidence: [
            {
              sectionCutId: 'hf-sec-demo',
              name: 'Demo section',
              projectionWireHref: `/api/models/${MODEL_ID}/projection/section/hf-sec-demo`,
              playwrightSuggestedFilenames: {
                pngSectionViewport: `${MOCK_EVIDENCE_BASENAME}-section-hf-sec-demo.png`,
              },
              correlation: {
                format: 'evidenceSectionCutCorrelation_v1',
                semanticDigestSha256: MOCK_SEMANTIC_DIGEST_SHA256,
                semanticDigestPrefix16: MOCK_SEMANTIC_PREFIX16,
                modelRevision: 3,
                modelId: MODEL_ID,
                suggestedEvidenceBundleEvidencePackageJson: `${MOCK_EVIDENCE_BASENAME}-evidence-package.json`,
              },
            },
          ],
          evidenceClosureReview_v1: {
            format: 'evidenceClosureReview_v1',
            packageSemanticDigestSha256: MOCK_SEMANTIC_DIGEST_SHA256,
            expectedDeterministicPngBasenames: MOCK_CLOSURE_DETERMINISTIC_PNG_BASENAMES,
            primaryScreenshotArtifactCount: 4,
            screenshotHintGaps_v1: {
              format: 'screenshotHintGaps_v1',
              gaps: [],
              hasGaps: false,
              gapRowCount: 0,
            },
            correlationDigestConsistency: {
              format: 'correlationDigestConsistency_v1',
              staleRowsRelativeToPackageDigest: [],
              rowsMissingCorrelationDigest: [],
              isFullyConsistent: true,
            },
            pixelDiffExpectation: {
              format: 'pixelDiffExpectation_v1',
              status: 'ingested',
              baselineRole: 'committed_png_under_e2e_screenshots',
              diffArtifactBasenameSuffix: '-diff.png',
              metricsPlaceholder: {
                maxChannelDelta: null,
                mismatchPixelRatioMax: null,
              },
              thresholdPolicy_v1: {
                format: 'pixelDiffThresholdPolicy_v1',
                enforcement: 'advisory_only',
                mismatchPixelRatioFailAbove: 0.001,
                maxChannelDeltaFailAbove: 1,
                notes: 'Mock threshold policy for e2e.',
              },
              notes: 'Pixel diff execution stays client-side (Playwright snapshots / pixelmatch).',
              ingestChecklist_v1: {
                format: 'pixelDiffIngestChecklist_v1',
                targets: MOCK_INGEST_PAIRS_SORTED,
              },
              artifactIngestCorrelation_v1: {
                format: 'artifactIngestCorrelation_v1',
                canonicalPairCount: MOCK_INGEST_PAIRS_SORTED.length,
                ingestManifestDigestSha256: MOCK_ARTIFACT_INGEST_DIGEST,
                playwrightEvidenceScreenshotsRootHint:
                  'packages/web/e2e/__screenshots__/evidence-baselines/evidence-baselines.spec.ts/',
                notes:
                  'mock artifactIngestCorrelation_v1 — deterministic digest over ingest checklist pairs',
              },
            },
          },
          evidenceLifecycleSignal_v1: {
            format: 'evidenceLifecycleSignal_v1',
            packageSemanticDigestSha256: MOCK_SEMANTIC_DIGEST_SHA256,
            suggestedEvidenceArtifactBasename: MOCK_EVIDENCE_BASENAME,
            expectedDeterministicPngCount: MOCK_CLOSURE_DETERMINISTIC_PNG_BASENAMES.length,
            correlationFullyConsistent: true,
            screenshotHintGapRowCount: 0,
            pixelDiffIngestTargetCount: MOCK_CLOSURE_DETERMINISTIC_PNG_BASENAMES.length,
            artifactIngestManifestDigestSha256: MOCK_ARTIFACT_INGEST_DIGEST,
          },
          evidenceDiffIngestFixLoop_v1: {
            format: 'evidence_diff_ingest_fix_loop_v1',
            needsFixLoop: false,
            blockerCodes: [],
            notes: 'mock clean closure — pixel diff marked ingested for e2e fix-loop panel',
          },
          evidenceReviewPerformanceGate_v1: {
            format: 'evidenceReviewPerformanceGate_v1',
            probeKind: 'deterministic_contract_v1',
            enforcement: 'advisory_mock',
            gateClosed: true,
            blockerCodesEcho: [],
            advisoryBudgetHintsMs_v1: {
              format: 'advisoryBudgetHintsMs_v1',
              evidencePackageJsonParse: 50,
              agentReviewEvidenceSectionRender: 200,
            },
            notes:
              'mock performance gate — derived from fix-loop only; no timing telemetry (e2e Agent Review)',
          },
          evidenceAgentFollowThrough_v1: {
            format: 'evidenceAgentFollowThrough_v1',
            semanticDigestExclusionNote: 'mock',
            packageSemanticDigestSha256: MOCK_SEMANTIC_DIGEST_SHA256,
            stagedArtifactLinks_v1: {
              format: 'stagedArtifactLinks_v1',
              followThroughNote: 'mock stagedArtifactLinks_v1 — local/offline shaped bundle',
              resolutionMode: 'local_relative',
              sideEffectsEnabled: false,
              modelId: MODEL_ID,
              suggestedEvidenceArtifactBasename: MOCK_EVIDENCE_BASENAME,
              packageSemanticDigestSha256: MOCK_SEMANTIC_DIGEST_SHA256,
              bundleFilenameHints: {
                evidencePackageJson: `${MOCK_EVIDENCE_BASENAME}-evidence-package.json`,
              },
              exportRelativePaths: {
                evidencePackage: `/api/models/${MODEL_ID}/evidence-package`,
                snapshot: `/api/models/${MODEL_ID}/snapshot`,
                validate: `/api/models/${MODEL_ID}/validate`,
                bcfTopicsJsonExport: `/api/models/${MODEL_ID}/exports/bcf-topics-json`,
                bcfTopicsJsonImport: `/api/models/${MODEL_ID}/imports/bcf-topics-json`,
              },
              githubActionsResolution: null,
              stagedLinkRows: [
                {
                  id: 'bcf_topics_json_export_anchor',
                  kind: 'api_relative_anchor',
                  bcfTopicsJsonExportHref: `/api/models/${MODEL_ID}/exports/bcf-topics-json`,
                },
                {
                  id: 'bcf_topics_json_import_anchor',
                  kind: 'api_relative_anchor',
                  bcfTopicsJsonImportHref: `/api/models/${MODEL_ID}/imports/bcf-topics-json`,
                },
                {
                  id: 'evidence_package_json_anchor',
                  kind: 'api_relative_anchor',
                  evidencePackageJsonBasename: `${MOCK_EVIDENCE_BASENAME}-evidence-package.json`,
                  evidencePackageHref: `/api/models/${MODEL_ID}/evidence-package`,
                  notes: 'mock evidence package anchor',
                },
                {
                  id: 'model_snapshot_anchor',
                  kind: 'api_relative_anchor',
                  snapshotHref: `/api/models/${MODEL_ID}/snapshot`,
                },
                {
                  id: 'model_validate_anchor',
                  kind: 'api_relative_anchor',
                  validateHref: `/api/models/${MODEL_ID}/validate`,
                },
                {
                  id: 'playwright_evidence_ci_bundle',
                  kind: 'ci_playwright_evidence_bundle',
                  artifactNamePattern: 'evidence-web-{githubRunId}-playwright',
                  notes: 'mock unresolved CI artifact row for local_relative',
                },
              ],
            },
            bcfIssueCoordinationCheck_v1: {
              format: 'bcfIssueCoordinationCheck_v1',
              documentBcfTopicCount: 0,
              documentIssueTopicCount: 0,
              indexedBcfTopicCount: 0,
              indexedIssueTopicCount: 0,
              bcfTopicsJsonExportTopicCount: 0,
              bcfIndexedTopicCountMatchesDocument: true,
              issueIndexedTopicCountMatchesDocument: true,
              bcfExportIncludesOnlyBcfElems: true,
              issueTopicsNotInBcfTopicsJsonExport: true,
              bcfTopicsJsonImportSupportsTopicKinds: ['bcf'],
            },
            evidenceRefResolution_v1: {
              format: 'evidenceRefResolution_v1',
              unresolvedEvidenceRefs: [],
              unresolvedCount: 0,
              hasUnresolvedEvidenceRefs: false,
            },
            collaborationReplayConflictHints_v1: {
              format: 'collaborationReplayConflictHints_v1',
              constraintRejectedHttpStatus: 409,
              typicalErrorBodyFields: ['reason', 'violations', 'replayDiagnostics'],
              replayDiagnosticsFields: [
                'commandCount',
                'commandTypesInOrder',
                'firstBlockingCommandIndex',
              ],
              firstBlockingCommandIndexNote: 'mock',
            },
          },
          agentEvidenceClosureHints: {
            format: 'agentEvidenceClosureHints_v1',
            evidenceClosureReviewField: 'evidenceClosureReview_v1',
            pixelDiffExpectationNestedField: 'pixelDiffExpectation',
            evidenceDiffIngestFixLoopField: 'evidenceDiffIngestFixLoop_v1',
            evidenceReviewPerformanceGateField: 'evidenceReviewPerformanceGate_v1',
            deterministicPngBasenamesField: 'expectedDeterministicPngBasenames',
            playwrightEvidenceSpecRelPath: 'packages/web/e2e/evidence-baselines.spec.ts',
            suggestedRegenerationCommands: [
              'cd packages/web && CI=true pnpm exec playwright test e2e/evidence-baselines.spec.ts',
            ],
            ciArtifactRelativePaths: [
              'packages/web/playwright-report/index.html',
              'packages/web/test-results/ci-evidence-correlation-hint.txt',
            ],
            ciEnvPlaceholderHints: [
              'GITHUB_RUN_ID — artifact evidence-web-${GITHUB_RUN_ID}-playwright',
            ],
          },
          planViews: [{ id: 'pv-eg' }, { id: 'pv-og' }],
          scheduleIds: [{ id: 'hf-sch-room' }, { id: 'hf-sch-window' }],
          expectedScreenshotCaptures: [
            { id: 'coord_sheet', screenshotBaseline: 'coordination-sheet.png' },
            {
              id: 'schedules_focus',
              screenshotBaseline: 'schedules-focus.png',
              workspaceLayoutPreset: 'schedules_focus',
            },
          ],
        }),
      });
    },
  );

  await page.route(`**/api/models/*/comments**`, async (route) => {
    await route.fulfill({ status: 200, body: '{}' });
  });
  await page.route(`**/api/models/*/activity**`, async (route) => {
    await route.fulfill({ status: 200, body: '{"events":[]}' });
  });
  await page.route(`**/api/building-presets**`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: '{"presets":{"residential":{}}}',
    });
  });
}

test.describe('evidence PNG baselines', () => {
  test('coordination layout: sheet + schedules panel', async ({ page }) => {
    await sharedRoutes(page, 'coordination');
    await page.goto('/');
    await expect(page.getByText('Ready', { exact: false })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('sheet-canvas')).toBeVisible();
    await expect(page.getByTestId('schedule-panel')).toBeVisible();
    await expect(page.getByTestId('schedule-server-derived')).toBeVisible();
    await expect(page.getByTestId('sheet-canvas')).toHaveScreenshot('coordination-sheet.png');
    await expect(page.getByTestId('schedule-panel')).toHaveScreenshot('coordination-schedules.png');
  });

  test('schedules_focus docked rails', async ({ page }) => {
    await sharedRoutes(page, 'schedules_focus');
    await page.goto('/');
    await expect(page.getByText('Ready', { exact: false })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('schedule-panel')).toBeVisible();
    await expect(page.getByTestId('schedule-server-derived')).toBeVisible();
    await expect(page.getByTestId('plan-canvas')).toBeVisible();
    await expect(page.getByTestId('schedule-panel')).toHaveScreenshot('schedules-focus.png');
  });

  test('split plan + 3D: canvases visible', async ({ page }) => {
    await sharedRoutes(page, 'split_plan_3d');
    await page.goto('/');
    await expect(page.getByText('Ready', { exact: false })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('plan-canvas')).toBeVisible();
    await expect(page.getByTestId('orbit-3d-viewport')).toBeVisible();
  });

  test('coordination layout: deterministic manifest sheet PNG basename', async ({ page }) => {
    await sharedRoutes(page, 'coordination');
    await page.goto('/');
    await expect(page.getByText('Ready', { exact: false })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('sheet-canvas')).toBeVisible();
    await expect(page.getByTestId('sheet-canvas')).toHaveScreenshot(
      MOCK_SHEET_VIEWPORT_PNG_FROM_MANIFEST,
    );
  });

  test('deterministic manifest: full-sheet SVG screenshot', async ({ page }) => {
    await sharedRoutes(page, 'coordination');
    await page.goto('/?evidenceSheetFull=1');
    await expect(page.getByText('Ready', { exact: false })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('sheet-svg')).toBeVisible();
    await expect(page.getByTestId('sheet-svg')).toHaveScreenshot(MOCK_SHEET_FULL_PNG_FROM_MANIFEST);
  });

  test('named plan_views change EG openings vs OG room presentation', async ({ page }) => {
    await sharedRoutes(page, 'split_plan_3d');
    await page.goto('/');
    await expect(page.getByText('Ready', { exact: false })).toBeVisible({ timeout: 30_000 });
    await page.getByRole('button', { name: /plan_view · EG — openings/i }).click();
    await expect(page.getByTestId('plan-canvas')).toHaveScreenshot('plan-eg-openings.png');

    await page.getByRole('button', { name: /plan_view · OG — rooms/i }).click();
    await expect(page.getByTestId('plan-canvas')).toHaveScreenshot('plan-og-rooms.png');
  });

  test('evidence-package exposes closure review inventory', async ({ page }) => {
    await sharedRoutes(page, 'coordination');
    await page.goto('/');
    await expect(page.getByText('Ready', { exact: false })).toBeVisible({ timeout: 30_000 });
    const pkg = await page.evaluate(async (mid: string) => {
      const res = await fetch(`/api/models/${mid}/evidence-package`);
      return res.json() as Record<string, unknown>;
    }, MODEL_ID);
    const closure = pkg.evidenceClosureReview_v1 as Record<string, unknown> | undefined;
    expect(closure?.format).toBe('evidenceClosureReview_v1');
    const basenames = closure?.expectedDeterministicPngBasenames as string[] | undefined;
    expect(basenames).toContain(MOCK_SHEET_VIEWPORT_PNG_FROM_MANIFEST);
    expect(basenames).toContain(MOCK_SHEET_FULL_PNG_FROM_MANIFEST);
    expect(basenames).toContain(`${MOCK_EVIDENCE_BASENAME}-plan-pv-eg.png`);
    expect(basenames).toContain(`${MOCK_EVIDENCE_BASENAME}-section-hf-sec-demo.png`);
    const cons = closure?.correlationDigestConsistency as Record<string, unknown> | undefined;
    expect(cons?.isFullyConsistent).toBe(true);
    const pix = closure?.pixelDiffExpectation as Record<string, unknown> | undefined;
    expect(pix?.format).toBe('pixelDiffExpectation_v1');
    expect(pix?.status).toBe('ingested');
    const pol = pix?.thresholdPolicy_v1 as Record<string, unknown> | undefined;
    expect(pol?.format).toBe('pixelDiffThresholdPolicy_v1');
    expect(pol?.enforcement).toBe('advisory_only');
    const life = pkg.evidenceLifecycleSignal_v1 as Record<string, unknown> | undefined;
    expect(life?.format).toBe('evidenceLifecycleSignal_v1');
    expect(life?.packageSemanticDigestSha256).toBe(pkg.semanticDigestSha256);
    expect(life?.suggestedEvidenceArtifactBasename).toBe(pkg.suggestedEvidenceArtifactBasename);
    expect(life?.expectedDeterministicPngCount).toBe(basenames?.length);
    const ingest = pix?.ingestChecklist_v1 as Record<string, unknown> | undefined;
    const targets = ingest?.targets as unknown[] | undefined;
    expect(life?.pixelDiffIngestTargetCount).toBe(targets?.length);
    const shotGaps = closure?.screenshotHintGaps_v1 as Record<string, unknown> | undefined;
    const gapRows = shotGaps?.gaps as unknown[] | undefined;
    expect(life?.screenshotHintGapRowCount).toBe(gapRows?.length);
    expect(life?.correlationFullyConsistent).toBe(true);
    expect(life?.artifactIngestManifestDigestSha256).toBe(MOCK_ARTIFACT_INGEST_DIGEST);
    const ac = pix?.artifactIngestCorrelation_v1 as Record<string, unknown> | undefined;
    expect(ac?.format).toBe('artifactIngestCorrelation_v1');
    expect(ac?.canonicalPairCount).toBe(MOCK_INGEST_PAIRS_SORTED.length);
    expect(ac?.ingestManifestDigestSha256).toBe(MOCK_ARTIFACT_INGEST_DIGEST);
    expect(ac?.playwrightEvidenceScreenshotsRootHint).toBe(
      'packages/web/e2e/__screenshots__/evidence-baselines/evidence-baselines.spec.ts/',
    );
    const fixLoop = pkg.evidenceDiffIngestFixLoop_v1 as Record<string, unknown> | undefined;
    expect(fixLoop?.format).toBe('evidence_diff_ingest_fix_loop_v1');
    expect(fixLoop?.needsFixLoop).toBe(false);
    const fixBlockers = fixLoop?.blockerCodes as unknown[] | undefined;
    expect(Array.isArray(fixBlockers) ? fixBlockers.length : -1).toBe(0);
    const follow = pkg.evidenceAgentFollowThrough_v1 as Record<string, unknown> | undefined;
    expect(follow?.format).toBe('evidenceAgentFollowThrough_v1');
    const sal = follow?.stagedArtifactLinks_v1 as Record<string, unknown> | undefined;
    expect(sal?.format).toBe('stagedArtifactLinks_v1');
    expect(sal?.resolutionMode).toBe('local_relative');
    expect(sal?.sideEffectsEnabled).toBe(false);
    expect(
      (follow?.bcfIssueCoordinationCheck_v1 as Record<string, unknown> | undefined)?.format,
    ).toBe('bcfIssueCoordinationCheck_v1');
    const sheetRows = pkg.deterministicSheetEvidence as Record<string, unknown>[] | undefined;
    expect(sheetRows?.[0]?.printRasterPngHref as string).toContain('sheet-print-raster.png');
    const rasterIngest = sheetRows?.[0]?.sheetPrintRasterIngest_v1 as
      | Record<string, unknown>
      | undefined;
    expect(rasterIngest?.format).toBe('sheetPrintRasterIngest_v1');
    expect(rasterIngest?.contract).toBe('sheetPrintRasterPrintSurrogate_v2');
    expect(rasterIngest?.placeholderPngSha256).toBe(
      '769c7b0d8a5a6c623b6dfa9886352a594ee4b54ae2013dbc5d5d3707754ddfa2',
    );
  });

  test('sheet-print-raster.png: print-surrogate v2 response headers', async ({ page }) => {
    await sharedRoutes(page, 'coordination');
    await page.goto('/');
    await expect(page.getByText('Ready', { exact: false })).toBeVisible({ timeout: 30_000 });
    const result = await page.evaluate(async (mid: string) => {
      const r = await fetch(
        `/api/models/${mid}/exports/sheet-print-raster.png?sheetId=hf-sheet-ga01`,
      );
      const buf = new Uint8Array(await r.arrayBuffer());
      return {
        ok: r.ok,
        contentType: r.headers.get('content-type'),
        contract: r.headers.get('X-Bim-Ai-Sheet-Print-Raster-Contract'),
        svgSha: r.headers.get('X-Bim-Ai-Sheet-Svg-Sha256'),
        width: r.headers.get('X-Bim-Ai-Sheet-Print-Raster-Width'),
        height: r.headers.get('X-Bim-Ai-Sheet-Print-Raster-Height'),
        pngSha256: r.headers.get('X-Bim-Ai-Sheet-Print-Raster-Png-Sha256'),
        byteLength: buf.byteLength,
      };
    }, MODEL_ID);
    expect(result.ok).toBe(true);
    expect(result.contentType).toContain('image/png');
    expect(result.contract).toBe('sheetPrintRasterPrintSurrogate_v2');
    expect(result.svgSha).toBe('f13a0871bd04a7cb933cf2fa97b0e49574275df627a64e8fcca695d8f44b9f86');
    expect(result.width).toBe('128');
    expect(result.height).toBe('112');
    expect(result.byteLength).toBe(MOCK_SHEET_PRINT_RASTER_PNG_BYTES.length);
  });

  test('agent_review layout: fix-loop callout hidden when evidence package clean', async ({
    page,
  }) => {
    await sharedRoutes(page, 'agent_review');
    await page.goto('/');
    await expect(page.getByText('Ready', { exact: false })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText('Agent cockpit')).toBeVisible();
    await page.getByRole('button', { name: 'Fetch evidence-package JSON' }).click();
    await expect(page.getByTestId('evidence-diff-fix-loop-callout')).toHaveCount(0);
    const perfGate = page.getByTestId('evidence-review-performance-gate');
    await expect(perfGate).toBeVisible();
    await expect(perfGate).toContainText('gateClosed:');
    await expect(perfGate).toContainText('true');
    await expect(perfGate).toContainText('deterministic_contract_v1');
    await expect(perfGate).toContainText('advisory_mock');
  });
});
