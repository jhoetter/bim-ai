/**
 * High-fidelity 48×48 BIM icons — view and annotation types.
 *
 * CSS custom properties (set on a wrapper element):
 *   --hi-concrete / --hi-concrete-op  — walls, structural (warm stone gray)
 *   --hi-finish   / --hi-finish-op    — paper, white, plaster (warm off-white)
 *   --hi-glass    / --hi-glass-op     — glazing panes (sky blue)
 *   --hi-steel    / --hi-steel-op     — steel, metal, header rows (blue-gray)
 *   --hi-room     / --hi-room-op      — interior space, data rows (pale yellow)
 *
 * Without variables the icons render in monochrome currentColor.
 *
 * Stroke hierarchy:
 *   strokeWidth 2    — primary outlines
 *   strokeWidth 1.5  — secondary edges, reveals
 *   strokeWidth 0.75 — hatch, grid lines, text placeholder lines
 */
import { bimIconHifi } from './icon';

// ── PlanViewHifi — schematic floor plan: walls, room interior, door swing, window ──
export const PlanViewHifi = bimIconHifi(
  'PlanViewHifi',
  <>
    {/* Room interior fill */}
    <rect
      x="10"
      y="10"
      width="30"
      height="28"
      style={{ fill: 'var(--hi-room, currentColor)', fillOpacity: 'var(--hi-room-op, 0.10)' }}
    />

    {/* Wall fills — top, left, right, partial bottom (L-shape notch at bottom-right) */}
    {/* Top wall */}
    <rect
      x="4"
      y="4"
      width="40"
      height="6"
      style={{
        fill: 'var(--hi-concrete, currentColor)',
        fillOpacity: 'var(--hi-concrete-op, 0.10)',
      }}
    />
    {/* Left wall */}
    <rect
      x="4"
      y="4"
      width="6"
      height="40"
      style={{
        fill: 'var(--hi-concrete, currentColor)',
        fillOpacity: 'var(--hi-concrete-op, 0.10)',
      }}
    />
    {/* Right wall — only upper portion (L-shape) */}
    <rect
      x="38"
      y="4"
      width="6"
      height="22"
      style={{
        fill: 'var(--hi-concrete, currentColor)',
        fillOpacity: 'var(--hi-concrete-op, 0.10)',
      }}
    />
    {/* Bottom wall — full width */}
    <rect
      x="4"
      y="38"
      width="22"
      height="6"
      style={{
        fill: 'var(--hi-concrete, currentColor)',
        fillOpacity: 'var(--hi-concrete-op, 0.10)',
      }}
    />
    {/* Interior horizontal wall (forms L) */}
    <rect
      x="26"
      y="26"
      width="18"
      height="6"
      style={{
        fill: 'var(--hi-concrete, currentColor)',
        fillOpacity: 'var(--hi-concrete-op, 0.10)',
      }}
    />

    {/* Outer wall outlines — L-shape perimeter */}
    {/* Top edge */}
    <line x1="4" y1="4" x2="44" y2="4" strokeWidth={2} />
    {/* Right edge upper portion */}
    <line x1="44" y1="4" x2="44" y2="26" strokeWidth={2} />
    {/* Step across (interior horizontal wall outer edge) */}
    <line x1="44" y1="26" x2="26" y2="26" strokeWidth={2} />
    {/* Step down (interior vertical at notch) */}
    <line x1="26" y1="26" x2="26" y2="44" strokeWidth={2} />
    {/* Bottom edge partial */}
    <line x1="26" y1="44" x2="4" y2="44" strokeWidth={2} />
    {/* Left edge */}
    <line x1="4" y1="44" x2="4" y2="4" strokeWidth={2} />

    {/* Inner wall outlines */}
    <line x1="10" y1="10" x2="38" y2="10" strokeWidth={1.5} />
    <line x1="10" y1="10" x2="10" y2="38" strokeWidth={1.5} />
    <line x1="10" y1="38" x2="26" y2="38" strokeWidth={1.5} />
    <line x1="38" y1="10" x2="38" y2="32" strokeWidth={1.5} />
    <line x1="38" y1="32" x2="32" y2="32" strokeWidth={1.5} />
    <line x1="32" y1="32" x2="32" y2="38" strokeWidth={1.5} />

    {/* Window opening — gap in top wall (double line = glazing) */}
    {/* Break outer top wall line at window: 22-32 */}
    <rect
      x="22"
      y="4"
      width="10"
      height="6"
      style={{ fill: 'var(--hi-glass, currentColor)', fillOpacity: 'var(--hi-glass-op, 0.12)' }}
      stroke="none"
    />
    <line x1="22" y1="4" x2="32" y2="4" strokeWidth={0.75} strokeOpacity={0.3} />
    <line x1="22" y1="7" x2="32" y2="7" strokeWidth={0.75} />
    <line x1="22" y1="10" x2="32" y2="10" strokeWidth={0.75} />
    {/* Window jamb ticks */}
    <line x1="22" y1="4" x2="22" y2="10" strokeWidth={1.5} />
    <line x1="32" y1="4" x2="32" y2="10" strokeWidth={1.5} />

    {/* Door swing — bottom-left corner, door in left wall gap at y=28-38 */}
    {/* Door leaf: horizontal line from hinge at (10,28) extending right 8px */}
    <line x1="10" y1="28" x2="18" y2="28" strokeWidth={1.5} />
    {/* Swing arc: quarter-circle from (10,28) with radius 8, sweeping to (18,36 approx) */}
    <path d="M10 36 A8 8 0 0 0 18 28" strokeWidth={0.75} strokeDasharray="3 2" fill="none" />
  </>,
);

// ── SectionViewHifi — building section cut: wall, interior, slab, cut line, arrow ──
export const SectionViewHifi = bimIconHifi(
  'SectionViewHifi',
  <>
    {/* Floor slab — thin horizontal band at bottom */}
    <rect
      x="4"
      y="36"
      width="40"
      height="6"
      style={{
        fill: 'var(--hi-concrete, currentColor)',
        fillOpacity: 'var(--hi-concrete-op, 0.10)',
      }}
    />
    {/* Slab hatch */}
    <g strokeWidth={0.75} strokeOpacity={0.35}>
      <line x1="4" y1="40" x2="8" y2="36" />
      <line x1="4" y1="42" x2="12" y2="36" />
      <line x1="10" y1="42" x2="18" y2="36" />
      <line x1="16" y1="42" x2="24" y2="36" />
      <line x1="22" y1="42" x2="30" y2="36" />
      <line x1="28" y1="42" x2="36" y2="36" />
      <line x1="34" y1="42" x2="42" y2="36" />
      <line x1="40" y1="42" x2="44" y2="38" />
    </g>
    <line x1="4" y1="36" x2="44" y2="36" strokeWidth={2} />
    <line x1="4" y1="42" x2="44" y2="42" strokeWidth={1.5} />

    {/* Left wall in section — concrete filled + hatched */}
    <rect
      x="4"
      y="8"
      width="14"
      height="28"
      style={{
        fill: 'var(--hi-concrete, currentColor)',
        fillOpacity: 'var(--hi-concrete-op, 0.10)',
      }}
    />
    {/* Wall hatch */}
    <g strokeWidth={0.75} strokeOpacity={0.35}>
      <line x1="4" y1="16" x2="10" y2="8" />
      <line x1="4" y1="22" x2="16" y2="8" />
      <line x1="4" y1="28" x2="18" y2="14" />
      <line x1="4" y1="34" x2="18" y2="20" />
      <line x1="8" y1="36" x2="18" y2="26" />
      <line x1="14" y1="36" x2="18" y2="32" />
    </g>
    {/* Wall boundary */}
    <line x1="4" y1="8" x2="18" y2="8" strokeWidth={2} />
    <line x1="4" y1="8" x2="4" y2="36" strokeWidth={1.5} />
    <line x1="18" y1="8" x2="18" y2="36" strokeWidth={2} />

    {/* Interior open space — room fill */}
    <rect
      x="18"
      y="8"
      width="26"
      height="28"
      style={{ fill: 'var(--hi-room, currentColor)', fillOpacity: 'var(--hi-room-op, 0.10)' }}
    />
    {/* Interior ceiling line */}
    <line x1="18" y1="8" x2="44" y2="8" strokeWidth={1.5} />
    {/* Right boundary of view */}
    <line x1="44" y1="8" x2="44" y2="36" strokeWidth={1} strokeOpacity={0.4} />

    {/* Window opening in left wall */}
    <rect
      x="4"
      y="16"
      width="14"
      height="10"
      style={{ fill: 'var(--hi-glass, currentColor)', fillOpacity: 'var(--hi-glass-op, 0.14)' }}
      stroke="none"
    />
    <line x1="4" y1="16" x2="18" y2="16" strokeWidth={1.5} />
    <line x1="4" y1="26" x2="18" y2="26" strokeWidth={1.5} />

    {/* Bold vertical cut line on the left */}
    <line x1="4" y1="4" x2="4" y2="44" strokeWidth={2.5} />

    {/* View direction triangle pointing right */}
    <polygon points="4,5 4,11 10,8" fill="currentColor" stroke="none" />
  </>,
);

// ── ElevationViewHifi — building exterior face: wall, windows, plinth, level marker ──
export const ElevationViewHifi = bimIconHifi(
  'ElevationViewHifi',
  <>
    {/* Wall face fill */}
    <rect
      x="6"
      y="4"
      width="36"
      height="36"
      style={{ fill: 'var(--hi-finish, currentColor)', fillOpacity: 'var(--hi-finish-op, 0.08)' }}
    />

    {/* Plinth / base band */}
    <rect
      x="6"
      y="36"
      width="36"
      height="6"
      style={{
        fill: 'var(--hi-concrete, currentColor)',
        fillOpacity: 'var(--hi-concrete-op, 0.12)',
      }}
    />
    <line x1="6" y1="36" x2="42" y2="36" strokeWidth={1.5} />

    {/* Building outline */}
    <rect x="6" y="4" width="36" height="38" strokeWidth={2} />

    {/* Window grid — 2 columns × 2 rows */}
    {/* Top-left window */}
    <rect
      x="12"
      y="10"
      width="10"
      height="10"
      style={{ fill: 'var(--hi-glass, currentColor)', fillOpacity: 'var(--hi-glass-op, 0.14)' }}
      strokeWidth={1.5}
    />
    {/* Top-right window */}
    <rect
      x="26"
      y="10"
      width="10"
      height="10"
      style={{ fill: 'var(--hi-glass, currentColor)', fillOpacity: 'var(--hi-glass-op, 0.14)' }}
      strokeWidth={1.5}
    />
    {/* Bottom-left window */}
    <rect
      x="12"
      y="25"
      width="10"
      height="10"
      style={{ fill: 'var(--hi-glass, currentColor)', fillOpacity: 'var(--hi-glass-op, 0.14)' }}
      strokeWidth={1.5}
    />
    {/* Bottom-right window */}
    <rect
      x="26"
      y="25"
      width="10"
      height="10"
      style={{ fill: 'var(--hi-glass, currentColor)', fillOpacity: 'var(--hi-glass-op, 0.14)' }}
      strokeWidth={1.5}
    />

    {/* Window mullion crosses */}
    <line x1="17" y1="10" x2="17" y2="20" strokeWidth={0.75} strokeOpacity={0.5} />
    <line x1="12" y1="15" x2="22" y2="15" strokeWidth={0.75} strokeOpacity={0.5} />
    <line x1="31" y1="10" x2="31" y2="20" strokeWidth={0.75} strokeOpacity={0.5} />
    <line x1="26" y1="15" x2="36" y2="15" strokeWidth={0.75} strokeOpacity={0.5} />
    <line x1="17" y1="25" x2="17" y2="35" strokeWidth={0.75} strokeOpacity={0.5} />
    <line x1="12" y1="30" x2="22" y2="30" strokeWidth={0.75} strokeOpacity={0.5} />
    <line x1="31" y1="25" x2="31" y2="35" strokeWidth={0.75} strokeOpacity={0.5} />
    <line x1="26" y1="30" x2="36" y2="30" strokeWidth={0.75} strokeOpacity={0.5} />

    {/* Level marker at left — horizontal line with tick */}
    <line x1="2" y1="4" x2="6" y2="4" strokeWidth={1.5} />
    <line x1="4" y1="2" x2="4" y2="6" strokeWidth={0.75} />
  </>,
);

// ── SheetHifi — drawing sheet: border, margin, title block, viewport ──────────
export const SheetHifi = bimIconHifi(
  'SheetHifi',
  <>
    {/* Sheet background (paper white) */}
    <rect
      x="4"
      y="4"
      width="40"
      height="40"
      style={{ fill: 'var(--hi-finish, currentColor)', fillOpacity: 'var(--hi-finish-op, 0.08)' }}
    />

    {/* Outer border — sheet boundary */}
    <rect x="4" y="4" width="40" height="40" strokeWidth={2} />

    {/* Inner margin — offset 4px */}
    <rect x="8" y="8" width="32" height="32" strokeWidth={1} />

    {/* Title block zone — bottom 10px strip with steel fill */}
    <rect
      x="4"
      y="36"
      width="40"
      height="8"
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.10)' }}
    />
    <line x1="4" y1="36" x2="44" y2="36" strokeWidth={1.5} />

    {/* Title block dividers */}
    <line x1="20" y1="36" x2="20" y2="44" strokeWidth={0.75} strokeOpacity={0.5} />
    <line x1="32" y1="36" x2="32" y2="44" strokeWidth={0.75} strokeOpacity={0.5} />

    {/* Title block text placeholder lines */}
    <line x1="9" y1="39" x2="18" y2="39" strokeWidth={0.75} strokeOpacity={0.4} />
    <line x1="9" y1="42" x2="17" y2="42" strokeWidth={0.75} strokeOpacity={0.4} />
    <line x1="22" y1="40" x2="30" y2="40" strokeWidth={0.75} strokeOpacity={0.4} />
    <line x1="34" y1="40" x2="42" y2="40" strokeWidth={0.75} strokeOpacity={0.4} />

    {/* Placed viewport — dashed rectangle with finish fill inside margin area */}
    <rect
      x="12"
      y="12"
      width="22"
      height="18"
      style={{ fill: 'var(--hi-finish, currentColor)', fillOpacity: 'var(--hi-finish-op, 0.10)' }}
      strokeWidth={0.75}
      strokeDasharray="3 2"
    />

    {/* Viewport label placeholder line below viewport */}
    <line x1="12" y1="32" x2="28" y2="32" strokeWidth={0.75} strokeOpacity={0.4} />
  </>,
);

// ── ScheduleViewHifi — BIM schedule table: header row, data rows, column grid ──
export const ScheduleViewHifi = bimIconHifi(
  'ScheduleViewHifi',
  <>
    {/* Header row fill */}
    <rect
      x="4"
      y="4"
      width="40"
      height="9"
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.14)' }}
    />

    {/* Data row 1 (odd) fill */}
    <rect
      x="4"
      y="13"
      width="40"
      height="8"
      style={{ fill: 'var(--hi-room, currentColor)', fillOpacity: 'var(--hi-room-op, 0.10)' }}
    />
    {/* Data row 2 (even) — no fill */}
    {/* Data row 3 (odd) fill */}
    <rect
      x="4"
      y="29"
      width="40"
      height="8"
      style={{ fill: 'var(--hi-room, currentColor)', fillOpacity: 'var(--hi-room-op, 0.10)' }}
    />

    {/* Outer bold border */}
    <rect x="4" y="4" width="40" height="37" strokeWidth={2} />

    {/* Horizontal row dividers */}
    <line x1="4" y1="13" x2="44" y2="13" strokeWidth={1.5} />
    <line x1="4" y1="21" x2="44" y2="21" strokeWidth={0.75} strokeOpacity={0.6} />
    <line x1="4" y1="29" x2="44" y2="29" strokeWidth={0.75} strokeOpacity={0.6} />
    <line x1="4" y1="37" x2="44" y2="37" strokeWidth={0.75} strokeOpacity={0.6} />

    {/* Vertical column dividers */}
    <line x1="18" y1="4" x2="18" y2="41" strokeWidth={0.75} strokeOpacity={0.5} />
    <line x1="32" y1="4" x2="32" y2="41" strokeWidth={0.75} strokeOpacity={0.5} />

    {/* Header text placeholder lines */}
    <line x1="7" y1="8" x2="15" y2="8" strokeWidth={0.75} strokeOpacity={0.5} />
    <line x1="21" y1="8" x2="29" y2="8" strokeWidth={0.75} strokeOpacity={0.5} />
    <line x1="35" y1="8" x2="41" y2="8" strokeWidth={0.75} strokeOpacity={0.5} />

    {/* Row 1 data cell text lines */}
    <line x1="7" y1="17" x2="15" y2="17" strokeWidth={0.75} strokeOpacity={0.4} />
    <line x1="21" y1="17" x2="28" y2="17" strokeWidth={0.75} strokeOpacity={0.4} />
    <line x1="35" y1="17" x2="40" y2="17" strokeWidth={0.75} strokeOpacity={0.4} />

    {/* Row 2 data cell text lines */}
    <line x1="7" y1="25" x2="14" y2="25" strokeWidth={0.75} strokeOpacity={0.4} />
    <line x1="21" y1="25" x2="29" y2="25" strokeWidth={0.75} strokeOpacity={0.4} />
    <line x1="35" y1="25" x2="41" y2="25" strokeWidth={0.75} strokeOpacity={0.4} />

    {/* Row 3 data cell text lines */}
    <line x1="7" y1="33" x2="16" y2="33" strokeWidth={0.75} strokeOpacity={0.4} />
    <line x1="21" y1="33" x2="27" y2="33" strokeWidth={0.75} strokeOpacity={0.4} />
    <line x1="35" y1="33" x2="40" y2="33" strokeWidth={0.75} strokeOpacity={0.4} />
  </>,
);

// ── CalloutHifi — annotation callout: bubble, leader, text lines, detail boundary ──
export const CalloutHifi = bimIconHifi(
  'CalloutHifi',
  <>
    {/* Dashed detail boundary at bottom-right — area being called out */}
    <rect
      x="26"
      y="28"
      width="16"
      height="14"
      strokeWidth={0.75}
      strokeDasharray="3 2"
      strokeOpacity={0.5}
      fill="none"
    />

    {/* Triangular leader from callout bubble corner toward detail boundary */}
    <polygon
      points="22,22 28,26 24,28"
      style={{ fill: 'var(--hi-finish, currentColor)', fillOpacity: 'var(--hi-finish-op, 0.10)' }}
      strokeWidth={1}
    />

    {/* Callout bubble with rounded corners */}
    <rect
      x="4"
      y="6"
      width="28"
      height="18"
      rx="3"
      ry="3"
      style={{ fill: 'var(--hi-finish, currentColor)', fillOpacity: 'var(--hi-finish-op, 0.12)' }}
      strokeWidth={1.5}
    />

    {/* Text placeholder lines inside bubble */}
    <line x1="9" y1="13" x2="26" y2="13" strokeWidth={0.75} strokeOpacity={0.4} />
    <line x1="9" y1="18" x2="22" y2="18" strokeWidth={0.75} strokeOpacity={0.4} />

    {/* Callout identifier circle at top-left of bubble */}
    <circle
      cx="9"
      cy="9"
      r="3.5"
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.14)' }}
      strokeWidth={0.75}
    />

    {/* Detail boundary corner ticks */}
    <line x1="24" y1="28" x2="26" y2="28" strokeWidth={1} />
    <line x1="24" y1="28" x2="24" y2="30" strokeWidth={1} />
    <line x1="42" y1="28" x2="42" y2="30" strokeWidth={1} />
    <line x1="40" y1="42" x2="42" y2="42" strokeWidth={1} />
    <line x1="42" y1="40" x2="42" y2="42" strokeWidth={1} />
    <line x1="24" y1="40" x2="24" y2="42" strokeWidth={1} />
    <line x1="24" y1="42" x2="26" y2="42" strokeWidth={1} />
  </>,
);

// ── GridLineHifi — structural grid: two dashed lines, circle bubbles, label lines ──
export const GridLineHifi = bimIconHifi(
  'GridLineHifi',
  <>
    {/* Horizontal grid line — full width, dashed */}
    <line x1="9" y1="24" x2="39" y2="24" strokeWidth={1.5} strokeDasharray="6 3" />

    {/* Vertical grid line — full height, dashed */}
    <line x1="24" y1="9" x2="24" y2="39" strokeWidth={1.5} strokeDasharray="6 3" />

    {/* Left bubble */}
    <circle
      cx="5"
      cy="24"
      r="5"
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.12)' }}
      strokeWidth={1}
    />
    {/* Left bubble label placeholder */}
    <line x1="2.5" y1="24" x2="7.5" y2="24" strokeWidth={0.75} strokeOpacity={0.4} />

    {/* Right bubble */}
    <circle
      cx="43"
      cy="24"
      r="5"
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.12)' }}
      strokeWidth={1}
    />
    {/* Right bubble label placeholder */}
    <line x1="40.5" y1="24" x2="45.5" y2="24" strokeWidth={0.75} strokeOpacity={0.4} />

    {/* Top bubble */}
    <circle
      cx="24"
      cy="5"
      r="5"
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.12)' }}
      strokeWidth={1}
    />
    {/* Top bubble label placeholder */}
    <line x1="21" y1="5" x2="27" y2="5" strokeWidth={0.75} strokeOpacity={0.4} />

    {/* Bottom bubble */}
    <circle
      cx="24"
      cy="43"
      r="5"
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.12)' }}
      strokeWidth={1}
    />
    {/* Bottom bubble label placeholder */}
    <line x1="21" y1="43" x2="27" y2="43" strokeWidth={0.75} strokeOpacity={0.4} />

    {/* Grid intersection highlight dot */}
    <circle cx="24" cy="24" r="1.5" fill="currentColor" stroke="none" />
  </>,
);

// ── LevelHifi — level datum: horizontal line, bubble marker, arrowhead, text ──
export const LevelHifi = bimIconHifi(
  'LevelHifi',
  <>
    {/* Long datum line — full width at mid-height */}
    <line x1="4" y1="26" x2="44" y2="26" strokeWidth={1.5} />

    {/* Left level bubble/marker — diamond shape with steel fill */}
    <polygon
      points="8,22 12,26 8,30 4,26"
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.14)' }}
      strokeWidth={1.5}
    />

    {/* Short vertical drop line from datum at left marker */}
    <line x1="8" y1="30" x2="8" y2="36" strokeWidth={1} strokeOpacity={0.6} />
    {/* Base marker tick */}
    <line x1="5" y1="36" x2="11" y2="36" strokeWidth={1} strokeOpacity={0.6} />

    {/* Right level indicator — small diamond */}
    <polygon
      points="40,22 44,26 40,30 36,26"
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.10)' }}
      strokeWidth={1}
    />

    {/* Text placeholder lines for elevation value (right of left marker) */}
    <line x1="14" y1="23" x2="28" y2="23" strokeWidth={0.75} strokeOpacity={0.4} />
    <line x1="14" y1="28" x2="24" y2="28" strokeWidth={0.75} strokeOpacity={0.4} />

    {/* Arrowhead pointing up above datum line */}
    <line x1="24" y1="20" x2="24" y2="14" strokeWidth={1.5} />
    <polyline points="21,17 24,12 27,17" strokeWidth={1.5} fill="none" />

    {/* Second datum tick / reference line at upper level */}
    <line
      x1="20"
      y1="12"
      x2="44"
      y2="12"
      strokeWidth={0.75}
      strokeDasharray="4 2"
      strokeOpacity={0.4}
    />
  </>,
);
