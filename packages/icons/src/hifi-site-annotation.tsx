/**
 * High-fidelity 48×48 BIM site and annotation icons.
 *
 * CSS custom properties (set on a wrapper element):
 *   --hi-concrete / --hi-concrete-op  — structural, terrain (stone gray)
 *   --hi-finish   / --hi-finish-op    — paper, annotation fill (warm off-white)
 *   --hi-glass    / --hi-glass-op     — water, transparent zones (sky blue)
 *   --hi-steel    / --hi-steel-op     — metal markers, frames (blue-gray)
 *   --hi-leaf                          — vegetation, grass (amber-brown), no opacity var
 *   --hi-room     / --hi-room-op      — site areas, zones (pale yellow)
 *   --hi-roof     / --hi-roof-op      — boundaries, alerts (terracotta red)
 *
 * Without variables the icons render in monochrome currentColor.
 *
 * Stroke hierarchy:
 *   strokeWidth 2    — primary outlines
 *   strokeWidth 1.5  — secondary edges, reveals
 *   strokeWidth 0.75 — detail, text, annotation lines
 */
import { bimIconHifi } from './icon';

// ── TopoHifi ──
export const TopoHifi = bimIconHifi(
  'TopoHifi',
  <>
    {/* Outer contour zone — low ground / water tint */}
    <ellipse
      cx="24"
      cy="26"
      rx="19"
      ry="16"
      style={{ fill: 'var(--hi-glass, currentColor)', fillOpacity: 'var(--hi-glass-op, 0.10)' }}
    />

    {/* Middle contour zone — mid elevation, room/site fill */}
    <ellipse
      cx="23"
      cy="25"
      rx="13"
      ry="10"
      style={{ fill: 'var(--hi-room, currentColor)', fillOpacity: 'var(--hi-room-op, 0.18)' }}
    />

    {/* Inner contour zone — hilltop, concrete fill */}
    <ellipse
      cx="22"
      cy="22"
      rx="7"
      ry="5"
      style={{
        fill: 'var(--hi-concrete, currentColor)',
        fillOpacity: 'var(--hi-concrete-op, 0.22)',
      }}
    />

    {/* Contour line 1 — outermost */}
    <ellipse cx="24" cy="26" rx="19" ry="16" strokeWidth={1} />

    {/* Contour line 2 */}
    <ellipse cx="23.5" cy="25.5" rx="15.5" ry="12.5" strokeWidth={1} />

    {/* Contour line 3 — middle */}
    <ellipse cx="23" cy="25" rx="13" ry="10" strokeWidth={1} />

    {/* Contour line 4 */}
    <ellipse cx="22.5" cy="23.5" rx="10" ry="7.5" strokeWidth={1} />

    {/* Contour line 5 — near summit */}
    <ellipse cx="22" cy="22" rx="7" ry="5" strokeWidth={1} />

    {/* Summit contour line 6 — innermost */}
    <ellipse cx="21.5" cy="21" rx="3.5" ry="2.5" strokeWidth={1} />

    {/* Elevation tick marks on contours — short dashes suggesting text */}
    <g strokeWidth={0.75} strokeOpacity={0.45}>
      {/* Tick on outer contour, right side */}
      <line x1="43" y1="26" x2="46" y2="26" />
      {/* Short placeholder line beside tick */}
      <line x1="43" y1="28" x2="46" y2="28" />

      {/* Tick on middle contour, right side */}
      <line x1="36" y1="25" x2="39" y2="25" />
      <line x1="36" y1="27" x2="38.5" y2="27" />

      {/* Tick on inner contour, right side */}
      <line x1="29" y1="22" x2="32" y2="22" />
      <line x1="29" y1="24" x2="31.5" y2="24" />
    </g>
  </>,
);

// ── PropertyLineHifi ──
export const PropertyLineHifi = bimIconHifi(
  'PropertyLineHifi',
  <>
    {/* Parcel interior fill */}
    <polygon
      points="6,38 10,8 34,5 44,16 40,42"
      style={{ fill: 'var(--hi-room, currentColor)', fillOpacity: 'var(--hi-room-op, 0.20)' }}
    />

    {/* Parcel boundary — bold primary outline */}
    <polygon points="6,38 10,8 34,5 44,16 40,42" strokeWidth={2} fill="none" />

    {/* Corner survey marker — top-left (L-shaped) */}
    <g strokeWidth={1.5} style={{ stroke: 'var(--hi-steel, currentColor)' }}>
      <line x1="10" y1="8" x2="10" y2="3" />
      <line x1="10" y1="3" x2="15" y2="3" />
    </g>
    <circle
      cx="10"
      cy="8"
      r="1.5"
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.8)' }}
      stroke="none"
    />

    {/* Corner survey marker — top-right (T-shaped stake) */}
    <g strokeWidth={1.5} style={{ stroke: 'var(--hi-steel, currentColor)' }}>
      <line x1="34" y1="5" x2="34" y2="0" />
      <line x1="31" y1="0" x2="37" y2="0" />
    </g>
    <circle
      cx="34"
      cy="5"
      r="1.5"
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.8)' }}
      stroke="none"
    />

    {/* Bearing annotation along bottom-left boundary edge */}
    {/* Perpendicular tick on the edge midpoint */}
    <line x1="20" y1="26" x2="17" y2="21" strokeWidth={0.75} strokeOpacity={0.6} />
    {/* Placeholder angle text lines */}
    <line x1="14" y1="18" x2="22" y2="18" strokeWidth={0.75} strokeOpacity={0.45} />
    <line x1="14" y1="20" x2="20" y2="20" strokeWidth={0.75} strokeOpacity={0.45} />

    {/* Pin/stake marker at bottom-left corner */}
    <circle cx="6" cy="38" r="2" strokeWidth={1.5} fill="none" />
    <line x1="6" y1="40" x2="6" y2="44" strokeWidth={1.5} />
    <line x1="4" y1="44" x2="8" y2="44" strokeWidth={1.5} />
  </>,
);

// ── NorthArrowHifi ──
export const NorthArrowHifi = bimIconHifi(
  'NorthArrowHifi',
  <>
    {/* Outer compass ring */}
    <circle cx="24" cy="26" r="18" strokeWidth={1} strokeOpacity={0.4} fill="none" />

    {/* Ring fill — very subtle */}
    <circle
      cx="24"
      cy="26"
      r="18"
      style={{ fill: 'var(--hi-finish, currentColor)', fillOpacity: 'var(--hi-finish-op, 0.05)' }}
      stroke="none"
    />

    {/* North arrow — south half (back) fill: finish/white */}
    <polygon
      points="24,8 20,30 24,27 28,30"
      style={{ fill: 'var(--hi-finish, currentColor)', fillOpacity: 'var(--hi-finish-op, 0.85)' }}
      strokeWidth={1.5}
    />

    {/* North arrow — north half (front) fill: steel/dark */}
    <polygon
      points="24,8 20,30 24,27"
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.85)' }}
      strokeWidth={1.5}
    />

    {/* Arrow full outline */}
    <polygon points="24,8 20,30 24,27 28,30" strokeWidth={1.5} fill="none" />

    {/* "N" text placeholder — two short lines forming N near the tip */}
    <g strokeWidth={0.75} strokeOpacity={0.7}>
      <line x1="21" y1="5" x2="21" y2="2" />
      <line x1="21" y1="2" x2="23" y2="5" />
      <line x1="23" y1="5" x2="23" y2="2" />
    </g>

    {/* Cardinal tick marks at E, S, W */}
    {/* East */}
    <line x1="42" y1="26" x2="44" y2="26" strokeWidth={1} strokeOpacity={0.5} />
    {/* West */}
    <line x1="6" y1="26" x2="4" y2="26" strokeWidth={1} strokeOpacity={0.5} />
    {/* South */}
    <line x1="24" y1="44" x2="24" y2="46" strokeWidth={1} strokeOpacity={0.5} />

    {/* Small ring at arrow base center */}
    <circle cx="24" cy="27" r="2" strokeWidth={1} fill="none" />
  </>,
);

// ── RevisionCloudHifi ──
export const RevisionCloudHifi = bimIconHifi(
  'RevisionCloudHifi',
  <>
    {/* Cloud interior fill */}
    <rect
      x="6"
      y="8"
      width="36"
      height="30"
      rx="1"
      style={{ fill: 'var(--hi-finish, currentColor)', fillOpacity: 'var(--hi-finish-op, 0.12)' }}
      stroke="none"
    />

    {/* Revision cloud bumps — closed path of arc segments approximated with polyline */}
    {/* Top edge bumps (left to right) */}
    <path
      d="
        M 6 22
        A 4 4 0 0 1 14 22
        A 4 4 0 0 1 22 22
        A 4 4 0 0 1 30 22
        A 4 4 0 0 1 38 22
        A 4 4 0 0 0 38 10
        A 4 4 0 0 0 30 10
        A 4 4 0 0 0 22 10
        A 4 4 0 0 0 14 10
        A 4 4 0 0 0 6 10
        A 4 4 0 0 1 6 18
        Z
      "
      strokeWidth={1.5}
      fill="none"
    />

    {/* Bottom cloud edge bumps */}
    <path
      d="
        M 6 22
        A 4 4 0 0 0 14 22
        A 4 4 0 0 0 22 22
        A 4 4 0 0 0 30 22
        A 4 4 0 0 0 38 22
        A 4 4 0 0 1 38 30
        A 4 4 0 0 1 30 30
        A 4 4 0 0 1 22 30
        A 4 4 0 0 1 14 30
        A 4 4 0 0 1 6 30
        A 4 4 0 0 0 6 22
        Z
      "
      strokeWidth={1.5}
      fill="none"
    />

    {/* Revision delta / triangle symbol at bottom-right inside cloud */}
    <polygon
      points="36,36 32,43 40,43"
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.20)' }}
      strokeWidth={1.5}
    />

    {/* Revision number placeholder lines inside triangle */}
    <line x1="34" y1="40" x2="38" y2="40" strokeWidth={0.75} strokeOpacity={0.5} />

    {/* Revision text placeholder lines inside cloud */}
    <g strokeWidth={0.75} strokeOpacity={0.4}>
      <line x1="10" y1="15" x2="24" y2="15" />
      <line x1="10" y1="18" x2="22" y2="18" />
      <line x1="10" y1="26" x2="26" y2="26" />
    </g>
  </>,
);

// ── ScaleBarHifi ──
export const ScaleBarHifi = bimIconHifi(
  'ScaleBarHifi',
  <>
    {/* Full bar outline */}
    <rect x="4" y="18" width="40" height="8" strokeWidth={2} fill="none" />

    {/* Segment 1 — filled (steel) */}
    <rect
      x="4"
      y="18"
      width="8"
      height="8"
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.55)' }}
      stroke="none"
    />

    {/* Segment 2 — unfilled (finish) */}
    <rect
      x="12"
      y="18"
      width="8"
      height="8"
      style={{ fill: 'var(--hi-finish, currentColor)', fillOpacity: 'var(--hi-finish-op, 0.80)' }}
      stroke="none"
    />

    {/* Segment 3 — filled (steel) */}
    <rect
      x="20"
      y="18"
      width="8"
      height="8"
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.55)' }}
      stroke="none"
    />

    {/* Segment 4 — unfilled (finish) */}
    <rect
      x="28"
      y="18"
      width="8"
      height="8"
      style={{ fill: 'var(--hi-finish, currentColor)', fillOpacity: 'var(--hi-finish-op, 0.80)' }}
      stroke="none"
    />

    {/* Segment 5 — filled (steel) */}
    <rect
      x="36"
      y="18"
      width="8"
      height="8"
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.55)' }}
      stroke="none"
    />

    {/* Internal division lines */}
    <g strokeWidth={1}>
      <line x1="12" y1="18" x2="12" y2="26" />
      <line x1="20" y1="18" x2="20" y2="26" />
      <line x1="28" y1="18" x2="28" y2="26" />
      <line x1="36" y1="18" x2="36" y2="26" />
    </g>

    {/* Vertical tick marks above each division */}
    <g strokeWidth={1} strokeOpacity={0.7}>
      <line x1="4" y1="15" x2="4" y2="18" />
      <line x1="12" y1="15" x2="12" y2="18" />
      <line x1="20" y1="15" x2="20" y2="18" />
      <line x1="28" y1="15" x2="28" y2="18" />
      <line x1="36" y1="15" x2="36" y2="18" />
      <line x1="44" y1="15" x2="44" y2="18" />
    </g>

    {/* Text placeholder lines below each division — measurement labels */}
    <g strokeWidth={0.75} strokeOpacity={0.4}>
      {/* "0" at left */}
      <line x1="2" y1="29" x2="6" y2="29" />
      {/* "1m" */}
      <line x1="10" y1="29" x2="15" y2="29" />
      {/* "2m" */}
      <line x1="18" y1="29" x2="23" y2="29" />
      {/* "3m" */}
      <line x1="26" y1="29" x2="31" y2="29" />
      {/* "4m" */}
      <line x1="34" y1="29" x2="39" y2="29" />
      {/* "5m" at right — slightly longer for "5m" label */}
      <line x1="41" y1="29" x2="47" y2="29" />
    </g>
  </>,
);

// ── AreaLabelHifi ──
export const AreaLabelHifi = bimIconHifi(
  'AreaLabelHifi',
  <>
    {/* Badge / tag body fill */}
    <rect
      x="6"
      y="8"
      width="32"
      height="22"
      rx="3"
      ry="3"
      style={{ fill: 'var(--hi-finish, currentColor)', fillOpacity: 'var(--hi-finish-op, 0.90)' }}
    />

    {/* Badge outline — bold */}
    <rect x="6" y="8" width="32" height="22" rx="3" ry="3" strokeWidth={2} fill="none" />

    {/* Room name text placeholder — large line */}
    <line x1="11" y1="15" x2="33" y2="15" strokeWidth={1.5} strokeOpacity={0.5} />

    {/* Area value text placeholder — smaller line (e.g. "24.5 m²") */}
    <line x1="11" y1="20" x2="30" y2="20" strokeWidth={1} strokeOpacity={0.4} />
    <line x1="11" y1="23" x2="26" y2="23" strokeWidth={0.75} strokeOpacity={0.35} />

    {/* Leader line from tag to space interior */}
    <line x1="22" y1="30" x2="22" y2="38" strokeWidth={1.5} />
    <circle cx="22" cy="39" r="1.5" fill="currentColor" stroke="none" />

    {/* Dashed boundary lines suggesting the measured space */}
    <g strokeWidth={0.75} strokeDasharray="3 2" strokeOpacity={0.4}>
      {/* Left boundary */}
      <line x1="6" y1="30" x2="6" y2="44" />
      {/* Right boundary */}
      <line x1="38" y1="30" x2="38" y2="44" />
      {/* Bottom boundary */}
      <line x1="6" y1="44" x2="38" y2="44" />
    </g>
  </>,
);

// ── KeynoteHifi ──
export const KeynoteHifi = bimIconHifi(
  'KeynoteHifi',
  <>
    {/* Balloon fill */}
    <circle
      cx="20"
      cy="18"
      r="13"
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.12)' }}
    />

    {/* Balloon outline — bold */}
    <circle cx="20" cy="18" r="13" strokeWidth={2} fill="none" />

    {/* Number placeholder — three horizontal bars inside balloon */}
    <g strokeWidth={1.5} strokeOpacity={0.55}>
      <line x1="13" y1="14" x2="27" y2="14" />
      <line x1="13" y1="18" x2="27" y2="18" />
      <line x1="13" y1="22" x2="23" y2="22" />
    </g>

    {/* Leader line — diagonal from balloon edge to target */}
    <line x1="30" y1="28" x2="42" y2="42" strokeWidth={1.5} />

    {/* Small filled circle at leader target point */}
    <circle cx="42" cy="42" r="2.5" fill="currentColor" stroke="none" />
  </>,
);

// ── SpotElevationHifi ──
export const SpotElevationHifi = bimIconHifi(
  'SpotElevationHifi',
  <>
    {/* Datum marker — upward-pointing filled triangle */}
    <polygon
      points="24,8 18,20 30,20"
      style={{ fill: 'var(--hi-steel, currentColor)', fillOpacity: 'var(--hi-steel-op, 0.70)' }}
      strokeWidth={2}
    />

    {/* Ground / floor line — horizontal baseline at triangle base */}
    <line x1="6" y1="20" x2="42" y2="20" strokeWidth={2} />

    {/* Small circle at triangle tip / datum intersection */}
    <circle cx="24" cy="8" r="2" strokeWidth={1.5} fill="none" />

    {/* Horizontal datum line extending left from triangle tip */}
    <line x1="4" y1="8" x2="22" y2="8" strokeWidth={1.5} />

    {/* Elevation value text placeholder lines above datum line */}
    <g strokeWidth={0.75} strokeOpacity={0.5}>
      {/* "+3.200" placeholder */}
      <line x1="4" y1="4" x2="20" y2="4" />
      <line x1="4" y1="6" x2="18" y2="6" />
    </g>

    {/* Secondary annotation lines below floor — e.g. floor finish level indicator */}
    <g strokeWidth={0.75} strokeOpacity={0.35}>
      <line x1="6" y1="24" x2="42" y2="24" />
      <line x1="14" y1="20" x2="14" y2="24" />
      <line x1="34" y1="20" x2="34" y2="24" />
    </g>
  </>,
);
