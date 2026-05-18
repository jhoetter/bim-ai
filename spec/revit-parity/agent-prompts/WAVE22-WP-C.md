# Wave 22 — WP-C: Stair Component Assembly Inspector (§8.6.2)

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).
This prompt is self-contained — start here.

---

## Context

§8.6.2 "Treppe nach Bauteil" is Partial — "Independent run/landing/railing assembly with granular control is Partial." Wave 19 WP-A added `stair_run` and `stair_landing` element types with `parentStairId` fields and basic inspector panels. What's missing is:

- A way to see all components of a stair from the stair's own inspector panel
- A "Stair Assembly" panel on the stair element listing all linked runs/landings
- "Add Run" / "Add Landing" buttons directly from the stair inspector

---

## Repo orientation

```
packages/core/src/index.ts                       — find stair_run, stair_landing types
packages/web/src/workspace/inspector/InspectorContent.tsx — find case 'stair':
packages/web/src/plan/PlanCanvas.tsx             — find addStairRun / addStairLanding dispatch
packages/web/src/workspace/Workspace.tsx         — find addStairRun / addStairLanding handlers
```

Run:

- `grep -n "stair_run\|stair_landing\|parentStairId" packages/core/src/index.ts | head -15`
- `grep -n "case 'stair':" packages/web/src/workspace/inspector/InspectorContent.tsx`
- `grep -n "addStairRun\|addStairLanding" packages/web/src/workspace/Workspace.tsx | head -10`

Read the stair inspector section and the stair_run/stair_landing type shapes before editing.

Tests: `pnpm test --filter @bim-ai/web`.
Prettier runs automatically. **Always `git pull --rebase origin main` before pushing.**

---

## Tasks

### A — stairComponentList.ts utility

Create `packages/web/src/plan/stairComponentList.ts`:

```ts
import type { Element } from '@bim-ai/core';

export interface StairComponentSummary {
  runs: Array<Extract<Element, { kind: 'stair_run' }>>;
  landings: Array<Extract<Element, { kind: 'stair_landing' }>>;
}

/**
 * Finds all stair_run and stair_landing elements that belong to the given stairId.
 */
export function getStairComponents(
  stairId: string,
  elementsById: Record<string, Element>,
): StairComponentSummary {
  const runs: Array<Extract<Element, { kind: 'stair_run' }>> = [];
  const landings: Array<Extract<Element, { kind: 'stair_landing' }>> = [];

  for (const el of Object.values(elementsById)) {
    if (el.kind === 'stair_run' && (el as any).parentStairId === stairId) {
      runs.push(el as any);
    }
    if (el.kind === 'stair_landing' && (el as any).parentStairId === stairId) {
      landings.push(el as any);
    }
  }

  return { runs, landings };
}
```

### B — Stair Assembly section in InspectorContent.tsx

Find `case 'stair':` in `InspectorContent.tsx`. Read the existing section carefully. After the existing stair properties (riserCount, runWidthMm, etc.), add a "Stair Assembly" subsection:

```tsx
{
  /* §8.6.2: Stair Assembly — list linked run/landing components */
}
<StairAssemblySection
  stairId={el.id}
  elementsById={elementsById}
  onSemanticCommand={onSemanticCommand}
/>;
```

Create a small inline component (can be defined at the top of InspectorContent.tsx or in a separate file `StairAssemblySection.tsx` in the inspector folder):

```tsx
function StairAssemblySection({
  stairId,
  elementsById,
  onSemanticCommand,
}: {
  stairId: string;
  elementsById: Record<string, Element>;
  onSemanticCommand?: (cmd: any) => void;
}) {
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
              Run {i + 1}: {(run as any).riserCount ?? '?'} risers, {(run as any).runWidthMm ?? '?'}
              mm wide
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
        {landings.map((landing, i) => (
          <div
            key={landing.id}
            data-testid={`inspector-stair-landing-row-${i}`}
            style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, marginBottom: 2 }}
          >
            <span>
              Landing {i + 1}: {(landing as any).depthMm ?? '?'}mm
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
        ))}
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
                parentStairId: stairId,
                riserCount: 10,
                runWidthMm: 1200,
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
                parentStairId: stairId,
                depthMm: 1200,
                widthMm: 1200,
                positionMm: { xMm: 0, yMm: 0 },
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
```

Import `getStairComponents` from `'../../plan/stairComponentList'` (adjust path as needed).
Import `Element` from `'@bim-ai/core'`.

Check the actual `stair_run` and `stair_landing` field names by reading `packages/core/src/index.ts` before implementing — use only fields that actually exist.

### C — Tests

Create `packages/web/src/plan/stairComponentList.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { getStairComponents } from './stairComponentList';

const elementsById: any = {
  s1: { id: 's1', kind: 'stair', levelId: 'L1' },
  sr1: {
    id: 'sr1',
    kind: 'stair_run',
    parentStairId: 's1',
    riserCount: 10,
    runWidthMm: 1200,
    startMm: { xMm: 0, yMm: 0 },
    endMm: { xMm: 0, yMm: 3000 },
  },
  sr2: {
    id: 'sr2',
    kind: 'stair_run',
    parentStairId: 's1',
    riserCount: 8,
    runWidthMm: 1000,
    startMm: { xMm: 0, yMm: 3500 },
    endMm: { xMm: 0, yMm: 6000 },
  },
  sl1: {
    id: 'sl1',
    kind: 'stair_landing',
    parentStairId: 's1',
    depthMm: 1200,
    widthMm: 1200,
    positionMm: { xMm: 0, yMm: 3000 },
  },
  sr3: {
    id: 'sr3',
    kind: 'stair_run',
    parentStairId: 's2',
    riserCount: 5,
    runWidthMm: 900,
    startMm: { xMm: 0, yMm: 0 },
    endMm: { xMm: 0, yMm: 1500 },
  },
};

describe('getStairComponents — §8.6.2', () => {
  it('returns runs belonging to stairId', () => {
    const { runs } = getStairComponents('s1', elementsById);
    expect(runs).toHaveLength(2);
    expect(runs.map((r) => r.id)).toContain('sr1');
    expect(runs.map((r) => r.id)).toContain('sr2');
  });

  it('returns landings belonging to stairId', () => {
    const { landings } = getStairComponents('s1', elementsById);
    expect(landings).toHaveLength(1);
    expect(landings[0].id).toBe('sl1');
  });

  it('excludes components from other stairs', () => {
    const { runs } = getStairComponents('s1', elementsById);
    expect(runs.map((r) => r.id)).not.toContain('sr3');
  });

  it('returns empty arrays for stair with no components', () => {
    const { runs, landings } = getStairComponents('nonexistent', elementsById);
    expect(runs).toHaveLength(0);
    expect(landings).toHaveLength(0);
  });

  it('handles empty elementsById', () => {
    const { runs, landings } = getStairComponents('s1', {});
    expect(runs).toHaveLength(0);
    expect(landings).toHaveLength(0);
  });
});
```

---

## Commit and push

```
git pull --rebase origin main
git add -p
git commit -m "feat(wave22/C): stair assembly inspector — component list panel with run/landing rows + add/remove buttons (§8.6.2)"
git push origin main
```

## Success criterion

`pnpm test --filter @bim-ai/web` — all tests pass.
