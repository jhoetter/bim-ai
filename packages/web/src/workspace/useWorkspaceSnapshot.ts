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

export type SeedModelOption = {
  id: string;
  label: string;
  slug: string;
  projectTitle: string;
  revision: number;
};

function seedModelsFromBootstrap(bx: { projects?: Record<string, unknown>[] }): SeedModelOption[] {
  const rows: SeedModelOption[] = [];
  for (const project of bx.projects ?? []) {
    const projectTitle = String(project.title ?? project.slug ?? 'Seed Library');
    const models = Array.isArray(project.models) ? project.models : [];
    for (const model of models as Record<string, unknown>[]) {
      if (typeof model.id !== 'string') continue;
      const slug = String(model.slug ?? model.id);
      rows.push({
        id: model.id,
        slug,
        label: `${projectTitle} / ${slug}`,
        projectTitle,
        revision: Number(model.revision ?? 0),
      });
    }
  }
  return rows;
}

export function useWorkspaceSnapshot(): {
  insertSeedHouse: () => Promise<void>;
  loadSeedModel: (modelId: string) => Promise<void>;
  seedModels: SeedModelOption[];
  activeSeedLabel: string | null;
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
  const [seedModels, setSeedModels] = useState<SeedModelOption[]>([]);
  const [activeSeedLabel, setActiveSeedLabel] = useState<string | null>(null);
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

  const loadModelSnapshot = useCallback(
    async (mid: string, label: string | null): Promise<void> => {
      const snapRes = await fetch(
        `/api/models/${encodeURIComponent(mid)}/snapshot?expandLinks=true`,
      );
      if (!snapRes.ok) throw new Error(`snapshot ${snapRes.status}`);
      const snap = (await snapRes.json()) as Snapshot;
      hydrateFromSnapshot(snap);
      setActiveSeedLabel(label);
      // activityEvents/comments are populated by the modelId effect below.
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
      }
      wsRef.current = null;
      if (!DISABLE_WS) {
        const lastSeq = readLastSeq(mid);
        lastSeqRef.current = lastSeq;
        wsRef.current = connectWs(mid, lastSeq);
      }
    },
    [hydrateFromSnapshot, connectWs],
  );

  const insertSeedHouse = useCallback(async (): Promise<void> => {
    setSeedLoading(true);
    setSeedError(null);
    try {
      const bx = await bootstrap();
      const options = seedModelsFromBootstrap(bx);
      setSeedModels(options);
      const first = options[0];
      if (!first) {
        throw new Error(
          'No seed artifacts loaded. Create one, then run make seed name=<seed-name>.',
        );
      }
      await loadModelSnapshot(first.id, first.label);
    } catch (err) {
      setSeedError(err instanceof Error ? err.message : 'Failed to load seed');
    } finally {
      setSeedLoading(false);
    }
  }, [loadModelSnapshot]);

  const loadSeedModel = useCallback(
    async (mid: string): Promise<void> => {
      setSeedLoading(true);
      setSeedError(null);
      try {
        let options = seedModels;
        if (!options.some((option) => option.id === mid)) {
          const bx = await bootstrap();
          options = seedModelsFromBootstrap(bx);
          setSeedModels(options);
        }
        const selected = options.find((option) => option.id === mid);
        if (!selected) throw new Error(`Seed model not found: ${mid}`);
        await loadModelSnapshot(selected.id, selected.label);
      } catch (err) {
        setSeedError(err instanceof Error ? err.message : 'Failed to load seed model');
      } finally {
        setSeedLoading(false);
      }
    },
    [loadModelSnapshot, seedModels],
  );

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

  return {
    insertSeedHouse,
    loadSeedModel,
    seedModels,
    activeSeedLabel,
    seedLoading,
    seedError,
    setSeedError,
    wsOn,
    codePresetIds,
  };
}
