/**
 * High-fidelity 48×48 BIM icons — organization & coordination.
 *
 * CSS custom properties (set on a wrapper element):
 *   --hi-concrete / --hi-concrete-op  — structural concrete (stone gray)
 *   --hi-finish   / --hi-finish-op    — paper, plaster, background (warm off-white)
 *   --hi-glass    / --hi-glass-op     — glazing, transparent (sky blue)
 *   --hi-steel    / --hi-steel-op     — steel, metal, frames (blue-gray)
 *   --hi-leaf                          — timber, wood tones (amber-brown), no opacity var
 *   --hi-room     / --hi-room-op      — interior zone (pale yellow)
 *   --hi-roof     / --hi-roof-op      — roof, alert/issue color (terracotta red)
 *
 * Without variables the icons render in monochrome currentColor.
 *
 * Stroke hierarchy:
 *   strokeWidth 2    — primary outlines
 *   strokeWidth 1.5  — secondary edges, reveals
 *   strokeWidth 0.75 — hatch, detail lines
 */
import { bimIconHifi } from './icon';

// ── FamilyHifi — parametric element with dimension arrows and grip handles ──
export const FamilyHifi = bimIconHifi(
  'FamilyHifi',
  <>
    {/* Wall section — left stub */}
    <rect
      x="4"
      y="14"
      width="8"
      height="20"
      style={{
        fill: 'var(--hi-concrete, currentColor)',
        fillOpacity: 'var(--hi-concrete-op, 0.10)',
      }}
      strokeWidth={2}
    />
    {/* Wall section — right stub */}
    <rect
      x="36"
      y="14"
      width="8"
      height="20"
      style={{
        fill: 'var(--hi-concrete, currentColor)',
        fillOpacity: 'var(--hi-concrete-op, 0.10)',
      }}
      strokeWidth={2}
    />

    {/* Glazing fill */}
    <rect
      x="12"
      y="14"
      width="24"
      height="20"
      style={{ fill: 'var(--hi-glass, currentColor)', fillOpacity: 'var(--hi-glass-op, 0.18)' }}
      strokeWidth={1.5}
    />
    {/* Glazing center rail */}
    <line x1="12" y1="24" x2="36" y2="24" strokeWidth={0.75} strokeOpacity={0.5} />
    {/* Glazing center mullion */}
    <line x1="24" y1="14" x2="24" y2="34" strokeWidth={0.75} strokeOpacity={0.5} />

    {/* Dimension line — horizontal, above element */}
    <line x1="4" y1="9" x2="44" y2="9" strokeWidth={1} strokeOpacity={0.7} />
    {/* Left extension tick */}
    <line x1="4" y1="7" x2="4" y2="11" strokeWidth={1} strokeOpacity={0.7} />
    {/* Right extension tick */}
    <line x1="44" y1="7" x2="44" y2="11" strokeWidth={1} strokeOpacity={0.7} />
    {/* Arrow heads on dim line */}
    <polyline points="8,7 4,9 8,11" strokeWidth={1} strokeOpacity={0.7} fill="none" />
    <polyline points="40,7 44,9 40,11" strokeWidth={1} strokeOpacity={0.7} fill="none" />

    {/* Dimension line — vertical, left of element */}
    <line x1="2" y1="14" x2="2" y2="34" strokeWidth={1} strokeOpacity={0.7} />
    <line x1="0" y1="14" x2="4" y2="14" strokeWidth={1} strokeOpacity={0.7} />
    <line x1="0" y1="34" x2="4" y2="34" strokeWidth={1} strokeOpacity={0.7} />
    <polyline points="0,18 2,14 4,18" strokeWidth={1} strokeOpacity={0.7} fill="none" />
    <polyline points="0,30 2,34 4,30" strokeWidth={1} strokeOpacity={0.7} fill="none" />

    {/* "W=" text placeholder near top dim line */}
    <line x1="18" y1="7.5" x2="24" y2="7.5" strokeWidth={0.75} strokeOpacity={0.4} />

    {/* "H=" text placeholder left side */}
    <line x1="2.5" y1="22" x2="2.5" y2="24" strokeWidth={0.75} strokeOpacity={0.4} />

    {/* Grip handles — small squares at corners */}
    <rect
      x="10.5"
      y="12.5"
      width="3"
      height="3"
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.30)' }}
      strokeWidth={1}
    />
    <rect
      x="34.5"
      y="12.5"
      width="3"
      height="3"
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.30)' }}
      strokeWidth={1}
    />
    <rect
      x="10.5"
      y="32.5"
      width="3"
      height="3"
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.30)' }}
      strokeWidth={1}
    />
    <rect
      x="34.5"
      y="32.5"
      width="3"
      height="3"
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.30)' }}
      strokeWidth={1}
    />

    {/* Parameter label placeholder below element */}
    <line x1="10" y1="39" x2="20" y2="39" strokeWidth={0.75} strokeOpacity={0.4} />
    <line x1="28" y1="39" x2="38" y2="39" strokeWidth={0.75} strokeOpacity={0.4} />
  </>,
);

// ── FamilyTypeHifi — three window type variants side by side with bracket ──
export const FamilyTypeHifi = bimIconHifi(
  'FamilyTypeHifi',
  <>
    {/* ── Type A: narrow window (left) ── */}
    {/* Wall stub left of A */}
    <rect
      x="4"
      y="18"
      width="3"
      height="16"
      style={{
        fill: 'var(--hi-concrete, currentColor)',
        fillOpacity: 'var(--hi-concrete-op, 0.10)',
      }}
      strokeWidth={1.5}
    />
    {/* Glazing A */}
    <rect
      x="7"
      y="18"
      width="7"
      height="16"
      style={{ fill: 'var(--hi-glass, currentColor)', fillOpacity: 'var(--hi-glass-op, 0.20)' }}
      strokeWidth={1.5}
    />
    {/* Wall stub right of A */}
    <rect
      x="14"
      y="18"
      width="2"
      height="16"
      style={{
        fill: 'var(--hi-concrete, currentColor)',
        fillOpacity: 'var(--hi-concrete-op, 0.10)',
      }}
      strokeWidth={1.5}
    />
    {/* Type label A: short line below */}
    <line x1="8" y1="37" x2="13" y2="37" strokeWidth={0.75} strokeOpacity={0.4} />

    {/* ── Type B: medium window (center) ── */}
    <rect
      x="16"
      y="18"
      width="2"
      height="16"
      style={{
        fill: 'var(--hi-concrete, currentColor)',
        fillOpacity: 'var(--hi-concrete-op, 0.10)',
      }}
      strokeWidth={1.5}
    />
    <rect
      x="18"
      y="18"
      width="12"
      height="16"
      style={{ fill: 'var(--hi-glass, currentColor)', fillOpacity: 'var(--hi-glass-op, 0.20)' }}
      strokeWidth={1.5}
    />
    {/* Horizontal rail on B to differentiate */}
    <line x1="18" y1="26" x2="30" y2="26" strokeWidth={0.75} strokeOpacity={0.5} />
    <rect
      x="30"
      y="18"
      width="2"
      height="16"
      style={{
        fill: 'var(--hi-concrete, currentColor)',
        fillOpacity: 'var(--hi-concrete-op, 0.10)',
      }}
      strokeWidth={1.5}
    />
    <line x1="20" y1="37" x2="28" y2="37" strokeWidth={0.75} strokeOpacity={0.4} />

    {/* ── Type C: wide window (right) ── */}
    <rect
      x="32"
      y="18"
      width="2"
      height="16"
      style={{
        fill: 'var(--hi-concrete, currentColor)',
        fillOpacity: 'var(--hi-concrete-op, 0.10)',
      }}
      strokeWidth={1.5}
    />
    <rect
      x="34"
      y="18"
      width="10"
      height="16"
      style={{ fill: 'var(--hi-glass, currentColor)', fillOpacity: 'var(--hi-glass-op, 0.20)' }}
      strokeWidth={1.5}
    />
    {/* Vertical mullion on C */}
    <line x1="39" y1="18" x2="39" y2="34" strokeWidth={0.75} strokeOpacity={0.5} />
    <rect
      x="44"
      y="18"
      width="2"
      height="16"
      style={{
        fill: 'var(--hi-concrete, currentColor)',
        fillOpacity: 'var(--hi-concrete-op, 0.10)',
      }}
      strokeWidth={1.5}
    />
    <line x1="35" y1="37" x2="43" y2="37" strokeWidth={0.75} strokeOpacity={0.4} />

    {/* Bracket above all three — connects type variants */}
    <line x1="10" y1="13" x2="10" y2="15" strokeWidth={1} strokeOpacity={0.6} />
    <line x1="10" y1="13" x2="38" y2="13" strokeWidth={1} strokeOpacity={0.6} />
    <line x1="38" y1="13" x2="38" y2="15" strokeWidth={1} strokeOpacity={0.6} />
    <line x1="24" y1="10" x2="24" y2="13" strokeWidth={1} strokeOpacity={0.6} />
    {/* A / B / C short indicator marks */}
    <line x1="9" y1="10" x2="12" y2="10" strokeWidth={0.75} strokeOpacity={0.45} />
    <line x1="22" y1="10" x2="26" y2="10" strokeWidth={0.75} strokeOpacity={0.45} />
    <line x1="36" y1="10" x2="40" y2="10" strokeWidth={0.75} strokeOpacity={0.45} />
  </>,
);

// ── GroupHifi — selection group: BIM elements inside dashed boundary ──
export const GroupHifi = bimIconHifi(
  'GroupHifi',
  <>
    {/* Dashed selection boundary */}
    <rect
      x="5"
      y="7"
      width="38"
      height="34"
      rx="3"
      strokeWidth={1.5}
      strokeDasharray="5 3"
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.05)' }}
    />

    {/* Wall segment — left */}
    <rect
      x="9"
      y="12"
      width="10"
      height="5"
      style={{
        fill: 'var(--hi-concrete, currentColor)',
        fillOpacity: 'var(--hi-concrete-op, 0.12)',
      }}
      strokeWidth={1.5}
    />

    {/* Door rectangle — center-left */}
    <rect
      x="9"
      y="21"
      width="7"
      height="10"
      style={{ fill: 'var(--hi-leaf, currentColor)' }}
      fillOpacity={0.35}
      strokeWidth={1.5}
    />
    {/* Door arc */}
    <path d="M9 21 A7 7 0 0 1 16 28" strokeWidth={0.75} strokeOpacity={0.5} fill="none" />

    {/* Window opening — center */}
    <rect
      x="21"
      y="12"
      width="12"
      height="5"
      style={{ fill: 'var(--hi-glass, currentColor)', fillOpacity: 'var(--hi-glass-op, 0.25)' }}
      strokeWidth={1.5}
    />
    <line x1="27" y1="12" x2="27" y2="17" strokeWidth={0.75} strokeOpacity={0.5} />

    {/* Room zone fill — right side */}
    <rect
      x="22"
      y="21"
      width="17"
      height="14"
      style={{ fill: 'var(--hi-room, currentColor)', fillOpacity: 'var(--hi-room-op, 0.30)' }}
      strokeWidth={1}
      strokeOpacity={0.4}
    />

    {/* Group bracket icon — chain link symbol, bottom-right corner */}
    {/* Left oval */}
    <ellipse cx="37" cy="37" rx="3" ry="2" strokeWidth={1.5} fill="none" />
    {/* Right oval — overlapping */}
    <ellipse cx="41" cy="37" rx="3" ry="2" strokeWidth={1.5} fill="none" />
    {/* Mask overlap on left oval to show chain link */}
    <line x1="39" y1="35.5" x2="39" y2="38.5" strokeWidth={1.5} stroke="none" />
  </>,
);

// ── LinkedModelHifi — chain links connecting two building floor plans ──
export const LinkedModelHifi = bimIconHifi(
  'LinkedModelHifi',
  <>
    {/* Building floor plan — left */}
    <rect
      x="4"
      y="10"
      width="14"
      height="16"
      style={{ fill: 'var(--hi-room, currentColor)', fillOpacity: 'var(--hi-room-op, 0.30)' }}
      strokeWidth={1.5}
    />
    {/* Interior room partition lines — left building */}
    <line x1="4" y1="18" x2="18" y2="18" strokeWidth={0.75} strokeOpacity={0.5} />
    <line x1="11" y1="18" x2="11" y2="26" strokeWidth={0.75} strokeOpacity={0.5} />

    {/* Building floor plan — right */}
    <rect
      x="30"
      y="10"
      width="14"
      height="16"
      style={{ fill: 'var(--hi-room, currentColor)', fillOpacity: 'var(--hi-room-op, 0.30)' }}
      strokeWidth={1.5}
    />
    {/* Interior room partition lines — right building */}
    <line x1="30" y1="18" x2="44" y2="18" strokeWidth={0.75} strokeOpacity={0.5} />
    <line x1="37" y1="10" x2="37" y2="18" strokeWidth={0.75} strokeOpacity={0.5} />

    {/* Chain link — left oval */}
    <ellipse
      cx="20"
      cy="32"
      rx="5"
      ry="8"
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.18)' }}
      strokeWidth={2}
    />
    {/* Chain link — right oval, overlapping left */}
    <ellipse
      cx="28"
      cy="32"
      rx="5"
      ry="8"
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.18)' }}
      strokeWidth={2}
    />
    {/* Inner bore of left link */}
    <ellipse cx="20" cy="32" rx="2.5" ry="5" strokeWidth={0.75} strokeOpacity={0.4} fill="none" />
    {/* Inner bore of right link */}
    <ellipse cx="28" cy="32" rx="2.5" ry="5" strokeWidth={0.75} strokeOpacity={0.4} fill="none" />

    {/* Connecting lines from buildings to chain */}
    <line
      x1="11"
      y1="26"
      x2="18"
      y2="28"
      strokeWidth={1}
      strokeOpacity={0.5}
      strokeDasharray="3 2"
    />
    <line
      x1="37"
      y1="26"
      x2="30"
      y2="28"
      strokeWidth={1}
      strokeOpacity={0.5}
      strokeDasharray="3 2"
    />
  </>,
);

// ── MaterialHifi — layered material sample swatch stack ──
export const MaterialHifi = bimIconHifi(
  'MaterialHifi',
  <>
    {/* Layer 1 — exterior render / paint (finish) */}
    <rect
      x="4"
      y="7"
      width="40"
      height="9"
      style={{ fill: 'var(--hi-finish, currentColor)', fillOpacity: 'var(--hi-finish-op, 0.18)' }}
    />
    {/* Layer 1 boundary lines */}
    <line x1="4" y1="7" x2="44" y2="7" strokeWidth={2} />
    <line x1="4" y1="16" x2="44" y2="16" strokeWidth={1.5} />
    {/* End caps layer 1 */}
    <line x1="4" y1="7" x2="4" y2="16" strokeWidth={1.5} />
    <line x1="44" y1="7" x2="44" y2="16" strokeWidth={1.5} />

    {/* Layer 2 — structural concrete with hatch */}
    <rect
      x="4"
      y="16"
      width="40"
      height="10"
      style={{
        fill: 'var(--hi-concrete, currentColor)',
        fillOpacity: 'var(--hi-concrete-op, 0.14)',
      }}
    />
    <line x1="4" y1="26" x2="44" y2="26" strokeWidth={1.5} />
    <line x1="4" y1="16" x2="4" y2="26" strokeWidth={1.5} />
    <line x1="44" y1="16" x2="44" y2="26" strokeWidth={1.5} />
    {/* Concrete hatch lines */}
    <g strokeWidth={0.75} strokeOpacity={0.3}>
      <line x1="4" y1="20" x2="10" y2="16" />
      <line x1="4" y1="24" x2="14" y2="16" />
      <line x1="8" y1="26" x2="18" y2="16" />
      <line x1="16" y1="26" x2="26" y2="16" />
      <line x1="24" y1="26" x2="34" y2="16" />
      <line x1="32" y1="26" x2="42" y2="16" />
      <line x1="40" y1="26" x2="44" y2="22" />
    </g>

    {/* Layer 3 — insulation (finish, wavy lines) */}
    <rect
      x="4"
      y="26"
      width="40"
      height="10"
      style={{ fill: 'var(--hi-finish, currentColor)', fillOpacity: 'var(--hi-finish-op, 0.10)' }}
    />
    <line x1="4" y1="36" x2="44" y2="36" strokeWidth={1.5} />
    <line x1="4" y1="26" x2="4" y2="36" strokeWidth={1.5} />
    <line x1="44" y1="26" x2="44" y2="36" strokeWidth={1.5} />
    {/* Insulation batt wavy lines */}
    <path
      d="M6 30 Q8 28 10 30 Q12 32 14 30 Q16 28 18 30 Q20 32 22 30 Q24 28 26 30 Q28 32 30 30 Q32 28 34 30 Q36 32 38 30 Q40 28 42 30"
      strokeWidth={0.75}
      strokeOpacity={0.45}
      fill="none"
    />
    <path
      d="M6 33 Q8 31 10 33 Q12 35 14 33 Q16 31 18 33 Q20 35 22 33 Q24 31 26 33 Q28 35 30 33 Q32 31 34 33 Q36 35 38 33 Q40 31 42 33"
      strokeWidth={0.75}
      strokeOpacity={0.35}
      fill="none"
    />

    {/* Layer 4 — interior gypsum (finish, lighter) */}
    <rect
      x="4"
      y="36"
      width="40"
      height="5"
      style={{ fill: 'var(--hi-finish, currentColor)', fillOpacity: 'var(--hi-finish-op, 0.07)' }}
    />
    <line x1="4" y1="41" x2="44" y2="41" strokeWidth={2} />
    <line x1="4" y1="36" x2="4" y2="41" strokeWidth={1.5} />
    <line x1="44" y1="36" x2="44" y2="41" strokeWidth={1.5} />
  </>,
);

// ── PhaseHifi — construction phase timeline with brackets and milestones ──
export const PhaseHifi = bimIconHifi(
  'PhaseHifi',
  <>
    {/* Timeline bar */}
    <line x1="5" y1="26" x2="43" y2="26" strokeWidth={2} />

    {/* Phase 1 bracket — left half */}
    <rect
      x="5"
      y="20"
      width="18"
      height="6"
      style={{
        fill: 'var(--hi-concrete, currentColor)',
        fillOpacity: 'var(--hi-concrete-op, 0.18)',
      }}
      strokeWidth={0}
    />
    <line x1="5" y1="20" x2="23" y2="20" strokeWidth={1.5} />
    <line x1="5" y1="20" x2="5" y2="24" strokeWidth={1.5} />
    <line x1="23" y1="20" x2="23" y2="24" strokeWidth={1.5} />

    {/* Phase 2 bracket — right half */}
    <rect
      x="23"
      y="20"
      width="20"
      height="6"
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.18)' }}
      strokeWidth={0}
    />
    <line x1="23" y1="20" x2="43" y2="20" strokeWidth={1.5} />
    <line x1="43" y1="20" x2="43" y2="24" strokeWidth={1.5} />

    {/* Milestone diamonds on timeline */}
    {/* Milestone 1 at x=12 */}
    <polygon
      points="12,23 14,26 12,29 10,26"
      style={{
        fill: 'var(--hi-concrete, currentColor)',
        fillOpacity: 'var(--hi-concrete-op, 0.5)',
      }}
      strokeWidth={1}
    />
    {/* Milestone 2 at x=23 (phase boundary) */}
    <polygon
      points="23,22 25.5,26 23,30 20.5,26"
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.5)' }}
      strokeWidth={1.5}
    />
    {/* Milestone 3 at x=36 */}
    <polygon
      points="36,23 38,26 36,29 34,26"
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.4)' }}
      strokeWidth={1}
    />

    {/* Current date cursor line — at ~x=30 */}
    <line x1="30" y1="16" x2="30" y2="36" strokeWidth={1.5} strokeDasharray="3 2" />
    <polygon points="28,16 30,12 32,16" fill="currentColor" stroke="none" fillOpacity={0.6} />

    {/* Phase label placeholder lines below bar */}
    <line x1="8" y1="31" x2="18" y2="31" strokeWidth={0.75} strokeOpacity={0.4} />
    <line x1="8" y1="33.5" x2="15" y2="33.5" strokeWidth={0.75} strokeOpacity={0.35} />
    <line x1="27" y1="31" x2="39" y2="31" strokeWidth={0.75} strokeOpacity={0.4} />
    <line x1="27" y1="33.5" x2="36" y2="33.5" strokeWidth={0.75} strokeOpacity={0.35} />

    {/* Start / end tick marks on timeline */}
    <line x1="5" y1="24" x2="5" y2="28" strokeWidth={2} />
    <line x1="43" y1="24" x2="43" y2="28" strokeWidth={2} />
  </>,
);

// ── IssueHifi — location-based issue/alert map pin over room context ──
export const IssueHifi = bimIconHifi(
  'IssueHifi',
  <>
    {/* Room context behind pin — dashed boundary */}
    <rect
      x="5"
      y="26"
      width="38"
      height="18"
      rx="2"
      style={{ fill: 'var(--hi-room, currentColor)', fillOpacity: 'var(--hi-room-op, 0.25)' }}
      strokeWidth={1}
      strokeDasharray="4 3"
    />
    {/* Room interior walls hint */}
    <line x1="5" y1="34" x2="22" y2="34" strokeWidth={0.75} strokeOpacity={0.4} />

    {/* Pin body — circle at top */}
    <circle
      cx="24"
      cy="16"
      r="12"
      style={{ fill: 'var(--hi-roof, currentColor)', fillOpacity: 'var(--hi-roof-op, 0.85)' }}
      strokeWidth={2}
    />

    {/* Pin point — tapered triangle below circle */}
    <path
      d="M17 24 L24 40 L31 24"
      style={{ fill: 'var(--hi-roof, currentColor)', fillOpacity: 'var(--hi-roof-op, 0.85)' }}
      strokeWidth={2}
      strokeLinejoin="round"
    />

    {/* Exclamation mark inside pin */}
    {/* Exclamation body */}
    <line x1="24" y1="10" x2="24" y2="18" strokeWidth={2.5} strokeLinecap="round" stroke="white" />
    {/* Exclamation dot */}
    <circle cx="24" cy="21" r="1.2" fill="white" stroke="none" />
  </>,
);

// ── ClashHifi — structural clash: wall vs. pipe with red overlap zone ──
export const ClashHifi = bimIconHifi(
  'ClashHifi',
  <>
    {/* Wall plan cross-section — left element (concrete) */}
    <rect
      x="4"
      y="12"
      width="28"
      height="24"
      style={{
        fill: 'var(--hi-concrete, currentColor)',
        fillOpacity: 'var(--hi-concrete-op, 0.12)',
      }}
      strokeWidth={2}
    />
    {/* Concrete hatch in wall */}
    <g strokeWidth={0.75} strokeOpacity={0.3}>
      <line x1="4" y1="18" x2="10" y2="12" />
      <line x1="4" y1="24" x2="16" y2="12" />
      <line x1="4" y1="30" x2="22" y2="12" />
      <line x1="8" y1="36" x2="28" y2="16" />
      <line x1="16" y1="36" x2="28" y2="24" />
      <line x1="24" y1="36" x2="28" y2="32" />
    </g>

    {/* Pipe cross-section — right element (steel circle) */}
    <circle
      cx="32"
      cy="24"
      r="12"
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.18)' }}
      strokeWidth={2}
    />
    {/* Pipe inner bore */}
    <circle
      cx="32"
      cy="24"
      r="7"
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.08)' }}
      strokeWidth={1}
      strokeOpacity={0.6}
    />
    {/* Pipe wall hatch */}
    <g strokeWidth={0.75} strokeOpacity={0.3}>
      <line x1="22" y1="18" x2="26" y2="13" />
      <line x1="22" y1="24" x2="29" y2="13" />
      <line x1="26" y1="35" x2="39" y2="14" />
      <line x1="32" y1="36" x2="42" y2="20" />
      <line x1="38" y1="35" x2="44" y2="26" />
    </g>

    {/* Clash overlap zone — red fill at intersection */}
    <rect
      x="20"
      y="12"
      width="12"
      height="24"
      style={{ fill: 'var(--hi-roof, currentColor)', fillOpacity: 'var(--hi-roof-op, 0.35)' }}
      stroke="none"
    />

    {/* Clash zone outline (red stroke) */}
    <rect
      x="20"
      y="12"
      width="12"
      height="24"
      style={{ stroke: 'var(--hi-roof, currentColor)' }}
      strokeWidth={1}
      strokeOpacity={0.7}
      fill="none"
    />

    {/* X / starburst at clash center */}
    <line
      x1="23"
      y1="21"
      x2="29"
      y2="27"
      strokeWidth={2}
      strokeOpacity={0.9}
      style={{ stroke: 'var(--hi-roof, currentColor)' }}
    />
    <line
      x1="29"
      y1="21"
      x2="23"
      y2="27"
      strokeWidth={2}
      strokeOpacity={0.9}
      style={{ stroke: 'var(--hi-roof, currentColor)' }}
    />
    {/* Short rays around X */}
    <line
      x1="26"
      y1="19"
      x2="26"
      y2="21"
      strokeWidth={1}
      strokeOpacity={0.7}
      style={{ stroke: 'var(--hi-roof, currentColor)' }}
    />
    <line
      x1="26"
      y1="27"
      x2="26"
      y2="29"
      strokeWidth={1}
      strokeOpacity={0.7}
      style={{ stroke: 'var(--hi-roof, currentColor)' }}
    />
    <line
      x1="21"
      y1="24"
      x2="23"
      y2="24"
      strokeWidth={1}
      strokeOpacity={0.7}
      style={{ stroke: 'var(--hi-roof, currentColor)' }}
    />
    <line
      x1="29"
      y1="24"
      x2="31"
      y2="24"
      strokeWidth={1}
      strokeOpacity={0.7}
      style={{ stroke: 'var(--hi-roof, currentColor)' }}
    />
  </>,
);
