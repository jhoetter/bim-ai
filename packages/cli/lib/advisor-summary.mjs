import { base, fetchJson } from './api-client.mjs';

export const ADVISOR_RULE_FILES = [
  'app/bim_ai/advisor_rule_registry.py',
  'app/bim_ai/constructability_advisories.py',
  'app/bim_ai/constructability_report.py',
  'app/bim_ai/constraints_metadata.py',
  'app/bim_ai/domain_integrity.py',
  'app/bim_ai/room_access_integrity.py',
  'packages/web/src/advisor/advisorViolationContext.ts',
  'packages/web/src/advisor/perspectiveFilter.ts',
];

function advisoryCode(v) {
  return v?.advisoryClass ?? v?.ruleId ?? v?.code ?? 'unknown';
}

function asStringArray(value) {
  if (!Array.isArray(value)) return [];
  return [
    ...new Set(
      value.filter((item) => typeof item === 'string' && item.trim()).map((item) => item.trim()),
    ),
  ].sort();
}

function compactObject(value) {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => {
      if (entry == null) return false;
      if (Array.isArray(entry)) return entry.length > 0;
      if (entry instanceof Set) return entry.size > 0;
      return true;
    }),
  );
}

function quickFixSummary(command) {
  if (!command || typeof command !== 'object') return null;
  const parts = [];
  if (typeof command.type === 'string') parts.push(`type=${command.type}`);
  for (const key of ['elementId', 'openingId', 'wallId', 'hostId', 'id', 'mode', 'key']) {
    if (typeof command[key] === 'string' && command[key].trim()) {
      parts.push(`${key}=${command[key].trim()}`);
    }
  }
  return parts.slice(0, 4).join(' ');
}

function recommendationFromViolation(v) {
  const candidates = [
    v?.recommendation,
    v?.recommendationText,
    v?.actionability?.recommendation,
    v?.audienceText?.agent,
    v?.audienceText?.ui,
  ];
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) return candidate.trim();
  }
  if (typeof v?.message === 'string') {
    const marker = 'Recommendation:';
    const index = v.message.indexOf(marker);
    if (index >= 0) return v.message.slice(index + marker.length).trim();
  }
  return null;
}

function actionabilityFromViolation(v) {
  const elementIds = asStringArray(v?.elementIds);
  const quickFixCommand =
    v?.quickFixCommand && typeof v.quickFixCommand === 'object' ? v.quickFixCommand : null;
  const quickFixHint = quickFixSummary(quickFixCommand);
  const recommendation = recommendationFromViolation(v);
  const viewpointRefs = asStringArray([
    v?.viewpointRef,
    v?.actionability?.viewpointRef,
    v?.viewpointEvidence?.viewpointId,
    v?.viewpointEvidence?.viewId,
  ]);
  const diagnosticCodes = asStringArray([
    v?.diagnosticCode,
    v?.code,
    ...(Array.isArray(v?.diagnosticCodes) ? v.diagnosticCodes : []),
    ...(Array.isArray(v?.viewpointEvidence?.diagnosticCodes)
      ? v.viewpointEvidence.diagnosticCodes
      : []),
  ]);
  const issueClasses = asStringArray([
    v?.issueClass,
    v?.diagnosticIssueClass,
    ...(Array.isArray(v?.issueClasses) ? v.issueClasses : []),
  ]);
  return compactObject({
    affectedElementIds: elementIds,
    openElementActions: elementIds.map((elementId) => ({ type: 'openElement', elementId })),
    isolateElementActions: elementIds.map((elementId) => ({ type: 'isolateElement', elementId })),
    contextViewSuggestion: v?.viewpointRef
      ? { type: 'openViewpoint', viewpointRef: v.viewpointRef }
      : elementIds.length
        ? { type: 'focusElements', elementIds }
        : null,
    recommendation,
    quickFixSummary: quickFixHint,
    quickFixCommand,
    viewpointRefs,
    evidenceRefs: Array.isArray(v?.evidenceRefs) ? v.evidenceRefs : [],
    diagnosticCodes,
    issueClasses,
    reason: typeof v?.message === 'string' ? v.message : null,
  });
}

export async function advisorSummary(modelId, { severity = null } = {}) {
  const snap = await fetchJson('GET', `${base}/api/models/${encodeURIComponent(modelId)}/snapshot`);
  let violations = Array.isArray(snap.violations) ? snap.violations : [];
  if (severity) violations = violations.filter((v) => String(v?.severity ?? '') === severity);

  const groups = new Map();
  for (const v of violations) {
    const code = advisoryCode(v);
    const key = `${v?.severity ?? 'unknown'}:${code}`;
    const row = groups.get(key) ?? {
      severity: v?.severity ?? 'unknown',
      code,
      count: 0,
      elementIds: new Set(),
      messages: new Set(),
      disciplines: new Set(),
      priorities: new Set(),
      priorityRanks: new Set(),
      recommendations: new Set(),
      quickFixSummaries: new Set(),
      quickFixCommands: [],
      viewpointRefs: new Set(),
      evidenceRefs: [],
      diagnosticCodes: new Set(),
      issueClasses: new Set(),
      reasons: new Set(),
    };
    row.count += 1;
    for (const id of v?.elementIds ?? []) row.elementIds.add(id);
    if (v?.message) row.messages.add(v.message);
    if (v?.discipline) row.disciplines.add(v.discipline);
    if (v?.priority) row.priorities.add(v.priority);
    if (Number.isFinite(Number(v?.priorityRank))) row.priorityRanks.add(Number(v.priorityRank));
    const actionability = actionabilityFromViolation(v);
    for (const recommendation of actionability.recommendation
      ? [actionability.recommendation]
      : []) {
      row.recommendations.add(recommendation);
    }
    if (actionability.quickFixSummary) row.quickFixSummaries.add(actionability.quickFixSummary);
    if (actionability.quickFixCommand) row.quickFixCommands.push(actionability.quickFixCommand);
    for (const ref of actionability.viewpointRefs ?? []) row.viewpointRefs.add(ref);
    for (const ref of actionability.evidenceRefs ?? []) row.evidenceRefs.push(ref);
    for (const code of actionability.diagnosticCodes ?? []) row.diagnosticCodes.add(code);
    for (const issueClass of actionability.issueClasses ?? []) row.issueClasses.add(issueClass);
    if (actionability.reason) row.reasons.add(actionability.reason);
    groups.set(key, row);
  }
  const grouped = [...groups.values()]
    .map((g) => {
      const elementIds = [...g.elementIds].sort();
      const viewpointRefs = [...g.viewpointRefs].sort();
      const actionability = compactObject({
        affectedElementIds: elementIds,
        openElementActions: elementIds.map((elementId) => ({ type: 'openElement', elementId })),
        isolateElementActions: elementIds.map((elementId) => ({
          type: 'isolateElement',
          elementId,
        })),
        contextViewSuggestion: viewpointRefs.length
          ? { type: 'openViewpoint', viewpointRef: viewpointRefs[0] }
          : elementIds.length
            ? { type: 'focusElements', elementIds }
            : null,
        recommendations: [...g.recommendations].sort(),
        quickFixSummaries: [...g.quickFixSummaries].sort(),
        quickFixCommands: g.quickFixCommands,
        viewpointRefs,
        evidenceRefs: g.evidenceRefs,
        diagnosticCodes: [...g.diagnosticCodes].sort(),
        issueClasses: [...g.issueClasses].sort(),
        reasons: [...g.reasons].slice(0, 3),
      });
      return {
        severity: g.severity,
        code: g.code,
        count: g.count,
        elementIds,
        messages: [...g.messages].slice(0, 3),
        ruleMetadata: compactObject({
          ruleId: g.code,
          severity: g.severity,
          disciplines: [...g.disciplines].sort(),
          priorities: [...g.priorities].sort(),
          priorityRanks: [...g.priorityRanks].sort((a, b) => a - b),
        }),
        actionability,
      };
    })
    .sort((a, b) => {
      const rank = { error: 0, warning: 1, info: 2 };
      return (rank[a.severity] ?? 9) - (rank[b.severity] ?? 9) || a.code.localeCompare(b.code);
    });

  return {
    modelId: snap.modelId,
    revision: snap.revision,
    total: violations.length,
    groups: grouped,
  };
}

export function severityRank(severity) {
  return { error: 0, warning: 1, info: 2 }[severity] ?? 9;
}

export function advisorFindingRows(summary, sourceLabel) {
  const rows = [];
  for (const group of summary?.groups ?? []) {
    const severity = String(group?.severity ?? 'unknown');
    rows.push({
      source: sourceLabel,
      severity,
      code: group?.code ?? 'unknown',
      count: group?.count ?? 0,
      elementIds: group?.elementIds ?? [],
      messages: group?.messages ?? [],
      disposition: severity === 'info' ? 'reviewed' : 'unclassified',
      phaseRationale: '',
      toleranceEvidence: '',
      owner: '',
      expiryCondition: '',
    });
  }
  return rows;
}
