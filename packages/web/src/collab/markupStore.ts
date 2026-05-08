import { create } from 'zustand';
import type { Markup } from '@bim-ai/core';

interface MarkupState {
  modelId: string | null;
  markups: Markup[];
  load: (modelId: string) => Promise<void>;
  addMarkup: (markup: Markup) => void;
  resolveMarkup: (id: string) => Promise<void>;
  deleteMarkup: (id: string) => Promise<void>;
}

export const useMarkupStore = create<MarkupState>((set, get) => ({
  modelId: null,
  markups: [],

  async load(modelId: string) {
    const res = await fetch(`/api/models/${modelId}/markups`);
    if (!res.ok) return;
    const data = (await res.json()) as { markups: Markup[] };
    set({ modelId, markups: data.markups });
  },

  addMarkup(markup: Markup) {
    set((state) => ({ markups: [...state.markups, markup] }));
  },

  async resolveMarkup(id: string) {
    const { modelId } = get();
    if (!modelId) return;
    const res = await fetch(`/api/models/${modelId}/markups/${id}/resolve`, { method: 'PATCH' });
    if (!res.ok) return;
    const updated = (await res.json()) as Markup;
    set((state) => ({
      markups: state.markups.map((m) => (m.id === id ? updated : m)),
    }));
  },

  async deleteMarkup(id: string) {
    const { modelId } = get();
    if (!modelId) return;
    const res = await fetch(`/api/models/${modelId}/markups/${id}`, { method: 'DELETE' });
    if (!res.ok) return;
    set((state) => ({ markups: state.markups.filter((m) => m.id !== id) }));
  },
}));
