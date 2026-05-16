import { useState } from 'react';
import type { Element } from '@bim-ai/core';

type PhaseEl = Extract<Element, { kind: 'phase' }>;

export type ManagePhasesDialogProps = {
  isOpen: boolean;
  phases: PhaseEl[];
  onCreatePhase: (cmd: { id: string; name: string; ord: number }) => void;
  onUpdatePhase: (cmd: { id: string; name: string }) => void;
  onDeletePhase: (id: string) => void;
  onClose: () => void;
};

export function ManagePhasesDialog({
  isOpen,
  phases,
  onCreatePhase,
  onUpdatePhase,
  onDeletePhase,
  onClose,
}: ManagePhasesDialogProps) {
  const [editingNames, setEditingNames] = useState<Record<string, string>>({});

  if (!isOpen) return null;

  const sorted = [...phases].sort((a, b) => a.ord - b.ord);
  const maxOrd = phases.reduce((m, p) => Math.max(m, p.ord), -1);

  const handleAdd = () => {
    onCreatePhase({
      id: `phase-${Date.now().toString(36)}`,
      name: 'New Phase',
      ord: maxOrd + 1,
    });
  };

  const handleNameBlur = (phase: PhaseEl) => {
    const draft = editingNames[phase.id];
    if (draft !== undefined && draft.trim() && draft.trim() !== phase.name) {
      onUpdatePhase({ id: phase.id, name: draft.trim() });
    }
    setEditingNames((prev) => {
      const next = { ...prev };
      delete next[phase.id];
      return next;
    });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Project Phases"
      data-testid="manage-phases-dialog"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.45)',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg, 8px)',
          padding: 'var(--space-5, 20px)',
          width: 520,
          maxWidth: 'calc(100vw - 48px)',
          maxHeight: 'calc(100vh - 96px)',
          overflowY: 'auto',
          boxShadow: '0 8px 32px rgba(0,0,0,0.32)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 'var(--space-4)',
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: 'var(--text-base, 14px)',
              fontWeight: 600,
              color: 'var(--color-foreground)',
            }}
          >
            Project Phases
          </h2>
          <button
            type="button"
            data-testid="manage-phases-close"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: 16,
              color: 'var(--color-muted-foreground)',
            }}
          >
            ✕
          </button>
        </div>

        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: 'var(--text-sm, 12.5px)',
            color: 'var(--color-foreground)',
            marginBottom: 'var(--space-4)',
          }}
        >
          <thead>
            <tr>
              <th style={thStyle}>Seq</th>
              <th style={thStyle}>Name</th>
              <th style={thStyle} />
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td
                  colSpan={3}
                  style={{
                    ...tdStyle,
                    textAlign: 'center',
                    color: 'var(--color-muted-foreground)',
                  }}
                >
                  No phases — add one below.
                </td>
              </tr>
            ) : null}
            {sorted.map((phase) => (
              <tr key={phase.id} data-testid={`manage-phases-row-${phase.id}`}>
                <td style={{ ...tdStyle, width: 40, color: 'var(--color-muted-foreground)' }}>
                  {phase.ord + 1}
                </td>
                <td style={tdStyle}>
                  <input
                    style={inputStyle}
                    value={editingNames[phase.id] ?? phase.name}
                    onChange={(e) =>
                      setEditingNames((prev) => ({ ...prev, [phase.id]: e.target.value }))
                    }
                    onBlur={() => handleNameBlur(phase)}
                  />
                </td>
                <td style={{ ...tdStyle, textAlign: 'right' }}>
                  <button
                    type="button"
                    data-testid={`manage-phases-delete-${phase.id}`}
                    onClick={() => onDeletePhase(phase.id)}
                    style={{
                      ...actionBtnStyle,
                      color: 'var(--color-destructive, #dc2626)',
                    }}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <button
          type="button"
          data-testid="manage-phases-add"
          onClick={handleAdd}
          style={{
            padding: 'var(--space-1-5, 6px) var(--space-3, 12px)',
            background: 'var(--color-accent)',
            border: 'none',
            borderRadius: 'var(--radius-sm, 4px)',
            color: 'var(--color-accent-foreground, white)',
            fontSize: 'var(--text-sm, 12.5px)',
            cursor: 'pointer',
          }}
        >
          Add Phase
        </button>
      </div>
    </div>
  );
}

const thStyle: React.CSSProperties = {
  padding: 'var(--space-1-5, 6px) var(--space-2, 8px)',
  textAlign: 'left',
  fontSize: 'var(--text-xs, 11px)',
  fontWeight: 600,
  color: 'var(--color-muted-foreground)',
  borderBottom: '1px solid var(--color-border)',
  whiteSpace: 'nowrap',
};

const tdStyle: React.CSSProperties = {
  padding: 'var(--space-1-5, 6px) var(--space-2, 8px)',
  borderBottom: '1px solid var(--color-border)',
  fontSize: 'var(--text-sm, 12.5px)',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: 'var(--space-0-5, 2px) var(--space-1, 4px)',
  background: 'var(--color-background)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-sm, 4px)',
  color: 'var(--color-foreground)',
  fontSize: 'var(--text-sm, 12.5px)',
  boxSizing: 'border-box',
};

const actionBtnStyle: React.CSSProperties = {
  padding: 'var(--space-0-5, 2px) var(--space-1-5, 6px)',
  background: 'var(--color-surface)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-sm, 4px)',
  color: 'var(--color-foreground)',
  fontSize: 'var(--text-xs, 11px)',
  cursor: 'pointer',
};
