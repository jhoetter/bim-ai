import { type JSX, useEffect, useMemo, useRef, useState } from 'react';

import type { Element } from '@bim-ai/core';

type CategoryRow = {
  kind: string;
  label: string;
  count: number;
  ids: string[];
};

function formatKind(kind: string): string {
  return kind
    .split('_')
    .map((w) => w[0]!.toUpperCase() + w.slice(1))
    .join(' ');
}

/** Groups selected element IDs by their element kind and returns a sorted category list. */
export function buildCategoryRows(
  selectedIds: string[],
  elementsById: Record<string, Element>,
): CategoryRow[] {
  const byKind = new Map<string, string[]>();
  for (const id of selectedIds) {
    const el = elementsById[id];
    if (!el) continue;
    const ids = byKind.get(el.kind) ?? [];
    ids.push(id);
    byKind.set(el.kind, ids);
  }
  return [...byKind.entries()]
    .map(([kind, ids]) => ({ kind, label: formatKind(kind), count: ids.length, ids }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

/** Filters the selection to only include the given kinds; returns new [primaryId, restIds]. */
export function deselectByCategory(
  selectedId: string | undefined,
  selectedIds: string[],
  elementsById: Record<string, Element>,
  keepKinds: Set<string>,
): { selectedId: string | undefined; selectedIds: string[] } {
  const keep = (id: string) => {
    const el = elementsById[id];
    return el != null && keepKinds.has(el.kind);
  };

  const allIds = [selectedId, ...selectedIds].filter((id): id is string => id != null);
  const kept = allIds.filter(keep);
  const [primary, ...rest] = kept;
  return { selectedId: primary, selectedIds: rest };
}

export function SelectionFilterDialog({
  open,
  onClose,
  selectedId,
  selectedIds,
  elementsById,
  onApply,
}: {
  open: boolean;
  onClose: () => void;
  selectedId: string | undefined;
  selectedIds: string[];
  elementsById: Record<string, Element>;
  onApply: (selectedId: string | undefined, selectedIds: string[]) => void;
}): JSX.Element | null {
  const dialogRef = useRef<HTMLDivElement | null>(null);

  const allIds = useMemo(
    () => [...new Set([selectedId, ...selectedIds].filter((id): id is string => id != null))],
    [selectedId, selectedIds],
  );

  const rows = useMemo(() => buildCategoryRows(allIds, elementsById), [allIds, elementsById]);

  const [checkedKinds, setCheckedKinds] = useState<Set<string>>(
    () => new Set(rows.map((r) => r.kind)),
  );

  useEffect(() => {
    if (open) setCheckedKinds(new Set(rows.map((r) => r.kind)));
  }, [open, rows]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  const handleToggle = (kind: string) => {
    setCheckedKinds((prev) => {
      const next = new Set(prev);
      if (next.has(kind)) next.delete(kind);
      else next.add(kind);
      return next;
    });
  };

  const handleApply = () => {
    const result = deselectByCategory(selectedId, selectedIds, elementsById, checkedKinds);
    onApply(result.selectedId, result.selectedIds);
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Selection Filter"
      data-testid="selection-filter-dialog"
      style={{ position: 'fixed', inset: 0, zIndex: 9000 }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.4)',
          pointerEvents: 'none',
        }}
        aria-hidden
      />
      <div
        ref={dialogRef}
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 8,
          padding: '16px 20px',
          minWidth: 280,
          maxHeight: '60vh',
          overflowY: 'auto',
          boxShadow: '0 8px 32px rgba(0,0,0,0.24)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>
          Selection Filter — {allIds.length} element{allIds.length !== 1 ? 's' : ''}
        </h2>
        <ul
          style={{
            listStyle: 'none',
            margin: 0,
            padding: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
          }}
        >
          {rows.map((row) => (
            <li key={row.kind} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="checkbox"
                id={`sf-${row.kind}`}
                checked={checkedKinds.has(row.kind)}
                onChange={() => handleToggle(row.kind)}
                data-testid={`sf-check-${row.kind}`}
              />
              <label
                htmlFor={`sf-${row.kind}`}
                style={{ flex: 1, fontSize: 12, cursor: 'pointer' }}
              >
                {row.label}
              </label>
              <span style={{ fontSize: 11, color: 'var(--color-muted)' }}>{row.count}</span>
            </li>
          ))}
        </ul>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
          <button
            type="button"
            onClick={onClose}
            style={{ fontSize: 12, padding: '4px 12px', cursor: 'pointer' }}
            data-testid="sf-cancel"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleApply}
            style={{ fontSize: 12, padding: '4px 12px', fontWeight: 600, cursor: 'pointer' }}
            data-testid="sf-apply"
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}
