import { useState, useEffect } from 'react';

import { validateCreateGroup } from './groupCommands';

interface Props {
  open: boolean;
  elementCount: number;
  onConfirm: (name: string) => void;
  onClose: () => void;
}

export function CreateGroupDialog({ open, elementCount, onConfirm, onClose }: Props) {
  const [name, setName] = useState('');
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    if (open) {
      setName('');
      setError(undefined);
    }
  }, [open]);

  if (!open) return null;

  function handleConfirm() {
    const ids = Array.from({ length: elementCount }, (_, i) => `el-${i}`);
    const v = validateCreateGroup(name, ids);
    if (!v.valid) {
      setError(v.error);
      return;
    }
    onConfirm(name.trim());
    onClose();
  }

  function handleKey(ev: React.KeyboardEvent) {
    if (ev.key === 'Enter') handleConfirm();
    if (ev.key === 'Escape') onClose();
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Create Model Group"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9000,
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
          background: 'var(--color-surface, #fff)',
          borderRadius: 6,
          padding: '20px 24px',
          minWidth: 320,
          maxWidth: 420,
          boxShadow: '0 8px 32px rgba(0,0,0,0.24)',
        }}
        onKeyDown={handleKey}
      >
        <h3 style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 600 }}>Create Model Group</h3>
        <p style={{ margin: '0 0 14px', fontSize: 13, color: 'var(--color-text-secondary, #666)' }}>
          {elementCount} element{elementCount !== 1 ? 's' : ''} selected
        </p>

        <label style={{ display: 'block', fontSize: 13, marginBottom: 6 }}>
          Group name
          <input
            autoFocus
            type="text"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setError(undefined);
            }}
            placeholder="e.g. Entrance Bay"
            style={{
              display: 'block',
              width: '100%',
              marginTop: 4,
              padding: '6px 8px',
              fontSize: 13,
              boxSizing: 'border-box',
              border: error ? '1px solid #c00' : '1px solid var(--color-border, #ccc)',
              borderRadius: 4,
            }}
          />
        </label>

        {error && (
          <p role="alert" style={{ margin: '6px 0 0', fontSize: 12, color: '#c00' }}>
            {error}
          </p>
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: 18, justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{
              padding: '6px 14px',
              fontSize: 13,
              borderRadius: 4,
              border: '1px solid var(--color-border, #ccc)',
              background: 'transparent',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            style={{
              padding: '6px 14px',
              fontSize: 13,
              borderRadius: 4,
              border: 'none',
              background: 'var(--color-accent, #0057d9)',
              color: '#fff',
              cursor: 'pointer',
            }}
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}
