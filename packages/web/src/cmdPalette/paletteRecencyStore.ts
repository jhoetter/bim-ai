import { create } from 'zustand';

import {
  CAPABILITY_VIEW_MODES,
  getCommandCapability,
  type CapabilityViewMode,
} from '../workspace/commandCapabilities';
import type { PaletteContext } from './registry';

const STORAGE_KEY = 'bim.cmdPalette.recency';
const MAX_ENTRIES = 100;
const DECAY_DAYS = 14;
export const GLOBAL_RECENCY_SCOPE = 'global';

type InvocationRecord = { ts: number; count: number };

interface PaletteRecencyState {
  invocations: Record<string, InvocationRecord>;
  recordInvocation: (id: string, scope?: string) => void;
  getRecencyScore: (id: string, scope?: string, now?: number) => number;
}

function isUniversalCapability(id: string): boolean {
  const capability = getCommandCapability(id);
  if (!capability) return id.startsWith('navigate.') || id.startsWith('view.');
  return CAPABILITY_VIEW_MODES.every((mode: CapabilityViewMode) =>
    capability.intendedModes.includes(mode),
  );
}

export function paletteRecencyKey(id: string, scope = GLOBAL_RECENCY_SCOPE): string {
  return scope === GLOBAL_RECENCY_SCOPE ? id : `${scope}::${id}`;
}

export function paletteRecencyScopeForCommand(
  id: string,
  context: Pick<PaletteContext, 'activeMode' | 'activeViewId'>,
): string {
  if (isUniversalCapability(id)) return GLOBAL_RECENCY_SCOPE;
  if (context.activeViewId) return `view:${context.activeViewId}`;
  if (context.activeMode) return `mode:${context.activeMode}`;
  return GLOBAL_RECENCY_SCOPE;
}

function loadFromStorage(): Record<string, InvocationRecord> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, InvocationRecord>) : {};
  } catch {
    return {};
  }
}

function saveToStorage(invocations: Record<string, InvocationRecord>): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(invocations));
  } catch {
    // Quota exceeded — silently skip.
  }
}

export const usePaletteRecencyStore = create<PaletteRecencyState>((set, get) => ({
  invocations: loadFromStorage(),

  recordInvocation(id: string, scope = GLOBAL_RECENCY_SCOPE) {
    set((state) => {
      const key = paletteRecencyKey(id, scope);
      const prev = state.invocations[key];
      const updated: Record<string, InvocationRecord> = {
        ...state.invocations,
        [key]: { ts: Date.now(), count: (prev?.count ?? 0) + 1 },
      };
      const keys = Object.keys(updated);
      if (keys.length > MAX_ENTRIES) {
        keys.sort((a, b) => updated[a]!.ts - updated[b]!.ts);
        for (const k of keys.slice(0, keys.length - MAX_ENTRIES)) {
          delete updated[k];
        }
      }
      saveToStorage(updated);
      return { invocations: updated };
    });
  },

  getRecencyScore(id: string, scope = GLOBAL_RECENCY_SCOPE, now?: number): number {
    const rec = get().invocations[paletteRecencyKey(id, scope)];
    if (!rec) return 0;
    const elapsed = (now ?? Date.now()) - rec.ts;
    const halfLifeMs = DECAY_DAYS * 24 * 3600 * 1000;
    return rec.count * Math.exp((-Math.LN2 * elapsed) / halfLifeMs);
  },
}));
