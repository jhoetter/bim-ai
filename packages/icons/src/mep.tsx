/**
 * MEP — Mechanical, Electrical & Plumbing icons.
 *
 * These cover the most common MEP elements found in coordination drawings:
 * ductwork, piping, cable trays, mechanical equipment, and fixtures.
 * Each uses standard plan/elevation/section symbology from MEP drafting
 * conventions (ASHRAE, BS 8313, etc.).
 */
import { bimIcon } from './icon';

// ── Rectangular duct: plan/section view with cross hatching ──────────────────
export const DuctRectIcon = bimIcon(
  'DuctRectIcon',
  <path d="M3 8H21V16H3z M3 8L21 16 M21 8L3 16" />,
);

// ── Round duct: circular cross-section with diagonal X ───────────────────────
export const DuctRoundIcon = bimIcon(
  'DuctRoundIcon',
  <>
    <circle cx="12" cy="12" r="8" />
    <path d="M5.7 5.7L18.3 18.3 M18.3 5.7L5.7 18.3" />
  </>,
);

// ── Pipe: tube cross-section from the side with elliptical end cap ────────────
// Three sides of the run + a visible elliptical end cap on the right.
export const PipeIcon = bimIcon(
  'PipeIcon',
  <>
    <path d="M4 9H20 M4 15H20 M4 9V15" />
    <ellipse cx="20" cy="12" rx="2" ry="3" />
  </>,
);

// ── Cable tray: open ladder/tray with regularly spaced rungs ─────────────────
export const CableTrayIcon = bimIcon(
  'CableTrayIcon',
  <path d="M2 9H22V15H2z M6 9V15 M10 9V15 M14 9V15 M18 9V15" />,
);

// ── Conduit: three concentric circles — wall thickness + bore + cable inside ──
// Standard electrical drawing symbol for conduit shown in cross-section.
// Completely distinct from PipeIcon (which shows a side/perspective view).
export const ConduitIcon = bimIcon(
  'ConduitIcon',
  <>
    <circle cx="12" cy="12" r="8" />
    <circle cx="12" cy="12" r="4.5" />
    <circle cx="12" cy="12" r="1.5" />
  </>,
);

// ── Mechanical equipment: equipment housing with 6-blade fan/impeller ────────
// The rotating fan wheel inside the box enclosure unambiguously signals rotating
// mechanical equipment (AHU, fan coil, pump). Clearly distinct from
// PlumbingFixtureIcon (oval basin) and MepSpaceIcon (diagonal-X circle).
export const MechanicalEquipmentIcon = bimIcon(
  'MechanicalEquipmentIcon',
  <>
    <path d="M3 5H21V19H3z" />
    <circle cx="12" cy="12" r="5" />
    <circle cx="12" cy="12" r="1.5" />
    <path d="M12 10.5V7 M13.3 11.3L15.5 9.5 M13.3 12.8L15.5 14.5 M12 13.5V17 M10.7 12.8L8.5 14.5 M10.7 11.3L8.5 9.5" />
  </>,
);

// ── Plumbing fixture: plan view of sink — oval basin + T-shaped faucet ───────
// Standard plan-view lavatory symbol: rectangular surround, oval basin, faucet.
// Clearly distinct from MechanicalEquipmentIcon (fan wheel).
export const PlumbingFixtureIcon = bimIcon(
  'PlumbingFixtureIcon',
  <>
    <path d="M4 5H20V19H4z" />
    <ellipse cx="12" cy="13" rx="5" ry="4" />
    <path d="M10 7H14 M12 7V9" />
  </>,
);

// ── Lighting fixture: 2-lamp fluorescent (RCP plan view) ─────────────────────
// Two vertical lamp tubes inside a rectangular fixture housing — the standard
// RCP symbol for a fluorescent ceiling fixture. Distinct from DuctRectIcon (X).
export const LightingFixtureIcon = bimIcon(
  'LightingFixtureIcon',
  <>
    <path d="M4 9H20V15H4z" />
    <path d="M8 9V15 M16 9V15" />
  </>,
);

// ── Electrical panel: distribution board with circuit breaker rows ───────────
export const ElectricalPanelIcon = bimIcon(
  'ElectricalPanelIcon',
  <path d="M4 3H20V21H4z M4 9H20 M4 15H20 M8 9V15 M12 9V15 M16 9V15 M7 6H17 M7 18H13" />,
);

// ── Fire sprinkler: head body + four supply arms in cardinal directions ───────
export const FireSprinklerIcon = bimIcon(
  'FireSprinklerIcon',
  <>
    <circle cx="12" cy="12" r="3" />
    <path d="M12 2V9 M12 15V22 M2 12H9 M15 12H22" />
  </>,
);

// ── Diffuser / air terminal: three concentric squares (supply/return grille) ──
export const DiffuserIcon = bimIcon(
  'DiffuserIcon',
  <path d="M3 3H21V21H3z M6 6H18V18H6z M9 9H15V15H9z" />,
);

// ── MEP space: room boundary with circular HVAC indicator (energy calc zone) ──
// Distinct from RoomIcon (+ cross) by using a diagonal cross and inner circle.
export const MepSpaceIcon = bimIcon(
  'MepSpaceIcon',
  <>
    <path d="M3 5H21V19H3z" />
    <circle cx="12" cy="12" r="4" />
    <path d="M9.2 9.2L14.8 14.8 M14.8 9.2L9.2 14.8" />
  </>,
);
