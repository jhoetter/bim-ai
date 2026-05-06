/**
 * Workflow, coordination, and data management icons.
 *
 * Covers the project-management layer of BIM: worksharing (worksets, sync),
 * design exploration (options), contractor coordination (RFI, submittal),
 * scan data (point cloud), open formats (IFC), analysis (energy, QTO),
 * and model management concepts (LOD, scope box, digital twin).
 */
import { bimIcon } from './icon';

// ── Workset: folder-tab container grouping elements by discipline ──────────────
export const WorksetIcon = bimIcon(
  'WorksetIcon',
  <path d="M3 7H21V19H3z M3 7L3 4H10L12 7 M8 12H16 M8 15H13" />,
);

// ── Design option: shared stem branching into two alternative outcomes ────────
export const DesignOptionIcon = bimIcon(
  'DesignOptionIcon',
  <path d="M12 4V10 M12 10L7 19 M12 10L17 19 M5 16H9V20H5z M15 16H19V20H15z" />,
);

// ── Revision: document with corner tab + horizontal revision entry rows ────────
export const RevisionIcon = bimIcon(
  'RevisionIcon',
  <path d="M5 3H19V21H5z M5 3L8 3V6H5 M9 10H15 M9 13H13 M5 17H19 M8 18.5H16" />,
);

// ── RFI: document with question mark asking for design clarification ───────────
export const RFIIcon = bimIcon(
  'RFIIcon',
  <>
    <path d="M4 3H20V21H4z" />
    <path d="M10 9C10 7 14 7 14 10C14 13 12 13 12 15" />
    <path d="M12 17V18" />
  </>,
);

// ── Submittal: document with corner fold + stamp approval circle ───────────────
export const SubmittalIcon = bimIcon(
  'SubmittalIcon',
  <>
    <path d="M4 3H18V21H4z M18 3L22 7H18V3" />
    <path d="M7 10H15 M7 13H15 M7 16H11" />
    <circle cx="16" cy="17" r="4" />
    <path d="M14 17L15.5 18.5L18.5 15.5" />
  </>,
);

// ── Point cloud: scattered dot field representing 3D scan data ────────────────
// Uses near-zero-length paths with round caps to render as visible dots.
export const PointCloudIcon = bimIcon(
  'PointCloudIcon',
  <path
    d="M6 8v0 M11 6v0 M16 7v0 M20 10v0 M4 13v0 M9 15v0 M14 12v0 M18 15v0 M7 19v0 M12 20v0 M17 18v0 M21 14v0"
    strokeWidth={2.5}
  />,
);

// ── Digital twin: building outline with wireless signal arcs alongside ─────────
export const DigitalTwinIcon = bimIcon(
  'DigitalTwinIcon',
  <>
    <path d="M3 20H15V10H9V6H13L9 2L5 6H9V10H3z" />
    <path d="M18 7A5 5 0 0 1 18 17" />
    <path d="M20 10A2 2 0 0 1 20 14" />
  </>,
);

// ── Sync to central: two opposing circular arrows (rotate/refresh shape) ──────
export const SyncIcon = bimIcon(
  'SyncIcon',
  <path d="M4 12A8 8 0 0 1 18 6 M20 12A8 8 0 0 1 6 18 M18 6L15 3L18 3 M6 18L9 21L6 21" />,
);

// ── Transmittal: envelope with open flap indicating outgoing package ──────────
export const TransmittalIcon = bimIcon(
  'TransmittalIcon',
  <path d="M3 6H21V18H3z M3 6L12 13L21 6 M3 18L9 12 M21 18L15 12" />,
);

// ── IFC: building footprint with open-format link indicator arrow ──────────────
export const IFCIcon = bimIcon(
  'IFCIcon',
  <>
    <path d="M4 20H20 M6 20V8H18V20 M6 8L12 4L18 8 M10 14H14V20" />
    <path d="M18 5L22 5L22 9" />
    <path d="M22 5L19 8" />
  </>,
);

// ── LOD: three progressively taller boxes showing increasing detail ────────────
export const LODIcon = bimIcon(
  'LODIcon',
  <path d="M2 20H22 M3 15H8V20H3z M9 11H14V20H9z M15 7H21V20H15z M15 12H20 M15 16H20" />,
);

// ── Quantity takeoff: table of items with a quantities column ─────────────────
export const QuantityTakeoffIcon = bimIcon(
  'QuantityTakeoffIcon',
  <path d="M4 3H20V21H4z M16 3V21 M4 8H20 M4 12H20 M4 16H20 M4 19H20" />,
);

// ── Energy model: lightning bolt indicating energy analysis mode ───────────────
export const EnergyModelIcon = bimIcon(
  'EnergyModelIcon',
  <path d="M14 2L6 14H12L10 22L18 10H12z" />,
);

// ── Scope box: wireframe bounding box with a front cutting plane ──────────────
export const ScopeBoxIcon = bimIcon(
  'ScopeBoxIcon',
  <>
    <path d="M3 15H13V20H3z" />
    <path d="M3 15L8 10H18L13 15" />
    <path d="M13 15L18 10V15L13 20z" strokeDasharray="2 1.5" />
    <path d="M8 10V5L3 10" strokeDasharray="2 1.5" />
    <path d="M8 5H18" strokeDasharray="2 1.5" />
  </>,
);
