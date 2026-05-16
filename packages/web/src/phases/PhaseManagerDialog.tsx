import { type JSX, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { Element } from '@bim-ai/core';

type PhaseEl = Extract<Element, { kind: 'phase' }>;

type CommandDispatcher = (cmd: Record<string, unknown>) => void | Promise<void>;

interface PhaseRow {
  id: string;
  name: string;
  ord: number;
  description: string;
  elementCount: number;
}

function countElementsInPhase(elementsById: Record<string, Element>, phaseId: string): number {
  return Object.values(elementsById).filter(
    (e) => (e as { phaseId?: string | null }).phaseId === phaseId,
  ).length;
}

export function PhaseManagerDialog({
  open,
  onClose,
  elementsById,
  onSemanticCommand,
}: {
  open: boolean;
  onClose: () => void;
  elementsById: Record<string, Element>;
  onSemanticCommand: CommandDispatcher;
}): JSX.Element | null {
  const dialogRef = useRef<HTMLDivElement | null>(null);

  const phases = useMemo(() => {
    const all = Object.values(elementsById) as Element[];
    return (all.filter((e) => e.kind === 'phase') as PhaseEl[])
      .sort((a, b) => a.ord - b.ord)
      .map(
        (p): PhaseRow => ({
          id: p.id,
          name: p.name,
          ord: p.ord,
          description: p.description ?? '',
          elementCount: countElementsInPhase(elementsById, p.id),
        }),
      );
  }, [elementsById]);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setEditingId(null);
      setNewName('');
      setConfirmDeleteId(null);
      setError(null);
    }
  }, [open]);

  useEffect(() => {
    if (open) dialogRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  const run = useCallback(
    async (cmds: Record<string, unknown>[]) => {
      setBusy(true);
      setError(null);
      try {
        for (const cmd of cmds) await onSemanticCommand(cmd);
      } catch {
        setError('Command failed.');
      } finally {
        setBusy(false);
      }
    },
    [onSemanticCommand],
  );

  const startEdit = (row: PhaseRow) => {
    setEditingId(row.id);
    setEditName(row.name);
    setEditDesc(row.description);
  };

  const commitEdit = async () => {
    if (!editingId) return;
    const row = phases.find((p) => p.id === editingId);
    if (!row) return;
    const cmds: Record<string, unknown>[] = [];
    if (editName.trim() && editName.trim() !== row.name) {
      cmds.push({
        type: 'updateElementProperty',
        elementId: editingId,
        key: 'name',
        value: editName.trim(),
      });
    }
    if (editDesc !== row.description) {
      cmds.push({
        type: 'updateElementProperty',
        elementId: editingId,
        key: 'description',
        value: editDesc,
      });
    }
    setEditingId(null);
    if (cmds.length) await run(cmds);
  };

  const addPhase = async () => {
    const name = newName.trim();
    if (!name) return;
    const maxOrd = phases.reduce((m, p) => Math.max(m, p.ord), -1);
    const id = `phase-${name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 32)}-${Date.now().toString(36)}`;
    setNewName('');
    await run([{ type: 'createPhase', id, name, ord: maxOrd + 1 }]);
  };

  const deletePhase = async (row: PhaseRow) => {
    setConfirmDeleteId(null);
    await run([{ type: 'deleteElement', elementId: row.id }]);
  };

  const movePhase = async (row: PhaseRow, direction: 'up' | 'down') => {
    const idx = phases.indexOf(row);
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= phases.length) return;
    const other = phases[swapIdx];
    await run([
      { type: 'updateElementProperty', elementId: row.id, key: 'ord', value: String(other.ord) },
      { type: 'updateElementProperty', elementId: other.id, key: 'ord', value: String(row.ord) },
    ]);
  };

  if (!open) return null;

  const confirmRow = confirmDeleteId ? phases.find((p) => p.id === confirmDeleteId) : null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Manage Phases"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.4)',
      }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 6,
          boxShadow: '0 4px 24px rgba(0,0,0,0.2)',
          width: 640,
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          outline: 'none',
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 16px',
            borderBottom: '1px solid var(--color-border)',
            flexShrink: 0,
          }}
        >
          <span style={{ fontWeight: 600, fontSize: 14 }}>Manage Phases</span>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: 16,
              color: 'var(--color-text-secondary)',
              padding: '2px 6px',
            }}
          >
            ×
          </button>
        </div>

        {/* Table */}
        <div style={{ overflowY: 'auto', flex: 1 }}>
          <table
            data-testid="phase-manager-table"
            style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}
          >
            <thead>
              <tr style={{ background: 'var(--color-background)' }}>
                <th
                  scope="col"
                  style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 600, width: 32 }}
                >
                  Seq
                </th>
                <th scope="col" style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 600 }}>
                  Name
                </th>
                <th scope="col" style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 600 }}>
                  Description
                </th>
                <th
                  scope="col"
                  style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 600, width: 56 }}
                >
                  Elements
                </th>
                <th scope="col" style={{ padding: '6px 8px', width: 120 }} />
              </tr>
            </thead>
            <tbody>
              {phases.map((row, idx) => {
                const isEditing = editingId === row.id;
                return (
                  <tr
                    key={row.id}
                    data-testid={`phase-row-${row.id}`}
                    style={{ borderTop: '1px solid var(--color-border)' }}
                  >
                    <td
                      style={{
                        padding: '6px 8px',
                        color: 'var(--color-text-secondary)',
                        textAlign: 'center',
                      }}
                    >
                      {row.ord + 1}
                    </td>
                    <td style={{ padding: '6px 4px' }}>
                      {isEditing ? (
                        <input
                          autoFocus
                          data-testid="phase-edit-name"
                          value={editName}
                          onChange={(e) => setEditName(e.currentTarget.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') void commitEdit();
                            if (e.key === 'Escape') setEditingId(null);
                          }}
                          style={{
                            width: '100%',
                            fontSize: 13,
                            border: '1px solid var(--color-border)',
                            borderRadius: 3,
                            padding: '2px 6px',
                            background: 'var(--color-surface)',
                            color: 'var(--color-text)',
                          }}
                        />
                      ) : (
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={() => startEdit(row)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') startEdit(row);
                          }}
                          style={{
                            cursor: 'text',
                            display: 'block',
                            padding: '2px 6px',
                            borderRadius: 3,
                          }}
                          title="Click to rename"
                        >
                          {row.name}
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '6px 4px' }}>
                      {isEditing ? (
                        <input
                          data-testid="phase-edit-description"
                          value={editDesc}
                          onChange={(e) => setEditDesc(e.currentTarget.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') void commitEdit();
                            if (e.key === 'Escape') setEditingId(null);
                          }}
                          style={{
                            width: '100%',
                            fontSize: 13,
                            border: '1px solid var(--color-border)',
                            borderRadius: 3,
                            padding: '2px 6px',
                            background: 'var(--color-surface)',
                            color: 'var(--color-text)',
                          }}
                        />
                      ) : (
                        <span
                          style={{
                            display: 'block',
                            padding: '2px 6px',
                            color: row.description
                              ? 'var(--color-text)'
                              : 'var(--color-text-secondary)',
                          }}
                        >
                          {row.description || '—'}
                        </span>
                      )}
                    </td>
                    <td
                      style={{
                        padding: '6px 8px',
                        textAlign: 'right',
                        color: 'var(--color-text-secondary)',
                      }}
                    >
                      {row.elementCount}
                    </td>
                    <td style={{ padding: '6px 8px' }}>
                      <div
                        style={{
                          display: 'flex',
                          gap: 4,
                          justifyContent: 'flex-end',
                          alignItems: 'center',
                        }}
                      >
                        {isEditing ? (
                          <>
                            <button
                              data-testid="phase-save-btn"
                              disabled={busy}
                              onClick={() => void commitEdit()}
                              style={smallBtn}
                            >
                              Save
                            </button>
                            <button onClick={() => setEditingId(null)} style={smallBtn}>
                              Cancel
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              aria-label="Move up"
                              disabled={busy || idx === 0}
                              onClick={() => void movePhase(row, 'up')}
                              style={iconBtn}
                              title="Move up"
                            >
                              ↑
                            </button>
                            <button
                              aria-label="Move down"
                              disabled={busy || idx === phases.length - 1}
                              onClick={() => void movePhase(row, 'down')}
                              style={iconBtn}
                              title="Move down"
                            >
                              ↓
                            </button>
                            <button
                              data-testid={`phase-delete-${row.id}`}
                              disabled={busy}
                              onClick={() => setConfirmDeleteId(row.id)}
                              style={{ ...iconBtn, color: 'var(--color-error, #e55)' }}
                              title="Delete phase"
                              aria-label={`Delete phase ${row.name}`}
                            >
                              ×
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {phases.length === 0 && (
            <div
              style={{
                padding: '24px 16px',
                textAlign: 'center',
                color: 'var(--color-text-secondary)',
                fontSize: 13,
              }}
            >
              No phases. Add one below.
            </div>
          )}
        </div>

        {/* Add row */}
        <div
          style={{
            display: 'flex',
            gap: 8,
            padding: '10px 12px',
            borderTop: '1px solid var(--color-border)',
            flexShrink: 0,
            alignItems: 'center',
          }}
        >
          <input
            data-testid="phase-new-name"
            placeholder="New phase name…"
            value={newName}
            onChange={(e) => setNewName(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void addPhase();
            }}
            disabled={busy}
            style={{
              flex: 1,
              fontSize: 13,
              border: '1px solid var(--color-border)',
              borderRadius: 4,
              padding: '4px 8px',
              background: 'var(--color-surface)',
              color: 'var(--color-text)',
            }}
          />
          <button
            data-testid="phase-add-btn"
            disabled={busy || !newName.trim()}
            onClick={() => void addPhase()}
            style={{
              fontSize: 12,
              padding: '4px 12px',
              borderRadius: 4,
              border: '1px solid var(--color-border)',
              background: 'var(--color-accent, #2563eb)',
              color: '#fff',
              cursor: 'pointer',
              opacity: newName.trim() ? 1 : 0.5,
            }}
          >
            Add Phase
          </button>
        </div>

        {error && (
          <div
            style={{
              padding: '6px 12px',
              color: 'var(--color-error, #e55)',
              fontSize: 12,
              borderTop: '1px solid var(--color-border)',
            }}
          >
            {error}
          </div>
        )}
      </div>

      {/* Delete confirmation overlay */}
      {confirmRow && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 210,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0,0,0,0.5)',
          }}
        >
          <div
            role="alertdialog"
            aria-label="Confirm delete phase"
            style={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 6,
              boxShadow: '0 4px 24px rgba(0,0,0,0.3)',
              padding: '20px 24px',
              width: 380,
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: 8 }}>
              Delete phase "{confirmRow.name}"?
            </div>
            {confirmRow.elementCount > 0 && (
              <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 12 }}>
                {confirmRow.elementCount} element{confirmRow.elementCount !== 1 ? 's' : ''} are
                assigned to this phase. They will become unphased.
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
              <button
                onClick={() => setConfirmDeleteId(null)}
                style={{ ...smallBtn, border: '1px solid var(--color-border)' }}
              >
                Cancel
              </button>
              <button
                data-testid="phase-confirm-delete"
                onClick={() => void deletePhase(confirmRow)}
                style={{
                  ...smallBtn,
                  background: 'var(--color-error, #e55)',
                  color: '#fff',
                  border: 'none',
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const smallBtn: React.CSSProperties = {
  fontSize: 12,
  padding: '3px 10px',
  borderRadius: 4,
  border: '1px solid var(--color-border)',
  background: 'var(--color-surface)',
  color: 'var(--color-text)',
  cursor: 'pointer',
};

const iconBtn: React.CSSProperties = {
  fontSize: 14,
  padding: '1px 6px',
  borderRadius: 3,
  border: '1px solid var(--color-border)',
  background: 'var(--color-surface)',
  color: 'var(--color-text-secondary)',
  cursor: 'pointer',
  lineHeight: 1.4,
};
