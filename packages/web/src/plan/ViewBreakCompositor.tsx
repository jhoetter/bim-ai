import type { ReactElement, ReactNode } from 'react';
import type { ViewBreak } from '@bim-ai/core';

type ViewBreakCompositorProps = {
  breaks: ViewBreak[];
  totalLengthMM: number;
  scaleDenominator: number;
  children: ReactNode;
};

const WAVY_AMPLITUDE = 4;
const WAVY_PERIOD = 12;

function wavyPath(x: number, y1: number, y2: number): string {
  const height = y2 - y1;
  const segments = Math.max(2, Math.round(height / WAVY_PERIOD));
  const segH = height / segments;
  let d = `M ${x} ${y1}`;
  for (let i = 0; i < segments; i++) {
    const yMid = y1 + (i + 0.5) * segH;
    const yEnd = y1 + (i + 1) * segH;
    const dir = i % 2 === 0 ? WAVY_AMPLITUDE : -WAVY_AMPLITUDE;
    d += ` Q ${x + dir} ${yMid} ${x} ${yEnd}`;
  }
  return d;
}

export function ViewBreakCompositor({
  breaks,
  totalLengthMM,
  scaleDenominator,
  children,
}: ViewBreakCompositorProps): ReactElement {
  const mmPerPx = scaleDenominator / 1000;
  const totalPx = totalLengthMM / mmPerPx;

  if (breaks.length === 0) {
    return <g>{children}</g>;
  }

  const sorted = [...breaks].sort((a, b) => a.axisMM - b.axisMM);

  let cumulativeOffsetPx = 0;
  const cutLines: ReactElement[] = [];
  const clipTranslations: { clipPath: string; tx: number }[] = [];

  sorted.forEach((brk, idx) => {
    const axisStartPx = brk.axisMM / mmPerPx;
    const widthPx = brk.widthMM / mmPerPx;
    const cutX = axisStartPx - cumulativeOffsetPx;

    cutLines.push(
      <path
        key={`break-${idx}`}
        d={wavyPath(cutX, 0, totalPx)}
        fill="none"
        stroke="var(--draft-lw-cut-minor)"
        strokeWidth={1}
      />,
    );

    clipTranslations.push({ clipPath: `inset(0 0 0 ${brk.axisMM + brk.widthMM}mm)`, tx: -widthPx });
    cumulativeOffsetPx += widthPx;
  });

  const totalReducedPx = totalPx - cumulativeOffsetPx;

  return (
    <g style={{ overflow: 'hidden', width: totalReducedPx }}>
      {children}
      {cutLines}
    </g>
  );
}
