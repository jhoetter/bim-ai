import { useState } from 'react';

import type { Element } from '@bim-ai/core';

export function LevelStack(props: {
  levels: Extract<Element, { kind: 'level' }>[];

  activeId: string;

  setActive(id: string): void;

  onElevationCommitted(levelId: string, elevationMm: number): void;

  onNameCommitted?: (levelId: string, name: string) => void;

  onCreatePlanView?: (levelId: string, levelName: string) => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [nameDraft, setNameDraft] = useState('');

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

  return (
    <div className="rounded border bg-surface p-2">
      <div className="text-[11px] font-semibold uppercase text-muted">Levels</div>

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
