/**
 * Architectural extended icons — additional Revit-equivalent elements.
 *
 * Covers elements beyond the core drawing-tool set: sweeps, reveals,
 * component instances, roof variants, openings, boundaries, reference
 * planes, work planes, model lines, model text, and stair path.
 */
import { bimIcon } from './icon';

// ── Wall sweep: wall section with extruded profile on one face ────────────────
export const WallSweepIcon = bimIcon(
  'WallSweepIcon',
  <path d="M2 10H22V14H2z M16 7H20V10H16z" />,
);

// ── Wall reveal: wall with a recessed groove cut into one face ────────────────
export const WallRevealIcon = bimIcon(
  'WallRevealIcon',
  <path d="M2 10H22V14H2z M8 10H16V12H8" />,
);

// ── Component: generic hosted family instance — box with insertion plus ───────
export const ComponentIcon = bimIcon(
  'ComponentIcon',
  <>
    <path d="M5 5H19V19H5z" />
    <path d="M12 9V15 M9 12H15" />
  </>,
);

// ── Roof by extrusion: profile shape extruded into a roof form ────────────────
// Section view of an extruded profile: a step/L profile that becomes a roof.
export const RoofExtrusionIcon = bimIcon(
  'RoofExtrusionIcon',
  <path d="M4 18H20V14H14V10H8V18" />,
);

// ── Roof soffit: the underside face of a roof overhang ───────────────────────
// Horizontal wall with an overhanging cantilever showing the soffit underside.
export const RoofSoffitIcon = bimIcon(
  'RoofSoffitIcon',
  <path d="M2 8H18V12H2z M18 8L22 4 M22 4V14 M18 12L22 14" />,
);

// ── Fascia: vertical trim board at the roof eave ─────────────────────────────
export const FasciaIcon = bimIcon(
  'FasciaIcon',
  <path d="M2 12H20 M20 8H22V16H20" />,
);

// ── Gutter: half-round drainage channel at eave level ────────────────────────
export const GutterIcon = bimIcon(
  'GutterIcon',
  <path d="M2 11H18 M16 11V17 M20 11V17 M16 17H20" />,
);

// ── Curtain system: free-form planar/curved curtain wall with grid ────────────
export const CurtainSystemIcon = bimIcon(
  'CurtainSystemIcon',
  <>
    <path d="M5 4Q12 9 19 4V20Q12 15 5 20z" />
    <path d="M5 12Q12 17 19 12" />
    <path d="M9 4Q10 9 9 12Q8 15 9 20 M15 4Q14 9 15 12Q16 15 15 20" />
  </>,
);

// ── Curtain grid: a single grid division line on a curtain wall ───────────────
export const CurtainGridIcon = bimIcon(
  'CurtainGridIcon',
  <path d="M4 4H20V20H4z M4 12H20 M9 4V20" />,
);

// ── Vertical opening: floor/slab opening (viewed in plan) ────────────────────
// Dashed boundary + up-down arrows indicate a vertical void through the slab.
export const VerticalOpeningIcon = bimIcon(
  'VerticalOpeningIcon',
  <>
    <path d="M5 5H19V19H5z" strokeDasharray="3 2" />
    <path d="M12 8V16 M9 11L12 8L15 11 M9 13L12 16L15 13" />
  </>,
);

// ── Dormer opening: a dormer window cut through a pitched roof ────────────────
export const DormerOpeningIcon = bimIcon(
  'DormerOpeningIcon',
  <path d="M2 20L12 7L22 20z M9 13H15V20H9z" />,
);

// ── Face-based opening: opening cut into any face of a host element ───────────
export const FaceOpeningIcon = bimIcon(
  'FaceOpeningIcon',
  <path d="M4 4H20V20H4z M9 12H15V20H9z" />,
);

// ── Room separator: non-structural dashed line dividing room zones ────────────
// Two room outlines sharing a dashed dividing boundary.
export const RoomSeparatorIcon = bimIcon(
  'RoomSeparatorIcon',
  <>
    <path d="M3 4H10V20H3z M14 4H21V20H14z" />
    <path d="M10 4V20" strokeDasharray="3 2" />
  </>,
);

// ── Area boundary: closed dashed line defining an area plan region ────────────
export const AreaBoundaryIcon = bimIcon(
  'AreaBoundaryIcon',
  <>
    <path d="M4 4H20V20H4z" strokeDasharray="4 2" />
    <circle cx="12" cy="12" r="1.5" />
  </>,
);

// ── Reference plane: dashed infinite plane with name bubble at one end ────────
export const ReferencePlaneIcon = bimIcon(
  'ReferencePlaneIcon',
  <>
    <path d="M2 12H20" strokeDasharray="6 3" />
    <circle cx="22" cy="12" r="2" />
  </>,
);

// ── Work plane: receding perspective grid representing a 3D reference plane ───
export const WorkPlaneIcon = bimIcon(
  'WorkPlaneIcon',
  <path d="M4 10H22 M2 18H22 M4 10L2 18 M7 10L5 18 M10 10L8 18 M13 10L11 18 M16 10L14 18 M19 10L17 18 M22 10L20 18" />,
);

// ── Model line: 3D line element with visible endpoints ───────────────────────
export const ModelLineIcon = bimIcon(
  'ModelLineIcon',
  <>
    <circle cx="6" cy="6" r="2" />
    <circle cx="18" cy="18" r="2" />
    <path d="M7.4 7.4L16.6 16.6" />
  </>,
);

// ── Model text: 3D text element placed in the model ──────────────────────────
export const ModelTextIcon = bimIcon(
  'ModelTextIcon',
  <path d="M4 5H20 M12 5V19 M8 19H16" />,
);

// ── Stair path: the up-direction arrow path annotating a stair run ────────────
export const StairPathIcon = bimIcon(
  'StairPathIcon',
  <path d="M4 20H8V16H12V12H16V8H20 M18 5L20 8L22 5" />,
);
