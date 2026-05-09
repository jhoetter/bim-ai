import { useCallback, useEffect, useRef, useState } from 'react';

import type { Snapshot } from '@bim-ai/core';

import {
  bootstrap,
  coerceDelta,
  fetchActivity,
  fetchBuildingPresets,
  fetchComments,
} from '../lib/api';
import { log } from '../logger';
import { useBimStore } from '../state/store';
import { MAX_WS_RECONNECT_ATTEMPTS, reconnectDelayMs } from '../lib/wsReconnect';
import { mapComments } from './workspaceUtils';

const DISABLE_WS =
  typeof import.meta.env.VITE_E2E_DISABLE_WS === 'string' &&
  ['1', 'true', 'yes'].includes(import.meta.env.VITE_E2E_DISABLE_WS.trim().toLowerCase());

function lastSeqStorageKey(modelId: string): string {
  return `bim.ws.lastSeq.${modelId}`;
}

function readLastSeq(modelId: string): number | null {
  try {
    const raw = sessionStorage.getItem(lastSeqStorageKey(modelId));
    if (!raw) return null;
    const parsed = Number(raw);
    return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
  } catch {
    return null;
  }
}

function writeLastSeq(modelId: string, seq: number): void {
  try {
    sessionStorage.setItem(lastSeqStorageKey(modelId), String(seq));
  } catch {
    /* noop */
  }
}

function clearLastSeq(modelId: string): void {
  try {
    sessionStorage.removeItem(lastSeqStorageKey(modelId));
  } catch {
    /* noop */
  }
}

export function useWorkspaceSnapshot(): {
  insertSeedHouse: () => Promise<void>;
  seedLoading: boolean;
  seedError: string | null;
  setSeedError: (err: string | null) => void;
  wsOn: boolean;
  codePresetIds: string[];
} {
  const hydrateFromSnapshot = useBimStore((s) => s.hydrateFromSnapshot);
  const setActivity = useBimStore((s) => s.setActivity);
  const applyDelta = useBimStore((s) => s.applyDelta);
  const setPresencePeers = useBimStore((s) => s.setPresencePeers);
  const mergeComment = useBimStore((s) => s.mergeComment);
  const setComments = useBimStore((s) => s.setComments);
  const elementsById = useBimStore((s) => s.elementsById);
  const modelId = useBimStore((s) => s.modelId);

  const [seedLoading, setSeedLoading] = useState(false);
  const [seedError, setSeedError] = useState<string | null>(null);
  const [wsOn, setWsOn] = useState(false);
  const [codePresetIds, setCodePresetIds] = useState<string[]>([
    'residential',
    'commercial',
    'office',
  ]);
  const wsRef = useRef<WebSocket | null>(null);
  const lastSeqRef = useRef<number | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  const connectWs = useCallback(
    (mid: string, lastSeq: number | null): WebSocket => {
      const p = window.location.protocol === 'https:' ? 'wss' : 'ws';
      const resumeParam = lastSeq !== null ? `?resumeFrom=${lastSeq}` : '';
      const ws = new WebSocket(
        `${p}://${window.location.host}/ws/${encodeURIComponent(mid)}${resumeParam}`,
      );

      ws.onopen = () => {
        reconnectAttemptsRef.current = 0;
        setWsOn(true);
      };

      ws.onclose = () => {
        setWsOn(false);
        if (DISABLE_WS || !mountedRef.current) return;

        const attempt = reconnectAttemptsRef.current + 1;
        reconnectAttemptsRef.current = attempt;

        if (attempt > MAX_WS_RECONNECT_ATTEMPTS) {
          console.warn('[bim-ai/ws] offline: max reconnect attempts reached');
          return;
        }

        const delay = reconnectDelayMs(attempt);

        const doReconnect = () => {
          if (!mountedRef.current) return;
          wsRef.current?.close();
          wsRef.current = connectWs(mid, lastSeqRef.current);
        };

        if (document.visibilityState === 'hidden') {
          const onVisible = () => {
            if (document.visibilityState !== 'hidden') {
              document.removeEventListener('visibilitychange', onVisible);
              doReconnect();
            }
          };
          document.addEventListener('visibilitychange', onVisible);
        } else {
          reconnectTimerRef.current = setTimeout(doReconnect, delay);
        }
      };

      ws.onmessage = (evt) => {
        let payload: Record<string, unknown>;
        try {
          payload = JSON.parse(String(evt.data)) as Record<string, unknown>;
        } catch (err) {
          log.error('ws', 'ignored malformed websocket frame', err);
          return;
        }
        const t = payload.type;

        const seq = payload.seq;
        if (typeof seq === 'number') {
          lastSeqRef.current = seq;
          writeLastSeq(mid, seq);
        }

        if (t === 'snapshot') {
          const s = payload as unknown as Snapshot;
          if (s.modelId) hydrateFromSnapshot(s);
        } else if (t === 'delta') {
          const dd = coerceDelta(payload);
          if (dd) applyDelta(dd);
        } else if (t === 'presence_state') {
          const pl = payload.payload as Record<string, unknown> | undefined;
          const px = ((pl?.peers as Record<string, unknown>) ?? {}) as Parameters<
            typeof setPresencePeers
          >[0];
          setPresencePeers(px);
        } else if (t === 'comment_event') {
          const w = payload.payload as Record<string, unknown> | undefined;
          if (!w) return;
          mergeComment(mapComments([w])[0]!);
        } else if (t === 'RESYNC') {
          void (async () => {
            try {
              const snapRes = await fetch(
                `/api/models/${encodeURIComponent(mid)}/snapshot?expandLinks=true`,
              );
              if (!snapRes.ok) throw new Error(`snapshot ${snapRes.status}`);
              const snap = (await snapRes.json()) as Snapshot;
              hydrateFromSnapshot(snap);
              lastSeqRef.current = null;
              clearLastSeq(mid);
            } catch (err) {
              log.error('ws', 'RESYNC snapshot fetch failed', err);
            }
          })();
        } else if (t === 'replay_done') {
          log.info('ws', 'replay_done received');
        }
      };

      return ws;
    },
    [hydrateFromSnapshot, applyDelta, setPresencePeers, mergeComment],
  );

  const insertSeedHouse = useCallback(async (): Promise<void> => {
    setSeedLoading(true);
    setSeedError(null);
    try {
      const bx = await bootstrap();
      const pj = bx.projects as Record<string, unknown>[] | undefined;
      const m0 = pj?.[0]?.models as Array<{ id?: unknown }> | undefined;
      const mid = m0?.[0]?.id;
      if (typeof mid !== 'string') throw new Error('No models — run make seed');
      const snapRes = await fetch(
        `/api/models/${encodeURIComponent(mid)}/snapshot?expandLinks=true`,
      );
      if (!snapRes.ok) throw new Error(`snapshot ${snapRes.status}`);
      const snap = (await snapRes.json()) as Snapshot;
      hydrateFromSnapshot(snap);
      // activityEvents/comments are populated by the modelId effect below — they
      // are model-scoped server state and must invalidate together with modelId.
      if (!DISABLE_WS) {
        const lastSeq = readLastSeq(mid);
        lastSeqRef.current = lastSeq;
        wsRef.current = connectWs(mid, lastSeq);
      }
    } catch (err) {
      setSeedError(err instanceof Error ? err.message : 'Failed to load seed');
    } finally {
      setSeedLoading(false);
    }
  }, [hydrateFromSnapshot, connectWs]);

  // modelId is the cache key for server-fetched, model-scoped state. Whenever
  // it changes, prior activity/comments must be cleared (so the previous
  // model's history doesn't bleed into the new one) and refetched. Empty/unset
  // modelIds clear without fetching.
  useEffect(() => {
    setActivity([]);
    setComments([]);
    if (!modelId || modelId === 'empty') return;
    let cancelled = false;
    void fetchActivity(modelId)
      .then((a) => {
        if (cancelled) return;
        const evs = ((a.events ?? []) as Record<string, unknown>[]).map((ev) => ({
          id: Number(ev.id),
          userId: String(ev.userId ?? ev.user_id ?? ''),
          revisionAfter: Number(ev.revisionAfter ?? ev.revision_after ?? 0),
          createdAt: String(ev.createdAt ?? ev.created_at ?? ''),
          commandTypes: Array.isArray(ev.commandTypes) ? ev.commandTypes.map(String) : [],
        }));
        setActivity(evs);
      })
      .catch((err) => log.error('modelId', 'fetchActivity failed', err));
    void fetchComments(modelId)
      .then((c) => {
        if (cancelled) return;
        setComments(mapComments((c.comments ?? []) as Record<string, unknown>[]));
      })
      .catch((err) => log.error('modelId', 'fetchComments failed', err));
    return () => {
      cancelled = true;
    };
  }, [modelId, setActivity, setComments]);

  useEffect(() => {
    void fetchBuildingPresets()
      .then((ids) => {
        if (ids.length) setCodePresetIds(ids);
      })
      .catch((err) => log.error('bootstrap', 'fetchBuildingPresets failed', err));
  }, []);

  useEffect(() => {
    const isEmpty = Object.keys(elementsById).length === 0;
    if (!isEmpty) return;
    void insertSeedHouse();
    return () => {
      mountedRef.current = false;
      reconnectAttemptsRef.current = Infinity;
      if (reconnectTimerRef.current !== null) clearTimeout(reconnectTimerRef.current);
      wsRef.current?.close();
      wsRef.current = null;
    };
    // Run-once bootstrap: re-running is the user's job via the empty-state CTA.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Presence heartbeat — sends viewer/selection state to collaborators every ~2.3s
  useEffect(() => {
    const id = window.setInterval(() => {
      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) return;
      const st = useBimStore.getState();
      ws.send(
        JSON.stringify({
          type: 'presence_update',
          peerId: st.peerId,
          userId: st.userId,
          name: st.userDisplayName,
          selectionId: st.selectedId,
          viewer: st.viewerMode,
        }),
      );
    }, 2300);
    return () => window.clearInterval(id);
  }, []);

  return { insertSeedHouse, seedLoading, seedError, setSeedError, wsOn, codePresetIds };
}
