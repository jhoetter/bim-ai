/**
 * D8 - Color Fill Scheme Dialog.
 *
 * Lets users configure explicit per-value color overrides for the active plan
 * view's room_scheme presentation. Picks a scheme category (By Name,
 * By Department, By Area, By Occupancy) and exposes a color picker for each
 * unique value in that category across the supplied rooms.
 */

import { useEffect, useMemo, useState } from 'react';
import type { JSX } from 'react';

import { deterministicSchemeColorHex } from './roomSchemeColor';

export type ColorSchemeCategory = 'name' | 'department' | 'area' | 'occupancy';

export type ColorSchemeRoomEntry = {
  id: string;
  name: string;
  department?: string;
  area?: number;
  occupancy?: string;
};

export type ColorSchemeDialogProps = {
  open: boolean;
  viewId: string;
  rooms: ColorSchemeRoomEntry[];
  currentScheme?: { category: string; colorMap: Record<string, string> };
  onClose: () => void;
  onApply: (payload: {
    viewId: string;
    schemeCategory: string;
    colorMap: Record<string, string>;
  }) => void;
};

const CATEGORIES: Array<{ value: ColorSchemeCategory; label: string }> = [
  { value: 'name', label: 'By Name' },
  { value: 'department', label: 'By Department' },
  { value: 'area', label: 'By Area' },
  { value: 'occupancy', label: 'By Occupancy' },
];

function categoryValueForRoom(room: ColorSchemeRoomEntry, category: ColorSchemeCategory): string {
  switch (category) {
    case 'name':
      return room.name || '(unnamed)';
    case 'department':
      return room.department?.trim() || '(no department)';
    case 'area': {
      if (room.area == null) return '(no area)';
      const sqM = room.area / 1_000_000;
      const bucket = Math.floor(sqM / 10) * 10;
      return `${bucket}\u2013${bucket + 10} m\u00b2`;
    }
    case 'occupancy':
      return room.occupancy?.trim() || '(no occupancy)';
  }
}

function uniqueValuesForCategory(
  rooms: ColorSchemeRoomEntry[],
  category: ColorSchemeCategory,
): string[] {
  const seen = new Set<string>();
  for (const room of rooms) {
    seen.add(categoryValueForRoom(room, category));
  }
  return [...seen].sort((a, b) => a.localeCompare(b));
}

export function ColorSchemeDialog({
  open,
  viewId,
  rooms,
  currentScheme,
  onClose,
  onApply,
}: ColorSchemeDialogProps): JSX.Element | null {
  const [category, setCategory] = useState<ColorSchemeCategory>(() => {
    const cat = currentScheme?.category;
    if (cat === 'name' || cat === 'department' || cat === 'area' || cat === 'occupancy') {
      return cat;
    }
    return 'name';
  });

  const [colorMap, setColorMap] = useState<Record<string, string>>(
    () => currentScheme?.colorMap ?? {},
  );

  const uniqueValues = useMemo(() => uniqueValuesForCategory(rooms, category), [rooms, category]);

  useEffect(() => {
    setColorMap((prev) => {
      const next: Record<string, string> = {};
      for (const val of uniqueValues) {
        next[val] = prev[val] ?? deterministicSchemeColorHex(val);
      }
      return next;
    });
  }, [uniqueValues]);

  useEffect(() => {
    if (!currentScheme) return;
    const cat = currentScheme.category;
    if (cat === 'name' || cat === 'department' || cat === 'area' || cat === 'occupancy') {
      setCategory(cat);
    }
    setColorMap(currentScheme.colorMap);
  }, [currentScheme]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  function handleApply() {
    onApply({ viewId, schemeCategory: category, colorMap });
    onClose();
  }

  function handleClear() {
    onApply({ viewId, schemeCategory: category, colorMap: {} });
    onClose();
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Color Fill Scheme"
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.4)',
        zIndex: 1000,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: 'var(--color-surface-strong)',
          border: '1px solid var(--color-border)',
          borderRadius: 8,
          padding: 24,
          minWidth: 340,
          maxWidth: 480,
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          overflow: 'hidden',
        }}
      >
        <div style={{ fontWeight: 600, fontSize: 14 }}>Color Fill Scheme</div>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
          Scheme category
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as ColorSchemeCategory)}
            style={{
              padding: '4px 8px',
              border: '1px solid var(--color-border)',
              borderRadius: 4,
              background: 'var(--color-background)',
              color: 'var(--color-foreground)',
            }}
          >
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </label>

        <div style={{ fontSize: 12, flex: 1, overflowY: 'auto' }}>
          {uniqueValues.length === 0 ? (
            <div style={{ color: 'var(--color-muted)', fontStyle: 'italic' }}>
              No rooms found for this category.
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th
                    style={{
                      textAlign: 'left',
                      padding: '4px 8px',
                      borderBottom: '1px solid var(--color-border)',
                      fontWeight: 600,
                    }}
                  >
                    Value
                  </th>
                  <th
                    style={{
                      textAlign: 'center',
                      padding: '4px 8px',
                      borderBottom: '1px solid var(--color-border)',
                      fontWeight: 600,
                      width: 64,
                    }}
                  >
                    Color
                  </th>
                </tr>
              </thead>
              <tbody>
                {uniqueValues.map((val) => (
                  <tr key={val} style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <td
                      style={{
                        padding: '4px 8px',
                        color: 'var(--color-foreground)',
                        maxWidth: 280,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                      title={val}
                    >
                      {val}
                    </td>
                    <td style={{ padding: '4px 8px', textAlign: 'center' }}>
                      <input
                        type="color"
                        value={colorMap[val] ?? deterministicSchemeColorHex(val)}
                        onChange={(e) => {
                          const hex = e.target.value;
                          setColorMap((prev) => ({ ...prev, [val]: hex }));
                        }}
                        style={{ width: 36, height: 24, cursor: 'pointer', border: 'none' }}
                        aria-label={`Color for ${val}`}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between' }}>
          <button
            type="button"
            onClick={handleClear}
            style={{
              padding: '6px 16px',
              border: '1px solid var(--color-border)',
              borderRadius: 4,
              cursor: 'pointer',
              fontSize: 12,
              background: 'transparent',
              color: 'var(--color-foreground)',
            }}
          >
            Clear
          </button>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '6px 16px',
                border: '1px solid var(--color-border)',
                borderRadius: 4,
                cursor: 'pointer',
                fontSize: 12,
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApply}
              disabled={uniqueValues.length === 0}
              style={{
                padding: '6px 16px',
                border: 'none',
                borderRadius: 4,
                cursor: uniqueValues.length === 0 ? 'not-allowed' : 'pointer',
                fontSize: 12,
                background: 'var(--color-accent)',
                opacity: uniqueValues.length === 0 ? 0.5 : 1,
              }}
            >
              Apply
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
