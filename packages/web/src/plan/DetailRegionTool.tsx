/**
 * ANN-V3-01 — Detail-region drawing-mode tool.
 *
 * Polyline click-to-draw on plan / section / drafting / callout views.
 * - Click to add vertices; R key mid-command toggles closed/open.
 * - Enter commits → create_detail_region command.
 * - Esc cancels and clears the transient.
 * - Shortcut: DR chord within 400 ms.
 * - OptionsBar slot: hatch picker (brick_45, concrete_dot, insulation_curve).
 */
import { useCallback, useEffect, useRef } from 'react';
import type { DraftDetailRegionElem } from '@bim-ai/core';

export type DetailRegionVertex = { x: number; y: number };

export type DetailRegionDraft = {
  vertices: DetailRegionVertex[];
  closed: boolean;
  hatchId: string | null;
};

export const SEED_HATCHES = ['brick_45', 'concrete_dot', 'insulation_curve'] as const;
export type SeedHatch = (typeof SEED_HATCHES)[number];

export function draftToDraftElem(draft: DetailRegionDraft, viewId: string): DraftDetailRegionElem {
  return {
    kind: 'draft_detail_region',
    viewId,
    vertices: draft.vertices,
    closed: draft.closed,
    hatchId: draft.hatchId,
  };
}

type UseDetailRegionToolOptions = {
  viewId: string;
  onCommit: (cmd: {
    type: 'create_detail_region';
    id: string;
    viewId: string;
    vertices: DetailRegionVertex[];
    closed: boolean;
    hatchId: string | null;
  }) => void;
  onDraftChange: (draft: DetailRegionDraft | null) => void;
};

export function useDetailRegionTool({
  viewId,
  onCommit,
  onDraftChange,
}: UseDetailRegionToolOptions) {
  const draftRef = useRef<DetailRegionDraft | null>(null);

  const reset = useCallback(() => {
    draftRef.current = null;
    onDraftChange(null);
  }, [onDraftChange]);

  const commit = useCallback(() => {
    const draft = draftRef.current;
    if (!draft || draft.vertices.length < 2) {
      reset();
      return;
    }
    onCommit({
      type: 'create_detail_region',
      id: crypto.randomUUID(),
      viewId,
      vertices: draft.vertices,
      closed: draft.closed,
      hatchId: draft.hatchId,
    });
    reset();
  }, [onCommit, viewId, reset]);

  const addVertex = useCallback(
    (p: DetailRegionVertex) => {
      if (!draftRef.current) {
        draftRef.current = { vertices: [p], closed: false, hatchId: null };
        onDraftChange({ ...draftRef.current });
        return;
      }
      const draft = draftRef.current;
      const fst = draft.vertices[0];
      if (fst && draft.vertices.length >= 3 && Math.hypot(p.x - fst.x, p.y - fst.y) < 520) {
        draft.closed = true;
        onDraftChange({ ...draft });
        commit();
        return;
      }
      draft.vertices.push(p);
      onDraftChange({ ...draft });
    },
    [commit, onDraftChange],
  );

  const toggleClosed = useCallback(() => {
    if (!draftRef.current) return;
    draftRef.current.closed = !draftRef.current.closed;
    onDraftChange({ ...draftRef.current });
  }, [onDraftChange]);

  const setHatchId = useCallback(
    (id: string | null) => {
      if (!draftRef.current) return;
      draftRef.current.hatchId = id;
      onDraftChange({ ...draftRef.current });
    },
    [onDraftChange],
  );

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        reset();
        return;
      }
      if (e.key === 'Enter') {
        commit();
        return;
      }
      if (e.key === 'r' || e.key === 'R') {
        toggleClosed();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [reset, commit, toggleClosed]);

  return { addVertex, commit, reset, toggleClosed, setHatchId };
}

/** OptionsBar hatch picker shown when the detail-region tool is active. */
export function DetailRegionOptionsBar({
  hatchId,
  onChange,
}: {
  hatchId: string | null;
  onChange: (id: string | null) => void;
}) {
  return (
    <div className="flex items-center gap-2 px-2">
      <span className="text-xs text-muted-foreground">Hatch:</span>
      {SEED_HATCHES.map((h) => (
        <button
          key={h}
          type="button"
          onClick={() => onChange(hatchId === h ? null : h)}
          className={[
            'rounded border px-2 py-0.5 text-xs',
            hatchId === h
              ? 'border-primary bg-primary/10 text-primary'
              : 'border-border hover:bg-accent/20 hover:text-foreground',
          ].join(' ')}
          title={h}
        >
          {h.replace(/_/g, ' ')}
        </button>
      ))}
    </div>
  );
}
