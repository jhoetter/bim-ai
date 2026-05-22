import { parseAgentReviewActionsV1, type AgentReviewActionRow } from '../agent';
import {
  summarizeArtifactUploadManifestV1,
  parseEvidenceBaselineLifecycleReadoutV1,
  type EvidenceBaselineLifecycleReadoutWire,
} from '../evidence';
import {
  parseAgentReviewReadoutConsistencyClosureV1,
  type AgentReviewReadoutConsistencyClosureV1,
} from '../agent';
import {
  parsePrdCloseoutCrossCorrelationManifestV1,
  type PrdCloseoutCrossCorrelationManifestWire,
} from '../readouts';

export type EvidenceArtifactSummary = {
  semanticDigestPrefix16: string | null;
  semanticDigestSha256Tail: string | null;
  semanticDigestSha256Full: string | null;
  modelRevision: number | null;
  sheetRows: {
    sheetId: string;
    sheetName?: string;
    pngViewport?: string;
    pngFullSheet?: string;
    printRasterPngHref?: string;
    printRasterContract?: string;
    placeholderPngSha256Tail?: string;
    bundleJson?: string;
  }[];
  view3dRows: {
    viewpointId: string;
    viewpointName?: string;
    pngViewport?: string;
    bundleJson?: string;
  }[];
  planViewRows: {
    planViewId: string;
    name?: string;
    levelId?: string;
    planPresentation?: string;
    pngPlanCanvas?: string;
    bundleJson?: string;
  }[];
  sectionCutRows: {
    sectionCutId: string;
    name?: string;
    projectionWireHref?: string;
    pngSectionViewport?: string;
    bundleJson?: string;
  }[];
  closureHints: {
    playwrightSpec?: string;
    commands: string[];
    ciPaths: string[];
    envHints: string[];
  } | null;
  closureReview: {
    primaryCount: number;
    basenames: string[];
    correlationFullyConsistent: boolean | null;
    staleRowCount: number;
    missingDigestRowCount: number;
    pixelDiffStatus: string | null;
    pixelDiffSuffix: string | null;
    pixelDiffThresholdEnforcement: string | null;
    pixelMismatchRatioFailAbove: number | null;
    artifactIngestDigestSha256Tail: string | null;
    artifactIngestDigestSha256Full: string | null;
    artifactIngestScreenshotsRootHint: string | null;
    artifactIngestCanonicalPairCount: number | null;
    serverPngByteIngestWidth: number | null;
    serverPngByteIngestHeight: number | null;
    serverPngByteIngestByteLength: number | null;
    serverPngByteIngestCanonicalDigestFull: string | null;
    serverPngByteIngestCanonicalDigestTail: string | null;
    serverPngByteIngestComparisonResult: string | null;
    serverPngByteIngestSkippedReason: string | null;
    serverPngByteIngestLinkedBasename: string | null;
  } | null;
  lifecycleSignal: Record<string, unknown> | null;
  agentFollowThrough: Record<string, unknown> | null;
  screenshotSlotGaps: {
    gapRowCount: number;
    items: {
      deterministicRowKind: string;
      rowId: string;
      missingPlaywrightFilenameSlots: string[];
    }[];
  } | null;
  suggestedBasenameHint: string | null;
  mismatchNotes: string[];
  diffFixLoop: {
    needsFixLoop: boolean;
    blockerCodes: string[];
  } | null;
  performanceGate: {
    gateClosed: boolean;
    enforcement: string | null;
    probeKind: string | null;
    blockerCodesEcho: string[];
    // PERF-D08: real wall-clock probe of the evidence-package route.
    // When the route handler measured the build path, these carry the
    // measured ms + budget + overBudget verdict so the panel can flip
    // from advisory mock to a real warning.
    packageGenerationMs?: number;
    packageGenerationBudgetMs?: number;
    packageGenerationOverBudget?: boolean;
  } | null;
  reviewActions: AgentReviewActionRow[];
  artifactUploadManifestReadout: string[] | null;
  baselineLifecycleReadout: EvidenceBaselineLifecycleReadoutWire | null;
  consistencyClosure: AgentReviewReadoutConsistencyClosureV1 | null;
  prdCloseoutCrossCorrelation: PrdCloseoutCrossCorrelationManifestWire | null;
  evidenceFreshness: {
    freshCount: number;
    staleCount: number;
    missingCount: number;
    totalCount: number;
    blockerCodes: string[];
    staleRows: {
      id: string;
      code: string;
      status: string;
    }[];
  } | null;
  targetHouseFeatureCoverage: {
    requiredFeatureCount: number;
    explicitElementCoverageCount: number;
    resolvedElementCoverageCount: number;
    semanticSelectorCoverageCount: number;
    missingElementCoverageCount: number;
    openFindingCount: number;
    screenshotMissingCount: number;
    blockerCount: number;
    evidenceAcceptanceOk: boolean | null;
    rows: {
      featureId: string;
      status: string;
      elementCoverageStatus: string;
      openFindingCount: number;
      blockerCount: number;
      screenshotMissingCount: number;
    }[];
  } | null;
  methodologyDashboard: {
    ok: boolean | null;
    acceptanceLayer: string;
    normalAdvisorBoundary: string;
    blockingRowCount: number;
    passingRowCount: number;
    rowCount: number;
    rows: {
      trackerId: string;
      title: string;
      ok: boolean;
      evidence: string[];
      summary: Record<string, unknown>;
    }[];
  } | null;
  regenerationGuidance:
    | {
        priority: string;
        artifactKey: string;
        reason: string;
        suggestedCommand: string;
      }[]
    | null;
};

export type RoomCand = {
  candidateId?: string;
  approxAreaM2?: number;
  levelName?: string;
  perimeterApproxM?: number;
  warnings?: { code?: string; message?: string; severity?: string }[];
  comparisonToAuthoredRooms?: {
    roomId?: string;
    roomName?: string;
    iouApprox?: number;
  }[];
  classificationHints?: { schemeColorHint?: string };
  suggestedBundleCommands?: unknown[];
};

export function parseEvidenceArtifact(
  evidenceTxt: string | null,
  revision: number,
): EvidenceArtifactSummary {
  const empty = (): EvidenceArtifactSummary => ({
    semanticDigestPrefix16: null,
    semanticDigestSha256Tail: null,
    semanticDigestSha256Full: null,
    modelRevision: null,
    sheetRows: [],
    view3dRows: [],
    planViewRows: [],
    sectionCutRows: [],
    closureHints: null,
    closureReview: null,
    lifecycleSignal: null,
    agentFollowThrough: null,
    screenshotSlotGaps: null,
    suggestedBasenameHint: null,
    mismatchNotes: [],
    diffFixLoop: null,
    performanceGate: null,
    reviewActions: [],
    artifactUploadManifestReadout: null,
    baselineLifecycleReadout: null,
    consistencyClosure: null,
    prdCloseoutCrossCorrelation: null,
    evidenceFreshness: null,
    targetHouseFeatureCoverage: null,
    methodologyDashboard: null,
    regenerationGuidance: null,
  });

  if (!evidenceTxt) return empty();

  try {
    const root = JSON.parse(evidenceTxt) as Record<string, unknown>;
    const payload =
      root && typeof root.payload === 'object' && root.payload !== null
        ? (root.payload as Record<string, unknown>)
        : root && typeof root.evidencePackage === 'object' && root.evidencePackage !== null
          ? (root.evidencePackage as Record<string, unknown>)
          : root;

    const prefix =
      typeof payload.semanticDigestPrefix16 === 'string' ? payload.semanticDigestPrefix16 : null;

    const dig =
      typeof payload.semanticDigestSha256 === 'string' ? payload.semanticDigestSha256 : null;
    const shaTail = dig && dig.length >= 12 ? dig.slice(-12) : dig;

    const revRaw = payload.modelRevision ?? payload.revision;
    const modelRevision =
      typeof revRaw === 'number' && Number.isFinite(revRaw)
        ? revRaw
        : typeof revRaw === 'string'
          ? Number(revRaw)
          : null;

    const basename =
      typeof payload.suggestedEvidenceArtifactBasename === 'string'
        ? payload.suggestedEvidenceArtifactBasename
        : null;

    let lifecycleSignal: EvidenceArtifactSummary['lifecycleSignal'] = null;
    const lifeRaw = payload.evidenceLifecycleSignal_v1;
    if (lifeRaw && typeof lifeRaw === 'object') {
      lifecycleSignal = lifeRaw as Record<string, unknown>;
    }

    let agentFollowThrough: EvidenceArtifactSummary['agentFollowThrough'] = null;
    const ftRaw = payload.evidenceAgentFollowThrough_v1;
    if (ftRaw && typeof ftRaw === 'object') {
      agentFollowThrough = ftRaw as Record<string, unknown>;
    }

    let artifactUploadManifestReadout: EvidenceArtifactSummary['artifactUploadManifestReadout'] =
      null;
    const aumRaw = payload.artifactUploadManifest_v1;
    const aumLines = summarizeArtifactUploadManifestV1(aumRaw);
    if (aumLines.length > 0) {
      artifactUploadManifestReadout = aumLines;
    }

    let baselineLifecycleReadout: EvidenceArtifactSummary['baselineLifecycleReadout'] = null;
    const lifecycleRoRaw = payload.evidenceBaselineLifecycleReadout_v1;
    baselineLifecycleReadout = parseEvidenceBaselineLifecycleReadoutV1(lifecycleRoRaw);

    const consistencyClosure = parseAgentReviewReadoutConsistencyClosureV1(
      payload.agentReviewReadoutConsistencyClosure_v1,
    );

    let prdCloseoutCrossCorrelation: EvidenceArtifactSummary['prdCloseoutCrossCorrelation'] = null;
    const closeoutManifestRaw = payload.v1CloseoutReadinessManifest_v1;
    if (closeoutManifestRaw && typeof closeoutManifestRaw === 'object') {
      const cm = closeoutManifestRaw as Record<string, unknown>;
      prdCloseoutCrossCorrelation = parsePrdCloseoutCrossCorrelationManifestV1(
        cm.prdCloseoutCrossCorrelationManifest_v1,
      );
    }

    let diffFixLoop: EvidenceArtifactSummary['diffFixLoop'] = null;
    const dflRaw = payload.evidenceDiffIngestFixLoop_v1;
    if (dflRaw && typeof dflRaw === 'object') {
      const d = dflRaw as Record<string, unknown>;
      if (d.format === 'evidence_diff_ingest_fix_loop_v1') {
        const codesRaw = d.blockerCodes;
        const blockerCodes = Array.isArray(codesRaw)
          ? codesRaw.filter((x): x is string => typeof x === 'string')
          : [];
        diffFixLoop = {
          needsFixLoop: d.needsFixLoop === true,
          blockerCodes,
        };
      }
    }

    let performanceGate: EvidenceArtifactSummary['performanceGate'] = null;
    const pgRaw = payload.evidenceReviewPerformanceGate_v1;
    if (pgRaw && typeof pgRaw === 'object') {
      const g = pgRaw as Record<string, unknown>;
      if (g.format === 'evidenceReviewPerformanceGate_v1') {
        const echoRaw = g.blockerCodesEcho;
        const blockerCodesEcho = Array.isArray(echoRaw)
          ? echoRaw.filter((x): x is string => typeof x === 'string')
          : [];
        // PERF-D08: pull wall-clock probe from the top-level payload (the
        // route handler stamps it on every evidence-package response).
        const pkgMs =
          typeof payload._packageGenerationMs === 'number'
            ? payload._packageGenerationMs
            : undefined;
        const pkgBudget =
          typeof payload._packageGenerationBudgetMs === 'number'
            ? payload._packageGenerationBudgetMs
            : undefined;
        const pkgOver =
          typeof payload._packageGenerationOverBudget === 'boolean'
            ? payload._packageGenerationOverBudget
            : undefined;
        performanceGate = {
          gateClosed: g.gateClosed === true,
          enforcement: typeof g.enforcement === 'string' ? g.enforcement : null,
          probeKind: typeof g.probeKind === 'string' ? g.probeKind : null,
          blockerCodesEcho,
          packageGenerationMs: pkgMs,
          packageGenerationBudgetMs: pkgBudget,
          packageGenerationOverBudget: pkgOver,
        };
      }
    }

    let screenshotSlotGaps: EvidenceArtifactSummary['screenshotSlotGaps'] = null;

    const hintsRaw = payload.agentEvidenceClosureHints;
    let closureHints: EvidenceArtifactSummary['closureHints'] = null;
    if (hintsRaw && typeof hintsRaw === 'object') {
      const h = hintsRaw as Record<string, unknown>;
      const cmdsRaw = h.suggestedRegenerationCommands;
      const pathsRaw = h.ciArtifactRelativePaths;
      const envRaw = h.ciEnvPlaceholderHints;
      closureHints = {
        playwrightSpec:
          typeof h.playwrightEvidenceSpecRelPath === 'string'
            ? h.playwrightEvidenceSpecRelPath
            : undefined,
        commands: Array.isArray(cmdsRaw)
          ? cmdsRaw.filter((x): x is string => typeof x === 'string')
          : [],
        ciPaths: Array.isArray(pathsRaw)
          ? pathsRaw.filter((x): x is string => typeof x === 'string')
          : [],
        envHints: Array.isArray(envRaw)
          ? envRaw.filter((x): x is string => typeof x === 'string')
          : [],
      };
    }

    const ecrRaw = payload.evidenceClosureReview_v1;
    let closureReview: EvidenceArtifactSummary['closureReview'] = null;
    if (ecrRaw && typeof ecrRaw === 'object') {
      const e = ecrRaw as Record<string, unknown>;
      const basenames = Array.isArray(e.expectedDeterministicPngBasenames)
        ? e.expectedDeterministicPngBasenames.filter((x): x is string => typeof x === 'string')
        : [];
      const consRaw = e.correlationDigestConsistency;
      let correlationFullyConsistent: boolean | null = null;
      let staleRowCount = 0;
      let missingDigestRowCount = 0;
      if (consRaw && typeof consRaw === 'object') {
        const c = consRaw as Record<string, unknown>;
        if (typeof c.isFullyConsistent === 'boolean') {
          correlationFullyConsistent = c.isFullyConsistent;
        }
        staleRowCount = Array.isArray(c.staleRowsRelativeToPackageDigest)
          ? c.staleRowsRelativeToPackageDigest.length
          : 0;
        missingDigestRowCount = Array.isArray(c.rowsMissingCorrelationDigest)
          ? c.rowsMissingCorrelationDigest.length
          : 0;
      }
      const pixRaw = e.pixelDiffExpectation;
      let pixelDiffStatus: string | null = null;
      let pixelDiffSuffix: string | null = null;
      let pixelDiffThresholdEnforcement: string | null = null;
      let pixelMismatchRatioFailAbove: number | null = null;
      let artifactIngestDigestSha256Tail: string | null = null;
      let artifactIngestDigestSha256Full: string | null = null;
      let artifactIngestScreenshotsRootHint: string | null = null;
      let artifactIngestCanonicalPairCount: number | null = null;
      let serverPngByteIngestWidth: number | null = null;
      let serverPngByteIngestHeight: number | null = null;
      let serverPngByteIngestByteLength: number | null = null;
      let serverPngByteIngestCanonicalDigestFull: string | null = null;
      let serverPngByteIngestCanonicalDigestTail: string | null = null;
      let serverPngByteIngestComparisonResult: string | null = null;
      let serverPngByteIngestSkippedReason: string | null = null;
      let serverPngByteIngestLinkedBasename: string | null = null;
      if (pixRaw && typeof pixRaw === 'object') {
        const p = pixRaw as Record<string, unknown>;
        pixelDiffStatus = typeof p.status === 'string' ? p.status : null;
        pixelDiffSuffix =
          typeof p.diffArtifactBasenameSuffix === 'string' ? p.diffArtifactBasenameSuffix : null;
        const pol = p.thresholdPolicy_v1;
        if (pol && typeof pol === 'object') {
          const t = pol as Record<string, unknown>;
          pixelDiffThresholdEnforcement = typeof t.enforcement === 'string' ? t.enforcement : null;
          const r = t.mismatchPixelRatioFailAbove;
          if (typeof r === 'number' && Number.isFinite(r)) {
            pixelMismatchRatioFailAbove = r;
          }
        }
        const acRaw = p.artifactIngestCorrelation_v1;
        if (acRaw && typeof acRaw === 'object') {
          const ac = acRaw as Record<string, unknown>;
          const dig = ac.ingestManifestDigestSha256;
          if (typeof dig === 'string' && /^[a-f0-9]{64}$/.test(dig)) {
            artifactIngestDigestSha256Full = dig;
            artifactIngestDigestSha256Tail = dig.length >= 12 ? dig.slice(-12) : dig;
          }
          const root = ac.playwrightEvidenceScreenshotsRootHint;
          if (typeof root === 'string' && root) {
            artifactIngestScreenshotsRootHint = root;
          }
          const pc = ac.canonicalPairCount;
          if (typeof pc === 'number' && Number.isFinite(pc)) {
            artifactIngestCanonicalPairCount = pc;
          }
        }
        const spiRaw = p.serverPngByteIngest_v1;
        if (spiRaw && typeof spiRaw === 'object') {
          const spi = spiRaw as Record<string, unknown>;
          const w = spi.width;
          const h = spi.height;
          const bl = spi.byteLength;
          if (typeof w === 'number' && Number.isFinite(w)) serverPngByteIngestWidth = w;
          if (typeof h === 'number' && Number.isFinite(h)) serverPngByteIngestHeight = h;
          if (typeof bl === 'number' && Number.isFinite(bl)) serverPngByteIngestByteLength = bl;
          const cdig = spi.canonicalDigestSha256;
          if (typeof cdig === 'string' && /^[a-f0-9]{64}$/.test(cdig)) {
            serverPngByteIngestCanonicalDigestFull = cdig;
            serverPngByteIngestCanonicalDigestTail = cdig.length >= 12 ? cdig.slice(-12) : cdig;
          }
          const compRaw = spi.comparison;
          if (compRaw && typeof compRaw === 'object') {
            const comp = compRaw as Record<string, unknown>;
            if (typeof comp.result === 'string') {
              serverPngByteIngestComparisonResult = comp.result;
            }
            const sr = comp.skippedReason;
            if (typeof sr === 'string' && sr) serverPngByteIngestSkippedReason = sr;
          }
          const lb = spi.linkedBaselinePngBasename;
          if (typeof lb === 'string' && lb) serverPngByteIngestLinkedBasename = lb;
        }
      }
      const primaryCount =
        typeof e.primaryScreenshotArtifactCount === 'number' &&
        Number.isFinite(e.primaryScreenshotArtifactCount)
          ? e.primaryScreenshotArtifactCount
          : basenames.length;
      closureReview = {
        primaryCount,
        basenames,
        correlationFullyConsistent,
        staleRowCount,
        missingDigestRowCount,
        pixelDiffStatus,
        pixelDiffSuffix,
        pixelDiffThresholdEnforcement,
        pixelMismatchRatioFailAbove,
        artifactIngestDigestSha256Tail,
        artifactIngestDigestSha256Full,
        artifactIngestScreenshotsRootHint,
        artifactIngestCanonicalPairCount,
        serverPngByteIngestWidth,
        serverPngByteIngestHeight,
        serverPngByteIngestByteLength,
        serverPngByteIngestCanonicalDigestFull,
        serverPngByteIngestCanonicalDigestTail,
        serverPngByteIngestComparisonResult,
        serverPngByteIngestSkippedReason,
        serverPngByteIngestLinkedBasename,
      };

      const sgRaw = e.screenshotHintGaps_v1;
      if (sgRaw && typeof sgRaw === 'object') {
        const sg = sgRaw as Record<string, unknown>;
        const rawGaps = Array.isArray(sg.gaps) ? sg.gaps : [];
        const items: {
          deterministicRowKind: string;
          rowId: string;
          missingPlaywrightFilenameSlots: string[];
        }[] = [];
        for (const gItem of rawGaps) {
          if (!gItem || typeof gItem !== 'object') continue;
          const o = gItem as Record<string, unknown>;
          const kind = typeof o.deterministicRowKind === 'string' ? o.deterministicRowKind : '';
          const rowId = typeof o.rowId === 'string' ? o.rowId : '';
          const slotsRaw = o.missingPlaywrightFilenameSlots;
          const slots = Array.isArray(slotsRaw)
            ? slotsRaw.filter((x): x is string => typeof x === 'string')
            : [];
          if (kind && rowId) {
            items.push({
              deterministicRowKind: kind,
              rowId,
              missingPlaywrightFilenameSlots: slots,
            });
          }
        }
        const gapRowCount =
          typeof sg.gapRowCount === 'number' && Number.isFinite(sg.gapRowCount)
            ? sg.gapRowCount
            : items.length;
        screenshotSlotGaps = { gapRowCount, items };
      }
    }

    const dse = payload.deterministicSheetEvidence;
    const rowsRaw = Array.isArray(dse) ? dse : [];
    const sheetRows = rowsRaw.map((row) => {
      const r = row as Record<string, unknown>;
      const pwRaw = r.playwrightSuggestedFilenames;
      const pw = pwRaw && typeof pwRaw === 'object' ? (pwRaw as Record<string, unknown>) : {};
      const corrRaw = r.correlation;
      const corr =
        corrRaw && typeof corrRaw === 'object' ? (corrRaw as Record<string, unknown>) : {};
      const rasterRaw = r.sheetPrintRasterIngest_v1;
      const raster =
        rasterRaw && typeof rasterRaw === 'object' ? (rasterRaw as Record<string, unknown>) : {};
      const ph = raster.placeholderPngSha256;
      const phStr = typeof ph === 'string' && ph.length >= 12 ? ph.slice(-12) : undefined;
      const ctr = raster.contract;
      return {
        sheetId: String(r.sheetId ?? r.sheet_id ?? ''),
        sheetName:
          typeof r.sheetName === 'string'
            ? r.sheetName
            : typeof r.sheet_name === 'string'
              ? r.sheet_name
              : undefined,
        pngViewport: typeof pw.pngViewport === 'string' ? pw.pngViewport : undefined,
        pngFullSheet: typeof pw.pngFullSheet === 'string' ? pw.pngFullSheet : undefined,
        printRasterPngHref:
          typeof r.printRasterPngHref === 'string'
            ? r.printRasterPngHref
            : typeof r.print_raster_png_href === 'string'
              ? r.print_raster_png_href
              : undefined,
        printRasterContract: typeof ctr === 'string' ? ctr : undefined,
        placeholderPngSha256Tail: phStr,
        bundleJson:
          typeof corr.suggestedEvidenceBundleEvidencePackageJson === 'string'
            ? corr.suggestedEvidenceBundleEvidencePackageJson
            : typeof corr.suggested_evidence_bundle_evidence_package_json === 'string'
              ? corr.suggested_evidence_bundle_evidence_package_json
              : undefined,
      };
    });

    const dv3 = payload.deterministic3dViewEvidence ?? payload.deterministic_3d_view_evidence;
    const vrowsRaw = Array.isArray(dv3) ? dv3 : [];
    const view3dRows = vrowsRaw.map((row) => {
      const r = row as Record<string, unknown>;
      const pwRaw = r.playwrightSuggestedFilenames;
      const pw = pwRaw && typeof pwRaw === 'object' ? (pwRaw as Record<string, unknown>) : {};
      const corrRaw = r.correlation;
      const corr =
        corrRaw && typeof corrRaw === 'object' ? (corrRaw as Record<string, unknown>) : {};
      return {
        viewpointId: String(r.viewpointId ?? r.viewpoint_id ?? ''),
        viewpointName:
          typeof r.viewpointName === 'string'
            ? r.viewpointName
            : typeof r.viewpoint_name === 'string'
              ? r.viewpoint_name
              : undefined,
        pngViewport: typeof pw.pngViewport === 'string' ? pw.pngViewport : undefined,
        bundleJson:
          typeof corr.suggestedEvidenceBundleEvidencePackageJson === 'string'
            ? corr.suggestedEvidenceBundleEvidencePackageJson
            : typeof corr.suggested_evidence_bundle_evidence_package_json === 'string'
              ? corr.suggested_evidence_bundle_evidence_package_json
              : undefined,
      };
    });

    const dpv = payload.deterministicPlanViewEvidence ?? payload.deterministic_plan_view_evidence;
    const prowsRaw = Array.isArray(dpv) ? dpv : [];
    const planViewRows = prowsRaw.map((row) => {
      const r = row as Record<string, unknown>;
      const pwRaw = r.playwrightSuggestedFilenames;
      const pw = pwRaw && typeof pwRaw === 'object' ? (pwRaw as Record<string, unknown>) : {};
      const corrRaw = r.correlation;
      const corr =
        corrRaw && typeof corrRaw === 'object' ? (corrRaw as Record<string, unknown>) : {};
      return {
        planViewId: String(r.planViewId ?? r.plan_view_id ?? ''),
        name: typeof r.name === 'string' ? r.name : undefined,
        levelId:
          typeof r.levelId === 'string'
            ? r.levelId
            : typeof r.level_id === 'string'
              ? r.level_id
              : undefined,
        planPresentation:
          typeof r.planPresentation === 'string'
            ? r.planPresentation
            : typeof r.plan_presentation === 'string'
              ? r.plan_presentation
              : undefined,
        pngPlanCanvas: typeof pw.pngPlanCanvas === 'string' ? pw.pngPlanCanvas : undefined,
        bundleJson:
          typeof corr.suggestedEvidenceBundleEvidencePackageJson === 'string'
            ? corr.suggestedEvidenceBundleEvidencePackageJson
            : typeof corr.suggested_evidence_bundle_evidence_package_json === 'string'
              ? corr.suggested_evidence_bundle_evidence_package_json
              : undefined,
      };
    });

    const dsc =
      payload.deterministicSectionCutEvidence ?? payload.deterministic_section_cut_evidence;
    const secrowsRaw = Array.isArray(dsc) ? dsc : [];
    const sectionCutRows = secrowsRaw.map((row) => {
      const r = row as Record<string, unknown>;
      const pwRaw = r.playwrightSuggestedFilenames;
      const pw = pwRaw && typeof pwRaw === 'object' ? (pwRaw as Record<string, unknown>) : {};
      const corrRaw = r.correlation;
      const corr =
        corrRaw && typeof corrRaw === 'object' ? (corrRaw as Record<string, unknown>) : {};
      return {
        sectionCutId: String(r.sectionCutId ?? r.section_cut_id ?? ''),
        name: typeof r.name === 'string' ? r.name : undefined,
        projectionWireHref:
          typeof r.projectionWireHref === 'string'
            ? r.projectionWireHref
            : typeof r.projection_wire_href === 'string'
              ? r.projection_wire_href
              : undefined,
        pngSectionViewport:
          typeof pw.pngSectionViewport === 'string' ? pw.pngSectionViewport : undefined,
        bundleJson:
          typeof corr.suggestedEvidenceBundleEvidencePackageJson === 'string'
            ? corr.suggestedEvidenceBundleEvidencePackageJson
            : typeof corr.suggested_evidence_bundle_evidence_package_json === 'string'
              ? corr.suggested_evidence_bundle_evidence_package_json
              : undefined,
      };
    });

    const reviewActionsParsed = parseAgentReviewActionsV1(
      payload.agentReviewActions_v1 ?? payload.agent_review_actions_v1,
    );
    const reviewActions = [
      ...reviewActionsParsed.filter((a) => a.kind === 'remediateEvidenceDiffIngest'),
      ...reviewActionsParsed.filter((a) => a.kind !== 'remediateEvidenceDiffIngest'),
    ];

    const mismatchNotes: string[] = [];

    const noteCorrelationDigest = (corr: Record<string, unknown>, label: string, id: string) => {
      const rowSha =
        typeof corr.semanticDigestSha256 === 'string' ? corr.semanticDigestSha256 : null;
      if (dig && rowSha && rowSha !== dig) {
        mismatchNotes.push(
          `${label} ${id}: correlation semanticDigestSha256 ≠ package digest — stale row or pasted fragment; re-fetch full evidence-package.`,
        );
      }
    };

    for (let i = 0; i < rowsRaw.length; i++) {
      const sr = sheetRows[i];
      if (!sr?.sheetId) continue;
      const cRaw = rowsRaw[i] as Record<string, unknown>;
      const corrRaw = cRaw?.correlation;
      const corr =
        corrRaw && typeof corrRaw === 'object' ? (corrRaw as Record<string, unknown>) : {};
      const rowPrefix =
        typeof corr.semanticDigestPrefix16 === 'string' ? corr.semanticDigestPrefix16 : null;
      if (prefix && rowPrefix && rowPrefix !== prefix) {
        mismatchNotes.push(
          `Sheet ${sr.sheetId}: correlation semanticDigestPrefix16 (${rowPrefix}) ≠ package (${prefix}).`,
        );
      }
      noteCorrelationDigest(corr, 'Sheet', sr.sheetId);
    }

    const liveRev = typeof revision === 'number' ? revision : null;
    if (modelRevision !== null && liveRev !== null && modelRevision !== liveRev) {
      mismatchNotes.push(
        `Evidence package modelRevision (${modelRevision}) ≠ loaded store revision (${liveRev}) — regenerate or re-fetch.`,
      );
    }

    for (let i = 0; i < vrowsRaw.length; i++) {
      const vr = view3dRows[i];
      if (!vr?.viewpointId) continue;
      const cRaw = vrowsRaw[i] as Record<string, unknown>;
      const corrRaw = cRaw?.correlation;
      const corr =
        corrRaw && typeof corrRaw === 'object' ? (corrRaw as Record<string, unknown>) : {};
      const rowPrefix =
        typeof corr.semanticDigestPrefix16 === 'string' ? corr.semanticDigestPrefix16 : null;
      if (prefix && rowPrefix && rowPrefix !== prefix) {
        mismatchNotes.push(
          `3D ${vr.viewpointId}: correlation semanticDigestPrefix16 (${rowPrefix}) ≠ package (${prefix}).`,
        );
      }
      noteCorrelationDigest(corr, '3D', vr.viewpointId);
    }

    for (let i = 0; i < prowsRaw.length; i++) {
      const pr = planViewRows[i];
      if (!pr?.planViewId) continue;
      const cRaw = prowsRaw[i] as Record<string, unknown>;
      const corrRaw = cRaw?.correlation;
      const corr =
        corrRaw && typeof corrRaw === 'object' ? (corrRaw as Record<string, unknown>) : {};
      const rowPrefix =
        typeof corr.semanticDigestPrefix16 === 'string' ? corr.semanticDigestPrefix16 : null;
      if (prefix && rowPrefix && rowPrefix !== prefix) {
        mismatchNotes.push(
          `Plan ${pr.planViewId}: correlation semanticDigestPrefix16 (${rowPrefix}) ≠ package (${prefix}).`,
        );
      }
      noteCorrelationDigest(corr, 'Plan', pr.planViewId);
    }

    for (let i = 0; i < secrowsRaw.length; i++) {
      const sec = sectionCutRows[i];
      if (!sec?.sectionCutId) continue;
      const cRaw = secrowsRaw[i] as Record<string, unknown>;
      const corrRaw = cRaw?.correlation;
      const corr =
        corrRaw && typeof corrRaw === 'object' ? (corrRaw as Record<string, unknown>) : {};
      const rowPrefix =
        typeof corr.semanticDigestPrefix16 === 'string' ? corr.semanticDigestPrefix16 : null;
      if (prefix && rowPrefix && rowPrefix !== prefix) {
        mismatchNotes.push(
          `Section ${sec.sectionCutId}: correlation semanticDigestPrefix16 (${rowPrefix}) ≠ package (${prefix}).`,
        );
      }
      noteCorrelationDigest(corr, 'Section', sec.sectionCutId);
    }

    for (const sr of sheetRows) {
      if (!sr.sheetId) continue;
      if (!sr.pngViewport && !sr.pngFullSheet) {
        mismatchNotes.push(
          `Sheet ${sr.sheetId}: missing Playwright PNG hints in deterministic sheet evidence row — rerun evidence-baselines or refresh manifest.`,
        );
      }
    }
    for (const vr of view3dRows) {
      if (!vr.viewpointId) continue;
      if (!vr.pngViewport) {
        mismatchNotes.push(
          `Viewpoint ${vr.viewpointId}: missing pngViewport hint — regenerate deterministic 3D evidence.`,
        );
      }
    }
    for (const pr of planViewRows) {
      if (!pr.planViewId) continue;
      if (!pr.pngPlanCanvas) {
        mismatchNotes.push(
          `Plan view ${pr.planViewId}: missing pngPlanCanvas hint — refresh evidence-package or extend server manifest.`,
        );
      }
    }
    for (const sec of sectionCutRows) {
      if (!sec.sectionCutId) continue;
      if (!sec.pngSectionViewport) {
        mismatchNotes.push(
          `Section cut ${sec.sectionCutId}: missing pngSectionViewport hint — refresh evidence-package or extend server manifest.`,
        );
      }
    }

    let evidenceFreshness: EvidenceArtifactSummary['evidenceFreshness'] = null;
    if (closureReview) {
      const staleCount = closureReview.staleRowCount;
      const missingCount = closureReview.missingDigestRowCount;
      const totalCount = closureReview.primaryCount;
      const freshCount = Math.max(0, totalCount - staleCount - missingCount);
      evidenceFreshness = {
        freshCount,
        staleCount,
        missingCount,
        totalCount,
        blockerCodes: [],
        staleRows: [],
      };
    }
    if (payload.schemaVersion === 'sketch.evidence.freshness.v1') {
      const summary =
        payload.summary && typeof payload.summary === 'object'
          ? (payload.summary as Record<string, unknown>)
          : {};
      const staleRows = Array.isArray(payload.blockers)
        ? payload.blockers
            .filter(
              (row): row is Record<string, unknown> => typeof row === 'object' && row !== null,
            )
            .map((row) => ({
              id:
                typeof row.id === 'string'
                  ? row.id
                  : typeof row.checkId === 'string'
                    ? row.checkId
                    : '',
              code: typeof row.code === 'string' ? row.code : '',
              status: typeof row.status === 'string' ? row.status : '',
            }))
            .filter((row) => row.id || row.code)
        : [];
      const totalCount =
        typeof summary.checkCount === 'number'
          ? summary.checkCount
          : typeof summary.totalCount === 'number'
            ? summary.totalCount
            : Array.isArray(payload.checks)
              ? payload.checks.length
              : staleRows.length;
      const staleCount =
        typeof summary.staleCount === 'number' ? summary.staleCount : staleRows.length;
      const missingCount = typeof summary.missingCount === 'number' ? summary.missingCount : 0;
      const freshCount =
        typeof summary.passCount === 'number'
          ? summary.passCount
          : Math.max(0, totalCount - staleCount - missingCount);
      evidenceFreshness = {
        freshCount,
        staleCount,
        missingCount,
        totalCount,
        blockerCodes: staleRows.map((row) => row.code).filter(Boolean),
        staleRows,
      };
    }

    let targetHouseFeatureCoverage: EvidenceArtifactSummary['targetHouseFeatureCoverage'] = null;
    const thRaw =
      payload.schemaVersion === 'target-house-feature-coverage-dashboard.v1'
        ? payload
        : (payload.targetHouseFeatureCoverageDashboard_v1 ??
          payload.featureCoverageDashboard ??
          payload.targetHouseFeatureCoverageDashboard);
    if (thRaw && typeof thRaw === 'object') {
      const dashboard = thRaw as Record<string, unknown>;
      if (dashboard.schemaVersion === 'target-house-feature-coverage-dashboard.v1') {
        const rowsRaw = Array.isArray(dashboard.rows) ? dashboard.rows : [];
        const rows = rowsRaw
          .filter((row): row is Record<string, unknown> => typeof row === 'object' && row !== null)
          .map((row) => {
            const screenshots =
              row.screenshots && typeof row.screenshots === 'object'
                ? (row.screenshots as Record<string, unknown>)
                : {};
            const blockersRaw = Array.isArray(row.blockers) ? row.blockers : [];
            return {
              featureId: typeof row.featureId === 'string' ? row.featureId : '',
              status: typeof row.status === 'string' ? row.status : '',
              elementCoverageStatus:
                typeof row.elementCoverageStatus === 'string' ? row.elementCoverageStatus : '',
              openFindingCount:
                typeof row.openFindingCount === 'number' && Number.isFinite(row.openFindingCount)
                  ? row.openFindingCount
                  : 0,
              blockerCount: blockersRaw.length,
              screenshotMissingCount:
                typeof screenshots.missingCount === 'number' &&
                Number.isFinite(screenshots.missingCount)
                  ? screenshots.missingCount
                  : 0,
            };
          })
          .filter((row) => row.featureId);
        targetHouseFeatureCoverage = {
          requiredFeatureCount:
            typeof dashboard.requiredFeatureCount === 'number' &&
            Number.isFinite(dashboard.requiredFeatureCount)
              ? dashboard.requiredFeatureCount
              : rows.length,
          explicitElementCoverageCount:
            typeof dashboard.explicitElementCoverageCount === 'number'
              ? dashboard.explicitElementCoverageCount
              : rows.filter((row) => row.elementCoverageStatus === 'explicit_elements').length,
          resolvedElementCoverageCount:
            typeof dashboard.resolvedElementCoverageCount === 'number'
              ? dashboard.resolvedElementCoverageCount
              : rows.filter((row) => row.elementCoverageStatus === 'resolved_elements').length,
          semanticSelectorCoverageCount:
            typeof dashboard.semanticSelectorCoverageCount === 'number'
              ? dashboard.semanticSelectorCoverageCount
              : rows.filter((row) => row.elementCoverageStatus === 'semantic_selectors_only')
                  .length,
          missingElementCoverageCount:
            typeof dashboard.missingElementCoverageCount === 'number'
              ? dashboard.missingElementCoverageCount
              : rows.filter((row) => row.elementCoverageStatus === 'missing_element_mapping')
                  .length,
          openFindingCount:
            typeof dashboard.openFindingCount === 'number'
              ? dashboard.openFindingCount
              : rows.reduce((sum, row) => sum + row.openFindingCount, 0),
          screenshotMissingCount:
            typeof dashboard.screenshotMissingCount === 'number'
              ? dashboard.screenshotMissingCount
              : rows.reduce((sum, row) => sum + row.screenshotMissingCount, 0),
          blockerCount:
            typeof dashboard.blockerCount === 'number'
              ? dashboard.blockerCount
              : rows.reduce((sum, row) => sum + row.blockerCount, 0),
          evidenceAcceptanceOk:
            typeof dashboard.evidenceAcceptanceOk === 'boolean'
              ? dashboard.evidenceAcceptanceOk
              : null,
          rows,
        };
      }
    }

    let methodologyDashboard: EvidenceArtifactSummary['methodologyDashboard'] = null;
    const methodologyRaw =
      payload.schemaVersion === 'target-house-methodology-dashboard.v1'
        ? payload
        : (payload.targetHouseMethodologyDashboard_v1 ??
          payload.methodologyDashboard ??
          payload.targetHouseMethodologyDashboard);
    if (methodologyRaw && typeof methodologyRaw === 'object') {
      const dashboard = methodologyRaw as Record<string, unknown>;
      if (dashboard.schemaVersion === 'target-house-methodology-dashboard.v1') {
        const summary =
          dashboard.summary && typeof dashboard.summary === 'object'
            ? (dashboard.summary as Record<string, unknown>)
            : {};
        const rowsRaw = Array.isArray(dashboard.rows) ? dashboard.rows : [];
        const rows = rowsRaw
          .filter((row): row is Record<string, unknown> => typeof row === 'object' && row !== null)
          .map((row) => ({
            trackerId: typeof row.trackerId === 'string' ? row.trackerId : '',
            title: typeof row.title === 'string' ? row.title : '',
            ok: row.ok === true,
            evidence: Array.isArray(row.evidence)
              ? row.evidence.filter((value): value is string => typeof value === 'string')
              : [],
            summary:
              row.summary && typeof row.summary === 'object'
                ? (row.summary as Record<string, unknown>)
                : {},
          }))
          .filter((row) => row.trackerId);
        methodologyDashboard = {
          ok: typeof dashboard.ok === 'boolean' ? dashboard.ok : null,
          acceptanceLayer:
            typeof dashboard.acceptanceLayer === 'string' ? dashboard.acceptanceLayer : '',
          normalAdvisorBoundary:
            typeof dashboard.normalAdvisorBoundary === 'string'
              ? dashboard.normalAdvisorBoundary
              : '',
          blockingRowCount:
            typeof summary.blockingRowCount === 'number' ? summary.blockingRowCount : 0,
          passingRowCount:
            typeof summary.passingRowCount === 'number'
              ? summary.passingRowCount
              : rows.filter((row) => row.ok).length,
          rowCount: typeof summary.rowCount === 'number' ? summary.rowCount : rows.length,
          rows,
        };
      }
    }

    let regenerationGuidance: EvidenceArtifactSummary['regenerationGuidance'] = null;
    const regenRaw =
      typeof evidenceTxt === 'string'
        ? (() => {
            try {
              return JSON.parse(evidenceTxt) as Record<string, unknown>;
            } catch {
              return null;
            }
          })()
        : null;
    if (regenRaw && typeof regenRaw === 'object') {
      const rgRaw = (regenRaw as Record<string, unknown>).agentRegenerationGuidance_v1;
      if (rgRaw && typeof rgRaw === 'object') {
        const rg = rgRaw as Record<string, unknown>;
        const actionsRaw = rg.actions;
        if (Array.isArray(actionsRaw)) {
          regenerationGuidance = actionsRaw
            .filter((a): a is Record<string, unknown> => typeof a === 'object' && a !== null)
            .map((a) => ({
              priority: typeof a.priority === 'string' ? a.priority : 'low',
              artifactKey: typeof a.artifactKey === 'string' ? a.artifactKey : '',
              reason: typeof a.reason === 'string' ? a.reason : '',
              suggestedCommand: typeof a.suggestedCommand === 'string' ? a.suggestedCommand : '',
            }))
            .filter((a) => a.artifactKey.length > 0);
        }
      }
    }

    return {
      semanticDigestPrefix16: prefix,
      semanticDigestSha256Tail: shaTail,
      semanticDigestSha256Full: dig,
      modelRevision:
        modelRevision !== null && Number.isFinite(modelRevision) ? modelRevision : null,
      sheetRows,
      view3dRows,
      planViewRows,
      sectionCutRows,
      closureHints,
      closureReview,
      lifecycleSignal,
      agentFollowThrough,
      screenshotSlotGaps,
      suggestedBasenameHint: basename,
      mismatchNotes,
      diffFixLoop,
      performanceGate,
      reviewActions,
      artifactUploadManifestReadout,
      baselineLifecycleReadout,
      consistencyClosure,
      prdCloseoutCrossCorrelation,
      evidenceFreshness,
      targetHouseFeatureCoverage,
      methodologyDashboard,
      regenerationGuidance,
    };
  } catch {
    return {
      semanticDigestPrefix16: null,
      semanticDigestSha256Tail: null,
      semanticDigestSha256Full: null,
      modelRevision: null,
      sheetRows: [],
      view3dRows: [],
      planViewRows: [],
      sectionCutRows: [],
      closureHints: null,
      closureReview: null,
      lifecycleSignal: null,
      agentFollowThrough: null,
      screenshotSlotGaps: null,
      suggestedBasenameHint: null,
      mismatchNotes: ['Could not parse evidence JSON for artifact summary.'],
      diffFixLoop: null,
      performanceGate: null,
      reviewActions: [],
      artifactUploadManifestReadout: null,
      baselineLifecycleReadout: null,
      consistencyClosure: null,
      prdCloseoutCrossCorrelation: null,
      evidenceFreshness: null,
      targetHouseFeatureCoverage: null,
      methodologyDashboard: null,
      regenerationGuidance: null,
    };
  }
}

export function parseRoomCandidates(roomCandTxt: string | null) {
  if (!roomCandTxt) return null;

  try {
    const parsed = JSON.parse(roomCandTxt) as { candidates?: RoomCand[] };

    const cands = Array.isArray(parsed.candidates) ? parsed.candidates : [];

    return cands.map((c) => {
      const topMatch = Array.isArray(c.comparisonToAuthoredRooms)
        ? c.comparisonToAuthoredRooms[0]
        : undefined;

      return {
        id: String(c.candidateId ?? '—'),

        area: typeof c.approxAreaM2 === 'number' ? c.approxAreaM2 : null,

        level: typeof c.levelName === 'string' ? c.levelName : '',

        perimeter: typeof c.perimeterApproxM === 'number' ? c.perimeterApproxM : null,

        warnCount: Array.isArray(c.warnings) ? c.warnings.length : 0,

        hint:
          typeof c.classificationHints?.schemeColorHint === 'string'
            ? c.classificationHints.schemeColorHint
            : '',
        bestRoomId: typeof topMatch?.roomId === 'string' ? topMatch.roomId : '',
        bestIou:
          typeof topMatch?.iouApprox === 'number'
            ? topMatch.iouApprox
            : topMatch?.iouApprox != null
              ? Number(topMatch.iouApprox)
              : null,
      };
    });
  } catch {
    return null;
  }
}
