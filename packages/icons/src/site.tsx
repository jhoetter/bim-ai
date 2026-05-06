/**
 * Site and civil engineering icons.
 *
 * Covers terrain, site boundaries, parking, planting, roads, and the
 * north-arrow orientation marker that appears on virtually every sheet.
 */
import { bimIcon } from './icon';

// ── Topography: three wavy contour lines stacked at different elevations ──────
export const TopoIcon = bimIcon(
  'TopoIcon',
  <path d="M2 18C6 16 8 14 12 14s6 2 10 4 M2 13C6 11 8 9 12 9s6 2 10 4 M2 8C6 6 8 4 12 4s6 2 10 4" />,
);

// ── Property line: outer cadastral boundary with inner building setback ────────
export const PropertyLineIcon = bimIcon(
  'PropertyLineIcon',
  <path d="M3 3H21V21H3z M8 8H16V16H8z" />,
);

// ── Parking space: bay outline with letter P ──────────────────────────────────
// The P is drawn as: vertical stroke + top horizontal + semicircular bowl.
export const ParkingSpaceIcon = bimIcon(
  'ParkingSpaceIcon',
  <>
    <path d="M3 3H21V21H3z" />
    <path d="M8 6V18 M8 6H14A4 4 0 0 1 14 14H8" />
  </>,
);

// ── Planting / tree: canopy circle with 8-direction radial tick marks ─────────
export const PlantingIcon = bimIcon(
  'PlantingIcon',
  <>
    <circle cx="12" cy="12" r="8" />
    <path d="M12 4V8 M12 16V20 M4 12H8 M16 12H20 M6.3 6.3L8.8 8.8 M17.7 6.3L15.2 8.8 M8.8 15.2L6.3 17.7 M15.2 15.2L17.7 17.7" />
  </>,
);

// ── Road / access route: twin-line roadway with centre dashes ─────────────────
export const RoadIcon = bimIcon(
  'RoadIcon',
  <path d="M2 9H22V15H2z M8 12H10 M14 12H16" />,
);

// ── Retaining wall: wall section with diagonal earth hatching behind ──────────
export const RetainingWallIcon = bimIcon(
  'RetainingWallIcon',
  <path d="M10 4V20H14V4z M3 20H21 M14 6H20 M14 9H18 M14 12H20 M14 15H18 M14 18H20" />,
);

// ── North arrow: solid half-arrowhead pointing up + south stem ───────────────
// Left half filled (dark), right half open — the universal "N" arrow convention.
export const NorthArrowIcon = bimIcon(
  'NorthArrowIcon',
  <path d="M12 2L7 14L12 10L17 14z M12 10V22" />,
);
