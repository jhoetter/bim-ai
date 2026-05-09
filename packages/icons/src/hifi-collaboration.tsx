/**
 * High-fidelity 48×48 BIM icons — collaboration & worksharing.
 *
 * CSS custom properties (set on a wrapper element):
 *   --hi-concrete / --hi-concrete-op  — structural concrete (stone gray)
 *   --hi-finish   / --hi-finish-op    — paper, plaster, background (warm off-white)
 *   --hi-glass    / --hi-glass-op     — glazing (sky blue)
 *   --hi-steel    / --hi-steel-op     — steel, metal, frames (blue-gray)
 *   --hi-leaf                          — timber/wood (amber), no opacity var
 *   --hi-room     / --hi-room-op      — interior zone (pale yellow)
 *   --hi-roof     / --hi-roof-op      — alert / roof surface (terracotta)
 *
 * Without variables the icons render in monochrome currentColor.
 *
 * Stroke hierarchy:
 *   strokeWidth 2    — primary outlines
 *   strokeWidth 1.5  — secondary edges, reveals
 *   strokeWidth 0.75 — hatch, detail lines, text placeholders
 */
import { bimIconHifi } from './icon';

// ── ReloadLatestHifi — circular refresh ring around a small building plan ──────
export const ReloadLatestHifi = bimIconHifi(
  'ReloadLatestHifi',
  <>
    {/* ── Refresh ring — two arcs forming a circle, steel fill band ── */}
    {/* Top arc (left sweep) — filled band */}
    <path
      d="M 24,6 A 18,18 0 0 0 6,24"
      strokeWidth={4}
      strokeLinecap="butt"
      fill="none"
      style={{ stroke: 'var(--hi-steel, currentColor)', opacity: 'var(--hi-steel-op, 0.22)' }}
    />
    <path d="M 24,6 A 18,18 0 0 0 6,24" strokeWidth={2} fill="none" />

    {/* Bottom arc (right sweep) */}
    <path
      d="M 24,42 A 18,18 0 0 0 42,24"
      strokeWidth={4}
      strokeLinecap="butt"
      fill="none"
      style={{ stroke: 'var(--hi-steel, currentColor)', opacity: 'var(--hi-steel-op, 0.22)' }}
    />
    <path d="M 24,42 A 18,18 0 0 0 42,24" strokeWidth={2} fill="none" />

    {/* Arrowhead at start of top arc (pointing clockwise) at ~(24,6) */}
    <polyline points="19,8 24,6 22,11" strokeWidth={2} fill="none" />

    {/* Arrowhead at start of bottom arc pointing counter-clockwise at ~(24,42) */}
    <polyline points="29,40 24,42 26,37" strokeWidth={2} fill="none" />

    {/* ── Inner building — simplified plan: walls + room ── */}
    {/* Building outline */}
    <rect
      x="16"
      y="17"
      width="16"
      height="14"
      rx="1"
      style={{
        fill: 'var(--hi-concrete, currentColor)',
        fillOpacity: 'var(--hi-concrete-op, 0.12)',
      }}
      strokeWidth={1.5}
    />
    {/* Room zone fill */}
    <rect
      x="18"
      y="19"
      width="10"
      height="8"
      style={{ fill: 'var(--hi-room, currentColor)', fillOpacity: 'var(--hi-room-op, 0.30)' }}
      stroke="none"
    />
    {/* Internal partition */}
    <line x1="16" y1="26" x2="32" y2="26" strokeWidth={0.75} strokeOpacity={0.4} />

    {/* ── Download arrow at bottom (pointing down) ── */}
    <line x1="24" y1="33" x2="24" y2="38" strokeWidth={1.5} />
    <polyline points="21,35.5 24,38 27,35.5" strokeWidth={1.5} fill="none" />
  </>,
);

// ── EditingRequestHifi — wall with open padlock and edit-request badge ─────────
export const EditingRequestHifi = bimIconHifi(
  'EditingRequestHifi',
  <>
    {/* ── Wall element (owned by another user — glass-tinted fill) ── */}
    <rect
      x="5"
      y="10"
      width="24"
      height="32"
      style={{ fill: 'var(--hi-glass, currentColor)', fillOpacity: 'var(--hi-glass-op, 0.14)' }}
      strokeWidth={2}
    />
    {/* Concrete hatch inside wall */}
    <g strokeWidth={0.75} strokeOpacity={0.25}>
      <line x1="5" y1="18" x2="11" y2="10" />
      <line x1="5" y1="26" x2="19" y2="10" />
      <line x1="5" y1="34" x2="27" y2="12" />
      <line x1="11" y1="42" x2="29" y2="24" />
      <line x1="19" y1="42" x2="29" y2="32" />
    </g>
    {/* Owner stripe at top of wall */}
    <rect
      x="5"
      y="10"
      width="24"
      height="5"
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.30)' }}
      stroke="none"
    />

    {/* ── Open padlock — being unlocked ── */}
    {/* Padlock body */}
    <rect
      x="28"
      y="27"
      width="14"
      height="12"
      rx="2"
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.22)' }}
      strokeWidth={2}
    />
    {/* Open shackle — arc swinging up-right */}
    <path d="M 31,27 L 31,20 A 4,4 0 0 1 42,20" strokeWidth={2} fill="none" />
    {/* Keyhole inside padlock body */}
    <circle cx="35" cy="32" r="1.8" strokeWidth={1} fill="none" strokeOpacity={0.6} />
    <line x1="35" y1="33.8" x2="35" y2="36.5" strokeWidth={1} strokeOpacity={0.6} />

    {/* ── Edit-request badge (steel rectangle + cursor pointer) ── */}
    <rect
      x="4"
      y="4"
      width="18"
      height="8"
      rx="1.5"
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.85)' }}
      strokeWidth={1.5}
    />
    {/* "EDIT" placeholder label in badge */}
    <line x1="6" y1="7" x2="10" y2="7" strokeWidth={0.75} stroke="white" strokeOpacity={0.9} />
    <line x1="11.5" y1="7" x2="14" y2="7" strokeWidth={0.75} stroke="white" strokeOpacity={0.9} />
    <line x1="15.5" y1="7" x2="20" y2="7" strokeWidth={0.75} stroke="white" strokeOpacity={0.9} />
    {/* Cursor / hand pointer below badge */}
    <path
      d="M 10,13 L 10,20 L 12,18 L 14,22 L 15.5,21.2 L 13.5,17 L 16,17 Z"
      strokeWidth={1}
      style={{ fill: 'var(--hi-finish, currentColor)', fillOpacity: 'var(--hi-finish-op, 0.9)' }}
    />
  </>,
);

// ── CopyMonitorHifi — host and linked model boxes with monitor arrow and eye ────
export const CopyMonitorHifi = bimIconHifi(
  'CopyMonitorHifi',
  <>
    {/* ── Host model box (concrete) — left ── */}
    <rect
      x="4"
      y="12"
      width="17"
      height="14"
      rx="1"
      style={{
        fill: 'var(--hi-concrete, currentColor)',
        fillOpacity: 'var(--hi-concrete-op, 0.14)',
      }}
      strokeWidth={2}
    />
    {/* Interior partition lines — host */}
    <line x1="4" y1="19" x2="21" y2="19" strokeWidth={0.75} strokeOpacity={0.4} />
    <line x1="12" y1="19" x2="12" y2="26" strokeWidth={0.75} strokeOpacity={0.4} />
    {/* "HOST" label placeholder */}
    <line x1="7" y1="30" x2="18" y2="30" strokeWidth={0.75} strokeOpacity={0.35} />

    {/* ── Linked model box (steel) — right ── */}
    <rect
      x="27"
      y="12"
      width="17"
      height="14"
      rx="1"
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.16)' }}
      strokeWidth={2}
    />
    {/* Interior partition lines — linked */}
    <line x1="27" y1="19" x2="44" y2="19" strokeWidth={0.75} strokeOpacity={0.4} />
    <line x1="35" y1="12" x2="35" y2="19" strokeWidth={0.75} strokeOpacity={0.4} />
    {/* "LINK" label placeholder */}
    <line x1="30" y1="30" x2="41" y2="30" strokeWidth={0.75} strokeOpacity={0.35} />

    {/* ── Sync/link line connecting the two boxes ── */}
    <line x1="21" y1="19" x2="27" y2="19" strokeWidth={1.5} strokeDasharray="3 2" />

    {/* ── Monitoring arrow: from linked element toward local copy ── */}
    {/* Arrow body — curves from right box down-left to host */}
    <path d="M 35,26 C 35,38 12,38 12,26" strokeWidth={1.5} fill="none" strokeOpacity={0.8} />
    {/* Arrowhead at host end */}
    <polyline points="9,29 12,26 15,29" strokeWidth={1.5} fill="none" />

    {/* ── Eye symbol — above the monitoring arrow ── */}
    <ellipse
      cx="24"
      cy="38"
      rx="6"
      ry="3.5"
      style={{ fill: 'var(--hi-glass, currentColor)', fillOpacity: 'var(--hi-glass-op, 0.20)' }}
      strokeWidth={1.5}
    />
    {/* Pupil */}
    <circle cx="24" cy="38" r="1.5" fill="currentColor" stroke="none" />
  </>,
);

// ── CoordinationReviewHifi — 3D model with clash zone + clipboard/check ─────────
export const CoordinationReviewHifi = bimIconHifi(
  'CoordinationReviewHifi',
  <>
    {/* ── Structural element (concrete wall stub) — left column ── */}
    <rect
      x="4"
      y="8"
      width="10"
      height="30"
      style={{
        fill: 'var(--hi-concrete, currentColor)',
        fillOpacity: 'var(--hi-concrete-op, 0.14)',
      }}
      strokeWidth={2}
    />
    {/* Concrete hatch */}
    <g strokeWidth={0.75} strokeOpacity={0.28}>
      <line x1="4" y1="14" x2="10" y2="8" />
      <line x1="4" y1="22" x2="14" y2="12" />
      <line x1="4" y1="30" x2="14" y2="20" />
      <line x1="4" y1="38" x2="14" y2="28" />
    </g>

    {/* ── MEP element (steel pipe running horizontally) ── */}
    <rect
      x="4"
      y="19"
      width="32"
      height="8"
      rx="4"
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.18)' }}
      strokeWidth={2}
    />
    {/* Inner bore of pipe */}
    <line x1="8" y1="23" x2="34" y2="23" strokeWidth={0.75} strokeOpacity={0.35} />

    {/* ── Clash/conflict zone (terracotta overlap zone) ── */}
    <rect
      x="4"
      y="19"
      width="10"
      height="8"
      style={{ fill: 'var(--hi-roof, currentColor)', fillOpacity: 'var(--hi-roof-op, 0.40)' }}
      stroke="none"
    />
    {/* Clash zone border */}
    <rect
      x="4"
      y="19"
      width="10"
      height="8"
      style={{ stroke: 'var(--hi-roof, currentColor)' }}
      strokeWidth={1}
      strokeOpacity={0.7}
      fill="none"
    />
    {/* X mark at clash center */}
    <line
      x1="6"
      y1="21"
      x2="12"
      y2="25"
      strokeWidth={1.5}
      style={{ stroke: 'var(--hi-roof, currentColor)' }}
      strokeOpacity={0.9}
    />
    <line
      x1="12"
      y1="21"
      x2="6"
      y2="25"
      strokeWidth={1.5}
      style={{ stroke: 'var(--hi-roof, currentColor)' }}
      strokeOpacity={0.9}
    />

    {/* ── Clipboard with checkmark — review status (right side) ── */}
    {/* Clipboard board */}
    <rect
      x="28"
      y="6"
      width="16"
      height="20"
      rx="1.5"
      style={{ fill: 'var(--hi-finish, currentColor)', fillOpacity: 'var(--hi-finish-op, 0.90)' }}
      strokeWidth={1.5}
    />
    {/* Clipboard clip at top */}
    <rect
      x="32"
      y="4"
      width="8"
      height="4"
      rx="1"
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.60)' }}
      strokeWidth={1}
    />
    {/* Checkmark */}
    <polyline points="31,16 34,19.5 41,12" strokeWidth={2} fill="none" />

    {/* ── Category label stubs below elements ── */}
    <line x1="4" y1="42" x2="14" y2="42" strokeWidth={0.75} strokeOpacity={0.4} />
    <line x1="16" y1="42" x2="36" y2="42" strokeWidth={0.75} strokeOpacity={0.4} />
  </>,
);

// ── PurgeUnusedHifi — trash bin with faded unused element symbols inside ────────
export const PurgeUnusedHifi = bimIconHifi(
  'PurgeUnusedHifi',
  <>
    {/* ── Bin body — steel fill trapezoid ── */}
    <path
      d="M 10,18 L 12,44 L 36,44 L 38,18 Z"
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.16)' }}
      strokeWidth={2}
    />
    {/* Bin lid */}
    <line x1="8" y1="18" x2="40" y2="18" strokeWidth={2} />
    {/* Bin handle / lid top */}
    <path d="M 19,18 L 19,14 A 5,5 0 0 1 29,14 L 29,18" strokeWidth={2} fill="none" />
    {/* Bin vertical slots */}
    <line x1="18" y1="22" x2="17" y2="40" strokeWidth={0.75} strokeOpacity={0.35} />
    <line x1="24" y1="22" x2="24" y2="40" strokeWidth={0.75} strokeOpacity={0.35} />
    <line x1="30" y1="22" x2="31" y2="40" strokeWidth={0.75} strokeOpacity={0.35} />

    {/* ── Unused element symbols inside bin (faded/gray) ── */}
    {/* Unused element A — small generic rectangle, faded */}
    <rect
      x="13"
      y="24"
      width="7"
      height="5"
      strokeWidth={0.75}
      strokeOpacity={0.35}
      style={{
        fill: 'var(--hi-concrete, currentColor)',
        fillOpacity: 'var(--hi-concrete-op, 0.10)',
      }}
    />
    {/* Unused element B — small circle, faded */}
    <circle
      cx="28"
      cy="28"
      r="3.5"
      strokeWidth={0.75}
      strokeOpacity={0.35}
      style={{
        fill: 'var(--hi-steel, currentColor)',
        fillOpacity: 'var(--hi-steel-op, 0.10)',
      }}
    />
    {/* Unused element C — triangle, faded */}
    <polygon
      points="16,38 13,34 19,34"
      strokeWidth={0.75}
      strokeOpacity={0.35}
      style={{
        fill: 'var(--hi-finish, currentColor)',
        fillOpacity: 'var(--hi-finish-op, 0.10)',
      }}
    />

    {/* ── Sweep arrow — element being swept into bin from outside ── */}
    <path d="M 4,10 C 4,16 8,18 10,18" strokeWidth={1.5} fill="none" strokeOpacity={0.7} />
    {/* Small element being swept — tiny rect outside bin */}
    <rect
      x="4"
      y="6"
      width="6"
      height="4"
      strokeWidth={1}
      strokeOpacity={0.6}
      style={{
        fill: 'var(--hi-finish, currentColor)',
        fillOpacity: 'var(--hi-finish-op, 0.6)',
      }}
    />
    {/* Arrowhead on sweep path */}
    <polyline points="8,15 10,18 13,16" strokeWidth={1.5} fill="none" strokeOpacity={0.7} />
  </>,
);

// ── TransferProjectStandardsHifi — two project docs with bold transfer arrow ────
export const TransferProjectStandardsHifi = bimIconHifi(
  'TransferProjectStandardsHifi',
  <>
    {/* ── Project A document — concrete fill, left ── */}
    <rect
      x="4"
      y="8"
      width="16"
      height="22"
      rx="1.5"
      style={{
        fill: 'var(--hi-concrete, currentColor)',
        fillOpacity: 'var(--hi-concrete-op, 0.14)',
      }}
      strokeWidth={2}
    />
    {/* Project A header band */}
    <rect
      x="4"
      y="8"
      width="16"
      height="6"
      rx="1.5"
      style={{
        fill: 'var(--hi-concrete, currentColor)',
        fillOpacity: 'var(--hi-concrete-op, 0.35)',
      }}
      stroke="none"
    />
    <line x1="4" y1="14" x2="20" y2="14" strokeWidth={1} strokeOpacity={0.4} />
    {/* Standard symbols in project A */}
    {/* Dimension annotation stub */}
    <line x1="6" y1="18" x2="18" y2="18" strokeWidth={1} strokeOpacity={0.5} />
    <line x1="6" y1="18" x2="6" y2="21" strokeWidth={0.75} strokeOpacity={0.5} />
    <line x1="18" y1="18" x2="18" y2="21" strokeWidth={0.75} strokeOpacity={0.5} />
    {/* Text style line */}
    <line x1="6" y1="23" x2="16" y2="23" strokeWidth={1.5} strokeOpacity={0.5} />
    {/* Pattern swatch */}
    <rect
      x="6"
      y="26"
      width="12"
      height="3"
      style={{
        fill: 'var(--hi-finish, currentColor)',
        fillOpacity: 'var(--hi-finish-op, 0.4)',
      }}
      strokeWidth={0.75}
      strokeOpacity={0.4}
    />

    {/* ── Transfer arrow — bold, center ── */}
    <line x1="20" y1="19" x2="28" y2="19" strokeWidth={2.5} />
    <polyline points="25,15.5 28,19 25,22.5" strokeWidth={2.5} fill="none" />

    {/* ── Project B document — finish fill, right ── */}
    <rect
      x="28"
      y="8"
      width="16"
      height="22"
      rx="1.5"
      style={{ fill: 'var(--hi-finish, currentColor)', fillOpacity: 'var(--hi-finish-op, 0.70)' }}
      strokeWidth={2}
    />
    {/* Project B header band — steel */}
    <rect
      x="28"
      y="8"
      width="16"
      height="6"
      rx="1.5"
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.35)' }}
      stroke="none"
    />
    <line x1="28" y1="14" x2="44" y2="14" strokeWidth={1} strokeOpacity={0.4} />
    {/* Received standards appearing in B */}
    <line x1="30" y1="18" x2="42" y2="18" strokeWidth={1} strokeOpacity={0.45} />
    <line x1="30" y1="18" x2="30" y2="21" strokeWidth={0.75} strokeOpacity={0.45} />
    <line x1="42" y1="18" x2="42" y2="21" strokeWidth={0.75} strokeOpacity={0.45} />
    <line x1="30" y1="23" x2="40" y2="23" strokeWidth={1.5} strokeOpacity={0.45} />
    <rect
      x="30"
      y="26"
      width="12"
      height="3"
      style={{
        fill: 'var(--hi-room, currentColor)',
        fillOpacity: 'var(--hi-room-op, 0.45)',
      }}
      strokeWidth={0.75}
      strokeOpacity={0.4}
    />

    {/* ── Project labels below ── */}
    <line x1="6" y1="34" x2="18" y2="34" strokeWidth={0.75} strokeOpacity={0.4} />
    <line x1="30" y1="34" x2="42" y2="34" strokeWidth={0.75} strokeOpacity={0.4} />

    {/* ── "Standards" flow particles along arrow (small dots) ── */}
    <circle cx="22" cy="19" r="1" fill="currentColor" fillOpacity={0.4} stroke="none" />
    <circle cx="25" cy="19" r="1" fill="currentColor" fillOpacity={0.55} stroke="none" />
  </>,
);

// ── ProjectInfoHifi — formal project document with building thumbnail + metadata ─
export const ProjectInfoHifi = bimIconHifi(
  'ProjectInfoHifi',
  <>
    {/* ── Document paper body ── */}
    <rect
      x="5"
      y="5"
      width="38"
      height="38"
      rx="2"
      style={{ fill: 'var(--hi-finish, currentColor)', fillOpacity: 'var(--hi-finish-op, 0.75)' }}
      strokeWidth={2}
    />

    {/* ── Steel header band ── */}
    <rect
      x="5"
      y="5"
      width="38"
      height="10"
      rx="2"
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.35)' }}
      stroke="none"
    />
    <line x1="5" y1="15" x2="43" y2="15" strokeWidth={1.5} />
    {/* Header title placeholder */}
    <line x1="9" y1="10" x2="30" y2="10" strokeWidth={1} strokeOpacity={0.6} stroke="white" />
    {/* Project number badge in header */}
    <rect
      x="33"
      y="7"
      width="8"
      height="6"
      rx="1"
      style={{
        fill: 'var(--hi-concrete, currentColor)',
        fillOpacity: 'var(--hi-concrete-op, 0.8)',
      }}
      strokeWidth={0.75}
      strokeOpacity={0.5}
    />
    <line x1="34" y1="10" x2="40" y2="10" strokeWidth={0.75} strokeOpacity={0.5} />

    {/* ── Building thumbnail — left column of document body ── */}
    {/* Thumbnail border */}
    <rect
      x="8"
      y="18"
      width="14"
      height="18"
      rx="1"
      style={{
        fill: 'var(--hi-room, currentColor)',
        fillOpacity: 'var(--hi-room-op, 0.20)',
      }}
      strokeWidth={1.5}
    />
    {/* Building silhouette: walls */}
    <rect
      x="9"
      y="22"
      width="12"
      height="13"
      style={{
        fill: 'var(--hi-concrete, currentColor)',
        fillOpacity: 'var(--hi-concrete-op, 0.18)',
      }}
      strokeWidth={1}
      strokeOpacity={0.6}
    />
    {/* Roof peak */}
    <polygon
      points="9,22 15,19 21,22"
      style={{ fill: 'var(--hi-roof, currentColor)', fillOpacity: 'var(--hi-roof-op, 0.40)' }}
      strokeWidth={1}
      strokeOpacity={0.5}
    />
    {/* Window openings in thumbnail */}
    <rect
      x="10"
      y="24"
      width="3"
      height="3"
      style={{ fill: 'var(--hi-glass, currentColor)', fillOpacity: 'var(--hi-glass-op, 0.50)' }}
      strokeWidth={0.75}
      strokeOpacity={0.5}
    />
    <rect
      x="17"
      y="24"
      width="3"
      height="3"
      style={{ fill: 'var(--hi-glass, currentColor)', fillOpacity: 'var(--hi-glass-op, 0.50)' }}
      strokeWidth={0.75}
      strokeOpacity={0.5}
    />

    {/* ── Project metadata lines — right column ── */}
    {/* Row 1: project name */}
    <line x1="25" y1="20" x2="40" y2="20" strokeWidth={1} strokeOpacity={0.5} />
    <line x1="25" y1="23" x2="38" y2="23" strokeWidth={0.75} strokeOpacity={0.35} />
    {/* Row 2: client / address */}
    <line x1="25" y1="27" x2="40" y2="27" strokeWidth={0.75} strokeOpacity={0.4} />
    <line x1="25" y1="30" x2="36" y2="30" strokeWidth={0.75} strokeOpacity={0.35} />
    {/* Row 3: date / number */}
    <line x1="25" y1="34" x2="40" y2="34" strokeWidth={0.75} strokeOpacity={0.4} />
    <line x1="25" y1="37" x2="34" y2="37" strokeWidth={0.75} strokeOpacity={0.35} />

    {/* ── Bold professional border (inner frame line) ── */}
    <rect
      x="7"
      y="7"
      width="34"
      height="34"
      rx="1"
      strokeWidth={0.75}
      strokeOpacity={0.25}
      fill="none"
    />
  </>,
);

// ── ProjectParametersHifi — config panel with header, gear, and param rows ───────
export const ProjectParametersHifi = bimIconHifi(
  'ProjectParametersHifi',
  <>
    {/* ── Panel background ── */}
    <rect
      x="5"
      y="5"
      width="38"
      height="38"
      rx="2"
      style={{ fill: 'var(--hi-finish, currentColor)', fillOpacity: 'var(--hi-finish-op, 0.70)' }}
      strokeWidth={2}
    />

    {/* ── Steel header ── */}
    <rect
      x="5"
      y="5"
      width="38"
      height="10"
      rx="2"
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.35)' }}
      stroke="none"
    />
    <line x1="5" y1="15" x2="43" y2="15" strokeWidth={1.5} />
    {/* Header label placeholder */}
    <line x1="9" y1="10" x2="28" y2="10" strokeWidth={1} strokeOpacity={0.55} stroke="white" />

    {/* ── Gear icon in header (right side) ── */}
    <circle cx="37" cy="10" r="3.5" strokeWidth={1.5} fill="none" />
    <circle cx="37" cy="10" r="1.5" fill="currentColor" stroke="none" fillOpacity={0.6} />
    {/* Gear teeth stubs */}
    <line x1="37" y1="5.5" x2="37" y2="7" strokeWidth={1.5} />
    <line x1="37" y1="13" x2="37" y2="14.5" strokeWidth={1.5} />
    <line x1="32.5" y1="10" x2="34" y2="10" strokeWidth={1.5} />
    <line x1="40" y1="10" x2="41.5" y2="10" strokeWidth={1.5} />
    <line x1="33.8" y1="6.8" x2="34.9" y2="7.9" strokeWidth={1.2} />
    <line x1="39.1" y1="12.1" x2="40.2" y2="13.2" strokeWidth={1.2} />
    <line x1="40.2" y1="6.8" x2="39.1" y2="7.9" strokeWidth={1.2} />
    <line x1="34.9" y1="12.1" x2="33.8" y2="13.2" strokeWidth={1.2} />

    {/* ── Parameter row 1 ── */}
    <line x1="8" y1="21" x2="19" y2="21" strokeWidth={1} strokeOpacity={0.45} />
    <rect
      x="21"
      y="18"
      width="18"
      height="6"
      rx="1"
      style={{ fill: 'var(--hi-room, currentColor)', fillOpacity: 'var(--hi-room-op, 0.45)' }}
      strokeWidth={1}
      strokeOpacity={0.35}
    />
    <line x1="23" y1="21" x2="35" y2="21" strokeWidth={0.75} strokeOpacity={0.4} />

    {/* ── Parameter row 2 ── */}
    <line x1="8" y1="29" x2="19" y2="29" strokeWidth={1} strokeOpacity={0.45} />
    <rect
      x="21"
      y="26"
      width="18"
      height="6"
      rx="1"
      style={{ fill: 'var(--hi-room, currentColor)', fillOpacity: 'var(--hi-room-op, 0.45)' }}
      strokeWidth={1}
      strokeOpacity={0.35}
    />
    <line x1="23" y1="29" x2="37" y2="29" strokeWidth={0.75} strokeOpacity={0.4} />

    {/* ── Parameter row 3 ── */}
    <line x1="8" y1="37" x2="19" y2="37" strokeWidth={1} strokeOpacity={0.45} />
    <rect
      x="21"
      y="34"
      width="18"
      height="6"
      rx="1"
      style={{ fill: 'var(--hi-room, currentColor)', fillOpacity: 'var(--hi-room-op, 0.45)' }}
      strokeWidth={1}
      strokeOpacity={0.35}
    />
    <line x1="23" y1="37" x2="33" y2="37" strokeWidth={0.75} strokeOpacity={0.4} />

    {/* Row dividers */}
    <line x1="5" y1="24" x2="43" y2="24" strokeWidth={0.75} strokeOpacity={0.25} />
    <line x1="5" y1="32" x2="43" y2="32" strokeWidth={0.75} strokeOpacity={0.25} />
  </>,
);

// ── SharedParametersHifi — central param doc radiating to 3 project boxes ────────
export const SharedParametersHifi = bimIconHifi(
  'SharedParametersHifi',
  <>
    {/* ── Central shared parameter document — finish fill ── */}
    <rect
      x="16"
      y="15"
      width="16"
      height="18"
      rx="1.5"
      style={{ fill: 'var(--hi-finish, currentColor)', fillOpacity: 'var(--hi-finish-op, 0.85)' }}
      strokeWidth={2}
    />
    {/* Header band on central doc */}
    <rect
      x="16"
      y="15"
      width="16"
      height="5"
      rx="1.5"
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.40)' }}
      stroke="none"
    />
    <line x1="16" y1="20" x2="32" y2="20" strokeWidth={1} strokeOpacity={0.4} />
    {/* Shared param label lines */}
    <line x1="18" y1="23" x2="30" y2="23" strokeWidth={0.75} strokeOpacity={0.5} />
    <line x1="18" y1="26" x2="28" y2="26" strokeWidth={0.75} strokeOpacity={0.4} />
    <line x1="18" y1="29" x2="30" y2="29" strokeWidth={0.75} strokeOpacity={0.4} />

    {/* ── Project A box — concrete fill (top) ── */}
    <rect
      x="17"
      y="4"
      width="14"
      height="9"
      rx="1"
      style={{
        fill: 'var(--hi-concrete, currentColor)',
        fillOpacity: 'var(--hi-concrete-op, 0.18)',
      }}
      strokeWidth={1.5}
    />
    <line x1="19" y1="8.5" x2="29" y2="8.5" strokeWidth={0.75} strokeOpacity={0.4} />
    {/* Radiation line A → center */}
    <line x1="24" y1="13" x2="24" y2="15" strokeWidth={1.5} strokeOpacity={0.7} />
    {/* Arrowhead pointing into center */}
    <polyline points="22,14.5 24,15 26,14.5" strokeWidth={1} fill="none" strokeOpacity={0.7} />

    {/* ── Project B box — steel fill (bottom-left) ── */}
    <rect
      x="4"
      y="36"
      width="14"
      height="9"
      rx="1"
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.18)' }}
      strokeWidth={1.5}
    />
    <line x1="6" y1="40.5" x2="16" y2="40.5" strokeWidth={0.75} strokeOpacity={0.4} />
    {/* Radiation line B → center */}
    <line x1="16" y1="36" x2="20" y2="33" strokeWidth={1.5} strokeOpacity={0.7} />
    <polyline points="17.5,34 20,33 19,36" strokeWidth={1} fill="none" strokeOpacity={0.7} />

    {/* ── Project C box — room fill (bottom-right) ── */}
    <rect
      x="30"
      y="36"
      width="14"
      height="9"
      rx="1"
      style={{ fill: 'var(--hi-room, currentColor)', fillOpacity: 'var(--hi-room-op, 0.45)' }}
      strokeWidth={1.5}
    />
    <line x1="32" y1="40.5" x2="42" y2="40.5" strokeWidth={0.75} strokeOpacity={0.4} />
    {/* Radiation line C → center */}
    <line x1="32" y1="36" x2="28" y2="33" strokeWidth={1.5} strokeOpacity={0.7} />
    <polyline points="30.5,34 28,33 29,36" strokeWidth={1} fill="none" strokeOpacity={0.7} />

    {/* ── "Shared" icon — small infinity/link symbol on central doc ── */}
    <path d="M 20,17.5 A 1.5,1.5 0 1 0 20,17.4" strokeWidth={1} strokeOpacity={0.5} fill="none" />
    <path d="M 28,17.5 A 1.5,1.5 0 1 0 28,17.4" strokeWidth={1} strokeOpacity={0.5} fill="none" />
    <line x1="21.5" y1="17.5" x2="26.5" y2="17.5" strokeWidth={0.75} strokeOpacity={0.4} />
  </>,
);

// ── ObjectStylesHifi — style panel: 4 category bars with weights and swatches ───
export const ObjectStylesHifi = bimIconHifi(
  'ObjectStylesHifi',
  <>
    {/* ── Panel background ── */}
    <rect
      x="5"
      y="5"
      width="38"
      height="38"
      rx="2"
      style={{ fill: 'var(--hi-finish, currentColor)', fillOpacity: 'var(--hi-finish-op, 0.60)' }}
      strokeWidth={2}
    />

    {/* ── Steel header bar ── */}
    <rect
      x="5"
      y="5"
      width="38"
      height="7"
      rx="2"
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.35)' }}
      stroke="none"
    />
    <line x1="5" y1="12" x2="43" y2="12" strokeWidth={1.5} />
    {/* Header label */}
    <line x1="8" y1="8.5" x2="32" y2="8.5" strokeWidth={0.75} strokeOpacity={0.55} stroke="white" />

    {/* ── Column divider: line-weight zone | name zone | swatch ── */}
    <line x1="19" y1="12" x2="19" y2="43" strokeWidth={0.75} strokeOpacity={0.3} />
    <line x1="37" y1="12" x2="37" y2="43" strokeWidth={0.75} strokeOpacity={0.3} />

    {/* ── Row 1: bold line (concrete) ── */}
    <line x1="8" y1="20" x2="17" y2="20" strokeWidth={2.5} strokeOpacity={0.75} />
    <line x1="21" y1="20" x2="35" y2="20" strokeWidth={0.75} strokeOpacity={0.4} />
    <rect
      x="38"
      y="16"
      width="5"
      height="7"
      rx="0.5"
      style={{
        fill: 'var(--hi-concrete, currentColor)',
        fillOpacity: 'var(--hi-concrete-op, 0.75)',
      }}
      strokeWidth={0.75}
      strokeOpacity={0.5}
    />
    <line x1="5" y1="24" x2="43" y2="24" strokeWidth={0.75} strokeOpacity={0.25} />

    {/* ── Row 2: medium line (steel) ── */}
    <line x1="8" y1="30" x2="17" y2="30" strokeWidth={1.5} strokeOpacity={0.65} />
    <line x1="21" y1="30" x2="35" y2="30" strokeWidth={0.75} strokeOpacity={0.4} />
    <rect
      x="38"
      y="26"
      width="5"
      height="7"
      rx="0.5"
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.75)' }}
      strokeWidth={0.75}
      strokeOpacity={0.5}
    />
    <line x1="5" y1="34" x2="43" y2="34" strokeWidth={0.75} strokeOpacity={0.25} />

    {/* ── Row 3: thin line (finish) ── */}
    <line x1="8" y1="38" x2="17" y2="38" strokeWidth={0.75} strokeOpacity={0.6} />
    <line x1="21" y1="38" x2="35" y2="38" strokeWidth={0.75} strokeOpacity={0.4} />
    <rect
      x="38"
      y="34.5"
      width="5"
      height="7"
      rx="0.5"
      style={{ fill: 'var(--hi-finish, currentColor)', fillOpacity: 'var(--hi-finish-op, 0.9)' }}
      strokeWidth={0.75}
      strokeOpacity={0.5}
    />

    {/* ── Row 4 hint: pattern fill zone (room) — partially visible at bottom ── */}
    <rect
      x="5"
      y="40"
      width="14"
      height="3"
      style={{
        fill: 'var(--hi-room, currentColor)',
        fillOpacity: 'var(--hi-room-op, 0.40)',
      }}
      stroke="none"
    />
    {/* Hatch pattern in room zone */}
    <line x1="6" y1="43" x2="9" y2="40" strokeWidth={0.75} strokeOpacity={0.4} />
    <line x1="9" y1="43" x2="12" y2="40" strokeWidth={0.75} strokeOpacity={0.4} />
    <line x1="12" y1="43" x2="15" y2="40" strokeWidth={0.75} strokeOpacity={0.4} />
    <line x1="15" y1="43" x2="18" y2="40" strokeWidth={0.75} strokeOpacity={0.4} />
  </>,
);
