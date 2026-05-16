import { type JSX, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useBimStore } from '../../state/store';
import { formatLength, formatArea } from '../../lib/formatUnit';
import type { LengthUnit, AreaUnit, ProjectUnits } from '../../lib/formatUnit';
import { applyCommand } from '../../lib/api';

const LENGTH_UNIT_OPTIONS: { value: LengthUnit; label: string }[] = [
  { value: 'mm', label: 'Millimeters (mm)' },
  { value: 'cm', label: 'Centimeters (cm)' },
  { value: 'm', label: 'Meters (m)' },
  { value: 'ft', label: 'Feet (ft)' },
  { value: 'in', label: 'Inches (in)' },
  { value: 'ft-in', label: 'Feet and Inches (ft-in)' },
];

const AREA_UNIT_OPTIONS: { value: AreaUnit; label: string }[] = [
  { value: 'm2', label: 'm²' },
  { value: 'ft2', label: 'ft²' },
];

const DECIMAL_SYMBOL_OPTIONS: { value: '.' | ','; label: string }[] = [
  { value: '.', label: 'Period (1.23)' },
  { value: ',', label: 'Comma (1,23)' },
];

/** Resolve unit values from project_settings, with sensible defaults. */
function resolveUnits(ps: {
  lengthUnitFull?: string | null;
  areaUnit?: string | null;
  decimalSymbol?: string | null;
}): { lengthUnit: LengthUnit; areaUnit: AreaUnit; decimalSymbol: '.' | ',' } {
  const lengthUnit: LengthUnit =
    ps.lengthUnitFull === 'mm' ||
    ps.lengthUnitFull === 'cm' ||
    ps.lengthUnitFull === 'm' ||
    ps.lengthUnitFull === 'ft' ||
    ps.lengthUnitFull === 'in' ||
    ps.lengthUnitFull === 'ft-in'
      ? (ps.lengthUnitFull as LengthUnit)
      : 'mm';

  const areaUnit: AreaUnit = ps.areaUnit === 'ft2' ? 'ft2' : 'm2';

  const decimalSymbol: '.' | ',' = ps.decimalSymbol === ',' ? ',' : '.';

  return { lengthUnit, areaUnit, decimalSymbol };
}

export function ProjectUnitsDialog({
  open,
  onClose,
  applyCommandImpl = applyCommand,
}: {
  open: boolean;
  onClose: () => void;
  /** Tests inject a mock to capture commands without hitting the network. */
  applyCommandImpl?: typeof applyCommand;
}): JSX.Element | null {
  const elementsById = useBimStore((s) => s.elementsById);
  const modelId = useBimStore((s) => s.modelId);

  const dialogRef = useRef<HTMLDivElement>(null);

  // Find project_settings element
  const projectSettings = useMemo(() => {
    const all = Object.values(elementsById);
    return (
      (elementsById['project_settings']?.kind === 'project_settings'
        ? elementsById['project_settings']
        : undefined) ??
      all.find(
        (e): e is Extract<(typeof all)[number], { kind: 'project_settings' }> =>
          e.kind === 'project_settings',
      )
    );
  }, [elementsById]);

  const psId = projectSettings?.id ?? 'project_settings';

  // Draft state
  const [lengthUnit, setLengthUnit] = useState<LengthUnit>('mm');
  const [areaUnit, setAreaUnit] = useState<AreaUnit>('m2');
  const [decimalSymbol, setDecimalSymbol] = useState<'.' | ','>('.');

  // Sync draft from store when dialog opens
  useEffect(() => {
    if (!open) return;
    if (projectSettings) {
      const resolved = resolveUnits(projectSettings);
      setLengthUnit(resolved.lengthUnit);
      setAreaUnit(resolved.areaUnit);
      setDecimalSymbol(resolved.decimalSymbol);
    }
  }, [open, projectSettings]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  useEffect(() => {
    if (open) dialogRef.current?.focus();
  }, [open]);

  const currentUnits: ProjectUnits = { lengthUnit, areaUnit, decimalSymbol };
  const sampleLength = formatLength(3500, currentUnits);
  const sampleArea = formatArea(12_250_000, currentUnits);

  const handleSave = useCallback(async () => {
    if (!modelId) {
      onClose();
      return;
    }

    const commands: Array<{ type: string; id: string; property: string; value: unknown }> = [
      { type: 'updateElementProperty', id: psId, property: 'lengthUnitFull', value: lengthUnit },
      { type: 'updateElementProperty', id: psId, property: 'areaUnit', value: areaUnit },
      { type: 'updateElementProperty', id: psId, property: 'decimalSymbol', value: decimalSymbol },
    ];

    for (const cmd of commands) {
      try {
        await applyCommandImpl(modelId, cmd);
      } catch (err) {
        console.error('ProjectUnitsDialog: command failed', cmd, err);
      }
    }

    onClose();
  }, [modelId, psId, lengthUnit, areaUnit, decimalSymbol, applyCommandImpl, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
      data-testid="project-units-dialog-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="project-units-dialog-title"
        data-testid="project-units-dialog"
        tabIndex={-1}
        className="flex w-[360px] flex-col rounded border border-border bg-surface shadow-xl outline-none"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 id="project-units-dialog-title" className="text-sm font-semibold text-foreground">
            Project Units
          </h2>
          <button
            type="button"
            data-testid="project-units-dialog-close"
            onClick={onClose}
            className="inline-flex h-7 w-7 items-center justify-center rounded border border-border text-muted hover:bg-surface-strong hover:text-foreground"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-col gap-4 p-4">
          {/* Length Unit */}
          <label className="flex flex-col gap-1 text-xs text-foreground">
            <span className="font-medium">Length Unit</span>
            <select
              data-testid="project-units-length"
              value={lengthUnit}
              onChange={(e) => setLengthUnit(e.currentTarget.value as LengthUnit)}
              className="h-7 rounded border border-border bg-surface px-2 text-xs text-foreground"
            >
              {LENGTH_UNIT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>

          {/* Area Unit */}
          <label className="flex flex-col gap-1 text-xs text-foreground">
            <span className="font-medium">Area Unit</span>
            <select
              data-testid="project-units-area"
              value={areaUnit}
              onChange={(e) => setAreaUnit(e.currentTarget.value as AreaUnit)}
              className="h-7 rounded border border-border bg-surface px-2 text-xs text-foreground"
            >
              {AREA_UNIT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>

          {/* Decimal Symbol */}
          <label className="flex flex-col gap-1 text-xs text-foreground">
            <span className="font-medium">Decimal Symbol</span>
            <select
              data-testid="project-units-decimal"
              value={decimalSymbol}
              onChange={(e) => setDecimalSymbol(e.currentTarget.value as '.' | ',')}
              className="h-7 rounded border border-border bg-surface px-2 text-xs text-foreground"
            >
              {DECIMAL_SYMBOL_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>

          {/* Live Preview */}
          <div
            data-testid="project-units-preview"
            className="rounded border border-border bg-surface-strong px-3 py-2 text-xs text-muted"
          >
            <span className="font-medium text-foreground">Preview: </span>
            {sampleLength} &nbsp;/&nbsp; {sampleArea}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-border px-4 py-3">
          <button
            type="button"
            data-testid="project-units-cancel"
            onClick={onClose}
            className="rounded border border-border px-3 py-1.5 text-xs text-foreground hover:bg-surface-strong"
          >
            Cancel
          </button>
          <button
            type="button"
            data-testid="project-units-save"
            onClick={() => void handleSave()}
            className="rounded bg-brand px-3 py-1.5 text-xs text-white hover:bg-brand/80"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
