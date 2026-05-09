/**
 * High-fidelity 48×48 BIM geometry/edit-operation icons with multi-material fills.
 *
 * CSS custom properties (set on a wrapper element):
 *   --hi-concrete / --hi-concrete-op  — structural concrete (stone gray)
 *   --hi-finish   / --hi-finish-op    — plaster/paper (warm white)
 *   --hi-glass    / --hi-glass-op     — glazing (sky blue)
 *   --hi-steel    / --hi-steel-op     — steel/metal (blue-gray)
 *   --hi-leaf                         — timber (amber, no op var)
 *   --hi-room     / --hi-room-op      — interior zone (pale yellow)
 *   --hi-roof     / --hi-roof-op      — roof/alert (terracotta)
 *
 * Without variables the icons render in monochrome currentColor.
 *
 * Stroke hierarchy:
 *   strokeWidth 2    — primary outlines
 *   strokeWidth 1.5  — secondary edges, reveals
 *   strokeWidth 0.75 — hatch, detail lines
 */
import { bimIconHifi } from './icon';

// ── MirrorHifi: plan view — wall + vertical mirror axis + ghost copy ───────────
export const MirrorHifi = bimIconHifi(
  'MirrorHifi',
  <>
    {/* Left wall fill — concrete */}
    <rect
      x="6"
      y="10"
      width="14"
      height="28"
      style={{
        fill: 'var(--hi-concrete, currentColor)',
        fillOpacity: 'var(--hi-concrete-op, 0.12)',
      }}
    />
    {/* Left wall hatch — diagonal */}
    <g strokeWidth={0.75} strokeOpacity={0.35}>
      <line x1="6" y1="18" x2="14" y2="10" />
      <line x1="6" y1="26" x2="20" y2="12" />
      <line x1="6" y1="34" x2="20" y2="20" />
      <line x1="6" y1="38" x2="20" y2="24" />
      <line x1="10" y1="38" x2="20" y2="28" />
      <line x1="14" y1="38" x2="20" y2="32" />
      <line x1="18" y1="38" x2="20" y2="36" />
    </g>
    {/* Left wall outline — primary */}
    <rect x="6" y="10" width="14" height="28" strokeWidth={2} fill="none" />

    {/* Mirror axis — bold dashed vertical at center (x=24) */}
    <line
      x1="24"
      y1="4"
      x2="24"
      y2="44"
      strokeWidth={1.5}
      strokeDasharray="5 3"
      strokeOpacity={0.85}
    />

    {/* Right ghost wall — steel at low opacity (mirrored result) */}
    <rect
      x="28"
      y="10"
      width="14"
      height="28"
      style={{
        fill: 'var(--hi-steel, currentColor)',
        fillOpacity: 'var(--hi-steel-op, 0.08)',
      }}
      strokeWidth={1.5}
      strokeOpacity={0.4}
      strokeDasharray="4 2"
    />

    {/* Double arrow perpendicular to axis (mirror-plane indicator) */}
    {/* Left arrow head pointing left */}
    <polyline points="18,24 14,24" strokeWidth={1.5} strokeOpacity={0.7} />
    <polyline points="17,21.5 14,24 17,26.5" strokeWidth={1.5} strokeOpacity={0.7} fill="none" />
    {/* Right arrow head pointing right */}
    <polyline points="30,24 34,24" strokeWidth={1.5} strokeOpacity={0.7} />
    <polyline points="31,21.5 34,24 31,26.5" strokeWidth={1.5} strokeOpacity={0.7} fill="none" />
  </>,
);

// ── ArrayLinearHifi: wall element × 3 with equal spacing + ×3 badge ───────────
export const ArrayLinearHifi = bimIconHifi(
  'ArrayLinearHifi',
  <>
    {/* First element — original, concrete */}
    <rect
      x="4"
      y="16"
      width="10"
      height="16"
      style={{
        fill: 'var(--hi-concrete, currentColor)',
        fillOpacity: 'var(--hi-concrete-op, 0.14)',
      }}
    />
    <g strokeWidth={0.75} strokeOpacity={0.35}>
      <line x1="4" y1="24" x2="12" y2="16" />
      <line x1="4" y1="32" x2="14" y2="22" />
      <line x1="8" y1="32" x2="14" y2="26" />
    </g>
    <rect x="4" y="16" width="10" height="16" strokeWidth={2} fill="none" />

    {/* Second element — steel, slightly lighter */}
    <rect
      x="19"
      y="16"
      width="10"
      height="16"
      style={{
        fill: 'var(--hi-steel, currentColor)',
        fillOpacity: 'var(--hi-steel-op, 0.09)',
      }}
      strokeWidth={1.5}
      strokeOpacity={0.55}
    />

    {/* Third element — steel, lightest */}
    <rect
      x="34"
      y="16"
      width="10"
      height="16"
      style={{
        fill: 'var(--hi-steel, currentColor)',
        fillOpacity: 'var(--hi-steel-op, 0.06)',
      }}
      strokeWidth={1.5}
      strokeOpacity={0.35}
      strokeDasharray="3 2"
    />

    {/* Spacing arrows between elements */}
    {/* Arrow 1: between elem1 and elem2 */}
    <line x1="14" y1="24" x2="19" y2="24" strokeWidth={1} strokeOpacity={0.6} />
    <polyline points="15.5,21.5 14,24 15.5,26.5" strokeWidth={1} strokeOpacity={0.6} fill="none" />
    <polyline points="17.5,21.5 19,24 17.5,26.5" strokeWidth={1} strokeOpacity={0.6} fill="none" />

    {/* Arrow 2: between elem2 and elem3 */}
    <line x1="29" y1="24" x2="34" y2="24" strokeWidth={1} strokeOpacity={0.6} />
    <polyline points="30.5,21.5 29,24 30.5,26.5" strokeWidth={1} strokeOpacity={0.6} fill="none" />
    <polyline points="32.5,21.5 34,24 32.5,26.5" strokeWidth={1} strokeOpacity={0.6} fill="none" />

    {/* ×3 badge — top-right corner */}
    <rect
      x="33"
      y="5"
      width="11"
      height="8"
      rx="1.5"
      style={{
        fill: 'var(--hi-concrete, currentColor)',
        fillOpacity: 'var(--hi-concrete-op, 0.18)',
      }}
      strokeWidth={1}
      strokeOpacity={0.5}
    />
    <text
      x="38.5"
      y="11.5"
      fontSize="6"
      textAnchor="middle"
      stroke="none"
      fill="currentColor"
      fillOpacity={0.75}
      fontFamily="sans-serif"
      fontWeight="600"
    >
      ×3
    </text>
  </>,
);

// ── ArrayRadialHifi: central point + 4 elements at 90° + curved arrows ─────────
export const ArrayRadialHifi = bimIconHifi(
  'ArrayRadialHifi',
  <>
    {/* Center point */}
    <circle
      cx="24"
      cy="24"
      r="2.5"
      style={{
        fill: 'var(--hi-concrete, currentColor)',
        fillOpacity: 'var(--hi-concrete-op, 0.5)',
      }}
      strokeWidth={1.5}
    />

    {/* Radial guide lines (faint) */}
    <g strokeWidth={0.75} strokeOpacity={0.2} strokeDasharray="2 2">
      <line x1="24" y1="24" x2="24" y2="8" />
      <line x1="24" y1="24" x2="40" y2="24" />
      <line x1="24" y1="24" x2="24" y2="40" />
      <line x1="24" y1="24" x2="8" y2="24" />
    </g>

    {/* Top element — original, concrete */}
    <rect
      x="19"
      y="5"
      width="10"
      height="7"
      style={{
        fill: 'var(--hi-concrete, currentColor)',
        fillOpacity: 'var(--hi-concrete-op, 0.14)',
      }}
    />
    <rect x="19" y="5" width="10" height="7" strokeWidth={2} fill="none" />

    {/* Right element — steel */}
    <rect
      x="36"
      y="20.5"
      width="7"
      height="7"
      style={{
        fill: 'var(--hi-steel, currentColor)',
        fillOpacity: 'var(--hi-steel-op, 0.09)',
      }}
      strokeWidth={1.5}
      strokeOpacity={0.55}
    />

    {/* Bottom element — steel, lighter */}
    <rect
      x="19"
      y="36"
      width="10"
      height="7"
      style={{
        fill: 'var(--hi-steel, currentColor)',
        fillOpacity: 'var(--hi-steel-op, 0.07)',
      }}
      strokeWidth={1.5}
      strokeOpacity={0.45}
    />

    {/* Left element — steel, lightest */}
    <rect
      x="5"
      y="20.5"
      width="7"
      height="7"
      style={{
        fill: 'var(--hi-steel, currentColor)',
        fillOpacity: 'var(--hi-steel-op, 0.05)',
      }}
      strokeWidth={1.5}
      strokeOpacity={0.35}
      strokeDasharray="3 2"
    />

    {/* Curved arrows suggesting radial rotation */}
    {/* Top-right quarter arc */}
    <path d="M 24 14 A 10 10 0 0 1 34 24" fill="none" strokeWidth={1.5} strokeOpacity={0.65} />
    <polyline points="32,20.5 34,24 30.5,24.5" strokeWidth={1.5} strokeOpacity={0.65} fill="none" />

    {/* Bottom-left quarter arc */}
    <path d="M 24 34 A 10 10 0 0 1 14 24" fill="none" strokeWidth={1.5} strokeOpacity={0.65} />
    <polyline points="16,27.5 14,24 17.5,23.5" strokeWidth={1.5} strokeOpacity={0.65} fill="none" />
  </>,
);

// ── AlignHifi: two misaligned walls + alignment target line + arrows ───────────
export const AlignHifi = bimIconHifi(
  'AlignHifi',
  <>
    {/* Alignment target line — bold horizontal at y=14 */}
    <line x1="4" y1="14" x2="44" y2="14" strokeWidth={2} strokeOpacity={0.9} />

    {/* Left wall — concrete, positioned with top at y=18 (below target) */}
    <rect
      x="7"
      y="18"
      width="12"
      height="22"
      style={{
        fill: 'var(--hi-concrete, currentColor)',
        fillOpacity: 'var(--hi-concrete-op, 0.12)',
      }}
    />
    <g strokeWidth={0.75} strokeOpacity={0.3}>
      <line x1="7" y1="26" x2="15" y2="18" />
      <line x1="7" y1="34" x2="19" y2="22" />
      <line x1="7" y1="40" x2="19" y2="28" />
      <line x1="11" y1="40" x2="19" y2="32" />
    </g>
    <rect x="7" y="18" width="12" height="22" strokeWidth={2} fill="none" />

    {/* Right wall — steel, positioned with top at y=22 (even further below) */}
    <rect
      x="29"
      y="22"
      width="12"
      height="18"
      style={{
        fill: 'var(--hi-steel, currentColor)',
        fillOpacity: 'var(--hi-steel-op, 0.10)',
      }}
      strokeWidth={1.5}
    />

    {/* Alignment arrows — pointing from each wall top toward the target line */}
    {/* Left wall arrow */}
    <line x1="13" y1="18" x2="13" y2="14" strokeWidth={1.5} strokeOpacity={0.75} />
    <polyline points="10.5,16 13,14 15.5,16" strokeWidth={1.5} strokeOpacity={0.75} fill="none" />

    {/* Right wall arrow */}
    <line x1="35" y1="22" x2="35" y2="14" strokeWidth={1.5} strokeOpacity={0.75} />
    <polyline points="32.5,16 35,14 37.5,16" strokeWidth={1.5} strokeOpacity={0.75} fill="none" />

    {/* Tick marks on alignment line at wall positions */}
    <line x1="13" y1="11" x2="13" y2="17" strokeWidth={1} strokeOpacity={0.5} />
    <line x1="35" y1="11" x2="35" y2="17" strokeWidth={1} strokeOpacity={0.5} />
  </>,
);

// ── SplitHifi: continuous wall with a split point + gap + scissors cursor ───────
export const SplitHifi = bimIconHifi(
  'SplitHifi',
  <>
    {/* Left wall half — concrete */}
    <rect
      x="4"
      y="12"
      width="17"
      height="24"
      style={{
        fill: 'var(--hi-concrete, currentColor)',
        fillOpacity: 'var(--hi-concrete-op, 0.12)',
      }}
    />
    <g strokeWidth={0.75} strokeOpacity={0.35}>
      <line x1="4" y1="20" x2="12" y2="12" />
      <line x1="4" y1="28" x2="20" y2="12" />
      <line x1="4" y1="36" x2="21" y2="19" />
      <line x1="8" y1="36" x2="21" y2="23" />
      <line x1="14" y1="36" x2="21" y2="29" />
    </g>
    <rect x="4" y="12" width="17" height="24" strokeWidth={2} fill="none" />

    {/* Right wall half — concrete, slightly separated */}
    <rect
      x="27"
      y="12"
      width="17"
      height="24"
      style={{
        fill: 'var(--hi-concrete, currentColor)',
        fillOpacity: 'var(--hi-concrete-op, 0.12)',
      }}
    />
    <g strokeWidth={0.75} strokeOpacity={0.35}>
      <line x1="27" y1="20" x2="35" y2="12" />
      <line x1="27" y1="28" x2="43" y2="12" />
      <line x1="27" y1="36" x2="44" y2="19" />
      <line x1="31" y1="36" x2="44" y2="23" />
      <line x1="37" y1="36" x2="44" y2="30" />
    </g>
    <rect x="27" y="12" width="17" height="24" strokeWidth={2} fill="none" />

    {/* Split gap indicator lines */}
    <line
      x1="21"
      y1="12"
      x2="27"
      y2="12"
      strokeWidth={0.75}
      strokeOpacity={0.3}
      strokeDasharray="2 1"
    />
    <line
      x1="21"
      y1="36"
      x2="27"
      y2="36"
      strokeWidth={0.75}
      strokeOpacity={0.3}
      strokeDasharray="2 1"
    />

    {/* Scissors / cut cursor at split point (center x=24, center y=24) */}
    {/* Top blade */}
    <path d="M 24 20 L 20.5 15.5" strokeWidth={1.5} strokeOpacity={0.85} />
    {/* Bottom blade */}
    <path d="M 24 20 L 27.5 15.5" strokeWidth={1.5} strokeOpacity={0.85} />
    {/* Pivot circle */}
    <circle cx="24" cy="21" r="2" strokeWidth={1.5} strokeOpacity={0.85} fill="none" />
    {/* Cut line through gap */}
    <line
      x1="24"
      y1="24"
      x2="24"
      y2="38"
      strokeWidth={1.5}
      strokeDasharray="3 2"
      strokeOpacity={0.7}
    />
  </>,
);

// ── TrimExtendHifi: wall crossing + trim boundary + extend arrow ───────────────
export const TrimExtendHifi = bimIconHifi(
  'TrimExtendHifi',
  <>
    {/* Trim/Extend boundary — bold diagonal line */}
    <line x1="28" y1="4" x2="44" y2="44" strokeWidth={2} strokeOpacity={0.9} />

    {/* Wall 1: crosses the boundary — main part in concrete */}
    <rect
      x="4"
      y="10"
      width="34"
      height="10"
      style={{
        fill: 'var(--hi-concrete, currentColor)',
        fillOpacity: 'var(--hi-concrete-op, 0.12)',
      }}
    />
    <g strokeWidth={0.75} strokeOpacity={0.3}>
      <line x1="4" y1="18" x2="12" y2="10" />
      <line x1="4" y1="20" x2="20" y2="4" />
      <line x1="10" y1="20" x2="26" y2="4" />
      <line x1="18" y1="20" x2="34" y2="4" />
    </g>
    <rect x="4" y="10" width="34" height="10" strokeWidth={2} fill="none" />

    {/* Part beyond boundary — roof color at low opacity (to be removed) */}
    <rect
      x="34"
      y="10"
      width="10"
      height="10"
      style={{
        fill: 'var(--hi-roof, currentColor)',
        fillOpacity: 'var(--hi-roof-op, 0.12)',
      }}
      strokeWidth={1}
      strokeOpacity={0.3}
      strokeDasharray="3 2"
    />
    {/* X mark on the part to be removed */}
    <line x1="35" y1="11" x2="43" y2="19" strokeWidth={1} strokeOpacity={0.45} />
    <line x1="43" y1="11" x2="35" y2="19" strokeWidth={1} strokeOpacity={0.45} />

    {/* Wall 2: stops short of boundary — concrete */}
    <rect
      x="4"
      y="28"
      width="20"
      height="10"
      style={{
        fill: 'var(--hi-concrete, currentColor)',
        fillOpacity: 'var(--hi-concrete-op, 0.12)',
      }}
    />
    <g strokeWidth={0.75} strokeOpacity={0.3}>
      <line x1="4" y1="36" x2="12" y2="28" />
      <line x1="4" y1="38" x2="20" y2="22" />
      <line x1="10" y1="38" x2="24" y2="24" />
    </g>
    <rect x="4" y="28" width="20" height="10" strokeWidth={2} fill="none" />

    {/* Extend arrow — pointing from wall2 end toward boundary */}
    <line
      x1="24"
      y1="33"
      x2="34"
      y2="33"
      strokeWidth={1.5}
      strokeOpacity={0.75}
      strokeDasharray="4 2"
    />
    <polyline
      points="31.5,30.5 34,33 31.5,35.5"
      strokeWidth={1.5}
      strokeOpacity={0.75}
      fill="none"
    />
  </>,
);

// ── VoidHifi: wall with rectangular void cut through it ───────────────────────
export const VoidHifi = bimIconHifi(
  'VoidHifi',
  <>
    {/* Wall body — concrete */}
    <rect
      x="4"
      y="8"
      width="40"
      height="32"
      style={{
        fill: 'var(--hi-concrete, currentColor)',
        fillOpacity: 'var(--hi-concrete-op, 0.12)',
      }}
    />
    {/* Concrete hatch (clipped by void visually via layering) */}
    <g strokeWidth={0.75} strokeOpacity={0.3}>
      <line x1="4" y1="16" x2="12" y2="8" />
      <line x1="4" y1="24" x2="20" y2="8" />
      <line x1="4" y1="32" x2="28" y2="8" />
      <line x1="4" y1="40" x2="36" y2="8" />
      <line x1="8" y1="40" x2="44" y2="4" />
      <line x1="16" y1="40" x2="44" y2="12" />
      <line x1="24" y1="40" x2="44" y2="20" />
      <line x1="32" y1="40" x2="44" y2="28" />
      <line x1="40" y1="40" x2="44" y2="36" />
    </g>
    {/* Wall outline */}
    <rect x="4" y="8" width="40" height="32" strokeWidth={2} fill="none" />

    {/* Void rectangle — room fill covers the hatch */}
    <rect
      x="15"
      y="18"
      width="18"
      height="12"
      style={{
        fill: 'var(--hi-room, currentColor)',
        fillOpacity: 'var(--hi-room-op, 0.35)',
      }}
    />
    {/* Void bold edges */}
    <rect x="15" y="18" width="18" height="12" strokeWidth={2} fill="none" />

    {/* Dashed extent lines showing void goes through full wall thickness */}
    <line
      x1="15"
      y1="8"
      x2="15"
      y2="18"
      strokeWidth={0.75}
      strokeDasharray="2 2"
      strokeOpacity={0.55}
    />
    <line
      x1="33"
      y1="8"
      x2="33"
      y2="18"
      strokeWidth={0.75}
      strokeDasharray="2 2"
      strokeOpacity={0.55}
    />
    <line
      x1="15"
      y1="30"
      x2="15"
      y2="40"
      strokeWidth={0.75}
      strokeDasharray="2 2"
      strokeOpacity={0.55}
    />
    <line
      x1="33"
      y1="30"
      x2="33"
      y2="40"
      strokeWidth={0.75}
      strokeDasharray="2 2"
      strokeOpacity={0.55}
    />

    {/* Depth arrows — showing void penetrates full thickness */}
    {/* Top arrow */}
    <line x1="24" y1="8" x2="24" y2="18" strokeWidth={1} strokeOpacity={0.55} />
    <polyline points="21.5,10 24,8 26.5,10" strokeWidth={1} strokeOpacity={0.55} fill="none" />
    {/* Bottom arrow */}
    <line x1="24" y1="30" x2="24" y2="40" strokeWidth={1} strokeOpacity={0.55} />
    <polyline points="21.5,38 24,40 26.5,38" strokeWidth={1} strokeOpacity={0.55} fill="none" />
  </>,
);

// ── PinHifi: wall element with pin symbol locked to it ────────────────────────
export const PinHifi = bimIconHifi(
  'PinHifi',
  <>
    {/* Wall element — concrete */}
    <rect
      x="6"
      y="30"
      width="36"
      height="12"
      style={{
        fill: 'var(--hi-concrete, currentColor)',
        fillOpacity: 'var(--hi-concrete-op, 0.14)',
      }}
    />
    <g strokeWidth={0.75} strokeOpacity={0.3}>
      <line x1="6" y1="38" x2="14" y2="30" />
      <line x1="6" y1="42" x2="22" y2="26" />
      <line x1="14" y1="42" x2="30" y2="26" />
      <line x1="22" y1="42" x2="38" y2="26" />
      <line x1="30" y1="42" x2="42" y2="30" />
    </g>
    <rect x="6" y="30" width="36" height="12" strokeWidth={2} fill="none" />

    {/* Locked indicator — small lock shape on wall */}
    <rect
      x="20"
      y="32"
      width="8"
      height="6"
      rx="1"
      style={{
        fill: 'var(--hi-steel, currentColor)',
        fillOpacity: 'var(--hi-steel-op, 0.25)',
      }}
      strokeWidth={1}
      strokeOpacity={0.5}
    />
    <path
      d="M 21.5 32 Q 21.5 29.5 24 29.5 Q 26.5 29.5 26.5 32"
      fill="none"
      strokeWidth={1}
      strokeOpacity={0.5}
    />

    {/* Pin head — filled circle above */}
    <circle
      cx="24"
      cy="16"
      r="5"
      style={{
        fill: 'var(--hi-steel, currentColor)',
        fillOpacity: 'var(--hi-steel-op, 0.55)',
      }}
      strokeWidth={2}
    />

    {/* Pin needle — line from head down to element */}
    <line x1="24" y1="21" x2="24" y2="30" strokeWidth={2} />

    {/* Pin inner dot */}
    <circle
      cx="24"
      cy="16"
      r="2"
      style={{
        fill: 'var(--hi-steel, currentColor)',
        fillOpacity: 'var(--hi-steel-op, 0.85)',
      }}
      stroke="none"
    />
  </>,
);

// ── UnpinHifi: wall element with pin released / floating away ─────────────────
export const UnpinHifi = bimIconHifi(
  'UnpinHifi',
  <>
    {/* Wall element — lighter fill indicating it's now free */}
    <rect
      x="6"
      y="30"
      width="36"
      height="12"
      style={{
        fill: 'var(--hi-concrete, currentColor)',
        fillOpacity: 'var(--hi-concrete-op, 0.07)',
      }}
    />
    <g strokeWidth={0.75} strokeOpacity={0.2}>
      <line x1="6" y1="38" x2="14" y2="30" />
      <line x1="6" y1="42" x2="22" y2="26" />
      <line x1="14" y1="42" x2="30" y2="26" />
      <line x1="22" y1="42" x2="38" y2="26" />
      <line x1="30" y1="42" x2="42" y2="30" />
    </g>
    <rect x="6" y="30" width="36" height="12" strokeWidth={1.5} strokeOpacity={0.55} fill="none" />

    {/* Movement arrow on the element — indicating it's now free to move */}
    <line x1="34" y1="36" x2="42" y2="36" strokeWidth={1.5} strokeOpacity={0.65} />
    <polyline
      points="39.5,33.5 42,36 39.5,38.5"
      strokeWidth={1.5}
      strokeOpacity={0.65}
      fill="none"
    />

    {/* Pin floating/lifted — positioned above and to the right with tilt */}
    {/* Pin head — steel circle, lifted */}
    <circle
      cx="30"
      cy="14"
      r="5"
      style={{
        fill: 'var(--hi-steel, currentColor)',
        fillOpacity: 'var(--hi-steel-op, 0.35)',
      }}
      strokeWidth={1.5}
      strokeOpacity={0.6}
    />

    {/* Pin needle — tilted/angled (not vertical, suggesting release) */}
    <line
      x1="33"
      y1="18"
      x2="22"
      y2="28"
      strokeWidth={1.5}
      strokeOpacity={0.55}
      strokeDasharray="4 2"
    />

    {/* Pin inner dot */}
    <circle
      cx="30"
      cy="14"
      r="2"
      style={{
        fill: 'var(--hi-steel, currentColor)',
        fillOpacity: 'var(--hi-steel-op, 0.5)',
      }}
      stroke="none"
    />

    {/* Diagonal "release" arrow away from element */}
    <line x1="28" y1="11" x2="22" y2="6" strokeWidth={1.5} strokeOpacity={0.7} />
    <polyline points="25,7.5 22,6 23.5,9" strokeWidth={1.5} strokeOpacity={0.7} fill="none" />

    {/* Empty pin hole on element — where pin used to be */}
    <circle
      cx="20"
      cy="36"
      r="2.5"
      fill="none"
      strokeWidth={1}
      strokeOpacity={0.45}
      strokeDasharray="2 1.5"
    />
  </>,
);
