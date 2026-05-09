/**
 * High-fidelity 48×48 BIM icons — basic modify operations.
 *
 * CSS custom properties (set on a wrapper element):
 *   --hi-concrete / --hi-concrete-op  — structural concrete (stone gray)
 *   --hi-finish   / --hi-finish-op    — plaster, paper, gypsum (warm white)
 *   --hi-glass    / --hi-glass-op     — glazing (sky blue)
 *   --hi-steel    / --hi-steel-op     — steel, metal, frames (blue-gray)
 *   --hi-leaf                         — timber/wood (amber, no opacity var)
 *   --hi-room     / --hi-room-op      — interior zone (pale yellow)
 *   --hi-roof     / --hi-roof-op      — roof surface / alert color (terracotta)
 *
 * Without variables the icons render in monochrome currentColor.
 *
 * Stroke hierarchy:
 *   strokeWidth 2    — primary outlines
 *   strokeWidth 1.5  — secondary edges, reveals
 *   strokeWidth 0.75 — hatch, detail lines, text placeholders
 */
import { bimIconHifi } from './icon';

// ── MoveHifi — wall at origin (ghost/dashed) + destination (solid) + bold arrow ──
export const MoveHifi = bimIconHifi(
  'MoveHifi',
  <>
    {/* Ghost wall at origin — steel at low opacity, dashed outline */}
    <rect
      x="4"
      y="14"
      width="14"
      height="20"
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.08)' }}
      strokeWidth={1.5}
      strokeDasharray="3 2"
      strokeOpacity={0.45}
    />
    {/* Ghost hatch */}
    <g strokeWidth={0.75} strokeOpacity={0.18}>
      <line x1="4" y1="22" x2="10" y2="14" />
      <line x1="4" y1="30" x2="16" y2="16" />
      <line x1="8" y1="34" x2="18" y2="22" />
    </g>

    {/* Destination wall — concrete, solid */}
    <rect
      x="28"
      y="14"
      width="14"
      height="20"
      style={{
        fill: 'var(--hi-concrete, currentColor)',
        fillOpacity: 'var(--hi-concrete-op, 0.14)',
      }}
      strokeWidth={2}
    />
    {/* Destination concrete hatch */}
    <g strokeWidth={0.75} strokeOpacity={0.3}>
      <line x1="28" y1="22" x2="34" y2="14" />
      <line x1="28" y1="30" x2="40" y2="16" />
      <line x1="32" y1="34" x2="42" y2="22" />
      <line x1="36" y1="34" x2="42" y2="28" />
    </g>

    {/* Bold movement arrow from ghost center to destination center */}
    <line x1="19" y1="24" x2="27" y2="24" strokeWidth={2} />
    <polyline points="24,20 28,24 24,28" strokeWidth={2} fill="none" />

    {/* Floor reference lines */}
    <line
      x1="4"
      y1="38"
      x2="18"
      y2="38"
      strokeWidth={0.75}
      strokeDasharray="3 2"
      strokeOpacity={0.4}
    />
    <line x1="28" y1="38" x2="42" y2="38" strokeWidth={0.75} strokeOpacity={0.4} />
  </>,
);

// ── CopyHifi — original wall (concrete) left + copy (steel) right + dashed arrow + C badge ──
export const CopyHifi = bimIconHifi(
  'CopyHifi',
  <>
    {/* Original wall — concrete, solid */}
    <rect
      x="4"
      y="14"
      width="14"
      height="22"
      style={{
        fill: 'var(--hi-concrete, currentColor)',
        fillOpacity: 'var(--hi-concrete-op, 0.14)',
      }}
      strokeWidth={2}
    />
    {/* Concrete hatch on original */}
    <g strokeWidth={0.75} strokeOpacity={0.3}>
      <line x1="4" y1="22" x2="10" y2="14" />
      <line x1="4" y1="30" x2="14" y2="18" />
      <line x1="6" y1="36" x2="18" y2="22" />
      <line x1="10" y1="36" x2="18" y2="28" />
    </g>

    {/* Copy wall — steel at slightly lower opacity */}
    <rect
      x="28"
      y="16"
      width="14"
      height="22"
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.12)' }}
      strokeWidth={1.5}
      strokeDasharray="0"
      strokeOpacity={0.7}
    />
    {/* Copy steel hatch */}
    <g strokeWidth={0.75} strokeOpacity={0.2}>
      <line x1="28" y1="24" x2="34" y2="16" />
      <line x1="28" y1="32" x2="40" y2="18" />
      <line x1="30" y1="38" x2="42" y2="26" />
      <line x1="34" y1="38" x2="42" y2="30" />
    </g>

    {/* Dashed arrow from original to copy */}
    <line x1="18" y1="25" x2="28" y2="27" strokeWidth={1.5} strokeDasharray="3 2" />
    <polyline points="25,24 28,27 25,30" strokeWidth={1.5} fill="none" />

    {/* Copy "C" badge — circle with C text placeholder, upper right */}
    <circle
      cx="38"
      cy="9"
      r="5"
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.18)' }}
      strokeWidth={1.5}
    />
    {/* C arc indicator */}
    <path d="M 41,7 A 3,3 0 1,0 41,11" strokeWidth={1.5} fill="none" />
  </>,
);

// ── RotateHifi — wall + ghost rotated position + curved arc arrow + pivot marker ──
export const RotateHifi = bimIconHifi(
  'RotateHifi',
  <>
    {/* Pivot center marker — crosshair circle */}
    <circle cx="24" cy="30" r="3" strokeWidth={1.5} fill="none" />
    <line x1="24" y1="26" x2="24" y2="24" strokeWidth={0.75} strokeOpacity={0.6} />
    <line x1="24" y1="34" x2="24" y2="36" strokeWidth={0.75} strokeOpacity={0.6} />
    <line x1="20" y1="30" x2="18" y2="30" strokeWidth={0.75} strokeOpacity={0.6} />
    <line x1="28" y1="30" x2="30" y2="30" strokeWidth={0.75} strokeOpacity={0.6} />

    {/* Original wall position — concrete, solid, vertical */}
    <rect
      x="20"
      y="8"
      width="10"
      height="20"
      style={{
        fill: 'var(--hi-concrete, currentColor)',
        fillOpacity: 'var(--hi-concrete-op, 0.14)',
      }}
      strokeWidth={2}
    />
    {/* Concrete hatch */}
    <g strokeWidth={0.75} strokeOpacity={0.28}>
      <line x1="20" y1="16" x2="26" y2="8" />
      <line x1="20" y1="24" x2="30" y2="12" />
      <line x1="22" y1="28" x2="30" y2="18" />
      <line x1="24" y1="28" x2="30" y2="22" />
    </g>

    {/* Ghost rotated position — steel at low opacity, dashed, rotated ~60 deg */}
    {/* Approximated as a rotated rect using a parallelogram */}
    <polygon
      points="10,22 18,14 28,24 20,32"
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.09)' }}
      strokeWidth={1.5}
      strokeDasharray="3 2"
      strokeOpacity={0.45}
    />

    {/* Curved arc arrow showing rotation sweep */}
    <path d="M 22,8 A 18,18 0 0,0 9,19" strokeWidth={2} fill="none" />
    {/* Arrowhead at end of arc */}
    <polyline points="6,17 9,19 11,16" strokeWidth={2} fill="none" />
  </>,
);

// ── ScaleHifi — smaller ghost wall (steel) + larger concrete wall + diagonal scale arrows ──
export const ScaleHifi = bimIconHifi(
  'ScaleHifi',
  <>
    {/* Smaller "before" wall — steel at low opacity */}
    <rect
      x="15"
      y="17"
      width="18"
      height="14"
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.09)' }}
      strokeWidth={1}
      strokeDasharray="3 2"
      strokeOpacity={0.4}
    />

    {/* Larger "after" wall — concrete, solid */}
    <rect
      x="8"
      y="10"
      width="32"
      height="28"
      style={{
        fill: 'var(--hi-concrete, currentColor)',
        fillOpacity: 'var(--hi-concrete-op, 0.13)',
      }}
      strokeWidth={2}
    />
    {/* Concrete hatch */}
    <g strokeWidth={0.75} strokeOpacity={0.26}>
      <line x1="8" y1="20" x2="18" y2="10" />
      <line x1="8" y1="30" x2="28" y2="10" />
      <line x1="8" y1="38" x2="36" y2="10" />
      <line x1="16" y1="38" x2="40" y2="14" />
      <line x1="26" y1="38" x2="40" y2="24" />
      <line x1="32" y1="38" x2="40" y2="30" />
    </g>

    {/* Bold diagonal scale arrows from center to corners */}
    {/* Top-left arrow */}
    <line x1="24" y1="24" x2="9" y2="11" strokeWidth={2} />
    <polyline points="12,11 9,11 9,14" strokeWidth={2} fill="none" />
    {/* Top-right arrow */}
    <line x1="24" y1="24" x2="39" y2="11" strokeWidth={2} />
    <polyline points="36,11 39,11 39,14" strokeWidth={2} fill="none" />
    {/* Bottom-left arrow */}
    <line x1="24" y1="24" x2="9" y2="37" strokeWidth={2} />
    <polyline points="12,37 9,37 9,34" strokeWidth={2} fill="none" />
    {/* Bottom-right arrow */}
    <line x1="24" y1="24" x2="39" y2="37" strokeWidth={2} />
    <polyline points="36,37 39,37 39,34" strokeWidth={2} fill="none" />
  </>,
);

// ── OffsetHifi — original wall (concrete + hatch) + offset copy (steel) + perpendicular arrows ──
export const OffsetHifi = bimIconHifi(
  'OffsetHifi',
  <>
    {/* Original wall — concrete with hatch */}
    <rect
      x="6"
      y="14"
      width="14"
      height="22"
      style={{
        fill: 'var(--hi-concrete, currentColor)',
        fillOpacity: 'var(--hi-concrete-op, 0.14)',
      }}
      strokeWidth={2}
    />
    {/* Concrete hatch */}
    <g strokeWidth={0.75} strokeOpacity={0.3}>
      <line x1="6" y1="22" x2="12" y2="14" />
      <line x1="6" y1="30" x2="18" y2="16" />
      <line x1="8" y1="36" x2="20" y2="22" />
      <line x1="12" y1="36" x2="20" y2="28" />
    </g>

    {/* Offset copy — steel at lower opacity */}
    <rect
      x="28"
      y="14"
      width="14"
      height="22"
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.11)' }}
      strokeWidth={1.5}
      strokeOpacity={0.65}
    />
    {/* Offset copy hatch — lighter */}
    <g strokeWidth={0.75} strokeOpacity={0.18}>
      <line x1="28" y1="22" x2="34" y2="14" />
      <line x1="28" y1="30" x2="40" y2="16" />
      <line x1="30" y1="36" x2="42" y2="24" />
    </g>

    {/* Bold perpendicular arrows showing offset distance */}
    {/* Arrow from right face of original to left face of copy — top */}
    <line x1="20" y1="20" x2="28" y2="20" strokeWidth={1.5} />
    <polyline points="25,17 28,20 25,23" strokeWidth={1.5} fill="none" />
    <polyline points="23,17 20,20 23,23" strokeWidth={1.5} fill="none" />

    {/* Arrow from right face of original to left face of copy — bottom */}
    <line x1="20" y1="30" x2="28" y2="30" strokeWidth={1.5} />
    <polyline points="25,27 28,30 25,33" strokeWidth={1.5} fill="none" />
    <polyline points="23,27 20,30 23,33" strokeWidth={1.5} fill="none" />

    {/* Distance label placeholder */}
    <line x1="21" y1="24.5" x2="27" y2="24.5" strokeWidth={0.75} strokeOpacity={0.4} />
  </>,
);

// ── DeleteHifi — wall (concrete, low opacity) with large X in terracotta/roof color ──
export const DeleteHifi = bimIconHifi(
  'DeleteHifi',
  <>
    {/* Wall element — concrete at lower opacity indicating deletion */}
    <rect
      x="8"
      y="12"
      width="32"
      height="24"
      style={{
        fill: 'var(--hi-concrete, currentColor)',
        fillOpacity: 'var(--hi-concrete-op, 0.08)',
      }}
      strokeWidth={2}
      strokeOpacity={0.45}
    />
    {/* Concrete hatch — faint */}
    <g strokeWidth={0.75} strokeOpacity={0.16}>
      <line x1="8" y1="22" x2="18" y2="12" />
      <line x1="8" y1="32" x2="28" y2="12" />
      <line x1="16" y1="36" x2="38" y2="14" />
      <line x1="26" y1="36" x2="40" y2="22" />
      <line x1="34" y1="36" x2="40" y2="30" />
    </g>

    {/* Large X deletion mark — terracotta/roof color */}
    {/* Diagonal 1: top-left to bottom-right */}
    <line
      x1="11"
      y1="15"
      x2="37"
      y2="33"
      strokeWidth={2}
      style={{ stroke: 'var(--hi-roof, currentColor)' }}
    />
    {/* Diagonal 2: top-right to bottom-left */}
    <line
      x1="37"
      y1="15"
      x2="11"
      y2="33"
      strokeWidth={2}
      style={{ stroke: 'var(--hi-roof, currentColor)' }}
    />

    {/* Small deletion indicator badge — terracotta circle at top-right */}
    <circle
      cx="38"
      cy="10"
      r="4"
      style={{
        fill: 'var(--hi-roof, currentColor)',
        fillOpacity: 'var(--hi-roof-op, 0.22)',
        stroke: 'var(--hi-roof, currentColor)',
      }}
      strokeWidth={1.5}
    />
    {/* Minus/dash in badge */}
    <line
      x1="35"
      y1="10"
      x2="41"
      y2="10"
      strokeWidth={1.5}
      style={{ stroke: 'var(--hi-roof, currentColor)' }}
    />
  </>,
);

// ── JoinGeometryHifi — two wall segments meeting at clean mitered corner ──────
export const JoinGeometryHifi = bimIconHifi(
  'JoinGeometryHifi',
  <>
    {/* Overlap zone (before join) — roof/terracotta at very low opacity */}
    <rect
      x="26"
      y="14"
      width="12"
      height="12"
      style={{ fill: 'var(--hi-roof, currentColor)', fillOpacity: 'var(--hi-roof-op, 0.12)' }}
      stroke="none"
    />

    {/* Horizontal wall — concrete */}
    <rect
      x="8"
      y="14"
      width="30"
      height="12"
      style={{
        fill: 'var(--hi-concrete, currentColor)',
        fillOpacity: 'var(--hi-concrete-op, 0.14)',
      }}
      strokeWidth={2}
    />
    {/* Horizontal wall hatch */}
    <g strokeWidth={0.75} strokeOpacity={0.28}>
      <line x1="8" y1="22" x2="14" y2="14" />
      <line x1="8" y1="26" x2="22" y2="14" />
      <line x1="14" y1="26" x2="28" y2="14" />
      <line x1="20" y1="26" x2="34" y2="16" />
      <line x1="26" y1="26" x2="36" y2="18" />
    </g>

    {/* Vertical wall — concrete */}
    <rect
      x="26"
      y="14"
      width="12"
      height="24"
      style={{
        fill: 'var(--hi-concrete, currentColor)',
        fillOpacity: 'var(--hi-concrete-op, 0.14)',
      }}
      strokeWidth={2}
    />
    {/* Vertical wall hatch */}
    <g strokeWidth={0.75} strokeOpacity={0.28}>
      <line x1="26" y1="22" x2="32" y2="14" />
      <line x1="26" y1="30" x2="36" y2="20" />
      <line x1="26" y1="38" x2="36" y2="28" />
      <line x1="28" y1="38" x2="38" y2="28" />
      <line x1="32" y1="38" x2="38" y2="32" />
    </g>

    {/* Clean miter join indicator — bold corner line */}
    <polyline points="8,26 26,26 26,38" strokeWidth={2} fill="none" />
    <line x1="8" y1="14" x2="38" y2="14" strokeWidth={2} />
    <line x1="38" y1="14" x2="38" y2="38" strokeWidth={2} />

    {/* Small join indicator — dot at corner */}
    <circle cx="26" cy="26" r="2.5" fill="currentColor" fillOpacity={0.5} stroke="none" />

    {/* Dotted lines showing pre-join wall extents */}
    <line
      x1="26"
      y1="14"
      x2="26"
      y2="26"
      strokeWidth={0.75}
      strokeDasharray="2 2"
      strokeOpacity={0.45}
    />
    <line
      x1="26"
      y1="26"
      x2="38"
      y2="26"
      strokeWidth={0.75}
      strokeDasharray="2 2"
      strokeOpacity={0.45}
    />
  </>,
);

// ── UnjoinGeometryHifi — walls at corner being unjoined, separation gap visible ──
export const UnjoinGeometryHifi = bimIconHifi(
  'UnjoinGeometryHifi',
  <>
    {/* Original join outline — steel dashed, indicating former joined state */}
    <polyline
      points="8,26 26,26 26,40"
      strokeWidth={1}
      strokeDasharray="3 2"
      strokeOpacity={0.4}
      fill="none"
      style={{ stroke: 'var(--hi-steel, currentColor)' }}
    />

    {/* Horizontal wall ending short — concrete */}
    <rect
      x="8"
      y="14"
      width="20"
      height="12"
      style={{
        fill: 'var(--hi-concrete, currentColor)',
        fillOpacity: 'var(--hi-concrete-op, 0.14)',
      }}
      strokeWidth={2}
    />
    {/* Horizontal hatch */}
    <g strokeWidth={0.75} strokeOpacity={0.28}>
      <line x1="8" y1="22" x2="14" y2="14" />
      <line x1="8" y1="26" x2="20" y2="14" />
      <line x1="14" y1="26" x2="26" y2="18" />
      <line x1="20" y1="26" x2="26" y2="22" />
    </g>

    {/* Vertical wall starting with gap — concrete */}
    <rect
      x="28"
      y="16"
      width="12"
      height="24"
      style={{
        fill: 'var(--hi-concrete, currentColor)',
        fillOpacity: 'var(--hi-concrete-op, 0.14)',
      }}
      strokeWidth={2}
    />
    {/* Vertical hatch */}
    <g strokeWidth={0.75} strokeOpacity={0.28}>
      <line x1="28" y1="24" x2="34" y2="16" />
      <line x1="28" y1="32" x2="38" y2="22" />
      <line x1="28" y1="40" x2="38" y2="30" />
      <line x1="30" y1="40" x2="40" y2="30" />
      <line x1="34" y1="40" x2="40" y2="34" />
    </g>

    {/* Break / separation symbol at the gap */}
    {/* Zigzag break line at separation point */}
    <polyline
      points="26,20 27,22 25,24 27,26 26,28"
      strokeWidth={2}
      fill="none"
      style={{ stroke: 'var(--hi-roof, currentColor)' }}
    />

    {/* Gap zone highlight */}
    <rect
      x="26"
      y="14"
      width="2"
      height="28"
      style={{ fill: 'var(--hi-roof, currentColor)', fillOpacity: 'var(--hi-roof-op, 0.12)' }}
      stroke="none"
    />
  </>,
);

// ── SwitchJoinOrderHifi — two overlapping walls, swap arrow, reversed priority ──
export const SwitchJoinOrderHifi = bimIconHifi(
  'SwitchJoinOrderHifi',
  <>
    {/* Wall A — concrete, cuts through Wall B (higher priority) */}
    <rect
      x="8"
      y="10"
      width="32"
      height="10"
      style={{
        fill: 'var(--hi-concrete, currentColor)',
        fillOpacity: 'var(--hi-concrete-op, 0.14)',
      }}
      strokeWidth={2}
    />
    {/* Wall A hatch */}
    <g strokeWidth={0.75} strokeOpacity={0.28}>
      <line x1="8" y1="18" x2="16" y2="10" />
      <line x1="8" y1="20" x2="24" y2="10" />
      <line x1="16" y1="20" x2="32" y2="10" />
      <line x1="26" y1="20" x2="38" y2="16" />
    </g>

    {/* Wall B — steel/finish, lower priority */}
    <rect
      x="20"
      y="10"
      width="10"
      height="28"
      style={{ fill: 'var(--hi-finish, currentColor)', fillOpacity: 'var(--hi-finish-op, 0.20)' }}
      strokeWidth={1.5}
      strokeDasharray="0"
    />
    {/* Priority A label zone */}
    <rect
      x="8"
      y="10"
      width="32"
      height="10"
      style={{
        fill: 'var(--hi-concrete, currentColor)',
        fillOpacity: 'var(--hi-concrete-op, 0.06)',
      }}
      stroke="none"
    />

    {/* Wall B label placeholder */}
    <line x1="22" y1="31" x2="28" y2="31" strokeWidth={0.75} strokeOpacity={0.4} />

    {/* Swap / switch arrow — curved double-headed arrow indicating order reversal */}
    {/* Top arc (from right-to-left) */}
    <path d="M 36,8 C 36,4 12,4 12,8" strokeWidth={2} fill="none" />
    <polyline points="9,7 12,8 12,11" strokeWidth={2} fill="none" />
    <polyline points="39,7 36,8 36,11" strokeWidth={2} fill="none" />

    {/* Priority indicator labels: "A" region (placeholder lines) */}
    <line x1="10" y1="15" x2="18" y2="15" strokeWidth={0.75} strokeOpacity={0.5} />
    {/* "B" region (placeholder lines) */}
    <line x1="22" y1="25" x2="28" y2="25" strokeWidth={0.75} strokeOpacity={0.35} />

    {/* Result state — dashed outline of switched result */}
    <rect
      x="20"
      y="24"
      width="10"
      height="14"
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.10)' }}
      strokeWidth={1.5}
      strokeDasharray="3 2"
      strokeOpacity={0.5}
    />
  </>,
);

// ── WallJoinsHifi — T-junction of walls with clean intersection cleanup ────────
export const WallJoinsHifi = bimIconHifi(
  'WallJoinsHifi',
  <>
    {/* Horizontal wall — concrete */}
    <rect
      x="4"
      y="18"
      width="40"
      height="12"
      style={{
        fill: 'var(--hi-concrete, currentColor)',
        fillOpacity: 'var(--hi-concrete-op, 0.14)',
      }}
      strokeWidth={2}
    />
    {/* Horizontal wall hatch */}
    <g strokeWidth={0.75} strokeOpacity={0.28}>
      <line x1="4" y1="26" x2="10" y2="18" />
      <line x1="4" y1="30" x2="18" y2="18" />
      <line x1="10" y1="30" x2="26" y2="18" />
      <line x1="18" y1="30" x2="34" y2="18" />
      <line x1="26" y1="30" x2="40" y2="22" />
      <line x1="34" y1="30" x2="44" y2="22" />
      <line x1="38" y1="30" x2="44" y2="26" />
    </g>

    {/* Vertical wall joining into horizontal — concrete */}
    <rect
      x="20"
      y="30"
      width="8"
      height="14"
      style={{
        fill: 'var(--hi-concrete, currentColor)',
        fillOpacity: 'var(--hi-concrete-op, 0.14)',
      }}
      strokeWidth={2}
    />
    {/* Vertical wall hatch */}
    <g strokeWidth={0.75} strokeOpacity={0.28}>
      <line x1="20" y1="36" x2="24" y2="30" />
      <line x1="20" y1="42" x2="28" y2="34" />
      <line x1="22" y1="44" x2="28" y2="40" />
      <line x1="24" y1="44" x2="28" y2="42" />
    </g>

    {/* Dotted lines showing original unjoined extents */}
    <line
      x1="20"
      y1="18"
      x2="20"
      y2="30"
      strokeWidth={0.75}
      strokeDasharray="2 2"
      strokeOpacity={0.4}
    />
    <line
      x1="28"
      y1="18"
      x2="28"
      y2="30"
      strokeWidth={0.75}
      strokeDasharray="2 2"
      strokeOpacity={0.4}
    />

    {/* T-junction cleanup indicator — bold vertical outline from join point */}
    <line x1="20" y1="30" x2="20" y2="44" strokeWidth={2} />
    <line x1="28" y1="30" x2="28" y2="44" strokeWidth={2} />
    <line x1="20" y1="44" x2="28" y2="44" strokeWidth={2} />

    {/* Junction highlight dot */}
    <circle cx="24" cy="30" r="2" fill="currentColor" fillOpacity={0.4} stroke="none" />
  </>,
);

// ── PaintMaterialHifi — wall being painted: concrete zone + finish zone + paintbrush ──
export const PaintMaterialHifi = bimIconHifi(
  'PaintMaterialHifi',
  <>
    {/* Full wall background — concrete */}
    <rect
      x="6"
      y="16"
      width="32"
      height="20"
      style={{
        fill: 'var(--hi-concrete, currentColor)',
        fillOpacity: 'var(--hi-concrete-op, 0.12)',
      }}
      strokeWidth={2}
    />
    {/* Concrete hatch — right (unpainted) zone */}
    <g strokeWidth={0.75} strokeOpacity={0.26}>
      <line x1="22" y1="24" x2="28" y2="16" />
      <line x1="22" y1="32" x2="36" y2="18" />
      <line x1="26" y1="36" x2="38" y2="24" />
      <line x1="30" y1="36" x2="38" y2="28" />
      <line x1="34" y1="36" x2="38" y2="32" />
    </g>

    {/* Painted zone — finish (warm white), left portion */}
    <rect
      x="6"
      y="16"
      width="16"
      height="20"
      style={{ fill: 'var(--hi-finish, currentColor)', fillOpacity: 'var(--hi-finish-op, 0.35)' }}
      stroke="none"
    />
    {/* Finish texture lines */}
    <line x1="8" y1="22" x2="20" y2="22" strokeWidth={0.75} strokeOpacity={0.3} />
    <line x1="8" y1="28" x2="20" y2="28" strokeWidth={0.75} strokeOpacity={0.25} />
    <line x1="8" y1="32" x2="20" y2="32" strokeWidth={0.75} strokeOpacity={0.2} />

    {/* Paint division line */}
    <line x1="22" y1="16" x2="22" y2="36" strokeWidth={1.5} strokeDasharray="0" />

    {/* Wall outline */}
    <rect x="6" y="16" width="32" height="20" strokeWidth={2} fill="none" />

    {/* Paintbrush cursor approaching the wall from top-right */}
    {/* Brush handle */}
    <line x1="36" y1="6" x2="26" y2="18" strokeWidth={2} />
    {/* Brush ferrule (band) */}
    <rect
      x="27"
      y="14"
      width="5"
      height="3"
      rx="0.5"
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.40)' }}
      strokeWidth={1}
      transform="rotate(-45, 29.5, 15.5)"
    />
    {/* Brush bristle tip */}
    <polygon
      points="22,18 26,16 28,22 24,22"
      style={{ fill: 'var(--hi-finish, currentColor)', fillOpacity: 'var(--hi-finish-op, 0.60)' }}
      strokeWidth={1}
    />
  </>,
);

// ── MeasureBetweenHifi — two wall corners + measurement line + arrowheads + "3600mm" ──
export const MeasureBetweenHifi = bimIconHifi(
  'MeasureBetweenHifi',
  <>
    {/* Left wall corner stub — concrete */}
    <rect
      x="4"
      y="12"
      width="10"
      height="24"
      style={{
        fill: 'var(--hi-concrete, currentColor)',
        fillOpacity: 'var(--hi-concrete-op, 0.14)',
      }}
      strokeWidth={2}
    />
    {/* Left wall hatch */}
    <g strokeWidth={0.75} strokeOpacity={0.26}>
      <line x1="4" y1="20" x2="8" y2="12" />
      <line x1="4" y1="28" x2="12" y2="14" />
      <line x1="6" y1="36" x2="14" y2="26" />
    </g>

    {/* Right wall corner stub — concrete */}
    <rect
      x="34"
      y="12"
      width="10"
      height="24"
      style={{
        fill: 'var(--hi-concrete, currentColor)',
        fillOpacity: 'var(--hi-concrete-op, 0.14)',
      }}
      strokeWidth={2}
    />
    {/* Right wall hatch */}
    <g strokeWidth={0.75} strokeOpacity={0.26}>
      <line x1="34" y1="20" x2="40" y2="12" />
      <line x1="34" y1="28" x2="42" y2="20" />
      <line x1="34" y1="36" x2="42" y2="30" />
    </g>

    {/* Extension lines dropping to measurement points */}
    <line
      x1="14"
      y1="8"
      x2="14"
      y2="42"
      strokeWidth={0.75}
      strokeDasharray="2 2"
      strokeOpacity={0.45}
    />
    <line
      x1="34"
      y1="8"
      x2="34"
      y2="42"
      strokeWidth={0.75}
      strokeDasharray="2 2"
      strokeOpacity={0.45}
    />

    {/* Measurement line with arrowheads */}
    <line x1="14" y1="40" x2="34" y2="40" strokeWidth={1.5} />
    <polyline points="17,37 14,40 17,43" strokeWidth={1.5} fill="none" />
    <polyline points="31,37 34,40 31,43" strokeWidth={1.5} fill="none" />

    {/* Dimension text placeholder — "3600mm" represented as lines */}
    <rect
      x="17"
      y="35"
      width="14"
      height="6"
      style={{ fill: 'var(--hi-room, currentColor)', fillOpacity: 'var(--hi-room-op, 0.30)' }}
      strokeWidth={0.75}
      strokeOpacity={0.4}
    />
    {/* Text lines inside dim box */}
    <line x1="18" y1="37" x2="30" y2="37" strokeWidth={0.75} strokeOpacity={0.5} />
    <line x1="18" y1="39.5" x2="28" y2="39.5" strokeWidth={0.75} strokeOpacity={0.35} />

    {/* Point markers at measurement endpoints */}
    <circle cx="14" cy="24" r="1.5" fill="currentColor" fillOpacity={0.5} stroke="none" />
    <circle cx="34" cy="24" r="1.5" fill="currentColor" fillOpacity={0.5} stroke="none" />
  </>,
);

// ── MeasureAlongHifi — curved wall with measurement tape + tick marks along face ──
export const MeasureAlongHifi = bimIconHifi(
  'MeasureAlongHifi',
  <>
    {/* Curved wall — concrete, plan-view arc */}
    {/* Wall outer face */}
    <path
      d="M 6,38 Q 24,6 42,38"
      style={{
        fill: 'var(--hi-concrete, currentColor)',
        fillOpacity: 'var(--hi-concrete-op, 0.14)',
      }}
      strokeWidth={2}
    />
    {/* Wall inner face (offset arc) */}
    <path d="M 10,38 Q 24,12 38,38" strokeWidth={1.5} fill="none" strokeOpacity={0.7} />
    {/* Fill between outer and inner arc */}
    <path
      d="M 6,38 Q 24,6 42,38 L 38,38 Q 24,12 10,38 Z"
      style={{
        fill: 'var(--hi-concrete, currentColor)',
        fillOpacity: 'var(--hi-concrete-op, 0.10)',
      }}
      stroke="none"
    />
    {/* Concrete hatch along wall */}
    <g strokeWidth={0.75} strokeOpacity={0.24}>
      <line x1="8" y1="38" x2="14" y2="28" />
      <line x1="14" y1="32" x2="18" y2="20" />
      <line x1="20" y1="24" x2="22" y2="14" />
      <line x1="26" y1="14" x2="28" y2="24" />
      <line x1="30" y1="20" x2="34" y2="32" />
      <line x1="36" y1="28" x2="40" y2="38" />
    </g>

    {/* Measurement tape / line following the outer wall face */}
    <path
      d="M 6,38 Q 24,4 42,38"
      strokeWidth={1}
      strokeDasharray="0"
      fill="none"
      strokeOpacity={0.7}
      style={{ stroke: 'var(--hi-steel, currentColor)' }}
    />

    {/* Tick marks at regular intervals along measurement path */}
    {/* Tick 1 ~at 20% */}
    <line x1="11" y1="30" x2="12" y2="27" strokeWidth={1.5} />
    {/* Tick 2 ~at 35% */}
    <line x1="17" y1="20" x2="18" y2="17" strokeWidth={1.5} />
    {/* Tick 3 ~at 50% (top/center) */}
    <line x1="24" y1="12" x2="24" y2="8" strokeWidth={1.5} />
    {/* Tick 4 ~at 65% */}
    <line x1="30" y1="17" x2="31" y2="20" strokeWidth={1.5} />
    {/* Tick 5 ~at 80% */}
    <line x1="36" y1="27" x2="37" y2="30" strokeWidth={1.5} />

    {/* Cumulative distance placeholder text — bottom center */}
    <rect
      x="16"
      y="41"
      width="16"
      height="5"
      style={{ fill: 'var(--hi-room, currentColor)', fillOpacity: 'var(--hi-room-op, 0.28)' }}
      strokeWidth={0.75}
      strokeOpacity={0.4}
    />
    <line x1="17" y1="43" x2="31" y2="43" strokeWidth={0.75} strokeOpacity={0.45} />
  </>,
);

// ── UngroupHifi — dotted selection boundary breaking apart, elements separating ──
export const UngroupHifi = bimIconHifi(
  'UngroupHifi',
  <>
    {/* Outer group boundary — dashed, breaking apart */}
    {/* Top edge — left segment (intact) */}
    <line
      x1="6"
      y1="8"
      x2="19"
      y2="8"
      strokeWidth={1.5}
      strokeDasharray="3 2"
      strokeOpacity={0.6}
    />
    {/* Top edge — right segment (intact) */}
    <line
      x1="29"
      y1="8"
      x2="42"
      y2="8"
      strokeWidth={1.5}
      strokeDasharray="3 2"
      strokeOpacity={0.6}
    />
    {/* Bottom edge — left segment */}
    <line
      x1="6"
      y1="40"
      x2="19"
      y2="40"
      strokeWidth={1.5}
      strokeDasharray="3 2"
      strokeOpacity={0.6}
    />
    {/* Bottom edge — right segment */}
    <line
      x1="29"
      y1="40"
      x2="42"
      y2="40"
      strokeWidth={1.5}
      strokeDasharray="3 2"
      strokeOpacity={0.6}
    />
    {/* Left edge */}
    <line
      x1="6"
      y1="8"
      x2="6"
      y2="40"
      strokeWidth={1.5}
      strokeDasharray="3 2"
      strokeOpacity={0.6}
    />
    {/* Right edge */}
    <line
      x1="42"
      y1="8"
      x2="42"
      y2="40"
      strokeWidth={1.5}
      strokeDasharray="3 2"
      strokeOpacity={0.6}
    />

    {/* Break arrows pointing outward at top gap */}
    <polyline points="20,5 24,8 28,5" strokeWidth={1.5} fill="none" />
    {/* Break arrows pointing outward at bottom gap */}
    <polyline points="20,43 24,40 28,43" strokeWidth={1.5} fill="none" />

    {/* Interior element 1 — wall stub (left), concrete */}
    <rect
      x="9"
      y="18"
      width="12"
      height="10"
      style={{
        fill: 'var(--hi-concrete, currentColor)',
        fillOpacity: 'var(--hi-concrete-op, 0.14)',
      }}
      strokeWidth={1.5}
    />
    {/* Wall stub hatch */}
    <g strokeWidth={0.75} strokeOpacity={0.26}>
      <line x1="9" y1="24" x2="13" y2="18" />
      <line x1="9" y1="28" x2="17" y2="18" />
      <line x1="13" y1="28" x2="21" y2="20" />
    </g>
    {/* Independent boundary hint for element 1 */}
    <rect
      x="8"
      y="17"
      width="14"
      height="12"
      strokeWidth={0.75}
      strokeDasharray="2 1.5"
      strokeOpacity={0.5}
      fill="none"
    />

    {/* Interior element 2 — door stub (right), leaf/timber */}
    <rect
      x="27"
      y="18"
      width="12"
      height="10"
      style={{ fill: 'var(--hi-leaf, currentColor)' }}
      fillOpacity={0.15}
      strokeWidth={1.5}
    />
    {/* Door arc hint */}
    <path d="M 27,28 Q 33,22 39,28" strokeWidth={0.75} strokeOpacity={0.45} fill="none" />
    {/* Independent boundary hint for element 2 */}
    <rect
      x="26"
      y="17"
      width="14"
      height="12"
      strokeWidth={0.75}
      strokeDasharray="2 1.5"
      strokeOpacity={0.5}
      fill="none"
    />

    {/* Separation arrows pointing elements apart (outward from center) */}
    {/* Left element arrow */}
    <line x1="18" y1="24" x2="14" y2="24" strokeWidth={1.5} />
    <polyline points="16,22 14,24 16,26" strokeWidth={1.5} fill="none" />
    {/* Right element arrow */}
    <line x1="30" y1="24" x2="34" y2="24" strokeWidth={1.5} />
    <polyline points="32,22 34,24 32,26" strokeWidth={1.5} fill="none" />
  </>,
);
