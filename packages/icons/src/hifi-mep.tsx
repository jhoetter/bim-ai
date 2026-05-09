/**
 * High-fidelity 48×48 MEP icons with multi-material fills.
 *
 * CSS custom properties (set on a wrapper element):
 *   --hi-concrete / --hi-concrete-op  — structural concrete
 *   --hi-finish   / --hi-finish-op    — plaster, insulation, casing
 *   --hi-glass    / --hi-glass-op     — glazing, transparent panels (water tint)
 *   --hi-steel    / --hi-steel-op     — steel, aluminum, galvanized metal, ductwork
 *   --hi-leaf                          — timber/organic fills (also: cable bundles)
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

// ── DuctRect: cross-section of a rectangular HVAC duct ───────────────────────
export const DuctRectHifi = bimIconHifi(
  'DuctRectHifi',
  <>
    {/* Insulation outer band */}
    <rect
      x="5"
      y="10"
      width="38"
      height="28"
      rx="1"
      style={{ fill: 'var(--hi-finish, currentColor)', fillOpacity: 'var(--hi-finish-op, 0.06)' }}
    />

    {/* Steel duct wall — outer rect fill (shown between outer and inner rect) */}
    <rect
      x="9"
      y="14"
      width="30"
      height="20"
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.18)' }}
    />

    {/* Air cavity (inner space) */}
    <rect
      x="13"
      y="18"
      width="22"
      height="12"
      style={{ fill: 'var(--hi-room, currentColor)', fillOpacity: 'var(--hi-room-op, 0.35)' }}
    />

    {/* Insulation outer boundary */}
    <rect x="5" y="10" width="38" height="28" rx="1" strokeWidth={0.75} strokeOpacity={0.4} />

    {/* Duct outer wall outline */}
    <rect x="9" y="14" width="30" height="20" strokeWidth={2} />

    {/* Duct inner wall line */}
    <rect x="13" y="18" width="22" height="12" strokeWidth={1} strokeOpacity={0.6} />

    {/* Airflow arrow inside cavity */}
    <line x1="17" y1="24" x2="31" y2="24" strokeWidth={1.5} />
    <polyline points="27,21 31,24 27,27" strokeWidth={1.5} />

    {/* Corner detail ticks on duct wall */}
    <line x1="9" y1="14" x2="13" y2="18" strokeWidth={0.75} strokeOpacity={0.5} />
    <line x1="39" y1="14" x2="35" y2="18" strokeWidth={0.75} strokeOpacity={0.5} />
    <line x1="9" y1="34" x2="13" y2="30" strokeWidth={0.75} strokeOpacity={0.5} />
    <line x1="39" y1="34" x2="35" y2="30" strokeWidth={0.75} strokeOpacity={0.5} />
  </>,
);

// ── DuctRound: cross-section of a round duct ──────────────────────────────────
export const DuctRoundHifi = bimIconHifi(
  'DuctRoundHifi',
  <>
    {/* Outer duct shell — steel fill */}
    <circle
      cx="24"
      cy="24"
      r="18"
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.18)' }}
    />

    {/* Air cavity */}
    <circle
      cx="24"
      cy="24"
      r="13"
      style={{ fill: 'var(--hi-room, currentColor)', fillOpacity: 'var(--hi-room-op, 0.45)' }}
    />

    {/* Outer outline */}
    <circle cx="24" cy="24" r="18" strokeWidth={2} />

    {/* Inner wall line */}
    <circle cx="24" cy="24" r="13" strokeWidth={1} strokeOpacity={0.7} />

    {/* Concentric rings suggesting cylindrical cross-section */}
    <circle cx="24" cy="24" r="16" strokeWidth={0.75} strokeOpacity={0.35} />
    <circle cx="24" cy="24" r="14.5" strokeWidth={0.75} strokeOpacity={0.25} />

    {/* Airflow arrow inside */}
    <line x1="16" y1="24" x2="30" y2="24" strokeWidth={1.5} />
    <polyline points="26,21 30,24 26,27" strokeWidth={1.5} />
  </>,
);

// ── Pipe: cross-section of a structural plumbing pipe ────────────────────────
export const PipeHifi = bimIconHifi(
  'PipeHifi',
  <>
    {/* Pipe body — steel, thick wall */}
    <circle
      cx="24"
      cy="21"
      r="17"
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.2)' }}
    />

    {/* Fluid void — glass tint for water */}
    <circle
      cx="24"
      cy="21"
      r="10"
      style={{ fill: 'var(--hi-glass, currentColor)', fillOpacity: 'var(--hi-glass-op, 0.25)' }}
    />

    {/* Pipe outer outline */}
    <circle cx="24" cy="21" r="17" strokeWidth={2} />

    {/* Inner bore line */}
    <circle cx="24" cy="21" r="10" strokeWidth={1.5} strokeOpacity={0.8} />

    {/* Wall hatch — diagonal lines in the pipe wall zone */}
    <g strokeWidth={0.75} strokeOpacity={0.3}>
      <line x1="9" y1="16" x2="14" y2="11" />
      <line x1="9" y1="22" x2="18" y2="11" />
      <line x1="11" y1="27" x2="22" y2="11" />
      <line x1="26" y1="10" x2="36" y2="12" />
      <line x1="32" y1="11" x2="39" y2="16" />
      <line x1="36" y1="15" x2="40" y2="22" />
      <line x1="9" y1="28" x2="14" y2="35" />
      <line x1="10" y1="24" x2="18" y2="34" />
      <line x1="30" y1="34" x2="38" y2="26" />
      <line x1="35" y1="32" x2="39" y2="27" />
    </g>

    {/* Centroid cross */}
    <line x1="24" y1="17" x2="24" y2="25" strokeWidth={0.75} strokeOpacity={0.5} />
    <line x1="20" y1="21" x2="28" y2="21" strokeWidth={0.75} strokeOpacity={0.5} />

    {/* Support / label line at bottom */}
    <line x1="18" y1="40" x2="30" y2="40" strokeWidth={1.5} />
    <line x1="24" y1="38" x2="24" y2="40" strokeWidth={1.5} />
  </>,
);

// ── CableTray: cross-section of an open-top cable tray ───────────────────────
export const CableTrayHifi = bimIconHifi(
  'CableTrayHifi',
  <>
    {/* Tray body fill — U-channel, steel */}
    <path
      d="M8 14 H40 V36 H36 V18 H12 V36 H8 Z"
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.15)' }}
    />

    {/* Cable bundle fills */}
    <circle
      cx="17"
      cy="28"
      r="4"
      style={{ fill: 'var(--hi-leaf, currentColor)' }}
      fillOpacity={0.45}
      strokeWidth={1}
    />
    <circle
      cx="24"
      cy="27"
      r="3.5"
      style={{
        fill: 'var(--hi-concrete, currentColor)',
        fillOpacity: 'var(--hi-concrete-op, 0.5)',
      }}
      strokeWidth={1}
    />
    <circle
      cx="31"
      cy="28"
      r="4"
      style={{ fill: 'var(--hi-leaf, currentColor)' }}
      fillOpacity={0.35}
      strokeWidth={1}
    />
    <circle
      cx="20"
      cy="22"
      r="3"
      style={{
        fill: 'var(--hi-concrete, currentColor)',
        fillOpacity: 'var(--hi-concrete-op, 0.4)',
      }}
      strokeWidth={1}
    />
    <circle
      cx="28"
      cy="22"
      r="3"
      style={{ fill: 'var(--hi-leaf, currentColor)' }}
      fillOpacity={0.3}
      strokeWidth={1}
    />

    {/* Tray outline — U-channel */}
    <path d="M8 14 H40 V36 H36 V18 H12 V36 H8 Z" strokeWidth={2} fill="none" />

    {/* Open top indicator — dashed line at top opening */}
    <line
      x1="12"
      y1="14"
      x2="36"
      y2="14"
      strokeWidth={1}
      strokeDasharray="3 2"
      strokeOpacity={0.5}
    />

    {/* Perforated bottom texture — short dashes */}
    <g strokeWidth={0.75} strokeOpacity={0.4}>
      <line x1="14" y1="35" x2="16" y2="35" />
      <line x1="18" y1="35" x2="20" y2="35" />
      <line x1="22" y1="35" x2="24" y2="35" />
      <line x1="26" y1="35" x2="28" y2="35" />
      <line x1="30" y1="35" x2="32" y2="35" />
      <line x1="34" y1="35" x2="36" y2="35" />
    </g>

    {/* Side perforations */}
    <g strokeWidth={0.75} strokeOpacity={0.3}>
      <line x1="8" y1="20" x2="8" y2="22" />
      <line x1="8" y1="25" x2="8" y2="27" />
      <line x1="8" y1="30" x2="8" y2="32" />
      <line x1="40" y1="20" x2="40" y2="22" />
      <line x1="40" y1="25" x2="40" y2="27" />
      <line x1="40" y1="30" x2="40" y2="32" />
    </g>
  </>,
);

// ── MechanicalEquipment: elevation of an HVAC rooftop unit ───────────────────
export const MechanicalEquipmentHifi = bimIconHifi(
  'MechanicalEquipmentHifi',
  <>
    {/* Concrete mounting base */}
    <rect
      x="5"
      y="40"
      width="38"
      height="4"
      style={{
        fill: 'var(--hi-concrete, currentColor)',
        fillOpacity: 'var(--hi-concrete-op, 0.15)',
      }}
    />
    <rect x="5" y="40" width="38" height="4" strokeWidth={1.5} fill="none" />

    {/* Main body — steel */}
    <rect
      x="9"
      y="16"
      width="30"
      height="24"
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.14)' }}
    />
    <rect x="9" y="16" width="30" height="24" strokeWidth={2} fill="none" />

    {/* Supply duct stub — left side */}
    <rect
      x="4"
      y="22"
      width="5"
      height="8"
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.2)' }}
    />
    <rect x="4" y="22" width="5" height="8" strokeWidth={1.5} fill="none" />
    {/* Supply label arrow */}
    <line x1="4" y1="26" x2="2" y2="26" strokeWidth={1} strokeOpacity={0.5} />

    {/* Return duct stub — right side */}
    <rect
      x="39"
      y="22"
      width="5"
      height="8"
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.2)' }}
    />
    <rect x="39" y="22" width="5" height="8" strokeWidth={1.5} fill="none" />
    <line x1="44" y1="26" x2="46" y2="26" strokeWidth={1} strokeOpacity={0.5} />

    {/* Control panel / access door — finish fill with handle */}
    <rect
      x="15"
      y="21"
      width="10"
      height="14"
      style={{ fill: 'var(--hi-finish, currentColor)', fillOpacity: 'var(--hi-finish-op, 0.4)' }}
    />
    <rect x="15" y="21" width="10" height="14" strokeWidth={1} fill="none" />
    {/* Door handle */}
    <line x1="22" y1="27" x2="22" y2="30" strokeWidth={1.5} />

    {/* Fan grill on top — circle with cross */}
    <circle cx="30" cy="12" r="6" strokeWidth={1.5} />
    <line x1="30" y1="6" x2="30" y2="18" strokeWidth={0.75} strokeOpacity={0.6} />
    <line x1="24" y1="12" x2="36" y2="12" strokeWidth={0.75} strokeOpacity={0.6} />
    <circle cx="30" cy="12" r="2" strokeWidth={1} />

    {/* Mounting tabs from unit to base */}
    <line x1="12" y1="40" x2="12" y2="40" strokeWidth={1.5} />
    <line x1="10" y1="40" x2="10" y2="38" strokeWidth={1} strokeOpacity={0.5} />
    <line x1="38" y1="40" x2="38" y2="38" strokeWidth={1} strokeOpacity={0.5} />

    {/* Detail lines — horizontal panel seam */}
    <line x1="9" y1="33" x2="39" y2="33" strokeWidth={0.75} strokeOpacity={0.4} />
  </>,
);

// ── PlumbingFixture: plan view of a washbasin / sink ─────────────────────────
export const PlumbingFixtureHifi = bimIconHifi(
  'PlumbingFixtureHifi',
  <>
    {/* Basin body — finish fill, oval rounded-rect */}
    <rect
      x="8"
      y="12"
      width="32"
      height="28"
      rx="12"
      ry="10"
      style={{ fill: 'var(--hi-finish, currentColor)', fillOpacity: 'var(--hi-finish-op, 0.35)' }}
    />
    {/* Basin inner bowl — slightly inset */}
    <rect
      x="12"
      y="16"
      width="24"
      height="20"
      rx="9"
      ry="7"
      style={{ fill: 'var(--hi-glass, currentColor)', fillOpacity: 'var(--hi-glass-op, 0.12)' }}
    />

    {/* Basin outer outline */}
    <rect x="8" y="12" width="32" height="28" rx="12" ry="10" strokeWidth={2} fill="none" />
    {/* Inner bowl outline */}
    <rect
      x="12"
      y="16"
      width="24"
      height="20"
      rx="9"
      ry="7"
      strokeWidth={1}
      strokeOpacity={0.7}
      fill="none"
    />

    {/* Drain — small circle at center */}
    <circle cx="24" cy="26" r="2.5" strokeWidth={1.5} />
    <circle cx="24" cy="26" r="1" fill="currentColor" stroke="none" fillOpacity={0.4} />

    {/* Faucet — two tap circles near back */}
    <circle cx="19" cy="17" r="2" strokeWidth={1.5} />
    <circle cx="29" cy="17" r="2" strokeWidth={1.5} />
    {/* Faucet connecting arc */}
    <path d="M19 17 Q24 13 29 17" strokeWidth={1.5} fill="none" />
    {/* Faucet spout drop */}
    <line x1="24" y1="13" x2="24" y2="19" strokeWidth={1} strokeOpacity={0.6} />

    {/* Overflow slot near top of bowl */}
    <rect x="21" y="15" width="6" height="2" rx="1" strokeWidth={0.75} strokeOpacity={0.6} />

    {/* Waste pipe connection at bottom */}
    <line x1="22" y1="40" x2="22" y2="44" strokeWidth={1.5} />
    <line x1="26" y1="40" x2="26" y2="44" strokeWidth={1.5} />
  </>,
);

// ── LightingFixture: reflected ceiling plan of a recessed luminaire ───────────
export const LightingFixtureHifi = bimIconHifi(
  'LightingFixtureHifi',
  <>
    {/* Ceiling opening / metal trim — steel fill */}
    <rect
      x="8"
      y="8"
      width="32"
      height="32"
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.15)' }}
    />

    {/* Lamp face / light emitting surface — glass/room fill */}
    <rect
      x="13"
      y="13"
      width="22"
      height="22"
      style={{ fill: 'var(--hi-room, currentColor)', fillOpacity: 'var(--hi-room-op, 0.6)' }}
    />

    {/* Trim outer outline */}
    <rect x="8" y="8" width="32" height="32" strokeWidth={2} fill="none" />
    {/* Lamp face outline */}
    <rect x="13" y="13" width="22" height="22" strokeWidth={1.5} fill="none" />

    {/* Bulb symbol — center circle */}
    <circle cx="24" cy="24" r="3" strokeWidth={1.5} />
    <circle cx="24" cy="24" r="1" fill="currentColor" stroke="none" fillOpacity={0.5} />

    {/* Beam spread — diagonal lines from corners of lamp face */}
    <g strokeWidth={0.75} strokeOpacity={0.4}>
      <line x1="13" y1="13" x2="6" y2="6" />
      <line x1="35" y1="13" x2="42" y2="6" />
      <line x1="13" y1="35" x2="6" y2="42" />
      <line x1="35" y1="35" x2="42" y2="42" />
    </g>

    {/* Trim detail — inner reveal lines */}
    <line x1="8" y1="8" x2="13" y2="13" strokeWidth={0.75} strokeOpacity={0.5} />
    <line x1="40" y1="8" x2="35" y2="13" strokeWidth={0.75} strokeOpacity={0.5} />
    <line x1="8" y1="40" x2="13" y2="35" strokeWidth={0.75} strokeOpacity={0.5} />
    <line x1="40" y1="40" x2="35" y2="35" strokeWidth={0.75} strokeOpacity={0.5} />
  </>,
);

// ── MepSpace: plan view of an MEP zone / space boundary ──────────────────────
export const MepSpaceHifi = bimIconHifi(
  'MepSpaceHifi',
  <>
    {/* MEP zone fill — room fill, technical feel */}
    <rect
      x="5"
      y="5"
      width="38"
      height="38"
      rx="3"
      style={{ fill: 'var(--hi-room, currentColor)', fillOpacity: 'var(--hi-room-op, 0.3)' }}
    />

    {/* Zone boundary — dashed / dotted perimeter */}
    <rect
      x="5"
      y="5"
      width="38"
      height="38"
      rx="3"
      strokeWidth={1.5}
      strokeDasharray="4 3"
      fill="none"
    />

    {/* Air supply diffuser symbol — centered */}
    {/* Diffuser rectangle body — steel */}
    <rect
      x="18"
      y="19"
      width="12"
      height="8"
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.25)' }}
    />
    <rect x="18" y="19" width="12" height="8" strokeWidth={1.5} fill="none" />
    {/* Diffuser louver lines */}
    <g strokeWidth={0.75} strokeOpacity={0.5}>
      <line x1="21" y1="19" x2="21" y2="27" />
      <line x1="24" y1="19" x2="24" y2="27" />
      <line x1="27" y1="19" x2="27" y2="27" />
    </g>
    {/* Supply air arrow pointing down into space */}
    <line x1="24" y1="12" x2="24" y2="19" strokeWidth={1.5} />
    <polyline points="21,16 24,19 27,16" strokeWidth={1.5} />

    {/* Thermostat symbol — small circle in corner */}
    <circle cx="38" cy="38" r="4" strokeWidth={1.5} />
    <circle cx="38" cy="38" r="1.5" strokeWidth={0.75} strokeOpacity={0.6} />

    {/* Zone label baseline */}
    <line x1="10" y1="36" x2="16" y2="36" strokeWidth={1} strokeOpacity={0.4} />
    <line x1="10" y1="38" x2="14" y2="38" strokeWidth={1} strokeOpacity={0.3} />
  </>,
);
