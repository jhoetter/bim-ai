import { create } from 'zustand';
import type { Milestone } from '@bim-ai/core';

type MilestoneState = {
  modelId: string | null;
  milestones: Milestone[];
  loading: boolean;
  fetchMilestones: (modelId: string) => Promise<void>;
  createMilestone: (
    modelId: string,
    name: string,
    snapshotId: string,
    authorId: string,
    description?: string,
  ) => Promise<Milestone>;
  deleteMilestone: (modelId: string, id: string) => Promise<void>;
  reset: () => void;
};

export const useMilestoneStore = create<MilestoneState>((set, get) => ({
  modelId: null,
  milestones: [],
  loading: false,

  async fetchMilestones(modelId: string) {
    set({ loading: true });
    try {
      const res = await fetch(`/api/models/${modelId}/milestones`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { milestones: Milestone[] };
      set({ modelId, milestones: data.milestones });
    } finally {
      set({ loading: false });
    }
  },

  async createMilestone(
    modelId: string,
    name: string,
    snapshotId: string,
    authorId: string,
    description?: string,
  ) {
    const res = await fetch(`/api/models/${modelId}/milestones`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, snapshotId, authorId, description }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const milestone = (await res.json()) as Milestone;
    if (get().modelId === modelId) {
      set((s) => ({ milestones: [milestone, ...s.milestones] }));
    }
    return milestone;
  },

  async deleteMilestone(modelId: string, id: string) {
    const res = await fetch(`/api/models/${modelId}/milestones/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    set((s) => ({ milestones: s.milestones.filter((m) => m.id !== id) }));
  },

  reset() {
    set({ modelId: null, milestones: [], loading: false });
  },
}));
