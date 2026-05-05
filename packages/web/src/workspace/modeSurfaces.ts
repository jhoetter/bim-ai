/**
 * Mode-specific surface state — spec §20.
 *
 * Pure-state controllers per workspace mode. Each surface lives in its
 * own section so the corresponding `ModeAdapter` (WP-UI-D03) can
 * capture/restore via these helpers.
 *
 * Currently exposes: WP-UI-E04 Section / Elevation. Sheet / Schedule /
 * Agent surfaces follow in subsequent commits.
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
