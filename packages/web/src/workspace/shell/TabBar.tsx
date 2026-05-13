import { type JSX, useEffect, useRef, useState } from 'react';
import { MoreHorizontal } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ICON_SIZE, Icons, type LucideLikeIcon } from '@bim-ai/ui';

import { type TabKind, type ViewTab } from '../tabsModel';

/**
 * TabBar — spec §11.3.
 *
 * Horizontal strip of open-view tabs sitting between the TopBar and
 * the canvas. Each tab carries a `kind` icon, a truncated label, and a
 * close ✕ button. Trailing `+` opens an "add view" popover.
 */

const TAB_KIND_ICON: Record<TabKind, LucideLikeIcon> = {
  plan: Icons.floor!,
  '3d': Icons.family!, // Component (cube) — used for 3D views
  'plan-3d': Icons.floor!,
  section: Icons.section!,
  sheet: Icons.sheet!,
  schedule: Icons.schedule!,
  agent: Icons.agent!,
  concept: Icons.agent!,
};

export interface TabBarProps {
  tabs: ViewTab[];
  activeId: string | null;
  onActivate: (id: string) => void;
  onClose: (id: string) => void;
  /** Called when the user clicks a "+ {kind}" entry in the trailing
   * popover. The kind names a target the host should resolve (e.g.
   * "+ Plan" → open the active level as a tab). */
  onAdd?: (kind: TabKind) => void;
  /** Called when the user drags a tab to a new position. The host
   * should run the `reorderTab` reducer with the same indices. */
  onReorder?: (fromIdx: number, toIdx: number) => void;
  /** Called when the user clicks "Close Inactive Views" — closes all
   * tabs except the currently active one. */
  onCloseInactive?: () => void;
  /** Emits when a tab drag starts/ends so the canvas can expose split drop zones. */
  onTabDragStart?: (tabId: string) => void;
  onTabDragEnd?: () => void;
}

const ADDABLE_KINDS: TabKind[] = [
  'plan',
  '3d',
  'plan-3d',
  'section',
  'sheet',
  'schedule',
  'agent',
  'concept',
];

export function TabBar({
  tabs,
  activeId,
  onActivate,
  onClose,
  onAdd,
  onReorder,
  onCloseInactive,
  onTabDragStart,
  onTabDragEnd,
}: TabBarProps): JSX.Element {
  const { t } = useTranslation();
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [overflowOpen, setOverflowOpen] = useState(false);
  const [overflowPosition, setOverflowPosition] = useState<{ left: number; top: number } | null>(
    null,
  );
  const [dragSrc, setDragSrc] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const overflowRef = useRef<HTMLDivElement | null>(null);
  const tabBarRef = useRef<HTMLDivElement>(null);

  // Click-outside closes the popover.
  useEffect(() => {
    if (!popoverOpen) return;
    const onDoc = (e: MouseEvent): void => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setPopoverOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [popoverOpen]);

  useEffect(() => {
    if (!overflowOpen) return;
    const onDoc = (e: MouseEvent): void => {
      if (overflowRef.current && !overflowRef.current.contains(e.target as Node)) {
        setOverflowOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [overflowOpen]);

  // Convert vertical scroll to horizontal scroll on the tab bar so a
  // regular mouse wheel (or two-finger vertical swipe) scrolls tabs.
  useEffect(() => {
    const el = tabBarRef.current;
    if (!el) return;
    const onWheel = (ev: WheelEvent): void => {
      if (Math.abs(ev.deltaX) > Math.abs(ev.deltaY)) return; // already horizontal
      ev.preventDefault();
      el.scrollLeft += ev.deltaY;
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  // Scroll the active tab into view whenever activeId changes.
  useEffect(() => {
    if (!activeId || !tabBarRef.current) return;
    const activeEl = tabBarRef.current.querySelector<HTMLElement>(`[data-tab-id="${activeId}"]`);
    if (activeEl && typeof activeEl.scrollIntoView === 'function') {
      activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
    }
  }, [activeId]);

  function handleTabListKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const tabEls = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('[role="tab"]'));
    const idx = tabEls.indexOf(document.activeElement as HTMLElement);
    const next = tabEls[(idx + (e.key === 'ArrowRight' ? 1 : -1) + tabEls.length) % tabEls.length];
    next?.focus();
    e.preventDefault();
  }

  return (
    <div
      ref={tabBarRef}
      role="tablist"
      aria-label={t('workspace.openViews')}
      data-testid="view-tabs"
      onKeyDown={handleTabListKeyDown}
      className="flex items-end gap-0.5 overflow-x-auto border-b border-border bg-surface pt-1.5"
      style={{ height: 38 }}
    >
      {tabs.length === 0 ? (
        <div className="px-2 pb-1.5 text-xs text-muted">{t('workspace.noViewsOpen')}</div>
      ) : null}
      {tabs.map((tab, idx) => {
        const Icon = TAB_KIND_ICON[tab.kind] ?? Icons.floor!;
        const isActive = tab.id === activeId;
        const isDragOver = dragOverIdx === idx && dragSrc !== null && dragSrc !== idx;
        const truncated = tab.label.length > 22 ? tab.label.slice(0, 21) + '…' : tab.label;
        return (
          <div
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            tabIndex={isActive ? 0 : -1}
            data-tab-id={tab.id}
            data-tab-index={idx}
            data-active={isActive ? 'true' : 'false'}
            data-drag-over={isDragOver ? 'true' : 'false'}
            draggable={Boolean(onReorder || onTabDragStart)}
            onClick={() => onActivate(tab.id)}
            onKeyDown={(e) => {
              if (e.key !== 'Enter' && e.key !== ' ') return;
              e.preventDefault();
              onActivate(tab.id);
            }}
            onDragStart={(e) => {
              if (!onReorder && !onTabDragStart) return;
              setDragSrc(idx);
              e.dataTransfer.effectAllowed = 'move';
              try {
                e.dataTransfer.setData('text/plain', String(idx));
                e.dataTransfer.setData('application/x-bim-tab-id', tab.id);
              } catch {
                /* some browsers throw on setData inside synthetic events */
              }
              onTabDragStart?.(tab.id);
            }}
            onDragOver={(e) => {
              if (!onReorder || dragSrc === null) return;
              e.preventDefault();
              e.dataTransfer.dropEffect = 'move';
              if (dragOverIdx !== idx) setDragOverIdx(idx);
            }}
            onDragLeave={() => {
              if (dragOverIdx === idx) setDragOverIdx(null);
            }}
            onDrop={(e) => {
              if (!onReorder || dragSrc === null) return;
              e.preventDefault();
              if (dragSrc !== idx) onReorder(dragSrc, idx);
              setDragSrc(null);
              setDragOverIdx(null);
            }}
            onDragEnd={() => {
              setDragSrc(null);
              setDragOverIdx(null);
              onTabDragEnd?.();
            }}
            className={[
              'group flex items-center gap-1.5 rounded-t-md border border-b-0 px-3 py-1.5 text-[12px] font-medium transition-colors',
              isActive
                ? 'border-border/60 bg-background text-foreground'
                : 'border-transparent text-muted/70 hover:bg-background/40 hover:text-foreground',
              isDragOver ? 'ring-2 ring-accent ring-offset-0' : '',
            ].join(' ')}
            style={
              isActive
                ? {
                    boxShadow: 'inset 0 -2px 0 0 var(--color-accent)',
                  }
                : undefined
            }
          >
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onActivate(tab.id);
              }}
              aria-label={`${t(`workspace.tabs.${tab.kind}`)}: ${tab.label}`}
              className="flex items-center gap-1.5 rounded"
              title={`${t(`workspace.tabs.${tab.kind}`)} · ${tab.label}`}
              data-testid={`tab-activate-${tab.id}`}
            >
              <Icon
                size={13}
                aria-hidden="true"
                className={isActive ? 'text-accent' : 'text-muted'}
              />
              <span className="whitespace-nowrap">{truncated}</span>
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onClose(tab.id);
              }}
              aria-label={t('workspace.closeTab', { label: tab.label })}
              data-testid={`tab-close-${tab.id}`}
              className={[
                'rounded p-0.5 hover:bg-surface-strong',
                isActive
                  ? 'opacity-50 hover:opacity-100'
                  : 'opacity-0 group-hover:opacity-50 group-hover:hover:opacity-100',
              ].join(' ')}
            >
              <Icons.close size={11} aria-hidden="true" />
            </button>
          </div>
        );
      })}
      <div className="relative ml-1 mb-1.5" ref={popoverRef}>
        <button
          type="button"
          onClick={() => setPopoverOpen((v) => !v)}
          aria-label={t('workspace.openNewView')}
          aria-expanded={popoverOpen}
          aria-haspopup="menu"
          data-testid="tab-add-button"
          className="flex h-6 w-6 items-center justify-center rounded text-muted hover:bg-surface-strong hover:text-foreground"
          style={{ fontSize: 16, lineHeight: 1 }}
        >
          +
        </button>
        {popoverOpen ? (
          <div
            role="menu"
            data-testid="tab-add-popover"
            className="absolute left-0 top-full z-30 mt-1 flex min-w-[180px] flex-col rounded-md border border-border bg-surface shadow-elev-2"
            ref={(el) => el?.querySelector<HTMLElement>('[role="menuitem"]')?.focus()}
            onKeyDown={(e) => {
              const items = Array.from(
                e.currentTarget.querySelectorAll<HTMLElement>('[role="menuitem"]'),
              );
              const idx = items.indexOf(document.activeElement as HTMLElement);
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                items[(idx + 1) % items.length]?.focus();
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                items[(idx - 1 + items.length) % items.length]?.focus();
              } else if (e.key === 'Escape') {
                e.preventDefault();
                setPopoverOpen(false);
              }
            }}
          >
            {ADDABLE_KINDS.map((kind) => {
              const Icon = TAB_KIND_ICON[kind];
              return (
                <button
                  key={kind}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setPopoverOpen(false);
                    onAdd?.(kind);
                  }}
                  className="flex items-center gap-2 px-3 py-1.5 text-left text-xs text-foreground hover:bg-surface-strong"
                  data-testid={`tab-add-${kind}`}
                >
                  <Icon size={ICON_SIZE.chrome} aria-hidden="true" />
                  <span>+ {t(`workspace.tabs.${kind}`)}</span>
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
      {onCloseInactive && tabs.length > 1 ? (
        <div className="relative ml-0.5 mb-1.5" ref={overflowRef}>
          <button
            type="button"
            data-testid="tab-overflow-button"
            aria-label="Tab options"
            aria-expanded={overflowOpen}
            aria-haspopup="menu"
            title="Tab options"
            onClick={(event) => {
              const nextOpen = !overflowOpen;
              if (nextOpen) {
                const rect = event.currentTarget.getBoundingClientRect();
                setOverflowPosition({
                  left: Math.max(8, rect.right - 170),
                  top: rect.bottom + 4,
                });
              }
              setOverflowOpen(nextOpen);
            }}
            className="flex h-6 w-6 items-center justify-center rounded text-muted hover:bg-surface-strong hover:text-foreground"
          >
            <MoreHorizontal size={14} aria-hidden="true" />
          </button>
          {overflowOpen ? (
            <div
              role="menu"
              data-testid="tab-overflow-menu"
              className="fixed z-50 flex min-w-[170px] flex-col rounded-md border border-border bg-surface py-1 shadow-elev-2"
              style={{
                left: overflowPosition?.left ?? 8,
                top: overflowPosition?.top ?? 42,
              }}
            >
              <button
                type="button"
                role="menuitem"
                data-testid="close-inactive-tabs"
                onClick={() => {
                  setOverflowOpen(false);
                  onCloseInactive();
                }}
                className="flex items-center gap-2 px-3 py-1.5 text-left text-xs text-foreground hover:bg-surface-strong"
              >
                <Icons.close size={ICON_SIZE.chrome} aria-hidden="true" />
                <span>Close inactive views</span>
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
