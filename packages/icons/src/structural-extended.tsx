/**
 * Structural extended icons — additional Revit-equivalent structural elements.
 *
 * Covers elements beyond the core structural set: beam systems, slabs,
 * reinforcement types, fasteners, welds, analytical elements, loads,
 * and boundary conditions.
 */
import { bimIcon } from './icon';

// ── Beam system: multiple parallel beams in plan view ────────────────────────
export const BeamSystemIcon = bimIcon(
  'BeamSystemIcon',
  <path d="M2 8H22 M2 12H22 M2 16H22 M4 8V16 M20 8V16" />,
);

// ── Foundation slab: mat/raft foundation — thick slab section at grade ────────
export const FoundationSlabIcon = bimIcon(
  'FoundationSlabIcon',
  <path d="M2 13H22V20H2z M2 11H22" />,
);

// ── Slab edge: slab section with thickened/dropped edge beam ─────────────────
export const SlabEdgeIcon = bimIcon(
  'SlabEdgeIcon',
  <path d="M2 12H22V16H2z M2 16H6V20H2z" />,
);

// ── Area reinforcement: rebar mesh over a surface area ───────────────────────
export const AreaReinforcementIcon = bimIcon(
  'AreaReinforcementIcon',
  <path d="M3 8H21 M3 12H21 M3 16H21 M7 5V19 M12 5V19 M17 5V19" />,
);

// ── Path reinforcement: rebar running along a curved/linear path ──────────────
export const PathReinforcementIcon = bimIcon(
  'PathReinforcementIcon',
  <path d="M3 12C7 8 11 16 15 12S19 8 21 12 M6 9V15 M12 9V15 M18 9V15" />,
);

// ── Fabric sheet: welded wire mesh sheet for concrete reinforcement ───────────
export const FabricSheetIcon = bimIcon(
  'FabricSheetIcon',
  <path d="M3 6H21V18H3z M6 6V18 M9 6V18 M12 6V18 M15 6V18 M18 6V18 M3 10H21 M3 14H21" />,
);

// ── Shear stud: headed anchor stud welded to structural steel ─────────────────
export const ShearStudIcon = bimIcon(
  'ShearStudIcon',
  <>
    <circle cx="12" cy="6" r="3" />
    <path d="M12 9V18 M9 18H15" />
  </>,
);

// ── Anchor: J-bolt or cast-in anchor embedded in concrete ────────────────────
export const AnchorIcon = bimIcon(
  'AnchorIcon',
  <path d="M12 3V16 M8 16H16 M8 20H16 M8 16V20" />,
);

// ── Bolt: structural bolt with head and threaded shaft ───────────────────────
export const BoltIcon = bimIcon(
  'BoltIcon',
  <>
    <path d="M7 3H17L18 7H6z" />
    <path d="M12 7V20 M9 11H15 M9 14H15 M9 17H15" />
  </>,
);

// ── Weld: weld joint symbol — reference line with V-groove fillet above ───────
export const WeldIcon = bimIcon(
  'WeldIcon',
  <path d="M2 16H22 M3 16L6 20 M8 16L12 8L16 16" />,
);

// ── Analytical node: structural analysis point with member connections ─────────
export const AnalyticalNodeIcon = bimIcon(
  'AnalyticalNodeIcon',
  <>
    <circle cx="12" cy="12" r="3" />
    <path d="M12 3V9 M12 15V21 M3 12H9 M15 12H21" />
  </>,
);

// ── Structural load: distributed load arrows on a member ─────────────────────
export const StructuralLoadIcon = bimIcon(
  'StructuralLoadIcon',
  <path d="M3 6H21 M6 6V14 M12 6V14 M18 6V14 M4 14L6 11 M10 14L12 11 M16 14L18 11" />,
);

// ── Boundary condition: pin support symbol — inverted triangle + ground line ──
export const BoundaryConditionIcon = bimIcon(
  'BoundaryConditionIcon',
  <path d="M8 8H16L12 16z M6 16H18 M4 18H20" />,
);
