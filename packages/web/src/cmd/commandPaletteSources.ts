/**
 * Command palette sources & ranker — spec §18.
 *
 * Pure-state composition for the §18 cmdk-backed palette: aggregates
 * sources (recent / tools / views / elements / settings / agent), parses
 * prefix grammar (`>` for tools, `@` for elements, `:` for settings),
 * and produces a ranked candidate list. The cmdk widget itself lives in
 * `CommandPalette.tsx` and consumes this module.
 */

export type CommandSourceKind = 'recent' | 'tool' | 'view' | 'element' | 'setting' | 'agent';

export interface CommandCandidate {
  id: string;
  kind: CommandSourceKind;
  label: string;
  /** Extra free-text keywords appended to the matchable string. */
  keywords?: string;
  /** Optional shortcut hint shown trailing the label. */
  hint?: string;
}

const PRIORITY: Record<CommandSourceKind, number> = {
  recent: 0,
  tool: 1,
  view: 2,
  element: 3,
  setting: 4,
  agent: 5,
};

export interface CommandPaletteQuery {
  /** Raw query as typed (still includes any prefix). */
  raw: string;
  /** Parsed source-kind filter — null when no prefix used. */
  filter: CommandSourceKind | null;
  /** Stripped query without the prefix. */
  needle: string;
}

const PREFIX_MAP: Record<string, CommandSourceKind> = {
  '>': 'tool',
  '@': 'element',
  ':': 'setting',
};

/** Parse the query string into `{ filter, needle }` per §18 prefix grammar. */
export function parseQuery(raw: string): CommandPaletteQuery {
  const trimmed = raw.trim();
  if (!trimmed) return { raw, filter: null, needle: '' };
  const head = trimmed[0]!;
  const filter = PREFIX_MAP[head] ?? null;
  const needle = filter ? trimmed.slice(1).trim() : trimmed;
  return { raw, filter, needle };
}

function fuzzyScore(haystack: string, needle: string): number | null {
  const h = haystack.toLowerCase();
  const n = needle.toLowerCase();
  if (!n) return 0;
  if (h === n) return 1000;
  if (h.startsWith(n)) return 800;
  if (h.includes(n)) return 600;
  // Sequential subsequence match.
  let idx = 0;
  for (const ch of n) {
    const found = h.indexOf(ch, idx);
    if (found < 0) return null;
    idx = found + 1;
  }
  return 200;
}

export interface RankedCandidate extends CommandCandidate {
  score: number;
}

export interface RankOptions {
  /** Recent-command ids (most recent first). Caps at 5 per §18.1. */
  recentIds?: string[];
}

/** Rank a candidate list against `query`. Recent items always lift to
 * the top; equal-score ties break on source-kind priority. */
export function rankCandidates(
  candidates: CommandCandidate[],
  query: CommandPaletteQuery,
  options: RankOptions = {},
): RankedCandidate[] {
  const recentIds = (options.recentIds ?? []).slice(0, 5);
  const recentBoost = (id: string): number => {
    const idx = recentIds.indexOf(id);
    return idx < 0 ? 0 : 500 - idx * 10;
  };
  const filtered = query.filter ? candidates.filter((c) => c.kind === query.filter) : candidates;
  const ranked: RankedCandidate[] = [];
  for (const c of filtered) {
    const corpus = `${c.label} ${c.keywords ?? ''}`;
    const score = fuzzyScore(corpus, query.needle);
    if (score === null) continue;
    ranked.push({ ...c, score: score + recentBoost(c.id) });
  }
  ranked.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const pa = PRIORITY[a.kind];
    const pb = PRIORITY[b.kind];
    if (pa !== pb) return pa - pb;
    return a.label.localeCompare(b.label);
  });
  return ranked;
}

/** Top 5 keyboard-shortcut hints shown in the empty state per §18. */
export const EMPTY_STATE_HINTS: { keys: string; label: string }[] = [
  { keys: '⌘K', label: 'Open command palette' },
  { keys: 'V', label: 'Select tool' },
  { keys: 'W', label: 'Wall tool' },
  { keys: '?', label: 'Keyboard shortcuts' },
  { keys: '1–7', label: 'Switch workspace mode' },
];
