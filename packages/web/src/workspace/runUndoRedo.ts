import type { Element, Violation } from '@bim-ai/core';

import { ApiHttpError, fetchActivity, redoModel, undoModel } from '../lib/api';
import { useBimStore } from '../state/store';
import { syncLastLevelElevationPropagationFromApplyResponse } from './authoring';
import { buildCollaborationConflictQueueV1 } from '../lib/collaborationConflictQueue';
import { log } from '../logger';

interface ActivityRow {
  id: number;
  userId: string;
  revisionAfter: number;
  createdAt: string;
  commandTypes: string[];
}

export interface RunUndoRedoContext {
  hydrateFromSnapshot: (input: {
    modelId: string;
    revision: number;
    elements: Record<string, Element>;
    violations: Violation[];
  }) => void;
  setPendingCommandCount: (fn: (count: number) => number) => void;
  setUndoDepth: (fn: (d: number) => number) => void;
  setRedoDepth: (fn: (d: number) => number) => void;
  setActivity: (rows: ActivityRow[]) => void;
  setCollaborationConflictQueue: (
    queue: ReturnType<typeof buildCollaborationConflictQueueV1> | null,
  ) => void;
}

/**
 * Apply an undo or redo against the active model and re-hydrate the
 * client store from the returned snapshot. Refreshes the activity feed
 * and surfaces 409 conflicts via the collaboration-conflict queue.
 */
export async function runUndoRedo(ctx: RunUndoRedoContext, isUndo: boolean): Promise<void> {
  const {
    hydrateFromSnapshot,
    setPendingCommandCount,
    setUndoDepth,
    setRedoDepth,
    setActivity,
    setCollaborationConflictQueue,
  } = ctx;
  const mid = useBimStore.getState().modelId;
  const uid = useBimStore.getState().userId;
  if (!mid) return;
  setPendingCommandCount((count) => count + 1);
  try {
    const r = isUndo ? await undoModel(mid, uid) : await redoModel(mid, uid);
    if (r.revision !== undefined) {
      hydrateFromSnapshot({
        modelId: mid,
        revision: r.revision,
        elements: (r.elements ?? {}) as Record<string, Element>,
        violations: (r.violations ?? []) as Violation[],
      });
      syncLastLevelElevationPropagationFromApplyResponse(
        r as Parameters<typeof syncLastLevelElevationPropagationFromApplyResponse>[0],
      );
      setUndoDepth((d) => Math.max(0, d + (isUndo ? -1 : 1)));
      setRedoDepth((d) => Math.max(0, d + (isUndo ? 1 : -1)));
    }
    fetchActivity(mid)
      .then((a) => {
        const evs: ActivityRow[] = ((a.events ?? []) as Record<string, unknown>[]).map((ev) => ({
          id: Number(ev.id),
          userId: String(ev.userId ?? ev.user_id ?? ''),
          revisionAfter: Number(ev.revisionAfter ?? ev.revision_after ?? 0),
          createdAt: String(ev.createdAt ?? ev.created_at ?? ''),
          commandTypes: Array.isArray(ev.commandTypes) ? ev.commandTypes.map(String) : [],
        }));
        setActivity(evs);
      })
      .catch((err) => log.error('loadSnapshot', 'fetchActivity failed', err));
    setCollaborationConflictQueue(null);
  } catch (err) {
    if (err instanceof ApiHttpError && err.status === 409) {
      setCollaborationConflictQueue(buildCollaborationConflictQueueV1(err.detail));
    } else {
      setCollaborationConflictQueue(null);
    }
  } finally {
    setPendingCommandCount((count) => Math.max(0, count - 1));
  }
}
