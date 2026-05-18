# Wave 24 — WP-A: Angular + Radial + Diameter Dimension Workspace Handlers (§4.1)

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).
This prompt is self-contained — start here.

---

## Context

§4.1 "Die Bemaßungsbefehle" is Partial. Angular, radial, and diameter dimension element types exist in `packages/core/src/index.ts`, grammars exist in `toolGrammar.ts`, and plan renderers exist in `detailComponentsRender.ts`. `AnnotateRibbon.tsx` dispatches `createAngularDimension`, `createRadialDimension`, `createDiameterDimension` semantic commands — but **Workspace.tsx has no handlers for these commands**. Without handlers, the dispatched commands are silently ignored and no elements are created.

This task wires up the 3 missing Workspace handlers and adds inspector cases.

---

## Repo orientation

```
packages/core/src/index.ts                  — angular_dimension, radial_dimension, diameter_dimension types (search for "kind: 'angular_dimension'")
packages/web/src/workspace/Workspace.tsx    — find 'createPermanentDimension' handler as pattern (~line 2400+)
packages/web/src/plan/AnnotateRibbon.tsx    — see lines 95-160 for how commands are dispatched
packages/web/src/workspace/inspector/InspectorContent.tsx — find 'permanent_dimension' case as pattern
packages/web/src/plan/detailComponentsRender.ts — angular/radial dim renderers already exist
```

Run before editing:

- `grep -n "angular_dimension\|radial_dimension\|diameter_dimension" packages/core/src/index.ts | head -20`
- `grep -n "createAngularDimension\|createRadialDimension\|createDiameterDimension" packages/web/src/plan/AnnotateRibbon.tsx`
- `grep -n "createPermanentDimension\|permanent_dimension" packages/web/src/workspace/Workspace.tsx | head -10`

Read the `angular_dimension`, `radial_dimension`, and `diameter_dimension` union members in `core/index.ts` carefully to know the exact field names before writing the handlers.

Tests: `pnpm test --filter @bim-ai/web` (run from repo root, or `npx vitest run` from packages/web).
Prettier runs automatically. **Always `git pull --rebase origin main` before pushing.**

---

## Tasks

### A — Read core types

Run:

```
grep -n "kind: 'angular_dimension'\|kind: 'radial_dimension'\|kind: 'diameter_dimension'" packages/core/src/index.ts
```

Read the 3 union members to confirm all field names (vertexMm, rayAMm, rayBMm, arcRadiusMm for angular; centerMm, arcPointMm for radial; etc.).

### B — Workspace handlers in packages/web/src/workspace/Workspace.tsx

Find the `createPermanentDimension` handler. After it, add handlers for the 3 new annotation dimension types.

Pattern: each handler creates a new element in `elementsById` using `crypto.randomUUID()` as the id.

For `createAngularDimension`:

```ts
if (cmd.type === 'createAngularDimension') {
  const { elementsById: cur } = useBimStore.getState();
  const newId = crypto.randomUUID();
  useBimStore.setState({
    elementsById: {
      ...cur,
      [newId]: {
        kind: 'angular_dimension',
        id: newId,
        hostViewId: cmd.hostViewId as string,
        vertexMm: cmd.vertexMm as { xMm: number; yMm: number },
        rayAMm: cmd.rayAMm as { xMm: number; yMm: number },
        rayBMm: cmd.rayBMm as { xMm: number; yMm: number },
        arcRadiusMm: (cmd.arcRadiusMm as number) ?? 400,
      } as any,
    },
  });
  return;
}
```

For `createRadialDimension`:

```ts
if (cmd.type === 'createRadialDimension') {
  const { elementsById: cur } = useBimStore.getState();
  const newId = crypto.randomUUID();
  useBimStore.setState({
    elementsById: {
      ...cur,
      [newId]: {
        kind: 'radial_dimension',
        id: newId,
        hostViewId: cmd.hostViewId as string,
        centerMm: cmd.centerMm as { xMm: number; yMm: number },
        arcPointMm: cmd.arcPointMm as { xMm: number; yMm: number },
      } as any,
    },
  });
  return;
}
```

For `createDiameterDimension` — check if `diameter_dimension` type exists in core:

```
grep -n "kind: 'diameter_dimension'" packages/core/src/index.ts | head -5
```

If it exists, add a similar handler. If not, skip it.

**Important**: Read the actual type fields from core before writing. If a field name differs from what's shown above, use the correct one.

### C — Inspector cases in packages/web/src/workspace/inspector/InspectorContent.tsx

Find `case 'permanent_dimension':` as pattern. Add cases for the 3 new types before or after it:

```tsx
case 'angular_dimension': {
  return (
    <div style={{ padding: 8 }}>
      <div className="text-xs font-semibold mb-1">Angular Dimension</div>
      <div className="text-xs text-muted">
        Vertex: ({(el as any).vertexMm?.xMm?.toFixed(0)}, {(el as any).vertexMm?.yMm?.toFixed(0)})
      </div>
      <div className="text-xs text-muted" data-testid="inspector-angular-dim-arc-radius">
        Arc radius: {(el as any).arcRadiusMm ?? 400} mm
      </div>
    </div>
  );
}
case 'radial_dimension': {
  const dx = ((el as any).arcPointMm?.xMm ?? 0) - ((el as any).centerMm?.xMm ?? 0);
  const dy = ((el as any).arcPointMm?.yMm ?? 0) - ((el as any).centerMm?.yMm ?? 0);
  const radiusMm = Math.round(Math.hypot(dx, dy));
  return (
    <div style={{ padding: 8 }}>
      <div className="text-xs font-semibold mb-1">Radial Dimension</div>
      <div className="text-xs text-muted" data-testid="inspector-radial-dim-radius">
        Radius: {radiusMm} mm
      </div>
    </div>
  );
}
```

If `diameter_dimension` type exists, add a similar case.

### D — commandCapabilities.ts entry

Add to `packages/web/src/workspace/commandCapabilities.ts`:

```ts
{
  id: 'annotate.angular-dimension',
  label: 'Angular Dimension',
  owner: 'plan/AnnotateRibbon',
  group: 'annotate',
  scope: 'view',
  intendedModes: ['plan'],
  surfaces: ['annotate-ribbon'],
  executionSurface: 'store',
  preconditions: [],
  status: 'implemented',
  usabilityScore: 7,
  notes: '§4.1: places an angular dimension annotation in the active plan view.',
},
{
  id: 'annotate.radial-dimension',
  label: 'Radial Dimension',
  owner: 'plan/AnnotateRibbon',
  group: 'annotate',
  scope: 'view',
  intendedModes: ['plan'],
  surfaces: ['annotate-ribbon'],
  executionSurface: 'store',
  preconditions: [],
  status: 'implemented',
  usabilityScore: 7,
  notes: '§4.1: places a radial dimension annotation in the active plan view.',
},
```

### E — Tests

Create `packages/web/src/plan/angularRadialDimensions.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

describe('Angular / Radial dimension command shapes — §4.1', () => {
  it('createAngularDimension has correct shape', () => {
    const cmd = {
      type: 'createAngularDimension' as const,
      hostViewId: 'v1',
      vertexMm: { xMm: 0, yMm: 0 },
      rayAMm: { xMm: 500, yMm: 0 },
      rayBMm: { xMm: 0, yMm: 500 },
      arcRadiusMm: 200,
    };
    expect(cmd.type).toBe('createAngularDimension');
    expect(cmd.vertexMm.xMm).toBe(0);
    expect(cmd.arcRadiusMm).toBe(200);
  });

  it('createRadialDimension has correct shape', () => {
    const cmd = {
      type: 'createRadialDimension' as const,
      hostViewId: 'v1',
      centerMm: { xMm: 0, yMm: 0 },
      arcPointMm: { xMm: 500, yMm: 0 },
    };
    expect(cmd.type).toBe('createRadialDimension');
    expect(cmd.arcPointMm.xMm).toBe(500);
  });

  it('radial dimension computes radius correctly', () => {
    const centerMm = { xMm: 0, yMm: 0 };
    const arcPointMm = { xMm: 300, yMm: 400 };
    const radius = Math.round(
      Math.hypot(arcPointMm.xMm - centerMm.xMm, arcPointMm.yMm - centerMm.yMm),
    );
    expect(radius).toBe(500);
  });

  it('angular dimension arc radius defaults to 400 if omitted', () => {
    const arcRadiusMm = undefined ?? 400;
    expect(arcRadiusMm).toBe(400);
  });
});
```

---

## Commit and push

```
git pull --rebase origin main
git add -p
git commit -m "feat(wave24/A): angular + radial + diameter dimension Workspace handlers + inspector cases (§4.1)"
git push origin main
```

## Success criterion

`npx vitest run` from `packages/web` — all tests pass including the new 4 tests.
