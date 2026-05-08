import { create } from 'zustand';

type ActivityDrawerState = {
  isOpen: boolean;
  lastSeenAt: number;
  toggle: () => void;
  open: () => void;
  close: () => void;
  markSeen: () => void;
};

export const useActivityDrawerStore = create<ActivityDrawerState>((set) => ({
  isOpen: false,
  lastSeenAt: Date.now(),
  toggle: () =>
    set((s) => (s.isOpen ? { isOpen: false } : { isOpen: true, lastSeenAt: Date.now() })),
  open: () => set({ isOpen: true, lastSeenAt: Date.now() }),
  close: () => set({ isOpen: false }),
  markSeen: () => set({ lastSeenAt: Date.now() }),
}));
