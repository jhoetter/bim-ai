import type { JSX } from 'react';
import type { Element } from '@bim-ai/core';

import { getStairComponents } from '../../plan/stairComponentList';

function legacyNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function StairAssemblySection({
  stairId,
  elementsById,
  onSemanticCommand,
}: {
  stairId: string;
  elementsById: Record<string, Element>;
  onSemanticCommand?: (cmd: Record<string, unknown>) => void;
}): JSX.Element {
  const { runs, landings } = getStairComponents(stairId, elementsById);

  return (
    <details style={{ marginTop: 8 }}>
      <summary
        data-testid="inspector-stair-assembly-summary"
        style={{ cursor: 'pointer', fontWeight: 600, fontSize: 12 }}
      >
        Assembly ({runs.length} runs, {landings.length} landings)
      </summary>
      <div style={{ marginTop: 6 }}>
        {runs.map((run, i) => (
          <div
            key={run.id}
            data-testid={`inspector-stair-run-row-${i}`}
            style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, marginBottom: 2 }}
          >
            <span>
              Run {i + 1}: {run.riserCount ?? '?'} risers, {run.runWidthMm ?? '?'} mm wide
            </span>
            <button
              data-testid={`inspector-stair-run-remove-${i}`}
              onClick={() =>
                onSemanticCommand?.({ type: 'removeStairComponent', componentId: run.id })
              }
              style={{ color: '#f87171', fontSize: 10 }}
            >
              ✕
            </button>
          </div>
        ))}
        {landings.map((landing, i) => {
          const depthMm = legacyNumber((landing as { depthMm?: unknown }).depthMm);
          return (
            <div
              key={landing.id}
              data-testid={`inspector-stair-landing-row-${i}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 11,
                marginBottom: 2,
              }}
            >
              <span>
                Landing {i + 1}: {depthMm ?? landing.elevationMm ?? '?'}mm
              </span>
              <button
                data-testid={`inspector-stair-landing-remove-${i}`}
                onClick={() =>
                  onSemanticCommand?.({ type: 'removeStairComponent', componentId: landing.id })
                }
                style={{ color: '#f87171', fontSize: 10 }}
              >
                ✕
              </button>
            </div>
          );
        })}
        {runs.length === 0 && landings.length === 0 && (
          <p data-testid="inspector-stair-assembly-empty" style={{ fontSize: 11, color: '#888' }}>
            No components. Use the Stair by Component tool to add runs and landings.
          </p>
        )}
        <button
          data-testid="inspector-stair-add-run-btn"
          onClick={() =>
            onSemanticCommand?.({
              type: 'addStairRun',
              run: {
                id: crypto.randomUUID(),
                kind: 'stair_run',
                stairId,
                riserCount: 10,
                runWidthMm: 1200,
                runIndex: 0,
                startMm: { xMm: 0, yMm: 0 },
                endMm: { xMm: 0, yMm: 3000 },
              },
            })
          }
          style={{ fontSize: 11, marginTop: 4, marginRight: 8 }}
        >
          + Add Run
        </button>
        <button
          data-testid="inspector-stair-add-landing-btn"
          onClick={() =>
            onSemanticCommand?.({
              type: 'addStairLanding',
              landing: {
                id: crypto.randomUUID(),
                kind: 'stair_landing',
                stairId,
                landingIndex: 0,
                elevationMm: 0,
                perimeterMm: [
                  { xMm: 0, yMm: 0 },
                  { xMm: 1200, yMm: 0 },
                  { xMm: 1200, yMm: 1200 },
                  { xMm: 0, yMm: 1200 },
                ],
              },
            })
          }
          style={{ fontSize: 11, marginTop: 4 }}
        >
          + Add Landing
        </button>
      </div>
    </details>
  );
}
