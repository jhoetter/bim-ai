import { beforeEach, describe, expect, it } from 'vitest';

import type { SnapHit } from './snapEngine';
import {
  applySnapSettings,
  DEFAULT_SNAP_SETTINGS,
  loadSnapSettings,
  saveSnapSettings,
  type SnapSettings,
} from './snapSettings';

function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (k) => (map.has(k) ? map.get(k)! : null),
    key: (i) => Array.from(map.keys())[i] ?? null,
    removeItem: (k) => {
      map.delete(k);
    },
    setItem: (k, v) => {
      map.set(k, v);
    },
  };
}

describe('EDT-05 — snapSettings', () => {
  let storage: Storage;
  beforeEach(() => {
    storage = memoryStorage();
  });

  it('returns defaults when storage is empty', () => {
    expect(loadSnapSettings(storage)).toEqual(DEFAULT_SNAP_SETTINGS);
  });

  it('roundtrips a custom snap settings blob', () => {
    const next: SnapSettings = {
      ...DEFAULT_SNAP_SETTINGS,
      perpendicular: false,
      extension: false,
    };
    saveSnapSettings(next, storage);
    expect(loadSnapSettings(storage)).toEqual(next);
  });

  it('falls back to defaults on malformed JSON', () => {
    storage.setItem('bim-ai.plan.snapSettings.v1', 'not-json{');
    expect(loadSnapSettings(storage)).toEqual(DEFAULT_SNAP_SETTINGS);
  });

  it('ignores unknown keys', () => {
    storage.setItem(
      'bim-ai.plan.snapSettings.v1',
      JSON.stringify({ endpoint: false, banana: true }),
    );
    const out = loadSnapSettings(storage);
    expect(out.endpoint).toBe(false);
    expect(out.intersection).toBe(true); // default preserved
    expect((out as Record<string, unknown>).banana).toBeUndefined();
  });
});

describe('EDT-05 — applySnapSettings', () => {
  const HITS: SnapHit[] = [
    { kind: 'endpoint', point: { xMm: 0, yMm: 0 } },
    { kind: 'perpendicular', point: { xMm: 1, yMm: 1 } },
    { kind: 'intersection', point: { xMm: 2, yMm: 2 } },
    { kind: 'extension', point: { xMm: 3, yMm: 3 } },
    { kind: 'grid', point: { xMm: 4, yMm: 4 } },
  ];

  it('drops the kinds the user has disabled', () => {
    const settings: SnapSettings = {
      ...DEFAULT_SNAP_SETTINGS,
      perpendicular: false,
      extension: false,
    };
    const filtered = applySnapSettings(HITS, settings);
    expect(filtered.map((h) => h.kind)).toEqual(['endpoint', 'intersection', 'grid']);
  });

  it('keeps all kinds when every toggle is on', () => {
    const filtered = applySnapSettings(HITS, DEFAULT_SNAP_SETTINGS);
    expect(filtered.length).toBe(HITS.length);
  });
});
