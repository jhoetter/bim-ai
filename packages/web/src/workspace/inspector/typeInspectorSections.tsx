import type { JSX } from 'react';
import type { Element } from '@bim-ai/core';

import { fmtMm } from './inspectorRows';

function parseTypeParameterDraft(value: string, prior: unknown): unknown {
  if (typeof prior === 'number') {
    const n = Number(value);
    return Number.isFinite(n) ? n : prior;
  }
  if (typeof prior === 'boolean') return value === 'true';
  return value;
}

export function TypeTextInput({
  label,
  value,
  testId,
  onCommit,
}: {
  label: string;
  value: string;
  testId: string;
  onCommit?: (value: string) => void;
}): JSX.Element {
  return (
    <label className="flex items-center gap-2 py-0.5">
      <span className="w-28 shrink-0 text-xs text-muted">{label}</span>
      <input
        className="flex-1 rounded border border-border bg-surface px-1 py-0.5 text-xs"
        defaultValue={value}
        data-testid={testId}
        onBlur={(e) => {
          const next = e.currentTarget.value.trim();
          if (next && next !== value) onCommit?.(next);
        }}
      />
    </label>
  );
}

export function TypeLayerSummary({
  layers,
}: {
  layers: Extract<Element, { kind: 'wall_type' | 'floor_type' | 'roof_type' }>['layers'];
}): JSX.Element {
  const totalMm = layers.reduce((sum, layer) => sum + (Number(layer.thicknessMm) || 0), 0);
  return (
    <div className="rounded border border-border bg-surface-strong p-2 text-xs">
      <div className="mb-1 flex items-center justify-between">
        <span className="font-medium text-foreground">Type Layers</span>
        <span className="text-muted">
          {layers.length} layer{layers.length === 1 ? '' : 's'} · {fmtMm(totalMm)}
        </span>
      </div>
      <div className="flex flex-col gap-1">
        {layers.map((layer, index) => (
          <div
            key={`${layer.function}-${layer.materialKey ?? 'mat'}-${index}`}
            className="grid grid-cols-[1fr_72px_72px] gap-2 border-t border-border pt-1 first:border-t-0 first:pt-0"
          >
            <span className="truncate" title={layer.materialKey ?? layer.function}>
              {layer.materialKey ?? 'By category'}
            </span>
            <span className="text-muted">{layer.function}</span>
            <span className="text-right font-mono">{fmtMm(layer.thicknessMm)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function FamilyTypeParameterTable({
  parameters,
  onPropertyChange,
}: {
  parameters: Record<string, unknown>;
  onPropertyChange?: (property: string, value: unknown) => void;
}): JSX.Element {
  const entries = Object.entries(parameters).sort(([a], [b]) => a.localeCompare(b));
  return (
    <div className="rounded border border-border bg-surface-strong p-2 text-xs">
      <div className="mb-1 font-medium text-foreground">Type Parameters</div>
      <div className="flex max-h-56 flex-col gap-1 overflow-y-auto">
        {entries.map(([key, value]) => {
          const display = value == null ? '' : String(value);
          return (
            <label key={key} className="grid grid-cols-[110px_minmax(0,1fr)] items-center gap-2">
              <span className="truncate text-muted" title={key}>
                {key}
              </span>
              {typeof value === 'boolean' ? (
                <select
                  className="rounded border border-border bg-surface px-1 py-0.5 text-xs"
                  value={String(value)}
                  data-testid={`inspector-family-type-param-${key}`}
                  onChange={(e) =>
                    onPropertyChange?.(
                      `parameters.${key}`,
                      parseTypeParameterDraft(e.currentTarget.value, value),
                    )
                  }
                >
                  <option value="true">true</option>
                  <option value="false">false</option>
                </select>
              ) : (
                <input
                  className="rounded border border-border bg-surface px-1 py-0.5 font-mono text-xs"
                  defaultValue={display}
                  data-testid={`inspector-family-type-param-${key}`}
                  onBlur={(e) => {
                    const next = e.currentTarget.value;
                    if (next !== display) {
                      onPropertyChange?.(`parameters.${key}`, parseTypeParameterDraft(next, value));
                    }
                  }}
                />
              )}
            </label>
          );
        })}
      </div>
    </div>
  );
}
