/**
 * High-fidelity 48×48 BIM icons — architectural extended set A.
 *
 * CSS custom properties (set on a wrapper element):
 *   --hi-concrete / --hi-concrete-op  — structural concrete (stone gray)
 *   --hi-finish   / --hi-finish-op    — plaster, paper, gypsum (warm white)
 *   --hi-glass    / --hi-glass-op     — glazing (sky blue)
 *   --hi-steel    / --hi-steel-op     — steel, metal, frames (blue-gray)
 *   --hi-leaf                         — timber/wood (amber, no opacity var)
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

// ── WallSweepHifi — wall cross-section + decorative L/S molding profile on face ─
export const WallSweepHifi = bimIconHifi(
  'WallSweepHifi',
  <>
    {/* Concrete wall body fill */}
    <rect
      x="4"
      y="10"
      width="26"
      height="28"
      style={{
        fill: 'var(--hi-concrete, currentColor)',
        fillOpacity: 'var(--hi-concrete-op, 0.09)',
      }}
    />
    {/* Concrete hatch */}
    <g strokeWidth={0.75} strokeOpacity={0.35}>
      <line x1="4" y1="18" x2="12" y2="10" />
      <line x1="4" y1="26" x2="20" y2="10" />
      <line x1="4" y1="34" x2="28" y2="10" />
      <line x1="10" y1="38" x2="30" y2="18" />
      <line x1="18" y1="38" x2="30" y2="26" />
      <line x1="26" y1="38" x2="30" y2="34" />
    </g>
    {/* Wall primary outline */}
    <rect x="4" y="10" width="26" height="28" strokeWidth={2} fill="none" />

    {/* Sweep profile on the right face — wood molding in --hi-leaf */}
    {/* L-shaped extrusion steps: horizontal shelf + vertical return */}
    <polygon
      points="30,18 38,18 38,23 34,23 34,28 30,28"
      style={{ fill: 'var(--hi-leaf, currentColor)' }}
      fillOpacity={0.45}
      strokeWidth={1.5}
    />
    {/* Profile detail lines (inner step) */}
    <line x1="34" y1="18" x2="34" y2="23" strokeWidth={0.75} strokeOpacity={0.6} />
    <line x1="30" y1="23" x2="34" y2="23" strokeWidth={0.75} strokeOpacity={0.6} />

    {/* Finish layer on wall face (thin plaster coat) */}
    <rect
      x="29"
      y="10"
      width="1.5"
      height="28"
      style={{ fill: 'var(--hi-finish, currentColor)', fillOpacity: 'var(--hi-finish-op, 0.18)' }}
      strokeWidth={0.75}
    />

    {/* Extrusion direction arrow (pointing along wall, downward) */}
    <line x1="42" y1="14" x2="42" y2="34" strokeWidth={1.5} strokeDasharray="3 2" />
    <polyline points="39,31 42,34 45,31" strokeWidth={1.5} fill="none" />
  </>,
);

// ── WallRevealHifi — wall cross-section (hatched) + indented groove on face ──────
export const WallRevealHifi = bimIconHifi(
  'WallRevealHifi',
  <>
    {/* Concrete wall body fill */}
    <rect
      x="4"
      y="10"
      width="40"
      height="28"
      style={{
        fill: 'var(--hi-concrete, currentColor)',
        fillOpacity: 'var(--hi-concrete-op, 0.09)',
      }}
    />
    {/* Hatch lines (angled at 45°) */}
    <g strokeWidth={0.75} strokeOpacity={0.35}>
      <line x1="4" y1="18" x2="12" y2="10" />
      <line x1="4" y1="26" x2="20" y2="10" />
      <line x1="4" y1="34" x2="28" y2="10" />
      <line x1="8" y1="38" x2="36" y2="10" />
      <line x1="16" y1="38" x2="44" y2="10" />
      <line x1="24" y1="38" x2="44" y2="18" />
      <line x1="32" y1="38" x2="44" y2="26" />
      <line x1="40" y1="38" x2="44" y2="34" />
    </g>
    {/* Wall primary outline */}
    <rect x="4" y="10" width="40" height="28" strokeWidth={2} fill="none" />

    {/* Reveal groove (recessed into the face at the right side) */}
    {/* Shadow/void fill */}
    <rect
      x="38"
      y="10"
      width="6"
      height="28"
      style={{ fill: 'var(--hi-room, currentColor)', fillOpacity: 'var(--hi-room-op, 0.30)' }}
      strokeWidth={0}
    />
    {/* Groove side walls (secondary edges) */}
    <line x1="38" y1="10" x2="38" y2="38" strokeWidth={1.5} />
    {/* Groove depth line (bottom of recess) */}
    <line x1="44" y1="10" x2="44" y2="38" strokeWidth={1.5} />

    {/* Groove shadow accent line */}
    <line x1="39" y1="10" x2="39" y2="38" strokeWidth={0.75} strokeOpacity={0.45} />

    {/* Smooth outer face line (left face of wall) */}
    <line x1="4" y1="10" x2="4" y2="38" strokeWidth={2} />

    {/* Reveal callout dashes */}
    <line
      x1="38"
      y1="24"
      x2="30"
      y2="24"
      strokeWidth={0.75}
      strokeDasharray="2 2"
      strokeOpacity={0.6}
    />
    <polyline points="34,21 30,24 34,27" strokeWidth={0.75} fill="none" strokeOpacity={0.6} />
  </>,
);

// ── ComponentHifi — parametric BIM component: desk chair plan + bounding box ─────
export const ComponentHifi = bimIconHifi(
  'ComponentHifi',
  <>
    {/* Bounding box (dashed) */}
    <rect
      x="6"
      y="6"
      width="36"
      height="36"
      strokeWidth={0.75}
      strokeDasharray="4 3"
      strokeOpacity={0.55}
      fill="none"
    />

    {/* Corner grip handles — small filled squares at bounding-box corners */}
    {[
      [4, 4],
      [40, 4],
      [4, 40],
      [40, 40],
    ].map(([cx, cy], i) => (
      <rect
        key={i}
        x={cx}
        y={cy}
        width="4"
        height="4"
        style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.70)' }}
        stroke="none"
      />
    ))}

    {/* Chair seat — wood fill */}
    <rect
      x="14"
      y="16"
      width="20"
      height="18"
      rx="2"
      style={{ fill: 'var(--hi-leaf, currentColor)' }}
      fillOpacity={0.45}
      strokeWidth={1.5}
    />

    {/* Chair back rest */}
    <rect
      x="14"
      y="11"
      width="20"
      height="6"
      rx="1.5"
      style={{ fill: 'var(--hi-leaf, currentColor)' }}
      fillOpacity={0.3}
      strokeWidth={1.5}
    />

    {/* Metal legs — 4 small circles at seat corners */}
    {[
      [17, 32],
      [31, 32],
      [17, 21],
      [31, 21],
    ].map(([cx, cy], i) => (
      <circle
        key={i}
        cx={cx}
        cy={cy}
        r="2"
        style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.55)' }}
        strokeWidth={1}
      />
    ))}

    {/* Central hub */}
    <circle
      cx="24"
      cy="28"
      r="3"
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.40)' }}
      strokeWidth={1}
    />
  </>,
);

// ── RoofExtrusionHifi — pitched profile + extrusion arrow ─────────────────────────
export const RoofExtrusionHifi = bimIconHifi(
  'RoofExtrusionHifi',
  <>
    {/* Extruded volume hint (lighter fill, offset) */}
    <polygon
      points="10,14 26,6 38,14 38,22 26,14 10,22"
      style={{ fill: 'var(--hi-roof, currentColor)', fillOpacity: 'var(--hi-roof-op, 0.10)' }}
      strokeWidth={0.75}
      strokeDasharray="3 2"
      strokeOpacity={0.45}
    />

    {/* Main profile cross-section fill — terracotta */}
    <polygon
      points="8,42 24,26 40,42"
      style={{ fill: 'var(--hi-roof, currentColor)', fillOpacity: 'var(--hi-roof-op, 0.35)' }}
    />

    {/* Profile outline (primary) */}
    <polyline points="8,42 24,26 40,42" strokeWidth={2} fill="none" />
    {/* Base of profile */}
    <line x1="8" y1="42" x2="40" y2="42" strokeWidth={2} />

    {/* Ridge tick */}
    <line x1="24" y1="22" x2="24" y2="26" strokeWidth={1.5} />

    {/* Extrusion arrow pointing out of profile plane (upper right) */}
    <line x1="34" y1="36" x2="44" y2="20" strokeWidth={1.5} />
    <polyline points="39,20 44,20 44,25" strokeWidth={1.5} fill="none" />

    {/* Ridge detail dotted line */}
    <line
      x1="24"
      y1="26"
      x2="24"
      y2="42"
      strokeWidth={0.75}
      strokeDasharray="2 2"
      strokeOpacity={0.4}
    />
  </>,
);

// ── RoofSoffitHifi — overhang cross-section: roof above, soffit board below ──────
export const RoofSoffitHifi = bimIconHifi(
  'RoofSoffitHifi',
  <>
    {/* Roof deck fill (terracotta) */}
    <polygon
      points="4,14 44,4 44,18 4,28"
      style={{ fill: 'var(--hi-roof, currentColor)', fillOpacity: 'var(--hi-roof-op, 0.30)' }}
    />
    {/* Roof deck outline */}
    <polyline points="4,14 44,4 44,18 4,28" strokeWidth={2} fill="none" />
    <line x1="4" y1="14" x2="4" y2="28" strokeWidth={1.5} />

    {/* Eave space (void gap between deck and soffit) */}

    {/* Soffit board — wood fill */}
    <rect
      x="4"
      y="30"
      width="36"
      height="5"
      style={{ fill: 'var(--hi-leaf, currentColor)' }}
      fillOpacity={0.45}
      strokeWidth={1.5}
    />

    {/* Fascia board at right edge (vertical) */}
    <rect
      x="40"
      y="18"
      width="4"
      height="17"
      style={{ fill: 'var(--hi-leaf, currentColor)' }}
      fillOpacity={0.35}
      strokeWidth={1.5}
    />

    {/* "Looking up" direction indicator — small arc */}
    <path d="M 10,38 A 6,4 0 0,1 22,38" strokeWidth={0.75} strokeOpacity={0.5} fill="none" />
    <polyline points="9,35 10,38 13,37" strokeWidth={0.75} fill="none" strokeOpacity={0.5} />

    {/* Interior zone below soffit */}
    <rect
      x="4"
      y="35"
      width="36"
      height="9"
      style={{ fill: 'var(--hi-room, currentColor)', fillOpacity: 'var(--hi-room-op, 0.12)' }}
      strokeWidth={0.75}
      strokeOpacity={0.35}
    />
  </>,
);

// ── FasciaHifi — eave detail cross-section: roof, fascia board, gutter ───────────
export const FasciaHifi = bimIconHifi(
  'FasciaHifi',
  <>
    {/* Roof deck / rafter fill */}
    <polygon
      points="4,10 44,4 44,16 4,22"
      style={{ fill: 'var(--hi-roof, currentColor)', fillOpacity: 'var(--hi-roof-op, 0.28)' }}
    />
    <polyline points="4,10 44,4 44,16 4,22" strokeWidth={1.5} fill="none" />
    <line x1="4" y1="10" x2="4" y2="22" strokeWidth={1.5} />

    {/* Fascia board (prominent flat vertical board) — wood */}
    <rect
      x="38"
      y="16"
      width="6"
      height="22"
      style={{ fill: 'var(--hi-leaf, currentColor)' }}
      fillOpacity={0.55}
      strokeWidth={2}
    />

    {/* Fascia wood grain detail lines */}
    <g strokeWidth={0.75} strokeOpacity={0.35}>
      <line x1="39" y1="18" x2="43" y2="18" />
      <line x1="39" y1="22" x2="43" y2="22" />
      <line x1="39" y1="26" x2="43" y2="26" />
      <line x1="39" y1="30" x2="43" y2="30" />
      <line x1="39" y1="34" x2="43" y2="34" />
    </g>

    {/* Soffit underside (thin board running back to wall) */}
    <rect
      x="4"
      y="22"
      width="34"
      height="4"
      style={{ fill: 'var(--hi-finish, currentColor)', fillOpacity: 'var(--hi-finish-op, 0.14)' }}
      strokeWidth={1}
    />

    {/* Gutter below fascia (steel/metal box section) */}
    <rect
      x="34"
      y="38"
      width="10"
      height="6"
      rx="0.5"
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.20)' }}
      strokeWidth={1.5}
    />
    {/* Gutter hanger */}
    <line x1="39" y1="38" x2="41" y2="35" strokeWidth={0.75} strokeOpacity={0.55} />

    {/* Callout label arrow to fascia */}
    <line
      x1="20"
      y1="28"
      x2="37"
      y2="28"
      strokeWidth={0.75}
      strokeDasharray="2 2"
      strokeOpacity={0.5}
    />
    <polyline points="34,25 37,28 34,31" strokeWidth={0.75} fill="none" strokeOpacity={0.5} />
  </>,
);

// ── GutterHifi — gutter cross-section: half-round bowl + fascia + water fill ─────
export const GutterHifi = bimIconHifi(
  'GutterHifi',
  <>
    {/* Fascia board at top (wood) */}
    <rect
      x="4"
      y="8"
      width="40"
      height="6"
      style={{ fill: 'var(--hi-leaf, currentColor)' }}
      fillOpacity={0.4}
      strokeWidth={1.5}
    />
    {/* Fascia grain */}
    <g strokeWidth={0.75} strokeOpacity={0.3}>
      <line x1="4" y1="10" x2="44" y2="10" />
      <line x1="4" y1="12" x2="44" y2="12" />
    </g>

    {/* Gutter body (half-round cross-section) — steel/metal */}
    <path
      d="M 8,14 L 8,30 A 16,16 0 0,0 40,30 L 40,14 Z"
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.18)' }}
      strokeWidth={2}
    />

    {/* Water fill inside gutter bowl (sky blue) */}
    <path
      d="M 8,28 A 16,10 0 0,0 40,28"
      style={{ fill: 'var(--hi-glass, currentColor)', fillOpacity: 'var(--hi-glass-op, 0.35)' }}
      strokeWidth={0}
    />
    {/* Water surface line */}
    <path
      d="M 9,28 Q 24,24 39,28"
      strokeWidth={1}
      strokeOpacity={0.6}
      fill="none"
      style={{ stroke: 'var(--hi-glass, currentColor)' }}
    />

    {/* Downspout outlet at right end */}
    <rect
      x="34"
      y="28"
      width="6"
      height="12"
      rx="1"
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.22)' }}
      strokeWidth={1.5}
    />
    {/* Flow dots in downspout */}
    <g strokeWidth={0} style={{ fill: 'var(--hi-glass, currentColor)' }} fillOpacity={0.6}>
      <circle cx="37" cy="32" r="1" />
      <circle cx="37" cy="36" r="1" />
    </g>

    {/* Gutter hanger straps */}
    <g strokeWidth={0.75} strokeOpacity={0.45}>
      <line x1="14" y1="14" x2="14" y2="8" />
      <line x1="24" y1="14" x2="24" y2="8" />
    </g>
  </>,
);

// ── CurtainSystemHifi — plan view: curved curtain wall run + glass + mullions ─────
export const CurtainSystemHifi = bimIconHifi(
  'CurtainSystemHifi',
  <>
    {/* Interior zone fill (room, beyond the glazing) */}
    <path
      d="M 4,10 Q 24,4 44,10 L 44,20 Q 24,14 4,20 Z"
      style={{ fill: 'var(--hi-room, currentColor)', fillOpacity: 'var(--hi-room-op, 0.18)' }}
      strokeWidth={0}
    />

    {/* Glass pane panels fill — sky blue */}
    {/* Bay 1 */}
    <path
      d="M 4,20 Q 11,17 18,20 L 18,26 Q 11,23 4,26 Z"
      style={{ fill: 'var(--hi-glass, currentColor)', fillOpacity: 'var(--hi-glass-op, 0.28)' }}
      strokeWidth={0.75}
    />
    {/* Bay 2 */}
    <path
      d="M 18,20 Q 24,18 30,20 L 30,26 Q 24,24 18,26 Z"
      style={{ fill: 'var(--hi-glass, currentColor)', fillOpacity: 'var(--hi-glass-op, 0.22)' }}
      strokeWidth={0.75}
    />
    {/* Bay 3 */}
    <path
      d="M 30,20 Q 37,18 44,20 L 44,26 Q 37,24 30,26 Z"
      style={{ fill: 'var(--hi-glass, currentColor)', fillOpacity: 'var(--hi-glass-op, 0.28)' }}
      strokeWidth={0.75}
    />

    {/* Outer face curve (primary — bold) */}
    <path d="M 4,20 Q 24,14 44,20" strokeWidth={2} fill="none" />
    {/* Inner face curve (secondary) */}
    <path d="M 4,26 Q 24,20 44,26" strokeWidth={1.5} fill="none" />

    {/* Mullion verticals (steel) at each bay joint */}
    {/* Left end mullion */}
    <rect
      x="3"
      y="19"
      width="2"
      height="8"
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.60)' }}
      strokeWidth={0}
    />
    {/* Center mullion 1 (at x≈18) */}
    <rect
      x="17"
      y="19"
      width="2"
      height="7"
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.60)' }}
      strokeWidth={0}
    />
    {/* Center mullion 2 (at x≈30) */}
    <rect
      x="29"
      y="19"
      width="2"
      height="7"
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.60)' }}
      strokeWidth={0}
    />
    {/* Right end mullion */}
    <rect
      x="43"
      y="19"
      width="2"
      height="8"
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.60)' }}
      strokeWidth={0}
    />

    {/* Mullion outlines */}
    <line x1="4" y1="20" x2="4" y2="26" strokeWidth={1.5} />
    <line x1="18" y1="20" x2="18" y2="26" strokeWidth={1.5} />
    <line x1="30" y1="20" x2="30" y2="26" strokeWidth={1.5} />
    <line x1="44" y1="20" x2="44" y2="26" strokeWidth={1.5} />

    {/* Plan reflection lines to interior */}
    <g strokeWidth={0.75} strokeDasharray="3 2" strokeOpacity={0.35}>
      <line x1="4" y1="26" x2="4" y2="36" />
      <line x1="44" y1="26" x2="44" y2="36" />
      <path d="M 4,36 Q 24,30 44,36" fill="none" />
    </g>

    {/* Interior room zone lower boundary */}
    <path
      d="M 4,36 Q 24,30 44,36"
      style={{ fill: 'var(--hi-room, currentColor)', fillOpacity: 'var(--hi-room-op, 0.10)' }}
      strokeWidth={0.75}
      strokeOpacity={0.35}
    />
  </>,
);

// ── CurtainGridHifi — mullion grid: elevation view, glass panels + grid nodes ─────
export const CurtainGridHifi = bimIconHifi(
  'CurtainGridHifi',
  <>
    {/* Glass panel fills — 2 columns × 3 rows = 6 panels */}
    {/* Row 1 */}
    <rect
      x="5"
      y="5"
      width="17"
      height="12"
      style={{ fill: 'var(--hi-glass, currentColor)', fillOpacity: 'var(--hi-glass-op, 0.22)' }}
      strokeWidth={0}
    />
    <rect
      x="26"
      y="5"
      width="17"
      height="12"
      style={{ fill: 'var(--hi-glass, currentColor)', fillOpacity: 'var(--hi-glass-op, 0.22)' }}
      strokeWidth={0}
    />
    {/* Row 2 */}
    <rect
      x="5"
      y="21"
      width="17"
      height="12"
      style={{ fill: 'var(--hi-glass, currentColor)', fillOpacity: 'var(--hi-glass-op, 0.18)' }}
      strokeWidth={0}
    />
    <rect
      x="26"
      y="21"
      width="17"
      height="12"
      style={{ fill: 'var(--hi-glass, currentColor)', fillOpacity: 'var(--hi-glass-op, 0.18)' }}
      strokeWidth={0}
    />
    {/* Row 3 */}
    <rect
      x="5"
      y="37"
      width="17"
      height="6"
      style={{ fill: 'var(--hi-glass, currentColor)', fillOpacity: 'var(--hi-glass-op, 0.22)' }}
      strokeWidth={0}
    />
    <rect
      x="26"
      y="37"
      width="17"
      height="6"
      style={{ fill: 'var(--hi-glass, currentColor)', fillOpacity: 'var(--hi-glass-op, 0.22)' }}
      strokeWidth={0}
    />

    {/* Outer boundary frame (primary, bold) */}
    <rect x="4" y="4" width="40" height="40" strokeWidth={2} fill="none" />

    {/* Horizontal mullion lines */}
    <line x1="4" y1="17" x2="44" y2="17" strokeWidth={1.5} />
    <line x1="4" y1="33" x2="44" y2="33" strokeWidth={1.5} />

    {/* Vertical mullion line */}
    <line x1="23" y1="4" x2="23" y2="44" strokeWidth={1.5} />

    {/* Grid node circles at all mullion intersections — steel filled */}
    {[
      [4, 4],
      [23, 4],
      [44, 4],
      [4, 17],
      [23, 17],
      [44, 17],
      [4, 33],
      [23, 33],
      [44, 33],
      [4, 44],
      [23, 44],
      [44, 44],
    ].map(([cx, cy], i) => (
      <circle
        key={i}
        cx={cx}
        cy={cy}
        r="2.5"
        style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.75)' }}
        stroke="none"
      />
    ))}

    {/* Panel highlight diagonal (reflection) in top-left panel */}
    <line
      x1="7"
      y1="7"
      x2="14"
      y2="14"
      strokeWidth={0.75}
      strokeOpacity={0.3}
      style={{ stroke: 'var(--hi-glass, currentColor)' }}
    />
    <line
      x1="28"
      y1="23"
      x2="35"
      y2="30"
      strokeWidth={0.75}
      strokeOpacity={0.3}
      style={{ stroke: 'var(--hi-glass, currentColor)' }}
    />
  </>,
);
