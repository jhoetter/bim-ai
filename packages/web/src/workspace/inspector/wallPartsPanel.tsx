import { useState, type JSX } from 'react';
import type { Element } from '@bim-ai/core';

export function WallPartsPanel({
  wall,
  elementsById,
  onPropertyChange,
}: {
  wall: Extract<Element, { kind: 'wall' }>;
  elementsById: Record<string, Element>;
  onPropertyChange?: (property: string, value: unknown) => void;
}): JSX.Element | null {
  const [createCount, setCreateCount] = useState(3);

  if (!wall.parts || wall.parts.length === 0) return null;

  const wallLengthMm = Math.hypot(wall.end.xMm - wall.start.xMm, wall.end.yMm - wall.start.yMm);

  const materials = Object.values(elementsById)
    .filter((e): e is Extract<Element, { kind: 'material' }> => e.kind === 'material')
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="border-t border-border pt-1.5">
      <div className="mb-1 text-xs text-muted">Parts</div>
      <div className="flex flex-col gap-1">
        {wall.parts.map((part, i) => {
          const lengthMm = ((part.endT - part.startT) * wallLengthMm).toFixed(0);
          return (
            <div key={part.id} className="flex flex-col gap-1 pb-1 mb-0.5">
              <div className="flex items-center gap-2 py-0.5">
                <span className="text-xs text-muted w-20 shrink-0">Label</span>
                <input
                  type="text"
                  data-testid={`inspector-part-label-${i}`}
                  className="flex-1 text-xs bg-surface border border-border rounded px-1 py-0.5"
                  defaultValue={part.label ?? `Part ${i + 1}`}
                  key={`${part.id}-label`}
                  onBlur={(e) => {
                    const updated = wall.parts!.map((p, j) =>
                      j === i ? { ...p, label: e.currentTarget.value || null } : p,
                    );
                    onPropertyChange?.('parts', updated);
                  }}
                />
              </div>
              <div className="flex items-center gap-2 py-0.5">
                <span className="text-xs text-muted w-20 shrink-0">Material</span>
                <select
                  data-testid={`inspector-part-material-${i}`}
                  className="flex-1 text-xs bg-surface border border-border rounded px-1 py-0.5"
                  value={part.materialId ?? ''}
                  onChange={(e) => {
                    const updated = wall.parts!.map((p, j) =>
                      j === i ? { ...p, materialId: e.target.value || null } : p,
                    );
                    onPropertyChange?.('parts', updated);
                  }}
                >
                  <option value="">— (none) —</option>
                  {materials.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2 py-0.5">
                <span
                  data-testid={`inspector-part-length-${i}`}
                  className="text-xs text-foreground"
                >
                  {lengthMm} mm
                </span>
                <button
                  type="button"
                  data-testid={`inspector-part-remove-${i}`}
                  className="ml-auto text-xs text-muted hover:text-foreground border border-border rounded px-1.5 py-0.5"
                  onClick={() => {
                    const updated = wall.parts!.filter((p) => p.id !== part.id);
                    onPropertyChange?.('parts', updated.length > 0 ? updated : null);
                  }}
                >
                  ×
                </button>
              </div>
            </div>
          );
        })}
        <div className="flex items-center gap-2 py-0.5">
          <input
            type="number"
            min={2}
            max={20}
            className="w-12 text-xs bg-surface border border-border rounded px-1 py-0.5"
            value={createCount}
            onChange={(e) => setCreateCount(Number(e.target.value))}
          />
          <button
            type="button"
            data-testid="inspector-parts-create"
            className="text-xs rounded border border-border px-2 py-0.5 text-muted hover:text-foreground"
            onClick={() => {
              const n = Math.max(1, Math.floor(createCount));
              const newParts = Array.from({ length: n }, (_, idx) => ({
                id: crypto.randomUUID(),
                startT: parseFloat((idx / n).toFixed(10)),
                endT: parseFloat(((idx + 1) / n).toFixed(10)),
              }));
              onPropertyChange?.('parts', newParts);
            }}
          >
            Create {createCount} Equal Parts
          </button>
        </div>
      </div>
    </div>
  );
}
