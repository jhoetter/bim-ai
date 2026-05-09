import React, { useCallback, useEffect, useState } from 'react';
import type { ActivityRow } from '@bim-ai/core';
import { useActivityStore } from './activityStore';

type FilterKind = 'all' | 'mine' | 'comments' | 'commits';

const KIND_VERB: Record<ActivityRow['kind'], string> = {
  commit: 'committed',
  comment_created: 'commented',
  comment_resolved: 'resolved',
  markup_created: 'marked up',
  markup_resolved: 'closed markup',
  milestone_created: 'milestone',
  option_set_lifecycle: 'option set',
  collab_join: 'joined',
  collab_leave: 'left',
};

function kindColor(kind: ActivityRow['kind']): string {
  if (kind === 'commit') return 'var(--disc-struct)';
  if (kind === 'comment_created' || kind === 'comment_resolved') return 'var(--disc-arch)';
  if (kind === 'markup_created' || kind === 'markup_resolved') return 'var(--disc-mep)';
  return 'var(--color-muted)';
}

function initials(authorId: string): string {
  return authorId.slice(0, 2).toUpperCase();
}

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function matchesFilter(row: ActivityRow, filter: FilterKind, selfId: string | null): boolean {
  if (filter === 'all') return true;
  if (filter === 'mine') return selfId != null && row.authorId === selfId;
  if (filter === 'comments')
    return row.kind === 'comment_created' || row.kind === 'comment_resolved';
  if (filter === 'commits') return row.kind === 'commit';
  return true;
}

type RowItemProps = {
  row: ActivityRow;
  onRestore: (row: ActivityRow) => void;
};

function ActivityRowItem({ row, onRestore }: RowItemProps) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '4px 8px',
        borderRadius: 4,
        background: hovered ? 'var(--color-surface-hover)' : 'transparent',
        cursor: 'default',
        fontSize: 'var(--text-2xs)',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div
        style={{
          width: 24,
          height: 24,
          borderRadius: '50%',
          background: 'var(--color-surface-strong)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 'var(--text-2xs)',
          fontWeight: 600,
          flexShrink: 0,
          color: 'var(--color-foreground)',
        }}
      >
        {initials(row.authorId)}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <span style={{ fontWeight: 500, color: 'var(--color-foreground)' }}>{row.authorId}</span>{' '}
        <span style={{ color: kindColor(row.kind) }}>{KIND_VERB[row.kind]}</span>
        {row.kind === 'commit' && row.payload.commandCount != null && (
          <span style={{ color: 'var(--color-muted)' }}>
            {' '}
            ({row.payload.commandCount as number} cmd
            {(row.payload.commandCount as number) !== 1 ? 's' : ''})
          </span>
        )}
        <span style={{ color: 'var(--color-muted)', marginLeft: 6 }}>{relativeTime(row.ts)}</span>
      </div>
      {hovered && row.parentSnapshotId != null && (
        <button
          onClick={() => onRestore(row)}
          style={{
            padding: '2px 8px',
            borderRadius: 4,
            border: '1px solid var(--color-border)',
            background: 'var(--color-surface)',
            color: 'var(--color-foreground)',
            fontSize: 'var(--text-2xs)',
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          Restore
        </button>
      )}
    </div>
  );
}

type ActivityPanelProps = {
  modelId: string;
  selfId?: string | null;
  onRestored?: (row: ActivityRow) => void;
};

export function ActivityPanel({ modelId, selfId = null, onRestored }: ActivityPanelProps) {
  const { rows, loading, fetchMore, restore } = useActivityStore();
  const [filter, setFilter] = useState<FilterKind>('all');

  useEffect(() => {
    void fetchMore(modelId);
  }, [modelId, fetchMore]);

  const handleRestore = useCallback(
    async (row: ActivityRow) => {
      try {
        const newRow = await restore(modelId, row.id);
        onRestored?.(newRow);
      } catch {
        // swallow — caller may hook error boundary
      }
    },
    [modelId, restore, onRestored],
  );

  const visible = rows.filter((r) => matchesFilter(r, filter, selfId));
  const oldest = visible[visible.length - 1];

  const filters: { key: FilterKind; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'mine', label: 'Mine' },
    { key: 'comments', label: 'Comments' },
    { key: 'commits', label: 'Commits' },
  ];

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'flex',
          gap: 4,
          padding: '6px 8px',
          borderBottom: '1px solid var(--color-border)',
          flexShrink: 0,
        }}
      >
        {filters.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            style={{
              padding: '2px 8px',
              borderRadius: 12,
              border: 'none',
              background:
                filter === key ? 'var(--color-accent-soft)' : 'var(--color-surface-strong)',
              color: filter === key ? 'var(--color-foreground)' : 'var(--color-muted)',
              fontSize: 'var(--text-2xs)',
              fontWeight: filter === key ? 600 : 400,
              cursor: 'pointer',
            }}
          >
            {label}
          </button>
        ))}
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
        {loading && rows.length === 0 && (
          <div
            style={{
              padding: 12,
              color: 'var(--color-muted)',
              fontSize: 'var(--text-2xs)',
              textAlign: 'center',
            }}
          >
            Loading…
          </div>
        )}
        {visible.map((row) => (
          <ActivityRowItem key={row.id} row={row} onRestore={handleRestore} />
        ))}
        {visible.length >= 50 && oldest && (
          <div style={{ padding: '4px 8px' }}>
            <button
              onClick={() => void fetchMore(modelId, oldest.ts)}
              disabled={loading}
              style={{
                width: '100%',
                padding: '4px 0',
                border: '1px solid var(--color-border)',
                borderRadius: 4,
                background: 'transparent',
                color: 'var(--color-muted)',
                fontSize: 'var(--text-2xs)',
                cursor: loading ? 'default' : 'pointer',
              }}
            >
              {loading ? 'Loading…' : 'Load more'}
            </button>
          </div>
        )}
        {!loading && visible.length === 0 && (
          <div
            style={{
              padding: 12,
              color: 'var(--color-muted)',
              fontSize: 'var(--text-2xs)',
              textAlign: 'center',
            }}
          >
            No activity yet.
          </div>
        )}
      </div>
    </div>
  );
}
