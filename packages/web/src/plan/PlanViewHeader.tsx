import type { JSX } from 'react';

import type { PhaseFilter } from '@bim-ai/core';

import { PhaseDropdown } from './PhaseDropdown';
import type { PlanDetailLevel } from './planDetailLevelLines';
import { PlanDetailLevelToolbar } from './PlanDetailLevelToolbar';

export type PlanViewHeaderProps = {
  phaseFilter: PhaseFilter;
  onPhaseFilterChange: (value: PhaseFilter) => void;
  detailLevel: PlanDetailLevel;
  onDetailLevelChange: (value: PlanDetailLevel) => void;
};

export function PlanViewHeader({
  phaseFilter,
  onPhaseFilterChange,
  detailLevel,
  onDetailLevelChange,
}: PlanViewHeaderProps): JSX.Element {
  return (
    <div className="plan-view-header flex items-center gap-2 px-2 py-1">
      <PlanDetailLevelToolbar value={detailLevel} onChange={onDetailLevelChange} />
      <PhaseDropdown value={phaseFilter} onChange={onPhaseFilterChange} />
    </div>
  );
}
