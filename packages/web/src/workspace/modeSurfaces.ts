/**
 * Mode-specific surface state — spec §20.
 *
 * Pure-state controllers per workspace mode. Each surface lives in its
 * own section so the corresponding `ModeAdapter` (WP-UI-D03) can
 * capture/restore via these helpers.
 *
 * Currently exposes: WP-UI-E04 Section / Elevation, WP-UI-E01 Sheet.
 * Schedule / Agent surfaces follow in subsequent commits.
 */

/* ────────────────────────────────────────────────────────────────────── */
/* E04 — Section / Elevation mode (§20.4)                                  */
/* ────────────────────────────────────────────────────────────────────── */

export interface SectionElevationViewState {
  /** Active section cut id; null when the user is drawing a new line. */
  activeSectionId: string | null;
  /** Far-clip distance in mm from the section line. */
  farClipMm: number;
  /** Optional view-template id (inherited from `seed-vt-arch-1to100` etc). */
  viewTemplateId: string | null;
  /** Plan canvas plot scale anchored beside the section preview. */
  planScale: number;
  /** Section-preview plot scale. */
  sectionScale: number;
}

export const SECTION_ELEVATION_DEFAULTS: SectionElevationViewState = {
  activeSectionId: null,
  farClipMm: 9000,
  viewTemplateId: null,
  planScale: 100,
  sectionScale: 50,
};

export function withActiveSection(
  state: SectionElevationViewState,
  sectionId: string,
): SectionElevationViewState {
  return { ...state, activeSectionId: sectionId };
}

export function withFarClip(
  state: SectionElevationViewState,
  farClipMm: number,
): SectionElevationViewState {
  return { ...state, farClipMm: Math.max(0, farClipMm) };
}

export function withViewTemplate(
  state: SectionElevationViewState,
  viewTemplateId: string | null,
): SectionElevationViewState {
  return { ...state, viewTemplateId };
}

/* ────────────────────────────────────────────────────────────────────── */
/* E01 — Sheet mode (§20.5)                                                 */
/* ────────────────────────────────────────────────────────────────────── */

export interface SheetViewport {
  id: string;
  label: string;
  viewRef: string;
  xMm: number;
  yMm: number;
  widthMm: number;
  heightMm: number;
}

export interface SheetSurfaceState {
  /** Active sheet id; null when no sheet is open. */
  activeSheetId: string | null;
  /** Selected viewport on the active sheet. */
  selectedViewportId: string | null;
  /** Snap-to-edge tolerance in mm for viewport drag. */
  snapToleranceMm: number;
}

export const SHEET_DEFAULTS: SheetSurfaceState = {
  activeSheetId: null,
  selectedViewportId: null,
  snapToleranceMm: 50,
};

/** Move a viewport on the sheet by (dx, dy) mm; snaps to a 50 mm gauge
 * when within `snapToleranceMm` of an integer multiple. */
export function moveViewport(
  vp: SheetViewport,
  dxMm: number,
  dyMm: number,
  snapToleranceMm = SHEET_DEFAULTS.snapToleranceMm,
): SheetViewport {
  const gauge = 50;
  const snap = (value: number): number => {
    const remainder = value % gauge;
    if (Math.abs(remainder) <= snapToleranceMm) return value - remainder;
    if (Math.abs(remainder - gauge) <= snapToleranceMm) return value + (gauge - remainder);
    return value;
  };
  return { ...vp, xMm: snap(vp.xMm + dxMm), yMm: snap(vp.yMm + dyMm) };
}

/** Resize a viewport by adjusting its NE corner by (dw, dh) mm. */
export function resizeViewport(
  vp: SheetViewport,
  dWidthMm: number,
  dHeightMm: number,
  minMm = 200,
): SheetViewport {
  return {
    ...vp,
    widthMm: Math.max(minMm, vp.widthMm + dWidthMm),
    heightMm: Math.max(minMm, vp.heightMm + dHeightMm),
  };
}
