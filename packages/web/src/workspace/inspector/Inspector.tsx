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
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { Icons, IconLabels, ICON_SIZE, type LucideLikeIcon } from '@bim-ai/ui';
import { evaluateFormula } from '../../lib/expressionEvaluator';

/**
 * Inspector / Right rail — spec §13 + CHR-V3-06.
 *
 * CHR-V3-06 additions:
 *   - When `selection` is null, the Inspector returns null (absent from DOM),
 *     not a visible empty-state shell.
 *   - A CSS `@keyframes inspector-slide-in` drives 200 ms translateX(100%→0)
 *     re-entry every time the component mounts (i.e. key={selectedId}).
 *   - When `siblingCount > 1`, a segmented radio ("Applies to: this / all N")
 *     appears at the top of the Properties tab body.
 *   - `InspectorDrawer`: non-modal slide-over for type/material edits.
 *     `aria-modal="false"` keeps the canvas interactive.
 *
 * `evaluateExpression` exposes the §13.3 numeric-field grammar
 * (`2400 + 200`, `1500 / 2` etc.) so inspector callers can wire it into
 * their numeric inputs uniformly. `<NumericField>` is a primitive that
 * uses the evaluator + an optional unit chip (mm / cm / m).
 */

export type InspectorTab = 'properties' | 'constraints' | 'identity' | 'graphics' | 'evidence';
export type InspectorPropertiesContext = 'properties' | 'instance' | 'type' | 'view';

/** CHR-V3-06: scope for bulk-edit radio. */
export type InspectorApplyScope = 'this' | 'all';

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
    /** Professional evidence/provenance details. Collapsed away from everyday properties. */
    evidence?: ReactNode;
  };
  /** Quick-action lines for the empty state — not used when selection is null
   * (Inspector is absent from DOM). Kept for API compatibility. */
  emptyStateActions?: { hotkey: string; label: string; onTrigger?: () => void }[];
  /** When `true` Apply / Reset footer is shown. */
  dirty?: boolean;
  onApply?: () => void;
  onReset?: () => void;
  onClearSelection?: () => void;
  /** Initial active tab; uncontrolled. */
  defaultTab?: InspectorTab;
  /** Context-sensitive label for the first tab. */
  propertiesContext?: InspectorPropertiesContext;
  /**
   * CHR-V3-06: number of sibling elements of the same kind in the model.
   * When > 1, an "Applies to: this / all N" radio appears at the top of
   * the Properties tab.
   */
  siblingCount?: number;
  /** CHR-V3-06: fired when the user switches the applies-to radio. */
  onApplyScopeChange?: (scope: InspectorApplyScope) => void;
}

export function Inspector({
  selection,
  tabs,
  dirty = false,
  onApply,
  onReset,
  onClearSelection,
  defaultTab = 'properties',
  propertiesContext = 'properties',
  siblingCount = 1,
  onApplyScopeChange,
}: InspectorProps): JSX.Element | null {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<InspectorTab>(defaultTab);
  const [applyScope, setApplyScope] = useState<InspectorApplyScope>('this');
  const tablistId = useId();
  const radioGroupId = useId();

  // Compute hasGraphics before the early-return so hook count is stable.
  const hasGraphics = tabs.graphics !== undefined;
  const hasEvidence = tabs.evidence !== undefined;

  const propertiesLabel =
    propertiesContext === 'type'
      ? 'Type'
      : propertiesContext === 'instance'
        ? 'Instance'
        : propertiesContext === 'view'
          ? 'View'
          : t('inspector.tabs.properties');

  const tabDefs: { id: InspectorTab; label: string }[] = [
    { id: 'properties', label: propertiesLabel },
    { id: 'constraints', label: t('inspector.tabs.constraints') },
    { id: 'identity', label: t('inspector.tabs.identity') },
  ];
  if (hasGraphics) tabDefs.push({ id: 'graphics', label: t('inspector.tabs.graphics') });
  if (hasEvidence) tabDefs.push({ id: 'evidence', label: t('inspector.tabs.evidence') });

  useEffect(() => {
    if (activeTab === 'graphics' && !hasGraphics) setActiveTab('properties');
    if (activeTab === 'evidence' && !hasEvidence) setActiveTab('properties');
  }, [activeTab, hasGraphics, hasEvidence]);

  const handleTabKey = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
      const idx = tabDefs.findIndex((td) => td.id === activeTab);
      if (idx < 0) return;
      const delta = event.key === 'ArrowRight' ? 1 : -1;
      const next = tabDefs[(idx + delta + tabDefs.length) % tabDefs.length];
      event.preventDefault();
      setActiveTab(next.id);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeTab, tabDefs.length, hasGraphics],
  );

  // CHR-V3-06 — absent from DOM when nothing is selected.
  if (!selection) return null;

  function getTabBody(): ReactNode {
    switch (activeTab) {
      case 'properties':
        return tabs.properties;
      case 'constraints':
        return tabs.constraints ?? <EmptyTab message={t('inspector.noConstraintsMeta')} />;
      case 'identity':
        return tabs.identity ?? <EmptyTab message={t('inspector.noIdentityMeta')} />;
      case 'graphics':
        return tabs.graphics ?? null;
      case 'evidence':
        return tabs.evidence ?? null;
      default:
        return null;
    }
  }

  function handleScopeChange(scope: InspectorApplyScope): void {
    setApplyScope(scope);
    onApplyScopeChange?.(scope);
  }

  return (
    <>
      <style>{`
        @keyframes inspector-slide-in {
          from { transform: translateX(100%); }
          to   { transform: translateX(0); }
        }
        @keyframes inspector-drawer-in {
          from { transform: translateX(100%); }
          to   { transform: translateX(0); }
        }
        @keyframes slide-up {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      <div
        className="flex h-full flex-col overflow-hidden bg-surface"
        data-testid="inspector"
        data-dirty={dirty ? 'true' : 'false'}
        style={{
          animation: 'inspector-slide-in 200ms var(--ease-paper, cubic-bezier(0.32,0.72,0,1)) both',
        }}
      >
        <InspectorHeader selection={selection} onClearSelection={onClearSelection} />
        <div
          role="tablist"
          id={tablistId}
          aria-label={t('inspector.tabs.ariaLabel')}
          onKeyDown={handleTabKey}
          className="flex border-b border-border px-3"
        >
          {tabDefs.map((td) => {
            const active = td.id === activeTab;
            return (
              <button
                key={td.id}
                id={`${tablistId}-tab-${td.id}`}
                type="button"
                role="tab"
                aria-selected={active}
                aria-controls={`${tablistId}-panel-${td.id}`}
                tabIndex={active ? 0 : -1}
                onClick={() => setActiveTab(td.id)}
                data-active={active ? 'true' : 'false'}
                className={[
                  'px-3 py-2 text-[12px] transition-colors',
                  active
                    ? 'border-b-2 border-accent font-medium text-foreground'
                    : 'border-b-2 border-transparent text-muted/70 hover:text-foreground',
                ].join(' ')}
              >
                {td.label}
              </button>
            );
          })}
        </div>
        <div
          role="tabpanel"
          id={`${tablistId}-panel-${activeTab}`}
          aria-labelledby={`${tablistId}-tab-${activeTab}`}
          className="flex-1 overflow-y-auto px-3 py-3"
        >
          {/* CHR-V3-06: applies-to radio shown only in Properties tab with >1 siblings */}
          {activeTab === 'properties' && siblingCount > 1 ? (
            <div
              role="radiogroup"
              aria-label="Applies to"
              id={radioGroupId}
              className="mb-3 flex items-center gap-1 rounded-md border border-border bg-surface-strong p-1 text-xs"
            >
              <span className="px-1 text-muted">Applies to:</span>
              {(['this', 'all'] as InspectorApplyScope[]).map((scope) => {
                const checked = applyScope === scope;
                const label = scope === 'this' ? 'this' : `all ${siblingCount}`;
                return (
                  <label
                    key={scope}
                    className={[
                      'flex cursor-pointer items-center rounded px-2 py-0.5 transition-colors',
                      checked
                        ? 'bg-accent text-accent-foreground'
                        : 'text-muted hover:bg-background',
                    ].join(' ')}
                  >
                    <input
                      type="radio"
                      name={radioGroupId}
                      value={scope}
                      checked={checked}
                      onChange={() => handleScopeChange(scope)}
                      className="sr-only"
                      aria-label={label}
                    />
                    {label}
                  </label>
                );
              })}
            </div>
          ) : null}
          {getTabBody()}
        </div>
        {dirty ? <InspectorFooter onApply={onApply} onReset={onReset} /> : null}
      </div>
    </>
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
      {Icon ? (
        <div className="mt-0.5 flex h-7 w-7 items-center justify-center rounded bg-surface-strong text-muted">
          <Icon size={ICON_SIZE.chrome} aria-hidden="true" />
        </div>
      ) : null}
      <div className="flex flex-1 flex-col gap-0.5">
        <div className="text-[13px] font-medium leading-snug text-foreground">
          {selection.label}
        </div>
        <div className="font-mono text-[10px] text-muted opacity-60">{selection.id}</div>
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
  const { t } = useTranslation();
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
        {t('inspector.footer.reset')}
      </button>
      <button
        type="button"
        onClick={onApply}
        className="rounded-md bg-accent px-3 py-1 text-sm text-accent-foreground hover:opacity-90"
      >
        {t('inspector.footer.apply')}
      </button>
    </div>
  );
}

function EmptyTab({ message }: { message: string }): JSX.Element {
  return <div className="px-1 py-2 text-xs text-muted">{message}</div>;
}

/* ────────────────────────────────────────────────────────────────────── */
/* CHR-V3-06 — InspectorDrawer                                             */
/* ────────────────────────────────────────────────────────────────────── */

export interface InspectorDrawerProps {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
}

/**
 * Non-modal slide-over drawer for type/material edit flows.
 * `aria-modal="false"` so the canvas stays interactive while the drawer
 * is open. The scrim (click-away) and Escape key both trigger `onClose`.
 */
export function InspectorDrawer({
  open,
  title,
  children,
  onClose,
}: InspectorDrawerProps): JSX.Element | null {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: globalThis.KeyboardEvent): void {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      {/* Scrim — click-away closes drawer; aria-modal=false keeps canvas interactive */}
      <div
        data-testid="inspector-drawer-scrim"
        aria-hidden="true"
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 40,
          backgroundColor: 'var(--color-overlay, rgba(0,0,0,0.3))',
        }}
      />
      {/* Drawer panel */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="false"
        aria-label={title}
        data-testid="inspector-drawer"
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: '320px',
          zIndex: 41,
          backgroundColor: 'var(--color-surface)',
          boxShadow: 'var(--shadow-modal)',
          display: 'flex',
          flexDirection: 'column',
          animation:
            'inspector-drawer-in 200ms var(--ease-paper, cubic-bezier(0.32,0.72,0,1)) both',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 16px',
            borderBottom: '1px solid var(--color-border)',
          }}
        >
          <span style={{ fontSize: 'var(--text-sm)', fontWeight: 500 }}>{title}</span>
          <button
            type="button"
            onClick={onClose}
            aria-label={IconLabels.close}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '28px',
              height: '28px',
              borderRadius: '6px',
              color: 'var(--color-muted)',
            }}
          >
            <Icons.close size={ICON_SIZE.chrome} aria-hidden="true" />
          </button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>{children}</div>
      </div>
    </>
  );
}

/* ────────────────────────────────────────────────────────────────────── */
/* Numeric expression evaluator — §13.3                                    */
/* ────────────────────────────────────────────────────────────────────── */

/**
 * Evaluate a §13.3 numeric expression. Delegates to FAM-04's
 * :func:`evaluateFormula` for safe parsing — no `eval()` /
 * `new Function()`. Identifiers / functions are not exposed in this
 * surface; pass an empty parameter map so bare names still error.
 */
export function evaluateExpression(raw: string): number | null {
  return evaluateFormula(raw, {});
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
  const { t } = useTranslation();
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

  const errorId = `nf-err-${label.replace(/\s+/g, '-').toLowerCase()}`;
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
          aria-describedby={error ? errorId : undefined}
          step={step}
          onChange={handleChange}
          onBlur={() => commit(draft)}
          className="flex-1 bg-transparent text-foreground outline-none"
        />
        <button
          type="button"
          onClick={cycleUnit}
          aria-label={t('inspector.cycleUnits', { unit })}
          className="rounded-sm border border-border px-1.5 text-xs text-muted hover:bg-surface-strong"
        >
          {unit}
        </button>
      </div>
      {error ? (
        <span id={errorId} role="alert" className="text-[10px] text-danger">
          {t('inspector.invalidExpression')}
        </span>
      ) : null}
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
