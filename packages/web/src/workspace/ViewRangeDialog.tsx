import { useState, type JSX } from 'react';
import type { Element } from '@bim-ai/core';

import { VIEW_RANGE_DEFAULTS } from '../plan/planProjection';

interface ViewRangeDialogProps {
  open: boolean;
  onClose: () => void;
  view: Extract<Element, { kind: 'plan_view' }>;
  onPropertyChange: (key: string, value: number) => void;
}

export function ViewRangeDialog({
  open,
  onClose,
  view,
  onPropertyChange,
}: ViewRangeDialogProps): JSX.Element | null {
  const [top, setTop] = useState(() => view.viewRangeTopMm ?? VIEW_RANGE_DEFAULTS.viewRangeTopMm);
  const [cut, setCut] = useState(
    () => view.cutPlaneOffsetMm ?? VIEW_RANGE_DEFAULTS.cutPlaneOffsetMm,
  );
  const [bottom, setBottom] = useState(
    () => view.viewRangeBottomMm ?? VIEW_RANGE_DEFAULTS.viewRangeBottomMm,
  );
  const [depth, setDepth] = useState(() => view.viewDepth ?? VIEW_RANGE_DEFAULTS.viewDepth);

  if (!open) return null;

  const invalid = top <= cut || cut <= bottom;

  const inputStyle: React.CSSProperties = {
    padding: '4px 8px',
    border: '1px solid var(--color-border)',
    borderRadius: 4,
    background: 'var(--color-background, var(--color-surface))',
    color: 'var(--color-foreground)',
    fontFamily: 'var(--font-mono, monospace)',
    fontSize: 12,
    width: '100%',
  };

  const labelStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    fontSize: 12,
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="View Range"
      data-testid="view-range-dialog"
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
        <div style={{ fontWeight: 600, fontSize: 14 }}>View Range</div>

        <div style={{ fontSize: 11, color: 'var(--color-muted)' }}>
          All values in mm above level elevation.
        </div>

        <label style={labelStyle}>
          Top of Range (mm)
          <input
            data-testid="vr-top"
            type="number"
            value={top}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              if (Number.isFinite(v)) {
                setTop(v);
                onPropertyChange('viewRangeTopMm', v);
              }
            }}
            style={inputStyle}
          />
        </label>

        <label style={labelStyle}>
          Cut Plane Height (mm)
          <input
            data-testid="vr-cut"
            type="number"
            value={cut}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              if (Number.isFinite(v)) {
                setCut(v);
                onPropertyChange('cutPlaneOffsetMm', v);
              }
            }}
            style={inputStyle}
          />
        </label>

        <label style={labelStyle}>
          Bottom of Range (mm)
          <input
            data-testid="vr-bottom"
            type="number"
            value={bottom}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              if (Number.isFinite(v)) {
                setBottom(v);
                onPropertyChange('viewRangeBottomMm', v);
              }
            }}
            style={inputStyle}
          />
        </label>

        <label style={labelStyle}>
          View Depth (mm)
          <input
            data-testid="vr-depth"
            type="number"
            value={depth}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              if (Number.isFinite(v)) {
                setDepth(v);
                onPropertyChange('viewDepth', v);
              }
            }}
            style={inputStyle}
          />
        </label>

        {invalid ? (
          <div
            data-testid="vr-warning"
            style={{ fontSize: 11, color: 'var(--color-warning, #f59e0b)' }}
          >
            Warning: Top must be greater than Cut Plane, and Cut Plane must be greater than Bottom.
          </div>
        ) : null}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            type="button"
            data-testid="vr-ok"
            onClick={onClose}
            style={{
              padding: '6px 16px',
              border: 'none',
              borderRadius: 4,
              cursor: 'pointer',
              fontSize: 12,
              background: 'var(--color-accent)',
              color: 'var(--color-accent-foreground, var(--color-foreground))',
            }}
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}
