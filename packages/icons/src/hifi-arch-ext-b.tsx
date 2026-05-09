/**
 * High-fidelity 48×48 BIM icons — architectural extended set B.
 *
 * CSS custom properties (set on a wrapper element):
 *   --hi-concrete / --hi-concrete-op  — structural concrete (stone gray)
 *   --hi-finish   / --hi-finish-op    — plaster, paper, gypsum (warm white)
 *   --hi-glass    / --hi-glass-op     — glazing (sky blue)
 *   --hi-steel    / --hi-steel-op     — steel, metal, frames (blue-gray)
 *   --hi-leaf                          — timber/wood (amber, no opacity var)
 *   --hi-room     / --hi-room-op      — interior zone (pale yellow)
 *   --hi-roof     / --hi-roof-op      — roof surface / alert color (terracotta)
 *
 * Without variables the icons render in monochrome currentColor.
 *
 * Stroke hierarchy:
 *   strokeWidth 2    — primary outlines
 *   strokeWidth 1.5  — secondary edges, reveals
 *   strokeWidth 0.75 — hatch, detail lines
 */
import { bimIconHifi } from './icon';

// ── VerticalOpeningHifi — floor slab (section) with rectangular void cut through ──
export const VerticalOpeningHifi = bimIconHifi(
  'VerticalOpeningHifi',
  <>
    {/* ── Left slab segment — concrete fill with hatch ── */}
    <rect
      x="4"
      y="18"
      width="13"
      height="12"
      style={{
        fill: 'var(--hi-concrete, currentColor)',
        fillOpacity: 'var(--hi-concrete-op, 0.14)',
      }}
      strokeWidth={2}
    />
    {/* Left slab hatch */}
    <g strokeWidth={0.75} strokeOpacity={0.28}>
      <line x1="4" y1="24" x2="8" y2="18" />
      <line x1="4" y1="30" x2="14" y2="18" />
      <line x1="8" y1="30" x2="17" y2="21" />
      <line x1="14" y1="30" x2="17" y2="27" />
    </g>

    {/* ── Right slab segment — concrete fill with hatch ── */}
    <rect
      x="31"
      y="18"
      width="13"
      height="12"
      style={{
        fill: 'var(--hi-concrete, currentColor)',
        fillOpacity: 'var(--hi-concrete-op, 0.14)',
      }}
      strokeWidth={2}
    />
    {/* Right slab hatch */}
    <g strokeWidth={0.75} strokeOpacity={0.28}>
      <line x1="31" y1="24" x2="35" y2="18" />
      <line x1="31" y1="30" x2="41" y2="18" />
      <line x1="37" y1="30" x2="44" y2="21" />
      <line x1="43" y1="30" x2="44" y2="29" />
    </g>

    {/* ── Void — room fill between slabs ── */}
    <rect
      x="17"
      y="18"
      width="14"
      height="12"
      style={{ fill: 'var(--hi-room, currentColor)', fillOpacity: 'var(--hi-room-op, 0.20)' }}
      stroke="none"
    />
    {/* Void X-pattern indicating void/opening */}
    <g strokeWidth={0.75} strokeOpacity={0.35}>
      <line x1="17" y1="18" x2="31" y2="30" />
      <line x1="31" y1="18" x2="17" y2="30" />
    </g>

    {/* ── Bold void boundary lines ── */}
    <line x1="17" y1="18" x2="17" y2="30" strokeWidth={2} />
    <line x1="31" y1="18" x2="31" y2="30" strokeWidth={2} />

    {/* ── Dashed extent markers at void edges ── */}
    <line
      x1="17"
      y1="14"
      x2="17"
      y2="18"
      strokeWidth={1}
      strokeDasharray="3 2"
      strokeOpacity={0.55}
    />
    <line
      x1="17"
      y1="30"
      x2="17"
      y2="34"
      strokeWidth={1}
      strokeDasharray="3 2"
      strokeOpacity={0.55}
    />
    <line
      x1="31"
      y1="14"
      x2="31"
      y2="18"
      strokeWidth={1}
      strokeDasharray="3 2"
      strokeOpacity={0.55}
    />
    <line
      x1="31"
      y1="30"
      x2="31"
      y2="34"
      strokeWidth={1}
      strokeDasharray="3 2"
      strokeOpacity={0.55}
    />

    {/* ── Drop arrows inside the void ── */}
    {/* Left drop arrow */}
    <line x1="21" y1="10" x2="21" y2="40" strokeWidth={1.5} strokeOpacity={0.7} />
    <polyline points="18.5,37 21,40 23.5,37" strokeWidth={1.5} fill="none" strokeOpacity={0.7} />
    {/* Right drop arrow */}
    <line x1="27" y1="10" x2="27" y2="40" strokeWidth={1.5} strokeOpacity={0.7} />
    <polyline points="24.5,37 27,40 29.5,37" strokeWidth={1.5} fill="none" strokeOpacity={0.7} />
  </>,
);

// ── DormerOpeningHifi — dormer window protruding from a roof slope (section) ──
export const DormerOpeningHifi = bimIconHifi(
  'DormerOpeningHifi',
  <>
    {/* ── Main roof slope — terracotta fill ── */}
    <polygon
      points="4,38 24,10 44,38"
      style={{ fill: 'var(--hi-roof, currentColor)', fillOpacity: 'var(--hi-roof-op, 0.18)' }}
      strokeWidth={2}
    />

    {/* ── Dormer bump — cuts into the main slope ── */}
    {/* Dormer body (finish walls) */}
    <rect
      x="16"
      y="22"
      width="16"
      height="16"
      style={{ fill: 'var(--hi-finish, currentColor)', fillOpacity: 'var(--hi-finish-op, 0.18)' }}
      strokeWidth={1.5}
    />

    {/* ── Dormer roof — small triangular peak ── */}
    <polygon
      points="14,22 24,12 34,22"
      style={{ fill: 'var(--hi-roof, currentColor)', fillOpacity: 'var(--hi-roof-op, 0.28)' }}
      strokeWidth={1.5}
    />

    {/* ── Dormer window — glass fill ── */}
    <rect
      x="20"
      y="27"
      width="8"
      height="8"
      style={{ fill: 'var(--hi-glass, currentColor)', fillOpacity: 'var(--hi-glass-op, 0.40)' }}
      strokeWidth={1.5}
    />
    {/* Window cross-bar */}
    <line x1="24" y1="27" x2="24" y2="35" strokeWidth={0.75} strokeOpacity={0.5} />
    <line x1="20" y1="31" x2="28" y2="31" strokeWidth={0.75} strokeOpacity={0.5} />

    {/* ── Dormer wall-to-roof junction lines ── */}
    <line x1="16" y1="22" x2="14" y2="22" strokeWidth={1.5} strokeOpacity={0.6} />
    <line x1="32" y1="22" x2="34" y2="22" strokeWidth={1.5} strokeOpacity={0.6} />

    {/* ── Base of dormer meets slab ── */}
    <line x1="16" y1="38" x2="32" y2="38" strokeWidth={1.5} />
  </>,
);

// ── FaceOpeningHifi — irregular opening cut in a wall face (plan view) ──
export const FaceOpeningHifi = bimIconHifi(
  'FaceOpeningHifi',
  <>
    {/* ── Left wall segment — concrete fill with hatch ── */}
    <rect
      x="4"
      y="8"
      width="12"
      height="32"
      style={{
        fill: 'var(--hi-concrete, currentColor)',
        fillOpacity: 'var(--hi-concrete-op, 0.14)',
      }}
      strokeWidth={2}
    />
    {/* Left wall hatch */}
    <g strokeWidth={0.75} strokeOpacity={0.28}>
      <line x1="4" y1="16" x2="10" y2="8" />
      <line x1="4" y1="24" x2="16" y2="10" />
      <line x1="4" y1="32" x2="16" y2="18" />
      <line x1="4" y1="40" x2="16" y2="26" />
      <line x1="8" y1="40" x2="16" y2="32" />
    </g>

    {/* ── Right wall segment — concrete fill with hatch ── */}
    <rect
      x="32"
      y="8"
      width="12"
      height="32"
      style={{
        fill: 'var(--hi-concrete, currentColor)',
        fillOpacity: 'var(--hi-concrete-op, 0.14)',
      }}
      strokeWidth={2}
    />
    {/* Right wall hatch */}
    <g strokeWidth={0.75} strokeOpacity={0.28}>
      <line x1="32" y1="16" x2="38" y2="8" />
      <line x1="32" y1="24" x2="44" y2="10" />
      <line x1="32" y1="32" x2="44" y2="18" />
      <line x1="32" y1="40" x2="44" y2="26" />
      <line x1="36" y1="40" x2="44" y2="32" />
    </g>

    {/* ── Opening fill — room color ── */}
    <path
      d="M 16,8 L 32,8 L 32,40 L 16,40 Z"
      style={{ fill: 'var(--hi-room, currentColor)', fillOpacity: 'var(--hi-room-op, 0.22)' }}
      stroke="none"
    />

    {/* ── Bold opening boundary lines ── */}
    <line x1="16" y1="8" x2="16" y2="40" strokeWidth={2} />
    <line x1="32" y1="8" x2="32" y2="40" strokeWidth={2} />

    {/* ── Dashed extent markers at opening edges ── */}
    <line
      x1="10"
      y1="8"
      x2="16"
      y2="8"
      strokeWidth={1}
      strokeDasharray="3 2"
      strokeOpacity={0.55}
    />
    <line
      x1="32"
      y1="8"
      x2="38"
      y2="8"
      strokeWidth={1}
      strokeDasharray="3 2"
      strokeOpacity={0.55}
    />
    <line
      x1="10"
      y1="40"
      x2="16"
      y2="40"
      strokeWidth={1}
      strokeDasharray="3 2"
      strokeOpacity={0.55}
    />
    <line
      x1="32"
      y1="40"
      x2="38"
      y2="40"
      strokeWidth={1}
      strokeDasharray="3 2"
      strokeOpacity={0.55}
    />

    {/* ── Corner extent markers ── */}
    <polyline points="16,11 16,8 19,8" strokeWidth={1} fill="none" strokeOpacity={0.6} />
    <polyline points="29,8 32,8 32,11" strokeWidth={1} fill="none" strokeOpacity={0.6} />
    <polyline points="16,37 16,40 19,40" strokeWidth={1} fill="none" strokeOpacity={0.6} />
    <polyline points="29,40 32,40 32,37" strokeWidth={1} fill="none" strokeOpacity={0.6} />

    {/* ── Diagonal opening indicator inside void ── */}
    <line
      x1="16"
      y1="8"
      x2="32"
      y2="40"
      strokeWidth={0.75}
      strokeDasharray="4 3"
      strokeOpacity={0.3}
    />
    <line
      x1="32"
      y1="8"
      x2="16"
      y2="40"
      strokeWidth={0.75}
      strokeDasharray="4 3"
      strokeOpacity={0.3}
    />
  </>,
);

// ── RoomSeparatorHifi — invisible boundary between two adjacent rooms ──
export const RoomSeparatorHifi = bimIconHifi(
  'RoomSeparatorHifi',
  <>
    {/* ── Left room fill — room pale yellow ── */}
    <rect
      x="4"
      y="6"
      width="20"
      height="36"
      style={{ fill: 'var(--hi-room, currentColor)', fillOpacity: 'var(--hi-room-op, 0.22)' }}
      strokeWidth={1.5}
    />

    {/* ── Right room fill — finish warm white ── */}
    <rect
      x="24"
      y="6"
      width="20"
      height="36"
      style={{ fill: 'var(--hi-finish, currentColor)', fillOpacity: 'var(--hi-finish-op, 0.22)' }}
      strokeWidth={1.5}
    />

    {/* ── Room separator dashed line ── */}
    <line x1="24" y1="6" x2="24" y2="42" strokeWidth={1.5} strokeDasharray="5 3" />

    {/* ── Triangle markers along the separator line ── */}
    {/* Top triangle (pointing right) */}
    <polygon
      points="24,12 28,15 24,18"
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.30)' }}
      strokeWidth={1}
    />
    {/* Middle triangle (pointing left) */}
    <polygon
      points="24,22 20,25 24,28"
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.30)' }}
      strokeWidth={1}
    />
    {/* Bottom triangle (pointing right) */}
    <polygon
      points="24,32 28,35 24,38"
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.30)' }}
      strokeWidth={1}
    />

    {/* ── Room label placeholders ── */}
    {/* Left room label */}
    <line x1="6" y1="24" x2="18" y2="24" strokeWidth={0.75} strokeOpacity={0.35} />
    <line x1="7" y1="27" x2="16" y2="27" strokeWidth={0.75} strokeOpacity={0.25} />
    {/* Right room label */}
    <line x1="26" y1="24" x2="38" y2="24" strokeWidth={0.75} strokeOpacity={0.35} />
    <line x1="27" y1="27" x2="37" y2="27" strokeWidth={0.75} strokeOpacity={0.25} />
  </>,
);

// ── AreaBoundaryHifi — closed boundary separating two area zones ──
export const AreaBoundaryHifi = bimIconHifi(
  'AreaBoundaryHifi',
  <>
    {/* ── Area A fill — room pale yellow (left/top zone) ── */}
    <path
      d="M 4,4 L 44,4 L 44,26 L 4,26 Z"
      style={{ fill: 'var(--hi-room, currentColor)', fillOpacity: 'var(--hi-room-op, 0.20)' }}
      stroke="none"
    />

    {/* ── Area B fill — finish warm white (bottom zone) ── */}
    <path
      d="M 4,26 L 44,26 L 44,44 L 4,44 Z"
      style={{ fill: 'var(--hi-finish, currentColor)', fillOpacity: 'var(--hi-finish-op, 0.22)' }}
      stroke="none"
    />

    {/* ── Outer bounding box ── */}
    <rect x="4" y="4" width="40" height="40" strokeWidth={1.5} strokeOpacity={0.5} fill="none" />

    {/* ── Bold dashed boundary line between areas ── */}
    <line x1="4" y1="26" x2="44" y2="26" strokeWidth={2} strokeDasharray="6 3" />

    {/* ── Boundary corner markers ── */}
    {/* Left end marker */}
    <line x1="4" y1="21" x2="4" y2="31" strokeWidth={1.5} />
    {/* Right end marker */}
    <line x1="44" y1="21" x2="44" y2="31" strokeWidth={1.5} />

    {/* ── Small diamond markers at boundary corners ── */}
    <polygon
      points="4,26 7,23 10,26 7,29"
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.30)' }}
      strokeWidth={0.75}
    />
    <polygon
      points="44,26 41,23 38,26 41,29"
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.30)' }}
      strokeWidth={0.75}
    />

    {/* ── Area A label badge ── */}
    <rect
      x="15"
      y="9"
      width="18"
      height="9"
      rx="1.5"
      style={{ fill: 'var(--hi-room, currentColor)', fillOpacity: 'var(--hi-room-op, 0.40)' }}
      strokeWidth={1}
    />
    <line x1="17" y1="13" x2="31" y2="13" strokeWidth={0.75} strokeOpacity={0.55} />

    {/* ── Area B label badge ── */}
    <rect
      x="15"
      y="30"
      width="18"
      height="9"
      rx="1.5"
      style={{ fill: 'var(--hi-finish, currentColor)', fillOpacity: 'var(--hi-finish-op, 0.45)' }}
      strokeWidth={1}
    />
    <line x1="17" y1="34" x2="31" y2="34" strokeWidth={0.75} strokeOpacity={0.55} />
  </>,
);

// ── ReferencePlaneHifi — datum plane in 3D isometric with name label and normal ──
export const ReferencePlaneHifi = bimIconHifi(
  'ReferencePlaneHifi',
  <>
    {/* ── Flat plane in isometric — parallelogram ── */}
    {/* Plane fill — steel at very low opacity */}
    <polygon
      points="6,30 24,20 44,30 26,40"
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.10)' }}
      stroke="none"
    />
    {/* Plane outline */}
    <polygon points="6,30 24,20 44,30 26,40" strokeWidth={1.5} fill="none" />

    {/* ── Grid lines on the plane surface ── */}
    {/* Horizontal iso grid lines */}
    <g strokeWidth={0.75} strokeOpacity={0.3}>
      <line x1="10,33" y1="0" x2="30,43" y2="0" />
      <line x1="15,27" y1="0" x2="35,37" y2="0" />
      <line x1="20,22" y1="0" x2="40,32" y2="0" />
    </g>
    {/* Diagonal iso grid lines */}
    <g strokeWidth={0.75} strokeOpacity={0.3}>
      <line x1="6" y1="30" x2="26" y2="40" />
      <line x1="14" y1="25" x2="34" y2="35" />
      <line x1="24" y1="20" x2="44" y2="30" />
    </g>

    {/* ── Normal indicator arrow — perpendicular to plane ── */}
    <line x1="25" y1="30" x2="25" y2="8" strokeWidth={1.5} />
    <polyline points="22,11 25,8 28,11" strokeWidth={1.5} fill="none" />

    {/* ── Name label on the plane surface ── */}
    <rect
      x="10"
      y="28"
      width="14"
      height="7"
      rx="1"
      style={{ fill: 'var(--hi-finish, currentColor)', fillOpacity: 'var(--hi-finish-op, 0.55)' }}
      strokeWidth={0.75}
    />
    <line x1="11" y1="31" x2="23" y2="31" strokeWidth={0.75} strokeOpacity={0.55} />
    <line x1="11" y1="33.5" x2="19" y2="33.5" strokeWidth={0.75} strokeOpacity={0.4} />

    {/* ── Perpendicular indicator marker at base of normal ── */}
    <polyline points="25,26 28,26 28,30" strokeWidth={1} fill="none" strokeOpacity={0.6} />
  </>,
);

// ── WorkPlaneHifi — active sketching plane with grid and pencil cursor ──
export const WorkPlaneHifi = bimIconHifi(
  'WorkPlaneHifi',
  <>
    {/* ── Work plane — glass fill at very low opacity ── */}
    <polygon
      points="6,32 22,22 44,32 28,42"
      style={{ fill: 'var(--hi-glass, currentColor)', fillOpacity: 'var(--hi-glass-op, 0.12)' }}
      stroke="none"
    />
    {/* Plane bold outline */}
    <polygon points="6,32 22,22 44,32 28,42" strokeWidth={1.5} fill="none" />

    {/* ── Grid on the plane surface ── */}
    <g strokeWidth={0.75} strokeOpacity={0.28}>
      {/* Iso rows */}
      <line x1="10" y1="35" x2="28" y2="44" />
      <line x1="16" y1="29" x2="36" y2="39" />
      <line x1="22" y1="22" x2="44" y2="32" />
      {/* Iso columns */}
      <line x1="6" y1="32" x2="28" y2="42" />
      <line x1="14" y1="27" x2="36" y2="37" />
      <line x1="22" y1="22" x2="28" y2="42" />
      <line x1="30" y1="22" x2="38" y2="40" />
    </g>

    {/* ── Bold normal arrow ── */}
    <line x1="25" y1="32" x2="25" y2="10" strokeWidth={1.5} />
    <polyline points="22,13 25,10 28,13" strokeWidth={1.5} fill="none" />
    {/* Right-angle indicator at base */}
    <polyline points="25,28 28.5,28 28.5,32" strokeWidth={1} fill="none" strokeOpacity={0.6} />

    {/* ── Sketch pencil cursor on the plane ── */}
    {/* Pencil body */}
    <rect
      x="33"
      y="14"
      width="4"
      height="12"
      rx="0.5"
      transform="rotate(35 35 20)"
      style={{ fill: 'var(--hi-leaf, currentColor)' }}
      fillOpacity={0.75}
      strokeWidth={1}
    />
    {/* Pencil tip */}
    <polygon
      points="38,28 40,34 34,30"
      transform="rotate(35 38 30)"
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.50)' }}
      strokeWidth={0.75}
    />
    {/* Pencil eraser top */}
    <line
      x1="33"
      y1="14"
      x2="37"
      y2="14"
      transform="rotate(35 35 14)"
      strokeWidth={1.5}
      strokeOpacity={0.5}
    />
  </>,
);

// ── ModelLineHifi — a 3D model line in isometric space with endpoints ──
export const ModelLineHifi = bimIconHifi(
  'ModelLineHifi',
  <>
    {/* ── 3D context: dashed projection lines ── */}
    {/* Projection to X-axis floor */}
    <line
      x1="10"
      y1="36"
      x2="40"
      y2="36"
      strokeWidth={0.75}
      strokeDasharray="3 2"
      strokeOpacity={0.3}
    />
    {/* Projection from start point down */}
    <line
      x1="10"
      y1="14"
      x2="10"
      y2="36"
      strokeWidth={0.75}
      strokeDasharray="3 2"
      strokeOpacity={0.3}
    />
    {/* Projection from end point down */}
    <line
      x1="40"
      y1="36"
      x2="38"
      y2="36"
      strokeWidth={0.75}
      strokeDasharray="3 2"
      strokeOpacity={0.3}
    />

    {/* ── Line body — thin filled rectangle (steel fill) ── */}
    <rect
      x="8"
      y="23"
      width="32"
      height="3"
      rx="1"
      transform="rotate(-22 24 24)"
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.35)' }}
      strokeWidth={0}
    />
    {/* Primary bold line */}
    <line x1="10" y1="34" x2="38" y2="14" strokeWidth={2} />

    {/* ── Endpoint spheres ── */}
    {/* Start point sphere */}
    <circle
      cx="10"
      cy="34"
      r="3"
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.50)' }}
      strokeWidth={1.5}
    />
    <circle cx="10" cy="34" r="1" fill="currentColor" stroke="none" fillOpacity={0.6} />
    {/* End point sphere */}
    <circle
      cx="38"
      cy="14"
      r="3"
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.50)' }}
      strokeWidth={1.5}
    />
    <circle cx="38" cy="14" r="1" fill="currentColor" stroke="none" fillOpacity={0.6} />

    {/* ── Isometric axis indicators at origin ── */}
    <g strokeWidth={0.75} strokeOpacity={0.35}>
      <line x1="10" y1="36" x2="4" y2="42" />
      <line x1="10" y1="36" x2="20" y2="42" />
      <line x1="10" y1="36" x2="10" y2="44" />
    </g>
  </>,
);

// ── ModelTextHifi — 3D isometric "ABC" text sitting on a work plane ──
export const ModelTextHifi = bimIconHifi(
  'ModelTextHifi',
  <>
    {/* ── Work plane below text — finish fill ── */}
    <polygon
      points="6,38 24,30 44,38 26,46"
      style={{ fill: 'var(--hi-finish, currentColor)', fillOpacity: 'var(--hi-finish-op, 0.18)' }}
      strokeWidth={1}
      strokeOpacity={0.5}
    />

    {/* ── Letter A — steel fill ── */}
    {/* A left stroke */}
    <line x1="10" y1="28" x2="14" y2="10" strokeWidth={2.5} strokeLinecap="round" />
    {/* A right stroke */}
    <line x1="18" y1="28" x2="14" y2="10" strokeWidth={2.5} strokeLinecap="round" />
    {/* A crossbar */}
    <line x1="11.5" y1="22" x2="16.5" y2="22" strokeWidth={1.5} />
    {/* A fill */}
    <path
      d="M 10,28 L 14,10 L 18,28 L 16.5,28 L 14,14 L 11.5,28 Z"
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.40)' }}
      stroke="none"
    />

    {/* ── Letter B — steel fill ── */}
    {/* B vertical stroke */}
    <line x1="22" y1="10" x2="22" y2="28" strokeWidth={2.5} strokeLinecap="round" />
    {/* B top bump */}
    <path d="M 22,10 Q 30,10 30,16 Q 30,19 22,19" strokeWidth={2} fill="none" />
    {/* B bottom bump */}
    <path d="M 22,19 Q 32,19 32,24 Q 32,28 22,28" strokeWidth={2} fill="none" />
    {/* B fill zones */}
    <path
      d="M 22,10 Q 30,10 30,16 Q 30,19 22,19 Z"
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.28)' }}
      stroke="none"
    />
    <path
      d="M 22,19 Q 32,19 32,24 Q 32,28 22,28 Z"
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.28)' }}
      stroke="none"
    />

    {/* ── Letter C — steel fill ── */}
    <path
      d="M 38,12 Q 34,10 36,10 Q 44,10 44,19 Q 44,28 36,28 Q 34,28 38,26"
      strokeWidth={2}
      fill="none"
    />
    <path
      d="M 38,12 Q 34,10 36,10 Q 44,10 44,19 Q 44,28 36,28 Q 34,28 38,26 Q 32,26 32,19 Q 32,12 38,12 Z"
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.28)' }}
      stroke="none"
    />
    <path d="M 38,12 Q 32,12 32,19 Q 32,26 38,26" strokeWidth={2} fill="none" />

    {/* ── Shadow on work plane below text ── */}
    <ellipse
      cx="24"
      cy="36"
      rx="14"
      ry="2.5"
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.12)' }}
      stroke="none"
    />
  </>,
);

// ── StairPathHifi — plan view of stair with walking path arrows and step numbers ──
export const StairPathHifi = bimIconHifi(
  'StairPathHifi',
  <>
    {/* ── Stair outline — concrete ── */}
    <rect
      x="4"
      y="6"
      width="40"
      height="36"
      style={{
        fill: 'var(--hi-concrete, currentColor)',
        fillOpacity: 'var(--hi-concrete-op, 0.08)',
      }}
      strokeWidth={2}
    />

    {/* ── Stair step lines (plan view horizontal treads) ── */}
    <g strokeWidth={1.5} strokeOpacity={0.6}>
      <line x1="4" y1="13" x2="44" y2="13" />
      <line x1="4" y1="20" x2="44" y2="20" />
      <line x1="4" y1="27" x2="44" y2="27" />
      <line x1="4" y1="34" x2="44" y2="34" />
    </g>

    {/* ── Walking path — curved diagonal dashed path ── */}
    <path
      d="M 12,40 Q 12,30 24,24 Q 36,18 36,8"
      strokeWidth={1.5}
      strokeDasharray="5 3"
      fill="none"
      strokeOpacity={0.85}
    />

    {/* ── Directional arrows along the walking path ── */}
    {/* Arrow 1 — near bottom */}
    <polyline points="10,34 12,31 14,34" strokeWidth={1.5} fill="none" />
    {/* Arrow 2 — mid path */}
    <polyline points="22,25 24,22 26,25" strokeWidth={1.5} fill="none" />
    {/* Arrow 3 — near top */}
    <polyline points="34,14 36,11 38,14" strokeWidth={1.5} fill="none" />

    {/* ── Step number badges ── */}
    {/* Badge 1 */}
    <circle
      cx="10"
      cy="38"
      r="4"
      style={{ fill: 'var(--hi-room, currentColor)', fillOpacity: 'var(--hi-room-op, 0.55)' }}
      strokeWidth={1}
    />
    <line x1="8" y1="38" x2="12" y2="38" strokeWidth={0.75} strokeOpacity={0.6} />
    {/* Badge 2 */}
    <circle
      cx="22"
      cy="30"
      r="4"
      style={{ fill: 'var(--hi-room, currentColor)', fillOpacity: 'var(--hi-room-op, 0.55)' }}
      strokeWidth={1}
    />
    <line x1="20" y1="30" x2="24" y2="30" strokeWidth={0.75} strokeOpacity={0.6} />
    {/* Badge 3 */}
    <circle
      cx="34"
      cy="17"
      r="4"
      style={{ fill: 'var(--hi-room, currentColor)', fillOpacity: 'var(--hi-room-op, 0.55)' }}
      strokeWidth={1}
    />
    <line x1="32" y1="17" x2="36" y2="17" strokeWidth={0.75} strokeOpacity={0.6} />

    {/* ── Up arrow at path start (bottom) ── */}
    <circle
      cx="12"
      cy="42"
      r="2.5"
      style={{ fill: 'var(--hi-roof, currentColor)', fillOpacity: 'var(--hi-roof-op, 0.45)' }}
      strokeWidth={1}
    />
    {/* UP text marker — small bar */}
    <line x1="10" y1="42" x2="14" y2="42" strokeWidth={0.75} />

    {/* ── Path termination X at top ── */}
    <g strokeWidth={1.5} strokeOpacity={0.7}>
      <line x1="33" y1="7" x2="39" y2="7" />
      <line x1="33" y1="7" x2="36" y2="7" />
      <line x1="36" y1="5" x2="36" y2="9" />
    </g>
  </>,
);
