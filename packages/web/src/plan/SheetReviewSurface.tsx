import { useCallback, useEffect, useRef, useState, type JSX, type MouseEvent } from 'react';

import type { Comment, Element, SheetAnchor } from '@bim-ai/core';

import { SheetCanvas } from '../workspace/SheetCanvas';
import { CommentsPanel } from '../workspace/CommentsPanel';
import { useBimStore, type UxComment } from '../state/store';

type ReviewMode = 'cm' | 'an' | 'mr';

const REVIEW_TOOLS: Array<{ mode: ReviewMode; label: string; title: string }> = [
  { mode: 'cm', label: 'Comment', title: 'Click on the sheet to place a comment pin (CM)' },
  { mode: 'an', label: 'Markup', title: 'Draw freehand markup annotations (AN)' },
  { mode: 'mr', label: 'Resolve', title: 'Click comment pins to mark them resolved (MR)' },
];

type PixelMapEntry = { sourceViewId: string; sourceElementId?: string };
type PixelMapCache = { map: Record<string, PixelMapEntry>; expiresAt: number };

const PIXEL_MAP_TTL_MS = 30_000;

export type SheetReviewSurfaceProps = {
  sheetId: string;
  modelId: string;
  readOnly?: boolean;
  elementsById: Record<string, Element>;
};

export function SheetReviewSurface({
  sheetId,
  modelId,
  readOnly = false,
  elementsById,
}: SheetReviewSurfaceProps): JSX.Element {
  const userId = useBimStore((s) => s.userId);
  const userDisplayName = useBimStore((s) => s.userDisplayName);
  const [mode, setMode] = useState<ReviewMode>('cm');
  const [comments, setComments] = useState<Comment[]>([]);
  const [activePinId, setActivePinId] = useState<string | null>(null);
  const [pendingPin, setPendingPin] = useState<{ xPx: number; yPx: number } | null>(null);
  const pixelMapCacheRef = useRef<PixelMapCache | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

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
      if (mode !== 'cm' || readOnly) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const xPx = e.clientX - rect.left;
      const yPx = e.clientY - rect.top;
      setPendingPin({ xPx, yPx });
      setActivePinId(null);
    },
    [mode, readOnly],
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
    [pendingPin, resolveSourceBinding, sheetId, modelId],
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
      style={{ background: 'var(--color-surface-1)' }}
    >
      <div
        className="relative flex-1 overflow-hidden"
        style={{ paddingBottom: 40 }}
        onClick={handleCanvasClick}
        ref={canvasRef}
      >
        <SheetCanvas
          elementsById={elementsById}
          preferredSheetId={sheetId}
          modelId={modelId}
          evidenceFullBleed
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
              border: '2px solid var(--color-surface-1)',
              pointerEvents: 'none',
            }}
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

      <ReviewToolbar mode={mode} onModeChange={setMode} readOnly={readOnly} />
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
      aria-label="Sheet comment"
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
        border: active ? '2px solid var(--color-accent)' : '2px solid var(--color-surface-1)',
        cursor: 'pointer',
        opacity: resolved ? 0.4 : 1,
        padding: 0,
      }}
    />
  );
}

function ReviewToolbar({
  mode,
  onModeChange,
  readOnly,
}: {
  mode: ReviewMode;
  onModeChange: (m: ReviewMode) => void;
  readOnly: boolean;
}): JSX.Element {
  return (
    <div
      data-testid="sheet-review-toolbar"
      className="flex items-center gap-2 border-t border-border px-4"
      style={{
        height: 40,
        background: 'var(--color-surface-strong)',
        borderRadius: 0,
      }}
    >
      {REVIEW_TOOLS.map(({ mode: m, label, title }) => (
        <button
          key={m}
          type="button"
          data-testid={`review-tool-${m}`}
          disabled={readOnly && m !== 'mr'}
          aria-pressed={mode === m}
          title={title}
          onClick={() => onModeChange(m)}
          className={[
            'rounded px-3 py-1 text-xs font-semibold transition-colors',
            mode === m
              ? 'bg-accent text-accent-foreground'
              : 'text-muted hover:bg-surface hover:text-foreground',
            readOnly && m !== 'mr' ? 'cursor-not-allowed opacity-40' : '',
          ]
            .join(' ')
            .trim()}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
