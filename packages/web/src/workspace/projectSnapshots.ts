/**
 * Project snapshots — local-only persistence for T-03.
 *
 * Lets the user save the current model state to a JSON blob (download
 * to disk, or keep in localStorage as a "recent project") and restore
 * later. No backend involvement — for shared / collaborative state
 * the user still goes through `/api/bootstrap` + `applyCommand`.
 */

import type { Snapshot } from '@bim-ai/core';

const STORAGE_KEY = 'bim-ai:recent-projects-v1';

export interface ProjectSnapshotPayload {
  /** Schema version for future-proofing. */
  v: 1;
  /** Display label — falls back to a timestamp when not provided. */
  label: string;
  /** ISO 8601 capture timestamp. */
  capturedAt: string;
  /** The full Snapshot the store can hydrate from. */
  snapshot: Snapshot;
}

export interface RecentProject {
  id: string;
  label: string;
  capturedAt: string;
  payload: ProjectSnapshotPayload;
}

/** Build a Snapshot wrapper around the store's current state. */
export function buildSnapshotPayload(snapshot: Snapshot, label?: string): ProjectSnapshotPayload {
  const capturedAt = new Date().toISOString();
  return {
    v: 1,
    label: label ?? `Snapshot ${capturedAt.slice(0, 19).replace('T', ' ')}`,
    capturedAt,
    snapshot,
  };
}

/** Trigger a JSON file download in the browser. No-op in non-DOM env. */
export function downloadSnapshot(payload: ProjectSnapshotPayload): void {
  if (typeof document === 'undefined') return;
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${payload.label.replace(/[^a-z0-9-_ ]/gi, '_').slice(0, 64)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Read a File → ProjectSnapshotPayload. Throws on invalid input.
 * Falls back to `FileReader` when `File.text()` isn't available
 * (jsdom in vitest doesn't implement it). */
export async function readSnapshotFile(file: File): Promise<ProjectSnapshotPayload> {
  const text = typeof file.text === 'function' ? await file.text() : await readAsText(file);
  const parsed = JSON.parse(text) as Partial<ProjectSnapshotPayload>;
  if (!parsed || parsed.v !== 1 || !parsed.snapshot) {
    throw new Error('Snapshot file: unexpected schema. Expected v=1.');
  }
  return parsed as ProjectSnapshotPayload;
}

function readAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error ?? new Error('FileReader failed'));
    reader.readAsText(file);
  });
}

/** Read the recent-projects list from localStorage. */
export function readRecentProjects(): RecentProject[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as RecentProject[] | null;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isRecentProject).slice(0, 5);
  } catch {
    return [];
  }
}

/** Append a payload to the recent-projects list, deduped by label, capped at 5. */
export function pushRecentProject(payload: ProjectSnapshotPayload): RecentProject[] {
  const next: RecentProject = {
    id: `recent-${Date.now()}`,
    label: payload.label,
    capturedAt: payload.capturedAt,
    payload,
  };
  const existing = readRecentProjects().filter((p) => p.label !== payload.label);
  const merged = [next, ...existing].slice(0, 5);
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
    } catch {
      /* quota / private mode */
    }
  }
  return merged;
}

export function findRecentProject(id: string): RecentProject | null {
  return readRecentProjects().find((p) => p.id === id) ?? null;
}

function isRecentProject(p: unknown): p is RecentProject {
  if (!p || typeof p !== 'object') return false;
  const r = p as Record<string, unknown>;
  return (
    typeof r.id === 'string' &&
    typeof r.label === 'string' &&
    typeof r.capturedAt === 'string' &&
    !!r.payload
  );
}
