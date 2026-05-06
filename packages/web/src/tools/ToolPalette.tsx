import { type CSSProperties, type JSX, type KeyboardEvent, useCallback, useRef } from 'react';
import { Icons, ICON_SIZE } from '@bim-ai/ui';
import {
  isToolDisabled,
  paletteForMode,
  type ToolDisabledContext,
  type ToolId,
  type WorkspaceMode,
} from './toolRegistry';

/**
 * ToolPalette — spec §16.
 *
 * Top-floating, mode-aware tool group. Each button is 36 × 36 with the
 * lucide icon centered and the hotkey letter as a `--text-xs` superscript
 * bottom-right. `role="toolbar"` with arrow-key traversal between
 * buttons. Active tool gets `--color-accent` background; disabled tools
 * get 0.4 opacity and the disablement reason as the tooltip.
 *
 * The Tag subdropdown (`Tag ▾`) is exposed as a separate trailing
 * button; clicking it dispatches `onTagSubmenu()` so the consumer can
 * mount the §16.5 menu.
 */

export interface ToolPaletteProps {
  mode: WorkspaceMode;
  activeTool: ToolId;
  onToolSelect: (id: ToolId) => void;
  /** Tool-disablement context (wall / floor / selection presence). */
  disabledContext: ToolDisabledContext;
  /** Tag dropdown trigger; the menu itself is rendered by the parent. */
  onTagSubmenu?: () => void;
}

export function ToolPalette({
  mode,
  activeTool,
  onToolSelect,
  disabledContext,
  onTagSubmenu,
}: ToolPaletteProps): JSX.Element {
  const tools = paletteForMode(mode);
  const refs = useRef<Map<ToolId, HTMLButtonElement>>(new Map());
  const setRef = useCallback(
    (id: ToolId) => (el: HTMLButtonElement | null) => {
      if (el) refs.current.set(id, el);
      else refs.current.delete(id);
    },
    [],
  );

  const handleKey = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
      const idx = tools.findIndex((t) => t.id === activeTool);
      if (idx < 0) return;
      const delta = event.key === 'ArrowRight' ? 1 : -1;
      const next = tools[(idx + delta + tools.length) % tools.length]!;
      event.preventDefault();
      onToolSelect(next.id);
      refs.current.get(next.id)?.focus();
    },
    [activeTool, onToolSelect, tools],
  );

  return (
    <div
      role="toolbar"
      aria-label="Drawing tools"
      data-testid="tool-palette"
      onKeyDown={handleKey}
      style={paletteStyle}
      className="flex items-center gap-0.5 rounded-xl border border-border bg-background/95 px-1.5 py-1.5 shadow-elev-2 backdrop-blur-sm"
    >
      {tools.map((tool) => {
        const Icon = Icons[tool.icon]!;
        const enablement = isToolDisabled(tool.id, disabledContext);
        const isActive = tool.id === activeTool;
        return (
          <button
            key={tool.id}
            ref={setRef(tool.id)}
            type="button"
            aria-label={`${tool.label} (${tool.hotkey})`}
            aria-pressed={isActive}
            aria-keyshortcuts={tool.hotkey}
            aria-disabled={enablement.disabled}
            tabIndex={isActive ? 0 : -1}
            disabled={enablement.disabled}
            title={enablement.disabled ? enablement.reason : tool.tooltip}
            data-tool={tool.id}
            data-active={isActive ? 'true' : 'false'}
            onClick={() => {
              if (enablement.disabled) return;
              if (tool.id === 'tag') onTagSubmenu?.();
              else onToolSelect(tool.id);
            }}
            className={[
              'relative inline-flex h-8 w-8 items-center justify-center rounded-lg transition-colors',
              isActive
                ? 'bg-accent text-accent-foreground shadow-sm'
                : 'text-muted hover:bg-surface hover:text-foreground',
              enablement.disabled ? 'opacity-40' : '',
            ].join(' ')}
          >
            <Icon size={16} aria-hidden="true" />
            <span
              aria-hidden="true"
              className="pointer-events-none absolute bottom-0.5 right-0.5 text-[8px] font-medium opacity-60 tabular-nums"
            >
              {tool.hotkey.replace('Shift+', '⇧')}
            </span>
          </button>
        );
      })}
    </div>
  );
}

const paletteStyle: CSSProperties = {
  // Top-center floating per §16; absolute positioning is left to caller.
  zIndex: 10,
};
