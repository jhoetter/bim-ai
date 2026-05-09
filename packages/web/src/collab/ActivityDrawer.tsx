import { useCallback, useEffect, useState } from 'react';
import type { ReactElement } from 'react';
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
  sheet_comment_chip: 'sheet comment',
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

type DrawerRowProps = {
  row: ActivityRow;
  travelled: boolean;
  onTimeTravel: (row: ActivityRow) => void;
  onHoverChange: (row: ActivityRow | null) => void;
};

function DrawerRow({ row, travelled, onTimeTravel, onHoverChange }: DrawerRowProps): ReactElement {
  return (
    <div
      role="button"
      tabIndex={0}
      data-testid="activity-drawer-row"
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 8,
        padding: '6px 12px',
        cursor: 'pointer',
        fontSize: 'var(--text-sm)',
        background: travelled ? 'var(--color-accent-soft)' : 'transparent',
        borderLeft: travelled ? '2px solid var(--color-accent)' : '2px solid transparent',
      }}
      onMouseEnter={() => onHoverChange(row)}
      onMouseLeave={() => onHoverChange(null)}
      onClick={() => onTimeTravel(row)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onTimeTravel(row);
      }}
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
          marginTop: 2,
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
        <div style={{ fontSize: 'var(--text-2xs)', color: 'var(--color-muted)', marginTop: 2 }}>
          {relativeTime(row.ts)}
        </div>
      </div>
    </div>
  );
}

export type ActivityDrawerProps = {
  isOpen: boolean;
  onClose: () => void;
  modelId: string | null;
  selfId?: string | null;
  onSeeAll?: () => void;
};

export function ActivityDrawer({
  isOpen,
  onClose,
  modelId,
  selfId = null,
  onSeeAll,
}: ActivityDrawerProps): ReactElement {
  const { rows, fetchMore, restore } = useActivityStore();
  const [filter, setFilter] = useState<FilterKind>('all');
  const [hoveredRow, setHoveredRow] = useState<ActivityRow | null>(null);
  const [travelledRow, setTravelledRow] = useState<ActivityRow | null>(null);
  const [restoring, setRestoring] = useState(false);

  useEffect(() => {
    if (isOpen && modelId) {
      void fetchMore(modelId);
    }
  }, [isOpen, modelId, fetchMore]);

  // Esc closes the drawer
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  // Clear time-travel state when drawer closes
  useEffect(() => {
    if (!isOpen) {
      setTravelledRow(null);
      setHoveredRow(null);
    }
  }, [isOpen]);

  const handleTimeTravel = useCallback((row: ActivityRow) => {
    setTravelledRow(row);
  }, []);

  const handleRestore = useCallback(async () => {
    if (!travelledRow || !modelId) return;
    setRestoring(true);
    try {
      await restore(modelId, travelledRow.id);
      setTravelledRow(null);
      onClose();
    } catch {
      // swallow — caller may hook error boundary
    } finally {
      setRestoring(false);
    }
  }, [travelledRow, modelId, restore, onClose]);

  const visible = rows.filter((r) => matchesFilter(r, filter, selfId)).slice(0, 10);

  const filterChips: { key: FilterKind; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'mine', label: 'Mine' },
    { key: 'comments', label: 'Comments' },
    { key: 'commits', label: 'Commits' },
  ];

  return (
    <>
      {/* Canvas dim overlay — pointer-events none; appears on hover (40 %) */}
      <div
        aria-hidden="true"
        data-testid="activity-drawer-canvas-dim"
        style={{
          position: 'fixed',
          inset: 0,
          right: 380,
          zIndex: 49,
          background: 'var(--color-foreground)',
          opacity: isOpen && hoveredRow ? 0.4 : 0,
          pointerEvents: 'none',
          transition: 'opacity 150ms var(--ease-paper)',
        }}
      />
      {/* Right-rail dim overlay — 50 % while drawer is open */}
      <div
        aria-hidden="true"
        data-testid="activity-drawer-rail-dim"
        style={{
          position: 'fixed',
          top: 0,
          bottom: 0,
          right: 380,
          width: 280,
          zIndex: 49,
          background: 'var(--color-surface)',
          opacity: isOpen ? 0.5 : 0,
          pointerEvents: 'none',
          transition: 'opacity 200ms var(--ease-paper)',
        }}
      />

      {/* Drawer panel */}
      <div
        data-testid="activity-drawer"
        role="dialog"
        aria-label="Activity stream"
        aria-modal={isOpen}
        className="status-bar__activity-drawer"
        style={{
          position: 'fixed',
          right: 0,
          top: 'var(--shell-statusbar-height, 32px)',
          width: 380,
          height: 'calc(100vh - var(--shell-statusbar-height, 32px))',
          background: 'var(--color-surface)',
          borderLeft: '1px solid var(--color-border)',
          transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 200ms var(--ease-paper)',
          zIndex: 50,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '8px 12px',
            borderBottom: '1px solid var(--color-border)',
            flexShrink: 0,
          }}
        >
          <span
            style={{
              fontWeight: 600,
              fontSize: 'var(--text-sm)',
              color: 'var(--color-foreground)',
            }}
          >
            Activity
          </span>
          <button
            type="button"
            aria-label="Close activity drawer"
            onClick={onClose}
            style={{
              padding: '2px 6px',
              borderRadius: 4,
              border: 'none',
              background: 'transparent',
              color: 'var(--color-muted)',
              cursor: 'pointer',
              fontSize: 'var(--text-sm)',
            }}
          >
            ✕
          </button>
        </div>

        {/* Time-travel banner + [Restore] chip */}
        {travelledRow && (
          <div
            data-testid="activity-drawer-travel-banner"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '6px 12px',
              background: 'var(--color-accent-soft)',
              borderBottom: '1px solid var(--color-border)',
              flexShrink: 0,
            }}
          >
            <span style={{ fontSize: 'var(--text-2xs)', color: 'var(--color-foreground)' }}>
              Viewing version {travelledRow.id.slice(0, 8)}
            </span>
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                type="button"
                onClick={() => setTravelledRow(null)}
                style={{
                  padding: '2px 8px',
                  borderRadius: 4,
                  border: '1px solid var(--color-border)',
                  background: 'var(--color-surface)',
                  color: 'var(--color-muted)',
                  fontSize: 'var(--text-2xs)',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                data-testid="activity-drawer-restore-chip"
                onClick={() => void handleRestore()}
                disabled={restoring}
                style={{
                  padding: '2px 8px',
                  borderRadius: 4,
                  border: '1px solid var(--color-border)',
                  background: 'var(--color-accent-soft)',
                  color: 'var(--color-foreground)',
                  fontSize: 'var(--text-2xs)',
                  cursor: restoring ? 'default' : 'pointer',
                  fontWeight: 600,
                }}
              >
                {restoring ? 'Restoring…' : '[Restore]'}
              </button>
            </div>
          </div>
        )}

        {/* Filter chips */}
        <div
          style={{
            display: 'flex',
            gap: 4,
            padding: '6px 12px',
            borderBottom: '1px solid var(--color-border)',
            flexShrink: 0,
          }}
        >
          {filterChips.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              data-testid={`activity-filter-${key}`}
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

        {/* Row list — latest 10 */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
          {visible.length === 0 ? (
            <div
              style={{
                padding: 16,
                color: 'var(--color-muted)',
                fontSize: 'var(--text-2xs)',
                textAlign: 'center',
              }}
            >
              No activity yet.
            </div>
          ) : (
            visible.map((row) => (
              <DrawerRow
                key={row.id}
                row={row}
                travelled={travelledRow?.id === row.id}
                onTimeTravel={handleTimeTravel}
                onHoverChange={setHoveredRow}
              />
            ))
          )}
        </div>

        {/* Footer: see all */}
        <div
          style={{
            padding: '8px 12px',
            borderTop: '1px solid var(--color-border)',
            flexShrink: 0,
          }}
        >
          <button
            type="button"
            data-testid="activity-drawer-see-all"
            onClick={onSeeAll ?? onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--color-muted)',
              fontSize: 'var(--text-2xs)',
              cursor: 'pointer',
              padding: 0,
            }}
          >
            See all →
          </button>
        </div>
      </div>
    </>
  );
}
