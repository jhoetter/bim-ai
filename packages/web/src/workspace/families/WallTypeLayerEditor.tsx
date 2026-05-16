import { type JSX } from 'react';
import type { Element, WallTypeLayer } from '@bim-ai/core';

interface WallTypeLayerEditorProps {
  typeElement: Extract<Element, { kind: 'wall_type' | 'floor_type' | 'roof_type' }>;
  onUpdate: (patch: { name?: string; layers?: WallTypeLayer[]; basisLine?: string }) => void;
}

export function WallTypeLayerEditor({
  typeElement,
  onUpdate,
}: WallTypeLayerEditorProps): JSX.Element {
  const { layers } = typeElement;

  function updateLayer(index: number, changes: Partial<WallTypeLayer>): void {
    const next = layers.map((l, i) => (i === index ? { ...l, ...changes } : l));
    onUpdate({ layers: next });
  }

  function deleteLayer(index: number): void {
    onUpdate({ layers: layers.filter((_, i) => i !== index) });
  }

  function moveLayer(index: number, direction: -1 | 1): void {
    const target = index + direction;
    if (target < 0 || target >= layers.length) return;
    const next = [...layers];
    [next[index], next[target]] = [next[target], next[index]];
    onUpdate({ layers: next });
  }

  return (
    <div data-testid="wall-type-layer-editor" className="flex flex-col gap-2 text-xs">
      <label className="flex items-center gap-2">
        <span className="w-20 shrink-0 text-muted">Name</span>
        <input
          className="flex-1 rounded border border-border bg-surface px-1 py-0.5 text-xs"
          data-testid="wall-type-name-input"
          defaultValue={typeElement.name}
          onBlur={(e) => {
            const v = e.currentTarget.value;
            if (v !== typeElement.name) onUpdate({ name: v });
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur();
          }}
        />
      </label>

      {typeElement.kind === 'wall_type' ? (
        <label className="flex items-center gap-2">
          <span className="w-20 shrink-0 text-muted">Basis Line</span>
          <select
            className="flex-1 rounded border border-border bg-surface px-1 py-0.5 text-xs"
            data-testid="wall-type-basis-line"
            value={typeElement.basisLine ?? 'center'}
            onChange={(e) => onUpdate({ basisLine: e.currentTarget.value })}
          >
            <option value="center">Centerline</option>
            <option value="face_interior">Finish Face: Interior</option>
            <option value="face_exterior">Finish Face: Exterior</option>
          </select>
        </label>
      ) : null}

      <div data-testid="wall-type-layers-table" className="flex flex-col gap-1">
        {layers.map((layer, i) => (
          <div
            key={i}
            data-testid={`wall-type-layer-row-${i}`}
            className="grid grid-cols-[56px_90px_80px_24px_24px_24px] items-center gap-1 rounded border border-border bg-surface-strong px-1 py-0.5"
          >
            <input
              type="number"
              className="w-full rounded border border-border bg-surface px-1 py-0.5 font-mono text-xs"
              data-testid={`wall-type-layer-thickness-${i}`}
              value={layer.thicknessMm}
              onChange={(e) => updateLayer(i, { thicknessMm: Number(e.currentTarget.value) })}
            />
            <select
              className="w-full rounded border border-border bg-surface px-1 py-0.5 text-xs"
              data-testid={`wall-type-layer-function-${i}`}
              value={layer.function}
              onChange={(e) =>
                updateLayer(i, { function: e.currentTarget.value as WallTypeLayer['function'] })
              }
            >
              <option value="structure">Structure</option>
              <option value="insulation">Insulation</option>
              <option value="finish">Finish</option>
              <option value="membrane">Membrane</option>
              <option value="air">Air</option>
            </select>
            <input
              className="w-full rounded border border-border bg-surface px-1 py-0.5 font-mono text-xs"
              data-testid={`wall-type-layer-material-${i}`}
              value={layer.materialKey ?? ''}
              onChange={(e) => updateLayer(i, { materialKey: e.currentTarget.value || null })}
            />
            <button
              data-testid={`wall-type-layer-up-${i}`}
              className="flex items-center justify-center rounded border border-border bg-surface px-0.5 py-0.5 text-xs hover:bg-surface-strong"
              onClick={() => moveLayer(i, -1)}
              disabled={i === 0}
            >
              ↑
            </button>
            <button
              data-testid={`wall-type-layer-down-${i}`}
              className="flex items-center justify-center rounded border border-border bg-surface px-0.5 py-0.5 text-xs hover:bg-surface-strong"
              onClick={() => moveLayer(i, 1)}
              disabled={i === layers.length - 1}
            >
              ↓
            </button>
            <button
              data-testid={`wall-type-layer-delete-${i}`}
              className="flex items-center justify-center rounded border border-border bg-surface px-0.5 py-0.5 text-xs text-danger hover:bg-danger/10"
              onClick={() => deleteLayer(i)}
            >
              ×
            </button>
          </div>
        ))}
      </div>

      <button
        data-testid="wall-type-add-layer"
        className="rounded border border-border bg-surface px-2 py-0.5 text-xs hover:bg-surface-strong"
        onClick={() =>
          onUpdate({
            layers: [...layers, { thicknessMm: 100, function: 'structure', materialKey: null }],
          })
        }
      >
        Add Layer
      </button>
    </div>
  );
}
