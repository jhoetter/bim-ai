import { useMemo, useState } from 'react';

import { Btn } from '@bim-ai/ui';

import { collaborationConflictQueueInspectionLinesFromHints } from '../lib/collaborationConflictQueue';
import { useBimStore } from '../state/store';
import {
  AgentBriefAcceptanceReadoutV1Table,
  formatAgentBriefAcceptanceReadoutLines,
  parseAgentBriefAcceptanceReadoutV1,
} from './agentBriefAcceptanceReadout';
import {
  formatAgentBriefCommandProtocolReadout,
  parseAgentBriefCommandProtocolV1,
} from './agentBriefCommandProtocol';
import {
  formatAgentGeneratedBundleQaChecklistReadout,
  parseAgentGeneratedBundleQaChecklistV1,
} from './agentGeneratedBundleQaChecklist';
import { formatAgentReviewActionDetails } from './agentReviewActionDetails';
import { parseAgentReviewActionsV1, type AgentReviewActionRow } from './agentReviewActions';
import { summarizeArtifactUploadManifestV1 } from './artifactUploadManifestReadout';
import {
  EvidenceBaselineLifecycleReadoutV1Table,
  parseEvidenceBaselineLifecycleReadoutV1,
  type EvidenceBaselineLifecycleReadoutWire,
} from './evidenceBaselineLifecycleReadout';
import {
  summarizeBcfIssuePackageExport,
  type BcfIssuePackageExportWire,
} from './bcfIssuePackageExportFormat';
import {
  summarizeBcfRoundtripEvidenceSummary,
  type BcfRoundtripEvidenceSummaryWire,
} from './bcfRoundtripEvidenceSummaryFormat';
import { formatStagedArtifactResolutionMode } from './formatStagedArtifactResolutionMode';
import {
  buildBrowserRenderingBudgetReadoutV1,
  formatBrowserRenderingBudgetLines,
} from './browserRenderingBudgetReadout';
import {
  formatAgentReviewReadoutConsistencyClosureLines,
  parseAgentReviewReadoutConsistencyClosureV1,
  type AgentReviewReadoutConsistencyClosureV1,
} from './agentReviewReadoutConsistencyClosure';
import {
  formatIfcExchangeManifestClosureLines,
  type IfcExchangeManifestClosureWire,
} from './ifcExchangeManifestClosureReadout';
import {
  formatPrdCloseoutCrossCorrelationReadoutLines,
  parsePrdCloseoutCrossCorrelationManifestV1,
  type PrdCloseoutCrossCorrelationManifestWire,
} from './prdCloseoutCrossCorrelationReadout';

type JsonText = string;

/** Agent-style review workflow: assumptions, dry-run bundle, validate + evidence-package. */
export function AgentReviewPane() {
  const [schemaTxt, setSchemaTxt] = useState<JsonText | null>(null);
  const [evidenceTxt, setEvidenceTxt] = useState<JsonText | null>(null);
  const [bundleText, setBundleText] = useState<string>('{"commands":[]}');
  const [dryRunTxt, setDryRunTxt] = useState<JsonText | null>(null);
  const [roomCandTxt, setRoomCandTxt] = useState<JsonText | null>(null);
  const [roomCandError, setRoomCandError] = useState<string | null>(null);
  const [assumeLogTxt, setAssumeLogTxt] = useState<JsonText>(
    JSON.stringify(
      [
        'Golden bundles target an isolated model revision — avoid stacking repeats blindly.',
        'Coordinates are mm; disciplines default residential unless commanded otherwise.',
      ],
      null,
      2,
    ),
  );
  const [stepLog, setStepLog] = useState<string[]>([]);

  const modelId = useBimStore((s) => s.modelId);
  const revision = useBimStore((s) => s.revision);

  function pushStep(line: string) {
    setStepLog((p) => [...p.slice(-80), `[${new Date().toISOString()}] ${line}`]);
  }

  type EvidenceArtifactSummary = {
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
    } | null;
    regenerationGuidance: {
      priority: string;
      artifactKey: string;
      reason: string;
      suggestedCommand: string;
    }[] | null;
  };

  const assumptionsJson = useMemo(() => {
    try {
      const raw = assumeLogTxt.trim();
      const parsed = JSON.parse(raw === '' ? '[]' : raw) as unknown;
      const arr = Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : [];
      return { assumptionLogFormat: 'assumptionLog_v0', assumptions: arr };
    } catch {
      return {
        assumptionLogFormat: 'assumptionLog_v0',
        assumptions: [],
        error: 'Invalid JSON array',
      };
    }
  }, [assumeLogTxt]);

  const dryRunBriefProtocol = useMemo(() => {
    if (!dryRunTxt) return null;
    try {
      const root = JSON.parse(dryRunTxt) as Record<string, unknown>;
      const dr = root.dryRun;
      if (dr !== null && typeof dr === 'object' && !Array.isArray(dr)) {
        return parseAgentBriefCommandProtocolV1(
          (dr as Record<string, unknown>).agentBriefCommandProtocol_v1,
        );
      }
    } catch {
      return null;
    }
    return null;
  }, [dryRunTxt]);

  const evidenceBriefProtocol = useMemo(() => {
    if (!evidenceTxt) return null;
    try {
      const root = JSON.parse(evidenceTxt) as Record<string, unknown>;
      const pay = root.payload ?? root.evidencePackage;
      if (pay !== null && typeof pay === 'object' && !Array.isArray(pay)) {
        return parseAgentBriefCommandProtocolV1(
          (pay as Record<string, unknown>).agentBriefCommandProtocol_v1,
        );
      }
    } catch {
      return null;
    }
    return null;
  }, [evidenceTxt]);

  const evidenceQaChecklist = useMemo(() => {
    if (!evidenceTxt) return null;
    try {
      const root = JSON.parse(evidenceTxt) as Record<string, unknown>;
      const pay = root.payload ?? root.evidencePackage;
      if (pay !== null && typeof pay === 'object' && !Array.isArray(pay)) {
        return parseAgentGeneratedBundleQaChecklistV1(
          (pay as Record<string, unknown>).agentGeneratedBundleQaChecklist_v1,
        );
      }
    } catch {
      return null;
    }
    return null;
  }, [evidenceTxt]);

  const dryRunQaChecklist = useMemo(() => {
    if (!dryRunTxt) return null;
    try {
      const root = JSON.parse(dryRunTxt) as Record<string, unknown>;
      const dr = root.dryRun;
      if (dr !== null && typeof dr === 'object' && !Array.isArray(dr)) {
        return parseAgentGeneratedBundleQaChecklistV1(
          (dr as Record<string, unknown>).agentGeneratedBundleQaChecklist_v1,
        );
      }
    } catch {
      return null;
    }
    return null;
  }, [dryRunTxt]);

  const evidenceAcceptanceReadout = useMemo(() => {
    if (!evidenceTxt) return null;
    try {
      const root = JSON.parse(evidenceTxt) as Record<string, unknown>;
      const pay = root.payload ?? root.evidencePackage;
      if (pay !== null && typeof pay === 'object' && !Array.isArray(pay)) {
        return parseAgentBriefAcceptanceReadoutV1(
          (pay as Record<string, unknown>).agentBriefAcceptanceReadout_v1,
        );
      }
    } catch {
      return null;
    }
    return null;
  }, [evidenceTxt]);

  const dryRunAcceptanceReadout = useMemo(() => {
    if (!dryRunTxt) return null;
    try {
      const root = JSON.parse(dryRunTxt) as Record<string, unknown>;
      const dr = root.dryRun;
      if (dr !== null && typeof dr === 'object' && !Array.isArray(dr)) {
        return parseAgentBriefAcceptanceReadoutV1(
          (dr as Record<string, unknown>).agentBriefAcceptanceReadout_v1,
        );
      }
    } catch {
      return null;
    }
    return null;
  }, [dryRunTxt]);

  const evidenceConsistencyClosure = useMemo(() => {
    if (!evidenceTxt) return null;
    try {
      const root = JSON.parse(evidenceTxt) as Record<string, unknown>;
      const pay = root.payload ?? root.evidencePackage;
      if (pay !== null && typeof pay === 'object' && !Array.isArray(pay)) {
        return parseAgentReviewReadoutConsistencyClosureV1(
          (pay as Record<string, unknown>).agentReviewReadoutConsistencyClosure_v1,
        );
      }
    } catch {
      return null;
    }
    return null;
  }, [evidenceTxt]);

  const dryRunConsistencyClosure = useMemo(() => {
    if (!dryRunTxt) return null;
    try {
      const root = JSON.parse(dryRunTxt) as Record<string, unknown>;
      const dr = root.dryRun;
      if (dr !== null && typeof dr === 'object' && !Array.isArray(dr)) {
        return parseAgentReviewReadoutConsistencyClosureV1(
          (dr as Record<string, unknown>).agentReviewReadoutConsistencyClosure_v1,
        );
      }
    } catch {
      return null;
    }
    return null;
  }, [dryRunTxt]);

  type RoomCand = {
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

  const elementsById = useBimStore((s) => s.elementsById);

  const planProjectionPrimitives = useBimStore((s) => s.planProjectionPrimitives);
  const scheduleBudgetHydration = useBimStore((s) => s.scheduleBudgetHydration);

  const browserRenderingBudgetReadout = useMemo(
    () =>
      buildBrowserRenderingBudgetReadoutV1({
        elementsById,
        planProjectionPrimitives,
        scheduleHydratedRowCount: scheduleBudgetHydration?.rowCount ?? null,
        scheduleHydratedTab: scheduleBudgetHydration?.tab ?? null,
      }),
    [elementsById, planProjectionPrimitives, scheduleBudgetHydration],
  );

  const browserRenderingBudgetLines = useMemo(
    () => formatBrowserRenderingBudgetLines(browserRenderingBudgetReadout),
    [browserRenderingBudgetReadout],
  );

  const authoredRoomStats = useMemo(() => {
    const rooms = Object.values(elementsById).filter((e) => e.kind === 'room');

    return { count: rooms.length };
  }, [elementsById]);

  const evidenceArtifactSummary = useMemo((): EvidenceArtifactSummary => {
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
          performanceGate = {
            gateClosed: g.gateClosed === true,
            enforcement: typeof g.enforcement === 'string' ? g.enforcement : null,
            probeKind: typeof g.probeKind === 'string' ? g.probeKind : null,
            blockerCodesEcho,
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
            pixelDiffThresholdEnforcement =
              typeof t.enforcement === 'string' ? t.enforcement : null;
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
              serverPngByteIngestCanonicalDigestTail =
                cdig.length >= 12 ? cdig.slice(-12) : cdig;
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
        evidenceFreshness = { freshCount, staleCount, missingCount, totalCount };
      }

      let regenerationGuidance: EvidenceArtifactSummary['regenerationGuidance'] = null;
      const regenRaw = (typeof evidenceTxt === 'string' ? (() => {
        try { return JSON.parse(evidenceTxt) as Record<string, unknown>; } catch { return null; }
      })() : null);
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
        regenerationGuidance: null,
      };
    }
  }, [evidenceTxt, revision]);

  const roomCandPreview = useMemo(() => {
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
  }, [roomCandTxt]);

  function appendRoomCandidateCommands(cands: RoomCand[]) {
    const flat: unknown[] = [];
    for (const c of cands) {
      const sb = c.suggestedBundleCommands;
      if (Array.isArray(sb)) {
        for (const cmd of sb) {
          flat.push(cmd);
        }
      }
    }
    if (!flat.length) return;
    try {
      const env = JSON.parse(bundleText || '{}') as { commands?: unknown[] };
      const existing = Array.isArray(env.commands) ? env.commands : [];
      env.commands = [...existing, ...flat];
      setBundleText(JSON.stringify(env, null, 2));
      pushStep(`appended ${flat.length} commands from room derivation candidates`);
    } catch {
      pushStep('failed to merge room candidate commands into bundle JSON');
    }
  }

  return (
    <div className="space-y-3 text-[11px]">
      <div>
        <div className="font-semibold text-muted">Guided workflow</div>
        <ol className="mt-2 list-decimal space-y-1 ps-5 text-muted">
          <li>
            Inspect schema + attach an <strong>assumption log</strong> (JSON array of strings).
          </li>
          <li>Paste a command bundle and run bundle dry-run (no commit).</li>
          <li>
            Fetch validation + evidence-package JSON and compare with Playwright screenshots in CI.
          </li>
          <li>
            Use advisor quick-fixes before applying bundles to production models. Watch{' '}
            <code className="text-[10px]">schedule_opening_*</code> rows for hosted openings and use the Schedules
            panel definition presets to confirm required export columns are present on the server table.
          </li>
        </ol>
      </div>

      <div>
        <div className="font-semibold text-muted">Model context</div>
        <p className="mt-1 text-muted">
          Active model <code className="text-[10px]">{modelId ?? '—'}</code> · revision r{revision}
        </p>
      </div>

      <div
        className="rounded border border-border bg-background/40 p-2"
        data-testid="agent-review-browser-rendering-budget"
      >
        <div className="text-[10px] font-semibold text-muted">
          Browser rendering budget (browserRenderingBudgetReadout_v1)
        </div>
        <ul className="mt-1 list-disc space-y-0.5 ps-4 text-[10px] text-muted">
          {browserRenderingBudgetLines.map((ln, idx) => (
            <li key={`br-${idx}`}>
              <code className="whitespace-pre-wrap break-all font-mono text-[9px]">{ln}</code>
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded border border-border bg-background/40 p-2">
        <label className="block text-[10px] font-semibold text-muted">
          Assumption log (JSON string array — attached to bundled evidence previews)
          <textarea
            className="mt-1 w-full rounded border border-border bg-background p-2 font-mono text-[10px]"
            rows={6}
            value={assumeLogTxt}
            onChange={(e) => setAssumeLogTxt(e.target.value)}
          />
        </label>
        {'error' in assumptionsJson && assumptionsJson.error ? (
          <div className="mt-1 text-[10px] text-amber-500">{assumptionsJson.error}</div>
        ) : (
          <div className="mt-2 text-[10px] text-muted">
            Attached shape:{' '}
            <code className="text-[10px]">{JSON.stringify(assumptionsJson, null, 0)}</code>
          </div>
        )}
      </div>

      <div className="rounded border border-border bg-background/40 p-2">
        <div className="font-semibold text-muted">Command bundle (JSON)</div>
        <textarea
          className="mt-2 w-full rounded border border-border bg-background p-2 font-mono text-[10px]"
          rows={6}
          spellCheck={false}
          value={bundleText}
          onChange={(e) => setBundleText(e.target.value)}
        />

        <div className="mt-2 flex flex-wrap gap-2">
          <Btn
            type="button"
            variant="quiet"
            className="text-[11px]"
            disabled={!modelId}
            title={!modelId ? 'Bootstrap a model first' : undefined}
            onClick={() =>
              void (async () => {
                if (!modelId) return;
                try {
                  const env = JSON.parse(bundleText || '{}') as { commands?: unknown };
                  const commands = Array.isArray(env.commands) ? env.commands : [];
                  const res = await fetch(
                    `/api/models/${encodeURIComponent(modelId)}/commands/bundle/dry-run`,
                    {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ commands }),
                    },
                  );
                  const body = JSON.parse(await res.text()) as unknown;
                  const merged = { assumptionPreview: assumptionsJson, dryRun: body };
                  setDryRunTxt(JSON.stringify(merged, null, 2));
                  pushStep(`bundle dry-run ${res.ok ? 'ok' : 'failed'}`);
                  if (!res.ok) throw new Error(JSON.stringify(body));
                } catch (e) {
                  setDryRunTxt(e instanceof Error ? e.message : String(e));
                  pushStep(`bundle dry-run error`);
                }
              })()
            }
          >
            POST bundle dry-run
          </Btn>

          <Btn
            type="button"
            variant="quiet"
            className="text-[11px]"
            disabled={!modelId}
            title={!modelId ? 'Bootstrap a model first' : undefined}
            onClick={() =>
              void (async () => {
                if (!modelId) return;
                try {
                  const valRes = await fetch(`/api/models/${encodeURIComponent(modelId)}/validate`);
                  const val = JSON.parse(await valRes.text()) as unknown;

                  const evRes = await fetch(
                    `/api/models/${encodeURIComponent(modelId)}/evidence-package`,
                  );
                  const ev = JSON.parse(await evRes.text()) as unknown;
                  const merged = {
                    assumptions: assumptionsJson,
                    validate: val,
                    evidencePackage: ev,
                  };
                  setEvidenceTxt(JSON.stringify(merged, null, 2));
                  pushStep(`validate+evidence ${valRes.ok && evRes.ok ? 'ok' : 'partial failure'}`);
                } catch (e) {
                  setEvidenceTxt(e instanceof Error ? e.message : String(e));
                  pushStep('validate+evidence error');
                }
              })()
            }
          >
            Validate + fetch evidence-package
          </Btn>

          <Btn
            type="button"
            variant="quiet"
            className="text-[11px]"
            disabled={!modelId}
            title={!modelId ? 'Bootstrap a model first' : undefined}
            onClick={() =>
              void (async () => {
                if (!modelId) return;
                try {
                  const res = await fetch(
                    `/api/models/${encodeURIComponent(modelId)}/room-derivation-candidates`,
                  );
                  const body = JSON.parse(await res.text()) as unknown;
                  if (!res.ok) throw new Error(JSON.stringify(body));
                  setRoomCandTxt(JSON.stringify(body, null, 2));
                  setRoomCandError(null);
                  pushStep('room-derivation-candidates fetch ok');
                } catch (e) {
                  const msg = e instanceof Error ? e.message : String(e);
                  setRoomCandError(msg);
                  setRoomCandTxt(null);
                  pushStep('room-derivation-candidates error');
                }
              })()
            }
          >
            Fetch room-derivation-candidates
          </Btn>
        </div>
      </div>

      {roomCandError ? (
        <div className="rounded border border-border border-amber-500/40 bg-background/40 p-2 text-[10px] text-amber-600">
          {roomCandError}
        </div>
      ) : null}

      {roomCandTxt ? (
        <div className="rounded border border-border bg-background/40 p-2">
          <div className="font-semibold text-muted">Room derivation (review)</div>
          <p className="mt-1 text-[10px] text-muted" data-testid="room-derivation-browser-context">
            Browser snapshot: {authoredRoomStats.count} authored room(s). Use comparison below
            against server candidates.
          </p>
          {roomCandPreview && roomCandPreview.length > 0 ? (
            <div data-testid="room-derivation-comparison" className="mt-2 overflow-x-auto">
              <table className="w-full border-collapse text-[10px]">
                <thead>
                  <tr className="border-b border-border/60 text-left text-muted">
                    <th className="py-1 pe-2">Candidate</th>
                    <th className="py-1 pe-2">Level</th>
                    <th className="py-1 pe-2">A (m²)</th>
                    <th className="py-1 pe-2">Perim (m)</th>
                    <th className="py-1 pe-2">Best room</th>
                    <th className="py-1 pe-2">IoU≈</th>
                    <th className="py-1 pe-2">Warnings</th>
                    <th className="py-1">Hint</th>
                  </tr>
                </thead>
                <tbody>
                  {roomCandPreview.map((row) => (
                    <tr key={row.id} className="border-t border-border/40">
                      <td className="py-1 pe-2 font-mono">{row.id.slice(0, 12)}…</td>
                      <td className="py-1 pe-2">{row.level || '—'}</td>
                      <td className="py-1 pe-2">{row.area != null ? row.area.toFixed(2) : '—'}</td>
                      <td className="py-1 pe-2">
                        {row.perimeter != null ? row.perimeter.toFixed(2) : '—'}
                      </td>
                      <td className="py-1 pe-2 font-mono">{row.bestRoomId || '—'}</td>
                      <td className="py-1 pe-2">
                        {row.bestIou != null ? row.bestIou.toFixed(2) : '—'}
                      </td>
                      <td className="py-1 pe-2">{row.warnCount}</td>
                      <td className="py-1">
                        {row.hint ? (
                          <span
                            className="inline-block size-3 rounded-full border border-border"
                            style={{ backgroundColor: row.hint }}
                            title={row.hint}
                          />
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
          <div className="mt-2 flex flex-wrap gap-2">
            <Btn
              type="button"
              variant="quiet"
              className="text-[11px]"
              onClick={() => {
                try {
                  const parsed = JSON.parse(roomCandTxt || '{}') as { candidates?: RoomCand[] };
                  const cands = Array.isArray(parsed.candidates) ? parsed.candidates : [];
                  appendRoomCandidateCommands(cands);
                } catch {
                  pushStep('room candidate merge parse error');
                }
              }}
            >
              Append all suggested bundle commands
            </Btn>
          </div>
          <pre className="mt-2 max-h-40 overflow-auto rounded border bg-background p-2 text-[10px]">
            {roomCandTxt}
          </pre>
        </div>
      ) : null}

      <div>
        <div className="font-semibold text-muted">Evidence checklist (CLI)</div>
        <p className="mt-1 text-muted">
          Run from a shell with <code className="text-[10px]">BIM_AI_MODEL_ID</code> and optional{' '}
          <code className="text-[10px]">BIM_AI_BASE_URL</code> pointing at this stack.
        </p>
        <ol className="mt-2 list-decimal space-y-1 ps-5 text-muted">
          <li>
            <code className="text-[10px]">bim-ai presets</code> — schema + preset ids
          </li>
          <li>
            <code className="text-[10px]">bim-ai schema</code> — full command wire schema
          </li>
          <li>
            <code className="text-[10px]">bim-ai evidence</code> — snapshot counts + validate rollup
          </li>
          <li>
            <code className="text-[10px]">bim-ai apply-bundle --dry-run &lt;bundle.json</code> —
            commit preview
          </li>
        </ol>
      </div>

      <div className="flex flex-wrap gap-2">
        <Btn
          type="button"
          variant="quiet"
          className="text-[11px]"
          onClick={() =>
            void (async () => {
              try {
                const res = await fetch('/api/schema');
                const body = JSON.parse(await res.text()) as unknown;
                if (!res.ok) throw new Error(String(body));
                setSchemaTxt(JSON.stringify(body, null, 2));
              } catch {
                setSchemaTxt('failed to fetch /api/schema');
              }
            })()
          }
        >
          Load /api/schema
        </Btn>

        <Btn
          type="button"
          variant="quiet"
          className="text-[11px]"
          disabled={!modelId}
          title={!modelId ? 'Bootstrap a model first' : undefined}
          onClick={() =>
            void (async () => {
              if (!modelId) return;
              try {
                const snapRes = await fetch(`/api/models/${encodeURIComponent(modelId)}/snapshot`);
                const snap = JSON.parse(await snapRes.text()) as Record<string, unknown>;
                const valRes = await fetch(`/api/models/${encodeURIComponent(modelId)}/validate`);
                const val = JSON.parse(await valRes.text()) as Record<string, unknown>;
                if (!snapRes.ok) throw new Error(JSON.stringify(snap));
                if (!valRes.ok) throw new Error(JSON.stringify(val));

                const elements = snap.elements as
                  | Record<string, Record<string, unknown>>
                  | undefined;
                const counts: Record<string, number> = {};
                if (elements) {
                  for (const row of Object.values(elements)) {
                    const k = typeof row.kind === 'string' ? row.kind : '?';
                    counts[k] = (counts[k] ?? 0) + 1;
                  }
                }
                const bundled = {
                  assumptions: assumptionsJson,
                  generatedAt: new Date().toISOString(),
                  modelId,
                  revision: snap.revision,
                  elementCount: elements ? Object.keys(elements).length : 0,
                  countsByKind: counts,
                  validate: val,
                };
                setEvidenceTxt(JSON.stringify(bundled, null, 2));
              } catch (e) {
                setEvidenceTxt(e instanceof Error ? e.message : String(e));
              }
            })()
          }
        >
          Fetch browser evidence bundle (snapshot + validate)
        </Btn>

        <Btn
          type="button"
          variant="quiet"
          className="text-[11px]"
          disabled={!modelId}
          title={!modelId ? 'Bootstrap a model first' : undefined}
          onClick={() =>
            void (async () => {
              if (!modelId) return;
              try {
                const res = await fetch(
                  `/api/models/${encodeURIComponent(modelId)}/evidence-package`,
                );
                const body = JSON.parse(await res.text()) as unknown;
                if (!res.ok) throw new Error(String(body));
                setEvidenceTxt(
                  JSON.stringify({ assumptions: assumptionsJson, payload: body }, null, 2),
                );
              } catch (e) {
                setEvidenceTxt(e instanceof Error ? e.message : String(e));
              }
            })()
          }
        >
          Fetch evidence-package JSON
        </Btn>
      </div>

      {stepLog.length ? (
        <div>
          <div className="mb-1 text-[10px] font-semibold text-muted">Run trace</div>
          <pre className="max-h-32 overflow-auto rounded border bg-background p-2 text-[10px]">
            {stepLog.join('\n')}
          </pre>
        </div>
      ) : null}

      {dryRunBriefProtocol !== null || evidenceBriefProtocol !== null ? (
        <div
          data-testid="agent-brief-command-protocol"
          className="rounded border border-border bg-background/40 p-2"
        >
          <div className="text-[10px] font-semibold text-muted">Brief → command protocol</div>
          <p className="mt-1 text-[10px] text-muted">
            Deterministic readout from model state + validation violations + optional command preview
            (evidence-package uses an empty proposed-command list; dry-run uses your bundle).
          </p>
          {evidenceBriefProtocol !== null ? (
            <div className="mt-2">
              <div className="text-[10px] font-medium text-muted">
                Evidence-package snapshot (proposedCommandCount from server digest)
              </div>
              <pre className="mt-1 max-h-40 overflow-auto rounded border border-border/60 bg-background p-2 font-mono text-[10px]">
                {formatAgentBriefCommandProtocolReadout(evidenceBriefProtocol).join('\n')}
              </pre>
            </div>
          ) : null}
          {dryRunBriefProtocol !== null ? (
            <div className="mt-2">
              <div className="text-[10px] font-medium text-muted">Last bundle dry-run preview</div>
              <pre className="mt-1 max-h-40 overflow-auto rounded border border-border/60 bg-background p-2 font-mono text-[10px]">
                {formatAgentBriefCommandProtocolReadout(dryRunBriefProtocol).join('\n')}
              </pre>
            </div>
          ) : null}
        </div>
      ) : null}

      {evidenceQaChecklist !== null || dryRunQaChecklist !== null ? (
        <div
          data-testid="agent-generated-bundle-qa-checklist"
          className="rounded border border-border bg-background/40 p-2"
        >
          <div className="text-[10px] font-semibold text-muted">Generated bundle QA checklist</div>
          <p className="mt-2 text-[11px] font-medium text-foreground">
            Deterministic QA summary only. It does not auto-execute commands on the model, does not
            apply remediation, and does not replace human review.
          </p>
          <p className="mt-1 text-[10px] text-muted">
            Row order is stable and matches the evidence-package / dry-run payloads. Use Fetch
            evidence-package JSON for full coverage rows; bundle dry-run narrows command + validation
            preview.
          </p>
          {evidenceQaChecklist !== null ? (
            <div className="mt-2">
              <div className="text-[10px] font-medium text-muted">
                Evidence-package checklist (agentGeneratedBundleQaChecklist_v1)
              </div>
              <pre className="mt-1 max-h-48 overflow-auto rounded border border-border/60 bg-background p-2 font-mono text-[10px] leading-snug">
                {formatAgentGeneratedBundleQaChecklistReadout(evidenceQaChecklist).join('\n')}
              </pre>
            </div>
          ) : null}
          {dryRunQaChecklist !== null ? (
            <div className="mt-2">
              <div className="text-[10px] font-medium text-muted">
                Last dry-run checklist (agentGeneratedBundleQaChecklist_v1)
              </div>
              <pre className="mt-1 max-h-48 overflow-auto rounded border border-border/60 bg-background p-2 font-mono text-[10px] leading-snug">
                {formatAgentGeneratedBundleQaChecklistReadout(dryRunQaChecklist).join('\n')}
              </pre>
            </div>
          ) : null}
        </div>
      ) : null}

      {evidenceAcceptanceReadout !== null || dryRunAcceptanceReadout !== null ? (
        <div
          data-testid="agent-brief-acceptance-readout"
          className="rounded border border-border bg-background/40 p-2"
        >
          <div className="text-[10px] font-semibold text-muted">Brief acceptance gates</div>
          <p className="mt-1 text-[10px] text-muted">
            Deterministic closure readout (<code className="text-[9px]">agentBriefAcceptanceReadout_v1</code>) from
            evidence-package and bundle dry-run payloads. Line preview:
          </p>
          <div className="mt-2 grid gap-2 md:grid-cols-2">
            <pre className="max-h-32 overflow-auto rounded border border-border/60 bg-background p-2 font-mono text-[9px]">
              {formatAgentBriefAcceptanceReadoutLines(evidenceAcceptanceReadout).join('\n')}
            </pre>
            <pre className="max-h-32 overflow-auto rounded border border-border/60 bg-background p-2 font-mono text-[9px]">
              {formatAgentBriefAcceptanceReadoutLines(dryRunAcceptanceReadout).join('\n')}
            </pre>
          </div>
          <AgentBriefAcceptanceReadoutV1Table
            title="Evidence-package readout (preferred for artifact expectations)"
            readout={evidenceAcceptanceReadout}
          />
          <AgentBriefAcceptanceReadoutV1Table title="Last bundle dry-run readout" readout={dryRunAcceptanceReadout} />
        </div>
      ) : null}

      {evidenceConsistencyClosure !== null || dryRunConsistencyClosure !== null ? (
        <div
          data-testid="agent-review-readout-consistency-closure"
          className="rounded border border-border bg-background/40 p-2"
        >
          <div className="text-[10px] font-semibold text-muted">
            Agent Review readout consistency closure (agentReviewReadoutConsistencyClosure_v1)
          </div>
          <p className="mt-1 text-[10px] text-muted">
            Cross-checks field presence, bundle id, and evidence digest drift across the five Agent
            Review readouts. Rows are{' '}
            <code className="text-[9px]">aligned</code>,{' '}
            <code className="text-[9px]">missing_fields</code>,{' '}
            <code className="text-[9px]">bundle_id_drift</code>, or{' '}
            <code className="text-[9px]">digest_drift</code>.
          </p>
          <div className="mt-2 grid gap-2 md:grid-cols-2">
            <div>
              <div className="text-[10px] font-medium text-muted">
                Evidence-package snapshot
              </div>
              <pre className="mt-1 max-h-40 overflow-auto rounded border border-border/60 bg-background p-2 font-mono text-[10px] leading-snug">
                {formatAgentReviewReadoutConsistencyClosureLines(evidenceConsistencyClosure).join('\n')}
              </pre>
            </div>
            <div>
              <div className="text-[10px] font-medium text-muted">
                Last bundle dry-run
              </div>
              <pre className="mt-1 max-h-40 overflow-auto rounded border border-border/60 bg-background p-2 font-mono text-[10px] leading-snug">
                {formatAgentReviewReadoutConsistencyClosureLines(dryRunConsistencyClosure).join('\n')}
              </pre>
            </div>
          </div>
          {(evidenceConsistencyClosure?.advisoryFindings.length ?? 0) > 0 ? (
            <div className="mt-2 rounded border border-amber-500/35 bg-amber-500/5 p-2">
              <div className="text-[10px] font-semibold text-amber-800 dark:text-amber-400">
                Consistency advisories ({evidenceConsistencyClosure!.advisoryFindings.length})
              </div>
              <ul className="mt-1 list-disc space-y-0.5 ps-4 text-[10px] text-muted">
                {evidenceConsistencyClosure!.advisoryFindings.map((f, i) => (
                  <li key={i}>
                    <code className="font-mono text-[9px]">[{f.severity}] {f.ruleId}</code>
                    {' '}({f.readoutId}){': '}{f.message}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}

      {dryRunTxt ? (
        <div>
          <div className="mb-1 text-[10px] font-semibold text-muted">Bundle dry-run</div>
          <pre className="max-h-48 overflow-auto rounded border bg-background p-2 text-[10px]">
            {dryRunTxt}
          </pre>
        </div>
      ) : null}

      {schemaTxt ? (
        <div>
          <div className="mb-1 text-[10px] font-semibold text-muted">Schema</div>
          <pre className="max-h-48 overflow-auto rounded border bg-background p-2 text-[10px]">
            {schemaTxt}
          </pre>
        </div>
      ) : null}

      {evidenceArtifactSummary.sheetRows.length ||
      evidenceArtifactSummary.view3dRows.length ||
      evidenceArtifactSummary.planViewRows.length ||
      evidenceArtifactSummary.sectionCutRows.length ||
      evidenceArtifactSummary.semanticDigestPrefix16 ||
      evidenceArtifactSummary.closureHints ||
      evidenceArtifactSummary.closureReview ||
      evidenceArtifactSummary.lifecycleSignal ||
      evidenceArtifactSummary.diffFixLoop?.needsFixLoop ||
      evidenceArtifactSummary.performanceGate ||
      evidenceArtifactSummary.baselineLifecycleReadout ||
      evidenceArtifactSummary.prdCloseoutCrossCorrelation ||
      evidenceArtifactSummary.evidenceFreshness ||
      evidenceArtifactSummary.reviewActions.length ? (
        <div className="rounded border border-border bg-background/40 p-2">
          <div className="text-[10px] font-semibold text-muted">Evidence artifact correlation</div>
          <ul className="mt-1 list-disc space-y-1 ps-4 text-[10px] text-muted">
            {evidenceArtifactSummary.semanticDigestPrefix16 ? (
              <li>
                semanticDigestPrefix16:{' '}
                <code className="text-[10px]">
                  {evidenceArtifactSummary.semanticDigestPrefix16}
                </code>
              </li>
            ) : null}
            {evidenceArtifactSummary.semanticDigestSha256Tail ? (
              <li>
                semanticDigest tail:{' '}
                <code className="text-[10px]">
                  {evidenceArtifactSummary.semanticDigestSha256Tail}
                </code>
              </li>
            ) : null}
            {evidenceArtifactSummary.semanticDigestSha256Full &&
            evidenceArtifactSummary.semanticDigestSha256Full.length >= 24 ? (
              <li>
                semanticDigestSha256 (verify row correlation matches):{' '}
                <code className="text-[10px]">
                  {evidenceArtifactSummary.semanticDigestSha256Full.slice(0, 12)}…
                  {evidenceArtifactSummary.semanticDigestSha256Full.slice(-12)}
                </code>
              </li>
            ) : null}
            {evidenceArtifactSummary.suggestedBasenameHint ? (
              <li>
                suggested basename:{' '}
                <code className="text-[10px]">{evidenceArtifactSummary.suggestedBasenameHint}</code>
              </li>
            ) : null}
            {evidenceArtifactSummary.modelRevision !== null ? (
              <li>package modelRevision: {evidenceArtifactSummary.modelRevision}</li>
            ) : null}
          </ul>
          {evidenceArtifactSummary.closureReview ? (
            <div className="mt-2 rounded border border-border/60 bg-background/30 p-2">
              <div className="text-[10px] font-semibold text-muted">Evidence closure inventory</div>
              <p className="mt-1 text-[10px] text-muted">
                Primary deterministic PNG artifacts expected:{' '}
                <strong>{evidenceArtifactSummary.closureReview.primaryCount}</strong>
              </p>
              {evidenceArtifactSummary.closureReview.basenames.length ? (
                <ul className="mt-1 list-disc space-y-0.5 ps-4 font-mono text-[10px] text-muted">
                  {evidenceArtifactSummary.closureReview.basenames.slice(0, 8).map((bn) => (
                    <li key={bn}>{bn}</li>
                  ))}
                  {evidenceArtifactSummary.closureReview.basenames.length > 8 ? (
                    <li className="text-muted">
                      … +{evidenceArtifactSummary.closureReview.basenames.length - 8} more (see{' '}
                      <code className="text-[10px]">expectedDeterministicPngBasenames</code>)
                    </li>
                  ) : null}
                </ul>
              ) : (
                <p className="mt-1 text-[10px] text-muted">
                  No deterministic PNG basenames listed.
                </p>
              )}
              <p className="mt-2 text-[10px]">
                {evidenceArtifactSummary.closureReview.correlationFullyConsistent === true ? (
                  <span className="text-emerald-600 dark:text-emerald-400">
                    Row correlation digests match package semanticDigestSha256.
                  </span>
                ) : evidenceArtifactSummary.closureReview.correlationFullyConsistent === false ? (
                  <span className="text-amber-600 dark:text-amber-400">
                    Stale or incomplete deterministic rows:{' '}
                    {evidenceArtifactSummary.closureReview.staleRowCount} stale digest(s),{' '}
                    {evidenceArtifactSummary.closureReview.missingDigestRowCount} missing
                    correlation digest(s).
                  </span>
                ) : (
                  <span className="text-muted">Correlation consistency unknown.</span>
                )}
              </p>
              <p className="mt-1 text-[10px] text-muted">
                Pixel diff pipeline:{' '}
                <code className="text-[10px]">
                  {evidenceArtifactSummary.closureReview.pixelDiffStatus ?? '—'}
                </code>
                {evidenceArtifactSummary.closureReview.pixelDiffSuffix ? (
                  <>
                    {' '}
                    · optional diff suffix{' '}
                    <code className="text-[10px]">
                      {evidenceArtifactSummary.closureReview.pixelDiffSuffix}
                    </code>
                  </>
                ) : null}
              </p>
              {evidenceArtifactSummary.closureReview.pixelDiffThresholdEnforcement ||
              evidenceArtifactSummary.closureReview.pixelMismatchRatioFailAbove !== null ? (
                <p className="mt-1 text-[10px] text-muted">
                  Threshold policy (
                  <code className="text-[10px]">pixelDiffExpectation.thresholdPolicy_v1</code>
                  ): {evidenceArtifactSummary.closureReview.pixelDiffThresholdEnforcement ?? '—'}
                  {evidenceArtifactSummary.closureReview.pixelMismatchRatioFailAbove !== null ? (
                    <>
                      {' '}
                      · mismatchPixelRatioFailAbove{' '}
                      <code className="font-mono text-[10px]">
                        {String(evidenceArtifactSummary.closureReview.pixelMismatchRatioFailAbove)}
                      </code>
                    </>
                  ) : null}
                </p>
              ) : null}
              {evidenceArtifactSummary.closureReview.artifactIngestDigestSha256Full ? (
                <div
                  data-testid="artifact-ingest-correlation-callout"
                  className="mt-2 rounded border border-border/40 bg-muted/10 p-2"
                >
                  <div className="text-[10px] font-semibold text-muted">
                    Artifact ingest correlation (
                    <code className="text-[10px]">artifactIngestCorrelation_v1</code>)
                  </div>
                  <p className="mt-1 text-[10px] text-muted">
                    ingestManifestDigestSha256:{' '}
                    <code className="font-mono text-[10px]">
                      {evidenceArtifactSummary.closureReview.artifactIngestDigestSha256Full.slice(
                        0,
                        12,
                      )}
                      …{evidenceArtifactSummary.closureReview.artifactIngestDigestSha256Tail}
                    </code>
                  </p>
                  {evidenceArtifactSummary.closureReview.artifactIngestCanonicalPairCount !==
                  null ? (
                    <p className="mt-0.5 text-[10px] text-muted">
                      canonicalPairCount:{' '}
                      <code className="font-mono text-[10px]">
                        {String(
                          evidenceArtifactSummary.closureReview.artifactIngestCanonicalPairCount,
                        )}
                      </code>
                    </p>
                  ) : null}
                  {evidenceArtifactSummary.closureReview.artifactIngestScreenshotsRootHint ? (
                    <p className="mt-0.5 text-[10px] text-muted">
                      Playwright screenshots root hint:{' '}
                      <code className="text-[9px]">
                        {evidenceArtifactSummary.closureReview.artifactIngestScreenshotsRootHint}
                      </code>
                    </p>
                  ) : null}
                </div>
              ) : null}
              {evidenceArtifactSummary.closureReview.serverPngByteIngestComparisonResult !== null ||
              evidenceArtifactSummary.closureReview.serverPngByteIngestCanonicalDigestFull !==
                null ? (
                <div
                  data-testid="server-png-byte-ingest-callout"
                  className="mt-2 rounded border border-border/40 bg-muted/10 p-2"
                >
                  <div className="text-[10px] font-semibold text-muted">
                    Server PNG byte ingest (
                    <code className="text-[10px]">serverPngByteIngest_v1</code>)
                  </div>
                  <p className="mt-1 text-[10px] text-muted">
                    comparison.result:{' '}
                    <code className="font-mono text-[10px]">
                      {evidenceArtifactSummary.closureReview.serverPngByteIngestComparisonResult ??
                        '—'}
                    </code>
                  </p>
                  {evidenceArtifactSummary.closureReview.serverPngByteIngestWidth !== null &&
                  evidenceArtifactSummary.closureReview.serverPngByteIngestHeight !== null ? (
                    <p className="mt-0.5 text-[10px] text-muted">
                      dimensions:{' '}
                      <code className="font-mono text-[10px]">
                        {evidenceArtifactSummary.closureReview.serverPngByteIngestWidth}×
                        {evidenceArtifactSummary.closureReview.serverPngByteIngestHeight}
                      </code>
                      {evidenceArtifactSummary.closureReview.serverPngByteIngestByteLength !==
                      null ? (
                        <>
                          {' '}
                          · bytes{' '}
                          <code className="font-mono text-[10px]">
                            {String(
                              evidenceArtifactSummary.closureReview.serverPngByteIngestByteLength,
                            )}
                          </code>
                        </>
                      ) : null}
                    </p>
                  ) : null}
                  {evidenceArtifactSummary.closureReview.serverPngByteIngestCanonicalDigestFull ? (
                    <p className="mt-0.5 text-[10px] text-muted">
                      canonicalDigestSha256 (
                      <code className="text-[10px]">png_file_sha256</code>):{' '}
                      <code className="font-mono text-[10px]">
                        {evidenceArtifactSummary.closureReview.serverPngByteIngestCanonicalDigestFull.slice(
                          0,
                          12,
                        )}
                        …
                        {evidenceArtifactSummary.closureReview.serverPngByteIngestCanonicalDigestTail}
                      </code>
                    </p>
                  ) : null}
                  {evidenceArtifactSummary.closureReview.serverPngByteIngestSkippedReason ? (
                    <p className="mt-0.5 text-[10px] text-muted">
                      skippedReason:{' '}
                      <code className="text-[9px]">
                        {evidenceArtifactSummary.closureReview.serverPngByteIngestSkippedReason}
                      </code>
                    </p>
                  ) : null}
                  {evidenceArtifactSummary.closureReview.serverPngByteIngestLinkedBasename ? (
                    <p className="mt-0.5 text-[10px] text-muted">
                      checklist link (first baseline basename):{' '}
                      <code className="font-mono text-[10px]">
                        {evidenceArtifactSummary.closureReview.serverPngByteIngestLinkedBasename}
                      </code>
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}
          {evidenceArtifactSummary.lifecycleSignal ? (
            <div className="mt-2 rounded border border-border/60 bg-background/30 p-2">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="text-[10px] font-semibold text-muted">
                  Programmatic signal (evidenceLifecycleSignal_v1)
                </div>
                <Btn
                  type="button"
                  variant="quiet"
                  className="shrink-0 text-[10px]"
                  onClick={() => {
                    const body = JSON.stringify(evidenceArtifactSummary.lifecycleSignal, null, 2);
                    void navigator.clipboard.writeText(body).then(
                      () => pushStep('Copied evidenceLifecycleSignal_v1 JSON'),
                      () => pushStep('Clipboard write failed'),
                    );
                  }}
                >
                  Copy JSON
                </Btn>
              </div>
              <ul className="mt-1 list-disc space-y-0.5 ps-4 text-[10px] text-muted">
                <li>
                  expectedDeterministicPngCount:{' '}
                  <code className="font-mono">
                    {String(
                      evidenceArtifactSummary.lifecycleSignal.expectedDeterministicPngCount ?? '—',
                    )}
                  </code>
                </li>
                <li>
                  screenshotHintGapRowCount:{' '}
                  <code className="font-mono">
                    {String(
                      evidenceArtifactSummary.lifecycleSignal.screenshotHintGapRowCount ?? '—',
                    )}
                  </code>
                </li>
                <li>
                  pixelDiffIngestTargetCount:{' '}
                  <code className="font-mono">
                    {String(
                      evidenceArtifactSummary.lifecycleSignal.pixelDiffIngestTargetCount ?? '—',
                    )}
                  </code>
                </li>
                <li>
                  correlationFullyConsistent:{' '}
                  <code className="font-mono">
                    {String(
                      evidenceArtifactSummary.lifecycleSignal.correlationFullyConsistent ?? '—',
                    )}
                  </code>
                </li>
                {typeof evidenceArtifactSummary.lifecycleSignal
                  .artifactIngestManifestDigestSha256 === 'string' ? (
                  <li data-testid="lifecycle-artifact-ingest-digest-row">
                    artifactIngestManifestDigestSha256:{' '}
                    <code className="font-mono">
                      {String(
                        evidenceArtifactSummary.lifecycleSignal.artifactIngestManifestDigestSha256,
                      ).length >= 24
                        ? `${String(evidenceArtifactSummary.lifecycleSignal.artifactIngestManifestDigestSha256).slice(0, 12)}…${String(evidenceArtifactSummary.lifecycleSignal.artifactIngestManifestDigestSha256).slice(-12)}`
                        : String(
                            evidenceArtifactSummary.lifecycleSignal
                              .artifactIngestManifestDigestSha256,
                          )}
                    </code>
                  </li>
                ) : null}
              </ul>
            </div>
          ) : null}
          {evidenceArtifactSummary.performanceGate ? (
            <div
              data-testid="evidence-review-performance-gate"
              className={`mt-2 rounded border p-2 text-[10px] ${
                evidenceArtifactSummary.performanceGate.gateClosed
                  ? 'border-emerald-500/35 bg-emerald-500/5'
                  : 'border-amber-500/35 bg-amber-500/5'
              }`}
            >
              <div className="font-semibold text-muted">
                Evidence review performance gate (
                <code className="text-[9px]">evidenceReviewPerformanceGate_v1</code>)
              </div>
              <p className="mt-1 text-muted">
                gateClosed:{' '}
                <code className="font-mono text-[9px]">
                  {String(evidenceArtifactSummary.performanceGate.gateClosed)}
                </code>
                {evidenceArtifactSummary.performanceGate.probeKind ? (
                  <>
                    {' '}
                    · probeKind{' '}
                    <code className="font-mono text-[9px]">
                      {evidenceArtifactSummary.performanceGate.probeKind}
                    </code>
                  </>
                ) : null}
                {evidenceArtifactSummary.performanceGate.enforcement ? (
                  <>
                    {' '}
                    ·{' '}
                    <code className="font-mono text-[9px]">
                      {evidenceArtifactSummary.performanceGate.enforcement}
                    </code>
                  </>
                ) : null}
              </p>
              <p className="mt-1 text-muted">
                blockerCodesEcho:{' '}
                <code className="text-[9px]">
                  {evidenceArtifactSummary.performanceGate.blockerCodesEcho.join(', ') || '—'}
                </code>
              </p>
              <p className="mt-0.5 text-[9px] text-muted">
                Advisory mock gate (no wall-clock probe); echoes fix-loop blockers only.
              </p>
            </div>
          ) : null}
          {evidenceArtifactSummary.baselineLifecycleReadout ? (
            <EvidenceBaselineLifecycleReadoutV1Table
              readout={evidenceArtifactSummary.baselineLifecycleReadout}
            />
          ) : null}
          {evidenceArtifactSummary.prdCloseoutCrossCorrelation ? (
            <div
              className="mt-2 rounded border border-border/60 bg-background/30 p-2"
              data-testid="prd-closeout-cross-correlation-readout"
            >
              <div className="text-[10px] font-semibold text-muted">
                PRD closeout cross-correlation (prdCloseoutCrossCorrelationManifest_v1)
              </div>
              <ul className="mt-1 list-disc space-y-0.5 ps-4 text-[10px] text-muted">
                {formatPrdCloseoutCrossCorrelationReadoutLines(
                  evidenceArtifactSummary.prdCloseoutCrossCorrelation,
                ).map((ln, idx) => (
                  <li key={`prd-cc-${idx}`}>
                    <code className="whitespace-pre-wrap break-all font-mono text-[9px]">{ln}</code>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {evidenceArtifactSummary.evidenceFreshness ? (
            <div
              className="mt-2 rounded border border-border/60 bg-background/30 p-2"
              data-testid="agent-review-evidence-freshness"
            >
              <div className="text-[10px] font-semibold text-muted">
                Evidence freshness (ingestEvidenceArtifactManifest_v1)
              </div>
              <ul className="mt-1 list-disc space-y-0.5 ps-4 text-[10px] text-muted">
                <li>
                  fresh:{' '}
                  <strong data-testid="freshness-fresh-count">
                    {evidenceArtifactSummary.evidenceFreshness.freshCount}
                  </strong>
                  {' / '}stale:{' '}
                  <strong data-testid="freshness-stale-count">
                    {evidenceArtifactSummary.evidenceFreshness.staleCount}
                  </strong>
                  {' / '}missing:{' '}
                  <strong data-testid="freshness-missing-count">
                    {evidenceArtifactSummary.evidenceFreshness.missingCount}
                  </strong>
                  {' '}(total:{' '}
                  <strong>{evidenceArtifactSummary.evidenceFreshness.totalCount}</strong>)
                </li>
              </ul>
              {evidenceArtifactSummary.regenerationGuidance &&
              evidenceArtifactSummary.regenerationGuidance.length > 0 ? (
                <div className="mt-2">
                  <div className="text-[10px] font-semibold text-muted">
                    Regeneration guidance (agentRegenerationGuidance_v1)
                  </div>
                  <ul
                    className="mt-1 list-disc space-y-1 ps-4 text-[10px] text-muted"
                    data-testid="regeneration-guidance-checklist"
                  >
                    {evidenceArtifactSummary.regenerationGuidance.map((action, idx) => (
                      <li key={`regen-${idx}`}>
                        <span
                          className={
                            action.priority === 'high'
                              ? 'font-semibold text-red-600 dark:text-red-400'
                              : action.priority === 'medium'
                                ? 'font-semibold text-amber-600 dark:text-amber-400'
                                : 'text-muted'
                          }
                        >
                          [{action.priority}]
                        </span>{' '}
                        <code className="font-mono text-[9px]">{action.artifactKey}</code>
                        {' — '}{action.reason}
                        <div className="mt-0.5">
                          <code className="whitespace-pre-wrap break-all font-mono text-[9px] text-muted">
                            $ {action.suggestedCommand}
                          </code>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : null}
          {evidenceArtifactSummary.diffFixLoop?.needsFixLoop ? (
            <div
              data-testid="evidence-diff-fix-loop-callout"
              className="mt-2 rounded border border-amber-500/35 bg-amber-500/5 p-2"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="text-[10px] font-semibold text-amber-800 dark:text-amber-400">
                  Evidence diff / screenshot fix loop (evidenceDiffIngestFixLoop_v1)
                </div>
                <Btn
                  type="button"
                  variant="quiet"
                  className="shrink-0 text-[10px]"
                  onClick={() => {
                    const body = JSON.stringify(
                      {
                        format: 'evidence_diff_ingest_fix_loop_v1',
                        needsFixLoop: true,
                        blockerCodes: evidenceArtifactSummary.diffFixLoop?.blockerCodes ?? [],
                      },
                      null,
                      2,
                    );
                    void navigator.clipboard.writeText(body).then(
                      () => pushStep('Copied evidenceDiffIngestFixLoop_v1 summary JSON'),
                      () => pushStep('Clipboard write failed'),
                    );
                  }}
                >
                  Copy JSON
                </Btn>
              </div>
              <p className="mt-1 text-[10px] text-muted">
                Blockers:{' '}
                <code className="text-[9px]">
                  {(evidenceArtifactSummary.diffFixLoop?.blockerCodes ?? []).join(', ') || '—'}
                </code>
              </p>
              <p className="mt-1 text-[10px] text-muted">
                Use <code className="text-[9px]">remediateEvidenceDiffIngest</code> in{' '}
                <code className="text-[9px]">agentReviewActions_v1</code> (pinned first when
                present).
              </p>
            </div>
          ) : null}
          {evidenceArtifactSummary.artifactUploadManifestReadout?.length ? (
            <div
              className="mt-2 rounded border border-border/60 bg-background/30 p-2"
              data-testid="artifact-upload-manifest-readout"
            >
              <div className="text-[10px] font-semibold text-muted">
                Artifact upload manifest (artifactUploadManifest_v1)
              </div>
              <ul className="mt-1 list-disc space-y-0.5 ps-4 text-[10px] text-muted">
                {evidenceArtifactSummary.artifactUploadManifestReadout.map((ln, idx) => (
                  <li key={`aum-${idx}`}>
                    <code className="whitespace-pre-wrap break-all font-mono text-[9px]">{ln}</code>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {evidenceArtifactSummary.agentFollowThrough ? (
            <div className="mt-2 rounded border border-border/60 bg-background/30 p-2">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="text-[10px] font-semibold text-muted">
                  Agent follow-through (evidenceAgentFollowThrough_v1)
                </div>
                <Btn
                  type="button"
                  variant="quiet"
                  className="shrink-0 text-[10px]"
                  onClick={() => {
                    const body = JSON.stringify(
                      evidenceArtifactSummary.agentFollowThrough,
                      null,
                      2,
                    );
                    void navigator.clipboard.writeText(body).then(
                      () => pushStep('Copied evidenceAgentFollowThrough_v1 JSON'),
                      () => pushStep('Clipboard write failed'),
                    );
                  }}
                >
                  Copy JSON
                </Btn>
              </div>
              {(() => {
                const ft = evidenceArtifactSummary.agentFollowThrough ?? {};
                const sal = ft.stagedArtifactLinks_v1 as Record<string, unknown> | undefined;
                const stagedFormat = typeof sal?.format === 'string' ? sal.format : null;
                const chk = ft.bcfIssueCoordinationCheck_v1 as Record<string, unknown> | undefined;
                const res = ft.evidenceRefResolution_v1 as Record<string, unknown> | undefined;
                const collab = ft.collaborationReplayConflictHints_v1 as
                  | Record<string, unknown>
                  | undefined;
                const unres =
                  typeof res?.unresolvedCount === 'number' && Number.isFinite(res.unresolvedCount)
                    ? res.unresolvedCount
                    : null;
                const roundtripRaw = ft.bcfRoundtripEvidenceSummary_v1 as Record<
                  string,
                  unknown
                > | undefined;
                const roundtripFmt = summarizeBcfRoundtripEvidenceSummary(
                  roundtripRaw as BcfRoundtripEvidenceSummaryWire,
                );
                const issuePkgRaw = ft.bcfIssuePackageExport_v1 as
                  | Record<string, unknown>
                  | undefined;
                const issuePkgFmt = summarizeBcfIssuePackageExport(
                  issuePkgRaw as BcfIssuePackageExportWire,
                );
                const ifcClosureRaw = ft.ifcExchangeManifestClosure_v0 as
                  | IfcExchangeManifestClosureWire
                  | undefined;
                const ifcClosureLines = formatIfcExchangeManifestClosureLines(ifcClosureRaw);
                const bcfOk =
                  typeof chk?.bcfIndexedTopicCountMatchesDocument === 'boolean'
                    ? chk.bcfIndexedTopicCountMatchesDocument
                    : null;
                const docBcf =
                  typeof chk?.documentBcfTopicCount === 'number' ? chk.documentBcfTopicCount : null;
                const idxBcf =
                  typeof chk?.indexedBcfTopicCount === 'number' ? chk.indexedBcfTopicCount : null;
                return (
                  <ul className="mt-1 list-disc space-y-0.5 ps-4 text-[10px] text-muted">
                    {stagedFormat ? (
                      <li>
                        Staged artifact links: <code className="font-mono">{stagedFormat}</code>
                        {' · '}resolution{' '}
                        <code className="font-mono">
                          {formatStagedArtifactResolutionMode(sal?.resolutionMode)}
                        </code>
                        {' · '}side effects{' '}
                        <code className="font-mono">
                          {typeof sal?.sideEffectsEnabled === 'boolean'
                            ? String(sal.sideEffectsEnabled)
                            : '—'}
                        </code>
                      </li>
                    ) : null}
                    {bcfOk !== null ? (
                      <li>
                        BCF index vs document: <code className="font-mono">{String(bcfOk)}</code>
                        {docBcf !== null && idxBcf !== null ? (
                          <>
                            {' '}
                            (doc {docBcf} · indexed {idxBcf})
                          </>
                        ) : null}
                      </li>
                    ) : null}
                    {unres !== null ? (
                      <li>
                        Unresolved BCF/issue evidenceRefs:{' '}
                        <code className="font-mono">{unres}</code>
                      </li>
                    ) : null}
                    {roundtripRaw?.format === 'bcfRoundtripEvidenceSummary_v1' ? (
                      <>
                        <li>
                          BCF round-trip summary: BCF topics{' '}
                          <code className="font-mono">
                            {roundtripFmt.bcfTopicCount ?? '—'}
                          </code>
                          {' · '}viewpoint/PNG refs{' '}
                          <code className="font-mono">
                            {roundtripFmt.viewpointAndScreenshotRefCount ?? '—'}
                          </code>
                          {' · '}model element refs{' '}
                          <code className="font-mono">
                            {roundtripFmt.modelElementReferenceCount ?? '—'}
                          </code>
                          {' · '}unresolved (refs + anchors){' '}
                          <code className="font-mono">
                            {roundtripFmt.unresolvedReferenceCount ?? '—'}
                          </code>
                        </li>
                        {roundtripFmt.violationRuleLinkLines.length ? (
                          <li className="space-y-0.5">
                            <span>Violations linked to topic elements:</span>
                            <ul className="list-disc space-y-0.5 ps-4">
                              {roundtripFmt.violationRuleLinkLines.map((ln) => (
                                <li key={ln}>
                                  <code className="text-[9px] font-mono">{ln}</code>
                                </li>
                              ))}
                            </ul>
                          </li>
                        ) : null}
                      </>
                    ) : null}
                    {issuePkgRaw?.format === 'bcfIssuePackageExport_v1' &&
                    issuePkgFmt.lines.length ? (
                      <li
                        className="space-y-0.5"
                        data-testid="bcf-issue-package-export-readout"
                      >
                        <span>BCF issue package export:</span>
                        <ul className="list-disc space-y-0.5 ps-4">
                          {issuePkgFmt.lines.map((ln) => (
                            <li key={ln}>
                              <code className="text-[9px] font-mono">{ln}</code>
                            </li>
                          ))}
                          {issuePkgFmt.violationTopicLines.length ? (
                            <li className="space-y-0.5">
                              <span>Violations by topic:</span>
                              <ul className="list-disc space-y-0.5 ps-4">
                                {issuePkgFmt.violationTopicLines.map((ln) => (
                                  <li key={ln}>
                                    <code className="text-[9px] font-mono">{ln}</code>
                                  </li>
                                ))}
                              </ul>
                            </li>
                          ) : null}
                        </ul>
                      </li>
                    ) : null}
                    {ifcClosureLines.length ? (
                      <li className="space-y-0.5" data-testid="ifc-exchange-manifest-closure-readout">
                        <span>IFC exchange manifest closure:</span>
                        <ul className="list-disc space-y-0.5 ps-4">
                          {ifcClosureLines.map((ln) => (
                            <li key={ln}>
                              <code className="text-[9px] font-mono">{ln}</code>
                            </li>
                          ))}
                        </ul>
                      </li>
                    ) : null}
                    {collab && typeof collab.constraintRejectedHttpStatus === 'number' ? (
                      <li className="space-y-0.5">
                        <span>
                          Collaboration bundle conflicts: HTTP{' '}
                          <code className="font-mono">{collab.constraintRejectedHttpStatus}</code>
                          {Array.isArray(collab.typicalErrorBodyFields) ? (
                            <>
                              {' '}
                              · fields{' '}
                              <code className="text-[9px]">
                                {(collab.typicalErrorBodyFields as unknown[])
                                  .filter((x): x is string => typeof x === 'string')
                                  .join(', ')}
                              </code>
                            </>
                          ) : null}
                        </span>
                        <div className="mt-0.5 text-[9px] text-muted/90">
                          Conflict queue inspection (live readout also appears in the Workspace header on
                          409):
                        </div>
                        <ul className="list-disc space-y-0.5 ps-4">
                          {collaborationConflictQueueInspectionLinesFromHints().map((ln) => (
                            <li key={ln}>{ln}</li>
                          ))}
                        </ul>
                      </li>
                    ) : null}
                  </ul>
                );
              })()}
            </div>
          ) : null}
          {evidenceArtifactSummary.screenshotSlotGaps &&
          evidenceArtifactSummary.screenshotSlotGaps.items.length ? (
            <div className="mt-2 rounded border border-amber-500/30 bg-background/30 p-2">
              <div className="text-[10px] font-semibold text-amber-700 dark:text-amber-400">
                Screenshot filename gaps ({evidenceArtifactSummary.screenshotSlotGaps.gapRowCount}{' '}
                row(s))
              </div>
              <ul className="mt-1 space-y-1 ps-3 text-[10px] text-muted">
                {evidenceArtifactSummary.screenshotSlotGaps.items.slice(0, 6).map((g) => (
                  <li key={`${g.deterministicRowKind}:${g.rowId}`}>
                    <span className="font-mono">{g.deterministicRowKind}</span> ·{' '}
                    <span className="font-mono">{g.rowId}</span>
                    {g.missingPlaywrightFilenameSlots.length ? (
                      <>
                        {' '}
                        — missing{' '}
                        <code className="text-[9px]">
                          {g.missingPlaywrightFilenameSlots.join(', ')}
                        </code>
                      </>
                    ) : null}
                  </li>
                ))}
              </ul>
              {evidenceArtifactSummary.screenshotSlotGaps.items.length > 6 ? (
                <p className="mt-1 text-[9px] text-muted">
                  … +{evidenceArtifactSummary.screenshotSlotGaps.items.length - 6} more in{' '}
                  <code className="text-[9px]">evidenceClosureReview_v1.screenshotHintGaps_v1</code>
                </p>
              ) : null}
            </div>
          ) : null}
          {evidenceArtifactSummary.reviewActions.length ? (
            <div className="mt-3 rounded border border-border/60 bg-background/30 p-2">
              <div className="text-[10px] font-semibold text-muted">
                Suggested agent actions (agentReviewActions_v1)
              </div>
              <p className="mt-1 text-[9px] text-muted">
                Review aids only — inspect here or copy JSON. Does not create remote issues or run commands
                automatically.
              </p>
              <ul className="mt-2 space-y-2">
                {evidenceArtifactSummary.reviewActions.map((a) => {
                  const detailLines = formatAgentReviewActionDetails(a.kind, a.target);
                  return (
                    <li
                      key={a.actionId}
                      className="rounded border border-border/50 bg-background/40 p-2 text-[10px]"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <span className="font-mono text-muted">{a.kind}</span>
                          <div className="mt-0.5 font-mono text-[9px] text-muted/80">
                            {a.actionId}
                          </div>
                        </div>
                        <Btn
                          type="button"
                          variant="quiet"
                          className="shrink-0 text-[10px]"
                          onClick={() => {
                            const body = JSON.stringify(
                              {
                                actionId: a.actionId,
                                kind: a.kind,
                                guidance: a.guidance,
                                target: a.target,
                              },
                              null,
                              2,
                            );
                            void navigator.clipboard.writeText(body).then(
                              () => pushStep(`Copied agent action ${a.actionId}`),
                              () => pushStep('Clipboard write failed'),
                            );
                          }}
                        >
                          Copy JSON
                        </Btn>
                      </div>
                      <p className="mt-1 text-muted">{a.guidance}</p>
                      {detailLines.length ? (
                        <dl className="mt-2 space-y-1 text-[9px] text-muted">
                          {detailLines.map((d) => (
                            <div
                              key={`${a.actionId}:${d.label}:${d.value.slice(0, 48)}`}
                              className="grid gap-x-2 sm:grid-cols-[auto_1fr]"
                            >
                              <dt className="font-semibold whitespace-nowrap">{d.label}</dt>
                              <dd className="break-all font-mono">{d.value}</dd>
                            </div>
                          ))}
                        </dl>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}
          {evidenceArtifactSummary.sheetRows.length ? (
            <div className="mt-2 overflow-auto">
              <table className="w-full border-collapse border border-border text-[10px]">
                <thead>
                  <tr className="bg-surface/50">
                    <th className="border border-border px-1 py-1 text-left">Sheet</th>
                    <th className="border border-border px-1 py-1 text-left">PNG viewport</th>
                    <th className="border border-border px-1 py-1 text-left">PNG full bleed</th>
                    <th className="border border-border px-1 py-1 text-left">Print raster</th>
                  </tr>
                </thead>
                <tbody>
                  {evidenceArtifactSummary.sheetRows.map((sr) => (
                    <tr key={sr.sheetId}>
                      <td className="border border-border px-1 py-1 align-top">
                        <div className="font-mono">{sr.sheetId}</div>
                        {sr.sheetName ? <div className="text-muted">{sr.sheetName}</div> : null}
                      </td>
                      <td className="border border-border px-1 py-1 font-mono align-top">
                        {sr.pngViewport ?? '—'}
                      </td>
                      <td className="border border-border px-1 py-1 font-mono align-top">
                        {sr.pngFullSheet ?? '—'}
                      </td>
                      <td className="border border-border px-1 py-1 align-top font-mono text-[9px]">
                        {sr.printRasterPngHref ? (
                          <div className="space-y-0.5">
                            <a
                              className="text-primary underline break-all"
                              href={sr.printRasterPngHref}
                              target="_blank"
                              rel="noreferrer"
                            >
                              sheet-print-raster.png
                            </a>
                            {sr.printRasterContract ? (
                              <div className="text-muted">{sr.printRasterContract}</div>
                            ) : null}
                            {sr.placeholderPngSha256Tail ? (
                              <div className="text-muted">png…{sr.placeholderPngSha256Tail}</div>
                            ) : null}
                          </div>
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
          {evidenceArtifactSummary.view3dRows.length ? (
            <div className="mt-3 overflow-auto">
              <div className="mb-1 text-[10px] font-semibold text-muted">
                Deterministic 3D viewpoints
              </div>
              <table className="w-full border-collapse border border-border text-[10px]">
                <thead>
                  <tr className="bg-surface/50">
                    <th className="border border-border px-1 py-1 text-left">Viewpoint</th>
                    <th className="border border-border px-1 py-1 text-left">PNG stem</th>
                    <th className="border border-border px-1 py-1 text-left">
                      Evidence bundle hint
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {evidenceArtifactSummary.view3dRows.map((vr) => (
                    <tr key={vr.viewpointId}>
                      <td className="border border-border px-1 py-1 align-top">
                        <div className="font-mono">{vr.viewpointId}</div>
                        {vr.viewpointName ? (
                          <div className="text-muted">{vr.viewpointName}</div>
                        ) : null}
                      </td>
                      <td className="border border-border px-1 py-1 font-mono align-top">
                        {vr.pngViewport ?? '—'}
                      </td>
                      <td className="border border-border px-1 py-1 font-mono align-top">
                        {vr.bundleJson ?? '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
          {evidenceArtifactSummary.planViewRows.length ? (
            <div className="mt-3 overflow-auto">
              <div className="mb-1 text-[10px] font-semibold text-muted">
                Plan views (deterministic PNG)
              </div>
              <table className="w-full border-collapse border border-border text-[10px]">
                <thead>
                  <tr className="bg-surface/50">
                    <th className="border border-border px-1 py-1 text-left">Plan view</th>
                    <th className="border border-border px-1 py-1 text-left">Presentation</th>
                    <th className="border border-border px-1 py-1 text-left">PNG plan canvas</th>
                    <th className="border border-border px-1 py-1 text-left">Bundle JSON</th>
                  </tr>
                </thead>
                <tbody>
                  {evidenceArtifactSummary.planViewRows.map((pr) => (
                    <tr key={pr.planViewId}>
                      <td className="border border-border px-1 py-1 align-top">
                        <div className="font-mono">{pr.planViewId}</div>
                        {pr.name ? <div className="text-muted">{pr.name}</div> : null}
                      </td>
                      <td className="border border-border px-1 py-1 align-top">
                        {pr.planPresentation ?? '—'}
                      </td>
                      <td className="border border-border px-1 py-1 font-mono align-top">
                        {pr.pngPlanCanvas ?? '—'}
                      </td>
                      <td className="border border-border px-1 py-1 font-mono align-top">
                        {pr.bundleJson ?? '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
          {evidenceArtifactSummary.sectionCutRows.length ? (
            <div className="mt-3 overflow-auto">
              <div className="mb-1 text-[10px] font-semibold text-muted">
                Section cuts (projection + PNG)
              </div>
              <table className="w-full border-collapse border border-border text-[10px]">
                <thead>
                  <tr className="bg-surface/50">
                    <th className="border border-border px-1 py-1 text-left">Section</th>
                    <th className="border border-border px-1 py-1 text-left">Wire href</th>
                    <th className="border border-border px-1 py-1 text-left">PNG viewport</th>
                    <th className="border border-border px-1 py-1 text-left">Bundle JSON</th>
                  </tr>
                </thead>
                <tbody>
                  {evidenceArtifactSummary.sectionCutRows.map((sec) => (
                    <tr key={sec.sectionCutId}>
                      <td className="border border-border px-1 py-1 align-top">
                        <div className="font-mono">{sec.sectionCutId}</div>
                        {sec.name ? <div className="text-muted">{sec.name}</div> : null}
                      </td>
                      <td className="border border-border px-1 py-1 font-mono align-top break-all">
                        {sec.projectionWireHref ?? '—'}
                      </td>
                      <td className="border border-border px-1 py-1 font-mono align-top">
                        {sec.pngSectionViewport ?? '—'}
                      </td>
                      <td className="border border-border px-1 py-1 font-mono align-top">
                        {sec.bundleJson ?? '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
          <div className="mt-3 text-[10px] text-muted">
            <div className="font-semibold">Regeneration / CI artifacts</div>
            {evidenceArtifactSummary.closureHints &&
            (evidenceArtifactSummary.closureHints.commands.length > 0 ||
              evidenceArtifactSummary.closureHints.ciPaths.length > 0 ||
              evidenceArtifactSummary.closureHints.envHints.length > 0 ||
              evidenceArtifactSummary.closureHints.playwrightSpec) ? (
              <div className="mt-1 space-y-1">
                {evidenceArtifactSummary.closureHints.playwrightSpec ? (
                  <div>
                    Playwright spec:{' '}
                    <code className="text-[10px]">
                      {evidenceArtifactSummary.closureHints.playwrightSpec}
                    </code>
                  </div>
                ) : null}
                {evidenceArtifactSummary.closureHints.commands.length > 0 ? (
                  <ul className="list-disc space-y-0.5 ps-4">
                    {evidenceArtifactSummary.closureHints.commands.map((c, i) => (
                      <li key={i}>
                        <code className="text-[10px] break-all">{c}</code>
                      </li>
                    ))}
                  </ul>
                ) : null}
                {evidenceArtifactSummary.closureHints.ciPaths.length > 0 ? (
                  <>
                    <div className="font-semibold text-muted">
                      Artifact paths (after CI download)
                    </div>
                    <ul className="list-disc space-y-0.5 ps-4">
                      {evidenceArtifactSummary.closureHints.ciPaths.map((p, i) => (
                        <li key={i}>
                          <code className="text-[10px] break-all">{p}</code>
                        </li>
                      ))}
                    </ul>
                  </>
                ) : null}
                {evidenceArtifactSummary.closureHints.envHints.length ? (
                  <>
                    <div className="font-semibold text-muted">CI env placeholders</div>
                    <ul className="list-disc space-y-0.5 ps-4">
                      {evidenceArtifactSummary.closureHints.envHints.map((p, i) => (
                        <li key={i}>{p}</li>
                      ))}
                    </ul>
                  </>
                ) : null}
              </div>
            ) : (
              <p className="mt-1">
                Re-fetch <code className="text-[10px]">evidence-package</code> for{' '}
                <code className="text-[10px]">agentEvidenceClosureHints</code>, or run{' '}
                <code className="text-[10px] break-all">
                  cd packages/web && CI=true pnpm exec playwright test
                  e2e/evidence-baselines.spec.ts
                </code>
                .
              </p>
            )}
          </div>
          {evidenceArtifactSummary.mismatchNotes.length ? (
            <ul className="mt-2 list-disc space-y-1 ps-4 text-[10px] text-amber-500">
              {evidenceArtifactSummary.mismatchNotes.map((n, i) => (
                <li key={i}>{n}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {evidenceTxt ? (
        <div>
          <div className="mb-1 text-[10px] font-semibold text-muted">Evidence payloads</div>
          <pre className="max-h-48 overflow-auto rounded border bg-background p-2 text-[10px]">
            {evidenceTxt}
          </pre>
        </div>
      ) : null}
    </div>
  );
}
