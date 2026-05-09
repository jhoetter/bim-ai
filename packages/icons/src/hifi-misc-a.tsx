/**
 * High-fidelity 48×48 BIM icons — miscellaneous set A.
 *
 * CSS custom properties (set on a wrapper element):
 *   --hi-concrete / --hi-concrete-op  — structural concrete (stone gray)
 *   --hi-finish   / --hi-finish-op    — plaster, paper, gypsum (warm white)
 *   --hi-glass    / --hi-glass-op     — glazing (sky blue)
 *   --hi-steel    / --hi-steel-op     — steel, metal, frames (blue-gray)
 *   --hi-leaf                         — timber/wood (no opacity var)
 *   --hi-room     / --hi-room-op      — interior zone (pale yellow)
 *   --hi-roof     / --hi-roof-op      — roof surface / alert color (terracotta)
 *
 * Without variables the icons render in monochrome currentColor.
 *
 * Stroke hierarchy:
 *   strokeWidth 2    — primary outlines
 *   strokeWidth 1.5  — secondary edges, reveals
 *   strokeWidth 0.75 — hatch, detail lines, text placeholders
 */
import { bimIconHifi } from './icon';

// ── OrbitViewHifi — 3D isometric box with orbit arc, arrowhead, and eye symbol ──
export const OrbitViewHifi = bimIconHifi(
  'OrbitViewHifi',
  <>
    {/* ── Isometric box ── */}
    {/* Front face fill — room pale yellow */}
    <polygon
      points="10,28 10,40 24,44 24,32"
      style={{ fill: 'var(--hi-room, currentColor)', fillOpacity: 'var(--hi-room-op, 0.12)' }}
    />
    {/* Top face fill — finish warm white */}
    <polygon
      points="10,28 24,32 38,28 24,24"
      style={{ fill: 'var(--hi-finish, currentColor)', fillOpacity: 'var(--hi-finish-op, 0.14)' }}
    />
    {/* Right face fill — concrete gray at lower opacity */}
    <polygon
      points="24,32 38,28 38,40 24,44"
      style={{
        fill: 'var(--hi-concrete, currentColor)',
        fillOpacity: 'var(--hi-concrete-op, 0.08)',
      }}
    />
    {/* Front face outline */}
    <polygon points="10,28 10,40 24,44 24,32" strokeWidth={2} fill="none" />
    {/* Top face outline */}
    <polygon points="10,28 24,32 38,28 24,24" strokeWidth={2} fill="none" />
    {/* Right face outline */}
    <polygon points="24,32 38,28 38,40 24,44" strokeWidth={2} fill="none" />

    {/* ── Orbit arc — dashed ellipse arc sweeping around the box ── */}
    {/* Arc: from top-right, sweeping around upper-left of box */}
    <path d="M 40,20 A 20,10 -30 0,0 8,14" strokeWidth={1.5} strokeDasharray="4 3" fill="none" />
    {/* Arrowhead at end of orbit arc (at ~8,14) pointing along the arc tangent */}
    <polyline points="11,10 8,14 12,15" strokeWidth={1.5} fill="none" />

    {/* ── Eye / camera symbol near the arc — upper right ── */}
    {/* Eye outline ellipse */}
    <ellipse
      cx="40"
      cy="12"
      rx="4"
      ry="2.5"
      style={{ fill: 'var(--hi-glass, currentColor)', fillOpacity: 'var(--hi-glass-op, 0.18)' }}
      strokeWidth={1.5}
    />
    {/* Pupil dot */}
    <circle cx="40" cy="12" r="1.2" fill="currentColor" stroke="none" />
  </>,
);

// ── ViewpointHifi — camera body + lens + frustum + floor-plan context ────────
export const ViewpointHifi = bimIconHifi(
  'ViewpointHifi',
  <>
    {/* ── Camera body ── */}
    <rect
      x="8"
      y="10"
      width="22"
      height="15"
      rx="2"
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.14)' }}
      strokeWidth={2}
    />
    {/* Camera top bump (shutter/viewfinder bump) */}
    <rect
      x="13"
      y="7"
      width="8"
      height="4"
      rx="1"
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.10)' }}
      strokeWidth={1.5}
    />

    {/* ── Lens circle ── */}
    <circle
      cx="30"
      cy="17"
      r="6"
      style={{ fill: 'var(--hi-glass, currentColor)', fillOpacity: 'var(--hi-glass-op, 0.20)' }}
      strokeWidth={2}
    />
    {/* Inner lens ring */}
    <circle cx="30" cy="17" r="3.5" strokeWidth={0.75} strokeOpacity={0.4} fill="none" />

    {/* ── Viewfinder frustum extending right from lens ── */}
    <path d="M 36,13 L 44,8 L 44,26 L 36,21" strokeWidth={1.5} fill="none" strokeOpacity={0.7} />
    {/* Frustum interior fill */}
    <path
      d="M 36,13 L 44,8 L 44,26 L 36,21 Z"
      style={{ fill: 'var(--hi-room, currentColor)', fillOpacity: 'var(--hi-room-op, 0.08)' }}
      stroke="none"
    />

    {/* ── Floor plan context below camera — shows camera position in model ── */}
    {/* Wall lines in plan */}
    <line x1="6" y1="33" x2="42" y2="33" strokeWidth={2} />
    <line x1="6" y1="33" x2="6" y2="44" strokeWidth={2} />
    <line x1="42" y1="33" x2="42" y2="44" strokeWidth={2} />
    {/* Wall thickness inner line */}
    <line x1="6" y1="36" x2="42" y2="36" strokeWidth={0.75} strokeOpacity={0.4} />
    {/* Concrete fill for plan wall */}
    <rect
      x="6"
      y="33"
      width="36"
      height="3"
      style={{
        fill: 'var(--hi-concrete, currentColor)',
        fillOpacity: 'var(--hi-concrete-op, 0.12)',
      }}
      stroke="none"
    />
    {/* Camera position dot in plan */}
    <circle cx="19" cy="39" r="1.5" fill="currentColor" stroke="none" />
    {/* Sight-line from camera dot toward top wall */}
    <line
      x1="19"
      y1="36"
      x2="19"
      y2="33"
      strokeWidth={0.75}
      strokeDasharray="2 2"
      strokeOpacity={0.5}
    />
    {/* FOV triangle in plan */}
    <path d="M 19,39 L 10,44 M 19,39 L 28,44" strokeWidth={0.75} strokeOpacity={0.4} fill="none" />
  </>,
);

// ── SectionBoxHifi — 3D wire-frame clipping box with face fills + cut arrows ──
export const SectionBoxHifi = bimIconHifi(
  'SectionBoxHifi',
  <>
    {/* ── Three visible isometric faces ── */}
    {/* Front face — room fill */}
    <polygon
      points="8,28 8,42 26,42 26,28"
      style={{ fill: 'var(--hi-room, currentColor)', fillOpacity: 'var(--hi-room-op, 0.12)' }}
    />
    {/* Top face — finish fill */}
    <polygon
      points="8,28 20,22 38,22 26,28"
      style={{ fill: 'var(--hi-finish, currentColor)', fillOpacity: 'var(--hi-finish-op, 0.14)' }}
    />
    {/* Right face — concrete fill */}
    <polygon
      points="26,28 38,22 38,36 26,42"
      style={{
        fill: 'var(--hi-concrete, currentColor)',
        fillOpacity: 'var(--hi-concrete-op, 0.09)',
      }}
    />

    {/* ── Bold outlines (strokeWidth 2) ── */}
    {/* Front face */}
    <polygon points="8,28 8,42 26,42 26,28" strokeWidth={2} fill="none" />
    {/* Top face */}
    <polygon points="8,28 20,22 38,22 26,28" strokeWidth={2} fill="none" />
    {/* Right face */}
    <polygon points="26,28 38,22 38,36 26,42" strokeWidth={2} fill="none" />
    {/* Hidden back edges (dashed) */}
    <line
      x1="8"
      y1="28"
      x2="20"
      y2="22"
      strokeWidth={0.75}
      strokeDasharray="3 2"
      strokeOpacity={0.4}
    />

    {/* ── Cut/clip arrows — one per visible face ── */}
    {/* Front face: inward arrow pointing right */}
    <line x1="4" y1="35" x2="10" y2="35" strokeWidth={1.5} />
    <polyline points="8,32 10,35 8,38" strokeWidth={1.5} fill="none" />
    {/* Top face: downward arrow */}
    <line x1="23" y1="16" x2="23" y2="22" strokeWidth={1.5} />
    <polyline points="20,20 23,22 26,20" strokeWidth={1.5} fill="none" />
    {/* Right face: leftward arrow */}
    <line x1="44" y1="29" x2="38" y2="29" strokeWidth={1.5} />
    <polyline points="40,26 38,29 40,32" strokeWidth={1.5} fill="none" />
  </>,
);

// ── DetailLineHifi — annotated detail line with end caps + dimension + label ──
export const DetailLineHifi = bimIconHifi(
  'DetailLineHifi',
  <>
    {/* ── Line body — thin rect with steel fill ── */}
    <rect
      x="6"
      y="21"
      width="36"
      height="3"
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.14)' }}
      strokeWidth={0}
    />
    {/* Bold center line */}
    <line x1="6" y1="22.5" x2="42" y2="22.5" strokeWidth={2} />

    {/* ── Perpendicular end caps ── */}
    <line x1="6" y1="18" x2="6" y2="27" strokeWidth={1.5} />
    <line x1="42" y1="18" x2="42" y2="27" strokeWidth={1.5} />

    {/* ── Mid-line dimension annotation ── */}
    {/* Left vertical tick */}
    <line x1="16" y1="17" x2="16" y2="22" strokeWidth={1.5} />
    {/* Right vertical tick */}
    <line x1="32" y1="17" x2="32" y2="22" strokeWidth={1.5} />
    {/* Horizontal span line above */}
    <line x1="16" y1="17" x2="32" y2="17" strokeWidth={1} />
    {/* Small arrowheads on span */}
    <polyline points="19,15 16,17 19,19" strokeWidth={0.75} fill="none" />
    <polyline points="29,15 32,17 29,19" strokeWidth={0.75} fill="none" />
    {/* Dimension value placeholder */}
    <line x1="20" y1="14" x2="28" y2="14" strokeWidth={0.75} strokeOpacity={0.4} />

    {/* ── Label text placeholder lines below the line ── */}
    <line x1="10" y1="31" x2="30" y2="31" strokeWidth={0.75} strokeOpacity={0.4} />
    <line x1="10" y1="35" x2="24" y2="35" strokeWidth={0.75} strokeOpacity={0.4} />
  </>,
);

// ── AssemblyHifi — structural assembly: column + beam + plate + dotted boundary ──
export const AssemblyHifi = bimIconHifi(
  'AssemblyHifi',
  <>
    {/* ── Dotted boundary around group ── */}
    <rect
      x="5"
      y="12"
      width="38"
      height="32"
      rx="2"
      strokeWidth={1}
      strokeDasharray="4 3"
      strokeOpacity={0.6}
      fill="none"
    />

    {/* ── Column stub — concrete ── */}
    <rect
      x="10"
      y="18"
      width="10"
      height="22"
      style={{
        fill: 'var(--hi-concrete, currentColor)',
        fillOpacity: 'var(--hi-concrete-op, 0.12)',
      }}
      strokeWidth={2}
    />
    {/* Column hatch */}
    <g strokeWidth={0.75} strokeOpacity={0.3}>
      <line x1="10" y1="24" x2="14" y2="18" />
      <line x1="10" y1="30" x2="18" y2="20" />
      <line x1="10" y1="36" x2="20" y2="24" />
      <line x1="12" y1="40" x2="20" y2="30" />
    </g>

    {/* ── Beam stub — steel ── */}
    <rect
      x="20"
      y="20"
      width="20"
      height="8"
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.16)' }}
      strokeWidth={2}
    />
    {/* Beam web detail line */}
    <line x1="20" y1="24" x2="40" y2="24" strokeWidth={0.75} strokeOpacity={0.45} />

    {/* ── Connection plate — steel ── */}
    <rect
      x="20"
      y="30"
      width="14"
      height="5"
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.20)' }}
      strokeWidth={1.5}
    />
    {/* Bolt holes on plate */}
    <circle cx="24" cy="32.5" r="1.2" strokeWidth={0.75} fill="none" strokeOpacity={0.6} />
    <circle cx="30" cy="32.5" r="1.2" strokeWidth={0.75} fill="none" strokeOpacity={0.6} />

    {/* ── Assembly ID badge — circle + label placeholder ── */}
    <circle
      cx="38"
      cy="18"
      r="5.5"
      style={{ fill: 'var(--hi-room, currentColor)', fillOpacity: 'var(--hi-room-op, 0.20)' }}
      strokeWidth={1.5}
    />
    {/* ID placeholder line */}
    <line x1="34" y1="18" x2="42" y2="18" strokeWidth={0.75} strokeOpacity={0.45} />
    <line x1="35" y1="21" x2="41" y2="21" strokeWidth={0.75} strokeOpacity={0.3} />
  </>,
);

// ── WallLayerHifi — exploded wall cross-section: 4 offset bands with hatch ────
export const WallLayerHifi = bimIconHifi(
  'WallLayerHifi',
  <>
    {/* ── Layer 4 (innermost — inner finish) — bottom-most, slight offset ── */}
    <rect
      x="8"
      y="36"
      width="36"
      height="6"
      style={{ fill: 'var(--hi-finish, currentColor)', fillOpacity: 'var(--hi-finish-op, 0.14)' }}
      strokeWidth={1.5}
    />
    {/* Inner finish label placeholder */}
    <line x1="10" y1="39" x2="22" y2="39" strokeWidth={0.75} strokeOpacity={0.35} />

    {/* ── Layer 3 (insulation — wavy pattern) — warm white ── */}
    <rect
      x="6"
      y="27"
      width="36"
      height="6"
      style={{ fill: 'var(--hi-finish, currentColor)', fillOpacity: 'var(--hi-finish-op, 0.10)' }}
      strokeWidth={1.5}
    />
    {/* Wavy insulation lines */}
    <path
      d="M 8,30 Q 11,27.5 14,30 Q 17,32.5 20,30 Q 23,27.5 26,30 Q 29,32.5 32,30 Q 35,27.5 38,30"
      strokeWidth={0.75}
      strokeOpacity={0.45}
      fill="none"
    />

    {/* ── Layer 2 (structural — concrete with hatch) ── */}
    <rect
      x="4"
      y="18"
      width="36"
      height="6"
      style={{
        fill: 'var(--hi-concrete, currentColor)',
        fillOpacity: 'var(--hi-concrete-op, 0.12)',
      }}
      strokeWidth={2}
    />
    {/* Concrete hatch */}
    <g strokeWidth={0.75} strokeOpacity={0.3}>
      <line x1="4" y1="22" x2="8" y2="18" />
      <line x1="4" y1="24" x2="14" y2="18" />
      <line x1="10" y1="24" x2="20" y2="18" />
      <line x1="16" y1="24" x2="26" y2="18" />
      <line x1="22" y1="24" x2="32" y2="18" />
      <line x1="28" y1="24" x2="38" y2="18" />
      <line x1="34" y1="24" x2="40" y2="19" />
    </g>

    {/* ── Layer 1 (outer finish) — top, slightly offset ── */}
    <rect
      x="6"
      y="9"
      width="36"
      height="6"
      style={{ fill: 'var(--hi-finish, currentColor)', fillOpacity: 'var(--hi-finish-op, 0.16)' }}
      strokeWidth={1.5}
    />
    {/* Outer finish texture lines */}
    <line x1="8" y1="12" x2="40" y2="12" strokeWidth={0.75} strokeOpacity={0.3} />

    {/* ── Explode arrows between layers ── */}
    {/* Arrow between layer 1 and 2 */}
    <line x1="44" y1="12" x2="44" y2="21" strokeWidth={1.5} strokeOpacity={0.7} />
    <polyline points="42,19 44,21 46,19" strokeWidth={1} fill="none" strokeOpacity={0.7} />
    {/* Arrow between layer 2 and 3 */}
    <line x1="44" y1="24" x2="44" y2="30" strokeWidth={1.5} strokeOpacity={0.7} />
    <polyline points="42,28 44,30 46,28" strokeWidth={1} fill="none" strokeOpacity={0.7} />
    {/* Arrow between layer 3 and 4 */}
    <line x1="44" y1="33" x2="44" y2="39" strokeWidth={1.5} strokeOpacity={0.7} />
    <polyline points="42,37 44,39 46,37" strokeWidth={1} fill="none" strokeOpacity={0.7} />
  </>,
);

// ── ValidationRuleHifi — checklist document: paper + header + 3 rows w/ icons ──
export const ValidationRuleHifi = bimIconHifi(
  'ValidationRuleHifi',
  <>
    {/* ── Paper body ── */}
    <rect
      x="6"
      y="4"
      width="36"
      height="40"
      rx="2"
      style={{ fill: 'var(--hi-finish, currentColor)', fillOpacity: 'var(--hi-finish-op, 0.12)' }}
      strokeWidth={2}
    />

    {/* ── Header band — steel fill ── */}
    <rect
      x="6"
      y="4"
      width="36"
      height="10"
      rx="2"
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.18)' }}
      stroke="none"
    />
    {/* Header bottom edge */}
    <line x1="6" y1="14" x2="42" y2="14" strokeWidth={1.5} />
    {/* Header text placeholder */}
    <line x1="14" y1="9" x2="36" y2="9" strokeWidth={0.75} strokeOpacity={0.5} />

    {/* ── Row dividers ── */}
    <line x1="6" y1="23" x2="42" y2="23" strokeWidth={0.75} strokeOpacity={0.4} />
    <line x1="6" y1="32" x2="42" y2="32" strokeWidth={0.75} strokeOpacity={0.4} />

    {/* ── Row 1 — checkmark (pass) ── */}
    {/* Row background */}
    <rect x="6" y="14" width="36" height="9" fill="none" />
    {/* Check icon circle */}
    <circle cx="16" cy="18.5" r="4" strokeWidth={1} strokeOpacity={0.5} fill="none" />
    {/* Checkmark path */}
    <polyline points="13.5,18.5 15.5,20.5 18.5,16.5" strokeWidth={1.5} />
    {/* Row label */}
    <line x1="23" y1="17.5" x2="38" y2="17.5" strokeWidth={0.75} strokeOpacity={0.4} />
    <line x1="23" y1="20.5" x2="34" y2="20.5" strokeWidth={0.75} strokeOpacity={0.35} />

    {/* ── Row 2 — X mark (fail) ── */}
    <rect x="6" y="23" width="36" height="9" fill="none" />
    {/* X icon circle */}
    <circle cx="16" cy="27.5" r="4" strokeWidth={1} strokeOpacity={0.5} fill="none" />
    {/* X lines */}
    <line x1="13.5" y1="25" x2="18.5" y2="30" strokeWidth={1.5} />
    <line x1="18.5" y1="25" x2="13.5" y2="30" strokeWidth={1.5} />
    {/* Row label */}
    <line x1="23" y1="26.5" x2="39" y2="26.5" strokeWidth={0.75} strokeOpacity={0.4} />
    <line x1="23" y1="29.5" x2="33" y2="29.5" strokeWidth={0.75} strokeOpacity={0.35} />

    {/* ── Row 3 — warning triangle ── */}
    <rect x="6" y="32" width="36" height="10" fill="none" />
    {/* Warning triangle */}
    <polygon
      points="16,35.5 12.5,41 19.5,41"
      style={{ fill: 'var(--hi-roof, currentColor)', fillOpacity: 'var(--hi-roof-op, 0.18)' }}
      strokeWidth={1.5}
    />
    {/* Warning exclamation mark */}
    <line x1="16" y1="37.5" x2="16" y2="39.5" strokeWidth={1} />
    <circle cx="16" cy="41" r="0.6" fill="currentColor" stroke="none" />
    {/* Row label */}
    <line x1="23" y1="35.5" x2="37" y2="35.5" strokeWidth={0.75} strokeOpacity={0.4} />
    <line x1="23" y1="38.5" x2="31" y2="38.5" strokeWidth={0.75} strokeOpacity={0.35} />
  </>,
);

// ── DeviationHifi — two overlapping wall sections + offset arrow + delta symbol ─
export const DeviationHifi = bimIconHifi(
  'DeviationHifi',
  <>
    {/* ── Original wall position — concrete ── */}
    <rect
      x="8"
      y="10"
      width="12"
      height="32"
      style={{
        fill: 'var(--hi-concrete, currentColor)',
        fillOpacity: 'var(--hi-concrete-op, 0.14)',
      }}
      strokeWidth={2}
    />
    {/* Original wall hatch */}
    <g strokeWidth={0.75} strokeOpacity={0.28}>
      <line x1="8" y1="16" x2="12" y2="10" />
      <line x1="8" y1="22" x2="18" y2="10" />
      <line x1="8" y1="28" x2="20" y2="16" />
      <line x1="8" y1="34" x2="20" y2="22" />
      <line x1="8" y1="40" x2="20" y2="28" />
      <line x1="12" y1="42" x2="20" y2="34" />
    </g>

    {/* ── Deviated wall position — terracotta / roof color ── */}
    <rect
      x="20"
      y="10"
      width="12"
      height="32"
      style={{ fill: 'var(--hi-roof, currentColor)', fillOpacity: 'var(--hi-roof-op, 0.14)' }}
      strokeWidth={2}
    />
    {/* Deviated wall inner edge dashed (showing overlap zone) */}
    <line
      x1="20"
      y1="10"
      x2="20"
      y2="42"
      strokeWidth={1}
      strokeDasharray="3 2"
      strokeOpacity={0.5}
    />

    {/* ── Deviation arrow between wall centerlines ── */}
    {/* Horizontal double-headed arrow at mid-height */}
    <line x1="14" y1="5" x2="26" y2="5" strokeWidth={1.5} />
    <polyline points="16,3 14,5 16,7" strokeWidth={1.5} fill="none" />
    <polyline points="24,3 26,5 24,7" strokeWidth={1.5} fill="none" />
    {/* Vertical drop lines from arrow to wall tops */}
    <line
      x1="14"
      y1="5"
      x2="14"
      y2="10"
      strokeWidth={0.75}
      strokeDasharray="2 2"
      strokeOpacity={0.5}
    />
    <line
      x1="26"
      y1="5"
      x2="26"
      y2="10"
      strokeWidth={0.75}
      strokeDasharray="2 2"
      strokeOpacity={0.5}
    />

    {/* ── Delta (Δ) symbol — upper right ── */}
    <polygon
      points="38,12 33,22 43,22"
      style={{ fill: 'var(--hi-roof, currentColor)', fillOpacity: 'var(--hi-roof-op, 0.16)' }}
      strokeWidth={1.5}
    />
    {/* Delta label placeholder */}
    <line x1="33" y1="26" x2="43" y2="26" strokeWidth={0.75} strokeOpacity={0.4} />
    <line x1="35" y1="29" x2="41" y2="29" strokeWidth={0.75} strokeOpacity={0.35} />

    {/* ── Overlap zone indicator (both fills meet) ── */}
    {/* Small bracket at overlap zone center */}
    <line x1="20" y1="26" x2="20" y2="30" strokeWidth={2} strokeOpacity={0.6} />
    <line x1="17" y1="26" x2="20" y2="26" strokeWidth={1.5} strokeOpacity={0.5} />
    <line x1="17" y1="30" x2="20" y2="30" strokeWidth={1.5} strokeOpacity={0.5} />
  </>,
);
