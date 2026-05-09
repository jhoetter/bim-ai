/**
 * High-fidelity 48×48 BIM icons — architectural elements.
 *
 * CSS custom properties (set on a wrapper element):
 *   --hi-concrete / --hi-concrete-op  — structural concrete (gray)
 *   --hi-finish   / --hi-finish-op    — plaster, gypsum, screed (warm white)
 *   --hi-glass    / --hi-glass-op     — glazing panes (blue)
 *   --hi-steel    / --hi-steel-op     — steel sections, bolts, aluminum (blue-gray)
 *   --hi-leaf                          — timber: door leaf, handrail, frame (amber/brown), no opacity var
 *   --hi-roof     / --hi-roof-op      — roof surface (terracotta)
 *   --hi-room     / --hi-room-op      — room interior fill (pale yellow)
 *
 * Without variables the icons render in monochrome currentColor.
 *
 * Stroke hierarchy:
 *   strokeWidth 2    — primary outlines
 *   strokeWidth 1.5  — secondary edges, reveals
 *   strokeWidth 0.75 — hatch, detail lines
 */
import { bimIconHifi } from './icon';

// ── RailingHifi — plan view: two rails + wood baluster posts + end base plates ──
export const RailingHifi = bimIconHifi(
  'RailingHifi',
  <>
    {/* End base plate fills — left and right */}
    <rect
      x="4"
      y="20"
      width="4"
      height="8"
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.12)' }}
    />
    <rect
      x="40"
      y="20"
      width="4"
      height="8"
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.12)' }}
    />
    {/* Base plate outlines */}
    <rect x="4" y="20" width="4" height="8" strokeWidth={1.5} />
    <rect x="40" y="20" width="4" height="8" strokeWidth={1.5} />

    {/* Wood baluster posts */}
    <rect
      x="14"
      y="21"
      width="3"
      height="6"
      style={{ fill: 'var(--hi-leaf, currentColor)' }}
      fillOpacity={0.5}
      strokeWidth={1}
    />
    <rect
      x="22.5"
      y="21"
      width="3"
      height="6"
      style={{ fill: 'var(--hi-leaf, currentColor)' }}
      fillOpacity={0.5}
      strokeWidth={1}
    />
    <rect
      x="31"
      y="21"
      width="3"
      height="6"
      style={{ fill: 'var(--hi-leaf, currentColor)' }}
      fillOpacity={0.5}
      strokeWidth={1}
    />

    {/* Inner rail (secondary) */}
    <line x1="4" y1="25" x2="44" y2="25" strokeWidth={1.5} />

    {/* Outer top rail (primary, bold) */}
    <line x1="4" y1="21" x2="44" y2="21" strokeWidth={2} />
    {/* Outer bottom rail (primary, bold) */}
    <line x1="4" y1="27" x2="44" y2="27" strokeWidth={2} />
  </>,
);

// ── CurtainWallHifi — plan section: concrete wall stubs + glass panes + mullions ──
export const CurtainWallHifi = bimIconHifi(
  'CurtainWallHifi',
  <>
    {/* Left concrete wall stub */}
    <rect
      x="4"
      y="16"
      width="10"
      height="16"
      style={{
        fill: 'var(--hi-concrete, currentColor)',
        fillOpacity: 'var(--hi-concrete-op, 0.07)',
      }}
    />
    <g strokeWidth={0.75} strokeOpacity={0.4}>
      <line x1="4" y1="24" x2="8" y2="16" />
      <line x1="4" y1="30" x2="12" y2="16" />
      <line x1="8" y1="32" x2="14" y2="24" />
      <line x1="12" y1="32" x2="14" y2="28" />
    </g>
    <line x1="4" y1="16" x2="14" y2="16" strokeWidth={2} />
    <line x1="4" y1="32" x2="14" y2="32" strokeWidth={2} />
    <line x1="4" y1="16" x2="4" y2="32" strokeWidth={1.5} />

    {/* Right concrete wall stub */}
    <rect
      x="34"
      y="16"
      width="10"
      height="16"
      style={{
        fill: 'var(--hi-concrete, currentColor)',
        fillOpacity: 'var(--hi-concrete-op, 0.07)',
      }}
    />
    <g strokeWidth={0.75} strokeOpacity={0.4}>
      <line x1="34" y1="24" x2="38" y2="16" />
      <line x1="34" y1="30" x2="42" y2="16" />
      <line x1="38" y1="32" x2="44" y2="24" />
      <line x1="42" y1="32" x2="44" y2="28" />
    </g>
    <line x1="34" y1="16" x2="44" y2="16" strokeWidth={2} />
    <line x1="34" y1="32" x2="44" y2="32" strokeWidth={2} />
    <line x1="44" y1="16" x2="44" y2="32" strokeWidth={1.5} />

    {/* Glass pane 1 */}
    <rect
      x="14"
      y="16"
      width="6"
      height="16"
      style={{ fill: 'var(--hi-glass, currentColor)', fillOpacity: 'var(--hi-glass-op, 0.10)' }}
      strokeWidth={0.75}
    />
    {/* Mullion between pane 1 and 2 */}
    <line x1="20" y1="16" x2="20" y2="32" strokeWidth={1} />
    {/* Glass pane 2 */}
    <rect
      x="20"
      y="16"
      width="8"
      height="16"
      style={{ fill: 'var(--hi-glass, currentColor)', fillOpacity: 'var(--hi-glass-op, 0.08)' }}
      strokeWidth={0.75}
    />
    {/* Mullion between pane 2 and 3 */}
    <line x1="28" y1="16" x2="28" y2="32" strokeWidth={1} />
    {/* Glass pane 3 */}
    <rect
      x="28"
      y="16"
      width="6"
      height="16"
      style={{ fill: 'var(--hi-glass, currentColor)', fillOpacity: 'var(--hi-glass-op, 0.10)' }}
      strokeWidth={0.75}
    />

    {/* Aluminum transom lines (horizontal) */}
    <line x1="14" y1="24" x2="34" y2="24" strokeWidth={1} strokeOpacity={0.5} />
  </>,
);

// ── CeilingHifi — reflected ceiling plan: tile grid + recessed light fixture ────
export const CeilingHifi = bimIconHifi(
  'CeilingHifi',
  <>
    {/* Ceiling fill */}
    <rect
      x="4"
      y="6"
      width="40"
      height="36"
      style={{ fill: 'var(--hi-finish, currentColor)', fillOpacity: 'var(--hi-finish-op, 0.06)' }}
    />

    {/* Ceiling boundary */}
    <rect x="4" y="6" width="40" height="36" strokeWidth={2} />

    {/* Ceiling tile grid — 2 columns × 3 rows = 6 tiles */}
    {/* Vertical divider */}
    <line x1="24" y1="6" x2="24" y2="42" strokeWidth={0.75} strokeOpacity={0.4} />
    {/* Horizontal dividers */}
    <line x1="4" y1="18" x2="44" y2="18" strokeWidth={0.75} strokeOpacity={0.4} />
    <line x1="4" y1="30" x2="44" y2="30" strokeWidth={0.75} strokeOpacity={0.4} />

    {/* Recessed light fixture in top-right tile (center ~x=34, y=12) */}
    <rect x="30" y="8" width="8" height="8" strokeWidth={0.75} strokeOpacity={0.6} />
    {/* Cross lines inside fixture */}
    <line x1="34" y1="8" x2="34" y2="16" strokeWidth={0.75} strokeOpacity={0.6} />
    <line x1="30" y1="12" x2="38" y2="12" strokeWidth={0.75} strokeOpacity={0.6} />

    {/* Another light in bottom-left tile (center ~x=14, y=36) */}
    <rect x="10" y="32" width="8" height="8" strokeWidth={0.75} strokeOpacity={0.6} />
    <line x1="14" y1="32" x2="14" y2="40" strokeWidth={0.75} strokeOpacity={0.6} />
    <line x1="10" y1="36" x2="18" y2="36" strokeWidth={0.75} strokeOpacity={0.6} />
  </>,
);

// ── OpeningHifi — plan view: concrete wall stubs + void opening + jamb ticks ────
export const OpeningHifi = bimIconHifi(
  'OpeningHifi',
  <>
    {/* Left concrete wall stub */}
    <rect
      x="4"
      y="16"
      width="12"
      height="16"
      style={{
        fill: 'var(--hi-concrete, currentColor)',
        fillOpacity: 'var(--hi-concrete-op, 0.07)',
      }}
    />
    <g strokeWidth={0.75} strokeOpacity={0.4}>
      <line x1="4" y1="24" x2="8" y2="16" />
      <line x1="4" y1="30" x2="12" y2="16" />
      <line x1="8" y1="32" x2="16" y2="22" />
      <line x1="12" y1="32" x2="16" y2="28" />
    </g>
    <line x1="4" y1="16" x2="16" y2="16" strokeWidth={2} />
    <line x1="4" y1="32" x2="16" y2="32" strokeWidth={2} />
    <line x1="4" y1="16" x2="4" y2="32" strokeWidth={1.5} />
    <line x1="16" y1="16" x2="16" y2="32" strokeWidth={1.5} />

    {/* Right concrete wall stub */}
    <rect
      x="32"
      y="16"
      width="12"
      height="16"
      style={{
        fill: 'var(--hi-concrete, currentColor)',
        fillOpacity: 'var(--hi-concrete-op, 0.07)',
      }}
    />
    <g strokeWidth={0.75} strokeOpacity={0.4}>
      <line x1="32" y1="24" x2="36" y2="16" />
      <line x1="32" y1="30" x2="40" y2="16" />
      <line x1="36" y1="32" x2="44" y2="22" />
      <line x1="40" y1="32" x2="44" y2="28" />
    </g>
    <line x1="32" y1="16" x2="44" y2="16" strokeWidth={2} />
    <line x1="32" y1="32" x2="44" y2="32" strokeWidth={2} />
    <line x1="44" y1="16" x2="44" y2="32" strokeWidth={1.5} />
    <line x1="32" y1="16" x2="32" y2="32" strokeWidth={1.5} />

    {/* Jamb tick marks at left jamb edge */}
    <line x1="16" y1="13" x2="16" y2="16" strokeWidth={1.5} />
    <line x1="16" y1="32" x2="16" y2="35" strokeWidth={1.5} />

    {/* Jamb tick marks at right jamb edge */}
    <line x1="32" y1="13" x2="32" y2="16" strokeWidth={1.5} />
    <line x1="32" y1="32" x2="32" y2="35" strokeWidth={1.5} />

    {/* Dashed rectangle showing opening boundary extents */}
    <rect
      x="16"
      y="13"
      width="16"
      height="22"
      strokeWidth={0.75}
      strokeDasharray="3 2"
      strokeOpacity={0.5}
    />
  </>,
);

// ── RampHifi — plan view: finish floor + slope hatching + up-arrow + nosing ─────
export const RampHifi = bimIconHifi(
  'RampHifi',
  <>
    {/* Ramp boundary fill */}
    <rect
      x="4"
      y="8"
      width="40"
      height="32"
      style={{ fill: 'var(--hi-finish, currentColor)', fillOpacity: 'var(--hi-finish-op, 0.06)' }}
    />

    {/* Diagonal slope lines at 45° */}
    <g strokeWidth={0.75} strokeOpacity={0.4}>
      <line x1="4" y1="20" x2="16" y2="8" />
      <line x1="4" y1="28" x2="24" y2="8" />
      <line x1="4" y1="36" x2="32" y2="8" />
      <line x1="8" y1="40" x2="40" y2="8" />
      <line x1="16" y1="40" x2="44" y2="12" />
      <line x1="24" y1="40" x2="44" y2="20" />
      <line x1="32" y1="40" x2="44" y2="28" />
      <line x1="40" y1="40" x2="44" y2="36" />
    </g>

    {/* Ramp boundary */}
    <rect x="4" y="8" width="40" height="32" strokeWidth={2} />

    {/* Nosing lines at bottom edge (lower end of ramp) */}
    <line x1="10" y1="40" x2="10" y2="36" strokeWidth={2} />
    <line x1="38" y1="40" x2="38" y2="36" strokeWidth={2} />

    {/* Up arrow at top (direction of incline) */}
    <line x1="24" y1="28" x2="24" y2="14" strokeWidth={1.5} />
    <polyline points="20,19 24,14 28,19" strokeWidth={1.5} fill="none" />
  </>,
);

// ── PartitionHifi — plan section: lightweight drywall partition (two gypsum faces + core) ──
export const PartitionHifi = bimIconHifi(
  'PartitionHifi',
  <>
    {/* Outer gypsum board face 1 */}
    <rect
      x="4"
      y="21"
      width="40"
      height="2.5"
      style={{ fill: 'var(--hi-finish, currentColor)', fillOpacity: 'var(--hi-finish-op, 0.09)' }}
    />
    {/* Air/insulation gap (no fill — void) */}
    <rect x="4" y="23.5" width="40" height="1" fill="none" />
    {/* Inner gypsum board face 2 */}
    <rect
      x="4"
      y="24.5"
      width="40"
      height="2.5"
      style={{ fill: 'var(--hi-finish, currentColor)', fillOpacity: 'var(--hi-finish-op, 0.06)' }}
    />

    {/* Primary face lines — outer top and inner bottom */}
    <line x1="4" y1="21" x2="44" y2="21" strokeWidth={2} />
    <line x1="4" y1="27" x2="44" y2="27" strokeWidth={2} />

    {/* Layer dividers — gypsum to gap boundaries */}
    <line x1="4" y1="23.5" x2="44" y2="23.5" strokeWidth={0.75} strokeOpacity={0.45} />
    <line x1="4" y1="24.5" x2="44" y2="24.5" strokeWidth={0.75} strokeOpacity={0.45} />

    {/* End caps */}
    <line x1="4" y1="21" x2="4" y2="27" strokeWidth={1.5} />
    <line x1="44" y1="21" x2="44" y2="27" strokeWidth={1.5} />

    {/* Stud indication marks along the wall */}
    <g strokeWidth={0.75} strokeOpacity={0.35}>
      <line x1="14" y1="21" x2="14" y2="27" />
      <line x1="24" y1="21" x2="24" y2="27" />
      <line x1="34" y1="21" x2="34" y2="27" />
    </g>
  </>,
);

// ── TagHifi — annotation callout balloon + triangle leader + text placeholders ──
export const TagHifi = bimIconHifi(
  'TagHifi',
  <>
    {/* Balloon fill */}
    <rect
      x="8"
      y="4"
      width="32"
      height="24"
      rx="4"
      ry="4"
      style={{ fill: 'var(--hi-finish, currentColor)', fillOpacity: 'var(--hi-finish-op, 0.10)' }}
    />

    {/* Balloon outline */}
    <rect x="8" y="4" width="32" height="24" rx="4" ry="4" strokeWidth={1.5} />

    {/* Text placeholder lines inside balloon */}
    <line x1="14" y1="13" x2="34" y2="13" strokeWidth={1} strokeOpacity={0.4} />
    <line x1="14" y1="19" x2="30" y2="19" strokeWidth={1} strokeOpacity={0.4} />

    {/* Triangle leader pointing down-left */}
    <polygon
      points="8,28 16,28 10,38"
      style={{ fill: 'var(--hi-finish, currentColor)', fillOpacity: 'var(--hi-finish-op, 0.10)' }}
      strokeWidth={1.5}
    />

    {/* Small circle at leader tip */}
    <circle cx="10" cy="38" r="2" fill="currentColor" stroke="none" />
  </>,
);

// ── DimensionHifi — linear dimension: extension lines + dimension line + tick marks ──
export const DimensionHifi = bimIconHifi(
  'DimensionHifi',
  <>
    {/* Measured object indicator (thin baseline) */}
    <line x1="8" y1="32" x2="40" y2="32" strokeWidth={0.75} strokeOpacity={0.3} />

    {/* Left extension line (extends past dimension line) */}
    <line x1="10" y1="30" x2="10" y2="16" strokeWidth={1} strokeOpacity={0.7} />
    {/* Right extension line */}
    <line x1="38" y1="30" x2="38" y2="16" strokeWidth={1} strokeOpacity={0.7} />

    {/* Dimension line */}
    <line x1="10" y1="20" x2="38" y2="20" strokeWidth={1.5} />

    {/* Tick fill zone at each end */}
    <rect
      x="8"
      y="17"
      width="5"
      height="6"
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.12)' }}
      stroke="none"
    />
    <rect
      x="35"
      y="17"
      width="5"
      height="6"
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.12)' }}
      stroke="none"
    />

    {/* Perpendicular tick marks at each end of dimension line */}
    <line x1="10" y1="17" x2="10" y2="23" strokeWidth={2} />
    <line x1="38" y1="17" x2="38" y2="23" strokeWidth={2} />

    {/* Text placeholder box in center */}
    <rect x="17" y="13" width="14" height="8" rx="1" strokeWidth={0.75} strokeOpacity={0.35} />
    {/* Text lines inside placeholder */}
    <line x1="19" y1="16" x2="29" y2="16" strokeWidth={0.75} strokeOpacity={0.4} />
    <line x1="19" y1="19" x2="27" y2="19" strokeWidth={0.75} strokeOpacity={0.4} />
  </>,
);

// ── MassHifi — isometric massing box: three visible faces (front, top, side) ────
export const MassHifi = bimIconHifi(
  'MassHifi',
  <>
    {/* Front face (left-bottom quadrant, parallelogram) */}
    <polygon
      points="6,28 26,28 26,44 6,44"
      style={{
        fill: 'var(--hi-concrete, currentColor)',
        fillOpacity: 'var(--hi-concrete-op, 0.12)',
      }}
    />

    {/* Side face (right of front, parallelogram offset in x+y) */}
    <polygon
      points="26,28 42,20 42,36 26,44"
      style={{
        fill: 'var(--hi-concrete, currentColor)',
        fillOpacity: 'var(--hi-concrete-op, 0.07)',
      }}
    />

    {/* Top face (trapezoid above front + side) */}
    <polygon
      points="6,28 22,20 42,20 26,28"
      style={{ fill: 'var(--hi-finish, currentColor)', fillOpacity: 'var(--hi-finish-op, 0.10)' }}
    />

    {/* Silhouette edges (bold) */}
    {/* Left edge */}
    <line x1="6" y1="28" x2="6" y2="44" strokeWidth={2} />
    {/* Bottom edge front */}
    <line x1="6" y1="44" x2="26" y2="44" strokeWidth={2} />
    {/* Bottom-right edge */}
    <line x1="26" y1="44" x2="42" y2="36" strokeWidth={2} />
    {/* Right edge */}
    <line x1="42" y1="20" x2="42" y2="36" strokeWidth={2} />
    {/* Top-right ridge */}
    <line x1="22" y1="20" x2="42" y2="20" strokeWidth={2} />
    {/* Top-left edge */}
    <line x1="6" y1="28" x2="22" y2="20" strokeWidth={2} />

    {/* Shared face edges (medium weight) */}
    {/* Front-top shared edge */}
    <line x1="6" y1="28" x2="26" y2="28" strokeWidth={1.5} />
    {/* Front-side shared edge */}
    <line x1="26" y1="28" x2="26" y2="44" strokeWidth={1.5} />
    {/* Top-side shared edge */}
    <line x1="26" y1="28" x2="42" y2="20" strokeWidth={1.5} />
  </>,
);
