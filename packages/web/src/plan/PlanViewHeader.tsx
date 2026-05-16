import { useState, type JSX } from 'react';

import type { Element, PhaseFilter } from '@bim-ai/core';

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
}: PlanViewHeaderProps): JSX.Element {
  const [viewRangeOpen, setViewRangeOpen] = useState(false);
  const [colorSchemeOpen, setColorSchemeOpen] = useState(false);

  const viewRange = resolveViewRange(elementsById ?? {}, activePlanViewId ?? undefined);

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
            background: trueNorthActive ? 'var(--color-accent, #2563eb)' : 'transparent',
            color: trueNorthActive ? '#fff' : 'var(--color-foreground)',
            whiteSpace: 'nowrap',
          }}
        >
          N ↑ {projectNorthAngleDeg}°
        </button>
      ) : null}
    </div>
  );
}
