import { useState } from 'react';
import type { Element } from '@bim-ai/core';

type DimStyleShape = NonNullable<Extract<Element, { kind: 'project_settings' }>['dimensionStyle']>;

export interface DimensionStyleDialogProps {
  open: boolean;
  onClose: () => void;
  currentStyle: DimStyleShape;
  onSave: (style: DimStyleShape) => void;
}

export function DimensionStyleDialog({
  open,
  onClose,
  currentStyle,
  onSave,
}: DimensionStyleDialogProps): JSX.Element | null {
  const [draft, setDraft] = useState<DimStyleShape>(currentStyle);

  if (!open) return null;

  function handleSave() {
    onSave(draft);
    onClose();
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Dimension Style"
      data-testid="dimension-style-dialog"
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
          width: 400,
          maxWidth: 'calc(100vw - 48px)',
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
            Dimension Style
          </h2>
          <button
            type="button"
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

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <label style={labelStyle}>
            <span style={labelTextStyle}>Text Height (mm)</span>
            <input
              type="number"
              data-testid="dim-style-text-height"
              min={1}
              max={10}
              step={0.5}
              value={draft.textHeightMm ?? 2.5}
              onChange={(e) =>
                setDraft((d) => ({ ...d, textHeightMm: parseFloat(e.target.value) || 2.5 }))
              }
              style={inputStyle}
            />
          </label>

          <label style={labelStyle}>
            <span style={labelTextStyle}>Witness Extension (mm)</span>
            <input
              type="number"
              data-testid="dim-style-witness-extension"
              step={0.5}
              value={draft.witnessLineExtensionMm ?? 2}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  witnessLineExtensionMm: parseFloat(e.target.value) || 2,
                }))
              }
              style={inputStyle}
            />
          </label>

          <label style={labelStyle}>
            <span style={labelTextStyle}>Witness Gap (mm)</span>
            <input
              type="number"
              data-testid="dim-style-witness-gap"
              step={0.5}
              value={draft.witnessLineGapMm ?? 1}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  witnessLineGapMm: parseFloat(e.target.value) || 1,
                }))
              }
              style={inputStyle}
            />
          </label>

          <label style={labelStyle}>
            <span style={labelTextStyle}>Arrow Style</span>
            <select
              data-testid="dim-style-arrow-style"
              value={draft.arrowStyle ?? 'arrow'}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  arrowStyle: e.target.value as DimStyleShape['arrowStyle'],
                }))
              }
              style={{ ...inputStyle, width: 'auto' }}
            >
              <option value="arrow">Arrow</option>
              <option value="dot">Dot</option>
              <option value="tick">Tick</option>
              <option value="none">None</option>
            </select>
          </label>

          <label style={{ ...labelStyle, flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <input
              type="checkbox"
              data-testid="dim-style-show-unit"
              checked={draft.showUnit ?? false}
              onChange={(e) => setDraft((d) => ({ ...d, showUnit: e.target.checked }))}
            />
            <span style={labelTextStyle}>Show unit suffix (mm)</span>
          </label>
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
          <button
            type="button"
            data-testid="dim-style-cancel"
            onClick={onClose}
            style={cancelBtnStyle}
          >
            Cancel
          </button>
          <button
            type="button"
            data-testid="dim-style-save"
            onClick={handleSave}
            style={saveBtnStyle}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
};

const labelTextStyle: React.CSSProperties = {
  fontSize: 'var(--text-sm, 12.5px)',
  color: 'var(--color-muted-foreground)',
  fontWeight: 500,
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: 'var(--space-1, 4px) var(--space-2, 8px)',
  background: 'var(--color-background)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-sm, 4px)',
  color: 'var(--color-foreground)',
  fontSize: 'var(--text-sm, 12.5px)',
  boxSizing: 'border-box',
};

const saveBtnStyle: React.CSSProperties = {
  padding: 'var(--space-1-5, 6px) var(--space-3, 12px)',
  background: 'var(--color-accent)',
  border: 'none',
  borderRadius: 'var(--radius-sm, 4px)',
  color: 'var(--color-accent-foreground, white)',
  fontSize: 'var(--text-sm, 12.5px)',
  cursor: 'pointer',
};

const cancelBtnStyle: React.CSSProperties = {
  padding: 'var(--space-1-5, 6px) var(--space-3, 12px)',
  background: 'var(--color-surface)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-sm, 4px)',
  color: 'var(--color-foreground)',
  fontSize: 'var(--text-sm, 12.5px)',
  cursor: 'pointer',
};
