/**
 * High-fidelity 48×48 BIM annotation icons — extended set B.
 *
 * CSS custom properties (set on a wrapper element):
 *   --hi-concrete / --hi-concrete-op  — structural concrete (stone gray)
 *   --hi-finish   / --hi-finish-op    — paper, annotation fill (warm off-white)
 *   --hi-glass    / --hi-glass-op     — transparent zones (sky blue)
 *   --hi-steel    / --hi-steel-op     — metal markers, frames (blue-gray)
 *   --hi-leaf                         — vegetation (amber-brown), no opacity var
 *   --hi-room     / --hi-room-op      — interior zone (pale yellow)
 *   --hi-roof     / --hi-roof-op      — boundaries, alerts (terracotta red)
 *
 * Without variables the icons render in monochrome currentColor.
 *
 * Stroke hierarchy:
 *   strokeWidth 2    — primary outlines
 *   strokeWidth 1.5  — secondary edges, reveals
 *   strokeWidth 0.75 — hatch, detail lines
 */
import { bimIconHifi } from './icon';

// ── TextAnnotationHifi — text balloon/callout with leader line ──────────────────
export const TextAnnotationHifi = bimIconHifi(
  'TextAnnotationHifi',
  <>
    {/* Callout balloon fill — finish/paper */}
    <rect
      x="4"
      y="4"
      width="34"
      height="26"
      rx="3"
      ry="3"
      style={{ fill: 'var(--hi-finish, currentColor)', fillOpacity: 'var(--hi-finish-op, 0.90)' }}
    />

    {/* Balloon outline — primary */}
    <rect x="4" y="4" width="34" height="26" rx="3" ry="3" strokeWidth={2} fill="none" />

    {/* Text lines inside balloon */}
    <g strokeWidth={0.75} strokeOpacity={0.55}>
      <line x1="9" y1="11" x2="33" y2="11" />
      <line x1="9" y1="15" x2="33" y2="15" />
      <line x1="9" y1="19" x2="28" y2="19" />
    </g>

    {/* Underline on first text line */}
    <line x1="9" y1="12.5" x2="22" y2="12.5" strokeWidth={0.75} strokeOpacity={0.35} />

    {/* Leader pointer — triangular notch at bottom-left of balloon */}
    <polyline points="10,30 8,38 16,30" strokeWidth={1.5} fill="none" />

    {/* Concrete element being annotated — small rectangle at arrow tip */}
    <rect
      x="2"
      y="38"
      width="14"
      height="6"
      rx="1"
      style={{
        fill: 'var(--hi-concrete, currentColor)',
        fillOpacity: 'var(--hi-concrete-op, 0.25)',
      }}
      strokeWidth={1.5}
    />

    {/* Concrete hatch on target element */}
    <g strokeWidth={0.75} strokeOpacity={0.3}>
      <line x1="2" y1="41" x2="5" y2="38" />
      <line x1="5" y1="44" x2="10" y2="38" />
      <line x1="10" y1="44" x2="15" y2="38" />
    </g>
  </>,
);

// ── MultiCategoryTagHifi — tag rectangle with multiple data rows ─────────────────
export const MultiCategoryTagHifi = bimIconHifi(
  'MultiCategoryTagHifi',
  <>
    {/* Tag rectangle fill — finish/paper */}
    <rect
      x="6"
      y="4"
      width="36"
      height="32"
      rx="2"
      ry="2"
      style={{ fill: 'var(--hi-finish, currentColor)', fillOpacity: 'var(--hi-finish-op, 0.90)' }}
    />

    {/* Tag outline — primary */}
    <rect x="6" y="4" width="36" height="32" rx="2" ry="2" strokeWidth={2} fill="none" />

    {/* Divider after header row */}
    <line x1="6" y1="13" x2="42" y2="13" strokeWidth={1} strokeOpacity={0.5} />

    {/* Header text placeholder */}
    <line x1="10" y1="9.5" x2="38" y2="9.5" strokeWidth={1.5} strokeOpacity={0.55} />

    {/* Row 1 — material row: steel dot prefix + text */}
    <circle
      cx="11"
      cy="18"
      r="2"
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.75)' }}
      stroke="none"
    />
    <line x1="15" y1="18" x2="38" y2="18" strokeWidth={0.75} strokeOpacity={0.5} />

    {/* Row 2 — type row: steel dot prefix + text */}
    <circle
      cx="11"
      cy="24"
      r="2"
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.75)' }}
      stroke="none"
    />
    <line x1="15" y1="24" x2="36" y2="24" strokeWidth={0.75} strokeOpacity={0.5} />

    {/* Row 3 — level row: steel dot prefix + shorter text */}
    <circle
      cx="11"
      cy="30"
      r="2"
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.75)' }}
      stroke="none"
    />
    <line x1="15" y1="30" x2="32" y2="30" strokeWidth={0.75} strokeOpacity={0.5} />

    {/* Leader line from bottom-center with arrowhead */}
    <line x1="24" y1="36" x2="24" y2="44" strokeWidth={1.5} />
    <polyline points="21,41 24,44 27,41" strokeWidth={1.5} fill="none" />
  </>,
);

// ── MaterialTagHifi — material swatch zones with tag bubble + leader ────────────
export const MaterialTagHifi = bimIconHifi(
  'MaterialTagHifi',
  <>
    {/* Material region — concrete zone (left) */}
    <rect
      x="4"
      y="28"
      width="12"
      height="16"
      style={{
        fill: 'var(--hi-concrete, currentColor)',
        fillOpacity: 'var(--hi-concrete-op, 0.28)',
      }}
      strokeWidth={1.5}
    />
    {/* Concrete hatch */}
    <g strokeWidth={0.75} strokeOpacity={0.3}>
      <line x1="4" y1="36" x2="10" y2="28" />
      <line x1="4" y1="42" x2="16" y2="30" />
      <line x1="10" y1="44" x2="16" y2="38" />
    </g>

    {/* Material region — finish zone (center) */}
    <rect
      x="16"
      y="28"
      width="10"
      height="16"
      style={{
        fill: 'var(--hi-finish, currentColor)',
        fillOpacity: 'var(--hi-finish-op, 0.75)',
      }}
      strokeWidth={1.5}
    />

    {/* Material region — steel zone (right) */}
    <rect
      x="26"
      y="28"
      width="18"
      height="16"
      style={{
        fill: 'var(--hi-steel, currentColor)',
        fillOpacity: 'var(--hi-steel-op, 0.18)',
      }}
      strokeWidth={1.5}
    />
    {/* Steel diagonal hatch */}
    <g strokeWidth={0.75} strokeOpacity={0.3}>
      <line x1="28" y1="28" x2="44" y2="44" />
      <line x1="34" y1="28" x2="44" y2="38" />
      <line x1="26" y1="34" x2="36" y2="44" />
    </g>

    {/* Tag bubble at top — finish fill */}
    <rect
      x="10"
      y="6"
      width="28"
      height="14"
      rx="2"
      ry="2"
      style={{
        fill: 'var(--hi-finish, currentColor)',
        fillOpacity: 'var(--hi-finish-op, 0.90)',
      }}
      strokeWidth={2}
    />

    {/* Tag text placeholder lines */}
    <line x1="13" y1="11" x2="35" y2="11" strokeWidth={1.5} strokeOpacity={0.55} />
    <line x1="13" y1="15" x2="30" y2="15" strokeWidth={0.75} strokeOpacity={0.4} />

    {/* Leader line from tag to material region */}
    <line x1="24" y1="20" x2="24" y2="28" strokeWidth={1.5} />
    <circle cx="24" cy="28" r="1.5" fill="currentColor" stroke="none" />
  </>,
);

// ── RoomTagHifi — room interior with centered tag + concrete walls ───────────────
export const RoomTagHifi = bimIconHifi(
  'RoomTagHifi',
  <>
    {/* Room interior fill */}
    <rect
      x="4"
      y="4"
      width="40"
      height="40"
      style={{ fill: 'var(--hi-room, currentColor)', fillOpacity: 'var(--hi-room-op, 0.25)' }}
      stroke="none"
    />

    {/* Concrete walls — top */}
    <rect
      x="2"
      y="2"
      width="44"
      height="4"
      style={{
        fill: 'var(--hi-concrete, currentColor)',
        fillOpacity: 'var(--hi-concrete-op, 0.45)',
      }}
      stroke="none"
    />
    {/* Concrete walls — bottom */}
    <rect
      x="2"
      y="42"
      width="44"
      height="4"
      style={{
        fill: 'var(--hi-concrete, currentColor)',
        fillOpacity: 'var(--hi-concrete-op, 0.45)',
      }}
      stroke="none"
    />
    {/* Concrete walls — left */}
    <rect
      x="2"
      y="2"
      width="4"
      height="44"
      style={{
        fill: 'var(--hi-concrete, currentColor)',
        fillOpacity: 'var(--hi-concrete-op, 0.45)',
      }}
      stroke="none"
    />
    {/* Concrete walls — right */}
    <rect
      x="42"
      y="2"
      width="4"
      height="44"
      style={{
        fill: 'var(--hi-concrete, currentColor)',
        fillOpacity: 'var(--hi-concrete-op, 0.45)',
      }}
      stroke="none"
    />

    {/* Wall outlines */}
    <rect x="2" y="2" width="44" height="44" strokeWidth={2} fill="none" />
    <rect x="6" y="6" width="36" height="36" strokeWidth={1} fill="none" strokeOpacity={0.4} />

    {/* Central tag rectangle — finish fill */}
    <rect
      x="12"
      y="16"
      width="24"
      height="16"
      rx="2"
      ry="2"
      style={{
        fill: 'var(--hi-finish, currentColor)',
        fillOpacity: 'var(--hi-finish-op, 0.92)',
      }}
      strokeWidth={1.5}
    />

    {/* Room number line (larger) */}
    <line x1="16" y1="21" x2="32" y2="21" strokeWidth={1.5} strokeOpacity={0.6} />
    {/* Room name line (smaller) */}
    <line x1="16" y1="26" x2="28" y2="26" strokeWidth={0.75} strokeOpacity={0.45} />
  </>,
);

// ── SpaceTagHifi — open space area with MEP boundary + tag bubble ────────────────
export const SpaceTagHifi = bimIconHifi(
  'SpaceTagHifi',
  <>
    {/* Space area fill — glass/transparent */}
    <rect
      x="4"
      y="4"
      width="40"
      height="36"
      rx="1"
      style={{ fill: 'var(--hi-glass, currentColor)', fillOpacity: 'var(--hi-glass-op, 0.14)' }}
      stroke="none"
    />

    {/* MEP space boundary — dashed */}
    <rect
      x="4"
      y="4"
      width="40"
      height="36"
      rx="1"
      strokeWidth={1.5}
      strokeDasharray="5 3"
      fill="none"
    />

    {/* Interior MEP diffuser/grille symbol — center top */}
    <g strokeWidth={0.75} strokeOpacity={0.45}>
      <rect x="19" y="7" width="10" height="5" fill="none" />
      <line x1="21" y1="7" x2="21" y2="12" />
      <line x1="24" y1="7" x2="24" y2="12" />
      <line x1="27" y1="7" x2="27" y2="12" />
    </g>

    {/* Tag bubble — finish fill, centered lower portion */}
    <rect
      x="10"
      y="22"
      width="28"
      height="14"
      rx="2"
      ry="2"
      style={{
        fill: 'var(--hi-finish, currentColor)',
        fillOpacity: 'var(--hi-finish-op, 0.92)',
      }}
      strokeWidth={1.5}
    />

    {/* Air volume value placeholder */}
    <line x1="13" y1="27" x2="35" y2="27" strokeWidth={1.5} strokeOpacity={0.55} />
    {/* Area value placeholder */}
    <line x1="13" y1="31" x2="30" y2="31" strokeWidth={0.75} strokeOpacity={0.4} />

    {/* Dashed arrow from diffuser to space center suggesting air flow */}
    <line
      x1="24"
      y1="14"
      x2="24"
      y2="22"
      strokeWidth={0.75}
      strokeDasharray="2 2"
      strokeOpacity={0.45}
    />
    <polyline points="22,20 24,22 26,20" strokeWidth={0.75} fill="none" strokeOpacity={0.45} />

    {/* Bottom area boundary */}
    <line x1="4" y1="40" x2="44" y2="40" strokeWidth={0.75} strokeOpacity={0.35} />
  </>,
);

// ── AreaTagHifi — area region with area tag + boundary + perimeter dimension ─────
export const AreaTagHifi = bimIconHifi(
  'AreaTagHifi',
  <>
    {/* Area region fill — room/pale yellow */}
    <polygon
      points="4,44 4,10 36,4 44,18 44,44"
      style={{ fill: 'var(--hi-room, currentColor)', fillOpacity: 'var(--hi-room-op, 0.22)' }}
      stroke="none"
    />

    {/* Area boundary line — primary outline */}
    <polygon points="4,44 4,10 36,4 44,18 44,44" strokeWidth={2} fill="none" />

    {/* Area tag rectangle — finish fill */}
    <rect
      x="12"
      y="20"
      width="24"
      height="12"
      rx="2"
      ry="2"
      style={{
        fill: 'var(--hi-finish, currentColor)',
        fillOpacity: 'var(--hi-finish-op, 0.92)',
      }}
      strokeWidth={1.5}
    />

    {/* sqm value placeholder — prominent */}
    <line x1="15" y1="24.5" x2="33" y2="24.5" strokeWidth={1.5} strokeOpacity={0.6} />
    {/* Unit label placeholder */}
    <line x1="15" y1="28.5" x2="28" y2="28.5" strokeWidth={0.75} strokeOpacity={0.4} />

    {/* Perimeter dimension tick marks — bottom edge */}
    <g strokeWidth={0.75} strokeOpacity={0.5}>
      <line x1="4" y1="46" x2="4" y2="44" />
      <line x1="44" y1="46" x2="44" y2="44" />
      <line x1="4" y1="47" x2="44" y2="47" />
      {/* Midpoint tick */}
      <line x1="24" y1="46" x2="24" y2="47" />
    </g>

    {/* Dimension text placeholder */}
    <line x1="14" y1="45.5" x2="22" y2="45.5" strokeWidth={0.75} strokeOpacity={0.35} />
  </>,
);

// ── StairTagHifi — stair plan view with tag bubble + UP annotation ───────────────
export const StairTagHifi = bimIconHifi(
  'StairTagHifi',
  <>
    {/* Stair housing fill — subtle concrete */}
    <rect
      x="4"
      y="6"
      width="26"
      height="38"
      style={{
        fill: 'var(--hi-concrete, currentColor)',
        fillOpacity: 'var(--hi-concrete-op, 0.09)',
      }}
      stroke="none"
    />

    {/* Stair treads — horizontal lines (plan view) */}
    <g strokeWidth={1.5}>
      <line x1="4" y1="11" x2="30" y2="11" />
      <line x1="4" y1="16" x2="30" y2="16" />
      <line x1="4" y1="21" x2="30" y2="21" />
      <line x1="4" y1="26" x2="30" y2="26" />
      <line x1="4" y1="31" x2="30" y2="31" />
      <line x1="4" y1="36" x2="30" y2="36" />
    </g>

    {/* Stair housing outline */}
    <rect x="4" y="6" width="26" height="38" strokeWidth={2} fill="none" />

    {/* Cut / break line — diagonal across stair */}
    <line
      x1="4"
      y1="24"
      x2="30"
      y2="24"
      strokeWidth={0.75}
      strokeDasharray="4 2"
      strokeOpacity={0.6}
    />

    {/* UP arrow on first riser area */}
    <line x1="17" y1="40" x2="17" y2="28" strokeWidth={1} strokeOpacity={0.55} />
    <polyline points="14.5,31 17,28 19.5,31" strokeWidth={1} fill="none" strokeOpacity={0.55} />

    {/* Tag bubble — finish fill, upper right */}
    <rect
      x="30"
      y="8"
      width="16"
      height="14"
      rx="2"
      ry="2"
      style={{
        fill: 'var(--hi-finish, currentColor)',
        fillOpacity: 'var(--hi-finish-op, 0.92)',
      }}
      strokeWidth={1.5}
    />

    {/* Stair number placeholder lines */}
    <line x1="33" y1="13" x2="43" y2="13" strokeWidth={1.5} strokeOpacity={0.6} />
    <line x1="33" y1="17" x2="41" y2="17" strokeWidth={0.75} strokeOpacity={0.4} />

    {/* Leader from tag to stair */}
    <line x1="30" y1="15" x2="4" y2="15" strokeWidth={0.75} strokeOpacity={0.35} />
  </>,
);

// ── SymbolHifi — architectural symbol sheet: door + window symbols ───────────────
export const SymbolHifi = bimIconHifi(
  'SymbolHifi',
  <>
    {/* Symbol sheet background — finish fill */}
    <rect
      x="4"
      y="4"
      width="40"
      height="40"
      rx="2"
      ry="2"
      style={{
        fill: 'var(--hi-finish, currentColor)',
        fillOpacity: 'var(--hi-finish-op, 0.85)',
      }}
      strokeWidth={2}
    />

    {/* Divider line splitting sheet into two halves */}
    <line x1="24" y1="4" x2="24" y2="44" strokeWidth={1} strokeOpacity={0.3} />

    {/* ── Door symbol — left half ── */}
    {/* Door frame/wall opening */}
    <g strokeWidth={1.5} style={{ stroke: 'var(--hi-concrete, currentColor)' }}>
      <line x1="8" y1="14" x2="8" y2="38" />
      <line x1="8" y1="14" x2="20" y2="14" />
    </g>

    {/* Door panel — thin rectangle */}
    <rect
      x="8"
      y="14"
      width="2"
      height="14"
      style={{
        fill: 'var(--hi-concrete, currentColor)',
        fillOpacity: 'var(--hi-concrete-op, 0.50)',
      }}
      stroke="none"
    />
    <rect x="8" y="14" width="2" height="14" strokeWidth={1} fill="none" />

    {/* Door swing arc — quarter circle */}
    <path d="M 10,14 A 14,14 0 0 1 8,28" strokeWidth={1} fill="none" strokeDasharray="3 2" />

    {/* ── Window symbol — right half ── */}
    {/* Window outer frame — steel */}
    <rect
      x="27"
      y="17"
      width="13"
      height="14"
      style={{
        fill: 'var(--hi-steel, currentColor)',
        fillOpacity: 'var(--hi-steel-op, 0.10)',
        stroke: 'var(--hi-steel, currentColor)',
      }}
      strokeWidth={1.5}
    />
    {/* Window center glazing lines — two parallel horizontal lines */}
    <g strokeWidth={1.5} style={{ stroke: 'var(--hi-steel, currentColor)' }}>
      <line x1="27" y1="22" x2="40" y2="22" />
      <line x1="27" y1="26" x2="40" y2="26" />
    </g>

    {/* Label placeholders at bottom of each symbol */}
    <line x1="8" y1="40" x2="20" y2="40" strokeWidth={0.75} strokeOpacity={0.4} />
    <line x1="28" y1="40" x2="39" y2="40" strokeWidth={0.75} strokeOpacity={0.4} />
  </>,
);

// ── StairPathAnnotationHifi — stair plan with UP path arrow + cut line ───────────
export const StairPathAnnotationHifi = bimIconHifi(
  'StairPathAnnotationHifi',
  <>
    {/* Landing fill — finish */}
    <rect
      x="4"
      y="36"
      width="40"
      height="8"
      style={{
        fill: 'var(--hi-finish, currentColor)',
        fillOpacity: 'var(--hi-finish-op, 0.80)',
      }}
      strokeWidth={1.5}
    />

    {/* Stair treads — concrete fills */}
    {[0, 1, 2, 3, 4].map((i) => (
      <rect
        key={i}
        x={4 + i * 7}
        y={6}
        width={7}
        height={30}
        style={{
          fill: 'var(--hi-concrete, currentColor)',
          fillOpacity: 'var(--hi-concrete-op, 0.12)',
        }}
        strokeWidth={i === 0 ? 1.5 : 0.75}
        fill="none"
      />
    ))}

    {/* Tread lines (plan view) */}
    <g strokeWidth={1.5}>
      <line x1="4" y1="6" x2="39" y2="6" />
      <line x1="4" y1="12" x2="39" y2="12" />
      <line x1="4" y1="18" x2="39" y2="18" />
      <line x1="4" y1="24" x2="39" y2="24" />
      <line x1="4" y1="30" x2="39" y2="30" />
    </g>

    {/* Stair bounding outline */}
    <rect x="4" y="6" width="35" height="38" strokeWidth={2} fill="none" />

    {/* Diagonal cut / break line */}
    <line x1="4" y1="20" x2="39" y2="20" strokeWidth={1.5} strokeDasharray="6 3" />

    {/* UP path arrow — dashed line from bottom landing to break line */}
    <line
      x1="21"
      y1="35"
      x2="21"
      y2="21"
      strokeWidth={1}
      strokeDasharray="3 2"
      strokeOpacity={0.7}
    />
    <polyline points="18.5,24 21,21 23.5,24" strokeWidth={1} fill="none" strokeOpacity={0.7} />

    {/* "UP" text label placeholder at bottom of arrow */}
    <line x1="17" y1="38" x2="25" y2="38" strokeWidth={1} strokeOpacity={0.55} />
  </>,
);

// ── ReferencePointHifi — 3D coordinate system with X/Y/Z axes + datum plane ──────
export const ReferencePointHifi = bimIconHifi(
  'ReferencePointHifi',
  <>
    {/* Datum plane — flat parallelogram at base, finish fill */}
    <polygon
      points="8,36 24,42 44,34 28,28"
      style={{
        fill: 'var(--hi-finish, currentColor)',
        fillOpacity: 'var(--hi-finish-op, 0.55)',
      }}
      strokeWidth={1}
      strokeOpacity={0.4}
    />

    {/* Datum plane grid lines */}
    <g strokeWidth={0.75} strokeOpacity={0.25}>
      <line x1="16" y1="38.5" x2="36" y2="31" />
      <line x1="20" y1="40" x2="22" y2="29" />
    </g>

    {/* Origin sphere — finish fill */}
    <circle
      cx="24"
      cy="28"
      r="3.5"
      style={{
        fill: 'var(--hi-finish, currentColor)',
        fillOpacity: 'var(--hi-finish-op, 0.92)',
      }}
      strokeWidth={1.5}
    />

    {/* X-axis — roof/red arrow (pointing right-down in isometric) */}
    <line
      x1="24"
      y1="28"
      x2="42"
      y2="36"
      strokeWidth={2}
      style={{ stroke: 'var(--hi-roof, currentColor)' }}
    />
    <polygon
      points="44,37 39,33 40,38"
      style={{
        fill: 'var(--hi-roof, currentColor)',
        fillOpacity: 'var(--hi-roof-op, 0.80)',
      }}
      stroke="none"
    />

    {/* Y-axis — glass/blue arrow (pointing left-down in isometric) */}
    <line
      x1="24"
      y1="28"
      x2="6"
      y2="36"
      strokeWidth={2}
      style={{ stroke: 'var(--hi-glass, currentColor)' }}
    />
    <polygon
      points="4,37 9,33 8,38"
      style={{
        fill: 'var(--hi-glass, currentColor)',
        fillOpacity: 'var(--hi-glass-op, 0.80)',
      }}
      stroke="none"
    />

    {/* Z-axis — steel/gray arrow (pointing straight up) */}
    <line
      x1="24"
      y1="28"
      x2="24"
      y2="6"
      strokeWidth={2}
      style={{ stroke: 'var(--hi-steel, currentColor)' }}
    />
    <polygon
      points="24,4 21,10 27,10"
      style={{
        fill: 'var(--hi-steel, currentColor)',
        fillOpacity: 'var(--hi-steel-op, 0.80)',
      }}
      stroke="none"
    />

    {/* Axis label placeholders */}
    <g strokeWidth={0.75} strokeOpacity={0.55}>
      {/* X label at tip */}
      <line x1="44" y1="39" x2="47" y2="39" />
      {/* Y label at tip */}
      <line x1="1" y1="38" x2="4" y2="38" />
      {/* Z label at tip */}
      <line x1="22" y1="2" x2="26" y2="2" />
    </g>
  </>,
);
