import { create } from 'zustand';

type OfflineStore = {
  isOnline: boolean;
  pendingCommandCount: number;
  lastSyncedAt: string | null;
  offlineQueuedAt: string | null;
  setOnline: (online: boolean) => void;
  incrementPendingCount: () => void;
  clearPendingCount: () => void;
  setLastSyncedAt: (ts: string) => void;
};

export const useOfflineStore = create<OfflineStore>((set) => ({
  isOnline: navigator.onLine,
  pendingCommandCount: 0,
  lastSyncedAt: null,
  offlineQueuedAt: null,
  setOnline: (isOnline) =>
    set((s) => ({
      isOnline,
      offlineQueuedAt:
        !isOnline && s.isOnline ? new Date().toISOString() : s.offlineQueuedAt,
    })),
  incrementPendingCount: () =>
    set((s) => ({ pendingCommandCount: s.pendingCommandCount + 1 })),
  clearPendingCount: () =>
    set({ pendingCommandCount: 0, lastSyncedAt: new Date().toISOString() }),
  setLastSyncedAt: (ts) => set({ lastSyncedAt: ts }),
}));

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => useOfflineStore.getState().setOnline(true));
  window.addEventListener('offline', () => useOfflineStore.getState().setOnline(false));
}
