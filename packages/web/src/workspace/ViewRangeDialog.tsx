import { useState, type JSX } from 'react';
import type { Element } from '@bim-ai/core';

export interface ViewRangeDialogProps {
  open: boolean;
  onClose: () => void;
  planView: Extract<Element, { kind: 'plan_view' }>;
  levelElevationsMm: Record<string, number>;
  onSave: (patch: {
    viewRangeTopMm: number;
    viewRangeBottomMm: number;
    cutPlaneOffsetMm: number;
  }) => void;
}

export function ViewRangeDialog({
  open,
  onClose,
  planView,
  onSave,
}: ViewRangeDialogProps): JSX.Element | null {
  const [topMm, setTopMm] = useState(() => planView.viewRangeTopMm ?? 4000);
  const [cutMm, setCutMm] = useState(() => planView.cutPlaneOffsetMm ?? 1200);
  const [bottomMm, setBottomMm] = useState(() => planView.viewRangeBottomMm ?? 0);

  if (!open) return null;

  const invalid = cutMm <= bottomMm || cutMm >= topMm;

  const handleSave = () => {
    if (invalid) return;
    onSave({ viewRangeTopMm: topMm, viewRangeBottomMm: bottomMm, cutPlaneOffsetMm: cutMm });
    onClose();
  };

  // SVG diagram: y=0 is top, y increases downward
  const svgH = 200;
  const yTop = 24;
  const yBot = 176;
  const usable = yBot - yTop;
  const range = topMm - bottomMm;
  const yCut = range > 0 ? yTop + ((topMm - cutMm) / range) * usable : (yTop + yBot) / 2;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="View Range"
      data-testid="view-range-dialog"
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
          width: 440,
          maxWidth: 'calc(100vw - 48px)',
          maxHeight: 'calc(100vh - 96px)',
          overflowY: 'auto',
          boxShadow: '0 8px 32px rgba(0,0,0,0.32)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 16,
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
            View Range
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

        {/* Inputs */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
          <label style={rowStyle}>
            <span style={labelTextStyle}>Top of Range (mm)</span>
            <input
              data-testid="vr-top-mm"
              type="number"
              value={topMm}
              onChange={(e) => setTopMm(parseFloat(e.target.value) || 0)}
              style={inputStyle}
            />
          </label>
          <label style={rowStyle}>
            <span style={labelTextStyle}>Cut Plane (mm)</span>
            <input
              data-testid="vr-cut-mm"
              type="number"
              value={cutMm}
              onChange={(e) => setCutMm(parseFloat(e.target.value) || 0)}
              style={inputStyle}
            />
          </label>
          <label style={rowStyle}>
            <span style={labelTextStyle}>Bottom of Range (mm)</span>
            <input
              data-testid="vr-bottom-mm"
              type="number"
              value={bottomMm}
              onChange={(e) => setBottomMm(parseFloat(e.target.value) || 0)}
              style={inputStyle}
            />
          </label>
          {invalid && (
            <div
              data-testid="vr-error"
              style={{
                color: 'var(--color-destructive, #dc2626)',
                fontSize: 'var(--text-sm, 12.5px)',
              }}
            >
              Cut plane must be strictly between bottom and top of range.
            </div>
          )}
        </div>

        {/* SVG cross-section diagram */}
        <svg
          data-testid="vr-diagram"
          width="100%"
          height={svgH}
          viewBox={`0 0 300 ${svgH}`}
          style={{
            display: 'block',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-sm, 4px)',
            background: 'var(--color-background)',
            marginBottom: 16,
          }}
        >
          {/* Building outline */}
          <rect
            x={55}
            y={yTop}
            width={185}
            height={yBot - yTop}
            fill="var(--color-surface, #f8f8f8)"
            stroke="var(--color-border, #ccc)"
            strokeWidth={1}
          />

          {/* Top dashed line */}
          <line
            x1={40}
            y1={yTop}
            x2={240}
            y2={yTop}
            stroke="var(--color-muted-foreground, #888)"
            strokeWidth={1.5}
            strokeDasharray="6 3"
          />
          <text x={246} y={yTop + 4} fontSize={10} fill="var(--color-muted-foreground, #888)">
            Top
          </text>

          {/* Bottom dashed line */}
          <line
            x1={40}
            y1={yBot}
            x2={240}
            y2={yBot}
            stroke="var(--color-muted-foreground, #888)"
            strokeWidth={1.5}
            strokeDasharray="6 3"
          />
          <text x={246} y={yBot + 4} fontSize={10} fill="var(--color-muted-foreground, #888)">
            Bottom
          </text>

          {/* Cut plane solid line */}
          <line
            x1={40}
            y1={yCut}
            x2={240}
            y2={yCut}
            stroke="var(--color-accent, #2563eb)"
            strokeWidth={2}
          />
          <text x={246} y={yCut + 4} fontSize={10} fill="var(--color-accent, #2563eb)">
            Cut ✂
          </text>
        </svg>

        {/* Footer buttons */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button type="button" data-testid="vr-cancel" onClick={onClose} style={cancelBtnStyle}>
            Cancel
          </button>
          <button
            type="button"
            data-testid="vr-save"
            onClick={handleSave}
            disabled={invalid}
            style={{
              ...saveBtnStyle,
              opacity: invalid ? 0.5 : 1,
              cursor: invalid ? 'not-allowed' : 'pointer',
            }}
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}

const rowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 8,
};

const labelTextStyle: React.CSSProperties = {
  fontSize: 'var(--text-sm, 12.5px)',
  color: 'var(--color-foreground)',
  flexShrink: 0,
};

const inputStyle: React.CSSProperties = {
  width: 100,
  padding: 'var(--space-0-5, 2px) var(--space-1, 4px)',
  background: 'var(--color-background)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-sm, 4px)',
  color: 'var(--color-foreground)',
  fontSize: 'var(--text-sm, 12.5px)',
  textAlign: 'right',
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

const saveBtnStyle: React.CSSProperties = {
  padding: 'var(--space-1-5, 6px) var(--space-3, 12px)',
  background: 'var(--color-accent)',
  border: 'none',
  borderRadius: 'var(--radius-sm, 4px)',
  color: 'var(--color-accent-foreground, white)',
  fontSize: 'var(--text-sm, 12.5px)',
};
