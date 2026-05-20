import type { ReactNode } from 'react';
import type { Element } from '@bim-ai/core';

import type { PlanTool } from '../state/store';

type MeasureReadout = {
  distMm: number;
};

type MeasureAngleReadout = {
  angleDeg: number;
};

type MeasureArcReadout = {
  arcLengthMm: number;
  radiusMm: number;
};

type Props = {
  planTool: PlanTool;
  measureReadout: MeasureReadout | null;
  measureAngleReadout: MeasureAngleReadout | null;
  measureArcReadout: MeasureArcReadout | null;
  onDismissMeasureReadout: () => void;
  onDismissMeasureAngleReadout: () => void;
  onDismissMeasureArcReadout: () => void;
  selectedId: string | null;
  selectedIds: string[];
  elementsById: Record<string, Element>;
  filterOpen: boolean;
  onToggleFilter: () => void;
  onCloseFilter: () => void;
  onClearSelection: () => void;
  onFilterOutKind: (kind: string) => void;
};

const readoutStyle = {
  position: 'absolute',
  bottom: 48,
  left: '50%',
  transform: 'translateX(-50%)',
  pointerEvents: 'auto',
  zIndex: 20,
} as const;

function ReadoutChip({
  testId,
  children,
  onDismiss,
}: {
  testId: string;
  children: ReactNode;
  onDismiss: () => void;
}) {
  return (
    <div
      style={readoutStyle}
      className="flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs shadow"
      data-testid={testId}
    >
      <span className="font-mono">{children}</span>
      <button type="button" className="text-muted hover:text-foreground" onClick={onDismiss}>
        ×
      </button>
    </div>
  );
}

function selectedKindCounts({
  selectedId,
  selectedIds,
  elementsById,
}: {
  selectedId: string | null;
  selectedIds: string[];
  elementsById: Record<string, Element>;
}) {
  const allIds = [...(selectedId ? [selectedId] : []), ...selectedIds];
  const kindCounts: Record<string, number> = {};
  for (const eid of allIds) {
    const el = elementsById[eid];
    if (el) {
      kindCounts[el.kind] = (kindCounts[el.kind] ?? 0) + 1;
    }
  }
  return Object.entries(kindCounts);
}

function MultiSelectionOverlay({
  selectedId,
  selectedIds,
  elementsById,
  filterOpen,
  onToggleFilter,
  onCloseFilter,
  onClearSelection,
  onFilterOutKind,
}: Pick<
  Props,
  | 'selectedId'
  | 'selectedIds'
  | 'elementsById'
  | 'filterOpen'
  | 'onToggleFilter'
  | 'onCloseFilter'
  | 'onClearSelection'
  | 'onFilterOutKind'
>) {
  if (selectedIds.length === 0) return null;

  const kindCounts = selectedKindCounts({ selectedId, selectedIds, elementsById });

  return (
    <>
      <div
        style={{
          position: 'absolute',
          bottom: 80,
          left: '50%',
          transform: 'translateX(-50%)',
          pointerEvents: 'auto',
          zIndex: 20,
        }}
        className="flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs shadow"
        data-testid="multi-select-count"
      >
        <span>{(selectedId ? 1 : 0) + selectedIds.length} elements selected</span>
        <button
          type="button"
          className="rounded px-2 py-0.5 text-xs font-medium text-accent hover:underline"
          data-testid="filter-selection-button"
          onClick={onToggleFilter}
        >
          Filter
        </button>
        <button
          type="button"
          className="text-muted hover:text-foreground"
          onClick={onClearSelection}
        >
          ×
        </button>
      </div>
      {filterOpen ? (
        <div
          style={{
            position: 'absolute',
            bottom: 116,
            left: '50%',
            transform: 'translateX(-50%)',
            pointerEvents: 'auto',
            zIndex: 30,
          }}
          className="flex flex-col gap-2 rounded border border-border bg-surface p-3 shadow-lg"
          data-testid="filter-selection-dialog"
        >
          <div className="text-[11px] font-semibold text-foreground">Filter Selection</div>
          {kindCounts.map(([kind, count]) => (
            <label
              key={kind}
              className="flex items-center gap-2 text-xs cursor-pointer select-none"
            >
              <input
                type="checkbox"
                defaultChecked
                onChange={(e) => {
                  if (!e.target.checked) {
                    onFilterOutKind(kind);
                  }
                }}
              />
              {kind} ({count})
            </label>
          ))}
          <button
            type="button"
            className="mt-1 rounded bg-accent px-3 py-1 text-xs font-medium text-accent-foreground"
            onClick={onCloseFilter}
          >
            Close
          </button>
        </div>
      ) : null}
    </>
  );
}

export function PlanCanvasWorkflowOverlays({
  planTool,
  measureReadout,
  measureAngleReadout,
  measureArcReadout,
  onDismissMeasureReadout,
  onDismissMeasureAngleReadout,
  onDismissMeasureArcReadout,
  selectedId,
  selectedIds,
  elementsById,
  filterOpen,
  onToggleFilter,
  onCloseFilter,
  onClearSelection,
  onFilterOutKind,
}: Props) {
  return (
    <>
      {measureReadout && planTool === 'measure' ? (
        <ReadoutChip testId="measure-readout" onDismiss={onDismissMeasureReadout}>
          {(measureReadout.distMm / 1000).toFixed(3)} m &nbsp; ({Math.round(measureReadout.distMm)}{' '}
          mm)
        </ReadoutChip>
      ) : null}
      {measureAngleReadout && planTool === 'measure-angle' ? (
        <ReadoutChip testId="measure-angle-readout" onDismiss={onDismissMeasureAngleReadout}>
          ∠ {measureAngleReadout.angleDeg.toFixed(1)}°
        </ReadoutChip>
      ) : null}
      {measureArcReadout && planTool === 'measure-arc' ? (
        <ReadoutChip testId="measure-arc-readout" onDismiss={onDismissMeasureArcReadout}>
          Arc: {(measureArcReadout.arcLengthMm / 1000).toFixed(3)} m &nbsp; R:{' '}
          {(measureArcReadout.radiusMm / 1000).toFixed(3)} m
        </ReadoutChip>
      ) : null}
      <MultiSelectionOverlay
        selectedId={selectedId}
        selectedIds={selectedIds}
        elementsById={elementsById}
        filterOpen={filterOpen}
        onToggleFilter={onToggleFilter}
        onCloseFilter={onCloseFilter}
        onClearSelection={onClearSelection}
        onFilterOutKind={onFilterOutKind}
      />
    </>
  );
}
