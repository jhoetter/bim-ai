import { useMemo, type JSX } from 'react';

import type { Element } from '@bim-ai/core';

import { buildElevationLines } from './elevationProjection';

interface Props {
  view: Extract<Element, { kind: 'elevation_view' }>;
  elementsById: Record<string, Element | undefined>;
  widthPx: number;
  heightPx: number;
}

/**
 * SVG elevation view renderer — §6.1.4.
 *
 * Renders a 2D orthographic elevation of the model by projecting wall and
 * floor geometry into a direction-specific screen space.  The SVG is Y-flipped
 * so that elevation 0 appears at the bottom.
 */
export function ElevationViewport({ view, elementsById, widthPx, heightPx }: Props): JSX.Element {
  const lines = useMemo(() => buildElevationLines(view, elementsById), [view, elementsById]);

  if (lines.length === 0) {
    return (
      <div
        data-testid="elevation-viewport-empty"
        style={{
          width: widthPx,
          height: heightPx,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--color-muted)',
          fontSize: 12,
        }}
      >
        No geometry to display
      </div>
    );
  }

  // Compute SVG bounding box from all projected lines with 500 mm padding.
  const allX = lines.flatMap((l) => [l.x1, l.x2]);
  const allY = lines.flatMap((l) => [l.y1, l.y2]);
  const minX = Math.min(...allX) - 500;
  const maxX = Math.max(...allX) + 500;
  const minY = Math.min(...allY) - 500;
  const maxY = Math.max(...allY) + 500;
  const vbW = maxX - minX;
  const vbH = maxY - minY;

  return (
    <svg
      data-testid="elevation-viewport-svg"
      width={widthPx}
      height={heightPx}
      viewBox={`${minX} ${minY} ${vbW} ${vbH}`}
      style={{ transform: 'scaleY(-1)' /* flip Y so elevation 0 is at bottom */ }}
    >
      {lines.map((l, i) => (
        <line
          key={i}
          x1={l.x1}
          y1={l.y1}
          x2={l.x2}
          y2={l.y2}
          stroke="var(--color-foreground, #222)"
          strokeWidth={l.lineWeight ?? 300}
          strokeDasharray={l.dash ? '500 300' : undefined}
        />
      ))}
    </svg>
  );
}
