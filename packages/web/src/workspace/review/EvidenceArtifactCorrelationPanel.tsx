import { Btn } from '@bim-ai/ui';

import { collaborationConflictQueueInspectionLinesFromHints } from '../../lib/collaborationConflictQueue';
import { formatAgentReviewActionDetails } from '../agentReviewActionDetails';
import { EvidenceBaselineLifecycleReadoutV1Table } from '../evidenceBaselineLifecycleReadout';
import {
  summarizeBcfIssuePackageExport,
  type BcfIssuePackageExportWire,
} from '../bcfIssuePackageExportFormat';
import {
  summarizeBcfRoundtripEvidenceSummary,
  type BcfRoundtripEvidenceSummaryWire,
} from '../bcfRoundtripEvidenceSummaryFormat';
import { formatStagedArtifactResolutionMode } from '../formatStagedArtifactResolutionMode';
import {
  formatIfcExchangeManifestClosureLines,
  type IfcExchangeManifestClosureWire,
} from '../ifcExchangeManifestClosureReadout';
import { formatPrdCloseoutCrossCorrelationReadoutLines } from '../prdCloseoutCrossCorrelationReadout';
import type { EvidenceArtifactSummary } from './evidenceArtifactParser';

interface EvidenceArtifactCorrelationPanelProps {
  evidenceArtifactSummary: EvidenceArtifactSummary;
  pushStep: (line: string) => void;
}

export function EvidenceArtifactCorrelationPanel({
  evidenceArtifactSummary,
  pushStep,
}: EvidenceArtifactCorrelationPanelProps) {
  return (
    <div className="rounded border border-border bg-background/40 p-2">
      <div className="text-[10px] font-semibold text-muted">Evidence artifact correlation</div>
      <ul className="mt-1 list-disc space-y-1 ps-4 text-[10px] text-muted">
        {evidenceArtifactSummary.semanticDigestPrefix16 ? (
          <li>
            semanticDigestPrefix16:{' '}
            <code className="text-[10px]">{evidenceArtifactSummary.semanticDigestPrefix16}</code>
          </li>
        ) : null}
        {evidenceArtifactSummary.semanticDigestSha256Tail ? (
          <li>
            semanticDigest tail:{' '}
            <code className="text-[10px]">{evidenceArtifactSummary.semanticDigestSha256Tail}</code>
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
            <p className="mt-1 text-[10px] text-muted">No deterministic PNG basenames listed.</p>
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
                {evidenceArtifactSummary.closureReview.missingDigestRowCount} missing correlation
                digest(s).
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
              {evidenceArtifactSummary.closureReview.artifactIngestCanonicalPairCount !== null ? (
                <p className="mt-0.5 text-[10px] text-muted">
                  canonicalPairCount:{' '}
                  <code className="font-mono text-[10px]">
                    {String(evidenceArtifactSummary.closureReview.artifactIngestCanonicalPairCount)}
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
          evidenceArtifactSummary.closureReview.serverPngByteIngestCanonicalDigestFull !== null ? (
            <div
              data-testid="server-png-byte-ingest-callout"
              className="mt-2 rounded border border-border/40 bg-muted/10 p-2"
            >
              <div className="text-[10px] font-semibold text-muted">
                Server PNG byte ingest (<code className="text-[10px]">serverPngByteIngest_v1</code>)
              </div>
              <p className="mt-1 text-[10px] text-muted">
                comparison.result:{' '}
                <code className="font-mono text-[10px]">
                  {evidenceArtifactSummary.closureReview.serverPngByteIngestComparisonResult ?? '—'}
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
                  {evidenceArtifactSummary.closureReview.serverPngByteIngestByteLength !== null ? (
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
                  canonicalDigestSha256 (<code className="text-[10px]">png_file_sha256</code>):{' '}
                  <code className="font-mono text-[10px]">
                    {evidenceArtifactSummary.closureReview.serverPngByteIngestCanonicalDigestFull.slice(
                      0,
                      12,
                    )}
                    …{evidenceArtifactSummary.closureReview.serverPngByteIngestCanonicalDigestTail}
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
                {String(evidenceArtifactSummary.lifecycleSignal.screenshotHintGapRowCount ?? '—')}
              </code>
            </li>
            <li>
              pixelDiffIngestTargetCount:{' '}
              <code className="font-mono">
                {String(evidenceArtifactSummary.lifecycleSignal.pixelDiffIngestTargetCount ?? '—')}
              </code>
            </li>
            <li>
              correlationFullyConsistent:{' '}
              <code className="font-mono">
                {String(evidenceArtifactSummary.lifecycleSignal.correlationFullyConsistent ?? '—')}
              </code>
            </li>
            {typeof evidenceArtifactSummary.lifecycleSignal.artifactIngestManifestDigestSha256 ===
            'string' ? (
              <li data-testid="lifecycle-artifact-ingest-digest-row">
                artifactIngestManifestDigestSha256:{' '}
                <code className="font-mono">
                  {String(
                    evidenceArtifactSummary.lifecycleSignal.artifactIngestManifestDigestSha256,
                  ).length >= 24
                    ? `${String(evidenceArtifactSummary.lifecycleSignal.artifactIngestManifestDigestSha256).slice(0, 12)}…${String(evidenceArtifactSummary.lifecycleSignal.artifactIngestManifestDigestSha256).slice(-12)}`
                    : String(
                        evidenceArtifactSummary.lifecycleSignal.artifactIngestManifestDigestSha256,
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
              </strong>{' '}
              (total: <strong>{evidenceArtifactSummary.evidenceFreshness.totalCount}</strong>)
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
                    {' — '}
                    {action.reason}
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
            <code className="text-[9px]">agentReviewActions_v1</code> (pinned first when present).
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
                const body = JSON.stringify(evidenceArtifactSummary.agentFollowThrough, null, 2);
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
            const roundtripRaw = ft.bcfRoundtripEvidenceSummary_v1 as
              | Record<string, unknown>
              | undefined;
            const roundtripFmt = summarizeBcfRoundtripEvidenceSummary(
              roundtripRaw as BcfRoundtripEvidenceSummaryWire,
            );
            const issuePkgRaw = ft.bcfIssuePackageExport_v1 as Record<string, unknown> | undefined;
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
                    Unresolved BCF/issue evidenceRefs: <code className="font-mono">{unres}</code>
                  </li>
                ) : null}
                {roundtripRaw?.format === 'bcfRoundtripEvidenceSummary_v1' ? (
                  <>
                    <li>
                      BCF round-trip summary: BCF topics{' '}
                      <code className="font-mono">{roundtripFmt.bcfTopicCount ?? '—'}</code>
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
                {issuePkgRaw?.format === 'bcfIssuePackageExport_v1' && issuePkgFmt.lines.length ? (
                  <li className="space-y-0.5" data-testid="bcf-issue-package-export-readout">
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
                      Conflict queue inspection (live readout also appears in the Workspace header
                      on 409):
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
            Review aids only — inspect here or copy JSON. Does not create remote issues or run
            commands automatically.
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
                      <div className="mt-0.5 font-mono text-[9px] text-muted/80">{a.actionId}</div>
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
                <th className="border border-border px-1 py-1 text-left">Evidence bundle hint</th>
              </tr>
            </thead>
            <tbody>
              {evidenceArtifactSummary.view3dRows.map((vr) => (
                <tr key={vr.viewpointId}>
                  <td className="border border-border px-1 py-1 align-top">
                    <div className="font-mono">{vr.viewpointId}</div>
                    {vr.viewpointName ? <div className="text-muted">{vr.viewpointName}</div> : null}
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
                <div className="font-semibold text-muted">Artifact paths (after CI download)</div>
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
              cd packages/web && CI=true pnpm exec playwright test e2e/evidence-baselines.spec.ts
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
  );
}
