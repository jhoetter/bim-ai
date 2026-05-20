type UnderlayLevelOption = {
  id: string;
  name: string;
};

type Props = {
  thinLinesEnabled: boolean;
  onToggleThinLines: () => void;
  activePlanViewId?: string | null;
  showConstraints: boolean;
  onToggleConstraints: (viewId: string) => void;
  showUnderlay: boolean;
  onToggleUnderlay: (viewId: string) => void;
  underlayLevelId?: string | null;
  underlayLevels: UnderlayLevelOption[];
  onSetUnderlayLevel: (viewId: string, levelId: string | null) => void;
  activeWorkPlaneName?: string | null;
  onClearWorkPlane: (viewId: string) => void;
};

export function PlanCanvasViewControls({
  thinLinesEnabled,
  onToggleThinLines,
  activePlanViewId,
  showConstraints,
  onToggleConstraints,
  showUnderlay,
  onToggleUnderlay,
  underlayLevelId,
  underlayLevels,
  onSetUnderlayLevel,
  activeWorkPlaneName,
  onClearWorkPlane,
}: Props) {
  return (
    <div className="pointer-events-auto absolute left-2 top-1 z-20 flex items-center gap-2">
      <button
        type="button"
        data-testid="plan-view-thin-lines-toggle"
        title="Thin Lines"
        onClick={onToggleThinLines}
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
      {activePlanViewId ? (
        <button
          type="button"
          data-testid="plan-view-show-constraints-btn"
          title={showConstraints ? 'Hide Constraints' : 'Show Constraints'}
          onClick={() => onToggleConstraints(activePlanViewId)}
          style={{
            fontSize: 10,
            padding: '1px 5px',
            border: `1px solid ${showConstraints ? 'var(--color-success)' : 'var(--color-border)'}`,
            borderRadius: 3,
            background: showConstraints
              ? 'color-mix(in srgb, var(--color-success) 15%, transparent)'
              : 'transparent',
            color: showConstraints ? 'var(--color-success)' : 'inherit',
            cursor: 'pointer',
          }}
        >
          EQ
        </button>
      ) : null}
      {activePlanViewId ? (
        <button
          type="button"
          data-testid="plan-view-underlay-btn"
          title={showUnderlay ? 'Hide Underlay' : 'Show Underlay'}
          onClick={() => onToggleUnderlay(activePlanViewId)}
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
      {showUnderlay && activePlanViewId ? (
        <select
          data-testid="plan-view-underlay-level-select"
          value={underlayLevelId ?? ''}
          onChange={(e) => onSetUnderlayLevel(activePlanViewId, e.target.value || null)}
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
              {lv.name}
            </option>
          ))}
        </select>
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
          {activePlanViewId ? (
            <button
              type="button"
              data-testid="plan-view-work-plane-clear"
              onClick={() => onClearWorkPlane(activePlanViewId)}
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
          ) : null}
        </span>
      ) : null}
    </div>
  );
}
