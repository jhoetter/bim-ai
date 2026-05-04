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

/** Minimal deterministic placeholder PNG (`<svg/>`) for mocked `sheet-print-raster` route — matches server v1 encoder. */
const MOCK_SHEET_PRINT_RASTER_PNG_BYTES = Uint8Array.from([
  137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 1, 0, 0, 0, 1, 8, 2, 0, 0,
  0, 144, 119, 83, 222, 0, 0, 0, 12, 73, 68, 65, 84, 120, 218, 99, 184, 114, 39, 12, 0, 4, 142, 2,
  7, 23, 80, 123, 180, 0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130,
]);

/** Sorted like server `evidenceClosureReview_v1.expectedDeterministicPngBasenames` for mock + assertions. */
const MOCK_CLOSURE_DETERMINISTIC_PNG_BASENAMES = [
  `${MOCK_EVIDENCE_BASENAME}-plan-pv-eg.png`,
  `${MOCK_EVIDENCE_BASENAME}-section-hf-sec-demo.png`,
  MOCK_SHEET_FULL_PNG_FROM_MANIFEST,
  MOCK_SHEET_VIEWPORT_PNG_FROM_MANIFEST,
].sort();

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
        'X-Bim-Ai-Sheet-Print-Raster-Contract': 'sheetPrintRasterPlaceholder_v1',
        'X-Bim-Ai-Sheet-Svg-Sha256':
          'd4dc56669143034f31aa309635d4113d9ad76a02b1739da22c965ed2049be9e6',
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
                contract: 'sheetPrintRasterPlaceholder_v1',
                svgContentSha256:
                  'd4dc56669143034f31aa309635d4113d9ad76a02b1739da22c965ed2049be9e6',
                placeholderPngSha256:
                  'd96db10ee28f5c236c22ca3b9ff548cfdeecdbdd5a03a5b2ac51fe674e273e88',
                diffCorrelation: {
                  format: 'sheetPrintRasterDiffCorrelation_v1',
                  playwrightBaselineSlot: 'pngFullSheet',
                  notes:
                    'mock ingest — correlate placeholder hash vs Playwright baselines in CI only.',
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
              status: 'not_run',
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
                targets: MOCK_CLOSURE_DETERMINISTIC_PNG_BASENAMES.map((bn) => ({
                  baselinePngBasename: bn,
                  expectedDiffBasename: `${bn.replace(/\.png$/, '')}-diff.png`,
                })),
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
    expect(pix?.status).toBe('not_run');
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
    expect(rasterIngest?.contract).toBe('sheetPrintRasterPlaceholder_v1');
    expect(rasterIngest?.placeholderPngSha256).toBe(
      'd96db10ee28f5c236c22ca3b9ff548cfdeecdbdd5a03a5b2ac51fe674e273e88',
    );
  });

  test('sheet-print-raster.png: placeholder contract response headers', async ({ page }) => {
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
        byteLength: buf.byteLength,
      };
    }, MODEL_ID);
    expect(result.ok).toBe(true);
    expect(result.contentType).toContain('image/png');
    expect(result.contract).toBe('sheetPrintRasterPlaceholder_v1');
    expect(result.svgSha).toBe('d4dc56669143034f31aa309635d4113d9ad76a02b1739da22c965ed2049be9e6');
    expect(result.byteLength).toBe(MOCK_SHEET_PRINT_RASTER_PNG_BYTES.length);
  });
});
