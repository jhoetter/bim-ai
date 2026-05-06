/**
 * Edit / geometry-operation icons.
 *
 * Covers the BIM-aware editing operations: mirror (with axis), linear and
 * radial arrays, alignment, element splitting, trim/extend, void cutting,
 * and element pinning.  Each icon shows the *operation result* rather than
 * a generic tool cursor, making the intent legible at small sizes.
 */
import { bimIcon } from './icon';

// ── Mirror: two equal rectangles reflected across a central axis line ─────────
export const MirrorIcon = bimIcon(
  'MirrorIcon',
  <path d="M12 2V22 M3 8H10V16H3z M14 8H21V16H14z" />,
);

// ── Linear array: three copies spaced along a baseline with spacing ticks ─────
export const ArrayLinearIcon = bimIcon(
  'ArrayLinearIcon',
  <path d="M2 9H7V15H2z M9 9H14V15H9z M16 9H21V15H16z M2 17H21 M4.5 18V20 M11.5 18V20 M18.5 18V20" />,
);

// ── Radial array: centre pivot with four instances at cardinal positions ───────
export const ArrayRadialIcon = bimIcon(
  'ArrayRadialIcon',
  <>
    <circle cx="12" cy="12" r="2" />
    <path d="M10 3H14V7H10z M17 10H21V14H17z M10 17H14V21H10z M3 10H7V14H3z" />
    <path d="M12 7V10 M17 12H14 M12 14V17 M7 12H10" />
  </>,
);

// ── Align: two elements snapping up to a shared reference line ────────────────
export const AlignIcon = bimIcon(
  'AlignIcon',
  <path d="M2 8H22 M5 10H9V20H5z M11 14H17V20H11z M7 8V10 M14 8V14" />,
);

// ── Split: element divided at a vertical split plane with spreading arrows ─────
export const SplitIcon = bimIcon(
  'SplitIcon',
  <path d="M2 12H9 M15 12H22 M12 4V20 M9 8L12 12L9 16 M15 8L12 12L15 16" />,
);

// ── Trim/extend: reference line with two vertical elements meeting it ──────────
// One element stops short of the reference (will extend), one crosses it
// (will be trimmed). The X mark at the crossing indicates the trim point.
export const TrimExtendIcon = bimIcon(
  'TrimExtendIcon',
  <path d="M2 12H22 M8 4V12 M16 4V12V20 M14 18L16 20L18 18" />,
);

// ── Void: element outline with a cross-hatched cutout indicating removed solid ─
export const VoidIcon = bimIcon(
  'VoidIcon',
  <path d="M4 4H20V20H4z M8 8H16V16H8z M8 8L16 16 M16 8L8 16" />,
);

// ── Pin: drawing pin locking an element's position ───────────────────────────
export const PinIcon = bimIcon(
  'PinIcon',
  <path d="M9 3H15V9L12 15L9 9z M12 15V21 M9 12H15" />,
);

// ── Unpin: pin with a diagonal release slash ──────────────────────────────────
export const UnpinIcon = bimIcon(
  'UnpinIcon',
  <path d="M9 3H15V9L12 15L9 9z M12 15V18 M9 12H15 M17 2L22 7" />,
);
