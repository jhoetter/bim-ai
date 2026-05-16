import { useState } from 'react';
import type { Element } from '@bim-ai/core';

export type ManageRevisionsDialogProps = {
  isOpen: boolean;
  revisions: Extract<Element, { kind: 'revision' }>[];
  sheetRevisions: Extract<Element, { kind: 'sheet_revision' }>[];
  activeSheetId?: string | null;
  onCreateRevision: (cmd: {
    id: string;
    number: string;
    date: string;
    description: string;
    issuedBy?: string;
    issuedTo?: string;
  }) => void;
  onUpdateRevision: (cmd: {
    id: string;
    number?: string;
    date?: string;
    description?: string;
    issuedBy?: string;
    issuedTo?: string;
  }) => void;
  onDeleteRevision: (id: string) => void;
  onAddSheetRevision: (cmd: { id: string; sheetId: string; revisionId: string }) => void;
  onRemoveSheetRevision: (id: string) => void;
  onClose: () => void;
};

type DraftRevision = {
  number: string;
  date: string;
  description: string;
  issuedBy: string;
  issuedTo: string;
};

function blankDraft(): DraftRevision {
  const today = new Date().toISOString().slice(0, 10);
  return { number: '', date: today, description: '', issuedBy: '', issuedTo: '' };
}

/**
 * D6 — modal for managing project-level revision entries and their sheet assignments.
 * Lists all revisions, supports CRUD, and lets the user apply/remove revisions from
 * the active sheet via sheet_revision join records.
 */
export function ManageRevisionsDialog({
  isOpen,
  revisions,
  sheetRevisions,
  activeSheetId,
  onCreateRevision,
  onUpdateRevision,
  onDeleteRevision,
  onAddSheetRevision,
  onRemoveSheetRevision,
  onClose,
}: ManageRevisionsDialogProps) {
  const [draft, setDraft] = useState<DraftRevision>(blankDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<DraftRevision>(blankDraft);

  if (!isOpen) return null;

  const activeSheetRevisionIds = new Set(
    sheetRevisions.filter((sr) => sr.sheetId === activeSheetId).map((sr) => sr.revisionId),
  );

  const sheetRevisionRowId = (revisionId: string) =>
    sheetRevisions.find((sr) => sr.sheetId === activeSheetId && sr.revisionId === revisionId)?.id;

  const handleCreate = () => {
    const number = draft.number.trim();
    const date = draft.date.trim();
    const description = draft.description.trim();
    if (!number || !date || !description) return;
    onCreateRevision({
      id: `rev-${Date.now().toString(36)}`,
      number,
      date,
      description,
      issuedBy: draft.issuedBy.trim() || undefined,
      issuedTo: draft.issuedTo.trim() || undefined,
    });
    setDraft(blankDraft());
  };

  const startEdit = (rev: Extract<Element, { kind: 'revision' }>) => {
    setEditingId(rev.id);
    setEditDraft({
      number: rev.number,
      date: rev.date,
      description: rev.description,
      issuedBy: rev.issuedBy ?? '',
      issuedTo: rev.issuedTo ?? '',
    });
  };

  const commitEdit = (id: string) => {
    onUpdateRevision({
      id,
      number: editDraft.number.trim(),
      date: editDraft.date.trim(),
      description: editDraft.description.trim(),
      issuedBy: editDraft.issuedBy.trim() || undefined,
      issuedTo: editDraft.issuedTo.trim() || undefined,
    });
    setEditingId(null);
  };

  const toggleSheetRevision = (revisionId: string) => {
    if (!activeSheetId) return;
    const existingId = sheetRevisionRowId(revisionId);
    if (existingId) {
      onRemoveSheetRevision(existingId);
    } else {
      onAddSheetRevision({
        id: `sr-${Date.now().toString(36)}`,
        sheetId: activeSheetId,
        revisionId,
      });
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Manage Revisions"
      data-testid="manage-revisions-dialog"
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
          width: 640,
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
            Manage Revisions
          </h2>
          <button
            type="button"
            data-testid="manage-revisions-close"
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

        {/* Revision table */}
        <table
          data-testid="manage-revisions-table"
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
              {activeSheetId ? <th style={thStyle}>On Sheet</th> : null}
              <th style={thStyle}>Rev #</th>
              <th style={thStyle}>Date</th>
              <th style={thStyle}>Description</th>
              <th style={thStyle}>Issued By</th>
              <th style={thStyle}>Issued To</th>
              <th style={thStyle}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {revisions.length === 0 ? (
              <tr>
                <td
                  colSpan={activeSheetId ? 7 : 6}
                  style={{
                    ...tdStyle,
                    textAlign: 'center',
                    color: 'var(--color-muted-foreground)',
                  }}
                >
                  No revisions yet — add one below.
                </td>
              </tr>
            ) : null}
            {revisions.map((rev) =>
              editingId === rev.id ? (
                <tr key={rev.id} data-testid={`revision-row-${rev.id}`}>
                  {activeSheetId ? <td style={tdStyle} /> : null}
                  <td style={tdStyle}>
                    <input
                      data-testid={`revision-edit-number-${rev.id}`}
                      value={editDraft.number}
                      onChange={(e) => setEditDraft((d) => ({ ...d, number: e.target.value }))}
                      style={inputStyle}
                    />
                  </td>
                  <td style={tdStyle}>
                    <input
                      data-testid={`revision-edit-date-${rev.id}`}
                      type="date"
                      value={editDraft.date}
                      onChange={(e) => setEditDraft((d) => ({ ...d, date: e.target.value }))}
                      style={inputStyle}
                    />
                  </td>
                  <td style={tdStyle}>
                    <input
                      data-testid={`revision-edit-description-${rev.id}`}
                      value={editDraft.description}
                      onChange={(e) => setEditDraft((d) => ({ ...d, description: e.target.value }))}
                      style={inputStyle}
                    />
                  </td>
                  <td style={tdStyle}>
                    <input
                      value={editDraft.issuedBy}
                      onChange={(e) => setEditDraft((d) => ({ ...d, issuedBy: e.target.value }))}
                      style={inputStyle}
                    />
                  </td>
                  <td style={tdStyle}>
                    <input
                      value={editDraft.issuedTo}
                      onChange={(e) => setEditDraft((d) => ({ ...d, issuedTo: e.target.value }))}
                      style={inputStyle}
                    />
                  </td>
                  <td style={tdStyle}>
                    <button
                      type="button"
                      data-testid={`revision-save-${rev.id}`}
                      onClick={() => commitEdit(rev.id)}
                      style={actionBtnStyle}
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      style={{ ...actionBtnStyle, marginLeft: 4 }}
                    >
                      Cancel
                    </button>
                  </td>
                </tr>
              ) : (
                <tr key={rev.id} data-testid={`revision-row-${rev.id}`}>
                  {activeSheetId ? (
                    <td style={{ ...tdStyle, textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        data-testid={`revision-on-sheet-${rev.id}`}
                        checked={activeSheetRevisionIds.has(rev.id)}
                        onChange={() => toggleSheetRevision(rev.id)}
                      />
                    </td>
                  ) : null}
                  <td style={tdStyle}>{rev.number}</td>
                  <td style={tdStyle}>{rev.date}</td>
                  <td style={tdStyle}>{rev.description}</td>
                  <td style={tdStyle}>{rev.issuedBy ?? ''}</td>
                  <td style={tdStyle}>{rev.issuedTo ?? ''}</td>
                  <td style={tdStyle}>
                    <button
                      type="button"
                      data-testid={`revision-edit-${rev.id}`}
                      onClick={() => startEdit(rev)}
                      style={actionBtnStyle}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      data-testid={`revision-delete-${rev.id}`}
                      onClick={() => onDeleteRevision(rev.id)}
                      style={{
                        ...actionBtnStyle,
                        marginLeft: 4,
                        color: 'var(--color-destructive, #dc2626)',
                      }}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ),
            )}
          </tbody>
        </table>

        {/* Add new revision */}
        <fieldset
          style={{
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-sm, 4px)',
            padding: 'var(--space-3)',
          }}
        >
          <legend
            style={{ fontSize: 'var(--text-sm, 12.5px)', color: 'var(--color-muted-foreground)' }}
          >
            Add revision
          </legend>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 'var(--space-2)',
            }}
          >
            <label style={labelStyle}>
              Rev #
              <input
                data-testid="revision-new-number"
                value={draft.number}
                onChange={(e) => setDraft((d) => ({ ...d, number: e.target.value }))}
                placeholder="01"
                style={inputStyle}
              />
            </label>
            <label style={labelStyle}>
              Date
              <input
                data-testid="revision-new-date"
                type="date"
                value={draft.date}
                onChange={(e) => setDraft((d) => ({ ...d, date: e.target.value }))}
                style={inputStyle}
              />
            </label>
            <label style={labelStyle}>
              Description
              <input
                data-testid="revision-new-description"
                value={draft.description}
                onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
                placeholder="Issued for Review"
                style={inputStyle}
              />
            </label>
            <label style={labelStyle}>
              Issued By
              <input
                value={draft.issuedBy}
                onChange={(e) => setDraft((d) => ({ ...d, issuedBy: e.target.value }))}
                placeholder="Architect"
                style={inputStyle}
              />
            </label>
            <label style={labelStyle}>
              Issued To
              <input
                value={draft.issuedTo}
                onChange={(e) => setDraft((d) => ({ ...d, issuedTo: e.target.value }))}
                placeholder="Client"
                style={inputStyle}
              />
            </label>
          </div>
          <button
            type="button"
            data-testid="revision-add-btn"
            disabled={!draft.number.trim() || !draft.date.trim() || !draft.description.trim()}
            onClick={handleCreate}
            style={{
              marginTop: 'var(--space-3)',
              padding: 'var(--space-1-5, 6px) var(--space-3, 12px)',
              background: 'var(--color-accent)',
              border: 'none',
              borderRadius: 'var(--radius-sm, 4px)',
              color: 'var(--color-accent-foreground, white)',
              fontSize: 'var(--text-sm, 12.5px)',
              cursor: 'pointer',
              opacity:
                !draft.number.trim() || !draft.date.trim() || !draft.description.trim() ? 0.5 : 1,
            }}
          >
            Add Revision
          </button>
        </fieldset>
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

const labelStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-0-5, 2px)',
  fontSize: 'var(--text-sm, 12.5px)',
  color: 'var(--color-muted-foreground)',
};
