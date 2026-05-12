import {
  type BimIconHifiProps,
  FamilyHifi,
  LevelHifi,
  PlanViewHifi,
  ScheduleViewHifi,
  SectionViewHifi,
  SheetHifi,
  WallLayerHifi,
} from '@bim-ai/icons';
import {
  type CSSProperties,
  type ComponentType,
  type JSX,
  type KeyboardEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { Icons, IconLabels, ICON_SIZE, type LucideLikeIcon } from '@bim-ai/ui';

/**
 * LeftRail / Project Browser — spec §12.
 *
 * - Sticky header with a search field that filters every row by label / id.
 * - Vertically stacked sections (PROJECT / VIEWS / SHEETS / SCHEDULES /
 *   FAMILIES / EVIDENCE) with uppercase eyebrow labels.
 * - `role="tree"` semantics; each row is a `treeitem` with `aria-expanded`
 *   when it has children. Disclosure triangle is a lucide chevron.
 * - Keyboard: `ArrowDown`/`ArrowUp` move focus row-to-row; `ArrowRight`
 *   expands a closed parent or moves into its first child; `ArrowLeft`
 *   collapses an open parent or moves to its parent. `Enter` activates
 *   the focused row. `F2` invokes `onRename(rowId)`.
 *
 * Caller owns activeRowId, expansion state by default (uncontrolled), and
 * drag-drop reorder. The collapsed (icon-strip) variant is exposed as
 * `<LeftRailCollapsed/>` so AppShell can swap on `[`.
 */

export type LeftRailSection = {
  id: string;
  label: string;
  icon?: LucideLikeIcon;
  rows: LeftRailRow[];
};

export type LeftRailRow = {
  id: string;
  label: string;
  /** Lucide icon component to render at 12 px. Optional. */
  icon?: LucideLikeIcon;
  /** Subrows if any — drives the disclosure triangle and `aria-expanded`. */
  children?: LeftRailRow[];
  /** Optional secondary line shown after the label (muted). */
  hint?: string;
};

export interface LeftRailProps {
  sections: LeftRailSection[];
  activeRowId?: string;
  onRowActivate?: (id: string) => void;
  onRowRename?: (id: string) => void;
  /** Initial expanded set; uncontrolled. */
  defaultExpanded?: ReadonlySet<string>;
  /** Optional hook for context-menu invocation (right-click). */
  onRowContextMenu?: (id: string, event: { x: number; y: number }) => void;
}

/** Flatten sections + rows into a focusable order list. */
function flatten(
  sections: LeftRailSection[],
  expanded: ReadonlySet<string>,
): { id: string; depth: number; row: LeftRailRow; sectionId: string }[] {
  const out: { id: string; depth: number; row: LeftRailRow; sectionId: string }[] = [];
  function visit(rows: LeftRailRow[], depth: number, sectionId: string): void {
    for (const r of rows) {
      out.push({ id: r.id, depth, row: r, sectionId });
      if (r.children && r.children.length && expanded.has(r.id)) {
        visit(r.children, depth + 1, sectionId);
      }
    }
  }
  for (const s of sections) visit(s.rows, 0, s.id);
  return out;
}

function matchesQuery(row: LeftRailRow, q: string): boolean {
  if (!q) return true;
  const needle = q.toLowerCase();
  if (row.label.toLowerCase().includes(needle)) return true;
  if (row.id.toLowerCase().includes(needle)) return true;
  if (row.hint?.toLowerCase().includes(needle)) return true;
  if (row.children) return row.children.some((c) => matchesQuery(c, q));
  return false;
}

function filterRows(rows: LeftRailRow[], q: string): LeftRailRow[] {
  if (!q) return rows;
  const out: LeftRailRow[] = [];
  for (const r of rows) {
    if (matchesQuery(r, q)) {
      const filteredChildren = r.children ? filterRows(r.children, q) : undefined;
      out.push({ ...r, children: filteredChildren });
    }
  }
  return out;
}

export function LeftRail({
  sections,
  activeRowId,
  onRowActivate,
  onRowRename,
  defaultExpanded,
  onRowContextMenu,
}: LeftRailProps): JSX.Element {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(defaultExpanded ?? []));
  const [query, setQuery] = useState('');
  const [focusedId, setFocusedId] = useState<string | undefined>(activeRowId);

  const filteredSections = useMemo(
    () =>
      query
        ? sections
            .map((s) => ({ ...s, rows: filterRows(s.rows, query) }))
            .filter((s) => s.rows.length > 0)
        : sections,
    [sections, query],
  );

  // Auto-expand all rows during search so matches are visible.
  const liveExpanded = useMemo(() => {
    if (!query) return expanded;
    const all = new Set<string>(expanded);
    function collect(rows: LeftRailRow[]): void {
      for (const r of rows) {
        if (r.children?.length) {
          all.add(r.id);
          collect(r.children);
        }
      }
    }
    for (const s of filteredSections) collect(s.rows);
    return all;
  }, [filteredSections, expanded, query]);

  const flat = useMemo(
    () => flatten(filteredSections, liveExpanded),
    [filteredSections, liveExpanded],
  );

  const moveFocus = useCallback(
    (delta: 1 | -1) => {
      if (!flat.length) return;
      const idx = focusedId ? flat.findIndex((r) => r.id === focusedId) : -1;
      const next = flat[(idx + delta + flat.length) % flat.length];
      setFocusedId(next.id);
    },
    [flat, focusedId],
  );

  const handleKey = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        moveFocus(1);
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        moveFocus(-1);
      } else if (event.key === 'ArrowRight') {
        if (!focusedId) return;
        event.preventDefault();
        setExpanded((prev) => {
          const next = new Set(prev);
          next.add(focusedId);
          return next;
        });
      } else if (event.key === 'ArrowLeft') {
        if (!focusedId) return;
        event.preventDefault();
        setExpanded((prev) => {
          if (!prev.has(focusedId)) return prev;
          const next = new Set(prev);
          next.delete(focusedId);
          return next;
        });
      } else if (event.key === 'Enter') {
        if (!focusedId) return;
        event.preventDefault();
        onRowActivate?.(focusedId);
      } else if (event.key === 'F2') {
        if (!focusedId) return;
        event.preventDefault();
        onRowRename?.(focusedId);
      } else if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) {
        if (!focusedId) return;
        event.preventDefault();
        const rect = event.currentTarget.getBoundingClientRect();
        onRowContextMenu?.(focusedId, { x: rect.left + 32, y: rect.top + 32 });
      }
    },
    [focusedId, moveFocus, onRowActivate, onRowContextMenu, onRowRename],
  );

  return (
    <div className="flex h-full flex-col overflow-hidden bg-surface">
      <div className="sticky top-0 z-10 border-b border-border bg-surface px-3 py-2">
        <SearchField value={query} onChange={setQuery} />
      </div>
      <div
        role="tree"
        aria-label={t('workspace.projectBrowser')}
        tabIndex={0}
        onKeyDown={handleKey}
        className="flex-1 overflow-y-auto py-2"
      >
        {filteredSections.map((s) => (
          <SectionBlock key={s.id} section={s}>
            {s.rows.map((r) => (
              <Row
                key={r.id}
                row={r}
                depth={0}
                expanded={liveExpanded}
                onToggle={(id) =>
                  setExpanded((prev) => {
                    const next = new Set(prev);
                    if (next.has(id)) next.delete(id);
                    else next.add(id);
                    return next;
                  })
                }
                onActivate={onRowActivate}
                onContextMenu={onRowContextMenu}
                activeRowId={activeRowId}
                focusedRowId={focusedId}
                setFocused={setFocusedId}
              />
            ))}
          </SectionBlock>
        ))}
        {filteredSections.length === 0 ? (
          <div className="px-5 py-3 text-xs text-muted">No matches.</div>
        ) : null}
      </div>
    </div>
  );
}

/** Slim (56 px) icon strip used by AppShell when the rail is collapsed. */
export function LeftRailCollapsed({
  sections,
  activeRowId,
  onExpand,
}: {
  sections: LeftRailSection[];
  activeRowId?: string;
  onExpand?: () => void;
}): JSX.Element {
  const { t } = useTranslation();
  const activeSectionId = activeRowId
    ? sections.find((section) => sectionContainsRow(section.rows, activeRowId))?.id
    : undefined;
  return (
    <nav
      aria-label={t('workspace.projectBrowserSections')}
      className="flex h-full flex-col items-center gap-1 border-r border-border bg-surface py-2"
    >
      {/* Expand toggle at top — clear affordance */}
      <button
        type="button"
        aria-label={t('workspace.expandSidebar', { defaultValue: 'Expand sidebar' })}
        title={t('workspace.expandSidebar', { defaultValue: 'Expand sidebar' })}
        onClick={onExpand}
        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted transition-colors hover:bg-surface-strong hover:text-foreground"
      >
        <Icons.hamburger size={ICON_SIZE.chrome} aria-hidden="true" />
      </button>
      {/* Separator */}
      <div className="my-1 h-px w-5 bg-border" aria-hidden="true" />
      {/* Section shortcuts — clicking also expands */}
      {sections.map((s) => {
        const HifiIcon = hifiIconForSection(s.id);
        const Icon = s.icon ?? Icons.disclosureClosed;
        const isActive = activeSectionId === s.id;
        const rowCount = countRows(s.rows);
        return (
          <button
            key={s.id}
            type="button"
            aria-label={`${s.label}${rowCount ? `, ${rowCount} items` : ''}`}
            title={`${s.label}${rowCount ? ` · ${rowCount}` : ''}`}
            data-active={isActive ? 'true' : 'false'}
            onClick={onExpand}
            className={[
              'relative inline-flex h-9 w-9 items-center justify-center rounded-md transition-colors hover:bg-surface-strong hover:text-foreground',
              isActive ? 'bg-accent/15 text-accent' : 'text-foreground/75',
            ].join(' ')}
          >
            {HifiIcon ? (
              <HifiIcon size={25} aria-hidden="true" />
            ) : (
              <Icon size={ICON_SIZE.chrome} aria-hidden="true" />
            )}
            {isActive ? (
              <span
                aria-hidden="true"
                className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r bg-accent"
              />
            ) : null}
          </button>
        );
      })}
    </nav>
  );
}

function sectionContainsRow(rows: LeftRailRow[], rowId: string): boolean {
  for (const row of rows) {
    if (row.id === rowId) return true;
    if (row.children && sectionContainsRow(row.children, rowId)) return true;
  }
  return false;
}

function countRows(rows: LeftRailRow[]): number {
  let total = 0;
  for (const row of rows) {
    total += 1;
    if (row.children) total += countRows(row.children);
  }
  return total;
}

function hifiIconForSection(sectionId: string): ComponentType<BimIconHifiProps> | undefined {
  const normalized = sectionId.toLowerCase();
  if (normalized.includes('level') || normalized.includes('project')) return LevelHifi;
  if (normalized.includes('view')) return PlanViewHifi;
  if (normalized.includes('sheet')) return SheetHifi;
  if (normalized.includes('schedule')) return ScheduleViewHifi;
  if (normalized.includes('section')) return SectionViewHifi;
  if (normalized.includes('type')) return WallLayerHifi;
  if (normalized.includes('family')) return FamilyHifi;
  return undefined;
}

function SearchField({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}): JSX.Element {
  const { t } = useTranslation();
  return (
    <label className="flex items-center gap-2 rounded-md border border-transparent bg-surface-strong px-2 py-1.5 text-sm focus-within:border-border focus-within:ring-1 focus-within:ring-border focus-within:ring-offset-0">
      <Icons.search size={ICON_SIZE.chrome} className="text-muted" aria-hidden="true" />
      <input
        type="search"
        placeholder={t('workspace.searchProject')}
        aria-label={IconLabels.search}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted"
      />
    </label>
  );
}

function SectionBlock({
  section,
  children,
}: {
  section: LeftRailSection;
  children: ReactNode;
}): JSX.Element {
  return (
    <div className="mb-2">
      <div
        className="flex items-center gap-1.5 px-4 pb-0.5 pt-3 text-[10px] font-semibold uppercase text-muted"
        style={{ letterSpacing: 0, opacity: 0.7 }}
      >
        {section.icon ? <section.icon size={12} aria-hidden="true" /> : null}
        <span>{section.label}</span>
      </div>
      {children}
    </div>
  );
}

interface RowProps {
  row: LeftRailRow;
  depth: number;
  expanded: ReadonlySet<string>;
  onToggle: (id: string) => void;
  onActivate?: (id: string) => void;
  onContextMenu?: (id: string, event: { x: number; y: number }) => void;
  activeRowId?: string;
  focusedRowId?: string;
  setFocused: (id: string) => void;
}

function Row({
  row,
  depth,
  expanded,
  onToggle,
  onActivate,
  onContextMenu,
  activeRowId,
  focusedRowId,
  setFocused,
}: RowProps): JSX.Element {
  const hasChildren = !!row.children?.length;
  const isOpen = expanded.has(row.id);
  const isActive = row.id === activeRowId;
  const isFocused = row.id === focusedRowId;
  const ref = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (isFocused) {
      ref.current?.focus({ preventScroll: true });
      if (typeof ref.current?.scrollIntoView === 'function') {
        ref.current.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [isFocused]);

  const indentStyle: CSSProperties = {
    paddingLeft: `calc(var(--space-5) + ${depth} * var(--space-5))`,
  };

  return (
    <div role="none">
      <button
        ref={ref}
        type="button"
        role="treeitem"
        aria-level={depth + 1}
        aria-expanded={hasChildren ? isOpen : undefined}
        aria-selected={isActive}
        tabIndex={isFocused ? 0 : -1}
        onFocus={() => setFocused(row.id)}
        onClick={() => {
          setFocused(row.id);
          if (hasChildren) onToggle(row.id);
          onActivate?.(row.id);
        }}
        onContextMenu={(event) => {
          if (!onContextMenu) return;
          event.preventDefault();
          onContextMenu(row.id, { x: event.clientX, y: event.clientY });
        }}
        data-testid={`left-rail-row-${row.id}`}
        data-active={isActive ? 'true' : 'false'}
        title={row.hint ? `${row.label} — ${row.hint}` : row.label}
        style={indentStyle}
        className={[
          'flex h-7 w-full items-center gap-1.5 pr-3 text-[13px] transition-colors',
          isActive
            ? 'bg-accent-soft font-medium text-foreground'
            : 'text-foreground/80 hover:bg-surface-strong hover:text-foreground',
        ].join(' ')}
      >
        <span className="inline-flex w-4 items-center justify-center">
          {hasChildren ? (
            isOpen ? (
              <Icons.disclosureOpen size={12} aria-hidden="true" />
            ) : (
              <Icons.disclosureClosed size={12} aria-hidden="true" />
            )
          ) : null}
        </span>
        {row.icon ? <row.icon size={12} aria-hidden="true" className="text-muted" /> : null}
        <span className="truncate">{row.label}</span>
        {row.hint ? <span className="ml-auto truncate text-xs text-muted">{row.hint}</span> : null}
      </button>
      {hasChildren && isOpen
        ? (row.children ?? []).map((c) => (
            <Row
              key={c.id}
              row={c}
              depth={depth + 1}
              expanded={expanded}
              onToggle={onToggle}
              onActivate={onActivate}
              onContextMenu={onContextMenu}
              activeRowId={activeRowId}
              focusedRowId={focusedRowId}
              setFocused={setFocused}
            />
          ))
        : null}
    </div>
  );
}
