/**
 * EDT-05 — per-snap-type toggle persistence.
 *
 * Reads / writes a JSON blob in localStorage so user-toggled snap
 * preferences survive a page reload. Keys mirror `SnapKind` from
 * `snapEngine.ts`. Tangent is reserved for when curved geometry lands
 * but is exposed here so the toolbar checkbox does not need a future
 * schema bump.
 */
import type { SnapKind } from './snapEngine';

export type ToggleableSnapKind =
  | 'endpoint'
  | 'midpoint'
  | 'intersection'
  | 'perpendicular'
  | 'extension'
  | 'grid';

export type SnapSettings = Record<ToggleableSnapKind, boolean>;

export const DEFAULT_SNAP_SETTINGS: SnapSettings = {
  endpoint: true,
  midpoint: true,
  intersection: true,
  perpendicular: true,
  extension: true,
  grid: true,
};

const STORAGE_KEY = 'bim-ai.plan.snapSettings.v1';

export function loadSnapSettings(storage: Storage | undefined = safeLocalStorage()): SnapSettings {
  if (!storage) return { ...DEFAULT_SNAP_SETTINGS };
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SNAP_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<SnapSettings>;
    const out: SnapSettings = { ...DEFAULT_SNAP_SETTINGS };
    for (const k of Object.keys(DEFAULT_SNAP_SETTINGS) as ToggleableSnapKind[]) {
      if (typeof parsed[k] === 'boolean') out[k] = parsed[k];
    }
    return out;
  } catch {
    return { ...DEFAULT_SNAP_SETTINGS };
  }
}

export function saveSnapSettings(
  next: SnapSettings,
  storage: Storage | undefined = safeLocalStorage(),
): void {
  if (!storage) return;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Quota or privacy mode — ignore; the in-memory copy still works.
  }
}

/** Filter snap candidates by the user's enabled-kind toggles. */
export function applySnapSettings<T extends { kind: SnapKind }>(
  candidates: T[],
  settings: SnapSettings,
): T[] {
  return candidates.filter((c) => {
    switch (c.kind) {
      case 'endpoint':
        return settings.endpoint;
      case 'intersection':
        return settings.intersection;
      case 'perpendicular':
        return settings.perpendicular;
      case 'extension':
        return settings.extension;
      case 'grid':
        return settings.grid;
      case 'tangent':
      case 'raw':
        return true;
    }
  });
}

function safeLocalStorage(): Storage | undefined {
  try {
    return typeof window !== 'undefined' ? window.localStorage : undefined;
  } catch {
    return undefined;
  }
}
