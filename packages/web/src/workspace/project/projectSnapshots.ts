/**
 * Project snapshots — local-only persistence for T-03.
 *
 * Lets the user save the current model state to a JSON blob (download
 * to disk, or keep in localStorage as a "recent project") and restore
 * later. No backend involvement — for shared / collaborative state
 * the user still goes through `/api/bootstrap` + `applyCommand`.
 */

import type { Snapshot } from '@bim-ai/core';
import {
  coerceCheckpointRetentionLimit,
  DEFAULT_CHECKPOINT_RETENTION_LIMIT,
} from '../../state/backupRetention';

const STORAGE_KEY = 'bim-ai:recent-projects-v1';
const ROLLING_BACKUP_STORAGE_KEY = 'bim-ai:rolling-snapshot-backups-v1';

export interface ProjectSnapshotPayload {
  /** Schema version for future-proofing. */
  v: 1;
  /** Display label — falls back to a timestamp when not provided. */
  label: string;
  /** ISO 8601 capture timestamp. */
  capturedAt: string;
  /** The full Snapshot the store can hydrate from. */
  snapshot: Snapshot;
  /** Revit Save As Options parity metadata for local snapshot exports. */
  saveAsOptions?: SnapshotSaveAsOptions;
}

export interface RecentProject {
  id: string;
  label: string;
  capturedAt: string;
  payload: ProjectSnapshotPayload;
}

export interface SnapshotSaveAsOptions {
  maximumBackups: number;
  backupOrdinal?: number;
  backupLabel?: string;
}

export interface RollingSnapshotBackup {
  id: string;
  projectKey: string;
  ordinal: number;
  label: string;
  capturedAt: string;
  payload: ProjectSnapshotPayload;
}

/** Build a Snapshot wrapper around the store's current state. */
export function buildSnapshotPayload(
  snapshot: Snapshot,
  label?: string,
  saveAsOptions?: Partial<SnapshotSaveAsOptions>,
): ProjectSnapshotPayload {
  const capturedAt = new Date().toISOString();
  const maximumBackups = coerceCheckpointRetentionLimit(saveAsOptions?.maximumBackups);
  return {
    v: 1,
    label: label ?? `Snapshot ${capturedAt.slice(0, 19).replace('T', ' ')}`,
    capturedAt,
    snapshot,
    saveAsOptions: {
      maximumBackups,
      ...(saveAsOptions?.backupOrdinal
        ? { backupOrdinal: coerceBackupOrdinal(saveAsOptions.backupOrdinal, maximumBackups) }
        : {}),
      ...(saveAsOptions?.backupLabel ? { backupLabel: saveAsOptions.backupLabel } : {}),
    },
  };
}

/** Trigger a JSON file download in the browser. No-op in non-DOM env. */
export function downloadSnapshot(payload: ProjectSnapshotPayload): void {
  if (typeof document === 'undefined') return;
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = buildSnapshotFilename(payload);
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

export function readRollingSnapshotBackups(): RollingSnapshotBackup[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(ROLLING_BACKUP_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as RollingSnapshotBackup[] | null;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isRollingSnapshotBackup);
  } catch {
    return [];
  }
}

export function pushRollingSnapshotBackup(
  payload: ProjectSnapshotPayload,
  maximumBackups = payload.saveAsOptions?.maximumBackups ?? DEFAULT_CHECKPOINT_RETENTION_LIMIT,
): { payload: ProjectSnapshotPayload; backups: RollingSnapshotBackup[] } {
  const cappedLimit = coerceCheckpointRetentionLimit(maximumBackups);
  const projectKey = snapshotProjectKey(payload.snapshot);
  const existing = readRollingSnapshotBackups();
  const sameProject = existing.filter((b) => b.projectKey === projectKey);
  const otherProjects = existing.filter((b) => b.projectKey !== projectKey);
  const ordinal = nextBackupOrdinal(sameProject, cappedLimit);
  const payloadWithBackup: ProjectSnapshotPayload = {
    ...payload,
    saveAsOptions: {
      ...(payload.saveAsOptions ?? {}),
      maximumBackups: cappedLimit,
      backupOrdinal: ordinal,
      backupLabel: formatBackupLabel(payload.label, ordinal),
    },
  };
  const next: RollingSnapshotBackup = {
    id: `${projectKey}.${String(ordinal).padStart(4, '0')}`,
    projectKey,
    ordinal,
    label: payloadWithBackup.saveAsOptions?.backupLabel ?? payload.label,
    capturedAt: payload.capturedAt,
    payload: payloadWithBackup,
  };
  const projectBackups = [next, ...sameProject.filter((b) => b.ordinal !== ordinal)].slice(
    0,
    cappedLimit,
  );
  const backups = [...projectBackups, ...otherProjects];
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(ROLLING_BACKUP_STORAGE_KEY, JSON.stringify(backups));
    } catch {
      /* quota / private mode */
    }
  }
  return { payload: payloadWithBackup, backups };
}

export function buildSnapshotFilename(payload: ProjectSnapshotPayload): string {
  const base = payload.label.replace(/[^a-z0-9-_ ]/gi, '_').slice(0, 64) || 'Snapshot';
  const ordinal = payload.saveAsOptions?.backupOrdinal;
  if (!ordinal) return `${base}.json`;
  return `${base}.${String(ordinal).padStart(4, '0')}.json`;
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

function isRollingSnapshotBackup(p: unknown): p is RollingSnapshotBackup {
  if (!p || typeof p !== 'object') return false;
  const r = p as Record<string, unknown>;
  return (
    typeof r.id === 'string' &&
    typeof r.projectKey === 'string' &&
    typeof r.ordinal === 'number' &&
    typeof r.label === 'string' &&
    typeof r.capturedAt === 'string' &&
    !!r.payload
  );
}

function snapshotProjectKey(snapshot: Snapshot): string {
  return String(snapshot.modelId || 'local-project');
}

function nextBackupOrdinal(backups: RollingSnapshotBackup[], maximumBackups: number): number {
  if (backups.length === 0) return 1;
  const maxOrdinal = backups.reduce((max, backup) => Math.max(max, backup.ordinal), 0);
  return (maxOrdinal % maximumBackups) + 1;
}

function coerceBackupOrdinal(value: unknown, maximumBackups: number): number {
  const n = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(n)) return 1;
  return Math.min(maximumBackups, Math.max(1, Math.round(n)));
}

function formatBackupLabel(label: string, ordinal: number): string {
  return `${label}.${String(ordinal).padStart(4, '0')}`;
}
