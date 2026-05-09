/**
 * High-fidelity 48×48 BIM icons — workflow & document types.
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

// ── WorksetHifi — shared work partitioning: pie-chart circle with 3 colored segments ──
export const WorksetHifi = bimIconHifi(
  'WorksetHifi',
  <>
    {/* Segment A — top-right (~120°): concrete fill */}
    {/* Arc from 270° (top) to 30°: M24,24 L24,6 A18,18 0 0,1 39.6,15 Z */}
    <path
      d="M24,24 L24,6 A18,18 0 0,1 39.6,15 Z"
      style={{
        fill: 'var(--hi-concrete, currentColor)',
        fillOpacity: 'var(--hi-concrete-op, 0.18)',
      }}
      strokeWidth={1.5}
    />
    {/* Segment B — bottom (~120°): steel fill */}
    {/* Arc from 30° to 150°: M24,24 L39.6,33 A18,18 0 0,1 8.4,33 Z */}
    <path
      d="M24,24 L39.6,33 A18,18 0 0,1 8.4,33 Z"
      style={{
        fill: 'var(--hi-steel, currentColor)',
        fillOpacity: 'var(--hi-steel-op, 0.18)',
      }}
      strokeWidth={1.5}
    />
    {/* Segment C — top-left (~120°): room fill */}
    {/* Arc from 150° to 270°: M24,24 L8.4,33 A18,18 0 0,1 24,6 Z */}
    <path
      d="M24,24 L8.4,33 A18,18 0 0,1 24,6 Z"
      style={{
        fill: 'var(--hi-room, currentColor)',
        fillOpacity: 'var(--hi-room-op, 0.20)',
      }}
      strokeWidth={1.5}
    />

    {/* Bold outer ring */}
    <circle cx="24" cy="24" r="18" strokeWidth={2} fill="none" />

    {/* Center dot */}
    <circle cx="24" cy="24" r="1.5" fill="currentColor" stroke="none" />

    {/* Person stub — segment A (top-right): small head+body at ~15° */}
    <circle cx="33" cy="12" r="2" strokeWidth={0.75} fill="none" />
    <line x1="33" y1="14" x2="33" y2="18" strokeWidth={0.75} />

    {/* Person stub — segment B (bottom): small head+body at ~90° (bottom) */}
    <circle cx="24" cy="36" r="2" strokeWidth={0.75} fill="none" />
    <line x1="24" y1="38" x2="24" y2="42" strokeWidth={0.75} />

    {/* Person stub — segment C (top-left): small head+body at ~210° */}
    <circle cx="15" cy="12" r="2" strokeWidth={0.75} fill="none" />
    <line x1="15" y1="14" x2="15" y2="18" strokeWidth={0.75} />
  </>,
);

// ── DesignOptionHifi — design variants A/B/C with bracket and star on primary ──
export const DesignOptionHifi = bimIconHifi(
  'DesignOptionHifi',
  <>
    {/* Bracket connecting all three options */}
    <polyline points="6,10 6,6 42,6 42,10" strokeWidth={1.5} fill="none" />
    <line x1="24" y1="6" x2="24" y2="10" strokeWidth={1.5} />

    {/* Option A — left rectangle (14×18) */}
    <rect
      x="4"
      y="10"
      width="12"
      height="16"
      style={{ fill: 'var(--hi-room, currentColor)', fillOpacity: 'var(--hi-room-op, 0.14)' }}
      strokeWidth={1.5}
    />
    {/* Option A interior partition */}
    <line x1="10" y1="10" x2="10" y2="26" strokeWidth={0.75} strokeOpacity={0.5} />
    <line x1="4" y1="19" x2="16" y2="19" strokeWidth={0.75} strokeOpacity={0.5} />

    {/* Option B — center rectangle (PRIMARY) */}
    <rect
      x="18"
      y="10"
      width="12"
      height="16"
      style={{ fill: 'var(--hi-room, currentColor)', fillOpacity: 'var(--hi-room-op, 0.20)' }}
      strokeWidth={2}
    />
    {/* Option B interior — different arrangement */}
    <line x1="18" y1="18" x2="30" y2="18" strokeWidth={0.75} strokeOpacity={0.5} />
    <line x1="24" y1="18" x2="24" y2="26" strokeWidth={0.75} strokeOpacity={0.5} />

    {/* Star/diamond on primary option B */}
    <polygon
      points="24,4 25.2,6.8 28,6.8 25.8,8.6 26.6,11.4 24,9.8 21.4,11.4 22.2,8.6 20,6.8 22.8,6.8"
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.60)' }}
      strokeWidth={0.75}
    />

    {/* Option C — right rectangle */}
    <rect
      x="32"
      y="10"
      width="12"
      height="16"
      style={{ fill: 'var(--hi-room, currentColor)', fillOpacity: 'var(--hi-room-op, 0.14)' }}
      strokeWidth={1.5}
    />
    {/* Option C interior — different arrangement */}
    <line x1="32" y1="15" x2="44" y2="15" strokeWidth={0.75} strokeOpacity={0.5} />
    <line x1="32" y1="21" x2="44" y2="21" strokeWidth={0.75} strokeOpacity={0.5} />

    {/* Labels A, B, C (text placeholder lines below each) */}
    <line x1="7" y1="30" x2="13" y2="30" strokeWidth={0.75} strokeOpacity={0.4} />
    <line x1="21" y1="30" x2="27" y2="30" strokeWidth={0.75} strokeOpacity={0.4} />
    <line x1="35" y1="30" x2="41" y2="30" strokeWidth={0.75} strokeOpacity={0.4} />

    {/* Comparison annotation line below */}
    <line
      x1="4"
      y1="35"
      x2="44"
      y2="35"
      strokeWidth={0.75}
      strokeDasharray="4 2"
      strokeOpacity={0.3}
    />
  </>,
);

// ── RevisionHifi — document with revision cloud edge, delta symbol, row lines ──
export const RevisionHifi = bimIconHifi(
  'RevisionHifi',
  <>
    {/* Document background */}
    <rect
      x="4"
      y="4"
      width="32"
      height="40"
      style={{ fill: 'var(--hi-finish, currentColor)', fillOpacity: 'var(--hi-finish-op, 0.10)' }}
      strokeWidth={2}
    />

    {/* Revision cloud — wavy bumps along right edge of document */}
    <path
      d="M36,8 C38,8 40,10 40,12 C40,14 38,15 40,17 C42,19 40,21 40,23 C40,25 38,26 40,28 C42,30 40,32 40,34 C40,36 38,37 36,38"
      strokeWidth={1.5}
      fill="none"
    />

    {/* Header band */}
    <rect
      x="4"
      y="4"
      width="32"
      height="7"
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.14)' }}
      stroke="none"
    />
    <line x1="4" y1="11" x2="36" y2="11" strokeWidth={1.5} />

    {/* Revision rows — 3 rows with number stubs */}
    {/* Row 1 */}
    <line x1="8" y1="18" x2="14" y2="18" strokeWidth={1.5} />
    <line x1="16" y1="18" x2="30" y2="18" strokeWidth={0.75} strokeOpacity={0.4} />
    {/* Row 2 */}
    <line x1="8" y1="26" x2="14" y2="26" strokeWidth={1.5} />
    <line x1="16" y1="26" x2="28" y2="26" strokeWidth={0.75} strokeOpacity={0.4} />
    {/* Row 3 */}
    <line x1="8" y1="34" x2="14" y2="34" strokeWidth={1.5} />
    <line x1="16" y1="34" x2="32" y2="34" strokeWidth={0.75} strokeOpacity={0.4} />

    {/* Row dividers */}
    <line x1="4" y1="21" x2="36" y2="21" strokeWidth={0.75} strokeOpacity={0.3} />
    <line x1="4" y1="29" x2="36" y2="29" strokeWidth={0.75} strokeOpacity={0.3} />

    {/* Delta (Δ) triangle — change indicator at top-right, roof/alert color */}
    <polygon
      points="33,4 40,16 26,16"
      style={{ fill: 'var(--hi-roof, currentColor)', fillOpacity: 'var(--hi-roof-op, 0.80)' }}
      strokeWidth={1}
    />
    {/* Delta inner line */}
    <line x1="33" y1="8" x2="33" y2="13" strokeWidth={0.75} stroke="white" strokeOpacity={0.8} />
    <line
      x1="33"
      y1="14.5"
      x2="33"
      y2="15.5"
      strokeWidth={0.75}
      stroke="white"
      strokeOpacity={0.8}
    />

    {/* Version badge at bottom */}
    <rect
      x="6"
      y="38"
      width="10"
      height="5"
      rx="1"
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.20)' }}
      strokeWidth={0.75}
    />
  </>,
);

// ── RFIHifi — Request for Information: formal document with header band, question mark ──
export const RFIHifi = bimIconHifi(
  'RFIHifi',
  <>
    {/* Document body */}
    <rect
      x="4"
      y="4"
      width="34"
      height="40"
      style={{ fill: 'var(--hi-finish, currentColor)', fillOpacity: 'var(--hi-finish-op, 0.10)' }}
      strokeWidth={2}
    />

    {/* Header band — steel blue */}
    <rect
      x="4"
      y="4"
      width="34"
      height="9"
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.20)' }}
      stroke="none"
    />
    <line x1="4" y1="13" x2="38" y2="13" strokeWidth={1.5} />

    {/* "RFI" placeholder lines in header */}
    <line x1="8" y1="7" x2="14" y2="7" strokeWidth={1.5} strokeOpacity={0.7} />
    <line x1="16" y1="7" x2="22" y2="7" strokeWidth={1.5} strokeOpacity={0.7} />
    <line x1="24" y1="7" x2="30" y2="7" strokeWidth={1.5} strokeOpacity={0.7} />

    {/* Body text lines — 3 rows */}
    <line x1="8" y1="18" x2="30" y2="18" strokeWidth={0.75} strokeOpacity={0.4} />
    <line x1="8" y1="23" x2="34" y2="23" strokeWidth={0.75} strokeOpacity={0.4} />
    <line x1="8" y1="28" x2="26" y2="28" strokeWidth={0.75} strokeOpacity={0.4} />

    {/* Response area */}
    <rect
      x="4"
      y="32"
      width="34"
      height="12"
      style={{ fill: 'var(--hi-room, currentColor)', fillOpacity: 'var(--hi-room-op, 0.18)' }}
      stroke="none"
    />
    <line x1="4" y1="32" x2="38" y2="32" strokeWidth={1.5} />
    <line x1="8" y1="37" x2="30" y2="37" strokeWidth={0.75} strokeOpacity={0.4} />
    <line x1="8" y1="41" x2="26" y2="41" strokeWidth={0.75} strokeOpacity={0.4} />

    {/* Question mark — prominent on right side */}
    <path
      d="M42,12 C42,9 39,7 36.5,8 C34,9 33,12 35,14 C36,15 36,16 36,18"
      strokeWidth={2}
      fill="none"
    />
    <circle cx="36" cy="21" r="1.2" fill="currentColor" stroke="none" />
  </>,
);

// ── SubmittalHifi — document package stack with stamp mark ──
export const SubmittalHifi = bimIconHifi(
  'SubmittalHifi',
  <>
    {/* Back document (deepest offset) */}
    <rect
      x="10"
      y="6"
      width="30"
      height="36"
      style={{ fill: 'var(--hi-finish, currentColor)', fillOpacity: 'var(--hi-finish-op, 0.06)' }}
      strokeWidth={1}
      strokeOpacity={0.4}
    />

    {/* Middle document */}
    <rect
      x="7"
      y="8"
      width="30"
      height="36"
      style={{ fill: 'var(--hi-finish, currentColor)', fillOpacity: 'var(--hi-finish-op, 0.08)' }}
      strokeWidth={1.5}
      strokeOpacity={0.6}
    />

    {/* Top/front document */}
    <rect
      x="4"
      y="10"
      width="30"
      height="36"
      style={{ fill: 'var(--hi-finish, currentColor)', fillOpacity: 'var(--hi-finish-op, 0.12)' }}
      strokeWidth={2}
    />

    {/* Header band on top document */}
    <rect
      x="4"
      y="10"
      width="30"
      height="8"
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.18)' }}
      stroke="none"
    />
    <line x1="4" y1="18" x2="34" y2="18" strokeWidth={1.5} />

    {/* Header text placeholder */}
    <line x1="8" y1="14" x2="20" y2="14" strokeWidth={0.75} strokeOpacity={0.5} />

    {/* Document body lines */}
    <line x1="8" y1="24" x2="28" y2="24" strokeWidth={0.75} strokeOpacity={0.4} />
    <line x1="8" y1="29" x2="30" y2="29" strokeWidth={0.75} strokeOpacity={0.4} />
    <line x1="8" y1="34" x2="26" y2="34" strokeWidth={0.75} strokeOpacity={0.4} />

    {/* Approval stamp circle — concrete/terracotta */}
    <circle
      cx="23"
      cy="36"
      r="8"
      style={{
        fill: 'var(--hi-concrete, currentColor)',
        fillOpacity: 'var(--hi-concrete-op, 0.12)',
      }}
      strokeWidth={1.5}
    />
    {/* Stamp diagonal cross-lines inside circle */}
    <line x1="17" y1="30" x2="29" y2="42" strokeWidth={1} strokeOpacity={0.5} />
    <line x1="29" y1="30" x2="17" y2="42" strokeWidth={1} strokeOpacity={0.5} />
    {/* Stamp inner ring */}
    <circle cx="23" cy="36" r="5" strokeWidth={0.75} strokeOpacity={0.5} fill="none" />
  </>,
);

// ── PointCloudHifi — dense dot field representing scanned surfaces ──
export const PointCloudHifi = bimIconHifi(
  'PointCloudHifi',
  <>
    {/* Wall/floor silhouette emerging from point cloud — concrete fill */}
    <rect
      x="6"
      y="30"
      width="36"
      height="4"
      style={{
        fill: 'var(--hi-concrete, currentColor)',
        fillOpacity: 'var(--hi-concrete-op, 0.14)',
      }}
      strokeWidth={1.5}
    />
    <rect
      x="6"
      y="6"
      width="4"
      height="28"
      style={{
        fill: 'var(--hi-concrete, currentColor)',
        fillOpacity: 'var(--hi-concrete-op, 0.14)',
      }}
      strokeWidth={1.5}
    />

    {/* Dense inner zone dots — concrete at 0.7 */}
    {(
      [
        [16, 14],
        [20, 12],
        [24, 13],
        [28, 15],
        [32, 13],
        [18, 18],
        [22, 17],
        [26, 18],
        [30, 17],
        [34, 16],
        [16, 22],
        [20, 21],
        [24, 22],
        [28, 20],
        [32, 21],
        [18, 26],
        [22, 25],
        [26, 27],
        [30, 25],
        [34, 26],
      ] as [number, number][]
    ).map(([cx, cy], i) => (
      <circle
        key={i}
        cx={cx}
        cy={cy}
        r="1"
        style={{
          fill: 'var(--hi-concrete, currentColor)',
          fillOpacity: 'var(--hi-concrete-op, 0.70)',
        }}
        stroke="none"
      />
    ))}

    {/* Mid-ring zone dots — concrete at 0.4 */}
    {(
      [
        [13, 10],
        [37, 10],
        [13, 28],
        [37, 28],
        [11, 18],
        [39, 18],
        [24, 8],
        [24, 30],
        [15, 8],
        [33, 8],
        [11, 14],
        [39, 22],
      ] as [number, number][]
    ).map(([cx, cy], i) => (
      <circle
        key={`mid-${i}`}
        cx={cx}
        cy={cy}
        r="1"
        style={{
          fill: 'var(--hi-concrete, currentColor)',
          fillOpacity: 'var(--hi-concrete-op, 0.40)',
        }}
        stroke="none"
      />
    ))}

    {/* Outer sparse dots — just currentColor, very faint */}
    {(
      [
        [8, 6],
        [40, 6],
        [8, 34],
        [40, 34],
        [8, 18],
        [42, 16],
        [24, 4],
        [20, 36],
        [44, 24],
        [4, 24],
      ] as [number, number][]
    ).map(([cx, cy], i) => (
      <circle
        key={`outer-${i}`}
        cx={cx}
        cy={cy}
        r="1"
        fill="currentColor"
        fillOpacity={0.15}
        stroke="none"
      />
    ))}
  </>,
);

// ── DigitalTwinHifi — physical asset + digital model overlapping rects with sync arrows ──
export const DigitalTwinHifi = bimIconHifi(
  'DigitalTwinHifi',
  <>
    {/* Physical asset — left rectangle, concrete */}
    <rect
      x="4"
      y="14"
      width="18"
      height="22"
      style={{
        fill: 'var(--hi-concrete, currentColor)',
        fillOpacity: 'var(--hi-concrete-op, 0.16)',
      }}
      strokeWidth={2}
    />

    {/* Digital model — right rectangle, glass */}
    <rect
      x="26"
      y="14"
      width="18"
      height="22"
      style={{ fill: 'var(--hi-glass, currentColor)', fillOpacity: 'var(--hi-glass-op, 0.16)' }}
      strokeWidth={2}
    />

    {/* Overlap zone — center overlap area, room fill */}
    <rect
      x="18"
      y="14"
      width="12"
      height="22"
      style={{ fill: 'var(--hi-room, currentColor)', fillOpacity: 'var(--hi-room-op, 0.28)' }}
      stroke="none"
    />

    {/* Bidirectional arrows between the two rects */}
    {/* Right arrow */}
    <line x1="14" y1="23" x2="34" y2="23" strokeWidth={1.5} />
    <polyline points="31,20 34,23 31,26" strokeWidth={1.5} fill="none" />
    {/* Left arrow */}
    <line x1="14" y1="29" x2="34" y2="29" strokeWidth={1.5} />
    <polyline points="17,26 14,29 17,32" strokeWidth={1.5} fill="none" />

    {/* Wifi/signal icon above — 3 arcs */}
    <path d="M18,8 A8,8 0 0,1 30,8" strokeWidth={1.5} fill="none" />
    <path d="M20,10 A5,5 0 0,1 28,10" strokeWidth={1} fill="none" />
    <circle cx="24" cy="12" r="1.5" fill="currentColor" stroke="none" />

    {/* Label placeholder lines */}
    <line x1="6" y1="40" x2="16" y2="40" strokeWidth={0.75} strokeOpacity={0.4} />
    <line x1="28" y1="40" x2="40" y2="40" strokeWidth={0.75} strokeOpacity={0.4} />
  </>,
);

// ── SyncHifi — model synchronization: circular arrow ring, building inside, checkmark ──
export const SyncHifi = bimIconHifi(
  'SyncHifi',
  <>
    {/* Steel fill band / ring body — hint via a subtle annulus fill */}
    <circle
      cx="24"
      cy="24"
      r="17"
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.08)' }}
      stroke="none"
    />

    {/* Top arc arrow — clockwise, going right */}
    <path d="M10,20 A16,16 0 0,1 38,20" strokeWidth={2} fill="none" />
    <polyline points="35,17 38,20 35,23" strokeWidth={2} fill="none" />

    {/* Bottom arc arrow — clockwise, going left */}
    <path d="M38,28 A16,16 0 0,1 10,28" strokeWidth={2} fill="none" />
    <polyline points="13,31 10,28 13,25" strokeWidth={2} fill="none" />

    {/* Small building/model icon inside the ring */}
    <rect
      x="19"
      y="20"
      width="10"
      height="8"
      style={{
        fill: 'var(--hi-concrete, currentColor)',
        fillOpacity: 'var(--hi-concrete-op, 0.20)',
      }}
      strokeWidth={1.5}
    />
    <polyline points="17,20 24,15 31,20" strokeWidth={1} fill="none" />

    {/* Checkmark at arrow tip — top right */}
    <polyline points="36,14 38,17 42,12" strokeWidth={1.5} fill="none" />
  </>,
);

// ── TransmittalHifi — envelope with document, sent arrow, seal ──
export const TransmittalHifi = bimIconHifi(
  'TransmittalHifi',
  <>
    {/* Envelope body */}
    <rect
      x="4"
      y="14"
      width="34"
      height="24"
      style={{ fill: 'var(--hi-finish, currentColor)', fillOpacity: 'var(--hi-finish-op, 0.12)' }}
      strokeWidth={2}
    />

    {/* Envelope flap — steel blue */}
    <polygon
      points="4,14 21,26 38,14"
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.18)' }}
      strokeWidth={1.5}
    />

    {/* Envelope flap fold lines */}
    <line x1="4" y1="38" x2="16" y2="28" strokeWidth={0.75} strokeOpacity={0.35} />
    <line x1="38" y1="38" x2="26" y2="28" strokeWidth={0.75} strokeOpacity={0.35} />

    {/* Document peek inside envelope — top portion visible */}
    <rect
      x="10"
      y="6"
      width="18"
      height="14"
      style={{ fill: 'var(--hi-finish, currentColor)', fillOpacity: 'var(--hi-finish-op, 0.20)' }}
      strokeWidth={1.5}
    />
    {/* Document header lines */}
    <line x1="12" y1="10" x2="24" y2="10" strokeWidth={0.75} strokeOpacity={0.5} />
    <line x1="12" y1="13" x2="22" y2="13" strokeWidth={0.75} strokeOpacity={0.4} />

    {/* Sent arrow pointing right */}
    <line x1="36" y1="26" x2="44" y2="26" strokeWidth={2} />
    <polyline points="41,23 44,26 41,29" strokeWidth={2} fill="none" />

    {/* Official seal suggestion — circle with lines */}
    <circle
      cx="30"
      cy="34"
      r="4"
      style={{
        fill: 'var(--hi-concrete, currentColor)',
        fillOpacity: 'var(--hi-concrete-op, 0.14)',
      }}
      strokeWidth={0.75}
    />
    <circle cx="30" cy="34" r="2.5" strokeWidth={0.5} strokeOpacity={0.5} fill="none" />
  </>,
);

// ── IFCHifi — open BIM data interchange: open box pouring out geometric primitives ──
export const IFCHifi = bimIconHifi(
  'IFCHifi',
  <>
    {/* Box body — steel fill */}
    <rect
      x="10"
      y="20"
      width="22"
      height="18"
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.16)' }}
      strokeWidth={2}
    />

    {/* Box lid — open/tilted to the right */}
    <path
      d="M10,20 L18,12 L40,12 L32,20"
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.10)' }}
      strokeWidth={2}
    />
    {/* Lid right edge */}
    <line x1="40" y1="12" x2="32" y2="20" strokeWidth={1.5} />

    {/* Box depth right face */}
    <polygon
      points="32,20 40,20 40,38 32,38"
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.08)' }}
      strokeWidth={1}
    />

    {/* Floating primitives flowing out — circle (glass) */}
    <circle
      cx="42"
      cy="16"
      r="3"
      style={{ fill: 'var(--hi-glass, currentColor)', fillOpacity: 'var(--hi-glass-op, 0.50)' }}
      strokeWidth={1}
    />

    {/* Triangle (concrete) */}
    <polygon
      points="6,16 12,8 18,16"
      style={{
        fill: 'var(--hi-concrete, currentColor)',
        fillOpacity: 'var(--hi-concrete-op, 0.40)',
      }}
      strokeWidth={1}
    />

    {/* Small rectangle (room) */}
    <rect
      x="4"
      y="24"
      width="6"
      height="4"
      style={{ fill: 'var(--hi-room, currentColor)', fillOpacity: 'var(--hi-room-op, 0.60)' }}
      strokeWidth={1}
    />

    {/* "IFC" placeholder lines inside box */}
    <line x1="14" y1="27" x2="26" y2="27" strokeWidth={0.75} strokeOpacity={0.5} />
    <line x1="14" y1="32" x2="24" y2="32" strokeWidth={0.75} strokeOpacity={0.4} />
  </>,
);

// ── LODHifi — level of detail progression: 3 column variants + progress bar ──
export const LODHifi = bimIconHifi(
  'LODHifi',
  <>
    {/* LOD 100 — simple box column, left */}
    <rect
      x="4"
      y="10"
      width="10"
      height="26"
      style={{
        fill: 'var(--hi-concrete, currentColor)',
        fillOpacity: 'var(--hi-concrete-op, 0.18)',
      }}
      strokeWidth={2}
    />

    {/* Arrow right from LOD100 to LOD200 */}
    <line x1="14" y1="23" x2="18" y2="23" strokeWidth={1} strokeOpacity={0.5} />
    <polyline points="17,21 18,23 17,25" strokeWidth={0.75} fill="none" strokeOpacity={0.5} />

    {/* LOD 200 — I-section profile, center */}
    {/* Top flange */}
    <rect
      x="17"
      y="10"
      width="12"
      height="3"
      style={{
        fill: 'var(--hi-concrete, currentColor)',
        fillOpacity: 'var(--hi-concrete-op, 0.18)',
      }}
      strokeWidth={1.5}
    />
    {/* Web */}
    <rect
      x="21"
      y="13"
      width="4"
      height="20"
      style={{
        fill: 'var(--hi-concrete, currentColor)',
        fillOpacity: 'var(--hi-concrete-op, 0.18)',
      }}
      strokeWidth={1.5}
    />
    {/* Bottom flange */}
    <rect
      x="17"
      y="33"
      width="12"
      height="3"
      style={{
        fill: 'var(--hi-concrete, currentColor)',
        fillOpacity: 'var(--hi-concrete-op, 0.18)',
      }}
      strokeWidth={1.5}
    />

    {/* Arrow right from LOD200 to LOD400 */}
    <line x1="29" y1="23" x2="33" y2="23" strokeWidth={1} strokeOpacity={0.5} />
    <polyline points="32,21 33,23 32,25" strokeWidth={0.75} fill="none" strokeOpacity={0.5} />

    {/* LOD 400 — detailed section with rebar dots, right */}
    {/* Outer column outline */}
    <rect
      x="33"
      y="10"
      width="11"
      height="26"
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.16)' }}
      strokeWidth={2}
    />
    {/* Rebar dots inside */}
    <circle cx="36" cy="14" r="1" fill="currentColor" fillOpacity={0.5} stroke="none" />
    <circle cx="41" cy="14" r="1" fill="currentColor" fillOpacity={0.5} stroke="none" />
    <circle cx="36" cy="32" r="1" fill="currentColor" fillOpacity={0.5} stroke="none" />
    <circle cx="41" cy="32" r="1" fill="currentColor" fillOpacity={0.5} stroke="none" />
    {/* Stirrups hatch */}
    <rect x="35" y="17" width="8" height="12" strokeWidth={0.75} strokeOpacity={0.35} fill="none" />

    {/* Progress bar — LOD100→LOD400 */}
    <rect
      x="4"
      y="40"
      width="40"
      height="4"
      rx="2"
      strokeWidth={0.75}
      strokeOpacity={0.3}
      fill="none"
    />
    {/* Filled portion (~75%) */}
    <rect
      x="4"
      y="40"
      width="30"
      height="4"
      rx="2"
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.40)' }}
      stroke="none"
    />

    {/* LOD labels placeholder */}
    <line x1="4" y1="38" x2="10" y2="38" strokeWidth={0.5} strokeOpacity={0.3} />
    <line x1="17" y1="38" x2="27" y2="38" strokeWidth={0.5} strokeOpacity={0.3} />
    <line x1="33" y1="38" x2="43" y2="38" strokeWidth={0.5} strokeOpacity={0.3} />
  </>,
);

// ── QuantityTakeoffHifi — BOQ spreadsheet with icons, data bars, Σ symbol ──
export const QuantityTakeoffHifi = bimIconHifi(
  'QuantityTakeoffHifi',
  <>
    {/* Spreadsheet background */}
    <rect
      x="4"
      y="4"
      width="40"
      height="40"
      style={{ fill: 'var(--hi-finish, currentColor)', fillOpacity: 'var(--hi-finish-op, 0.08)' }}
      strokeWidth={2}
    />

    {/* Header row — steel */}
    <rect
      x="4"
      y="4"
      width="40"
      height="8"
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.18)' }}
      stroke="none"
    />
    <line x1="4" y1="12" x2="44" y2="12" strokeWidth={1.5} />
    {/* Header placeholder */}
    <line x1="16" y1="8" x2="28" y2="8" strokeWidth={0.75} strokeOpacity={0.5} />
    <line x1="30" y1="8" x2="40" y2="8" strokeWidth={0.75} strokeOpacity={0.5} />

    {/* Column dividers */}
    <line x1="14" y1="4" x2="14" y2="44" strokeWidth={0.75} strokeOpacity={0.4} />
    <line x1="28" y1="4" x2="28" y2="44" strokeWidth={0.75} strokeOpacity={0.3} />

    {/* Row 1 — triangle icon + data bar */}
    <polygon points="7,17 11,13 15,17" strokeWidth={0.75} fill="none" strokeOpacity={0.6} />
    <line x1="16" y1="16" x2="36" y2="16" strokeWidth={0.75} strokeOpacity={0.4} />
    <rect
      x="30"
      y="13"
      width="10"
      height="3"
      rx="1"
      strokeWidth={0.5}
      strokeOpacity={0.3}
      style={{
        fill: 'var(--hi-concrete, currentColor)',
        fillOpacity: 'var(--hi-concrete-op, 0.30)',
      }}
    />
    <line x1="4" y1="20" x2="44" y2="20" strokeWidth={0.75} strokeOpacity={0.3} />

    {/* Row 2 highlighted — room fill */}
    <rect
      x="4"
      y="20"
      width="40"
      height="8"
      style={{ fill: 'var(--hi-room, currentColor)', fillOpacity: 'var(--hi-room-op, 0.20)' }}
      stroke="none"
    />
    {/* Circle icon + data bar */}
    <circle cx="9" cy="24" r="2.5" strokeWidth={0.75} fill="none" strokeOpacity={0.6} />
    <line x1="16" y1="24" x2="38" y2="24" strokeWidth={0.75} strokeOpacity={0.4} />
    <rect
      x="30"
      y="21"
      width="12"
      height="3"
      rx="1"
      strokeWidth={0.5}
      strokeOpacity={0.3}
      style={{ fill: 'var(--hi-room, currentColor)', fillOpacity: 'var(--hi-room-op, 0.60)' }}
    />
    <line x1="4" y1="28" x2="44" y2="28" strokeWidth={0.75} strokeOpacity={0.3} />

    {/* Row 3 — rectangle icon + data bar */}
    <rect x="6" y="31" width="6" height="4" strokeWidth={0.75} fill="none" strokeOpacity={0.6} />
    <line x1="16" y1="33" x2="34" y2="33" strokeWidth={0.75} strokeOpacity={0.4} />
    <rect
      x="30"
      y="30"
      width="8"
      height="3"
      rx="1"
      strokeWidth={0.5}
      strokeOpacity={0.3}
      style={{
        fill: 'var(--hi-concrete, currentColor)',
        fillOpacity: 'var(--hi-concrete-op, 0.25)',
      }}
    />
    <line x1="4" y1="36" x2="44" y2="36" strokeWidth={0.75} strokeOpacity={0.3} />

    {/* Summation Σ row at bottom */}
    <rect
      x="4"
      y="36"
      width="40"
      height="8"
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.10)' }}
      stroke="none"
    />
    {/* Σ symbol */}
    <path d="M8,38 L14,38 L10,42 L14,46" strokeWidth={1.5} fill="none" />
    <line x1="20" y1="41" x2="40" y2="41" strokeWidth={0.75} strokeOpacity={0.5} />
  </>,
);

// ── EnergyModelHifi — building section with solar arrows, energy zones, sun ──
export const EnergyModelHifi = bimIconHifi(
  'EnergyModelHifi',
  <>
    {/* Sun — upper right corner */}
    <circle cx="40" cy="8" r="4" fill="currentColor" fillOpacity={0.15} strokeWidth={1} />
    {/* Sun rays */}
    <line x1="40" y1="2" x2="40" y2="4" strokeWidth={1} strokeOpacity={0.5} />
    <line x1="45" y1="4" x2="44" y2="5" strokeWidth={1} strokeOpacity={0.5} />
    <line x1="46" y1="8" x2="44" y2="8" strokeWidth={1} strokeOpacity={0.5} />
    <line x1="44" y1="12" x2="43" y2="11" strokeWidth={1} strokeOpacity={0.5} />

    {/* Building section — exterior wall left, roof top */}
    {/* Roof surface — terracotta */}
    <rect
      x="6"
      y="10"
      width="30"
      height="5"
      style={{ fill: 'var(--hi-roof, currentColor)', fillOpacity: 'var(--hi-roof-op, 0.22)' }}
      strokeWidth={2}
    />

    {/* Left wall */}
    <rect
      x="6"
      y="15"
      width="5"
      height="26"
      style={{
        fill: 'var(--hi-concrete, currentColor)',
        fillOpacity: 'var(--hi-concrete-op, 0.18)',
      }}
      strokeWidth={1.5}
    />

    {/* Floor slab */}
    <rect
      x="6"
      y="38"
      width="30"
      height="4"
      style={{
        fill: 'var(--hi-concrete, currentColor)',
        fillOpacity: 'var(--hi-concrete-op, 0.18)',
      }}
      strokeWidth={1.5}
    />

    {/* Right wall */}
    <rect
      x="31"
      y="15"
      width="5"
      height="23"
      style={{
        fill: 'var(--hi-concrete, currentColor)',
        fillOpacity: 'var(--hi-concrete-op, 0.18)',
      }}
      strokeWidth={1.5}
    />

    {/* Interior — warm zone left half */}
    <rect
      x="11"
      y="15"
      width="12"
      height="23"
      style={{ fill: 'var(--hi-room, currentColor)', fillOpacity: 'var(--hi-room-op, 0.30)' }}
      stroke="none"
    />

    {/* Interior — cool zone right half */}
    <rect
      x="23"
      y="15"
      width="8"
      height="23"
      style={{ fill: 'var(--hi-glass, currentColor)', fillOpacity: 'var(--hi-glass-op, 0.22)' }}
      stroke="none"
    />

    {/* Zone divider */}
    <line
      x1="23"
      y1="15"
      x2="23"
      y2="38"
      strokeWidth={0.75}
      strokeDasharray="3 2"
      strokeOpacity={0.4}
    />

    {/* Solar arrows hitting roof — diagonal from sun direction */}
    <line x1="32" y1="4" x2="26" y2="10" strokeWidth={1.5} strokeOpacity={0.6} />
    <polyline points="26,7 26,10 29,10" strokeWidth={1} fill="none" strokeOpacity={0.6} />
    <line x1="36" y1="4" x2="30" y2="10" strokeWidth={1.5} strokeOpacity={0.6} />
    <polyline points="30,7 30,10 33,10" strokeWidth={1} fill="none" strokeOpacity={0.6} />

    {/* Heat flow arrow through envelope — upward inside building */}
    <line x1="16" y1="32" x2="16" y2="20" strokeWidth={1} strokeOpacity={0.4} />
    <polyline points="14,22 16,20 18,22" strokeWidth={0.75} fill="none" strokeOpacity={0.4} />
  </>,
);

// ── ScopeBoxHifi — 3D isometric dashed box enclosing building elements with handles ──
export const ScopeBoxHifi = bimIconHifi(
  'ScopeBoxHifi',
  <>
    {/* Interior floor plan elements inside scope box */}
    {/* Wall segments — concrete */}
    <rect
      x="14"
      y="20"
      width="18"
      height="3"
      style={{
        fill: 'var(--hi-concrete, currentColor)',
        fillOpacity: 'var(--hi-concrete-op, 0.20)',
      }}
      strokeWidth={1}
    />
    <rect
      x="14"
      y="20"
      width="3"
      height="14"
      style={{
        fill: 'var(--hi-concrete, currentColor)',
        fillOpacity: 'var(--hi-concrete-op, 0.20)',
      }}
      strokeWidth={1}
    />
    {/* Interior zone */}
    <rect
      x="17"
      y="23"
      width="15"
      height="11"
      style={{ fill: 'var(--hi-room, currentColor)', fillOpacity: 'var(--hi-room-op, 0.16)' }}
      stroke="none"
    />

    {/* Scope box — dashed isometric box outline */}
    {/* Front face (bottom) */}
    <rect x="8" y="18" width="26" height="22" strokeWidth={2} strokeDasharray="6 3" fill="none" />
    {/* Top face — isometric top */}
    <polyline points="8,18 14,12 40,12 34,18" strokeWidth={2} strokeDasharray="6 3" fill="none" />
    {/* Right face */}
    <polyline points="34,18 40,12 40,32 34,40" strokeWidth={2} strokeDasharray="6 3" fill="none" />

    {/* Corner handle squares — steel fill */}
    {(
      [
        [6, 16],
        [32, 16],
        [6, 38],
        [32, 38],
        [12, 10],
        [38, 10],
        [38, 30],
      ] as [number, number][]
    ).map(([x, y], i) => (
      <rect
        key={i}
        x={x}
        y={y}
        width="4"
        height="4"
        style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.60)' }}
        strokeWidth={0.75}
      />
    ))}
  </>,
);
