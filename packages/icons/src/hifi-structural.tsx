/**
 * High-fidelity 48×48 BIM structural icons with multi-material fills.
 *
 * CSS custom properties (set on a wrapper element):
 *   --hi-concrete / --hi-concrete-op  — structural concrete (warm stone gray)
 *   --hi-finish   / --hi-finish-op    — plaster, grout, fill (warm off-white)
 *   --hi-steel    / --hi-steel-op     — steel, rebar, bolts, plates (blue-gray)
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

// ── FoundationHifi: plan view — pad footing + column stub ─────────────────────
export const FoundationHifi = bimIconHifi(
  'FoundationHifi',
  <>
    {/* Outer foundation pad */}
    <rect
      x="6"
      y="6"
      width="36"
      height="36"
      style={{
        fill: 'var(--hi-concrete, currentColor)',
        fillOpacity: 'var(--hi-concrete-op, 0.07)',
      }}
    />
    {/* Concrete pad hatch — diagonal lines */}
    <g strokeWidth={0.75} strokeOpacity={0.3}>
      <line x1="6" y1="14" x2="14" y2="6" />
      <line x1="6" y1="22" x2="22" y2="6" />
      <line x1="6" y1="30" x2="30" y2="6" />
      <line x1="6" y1="38" x2="38" y2="6" />
      <line x1="6" y1="42" x2="42" y2="6" />
      <line x1="12" y1="42" x2="42" y2="12" />
      <line x1="20" y1="42" x2="42" y2="20" />
      <line x1="28" y1="42" x2="42" y2="28" />
      <line x1="36" y1="42" x2="42" y2="36" />
    </g>
    {/* Pad outline */}
    <rect x="6" y="6" width="36" height="36" strokeWidth={1.5} strokeOpacity={0.6} fill="none" />

    {/* Stepped profile dashed lines showing footing depth */}
    <g strokeWidth={0.75} strokeDasharray="3 2" strokeOpacity={0.55}>
      <line x1="12" y1="6" x2="12" y2="42" />
      <line x1="36" y1="6" x2="36" y2="42" />
      <line x1="6" y1="12" x2="42" y2="12" />
      <line x1="6" y1="36" x2="42" y2="36" />
    </g>

    {/* Column stub — centered 12×12 */}
    <rect
      x="18"
      y="18"
      width="12"
      height="12"
      style={{
        fill: 'var(--hi-concrete, currentColor)',
        fillOpacity: 'var(--hi-concrete-op, 0.18)',
      }}
    />
    {/* Column stub bold border */}
    <rect x="18" y="18" width="12" height="12" strokeWidth={2} fill="none" />
  </>,
);

// ── StripFootingHifi: cross-section — footing base + wall ─────────────────────
export const StripFootingHifi = bimIconHifi(
  'StripFootingHifi',
  <>
    {/* Wide footing base */}
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
    {/* Footing hatch — diagonal (45°) */}
    <g strokeWidth={0.75} strokeOpacity={0.35}>
      <line x1="4" y1="38" x2="12" y2="30" />
      <line x1="4" y1="44" x2="18" y2="30" />
      <line x1="8" y1="44" x2="24" y2="30" />
      <line x1="14" y1="44" x2="30" y2="30" />
      <line x1="20" y1="44" x2="36" y2="30" />
      <line x1="26" y1="44" x2="42" y2="30" />
      <line x1="32" y1="44" x2="44" y2="32" />
      <line x1="38" y1="44" x2="44" y2="38" />
    </g>

    {/* Footing outline */}
    <line x1="4" y1="30" x2="44" y2="30" strokeWidth={2} />
    <line x1="4" y1="44" x2="44" y2="44" strokeWidth={2} />
    <line x1="4" y1="30" x2="4" y2="44" strokeWidth={2} />
    <line x1="44" y1="30" x2="44" y2="44" strokeWidth={2} />

    {/* Wall rising from footing — narrower, separate zone */}
    <rect
      x="20"
      y="4"
      width="8"
      height="26"
      style={{
        fill: 'var(--hi-concrete, currentColor)',
        fillOpacity: 'var(--hi-concrete-op, 0.12)',
      }}
    />
    {/* Wall hatch — steeper diagonal (opposite direction) */}
    <g strokeWidth={0.75} strokeOpacity={0.4}>
      <line x1="20" y1="12" x2="28" y2="4" />
      <line x1="20" y1="20" x2="28" y2="12" />
      <line x1="20" y1="28" x2="28" y2="20" />
      <line x1="20" y1="30" x2="28" y2="22" />
    </g>

    {/* Wall outline */}
    <line x1="20" y1="4" x2="28" y2="4" strokeWidth={2} />
    <line x1="20" y1="4" x2="20" y2="30" strokeWidth={2} />
    <line x1="28" y1="4" x2="28" y2="30" strokeWidth={2} />

    {/* Junction line between wall and footing */}
    <line x1="4" y1="30" x2="44" y2="30" strokeWidth={1} strokeOpacity={0.5} />

    {/* Grade line */}
    <line
      x1="4"
      y1="20"
      x2="20"
      y2="20"
      strokeWidth={1}
      strokeDasharray="3 2"
      strokeOpacity={0.5}
    />
    <line
      x1="28"
      y1="20"
      x2="44"
      y2="20"
      strokeWidth={1}
      strokeDasharray="3 2"
      strokeOpacity={0.5}
    />
  </>,
);

// ── TrussHifi: elevation — Pratt truss with steel chords + web members ─────────
export const TrussHifi = bimIconHifi(
  'TrussHifi',
  <>
    {/* Top chord fill — rectangular cross section */}
    <rect
      x="4"
      y="8"
      width="40"
      height="5"
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.12)' }}
    />
    {/* Top chord outline */}
    <rect x="4" y="8" width="40" height="5" strokeWidth={2} fill="none" />

    {/* Bottom chord fill */}
    <rect
      x="4"
      y="35"
      width="40"
      height="5"
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.12)' }}
    />
    {/* Bottom chord outline */}
    <rect x="4" y="35" width="40" height="5" strokeWidth={2} fill="none" />

    {/* Vertical posts (3) — at x=14, x=24, x=34 */}
    <g
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.10)' }}
      strokeWidth={1.5}
    >
      <rect x="12.5" y="13" width="3" height="22" />
      <rect x="22.5" y="13" width="3" height="22" />
      <rect x="32.5" y="13" width="3" height="22" />
    </g>

    {/* Diagonal web members (Pratt: diagonals lean toward center) */}
    {/* Left bay: lean right (compression) */}
    <line x1="4" y1="13" x2="12.5" y2="35" strokeWidth={1.5} />
    <line x1="15.5" y1="13" x2="22.5" y2="35" strokeWidth={1.5} />
    {/* Right bay: lean left (tension) */}
    <line x1="25.5" y1="35" x2="32.5" y2="13" strokeWidth={1.5} />
    <line x1="35.5" y1="35" x2="44" y2="13" strokeWidth={1.5} />

    {/* End gusset plates */}
    <g
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.20)' }}
      stroke="none"
    >
      <rect x="4" y="13" width="5" height="22" />
      <rect x="39" y="13" width="5" height="22" />
    </g>
    <line x1="4" y1="13" x2="4" y2="35" strokeWidth={2} />
    <line x1="44" y1="13" x2="44" y2="35" strokeWidth={2} />
  </>,
);

// ── BraceHifi: structural X-brace between two steel columns ───────────────────
export const BraceHifi = bimIconHifi(
  'BraceHifi',
  <>
    {/* Left column — I-section hint */}
    <rect
      x="4"
      y="4"
      width="8"
      height="40"
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.12)' }}
    />
    {/* Left column flanges */}
    <rect
      x="2"
      y="4"
      width="12"
      height="4"
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.20)' }}
    />
    <rect
      x="2"
      y="40"
      width="12"
      height="4"
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.20)' }}
    />
    <rect x="4" y="4" width="8" height="40" strokeWidth={2} fill="none" />
    <line x1="2" y1="4" x2="14" y2="4" strokeWidth={1.5} />
    <line x1="2" y1="44" x2="14" y2="44" strokeWidth={1.5} />

    {/* Right column — I-section hint */}
    <rect
      x="36"
      y="4"
      width="8"
      height="40"
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.12)' }}
    />
    <rect
      x="34"
      y="4"
      width="12"
      height="4"
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.20)' }}
    />
    <rect
      x="34"
      y="40"
      width="12"
      height="4"
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.20)' }}
    />
    <rect x="36" y="4" width="8" height="40" strokeWidth={2} fill="none" />
    <line x1="34" y1="4" x2="46" y2="4" strokeWidth={1.5} />
    <line x1="34" y1="44" x2="46" y2="44" strokeWidth={1.5} />

    {/* X-brace members — two diagonals */}
    <line
      x1="12"
      y1="8"
      x2="36"
      y2="40"
      strokeWidth={2.5}
      strokeOpacity={0.85}
      style={{ stroke: 'var(--hi-steel, currentColor)' }}
    />
    <line
      x1="36"
      y1="8"
      x2="12"
      y2="40"
      strokeWidth={2.5}
      strokeOpacity={0.85}
      style={{ stroke: 'var(--hi-steel, currentColor)' }}
    />

    {/* Connection plates at brace ends */}
    <g
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.30)' }}
      strokeWidth={1}
    >
      <rect x="10" y="6" width="6" height="6" />
      <rect x="32" y="6" width="6" height="6" />
      <rect x="10" y="36" width="6" height="6" />
      <rect x="32" y="36" width="6" height="6" />
    </g>

    {/* Center intersection gusset */}
    <circle
      cx="24"
      cy="24"
      r="3"
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.35)' }}
      strokeWidth={1}
    />
  </>,
);

// ── RebarHifi: cross-section — concrete with rebar grid + stirrup ─────────────
export const RebarHifi = bimIconHifi(
  'RebarHifi',
  <>
    {/* Concrete section body */}
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
    {/* Concrete hatch */}
    <g strokeWidth={0.75} strokeOpacity={0.3}>
      <line x1="4" y1="12" x2="12" y2="4" />
      <line x1="4" y1="20" x2="20" y2="4" />
      <line x1="4" y1="28" x2="28" y2="4" />
      <line x1="4" y1="36" x2="36" y2="4" />
      <line x1="4" y1="44" x2="44" y2="4" />
      <line x1="12" y1="44" x2="44" y2="12" />
      <line x1="20" y1="44" x2="44" y2="20" />
      <line x1="28" y1="44" x2="44" y2="28" />
      <line x1="36" y1="44" x2="44" y2="36" />
    </g>
    {/* Section boundary */}
    <rect x="4" y="4" width="40" height="40" strokeWidth={2} fill="none" />

    {/* Stirrup — rectangular loop inside cover */}
    <rect
      x="9"
      y="9"
      width="30"
      height="30"
      strokeWidth={1.5}
      style={{ stroke: 'var(--hi-steel, currentColor)' }}
      fill="none"
      strokeOpacity={0.8}
    />

    {/* Rebar circles — 3×3 grid */}
    <g style={{ fill: 'var(--hi-steel, currentColor)' }} fillOpacity={0.85} stroke="none">
      {/* Top row */}
      <circle cx="13" cy="13" r="2.2" />
      <circle cx="24" cy="13" r="2.2" />
      <circle cx="35" cy="13" r="2.2" />
      {/* Middle row */}
      <circle cx="13" cy="24" r="2.2" />
      <circle cx="24" cy="24" r="2.2" />
      <circle cx="35" cy="24" r="2.2" />
      {/* Bottom row */}
      <circle cx="13" cy="35" r="2.2" />
      <circle cx="24" cy="35" r="2.2" />
      <circle cx="35" cy="35" r="2.2" />
    </g>

    {/* Rebar ring indicators */}
    <g
      fill="none"
      strokeWidth={0.75}
      strokeOpacity={0.5}
      style={{ stroke: 'var(--hi-steel, currentColor)' }}
    >
      <circle cx="13" cy="13" r="3.2" />
      <circle cx="24" cy="13" r="3.2" />
      <circle cx="35" cy="13" r="3.2" />
      <circle cx="13" cy="24" r="3.2" />
      <circle cx="24" cy="24" r="3.2" />
      <circle cx="35" cy="24" r="3.2" />
      <circle cx="13" cy="35" r="3.2" />
      <circle cx="24" cy="35" r="3.2" />
      <circle cx="35" cy="35" r="3.2" />
    </g>
  </>,
);

// ── StructuralConnectionHifi: bolt plate splice — two plates + bolts + welds ──
export const StructuralConnectionHifi = bimIconHifi(
  'StructuralConnectionHifi',
  <>
    {/* Left base plate with flange stubs */}
    <rect
      x="4"
      y="20"
      width="22"
      height="8"
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.12)' }}
    />
    {/* Left flange stubs (top + bottom) */}
    <rect
      x="4"
      y="14"
      width="10"
      height="6"
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.18)' }}
    />
    <rect
      x="4"
      y="28"
      width="10"
      height="6"
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.18)' }}
    />
    <line x1="4" y1="14" x2="14" y2="14" strokeWidth={1.5} />
    <line x1="14" y1="14" x2="14" y2="20" strokeWidth={1.5} />
    <line x1="4" y1="34" x2="14" y2="34" strokeWidth={1.5} />
    <line x1="14" y1="28" x2="14" y2="34" strokeWidth={1.5} />
    <line x1="4" y1="14" x2="4" y2="34" strokeWidth={2} />
    <line x1="4" y1="20" x2="26" y2="20" strokeWidth={1.5} />
    <line x1="4" y1="28" x2="26" y2="28" strokeWidth={1.5} />

    {/* Right base plate with flange stubs */}
    <rect
      x="22"
      y="20"
      width="22"
      height="8"
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.12)' }}
    />
    <rect
      x="34"
      y="14"
      width="10"
      height="6"
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.18)' }}
    />
    <rect
      x="34"
      y="28"
      width="10"
      height="6"
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.18)' }}
    />
    <line x1="34" y1="14" x2="44" y2="14" strokeWidth={1.5} />
    <line x1="34" y1="14" x2="34" y2="20" strokeWidth={1.5} />
    <line x1="34" y1="34" x2="44" y2="34" strokeWidth={1.5} />
    <line x1="34" y1="28" x2="34" y2="34" strokeWidth={1.5} />
    <line x1="44" y1="14" x2="44" y2="34" strokeWidth={2} />
    <line x1="22" y1="20" x2="44" y2="20" strokeWidth={1.5} />
    <line x1="22" y1="28" x2="44" y2="28" strokeWidth={1.5} />

    {/* Overlap zone highlight */}
    <rect
      x="22"
      y="20"
      width="4"
      height="8"
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.30)' }}
      stroke="none"
    />

    {/* Bolt circles — 6 bolts: two rows of 3 */}
    <g
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.85)' }}
      stroke="none"
    >
      <circle cx="16" cy="22.5" r="1.6" />
      <circle cx="24" cy="22.5" r="1.6" />
      <circle cx="32" cy="22.5" r="1.6" />
      <circle cx="16" cy="25.5" r="1.6" />
      <circle cx="24" cy="25.5" r="1.6" />
      <circle cx="32" cy="25.5" r="1.6" />
    </g>
    {/* Bolt hole rings */}
    <g fill="none" strokeWidth={0.75} strokeOpacity={0.55}>
      <circle cx="16" cy="22.5" r="2.6" />
      <circle cx="24" cy="22.5" r="2.6" />
      <circle cx="32" cy="22.5" r="2.6" />
      <circle cx="16" cy="25.5" r="2.6" />
      <circle cx="24" cy="25.5" r="2.6" />
      <circle cx="32" cy="25.5" r="2.6" />
    </g>

    {/* Weld tick marks at plate edges — left side */}
    <g strokeWidth={0.75} strokeOpacity={0.6}>
      <line x1="14" y1="20" x2="16" y2="17" />
      <line x1="14" y1="24" x2="16" y2="21" />
      <line x1="14" y1="28" x2="16" y2="25" />
      {/* Weld ticks — right side */}
      <line x1="34" y1="20" x2="32" y2="17" />
      <line x1="34" y1="24" x2="32" y2="21" />
      <line x1="34" y1="28" x2="32" y2="25" />
    </g>
  </>,
);
