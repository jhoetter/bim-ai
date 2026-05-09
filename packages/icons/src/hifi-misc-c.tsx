/**
 * High-fidelity 48×48 BIM miscellaneous icons — set C.
 *
 * CSS custom properties (set on a wrapper element):
 *   --hi-concrete / --hi-concrete-op  — structural, terrain (stone gray)
 *   --hi-finish   / --hi-finish-op    — paper, annotation fill (warm off-white)
 *   --hi-glass    / --hi-glass-op     — water, transparent zones (sky blue)
 *   --hi-steel    / --hi-steel-op     — metal markers, frames (blue-gray)
 *   --hi-leaf                          — vegetation, grass (amber-brown), no opacity var
 *   --hi-room     / --hi-room-op      — site areas, zones (pale yellow)
 *   --hi-roof     / --hi-roof-op      — boundaries, alerts (terracotta red)
 *
 * Without variables the icons render in monochrome currentColor.
 *
 * Stroke hierarchy:
 *   strokeWidth 2    — primary outlines
 *   strokeWidth 1.5  — secondary edges, reveals
 *   strokeWidth 0.75 — detail, text, annotation lines
 */
import { bimIconHifi } from './icon';

// ── ParkingSpaceHifi ──
export const ParkingSpaceHifi = bimIconHifi(
  'ParkingSpaceHifi',
  <>
    {/* Parking bay floor — pavement marking fill */}
    <rect
      x="9"
      y="5"
      width="30"
      height="38"
      style={{ fill: 'var(--hi-finish, currentColor)', fillOpacity: 'var(--hi-finish-op, 0.22)' }}
      stroke="none"
    />

    {/* Parking bay bold outline */}
    <rect x="9" y="5" width="30" height="38" strokeWidth={2} fill="none" />

    {/* Dashed line at entry end (bottom) */}
    <line x1="9" y1="43" x2="39" y2="43" strokeWidth={2} strokeDasharray="5 3" />

    {/* Center stall divider line */}
    <line x1="24" y1="5" x2="24" y2="43" strokeWidth={1.5} strokeOpacity={0.45} />

    {/* Car body — simplified rectangle */}
    <rect
      x="13"
      y="16"
      width="22"
      height="14"
      rx="2"
      style={{
        fill: 'var(--hi-concrete, currentColor)',
        fillOpacity: 'var(--hi-concrete-op, 0.18)',
      }}
      strokeWidth={1.5}
    />

    {/* Wheel — front left */}
    <circle
      cx="15"
      cy="15"
      r="2"
      style={{
        fill: 'var(--hi-concrete, currentColor)',
        fillOpacity: 'var(--hi-concrete-op, 0.55)',
      }}
      strokeWidth={0.75}
    />

    {/* Wheel — front right */}
    <circle
      cx="33"
      cy="15"
      r="2"
      style={{
        fill: 'var(--hi-concrete, currentColor)',
        fillOpacity: 'var(--hi-concrete-op, 0.55)',
      }}
      strokeWidth={0.75}
    />

    {/* Wheel — rear left */}
    <circle
      cx="15"
      cy="31"
      r="2"
      style={{
        fill: 'var(--hi-concrete, currentColor)',
        fillOpacity: 'var(--hi-concrete-op, 0.55)',
      }}
      strokeWidth={0.75}
    />

    {/* Wheel — rear right */}
    <circle
      cx="33"
      cy="31"
      r="2"
      style={{
        fill: 'var(--hi-concrete, currentColor)',
        fillOpacity: 'var(--hi-concrete-op, 0.55)',
      }}
      strokeWidth={0.75}
    />
  </>,
);

// ── PlantingHifi ──
export const PlantingHifi = bimIconHifi(
  'PlantingHifi',
  <>
    {/* Shadow circle below canopy */}
    <ellipse
      cx="24"
      cy="29"
      rx="14"
      ry="5"
      style={{ fill: 'currentColor' }}
      strokeOpacity={0}
      fillOpacity={0.08}
    />

    {/* Canopy fill — leaf color at low opacity */}
    <circle
      cx="24"
      cy="22"
      r="14"
      style={{ fill: 'var(--hi-leaf, currentColor)', fillOpacity: 0.18 }}
      stroke="none"
    />

    {/* Canopy petal shapes — 8 radiating petals (alternating filled/outline) */}
    {/* Petal 1 — top (filled) */}
    <ellipse
      cx="24"
      cy="11"
      rx="4"
      ry="6"
      style={{ fill: 'var(--hi-leaf, currentColor)', fillOpacity: 0.45 }}
      strokeWidth={0.75}
    />
    {/* Petal 2 — top-right (outline) */}
    <ellipse
      cx="33"
      cy="14"
      rx="4"
      ry="6"
      transform="rotate(45 33 14)"
      fill="none"
      strokeWidth={0.75}
    />
    {/* Petal 3 — right (filled) */}
    <ellipse
      cx="35"
      cy="22"
      rx="6"
      ry="4"
      style={{ fill: 'var(--hi-leaf, currentColor)', fillOpacity: 0.45 }}
      strokeWidth={0.75}
    />
    {/* Petal 4 — bottom-right (outline) */}
    <ellipse
      cx="33"
      cy="30"
      rx="4"
      ry="6"
      transform="rotate(-45 33 30)"
      fill="none"
      strokeWidth={0.75}
    />
    {/* Petal 5 — bottom (filled) */}
    <ellipse
      cx="24"
      cy="33"
      rx="4"
      ry="6"
      style={{ fill: 'var(--hi-leaf, currentColor)', fillOpacity: 0.45 }}
      strokeWidth={0.75}
    />
    {/* Petal 6 — bottom-left (outline) */}
    <ellipse
      cx="15"
      cy="30"
      rx="4"
      ry="6"
      transform="rotate(45 15 30)"
      fill="none"
      strokeWidth={0.75}
    />
    {/* Petal 7 — left (filled) */}
    <ellipse
      cx="13"
      cy="22"
      rx="6"
      ry="4"
      style={{ fill: 'var(--hi-leaf, currentColor)', fillOpacity: 0.45 }}
      strokeWidth={0.75}
    />
    {/* Petal 8 — top-left (outline) */}
    <ellipse
      cx="15"
      cy="14"
      rx="4"
      ry="6"
      transform="rotate(-45 15 14)"
      fill="none"
      strokeWidth={0.75}
    />

    {/* Canopy outline ring */}
    <circle cx="24" cy="22" r="14" strokeWidth={1.5} fill="none" />

    {/* Trunk circle */}
    <circle
      cx="24"
      cy="22"
      r="4"
      style={{ fill: 'var(--hi-leaf, currentColor)', fillOpacity: 0.9 }}
      strokeWidth={2}
    />
  </>,
);

// ── RoadHifi ──
export const RoadHifi = bimIconHifi(
  'RoadHifi',
  <>
    {/* Shoulder strip — left */}
    <rect
      x="4"
      y="4"
      width="5"
      height="40"
      style={{ fill: 'var(--hi-finish, currentColor)', fillOpacity: 'var(--hi-finish-op, 0.55)' }}
      strokeWidth={1.5}
    />

    {/* Shoulder strip — right */}
    <rect
      x="39"
      y="4"
      width="5"
      height="40"
      style={{ fill: 'var(--hi-finish, currentColor)', fillOpacity: 'var(--hi-finish-op, 0.55)' }}
      strokeWidth={1.5}
    />

    {/* Pavement fill */}
    <rect
      x="9"
      y="4"
      width="30"
      height="40"
      style={{
        fill: 'var(--hi-concrete, currentColor)',
        fillOpacity: 'var(--hi-concrete-op, 0.22)',
      }}
      stroke="none"
    />

    {/* Road edge — left bold */}
    <line x1="9" y1="4" x2="9" y2="44" strokeWidth={2} />

    {/* Road edge — right bold */}
    <line x1="39" y1="4" x2="39" y2="44" strokeWidth={2} />

    {/* Dashed centre line */}
    <line
      x1="24"
      y1="4"
      x2="24"
      y2="44"
      strokeWidth={1.5}
      strokeDasharray="8 4"
      strokeOpacity={0.75}
    />

    {/* Straight-ahead arrow — shaft */}
    <line x1="24" y1="32" x2="24" y2="18" strokeWidth={1.5} strokeOpacity={0.6} />

    {/* Arrow head */}
    <polyline points="20,22 24,17 28,22" strokeWidth={1.5} strokeOpacity={0.6} fill="none" />
  </>,
);

// ── RetainingWallHifi ──
export const RetainingWallHifi = bimIconHifi(
  'RetainingWallHifi',
  <>
    {/* Earth / soil fill — left side */}
    <rect
      x="4"
      y="4"
      width="18"
      height="38"
      style={{ fill: 'var(--hi-room, currentColor)', fillOpacity: 'var(--hi-room-op, 0.30)' }}
      stroke="none"
    />

    {/* Earth diagonal hatch lines */}
    <g strokeWidth={0.75} strokeOpacity={0.35}>
      <line x1="4" y1="10" x2="14" y2="4" />
      <line x1="4" y1="18" x2="22" y2="4" />
      <line x1="4" y1="26" x2="22" y2="12" />
      <line x1="4" y1="34" x2="22" y2="20" />
      <line x1="4" y1="42" x2="22" y2="28" />
      <line x1="10" y1="42" x2="22" y2="34" />
      <line x1="18" y1="42" x2="22" y2="40" />
    </g>

    {/* Wall — concrete fill */}
    <rect
      x="22"
      y="6"
      width="10"
      height="34"
      style={{
        fill: 'var(--hi-concrete, currentColor)',
        fillOpacity: 'var(--hi-concrete-op, 0.55)',
      }}
      stroke="none"
    />

    {/* Wall diagonal hatch */}
    <g strokeWidth={0.75} strokeOpacity={0.28}>
      <line x1="22" y1="12" x2="32" y2="6" />
      <line x1="22" y1="20" x2="32" y2="14" />
      <line x1="22" y1="28" x2="32" y2="22" />
      <line x1="22" y1="36" x2="32" y2="30" />
    </g>

    {/* Wall bold outline */}
    <rect x="22" y="6" width="10" height="34" strokeWidth={2} fill="none" />

    {/* Foundation — slightly wider concrete block */}
    <rect
      x="19"
      y="40"
      width="16"
      height="5"
      style={{
        fill: 'var(--hi-concrete, currentColor)',
        fillOpacity: 'var(--hi-concrete-op, 0.65)',
      }}
      strokeWidth={2}
    />

    {/* Retained void — right side subtle fill */}
    <rect
      x="32"
      y="6"
      width="12"
      height="38"
      style={{ fill: 'var(--hi-finish, currentColor)', fillOpacity: 'var(--hi-finish-op, 0.10)' }}
      stroke="none"
    />

    {/* Drainage pipe symbol at wall base */}
    <circle cx="20" cy="40" r="2.5" strokeWidth={1.5} fill="none" />
    <line x1="4" y1="40" x2="17.5" y2="40" strokeWidth={1} strokeDasharray="3 2" />
  </>,
);

// ── BreakLineHifi ──
export const BreakLineHifi = bimIconHifi(
  'BreakLineHifi',
  <>
    {/* Line body fill zone — thin filled rect for left segment */}
    <rect
      x="4"
      y="22"
      width="13"
      height="4"
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.25)' }}
      stroke="none"
    />

    {/* Line body fill zone — right segment */}
    <rect
      x="31"
      y="22"
      width="13"
      height="4"
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.25)' }}
      stroke="none"
    />

    {/* Left segment — primary line */}
    <line x1="4" y1="24" x2="17" y2="24" strokeWidth={2} />

    {/* Right segment — primary line */}
    <line x1="31" y1="24" x2="44" y2="24" strokeWidth={2} />

    {/* Zig-zag break symbol — 4 sharp peaks */}
    <polyline points="17,24 20,14 23,34 26,14 29,34 31,24" strokeWidth={2} fill="none" />

    {/* Left terminus — perpendicular end cap */}
    <line x1="4" y1="20" x2="4" y2="28" strokeWidth={2} />

    {/* Right terminus — perpendicular end cap */}
    <line x1="44" y1="20" x2="44" y2="28" strokeWidth={2} />
  </>,
);

// ── CentreLineHifi ──
export const CentreLineHifi = bimIconHifi(
  'CentreLineHifi',
  <>
    {/* Chain-dash line body fill — thin rect */}
    <rect
      x="4"
      y="22"
      width="40"
      height="4"
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.15)' }}
      stroke="none"
    />

    {/* Chain-dash line — long dash, gap, dot, gap pattern */}
    <line
      x1="4"
      y1="24"
      x2="44"
      y2="24"
      strokeWidth={1.5}
      strokeDasharray="10 3 2 3"
      strokeOpacity={0.85}
    />

    {/* Left endpoint circle */}
    <circle cx="4" cy="24" r="2.5" strokeWidth={1.5} fill="none" />

    {/* Right endpoint circle */}
    <circle cx="44" cy="24" r="2.5" strokeWidth={1.5} fill="none" />

    {/* Centre cross / diamond symbol at midpoint */}
    <rect
      x="20.5"
      y="20.5"
      width="7"
      height="7"
      transform="rotate(45 24 24)"
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.30)' }}
      strokeWidth={1.5}
    />

    {/* Label placeholder lines — above line */}
    <g strokeWidth={0.75} strokeOpacity={0.4}>
      <line x1="8" y1="17" x2="20" y2="17" />
      <line x1="8" y1="14" x2="16" y2="14" />
    </g>

    {/* Label placeholder lines — below line */}
    <g strokeWidth={0.75} strokeOpacity={0.4}>
      <line x1="28" y1="31" x2="40" y2="31" />
      <line x1="28" y1="34" x2="36" y2="34" />
    </g>
  </>,
);

// ── MatchLineHifi ──
export const MatchLineHifi = bimIconHifi(
  'MatchLineHifi',
  <>
    {/* Match line fill zone */}
    <rect
      x="4"
      y="22"
      width="40"
      height="4"
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.28)' }}
      stroke="none"
    />

    {/* Match line — bold primary */}
    <line x1="4" y1="24" x2="44" y2="24" strokeWidth={2} />

    {/* Left end cap — T terminus */}
    <line x1="4" y1="18" x2="4" y2="30" strokeWidth={2} />

    {/* Right end cap — T terminus */}
    <line x1="44" y1="18" x2="44" y2="30" strokeWidth={2} />

    {/* Triangular pointer — left side pointing right */}
    <polygon
      points="4,24 10,20 10,28"
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.55)' }}
      strokeWidth={1}
    />

    {/* Triangular pointer — right side pointing left */}
    <polygon
      points="44,24 38,20 38,28"
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.55)' }}
      strokeWidth={1}
    />

    {/* "Sheet 1" placeholder lines — above the match line */}
    <g strokeWidth={0.75} strokeOpacity={0.4}>
      <line x1="14" y1="17" x2="30" y2="17" />
      <line x1="14" y1="14" x2="26" y2="14" />
    </g>

    {/* "Sheet 2" placeholder lines — below the match line */}
    <g strokeWidth={0.75} strokeOpacity={0.4}>
      <line x1="14" y1="31" x2="30" y2="31" />
      <line x1="14" y1="34" x2="26" y2="34" />
    </g>
  </>,
);

// ── SlopeArrowHifi ──
export const SlopeArrowHifi = bimIconHifi(
  'SlopeArrowHifi',
  <>
    {/* Arrow body fill zone — thin rect along diagonal */}
    <rect
      x="10"
      y="22"
      width="30"
      height="4"
      transform="rotate(-35 24 24)"
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.22)' }}
      stroke="none"
    />

    {/* Arrow shaft — bold diagonal from lower-left to upper-right */}
    <line x1="10" y1="38" x2="36" y2="12" strokeWidth={2} />

    {/* Arrowhead at upper-right (uphill end) */}
    <polyline points="28,10 36,12 34,20" strokeWidth={2} fill="none" />

    {/* Filled circle at tail — start point / lower elevation marker */}
    <circle
      cx="10"
      cy="38"
      r="3.5"
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.75)' }}
      strokeWidth={1.5}
    />

    {/* Elevation tick marks along shaft — short perpendicular ticks */}
    <g strokeWidth={1} strokeOpacity={0.55}>
      {/* Tick 1 — lower third */}
      <line x1="16" y1="34" x2="20" y2="30" />
      {/* Tick 2 — middle */}
      <line x1="22" y1="26" x2="26" y2="22" />
      {/* Tick 3 — upper third */}
      <line x1="28" y1="20" x2="32" y2="16" />
    </g>

    {/* Slope percentage text placeholder — two lines beside midpoint */}
    <g strokeWidth={0.75} strokeOpacity={0.45}>
      <line x1="28" y1="28" x2="40" y2="30" />
      <line x1="28" y1="31" x2="38" y2="33" />
    </g>
  </>,
);
