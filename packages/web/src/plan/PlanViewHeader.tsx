import { useState, type JSX } from 'react';

import type { Element, PhaseFilter } from '@bim-ai/core';

import { PhaseDropdown } from './PhaseDropdown';
import type { PlanDetailLevel } from './planDetailLevelLines';
import { PlanDetailLevelToolbar } from './PlanDetailLevelToolbar';
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
};

export function PlanViewHeader({
  phaseFilter,
  onPhaseFilterChange,
  detailLevel,
  onDetailLevelChange,
  activePlanViewId,
  elementsById,
  onViewRangeApply,
}: PlanViewHeaderProps): JSX.Element {
  const [viewRangeOpen, setViewRangeOpen] = useState(false);

  const viewRange = resolveViewRange(elementsById ?? {}, activePlanViewId ?? undefined);

  return (
    <div className="plan-view-header flex items-center gap-2 px-2 py-1">
      <PlanDetailLevelToolbar value={detailLevel} onChange={onDetailLevelChange} />
      <PhaseDropdown value={phaseFilter} onChange={onPhaseFilterChange} />
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
    </div>
  );
}
