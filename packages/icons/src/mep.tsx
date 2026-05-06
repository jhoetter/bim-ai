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

// ── Conduit: rectangular body with circular cross-section end cap ─────────────
export const ConduitIcon = bimIcon(
  'ConduitIcon',
  <path d="M2 9H18A3 3 0 0 1 18 15H2V9" />,
);

// ── Mechanical equipment: plan footprint with motor/fan symbol ────────────────
export const MechanicalEquipmentIcon = bimIcon(
  'MechanicalEquipmentIcon',
  <>
    <path d="M3 5H21V19H3z" />
    <circle cx="12" cy="12" r="4" />
    <path d="M12 8V16 M8 12H16" />
  </>,
);

// ── Plumbing fixture: plan outline of sink with basin and faucet ─────────────
export const PlumbingFixtureIcon = bimIcon(
  'PlumbingFixtureIcon',
  <>
    <path d="M5 5H19V19H5z" />
    <circle cx="12" cy="12" r="4" />
    <path d="M12 7V9 M10 8H14" />
  </>,
);

// ── Lighting fixture: rectangular ceiling light with cross diagonals (RCP) ───
export const LightingFixtureIcon = bimIcon(
  'LightingFixtureIcon',
  <path d="M3 9H21V15H3z M3 9L21 15 M21 9L3 15" />,
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
