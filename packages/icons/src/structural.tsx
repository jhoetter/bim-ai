/**
 * Structural icons.
 *
 * Covers the structural elements that sit below architectural design:
 * foundations, trusses, bracing, reinforcement, and connections.
 * Plan and section symbols follow standard structural engineering conventions.
 */
import { bimIcon } from './icon';

// ── Isolated pad footing: very narrow column stub on a wide spread footing ────
// The extreme proportion contrast (2-unit column on 16-unit base) makes the
// "point load to spread footing" relationship unmistakable. Clearly distinct
// from StripFootingIcon (wide continuous wall above a slightly wider base).
export const FoundationIcon = bimIcon('FoundationIcon', <path d="M11 3H13V14H20V20H4V14H11z" />);

// ── Strip/continuous footing: wall above, widened base below in section ───────
export const StripFootingIcon = bimIcon('StripFootingIcon', <path d="M4 4H20V12H22V16H2V12H4z" />);

// ── Warren truss: top/bottom chords with zigzag diagonals ────────────────────
export const TrussIcon = bimIcon(
  'TrussIcon',
  <path d="M2 8H22 M2 16H22 M2 8L7 16L12 8L17 16L22 8" />,
);

// ── X-brace: two column sections with crossing diagonal braces between them ───
// Showing two solid column rectangles (not just lines) with diagonals in the
// bay between them makes the structural-bracing intent unmistakable. Previously
// a plain rect+X identical to DuctRectIcon and LightingFixtureIcon.
export const BraceIcon = bimIcon(
  'BraceIcon',
  <>
    <path d="M3 2H8V22H3z M16 2H21V22H16z" />
    <path d="M8 4L16 20 M16 4L8 20" />
  </>,
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
