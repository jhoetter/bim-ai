/**
 * High-fidelity 48×48 MEP extended icons — set A (ductwork, piping, electrical).
 *
 * CSS custom properties (set on a wrapper element):
 *   --hi-concrete / --hi-concrete-op  — structural concrete
 *   --hi-finish   / --hi-finish-op    — plaster, insulation, casing
 *   --hi-glass    / --hi-glass-op     — glazing, transparent panels (water tint)
 *   --hi-steel    / --hi-steel-op     — steel, aluminum, galvanized metal, ductwork
 *   --hi-leaf                          — timber/organic fills (also: cable bundles)
 *   --hi-roof     / --hi-roof-op      — roof surface / alert color (terracotta)
 *   --hi-room     / --hi-room-op      — interior zone / air space fill
 *
 * Without variables the icons render in monochrome currentColor.
 *
 * Stroke hierarchy:
 *   strokeWidth 2    — primary outlines
 *   strokeWidth 1.5  — secondary edges, reveals
 *   strokeWidth 0.75 — hatch, detail lines
 */
import { bimIconHifi } from './icon';

// ── FlexDuctHifi — wavy corrugated flexible duct tube ────────────────────────
export const FlexDuctHifi = bimIconHifi(
  'FlexDuctHifi',
  <>
    {/* Interior air void — glass tint */}
    <path
      d="M6,24 C10,20 14,28 18,24 C22,20 26,28 30,24 C34,20 38,28 42,24"
      style={{ fill: 'var(--hi-glass, currentColor)', fillOpacity: 'var(--hi-glass-op, 0.25)' }}
      strokeWidth={0}
    />
    {/* Interior fill body (elliptical tube center) */}
    <ellipse
      cx="24"
      cy="24"
      rx="18"
      ry="8"
      style={{ fill: 'var(--hi-glass, currentColor)', fillOpacity: 'var(--hi-glass-op, 0.15)' }}
      strokeWidth={0}
    />

    {/* Outer corrugation rings — steel color */}
    <g
      strokeWidth={1.5}
      style={{ stroke: 'var(--hi-steel, currentColor)' }}
      strokeOpacity={0.7}
      fill="none"
    >
      <ellipse cx="8" cy="24" rx="2" ry="8" />
      <ellipse cx="13" cy="24" rx="2" ry="8" />
      <ellipse cx="18" cy="24" rx="2" ry="8" />
      <ellipse cx="23" cy="24" rx="2" ry="8" />
      <ellipse cx="28" cy="24" rx="2" ry="8" />
      <ellipse cx="33" cy="24" rx="2" ry="8" />
      <ellipse cx="38" cy="24" rx="2" ry="8" />
      <ellipse cx="43" cy="24" rx="2" ry="8" />
    </g>

    {/* Outer duct boundary lines (top and bottom) — primary outline */}
    <path
      d="M6,16 C10,16 14,16 18,16 C22,16 26,16 30,16 C34,16 38,16 42,16"
      strokeWidth={2}
      fill="none"
    />
    <path
      d="M6,32 C10,32 14,32 18,32 C22,32 26,32 30,32 C34,32 38,32 42,32"
      strokeWidth={2}
      fill="none"
    />

    {/* End caps */}
    <line x1="6" y1="16" x2="6" y2="32" strokeWidth={2} />
    <line x1="42" y1="16" x2="42" y2="32" strokeWidth={2} />

    {/* Insulation wrap dashes around outside */}
    <g strokeWidth={0.75} strokeDasharray="3 3" strokeOpacity={0.4}>
      <path d="M4,13 C14,11 34,11 44,13" fill="none" />
      <path d="M4,35 C14,37 34,37 44,35" fill="none" />
      <line x1="4" y1="13" x2="4" y2="35" />
      <line x1="44" y1="13" x2="44" y2="35" />
    </g>
  </>,
);

// ── DuctFittingHifi — 90° elbow fitting: rectangular duct turning corner ─────
export const DuctFittingHifi = bimIconHifi(
  'DuctFittingHifi',
  <>
    {/* Horizontal duct body — steel fill */}
    <rect
      x="6"
      y="28"
      width="22"
      height="12"
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.18)' }}
    />

    {/* Vertical duct body — steel fill (going up from elbow) */}
    <rect
      x="22"
      y="8"
      width="12"
      height="22"
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.18)' }}
    />

    {/* Corner fillet fill (bridge between horiz + vert) */}
    <path
      d="M22,28 L28,28 L28,30 Q28,8 34,8 L34,8 L34,8 Q22,8 22,20 Z"
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.18)' }}
      strokeWidth={0}
    />

    {/* Turning vanes — finish color */}
    <path
      d="M14,28 Q14,20 22,20"
      style={{ fill: 'none' }}
      stroke="var(--hi-finish, currentColor)"
      strokeWidth={1.5}
      strokeOpacity={0.8}
    />
    <path
      d="M17,28 Q17,23 22,23"
      style={{ fill: 'none' }}
      stroke="var(--hi-finish, currentColor)"
      strokeWidth={1.5}
      strokeOpacity={0.6}
    />
    <path
      d="M20,28 Q20,25 22,25"
      style={{ fill: 'none' }}
      stroke="var(--hi-finish, currentColor)"
      strokeWidth={1.5}
      strokeOpacity={0.4}
    />

    {/* Primary outlines */}
    {/* Horizontal duct outline */}
    <line x1="6" y1="28" x2="22" y2="28" strokeWidth={2} />
    <line x1="6" y1="40" x2="28" y2="40" strokeWidth={2} />
    <line x1="6" y1="28" x2="6" y2="40" strokeWidth={2} />
    {/* Elbow outer curve */}
    <path d="M22,28 Q28,28 28,22" strokeWidth={2} fill="none" />
    <path d="M22,40 Q40,40 40,22" strokeWidth={2} fill="none" />
    {/* Vertical duct outline */}
    <line x1="28" y1="22" x2="28" y2="8" strokeWidth={2} />
    <line x1="40" y1="22" x2="40" y2="8" strokeWidth={2} />
    <line x1="28" y1="8" x2="40" y2="8" strokeWidth={2} />

    {/* Flow arrows */}
    {/* Horizontal incoming */}
    <line x1="8" y1="34" x2="16" y2="34" strokeWidth={1.5} />
    <polyline points="13,31 16,34 13,37" strokeWidth={1.5} fill="none" />
    {/* Vertical outgoing */}
    <line x1="34" y1="32" x2="34" y2="14" strokeWidth={1.5} />
    <polyline points="31,17 34,14 37,17" strokeWidth={1.5} fill="none" />
  </>,
);

// ── DuctAccessoryHifi — rectangular duct with damper blade + actuator ─────────
export const DuctAccessoryHifi = bimIconHifi(
  'DuctAccessoryHifi',
  <>
    {/* Duct body — steel fill */}
    <rect
      x="5"
      y="16"
      width="38"
      height="16"
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.15)' }}
    />

    {/* Duct primary outline */}
    <rect x="5" y="16" width="38" height="16" strokeWidth={2} fill="none" />

    {/* Damper blade (pivoting across duct center) — roof fill */}
    <rect
      x="14"
      y="20"
      width="20"
      height="8"
      rx="1"
      style={{ fill: 'var(--hi-roof, currentColor)', fillOpacity: 'var(--hi-roof-op, 0.35)' }}
      strokeWidth={1.5}
    />

    {/* Damper pivot shaft — center line */}
    <line x1="24" y1="12" x2="24" y2="36" strokeWidth={1.5} strokeOpacity={0.7} />

    {/* Pivot indicator dots */}
    <circle cx="24" cy="24" r="2.5" fill="currentColor" fillOpacity={0.6} stroke="none" />

    {/* Actuator circle at top of shaft */}
    <circle cx="24" cy="9" r="4" strokeWidth={1.5} fill="none" />
    <circle
      cx="24"
      cy="9"
      r="2"
      style={{ fill: 'var(--hi-roof, currentColor)', fillOpacity: 'var(--hi-roof-op, 0.50)' }}
      strokeWidth={1}
    />

    {/* Actuator mounting bracket */}
    <line x1="21" y1="9" x2="17" y2="9" strokeWidth={1} strokeOpacity={0.5} />
    <line x1="27" y1="9" x2="31" y2="9" strokeWidth={1} strokeOpacity={0.5} />

    {/* Duct end arrows (airflow passes through or is blocked) */}
    <g strokeWidth={0.75} strokeOpacity={0.4}>
      <line x1="5" y1="24" x2="13" y2="24" />
      <line x1="35" y1="24" x2="43" y2="24" />
    </g>
  </>,
);

// ── DuctInsulationHifi — rectangular duct wrapped in insulation layer ─────────
export const DuctInsulationHifi = bimIconHifi(
  'DuctInsulationHifi',
  <>
    {/* Outer insulation jacket — finish fill, thick band */}
    <rect
      x="4"
      y="10"
      width="40"
      height="28"
      rx="2"
      style={{ fill: 'var(--hi-finish, currentColor)', fillOpacity: 'var(--hi-finish-op, 0.30)' }}
    />

    {/* Steel duct inner wall fill */}
    <rect
      x="11"
      y="17"
      width="26"
      height="14"
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.20)' }}
    />

    {/* Insulation stipple texture (dashed lines representing fiber batts) */}
    <g strokeWidth={0.75} strokeDasharray="2 3" strokeOpacity={0.35}>
      <line x1="6" y1="14" x2="10" y2="14" />
      <line x1="6" y1="18" x2="10" y2="18" />
      <line x1="6" y1="22" x2="10" y2="22" />
      <line x1="6" y1="26" x2="10" y2="26" />
      <line x1="6" y1="30" x2="10" y2="30" />
      <line x1="6" y1="34" x2="10" y2="34" />
      <line x1="38" y1="14" x2="42" y2="14" />
      <line x1="38" y1="18" x2="42" y2="18" />
      <line x1="38" y1="22" x2="42" y2="22" />
      <line x1="38" y1="26" x2="42" y2="26" />
      <line x1="38" y1="30" x2="42" y2="30" />
      <line x1="38" y1="34" x2="42" y2="34" />
      <line x1="14" y1="12" x2="14" y2="16" />
      <line x1="20" y1="12" x2="20" y2="16" />
      <line x1="26" y1="12" x2="26" y2="16" />
      <line x1="32" y1="12" x2="32" y2="16" />
      <line x1="14" y1="32" x2="14" y2="36" />
      <line x1="20" y1="32" x2="20" y2="36" />
      <line x1="26" y1="32" x2="26" y2="36" />
      <line x1="32" y1="32" x2="32" y2="36" />
    </g>

    {/* Insulation outer boundary */}
    <rect
      x="4"
      y="10"
      width="40"
      height="28"
      rx="2"
      strokeWidth={0.75}
      strokeOpacity={0.4}
      fill="none"
    />

    {/* Steel duct wall outline (primary) */}
    <rect x="11" y="17" width="26" height="14" strokeWidth={2} fill="none" />

    {/* Thickness callout arrows — left side */}
    <line x1="4" y1="6" x2="11" y2="6" strokeWidth={1} strokeOpacity={0.6} />
    <line x1="4" y1="5" x2="4" y2="7" strokeWidth={1} strokeOpacity={0.6} />
    <line x1="11" y1="5" x2="11" y2="7" strokeWidth={1} strokeOpacity={0.6} />
    <line
      x1="4"
      y1="6"
      x2="4"
      y2="11"
      strokeWidth={0.75}
      strokeDasharray="2 2"
      strokeOpacity={0.4}
    />
    <line
      x1="11"
      y1="6"
      x2="11"
      y2="18"
      strokeWidth={0.75}
      strokeDasharray="2 2"
      strokeOpacity={0.4}
    />
  </>,
);

// ── DuctLiningHifi — duct cross-section showing inner acoustic lining ─────────
export const DuctLiningHifi = bimIconHifi(
  'DuctLiningHifi',
  <>
    {/* Steel outer duct wall fill */}
    <rect
      x="6"
      y="8"
      width="36"
      height="32"
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.18)' }}
    />

    {/* Finish/lining layer fill (bonded to inner duct face) */}
    <rect
      x="11"
      y="13"
      width="26"
      height="22"
      style={{ fill: 'var(--hi-finish, currentColor)', fillOpacity: 'var(--hi-finish-op, 0.40)' }}
    />

    {/* Air cavity */}
    <rect
      x="14"
      y="16"
      width="20"
      height="16"
      style={{ fill: 'var(--hi-room, currentColor)', fillOpacity: 'var(--hi-room-op, 0.30)' }}
    />

    {/* Duct outer wall outline (primary) */}
    <rect x="6" y="8" width="36" height="32" strokeWidth={2} fill="none" />

    {/* Inner lining face outline (secondary) */}
    <rect x="11" y="13" width="26" height="22" strokeWidth={1.5} fill="none" />

    {/* Air cavity outline */}
    <rect x="14" y="16" width="20" height="16" strokeWidth={1} strokeOpacity={0.6} fill="none" />

    {/* Lining inner face hatch — angled lines within lining zone */}
    <g strokeWidth={0.75} strokeOpacity={0.35}>
      <line x1="11" y1="13" x2="14" y2="16" />
      <line x1="11" y1="17" x2="14" y2="20" />
      <line x1="11" y1="21" x2="14" y2="24" />
      <line x1="11" y1="25" x2="14" y2="28" />
      <line x1="11" y1="29" x2="14" y2="32" />
      <line x1="11" y1="33" x2="13" y2="35" />
      <line x1="34" y1="16" x2="37" y2="13" />
      <line x1="34" y1="20" x2="37" y2="17" />
      <line x1="34" y1="24" x2="37" y2="21" />
      <line x1="34" y1="28" x2="37" y2="25" />
      <line x1="34" y1="32" x2="37" y2="29" />
      <line x1="35" y1="35" x2="37" y2="33" />
    </g>

    {/* Airflow arrows inside cavity */}
    <line x1="18" y1="24" x2="28" y2="24" strokeWidth={1.5} />
    <polyline points="25,21 28,24 25,27" strokeWidth={1.5} fill="none" />
  </>,
);

// ── FlexPipeHifi — corrugated round flexible pipe ─────────────────────────────
export const FlexPipeHifi = bimIconHifi(
  'FlexPipeHifi',
  <>
    {/* Interior void — glass fill (fluid/water tint) */}
    <rect
      x="10"
      y="19"
      width="28"
      height="10"
      style={{ fill: 'var(--hi-glass, currentColor)', fillOpacity: 'var(--hi-glass-op, 0.25)' }}
      strokeWidth={0}
    />

    {/* Corrugation rings (metallic outer sheath — steel strokes) */}
    <g strokeWidth={1.5} strokeOpacity={0.6} fill="none">
      <ellipse cx="12" cy="24" rx="2" ry="6" />
      <ellipse cx="17" cy="24" rx="2" ry="6" />
      <ellipse cx="22" cy="24" rx="2" ry="6" />
      <ellipse cx="27" cy="24" rx="2" ry="6" />
      <ellipse cx="32" cy="24" rx="2" ry="6" />
      <ellipse cx="37" cy="24" rx="2" ry="6" />
    </g>

    {/* Metallic outer sheath fill zone */}
    <rect
      x="8"
      y="18"
      width="32"
      height="12"
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.12)' }}
      strokeWidth={0}
    />

    {/* Pipe top/bottom run lines (primary) */}
    <line x1="8" y1="18" x2="40" y2="18" strokeWidth={2} />
    <line x1="8" y1="30" x2="40" y2="30" strokeWidth={2} />

    {/* Coupling at left end */}
    <rect
      x="4"
      y="16"
      width="6"
      height="16"
      rx="1"
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.40)' }}
      strokeWidth={1.5}
    />
    {/* Coupling detail rings */}
    <line x1="7" y1="16" x2="7" y2="32" strokeWidth={0.75} strokeOpacity={0.5} />

    {/* Coupling at right end */}
    <rect
      x="38"
      y="16"
      width="6"
      height="16"
      rx="1"
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.40)' }}
      strokeWidth={1.5}
    />
    <line x1="41" y1="16" x2="41" y2="32" strokeWidth={0.75} strokeOpacity={0.5} />
  </>,
);

// ── PipeFittingHifi — tee fitting: horizontal pipe with upward branch ─────────
export const PipeFittingHifi = bimIconHifi(
  'PipeFittingHifi',
  <>
    {/* Horizontal pipe body fill — steel */}
    <rect
      x="4"
      y="20"
      width="40"
      height="14"
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.18)' }}
    />

    {/* Branch stub going upward — steel fill */}
    <rect
      x="19"
      y="6"
      width="10"
      height="16"
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.18)' }}
    />

    {/* Pipe walls concrete tint */}
    <rect
      x="4"
      y="20"
      width="40"
      height="3"
      style={{
        fill: 'var(--hi-concrete, currentColor)',
        fillOpacity: 'var(--hi-concrete-op, 0.25)',
      }}
      strokeWidth={0}
    />
    <rect
      x="4"
      y="31"
      width="40"
      height="3"
      style={{
        fill: 'var(--hi-concrete, currentColor)',
        fillOpacity: 'var(--hi-concrete-op, 0.25)',
      }}
      strokeWidth={0}
    />
    <rect
      x="19"
      y="6"
      width="3"
      height="16"
      style={{
        fill: 'var(--hi-concrete, currentColor)',
        fillOpacity: 'var(--hi-concrete-op, 0.25)',
      }}
      strokeWidth={0}
    />
    <rect
      x="26"
      y="6"
      width="3"
      height="16"
      style={{
        fill: 'var(--hi-concrete, currentColor)',
        fillOpacity: 'var(--hi-concrete-op, 0.25)',
      }}
      strokeWidth={0}
    />

    {/* Primary outlines */}
    {/* Horizontal pipe top and bottom */}
    <line x1="4" y1="20" x2="19" y2="20" strokeWidth={2} />
    <line x1="29" y1="20" x2="44" y2="20" strokeWidth={2} />
    <line x1="4" y1="34" x2="44" y2="34" strokeWidth={2} />
    <line x1="4" y1="20" x2="4" y2="34" strokeWidth={2} />
    <line x1="44" y1="20" x2="44" y2="34" strokeWidth={2} />
    {/* Branch outline */}
    <line x1="19" y1="6" x2="19" y2="20" strokeWidth={2} />
    <line x1="29" y1="6" x2="29" y2="20" strokeWidth={2} />
    <line x1="19" y1="6" x2="29" y2="6" strokeWidth={2} />

    {/* Flow arrows (three directions) */}
    {/* Left inflow */}
    <line x1="8" y1="27" x2="16" y2="27" strokeWidth={1.5} />
    <polyline points="13,24.5 16,27 13,29.5" strokeWidth={1.5} fill="none" />
    {/* Right outflow */}
    <line x1="32" y1="27" x2="40" y2="27" strokeWidth={1.5} />
    <polyline points="37,24.5 40,27 37,29.5" strokeWidth={1.5} fill="none" />
    {/* Branch upward outflow */}
    <line x1="24" y1="18" x2="24" y2="10" strokeWidth={1.5} />
    <polyline points="21.5,13 24,10 26.5,13" strokeWidth={1.5} fill="none" />
  </>,
);

// ── PipeAccessoryHifi — pipe section with gate valve body + wheel handle ──────
export const PipeAccessoryHifi = bimIconHifi(
  'PipeAccessoryHifi',
  <>
    {/* Pipe body fill — steel */}
    <rect
      x="4"
      y="21"
      width="14"
      height="7"
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.20)' }}
    />
    <rect
      x="30"
      y="21"
      width="14"
      height="7"
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.20)' }}
    />

    {/* Valve body — finish fill rounded rectangle */}
    <rect
      x="14"
      y="18"
      width="20"
      height="13"
      rx="3"
      style={{ fill: 'var(--hi-finish, currentColor)', fillOpacity: 'var(--hi-finish-op, 0.40)' }}
      strokeWidth={2}
    />

    {/* Valve internal gate fill (closed position hint) */}
    <rect
      x="18"
      y="21"
      width="12"
      height="7"
      rx="1"
      style={{ fill: 'var(--hi-finish, currentColor)', fillOpacity: 'var(--hi-finish-op, 0.60)' }}
      strokeWidth={1}
    />

    {/* Pipe outlines */}
    <rect x="4" y="21" width="14" height="7" strokeWidth={2} fill="none" />
    <rect x="30" y="21" width="14" height="7" strokeWidth={2} fill="none" />

    {/* Valve stem */}
    <line x1="24" y1="18" x2="24" y2="10" strokeWidth={1.5} />

    {/* Wheel handle (top of valve) */}
    <circle cx="24" cy="8" r="5" strokeWidth={1.5} fill="none" />
    <circle
      cx="24"
      cy="8"
      r="1.5"
      style={{ fill: 'var(--hi-finish, currentColor)', fillOpacity: 'var(--hi-finish-op, 0.70)' }}
      strokeWidth={1}
    />
    {/* Wheel spokes */}
    <g strokeWidth={0.75} strokeOpacity={0.6}>
      <line x1="24" y1="3" x2="24" y2="13" />
      <line x1="19" y1="8" x2="29" y2="8" />
      <line x1="20.5" y1="4.5" x2="27.5" y2="11.5" />
      <line x1="27.5" y1="4.5" x2="20.5" y2="11.5" />
    </g>

    {/* Packing gland detail around stem */}
    <rect
      x="21"
      y="17"
      width="6"
      height="3"
      rx="0.5"
      strokeWidth={0.75}
      strokeOpacity={0.6}
      fill="none"
    />
  </>,
);

// ── PipeInsulationHifi — pipe cross-section with insulation annular ring ──────
export const PipeInsulationHifi = bimIconHifi(
  'PipeInsulationHifi',
  <>
    {/* Outer jacket (concrete — protective casing) */}
    <circle
      cx="24"
      cy="24"
      r="19"
      style={{
        fill: 'var(--hi-concrete, currentColor)',
        fillOpacity: 'var(--hi-concrete-op, 0.20)',
      }}
    />

    {/* Insulation annular ring — finish fill */}
    <circle
      cx="24"
      cy="24"
      r="15"
      style={{ fill: 'var(--hi-finish, currentColor)', fillOpacity: 'var(--hi-finish-op, 0.40)' }}
    />

    {/* Steel pipe inner bore */}
    <circle
      cx="24"
      cy="24"
      r="9"
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.30)' }}
    />

    {/* Fluid void center */}
    <circle
      cx="24"
      cy="24"
      r="5"
      style={{ fill: 'var(--hi-glass, currentColor)', fillOpacity: 'var(--hi-glass-op, 0.35)' }}
    />

    {/* Outer jacket outline */}
    <circle cx="24" cy="24" r="19" strokeWidth={1.5} fill="none" />

    {/* Jacket/insulation interface */}
    <circle cx="24" cy="24" r="15" strokeWidth={0.75} strokeOpacity={0.45} fill="none" />

    {/* Pipe wall outline (primary) */}
    <circle cx="24" cy="24" r="9" strokeWidth={2} fill="none" />

    {/* Bore outline */}
    <circle cx="24" cy="24" r="5" strokeWidth={1} strokeOpacity={0.7} fill="none" />

    {/* Insulation texture — concentric dashes in annular zone */}
    <circle
      cx="24"
      cy="24"
      r="12"
      strokeWidth={0.75}
      strokeDasharray="3 4"
      strokeOpacity={0.3}
      fill="none"
    />

    {/* Callout lines pointing to layers */}
    <line x1="38" y1="10" x2="42" y2="6" strokeWidth={0.75} strokeOpacity={0.5} />
    <line x1="35" y1="12" x2="42" y2="6" strokeWidth={0} />
    <line x1="39" y1="6" x2="46" y2="6" strokeWidth={0.75} strokeOpacity={0.4} />
    <line x1="32" y1="15" x2="46" y2="12" strokeWidth={0.75} strokeOpacity={0.4} />
  </>,
);

// ── CableTrayFittingHifi — cable tray 90° elbow corner ───────────────────────
export const CableTrayFittingHifi = bimIconHifi(
  'CableTrayFittingHifi',
  <>
    {/* Tray channel fill (horizontal section) — steel */}
    <path
      d="M4,28 H24 V36 H8 V32 H4 Z"
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.18)' }}
    />

    {/* Tray channel fill (vertical section going up) — steel */}
    <path
      d="M28,4 V24 H36 V8 H32 V4 Z"
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.18)' }}
    />

    {/* Corner fill */}
    <path
      d="M24,28 L28,24 L28,28 Q28,28 24,28 Z"
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.18)' }}
      strokeWidth={0}
    />
    <path
      d="M24,28 Q24,36 36,36 L36,32 Q28,32 28,24 L24,24 Z"
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.10)' }}
      strokeWidth={0}
    />

    {/* Cable bundles inside — room colored */}
    <circle
      cx="14"
      cy="32"
      r="2.5"
      style={{ fill: 'var(--hi-room, currentColor)', fillOpacity: 'var(--hi-room-op, 0.60)' }}
      strokeWidth={1}
    />
    <circle
      cx="19"
      cy="32"
      r="2.5"
      style={{ fill: 'var(--hi-room, currentColor)', fillOpacity: 'var(--hi-room-op, 0.40)' }}
      strokeWidth={1}
    />
    <circle
      cx="32"
      cy="14"
      r="2.5"
      style={{ fill: 'var(--hi-room, currentColor)', fillOpacity: 'var(--hi-room-op, 0.60)' }}
      strokeWidth={1}
    />
    <circle
      cx="32"
      cy="19"
      r="2.5"
      style={{ fill: 'var(--hi-room, currentColor)', fillOpacity: 'var(--hi-room-op, 0.40)' }}
      strokeWidth={1}
    />

    {/* Tray rungs — horizontal section */}
    <g strokeWidth={0.75} strokeOpacity={0.5}>
      <line x1="8" y1="28" x2="8" y2="36" />
      <line x1="12" y1="28" x2="12" y2="36" />
      <line x1="16" y1="28" x2="16" y2="36" />
      <line x1="20" y1="28" x2="20" y2="36" />
    </g>
    {/* Tray rungs — vertical section */}
    <g strokeWidth={0.75} strokeOpacity={0.5}>
      <line x1="28" y1="8" x2="36" y2="8" />
      <line x1="28" y1="12" x2="36" y2="12" />
      <line x1="28" y1="16" x2="36" y2="16" />
      <line x1="28" y1="20" x2="36" y2="20" />
    </g>

    {/* Primary outlines */}
    <path d="M4,28 H24 Q36,28 36,8" strokeWidth={2} fill="none" />
    <path d="M4,36 H24 Q44,36 44,8" strokeWidth={2} fill="none" />
    <line x1="4" y1="28" x2="4" y2="36" strokeWidth={2} />
    <line x1="36" y1="4" x2="44" y2="4" strokeWidth={2} />
  </>,
);

// ── ConduitFittingHifi — conduit 90° elbow: round conduit with threaded ends ──
export const ConduitFittingHifi = bimIconHifi(
  'ConduitFittingHifi',
  <>
    {/* Conduit body fill — concrete (cast or rigid) */}
    <path
      d="M8,36 A20,20 0 0,1 36,8"
      style={{ fill: 'none' }}
      stroke="var(--hi-concrete, currentColor)"
      strokeWidth={10}
      strokeOpacity={0.2}
      strokeLinecap="round"
    />

    {/* Conduit bore (hollow inside) */}
    <path
      d="M10,38 A18,18 0 0,1 38,10"
      style={{ fill: 'none' }}
      stroke="currentColor"
      strokeWidth={0}
    />

    {/* Wire hint inside conduit — dashed line following center */}
    <path
      d="M8,36 A20,20 0 0,1 36,8"
      strokeWidth={0.75}
      strokeDasharray="3 3"
      strokeOpacity={0.35}
      fill="none"
    />

    {/* Conduit outer outline */}
    <path d="M3,36 A25,25 0 0,1 36,3" strokeWidth={2} fill="none" />
    <path d="M13,36 A15,15 0 0,1 36,13" strokeWidth={2} fill="none" />

    {/* Threaded coupling at bottom end — steel rings */}
    <rect
      x="3"
      y="35"
      width="10"
      height="5"
      rx="1"
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.45)' }}
      strokeWidth={1.5}
    />
    {/* Thread rings bottom */}
    <g strokeWidth={0.75} strokeOpacity={0.5}>
      <line x1="5" y1="35" x2="5" y2="40" />
      <line x1="7" y1="35" x2="7" y2="40" />
      <line x1="9" y1="35" x2="9" y2="40" />
      <line x1="11" y1="35" x2="11" y2="40" />
    </g>

    {/* Threaded coupling at right end — steel rings */}
    <rect
      x="35"
      y="3"
      width="5"
      height="10"
      rx="1"
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.45)' }}
      strokeWidth={1.5}
    />
    {/* Thread rings right */}
    <g strokeWidth={0.75} strokeOpacity={0.5}>
      <line x1="35" y1="5" x2="40" y2="5" />
      <line x1="35" y1="7" x2="40" y2="7" />
      <line x1="35" y1="9" x2="40" y2="9" />
      <line x1="35" y1="11" x2="40" y2="11" />
    </g>

    {/* Fill the conduit body (concrete) */}
    <path
      d="M3,36 A25,25 0 0,1 36,3 L36,13 A15,15 0 0,0 13,36 Z"
      style={{
        fill: 'var(--hi-concrete, currentColor)',
        fillOpacity: 'var(--hi-concrete-op, 0.15)',
      }}
      strokeWidth={0}
    />
  </>,
);

// ── ElectricalWireHifi — three-conductor cable cross-section ──────────────────
export const ElectricalWireHifi = bimIconHifi(
  'ElectricalWireHifi',
  <>
    {/* Outer cable jacket — concrete fill (gray PVC) */}
    <circle
      cx="24"
      cy="24"
      r="19"
      style={{
        fill: 'var(--hi-concrete, currentColor)',
        fillOpacity: 'var(--hi-concrete-op, 0.35)',
      }}
    />

    {/* Outer jacket outline (primary) */}
    <circle cx="24" cy="24" r="19" strokeWidth={2} fill="none" />

    {/* Jacket stripe detail (cable ID marking) */}
    <circle
      cx="24"
      cy="24"
      r="19"
      strokeWidth={0.75}
      strokeDasharray="8 4"
      strokeOpacity={0.3}
      fill="none"
    />

    {/* Filler/bedding between conductors */}
    <circle
      cx="24"
      cy="24"
      r="10"
      style={{
        fill: 'var(--hi-concrete, currentColor)',
        fillOpacity: 'var(--hi-concrete-op, 0.20)',
      }}
      strokeWidth={0}
    />

    {/* Conductor 1 — top-left (roof/terracotta — live/phase) */}
    <circle
      cx="18"
      cy="18"
      r="6"
      style={{ fill: 'var(--hi-roof, currentColor)', fillOpacity: 'var(--hi-roof-op, 0.50)' }}
      strokeWidth={1.5}
    />
    {/* Stranded wire cross-section circles — conductor 1 */}
    <g strokeWidth={0.75} strokeOpacity={0.35} fill="none">
      <circle cx="18" cy="16" r="1.5" />
      <circle cx="15.5" cy="19.5" r="1.5" />
      <circle cx="20.5" cy="19.5" r="1.5" />
    </g>

    {/* Conductor 2 — top-right (glass/blue — neutral) */}
    <circle
      cx="30"
      cy="18"
      r="6"
      style={{ fill: 'var(--hi-glass, currentColor)', fillOpacity: 'var(--hi-glass-op, 0.50)' }}
      strokeWidth={1.5}
    />
    {/* Stranded wire cross-section circles — conductor 2 */}
    <g strokeWidth={0.75} strokeOpacity={0.35} fill="none">
      <circle cx="30" cy="16" r="1.5" />
      <circle cx="27.5" cy="19.5" r="1.5" />
      <circle cx="32.5" cy="19.5" r="1.5" />
    </g>

    {/* Conductor 3 — bottom-center (finish/green-earth) */}
    <circle
      cx="24"
      cy="30"
      r="6"
      style={{ fill: 'var(--hi-finish, currentColor)', fillOpacity: 'var(--hi-finish-op, 0.50)' }}
      strokeWidth={1.5}
    />
    {/* Stranded wire cross-section circles — conductor 3 */}
    <g strokeWidth={0.75} strokeOpacity={0.35} fill="none">
      <circle cx="22" cy="28.5" r="1.5" />
      <circle cx="26" cy="28.5" r="1.5" />
      <circle cx="24" cy="32" r="1.5" />
    </g>
  </>,
);
