import { type JSX, useCallback, useEffect, useRef, useState } from 'react';
import type { LensMode } from '@bim-ai/core';
import { Icons } from '@bim-ai/ui';

import { normalizePaneLayout, type PaneLayoutState, type PaneNode } from './paneLayout';
import type { TabsState, ViewTab } from './tabsModel';

export type WorkspaceComposition = {
  id: string;
  label: string;
  tabsState: TabsState;
  paneLayout: PaneLayoutState;
};

export type WorkspaceCompositionState = {
  activeId: string;
  compositions: WorkspaceComposition[];
};

const COMPOSITIONS_STORAGE_KEY = 'bim-ai:workspace-compositions-v1';

export function nextCompositionId(): string {
  try {
    return `composition-${crypto.randomUUID().slice(0, 8)}`;
  } catch {
    return `composition-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  }
}

function fallbackComposition(
  tabsState: TabsState,
  paneLayout: PaneLayoutState,
): WorkspaceCompositionState {
  const id = nextCompositionId();
  const normalizedPaneLayout = normalizePaneLayout(
    paneLayout,
    tabsState.tabs.map((tab) => tab.id),
    tabsState.activeId,
  );
  return {
    activeId: id,
    compositions: [{ id, label: 'Composition 1', tabsState, paneLayout: normalizedPaneLayout }],
  };
}

export function readPersistedCompositions(
  tabsState: TabsState,
  paneLayout: PaneLayoutState,
): WorkspaceCompositionState {
  if (typeof localStorage === 'undefined') return fallbackComposition(tabsState, paneLayout);
  try {
    const raw = localStorage.getItem(COMPOSITIONS_STORAGE_KEY);
    if (!raw) return fallbackComposition(tabsState, paneLayout);
    const parsed = JSON.parse(raw) as Partial<WorkspaceCompositionState> | null;
    if (!parsed || !Array.isArray(parsed.compositions) || !parsed.compositions.length) {
      return fallbackComposition(tabsState, paneLayout);
    }
    const compositions = parsed.compositions
      .filter((composition): composition is WorkspaceComposition =>
        Boolean(
          composition &&
          typeof composition.id === 'string' &&
          typeof composition.label === 'string' &&
          composition.tabsState &&
          Array.isArray(composition.tabsState.tabs) &&
          composition.paneLayout,
        ),
      )
      .map((composition) => ({
        ...composition,
        paneLayout: normalizePaneLayout(
          composition.paneLayout,
          composition.tabsState.tabs.map((tab) => tab.id),
          composition.tabsState.activeId,
        ),
      }));
    if (!compositions.length) return fallbackComposition(tabsState, paneLayout);
    const activeId =
      typeof parsed.activeId === 'string' &&
      compositions.some((composition) => composition.id === parsed.activeId)
        ? parsed.activeId
        : compositions[0]!.id;
    return { activeId, compositions };
  } catch {
    return fallbackComposition(tabsState, paneLayout);
  }
}

export function persistCompositions(state: WorkspaceCompositionState): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(COMPOSITIONS_STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* noop */
  }
}

export function tabIdForLeaf(root: PaneNode, leafId: string): string | null {
  if (root.kind === 'leaf') return root.id === leafId ? root.tabId : null;
  return tabIdForLeaf(root.first, leafId) ?? tabIdForLeaf(root.second, leafId);
}

export function tabMatchesView(
  tab: ViewTab | null | undefined,
  partial: Omit<ViewTab, 'id'>,
): boolean {
  return Boolean(tab && tab.kind === partial.kind && tab.targetId === partial.targetId);
}

export function uniqueTabInstanceId(state: TabsState, baseId: string): string {
  if (!state.tabs.some((tab) => tab.id === baseId)) return baseId;
  let next = 2;
  let candidate = `${baseId}#${next}`;
  while (state.tabs.some((tab) => tab.id === candidate)) {
    next += 1;
    candidate = `${baseId}#${next}`;
  }
  return candidate;
}

export function upsertTabInstance(state: TabsState, tab: ViewTab): TabsState {
  if (state.tabs.some((existing) => existing.id === tab.id)) {
    return { ...state, activeId: tab.id };
  }
  return { tabs: [...state.tabs, tab], activeId: tab.id };
}

export function updateTabLens(state: TabsState, tabId: string, lensMode: LensMode): TabsState {
  let changed = false;
  const tabs = state.tabs.map((tab) => {
    if (tab.id !== tabId) return tab;
    if (tab.lensMode === lensMode) return tab;
    changed = true;
    return { ...tab, lensMode };
  });
  return changed ? { ...state, tabs } : state;
}

export function CompositionBar({
  compositions,
  activeId,
  loadingId,
  onActivate,
  onCreate,
  onClose,
  onReorder,
  onRename,
}: {
  compositions: WorkspaceComposition[];
  activeId: string;
  loadingId?: string | null;
  onActivate: (id: string) => void;
  onCreate: () => void;
  onClose: (id: string) => void;
  onReorder: (from: number, to: number) => void;
  onRename: (id: string, label: string) => void;
}): JSX.Element {
  const [dragSrc, setDragSrc] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const [renaming, setRenaming] = useState<{ id: string; label: string } | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!renaming) return;
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [renaming]);

  const commitRename = useCallback(
    (id: string, nextLabel: string) => {
      const trimmed = nextLabel.trim();
      const previous = renaming?.id === id ? renaming.label : '';
      setRenaming(null);
      if (!trimmed || trimmed === previous) return;
      onRename(id, trimmed);
    },
    [onRename, renaming],
  );

  return (
    <div
      data-testid="composition-bar"
      role="tablist"
      aria-label="Compositions"
      className="flex min-h-[44px] min-w-0 flex-1 self-stretch items-center gap-1 overflow-x-auto bg-surface"
    >
      {compositions.map((composition, idx) => {
        const active = composition.id === activeId;
        const isDragOver = dragOverIdx === idx && dragSrc !== null && dragSrc !== idx;
        const isRenaming = renaming?.id === composition.id;
        const isLoading = composition.id === loadingId;
        return (
          <div
            key={composition.id}
            role="tab"
            data-testid={`composition-tab-${composition.id}`}
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            draggable
            onClick={() => onActivate(composition.id)}
            onDoubleClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              setRenaming({ id: composition.id, label: composition.label });
            }}
            onKeyDown={(event) => {
              if (event.key === 'F2') {
                event.preventDefault();
                setRenaming({ id: composition.id, label: composition.label });
                return;
              }
              if (event.key === 'Delete' || event.key === 'Backspace') {
                event.preventDefault();
                onClose(composition.id);
                return;
              }
              if (event.key !== 'Enter' && event.key !== ' ') return;
              event.preventDefault();
              onActivate(composition.id);
            }}
            onDragStart={(event) => {
              if (isRenaming) return;
              setDragSrc(idx);
              event.dataTransfer.effectAllowed = 'move';
              event.dataTransfer.setData('text/plain', String(idx));
            }}
            onDragOver={(event) => {
              if (dragSrc === null) return;
              event.preventDefault();
              event.dataTransfer.dropEffect = 'move';
              setDragOverIdx(idx);
            }}
            onDragLeave={() => {
              if (dragOverIdx === idx) setDragOverIdx(null);
            }}
            onDrop={(event) => {
              if (dragSrc === null) return;
              event.preventDefault();
              if (dragSrc !== idx) onReorder(dragSrc, idx);
              setDragSrc(null);
              setDragOverIdx(null);
            }}
            onDragEnd={() => {
              setDragSrc(null);
              setDragOverIdx(null);
            }}
            className={[
              'group relative flex h-8 max-w-52 shrink-0 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium transition-colors',
              active
                ? 'border-accent/60 bg-accent/10 text-foreground'
                : 'border-transparent text-muted/70 hover:border-border hover:bg-background/40 hover:text-foreground',
              isDragOver ? 'ring-2 ring-accent ring-offset-0' : '',
            ].join(' ')}
            title={composition.label}
          >
            {isLoading ? (
              <LoadingSpinner className={active ? 'text-accent' : 'text-muted'} />
            ) : (
              <Icons.grid
                size={13}
                aria-hidden="true"
                className={active ? 'text-accent' : 'text-muted'}
              />
            )}
            {isRenaming ? (
              <input
                ref={inputRef}
                defaultValue={composition.label}
                aria-label={`Rename ${composition.label}`}
                data-testid={`composition-rename-input-${composition.id}`}
                className="min-w-24 flex-1 rounded border border-accent bg-background px-1 py-0.5 text-[12px] text-foreground outline-none"
                onClick={(event) => event.stopPropagation()}
                onDoubleClick={(event) => event.stopPropagation()}
                onBlur={(event) => commitRename(composition.id, event.currentTarget.value)}
                onKeyDown={(event) => {
                  event.stopPropagation();
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    event.currentTarget.blur();
                  } else if (event.key === 'Escape') {
                    event.preventDefault();
                    setRenaming(null);
                  }
                }}
              />
            ) : (
              <span className="truncate whitespace-nowrap">{composition.label}</span>
            )}
            {!isRenaming ? (
              <button
                type="button"
                aria-label={`Close ${composition.label}`}
                data-testid={`composition-close-${composition.id}`}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  onClose(composition.id);
                }}
                draggable={false}
                className={[
                  'ml-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded text-muted transition-opacity hover:bg-surface-strong hover:text-foreground',
                  active
                    ? 'opacity-60 hover:opacity-100'
                    : 'opacity-0 group-hover:opacity-70 group-hover:hover:opacity-100',
                ].join(' ')}
              >
                <Icons.close size={11} aria-hidden="true" />
              </button>
            ) : null}
          </div>
        );
      })}
      <button
        type="button"
        data-testid="composition-add-button"
        aria-label="Create composition"
        title="Create composition"
        onClick={onCreate}
        className="ml-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded text-base leading-none text-muted hover:bg-surface-strong hover:text-foreground"
      >
        +
      </button>
    </div>
  );
}

function LoadingSpinner({ className = 'text-accent' }: { className?: string }): JSX.Element {
  return (
    <span
      aria-hidden="true"
      className={[
        'inline-block h-[13px] w-[13px] shrink-0 rounded-full border-2 border-current border-t-transparent motion-safe:animate-spin motion-safe:[animation-duration:650ms]',
        className,
      ].join(' ')}
    />
  );
}
