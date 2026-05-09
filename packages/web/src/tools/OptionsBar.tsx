import { type JSX } from 'react';

import {
  TAG_FAMILIES,
  TOOL_CAPABILITIES,
  type TagFamily,
  type ToolGrammarModifiers,
  WALL_LOCATION_LINE_ORDER,
  type WallLocationLine,
} from './toolGrammar';
import type { ToolId } from './toolRegistry';

/**
 * EDT-06 — Options Bar.
 *
 * Mimics Revit's Options Bar: appears when a tool is active, exposes the
 * Chain / Multiple / Tag-on-Place / Numeric-input modifiers plus
 * tool-specific options (e.g. Wall location-line). The component itself
 * is presentational; toggle handlers and modifier state are owned by
 * the canvas / workspace shell.
 */

export interface OptionsBarProps {
  activeTool: ToolId | null;
  modifiers: ToolGrammarModifiers;
  onModifiersChange: (next: ToolGrammarModifiers) => void;
  /** Wall-tool only. Pass `undefined` for non-wall tools. */
  wallLocationLine?: WallLocationLine;
  onWallLocationLineChange?: (next: WallLocationLine) => void;
}

const WALL_LOCATION_LABELS: Record<WallLocationLine, string> = {
  'wall-centerline': 'Wall centerline',
  'finish-face-exterior': 'Finish face: ext.',
  'finish-face-interior': 'Finish face: int.',
  'core-centerline': 'Core centerline',
  'core-face-exterior': 'Core face: ext.',
  'core-face-interior': 'Core face: int.',
};

export function OptionsBar({
  activeTool,
  modifiers,
  onModifiersChange,
  wallLocationLine,
  onWallLocationLineChange,
}: OptionsBarProps): JSX.Element | null {
  if (!activeTool || activeTool === 'select') return null;
  const caps = TOOL_CAPABILITIES[activeTool];
  if (!caps) return null;
  const showAny =
    caps.chainable ||
    caps.multipleable ||
    caps.tagOnPlace ||
    caps.numericInput ||
    activeTool === 'wall';
  if (!showAny) return null;

  return (
    <div
      role="toolbar"
      aria-label="Tool options"
      data-testid="options-bar"
      style={{
        position: 'absolute',
        top: 8,
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '6px 12px',
        borderRadius: 6,
        background: 'var(--color-surface, #1b2433)',
        color: 'var(--color-foreground)',
        boxShadow: '0 2px 8px rgba(0,0,0,0.35)',
        font: 'var(--text-sm, 12px system-ui)',
        zIndex: 30,
      }}
    >
      {caps.chainable && (
        <label style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <input
            type="checkbox"
            data-testid="options-bar-chain"
            checked={modifiers.chainable}
            onChange={(ev) =>
              onModifiersChange({ ...modifiers, chainable: ev.currentTarget.checked })
            }
          />
          <span>Chain</span>
        </label>
      )}
      {caps.multipleable && (
        <label style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <input
            type="checkbox"
            data-testid="options-bar-multiple"
            checked={modifiers.multipleable}
            onChange={(ev) =>
              onModifiersChange({ ...modifiers, multipleable: ev.currentTarget.checked })
            }
          />
          <span>Multiple</span>
        </label>
      )}
      {caps.tagOnPlace && (
        <label style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <input
            type="checkbox"
            data-testid="options-bar-tag-on-place"
            checked={modifiers.tagOnPlace.enabled}
            onChange={(ev) =>
              onModifiersChange({
                ...modifiers,
                tagOnPlace: { ...modifiers.tagOnPlace, enabled: ev.currentTarget.checked },
              })
            }
          />
          <span>Tag on Place</span>
          {modifiers.tagOnPlace.enabled && (
            <select
              data-testid="options-bar-tag-family"
              value={modifiers.tagOnPlace.tagFamilyId ?? ''}
              onChange={(ev) =>
                onModifiersChange({
                  ...modifiers,
                  tagOnPlace: {
                    ...modifiers.tagOnPlace,
                    tagFamilyId: ev.currentTarget.value as TagFamily | '',
                  },
                })
              }
              style={{ marginLeft: 4 }}
            >
              <option value="">(default)</option>
              {TAG_FAMILIES.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.label}
                </option>
              ))}
            </select>
          )}
        </label>
      )}
      {caps.numericInput && (
        <span data-testid="options-bar-numeric-hint" style={{ opacity: 0.7, fontStyle: 'italic' }}>
          Type a digit while drawing for exact length
        </span>
      )}
      {activeTool === 'wall' && wallLocationLine && onWallLocationLineChange && (
        <label style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <span>Location line:</span>
          <select
            data-testid="options-bar-wall-location-line"
            value={wallLocationLine}
            onChange={(ev) => onWallLocationLineChange(ev.currentTarget.value as WallLocationLine)}
          >
            {WALL_LOCATION_LINE_ORDER.map((ll) => (
              <option key={ll} value={ll}>
                {WALL_LOCATION_LABELS[ll]}
              </option>
            ))}
          </select>
        </label>
      )}
      {activeTool === 'wall' && (
        <label style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <span>Offset (mm):</span>
          <input
            type="number"
            data-testid="options-bar-wall-offset"
            value={modifiers.wallDrawOffsetMm}
            step={50}
            onChange={(ev) =>
              onModifiersChange({ ...modifiers, wallDrawOffsetMm: Number(ev.currentTarget.value) })
            }
            style={{ width: 64 }}
          />
        </label>
      )}
      {activeTool === 'wall' && (
        <label style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <input
            type="checkbox"
            data-testid="options-bar-wall-radius-toggle"
            checked={modifiers.wallDrawRadiusMm !== null}
            onChange={(ev) =>
              onModifiersChange({
                ...modifiers,
                wallDrawRadiusMm: ev.currentTarget.checked ? 500 : null,
              })
            }
          />
          <span>Radius</span>
          {modifiers.wallDrawRadiusMm !== null && (
            <input
              type="number"
              data-testid="options-bar-wall-radius"
              value={modifiers.wallDrawRadiusMm}
              min={0}
              step={100}
              onChange={(ev) =>
                onModifiersChange({
                  ...modifiers,
                  wallDrawRadiusMm: Math.max(0, Number(ev.currentTarget.value)),
                })
              }
              style={{ width: 64 }}
            />
          )}
        </label>
      )}
    </div>
  );
}
