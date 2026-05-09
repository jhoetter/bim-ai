import { useEffect, useState } from 'react';
import type { ReactElement } from 'react';

export type NewSheetDialogProps = {
  onClose: () => void;
  onSubmit: (cmd: Record<string, unknown>) => void;
};

export function NewSheetDialog({ onClose, onSubmit }: NewSheetDialogProps): ReactElement {
  const [number, setNumber] = useState('A-101');
  const [name, setName] = useState('');
  const [size, setSize] = useState<'A0' | 'A1' | 'A2' | 'A3'>('A1');
  const [orientation, setOrientation] = useState<'landscape' | 'portrait'>('landscape');

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  function handleCreate() {
    if (!number.trim() || !name.trim()) return;
    const sheetId = `sheet-${number
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')}-${Date.now().toString(36)}`;
    onSubmit({
      type: 'CreateSheet',
      sheetId,
      name: name.trim(),
      number: number.trim(),
      size,
      orientation,
    });
    onClose();
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="New sheet"
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.4)',
        zIndex: 1000,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: 'var(--color-surface-strong)',
          border: '1px solid var(--color-border)',
          borderRadius: 8,
          padding: 24,
          minWidth: 320,
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        <div style={{ fontWeight: 600, fontSize: 14 }}>New sheet</div>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
          Sheet number
          <input
            type="text"
            value={number}
            onChange={(e) => setNumber(e.target.value)}
            placeholder="A-101"
            style={{ padding: '4px 8px', border: '1px solid var(--color-border)', borderRadius: 4 }}
          />
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
          Sheet name
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ground Floor Plan"
            style={{ padding: '4px 8px', border: '1px solid var(--color-border)', borderRadius: 4 }}
          />
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
          Size
          <select
            value={size}
            onChange={(e) => setSize(e.target.value as 'A0' | 'A1' | 'A2' | 'A3')}
            style={{ padding: '4px 8px', border: '1px solid var(--color-border)', borderRadius: 4 }}
          >
            <option value="A0">A0</option>
            <option value="A1">A1</option>
            <option value="A2">A2</option>
            <option value="A3">A3</option>
          </select>
        </label>

        <div style={{ display: 'flex', gap: 8, fontSize: 12 }}>
          <button
            type="button"
            onClick={() => setOrientation('landscape')}
            style={{
              flex: 1,
              padding: '4px 8px',
              border: '1px solid var(--color-border)',
              borderRadius: 4,
              background: orientation === 'landscape' ? 'var(--color-accent)' : 'transparent',
              cursor: 'pointer',
            }}
          >
            Landscape
          </button>
          <button
            type="button"
            onClick={() => setOrientation('portrait')}
            style={{
              flex: 1,
              padding: '4px 8px',
              border: '1px solid var(--color-border)',
              borderRadius: 4,
              background: orientation === 'portrait' ? 'var(--color-accent)' : 'transparent',
              cursor: 'pointer',
            }}
          >
            Portrait
          </button>
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '6px 16px',
              border: '1px solid var(--color-border)',
              borderRadius: 4,
              cursor: 'pointer',
              fontSize: 12,
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleCreate}
            disabled={!number.trim() || !name.trim()}
            style={{
              padding: '6px 16px',
              border: 'none',
              borderRadius: 4,
              cursor: 'pointer',
              fontSize: 12,
              background: 'var(--color-accent)',
              opacity: !number.trim() || !name.trim() ? 0.5 : 1,
            }}
          >
            Create
          </button>
        </div>
      </div>
    </div>
  );
}
