/**
 * Architectural element icons — Phase 2 additions.
 *
 * Covers the architectural elements not in the original drawing-tool set:
 * ceilings, openings, shafts, ramps, massing, curtain wall components,
 * skylights, and partition walls.
 */
import { bimIcon } from './icon';

// ── Ceiling: thin slab cross-section with pendant suspension hangers ──────────
// Viewed in section — the thin horizontal slab with downward hanger lines
// shows a suspended ceiling floating above the room space below.
export const CeilingIcon = bimIcon(
  'CeilingIcon',
  <path d="M2 8H22V11H2z M4 11V17 M8 11V17 M12 11V17 M16 11V17 M20 11V17 M3 17H21" />,
);

// ── Generic opening: element boundary with voided cutout marked with X ────────
export const OpeningIcon = bimIcon(
  'OpeningIcon',
  <path d="M4 4H20V20H4z M8 8H16V16H8z M8 8L16 16 M16 8L8 16" />,
);

// ── Shaft opening: multi-storey vertical void with angled corner cut lines ────
export const ShaftOpeningIcon = bimIcon(
  'ShaftOpeningIcon',
  <path d="M5 2H19V22H5z M9 6H15V18H9z M5 2L9 6 M19 2L15 6 M5 22L9 18 M19 22L15 18" />,
);

// ── Ramp: plan boundary with slope diagonal and direction arrow ───────────────
export const RampIcon = bimIcon(
  'RampIcon',
  <path d="M3 5H21V19H3z M3 5L21 19 M15 12L21 5L21 12" />,
);

// ── Conceptual mass: stepped building massing silhouette ─────────────────────
// The stepped pyramid shape signals early-design volumetric massing.
export const MassIcon = bimIcon('MassIcon', <path d="M3 20H21V10H17V6H13V3H11V6H7V10H3z" />);

// ── Curtain panel: single glazing unit with frame reveals and glazing X ───────
export const CurtainPanelIcon = bimIcon(
  'CurtainPanelIcon',
  <path d="M5 4H19V20H5z M7 4V20 M17 4V20 M5 6H19 M5 18H19 M5 4L19 20" />,
);

// ── Mullion: T-profile cross-section — wide flange + narrow web ───────────────
// Plan/section view of a curtain-wall mullion member. Clearly distinct from
// the old plus-sign shape.
export const MullionIcon = bimIcon('MullionIcon', <path d="M8 4H16V8H14V20H10V8H8z" />);

// ── Skylight: plan glazing unit with diagonal X + sun above ──────────────────
export const SkyLightIcon = bimIcon(
  'SkyLightIcon',
  <>
    <circle cx="12" cy="3" r="2" />
    <path d="M12 5V7 M5 8H19V17H5z M5 8L19 17 M19 8L5 17" />
  </>,
);

// ── Partition: room boundary split by a thin (non-structural) dividing wall ───
// Two spaces separated by a thin wall — clearly distinct from the structural
// WallIcon (two parallel lines) and the old resize-cursor-like arrow shape.
export const PartitionIcon = bimIcon(
  'PartitionIcon',
  <>
    <path d="M2 4H22V20H2z" />
    <path d="M11 4H13V20H11z" />
  </>,
);
