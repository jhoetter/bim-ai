/**
 * Structural icons.
 *
 * Covers the structural elements that sit below architectural design:
 * foundations, trusses, bracing, reinforcement, and connections.
 * Plan and section symbols follow standard structural engineering conventions.
 */
import { bimIcon } from './icon';

// ── Isolated pad footing: inverted T in section (column above, wide base) ─────
export const FoundationIcon = bimIcon(
  'FoundationIcon',
  <path d="M9 4H15V16H21V20H3V16H9z" />,
);

// ── Strip/continuous footing: wall above, widened base below in section ───────
export const StripFootingIcon = bimIcon(
  'StripFootingIcon',
  <path d="M4 4H20V12H22V16H2V12H4z" />,
);

// ── Warren truss: top/bottom chords with zigzag diagonals ────────────────────
export const TrussIcon = bimIcon(
  'TrussIcon',
  <path d="M2 8H22 M2 16H22 M2 8L7 16L12 8L17 16L22 8" />,
);

// ── X-brace: structural frame with crossing diagonal braces ──────────────────
export const BraceIcon = bimIcon(
  'BraceIcon',
  <path d="M4 4H20V20H4z M4 4L20 20 M20 4L4 20" />,
);

// ── Rebar: three parallel reinforcement bars with stirrups at intervals ───────
export const RebarIcon = bimIcon(
  'RebarIcon',
  <path d="M2 8H22 M2 12H22 M2 16H22 M5 6V18 M10 6V18 M15 6V18 M20 6V18" />,
);

// ── Structural connection: base plate with bolt circle ───────────────────────
export const StructuralConnectionIcon = bimIcon(
  'StructuralConnectionIcon',
  <>
    <path d="M5 5H19V19H5z M10 5V19 M14 5V19 M5 10H19 M5 14H19" />
    <circle cx="8" cy="8" r="1.5" />
    <circle cx="16" cy="8" r="1.5" />
    <circle cx="8" cy="16" r="1.5" />
    <circle cx="16" cy="16" r="1.5" />
  </>,
);
