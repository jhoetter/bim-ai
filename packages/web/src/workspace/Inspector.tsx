import {
  type ChangeEvent,
  type CSSProperties,
  type FormEvent,
  type JSX,
  type KeyboardEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useState,
} from 'react';
import { Icons, IconLabels, ICON_SIZE, type LucideLikeIcon } from '@bim-ai/ui';

/**
 * Inspector / Right rail — spec §13.
 *
 * Anatomy:
 *   - Header: icon + element type + id (mono) + clear-selection button.
 *   - Tabs: Properties / Constraints / Identity (`role="tablist"`).
 *   - Body: render the active tab; consumers pass each tab's content
 *     through `tabs.{properties,constraints,identity}` props.
 *   - Sticky footer: Apply (Enter) / Reset (Esc) — only visible when the
 *     inspector reports `dirty=true`.
 *
 * `evaluateExpression` exposes the §13.3 numeric-field grammar
 * (`2400 + 200`, `1500 / 2` etc.) so inspector callers can wire it into
 * their numeric inputs uniformly. `<NumericField>` is a primitive that
 * uses the evaluator + an optional unit chip (mm / cm / m).
 *
 * Empty state: when `selection` is null, an instruction block renders the
 * tool-mode "quick actions" hint set instead of the tab UI.
 */

export type InspectorTab = 'properties' | 'constraints' | 'identity' | 'graphics';

export interface InspectorSelection {
  /** Lucide icon to show in the header next to the type. */
  icon?: LucideLikeIcon;
  /** Human-readable element type, e.g. "Wall · Generic 200 mm". */
  label: string;
  /** Element id (rendered in mono). */
  id: string;
}

export interface InspectorProps {
  selection: InspectorSelection | null;
  tabs: {
    properties: ReactNode;
    constraints?: ReactNode;
    identity?: ReactNode;
    /** When provided, a "Graphics" tab appears after Identity. */
    graphics?: ReactNode;
  };
  /** Quick-action lines for the empty state — typically tool hints
   * sourced from the active mode. `onTrigger` makes them clickable; if
   * omitted, rows render as static hints with a key chip only. */
  emptyStateActions?: { hotkey: string; label: string; onTrigger?: () => void }[];
  /** When `true` Apply / Reset footer is shown. */
  dirty?: boolean;
  onApply?: () => void;
  onReset?: () => void;
  onClearSelection?: () => void;
  /** Initial active tab; uncontrolled. */
  defaultTab?: InspectorTab;
}

export function Inspector({
  selection,
  tabs,
  emptyStateActions,
  dirty = false,
  onApply,
  onReset,
  onClearSelection,
  defaultTab = 'properties',
}: InspectorProps): JSX.Element {
  const [activeTab, setActiveTab] = useState<InspectorTab>(defaultTab);
  const tablistId = useId();

  const hasGraphics = tabs.graphics !== undefined;
  const tabDefs = useMemo<{ id: InspectorTab; label: string }[]>(() => {
    const defs: { id: InspectorTab; label: string }[] = [
      { id: 'properties', label: 'Properties' },
      { id: 'constraints', label: 'Constraints' },
      { id: 'identity', label: 'Identity' },
    ];
    if (hasGraphics) defs.push({ id: 'graphics', label: 'Graphics' });
    return defs;
  }, [hasGraphics]);

  useEffect(() => {
    if (activeTab === 'graphics' && !hasGraphics) setActiveTab('properties');
  }, [activeTab, hasGraphics]);

  const handleTabKey = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
      const idx = tabDefs.findIndex((t) => t.id === activeTab);
      if (idx < 0) return;
      const delta = event.key === 'ArrowRight' ? 1 : -1;
      const next = tabDefs[(idx + delta + tabDefs.length) % tabDefs.length];
      event.preventDefault();
      setActiveTab(next.id);
    },
    [activeTab, tabDefs],
  );

  const tabBody = useMemo(() => {
    if (!selection) return null;
    switch (activeTab) {
      case 'properties':
        return tabs.properties;
      case 'constraints':
        return tabs.constraints ?? <EmptyTab message="No constraints for this element." />;
      case 'identity':
        return tabs.identity ?? <EmptyTab message="No identity metadata." />;
      case 'graphics':
        return tabs.graphics ?? null;
      default:
        return null;
    }
  }, [activeTab, selection, tabs]);

  return (
    <div
      className="flex h-full flex-col overflow-hidden bg-surface"
      data-testid="inspector"
      data-dirty={dirty ? 'true' : 'false'}
    >
      {selection ? (
        <>
          <InspectorHeader selection={selection} onClearSelection={onClearSelection} />
          <div
            role="tablist"
            id={tablistId}
            aria-label="Inspector tabs"
            onKeyDown={handleTabKey}
            className="flex border-b border-border px-3"
          >
            {tabDefs.map((t) => {
              const active = t.id === activeTab;
              return (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  aria-controls={`${tablistId}-panel-${t.id}`}
                  tabIndex={active ? 0 : -1}
                  onClick={() => setActiveTab(t.id)}
                  data-active={active ? 'true' : 'false'}
                  className={[
                    'px-3 py-2 text-sm transition-colors',
                    active
                      ? 'border-b-2 border-accent text-foreground'
                      : 'border-b-2 border-transparent text-muted hover:text-foreground',
                  ].join(' ')}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
          <div
            role="tabpanel"
            id={`${tablistId}-panel-${activeTab}`}
            aria-labelledby={tablistId}
            className="flex-1 overflow-y-auto px-3 py-3"
          >
            {tabBody}
          </div>
          {dirty ? <InspectorFooter onApply={onApply} onReset={onReset} /> : null}
        </>
      ) : (
        <InspectorEmpty actions={emptyStateActions ?? []} />
      )}
    </div>
  );
}

function InspectorHeader({
  selection,
  onClearSelection,
}: {
  selection: InspectorSelection;
  onClearSelection?: () => void;
}): JSX.Element {
  const Icon = selection.icon;
  return (
    <div className="flex items-start gap-3 border-b border-border px-3 py-3">
      <div className="flex h-9 w-9 items-center justify-center rounded-md bg-surface-strong">
        {Icon ? <Icon size={ICON_SIZE.toolPalette} aria-hidden="true" /> : null}
      </div>
      <div className="flex flex-1 flex-col">
        <div className="text-sm font-medium text-foreground">{selection.label}</div>
        <div className="font-mono text-xs text-muted">id · {selection.id}</div>
      </div>
      <button
        type="button"
        onClick={onClearSelection}
        aria-label={IconLabels.close}
        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted hover:bg-surface-strong"
      >
        <Icons.close size={ICON_SIZE.chrome} aria-hidden="true" />
      </button>
    </div>
  );
}

function InspectorFooter({
  onApply,
  onReset,
}: {
  onApply?: () => void;
  onReset?: () => void;
}): JSX.Element {
  const handleKey = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        onApply?.();
      } else if (event.key === 'Escape') {
        event.preventDefault();
        onReset?.();
      }
    },
    [onApply, onReset],
  );
  return (
    <div
      onKeyDown={handleKey}
      className="sticky bottom-0 flex items-center justify-end gap-2 border-t border-border bg-surface px-3 py-2"
    >
      <button
        type="button"
        onClick={onReset}
        className="rounded-md px-2 py-1 text-sm text-muted hover:bg-surface-strong"
      >
        Reset (Esc)
      </button>
      <button
        type="button"
        onClick={onApply}
        className="rounded-md bg-accent px-3 py-1 text-sm text-accent-foreground hover:opacity-90"
      >
        Apply (⏎)
      </button>
    </div>
  );
}

function InspectorEmpty({
  actions,
}: {
  actions: { hotkey: string; label: string; onTrigger?: () => void }[];
}): JSX.Element {
  return (
    <div className="flex flex-1 flex-col gap-3 px-3 py-6 text-sm">
      <p className="text-foreground">No selection.</p>
      <p className="text-xs text-muted">
        Click an element on the canvas, or press <kbd>V</kbd> to select.
      </p>
      {actions.length ? (
        <div className="rounded-md border border-border bg-surface-strong p-3">
          <div
            className="mb-2 text-xs uppercase text-muted"
            style={{ letterSpacing: 'var(--text-eyebrow-tracking)' }}
          >
            Quick actions
          </div>
          <ul className="flex flex-col gap-1">
            {actions.map((a) => {
              const inner = (
                <>
                  <span>{a.label}</span>
                  <kbd className="rounded-sm bg-background px-1.5 py-0.5 font-mono text-[11px] text-muted">
                    {a.hotkey}
                  </kbd>
                </>
              );
              if (a.onTrigger) {
                return (
                  <li key={`${a.hotkey}:${a.label}`}>
                    <button
                      type="button"
                      onClick={a.onTrigger}
                      data-testid={`inspector-quick-action-${a.hotkey.toLowerCase()}`}
                      className="flex w-full items-center justify-between rounded px-1.5 py-1 text-left text-xs text-foreground hover:bg-background"
                    >
                      {inner}
                    </button>
                  </li>
                );
              }
              return (
                <li
                  key={`${a.hotkey}:${a.label}`}
                  className="flex items-center justify-between text-xs text-foreground"
                >
                  {inner}
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function EmptyTab({ message }: { message: string }): JSX.Element {
  return <div className="px-1 py-2 text-xs text-muted">{message}</div>;
}

/* ────────────────────────────────────────────────────────────────────── */
/* Numeric expression evaluator — §13.3                                    */
/* ────────────────────────────────────────────────────────────────────── */

/**
 * Evaluate a §13.3 numeric expression. Supports `+`, `-`, `*`, `/`,
 * parentheses, and decimal numbers. Returns `null` for invalid input
 * so callers can keep the prior value and surface an error inline.
 */
export function evaluateExpression(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (!/^[\d+\-*/().\s]+$/.test(trimmed)) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    const value = Function(`'use strict'; return (${trimmed});`)();
    return Number.isFinite(value) ? Number(value) : null;
  } catch {
    return null;
  }
}

const UNIT_CYCLE = ['mm', 'cm', 'm'] as const;
export type LengthUnit = (typeof UNIT_CYCLE)[number];

function unitToMm(value: number, unit: LengthUnit): number {
  if (unit === 'mm') return value;
  if (unit === 'cm') return value * 10;
  return value * 1000;
}

function mmToUnit(valueMm: number, unit: LengthUnit): number {
  if (unit === 'mm') return valueMm;
  if (unit === 'cm') return valueMm / 10;
  return valueMm / 1000;
}

export interface NumericFieldProps {
  label: string;
  valueMm: number;
  onCommitMm: (next: number) => void;
  unit?: LengthUnit;
  step?: number;
  ariaLabel?: string;
}

/** Numeric field with mm-canonical state but human-friendly unit chip.
 * On commit (Enter or blur) the input is evaluated as an expression. */
export function NumericField({
  label,
  valueMm,
  onCommitMm,
  unit: initialUnit = 'mm',
  step = 1,
  ariaLabel,
}: NumericFieldProps): JSX.Element {
  const [unit, setUnit] = useState<LengthUnit>(initialUnit);
  const [draft, setDraft] = useState<string>(() => formatForUnit(valueMm, initialUnit));
  const [error, setError] = useState<boolean>(false);

  useEffect(() => {
    setDraft(formatForUnit(valueMm, unit));
    setError(false);
  }, [unit, valueMm]);

  const cycleUnit = useCallback(() => {
    const idx = UNIT_CYCLE.indexOf(unit);
    setUnit(UNIT_CYCLE[(idx + 1) % UNIT_CYCLE.length]);
  }, [unit]);

  const commit = useCallback(
    (raw: string) => {
      const evaluated = evaluateExpression(raw);
      if (evaluated === null) {
        setError(true);
        return;
      }
      onCommitMm(unitToMm(evaluated, unit));
    },
    [onCommitMm, unit],
  );

  const handleSubmit = (e: FormEvent<HTMLFormElement>): void => {
    e.preventDefault();
    commit(draft);
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>): void => {
    setDraft(e.target.value);
    if (error) setError(false);
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-1">
      <label className="text-xs text-muted">{label}</label>
      <div
        className={[
          'flex items-center gap-1 rounded-md border bg-background px-2 py-1 text-sm focus-within:ring-2 focus-within:ring-offset-0',
          error ? 'border-danger' : 'border-border',
        ].join(' ')}
      >
        <input
          type="text"
          inputMode="decimal"
          value={draft}
          aria-label={ariaLabel ?? label}
          aria-invalid={error}
          step={step}
          onChange={handleChange}
          onBlur={() => commit(draft)}
          className="flex-1 bg-transparent text-foreground outline-none"
        />
        <button
          type="button"
          onClick={cycleUnit}
          aria-label={`Cycle units (current: ${unit})`}
          className="rounded-sm border border-border px-1.5 text-xs text-muted hover:bg-surface-strong"
        >
          {unit}
        </button>
      </div>
    </form>
  );
}

function formatForUnit(valueMm: number, unit: LengthUnit): string {
  const v = mmToUnit(valueMm, unit);
  if (Number.isInteger(v)) return v.toString();
  return v.toFixed(unit === 'mm' ? 0 : unit === 'cm' ? 1 : 3);
}

export const InspectorStyle: CSSProperties = {
  fontSize: 'var(--text-sm)',
};
