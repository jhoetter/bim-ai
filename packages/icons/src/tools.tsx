/**
 * Phase 1 — Drawing tool icons.
 *
 * Each icon uses architectural plan/elevation conventions rather than
 * generic shapes, so the symbols match what a BIM user expects from
 * their modeling environment.
 *
 * Design rules (all icons):
 *   - 24×24 viewBox, stroke-based, fill="none", currentColor
 *   - strokeWidth default 1.5; active state drives it to 2.0 from outside
 *   - strokeLinecap/Join "round" (set by the bimIcon wrapper)
 *   - Pixel-hinted for clarity at 16, 18, 20 px render sizes
 */
import { bimIcon } from './icon';

// ── Plan cross-section: two parallel lines representing wall faces ───────────
export const WallIcon = bimIcon('WallIcon', <path d="M2 9h20 M2 15h20" />);

// ── Plan door symbol: wall gap + door leaf + quarter-circle swing arc ────────
// Hinge at (9,9). Leaf hangs to (9,15). Arc sweeps to open position (15,9).
export const DoorIcon = bimIcon(
  'DoorIcon',
  <>
    <path d="M2 9h7 M15 9h7 M2 15h7 M15 15h7 M9 9v6" />
    <path d="M9 15A6 6 0 0 1 15 9" />
  </>,
);

// ── Plan window symbol: wall gap + reveals + two glass lines ─────────────────
export const WindowIcon = bimIcon(
  'WindowIcon',
  <path d="M2 9h6 M16 9h6 M2 15h6 M16 15h6 M8 9v6 M16 9v6 M8 11.5h8 M8 12.5h8" />,
);

// ── Plan slab: boundary rectangle with 45° concrete hatch lines ─────────────
export const FloorIcon = bimIcon(
  'FloorIcon',
  <>
    <path d="M2 4h20v16H2z" />
    <path d="M2 20L18 4 M6 20L22 4 M2 12L10 4 M14 20L22 12" />
  </>,
);

// ── Elevation pitched roof: eave line + two slopes meeting at ridge ──────────
export const RoofIcon = bimIcon('RoofIcon', <path d="M2 20h20 M12 4L2 20 M12 4L22 20" />);

// ── Plan stair: 4-tread step outline going from top-right to bottom-left ─────
export const StairIcon = bimIcon('StairIcon', <path d="M21 5H17V9H13V13H9V17H5V19H21z" />);

// ── Elevation railing: top rail + bottom rail + four posts ───────────────────
export const RailingIcon = bimIcon(
  'RailingIcon',
  <path d="M2 6h20 M2 18h20 M5 6V18 M10 6V18 M14 6V18 M19 6V18" />,
);

// ── Room boundary with centroid cross ────────────────────────────────────────
export const RoomIcon = bimIcon(
  'RoomIcon',
  <>
    <path d="M3 5h18v14H3z" />
    <path d="M12 10v4 M10 12h4" />
  </>,
);

// ── Linear dimension: extension lines + dim line + tick arrowheads ───────────
export const DimensionIcon = bimIcon(
  'DimensionIcon',
  <path d="M4 7V17 M20 7V17 M4 12h16 M4 9L7 12L4 15 M20 9L17 12L20 15" />,
);

// ── Section cut: horizontal line + end ticks + downward viewing-direction legs
export const SectionIcon = bimIcon(
  'SectionIcon',
  <path d="M4 12h16 M4 8v8 M20 8v8 M4 16v4 M20 16v4" />,
);

// ── Element tag: circle bubble + diagonal leader line + label bar ─────────────
export const TagIcon = bimIcon(
  'TagIcon',
  <>
    <circle cx="15" cy="8" r="5" />
    <path d="M12 12L5 21 M13 8h4" />
  </>,
);

// ── Curtain wall: frame + two vertical mullions + two horizontal transoms ─────
export const CurtainWallIcon = bimIcon(
  'CurtainWallIcon',
  <path d="M2 4h20v16H2z M8 4V20 M15 4V20 M2 10h20 M2 16h20" />,
);

// ── Structural column plan: square section with cross hatching ───────────────
export const ColumnIcon = bimIcon('ColumnIcon', <path d="M7 7h10v10H7z M7 7L17 17 M17 7L7 17" />);

// ── I-beam cross-section: top flange + bottom flange + web ───────────────────
export const BeamIcon = bimIcon('BeamIcon', <path d="M4 7h16 M4 17h16 M12 7v10" />);
