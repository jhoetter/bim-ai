import {
  type CSSProperties,
  Fragment,
  type JSX,
  type KeyboardEvent,
  useCallback,
  useRef,
} from 'react';
import { useTranslation } from 'react-i18next';
import { Icons } from '@bim-ai/ui';
import {
  isToolDisabled,
  MODIFY_TOOL_IDS,
  paletteForMode,
  type ToolDisabledContext,
  type ToolId,
  type WorkspaceMode,
} from './toolRegistry';
import { ShortcutChip } from '../ui/ShortcutChip';
import {
  capabilityIdForTool,
  evaluateCommandInMode,
  type CapabilityViewMode,
} from '../workspace/commandCapabilities';

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
  const { t } = useTranslation();
  const tools = paletteForMode(mode, t);
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
      className="flex items-center gap-0.5 rounded-md border border-border bg-background/95 px-1.5 py-1.5 shadow-elev-2 backdrop-blur-sm"
    >
      {tools.map((tool, idx) => {
        const Icon = Icons[tool.icon]!;
        const enablement = isToolDisabled(tool.id, disabledContext, t);
        const capabilityAvailability = evaluateCommandInMode(
          capabilityIdForTool(tool.id),
          mode as CapabilityViewMode,
        );
        const disabledReason =
          capabilityAvailability?.state === 'disabled'
            ? capabilityAvailability.reason
            : enablement.reason;
        const disabled = Boolean(disabledReason) || enablement.disabled;
        const isActive = tool.id === activeTool;
        const isFirstModify =
          MODIFY_TOOL_IDS.has(tool.id) && (idx === 0 || !MODIFY_TOOL_IDS.has(tools[idx - 1]!.id));
        return (
          <Fragment key={tool.id}>
            {isFirstModify && (
              <div aria-hidden="true" className="mx-0.5 h-5 w-px self-center bg-border" />
            )}
            <button
              ref={setRef(tool.id)}
              type="button"
              aria-label={`${tool.label} (${tool.hotkey})`}
              aria-pressed={isActive}
              aria-keyshortcuts={tool.hotkey}
              aria-disabled={disabled}
              tabIndex={isActive ? 0 : -1}
              disabled={disabled}
              title={
                disabledReason
                  ? disabledReason
                  : tool.shortcut
                    ? `${tool.label} (${tool.shortcut})`
                    : tool.label
              }
              data-tool={tool.id}
              data-active={isActive ? 'true' : 'false'}
              onClick={() => {
                if (disabled) return;
                if (tool.id === 'tag') onTagSubmenu?.();
                else onToolSelect(tool.id);
              }}
              className={[
                'relative inline-flex h-8 w-8 items-center justify-center rounded transition-colors',
                isActive
                  ? 'bg-accent text-accent-foreground shadow-sm'
                  : 'text-muted hover:bg-surface hover:text-foreground',
                disabled ? 'opacity-40' : '',
              ].join(' ')}
            >
              <Icon size={16} aria-hidden="true" />
              <ShortcutChip label={tool.shortcut ?? tool.hotkey.replace('Shift+', '⇧')} />
            </button>
          </Fragment>
        );
      })}
    </div>
  );
}

const paletteStyle: CSSProperties = {
  // Top-center floating per §16; absolute positioning is left to caller.
  zIndex: 10,
};
