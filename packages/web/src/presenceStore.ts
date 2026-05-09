/**
 * COL-V3-04 — presence store.
 *
 * Holds the participant strip state. Updated by the collab transport layer
 * (WebSocket awareness, REST fallback). Consumed by ParticipantStrip.
 */
import { create } from 'zustand';
import type { Participant } from '@bim-ai/core';

type PresenceStore = {
  participants: Participant[];
  localUserId: string | null;
  setParticipants: (participants: Participant[]) => void;
  setLocalUserId: (userId: string) => void;
  addParticipant: (p: Participant) => void;
  removeParticipant: (userId: string) => void;
  updateParticipant: (userId: string, patch: Partial<Participant>) => void;
};

export const usePresenceStore = create<PresenceStore>((set) => ({
  participants: [],
  localUserId: null,
  setParticipants: (participants) => set({ participants }),
  setLocalUserId: (localUserId) => set({ localUserId }),
  addParticipant: (p) =>
    set((s) => ({ participants: [...s.participants.filter((x) => x.userId !== p.userId), p] })),
  removeParticipant: (userId) =>
    set((s) => ({ participants: s.participants.filter((p) => p.userId !== userId) })),
  updateParticipant: (userId, patch) =>
    set((s) => ({
      participants: s.participants.map((p) => (p.userId === userId ? { ...p, ...patch } : p)),
    })),
}));
