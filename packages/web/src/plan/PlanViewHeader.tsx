import { useState, type JSX } from 'react';

import type { Element, PhaseFilter } from '@bim-ai/core';

import { useBimStore } from '../state/store';
import { PhaseDropdown } from './PhaseDropdown';
import type { PlanDetailLevel } from './planDetailLevelLines';
import { PlanDetailLevelToolbar } from './PlanDetailLevelToolbar';
import { ColorSchemeDialog } from './ColorSchemeDialog';
import type { ColorSchemeRoomEntry } from './ColorSchemeDialog';
import { resolveViewRange } from './planProjection';
import { ViewRangeDialog } from './ViewRangeDialog';
import type { ViewRangeValues } from './ViewRangeDialog';

export type PlanViewHeaderProps = {
  phaseFilter: PhaseFilter;
  onPhaseFilterChange: (value: PhaseFilter) => void;
  detailLevel: PlanDetailLevel;
  onDetailLevelChange: (value: PlanDetailLevel) => void;
  /** Active plan view ID — used to read current view range values. */
  activePlanViewId?: string | null;
  /** All elements, for reading plan_view fields. */
  elementsById?: Record<string, Element>;
  /** Callback to persist view range changes for the active plan view. */
  onViewRangeApply?: (planViewId: string, values: ViewRangeValues) => void;
  /** D7 - ceiling/reflected ceiling plan badge. */
  viewSubtype?: string;
  /** When true, shows the Color Scheme button (only for plan views with rooms). */
  hasRooms?: boolean;
  /** Current color scheme applied to this view (if any). */
  currentColorScheme?: { category: string; colorMap: Record<string, string> };
  /** Rooms available for building the color scheme table. */
  rooms?: ColorSchemeRoomEntry[];
  /** Called when the user applies a color scheme in the dialog. */
  onColorSchemeApply?: (payload: {
    viewId: string;
    schemeCategory: string;
    colorMap: Record<string, string>;
  }) => void;
  /** F6: angle from project north to true north. When provided, shows the True North toggle. */
  projectNorthAngleDeg?: number;
  /** F6: whether the canvas is currently rotated to true north. */
  trueNorthActive?: boolean;
  /** F6: called when the user toggles the True North mode. */
  onTrueNorthToggle?: (active: boolean) => void;
  /** F2: current phase filter display mode. */
  phaseFilterMode?: 'new_construction' | 'demolition' | 'existing' | 'as_built' | null;
  /** F2: called when user selects a phase filter mode. */
  onPhaseFilterModeChange?: (
    mode: 'new_construction' | 'demolition' | 'existing' | 'as_built' | null,
  ) => void;
  /** §6.4.1: canvas width in px — used to compute callout scale indicator. */
  canvasWidthPx?: number;
  /** §13.1.3: whether the color fill legend panel is visible. */
  legendVisible?: boolean;
  /** §13.1.3: called when the user clicks the Legend toggle button. */
  onLegendToggle?: () => void;
  /** §1.6.10: whether thin lines mode is currently active. */
  thinLinesEnabled?: boolean;
  /** §1.6.10: called when the user clicks the Thin Lines toggle button. */
  onThinLinesToggle?: () => void;
  /** §7.3.1: name of the active work plane for the current plan view. */
  activeWorkPlaneName?: string | null;
  /** §7.3.1: called when the user clicks the × to clear the active work plane. */
  onClearWorkPlane?: () => void;
  /** §1.6.10: called when the user clicks the per-view VG button. */
  onPerViewVGOpen?: () => void;
  /** §5.4.2: per-view rotation in degrees (from true north rotation). When non-zero, shows indicator. */
  planViewAngleDeg?: number;
  /** §1.6.10: crop region rect — when set, shows the crop region toggle button. */
  cropRegionMm?: { xMm: number; yMm: number; widthMm: number; heightMm: number } | null;
  /** §1.6.10: whether the crop region is currently enabled. */
  cropRegionEnabled?: boolean;
  /** §1.6.10: called when the user clicks the crop region toggle button. */
  onCropRegionToggle?: () => void;
  /** §2.9.4: whether the plan underlay ghost is currently visible. */
  showUnderlay?: boolean;
  /** §2.9.4: called when the user clicks the UL toggle button. */
  onUnderlayToggle?: () => void;
  /** §2.9.4: the currently selected underlay level ID. */
  underlayLevelId?: string | null;
  /** §2.9.4: list of level elements to populate the underlay level selector. */
  underlayLevels?: Array<{ id: string; name?: string }>;
  /** §2.9.4: called when the user selects a different underlay level. */
  onUnderlayLevelChange?: (levelId: string | null) => void;
};

const PHASE_FILTER_MODE_LABELS: Record<string, string> = {
  new_construction: 'New Construction',
  demolition: 'Demolition Plan',
  existing: 'Existing Only',
  as_built: 'As-Built',
};

export function PlanViewHeader({
  phaseFilter,
  onPhaseFilterChange,
  detailLevel,
  onDetailLevelChange,
  activePlanViewId,
  elementsById,
  onViewRangeApply,
  viewSubtype,
  hasRooms = false,
  currentColorScheme,
  rooms = [],
  onColorSchemeApply,
  projectNorthAngleDeg,
  trueNorthActive = false,
  onTrueNorthToggle,
  phaseFilterMode,
  onPhaseFilterModeChange,
  canvasWidthPx,
  legendVisible = false,
  onLegendToggle,
  thinLinesEnabled = false,
  onThinLinesToggle,
  activeWorkPlaneName,
  onClearWorkPlane,
  onPerViewVGOpen,
  planViewAngleDeg,
  cropRegionMm,
  cropRegionEnabled = false,
  onCropRegionToggle,
  showUnderlay = false,
  onUnderlayToggle,
  underlayLevelId,
  underlayLevels = [],
  onUnderlayLevelChange,
}: PlanViewHeaderProps): JSX.Element {
  const [viewRangeOpen, setViewRangeOpen] = useState(false);
  const [colorSchemeOpen, setColorSchemeOpen] = useState(false);
  const selectLinkedEnabled = useBimStore((s) => s.selectLinkedEnabled);
  const setSelectLinkedEnabled = useBimStore((s) => s.setSelectLinkedEnabled);

  const viewRange = resolveViewRange(elementsById ?? {}, activePlanViewId ?? undefined);

  // §6.4.1 — callout view badge + scale
  const activePlanEl =
    activePlanViewId && elementsById ? elementsById[activePlanViewId] : undefined;
  const isCalloutView =
    activePlanEl?.kind === 'plan_view' && activePlanEl.planViewSubtype === 'callout';
  const calloutName = isCalloutView ? activePlanEl.name : undefined;

  let calloutScaleDisplay: number | undefined;
  if (
    isCalloutView &&
    activePlanEl.kind === 'plan_view' &&
    activePlanEl.cropMinMm &&
    activePlanEl.cropMaxMm &&
    canvasWidthPx &&
    canvasWidthPx > 0
  ) {
    const calloutWidthMm = Math.abs(activePlanEl.cropMaxMm.xMm - activePlanEl.cropMinMm.xMm) || 1;
    // calloutScale = calloutWidthMm / canvasWidthPx * (96 / 25.4)
    // (approximate plan-mm per screen-px conversion)
    calloutScaleDisplay = (calloutWidthMm / canvasWidthPx) * (96 / 25.4);
  }

  return (
    <div className="plan-view-header flex items-center gap-2 px-2 py-1">
      <PlanDetailLevelToolbar value={detailLevel} onChange={onDetailLevelChange} />
      <PhaseDropdown value={phaseFilter} onChange={onPhaseFilterChange} />
      {viewSubtype === 'ceiling_plan' ? (
        <span
          data-testid="plan-view-header-rcp-badge"
          style={{
            padding: '1px 6px',
            fontSize: 10,
            fontWeight: 600,
            border: '1px solid var(--color-border)',
            borderRadius: 3,
            color: 'var(--color-muted)',
            whiteSpace: 'nowrap',
          }}
        >
          RCP
        </span>
      ) : null}
      {isCalloutView && calloutName ? (
        <span
          data-testid="callout-view-badge"
          className="badge badge-info text-xs px-1"
          style={{
            padding: '1px 6px',
            fontSize: 10,
            fontWeight: 600,
            border: '1px solid var(--color-border)',
            borderRadius: 3,
            color: 'var(--color-muted)',
            whiteSpace: 'nowrap',
          }}
        >
          Detail Callout: {calloutName}
        </span>
      ) : null}
      {isCalloutView && calloutScaleDisplay !== undefined ? (
        <span
          data-testid="callout-view-scale"
          className="text-xs text-muted"
          style={{ fontSize: 10, color: 'var(--color-muted)', whiteSpace: 'nowrap' }}
        >
          1:{Math.round(calloutScaleDisplay)}
        </span>
      ) : null}
      {hasRooms && onColorSchemeApply ? (
        <button
          type="button"
          data-testid="color-scheme-dialog-trigger"
          onClick={() => setColorSchemeOpen(true)}
          style={{
            padding: '2px 8px',
            fontSize: 11,
            border: '1px solid var(--color-border)',
            borderRadius: 4,
            cursor: 'pointer',
            background: 'transparent',
            color: 'var(--color-foreground)',
            whiteSpace: 'nowrap',
          }}
        >
          Color Scheme…
        </button>
      ) : null}
      {currentColorScheme && onLegendToggle ? (
        <button
          type="button"
          data-testid="plan-view-legend-toggle"
          onClick={onLegendToggle}
          style={{
            padding: '2px 8px',
            fontSize: 11,
            border: '1px solid var(--color-border)',
            borderRadius: 4,
            cursor: 'pointer',
            background: legendVisible ? 'var(--color-accent)' : 'transparent',
            color: legendVisible ? 'var(--color-foreground-on-accent)' : 'var(--color-foreground)',
            whiteSpace: 'nowrap',
          }}
        >
          Legend
        </button>
      ) : null}
      {onThinLinesToggle ? (
        <button
          type="button"
          data-testid="plan-view-thin-lines-toggle"
          title="Thin Lines"
          onClick={onThinLinesToggle}
          style={{
            padding: '2px 8px',
            fontSize: 11,
            border: '1px solid var(--color-border)',
            borderRadius: 4,
            cursor: 'pointer',
            background: thinLinesEnabled ? 'var(--color-accent)' : 'transparent',
            color: thinLinesEnabled ? 'var(--color-accent-foreground)' : 'var(--color-foreground)',
            whiteSpace: 'nowrap',
          }}
        >
          TL
        </button>
      ) : null}
      <button
        type="button"
        data-testid="plan-view-select-linked-toggle"
        title={selectLinkedEnabled ? 'Disable Linked Selection' : 'Enable Linked Selection'}
        onClick={() => setSelectLinkedEnabled(!selectLinkedEnabled)}
        style={{
          padding: '2px 6px',
          borderRadius: 4,
          background: selectLinkedEnabled ? 'var(--color-accent)' : 'transparent',
          color: selectLinkedEnabled
            ? 'var(--color-accent-foreground)'
            : 'var(--color-muted-foreground)',
          border: '1px solid var(--color-border-strong)',
          fontSize: 11,
          cursor: 'pointer',
        }}
      >
        LK
      </button>
      {onPerViewVGOpen ? (
        <button
          type="button"
          data-testid="plan-view-per-view-vg-btn"
          onClick={onPerViewVGOpen}
          title="Per-View Visibility/Graphics Override"
          style={{
            padding: '2px 8px',
            fontSize: 11,
            border: '1px solid var(--color-border)',
            borderRadius: 4,
            cursor: 'pointer',
            background: 'transparent',
            color: 'var(--color-foreground)',
          }}
        >
          VG
        </button>
      ) : null}
      {activeWorkPlaneName ? (
        <span
          data-testid="plan-view-work-plane-badge"
          style={{
            fontSize: 10,
            color: 'var(--color-muted)',
            whiteSpace: 'nowrap',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          Work Plane: {activeWorkPlaneName}
          <button
            type="button"
            data-testid="plan-view-work-plane-clear"
            onClick={onClearWorkPlane}
            style={{
              fontSize: 10,
              cursor: 'pointer',
              background: 'none',
              border: 'none',
              color: 'inherit',
            }}
          >
            ×
          </button>
        </span>
      ) : null}
      {activePlanViewId && onViewRangeApply ? (
        <button
          type="button"
          data-testid="view-range-btn"
          onClick={() => setViewRangeOpen(true)}
          style={{
            padding: '2px 8px',
            fontSize: 11,
            border: '1px solid var(--color-border)',
            borderRadius: 4,
            cursor: 'pointer',
            background: 'transparent',
            color: 'var(--color-foreground)',
            whiteSpace: 'nowrap',
          }}
        >
          View Range…
        </button>
      ) : null}
      {viewRangeOpen && activePlanViewId && onViewRangeApply ? (
        <ViewRangeDialog
          open={viewRangeOpen}
          viewId={activePlanViewId}
          viewRangeTopMm={viewRange.viewRangeTopMm}
          cutPlaneOffsetMm={viewRange.cutPlaneOffsetMm}
          viewRangeBottomMm={viewRange.viewRangeBottomMm}
          viewDepth={viewRange.viewDepth}
          onClose={() => setViewRangeOpen(false)}
          onApply={(values) => {
            onViewRangeApply(activePlanViewId, values);
          }}
        />
      ) : null}
      {colorSchemeOpen && activePlanViewId && onColorSchemeApply ? (
        <ColorSchemeDialog
          open={colorSchemeOpen}
          viewId={activePlanViewId}
          rooms={rooms}
          currentScheme={currentColorScheme}
          onClose={() => setColorSchemeOpen(false)}
          onApply={(payload) => {
            onColorSchemeApply(payload);
            setColorSchemeOpen(false);
          }}
        />
      ) : null}
      {activePlanViewId && onPhaseFilterModeChange ? (
        <select
          data-testid="phase-filter-mode-select"
          value={phaseFilterMode ?? ''}
          onChange={(e) => {
            const v = e.currentTarget.value as
              | 'new_construction'
              | 'demolition'
              | 'existing'
              | 'as_built'
              | '';
            onPhaseFilterModeChange(v || null);
          }}
          title="Phase filter display mode"
          style={{
            fontSize: 11,
            padding: '2px 4px',
            border: '1px solid var(--color-border)',
            borderRadius: 4,
            background: phaseFilterMode ? 'var(--color-accent)' : 'var(--color-surface)',
            color: phaseFilterMode
              ? 'var(--color-foreground-on-accent)'
              : 'var(--color-foreground)',
            cursor: 'pointer',
          }}
        >
          <option value="">Phase: All</option>
          {Object.entries(PHASE_FILTER_MODE_LABELS).map(([k, label]) => (
            <option key={k} value={k}>
              {label}
            </option>
          ))}
        </select>
      ) : null}
      {projectNorthAngleDeg !== undefined && onTrueNorthToggle ? (
        <button
          type="button"
          data-testid="true-north-toggle"
          aria-pressed={trueNorthActive}
          onClick={() => onTrueNorthToggle(!trueNorthActive)}
          title={
            trueNorthActive
              ? `True North active (${projectNorthAngleDeg}°) — click to disable`
              : `True North off — click to rotate ${projectNorthAngleDeg}°`
          }
          style={{
            padding: '2px 8px',
            fontSize: 11,
            border: '1px solid var(--color-border)',
            borderRadius: 4,
            cursor: 'pointer',
            background: trueNorthActive ? 'var(--color-accent)' : 'transparent',
            color: trueNorthActive
              ? 'var(--color-foreground-on-accent)'
              : 'var(--color-foreground)',
            whiteSpace: 'nowrap',
          }}
        >
          N ↑ {projectNorthAngleDeg}°
        </button>
      ) : null}
      {(planViewAngleDeg ?? 0) !== 0 ? (
        <span
          data-testid="plan-view-north-angle"
          title="View rotated to true north"
          style={{ fontSize: 11, color: 'var(--color-muted-foreground)' }}
        >
          ↑{(planViewAngleDeg ?? 0).toFixed(1)}°
        </span>
      ) : null}
      {cropRegionMm && onCropRegionToggle ? (
        <button
          type="button"
          data-testid="plan-header-crop-region-toggle"
          title={
            cropRegionEnabled
              ? 'Crop region ON — click to disable'
              : 'Crop region OFF — click to enable'
          }
          onClick={onCropRegionToggle}
          style={{
            fontSize: 11,
            padding: '1px 6px',
            border: '1px solid var(--color-border)',
            borderRadius: 4,
            cursor: 'pointer',
            background: 'transparent',
            color: 'var(--color-foreground)',
            opacity: cropRegionEnabled ? 1 : 0.5,
            whiteSpace: 'nowrap',
          }}
        >
          {cropRegionEnabled ? '⬜ Crop ON' : '⬜ Crop OFF'}
        </button>
      ) : null}
      {/* §2.9.4: Underlay toggle + level selector */}
      {onUnderlayToggle ? (
        <button
          type="button"
          data-testid="plan-view-underlay-btn"
          title={showUnderlay ? 'Hide Underlay' : 'Show Underlay'}
          onClick={onUnderlayToggle}
          style={{
            fontSize: 10,
            padding: '1px 5px',
            border: `1px solid ${showUnderlay ? 'var(--color-info)' : 'var(--color-border)'}`,
            borderRadius: 3,
            background: showUnderlay
              ? 'color-mix(in srgb, var(--color-info) 15%, transparent)'
              : 'transparent',
            color: showUnderlay ? 'var(--color-info)' : 'inherit',
            cursor: 'pointer',
          }}
        >
          UL
        </button>
      ) : null}
      {showUnderlay && onUnderlayLevelChange ? (
        <select
          data-testid="plan-view-underlay-level-select"
          value={underlayLevelId ?? ''}
          onChange={(e) => onUnderlayLevelChange(e.target.value || null)}
          style={{
            fontSize: 10,
            padding: '1px 4px',
            background: 'transparent',
            color: 'inherit',
            border: '1px solid var(--border)',
          }}
        >
          <option value="">-- No Underlay --</option>
          {underlayLevels.map((lv) => (
            <option key={lv.id} value={lv.id}>
              {lv.name ?? lv.id}
            </option>
          ))}
        </select>
      ) : null}
    </div>
  );
}
