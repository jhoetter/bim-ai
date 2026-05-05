import type { Element, Violation } from '@bim-ai/core';

/** Server `bim_ai.constraints` schedule/documentation rules for hosted openings (Prompt 5). */
export const SCHEDULE_OPENING_ADVISORY_RULE_IDS = [
  'schedule_opening_identifier_missing',
  'schedule_opening_orphan_host',
  'schedule_opening_family_type_incomplete',
  'schedule_opening_host_wall_type_incomplete',
] as const;

export type ScheduleOpeningAdvisoryRuleId = (typeof SCHEDULE_OPENING_ADVISORY_RULE_IDS)[number];

const RULE_SET = new Set<string>(SCHEDULE_OPENING_ADVISORY_RULE_IDS);

/**
 * Compact monospace-friendly lines for the Schedules panel (doors/windows registry tabs only).
 * Ordering: ruleId, message, sorted elementIds.
 */
export function compactScheduleOpeningAdvisoryLines(
  violations: Violation[],
  elementsById: Record<string, Element>,
  tab: 'doors' | 'windows',
): string[] {
  const wantKind = tab === 'doors' ? 'door' : 'window';
  const openingIds = new Set(
    Object.values(elementsById)
      .filter((e) => e.kind === wantKind)
      .map((e) => e.id),
  );

  const matched = violations.filter((v) => {
    if (!RULE_SET.has(v.ruleId)) return false;
    const ids = v.elementIds ?? [];
    return ids.some((id) => openingIds.has(id));
  });

  const sorted = [...matched].sort((a, b) => {
    const cr = a.ruleId.localeCompare(b.ruleId);
    if (cr !== 0) return cr;
    const cm = a.message.localeCompare(b.message);
    if (cm !== 0) return cm;
    const sa = [...(a.elementIds ?? [])].sort((x, y) => x.localeCompare(y)).join(',');
    const sb = [...(b.elementIds ?? [])].sort((x, y) => x.localeCompare(y)).join(',');
    return sa.localeCompare(sb);
  });

  return sorted.map((v) => {
    const ids = [...(v.elementIds ?? [])].sort((x, y) => x.localeCompare(y)).join(', ');
    return `${v.ruleId} · ${v.severity} · ${v.message}${ids ? ` · ${ids}` : ''}`;
  });
}
