/**
 * Phase 3 — Organization, coordination, and AI advisor icons.
 *
 * Covers BIM data organization (families, groups, assemblies, linked models,
 * materials, phases), issue coordination (BCF issues, clashes), and the
 * AI advisor workflow (validation rules, deviations).
 */
import { bimIcon } from './icon';

// ── Parametric family: component body with parameter handles at 6 control pts ─
export const FamilyIcon = bimIcon(
  'FamilyIcon',
  <path d="M6 8H18V16H6z M6 8V5 M18 8V5 M6 16V19 M18 16V19 M3 12H6 M18 12H21" />,
);

// ── Family type: parent row above + child row indented below + connector ───────
export const FamilyTypeIcon = bimIcon(
  'FamilyTypeIcon',
  <path d="M2 5H14V9H2z M8 13H20V18H8z M5 9V13" />,
);

// ── Group: square-bracket selection surround with content lines inside ─────────
export const GroupIcon = bimIcon(
  'GroupIcon',
  <path d="M5 4V3H9 M15 3H19V4 M5 20V21H9 M15 21H19V20 M8 10H16 M8 14H16" />,
);

// ── Assembly: two rectangular parts connected by an L-shaped joint ────────────
export const AssemblyIcon = bimIcon(
  'AssemblyIcon',
  <path d="M2 13H10V20H2z M14 4H22V11H14z M10 16H14 M12 11V16" />,
);

// ── Linked model: two building footprints connected by a link line ─────────────
export const LinkedModelIcon = bimIcon(
  'LinkedModelIcon',
  <path d="M2 11H11V20H2z M13 4H22V13H13z M11 14L13 10" />,
);

// ── Material / assembly layers: four stacked rectangles, widest at bottom ─────
export const MaterialIcon = bimIcon(
  'MaterialIcon',
  <path d="M2 18H22V21H2z M5 14H19V18H5z M7 10H17V14H7z M9 6H15V10H9z" />,
);

// ── Wall layer: wall outline with layer boundaries and vertical hatch lines ───
export const WallLayerIcon = bimIcon(
  'WallLayerIcon',
  <path d="M2 4H22V20H2z M8 4V20 M16 4V20 M10 4V20 M12 4V20 M14 4V20" />,
);

// ── Phase / timeline bracket: horizontal timeline with phase bracket above ────
export const PhaseIcon = bimIcon(
  'PhaseIcon',
  <path d="M2 12H22 M8 12V6H16V12 M10 4H14 M12 4V6" />,
);

// ── BCF issue / flag: flagpole with V-notch pennant ───────────────────────────
export const IssueIcon = bimIcon(
  'IssueIcon',
  <path d="M7 20V4H19L16 9L19 14H7z" />,
);

// ── Clash: two overlapping rectangles with an X marking the conflict zone ─────
export const ClashIcon = bimIcon(
  'ClashIcon',
  <>
    <path d="M2 10H13V20H2z" />
    <path d="M11 4H22V14H11z" />
    <path d="M11 10L13 14 M11 14L13 10" />
  </>,
);

// ── Validation rule: document with text lines and a checkmark at the bottom ───
export const ValidationRuleIcon = bimIcon(
  'ValidationRuleIcon',
  <path d="M4 3H20V21H4z M8 10H16 M8 14H13 M9 17L11 19L15 15" />,
);

// ── Deviation (Δ): delta warning triangle with exclamation mark inside ─────────
// Distinct from a generic AlertTriangle: uses filled delta shape + longer body.
export const DeviationIcon = bimIcon(
  'DeviationIcon',
  <>
    <path d="M12 3L2 21H22z" />
    <path d="M12 9V15" />
    <path d="M12 17.5L12 18.5" strokeLinecap="round" strokeWidth={2} />
  </>,
);
