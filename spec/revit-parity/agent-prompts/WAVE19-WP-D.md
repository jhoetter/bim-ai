# Wave 19 — WP-D: Floor Boundary Auto-Detect — Tool Wiring + Inspector Edge Profile (§2.4.2)

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).
This prompt is self-contained — start here.

---

## Context — what Wave 18 already delivered

Wave 18 WP-E created:
- `packages/web/src/plan/detectFloorBoundaryFromWalls.ts` — `detectFloorBoundaryFromWalls()` + convex hull

**Still missing:**
- `edgeProfileMm` + `autoDetectedBoundary` fields on `floor` element in `core/index.ts`
- Tool wiring: shift-click in floor tool triggers `detectFloorBoundaryFromWalls` and auto-creates a floor
- Inspector edge profile section (collapsible, point list with add/clear)
- Palette command `tool.floor-auto-detect` + capability graph entry

---

## Repo orientation

```
packages/core/src/index.ts                              — floor element type
packages/web/src/plan/detectFloorBoundaryFromWalls.ts   — utility (already exists)
packages/web/src/plan/PlanCanvas.tsx                    — floor tool handler
packages/web/src/tools/toolGrammar.ts                   — floor grammar
packages/web/src/workspace/inspector/InspectorContent.tsx — floor inspector
packages/web/src/cmdPalette/defaultCommands.ts
packages/web/src/workspace/commandCapabilities.ts
```

Read `PlanCanvas.tsx` for the floor tool click handler — find where floor sketch points are added. Read `InspectorContent.tsx` `case 'floor':` for the existing inspector layout.

Tests: run `pnpm test --filter @bim-ai/web`.
Prettier runs automatically. **Always `git pull --rebase origin main` before pushing.**

---

## Tasks

### A — Floor element additional fields in `core/index.ts`

Add if not present:
```ts
// On the floor element:
edgeProfileMm?: { xMm: number; yMm: number }[];
autoDetectedBoundary?: boolean;
```

---

### B — Shift-click auto-detect in `PlanCanvas.tsx`

In the floor tool click handler (or wherever floor boundary points are accumulated), add a branch for shift-click:

```ts
// When the floor tool is active and user shift-clicks:
if (activeTool === 'floor' && event.shiftKey) {
  const boundary = detectFloorBoundaryFromWalls(
    planMm,
    elementsById,
    activePlanView?.levelId ?? null,
  );
  if (boundary && boundary.length >= 3) {
    // Immediately create a floor with the auto-detected boundary
    void onSemanticCommand({
      type: 'createElement',
      element: {
        kind: 'floor',
        id: crypto.randomUUID(),
        perimeterMm: boundary,
        thicknessMm: 200,
        levelId: activePlanView?.levelId ?? null,
        autoDetectedBoundary: true,
      },
    });
    // Exit floor sketch mode
    setActiveTool(null);
  }
  return; // Don't add as a normal sketch point
}
```

Import `detectFloorBoundaryFromWalls` at the top of `PlanCanvas.tsx`.

Also update the status bar hint for the floor tool to include: `"Shift+click to auto-detect boundary from walls"`.

---

### C — Inspector edge profile section

In `InspectorContent.tsx`, `case 'floor':`, add an edge profile collapsible section after the existing floor inspector content:

```tsx
<details>
  <summary data-testid="inspector-floor-edge-profile-toggle">Edge Profile</summary>
  <div>
    {(el.edgeProfileMm ?? []).length === 0 ? (
      <span data-testid="inspector-floor-edge-no-profile">No custom profile</span>
    ) : (
      (el.edgeProfileMm ?? []).map((pt, i) => (
        <div key={i} style={{ display: 'flex', gap: 4 }}>
          <input type="number" data-testid={`inspector-floor-edge-pt-x-${i}`}
            value={pt.xMm}
            onChange={e => {
              const updated = [...(el.edgeProfileMm ?? [])];
              updated[i] = { ...updated[i], xMm: +e.target.value };
              onPropertyChange('edgeProfileMm', updated);
            }} />
          <input type="number" data-testid={`inspector-floor-edge-pt-y-${i}`}
            value={pt.yMm}
            onChange={e => {
              const updated = [...(el.edgeProfileMm ?? [])];
              updated[i] = { ...updated[i], yMm: +e.target.value };
              onPropertyChange('edgeProfileMm', updated);
            }} />
        </div>
      ))
    )}
    <button data-testid="inspector-floor-edge-add-pt"
      onClick={() => onPropertyChange('edgeProfileMm', [...(el.edgeProfileMm ?? []), { xMm: 0, yMm: 0 }])}>
      + Point
    </button>
    {(el.edgeProfileMm ?? []).length > 0 && (
      <button data-testid="inspector-floor-edge-clear"
        onClick={() => onPropertyChange('edgeProfileMm', [])}>
        Clear
      </button>
    )}
  </div>
</details>
{el.autoDetectedBoundary && (
  <span data-testid="inspector-floor-auto-boundary">Auto-detected boundary</span>
)}
```

---

### D — Palette command + capability graph

In `defaultCommands.ts`:
```ts
{ id: 'tool.floor-auto-detect', label: 'Auto-Detect Floor Boundary',
  keywords: ['floor', 'auto', 'detect', 'boundary', 'wall', 'slab'],
  category: 'tool', invoke: (ctx) => startPlanTool(ctx, 'floor') }
```

In `commandCapabilities.ts`:
```ts
{ id: 'tool.floor-auto-detect', scope: 'document', intendedModes: ['plan'], precondition: null },
```

---

### E — Tests

`packages/web/src/plan/floorBoundaryWiring.test.ts`:

```ts
import { detectFloorBoundaryFromWalls } from './detectFloorBoundaryFromWalls';

describe('detectFloorBoundaryFromWalls wiring — §2.4.2', () => {
  it('returns null for empty elements', () => {
    const result = detectFloorBoundaryFromWalls({ xMm: 0, yMm: 0 }, {}, null);
    expect(result).toBeNull();
  });

  it('returns polygon from four wall endpoints', () => {
    const elements: Record<string, any> = {
      w1: { kind: 'wall', levelId: 'L1', startMm: { xMm: 0, yMm: 0 }, endMm: { xMm: 5000, yMm: 0 } },
      w2: { kind: 'wall', levelId: 'L1', startMm: { xMm: 5000, yMm: 0 }, endMm: { xMm: 5000, yMm: 4000 } },
      w3: { kind: 'wall', levelId: 'L1', startMm: { xMm: 5000, yMm: 4000 }, endMm: { xMm: 0, yMm: 4000 } },
      w4: { kind: 'wall', levelId: 'L1', startMm: { xMm: 0, yMm: 4000 }, endMm: { xMm: 0, yMm: 0 } },
    };
    const result = detectFloorBoundaryFromWalls({ xMm: 2500, yMm: 2000 }, elements, 'L1');
    expect(result).not.toBeNull();
    expect(result!.length).toBeGreaterThanOrEqual(3);
  });

  it('filters walls by levelId', () => {
    const elements: Record<string, any> = {
      w1: { kind: 'wall', levelId: 'L2', startMm: { xMm: 0, yMm: 0 }, endMm: { xMm: 5000, yMm: 0 } },
    };
    const result = detectFloorBoundaryFromWalls({ xMm: 0, yMm: 0 }, elements, 'L1');
    expect(result).toBeNull();
  });
});
```

---

## Commit and push

```
git pull --rebase origin main
git add -p
git commit -m "feat(wave19/D): floor boundary auto-detect — shift-click wiring + edge profile inspector (§2.4.2)"
git push origin main
```

## Success criterion

`pnpm test --filter @bim-ai/web` — all tests pass.
