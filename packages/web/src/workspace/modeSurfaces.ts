/**
 * Mode-specific surface state — spec §20.
 *
 * Pure-state controllers per workspace mode. Each surface lives in its
 * own section so the corresponding `ModeAdapter` (WP-UI-D03) can
 * capture/restore via these helpers.
 *
 * Exposes: WP-UI-E04 Section / Elevation, WP-UI-E01 Sheet,
 * WP-UI-E02 Schedule, WP-UI-E03 Agent Review.
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

/* ────────────────────────────────────────────────────────────────────── */
/* E02 — Schedule mode (§20.6)                                              */
/* ────────────────────────────────────────────────────────────────────── */

export interface ScheduleColumn {
  key: string;
  label: string;
  visible: boolean;
}

export interface ScheduleSort {
  columnKey: string;
  descending: boolean;
}

export interface ScheduleSurfaceState {
  /** Active schedule id (one of the 5 spec'd schedules in the seed house). */
  activeScheduleId: string | null;
  /** Editing cell coordinates (rowId × columnKey) — null when idle. */
  editingCell: { rowId: string; columnKey: string } | null;
  /** Column visibility / order — left rail toggles. */
  columns: ScheduleColumn[];
  /** Active sort. Null when sort is unspecified. */
  sort: ScheduleSort | null;
  /** Filter expression in the right-rail inspector. */
  filterExpression: string;
}

export const SCHEDULE_DEFAULTS: ScheduleSurfaceState = {
  activeScheduleId: null,
  editingCell: null,
  columns: [],
  sort: null,
  filterExpression: '',
};

/** Begin editing a cell. Calling with `null` exits edit mode. */
export function beginCellEdit(
  state: ScheduleSurfaceState,
  cell: { rowId: string; columnKey: string } | null,
): ScheduleSurfaceState {
  return { ...state, editingCell: cell };
}

/** Toggle a column's visibility. */
export function toggleColumnVisibility(
  state: ScheduleSurfaceState,
  columnKey: string,
): ScheduleSurfaceState {
  return {
    ...state,
    columns: state.columns.map((c) => (c.key === columnKey ? { ...c, visible: !c.visible } : c)),
  };
}

/** Cycle sort direction on a column: none → asc → desc → none. */
export function cycleSort(state: ScheduleSurfaceState, columnKey: string): ScheduleSurfaceState {
  if (!state.sort || state.sort.columnKey !== columnKey) {
    return { ...state, sort: { columnKey, descending: false } };
  }
  if (!state.sort.descending) {
    return { ...state, sort: { columnKey, descending: true } };
  }
  return { ...state, sort: null };
}

export function setFilter(state: ScheduleSurfaceState, expression: string): ScheduleSurfaceState {
  return { ...state, filterExpression: expression };
}

/* ────────────────────────────────────────────────────────────────────── */
/* E03 — Agent Review (§20.7)                                               */
/* ────────────────────────────────────────────────────────────────────── */

export type AgentReviewSeverity = 'info' | 'warning' | 'blocking';

export interface AgentReviewAction {
  id: string;
  label: string;
  severity: AgentReviewSeverity;
  /** Optional payload reference into the manifest tree. */
  manifestPath?: string;
}

export interface AgentReviewSurfaceState {
  /** Selected manifest leaf id (matches `seed-` evidence ids etc). */
  selectedManifestId: string | null;
  /** Pending action queue ordered by severity (blocking first). */
  actionQueue: AgentReviewAction[];
  /** Filter expression on the action queue. */
  actionFilter: AgentReviewSeverity | null;
}

export const AGENT_REVIEW_DEFAULTS: AgentReviewSurfaceState = {
  selectedManifestId: null,
  actionQueue: [],
  actionFilter: null,
};

const SEVERITY_RANK: Record<AgentReviewSeverity, number> = {
  blocking: 0,
  warning: 1,
  info: 2,
};

/** Sort actions so blocking ones float to the top of the queue. */
export function sortAgentActions(actions: AgentReviewAction[]): AgentReviewAction[] {
  return [...actions].sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]);
}

/** Apply the active severity filter, returning a fresh action list. */
export function visibleAgentActions(state: AgentReviewSurfaceState): AgentReviewAction[] {
  const sorted = sortAgentActions(state.actionQueue);
  if (!state.actionFilter) return sorted;
  return sorted.filter((a) => a.severity === state.actionFilter);
}

export function withSelectedManifest(
  state: AgentReviewSurfaceState,
  id: string | null,
): AgentReviewSurfaceState {
  return { ...state, selectedManifestId: id };
}

export function withActionFilter(
  state: AgentReviewSurfaceState,
  severity: AgentReviewSeverity | null,
): AgentReviewSurfaceState {
  return { ...state, actionFilter: severity };
}
