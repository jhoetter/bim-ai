import { useEffect, useState, type JSX } from 'react';

import { VIEW_RANGE_DEFAULTS } from './planProjection';

export type ViewRangeValues = {
  viewRangeTopMm: number;
  cutPlaneOffsetMm: number;
  viewRangeBottomMm: number;
  viewDepth: number;
};

export type ViewRangeDialogProps = {
  open: boolean;
  viewId: string;
  viewRangeTopMm: number;
  cutPlaneOffsetMm: number;
  viewRangeBottomMm: number;
  viewDepth: number;
  onClose: () => void;
  onApply: (values: ViewRangeValues) => void;
};

export function ViewRangeDialog({
  open,
  viewRangeTopMm,
  cutPlaneOffsetMm,
  viewRangeBottomMm,
  viewDepth,
  onClose,
  onApply,
}: ViewRangeDialogProps): JSX.Element | null {
  const [top, setTop] = useState(String(viewRangeTopMm));
  const [cut, setCut] = useState(String(cutPlaneOffsetMm));
  const [bottom, setBottom] = useState(String(viewRangeBottomMm));
  const [depth, setDepth] = useState(String(viewDepth));

  useEffect(() => {
    if (open) {
      setTop(String(viewRangeTopMm));
      setCut(String(cutPlaneOffsetMm));
      setBottom(String(viewRangeBottomMm));
      setDepth(String(viewDepth));
    }
  }, [open, viewRangeTopMm, cutPlaneOffsetMm, viewRangeBottomMm, viewDepth]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  function parseOrDefault(raw: string, fallback: number): number {
    const n = parseFloat(raw);
    return Number.isFinite(n) ? n : fallback;
  }

  function handleApply() {
    onApply({
      viewRangeTopMm: parseOrDefault(top, VIEW_RANGE_DEFAULTS.viewRangeTopMm),
      cutPlaneOffsetMm: parseOrDefault(cut, VIEW_RANGE_DEFAULTS.cutPlaneOffsetMm),
      viewRangeBottomMm: parseOrDefault(bottom, VIEW_RANGE_DEFAULTS.viewRangeBottomMm),
      viewDepth: parseOrDefault(depth, VIEW_RANGE_DEFAULTS.viewDepth),
    });
    onClose();
  }

  const inputStyle = {
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
            data-testid="view-range-top"
            type="number"
            value={top}
            onChange={(e) => setTop(e.target.value)}
            style={inputStyle}
          />
        </label>

        <label style={labelStyle}>
          Cut Plane Height (mm)
          <input
            data-testid="view-range-cut"
            type="number"
            value={cut}
            onChange={(e) => setCut(e.target.value)}
            style={inputStyle}
          />
        </label>

        <label style={labelStyle}>
          Bottom of Range (mm)
          <input
            data-testid="view-range-bottom"
            type="number"
            value={bottom}
            onChange={(e) => setBottom(e.target.value)}
            style={inputStyle}
          />
        </label>

        <label style={labelStyle}>
          View Depth (mm)
          <input
            data-testid="view-range-depth"
            type="number"
            value={depth}
            onChange={(e) => setDepth(e.target.value)}
            style={inputStyle}
          />
        </label>

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
              background: 'transparent',
              color: 'var(--color-foreground)',
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            data-testid="view-range-apply"
            onClick={handleApply}
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
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}
