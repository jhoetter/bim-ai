/**
 * High-fidelity 48×48 BIM structural extended icons with multi-material fills.
 *
 * CSS custom properties (set on a wrapper element):
 *   --hi-concrete / --hi-concrete-op  — structural concrete (warm stone gray)
 *   --hi-finish   / --hi-finish-op    — plaster, grout, fill (warm off-white)
 *   --hi-glass    / --hi-glass-op     — glazing (sky blue)
 *   --hi-steel    / --hi-steel-op     — steel, rebar, bolts, plates (blue-gray)
 *   --hi-leaf                         — timber/wood (amber, no opacity var)
 *   --hi-roof     / --hi-roof-op      — roof surface / load indicator (terracotta)
 *   --hi-room     / --hi-room-op      — interior void / air space (pale yellow)
 *
 * Without variables the icons render in monochrome currentColor.
 *
 * Stroke hierarchy:
 *   strokeWidth 2    — primary outlines
 *   strokeWidth 1.5  — secondary edges, reveals
 *   strokeWidth 0.75 — hatch, detail lines
 */
import { bimIconHifi } from './icon';

// ── BeamSystemHifi: grid of parallel I-beams with concrete slab on top ────────
export const BeamSystemHifi = bimIconHifi(
  'BeamSystemHifi',
  <>
    {/* Concrete deck slab on top */}
    <rect
      x="4"
      y="4"
      width="40"
      height="10"
      style={{
        fill: 'var(--hi-concrete, currentColor)',
        fillOpacity: 'var(--hi-concrete-op, 0.07)',
      }}
    />
    {/* Concrete slab hatch */}
    <g strokeWidth={0.75} strokeOpacity={0.3}>
      <line x1="4" y1="10" x2="10" y2="4" />
      <line x1="4" y1="14" x2="14" y2="4" />
      <line x1="8" y1="14" x2="20" y2="4" /> {/* shifted right */}
      <line x1="18" y1="14" x2="30" y2="4" />
      <line x1="28" y1="14" x2="40" y2="4" />
      <line x1="36" y1="14" x2="44" y2="6" />
    </g>
    {/* Slab outline */}
    <rect x="4" y="4" width="40" height="10" strokeWidth={2} fill="none" />

    {/* I-beam 1 — left (x=8) */}
    {/* Top flange */}
    <rect
      x="5"
      y="14"
      width="12"
      height="3"
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.15)' }}
      strokeWidth={1.5}
    />
    {/* Web */}
    <rect
      x="9.5"
      y="17"
      width="3"
      height="18"
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.12)' }}
      strokeWidth={1}
    />
    {/* Bottom flange */}
    <rect
      x="5"
      y="35"
      width="12"
      height="3"
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.15)' }}
      strokeWidth={1.5}
    />

    {/* I-beam 2 — center (x=24) */}
    <rect
      x="18"
      y="14"
      width="12"
      height="3"
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.15)' }}
      strokeWidth={1.5}
    />
    <rect
      x="22.5"
      y="17"
      width="3"
      height="18"
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.12)' }}
      strokeWidth={1}
    />
    <rect
      x="18"
      y="35"
      width="12"
      height="3"
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.15)' }}
      strokeWidth={1.5}
    />

    {/* I-beam 3 — right (x=38) */}
    <rect
      x="31"
      y="14"
      width="12"
      height="3"
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.15)' }}
      strokeWidth={1.5}
    />
    <rect
      x="35.5"
      y="17"
      width="3"
      height="18"
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.12)' }}
      strokeWidth={1}
    />
    <rect
      x="31"
      y="35"
      width="12"
      height="3"
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.15)' }}
      strokeWidth={1.5}
    />

    {/* Ground level line */}
    <line x1="4" y1="44" x2="44" y2="44" strokeWidth={1.5} strokeOpacity={0.4} />
  </>,
);

// ── FoundationSlabHifi: thick concrete slab with hatch, soil layer, column stub ─
export const FoundationSlabHifi = bimIconHifi(
  'FoundationSlabHifi',
  <>
    {/* Concrete slab body */}
    <rect
      x="4"
      y="16"
      width="40"
      height="16"
      style={{
        fill: 'var(--hi-concrete, currentColor)',
        fillOpacity: 'var(--hi-concrete-op, 0.07)',
      }}
    />
    {/* 45° hatch inside slab */}
    <g strokeWidth={0.75} strokeOpacity={0.3}>
      <line x1="4" y1="24" x2="12" y2="16" />
      <line x1="4" y1="32" x2="20" y2="16" />
      <line x1="10" y1="32" x2="26" y2="16" />
      <line x1="18" y1="32" x2="34" y2="16" />
      <line x1="26" y1="32" x2="42" y2="16" />
      <line x1="34" y1="32" x2="44" y2="22" />
    </g>
    {/* Slab outline */}
    <rect x="4" y="16" width="40" height="16" strokeWidth={2} fill="none" />

    {/* Soil/gravel layer below slab */}
    <rect
      x="4"
      y="32"
      width="40"
      height="10"
      style={{
        fill: 'var(--hi-finish, currentColor)',
        fillOpacity: 'var(--hi-finish-op, 0.07)',
      }}
    />
    {/* Soil dots pattern */}
    <g style={{ fill: 'var(--hi-finish, currentColor)' }} fillOpacity={0.4} stroke="none">
      <circle cx="10" cy="36" r="1" />
      <circle cx="18" cy="38" r="1" />
      <circle cx="26" cy="35" r="1" />
      <circle cx="34" cy="37" r="1" />
      <circle cx="42" cy="36" r="1" />
      <circle cx="14" cy="40" r="0.8" />
      <circle cx="22" cy="41" r="0.8" />
      <circle cx="30" cy="39" r="0.8" />
      <circle cx="38" cy="41" r="0.8" />
    </g>
    {/* Soil layer outline */}
    <line x1="4" y1="42" x2="44" y2="42" strokeWidth={1.5} strokeOpacity={0.5} />
    <line x1="4" y1="32" x2="4" y2="42" strokeWidth={1} strokeOpacity={0.4} />
    <line x1="44" y1="32" x2="44" y2="42" strokeWidth={1} strokeOpacity={0.4} />

    {/* Column stub on top of slab */}
    <rect
      x="18"
      y="4"
      width="12"
      height="12"
      style={{
        fill: 'var(--hi-concrete, currentColor)',
        fillOpacity: 'var(--hi-concrete-op, 0.15)',
      }}
    />
    <rect x="18" y="4" width="12" height="12" strokeWidth={2} fill="none" />
  </>,
);

// ── SlabEdgeHifi: floor slab cross-section with concrete fill, drip edge, rebar ─
export const SlabEdgeHifi = bimIconHifi(
  'SlabEdgeHifi',
  <>
    {/* Main concrete slab body */}
    <rect
      x="4"
      y="14"
      width="34"
      height="14"
      style={{
        fill: 'var(--hi-concrete, currentColor)',
        fillOpacity: 'var(--hi-concrete-op, 0.07)',
      }}
    />
    {/* Concrete hatch */}
    <g strokeWidth={0.75} strokeOpacity={0.3}>
      <line x1="4" y1="22" x2="12" y2="14" />
      <line x1="4" y1="28" x2="18" y2="14" />
      <line x1="8" y1="28" x2="24" y2="14" />
      <line x1="16" y1="28" x2="32" y2="14" />
      <line x1="24" y1="28" x2="38" y2="14" />
      <line x1="32" y1="28" x2="38" y2="22" />
    </g>

    {/* Drip edge profile at right end */}
    {/* Nose that steps down from bottom of slab */}
    <polygon
      points="38,14 44,14 44,20 40,20 40,28 38,28"
      style={{
        fill: 'var(--hi-concrete, currentColor)',
        fillOpacity: 'var(--hi-concrete-op, 0.12)',
      }}
      strokeWidth={1.5}
    />
    {/* Drip groove line */}
    <line x1="40" y1="22" x2="44" y2="22" strokeWidth={0.75} strokeOpacity={0.55} />

    {/* Slab primary outlines */}
    <line x1="4" y1="14" x2="44" y2="14" strokeWidth={2} />
    <line x1="4" y1="28" x2="40" y2="28" strokeWidth={2} />
    <line x1="4" y1="14" x2="4" y2="28" strokeWidth={2} />

    {/* Rebar dots inside slab (bottom zone) */}
    <g style={{ fill: 'var(--hi-steel, currentColor)' }} fillOpacity={0.8} stroke="none">
      <circle cx="10" cy="25" r="1.8" />
      <circle cx="18" cy="25" r="1.8" />
      <circle cx="26" cy="25" r="1.8" />
      <circle cx="34" cy="25" r="1.8" />
    </g>
    {/* Rebar rings */}
    <g
      fill="none"
      strokeWidth={0.75}
      strokeOpacity={0.5}
      style={{ stroke: 'var(--hi-steel, currentColor)' }}
    >
      <circle cx="10" cy="25" r="2.8" />
      <circle cx="18" cy="25" r="2.8" />
      <circle cx="26" cy="25" r="2.8" />
      <circle cx="34" cy="25" r="2.8" />
    </g>
  </>,
);

// ── AreaReinforcementHifi: concrete slab top view with diagonal rebar grid ─────
export const AreaReinforcementHifi = bimIconHifi(
  'AreaReinforcementHifi',
  <>
    {/* Concrete slab fill — top view */}
    <rect
      x="4"
      y="4"
      width="40"
      height="40"
      style={{
        fill: 'var(--hi-concrete, currentColor)',
        fillOpacity: 'var(--hi-concrete-op, 0.07)',
      }}
    />

    {/* Area boundary dashes */}
    <rect
      x="4"
      y="4"
      width="40"
      height="40"
      fill="none"
      strokeWidth={1.5}
      strokeDasharray="5 3"
      strokeOpacity={0.6}
    />

    {/* Steel rebar grid — diagonal lines (X direction ~45°) */}
    <g strokeWidth={1.5} strokeOpacity={0.75} style={{ stroke: 'var(--hi-steel, currentColor)' }}>
      <line x1="4" y1="20" x2="20" y2="4" />
      <line x1="4" y1="32" x2="32" y2="4" />
      <line x1="4" y1="44" x2="44" y2="4" />
      <line x1="16" y1="44" x2="44" y2="16" />
      <line x1="28" y1="44" x2="44" y2="28" />
      <line x1="40" y1="44" x2="44" y2="40" />
    </g>
    {/* Steel rebar grid — diagonal lines (Y direction ~135°) */}
    <g strokeWidth={1.5} strokeOpacity={0.75} style={{ stroke: 'var(--hi-steel, currentColor)' }}>
      <line x1="28" y1="4" x2="4" y2="28" />
      <line x1="40" y1="4" x2="4" y2="40" />
      <line x1="44" y1="8" x2="8" y2="44" />
      <line x1="44" y1="20" x2="20" y2="44" />
      <line x1="44" y1="32" x2="32" y2="44" />
    </g>
  </>,
);

// ── PathReinforcementHifi: curved slab strip with rebar path and section circles ─
export const PathReinforcementHifi = bimIconHifi(
  'PathReinforcementHifi',
  <>
    {/* Curved concrete strip */}
    <path
      d="M4,30 Q14,10 28,16 Q38,20 44,10"
      fill="none"
      strokeWidth={10}
      strokeOpacity={0.07}
      style={{ stroke: 'var(--hi-concrete, currentColor)' }}
      strokeLinecap="butt"
    />
    {/* Curved strip outline — top edge */}
    <path d="M4,25 Q14,5 28,11 Q38,15 44,5" fill="none" strokeWidth={1.5} strokeOpacity={0.55} />
    {/* Curved strip outline — bottom edge */}
    <path d="M4,35 Q14,15 28,21 Q38,25 44,15" fill="none" strokeWidth={1.5} strokeOpacity={0.55} />

    {/* Steel rebar path along centerline */}
    <path
      d="M4,30 Q14,10 28,16 Q38,20 44,10"
      fill="none"
      strokeWidth={2}
      style={{ stroke: 'var(--hi-steel, currentColor)' }}
      strokeOpacity={0.8}
    />

    {/* Arrowhead at path end */}
    <polygon
      points="44,10 40,8 41,12"
      style={{ fill: 'var(--hi-steel, currentColor)' }}
      fillOpacity={0.85}
      stroke="none"
    />

    {/* Cross-section circles at intervals along path */}
    <g style={{ fill: 'var(--hi-steel, currentColor)' }} fillOpacity={0.8} stroke="none">
      <circle cx="10" cy="27" r="2" />
      <circle cx="20" cy="17" r="2" />
      <circle cx="30" cy="16" r="2" />
      <circle cx="40" cy="13" r="2" />
    </g>
    <g
      fill="none"
      strokeWidth={0.75}
      strokeOpacity={0.5}
      style={{ stroke: 'var(--hi-steel, currentColor)' }}
    >
      <circle cx="10" cy="27" r="3.5" />
      <circle cx="20" cy="17" r="3.5" />
      <circle cx="30" cy="16" r="3.5" />
      <circle cx="40" cy="13" r="3.5" />
    </g>

    {/* Ground / slab base line */}
    <line
      x1="4"
      y1="42"
      x2="44"
      y2="42"
      strokeWidth={1}
      strokeOpacity={0.3}
      strokeDasharray="4 3"
    />
  </>,
);

// ── FabricSheetHifi: woven mesh grid with concrete fill zone and roll icon ──────
export const FabricSheetHifi = bimIconHifi(
  'FabricSheetHifi',
  <>
    {/* Concrete fill zone at bottom */}
    <rect
      x="4"
      y="30"
      width="40"
      height="14"
      style={{
        fill: 'var(--hi-concrete, currentColor)',
        fillOpacity: 'var(--hi-concrete-op, 0.07)',
      }}
    />
    {/* Concrete hatch */}
    <g strokeWidth={0.75} strokeOpacity={0.28}>
      <line x1="4" y1="38" x2="12" y2="30" />
      <line x1="4" y1="44" x2="18" y2="30" />
      <line x1="10" y1="44" x2="24" y2="30" />
      <line x1="18" y1="44" x2="30" y2="30" />
      <line x1="26" y1="44" x2="36" y2="30" />
      <line x1="34" y1="44" x2="44" y2="34" />
    </g>
    <rect x="4" y="30" width="40" height="14" strokeWidth={1.5} fill="none" strokeOpacity={0.5} />

    {/* Woven mesh X-lines */}
    <g strokeWidth={1.5} strokeOpacity={0.7} style={{ stroke: 'var(--hi-steel, currentColor)' }}>
      {/* Horizontal wires */}
      <line x1="14" y1="10" x2="44" y2="10" />
      <line x1="14" y1="17" x2="44" y2="17" />
      <line x1="14" y1="24" x2="44" y2="24" />
      <line x1="14" y1="30" x2="44" y2="30" />
      {/* Vertical wires */}
      <line x1="20" y1="6" x2="20" y2="30" />
      <line x1="28" y1="6" x2="28" y2="30" />
      <line x1="36" y1="6" x2="36" y2="30" />
      <line x1="44" y1="6" x2="44" y2="30" />
    </g>
    {/* Mesh nodes at intersections */}
    <g style={{ fill: 'var(--hi-steel, currentColor)' }} fillOpacity={0.6} stroke="none">
      <circle cx="20" cy="10" r="1.2" />
      <circle cx="28" cy="10" r="1.2" />
      <circle cx="36" cy="10" r="1.2" />
      <circle cx="44" cy="10" r="1.2" />
      <circle cx="20" cy="17" r="1.2" />
      <circle cx="28" cy="17" r="1.2" />
      <circle cx="36" cy="17" r="1.2" />
      <circle cx="44" cy="17" r="1.2" />
      <circle cx="20" cy="24" r="1.2" />
      <circle cx="28" cy="24" r="1.2" />
      <circle cx="36" cy="24" r="1.2" />
      <circle cx="44" cy="24" r="1.2" />
    </g>

    {/* Roll icon top-left — cylinder end view */}
    <ellipse
      cx="9"
      cy="18"
      rx="5"
      ry="12"
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.12)' }}
      strokeWidth={1.5}
    />
    <ellipse cx="9" cy="18" rx="2.5" ry="6" fill="none" strokeWidth={0.75} strokeOpacity={0.4} />
  </>,
);

// ── ShearStudHifi: concrete slab + steel deck flute + stud shapes ──────────────
export const ShearStudHifi = bimIconHifi(
  'ShearStudHifi',
  <>
    {/* Concrete slab above */}
    <rect
      x="4"
      y="4"
      width="40"
      height="18"
      style={{
        fill: 'var(--hi-concrete, currentColor)',
        fillOpacity: 'var(--hi-concrete-op, 0.07)',
      }}
    />
    {/* Concrete hatch */}
    <g strokeWidth={0.75} strokeOpacity={0.28}>
      <line x1="4" y1="12" x2="12" y2="4" />
      <line x1="4" y1="20" x2="20" y2="4" />
      <line x1="4" y1="22" x2="22" y2="4" />
      <line x1="12" y1="22" x2="30" y2="4" />
      <line x1="20" y1="22" x2="38" y2="4" />
      <line x1="28" y1="22" x2="44" y2="8" />
    </g>
    <rect x="4" y="4" width="40" height="18" strokeWidth={2} fill="none" />

    {/* Steel deck — trapezoidal flutes */}
    {/* Flute 1 */}
    <polygon
      points="4,22 10,22 14,32 4,32"
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.12)' }}
      strokeWidth={1.5}
    />
    {/* Flat between flutes 1-2 */}
    <rect
      x="14"
      y="22"
      width="8"
      height="3"
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.15)' }}
      strokeWidth={1}
    />
    {/* Flute 2 */}
    <polygon
      points="22,22 28,22 32,32 18,32"
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.12)' }}
      strokeWidth={1.5}
    />
    {/* Flat between flutes 2-3 */}
    <rect
      x="32"
      y="22"
      width="8"
      height="3"
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.15)' }}
      strokeWidth={1}
    />
    {/* Flute 3 */}
    <polygon
      points="40,22 44,22 44,32 36,32"
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.12)' }}
      strokeWidth={1.5}
    />
    {/* Deck bottom line */}
    <line x1="4" y1="32" x2="44" y2="32" strokeWidth={1.5} />

    {/* Shear studs — vertical bars protruding from deck into slab */}
    <g strokeWidth={2} style={{ stroke: 'var(--hi-steel, currentColor)' }} strokeOpacity={0.9}>
      <line x1="12" y1="22" x2="12" y2="12" />
      <line x1="24" y1="22" x2="24" y2="12" />
      <line x1="36" y1="22" x2="36" y2="12" />
    </g>
    {/* Stud heads (round top) */}
    <g style={{ fill: 'var(--hi-steel, currentColor)' }} fillOpacity={0.85} stroke="none">
      <circle cx="12" cy="11" r="2.5" />
      <circle cx="24" cy="11" r="2.5" />
      <circle cx="36" cy="11" r="2.5" />
    </g>
    {/* Deck bottom fill zone */}
    <rect
      x="4"
      y="32"
      width="40"
      height="4"
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.08)' }}
      strokeWidth={1}
    />
  </>,
);

// ── AnchorHifi: concrete block with L-anchor buried, bolt shaft + nut on top ───
export const AnchorHifi = bimIconHifi(
  'AnchorHifi',
  <>
    {/* Concrete block body */}
    <rect
      x="8"
      y="18"
      width="32"
      height="26"
      style={{
        fill: 'var(--hi-concrete, currentColor)',
        fillOpacity: 'var(--hi-concrete-op, 0.07)',
      }}
    />
    {/* Concrete hatch */}
    <g strokeWidth={0.75} strokeOpacity={0.28}>
      <line x1="8" y1="26" x2="16" y2="18" />
      <line x1="8" y1="34" x2="24" y2="18" />
      <line x1="8" y1="42" x2="32" y2="18" />
      <line x1="14" y1="44" x2="40" y2="18" />
      <line x1="22" y1="44" x2="40" y2="26" />
      <line x1="30" y1="44" x2="40" y2="34" />
    </g>
    <rect x="8" y="18" width="32" height="26" strokeWidth={2} fill="none" />

    {/* L-anchor hook buried in concrete */}
    {/* Vertical shaft inside concrete */}
    <rect
      x="21"
      y="22"
      width="6"
      height="16"
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.15)' }}
      strokeWidth={1.5}
    />
    {/* Horizontal hook at bottom */}
    <rect
      x="21"
      y="34"
      width="14"
      height="6"
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.20)' }}
      strokeWidth={1.5}
    />
    {/* L-anchor outline */}
    <polyline
      points="21,22 21,40 35,40 35,34"
      fill="none"
      strokeWidth={2}
      style={{ stroke: 'var(--hi-steel, currentColor)' }}
      strokeOpacity={0.85}
    />

    {/* Bolt shaft above concrete */}
    <rect x="22" y="4" width="4" height="16" fill="none" strokeWidth={1.5} strokeOpacity={0.7} />
    {/* Thread marks on bolt */}
    <g strokeWidth={0.75} strokeOpacity={0.5}>
      <line x1="22" y1="8" x2="26" y2="8" />
      <line x1="22" y1="11" x2="26" y2="11" />
      <line x1="22" y1="14" x2="26" y2="14" />
    </g>

    {/* Hex nut on top */}
    <polygon
      points="24,3 27,4.5 27,7.5 24,9 21,7.5 21,4.5"
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.20)' }}
      strokeWidth={1.5}
    />
    {/* Washer */}
    <ellipse
      cx="24"
      cy="18"
      rx="5"
      ry="1.5"
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.15)' }}
      strokeWidth={1}
    />
  </>,
);

// ── BoltHifi: hex bolt head + shaft + nut + two steel plates being joined ──────
export const BoltHifi = bimIconHifi(
  'BoltHifi',
  <>
    {/* Top steel plate */}
    <rect
      x="4"
      y="10"
      width="40"
      height="8"
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.12)' }}
      strokeWidth={2}
    />
    {/* Bottom steel plate */}
    <rect
      x="4"
      y="30"
      width="40"
      height="8"
      style={{ fill: 'var(--hi-finish, currentColor)', fillOpacity: 'var(--hi-finish-op, 0.12)' }}
      strokeWidth={2}
    />

    {/* Bolt shaft through both plates */}
    <rect x="20" y="4" width="8" height="40" fill="none" strokeWidth={1.5} strokeOpacity={0.6} />
    {/* Thread marks on exposed shaft ends */}
    <g strokeWidth={0.75} strokeOpacity={0.5}>
      <line x1="20" y1="6" x2="28" y2="6" />
      <line x1="20" y1="8" x2="28" y2="8" />
      <line x1="20" y1="40" x2="28" y2="40" />
      <line x1="20" y1="42" x2="28" y2="42" />
    </g>

    {/* Hex bolt head at top */}
    <polygon
      points="24,4 30,7 30,13 24,16 18,13 18,7"
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.25)' }}
      strokeWidth={2}
    />
    {/* Bolt head center mark */}
    <circle cx="24" cy="10" r="2" fill="none" strokeWidth={0.75} strokeOpacity={0.5} />

    {/* Hex nut at bottom */}
    <polygon
      points="24,32 30,35 30,41 24,44 18,41 18,35"
      style={{ fill: 'var(--hi-finish, currentColor)', fillOpacity: 'var(--hi-finish-op, 0.25)' }}
      strokeWidth={2}
    />
    {/* Nut center mark */}
    <circle cx="24" cy="38" r="2" fill="none" strokeWidth={0.75} strokeOpacity={0.5} />

    {/* Plate bolt holes */}
    <line
      x1="20"
      y1="18"
      x2="20"
      y2="30"
      strokeWidth={1}
      strokeOpacity={0.4}
      strokeDasharray="2 2"
    />
    <line
      x1="28"
      y1="18"
      x2="28"
      y2="30"
      strokeWidth={1}
      strokeOpacity={0.4}
      strokeDasharray="2 2"
    />
  </>,
);

// ── WeldHifi: two steel plates at corner joint with weld bead triangle ─────────
export const WeldHifi = bimIconHifi(
  'WeldHifi',
  <>
    {/* Horizontal steel plate */}
    <rect
      x="4"
      y="30"
      width="40"
      height="8"
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.12)' }}
      strokeWidth={2}
    />

    {/* Vertical steel plate (column/upright) */}
    <rect
      x="16"
      y="4"
      width="8"
      height="28"
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.12)' }}
      strokeWidth={2}
    />

    {/* Weld bead triangle fill at the corner joint */}
    <polygon
      points="16,30 24,30 24,38"
      style={{ fill: 'var(--hi-roof, currentColor)', fillOpacity: 'var(--hi-roof-op, 0.45)' }}
      stroke="none"
    />
    {/* Weld bead outline */}
    <polygon
      points="16,30 24,30 24,38"
      fill="none"
      strokeWidth={1.5}
      style={{ stroke: 'var(--hi-roof, currentColor)' }}
      strokeOpacity={0.8}
    />

    {/* Weld zigzag hatch symbols on the bead */}
    <g strokeWidth={0.75} strokeOpacity={0.6} style={{ stroke: 'var(--hi-roof, currentColor)' }}>
      <polyline points="17,31 19,33 21,31 23,33" fill="none" />
      <polyline points="19,33 21,35 23,33" fill="none" />
    </g>

    {/* Weld symbol arrow leader */}
    <line
      x1="30"
      y1="20"
      x2="22"
      y2="30"
      strokeWidth={1}
      strokeOpacity={0.5}
      strokeDasharray="3 2"
    />
    <line x1="30" y1="20" x2="34" y2="20" strokeWidth={1} strokeOpacity={0.5} />
    {/* Arrow tip */}
    <polygon points="22,30 25,27 24,31" fill="none" strokeWidth={0.75} strokeOpacity={0.5} />
  </>,
);

// ── AnalyticalNodeHifi: structural frame wireframe + bold node + DOF arrows ────
export const AnalyticalNodeHifi = bimIconHifi(
  'AnalyticalNodeHifi',
  <>
    {/* Structural frame lines — concrete colored wireframe */}
    <g strokeWidth={1.5} strokeOpacity={0.5} style={{ stroke: 'var(--hi-concrete, currentColor)' }}>
      {/* Left column leg */}
      <line x1="12" y1="44" x2="24" y2="24" />
      {/* Right column leg */}
      <line x1="36" y1="44" x2="24" y2="24" />
      {/* Top beam left */}
      <line x1="4" y1="24" x2="24" y2="24" />
      {/* Top beam right */}
      <line x1="24" y1="24" x2="44" y2="24" />
      {/* Diagonal brace left */}
      <line x1="4" y1="10" x2="24" y2="24" />
      {/* Diagonal brace right */}
      <line x1="44" y1="10" x2="24" y2="24" />
    </g>

    {/* Node circle — bold, steel colored, at joint */}
    <circle
      cx="24"
      cy="24"
      r="5"
      style={{
        fill: 'var(--hi-steel, currentColor)',
        fillOpacity: 'var(--hi-steel-op, 0.35)',
        stroke: 'var(--hi-steel, currentColor)',
      }}
      strokeWidth={2}
    />

    {/* DOF arrows radiating out from node (6 directions) */}
    <g strokeWidth={1.5} strokeOpacity={0.75} style={{ stroke: 'var(--hi-steel, currentColor)' }}>
      {/* Up */}
      <line x1="24" y1="18" x2="24" y2="10" />
      <polygon
        points="24,8 22,12 26,12"
        style={{ fill: 'var(--hi-steel, currentColor)' }}
        fillOpacity={0.75}
        stroke="none"
      />
      {/* Down */}
      <line x1="24" y1="30" x2="24" y2="38" />
      <polygon
        points="24,40 22,36 26,36"
        style={{ fill: 'var(--hi-steel, currentColor)' }}
        fillOpacity={0.75}
        stroke="none"
      />
      {/* Left */}
      <line x1="18" y1="24" x2="10" y2="24" />
      <polygon
        points="8,24 12,22 12,26"
        style={{ fill: 'var(--hi-steel, currentColor)' }}
        fillOpacity={0.75}
        stroke="none"
      />
      {/* Right */}
      <line x1="30" y1="24" x2="38" y2="24" />
      <polygon
        points="40,24 36,22 36,26"
        style={{ fill: 'var(--hi-steel, currentColor)' }}
        fillOpacity={0.75}
        stroke="none"
      />
    </g>
  </>,
);

// ── StructuralLoadHifi: concrete beam/column + load arrows + distributed load ──
export const StructuralLoadHifi = bimIconHifi(
  'StructuralLoadHifi',
  <>
    {/* Concrete beam / column body */}
    <rect
      x="14"
      y="26"
      width="20"
      height="18"
      style={{
        fill: 'var(--hi-concrete, currentColor)',
        fillOpacity: 'var(--hi-concrete-op, 0.07)',
      }}
      strokeWidth={2}
    />
    {/* Concrete hatch */}
    <g strokeWidth={0.75} strokeOpacity={0.28}>
      <line x1="14" y1="34" x2="22" y2="26" />
      <line x1="14" y1="42" x2="30" y2="26" />
      <line x1="20" y1="44" x2="34" y2="30" />
      <line x1="28" y1="44" x2="34" y2="38" />
    </g>

    {/* Distributed load line above */}
    <line
      x1="6"
      y1="6"
      x2="42"
      y2="6"
      strokeWidth={2}
      style={{ stroke: 'var(--hi-roof, currentColor)' }}
      strokeOpacity={0.8}
    />

    {/* Multiple downward load arrows */}
    <g strokeWidth={1.5} style={{ stroke: 'var(--hi-roof, currentColor)' }} strokeOpacity={0.8}>
      <line x1="10" y1="6" x2="10" y2="20" />
      <line x1="18" y1="6" x2="18" y2="22" />
      <line x1="24" y1="6" x2="24" y2="24" />
      <line x1="30" y1="6" x2="30" y2="22" />
      <line x1="38" y1="6" x2="38" y2="20" />
    </g>
    {/* Arrow heads (downward triangles) */}
    <g style={{ fill: 'var(--hi-roof, currentColor)' }} fillOpacity={0.85} stroke="none">
      <polygon points="10,22 8,18 12,18" />
      <polygon points="18,24 16,20 20,20" />
      <polygon points="24,26 22,22 26,22" />
      <polygon points="30,24 28,20 32,20" />
      <polygon points="38,22 36,18 40,18" />
    </g>
  </>,
);

// ── BoundaryConditionHifi: column base + pin support + ground hatch + rollers ──
export const BoundaryConditionHifi = bimIconHifi(
  'BoundaryConditionHifi',
  <>
    {/* Column base — concrete */}
    <rect
      x="16"
      y="4"
      width="16"
      height="20"
      style={{
        fill: 'var(--hi-concrete, currentColor)',
        fillOpacity: 'var(--hi-concrete-op, 0.07)',
      }}
      strokeWidth={2}
    />
    {/* Column hatch */}
    <g strokeWidth={0.75} strokeOpacity={0.28}>
      <line x1="16" y1="12" x2="24" y2="4" />
      <line x1="16" y1="20" x2="32" y2="4" />
      <line x1="20" y1="24" x2="32" y2="12" />
      <line x1="28" y1="24" x2="32" y2="20" />
    </g>

    {/* Pin support triangle at bottom of column */}
    <polygon
      points="24,24 14,36 34,36"
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.20)' }}
      strokeWidth={2}
    />
    {/* Pin circle at apex of triangle */}
    <circle
      cx="24"
      cy="24"
      r="2.5"
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.60)' }}
      strokeWidth={1}
    />

    {/* Ground line */}
    <line x1="8" y1="36" x2="40" y2="36" strokeWidth={2} strokeOpacity={0.7} />

    {/* Ground hatch below */}
    <rect
      x="8"
      y="36"
      width="32"
      height="8"
      style={{
        fill: 'var(--hi-finish, currentColor)',
        fillOpacity: 'var(--hi-finish-op, 0.07)',
      }}
    />
    <g strokeWidth={0.75} strokeOpacity={0.35}>
      <line x1="8" y1="40" x2="12" y2="36" />
      <line x1="14" y1="44" x2="22" y2="36" />
      <line x1="22" y1="44" x2="30" y2="36" />
      <line x1="30" y1="44" x2="38" y2="36" />
      <line x1="36" y1="44" x2="40" y2="40" />
    </g>

    {/* Roller wheels at base of support triangle */}
    <g
      style={{ fill: 'var(--hi-finish, currentColor)', fillOpacity: 'var(--hi-finish-op, 0.25)' }}
      strokeWidth={1.5}
    >
      <circle cx="16" cy="38" r="2.5" />
      <circle cx="24" cy="38" r="2.5" />
      <circle cx="32" cy="38" r="2.5" />
    </g>
    {/* Roller centers */}
    <g style={{ fill: 'var(--hi-steel, currentColor)' }} fillOpacity={0.5} stroke="none">
      <circle cx="16" cy="38" r="1" />
      <circle cx="24" cy="38" r="1" />
      <circle cx="32" cy="38" r="1" />
    </g>
  </>,
);
