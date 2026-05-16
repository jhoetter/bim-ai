import { type JSX, useEffect, useRef, useState } from 'react';

import type { Element } from '@bim-ai/core';

type CommandDispatcher = (cmd: Record<string, unknown>) => void | Promise<void>;

type ProjectSettings = Extract<Element, { kind: 'project_settings' }>;

function getProjectSettings(elementsById: Record<string, Element>): ProjectSettings | undefined {
  const direct = elementsById['project_settings'];
  if (direct?.kind === 'project_settings') return direct as ProjectSettings;
  return (Object.values(elementsById) as Element[]).find(
    (e): e is ProjectSettings => e.kind === 'project_settings',
  );
}

interface Draft {
  name: string;
  projectNumber: string;
  projectAddress: string;
  projectStatus: string;
  clientName: string;
  authorName: string;
  issueDate: string;
  checkDate: string;
  projectDescription: string;
  projectNorthAngleDeg: string;
}

function emptyDraft(): Draft {
  return {
    name: '',
    projectNumber: '',
    projectAddress: '',
    projectStatus: '',
    clientName: '',
    authorName: '',
    issueDate: '',
    checkDate: '',
    projectDescription: '',
    projectNorthAngleDeg: '0',
  };
}

function draftFromSettings(ps: ProjectSettings | undefined): Draft {
  if (!ps) return emptyDraft();
  return {
    name: ps.name ?? '',
    projectNumber: ps.projectNumber ?? '',
    projectAddress: ps.projectAddress ?? '',
    projectStatus: ps.projectStatus ?? '',
    clientName: ps.clientName ?? '',
    authorName: ps.authorName ?? '',
    issueDate: ps.issueDate ?? '',
    checkDate: ps.checkDate ?? '',
    projectDescription: ps.projectDescription ?? '',
    projectNorthAngleDeg: String(ps.projectNorthAngleDeg ?? 0),
  };
}

export function ProjectInfoDialog({
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
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const ps = getProjectSettings(elementsById);

  useEffect(() => {
    if (open) {
      setDraft(draftFromSettings(ps));
      setMessage(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const save = async () => {
    const sid = ps?.id ?? 'project_settings';
    const cmds: Record<string, unknown>[] = [];
    if (!ps) {
      cmds.push({ type: 'upsertProjectSettings', id: sid });
    }
    const fields: Array<[keyof Draft, string]> = [
      ['name', draft.name],
      ['projectNumber', draft.projectNumber],
      ['projectAddress', draft.projectAddress],
      ['projectStatus', draft.projectStatus],
      ['clientName', draft.clientName],
      ['authorName', draft.authorName],
      ['issueDate', draft.issueDate],
      ['checkDate', draft.checkDate],
      ['projectDescription', draft.projectDescription],
    ];
    for (const [key, value] of fields) {
      cmds.push({ type: 'updateElementProperty', elementId: sid, key, value });
    }
    const northAngle = parseFloat(draft.projectNorthAngleDeg);
    if (Number.isFinite(northAngle)) {
      cmds.push({
        type: 'updateElementProperty',
        elementId: sid,
        key: 'projectNorthAngleDeg',
        value: String(northAngle),
      });
    }
    setBusy(true);
    setMessage(null);
    try {
      for (const cmd of cmds) await onSemanticCommand(cmd);
      setMessage('Project information saved.');
    } catch {
      setMessage('Save failed — check your connection.');
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Project Information"
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
          width: 560,
          maxHeight: '85vh',
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
          <span style={{ fontWeight: 600, fontSize: 14 }}>Project Information</span>
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

        {/* Body */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '16px' }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '12px',
            }}
          >
            <Field
              label="Project name"
              testId="project-info-name"
              value={draft.name}
              onChange={(v) => setDraft((d) => ({ ...d, name: v }))}
            />
            <Field
              label="Project number"
              testId="project-info-number"
              value={draft.projectNumber}
              onChange={(v) => setDraft((d) => ({ ...d, projectNumber: v }))}
            />
            <Field
              label="Client"
              testId="project-info-client"
              value={draft.clientName}
              onChange={(v) => setDraft((d) => ({ ...d, clientName: v }))}
            />
            <Field
              label="Status"
              testId="project-info-status"
              value={draft.projectStatus}
              onChange={(v) => setDraft((d) => ({ ...d, projectStatus: v }))}
            />
            <Field
              label="Author"
              testId="project-info-author"
              value={draft.authorName}
              onChange={(v) => setDraft((d) => ({ ...d, authorName: v }))}
            />
            <Field
              label="Checked by"
              testId="project-info-checkdate"
              value={draft.checkDate}
              onChange={(v) => setDraft((d) => ({ ...d, checkDate: v }))}
            />
            <Field
              label="Issue date"
              testId="project-info-issuedate"
              value={draft.issueDate}
              onChange={(v) => setDraft((d) => ({ ...d, issueDate: v }))}
            />
            <Field
              label="True North angle (°)"
              testId="project-info-north-angle"
              value={draft.projectNorthAngleDeg}
              onChange={(v) => setDraft((d) => ({ ...d, projectNorthAngleDeg: v }))}
            />
          </div>
          <div style={{ marginTop: 12 }}>
            <label
              style={{
                display: 'block',
                fontSize: 11,
                color: 'var(--color-text-secondary)',
                marginBottom: 4,
              }}
            >
              Address
            </label>
            <textarea
              data-testid="project-info-address"
              value={draft.projectAddress}
              onChange={(e) => setDraft((d) => ({ ...d, projectAddress: e.currentTarget.value }))}
              rows={3}
              style={{
                width: '100%',
                fontSize: 13,
                border: '1px solid var(--color-border)',
                borderRadius: 4,
                padding: '6px 8px',
                background: 'var(--color-surface)',
                color: 'var(--color-text)',
                resize: 'vertical',
                boxSizing: 'border-box',
              }}
            />
          </div>
          <div style={{ marginTop: 12 }}>
            <label
              style={{
                display: 'block',
                fontSize: 11,
                color: 'var(--color-text-secondary)',
                marginBottom: 4,
              }}
            >
              Description
            </label>
            <textarea
              data-testid="project-info-description"
              value={draft.projectDescription}
              onChange={(e) =>
                setDraft((d) => ({ ...d, projectDescription: e.currentTarget.value }))
              }
              rows={3}
              style={{
                width: '100%',
                fontSize: 13,
                border: '1px solid var(--color-border)',
                borderRadius: 4,
                padding: '6px 8px',
                background: 'var(--color-surface)',
                color: 'var(--color-text)',
                resize: 'vertical',
                boxSizing: 'border-box',
              }}
            />
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '10px 16px',
            borderTop: '1px solid var(--color-border)',
            flexShrink: 0,
          }}
        >
          <span
            style={{
              fontSize: 12,
              color: message?.startsWith('Save failed')
                ? 'var(--color-error, #e55)'
                : 'var(--color-text-secondary)',
            }}
          >
            {message ?? ''}
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={onClose}
              style={{
                fontSize: 13,
                padding: '5px 14px',
                borderRadius: 4,
                border: '1px solid var(--color-border)',
                background: 'var(--color-surface)',
                color: 'var(--color-text)',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              data-testid="project-info-save"
              disabled={busy}
              onClick={() => void save()}
              style={{
                fontSize: 13,
                padding: '5px 14px',
                borderRadius: 4,
                border: 'none',
                background: 'var(--color-accent, #2563eb)',
                color: '#fff',
                cursor: 'pointer',
                opacity: busy ? 0.6 : 1,
              }}
            >
              {busy ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  testId,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  testId?: string;
}): JSX.Element {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>{label}</span>
      <input
        data-testid={testId}
        type="text"
        value={value}
        onChange={(e) => onChange(e.currentTarget.value)}
        style={{
          fontSize: 13,
          border: '1px solid var(--color-border)',
          borderRadius: 4,
          padding: '5px 8px',
          background: 'var(--color-surface)',
          color: 'var(--color-text)',
        }}
      />
    </label>
  );
}
