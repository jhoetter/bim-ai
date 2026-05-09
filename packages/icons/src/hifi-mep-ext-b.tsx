/**
 * High-fidelity 48×48 MEP icons — extended set B (electrical, fire, data, security, HVAC).
 *
 * CSS custom properties (set on a wrapper element):
 *   --hi-concrete / --hi-concrete-op  — structural concrete (stone gray)
 *   --hi-finish   / --hi-finish-op    — plaster, casing, switch plates (warm white)
 *   --hi-glass    / --hi-glass-op     — glazing, transparent, data cable (sky blue)
 *   --hi-steel    / --hi-steel-op     — steel, aluminum, rack frames (blue-gray)
 *   --hi-leaf                          — timber/organic fills (amber, no opacity var)
 *   --hi-roof     / --hi-roof-op      — roof surface / alert / alarm color (terracotta)
 *   --hi-room     / --hi-room-op      — interior zone / air space fill (pale yellow)
 *
 * Without variables the icons render in monochrome currentColor.
 *
 * Stroke hierarchy:
 *   strokeWidth 2    — primary outlines
 *   strokeWidth 1.5  — secondary edges, reveals
 *   strokeWidth 0.75 — hatch, detail lines
 */
import { bimIconHifi } from './icon';

// ── SwitchSystemHifi — rocker switch plate on wall with circuit lines ─────────
export const SwitchSystemHifi = bimIconHifi(
  'SwitchSystemHifi',
  <>
    {/* Wall surface — concrete fill */}
    <rect
      x="4"
      y="4"
      width="40"
      height="40"
      style={{
        fill: 'var(--hi-concrete, currentColor)',
        fillOpacity: 'var(--hi-concrete-op, 0.07)',
      }}
    />
    <rect x="4" y="4" width="40" height="40" strokeWidth={0.75} strokeOpacity={0.25} fill="none" />

    {/* Switch plate — finish fill */}
    <rect
      x="14"
      y="10"
      width="20"
      height="28"
      rx="2"
      style={{
        fill: 'var(--hi-finish, currentColor)',
        fillOpacity: 'var(--hi-finish-op, 0.07)',
      }}
    />
    <rect x="14" y="10" width="20" height="28" rx="2" strokeWidth={2} fill="none" />

    {/* Rocker switch body */}
    <rect x="17" y="14" width="14" height="20" rx="1" strokeWidth={1.5} fill="none" />

    {/* Rocker pivot line */}
    <line x1="17" y1="24" x2="31" y2="24" strokeWidth={1} strokeOpacity={0.6} />

    {/* Switch symbol — ON half (upper) */}
    <line x1="24" y1="16" x2="24" y2="22" strokeWidth={1.5} />
    <circle cx="24" cy="22" r="1.5" strokeWidth={1} />

    {/* Circuit lines branching to 3 outlets below plate */}
    <line x1="24" y1="38" x2="24" y2="44" strokeWidth={1.5} />
    <line x1="14" y1="42" x2="34" y2="42" strokeWidth={1} strokeOpacity={0.7} />
    {/* Left outlet */}
    <circle cx="14" cy="42" r="2" strokeWidth={1.5} />
    {/* Center outlet */}
    <circle cx="24" cy="44" r="2" strokeWidth={1.5} />
    {/* Right outlet */}
    <circle cx="34" cy="42" r="2" strokeWidth={1.5} />

    {/* Screw details on plate corners */}
    <circle cx="16" cy="12" r="1" strokeWidth={0.75} strokeOpacity={0.5} />
    <circle cx="32" cy="12" r="1" strokeWidth={0.75} strokeOpacity={0.5} />
    <circle cx="16" cy="36" r="1" strokeWidth={0.75} strokeOpacity={0.5} />
    <circle cx="32" cy="36" r="1" strokeWidth={0.75} strokeOpacity={0.5} />
  </>,
);

// ── LightingSwitchHifi — toggle switch body with wall plate and bulb schematic ─
export const LightingSwitchHifi = bimIconHifi(
  'LightingSwitchHifi',
  <>
    {/* Concrete wall background */}
    <rect
      x="4"
      y="4"
      width="40"
      height="40"
      style={{
        fill: 'var(--hi-concrete, currentColor)',
        fillOpacity: 'var(--hi-concrete-op, 0.07)',
      }}
    />
    <rect x="4" y="4" width="40" height="40" strokeWidth={0.75} strokeOpacity={0.2} fill="none" />

    {/* Wall plate — finish fill */}
    <rect
      x="12"
      y="8"
      width="16"
      height="26"
      rx="2"
      style={{
        fill: 'var(--hi-finish, currentColor)',
        fillOpacity: 'var(--hi-finish-op, 0.07)',
      }}
    />
    <rect x="12" y="8" width="16" height="26" rx="2" strokeWidth={2} fill="none" />

    {/* Toggle switch lever — ON position (angled up-left) */}
    <line x1="20" y1="22" x2="16" y2="14" strokeWidth={2} strokeLinecap="round" />
    {/* Toggle pivot circle */}
    <circle cx="20" cy="22" r="2.5" strokeWidth={1.5} />

    {/* ON label indicator (top region) */}
    <line x1="15" y1="12" x2="19" y2="12" strokeWidth={0.75} strokeOpacity={0.5} />

    {/* OFF label indicator (lower region) */}
    <line x1="15" y1="28" x2="25" y2="28" strokeWidth={0.75} strokeOpacity={0.5} />
    <line x1="15" y1="30" x2="23" y2="30" strokeWidth={0.75} strokeOpacity={0.4} />

    {/* Screw holes on plate */}
    <circle cx="14" cy="10" r="1" strokeWidth={0.75} strokeOpacity={0.5} />
    <circle cx="26" cy="10" r="1" strokeWidth={0.75} strokeOpacity={0.5} />
    <circle cx="14" cy="32" r="1" strokeWidth={0.75} strokeOpacity={0.5} />
    <circle cx="26" cy="32" r="1" strokeWidth={0.75} strokeOpacity={0.5} />

    {/* Light bulb schematic — right side */}
    {/* Bulb globe */}
    <circle cx="36" cy="20" r="7" strokeWidth={1.5} fill="none" />
    {/* Filament */}
    <path d="M33 20 Q34 17 36 19 Q38 17 39 20" strokeWidth={1} strokeOpacity={0.7} fill="none" />
    {/* Bulb base */}
    <line x1="33" y1="27" x2="39" y2="27" strokeWidth={1.5} />
    <line x1="34" y1="29" x2="38" y2="29" strokeWidth={1.5} />

    {/* Connection line from switch to bulb */}
    <line
      x1="28"
      y1="21"
      x2="29"
      y2="21"
      strokeWidth={1}
      strokeOpacity={0.5}
      strokeDasharray="2 2"
    />
    <line x1="30" y1="21" x2="29" y2="21" strokeWidth={1} strokeOpacity={0.5} />
  </>,
);

// ── CommunicationDeviceHifi — wall data port plate with RJ45 and cable wires ──
export const CommunicationDeviceHifi = bimIconHifi(
  'CommunicationDeviceHifi',
  <>
    {/* Concrete wall background */}
    <rect
      x="4"
      y="4"
      width="40"
      height="40"
      style={{
        fill: 'var(--hi-concrete, currentColor)',
        fillOpacity: 'var(--hi-concrete-op, 0.07)',
      }}
    />
    <rect x="4" y="4" width="40" height="40" strokeWidth={0.75} strokeOpacity={0.2} fill="none" />

    {/* Port plate — finish fill */}
    <rect
      x="10"
      y="10"
      width="28"
      height="28"
      rx="2"
      style={{
        fill: 'var(--hi-finish, currentColor)',
        fillOpacity: 'var(--hi-finish-op, 0.07)',
      }}
    />
    <rect x="10" y="10" width="28" height="28" rx="2" strokeWidth={2} fill="none" />

    {/* RJ45 jack body */}
    <rect x="16" y="16" width="16" height="12" rx="1" strokeWidth={1.5} fill="none" />

    {/* RJ45 jack opening */}
    <rect
      x="18"
      y="18"
      width="12"
      height="8"
      rx="1"
      strokeWidth={0.75}
      strokeOpacity={0.6}
      fill="none"
    />

    {/* RJ45 contact pins (8 pins) */}
    <g strokeWidth={0.75} strokeOpacity={0.7}>
      <line x1="19" y1="18" x2="19" y2="24" />
      <line x1="20.5" y1="18" x2="20.5" y2="24" />
      <line x1="22" y1="18" x2="22" y2="24" />
      <line x1="23.5" y1="18" x2="23.5" y2="24" />
      <line x1="25" y1="18" x2="25" y2="24" />
      <line x1="26.5" y1="18" x2="26.5" y2="24" />
      <line x1="28" y1="18" x2="28" y2="24" />
      <line x1="29.5" y1="18" x2="29.5" y2="24" />
    </g>

    {/* CAT6 label below jack */}
    <line x1="16" y1="32" x2="32" y2="32" strokeWidth={0.75} strokeOpacity={0.4} />
    <line x1="18" y1="34" x2="30" y2="34" strokeWidth={0.75} strokeOpacity={0.3} />

    {/* Cable end color wires — glass fill wire */}
    <rect
      x="20"
      y="36"
      width="4"
      height="6"
      rx="1"
      style={{
        fill: 'var(--hi-glass, currentColor)',
        fillOpacity: 'var(--hi-glass-op, 0.07)',
      }}
      strokeWidth={0.75}
    />
    {/* Roof-fill wire */}
    <rect
      x="26"
      y="36"
      width="4"
      height="6"
      rx="1"
      style={{
        fill: 'var(--hi-roof, currentColor)',
        fillOpacity: 'var(--hi-roof-op, 0.07)',
      }}
      strokeWidth={0.75}
    />

    {/* Plate screws */}
    <circle cx="12" cy="12" r="1" strokeWidth={0.75} strokeOpacity={0.5} />
    <circle cx="36" cy="12" r="1" strokeWidth={0.75} strokeOpacity={0.5} />
    <circle cx="12" cy="36" r="1" strokeWidth={0.75} strokeOpacity={0.5} />
    <circle cx="36" cy="36" r="1" strokeWidth={0.75} strokeOpacity={0.5} />
  </>,
);

// ── FireAlarmDeviceHifi — round smoke detector with alarm ring, mount, flash ───
export const FireAlarmDeviceHifi = bimIconHifi(
  'FireAlarmDeviceHifi',
  <>
    {/* Ceiling / mounting plate — concrete fill */}
    <rect
      x="8"
      y="6"
      width="32"
      height="6"
      rx="1"
      style={{
        fill: 'var(--hi-concrete, currentColor)',
        fillOpacity: 'var(--hi-concrete-op, 0.07)',
      }}
    />
    <rect x="8" y="6" width="32" height="6" rx="1" strokeWidth={1.5} fill="none" />

    {/* Detector body — finish fill, circular */}
    <circle
      cx="24"
      cy="28"
      r="14"
      style={{
        fill: 'var(--hi-finish, currentColor)',
        fillOpacity: 'var(--hi-finish-op, 0.07)',
      }}
    />
    <circle cx="24" cy="28" r="14" strokeWidth={2} fill="none" />

    {/* Alarm indicator ring — roof/alert fill */}
    <circle
      cx="24"
      cy="28"
      r="9"
      style={{
        fill: 'var(--hi-roof, currentColor)',
        fillOpacity: 'var(--hi-roof-op, 0.07)',
      }}
    />
    <circle cx="24" cy="28" r="9" strokeWidth={1.5} fill="none" />

    {/* Mounting stem from ceiling plate to detector */}
    <line x1="24" y1="12" x2="24" y2="14" strokeWidth={1.5} />

    {/* Smoke chamber vents — radial slots on detector body */}
    <g strokeWidth={0.75} strokeOpacity={0.5}>
      <line x1="11" y1="28" x2="15" y2="28" />
      <line x1="33" y1="28" x2="37" y2="28" />
      <line x1="24" y1="15" x2="24" y2="19" />
      <line x1="24" y1="37" x2="24" y2="41" />
      <line x1="14.4" y1="18.4" x2="17.2" y2="21.2" />
      <line x1="30.8" y1="34.8" x2="33.6" y2="37.6" />
      <line x1="33.6" y1="18.4" x2="30.8" y2="21.2" />
      <line x1="17.2" y1="34.8" x2="14.4" y2="37.6" />
    </g>

    {/* Alarm flash symbol — lightning bolt in center */}
    <polyline points="26,21 22,27 25,27 22,35" strokeWidth={1.5} fill="none" />

    {/* LED indicator dot */}
    <circle cx="30" cy="23" r="1.5" strokeWidth={1} />
  </>,
);

// ── DataDeviceHifi — rack-mounted device with port array and status LEDs ───────
export const DataDeviceHifi = bimIconHifi(
  'DataDeviceHifi',
  <>
    {/* Rack ears / mounting rails — steel fill */}
    <rect
      x="4"
      y="10"
      width="6"
      height="28"
      style={{
        fill: 'var(--hi-steel, currentColor)',
        fillOpacity: 'var(--hi-steel-op, 0.07)',
      }}
    />
    <rect x="4" y="10" width="6" height="28" strokeWidth={1.5} fill="none" />
    <rect
      x="38"
      y="10"
      width="6"
      height="28"
      style={{
        fill: 'var(--hi-steel, currentColor)',
        fillOpacity: 'var(--hi-steel-op, 0.07)',
      }}
    />
    <rect x="38" y="10" width="6" height="28" strokeWidth={1.5} fill="none" />

    {/* Front panel body — steel fill */}
    <rect
      x="10"
      y="14"
      width="28"
      height="20"
      style={{
        fill: 'var(--hi-steel, currentColor)',
        fillOpacity: 'var(--hi-steel-op, 0.07)',
      }}
    />
    <rect x="10" y="14" width="28" height="20" strokeWidth={2} fill="none" />

    {/* Port array — 8 network ports in 2 rows */}
    <g strokeWidth={0.75} strokeOpacity={0.6}>
      {/* Row 1 */}
      <rect x="13" y="17" width="4" height="3" rx="0.5" />
      <rect x="19" y="17" width="4" height="3" rx="0.5" />
      <rect x="25" y="17" width="4" height="3" rx="0.5" />
      <rect x="31" y="17" width="4" height="3" rx="0.5" />
      {/* Row 2 */}
      <rect x="13" y="22" width="4" height="3" rx="0.5" />
      <rect x="19" y="22" width="4" height="3" rx="0.5" />
      <rect x="25" y="22" width="4" height="3" rx="0.5" />
      <rect x="31" y="22" width="4" height="3" rx="0.5" />
    </g>

    {/* Status LEDs — glass (active) and roof (alert) dots */}
    <circle
      cx="14"
      cy="28"
      r="1.5"
      style={{
        fill: 'var(--hi-glass, currentColor)',
        fillOpacity: 'var(--hi-glass-op, 0.07)',
      }}
      strokeWidth={1}
    />
    <circle
      cx="18"
      cy="28"
      r="1.5"
      style={{
        fill: 'var(--hi-glass, currentColor)',
        fillOpacity: 'var(--hi-glass-op, 0.07)',
      }}
      strokeWidth={1}
    />
    <circle
      cx="22"
      cy="28"
      r="1.5"
      style={{
        fill: 'var(--hi-roof, currentColor)',
        fillOpacity: 'var(--hi-roof-op, 0.07)',
      }}
      strokeWidth={1}
    />
    <circle
      cx="26"
      cy="28"
      r="1.5"
      style={{
        fill: 'var(--hi-glass, currentColor)',
        fillOpacity: 'var(--hi-glass-op, 0.07)',
      }}
      strokeWidth={1}
    />

    {/* Network uplink lines at bottom */}
    <line
      x1="16"
      y1="34"
      x2="16"
      y2="40"
      strokeWidth={1}
      strokeOpacity={0.5}
      strokeDasharray="2 2"
    />
    <line
      x1="24"
      y1="34"
      x2="24"
      y2="40"
      strokeWidth={1}
      strokeOpacity={0.5}
      strokeDasharray="2 2"
    />
    <line
      x1="32"
      y1="34"
      x2="32"
      y2="40"
      strokeWidth={1}
      strokeOpacity={0.5}
      strokeDasharray="2 2"
    />
    <line x1="12" y1="40" x2="36" y2="40" strokeWidth={1} strokeOpacity={0.4} />

    {/* Rack mounting screws */}
    <circle cx="7" cy="16" r="1" strokeWidth={0.75} strokeOpacity={0.5} />
    <circle cx="7" cy="32" r="1" strokeWidth={0.75} strokeOpacity={0.5} />
    <circle cx="41" cy="16" r="1" strokeWidth={0.75} strokeOpacity={0.5} />
    <circle cx="41" cy="32" r="1" strokeWidth={0.75} strokeOpacity={0.5} />
  </>,
);

// ── NurseCallHifi — wall nurse-call unit with call button, speaker, cord ───────
export const NurseCallHifi = bimIconHifi(
  'NurseCallHifi',
  <>
    {/* Concrete wall surface */}
    <rect
      x="4"
      y="4"
      width="40"
      height="40"
      style={{
        fill: 'var(--hi-concrete, currentColor)',
        fillOpacity: 'var(--hi-concrete-op, 0.07)',
      }}
    />
    <rect x="4" y="4" width="40" height="40" strokeWidth={0.75} strokeOpacity={0.2} fill="none" />

    {/* Wall unit body — finish fill */}
    <rect
      x="12"
      y="8"
      width="24"
      height="30"
      rx="3"
      style={{
        fill: 'var(--hi-finish, currentColor)',
        fillOpacity: 'var(--hi-finish-op, 0.07)',
      }}
    />
    <rect x="12" y="8" width="24" height="30" rx="3" strokeWidth={2} fill="none" />

    {/* Nurse call button — roof/alert fill circle */}
    <circle
      cx="24"
      cy="18"
      r="7"
      style={{
        fill: 'var(--hi-roof, currentColor)',
        fillOpacity: 'var(--hi-roof-op, 0.07)',
      }}
    />
    <circle cx="24" cy="18" r="7" strokeWidth={2} fill="none" />
    {/* Button inner press marker */}
    <circle cx="24" cy="18" r="3.5" strokeWidth={1} strokeOpacity={0.6} fill="none" />

    {/* Speaker grille slots */}
    <g strokeWidth={0.75} strokeOpacity={0.5}>
      <line x1="17" y1="28" x2="31" y2="28" />
      <line x1="17" y1="30" x2="31" y2="30" />
      <line x1="17" y1="32" x2="31" y2="32" />
    </g>

    {/* Unit bottom edge detail */}
    <line x1="14" y1="36" x2="34" y2="36" strokeWidth={0.75} strokeOpacity={0.4} />

    {/* Call cord — exits bottom of unit */}
    <path
      d="M24 38 Q24 43 20 44 Q16 45 16 44"
      strokeWidth={1.5}
      fill="none"
      strokeDasharray="3 1.5"
    />
    {/* Cord button end */}
    <circle cx="16" cy="44" r="2" strokeWidth={1.5} />
  </>,
);

// ── SecurityDeviceHifi — security camera on ceiling mount with coverage cone ───
export const SecurityDeviceHifi = bimIconHifi(
  'SecurityDeviceHifi',
  <>
    {/* Ceiling mount bracket — concrete fill */}
    <rect
      x="16"
      y="4"
      width="16"
      height="6"
      rx="1"
      style={{
        fill: 'var(--hi-concrete, currentColor)',
        fillOpacity: 'var(--hi-concrete-op, 0.07)',
      }}
    />
    <rect x="16" y="4" width="16" height="6" rx="1" strokeWidth={1.5} fill="none" />

    {/* Mounting arm */}
    <line x1="24" y1="10" x2="24" y2="14" strokeWidth={2} />

    {/* Camera body — steel fill */}
    <rect
      x="10"
      y="14"
      width="22"
      height="12"
      rx="3"
      style={{
        fill: 'var(--hi-steel, currentColor)',
        fillOpacity: 'var(--hi-steel-op, 0.07)',
      }}
    />
    <rect x="10" y="14" width="22" height="12" rx="3" strokeWidth={2} fill="none" />

    {/* Lens circle — glass fill */}
    <circle
      cx="14"
      cy="20"
      r="4"
      style={{
        fill: 'var(--hi-glass, currentColor)',
        fillOpacity: 'var(--hi-glass-op, 0.07)',
      }}
    />
    <circle cx="14" cy="20" r="4" strokeWidth={1.5} fill="none" />
    {/* Lens inner highlight */}
    <circle cx="14" cy="20" r="1.5" strokeWidth={0.75} strokeOpacity={0.5} />

    {/* IR ring dashes around lens */}
    <g strokeWidth={0.75} strokeOpacity={0.4} strokeDasharray="1.5 2">
      <circle cx="14" cy="20" r="6.5" />
    </g>

    {/* Camera adjustment knob at rear */}
    <circle cx="30" cy="20" r="2" strokeWidth={1} strokeOpacity={0.7} />

    {/* Coverage cone — field of view triangle */}
    <path d="M10 20 L4 34 L4 42 L4 34" strokeWidth={0.75} strokeOpacity={0.3} fill="none" />
    <path d="M10 20 L4 42 L-2 44" strokeWidth={0} fill="none" />
    {/* Cone lines */}
    <line
      x1="10"
      y1="17"
      x2="2"
      y2="38"
      strokeWidth={0.75}
      strokeOpacity={0.35}
      strokeDasharray="3 2"
    />
    <line
      x1="10"
      y1="23"
      x2="2"
      y2="44"
      strokeWidth={0.75}
      strokeOpacity={0.35}
      strokeDasharray="3 2"
    />
    {/* Cone arc */}
    <path d="M2 38 Q1 41 2 44" strokeWidth={0.75} strokeOpacity={0.35} fill="none" />

    {/* Cable from camera body */}
    <line
      x1="32"
      y1="20"
      x2="44"
      y2="20"
      strokeWidth={1}
      strokeOpacity={0.5}
      strokeDasharray="2 2"
    />
  </>,
);

// ── HVACZoneHifi — floor plan room with thermostat and zone boundary ───────────
export const HVACZoneHifi = bimIconHifi(
  'HVACZoneHifi',
  <>
    {/* Room zone fill — room CSS var */}
    <rect
      x="4"
      y="4"
      width="40"
      height="40"
      rx="1"
      style={{
        fill: 'var(--hi-room, currentColor)',
        fillOpacity: 'var(--hi-room-op, 0.07)',
      }}
    />

    {/* Zone boundary — dashed perimeter */}
    <rect
      x="4"
      y="4"
      width="40"
      height="40"
      rx="1"
      strokeWidth={1.5}
      strokeDasharray="4 3"
      fill="none"
    />

    {/* Thermostat unit on right wall — steel fill */}
    <rect
      x="34"
      y="16"
      width="8"
      height="14"
      rx="2"
      style={{
        fill: 'var(--hi-steel, currentColor)',
        fillOpacity: 'var(--hi-steel-op, 0.07)',
      }}
    />
    <rect x="34" y="16" width="8" height="14" rx="2" strokeWidth={2} fill="none" />

    {/* Thermostat display */}
    <rect
      x="35.5"
      y="17.5"
      width="5"
      height="4"
      rx="0.5"
      strokeWidth={0.75}
      strokeOpacity={0.6}
      fill="none"
    />

    {/* Temperature degree symbol */}
    <circle cx="38" cy="20" r="1" strokeWidth={0.75} strokeOpacity={0.7} />

    {/* Thermostat control buttons */}
    <line x1="36" y1="24" x2="42" y2="24" strokeWidth={0.75} strokeOpacity={0.5} />
    <line x1="38" y1="26" x2="40" y2="26" strokeWidth={0.75} strokeOpacity={0.4} />

    {/* Supply air diffuser — top center */}
    <rect x="18" y="4" width="12" height="4" rx="0" strokeWidth={1.5} fill="none" />
    {/* Diffuser louver slots */}
    <g strokeWidth={0.75} strokeOpacity={0.5}>
      <line x1="21" y1="4" x2="21" y2="8" />
      <line x1="24" y1="4" x2="24" y2="8" />
      <line x1="27" y1="4" x2="27" y2="8" />
    </g>

    {/* Zone ductwork connection line */}
    <line
      x1="24"
      y1="8"
      x2="24"
      y2="14"
      strokeWidth={1}
      strokeOpacity={0.5}
      strokeDasharray="2 2"
    />

    {/* Return air grille — bottom */}
    <rect
      x="14"
      y="40"
      width="10"
      height="4"
      rx="0"
      strokeWidth={1}
      strokeOpacity={0.6}
      fill="none"
    />
    <g strokeWidth={0.75} strokeOpacity={0.4}>
      <line x1="16" y1="40" x2="16" y2="44" />
      <line x1="18" y1="40" x2="18" y2="44" />
      <line x1="20" y1="40" x2="20" y2="44" />
      <line x1="22" y1="40" x2="22" y2="44" />
    </g>

    {/* Flow arrows in room */}
    <line x1="24" y1="18" x2="24" y2="28" strokeWidth={0.75} strokeOpacity={0.35} />
    <polyline points="22,26 24,28 26,26" strokeWidth={0.75} strokeOpacity={0.35} fill="none" />
  </>,
);

// ── PanelScheduleHifi — electrical panel door with breaker rows and schedule ───
export const PanelScheduleHifi = bimIconHifi(
  'PanelScheduleHifi',
  <>
    {/* Panel enclosure outer — steel fill */}
    <rect
      x="6"
      y="4"
      width="36"
      height="40"
      rx="2"
      style={{
        fill: 'var(--hi-steel, currentColor)',
        fillOpacity: 'var(--hi-steel-op, 0.07)',
      }}
    />
    <rect x="6" y="4" width="36" height="40" rx="2" strokeWidth={2} fill="none" />

    {/* Panel door reveal — inner border */}
    <rect
      x="8"
      y="6"
      width="32"
      height="36"
      rx="1"
      strokeWidth={0.75}
      strokeOpacity={0.4}
      fill="none"
    />

    {/* Main breaker at top — finish fill */}
    <rect
      x="12"
      y="8"
      width="24"
      height="7"
      rx="1"
      style={{
        fill: 'var(--hi-finish, currentColor)',
        fillOpacity: 'var(--hi-finish-op, 0.07)',
      }}
    />
    <rect x="12" y="8" width="24" height="7" rx="1" strokeWidth={1.5} fill="none" />
    {/* Main breaker toggle */}
    <line x1="24" y1="9" x2="24" y2="14" strokeWidth={2} strokeLinecap="round" />

    {/* Breaker rows — finish fill rows */}
    {/* Row 1 */}
    <rect
      x="10"
      y="18"
      width="12"
      height="4"
      rx="0.5"
      style={{
        fill: 'var(--hi-finish, currentColor)',
        fillOpacity: 'var(--hi-finish-op, 0.07)',
      }}
      strokeWidth={1}
    />
    <rect
      x="26"
      y="18"
      width="12"
      height="4"
      rx="0.5"
      style={{
        fill: 'var(--hi-finish, currentColor)',
        fillOpacity: 'var(--hi-finish-op, 0.07)',
      }}
      strokeWidth={1}
    />
    {/* Row 2 */}
    <rect
      x="10"
      y="24"
      width="12"
      height="4"
      rx="0.5"
      style={{
        fill: 'var(--hi-finish, currentColor)',
        fillOpacity: 'var(--hi-finish-op, 0.07)',
      }}
      strokeWidth={1}
    />
    <rect
      x="26"
      y="24"
      width="12"
      height="4"
      rx="0.5"
      style={{
        fill: 'var(--hi-finish, currentColor)',
        fillOpacity: 'var(--hi-finish-op, 0.07)',
      }}
      strokeWidth={1}
    />
    {/* Row 3 */}
    <rect
      x="10"
      y="30"
      width="12"
      height="4"
      rx="0.5"
      style={{
        fill: 'var(--hi-finish, currentColor)',
        fillOpacity: 'var(--hi-finish-op, 0.07)',
      }}
      strokeWidth={1}
    />
    <rect
      x="26"
      y="30"
      width="12"
      height="4"
      rx="0.5"
      style={{
        fill: 'var(--hi-finish, currentColor)',
        fillOpacity: 'var(--hi-finish-op, 0.07)',
      }}
      strokeWidth={1}
    />

    {/* Breaker toggle marks */}
    <g strokeWidth={0.75} strokeOpacity={0.6}>
      <line x1="15" y1="19" x2="15" y2="21" />
      <line x1="29" y1="19" x2="29" y2="21" />
      <line x1="15" y1="25" x2="15" y2="27" />
      <line x1="29" y1="25" x2="29" y2="27" />
      <line x1="15" y1="31" x2="15" y2="33" />
      <line x1="29" y1="31" x2="29" y2="33" />
    </g>

    {/* Schedule grid lines at bottom */}
    <line x1="10" y1="37" x2="38" y2="37" strokeWidth={0.75} strokeOpacity={0.4} />
    <line x1="10" y1="39" x2="38" y2="39" strokeWidth={0.75} strokeOpacity={0.3} />
    <line x1="24" y1="36" x2="24" y2="42" strokeWidth={0.75} strokeOpacity={0.35} />

    {/* Panel handle / latch */}
    <circle cx="24" cy="16" r="1.5" strokeWidth={1} strokeOpacity={0.6} />
  </>,
);

// ── DuctSystemHifi — ductwork network: trunk, branches, diffusers, arrows ─────
export const DuctSystemHifi = bimIconHifi(
  'DuctSystemHifi',
  <>
    {/* Main trunk duct — steel fill, horizontal */}
    <rect
      x="4"
      y="20"
      width="26"
      height="8"
      style={{
        fill: 'var(--hi-steel, currentColor)',
        fillOpacity: 'var(--hi-steel-op, 0.07)',
      }}
    />
    <rect x="4" y="20" width="26" height="8" strokeWidth={2} fill="none" />

    {/* Branch duct 1 — glass fill, up-right */}
    <rect
      x="20"
      y="10"
      width="6"
      height="10"
      style={{
        fill: 'var(--hi-glass, currentColor)',
        fillOpacity: 'var(--hi-glass-op, 0.07)',
      }}
    />
    <rect x="20" y="10" width="6" height="10" strokeWidth={1.5} fill="none" />

    {/* Branch duct 2 — glass fill, down-right */}
    <rect
      x="20"
      y="28"
      width="6"
      height="10"
      style={{
        fill: 'var(--hi-glass, currentColor)',
        fillOpacity: 'var(--hi-glass-op, 0.07)',
      }}
    />
    <rect x="20" y="28" width="6" height="10" strokeWidth={1.5} fill="none" />

    {/* Branch duct 3 — glass fill, far right */}
    <rect
      x="30"
      y="20"
      width="10"
      height="8"
      style={{
        fill: 'var(--hi-glass, currentColor)',
        fillOpacity: 'var(--hi-glass-op, 0.07)',
      }}
    />
    <rect x="30" y="20" width="10" height="8" strokeWidth={1.5} fill="none" />

    {/* Diffuser endpoint diamonds — finish fill */}
    {/* Top diffuser */}
    <polygon
      points="23,4 27,8 23,12 19,8"
      style={{
        fill: 'var(--hi-finish, currentColor)',
        fillOpacity: 'var(--hi-finish-op, 0.07)',
      }}
      strokeWidth={1.5}
    />
    {/* Bottom diffuser */}
    <polygon
      points="23,36 27,40 23,44 19,40"
      style={{
        fill: 'var(--hi-finish, currentColor)',
        fillOpacity: 'var(--hi-finish-op, 0.07)',
      }}
      strokeWidth={1.5}
    />
    {/* Right diffuser */}
    <polygon
      points="40,20 44,24 40,28 36,24"
      style={{
        fill: 'var(--hi-finish, currentColor)',
        fillOpacity: 'var(--hi-finish-op, 0.07)',
      }}
      strokeWidth={1.5}
    />

    {/* Airflow arrows in trunk */}
    <line x1="7" y1="24" x2="16" y2="24" strokeWidth={1.5} />
    <polyline points="13,22 16,24 13,26" strokeWidth={1.5} fill="none" />

    {/* Detail hatch on trunk */}
    <line x1="4" y1="24" x2="30" y2="24" strokeWidth={0.75} strokeOpacity={0.3} />
  </>,
);

// ── PipingSystemHifi — isometric piping: supply, return, valves, arrows ───────
export const PipingSystemHifi = bimIconHifi(
  'PipingSystemHifi',
  <>
    {/* Supply pipe (horizontal, top) — glass fill */}
    <rect
      x="4"
      y="10"
      width="40"
      height="6"
      rx="3"
      style={{
        fill: 'var(--hi-glass, currentColor)',
        fillOpacity: 'var(--hi-glass-op, 0.07)',
      }}
    />
    <rect x="4" y="10" width="40" height="6" rx="3" strokeWidth={2} fill="none" />

    {/* Return pipe (horizontal, bottom) — roof fill */}
    <rect
      x="4"
      y="32"
      width="40"
      height="6"
      rx="3"
      style={{
        fill: 'var(--hi-roof, currentColor)',
        fillOpacity: 'var(--hi-roof-op, 0.07)',
      }}
    />
    <rect x="4" y="32" width="40" height="6" rx="3" strokeWidth={2} fill="none" />

    {/* Vertical riser connections */}
    <rect x="10" y="16" width="4" height="16" strokeWidth={1.5} fill="none" />
    <rect x="34" y="16" width="4" height="16" strokeWidth={1.5} fill="none" />

    {/* Equipment symbol — boiler/coil box in center */}
    <rect x="17" y="18" width="14" height="12" rx="2" strokeWidth={1.5} fill="none" />
    {/* Coil lines inside equipment */}
    <g strokeWidth={0.75} strokeOpacity={0.5}>
      <path d="M19 22 Q21 20 23 22 Q25 24 27 22 Q29 20 31 22" fill="none" />
      <path d="M19 26 Q21 24 23 26 Q25 28 27 26 Q29 24 31 26" fill="none" />
    </g>

    {/* Valve symbol on supply pipe — X symbol (gate valve) */}
    <line x1="22" y1="10" x2="26" y2="16" strokeWidth={1.5} />
    <line x1="26" y1="10" x2="22" y2="16" strokeWidth={1.5} />

    {/* Valve symbol on return pipe */}
    <line x1="22" y1="32" x2="26" y2="38" strokeWidth={1.5} />
    <line x1="26" y1="32" x2="22" y2="38" strokeWidth={1.5} />

    {/* Flow direction arrows on supply pipe */}
    <polyline points="7,13 11,13" strokeWidth={1.5} fill="none" />
    <polyline points="9,11 11,13 9,15" strokeWidth={1.5} fill="none" />

    {/* Flow direction arrow on return pipe (opposite direction) */}
    <polyline points="41,35 37,35" strokeWidth={1.5} fill="none" />
    <polyline points="39,33 37,35 39,37" strokeWidth={1.5} fill="none" />

    {/* Pipe insulation hatch marks on supply */}
    <g strokeWidth={0.75} strokeOpacity={0.25}>
      <line x1="14" y1="10" x2="12" y2="16" />
      <line x1="18" y1="10" x2="16" y2="16" />
      <line x1="30" y1="10" x2="28" y2="16" />
      <line x1="38" y1="10" x2="36" y2="16" />
    </g>
  </>,
);

// ── ValveHifi — butterfly valve: body, disc, actuator arm, pipe connections ────
export const ValveHifi = bimIconHifi(
  'ValveHifi',
  <>
    {/* Pipe connection — left */}
    <rect x="4" y="20" width="10" height="8" rx="1" strokeWidth={1.5} fill="none" />
    {/* Pipe connection — right */}
    <rect x="34" y="20" width="10" height="8" rx="1" strokeWidth={1.5} fill="none" />

    {/* Valve body (flange ring) — steel fill circle */}
    <circle
      cx="24"
      cy="24"
      r="12"
      style={{
        fill: 'var(--hi-steel, currentColor)',
        fillOpacity: 'var(--hi-steel-op, 0.07)',
      }}
    />
    <circle cx="24" cy="24" r="12" strokeWidth={2} fill="none" />

    {/* Inner bore circle */}
    <circle cx="24" cy="24" r="9" strokeWidth={1} strokeOpacity={0.5} fill="none" />

    {/* Butterfly disc plate — finish fill, angled */}
    <ellipse
      cx="24"
      cy="24"
      rx="3"
      ry="9"
      transform="rotate(-30 24 24)"
      style={{
        fill: 'var(--hi-finish, currentColor)',
        fillOpacity: 'var(--hi-finish-op, 0.07)',
      }}
    />
    <ellipse
      cx="24"
      cy="24"
      rx="3"
      ry="9"
      transform="rotate(-30 24 24)"
      strokeWidth={1.5}
      fill="none"
    />

    {/* Disc pivot shaft line through center */}
    <line x1="24" y1="15" x2="24" y2="33" strokeWidth={0.75} strokeOpacity={0.5} />

    {/* Actuator arm — from top of valve body upward */}
    <line x1="24" y1="12" x2="24" y2="6" strokeWidth={2} />

    {/* Actuator handle / handwheel */}
    <line x1="18" y1="6" x2="30" y2="6" strokeWidth={2} strokeLinecap="round" />
    <line x1="21" y1="4" x2="21" y2="8" strokeWidth={1.5} />
    <line x1="27" y1="4" x2="27" y2="8" strokeWidth={1.5} />
    <circle cx="24" cy="6" r="1.5" strokeWidth={1} />

    {/* Flange bolt holes — small circles on valve body ring */}
    <g strokeWidth={0.75} strokeOpacity={0.5}>
      <circle cx="24" cy="13" r="1" />
      <circle cx="24" cy="35" r="1" />
      <circle cx="13" cy="24" r="1" />
      <circle cx="35" cy="24" r="1" />
    </g>

    {/* Pipe bore hatch */}
    <g strokeWidth={0.75} strokeOpacity={0.3}>
      <line x1="4" y1="24" x2="14" y2="24" />
      <line x1="34" y1="24" x2="44" y2="24" />
    </g>
  </>,
);
