import { useState, type JSX } from 'react';
import type { Element } from '@bim-ai/core';

import { buildShaftSideWalls } from '../../plan/buildShaftSideWalls';

export function ShaftSideWallsButton({
  shaft,
  onDispatchCommand,
}: {
  shaft: Extract<Element, { kind: 'shaft' }>;
  onDispatchCommand?: (cmd: Record<string, unknown>) => void;
}): JSX.Element {
  const [sideWallsAdded, setSideWallsAdded] = useState<number | null>(null);
  return (
    <>
      <button
        type="button"
        className="rounded border border-border bg-background px-2 py-0.5 text-xs text-foreground hover:bg-surface-strong"
        data-testid="inspector-shaft-add-side-walls"
        style={{ marginTop: 8 }}
        onClick={() => {
          const walls = buildShaftSideWalls(shaft, shaft.baseLevelId ?? 'L1');
          for (const wall of walls) {
            onDispatchCommand?.({ type: 'createElement', element: wall });
          }
          setSideWallsAdded(walls.length);
        }}
      >
        Add Side Walls
      </button>
      {sideWallsAdded !== null && (
        <p
          data-testid="inspector-shaft-side-walls-added"
          style={{ fontSize: 11, color: '#22c55e', marginTop: 4 }}
        >
          {sideWallsAdded} side walls added
        </p>
      )}
    </>
  );
}
