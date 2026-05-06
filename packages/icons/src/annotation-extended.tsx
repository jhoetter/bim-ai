/**
 * Annotation extended icons — additional Revit-equivalent annotation types.
 *
 * Covers angular/radial/arc-length/ordinal dimensions, spot coordinate,
 * elevation tag, filled/masking regions, detail components, repeating
 * details, insulation annotation, text, multi-category/material/room/
 * space/area/stair tags, generic symbol, stair path annotation, and
 * reference point.
 */
import { bimIcon } from './icon';

// ── Angular dimension: two legs from vertex + arc spanning the angle ──────────
export const AngularDimensionIcon = bimIcon(
  'AngularDimensionIcon',
  <path d="M6 18L12 8L18 18 M9 15A4 4 0 0 0 15 15" />,
);

// ── Radial dimension: partial arc with radius line and arrowhead ──────────────
export const RadialDimensionIcon = bimIcon(
  'RadialDimensionIcon',
  <>
    <path d="M6 20A10 10 0 0 1 20 6" />
    <path d="M13 13L20 6 M17 4L20 6L22 9" />
  </>,
);

// ── Arc length dimension: two concentric arcs with tick marks ────────────────
export const ArcLengthDimensionIcon = bimIcon(
  'ArcLengthDimensionIcon',
  <path d="M4 20A10 10 0 0 1 20 20 M4 16A12 12 0 0 1 20 16 M4 16V20 M20 16V20" />,
);

// ── Ordinal dimension: vertical baseline with graduated extension lines ────────
export const OrdinalDimensionIcon = bimIcon(
  'OrdinalDimensionIcon',
  <path d="M2 20H22 M6 20V8 M12 20V12 M18 20V16 M5 8H7 M11 12H13 M17 16H19" />,
);

// ── Spot coordinate: 3D coordinate point tag with X/Y leaders ────────────────
export const SpotCoordinateIcon = bimIcon(
  'SpotCoordinateIcon',
  <>
    <circle cx="12" cy="12" r="2" />
    <path d="M12 2V10 M14 12H22 M10 12H2" />
  </>,
);

// ── Elevation tag: hexagonal view bubble with direction indicator ─────────────
// The standard Revit elevation tag is a hexagon with a filled triangle inside.
export const ElevationTagIcon = bimIcon(
  'ElevationTagIcon',
  <>
    <path d="M9 3L3 12L9 21H15L21 12L15 3z" />
    <path d="M12 9V15 M9 12L12 9L15 12" />
  </>,
);

// ── Filled region: rectangle with diagonal hatch fill ────────────────────────
export const FilledRegionIcon = bimIcon(
  'FilledRegionIcon',
  <path d="M3 3H21V21H3z M3 7L7 3 M3 11L11 3 M3 15L15 3 M3 19L19 3 M7 21L21 7 M11 21L21 11 M15 21L21 15 M19 21L21 19" />,
);

// ── Masking region: dashed border rectangle masking/hiding content ────────────
export const MaskingRegionIcon = bimIcon(
  'MaskingRegionIcon',
  <>
    <path d="M3 3H21V21H3z" strokeDasharray="4 2" />
    <path d="M3 3L21 21 M21 3L3 21" />
  </>,
);

// ── Detail component: 2D drafted symbol placed in a detail view ───────────────
export const DetailComponentIcon = bimIcon(
  'DetailComponentIcon',
  <>
    <circle cx="12" cy="12" r="8" />
    <circle cx="12" cy="12" r="4" />
    <path d="M12 4V8 M12 16V20 M4 12H8 M16 12H20" />
  </>,
);

// ── Repeating detail: same element repeated along a path ─────────────────────
export const RepeatingDetailIcon = bimIcon(
  'RepeatingDetailIcon',
  <path d="M2 8H8V16H2z M9 8H15V16H9z M16 8H22V16H16z" />,
);

// ── Insulation annotation: batt insulation sine-wave symbol ──────────────────
export const InsulationAnnotationIcon = bimIcon(
  'InsulationAnnotationIcon',
  <path d="M2 12C3 8 5 16 6 12S9 8 10 12S13 8 14 12S17 8 18 12S21 8 22 12" />,
);

// ── Text annotation: bold T representing the text annotation tool ─────────────
export const TextAnnotationIcon = bimIcon(
  'TextAnnotationIcon',
  <path d="M4 5H20 M12 5V19 M8 19H16" />,
);

// ── Multi-category tag: two connected tag bubbles for multi-element tagging ───
export const MultiCategoryTagIcon = bimIcon(
  'MultiCategoryTagIcon',
  <path d="M4 4H20V11H4z M8 11H16V18H8z M12 11V18" />,
);

// ── Material tag: hatch sample + leader pointing to a material surface ────────
export const MaterialTagIcon = bimIcon(
  'MaterialTagIcon',
  <path d="M3 11H11V17H3z M3 11L11 17 M11 14L17 8 M17 8H21V12H17" />,
);

// ── Room tag: rectangular tag showing room name and area ─────────────────────
export const RoomTagIcon = bimIcon('RoomTagIcon', <path d="M4 7H20V17H4z M7 11H17 M7 14H13" />);

// ── Space tag: MEP space tag with additional HVAC zone indicator ──────────────
export const SpaceTagIcon = bimIcon(
  'SpaceTagIcon',
  <path d="M4 7H20V17H4z M7 11H17 M7 14H17 M12 14V17" />,
);

// ── Area tag: area zone tag showing calculated area value ────────────────────
export const AreaTagIcon = bimIcon(
  'AreaTagIcon',
  <path d="M4 7H20V17H4z M7 11H17 M9 14H11V17H9 M12 14H16" />,
);

// ── Stair tag: circular tag with up-direction arrow for stair identification ──
export const StairTagIcon = bimIcon(
  'StairTagIcon',
  <>
    <circle cx="12" cy="12" r="7" />
    <path d="M12 15V9 M9 12L12 9L15 12" />
  </>,
);

// ── Symbol: generic drafting symbol — circle with cross ──────────────────────
export const SymbolIcon = bimIcon(
  'SymbolIcon',
  <>
    <circle cx="12" cy="12" r="8" />
    <path d="M8 12H16 M12 8V16" />
  </>,
);

// ── Stair path annotation: stair run direction with cut line ─────────────────
export const StairPathAnnotationIcon = bimIcon(
  'StairPathAnnotationIcon',
  <>
    <path d="M4 20H8V16H12V12H16V8H20 M17 5L20 8L23 5" />
    <path d="M4 10H10" strokeDasharray="2 1.5" />
  </>,
);

// ── Reference point: survey reference marker — diamond with crosshair ─────────
export const ReferencePointIcon = bimIcon(
  'ReferencePointIcon',
  <path d="M12 4L20 12L12 20L4 12z M12 4V20 M4 12H20" />,
);
