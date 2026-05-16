import { type JSX, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { Element } from '@bim-ai/core';

type ProjectSettingsElem = Extract<Element, { kind: 'project_settings' }>;
type GlobalParam = NonNullable<ProjectSettingsElem['globalParams']>[number];
type CommandDispatcher = (cmd: Record<string, unknown>) => void | Promise<void>;

/** Safe formula evaluator — strips non-numeric chars except operators, parens, spaces. */
export function evalFormulaMm(formula: string): number {
  const sanitized = formula.replace(/[^0-9+\-*/(). ]/g, '');
  try {
    const result = Function('"use strict"; return (' + sanitized + ')')() as unknown;
    if (typeof result === 'number' && isFinite(result)) return result;
  } catch {
    // invalid expression — fall through
  }
  return NaN;
}

/** Apply an addGlobalParam / updateGlobalParam / deleteGlobalParam command to a params array. */
export function applyGlobalParamCommand(
  params: GlobalParam[],
  cmd: Record<string, unknown>,
): GlobalParam[] {
  if (cmd.type === 'addGlobalParam') {
    const id = cmd.id as string;
    const name = cmd.name as string;
    const formula = cmd.formula as string;
    const valueMm = evalFormulaMm(formula);
    return [...params, { id, name, formula, valueMm: isNaN(valueMm) ? 0 : valueMm }];
  }
  if (cmd.type === 'updateGlobalParam') {
    const id = cmd.id as string;
    const formula = cmd.formula as string;
    const valueMm = evalFormulaMm(formula);
    return params.map((p) =>
      p.id === id ? { ...p, formula, valueMm: isNaN(valueMm) ? p.valueMm : valueMm } : p,
    );
  }
  if (cmd.type === 'deleteGlobalParam') {
    const id = cmd.id as string;
    return params.filter((p) => p.id !== id);
  }
  return params;
}

export function GlobalParamsDialog({
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

  const projectSettings = useMemo(() => {
    return Object.values(elementsById).find(
      (e): e is ProjectSettingsElem => e.kind === 'project_settings',
    );
  }, [elementsById]);

  const params = useMemo<GlobalParam[]>(
    () => projectSettings?.globalParams ?? [],
    [projectSettings],
  );

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editFormula, setEditFormula] = useState('');
  const [newName, setNewName] = useState('');
  const [newFormula, setNewFormula] = useState('0');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setEditingId(null);
      setNewName('');
      setNewFormula('0');
      setError(null);
    } else {
      requestAnimationFrame(() => dialogRef.current?.focus());
    }
  }, [open]);

  const run = useCallback(
    async (cmd: Record<string, unknown>) => {
      setBusy(true);
      setError(null);
      try {
        await onSemanticCommand(cmd);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Command failed');
      } finally {
        setBusy(false);
      }
    },
    [onSemanticCommand],
  );

  const addParam = async () => {
    const name = newName.trim();
    if (!name) return;
    const valueMm = evalFormulaMm(newFormula);
    if (isNaN(valueMm)) {
      setError('Invalid formula');
      return;
    }
    const id = `param-${name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .slice(0, 24)}-${Date.now().toString(36)}`;
    setNewName('');
    setNewFormula('0');
    await run({ type: 'addGlobalParam', id, name, formula: newFormula, valueMm });
  };

  const commitEdit = async () => {
    if (!editingId) return;
    const valueMm = evalFormulaMm(editFormula);
    if (isNaN(valueMm)) {
      setError('Invalid formula');
      return;
    }
    setEditingId(null);
    await run({ type: 'updateGlobalParam', id: editingId, formula: editFormula, valueMm });
  };

  const deleteParam = async (id: string) => {
    await run({ type: 'deleteGlobalParam', id });
  };

  const startEdit = (p: GlobalParam) => {
    setEditingId(p.id);
    setEditName(p.name);
    setEditFormula(p.formula);
    setError(null);
  };

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Global Parameters"
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
          width: 600,
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
          <span style={{ fontWeight: 600, fontSize: 14 }}>Global Parameters</span>
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
            data-testid="global-params-table"
            style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}
          >
            <thead>
              <tr style={{ background: 'var(--color-background)' }}>
                <th scope="col" style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 600 }}>
                  Name
                </th>
                <th scope="col" style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 600 }}>
                  Formula
                </th>
                <th
                  scope="col"
                  style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 600, width: 110 }}
                >
                  Value (mm)
                </th>
                <th scope="col" style={{ width: 60 }}></th>
              </tr>
            </thead>
            <tbody>
              {params.map((p) => (
                <tr
                  key={p.id}
                  data-testid={`global-param-row-${p.id}`}
                  style={{ borderTop: '1px solid var(--color-border)' }}
                >
                  {editingId === p.id ? (
                    <>
                      <td style={{ padding: '4px 8px' }}>
                        <input
                          data-testid="param-edit-name"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          style={{ width: '100%', fontSize: 13 }}
                        />
                      </td>
                      <td style={{ padding: '4px 8px' }}>
                        <input
                          data-testid="param-edit-formula"
                          value={editFormula}
                          onChange={(e) => setEditFormula(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') void commitEdit();
                            if (e.key === 'Escape') setEditingId(null);
                          }}
                          style={{ width: '100%', fontSize: 13 }}
                        />
                      </td>
                      <td style={{ padding: '4px 8px', textAlign: 'right' }}>
                        {isNaN(evalFormulaMm(editFormula))
                          ? '—'
                          : evalFormulaMm(editFormula).toFixed(1)}
                      </td>
                      <td style={{ padding: '4px 8px', textAlign: 'center' }}>
                        <button disabled={busy} onClick={() => void commitEdit()}>
                          ✓
                        </button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td style={{ padding: '6px 8px' }}>{p.name}</td>
                      <td
                        style={{ padding: '6px 8px', cursor: 'pointer' }}
                        onClick={() => startEdit(p)}
                      >
                        {p.formula}
                      </td>
                      <td style={{ padding: '6px 8px', textAlign: 'right' }}>
                        {p.valueMm.toFixed(1)}
                      </td>
                      <td style={{ padding: '4px 8px', textAlign: 'center' }}>
                        <button
                          data-testid={`delete-param-${p.id}`}
                          disabled={busy}
                          onClick={() => void deleteParam(p.id)}
                          style={{
                            color: 'var(--color-destructive)',
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                          }}
                        >
                          ✕
                        </button>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Add new row */}
        <div
          style={{
            borderTop: '1px solid var(--color-border)',
            padding: '10px 16px',
            display: 'flex',
            gap: 8,
            alignItems: 'center',
            flexShrink: 0,
          }}
        >
          <input
            data-testid="new-param-name"
            placeholder="Name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void addParam();
            }}
            style={{ flex: 1, fontSize: 13 }}
          />
          <input
            data-testid="new-param-formula"
            placeholder="Formula"
            value={newFormula}
            onChange={(e) => setNewFormula(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void addParam();
            }}
            style={{ flex: 1, fontSize: 13 }}
          />
          <button
            data-testid="add-param-button"
            disabled={busy || !newName.trim()}
            onClick={() => void addParam()}
            style={{ whiteSpace: 'nowrap', padding: '4px 12px' }}
          >
            Add Parameter
          </button>
        </div>

        {error && (
          <div style={{ color: 'var(--color-destructive)', padding: '4px 16px 8px', fontSize: 12 }}>
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
