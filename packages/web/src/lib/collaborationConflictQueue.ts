/** Deterministic conflict-resolution queue for collaboration 409 / replay outcomes (WP-P02). */

export type CollaborationRetryAdvice = 'safe' | 'blocked' | 'requires_manual_edit';

export type CollaborationConflictRowV1 = {
  ruleId: string;
  elementIds: string[];
  severity: 'error' | 'warning' | 'info';
  blocking: boolean;
  message: string;
};

export type CollaborationConflictQueueV1 = {
  format: 'collaborationConflictQueue_v1';
  reason: string;
  firstBlockingCommandIndex: number | null;
  firstBlockingCommandStep1Based: number | null;
  blockingCommandType: string | null;
  blockingRuleIds: string[];
  affectedElementIds: string[];
  rows: CollaborationConflictRowV1[];
  inspectionReadout: string;
  inspectionReadoutSecondary: string | null;
  retryAdvice: CollaborationRetryAdvice;
  mergePreflightReadout: string | null;
  mergePreflightReadoutSecondary: string | null;
};

const MANUAL_EDIT_REASONS = new Set([
  'merge_id_collision',
  'merge_reference_unresolved',
  'invalid_command',
  'invalid_sketch',
  'sketch_unavailable',
]);

function parseViolationEntry(v: unknown): CollaborationConflictRowV1 | null {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  const vv = v as Record<string, unknown>;
  const ruleIdRaw =
    typeof vv.ruleId === 'string' ? vv.ruleId : typeof vv.rule_id === 'string' ? vv.rule_id : '';
  const ruleId = ruleIdRaw.trim();
  if (!ruleId) return null;

  const sev = vv.severity as string | undefined;
  const severity: CollaborationConflictRowV1['severity'] =
    sev === 'error' || sev === 'warning' || sev === 'info' ? sev : 'warning';

  const elementIdsRaw = vv.elementIds ?? vv.element_ids;
  const elementIds =
    Array.isArray(elementIdsRaw) && elementIdsRaw.every((x) => typeof x === 'string')
      ? [...elementIdsRaw]
      : [];

  const message = typeof vv.message === 'string' ? vv.message : '';
  const blocking = typeof vv.blocking === 'boolean' ? vv.blocking : false;

  return { ruleId, elementIds, severity, blocking, message };
}

function rowSortKey(r: CollaborationConflictRowV1): string {
  return `${r.ruleId}\0${r.elementIds.slice().sort().join(',')}`;
}

function computeRetryAdvice(reason: string, hasBlockingRows: boolean): CollaborationRetryAdvice {
  const r = reason.trim();
  if (MANUAL_EDIT_REASONS.has(r)) return 'requires_manual_edit';
  if (r === 'constraint_error' || hasBlockingRows) return 'blocked';
  if (!r && !hasBlockingRows) return 'safe';
  return 'blocked';
}

function readReplayDiagnostics(detail: Record<string, unknown>) {
  const replayRaw = detail.replayDiagnostics;
  const replay =
    replayRaw && typeof replayRaw === 'object' && !Array.isArray(replayRaw)
      ? (replayRaw as Record<string, unknown>)
      : null;

  let firstBlockingCommandIndex: number | null = null;
  if (replay && 'firstBlockingCommandIndex' in replay) {
    const n = Number(replay.firstBlockingCommandIndex);
    if (Number.isFinite(n) && n >= 0) firstBlockingCommandIndex = Math.floor(n);
  }

  let blockingViolationRuleIds: string[] = [];
  const rulesRaw = replay?.blockingViolationRuleIds;
  if (Array.isArray(rulesRaw)) {
    blockingViolationRuleIds = rulesRaw
      .filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
      .map((s) => s.trim());
  }

  let commandTypesInOrder: string[] = [];
  const typesRaw = replay?.commandTypesInOrder;
  if (Array.isArray(typesRaw) && typesRaw.every((x) => typeof x === 'string')) {
    commandTypesInOrder = typesRaw as string[];
  }

  return {
    replay,
    firstBlockingCommandIndex,
    blockingViolationRuleIds,
    commandTypesInOrder,
  };
}

function buildInspectionReadout(params: {
  step1: number | null;
  commandType: string | null;
  blockingRuleIds: string[];
  affectedElementIds: string[];
  retryAdvice: CollaborationRetryAdvice;
}): { primary: string; secondary: string | null } {
  const { step1, commandType, blockingRuleIds, affectedElementIds, retryAdvice } = params;
  const maxIds = 5;
  const idHint =
    affectedElementIds.length > 0
      ? affectedElementIds.slice(0, maxIds).join(', ') +
        (affectedElementIds.length > maxIds ? ` (+${affectedElementIds.length - maxIds} more)` : '')
      : null;

  const rulesHint =
    blockingRuleIds.length > 0
      ? blockingRuleIds.slice(0, 6).join(', ') + (blockingRuleIds.length > 6 ? ', …' : '')
      : null;

  const stepChunk =
    step1 !== null
      ? `Blocking step ${step1}${commandType ? ` (${commandType})` : ''}`
      : commandType
        ? `Blocking command type ${commandType}`
        : 'Replay conflict';

  const mid =
    [rulesHint ? `rules: ${rulesHint}` : null, idHint ? `elements: ${idHint}` : null]
      .filter(Boolean)
      .join(' · ') || null;

  const primary = [stepChunk, mid, 'Cross-check in Advisor / validation.']
    .filter(Boolean)
    .join(' ');

  let secondary: string | null = null;
  if (retryAdvice === 'requires_manual_edit') {
    secondary =
      'Retry: fix command references, declared ids, or sketch payload before re-applying.';
  } else if (retryAdvice === 'blocked') {
    secondary =
      'Retry: not safe with the same commands — edit the model or trim the bundle, then re-try.';
  } else {
    secondary = 'Retry: may be safe once local model state matches the server revision.';
  }

  return { primary, secondary };
}

/** Stable workspace/agent-review lines from POST bundle mergePreflight_v1 / 409 detail. */
export function formatMergePreflightV1Readout(mp: Record<string, unknown>): {
  primary: string;
  secondary: string | null;
} {
  if (mp.format !== 'commandBundleMergePreflight_v1') {
    return { primary: '', secondary: null };
  }
  const reason = typeof mp.reasonCode === 'string' ? mp.reasonCode.trim() : '';
  const stepRaw = mp.firstConflictingStepIndex;
  const step1Based =
    typeof stepRaw === 'number' && Number.isFinite(stepRaw) && stepRaw >= 0
      ? Math.floor(stepRaw) + 1
      : null;
  const cls =
    typeof mp.safeRetryClassification === 'string' ? mp.safeRetryClassification.trim() : '';
  const manual =
    typeof mp.suggestedManualAction === 'string' ? mp.suggestedManualAction.trim() : '';
  const agentAct =
    typeof mp.suggestedAgentAction === 'string' ? mp.suggestedAgentAction.trim() : '';

  const declared = Array.isArray(mp.conflictingDeclaredIds)
    ? mp.conflictingDeclaredIds.filter((x): x is string => typeof x === 'string')
    : [];
  const existing = Array.isArray(mp.conflictingExistingElementIds)
    ? mp.conflictingExistingElementIds.filter((x): x is string => typeof x === 'string')
    : [];
  const hints = Array.isArray(mp.missingReferenceHints) ? mp.missingReferenceHints : [];

  const maxIds = 5;
  const declHint =
    declared.length > 0
      ? `declared: ${declared.slice(0, maxIds).join(', ')}` +
        (declared.length > maxIds ? ` (+${declared.length - maxIds})` : '')
      : null;
  const existHint =
    existing.length > 0
      ? `existing: ${existing.slice(0, maxIds).join(', ')}` +
        (existing.length > maxIds ? ` (+${existing.length - maxIds})` : '')
      : null;

  let missingHint: string | null = null;
  const h0 = hints[0];
  if (h0 !== undefined && h0 !== null && typeof h0 === 'object' && !Array.isArray(h0)) {
    const hr = h0 as Record<string, unknown>;
    const rk = typeof hr.referenceKey === 'string' ? hr.referenceKey : '';
    const rid = typeof hr.referenceId === 'string' ? hr.referenceId : '';
    const siRaw = hr.stepIndex;
    const si1 =
      typeof siRaw === 'number' && Number.isFinite(siRaw) && siRaw >= 0
        ? Math.floor(siRaw) + 1
        : null;
    missingHint =
      `missing ${rk}${rid !== '' ? `=${rid}` : ''}` + (si1 !== null ? ` @ step ${si1}` : '');
  }

  const digestRaw = mp.evidenceDigestSha256;
  const digestHint =
    typeof digestRaw === 'string' && digestRaw.length >= 16
      ? `digest ${digestRaw.slice(0, 16)}…`
      : null;

  const primary = [
    reason ? `Merge preflight: ${reason}` : 'Merge preflight',
    step1Based !== null ? `first conflicting step ${step1Based}` : null,
    cls ? `classification ${cls}` : null,
    [declHint, existHint, missingHint].filter(Boolean).join(' · ') || null,
    digestHint,
  ]
    .filter(Boolean)
    .join(' · ');

  const secondary =
    manual !== '' || agentAct !== ''
      ? `${manual}${manual !== '' && agentAct !== '' ? ' — ' : ''}${agentAct !== '' ? `Agent: ${agentAct}` : ''}`
      : null;

  return { primary, secondary };
}

/** Static inspection steps for Agent Review (no live 409 required). */
export function collaborationConflictQueueInspectionLinesFromHints(): string[] {
  return [
    'Map replayDiagnostics.firstBlockingCommandIndex (0-based) to commandTypesInOrder for the blocking command type.',
    'Join blockingViolationRuleIds with violations[].ruleId; use Advisor with those rule ids and elementIds.',
    'When replayPerformanceBudget_v1.largeBundleWarn is true, consider splitting or shrinking command bundles before replay.',
    'Read mergePreflight_v1 for deterministic safeRetryClassification, first conflicting step, ids/refs, and evidenceDigestSha256.',
  ];
}

export function buildCollaborationConflictQueueV1(
  detail: unknown,
): CollaborationConflictQueueV1 | null {
  if (!detail || typeof detail !== 'object' || Array.isArray(detail)) return null;
  const d = detail as Record<string, unknown>;

  const reason = typeof d.reason === 'string' ? d.reason.trim() : '';
  const violationsRaw = d.violations;
  const violationsList = Array.isArray(violationsRaw) ? violationsRaw : [];

  const { firstBlockingCommandIndex, blockingViolationRuleIds, commandTypesInOrder, replay } =
    readReplayDiagnostics(d);

  const mergeProbe = d.mergePreflight_v1;
  const hasMergePreflight =
    mergeProbe !== null && typeof mergeProbe === 'object' && !Array.isArray(mergeProbe);

  const hasReplay = replay !== null;
  const hasViolations = violationsList.length > 0;

  if (!reason && !hasViolations && !hasReplay && !hasMergePreflight) return null;

  const ruleFilter = blockingViolationRuleIds.length > 0 ? new Set(blockingViolationRuleIds) : null;

  const rowCandidates: CollaborationConflictRowV1[] = [];
  for (const v of violationsList) {
    const row = parseViolationEntry(v);
    if (!row) continue;
    const isBlockingOrError = row.blocking || row.severity === 'error';
    if (!isBlockingOrError) continue;
    if (ruleFilter !== null && !ruleFilter.has(row.ruleId)) continue;
    rowCandidates.push(row);
  }

  rowCandidates.sort((a, b) => rowSortKey(a).localeCompare(rowSortKey(b)));

  const blockingRuleIdsFromRows = [...new Set(rowCandidates.map((r) => r.ruleId))].sort();

  const blockingRuleIds =
    blockingViolationRuleIds.length > 0
      ? [...blockingViolationRuleIds].sort()
      : blockingRuleIdsFromRows;

  const affectedSet = new Set<string>();
  for (const r of rowCandidates) {
    for (const id of r.elementIds) affectedSet.add(id);
  }
  const affectedElementIds = [...affectedSet].sort();

  let blockingCommandType: string | null = null;
  if (
    firstBlockingCommandIndex !== null &&
    firstBlockingCommandIndex >= 0 &&
    firstBlockingCommandIndex < commandTypesInOrder.length
  ) {
    blockingCommandType = commandTypesInOrder[firstBlockingCommandIndex] ?? null;
  }

  const hasBlockingRows = rowCandidates.length > 0;
  const retryAdvice = computeRetryAdvice(reason, hasBlockingRows);

  const step1Based = firstBlockingCommandIndex !== null ? firstBlockingCommandIndex + 1 : null;

  const { primary, secondary } = buildInspectionReadout({
    step1: step1Based,
    commandType: blockingCommandType,
    blockingRuleIds,
    affectedElementIds,
    retryAdvice,
  });

  let mergePreflightReadout: string | null = null;
  let mergePreflightReadoutSecondary: string | null = null;
  if (hasMergePreflight) {
    const mf = formatMergePreflightV1Readout(mergeProbe as Record<string, unknown>);
    mergePreflightReadout = mf.primary.trim() !== '' ? mf.primary : null;
    mergePreflightReadoutSecondary = mf.secondary;
  }

  return {
    format: 'collaborationConflictQueue_v1',
    reason,
    firstBlockingCommandIndex,
    firstBlockingCommandStep1Based: step1Based,
    blockingCommandType,
    blockingRuleIds,
    affectedElementIds,
    rows: rowCandidates,
    inspectionReadout: primary,
    inspectionReadoutSecondary: secondary,
    retryAdvice,
    mergePreflightReadout,
    mergePreflightReadoutSecondary,
  };
}
