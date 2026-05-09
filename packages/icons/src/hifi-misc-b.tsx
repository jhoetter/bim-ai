/**
 * High-fidelity 48×48 BIM miscellaneous icons — batch B.
 *
 * CSS custom properties (set on a wrapper element):
 *   --hi-concrete / --hi-concrete-op  — structural concrete (stone gray)
 *   --hi-finish   / --hi-finish-op    — plaster, paper, gypsum (warm white)
 *   --hi-glass    / --hi-glass-op     — glazing (sky blue)
 *   --hi-steel    / --hi-steel-op     — steel, metal, aluminum (blue-gray)
 *   --hi-leaf                          — timber/wood (amber, no opacity var)
 *   --hi-room     / --hi-room-op      — interior zone (pale yellow)
 *   --hi-roof     / --hi-roof-op      — roof / alert (terracotta)
 *
 * Without variables the icons render in monochrome currentColor.
 *
 * Stroke hierarchy:
 *   strokeWidth 2    — primary outlines
 *   strokeWidth 1.5  — secondary edges, reveals
 *   strokeWidth 0.75 — hatch, detail lines
 */
import { bimIconHifi } from './icon';

// ── ConduitHifi: cross-section of a conduit bundle ───────────────────────────
export const ConduitHifi = bimIconHifi(
  'ConduitHifi',
  <>
    {/* Main conduit — steel outer ring fill */}
    <circle
      cx="20"
      cy="24"
      r="13"
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.20)' }}
    />
    {/* Main conduit — inner void */}
    <circle
      cx="20"
      cy="24"
      r="8"
      style={{ fill: 'var(--hi-room, currentColor)', fillOpacity: 'var(--hi-room-op, 0.45)' }}
    />
    {/* Main conduit outer outline */}
    <circle cx="20" cy="24" r="13" strokeWidth={2} />
    {/* Main conduit inner bore line */}
    <circle cx="20" cy="24" r="8" strokeWidth={1.5} />

    {/* Diagonal hatch in main conduit wall zone */}
    <g strokeWidth={0.75} strokeOpacity={0.3}>
      <line x1="8" y1="20" x2="12" y2="14" />
      <line x1="8" y1="26" x2="15" y2="14" />
      <line x1="10" y1="31" x2="19" y2="14" />
      <line x1="27" y1="13" x2="33" y2="17" />
      <line x1="31" y1="14" x2="33" y2="17" />
      <line x1="30" y1="34" x2="33" y2="30" />
      <line x1="8" y1="28" x2="12" y2="34" />
      <line x1="10" y1="22" x2="14" y2="34" />
    </g>

    {/* Wire/cable inside main conduit — small amber circle */}
    <circle
      cx="20"
      cy="24"
      r="2.5"
      style={{ fill: 'var(--hi-leaf, currentColor)' }}
      fillOpacity={0.7}
      strokeWidth={1}
    />

    {/* Second smaller conduit — offset upper-right */}
    <circle
      cx="36"
      cy="17"
      r="8"
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.16)' }}
    />
    <circle
      cx="36"
      cy="17"
      r="4.5"
      style={{ fill: 'var(--hi-room, currentColor)', fillOpacity: 'var(--hi-room-op, 0.40)' }}
    />
    <circle cx="36" cy="17" r="8" strokeWidth={2} />
    <circle cx="36" cy="17" r="4.5" strokeWidth={1.5} />

    {/* Hatch in second conduit wall */}
    <g strokeWidth={0.75} strokeOpacity={0.25}>
      <line x1="29" y1="13" x2="32" y2="10" />
      <line x1="29" y1="17" x2="34" y2="10" />
      <line x1="32" y1="22" x2="40" y2="12" />
      <line x1="37" y1="24" x2="43" y2="19" />
    </g>

    {/* Small wire in second conduit */}
    <circle
      cx="36"
      cy="17"
      r="1.5"
      style={{ fill: 'var(--hi-leaf, currentColor)' }}
      fillOpacity={0.6}
      strokeWidth={0.75}
    />
  </>,
);

// ── ElectricalPanelHifi: electrical panel board elevation ────────────────────
export const ElectricalPanelHifi = bimIconHifi(
  'ElectricalPanelHifi',
  <>
    {/* Panel box body — steel fill */}
    <rect
      x="7"
      y="5"
      width="34"
      height="38"
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.16)' }}
    />
    {/* Panel bold border */}
    <rect x="7" y="5" width="34" height="38" strokeWidth={2} fill="none" />

    {/* Main breaker at top — larger rectangle, steel */}
    <rect
      x="13"
      y="8"
      width="22"
      height="8"
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.35)' }}
    />
    <rect x="13" y="8" width="22" height="8" strokeWidth={1.5} fill="none" />
    {/* Main breaker label line */}
    <line x1="18" y1="12" x2="30" y2="12" strokeWidth={0.75} strokeOpacity={0.5} />

    {/* 3×4 grid of circuit breakers — alternating finish / concrete fills */}
    {/* Row 1 */}
    <rect
      x="10"
      y="19"
      width="8"
      height="4"
      style={{ fill: 'var(--hi-finish, currentColor)', fillOpacity: 'var(--hi-finish-op, 0.55)' }}
      strokeWidth={0.75}
    />
    <rect
      x="20"
      y="19"
      width="8"
      height="4"
      style={{
        fill: 'var(--hi-concrete, currentColor)',
        fillOpacity: 'var(--hi-concrete-op, 0.30)',
      }}
      strokeWidth={0.75}
    />
    <rect
      x="30"
      y="19"
      width="8"
      height="4"
      style={{ fill: 'var(--hi-finish, currentColor)', fillOpacity: 'var(--hi-finish-op, 0.55)' }}
      strokeWidth={0.75}
    />
    {/* Row 2 */}
    <rect
      x="10"
      y="24"
      width="8"
      height="4"
      style={{
        fill: 'var(--hi-concrete, currentColor)',
        fillOpacity: 'var(--hi-concrete-op, 0.30)',
      }}
      strokeWidth={0.75}
    />
    <rect
      x="20"
      y="24"
      width="8"
      height="4"
      style={{ fill: 'var(--hi-finish, currentColor)', fillOpacity: 'var(--hi-finish-op, 0.55)' }}
      strokeWidth={0.75}
    />
    <rect
      x="30"
      y="24"
      width="8"
      height="4"
      style={{
        fill: 'var(--hi-concrete, currentColor)',
        fillOpacity: 'var(--hi-concrete-op, 0.30)',
      }}
      strokeWidth={0.75}
    />
    {/* Row 3 */}
    <rect
      x="10"
      y="29"
      width="8"
      height="4"
      style={{ fill: 'var(--hi-finish, currentColor)', fillOpacity: 'var(--hi-finish-op, 0.55)' }}
      strokeWidth={0.75}
    />
    <rect
      x="20"
      y="29"
      width="8"
      height="4"
      style={{
        fill: 'var(--hi-concrete, currentColor)',
        fillOpacity: 'var(--hi-concrete-op, 0.30)',
      }}
      strokeWidth={0.75}
    />
    <rect
      x="30"
      y="29"
      width="8"
      height="4"
      style={{ fill: 'var(--hi-finish, currentColor)', fillOpacity: 'var(--hi-finish-op, 0.55)' }}
      strokeWidth={0.75}
    />
    {/* Row 4 */}
    <rect
      x="10"
      y="34"
      width="8"
      height="4"
      style={{
        fill: 'var(--hi-concrete, currentColor)',
        fillOpacity: 'var(--hi-concrete-op, 0.30)',
      }}
      strokeWidth={0.75}
    />
    <rect
      x="20"
      y="34"
      width="8"
      height="4"
      style={{ fill: 'var(--hi-finish, currentColor)', fillOpacity: 'var(--hi-finish-op, 0.55)' }}
      strokeWidth={0.75}
    />
    <rect
      x="30"
      y="34"
      width="8"
      height="4"
      style={{
        fill: 'var(--hi-concrete, currentColor)',
        fillOpacity: 'var(--hi-concrete-op, 0.30)',
      }}
      strokeWidth={0.75}
    />

    {/* Cable entry at bottom — vertical lines */}
    <line x1="18" y1="43" x2="18" y2="47" strokeWidth={1.5} />
    <line x1="24" y1="43" x2="24" y2="47" strokeWidth={1.5} />
    <line x1="30" y1="43" x2="30" y2="47" strokeWidth={1.5} />
  </>,
);

// ── FireSprinklerHifi: fire sprinkler head, plan/RCP view ────────────────────
export const FireSprinklerHifi = bimIconHifi(
  'FireSprinklerHifi',
  <>
    {/* Spray radius — dashed circle with very low-opacity room fill */}
    <circle
      cx="24"
      cy="24"
      r="20"
      style={{ fill: 'var(--hi-room, currentColor)', fillOpacity: 'var(--hi-room-op, 0.12)' }}
      strokeWidth={0.75}
      strokeDasharray="4 3"
      strokeOpacity={0.45}
    />

    {/* Pipe stub — concrete fill, vertical line from top */}
    <line x1="24" y1="4" x2="24" y2="16" strokeWidth={2} />

    {/* Deflector plate — steel fill circle */}
    <circle
      cx="24"
      cy="24"
      r="7"
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.30)' }}
    />
    <circle cx="24" cy="24" r="7" strokeWidth={2} fill="none" />

    {/* 4 radiating arms (cross) from center outward */}
    <line x1="24" y1="17" x2="24" y2="10" strokeWidth={1.5} />
    <line x1="31" y1="24" x2="38" y2="24" strokeWidth={1.5} />
    <line x1="24" y1="31" x2="24" y2="38" strokeWidth={1.5} />
    <line x1="17" y1="24" x2="10" y2="24" strokeWidth={1.5} />

    {/* Center nozzle point */}
    <circle cx="24" cy="24" r="2" fill="currentColor" stroke="none" fillOpacity={0.6} />

    {/* Diagonal secondary arms */}
    <line x1="29" y1="19" x2="34" y2="14" strokeWidth={0.75} strokeOpacity={0.5} />
    <line x1="29" y1="29" x2="34" y2="34" strokeWidth={0.75} strokeOpacity={0.5} />
    <line x1="19" y1="29" x2="14" y2="34" strokeWidth={0.75} strokeOpacity={0.5} />
    <line x1="19" y1="19" x2="14" y2="14" strokeWidth={0.75} strokeOpacity={0.5} />
  </>,
);

// ── DiffuserHifi: HVAC air diffuser, RCP plan view ───────────────────────────
export const DiffuserHifi = bimIconHifi(
  'DiffuserHifi',
  <>
    {/* Outer frame — bold steel */}
    <rect
      x="6"
      y="12"
      width="36"
      height="24"
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.16)' }}
    />
    <rect x="6" y="12" width="36" height="24" strokeWidth={2} fill="none" />

    {/* Concentric rectangular air slots — room fill */}
    <rect
      x="10"
      y="16"
      width="28"
      height="16"
      style={{ fill: 'var(--hi-room, currentColor)', fillOpacity: 'var(--hi-room-op, 0.40)' }}
      strokeWidth={1.5}
    />
    <rect
      x="14"
      y="19"
      width="20"
      height="10"
      style={{ fill: 'var(--hi-room, currentColor)', fillOpacity: 'var(--hi-room-op, 0.30)' }}
      strokeWidth={1}
      strokeOpacity={0.7}
    />
    <rect
      x="18"
      y="21.5"
      width="12"
      height="5"
      style={{ fill: 'var(--hi-room, currentColor)', fillOpacity: 'var(--hi-room-op, 0.20)' }}
      strokeWidth={0.75}
      strokeOpacity={0.6}
    />

    {/* Airflow diagonal lines radiating from center to corners */}
    <g strokeWidth={0.75} strokeOpacity={0.35}>
      <line x1="24" y1="24" x2="6" y2="12" />
      <line x1="24" y1="24" x2="42" y2="12" />
      <line x1="24" y1="24" x2="6" y2="36" />
      <line x1="24" y1="24" x2="42" y2="36" />
    </g>

    {/* Center crosshair */}
    <line x1="24" y1="21" x2="24" y2="27" strokeWidth={0.75} strokeOpacity={0.5} />
    <line x1="21" y1="24" x2="27" y2="24" strokeWidth={0.75} strokeOpacity={0.5} />
  </>,
);

// ── ShaftOpeningHifi: vertical shaft opening through floor slab, plan view ───
export const ShaftOpeningHifi = bimIconHifi(
  'ShaftOpeningHifi',
  <>
    {/* Slab frame — concrete fill */}
    <rect
      x="4"
      y="4"
      width="40"
      height="40"
      style={{
        fill: 'var(--hi-concrete, currentColor)',
        fillOpacity: 'var(--hi-concrete-op, 0.12)',
      }}
    />
    {/* Void interior — room fill */}
    <rect
      x="12"
      y="12"
      width="24"
      height="24"
      style={{ fill: 'var(--hi-room, currentColor)', fillOpacity: 'var(--hi-room-op, 0.50)' }}
    />

    {/* Slab outer outline */}
    <rect x="4" y="4" width="40" height="40" strokeWidth={2} fill="none" />

    {/* Slab concrete hatch (in frame region only) */}
    <g strokeWidth={0.75} strokeOpacity={0.28}>
      {/* top-left corner hatch */}
      <line x1="4" y1="8" x2="8" y2="4" />
      <line x1="4" y1="16" x2="16" y2="4" />
      {/* top-right corner hatch */}
      <line x1="32" y1="4" x2="44" y2="16" />
      <line x1="36" y1="4" x2="44" y2="12" />
      {/* bottom-left corner hatch */}
      <line x1="4" y1="32" x2="16" y2="44" />
      <line x1="4" y1="38" x2="10" y2="44" />
      {/* bottom-right corner hatch */}
      <line x1="32" y1="44" x2="44" y2="32" />
      <line x1="38" y1="44" x2="44" y2="38" />
    </g>

    {/* Slab opening boundary — bold */}
    <rect x="12" y="12" width="24" height="24" strokeWidth={2} fill="none" />

    {/* Dashed inner boundary for opening extent */}
    <rect
      x="14"
      y="14"
      width="20"
      height="20"
      strokeWidth={0.75}
      strokeDasharray="3 2"
      strokeOpacity={0.6}
      fill="none"
    />

    {/* X through void — two diagonals */}
    <line x1="12" y1="12" x2="36" y2="36" strokeWidth={1.5} strokeOpacity={0.55} />
    <line x1="36" y1="12" x2="12" y2="36" strokeWidth={1.5} strokeOpacity={0.55} />
  </>,
);

// ── CurtainPanelHifi: curtain wall panel, plan cross-section ─────────────────
export const CurtainPanelHifi = bimIconHifi(
  'CurtainPanelHifi',
  <>
    {/* Exterior glass face — glass fill */}
    <rect
      x="6"
      y="18"
      width="36"
      height="4"
      style={{ fill: 'var(--hi-glass, currentColor)', fillOpacity: 'var(--hi-glass-op, 0.35)' }}
    />
    <rect x="6" y="18" width="36" height="4" strokeWidth={2} fill="none" />

    {/* Air gap between panes */}
    <rect
      x="6"
      y="22"
      width="36"
      height="4"
      style={{ fill: 'var(--hi-room, currentColor)', fillOpacity: 'var(--hi-room-op, 0.20)' }}
      strokeWidth={0.75}
      strokeOpacity={0.4}
    />

    {/* Interior glass face — glass fill, slightly lighter */}
    <rect
      x="6"
      y="26"
      width="36"
      height="4"
      style={{ fill: 'var(--hi-glass, currentColor)', fillOpacity: 'var(--hi-glass-op, 0.22)' }}
    />
    <rect x="6" y="26" width="36" height="4" strokeWidth={1.5} fill="none" />

    {/* Left frame edge — steel mullion cap */}
    <rect
      x="4"
      y="16"
      width="4"
      height="18"
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.35)' }}
    />
    <rect x="4" y="16" width="4" height="18" strokeWidth={1.5} fill="none" />

    {/* Right frame edge — steel mullion cap */}
    <rect
      x="40"
      y="16"
      width="4"
      height="18"
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.35)' }}
    />
    <rect x="40" y="16" width="4" height="18" strokeWidth={1.5} fill="none" />

    {/* Shadow reveal at left edge */}
    <line x1="8" y1="18" x2="8" y2="30" strokeWidth={0.75} strokeOpacity={0.4} />
    {/* Shadow reveal at right edge */}
    <line x1="40" y1="18" x2="40" y2="30" strokeWidth={0.75} strokeOpacity={0.4} />

    {/* Glass pane reflection glint lines */}
    <line x1="12" y1="19" x2="20" y2="19" strokeWidth={0.75} strokeOpacity={0.4} />
    <line x1="12" y1="27" x2="20" y2="27" strokeWidth={0.75} strokeOpacity={0.3} />

    {/* Depth dimension ticks */}
    <line x1="47" y1="18" x2="47" y2="30" strokeWidth={0.75} strokeOpacity={0.5} />
    <line x1="45" y1="18" x2="47" y2="18" strokeWidth={0.75} strokeOpacity={0.5} />
    <line x1="45" y1="30" x2="47" y2="30" strokeWidth={0.75} strokeOpacity={0.5} />
  </>,
);

// ── MullionHifi: curtain wall mullion cross-section, plan view ───────────────
export const MullionHifi = bimIconHifi(
  'MullionHifi',
  <>
    {/* Glass panel stub — left side */}
    <rect
      x="4"
      y="20"
      width="14"
      height="8"
      style={{ fill: 'var(--hi-glass, currentColor)', fillOpacity: 'var(--hi-glass-op, 0.30)' }}
    />
    <rect x="4" y="20" width="14" height="8" strokeWidth={1.5} fill="none" />

    {/* Glass panel stub — right side */}
    <rect
      x="30"
      y="20"
      width="14"
      height="8"
      style={{ fill: 'var(--hi-glass, currentColor)', fillOpacity: 'var(--hi-glass-op, 0.30)' }}
    />
    <rect x="30" y="20" width="14" height="8" strokeWidth={1.5} fill="none" />

    {/* Mullion flanges gripping glass — left flange */}
    <rect
      x="16"
      y="18"
      width="4"
      height="12"
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.40)' }}
    />
    <rect x="16" y="18" width="4" height="12" strokeWidth={1.5} fill="none" />

    {/* Mullion flanges gripping glass — right flange */}
    <rect
      x="28"
      y="18"
      width="4"
      height="12"
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.40)' }}
    />
    <rect x="28" y="18" width="4" height="12" strokeWidth={1.5} fill="none" />

    {/* Mullion core body — steel, distinct opacity */}
    <rect
      x="20"
      y="16"
      width="8"
      height="16"
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.60)' }}
    />
    <rect x="20" y="16" width="8" height="16" strokeWidth={2} fill="none" />

    {/* Thermal break line through core */}
    <line
      x1="20"
      y1="24"
      x2="28"
      y2="24"
      strokeWidth={0.75}
      strokeDasharray="2 2"
      strokeOpacity={0.5}
    />

    {/* Gasket detail lines between flange and glass */}
    <line x1="18" y1="20" x2="18" y2="28" strokeWidth={0.75} strokeOpacity={0.4} />
    <line x1="30" y1="20" x2="30" y2="28" strokeWidth={0.75} strokeOpacity={0.4} />

    {/* Screw/fastener symbols in mullion core */}
    <circle cx="24" cy="20" r="1" strokeWidth={0.75} strokeOpacity={0.5} />
    <circle cx="24" cy="28" r="1" strokeWidth={0.75} strokeOpacity={0.5} />
  </>,
);

// ── SkyLightHifi: skylight in roof, elevation cross-section ──────────────────
export const SkyLightHifi = bimIconHifi(
  'SkyLightHifi',
  <>
    {/* Roof slope — left panel, terracotta fill */}
    <polygon
      points="4,42 20,14 20,42"
      style={{ fill: 'var(--hi-roof, currentColor)', fillOpacity: 'var(--hi-roof-op, 0.18)' }}
    />
    <line x1="4" y1="42" x2="20" y2="14" strokeWidth={2} />
    <line x1="20" y1="42" x2="4" y2="42" strokeWidth={2} />

    {/* Roof slope — right panel, terracotta fill */}
    <polygon
      points="28,14 44,42 28,42"
      style={{ fill: 'var(--hi-roof, currentColor)', fillOpacity: 'var(--hi-roof-op, 0.12)' }}
    />
    <line x1="28" y1="14" x2="44" y2="42" strokeWidth={2} />
    <line x1="44" y1="42" x2="28" y2="42" strokeWidth={2} />

    {/* Curb/frame — wood (leaf) or steel around skylight opening */}
    <rect
      x="18"
      y="14"
      width="12"
      height="28"
      style={{ fill: 'var(--hi-leaf, currentColor)' }}
      fillOpacity={0.2}
      strokeWidth={1.5}
    />

    {/* Outer glass pane — glass fill */}
    <rect
      x="20"
      y="16"
      width="8"
      height="10"
      style={{ fill: 'var(--hi-glass, currentColor)', fillOpacity: 'var(--hi-glass-op, 0.45)' }}
    />
    <rect x="20" y="16" width="8" height="10" strokeWidth={1.5} fill="none" />

    {/* Air gap between panes */}
    <rect
      x="20"
      y="26"
      width="8"
      height="3"
      style={{ fill: 'var(--hi-room, currentColor)', fillOpacity: 'var(--hi-room-op, 0.25)' }}
      strokeWidth={0.75}
      strokeOpacity={0.4}
    />

    {/* Inner glass pane */}
    <rect
      x="20"
      y="29"
      width="8"
      height="8"
      style={{ fill: 'var(--hi-glass, currentColor)', fillOpacity: 'var(--hi-glass-op, 0.30)' }}
    />
    <rect x="20" y="29" width="8" height="8" strokeWidth={1} fill="none" />

    {/* Rainwater drainage arrow — on right side of curb */}
    <line x1="30" y1="20" x2="34" y2="24" strokeWidth={1} strokeOpacity={0.6} />
    <polyline points="31,24 34,24 34,21" strokeWidth={1} strokeOpacity={0.6} fill="none" />

    {/* Roof hatch lines — left slope */}
    <g strokeWidth={0.75} strokeOpacity={0.25}>
      <line x1="7" y1="42" x2="16" y2="24" />
      <line x1="11" y1="42" x2="18" y2="30" />
      <line x1="15" y1="42" x2="19" y2="36" />
    </g>
    {/* Roof hatch lines — right slope */}
    <g strokeWidth={0.75} strokeOpacity={0.2}>
      <line x1="29" y1="22" x2="37" y2="42" />
      <line x1="29" y1="30" x2="41" y2="42" />
      <line x1="29" y1="36" x2="43" y2="42" />
    </g>
  </>,
);
