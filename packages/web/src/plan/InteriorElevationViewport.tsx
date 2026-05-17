import React from 'react';

import type { Element } from '@bim-ai/core';

import { buildInteriorElevationLines } from './interiorElevationProjection';

interface Props {
  marker: Extract<Element, { kind: 'interior_elevation_marker' }>;
  direction: 'N' | 'S' | 'E' | 'W';
  elementsById: Record<string, Element | undefined>;
  widthPx?: number;
  heightPx?: number;
}

/**
 * SVG interior elevation viewport — §6.1.5.
 *
 * Renders a 2D orthographic interior elevation for one view direction of an
 * interior_elevation_marker element. The SVG is Y-flipped so elevation 0
 * appears at the bottom.
 */
export function InteriorElevationViewport({
  marker,
  direction,
  elementsById,
  widthPx = 400,
  heightPx = 300,
}: Props) {
  const viewWidthMm = (marker.radiusMm ?? 3000) * 2;
  const viewHeightMm = 3000;
  const lines = buildInteriorElevationLines(
    marker,
    direction,
    elementsById,
    viewWidthMm,
    viewHeightMm,
  );

  const scaleX = widthPx / viewWidthMm;
  const scaleY = heightPx / viewHeightMm;

  // Offset horizontal coords so that 0 is at the left edge (marker centre → widthPx/2)
  const offsetX = widthPx / 2;

  return (
    <svg
      width={widthPx}
      height={heightPx + 36}
      data-testid={`interior-elevation-viewport-${direction}`}
      style={{
        border: '1px solid var(--color-border, currentColor)',
        background: 'var(--color-surface, white)',
      }}
    >
      {/* Background rect */}
      <rect x={0} y={0} width={widthPx} height={heightPx} fill="white" />

      {/* Elevation lines */}
      {lines.map((ln, i) => (
        <line
          key={i}
          x1={ln.x1 * scaleX + offsetX}
          y1={heightPx - ln.y1 * scaleY}
          x2={ln.x2 * scaleX + offsetX}
          y2={heightPx - ln.y2 * scaleY}
          stroke="var(--color-foreground, currentColor)"
          strokeWidth={ln.strokeWidth}
        />
      ))}

      {/* View title */}
      <g transform={`translate(0, ${heightPx + 6})`}>
        <line
          x1="0"
          y1="0"
          x2={widthPx * 0.5}
          y2="0"
          stroke="var(--color-foreground, currentColor)"
          strokeWidth="1"
        />
        <text
          x="4"
          y="14"
          fontSize="10"
          fontFamily="sans-serif"
          fill="var(--color-foreground, currentColor)"
          data-testid={`interior-elevation-title-${direction}`}
        >
          {`Interior Elevation — ${direction}`}
        </text>
      </g>
    </svg>
  );
}
