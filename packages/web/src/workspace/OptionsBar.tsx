import type { JSX } from 'react';
import { useBimStore } from '../state/store';
import { WALL_LOCATION_LINE_ORDER, type WallLocationLine } from '../tools/toolGrammar';

const LOCATION_LINE_LABELS: Record<WallLocationLine, string> = {
  'wall-centerline': 'Wall Centerline',
  'finish-face-exterior': 'Finish Face: Exterior',
  'finish-face-interior': 'Finish Face: Interior',
  'core-centerline': 'Core Centerline',
  'core-face-exterior': 'Core Face: Exterior',
  'core-face-interior': 'Core Face: Interior',
};

const BAR_CLASS = 'flex items-center gap-4 border-b border-border bg-surface py-1 px-3 text-xs';

export function OptionsBar(): JSX.Element | null {
  const planTool = useBimStore((s) => s.planTool);
  const wallLocationLine = useBimStore((s) => s.wallLocationLine);
  const setWallLocationLine = useBimStore((s) => s.setWallLocationLine);
  const floorBoundaryOffsetMm = useBimStore((s) => s.floorBoundaryOffsetMm);
  const setFloorBoundaryOffsetMm = useBimStore((s) => s.setFloorBoundaryOffsetMm);

  if (planTool === 'wall') {
    return (
      <div data-testid="options-bar" className={BAR_CLASS}>
        <span className="text-muted">Location Line:</span>
        <select
          value={wallLocationLine}
          onChange={(e) => setWallLocationLine(e.target.value as WallLocationLine)}
          className="rounded border border-border bg-surface px-1.5 py-0.5 text-xs text-foreground"
          aria-label="Wall location line"
        >
          {WALL_LOCATION_LINE_ORDER.map((loc) => (
            <option key={loc} value={loc}>
              {LOCATION_LINE_LABELS[loc]}
            </option>
          ))}
        </select>
        <span className="text-muted opacity-60">Tab to cycle</span>
      </div>
    );
  }

  if (planTool === 'floor') {
    return (
      <div data-testid="options-bar" className={BAR_CLASS}>
        <label className="flex items-center gap-2">
          <span className="text-muted">Boundary Offset:</span>
          <input
            type="number"
            value={floorBoundaryOffsetMm}
            onChange={(e) => setFloorBoundaryOffsetMm(Number(e.target.value))}
            className="w-20 rounded border border-border bg-surface px-1.5 py-0.5 text-xs text-foreground"
            aria-label="Floor boundary offset in mm"
          />
          <span className="text-muted opacity-60">mm</span>
        </label>
      </div>
    );
  }

  return null;
}
