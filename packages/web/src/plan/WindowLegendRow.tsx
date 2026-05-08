import type { ReactElement } from 'react';

export type WindowLegendEntry = {
  typeId: string;
  label: string;
  widthMm: number;
  heightMm: number;
  sillMm: number;
  count: number;
};

export type WindowLegendRowProps = {
  entry: WindowLegendEntry;
};

export function WindowLegendRow({ entry }: WindowLegendRowProps): ReactElement {
  const { label, widthMm, heightMm, sillMm, count } = entry;

  // Proportional elevation thumbnail: max 80px wide, 100px tall
  const maxW = 80;
  const maxH = 100;
  const aspect = widthMm > 0 && heightMm > 0 ? widthMm / heightMm : 1;
  const thumbW = aspect >= 1 ? maxW : maxW * aspect;
  const thumbH = aspect >= 1 ? maxW / aspect : maxH;
  const pad = 4;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600 }}>{label}</span>
      <svg
        width={thumbW + pad * 2}
        height={thumbH + pad * 2}
        viewBox={`0 0 ${thumbW + pad * 2} ${thumbH + pad * 2}`}
        style={{ display: 'block' }}
      >
        {/* Outer frame */}
        <rect
          x={pad}
          y={pad}
          width={thumbW}
          height={thumbH}
          fill="none"
          stroke="var(--draft-lw-cut-major)"
          strokeWidth={1.5}
        />
        {/* Horizontal transom line at mid-height */}
        <line
          x1={pad}
          y1={pad + thumbH / 2}
          x2={pad + thumbW}
          y2={pad + thumbH / 2}
          stroke="var(--draft-lw-cut-major)"
          strokeWidth={0.75}
        />
        {/* Vertical mullion line at mid-width */}
        <line
          x1={pad + thumbW / 2}
          y1={pad}
          x2={pad + thumbW / 2}
          y2={pad + thumbH}
          stroke="var(--draft-lw-cut-major)"
          strokeWidth={0.75}
        />
      </svg>
      <span style={{ fontSize: 'var(--text-2xs)', textAlign: 'center' }}>
        {widthMm} × {heightMm} / sill {sillMm}
      </span>
      <span style={{ fontSize: 'var(--text-2xs)', color: 'var(--color-muted)' }}>×{count}</span>
    </div>
  );
}
