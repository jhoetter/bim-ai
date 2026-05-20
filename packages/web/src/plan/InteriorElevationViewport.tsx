import React from 'react';

import type { Element } from '@bim-ai/core';

import { hatchPatternForMaterial, svgHatchDef } from './materialHatchPatterns';
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
/** Projected wall region for hatch fill rendering. */
interface WallRegion {
  hLeft: number;
  hRight: number;
  yBot: number;
  yTop: number;
  materialKey: string;
}

/** Build wall fill regions from elementsById for hatch rendering. */
function buildWallRegions(
  marker: Extract<Element, { kind: 'interior_elevation_marker' }>,
  direction: 'N' | 'S' | 'E' | 'W',
  elementsById: Record<string, Element | undefined>,
  viewWidthMm: number,
  viewHeightMm: number,
): WallRegion[] {
  const regions: WallRegion[] = [];
  const radiusMm = marker.radiusMm ?? 3000;
  const halfW = viewWidthMm / 2;
  const cx = marker.positionMm.xMm;
  const cy = marker.positionMm.yMm;

  function projectH(xMm: number, yMm: number): number {
    switch (direction) {
      case 'N':
        return xMm - cx;
      case 'S':
        return -(xMm - cx);
      case 'E':
        return yMm - cy;
      case 'W':
        return -(yMm - cy);
    }
  }
  function projectDepth(xMm: number, yMm: number): number {
    switch (direction) {
      case 'N':
        return -(yMm - cy);
      case 'S':
        return yMm - cy;
      case 'E':
        return xMm - cx;
      case 'W':
        return -(xMm - cx);
    }
  }
  function levelElevMm(levelId: string): number {
    const lvl = elementsById[levelId];
    if (lvl?.kind === 'level') return lvl.elevationMm;
    return 0;
  }

  for (const el of Object.values(elementsById)) {
    if (!el || el.kind !== 'wall') continue;

    const hStart = projectH(el.start.xMm, el.start.yMm);
    const hEnd = projectH(el.end.xMm, el.end.yMm);
    const dStart = projectDepth(el.start.xMm, el.start.yMm);
    const dEnd = projectDepth(el.end.xMm, el.end.yMm);

    const hMin = Math.min(hStart, hEnd);
    const hMax = Math.max(hStart, hEnd);
    const dMin = Math.min(dStart, dEnd);
    const dMax = Math.max(dStart, dEnd);

    if (hMax < -halfW || hMin > halfW) continue;
    if (dMax < 0 || dMin > radiusMm) continue;

    const baseElev = levelElevMm(el.levelId);
    const topElev = baseElev + el.heightMm;
    const yBot = Math.max(0, baseElev);
    const yTop = Math.min(viewHeightMm, topElev);
    if (yTop <= yBot) continue;

    const hLeft = Math.max(-halfW, Math.min(halfW, Math.min(hStart, hEnd)));
    const hRight = Math.max(-halfW, Math.min(halfW, Math.max(hStart, hEnd)));
    if (hRight <= hLeft) continue;

    const materialKey = el.materialKey ?? 'concrete';
    regions.push({ hLeft, hRight, yBot, yTop, materialKey });
  }

  return regions;
}

export function InteriorElevationViewport({
  marker,
  direction,
  elementsById,
  widthPx = 400,
  heightPx = 300,
}: Props) {
  const viewWidthMm = (marker.radiusMm ?? 3000) * 2;
  const viewHeightMm = 3000;
  const storeyHeightMm = viewHeightMm;
  const lines = buildInteriorElevationLines(
    marker,
    direction,
    elementsById,
    viewWidthMm,
    viewHeightMm,
  );

  const wallRegions = buildWallRegions(marker, direction, elementsById, viewWidthMm, viewHeightMm);

  const scaleX = widthPx / viewWidthMm;
  const scaleY = heightPx / viewHeightMm;

  // Offset horizontal coords so that 0 is at the left edge (marker centre → widthPx/2)
  const offsetX = widthPx / 2;

  // Collect unique material keys for hatch defs
  const materialKeys = [...new Set(wallRegions.map((w) => w.materialKey))];

  const margin = 10;

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
      {/* §6.1.5: material hatch pattern defs */}
      <defs
        dangerouslySetInnerHTML={{
          __html: materialKeys
            .map((mk) => svgHatchDef(hatchPatternForMaterial(mk), `hatch-iel-${mk}`, 1))
            .join(''),
        }}
      />

      {/* Background rect */}
      <rect x={0} y={0} width={widthPx} height={heightPx} fill="white" />

      {/* §6.1.5: wall hatch fill regions */}
      {wallRegions.map((w, i) => {
        const x = w.hLeft * scaleX + offsetX;
        const width = (w.hRight - w.hLeft) * scaleX;
        const y = heightPx - w.yTop * scaleY;
        const height = (w.yTop - w.yBot) * scaleY;
        return (
          <rect
            key={`wall-fill-${i}`}
            x={x}
            y={y}
            width={width}
            height={height}
            fill={`url(#hatch-iel-${w.materialKey})`}
            stroke="var(--color-border-strong)"
            strokeWidth={1}
          />
        );
      })}

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

      {/* §6.1.5: storey height ruler */}
      {storeyHeightMm > 0 && (
        <g data-testid="iel-height-ruler">
          {/* Vertical dashed line */}
          <line
            x1={widthPx - 20}
            y1={heightPx - margin}
            x2={widthPx - 20}
            y2={margin}
            stroke="var(--color-muted-foreground)"
            strokeWidth={1}
            strokeDasharray="4 2"
          />
          {/* Height label */}
          <text
            x={widthPx - 8}
            y={heightPx / 2}
            fontSize={9}
            fill="var(--color-muted-foreground)"
            textAnchor="middle"
            transform={`rotate(-90, ${widthPx - 8}, ${heightPx / 2})`}
          >
            {Math.round(storeyHeightMm)} mm
          </text>
        </g>
      )}

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
