import type { Element } from '@bim-ai/core';

export function LevelStack(props: {
  levels: Extract<Element, { kind: 'level' }>[];

  activeId: string;

  setActive(id: string): void;

  onElevationCommitted(levelId: string, elevationMm: number): void;
}) {
  return (
    <div className="rounded border bg-surface p-2">
      <div className="text-[11px] font-semibold uppercase text-muted">Levels</div>

      <ul className="mt-2 space-y-1">
        {props.levels.map((lv) => (
          <li key={lv.id} className="flex flex-wrap items-center gap-2 text-xs">
            <button
              type="button"
              className={
                'rounded px-2 py-1 font-medium ' +
                (props.activeId === lv.id ? 'bg-accent/30' : 'hover:bg-accent/10')
              }
              onClick={() => props.setActive(lv.id)}
            >
              {lv.name}
            </button>

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
