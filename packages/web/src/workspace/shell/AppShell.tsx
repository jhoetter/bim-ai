import {
  type CSSProperties,
  type JSX,
  type KeyboardEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { OptionsBar, ToolModifierBar } from '../authoring';

/**
 * AppShell — the canonical layout grid for the BIM AI workspace.
 *
 * Responsibilities (spec §8):
 *   - Five-zone CSS grid: topbar (48 px) / left rail / canvas / right rail
 *     / status bar (28 px).
 *   - Three documented breakpoints driven by tokens: `>= 1600` (full
 *     rails), `1280–1599` (slim rails), `1024–1279` (left rail collapses
 *     to a 56 px icon strip), `< 1024` (rails become overlays toggled by
 *     `[` / `]`).
 *   - Keyboard hotkeys: `[` toggles left rail collapsed-vs-expanded; `]`
 *     toggles right rail.
 *
 * Slot props are pure render functions. AppShell does not own canvas /
 * rail content — composed surfaces (TopBar, ProjectBrowser, Inspector,
 * StatusBar) are wired in by their owning workpackages (A03–A06).
 */

export interface AppShellProps {
  topBar: ReactNode;
  /** Optional tabbed command ribbon shown below the top bar. */
  ribbonBar?: ReactNode;
  /** Active workspace mode, used to scope tool option surfaces. */
  activeMode?: string;
  leftRail: ReactNode;
  /** Compact contents shown when the left rail is collapsed (icon-strip). */
  leftRailCollapsed?: ReactNode;
  canvas: ReactNode;
  rightRail: ReactNode;
  statusBar: ReactNode;
  /** Initial collapsed state for the left rail. Defaults to false. */
  defaultLeftCollapsed?: boolean;
  /** Initial collapsed state for the right rail. Defaults to false. */
  defaultRightCollapsed?: boolean;
  /** Controlled left-rail collapsed state. When provided, overrides internal state. */
  leftCollapsed?: boolean;
  onLeftCollapsedChange?: (v: boolean) => void;
  /** Controlled right-rail collapsed state. When provided, overrides internal toggle state. */
  rightCollapsed?: boolean;
  /** Override the document target for the global `[` / `]` hotkeys.
   * Used by tests to scope the listeners. */
  hotkeyTarget?: Document | HTMLElement;
}

export function AppShell({
  topBar,
  ribbonBar,
  activeMode,
  leftRail,
  leftRailCollapsed,
  canvas,
  rightRail,
  statusBar,
  defaultLeftCollapsed = false,
  defaultRightCollapsed = false,
  leftCollapsed: leftCollapsedProp,
  onLeftCollapsedChange,
  rightCollapsed: rightCollapsedProp,
  hotkeyTarget,
}: AppShellProps): JSX.Element {
  const { t } = useTranslation();
  const [leftCollapsedInternal, setLeftCollapsedInternal] = useState(defaultLeftCollapsed);
  const [rightCollapsedInternal, setRightCollapsedInternal] = useState(defaultRightCollapsed);

  const isRightControlled = rightCollapsedProp !== undefined;
  const rightCollapsed = isRightControlled ? rightCollapsedProp : rightCollapsedInternal;

  const isControlled = leftCollapsedProp !== undefined;
  const leftCollapsed = isControlled ? leftCollapsedProp : leftCollapsedInternal;
  const setLeftCollapsed = useCallback(
    (updater: boolean | ((prev: boolean) => boolean)) => {
      const next = typeof updater === 'function' ? updater(leftCollapsed) : updater;
      if (isControlled) {
        onLeftCollapsedChange?.(next);
      } else {
        setLeftCollapsedInternal(next);
      }
    },
    [isControlled, leftCollapsed, onLeftCollapsedChange],
  );

  const handleKey = useCallback(
    (event: KeyboardEvent | globalThis.KeyboardEvent) => {
      if (shouldIgnoreKey(event)) return;
      if (event.key === '[') {
        event.preventDefault();
        setLeftCollapsed((v) => !v);
      } else if (event.key === ']') {
        event.preventDefault();
        setRightCollapsedInternal((v) => !v);
      }
    },
    [setLeftCollapsed],
  );

  useEffect(() => {
    const target: Document | HTMLElement | undefined =
      hotkeyTarget ?? (typeof document !== 'undefined' ? document : undefined);
    if (!target) return;
    const listener = (e: globalThis.KeyboardEvent): void => handleKey(e);
    target.addEventListener('keydown', listener as EventListener);
    return () => target.removeEventListener('keydown', listener as EventListener);
  }, [handleKey, hotkeyTarget]);

  const style: CSSProperties = {
    display: 'grid',
    gridTemplateRows: 'auto auto minmax(0, 1fr) var(--shell-statusbar-height)',
    gridTemplateColumns: gridColumnsForState(leftCollapsed, rightCollapsed),
    gridTemplateAreas: `
      "topbar topbar topbar"
      "optionsbar optionsbar optionsbar"
      "leftRail canvas rightRail"
      "statusbar statusbar statusbar"
    `,
    transition: 'grid-template-columns 200ms var(--ease-paper, ease)',
    height: '100dvh',
    width: '100%',
    overflow: 'hidden',
    background: 'var(--color-background)',
    color: 'var(--color-foreground)',
  };
  const showToolBars =
    !activeMode || activeMode === 'plan' || activeMode === 'plan-3d' || activeMode === 'section';

  return (
    <div
      data-testid="app-shell"
      data-left-collapsed={leftCollapsed ? 'true' : 'false'}
      data-right-collapsed={rightCollapsed ? 'true' : 'false'}
      style={style}
    >
      <div
        style={{ gridArea: 'topbar' }}
        className="flex items-center border-b border-border bg-surface"
      >
        {topBar}
      </div>
      <div style={{ gridArea: 'optionsbar' }}>
        {ribbonBar}
        {showToolBars ? (
          <>
            <ToolModifierBar />
            <OptionsBar />
          </>
        ) : null}
      </div>
      <aside
        aria-label={t('workspace.projectBrowser')}
        data-testid="app-shell-left-rail"
        style={{ gridArea: 'leftRail', minWidth: 0 }}
        className="flex flex-col border-r border-border bg-surface"
      >
        {leftCollapsed ? (leftRailCollapsed ?? null) : leftRail}
      </aside>
      <main
        aria-label={t('workspace.canvasLabel')}
        data-testid="app-shell-canvas"
        style={{ gridArea: 'canvas', minWidth: 0, minHeight: 0 }}
        className="relative overflow-hidden bg-background"
      >
        {canvas}
      </main>
      <aside
        aria-label={t('workspace.inspectorLabel')}
        data-testid="app-shell-right-rail"
        style={{ gridArea: 'rightRail', minWidth: 0, minHeight: 0, overflow: 'hidden' }}
        className="flex flex-col border-l border-border bg-surface"
        hidden={rightCollapsed}
      >
        {rightRail}
      </aside>
      <footer
        style={{ gridArea: 'statusbar' }}
        className="flex items-center border-t border-border bg-surface text-xs"
      >
        {statusBar}
      </footer>
    </div>
  );
}

function gridColumnsForState(leftCollapsed: boolean, rightCollapsed: boolean): string {
  const left = leftCollapsed
    ? 'var(--shell-rail-left-collapsed-width)'
    : 'var(--shell-rail-left-width)';
  const right = rightCollapsed ? '0' : 'var(--shell-rail-right-width)';
  return `${left} minmax(0, 1fr) ${right}`;
}

function shouldIgnoreKey(event: KeyboardEvent | globalThis.KeyboardEvent): boolean {
  const target = event.target as HTMLElement | null;
  if (!target) return false;
  if (event.metaKey || event.ctrlKey || event.altKey) return true;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (target.isContentEditable) return true;
  return false;
}
