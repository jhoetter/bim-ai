import { useState } from 'react';

import type { Element } from '@bim-ai/core';

export function LevelStack(props: {
  levels: Extract<Element, { kind: 'level' }>[];

  activeId: string;

  setActive(id: string): void;

  onElevationCommitted(levelId: string, elevationMm: number): void;

  onNameCommitted?: (levelId: string, name: string) => void;

  onCreatePlanView?: (levelId: string, levelName: string) => void;

  onCreateLevel?: () => void;

  onCreateMultipleLevels?: (levels: Array<{ name: string; elevationMm: number }>) => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [nameDraft, setNameDraft] = useState('');
  const [multiDialogOpen, setMultiDialogOpen] = useState(false);
  const [multiCount, setMultiCount] = useState(3);
  const [multiSpacing, setMultiSpacing] = useState(3000);
  const [multiPrefix, setMultiPrefix] = useState('Ebene');

  function commitEdit(levelId: string) {
    if (!editingId || editingId !== levelId) return;
    const trimmed = nameDraft.trim();
    if (trimmed && trimmed !== (props.levels.find((l) => l.id === levelId)?.name ?? '')) {
      props.onNameCommitted?.(levelId, trimmed);
    }
    setEditingId(null);
    setNameDraft('');
  }

  function cancelEdit() {
    setEditingId(null);
    setNameDraft('');
  }

  function handleCreateMultiple() {
    if (!props.onCreateMultipleLevels) return;
    const topElevMm =
      props.levels.length > 0 ? Math.max(...props.levels.map((l) => l.elevationMm)) : 0;
    const newLevels = Array.from({ length: multiCount }, (_, i) => ({
      name: `${multiPrefix} ${i + 1}`,
      elevationMm: topElevMm + multiSpacing * (i + 1),
    }));
    props.onCreateMultipleLevels(newLevels);
    setMultiDialogOpen(false);
  }

  return (
    <div className="rounded border bg-surface p-2">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase text-muted">Levels</span>
        <div className="flex items-center gap-1">
          {props.onCreateLevel && (
            <button
              type="button"
              data-testid="level-stack-create"
              title="Create new level"
              onClick={props.onCreateLevel}
              className="rounded px-1.5 py-0.5 text-[10px] text-muted hover:bg-accent/10 hover:text-foreground"
            >
              +
            </button>
          )}
          {props.onCreateMultipleLevels && (
            <button
              type="button"
              data-testid="level-stack-create-multiple"
              title="Add multiple levels"
              onClick={() => setMultiDialogOpen((v) => !v)}
              className="rounded px-1.5 py-0.5 text-[10px] text-muted hover:bg-accent/10 hover:text-foreground"
            >
              Add Multiple&#8230;
            </button>
          )}
        </div>
      </div>

      {multiDialogOpen && props.onCreateMultipleLevels && (
        <div className="mt-2 rounded border border-border bg-background p-2 text-xs">
          <div className="mb-2 flex flex-col gap-1.5">
            <label className="flex items-center justify-between gap-2">
              <span className="text-muted">Count</span>
              <input
                type="number"
                min={1}
                max={20}
                value={multiCount}
                data-testid="multi-level-count"
                className="w-16 rounded border border-border bg-surface px-1 py-0.5 font-mono text-[11px]"
                onChange={(e) =>
                  setMultiCount(Math.min(20, Math.max(1, Number(e.currentTarget.value))))
                }
              />
            </label>
            <label className="flex items-center justify-between gap-2">
              <span className="text-muted">Spacing (mm)</span>
              <input
                type="number"
                value={multiSpacing}
                data-testid="multi-level-spacing"
                className="w-20 rounded border border-border bg-surface px-1 py-0.5 font-mono text-[11px]"
                onChange={(e) => setMultiSpacing(Number(e.currentTarget.value))}
              />
            </label>
            <label className="flex items-center justify-between gap-2">
              <span className="text-muted">Name prefix</span>
              <input
                type="text"
                value={multiPrefix}
                data-testid="multi-level-prefix"
                className="w-20 rounded border border-border bg-surface px-1 py-0.5 text-[11px]"
                onChange={(e) => setMultiPrefix(e.currentTarget.value)}
              />
            </label>
          </div>
          <div className="flex justify-end gap-1">
            <button
              type="button"
              onClick={() => setMultiDialogOpen(false)}
              className="rounded px-2 py-0.5 text-[10px] text-muted hover:bg-accent/10 hover:text-foreground"
            >
              Cancel
            </button>
            <button
              type="button"
              data-testid="multi-level-create"
              onClick={handleCreateMultiple}
              className="rounded bg-accent/20 px-2 py-0.5 text-[10px] font-medium text-foreground hover:bg-accent/30"
            >
              Create
            </button>
          </div>
        </div>
      )}

      <ul className="mt-2 space-y-1">
        {props.levels.map((lv) => (
          <li key={lv.id} className="flex flex-wrap items-center gap-2 text-xs">
            {editingId === lv.id ? (
              <input
                autoFocus
                type="text"
                data-testid={`level-name-input-${lv.id}`}
                value={nameDraft}
                className="rounded border border-border bg-background px-1 py-0.5 text-xs font-medium"
                onChange={(e) => setNameDraft(e.currentTarget.value)}
                onBlur={() => commitEdit(lv.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    commitEdit(lv.id);
                  }
                  if (e.key === 'Escape') {
                    e.preventDefault();
                    cancelEdit();
                  }
                }}
              />
            ) : (
              <button
                type="button"
                className={
                  'rounded px-2 py-1 font-medium ' +
                  (props.activeId === lv.id ? 'bg-accent/30' : 'hover:bg-accent/10')
                }
                onClick={() => props.setActive(lv.id)}
                onDoubleClick={
                  props.onNameCommitted
                    ? () => {
                        setEditingId(lv.id);
                        setNameDraft(lv.name);
                      }
                    : undefined
                }
                title={props.onNameCommitted ? 'Double-click to rename' : undefined}
              >
                {lv.name}
              </button>
            )}

            {props.onCreatePlanView && editingId !== lv.id && (
              <button
                type="button"
                data-testid={`level-create-view-${lv.id}`}
                title="Create floor plan view for this level"
                className="rounded px-1 py-0.5 text-[10px] text-muted hover:bg-accent/10 hover:text-foreground"
                onClick={() => props.onCreatePlanView!(lv.id, lv.name)}
              >
                +
              </button>
            )}

            <label className="flex items-center gap-1 text-[10px] text-muted">
              Elev (mm)
              <input
                defaultValue={String(lv.elevationMm)}
                className="w-24 rounded border border-border bg-background px-1 py-0.5 font-mono text-[11px]"
                key={`${lv.id}-${lv.elevationMm}`}
                type="number"
                onBlur={(e) => props.onElevationCommitted(lv.id, Number(e.currentTarget.value))}
              />
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}
