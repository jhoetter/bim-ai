import { useState, useCallback, useEffect } from 'react';
import type { JSX } from 'react';
import { useBimStore } from '../state/store';
import type { CategoryOverride, CategoryOverrides } from '../state/store';

const MODEL_CATEGORIES = [
  'wall',
  'floor',
  'roof',
  'door',
  'window',
  'stair',
  'railing',
  'room',
  'column',
  'beam',
  'ceiling',
  'site',
] as const;

const ANNOTATION_CATEGORIES = [
  'grid_line',
  'level_datum',
  'dimension',
  'room_tag',
  'door_tag',
  'window_tag',
  'section_mark',
] as const;

const CATEGORY_LABELS: Record<string, string> = {
  wall: 'Walls',
  floor: 'Floors',
  roof: 'Roofs',
  door: 'Doors',
  window: 'Windows',
  stair: 'Stairs',
  railing: 'Railings',
  room: 'Rooms',
  column: 'Columns',
  beam: 'Beams',
  ceiling: 'Ceilings',
  site: 'Site',
  grid_line: 'Grids',
  level_datum: 'Levels',
  dimension: 'Dimensions',
  room_tag: 'Room Tags',
  door_tag: 'Door Tags',
  window_tag: 'Window Tags',
  section_mark: 'Section Marks',
};

const PRESET_COLORS = ['#000000', '#808080', '#0000ff', '#ff0000', '#008000', 'custom'] as const;

const LINE_WEIGHTS = ['By Category', '1', '2', '3', '4', '5'] as const;

const LINE_PATTERNS = ['Solid', 'Dashed', 'Dotted', 'Center'] as const;

type Tab = 'model' | 'annotation';

function ColorSwatch({
  color,
  onChange,
}: {
  color: string | null | undefined;
  onChange: (c: string | null) => void;
}): JSX.Element {
  const [open, setOpen] = useState(false);
  const display = color ?? '#000000';
  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button
        type="button"
        title="Line color"
        onClick={() => setOpen((v) => !v)}
        style={{
          width: 20,
          height: 14,
          border: '1px solid var(--color-border)',
          background: display,
          cursor: 'pointer',
          borderRadius: 2,
        }}
      />
      {open && (
        <div
          style={{
            position: 'absolute',
            top: 20,
            left: 0,
            zIndex: 100,
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 4,
            padding: 4,
            display: 'flex',
            gap: 4,
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          }}
        >
          {PRESET_COLORS.slice(0, 5).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => {
                onChange(c);
                setOpen(false);
              }}
              style={{
                width: 18,
                height: 18,
                background: c,
                border:
                  c === color ? '2px solid var(--color-accent)' : '1px solid var(--color-border)',
                borderRadius: 2,
                cursor: 'pointer',
              }}
            />
          ))}
          <button
            type="button"
            onClick={() => {
              onChange(null);
              setOpen(false);
            }}
            style={{
              fontSize: 10,
              padding: '0 4px',
              border: '1px solid var(--color-border)',
              borderRadius: 2,
              cursor: 'pointer',
              background: 'transparent',
              color: 'var(--color-foreground)',
            }}
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}

function CategoryRow({
  categoryKey,
  draft,
  onChange,
}: {
  categoryKey: string;
  draft: CategoryOverride;
  onChange: (upd: CategoryOverride) => void;
}): JSX.Element {
  const visible = draft.visible !== false;
  const projColor = draft.projection?.lineColor ?? null;
  const projWeight =
    draft.projection?.lineWeightFactor != null
      ? String(Math.round(draft.projection.lineWeightFactor))
      : 'By Category';
  const projPattern = draft.projection?.linePattern ?? 'Solid';
  const cutColor = draft.cut?.lineColor ?? null;
  const cutWeight =
    draft.cut?.lineWeightFactor != null
      ? String(Math.round(draft.cut.lineWeightFactor))
      : 'By Category';
  const cutPattern = draft.cut?.linePattern ?? 'Solid';

  return (
    <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
      <td style={{ padding: '4px 8px', fontSize: 12 }}>
        {CATEGORY_LABELS[categoryKey] ?? categoryKey}
      </td>
      <td style={{ padding: '4px 8px' }}>
        <input
          type="checkbox"
          checked={visible}
          aria-label={`${CATEGORY_LABELS[categoryKey] ?? categoryKey} visible`}
          onChange={(e) => onChange({ ...draft, visible: e.target.checked })}
        />
      </td>
      {/* Projection: color, weight, pattern */}
      <td style={{ padding: '4px 8px' }}>
        <ColorSwatch
          color={projColor}
          onChange={(c) =>
            onChange({ ...draft, projection: { ...draft.projection, lineColor: c } })
          }
        />
      </td>
      <td style={{ padding: '4px 4px' }}>
        <select
          value={projWeight}
          aria-label={`${CATEGORY_LABELS[categoryKey] ?? categoryKey} projection line weight`}
          onChange={(e) => {
            const v = e.target.value;
            onChange({
              ...draft,
              projection: {
                ...draft.projection,
                lineWeightFactor: v === 'By Category' ? undefined : Number(v),
              },
            });
          }}
          style={{ fontSize: 11, border: '1px solid var(--color-border)', borderRadius: 2 }}
        >
          {LINE_WEIGHTS.map((w) => (
            <option key={w} value={w}>
              {w}
            </option>
          ))}
        </select>
      </td>
      <td style={{ padding: '4px 4px' }}>
        <select
          value={projPattern}
          aria-label={`${CATEGORY_LABELS[categoryKey] ?? categoryKey} projection pattern`}
          onChange={(e) =>
            onChange({ ...draft, projection: { ...draft.projection, linePattern: e.target.value } })
          }
          style={{ fontSize: 11, border: '1px solid var(--color-border)', borderRadius: 2 }}
        >
          {LINE_PATTERNS.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </td>
      {/* Cut: color, weight, pattern */}
      <td style={{ padding: '4px 8px' }}>
        <ColorSwatch
          color={cutColor}
          onChange={(c) => onChange({ ...draft, cut: { ...draft.cut, lineColor: c } })}
        />
      </td>
      <td style={{ padding: '4px 4px' }}>
        <select
          value={cutWeight}
          aria-label={`${CATEGORY_LABELS[categoryKey] ?? categoryKey} cut line weight`}
          onChange={(e) => {
            const v = e.target.value;
            onChange({
              ...draft,
              cut: {
                ...draft.cut,
                lineWeightFactor: v === 'By Category' ? undefined : Number(v),
              },
            });
          }}
          style={{ fontSize: 11, border: '1px solid var(--color-border)', borderRadius: 2 }}
        >
          {LINE_WEIGHTS.map((w) => (
            <option key={w} value={w}>
              {w}
            </option>
          ))}
        </select>
      </td>
      <td style={{ padding: '4px 4px' }}>
        <select
          value={cutPattern}
          aria-label={`${CATEGORY_LABELS[categoryKey] ?? categoryKey} cut pattern`}
          onChange={(e) =>
            onChange({ ...draft, cut: { ...draft.cut, linePattern: e.target.value } })
          }
          style={{ fontSize: 11, border: '1px solid var(--color-border)', borderRadius: 2 }}
        >
          {LINE_PATTERNS.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </td>
    </tr>
  );
}

export function VVDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}): JSX.Element | null {
  const activePlanViewId = useBimStore((s) => s.activePlanViewId);
  const elementsById = useBimStore((s) => s.elementsById);
  const setCategoryOverride = useBimStore((s) => s.setCategoryOverride);

  const [tab, setTab] = useState<Tab>('model');
  const [draft, setDraft] = useState<CategoryOverrides>({});

  // Sync draft from store when dialog opens or active view changes
  useEffect(() => {
    if (!open) return;
    const pv = activePlanViewId ? elementsById[activePlanViewId] : undefined;
    const stored =
      pv?.kind === 'plan_view' ? ((pv.categoryOverrides as CategoryOverrides) ?? {}) : {};
    setDraft(stored);
  }, [open, activePlanViewId, elementsById]);

  const handleCategoryChange = useCallback((catKey: string, upd: CategoryOverride) => {
    setDraft((prev) => ({ ...prev, [catKey]: upd }));
  }, []);

  const handleApply = useCallback(() => {
    if (!activePlanViewId) return;
    const pv = activePlanViewId ? elementsById[activePlanViewId] : undefined;
    const stored =
      pv?.kind === 'plan_view' ? ((pv.categoryOverrides as CategoryOverrides) ?? {}) : {};
    const allKeys = new Set([...Object.keys(stored), ...Object.keys(draft)]);
    for (const key of allKeys) {
      const draftVal = draft[key];
      if (draftVal !== undefined) {
        setCategoryOverride(activePlanViewId, key, draftVal);
      }
    }
  }, [activePlanViewId, draft, elementsById, setCategoryOverride]);

  const handleOk = useCallback(() => {
    handleApply();
    onClose();
  }, [handleApply, onClose]);

  if (!open) return null;

  const planViewName = activePlanViewId
    ? ((elementsById[activePlanViewId] as { name?: string })?.name ?? 'Plan View')
    : 'No Plan View';

  const categories = tab === 'model' ? MODEL_CATEGORIES : ANNOTATION_CATEGORIES;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Visibility/Graphics Overrides"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.4)',
      }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 6,
          boxShadow: '0 4px 24px rgba(0,0,0,0.2)',
          minWidth: 720,
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Title bar */}
        <div
          style={{
            padding: '10px 14px',
            borderBottom: '1px solid var(--color-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-foreground)' }}>
            Visibility/Graphics Overrides — {planViewName}
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              fontSize: 16,
              color: 'var(--color-muted)',
              lineHeight: 1,
              padding: '0 2px',
            }}
          >
            ×
          </button>
        </div>

        {/* Tabs */}
        <div
          style={{
            display: 'flex',
            borderBottom: '1px solid var(--color-border)',
            padding: '0 14px',
          }}
        >
          {(['model', 'annotation'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              style={{
                padding: '6px 14px',
                fontSize: 12,
                fontWeight: tab === t ? 600 : 400,
                borderBottom: tab === t ? '2px solid var(--color-accent)' : '2px solid transparent',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: tab === t ? 'var(--color-foreground)' : 'var(--color-muted)',
              }}
            >
              {t === 'model' ? 'Model Categories' : 'Annotation Categories'}
            </button>
          ))}
        </div>

        {/* Table */}
        <div style={{ overflowY: 'auto', flex: 1 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: 'var(--color-background)' }}>
                <th
                  style={{ padding: '6px 8px', textAlign: 'left', fontSize: 11, fontWeight: 600 }}
                >
                  Category
                </th>
                <th style={{ padding: '6px 8px', fontSize: 11, fontWeight: 600 }}>Visible</th>
                <th
                  colSpan={3}
                  style={{
                    padding: '6px 8px',
                    textAlign: 'center',
                    fontSize: 11,
                    fontWeight: 600,
                    borderLeft: '1px solid var(--color-border)',
                  }}
                >
                  Projection
                </th>
                <th
                  colSpan={3}
                  style={{
                    padding: '6px 8px',
                    textAlign: 'center',
                    fontSize: 11,
                    fontWeight: 600,
                    borderLeft: '1px solid var(--color-border)',
                  }}
                >
                  Cut
                </th>
              </tr>
              <tr style={{ background: 'var(--color-background)' }}>
                <th style={{ padding: '4px 8px' }} />
                <th style={{ padding: '4px 8px' }} />
                <th
                  style={{
                    padding: '4px 8px',
                    fontSize: 10,
                    fontWeight: 500,
                    borderLeft: '1px solid var(--color-border)',
                  }}
                >
                  Color
                </th>
                <th style={{ padding: '4px 8px', fontSize: 10, fontWeight: 500 }}>Weight</th>
                <th style={{ padding: '4px 8px', fontSize: 10, fontWeight: 500 }}>Pattern</th>
                <th
                  style={{
                    padding: '4px 8px',
                    fontSize: 10,
                    fontWeight: 500,
                    borderLeft: '1px solid var(--color-border)',
                  }}
                >
                  Color
                </th>
                <th style={{ padding: '4px 8px', fontSize: 10, fontWeight: 500 }}>Weight</th>
                <th style={{ padding: '4px 8px', fontSize: 10, fontWeight: 500 }}>Pattern</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((cat) => (
                <CategoryRow
                  key={cat}
                  categoryKey={cat}
                  draft={draft[cat] ?? {}}
                  onChange={(upd) => handleCategoryChange(cat, upd)}
                />
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '10px 14px',
            borderTop: '1px solid var(--color-border)',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 8,
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '5px 14px',
              fontSize: 12,
              border: '1px solid var(--color-border)',
              borderRadius: 4,
              background: 'transparent',
              cursor: 'pointer',
              color: 'var(--color-foreground)',
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleApply}
            style={{
              padding: '5px 14px',
              fontSize: 12,
              border: '1px solid var(--color-border)',
              borderRadius: 4,
              background: 'transparent',
              cursor: 'pointer',
              color: 'var(--color-foreground)',
            }}
          >
            Apply
          </button>
          <button
            type="button"
            onClick={handleOk}
            style={{
              padding: '5px 14px',
              fontSize: 12,
              border: 'none',
              borderRadius: 4,
              background: 'var(--color-accent)',
              cursor: 'pointer',
              color: 'var(--color-accent-foreground)',
              fontWeight: 600,
            }}
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}
