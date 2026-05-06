/**
 * Annotation and documentation icons.
 *
 * Covers the 2D markup symbols used in construction documents:
 * revision clouds, break lines, centrelines, keynotes, match lines,
 * scale bars, area labels, spot elevations, and slope arrows.
 */
import { bimIcon } from './icon';

// ── Revision cloud: scalloped perimeter used to call out changes ──────────────
// Four arcs forming bumpy top + flat sides + flat bottom.
export const RevisionCloudIcon = bimIcon(
  'RevisionCloudIcon',
  <path d="M4 18V10C3 7 6 6 8 9C8 6 11 6 12 9C12 6 15 6 16 9C16 6 19 5 20 9V18z" />,
);

// ── Break line: zigzag interruption of a long element ────────────────────────
// The lightning-bolt shaped break indicates the element continues past the view.
export const BreakLineIcon = bimIcon(
  'BreakLineIcon',
  <path d="M2 12H8L10 8L14 16L16 12H22" />,
);

// ── Centreline: axis line with symmetry tick marks ────────────────────────────
export const CentreLineIcon = bimIcon(
  'CentreLineIcon',
  <path d="M12 2V22 M9 6H15 M9 18H15 M9 12H15" />,
);

// ── Keynote: hexagonal reference tag + leader line pointing to element ─────────
export const KeynoteIcon = bimIcon(
  'KeynoteIcon',
  <>
    <path d="M12 3L4 7.5V16.5L12 21L20 16.5V7.5z" />
    <path d="M12 8V16 M9 8H12" />
  </>,
);

// ── Match line: dashed continuation line with arrowheads at each end ─────────
export const MatchLineIcon = bimIcon(
  'MatchLineIcon',
  <path d="M2 12H5 M9 12H15 M19 12H22 M2 9L5 12L2 15 M22 9L19 12L22 15" />,
);

// ── Scale bar: graphic scale with alternating major/minor divisions ───────────
export const ScaleBarIcon = bimIcon(
  'ScaleBarIcon',
  <path d="M2 15H22 M2 13V17 M7 13V15 M12 13V17 M17 13V15 M22 13V17 M2 13H12" />,
);

// ── Area label: room outline with measurement dimension lines ─────────────────
export const AreaLabelIcon = bimIcon(
  'AreaLabelIcon',
  <>
    <path d="M4 4H20V20H4z" />
    <path d="M4 22H20 M2 4V20" />
    <path d="M2 4L4 4 M2 20L4 20 M4 22L4 20 M20 22L20 20" />
  </>,
);

// ── Spot elevation: downward triangle marker with datum staff above ───────────
export const SpotElevationIcon = bimIcon(
  'SpotElevationIcon',
  <path d="M12 9L8 19H16z M12 3V9 M9 3H15" />,
);

// ── Slope arrow: diagonal slope line with direction arrow + low-end tick ──────
export const SlopeArrowIcon = bimIcon(
  'SlopeArrowIcon',
  <path d="M3 17L21 8 M17 7L21 8L19 12 M3 15V19" />,
);
