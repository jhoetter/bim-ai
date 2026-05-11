/**
 * EDT-05 / CAN-V3-03 — Snap glyph layer.
 *
 * 2D HTML overlay rendered above the plan canvas. Draws a kind-specific
 * glyph at the active snap point (square / triangle / × / ⊥ / dot+dash)
 * plus a lower-left label. Pure presentational component — caller maps
 * world-mm to client-px and supplies the active SnapHit and the
 * extension source segment when the kind is `'extension'`.
 */
import type { SnapKind } from './snapEngine';

const GLYPH_PX = 14;

export interface SnapGlyphProps {
  /** Screen-space pixels (relative to the canvas root). */
  pxX: number;
  pxY: number;
  kind: SnapKind;
  /** Source-segment endpoint in screen px — only used for `extension`. */
  extensionFromPxX?: number;
  extensionFromPxY?: number;
  /** Render a faint highlight ring around the glyph (e.g. when this is
   *  the actively-selected candidate during Tab-cycle). */
  highlighted?: boolean;
  /** CAN-V3-03: show closed padlock when the acquired snap is associative. */
  associative?: boolean;
}

/** Returns the human label rendered in the lower-left readout. */
export function snapKindLabel(kind: SnapKind): string {
  switch (kind) {
    case 'endpoint':
      return 'endpoint';
    case 'midpoint':
      return 'midpoint';
    case 'nearest':
      return 'nearest';
    case 'center':
      return 'center';
    case 'intersection':
      return 'intersection';
    case 'perpendicular':
      return 'perpendicular';
    case 'extension':
      return 'extension';
    case 'tangent':
      return 'tangent';
    case 'parallel':
      return 'parallel';
    case 'workplane':
      return 'workplane';
    case 'grid':
      return 'grid';
    case 'raw':
      return '';
  }
}

/** Single glyph at one snap point. */
export function SnapGlyph(props: SnapGlyphProps) {
  const {
    pxX,
    pxY,
    kind,
    extensionFromPxX,
    extensionFromPxY,
    highlighted = false,
    associative = false,
  } = props;
  const half = GLYPH_PX / 2;
  // SVG viewBox is centred at (pxX, pxY); we stretch to include the
  // extension dashed line back to source when present.
  const minX = Math.min(pxX - half - 2, extensionFromPxX ?? pxX - half - 2);
  const minY = Math.min(pxY - half - 2, extensionFromPxY ?? pxY - half - 2);
  const maxX = Math.max(pxX + half + 2, extensionFromPxX ?? pxX + half + 2);
  const maxY = Math.max(pxY + half + 2, extensionFromPxY ?? pxY + half + 2);
  const width = maxX - minX;
  const height = maxY - minY;
  const stroke = 'var(--color-accent)';
  const ring = highlighted ? (
    <circle
      data-testid={`snap-glyph-ring-${kind}`}
      cx={pxX}
      cy={pxY}
      r={GLYPH_PX}
      fill="none"
      stroke={stroke}
      strokeOpacity={0.45}
      strokeWidth={1}
    />
  ) : null;
  let glyph: React.ReactNode = null;
  switch (kind) {
    case 'endpoint':
      glyph = (
        <rect
          data-testid="snap-glyph-endpoint"
          x={pxX - half}
          y={pxY - half}
          width={GLYPH_PX}
          height={GLYPH_PX}
          fill="none"
          stroke={stroke}
          strokeWidth={1.5}
        />
      );
      break;
    case 'intersection':
      glyph = (
        <g data-testid="snap-glyph-intersection">
          <line
            x1={pxX - half}
            y1={pxY - half}
            x2={pxX + half}
            y2={pxY + half}
            stroke={stroke}
            strokeWidth={1.5}
          />
          <line
            x1={pxX - half}
            y1={pxY + half}
            x2={pxX + half}
            y2={pxY - half}
            stroke={stroke}
            strokeWidth={1.5}
          />
        </g>
      );
      break;
    case 'midpoint':
      glyph = (
        <polygon
          data-testid="snap-glyph-midpoint"
          points={`${pxX},${pxY - half} ${pxX + half},${pxY} ${pxX},${pxY + half} ${pxX - half},${pxY}`}
          fill="none"
          stroke={stroke}
          strokeWidth={1.5}
        />
      );
      break;
    case 'center':
      glyph = (
        <g data-testid="snap-glyph-center">
          <circle cx={pxX} cy={pxY} r={half - 2} fill="none" stroke={stroke} strokeWidth={1.5} />
          <circle cx={pxX} cy={pxY} r={2} fill={stroke} />
        </g>
      );
      break;
    case 'nearest':
      glyph = (
        <g data-testid="snap-glyph-nearest">
          <circle cx={pxX} cy={pxY} r={3} fill={stroke} />
          <line
            x1={pxX - half}
            y1={pxY + half}
            x2={pxX + half}
            y2={pxY - half}
            stroke={stroke}
            strokeWidth={1.5}
          />
        </g>
      );
      break;
    case 'perpendicular':
      glyph = (
        <g data-testid="snap-glyph-perpendicular">
          {/* Vertical stroke + horizontal foot — Revit's ⊥ glyph. */}
          <line
            x1={pxX}
            y1={pxY - half}
            x2={pxX}
            y2={pxY + half}
            stroke={stroke}
            strokeWidth={1.5}
          />
          <line
            x1={pxX - half}
            y1={pxY + half}
            x2={pxX + half}
            y2={pxY + half}
            stroke={stroke}
            strokeWidth={1.5}
          />
        </g>
      );
      break;
    case 'extension': {
      const fromX = extensionFromPxX ?? pxX;
      const fromY = extensionFromPxY ?? pxY;
      glyph = (
        <g data-testid="snap-glyph-extension">
          <line
            x1={fromX}
            y1={fromY}
            x2={pxX}
            y2={pxY}
            stroke={stroke}
            strokeWidth={1}
            strokeDasharray="3 3"
          />
          <circle cx={pxX} cy={pxY} r={2.5} fill={stroke} />
        </g>
      );
      break;
    }
    case 'tangent':
      // EDT-05 closeout — circle-tangent symbol: a small circle with a
      // horizontal tangent line that grazes the bottom.
      glyph = (
        <g data-testid="snap-glyph-tangent">
          <circle
            cx={pxX}
            cy={pxY - 1}
            r={half - 3}
            fill="none"
            stroke={stroke}
            strokeWidth={1.5}
          />
          <line
            x1={pxX - half}
            y1={pxY + half - 4}
            x2={pxX + half}
            y2={pxY + half - 4}
            stroke={stroke}
            strokeWidth={1.5}
          />
        </g>
      );
      break;
    case 'parallel':
      // EDT-05 closeout — `‖` symbol rendered as two short vertical
      // strokes flanking the snap point.
      glyph = (
        <g data-testid="snap-glyph-parallel">
          <line
            x1={pxX - 3}
            y1={pxY - half}
            x2={pxX - 3}
            y2={pxY + half}
            stroke={stroke}
            strokeWidth={1.5}
          />
          <line
            x1={pxX + 3}
            y1={pxY - half}
            x2={pxX + 3}
            y2={pxY + half}
            stroke={stroke}
            strokeWidth={1.5}
          />
        </g>
      );
      break;
    case 'workplane':
      // EDT-05 closeout — small wireframe square skewed to suggest a
      // plane viewed in perspective.
      glyph = (
        <g data-testid="snap-glyph-workplane">
          <polygon
            points={`${pxX - half},${pxY - 2} ${pxX + 2},${pxY - half} ${pxX + half},${pxY + 2} ${pxX - 2},${pxY + half}`}
            fill="none"
            stroke={stroke}
            strokeWidth={1.5}
          />
        </g>
      );
      break;
    case 'grid':
    case 'raw':
      // No special glyph — the small ring is enough.
      return null;
  }
  return (
    <svg
      role="presentation"
      data-testid="snap-glyph-svg"
      style={{
        position: 'absolute',
        left: minX,
        top: minY,
        pointerEvents: 'none',
      }}
      width={width}
      height={height}
      viewBox={`${minX} ${minY} ${width} ${height}`}
    >
      {ring}
      {glyph}
      {associative ? <PadlockGlyph x={pxX + 12} y={pxY - 14} /> : null}
    </svg>
  );
}

function PadlockGlyph({ x, y }: { x: number; y: number }) {
  return (
    <g data-testid="snap-glyph-padlock" aria-hidden="true">
      <path
        d={`M ${x + 3} ${y + 7} V ${y + 5} C ${x + 3} ${y + 1.5} ${x + 9} ${y + 1.5} ${x + 9} ${y + 5} V ${y + 7}`}
        fill="none"
        stroke="var(--color-accent)"
        strokeWidth={1.25}
        strokeLinecap="round"
      />
      <rect
        x={x + 1.5}
        y={y + 7}
        width={9}
        height={7}
        rx={1.5}
        fill="var(--color-accent)"
        fillOpacity={0.92}
      />
    </g>
  );
}

export interface SnapGlyphLayerProps {
  /** All candidates within tolerance, in priority order. */
  candidates: Array<{
    kind: SnapKind;
    pxX: number;
    pxY: number;
    /** Only for `extension` — the segment endpoint to draw the dashed
     *  hint back to. */
    extensionFromPxX?: number;
    extensionFromPxY?: number;
    associative?: boolean;
  }>;
  /** Index into `candidates` selected by Tab-cycle. Clamped silently
   *  so callers don't have to worry about cycle wraparound. */
  activeIndex: number;
}

/** Renders the active candidate's glyph plus a lower-left label that
 *  reflects which snap kind is in use. */
export function SnapGlyphLayer({ candidates, activeIndex }: SnapGlyphLayerProps) {
  if (candidates.length === 0) return null;
  const idx = ((activeIndex % candidates.length) + candidates.length) % candidates.length;
  const active = candidates[idx]!;
  const label = snapKindLabel(active.kind);
  return (
    <div
      data-testid="snap-glyph-layer"
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
      }}
    >
      <SnapGlyph
        pxX={active.pxX}
        pxY={active.pxY}
        kind={active.kind}
        extensionFromPxX={active.extensionFromPxX}
        extensionFromPxY={active.extensionFromPxY}
        highlighted={candidates.length > 1}
        associative={Boolean(active.associative)}
      />
      {label && (
        <div
          data-testid="snap-glyph-label"
          style={{
            position: 'absolute',
            bottom: 8,
            left: 12,
            fontFamily:
              'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Monaco, Consolas, monospace',
            fontSize: 'var(--text-2xs, 10px)',
            lineHeight: 'var(--text-2xs-line, 14px)',
            fontFeatureSettings: '"tnum"',
            color: 'var(--color-accent)',
            background: 'var(--color-surface-strong)',
            padding: '2px 6px',
            borderRadius: 3,
            border: '1px solid var(--color-border)',
          }}
        >
          {label}
          {candidates.length > 1 ? ` · ${idx + 1}/${candidates.length} · Tab` : ''}
        </div>
      )}
    </div>
  );
}
