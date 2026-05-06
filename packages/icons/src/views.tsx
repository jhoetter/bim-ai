/**
 * Phase 2 — View, annotation, and documentation icons.
 *
 * These represent the different view types users work in (plan, section,
 * elevation, 3D), documentation artifacts (sheet, schedule, callout),
 * and annotation elements (grid, level, detail line).
 */
import { bimIcon } from './icon';

// ── Floor plan view: building outline with interior room divisions ─────────────
export const PlanViewIcon = bimIcon('PlanViewIcon', <path d="M2 4h20v16H2z M2 13h20 M13 4V13" />);

// ── Section view: building cross-section with walls, ceiling, and door opening
export const SectionViewIcon = bimIcon(
  'SectionViewIcon',
  <path d="M4 20H20 M6 20V5H18V20 M10 12h4V20" />,
);

// ── Elevation view: building facade with ground line, door, and window ────────
export const ElevationViewIcon = bimIcon(
  'ElevationViewIcon',
  <path d="M2 20H22 M5 20V6H19V20 M8 14h4V20 M14 10h4V14H14z" />,
);

// ── 3D orbit view: isometric cube with three visible faces ────────────────────
// Front face: (3,15)–(13,20). Top face parallelogram. Right face parallelogram.
export const OrbitViewIcon = bimIcon(
  'OrbitViewIcon',
  <path d="M3 15H13V20H3z M3 15L8 10H18L13 15 M13 15L18 10V15L13 20z" />,
);

// ── Drawing sheet: sheet border with title block and content lines ─────────────
export const SheetIcon = bimIcon(
  'SheetIcon',
  <path d="M3 2H21V22H3z M3 17H21 M9 17V22 M7 5H17 M7 8H14 M7 11H11" />,
);

// ── Schedule/table view: grid with column and row dividers + header row ───────
export const ScheduleViewIcon = bimIcon(
  'ScheduleViewIcon',
  <path d="M2 4H22V20H2z M2 9H22 M2 14H22 M8 4V20 M15 4V20" />,
);

// ── Callout: annotation box with text lines and a rightward leader ────────────
export const CalloutIcon = bimIcon(
  'CalloutIcon',
  <path d="M2 4H18V15H2z M18 9H22L18 12 M5 8H15 M5 11H11" />,
);

// ── Saved viewpoint / camera: body + viewfinder pyramid + lens circle ─────────
export const ViewpointIcon = bimIcon(
  'ViewpointIcon',
  <>
    <path d="M2 7H16V17H2z" />
    <path d="M16 10L22 7V17L16 14" />
    <circle cx="9" cy="12" r="3" />
  </>,
);

// ── Section box (3D clipping box): dashed cube outline ───────────────────────
export const SectionBoxIcon = bimIcon(
  'SectionBoxIcon',
  <>
    <path d="M3 15H13V20H3z" />
    <path d="M3 15L8 10H18L13 15" />
    <path d="M13 15L18 10V15L13 20z" strokeDasharray="2 1.5" />
    <path d="M8 10V5L3 10" strokeDasharray="2 1.5" />
    <path d="M8 5H18" strokeDasharray="2 1.5" />
  </>,
);

// ── Structural grid: perpendicular grid lines with label bubble at top ────────
export const GridLineIcon = bimIcon(
  'GridLineIcon',
  <>
    <circle cx="12" cy="3" r="3" />
    <path d="M12 6V22 M2 12H22" />
  </>,
);

// ── Level datum: horizontal datum line with upward staff and triangle marker ──
// The triangle tip marks the exact elevation point.
export const LevelIcon = bimIcon('LevelIcon', <path d="M2 14H22 M6 14V7 M3 14L6 7L9 14" />);

// ── Detail line: drafted annotation line with endpoint crosshairs ─────────────
export const DetailLineIcon = bimIcon(
  'DetailLineIcon',
  <path d="M5 19L19 5 M5 19L9 19 M5 19L5 15 M19 5L15 5 M19 5L19 9" />,
);
