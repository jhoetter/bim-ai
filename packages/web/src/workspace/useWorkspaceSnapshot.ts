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
import { mapComments } from './workspaceUtils';

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

  const [seedLoading, setSeedLoading] = useState(false);
  const [seedError, setSeedError] = useState<string | null>(null);
  const [wsOn, setWsOn] = useState(false);
  const [codePresetIds, setCodePresetIds] = useState<string[]>([
    'residential',
    'commercial',
    'office',
  ]);
  const wsRef = useRef<WebSocket | null>(null);

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
      fetchActivity(mid)
        .then((a) => {
          const evs = ((a.events ?? []) as Record<string, unknown>[]).map((ev) => ({
            id: Number(ev.id),
            userId: String(ev.userId ?? ev.user_id ?? ''),
            revisionAfter: Number(ev.revisionAfter ?? ev.revision_after ?? 0),
            createdAt: String(ev.createdAt ?? ev.created_at ?? ''),
            commandTypes: Array.isArray(ev.commandTypes) ? ev.commandTypes.map(String) : [],
          }));
          setActivity(evs);
        })
        .catch((err) => log.error('insertSeedHouse', 'fetchActivity failed', err));
      fetchComments(mid)
        .then((c) => {
          setComments(mapComments((c.comments ?? []) as Record<string, unknown>[]));
        })
        .catch((err) => log.error('insertSeedHouse', 'fetchComments failed', err));
      const disableWs =
        typeof import.meta.env.VITE_E2E_DISABLE_WS === 'string' &&
        ['1', 'true', 'yes'].includes(import.meta.env.VITE_E2E_DISABLE_WS.trim().toLowerCase());
      if (!disableWs) {
        const p = window.location.protocol === 'https:' ? 'wss' : 'ws';
        const ws = new WebSocket(`${p}://${window.location.host}/ws/${encodeURIComponent(mid)}`);
        wsRef.current = ws;
        ws.onopen = () => setWsOn(true);
        ws.onclose = () => setWsOn(false);
        ws.onmessage = (evt) => {
          const payload = JSON.parse(String(evt.data)) as Record<string, unknown>;
          const t = payload.type;
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
          }
        };
      }
    } catch (err) {
      setSeedError(err instanceof Error ? err.message : 'Failed to load seed');
    } finally {
      setSeedLoading(false);
    }
  }, [hydrateFromSnapshot, setActivity, applyDelta, setPresencePeers, mergeComment, setComments]);

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
