import { useState } from 'react';

export type SimpleGlobalParam = {
  id: string;
  name: string;
  value: number;
  unit: 'mm' | 'm' | 'deg' | 'unitless';
};

/** Pure reducer for upsert_global_param / delete_global_param commands. */
export function applyGlobalParamCmd(
  params: SimpleGlobalParam[],
  cmd: Record<string, unknown>,
): SimpleGlobalParam[] {
  if (cmd.type === 'upsert_global_param') {
    const param = cmd.param as SimpleGlobalParam;
    const idx = params.findIndex((p) => p.id === param.id);
    if (idx >= 0) {
      return params.map((p, i) => (i === idx ? param : p));
    }
    return [...params, param];
  }
  if (cmd.type === 'delete_global_param') {
    return params.filter((p) => p.id !== (cmd.paramId as string));
  }
  return params;
}

export type ManageGlobalParamsDialogProps = {
  isOpen: boolean;
  params: SimpleGlobalParam[];
  onUpsertParam: (param: SimpleGlobalParam) => void;
  onDeleteParam: (paramId: string) => void;
  onClose: () => void;
};

export function ManageGlobalParamsDialog({
  isOpen,
  params,
  onUpsertParam,
  onDeleteParam,
  onClose,
}: ManageGlobalParamsDialogProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editValue, setEditValue] = useState('');
  const [editUnit, setEditUnit] = useState<SimpleGlobalParam['unit']>('mm');
  const [newName, setNewName] = useState('');
  const [newValue, setNewValue] = useState('0');
  const [newUnit, setNewUnit] = useState<SimpleGlobalParam['unit']>('mm');

  if (!isOpen) return null;

  const handleAdd = () => {
    const name = newName.trim();
    if (!name) return;
    const value = parseFloat(newValue);
    if (!isFinite(value)) return;
    const id = `param-${name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .slice(0, 24)}-${Date.now().toString(36)}`;
    onUpsertParam({ id, name, value, unit: newUnit });
    setNewName('');
    setNewValue('0');
    setNewUnit('mm');
  };

  const startEdit = (p: SimpleGlobalParam) => {
    setEditingId(p.id);
    setEditName(p.name);
    setEditValue(String(p.value));
    setEditUnit(p.unit);
  };

  const commitEdit = () => {
    if (!editingId) return;
    const value = parseFloat(editValue);
    if (!isFinite(value)) return;
    onUpsertParam({ id: editingId, name: editName.trim() || editingId, value, unit: editUnit });
    setEditingId(null);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Global Parameters"
      data-testid="global-params-dialog"
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
          width: 560,
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
            Global Parameters
          </h2>
          <button
            type="button"
            data-testid="global-params-close"
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
              <th style={thStyle}>Name</th>
              <th style={thStyle}>Value</th>
              <th style={thStyle}>Unit</th>
              <th style={thStyle} />
            </tr>
          </thead>
          <tbody>
            {params.length === 0 ? (
              <tr>
                <td
                  colSpan={4}
                  style={{
                    ...tdStyle,
                    textAlign: 'center',
                    color: 'var(--color-muted-foreground)',
                  }}
                >
                  No parameters — add one below.
                </td>
              </tr>
            ) : null}
            {params.map((p) => (
              <tr key={p.id} data-testid={`global-param-row-${p.id}`}>
                {editingId === p.id ? (
                  <>
                    <td style={tdStyle}>
                      <input
                        data-testid="param-edit-name"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        style={inputStyle}
                      />
                    </td>
                    <td style={tdStyle}>
                      <input
                        data-testid="param-edit-value"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') commitEdit();
                          if (e.key === 'Escape') setEditingId(null);
                        }}
                        style={inputStyle}
                      />
                    </td>
                    <td style={tdStyle}>
                      <select
                        data-testid="param-edit-unit"
                        value={editUnit}
                        onChange={(e) => setEditUnit(e.target.value as SimpleGlobalParam['unit'])}
                        style={{ ...inputStyle, width: 'auto' }}
                      >
                        {unitOptions}
                      </select>
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>
                      <button style={actionBtnStyle} onClick={commitEdit}>
                        ✓
                      </button>
                    </td>
                  </>
                ) : (
                  <>
                    <td style={{ ...tdStyle, cursor: 'pointer' }} onClick={() => startEdit(p)}>
                      {p.name}
                    </td>
                    <td style={{ ...tdStyle, cursor: 'pointer' }} onClick={() => startEdit(p)}>
                      {p.value}
                    </td>
                    <td style={tdStyle}>{p.unit}</td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>
                      <button
                        type="button"
                        data-testid={`delete-param-${p.id}`}
                        onClick={() => onDeleteParam(p.id)}
                        style={{
                          ...actionBtnStyle,
                          color: 'var(--color-destructive, #dc2626)',
                        }}
                      >
                        Delete
                      </button>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            data-testid="new-param-name"
            placeholder="Name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAdd();
            }}
            style={{ ...inputStyle, flex: 1 }}
          />
          <input
            data-testid="new-param-value"
            placeholder="Value"
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAdd();
            }}
            style={{ ...inputStyle, width: 80 }}
          />
          <select
            data-testid="new-param-unit"
            value={newUnit}
            onChange={(e) => setNewUnit(e.target.value as SimpleGlobalParam['unit'])}
            style={{ ...inputStyle, width: 'auto' }}
          >
            {unitOptions}
          </select>
          <button
            type="button"
            data-testid="global-params-add"
            onClick={handleAdd}
            disabled={!newName.trim()}
            style={{
              padding: 'var(--space-1-5, 6px) var(--space-3, 12px)',
              background: 'var(--color-accent)',
              border: 'none',
              borderRadius: 'var(--radius-sm, 4px)',
              color: 'var(--color-accent-foreground, white)',
              fontSize: 'var(--text-sm, 12.5px)',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            Add Parameter
          </button>
        </div>
      </div>
    </div>
  );
}

const unitOptions = (
  <>
    <option value="mm">mm</option>
    <option value="m">m</option>
    <option value="deg">deg</option>
    <option value="unitless">unitless</option>
  </>
);

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
