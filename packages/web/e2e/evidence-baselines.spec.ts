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
          '38780a26160d611bdc16776e682d852bbf4eecd83f93f9d4fef1e3d0b3e2f4cd',
        'X-Bim-Ai-Sheet-Print-Raster-Width': '128',
        'X-Bim-Ai-Sheet-Print-Raster-Height': '112',
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
                  '38780a26160d611bdc16776e682d852bbf4eecd83f93f9d4fef1e3d0b3e2f4cd',
                placeholderPngSha256:
                  '01a1bd732c454a43298e4888bce24a483808695147e28c3ab5e6a0ecab12e349',
                diffCorrelation: {
                  format: 'sheetPrintRasterDiffCorrelation_v1',
                  playwrightBaselineSlot: 'pngFullSheet',
                  notes:
                    'mock ingest — v2 print-surrogate hash; correlate vs Playwright baselines in CI only.',
                },
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
          evidenceAgentFollowThrough_v1: {
            format: 'evidenceAgentFollowThrough_v1',
            semanticDigestExclusionNote: 'mock',
            packageSemanticDigestSha256: MOCK_SEMANTIC_DIGEST_SHA256,
            stagedArtifactUrlPlaceholders_v1: {
              format: 'stagedArtifactUrlPlaceholders_v1',
              interpolationKeysNote: 'mock',
              interpolationKeys: [
                'suggestedEvidenceArtifactBasename',
                'modelId',
                'githubRepository',
                'githubRunId',
                'githubSha',
              ],
              urlTemplates: {
                githubActionsRunArtifactsUrl:
                  'https://github.com/{githubRepository}/actions/runs/{githubRunId}#artifacts',
              },
              relativeApiPaths: {
                evidencePackage: `/api/models/${MODEL_ID}/evidence-package`,
                bcfTopicsJsonExport: `/api/models/${MODEL_ID}/exports/bcf-topics-json`,
                bcfTopicsJsonImport: `/api/models/${MODEL_ID}/imports/bcf-topics-json`,
                snapshot: `/api/models/${MODEL_ID}/snapshot`,
              },
              bundleFilenameHints: {
                evidencePackageJson: `${MOCK_EVIDENCE_BASENAME}-evidence-package.json`,
              },
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
      '01a1bd732c454a43298e4888bce24a483808695147e28c3ab5e6a0ecab12e349',
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
        byteLength: buf.byteLength,
      };
    }, MODEL_ID);
    expect(result.ok).toBe(true);
    expect(result.contentType).toContain('image/png');
    expect(result.contract).toBe('sheetPrintRasterPrintSurrogate_v2');
    expect(result.svgSha).toBe('38780a26160d611bdc16776e682d852bbf4eecd83f93f9d4fef1e3d0b3e2f4cd');
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
  });
});
