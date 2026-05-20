import type { Element, LensMode } from '@bim-ai/core';

import type { WorkspaceId } from './chrome/workspaces';

export const EMPTY_JOBS_COUNTS = {
  queued: 0,
  running: 0,
  errored: 0,
} as const;

export function libraryDisciplineFromLens(lens: LensMode): 'arch' | 'struct' | 'mep' | 'all' {
  if (lens === 'architecture') return 'arch';
  if (lens === 'structure') return 'struct';
  if (lens === 'mep') return 'mep';
  return 'all';
}

export function lensForWorkspace(id: WorkspaceId): LensMode {
  if (id === 'arch') return 'architecture';
  if (id === 'struct') return 'structure';
  if (id === 'mep') return 'mep';
  return 'all';
}

export function splitViewTabLabel(
  label: string,
  fallbackViewType?: string,
): { viewType: string; viewName?: string } {
  const separator = ' · ';
  const separatorIndex = label.indexOf(separator);
  if (separatorIndex === -1) {
    return fallbackViewType ? { viewType: fallbackViewType, viewName: label } : { viewType: label };
  }
  return {
    viewType: label.slice(0, separatorIndex),
    viewName: label.slice(separatorIndex + separator.length),
  };
}

export function disciplineScopeNote(
  activeWorkspaceId: WorkspaceId,
  selected: Element | undefined,
): string | null {
  const expected =
    activeWorkspaceId === 'struct'
      ? 'structure'
      : activeWorkspaceId === 'mep'
        ? 'mep'
        : activeWorkspaceId === 'arch'
          ? 'architecture'
          : null;
  const actual =
    selected && 'discipline' in selected && typeof selected.discipline === 'string'
      ? selected.discipline
      : null;
  if (!expected || !actual || expected === actual) return null;
  return 'This element is outside the active discipline scope; the comment will post with a scope note.';
}

export function formatStatusMm(mm: number): string {
  return `${(mm / 1000).toFixed(1)} m`;
}

export function summarizeJobsCounts(rows: unknown[]): typeof EMPTY_JOBS_COUNTS {
  const counts = { ...EMPTY_JOBS_COUNTS };
  for (const row of rows) {
    const status =
      row && typeof row === 'object' && 'status' in row
        ? String((row as { status?: unknown }).status ?? '')
        : '';
    if (status === 'queued') counts.queued += 1;
    else if (status === 'running') counts.running += 1;
    else if (status === 'errored') counts.errored += 1;
  }
  return counts;
}

export function slugToken(label: string): string {
  const slug = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'item';
}

export function firstMmVector(
  value: unknown,
): { xMm: number; yMm: number; zMm: number } | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const row = value as Record<string, unknown>;
  const xMm = Number(row.xMm);
  const yMm = Number(row.yMm);
  const zMm = Number(row.zMm);
  if (!Number.isFinite(xMm) || !Number.isFinite(yMm) || !Number.isFinite(zMm)) return undefined;
  return { xMm, yMm, zMm };
}
