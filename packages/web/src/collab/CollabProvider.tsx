import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';

import type { CollabAwarenessState, Participant } from '@bim-ai/core';
import { participantColorToken } from '@bim-ai/core';

export type CollabContextValue = {
  ydoc: Y.Doc;
  awareness: WebsocketProvider['awareness'] | null;
  participants: Participant[];
  localUserId: string;
  broadcastSelection: (selectedElementIds: string[]) => void;
  connected: boolean;
};

export const CollabContext = React.createContext<CollabContextValue | null>(null);

interface Props {
  modelId: string;
  userId: string;
  role: CollabAwarenessState['role'];
  children: React.ReactNode;
}

const MAX_RECONNECT_ATTEMPTS = 10;

export function CollabProvider({ modelId, userId, role, children }: Props) {
  const ydocRef = useRef<Y.Doc>(new Y.Doc());
  const providerRef = useRef<WebsocketProvider | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const mountedRef = useRef(true);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [connected, setConnected] = useState(false);

  const updateParticipants = useCallback((awareness: WebsocketProvider['awareness']) => {
    const states = Array.from(awareness.getStates().entries()) as Array<
      [number, CollabAwarenessState]
    >;
    const next: Participant[] = states
      .filter(([, s]) => s && s.userId)
      .map(([, s], idx) => ({
        userId: s.userId,
        role: s.role ?? 'viewer',
        color: `var(${participantColorToken(idx)})`,
        sessionStartedAt: Date.now(),
      }));
    setParticipants(next);
  }, []);

  const connect = useCallback(() => {
    if (!mountedRef.current) return;

    const p = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const url = `${p}://${window.location.host}/api/models/${encodeURIComponent(modelId)}/collab`;

    const provider = new WebsocketProvider(url, modelId, ydocRef.current, {
      connect: true,
      resyncInterval: -1,
    });
    providerRef.current = provider;

    provider.on('status', ({ status }: { status: string }) => {
      setConnected(status === 'connected');
      if (status === 'connected') {
        reconnectAttemptsRef.current = 0;
        provider.awareness.setLocalState({
          userId,
          role,
          color: `var(${participantColorToken(0)})`,
          selectedElementIds: [],
        } satisfies CollabAwarenessState);
      }
    });

    provider.awareness.on('change', () => {
      updateParticipants(provider.awareness);
    });

    provider.on('connection-close', () => {
      setConnected(false);
      if (!mountedRef.current) return;
      const attempt = reconnectAttemptsRef.current + 1;
      reconnectAttemptsRef.current = attempt;
      if (attempt > MAX_RECONNECT_ATTEMPTS) return;
      const base = Math.min(250 * 2 ** (attempt - 1), 8000);
      const jitter = base * 0.2 * (Math.random() * 2 - 1);
      setTimeout(
        () => {
          if (!mountedRef.current) return;
          providerRef.current?.destroy();
          connect();
        },
        Math.max(0, Math.round(base + jitter)),
      );
    });
  }, [modelId, userId, role, updateParticipants]);

  useEffect(() => {
    mountedRef.current = true;
    connect();
    return () => {
      mountedRef.current = false;
      providerRef.current?.destroy();
      providerRef.current = null;
    };
  }, [connect]);

  const broadcastSelection = useCallback((selectedElementIds: string[]) => {
    const provider = providerRef.current;
    if (!provider) return;
    const current = (provider.awareness.getLocalState() ?? {}) as CollabAwarenessState;
    provider.awareness.setLocalState({ ...current, selectedElementIds });
  }, []);

  const value = useMemo<CollabContextValue>(
    () => ({
      ydoc: ydocRef.current,
      awareness: providerRef.current?.awareness ?? null,
      participants,
      localUserId: userId,
      broadcastSelection,
      connected,
    }),
    [participants, userId, broadcastSelection, connected],
  );

  return <CollabContext.Provider value={value}>{children}</CollabContext.Provider>;
}

export function useCollab(): CollabContextValue {
  const ctx = React.useContext(CollabContext);
  if (!ctx) throw new Error('useCollab must be used within CollabProvider');
  return ctx;
}
