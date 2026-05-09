/**
 * High-fidelity 48×48 BIM annotation extension icons — set A.
 *
 * CSS custom properties (set on a wrapper element):
 *   --hi-concrete / --hi-concrete-op  — structural concrete (stone gray)
 *   --hi-finish   / --hi-finish-op    — plaster, paper, annotation fill (warm white)
 *   --hi-glass    / --hi-glass-op     — glazing, transparent zones (sky blue)
 *   --hi-steel    / --hi-steel-op     — steel, metal, dimension lines (blue-gray)
 *   --hi-leaf                         — vegetation (no opacity var)
 *   --hi-room     / --hi-room-op      — interior zone fill (pale yellow)
 *   --hi-roof     / --hi-roof-op      — roof / alert color (terracotta)
 *
 * Without variables the icons render in monochrome currentColor.
 *
 * Stroke hierarchy:
 *   strokeWidth 2    — primary outlines
 *   strokeWidth 1.5  — secondary edges, reveals
 *   strokeWidth 0.75 — hatch, detail lines, text placeholders
 */
import { bimIconHifi } from './icon';

// ── AngularDimensionHifi ──
export const AngularDimensionHifi = bimIconHifi(
  'AngularDimensionHifi',
  <>
    {/* Left wall line — concrete fill strip */}
    <rect
      x="6"
      y="8"
      width="4"
      height="28"
      style={{
        fill: 'var(--hi-concrete, currentColor)',
        fillOpacity: 'var(--hi-concrete-op, 0.07)',
      }}
    />
    <line x1="6" y1="8" x2="6" y2="36" strokeWidth={2} />
    <line x1="10" y1="8" x2="10" y2="36" strokeWidth={2} />

    {/* Right wall line — angled, meeting at vertex ~(10,36) */}
    <rect
      x="10"
      y="30"
      width="28"
      height="4"
      style={{
        fill: 'var(--hi-concrete, currentColor)',
        fillOpacity: 'var(--hi-concrete-op, 0.07)',
      }}
    />
    <line x1="10" y1="30" x2="44" y2="30" strokeWidth={2} />
    <line x1="10" y1="34" x2="44" y2="34" strokeWidth={2} />

    {/* Arc dimension — steel color, from left wall upward to right wall */}
    <path
      d="M 10 18 A 18 18 0 0 1 28 30"
      strokeWidth={1.5}
      fill="none"
      style={{ stroke: 'var(--hi-steel, currentColor)' }}
    />

    {/* Arc arrow at start (10,18) pointing downward along arc */}
    <polyline
      points="7,20 10,18 13,20"
      strokeWidth={1.5}
      fill="none"
      style={{ stroke: 'var(--hi-steel, currentColor)' }}
    />
    {/* Arc arrow at end (28,30) pointing leftward along arc */}
    <polyline
      points="26,27 28,30 25,31"
      strokeWidth={1.5}
      fill="none"
      style={{ stroke: 'var(--hi-steel, currentColor)' }}
    />

    {/* Angle value text box — finish fill */}
    <rect
      x="14"
      y="10"
      width="18"
      height="10"
      rx="1.5"
      style={{
        fill: 'var(--hi-finish, currentColor)',
        fillOpacity: 'var(--hi-finish-op, 0.07)',
      }}
      strokeWidth={1}
    />
    {/* Text placeholder lines inside box */}
    <g strokeWidth={0.75} strokeOpacity={0.5}>
      <line x1="17" y1="14" x2="29" y2="14" />
      <line x1="17" y1="17" x2="26" y2="17" />
    </g>
  </>,
);

// ── RadialDimensionHifi ──
export const RadialDimensionHifi = bimIconHifi(
  'RadialDimensionHifi',
  <>
    {/* Circle fill — glass/glazing tint */}
    <circle
      cx="24"
      cy="26"
      r="16"
      style={{ fill: 'var(--hi-glass, currentColor)', fillOpacity: 'var(--hi-glass-op, 0.07)' }}
    />
    {/* Circle outline — primary */}
    <circle cx="24" cy="26" r="16" strokeWidth={2} fill="none" />

    {/* Center mark cross */}
    <g strokeWidth={1.5}>
      <line x1="22" y1="26" x2="26" y2="26" />
      <line x1="24" y1="24" x2="24" y2="28" />
    </g>

    {/* Radius dimension line from center to circle edge — steel color */}
    <line
      x1="24"
      y1="26"
      x2="38"
      y2="19"
      strokeWidth={1.5}
      style={{ stroke: 'var(--hi-steel, currentColor)' }}
    />
    {/* Arrowhead at circle edge */}
    <polyline
      points="35,18 38,19 36,22"
      strokeWidth={1.5}
      fill="none"
      style={{ stroke: 'var(--hi-steel, currentColor)' }}
    />

    {/* R value label box — finish fill */}
    <rect
      x="26"
      y="5"
      width="16"
      height="10"
      rx="1.5"
      style={{
        fill: 'var(--hi-finish, currentColor)',
        fillOpacity: 'var(--hi-finish-op, 0.07)',
      }}
      strokeWidth={1}
    />
    {/* Leader from label to dimension line */}
    <line
      x1="31"
      y1="15"
      x2="32"
      y2="19"
      strokeWidth={0.75}
      style={{ stroke: 'var(--hi-steel, currentColor)' }}
    />
    {/* Text placeholder lines in label */}
    <g strokeWidth={0.75} strokeOpacity={0.5}>
      <line x1="29" y1="9" x2="40" y2="9" />
      <line x1="29" y1="12" x2="38" y2="12" />
    </g>
  </>,
);

// ── ArcLengthDimensionHifi ──
export const ArcLengthDimensionHifi = bimIconHifi(
  'ArcLengthDimensionHifi',
  <>
    {/* Arc wall segment fill — concrete */}
    <path d="M 8 38 A 22 22 0 0 1 40 38" strokeWidth={2} fill="none" />
    {/* Concrete fill band behind arc */}
    <path
      d="M 8 38 A 22 22 0 0 1 40 38 A 20 20 0 0 0 10 38 Z"
      style={{
        fill: 'var(--hi-concrete, currentColor)',
        fillOpacity: 'var(--hi-concrete-op, 0.07)',
      }}
      stroke="none"
    />

    {/* Arc dimension line parallel above — steel */}
    <path
      d="M 10 30 A 18 18 0 0 1 38 30"
      strokeWidth={1.5}
      fill="none"
      style={{ stroke: 'var(--hi-steel, currentColor)' }}
    />

    {/* Tick marks at ends of dimension arc */}
    <line
      x1="8"
      y1="38"
      x2="10"
      y2="30"
      strokeWidth={1}
      style={{ stroke: 'var(--hi-steel, currentColor)' }}
    />
    <line
      x1="40"
      y1="38"
      x2="38"
      y2="30"
      strokeWidth={1}
      style={{ stroke: 'var(--hi-steel, currentColor)' }}
    />

    {/* Length label box — finish fill */}
    <rect
      x="15"
      y="10"
      width="18"
      height="11"
      rx="1.5"
      style={{
        fill: 'var(--hi-finish, currentColor)',
        fillOpacity: 'var(--hi-finish-op, 0.07)',
      }}
      strokeWidth={1}
    />
    {/* Leader from label down to arc dimension */}
    <line
      x1="24"
      y1="21"
      x2="24"
      y2="30"
      strokeWidth={0.75}
      style={{ stroke: 'var(--hi-steel, currentColor)' }}
    />
    {/* Text placeholder lines */}
    <g strokeWidth={0.75} strokeOpacity={0.5}>
      <line x1="18" y1="14" x2="30" y2="14" />
      <line x1="18" y1="17" x2="28" y2="17" />
    </g>
  </>,
);

// ── OrdinalDimensionHifi ──
export const OrdinalDimensionHifi = bimIconHifi(
  'OrdinalDimensionHifi',
  <>
    {/* Datum baseline — bold steel line */}
    <line
      x1="4"
      y1="42"
      x2="44"
      y2="42"
      strokeWidth={2}
      style={{ stroke: 'var(--hi-steel, currentColor)' }}
    />

    {/* Tick 1 — leftmost, short ordinate */}
    <line x1="10" y1="42" x2="10" y2="32" strokeWidth={1.5} />
    {/* Ordinate value box 1 — finish fill */}
    <rect
      x="4"
      y="22"
      width="12"
      height="9"
      rx="1"
      style={{
        fill: 'var(--hi-finish, currentColor)',
        fillOpacity: 'var(--hi-finish-op, 0.07)',
      }}
      strokeWidth={0.75}
    />
    <line x1="10" y1="31" x2="10" y2="32" strokeWidth={1} />
    <g strokeWidth={0.75} strokeOpacity={0.45}>
      <line x1="6" y1="25" x2="14" y2="25" />
      <line x1="6" y1="28" x2="13" y2="28" />
    </g>

    {/* Tick 2 — middle, medium ordinate */}
    <line x1="24" y1="42" x2="24" y2="22" strokeWidth={1.5} />
    {/* Ordinate value box 2 — finish fill */}
    <rect
      x="18"
      y="12"
      width="12"
      height="9"
      rx="1"
      style={{
        fill: 'var(--hi-finish, currentColor)',
        fillOpacity: 'var(--hi-finish-op, 0.07)',
      }}
      strokeWidth={0.75}
    />
    <line x1="24" y1="21" x2="24" y2="22" strokeWidth={1} />
    <g strokeWidth={0.75} strokeOpacity={0.45}>
      <line x1="20" y1="15" x2="28" y2="15" />
      <line x1="20" y1="18" x2="27" y2="18" />
    </g>

    {/* Tick 3 — rightmost, tallest ordinate */}
    <line x1="38" y1="42" x2="38" y2="12" strokeWidth={1.5} />
    {/* Ordinate value box 3 — finish fill */}
    <rect
      x="32"
      y="4"
      width="12"
      height="9"
      rx="1"
      style={{
        fill: 'var(--hi-finish, currentColor)',
        fillOpacity: 'var(--hi-finish-op, 0.07)',
      }}
      strokeWidth={0.75}
    />
    <line x1="38" y1="12" x2="38" y2="13" strokeWidth={1} />
    <g strokeWidth={0.75} strokeOpacity={0.45}>
      <line x1="34" y1="7" x2="42" y2="7" />
      <line x1="34" y1="10" x2="41" y2="10" />
    </g>
  </>,
);

// ── SpotCoordinateHifi ──
export const SpotCoordinateHifi = bimIconHifi(
  'SpotCoordinateHifi',
  <>
    {/* Floor level slab — concrete fill */}
    <rect
      x="4"
      y="36"
      width="40"
      height="6"
      style={{
        fill: 'var(--hi-concrete, currentColor)',
        fillOpacity: 'var(--hi-concrete-op, 0.07)',
      }}
    />
    <line x1="4" y1="36" x2="44" y2="36" strokeWidth={2} />
    <line x1="4" y1="42" x2="44" y2="42" strokeWidth={1} />

    {/* Crosshair center marker on floor surface */}
    <g strokeWidth={1.5}>
      <line x1="22" y1="36" x2="26" y2="36" />
      <line x1="24" y1="34" x2="24" y2="38" />
    </g>

    {/* Coordinate tag — finish fill rectangle */}
    <rect
      x="6"
      y="6"
      width="36"
      height="26"
      rx="2"
      style={{
        fill: 'var(--hi-finish, currentColor)',
        fillOpacity: 'var(--hi-finish-op, 0.07)',
      }}
      strokeWidth={1.5}
    />

    {/* Leader from tag bottom to crosshair on floor */}
    <line x1="24" y1="32" x2="24" y2="36" strokeWidth={1} />

    {/* X / Y / Z value lines inside tag */}
    <g strokeWidth={0.75} strokeOpacity={0.5}>
      {/* X row */}
      <line x1="10" y1="12" x2="13" y2="12" />
      <line x1="15" y1="12" x2="38" y2="12" />
      {/* Y row */}
      <line x1="10" y1="17" x2="13" y2="17" />
      <line x1="15" y1="17" x2="36" y2="17" />
      {/* Z row */}
      <line x1="10" y1="22" x2="13" y2="22" />
      <line x1="15" y1="22" x2="34" y2="22" />
      {/* Divider lines */}
      <line x1="9" y1="14" x2="39" y2="14" strokeOpacity={0.25} />
      <line x1="9" y1="19" x2="39" y2="19" strokeOpacity={0.25} />
    </g>
  </>,
);

// ── ElevationTagHifi ──
export const ElevationTagHifi = bimIconHifi(
  'ElevationTagHifi',
  <>
    {/* Target surface — concrete wall edge */}
    <rect
      x="4"
      y="8"
      width="6"
      height="32"
      style={{
        fill: 'var(--hi-concrete, currentColor)',
        fillOpacity: 'var(--hi-concrete-op, 0.07)',
      }}
    />
    <line x1="4" y1="8" x2="4" y2="40" strokeWidth={2} />
    <line x1="10" y1="8" x2="10" y2="40" strokeWidth={2} />

    {/* Leader arrow from tag to surface */}
    <line x1="18" y1="24" x2="10" y2="24" strokeWidth={1.5} />
    <polyline points="13,22 10,24 13,26" strokeWidth={1.5} fill="none" />

    {/* Circle tag — finish fill split by horizontal line */}
    <circle
      cx="30"
      cy="24"
      r="14"
      style={{
        fill: 'var(--hi-finish, currentColor)',
        fillOpacity: 'var(--hi-finish-op, 0.07)',
      }}
      strokeWidth={2}
    />

    {/* Horizontal split line */}
    <line x1="16" y1="24" x2="44" y2="24" strokeWidth={1.5} />

    {/* Crosshair at center of circle */}
    <g strokeWidth={1}>
      <line x1="28" y1="24" x2="32" y2="24" />
      <line x1="30" y1="22" x2="30" y2="26" />
    </g>

    {/* Elevation value above center line */}
    <g strokeWidth={0.75} strokeOpacity={0.5}>
      <line x1="19" y1="18" x2="41" y2="18" />
      <line x1="19" y1="21" x2="38" y2="21" />
    </g>

    {/* Elevation value below center line */}
    <g strokeWidth={0.75} strokeOpacity={0.4}>
      <line x1="19" y1="27" x2="39" y2="27" />
      <line x1="19" y1="30" x2="36" y2="30" />
    </g>
  </>,
);

// ── FilledRegionHifi ──
export const FilledRegionHifi = bimIconHifi(
  'FilledRegionHifi',
  <>
    {/* Closed polygonal region fill — room color */}
    <polygon
      points="6,10 42,10 42,38 30,44 6,44"
      style={{ fill: 'var(--hi-room, currentColor)', fillOpacity: 'var(--hi-room-op, 0.07)' }}
    />

    {/* Bold boundary outline */}
    <polygon points="6,10 42,10 42,38 30,44 6,44" strokeWidth={2} fill="none" />

    {/* Hatch pattern — diagonal lines at 45° clipped inside polygon */}
    <g strokeWidth={0.75} strokeOpacity={0.35}>
      <line x1="6" y1="16" x2="12" y2="10" />
      <line x1="6" y1="24" x2="20" y2="10" />
      <line x1="6" y1="32" x2="28" y2="10" />
      <line x1="6" y1="40" x2="36" y2="10" />
      <line x1="6" y1="44" x2="42" y2="10" />
      <line x1="12" y1="44" x2="42" y2="16" />
      <line x1="20" y1="44" x2="42" y2="24" />
      <line x1="28" y1="44" x2="42" y2="32" />
      <line x1="30" y1="44" x2="42" y2="34" />
    </g>

    {/* Fill type label box — finish fill */}
    <rect
      x="8"
      y="12"
      width="20"
      height="9"
      rx="1"
      style={{
        fill: 'var(--hi-finish, currentColor)',
        fillOpacity: 'var(--hi-finish-op, 0.07)',
      }}
      strokeWidth={0.75}
    />
    <g strokeWidth={0.75} strokeOpacity={0.5}>
      <line x1="10" y1="15" x2="26" y2="15" />
      <line x1="10" y1="18" x2="23" y2="18" />
    </g>
  </>,
);

// ── MaskingRegionHifi ──
export const MaskingRegionHifi = bimIconHifi(
  'MaskingRegionHifi',
  <>
    {/* Floor plan geometry beneath — concrete lines (visible outside mask) */}
    <g strokeWidth={1} strokeOpacity={0.55}>
      <line x1="4" y1="14" x2="44" y2="14" />
      <line x1="4" y1="22" x2="44" y2="22" />
      <line x1="4" y1="30" x2="44" y2="30" />
      <line x1="4" y1="38" x2="44" y2="38" />
      <line x1="12" y1="10" x2="12" y2="44" />
      <line x1="24" y1="10" x2="24" y2="44" />
      <line x1="36" y1="10" x2="36" y2="44" />
    </g>

    {/* Masking polygon — finish fill (opaque, hides geometry inside) */}
    <polygon
      points="10,8 40,8 40,40 22,44 10,40"
      style={{
        fill: 'var(--hi-finish, currentColor)',
        fillOpacity: 'var(--hi-finish-op, 0.07)',
      }}
    />

    {/* Bold masking boundary */}
    <polygon points="10,8 40,8 40,40 22,44 10,40" strokeWidth={2} fill="none" />

    {/* Dashed inner boundary to show masking intent */}
    <polygon
      points="13,11 37,11 37,37 22,41 13,37"
      strokeWidth={0.75}
      strokeDasharray="3 2"
      fill="none"
      strokeOpacity={0.45}
    />
  </>,
);

// ── DetailComponentHifi ──
export const DetailComponentHifi = bimIconHifi(
  'DetailComponentHifi',
  <>
    {/* Bolt head — steel fill, hexagonal approximation */}
    <polygon
      points="24,6 30,10 30,18 24,22 18,18 18,10"
      style={{
        fill: 'var(--hi-steel, currentColor)',
        fillOpacity: 'var(--hi-steel-op, 0.07)',
      }}
      strokeWidth={2}
    />

    {/* Inner hex detail */}
    <polygon
      points="24,9 28,12 28,16 24,19 20,16 20,12"
      strokeWidth={0.75}
      fill="none"
      strokeOpacity={0.5}
    />

    {/* Bolt shaft — concrete fill */}
    <rect
      x="21"
      y="22"
      width="6"
      height="16"
      style={{
        fill: 'var(--hi-concrete, currentColor)',
        fillOpacity: 'var(--hi-concrete-op, 0.07)',
      }}
      strokeWidth={1.5}
    />

    {/* Shaft thread hatch lines */}
    <g strokeWidth={0.75} strokeOpacity={0.4}>
      <line x1="21" y1="24" x2="27" y2="24" />
      <line x1="21" y1="27" x2="27" y2="27" />
      <line x1="21" y1="30" x2="27" y2="30" />
      <line x1="21" y1="33" x2="27" y2="33" />
      <line x1="21" y1="36" x2="27" y2="36" />
    </g>

    {/* Nut — steel fill */}
    <rect
      x="19"
      y="38"
      width="10"
      height="5"
      rx="1"
      style={{
        fill: 'var(--hi-steel, currentColor)',
        fillOpacity: 'var(--hi-steel-op, 0.07)',
      }}
      strokeWidth={1.5}
    />

    {/* Cut section hatch outside bolt head — indicating cross-section */}
    <g strokeWidth={0.75} strokeOpacity={0.35}>
      <line x1="6" y1="8" x2="18" y2="8" />
      <line x1="6" y1="12" x2="18" y2="12" />
      <line x1="6" y1="16" x2="18" y2="16" />
      <line x1="30" y1="8" x2="42" y2="8" />
      <line x1="30" y1="12" x2="42" y2="12" />
      <line x1="30" y1="16" x2="42" y2="16" />
    </g>
  </>,
);

// ── RepeatingDetailHifi ──
export const RepeatingDetailHifi = bimIconHifi(
  'RepeatingDetailHifi',
  <>
    {/* Repeat boundary — dashed rectangle showing repeat region */}
    <rect
      x="4"
      y="10"
      width="40"
      height="30"
      strokeWidth={1}
      strokeDasharray="4 2.5"
      fill="none"
      strokeOpacity={0.6}
    />

    {/* Instance 1 — leftmost detail component (steel fill small bolt head) */}
    <rect
      x="7"
      y="15"
      width="8"
      height="10"
      rx="1"
      style={{
        fill: 'var(--hi-steel, currentColor)',
        fillOpacity: 'var(--hi-steel-op, 0.07)',
      }}
      strokeWidth={1.5}
    />
    <line x1="11" y1="25" x2="11" y2="33" strokeWidth={1.5} />
    <rect x="9" y="33" width="4" height="3" strokeWidth={1} fill="none" />

    {/* Instance 2 — middle (primary) */}
    <rect
      x="20"
      y="15"
      width="8"
      height="10"
      rx="1"
      style={{
        fill: 'var(--hi-steel, currentColor)',
        fillOpacity: 'var(--hi-steel-op, 0.07)',
      }}
      strokeWidth={2}
    />
    <line x1="24" y1="25" x2="24" y2="33" strokeWidth={2} />
    <rect x="22" y="33" width="4" height="3" strokeWidth={1.5} fill="none" />

    {/* Instance 3 — rightmost */}
    <rect
      x="33"
      y="15"
      width="8"
      height="10"
      rx="1"
      style={{
        fill: 'var(--hi-steel, currentColor)',
        fillOpacity: 'var(--hi-steel-op, 0.07)',
      }}
      strokeWidth={1.5}
    />
    <line x1="37" y1="25" x2="37" y2="33" strokeWidth={1.5} />
    <rect x="35" y="33" width="4" height="3" strokeWidth={1} fill="none" />

    {/* Repeat spacing arrows */}
    <g strokeWidth={1} style={{ stroke: 'var(--hi-steel, currentColor)' }}>
      {/* Arrow between instance 1 and 2 */}
      <line x1="15" y1="8" x2="20" y2="8" />
      <polyline points="17,6 15,8 17,10" fill="none" />
      <polyline points="18,6 20,8 18,10" fill="none" />
      {/* Arrow between instance 2 and 3 */}
      <line x1="28" y1="8" x2="33" y2="8" />
      <polyline points="30,6 28,8 30,10" fill="none" />
      <polyline points="31,6 33,8 31,10" fill="none" />
    </g>
  </>,
);

// ── InsulationAnnotationHifi ──
export const InsulationAnnotationHifi = bimIconHifi(
  'InsulationAnnotationHifi',
  <>
    {/* Outer concrete layer — left */}
    <rect
      x="4"
      y="8"
      width="7"
      height="36"
      style={{
        fill: 'var(--hi-concrete, currentColor)',
        fillOpacity: 'var(--hi-concrete-op, 0.07)',
      }}
    />
    <line x1="4" y1="8" x2="4" y2="44" strokeWidth={2} />
    <line x1="11" y1="8" x2="11" y2="44" strokeWidth={2} />

    {/* Outer concrete layer — right */}
    <rect
      x="37"
      y="8"
      width="7"
      height="36"
      style={{
        fill: 'var(--hi-concrete, currentColor)',
        fillOpacity: 'var(--hi-concrete-op, 0.07)',
      }}
    />
    <line x1="37" y1="8" x2="37" y2="44" strokeWidth={2} />
    <line x1="44" y1="8" x2="44" y2="44" strokeWidth={2} />

    {/* Insulation fill zone — finish fill */}
    <rect
      x="11"
      y="8"
      width="26"
      height="36"
      style={{
        fill: 'var(--hi-finish, currentColor)',
        fillOpacity: 'var(--hi-finish-op, 0.07)',
      }}
      stroke="none"
    />

    {/* Wavy/bubble insulation pattern — rows of arcs */}
    <g strokeWidth={0.75} strokeOpacity={0.5}>
      {/* Row 1 */}
      <path
        d="M 11 14 Q 14 11 17 14 Q 20 17 23 14 Q 26 11 29 14 Q 32 17 35 14 L 37 14"
        fill="none"
      />
      {/* Row 2 */}
      <path
        d="M 11 20 Q 14 17 17 20 Q 20 23 23 20 Q 26 17 29 20 Q 32 23 35 20 L 37 20"
        fill="none"
      />
      {/* Row 3 */}
      <path
        d="M 11 26 Q 14 23 17 26 Q 20 29 23 26 Q 26 23 29 26 Q 32 29 35 26 L 37 26"
        fill="none"
      />
      {/* Row 4 */}
      <path
        d="M 11 32 Q 14 29 17 32 Q 20 35 23 32 Q 26 29 29 32 Q 32 35 35 32 L 37 32"
        fill="none"
      />
      {/* Row 5 */}
      <path
        d="M 11 38 Q 14 35 17 38 Q 20 41 23 38 Q 26 35 29 38 Q 32 41 35 38 L 37 38"
        fill="none"
      />
    </g>

    {/* Thermal break dashes — center horizontal dash lines */}
    <g strokeWidth={1} strokeDasharray="2 2" strokeOpacity={0.45}>
      <line x1="11" y1="8" x2="37" y2="8" />
      <line x1="11" y1="44" x2="37" y2="44" />
    </g>
  </>,
);
