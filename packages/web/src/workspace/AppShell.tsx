import {
  type CSSProperties,
  type JSX,
  type KeyboardEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useState,
} from 'react';

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
  /** Override the document target for the global `[` / `]` hotkeys.
   * Used by tests to scope the listeners. */
  hotkeyTarget?: Document | HTMLElement;
}

export function AppShell({
  topBar,
  leftRail,
  leftRailCollapsed,
  canvas,
  rightRail,
  statusBar,
  defaultLeftCollapsed = false,
  defaultRightCollapsed = false,
  hotkeyTarget,
}: AppShellProps): JSX.Element {
  const [leftCollapsed, setLeftCollapsed] = useState(defaultLeftCollapsed);
  const [rightCollapsed, setRightCollapsed] = useState(defaultRightCollapsed);

  const handleKey = useCallback((event: KeyboardEvent | globalThis.KeyboardEvent) => {
    if (shouldIgnoreKey(event)) return;
    if (event.key === '[') {
      event.preventDefault();
      setLeftCollapsed((v) => !v);
    } else if (event.key === ']') {
      event.preventDefault();
      setRightCollapsed((v) => !v);
    }
  }, []);

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
    gridTemplateRows: 'var(--shell-topbar-height) minmax(0, 1fr) var(--shell-statusbar-height)',
    gridTemplateColumns: gridColumnsForState(leftCollapsed, rightCollapsed),
    gridTemplateAreas: `
      "topbar topbar topbar"
      "leftRail canvas rightRail"
      "statusbar statusbar statusbar"
    `,
    minHeight: '100vh',
    width: '100%',
    background: 'var(--color-background)',
    color: 'var(--color-foreground)',
  };

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
      <aside
        aria-label="Project browser"
        data-testid="app-shell-left-rail"
        style={{ gridArea: 'leftRail', minWidth: 0 }}
        className="flex flex-col border-r border-border bg-surface"
      >
        {leftCollapsed ? (leftRailCollapsed ?? null) : leftRail}
      </aside>
      <main
        aria-label="Canvas"
        data-testid="app-shell-canvas"
        style={{ gridArea: 'canvas', minWidth: 0, minHeight: 0 }}
        className="relative overflow-hidden bg-background"
      >
        {canvas}
      </main>
      <aside
        aria-label="Inspector"
        data-testid="app-shell-right-rail"
        style={{ gridArea: 'rightRail', minWidth: 0 }}
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
