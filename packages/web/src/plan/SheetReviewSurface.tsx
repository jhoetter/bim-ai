import { useCallback, useEffect, useRef, useState, type JSX, type MouseEvent } from 'react';

import type { Comment, Element, Markup, SheetAnchor } from '@bim-ai/core';

import { SheetCanvas } from '../workspace/sheets';
import { CommentsPanel } from '../workspace/comments';
import { MarkupCanvas } from '../collab/MarkupCanvas';
import { useBimStore, type UxComment } from '../state/store';
import type { SheetMarkupShape, SheetReviewMode } from '../workspace/sheets/sheetReviewUi';

type PixelMapEntry = { sourceViewId: string; sourceElementId?: string };
type PixelMapCache = { map: Record<string, PixelMapEntry>; expiresAt: number };

const PIXEL_MAP_TTL_MS = 30_000;

export type SheetReviewSurfaceProps = {
  sheetId: string;
  modelId: string;
  readOnly?: boolean;
  elementsById: Record<string, Element>;
  onUpsertSemantic?: (cmd: Record<string, unknown>) => void;
  reviewMode?: SheetReviewMode;
  markupShape?: SheetMarkupShape;
};

export function SheetReviewSurface({
  sheetId,
  modelId,
  readOnly = false,
  elementsById,
  onUpsertSemantic,
  reviewMode,
  markupShape,
}: SheetReviewSurfaceProps): JSX.Element {
  const userId = useBimStore((s) => s.userId);
  const userDisplayName = useBimStore((s) => s.userDisplayName);
  const [comments, setComments] = useState<Comment[]>([]);
  const [markups, setMarkups] = useState<Markup[]>([]);
  const [canvasDims, setCanvasDims] = useState({ width: 0, height: 0 });
  const [activePinId, setActivePinId] = useState<string | null>(null);
  const [pendingPin, setPendingPin] = useState<{ xPx: number; yPx: number } | null>(null);
  const pixelMapCacheRef = useRef<PixelMapCache | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const activeMode = reviewMode ?? 'cm';
  const activeMarkupShape = markupShape ?? 'freehand';

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setCanvasDims({ width: entry.contentRect.width, height: entry.contentRect.height });
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const handleStrokeComplete = useCallback(
    (pathPx: Array<{ xPx: number; yPx: number }>) => {
      const shape =
        activeMarkupShape === 'cloud'
          ? { kind: 'cloud' as const, pointsMm: pathPx.map((p) => ({ xMm: p.xPx, yMm: p.yPx })) }
          : {
              kind: 'freehand' as const,
              pathPx,
              color: 'var(--cat-edit)',
              strokeWidthPx: 2,
            };
      const newMarkup: Markup = {
        id: `markup-${Date.now()}`,
        modelId,
        viewId: sheetId,
        anchor: {
          kind: 'screen',
          viewId: sheetId,
          xPx: pathPx[0]?.xPx ?? 0,
          yPx: pathPx[0]?.yPx ?? 0,
        },
        shape,
        authorId: userId ?? 'current-user',
        createdAt: Date.now(),
      };
      setMarkups((prev) => [...prev, newMarkup]);
    },
    [activeMarkupShape, modelId, sheetId, userId],
  );

  const handleArrowComplete = useCallback(
    (from: { xPx: number; yPx: number }, to: { xPx: number; yPx: number }) => {
      const newMarkup: Markup = {
        id: `markup-${Date.now()}`,
        modelId,
        viewId: sheetId,
        anchor: { kind: 'screen', viewId: sheetId, xPx: from.xPx, yPx: from.yPx },
        shape: {
          kind: 'arrow',
          fromMm: { xMm: from.xPx, yMm: from.yPx },
          toMm: { xMm: to.xPx, yMm: to.yPx },
          color: 'var(--cat-edit)',
        },
        authorId: userId ?? 'current-user',
        createdAt: Date.now(),
      };
      setMarkups((prev) => [...prev, newMarkup]);
    },
    [modelId, sheetId, userId],
  );

  const handleTextPlace = useCallback(
    (pos: { xPx: number; yPx: number }, text: string) => {
      const newMarkup: Markup = {
        id: `markup-${Date.now()}`,
        modelId,
        viewId: sheetId,
        anchor: { kind: 'screen', viewId: sheetId, xPx: pos.xPx, yPx: pos.yPx },
        shape: {
          kind: 'text',
          bodyMd: text,
          positionMm: { xMm: pos.xPx, yMm: pos.yPx },
        },
        authorId: userId ?? 'current-user',
        createdAt: Date.now(),
      };
      setMarkups((prev) => [...prev, newMarkup]);
    },
    [modelId, sheetId, userId],
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(
          `/api/v3/models/${encodeURIComponent(modelId)}/comments?sheetId=${encodeURIComponent(sheetId)}`,
        );
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as { comments?: Comment[] };
        setComments(data.comments ?? []);
      } catch {
        // non-fatal
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [modelId, sheetId]);

  const fetchPixelMap = useCallback(async (): Promise<Record<string, PixelMapEntry>> => {
    const cache = pixelMapCacheRef.current;
    if (cache && Date.now() < cache.expiresAt) return cache.map;
    try {
      const res = await fetch(
        `/api/v3/models/${encodeURIComponent(modelId)}/sheets/${encodeURIComponent(sheetId)}/pixel-map`,
      );
      if (!res.ok) return {};
      const data = (await res.json()) as { map?: Record<string, PixelMapEntry> };
      const map = data.map ?? {};
      pixelMapCacheRef.current = { map, expiresAt: Date.now() + PIXEL_MAP_TTL_MS };
      return map;
    } catch {
      return {};
    }
  }, [modelId, sheetId]);

  const resolveSourceBinding = useCallback(
    async (
      xPx: number,
      yPx: number,
    ): Promise<{ sourceViewId?: string; sourceElementId?: string }> => {
      const map = await fetchPixelMap();
      const key = `${Math.round(xPx)},${Math.round(yPx)}`;
      const entry = map[key];
      return entry ?? {};
    },
    [fetchPixelMap],
  );

  const handleCanvasClick = useCallback(
    (e: MouseEvent<HTMLDivElement>) => {
      if (activeMode !== 'cm' || readOnly) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const xPx = e.clientX - rect.left;
      const yPx = e.clientY - rect.top;
      setPendingPin({ xPx, yPx });
      setActivePinId(null);
    },
    [activeMode, readOnly],
  );

  const handlePost = useCallback(
    async (body: string) => {
      if (!pendingPin) return;
      const { sourceViewId, sourceElementId } = await resolveSourceBinding(
        pendingPin.xPx,
        pendingPin.yPx,
      );
      const anchor: SheetAnchor = {
        kind: 'sheet',
        sheetId,
        xPx: pendingPin.xPx,
        yPx: pendingPin.yPx,
        sourceViewId,
        sourceElementId,
      };
      const res = await fetch(`/api/v3/models/${encodeURIComponent(modelId)}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ authorId: userId ?? 'current-user', body, anchor }),
      });
      if (!res.ok) return;
      const created = (await res.json()) as Comment;
      setComments((prev) => [...prev, created]);
      setPendingPin(null);
    },
    [pendingPin, resolveSourceBinding, sheetId, modelId, userId],
  );

  const handleResolve = useCallback(
    async (commentId: string, resolved: boolean) => {
      if (!resolved) return;
      const res = await fetch(
        `/api/v3/models/${encodeURIComponent(modelId)}/comments/${encodeURIComponent(commentId)}/resolve`,
        { method: 'POST' },
      );
      if (!res.ok) return;
      setComments((prev) =>
        prev.map((c) => (c.id === commentId ? { ...c, resolvedAt: Date.now() } : c)),
      );
    },
    [modelId],
  );

  const sheetComments = comments.filter(
    (c) => c.anchor.kind === 'sheet' && (c.anchor as SheetAnchor).sheetId === sheetId,
  );

  const uxComments: UxComment[] = sheetComments.map((c) => ({
    id: c.id,
    userDisplay: c.authorId,
    body: c.body,
    resolved: c.resolvedAt != null,
    createdAt: String(c.createdAt),
  }));

  const activeComment = activePinId ? uxComments.filter((c) => c.id === activePinId) : [];

  return (
    <div
      data-testid="sheet-review-surface"
      className="relative flex h-full w-full flex-col"
      style={{ background: 'var(--color-surface-strong)' }}
    >
      <div className="relative flex-1 overflow-auto" onClick={handleCanvasClick} ref={canvasRef}>
        <SheetCanvas
          elementsById={elementsById}
          preferredSheetId={sheetId}
          modelId={modelId}
          evidenceFullBleed
          onUpsertSemantic={onUpsertSemantic}
        />
        {sheetComments.map((c) => {
          const anchor = c.anchor as SheetAnchor;
          return (
            <CommentPinOverlay
              key={c.id}
              xPx={anchor.xPx}
              yPx={anchor.yPx}
              resolved={c.resolvedAt != null}
              active={activePinId === c.id}
              onClick={() => setActivePinId(activePinId === c.id ? null : c.id)}
            />
          );
        })}
        {pendingPin && (
          <div
            style={{
              position: 'absolute',
              left: pendingPin.xPx - 8,
              top: pendingPin.yPx - 8,
              width: 16,
              height: 16,
              borderRadius: '50%',
              background: 'var(--draft-comment-pin)',
              border: '2px solid var(--color-surface-strong)',
              pointerEvents: 'none',
            }}
          />
        )}
        {canvasDims.width > 0 && (
          <MarkupCanvas
            markups={markups}
            viewId={sheetId}
            drawingActive={activeMode === 'an' && !readOnly}
            activeShape={activeMarkupShape}
            onStrokeComplete={handleStrokeComplete}
            onArrowComplete={handleArrowComplete}
            onTextPlace={handleTextPlace}
            width={canvasDims.width}
            height={canvasDims.height}
          />
        )}
      </div>

      {(activePinId || pendingPin) && (
        <div
          className="absolute"
          style={{
            left:
              (activePinId
                ? ((
                    sheetComments.find((c) => c.id === activePinId)?.anchor as
                      | SheetAnchor
                      | undefined
                  )?.xPx ?? 0)
                : (pendingPin?.xPx ?? 0)) + 8,
            top:
              (activePinId
                ? ((
                    sheetComments.find((c) => c.id === activePinId)?.anchor as
                      | SheetAnchor
                      | undefined
                  )?.yPx ?? 0)
                : (pendingPin?.yPx ?? 0)) + 8,
            zIndex: 10,
          }}
        >
          <CommentsPanel
            comments={activePinId ? activeComment : []}
            userDisplay={userDisplayName || 'You'}
            onPost={handlePost}
            onResolve={handleResolve}
            onClose={() => {
              setActivePinId(null);
              setPendingPin(null);
            }}
          />
        </div>
      )}
    </div>
  );
}

function CommentPinOverlay({
  xPx,
  yPx,
  resolved,
  active,
  onClick,
}: {
  xPx: number;
  yPx: number;
  resolved: boolean;
  active: boolean;
  onClick: () => void;
}): JSX.Element {
  return (
    <button
      type="button"
      aria-label={resolved ? 'Resolved comment' : active ? 'Active comment (open)' : 'Comment'}
      aria-pressed={active}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      style={{
        position: 'absolute',
        left: xPx - 8,
        top: yPx - 8,
        width: 16,
        height: 16,
        borderRadius: '50%',
        background: resolved ? 'var(--color-muted)' : 'var(--draft-comment-pin)',
        border: active ? '2px solid var(--color-accent)' : '2px solid var(--color-surface-strong)',
        cursor: 'pointer',
        opacity: resolved ? 0.4 : 1,
        padding: 0,
      }}
    />
  );
}
