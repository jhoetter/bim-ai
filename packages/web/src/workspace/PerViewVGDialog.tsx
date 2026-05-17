import { useState, type JSX } from 'react';
import type { CategoryVisualOverride, Element } from '@bim-ai/core';

export interface PerViewVGDialogProps {
  open: boolean;
  onClose: () => void;
  activePlanViewId: string | null;
  elementsById: Record<string, Element | undefined>;
  onApply: (viewId: string, overrides: CategoryVisualOverride[]) => void;
}

const CATEGORIES: Array<{ key: string; label: string }> = [
  { key: 'wall', label: 'Walls' },
  { key: 'floor', label: 'Floors' },
  { key: 'roof', label: 'Roofs' },
  { key: 'ceiling', label: 'Ceilings' },
  { key: 'door', label: 'Doors' },
  { key: 'window', label: 'Windows' },
  { key: 'column', label: 'Columns' },
  { key: 'stair', label: 'Stairs' },
  { key: 'room', label: 'Rooms' },
  { key: 'permanent_dimension', label: 'Dimensions' },
  { key: 'text_note', label: 'Text Notes' },
];

const DEFAULT_COLOR = '#1e293b';

function overridesToMap(overrides: CategoryVisualOverride[]): Map<string, CategoryVisualOverride> {
  const map = new Map<string, CategoryVisualOverride>();
  for (const ovr of overrides) {
    if ('category' in ovr && typeof (ovr as { category?: string }).category === 'string') {
      map.set((ovr as { category: string }).category, ovr);
    }
  }
  return map;
}

/** Build the initial map from a CategoryVisualOverride[] that uses a `category` discriminator. */
function buildInitialState(
  existing: CategoryVisualOverride[],
): Record<string, CategoryVisualOverride> {
  const result: Record<string, CategoryVisualOverride> = {};
  for (const ovr of existing) {
    const cat = (ovr as { category?: string }).category;
    if (typeof cat === 'string') {
      result[cat] = ovr;
    }
  }
  return result;
}

function mapToOverrides(map: Record<string, CategoryVisualOverride>): CategoryVisualOverride[] {
  return Object.entries(map).map(
    ([category, ovr]) => ({ ...ovr, category }) as CategoryVisualOverride & { category: string },
  );
}

export function PerViewVGDialog({
  open,
  onClose,
  activePlanViewId,
  elementsById,
  onApply,
}: PerViewVGDialogProps): JSX.Element | null {
  const planViewEl = activePlanViewId != null ? elementsById[activePlanViewId] : undefined;
  const existing: CategoryVisualOverride[] =
    planViewEl?.kind === 'plan_view'
      ? ((planViewEl.viewCategoryOverrides ?? []) as CategoryVisualOverride[])
      : [];

  const [localOverrides, setLocalOverrides] = useState<Record<string, CategoryVisualOverride>>(() =>
    buildInitialState(existing),
  );

  if (!open || activePlanViewId == null) return null;

  const getOverride = (key: string): CategoryVisualOverride | undefined => localOverrides[key];

  const setOverride = (key: string, patch: Partial<CategoryVisualOverride> | null) => {
    setLocalOverrides((prev) => {
      if (patch === null) {
        const next = { ...prev };
        delete next[key];
        return next;
      }
      return { ...prev, [key]: { ...prev[key], ...patch } };
    });
  };

  const handleVisible = (key: string, checked: boolean) => {
    setOverride(key, { hidden: !checked });
  };

  const handleColor = (key: string, colorHex: string) => {
    setOverride(key, { colorHex });
  };

  const handleWeight = (key: string, raw: string) => {
    const lineWeightPx = parseFloat(raw);
    setOverride(key, { lineWeightPx: isFinite(lineWeightPx) ? lineWeightPx : null });
  };

  const handleApply = () => {
    onApply(activePlanViewId, mapToOverrides(localOverrides));
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Per-View Visibility/Graphics Overrides"
      data-testid="per-view-vg-dialog"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.45)',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg, 8px)',
          padding: 'var(--space-5, 20px)',
          width: 640,
          maxWidth: 'calc(100vw - 48px)',
          maxHeight: 'calc(100vh - 96px)',
          overflowY: 'auto',
          boxShadow: '0 8px 32px rgba(0,0,0,0.32)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 'var(--space-4)',
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: 'var(--text-base, 14px)',
              fontWeight: 600,
              color: 'var(--color-foreground)',
            }}
          >
            Per-View Visibility/Graphics Overrides
          </h2>
          <button
            type="button"
            data-testid="per-view-vg-close"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: 16,
              color: 'var(--color-muted-foreground)',
            }}
          >
            &#x2715;
          </button>
        </div>

        {/* Table */}
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: 'var(--text-sm, 12.5px)',
            color: 'var(--color-foreground)',
          }}
        >
          <thead>
            <tr>
              <th style={thStyle}>Category</th>
              <th style={{ ...thStyle, textAlign: 'center' }}>Visible</th>
              <th style={thStyle}>Color</th>
              <th style={thStyle}>Line Weight</th>
              <th style={thStyle} />
            </tr>
          </thead>
          <tbody>
            {CATEGORIES.map(({ key, label }) => {
              const ovr = getOverride(key);
              const hasOverride = ovr !== undefined;
              const isVisible = !(ovr?.hidden ?? false);
              const colorHex = ovr?.colorHex ?? DEFAULT_COLOR;
              const lineWeightPx = ovr?.lineWeightPx ?? 1;
              return (
                <tr key={key}>
                  <td
                    style={{
                      ...tdStyle,
                      fontStyle: hasOverride ? 'normal' : 'italic',
                      color: hasOverride
                        ? 'var(--color-foreground)'
                        : 'var(--color-muted-foreground)',
                    }}
                  >
                    {label}
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'center' }}>
                    <input
                      type="checkbox"
                      data-testid={`per-view-vg-visible-${key}`}
                      checked={isVisible}
                      onChange={(e) => handleVisible(key, e.currentTarget.checked)}
                    />
                  </td>
                  <td style={tdStyle}>
                    <input
                      type="color"
                      data-testid={`per-view-vg-color-${key}`}
                      value={colorHex}
                      onChange={(e) => handleColor(key, e.currentTarget.value)}
                      style={{
                        width: 40,
                        height: 22,
                        cursor: 'pointer',
                        border: 'none',
                        padding: 0,
                      }}
                    />
                  </td>
                  <td style={tdStyle}>
                    <input
                      type="number"
                      data-testid={`per-view-vg-weight-${key}`}
                      value={lineWeightPx}
                      min={0.5}
                      max={4}
                      step={0.5}
                      onChange={(e) => handleWeight(key, e.currentTarget.value)}
                      style={{ width: 56, ...numInputStyle }}
                    />
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>
                    <button
                      type="button"
                      data-testid={`per-view-vg-reset-${key}`}
                      onClick={() => setOverride(key, null)}
                      disabled={!hasOverride}
                      style={{
                        ...resetBtnStyle,
                        opacity: hasOverride ? 1 : 0.4,
                        cursor: hasOverride ? 'pointer' : 'default',
                      }}
                    >
                      Reset
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 8,
            marginTop: 'var(--space-4)',
          }}
        >
          <button
            type="button"
            data-testid="per-view-vg-cancel"
            onClick={onClose}
            style={resetBtnStyle}
          >
            Cancel
          </button>
          <button
            type="button"
            data-testid="per-view-vg-apply"
            onClick={handleApply}
            style={{
              ...resetBtnStyle,
              background: 'var(--color-accent, #2563eb)',
              color: '#fff',
              border: '1px solid var(--color-accent, #2563eb)',
            }}
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}

const thStyle: React.CSSProperties = {
  padding: 'var(--space-1-5, 6px) var(--space-2, 8px)',
  textAlign: 'left',
  fontSize: 'var(--text-xs, 11px)',
  fontWeight: 600,
  color: 'var(--color-muted-foreground)',
  borderBottom: '1px solid var(--color-border)',
  whiteSpace: 'nowrap',
};

const tdStyle: React.CSSProperties = {
  padding: 'var(--space-1-5, 6px) var(--space-2, 8px)',
  borderBottom: '1px solid var(--color-border)',
  fontSize: 'var(--text-sm, 12.5px)',
};

const numInputStyle: React.CSSProperties = {
  padding: 'var(--space-0-5, 2px) var(--space-1, 4px)',
  background: 'var(--color-background)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-sm, 4px)',
  color: 'var(--color-foreground)',
  fontSize: 'var(--text-sm, 12.5px)',
};

const resetBtnStyle: React.CSSProperties = {
  padding: 'var(--space-0-5, 2px) var(--space-1-5, 6px)',
  background: 'var(--color-surface)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-sm, 4px)',
  color: 'var(--color-foreground)',
  fontSize: 'var(--text-xs, 11px)',
};

// Re-export for consumers that want the overrideMap → array helper.
export { overridesToMap };
