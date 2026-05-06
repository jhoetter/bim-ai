/**
 * Views extended icons — additional Revit-equivalent view types.
 *
 * Covers RCP, structural framing plan, area plan, detail and drafting
 * views, walkthrough, legend, sheet list, note block, and schedule types.
 */
import { bimIcon } from './icon';

// ── Reflected ceiling plan: plan view looking upward at ceiling ───────────────
// Room boundary with an upward-pointing arrow (looking up vs. down).
export const ReflectedCeilingPlanIcon = bimIcon(
  'ReflectedCeilingPlanIcon',
  <path d="M3 4H21V18H3z M12 14V9 M9 12L12 9L15 12" />,
);

// ── Structural plan: column grid nodes connected by beam lines ────────────────
export const StructuralPlanIcon = bimIcon(
  'StructuralPlanIcon',
  <>
    <circle cx="5" cy="5" r="2" />
    <circle cx="19" cy="5" r="2" />
    <circle cx="5" cy="19" r="2" />
    <circle cx="19" cy="19" r="2" />
    <path d="M7 5H17 M7 19H17 M5 7V17 M19 7V17" />
  </>,
);

// ── Area plan: floor plan subdivided into area zones ─────────────────────────
export const AreaPlanIcon = bimIcon('AreaPlanIcon', <path d="M3 3H21V21H3z M3 12H21 M12 3V12" />);

// ── Detail view: magnifier over a plan area — close-up view ──────────────────
export const DetailViewIcon = bimIcon(
  'DetailViewIcon',
  <>
    <path d="M2 4H12V15H2z" />
    <circle cx="16" cy="10" r="5" />
    <path d="M20 14L22 16" />
  </>,
);

// ── Drafting view: 2D drafting sheet with pen/pencil creating lines ───────────
export const DraftingViewIcon = bimIcon(
  'DraftingViewIcon',
  <>
    <path d="M4 4H18V20H4z" />
    <path d="M7 9H14 M7 13H14 M7 17H11" />
    <path d="M19 4L22 7L16 15L13 16L14 13z" />
  </>,
);

// ── Walkthrough: animation path — S-curve with forward arrow ─────────────────
export const WalkthroughIcon = bimIcon(
  'WalkthroughIcon',
  <path d="M2 12C6 6 10 8 12 12C14 16 18 14 22 12 M18 10L22 12L18 14" />,
);

// ── Legend: three-row table with color swatches and text labels ───────────────
export const LegendIcon = bimIcon(
  'LegendIcon',
  <path d="M3 5H21V19H3z M3 9H21 M3 14H21 M5 6H8V8H5z M5 10H8V13H5z M5 15H8V18H5z M10 7H19 M10 11H19 M10 16H19" />,
);

// ── Sheet list: document list — stacked sheet + text row lines ────────────────
export const SheetListIcon = bimIcon(
  'SheetListIcon',
  <>
    <path d="M5 6H19V21H5z M3 4H17V6H3z" />
    <path d="M8 11H16 M8 14H16 M8 17H13" />
  </>,
);

// ── Note block: annotation notepad with text lines ───────────────────────────
export const NoteBlockIcon = bimIcon(
  'NoteBlockIcon',
  <path d="M4 3H20V18H4z M7 8H17 M7 12H17 M7 15H12 M4 18L4 21H12L20 18" />,
);

// ── View list: a schedule listing all project views ──────────────────────────
export const ViewListIcon = bimIcon(
  'ViewListIcon',
  <path d="M3 4H21V20H3z M3 8H21 M3 12H21 M3 16H21" />,
);

// ── Panel schedule view: two-column electrical panel circuit view ─────────────
export const PanelScheduleViewIcon = bimIcon(
  'PanelScheduleViewIcon',
  <path d="M2 4H22V20H2z M12 4V20 M2 8H22 M2 12H22 M2 16H22 M5 6H11 M13 6H19" />,
);

// ── Graphical column schedule: column base grid with elevation marks ──────────
export const GraphicalColumnScheduleIcon = bimIcon(
  'GraphicalColumnScheduleIcon',
  <>
    <circle cx="7" cy="18" r="2" />
    <circle cx="17" cy="18" r="2" />
    <path d="M7 16V4 M17 16V4 M4 8H10 M14 8H20 M4 12H10 M14 12H20" />
  </>,
);

// ── View reference: callout bubble with leader referencing another view ────────
export const ViewReferenceIcon = bimIcon(
  'ViewReferenceIcon',
  <path d="M3 5H15V14H3z M9 14V18 M6 18H12 M15 9L19 5V13L15 9" />,
);
