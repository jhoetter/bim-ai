import {
  type CSSProperties,
  type JSX,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { Icons } from '@bim-ai/ui';
import { OptionsBar, ToolModifierBar } from '../authoring';

/**
 * AppShell — the canonical seven-region layout grid for the BIM AI workspace.
 *
 * Slot props are pure render functions. AppShell owns region placement and
 * landmark semantics, not the concrete controls inside each region.
 */

export interface AppShellProps {
  /** Canonical header region: sidebar reveal, tabs, Cmd+K, share, presence. */
  header?: ReactNode;
  /** Back-compat alias for header. */
  topBar?: ReactNode;
  /** Canonical ribbon/options region below the header. */
  ribbon?: ReactNode;
  /** Back-compat alias for ribbon. */
  ribbonBar?: ReactNode;
  /** Active workspace mode, used to scope tool option surfaces. */
  activeMode?: string;
  /** Canonical primary sidebar region: project and view navigation. */
  primarySidebar?: ReactNode;
  /** Back-compat alias for primarySidebar. */
  leftRail?: ReactNode;
  /** Compact contents shown when the left rail is collapsed (icon-strip). */
  leftRailCollapsed?: ReactNode;
  /** Canonical secondary sidebar region: persistent active-view state. */
  secondarySidebar?: ReactNode;
  canvas: ReactNode;
  /** Canonical selected-element sidebar. Omit/null when no element is selected. */
  elementSidebar?: ReactNode | null;
  /** Back-compat alias for elementSidebar. */
  rightRail?: ReactNode;
  /** Canonical footer region. */
  footer?: ReactNode;
  /** Back-compat alias for footer. */
  statusBar?: ReactNode;
  /** Initial collapsed state for the left rail. Defaults to false. */
  defaultLeftCollapsed?: boolean;
  /** Initial collapsed state for the right rail. Defaults to false. */
  defaultRightCollapsed?: boolean;
  /** Controlled left-rail collapsed state. When provided, overrides internal state. */
  leftCollapsed?: boolean;
  onLeftCollapsedChange?: (v: boolean) => void;
  /** Controlled right-rail collapsed state. When provided, overrides internal toggle state. */
  rightCollapsed?: boolean;
  /** Initial primary-sidebar width in pixels. */
  defaultPrimarySidebarWidth?: number;
  /** Initial secondary-sidebar width in pixels. */
  secondarySidebarWidth?: number;
  /** Initial element-sidebar width in pixels. */
  defaultElementSidebarWidth?: number;
  /** Override the document target for the global `[` / `]` hotkeys.
   * Used by tests to scope the listeners. */
  hotkeyTarget?: Document | HTMLElement;
}

const PRIMARY_SIDEBAR_MIN_WIDTH = 192;
const PRIMARY_SIDEBAR_MAX_WIDTH = 420;
const PRIMARY_SIDEBAR_HIDE_THRESHOLD = 32;
const DEFAULT_PRIMARY_SIDEBAR_WIDTH = 256;
const DEFAULT_SECONDARY_SIDEBAR_WIDTH = 280;
const ELEMENT_SIDEBAR_MIN_WIDTH = 272;
const ELEMENT_SIDEBAR_MAX_WIDTH = 520;
const ELEMENT_SIDEBAR_HIDE_THRESHOLD = 40;
const DEFAULT_ELEMENT_SIDEBAR_WIDTH = 340;

export function AppShell({
  header,
  topBar,
  ribbon,
  ribbonBar,
  activeMode,
  primarySidebar,
  leftRail,
  secondarySidebar,
  canvas,
  elementSidebar,
  rightRail,
  footer,
  statusBar,
  defaultLeftCollapsed = false,
  defaultRightCollapsed = false,
  leftCollapsed: leftCollapsedProp,
  onLeftCollapsedChange,
  rightCollapsed: rightCollapsedProp,
  defaultPrimarySidebarWidth = DEFAULT_PRIMARY_SIDEBAR_WIDTH,
  secondarySidebarWidth = DEFAULT_SECONDARY_SIDEBAR_WIDTH,
  defaultElementSidebarWidth = DEFAULT_ELEMENT_SIDEBAR_WIDTH,
  hotkeyTarget,
}: AppShellProps): JSX.Element {
  const { t } = useTranslation();
  const [leftCollapsedInternal, setLeftCollapsedInternal] = useState(defaultLeftCollapsed);
  const [rightCollapsedInternal, setRightCollapsedInternal] = useState(defaultRightCollapsed);
  const [primaryWidth, setPrimaryWidth] = useState(defaultPrimarySidebarWidth);
  const [elementWidth, setElementWidth] = useState(defaultElementSidebarWidth);
  const lastVisiblePrimaryWidthRef = useRef(defaultPrimarySidebarWidth);
  const lastVisibleElementWidthRef = useRef(defaultElementSidebarWidth);
  const narrowAutoCollapsedRef = useRef(false);
  const resizeStateRef = useRef<{ startX: number; startWidth: number } | null>(null);
  const elementResizeStateRef = useRef<{ startX: number; startWidth: number } | null>(null);

  const isRightControlled = rightCollapsedProp !== undefined;
  const rightCollapsed = isRightControlled ? rightCollapsedProp : rightCollapsedInternal;

  const isControlled = leftCollapsedProp !== undefined;
  const leftCollapsed = isControlled ? leftCollapsedProp : leftCollapsedInternal;
  const headerNode = header ?? topBar;
  const ribbonNode = ribbon ?? ribbonBar;
  const primarySidebarNode = primarySidebar ?? leftRail;
  const elementSidebarNode = elementSidebar ?? rightRail ?? null;
  const footerNode = footer ?? statusBar;
  const primaryHidden = leftCollapsed || primaryWidth <= 0;
  const elementSidebarPresent = Boolean(elementSidebarNode) && !rightCollapsed;

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

  const restorePrimarySidebar = useCallback(() => {
    const restoredWidth = clampPrimaryWidth(
      lastVisiblePrimaryWidthRef.current || defaultPrimarySidebarWidth,
    );
    setPrimaryWidth(restoredWidth);
    setLeftCollapsed(false);
  }, [defaultPrimarySidebarWidth, setLeftCollapsed]);

  const hidePrimarySidebar = useCallback(() => {
    if (primaryWidth > 0) lastVisiblePrimaryWidthRef.current = primaryWidth;
    setPrimaryWidth(0);
    setLeftCollapsed(true);
  }, [primaryWidth, setLeftCollapsed]);

  const hideElementSidebar = useCallback(() => {
    if (elementWidth > 0) lastVisibleElementWidthRef.current = elementWidth;
    if (isRightControlled) return;
    setRightCollapsedInternal(true);
  }, [elementWidth, isRightControlled]);

  const restoreElementSidebar = useCallback(() => {
    const restoredWidth = clampElementWidth(
      lastVisibleElementWidthRef.current || defaultElementSidebarWidth,
    );
    setElementWidth(restoredWidth);
    if (isRightControlled) return;
    setRightCollapsedInternal(false);
  }, [defaultElementSidebarWidth, isRightControlled]);

  const handleKey = useCallback(
    (event: KeyboardEvent | globalThis.KeyboardEvent) => {
      if (shouldIgnoreKey(event)) return;
      if (event.key === '[') {
        event.preventDefault();
        if (primaryHidden) restorePrimarySidebar();
        else hidePrimarySidebar();
      } else if (event.key === ']') {
        event.preventDefault();
        if (rightCollapsed) restoreElementSidebar();
        else hideElementSidebar();
      }
    },
    [
      hideElementSidebar,
      hidePrimarySidebar,
      primaryHidden,
      restoreElementSidebar,
      restorePrimarySidebar,
      rightCollapsed,
    ],
  );

  useEffect(() => {
    const target: Document | HTMLElement | undefined =
      hotkeyTarget ?? (typeof document !== 'undefined' ? document : undefined);
    if (!target) return;
    const listener = (e: globalThis.KeyboardEvent): void => handleKey(e);
    target.addEventListener('keydown', listener as EventListener);
    return () => target.removeEventListener('keydown', listener as EventListener);
  }, [handleKey, hotkeyTarget]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const applyNarrowDefault = (): void => {
      if (window.innerWidth < 640 && !narrowAutoCollapsedRef.current) {
        narrowAutoCollapsedRef.current = true;
        setLeftCollapsed(true);
      }
      if (window.innerWidth >= 900) {
        narrowAutoCollapsedRef.current = false;
      }
    };
    applyNarrowDefault();
    window.addEventListener('resize', applyNarrowDefault);
    return () => window.removeEventListener('resize', applyNarrowDefault);
  }, [setLeftCollapsed]);

  useEffect(() => {
    if (!leftCollapsed && primaryWidth <= 0) {
      const restoredWidth = clampPrimaryWidth(
        lastVisiblePrimaryWidthRef.current || defaultPrimarySidebarWidth,
      );
      setPrimaryWidth(restoredWidth);
    }
  }, [defaultPrimarySidebarWidth, leftCollapsed, primaryWidth]);

  const updatePrimaryWidth = useCallback(
    (nextWidth: number) => {
      if (nextWidth <= PRIMARY_SIDEBAR_HIDE_THRESHOLD) {
        hidePrimarySidebar();
        return;
      }
      const clamped = clampPrimaryWidth(nextWidth);
      lastVisiblePrimaryWidthRef.current = clamped;
      setPrimaryWidth(clamped);
      setLeftCollapsed(false);
    },
    [hidePrimarySidebar, setLeftCollapsed],
  );

  const updateElementWidth = useCallback(
    (nextWidth: number) => {
      if (nextWidth <= ELEMENT_SIDEBAR_HIDE_THRESHOLD) {
        hideElementSidebar();
        return;
      }
      const clamped = clampElementWidth(nextWidth);
      lastVisibleElementWidthRef.current = clamped;
      setElementWidth(clamped);
      if (isRightControlled) return;
      setRightCollapsedInternal(false);
    },
    [hideElementSidebar, isRightControlled],
  );

  const handlePrimaryResizeStart = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      resizeStateRef.current = {
        startX: event.clientX,
        startWidth: primaryHidden
          ? lastVisiblePrimaryWidthRef.current || defaultPrimarySidebarWidth
          : primaryWidth,
      };

      const ownerDocument = event.currentTarget.ownerDocument;
      const handlePointerMove = (moveEvent: globalThis.PointerEvent): void => {
        const state = resizeStateRef.current;
        if (!state) return;
        updatePrimaryWidth(state.startWidth + moveEvent.clientX - state.startX);
      };
      const handlePointerUp = (): void => {
        resizeStateRef.current = null;
        ownerDocument.removeEventListener('pointermove', handlePointerMove);
        ownerDocument.removeEventListener('pointerup', handlePointerUp);
      };
      ownerDocument.addEventListener('pointermove', handlePointerMove);
      ownerDocument.addEventListener('pointerup', handlePointerUp);
    },
    [defaultPrimarySidebarWidth, primaryHidden, primaryWidth, updatePrimaryWidth],
  );

  const handlePrimaryResizeKey = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key === 'Home') {
        event.preventDefault();
        restorePrimarySidebar();
      } else if (event.key === 'End') {
        event.preventDefault();
        hidePrimarySidebar();
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        updatePrimaryWidth(primaryWidth - 24);
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        updatePrimaryWidth(
          (primaryHidden ? lastVisiblePrimaryWidthRef.current : primaryWidth) + 24,
        );
      }
    },
    [hidePrimarySidebar, primaryHidden, primaryWidth, restorePrimarySidebar, updatePrimaryWidth],
  );

  const handleElementResizeStart = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      elementResizeStateRef.current = {
        startX: event.clientX,
        startWidth: rightCollapsed
          ? lastVisibleElementWidthRef.current || defaultElementSidebarWidth
          : elementWidth,
      };

      const ownerDocument = event.currentTarget.ownerDocument;
      const handlePointerMove = (moveEvent: globalThis.PointerEvent): void => {
        const state = elementResizeStateRef.current;
        if (!state) return;
        updateElementWidth(state.startWidth + state.startX - moveEvent.clientX);
      };
      const handlePointerUp = (): void => {
        elementResizeStateRef.current = null;
        ownerDocument.removeEventListener('pointermove', handlePointerMove);
        ownerDocument.removeEventListener('pointerup', handlePointerUp);
      };
      ownerDocument.addEventListener('pointermove', handlePointerMove);
      ownerDocument.addEventListener('pointerup', handlePointerUp);
    },
    [defaultElementSidebarWidth, elementWidth, rightCollapsed, updateElementWidth],
  );

  const handleElementResizeKey = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key === 'Home') {
        event.preventDefault();
        restoreElementSidebar();
      } else if (event.key === 'End') {
        event.preventDefault();
        hideElementSidebar();
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        updateElementWidth(
          (rightCollapsed ? lastVisibleElementWidthRef.current : elementWidth) + 24,
        );
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        updateElementWidth(elementWidth - 24);
      }
    },
    [elementWidth, hideElementSidebar, restoreElementSidebar, rightCollapsed, updateElementWidth],
  );

  const style: CSSProperties = {
    display: 'grid',
    gridTemplateRows: 'auto auto minmax(0, 1fr) var(--shell-statusbar-height)',
    gridTemplateColumns: gridColumnsForState(
      primaryHidden ? 0 : primaryWidth,
      secondarySidebarWidth,
      elementWidth,
      elementSidebarPresent,
    ),
    gridTemplateAreas: `
      ". header header header"
      ". secondarySidebar ribbon ribbon"
      ". secondarySidebar canvas elementSidebar"
      ". footer footer footer"
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
      data-left-collapsed={primaryHidden ? 'true' : 'false'}
      data-primary-hidden={primaryHidden ? 'true' : 'false'}
      data-right-collapsed={!elementSidebarPresent ? 'true' : 'false'}
      data-element-sidebar-present={elementSidebarPresent ? 'true' : 'false'}
      style={style}
    >
      <div
        data-testid="app-shell-header"
        role="banner"
        aria-label="Workspace header"
        style={{ gridArea: 'header' }}
        className="flex min-w-0 items-center border-b border-border bg-surface"
      >
        {primaryHidden ? (
          <button
            type="button"
            data-testid="app-shell-primary-reveal"
            aria-label="Show primary sidebar"
            title="Show primary sidebar"
            onClick={restorePrimarySidebar}
            className="ml-2 inline-flex h-8 w-8 flex-none items-center justify-center rounded border border-border text-muted hover:bg-surface-2 hover:text-foreground"
          >
            <Icons.hamburger aria-hidden="true" size={16} />
          </button>
        ) : null}
        {headerNode}
      </div>
      <div data-testid="app-shell-ribbon" style={{ gridArea: 'ribbon' }}>
        {ribbonNode}
        {showToolBars ? (
          <>
            <ToolModifierBar />
            <OptionsBar />
          </>
        ) : null}
      </div>
      <aside
        aria-label={t('workspace.projectBrowser')}
        data-testid="app-shell-primary-sidebar"
        style={{
          gridColumn: 1,
          gridRow: '1 / 5',
          minWidth: 0,
          display: primaryHidden ? 'none' : undefined,
        }}
        className="relative flex flex-col border-r border-border bg-surface"
        hidden={primaryHidden}
      >
        {primarySidebarNode}
      </aside>
      {primaryHidden ? null : (
        <div
          aria-label="Resize primary sidebar"
          aria-orientation="vertical"
          className="z-20 cursor-col-resize"
          data-testid="app-shell-primary-resize-handle"
          role="separator"
          tabIndex={0}
          onPointerDown={handlePrimaryResizeStart}
          onKeyDown={handlePrimaryResizeKey}
          style={{
            gridColumn: 1,
            gridRow: '1 / 5',
            justifySelf: 'end',
            width: 8,
            marginRight: -4,
          }}
        />
      )}
      <aside
        aria-label="Active view settings"
        data-testid="app-shell-secondary-sidebar"
        style={{ gridArea: 'secondarySidebar', minWidth: 0, minHeight: 0 }}
        className="flex flex-col overflow-hidden border-r border-border bg-surface"
      >
        {secondarySidebar}
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
        data-testid="app-shell-element-sidebar"
        style={{
          gridArea: 'elementSidebar',
          minWidth: 0,
          minHeight: 0,
          overflow: 'hidden',
          display: elementSidebarPresent ? undefined : 'none',
        }}
        className="flex flex-col border-l border-border bg-surface"
        hidden={!elementSidebarPresent}
      >
        {elementSidebarNode}
      </aside>
      {elementSidebarPresent ? (
        <div
          aria-label="Resize element sidebar"
          aria-orientation="vertical"
          className="z-20 cursor-col-resize"
          data-testid="app-shell-element-resize-handle"
          role="separator"
          tabIndex={0}
          onPointerDown={handleElementResizeStart}
          onKeyDown={handleElementResizeKey}
          style={{
            gridColumn: 4,
            gridRow: 3,
            justifySelf: 'start',
            width: 8,
            marginLeft: -4,
          }}
        />
      ) : null}
      <footer
        data-testid="app-shell-footer"
        aria-label="Global status footer"
        style={{ gridArea: 'footer' }}
        className="flex items-center border-t border-border bg-surface text-xs"
      >
        {footerNode}
      </footer>
    </div>
  );
}

function gridColumnsForState(
  primarySidebarWidth: number,
  secondarySidebarWidth: number,
  elementSidebarWidth: number,
  elementSidebarPresent: boolean,
): string {
  const secondary = `${Math.max(160, secondarySidebarWidth)}px`;
  const element = `${elementSidebarPresent ? clampElementWidth(elementSidebarWidth) : 0}px`;
  return `${primarySidebarWidth}px ${secondary} minmax(0, 1fr) ${element}`;
}

function clampPrimaryWidth(width: number): number {
  return Math.max(PRIMARY_SIDEBAR_MIN_WIDTH, Math.min(PRIMARY_SIDEBAR_MAX_WIDTH, width));
}

function clampElementWidth(width: number): number {
  return Math.max(ELEMENT_SIDEBAR_MIN_WIDTH, Math.min(ELEMENT_SIDEBAR_MAX_WIDTH, width));
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
