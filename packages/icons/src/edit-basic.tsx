/**
 * Basic edit / modify operation icons.
 *
 * Covers the everyday modify-panel operations: move, copy, rotate, scale,
 * offset, delete, join/unjoin geometry, switch join order, wall joins,
 * paint material, measure, and ungroup.
 */
import { bimIcon } from './icon';

// ── Move: element with arrow showing displacement to new position ─────────────
export const MoveIcon = bimIcon(
  'MoveIcon',
  <path d="M5 5H13V13H5z M13 13L19 19 M16 19H19V16" />,
);

// ── Copy: two rectangles, one offset from the other ──────────────────────────
export const CopyIcon = bimIcon(
  'CopyIcon',
  <path d="M4 8H14V18H4z M10 4H20V14H10z" />,
);

// ── Rotate: quarter arc with rotation arrowhead at end ───────────────────────
export const RotateIcon = bimIcon(
  'RotateIcon',
  <path d="M5 12A7 7 0 0 1 12 5 M12 5L9 2L12 5L15 2" />,
);

// ── Scale: small centre element with four expanding corner arrows ─────────────
export const ScaleIcon = bimIcon(
  'ScaleIcon',
  <path d="M10 10H14V14H10z M4 4L10 10 M14 14L20 20 M14 10L20 4 M10 14L4 20" />,
);

// ── Offset: element with parallel copy at a specified distance ────────────────
export const OffsetIcon = bimIcon(
  'OffsetIcon',
  <path d="M4 7H20 M4 14H20 M12 7V14 M10 9L12 7L14 9 M10 12L12 14L14 12" />,
);

// ── Delete: trash can with handle and body ───────────────────────────────────
export const DeleteIcon = bimIcon(
  'DeleteIcon',
  <path d="M9 3H15 M5 6H19 M6 6L7 21H17L18 6 M10 10V16 M14 10V16" />,
);

// ── Join geometry: two elements merged at their shared boundary ───────────────
export const JoinGeometryIcon = bimIcon(
  'JoinGeometryIcon',
  <path d="M2 8H14V20H2z M10 4H22V16H10z M10 8H14 M10 16H14" />,
);

// ── Unjoin geometry: two elements separated at their boundary ─────────────────
export const UnjoinGeometryIcon = bimIcon(
  'UnjoinGeometryIcon',
  <path d="M2 8H10V20H2z M14 4H22V16H14z" />,
);

// ── Switch join order: two elements with swapped priority ────────────────────
export const SwitchJoinOrderIcon = bimIcon(
  'SwitchJoinOrderIcon',
  <path d="M3 8H11V16H3z M13 8H21V16H13z M11 10C12 9 12 9 13 10 M11 14C12 15 12 15 13 14" />,
);

// ── Wall joins: T-junction of two wall lines showing a join node ──────────────
export const WallJoinsIcon = bimIcon(
  'WallJoinsIcon',
  <path d="M2 11H22V13H2z M11 2H13V11H11z" />,
);

// ── Paint material: roller applying a finish to a surface ────────────────────
export const PaintMaterialIcon = bimIcon(
  'PaintMaterialIcon',
  <path d="M3 8H17V14H3z M17 10H20V13L19 14H17 M19 13V19" />,
);

// ── Measure between: two points with spanning dimension arrow ────────────────
export const MeasureBetweenIcon = bimIcon(
  'MeasureBetweenIcon',
  <>
    <circle cx="4" cy="12" r="2" />
    <circle cx="20" cy="12" r="2" />
    <path d="M6 12H18 M6 9L4 12L6 15 M18 9L20 12L18 15" />
  </>,
);

// ── Measure along: baseline with regular measurement tick marks ───────────────
export const MeasureAlongIcon = bimIcon(
  'MeasureAlongIcon',
  <path d="M3 12H21 M3 9V15 M7 10V14 M11 10V14 M15 10V14 M21 9V15" />,
);

// ── Ungroup: dashed selection boundary with elements flying to corners ─────────
export const UngroupIcon = bimIcon(
  'UngroupIcon',
  <>
    <path d="M6 6H18V18H6z" strokeDasharray="3 2" />
    <path d="M4 4L6 6 M18 6L20 4 M18 18L20 20 M6 18L4 20" />
  </>,
);
