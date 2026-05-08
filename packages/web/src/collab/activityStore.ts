import { create } from 'zustand';
import type { ActivityRow } from '@bim-ai/core';

type ActivityState = {
  modelId: string | null;
  rows: ActivityRow[];
  loading: boolean;
  fetchMore: (modelId: string, before?: number) => Promise<void>;
  restore: (modelId: string, rowId: string) => Promise<ActivityRow>;
  reset: () => void;
};

export const useActivityStore = create<ActivityState>((set, get) => ({
  modelId: null,
  rows: [],
  loading: false,

  async fetchMore(modelId: string, before?: number) {
    set({ loading: true });
    try {
      const params = new URLSearchParams({ limit: '50' });
      if (before !== undefined) params.set('before', String(before));
      const res = await fetch(`/api/models/${modelId}/activity?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { rows: ActivityRow[] };
      const existing = get().modelId === modelId ? get().rows : [];
      const merged = before !== undefined ? [...existing, ...data.rows] : data.rows;
      set({ modelId, rows: merged });
    } finally {
      set({ loading: false });
    }
  },

  async restore(modelId: string, rowId: string) {
    const res = await fetch(`/api/models/${modelId}/activity/${rowId}/restore`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const newRow = (await res.json()) as ActivityRow;
    set((s) => ({ rows: [newRow, ...s.rows] }));
    return newRow;
  },

  reset() {
    set({ modelId: null, rows: [], loading: false });
  },
}));
