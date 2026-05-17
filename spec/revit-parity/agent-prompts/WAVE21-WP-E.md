# Wave 21 — WP-E: Family Parametric Constraint Propagation (§15.1.3)

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).
This prompt is self-contained — start here.

---

## Context

§15.1.3 "Fensterbearbeitung" is Partial — wave 17 added `family_parameter` element kinds and `applyFamilyParameters()`, but "full parametric constraint propagation (reference-plane-driven geometry) remains Partial." This task adds `family_constraint` — a constraint that links two reference planes with a named parameter, so changing the parameter value drives geometry dimensions.

---

## Repo orientation

```
packages/core/src/index.ts                           — add FamilyConstraintElem type
packages/web/src/families/familyParameterEval.ts    — add applyFamilyConstraints()
packages/web/src/families/FamilyEditorWorkbench.tsx — add constraint panel UI
packages/web/src/workspace/Workspace.tsx            — add command handlers
packages/web/src/workspace/inspector/InspectorContent.tsx — add inspector case
```

Run:
- `find packages/web/src -name "familyParameterEval*"` — locate the parameter evaluator
- `find packages/web/src -name "FamilyEditorWorkbench*"` — locate the workbench
- `grep -n "family_parameter\|FamilyParameter" packages/core/src/index.ts` — see the existing param type

Read `packages/core/src/index.ts` to see the full element union and existing family types.
Read `packages/web/src/families/familyParameterEval.ts` to understand `applyFamilyParameters()`.
Read `packages/web/src/families/FamilyEditorWorkbench.tsx` to see where the constraint panel should slot in.

Tests: `pnpm test --filter @bim-ai/web`.
Prettier runs automatically. **Always `git pull --rebase origin main` before pushing.**

---

## Tasks

### A — FamilyConstraintElem in packages/core/src/index.ts

After the existing `family_parameter` element definition, add:

```ts
export interface FamilyConstraintElem {
  id: string;
  kind: 'family_constraint';
  familyId: string;           // the family element this constraint belongs to
  paramName: string;          // name of the family_parameter that drives this constraint
  refPlaneId1: string;        // first reference plane element id
  refPlaneId2: string;        // second reference plane element id (driven by distance)
  axis: 'x' | 'y';           // which coordinate axis the constraint measures
}
```

Add `FamilyConstraintElem` to the `Element` union type (search for `| FamilyParameterElem` and add `| FamilyConstraintElem` beside it).

Add command types to the command union:
```ts
| { type: 'addFamilyConstraint'; constraint: FamilyConstraintElem }
| { type: 'removeFamilyConstraint'; constraintId: string }
```

### B — applyFamilyConstraints() in familyParameterEval.ts

In `packages/web/src/families/familyParameterEval.ts`, add a new exported function:

```ts
import type { FamilyConstraintElem, Element } from '@bim-ai/core';

/**
 * For each constraint that matches a parameter, moves refPlane2 so the distance
 * between refPlane1 and refPlane2 equals the parameter's value in mm.
 * Returns updated elements map.
 */
export function applyFamilyConstraints(
  elementsById: Record<string, Element>,
  constraints: FamilyConstraintElem[],
  paramValues: Record<string, number>, // paramName -> valueMm
): Record<string, Element> {
  let updated = { ...elementsById };

  for (const constraint of constraints) {
    const valueMm = paramValues[constraint.paramName];
    if (valueMm === undefined) continue;

    const plane1 = updated[constraint.refPlaneId1] as any;
    const plane2 = updated[constraint.refPlaneId2] as any;
    if (!plane1 || !plane2) continue;

    // Move plane2's position so distance from plane1 equals valueMm
    if (constraint.axis === 'x') {
      const newX = (plane1.xMm ?? 0) + valueMm;
      updated = {
        ...updated,
        [plane2.id]: { ...plane2, xMm: newX },
      };
    } else {
      const newY = (plane1.yMm ?? 0) + valueMm;
      updated = {
        ...updated,
        [plane2.id]: { ...plane2, yMm: newY },
      };
    }
  }

  return updated;
}
```

### C — Workspace.tsx handlers

In `packages/web/src/workspace/Workspace.tsx`, add handlers for the new commands (find the section near other family command handlers — search for `family_parameter` or `FamilyVoid`):

```ts
if (cmd.type === 'addFamilyConstraint') {
  const { elementsById: cur } = useBimStore.getState();
  useBimStore.setState({
    elementsById: { ...cur, [cmd.constraint.id]: cmd.constraint },
  });
  return;
}
if (cmd.type === 'removeFamilyConstraint') {
  const { elementsById: cur } = useBimStore.getState();
  const next = { ...cur };
  delete next[cmd.constraintId];
  useBimStore.setState({ elementsById: next });
  return;
}
```

### D — Inspector section in InspectorContent.tsx

In `InspectorContent.tsx`, add a `case 'family_constraint':` branch:

```tsx
case 'family_constraint': {
  const fc = el as FamilyConstraintElem;
  return (
    <div data-testid="inspector-family-constraint">
      <div style={{ marginBottom: 8 }}>
        <strong>Parametric Constraint</strong>
      </div>
      <label style={{ display: 'block', marginBottom: 4 }}>
        Parameter
        <input data-testid="inspector-fc-param-name" value={fc.paramName} readOnly
          style={{ display: 'block', width: '100%', marginTop: 2 }} />
      </label>
      <label style={{ display: 'block', marginBottom: 4 }}>
        Axis
        <span data-testid="inspector-fc-axis" style={{ marginLeft: 8 }}>{fc.axis}</span>
      </label>
      <label style={{ display: 'block', marginBottom: 4 }}>
        Ref Plane 1 ID
        <span data-testid="inspector-fc-ref1" style={{ marginLeft: 8, fontSize: 11, color: '#aaa' }}>
          {fc.refPlaneId1}
        </span>
      </label>
      <label style={{ display: 'block', marginBottom: 8 }}>
        Ref Plane 2 ID
        <span data-testid="inspector-fc-ref2" style={{ marginLeft: 8, fontSize: 11, color: '#aaa' }}>
          {fc.refPlaneId2}
        </span>
      </label>
      <button
        data-testid="inspector-fc-remove"
        onClick={() => onSemanticCommand?.({ type: 'removeFamilyConstraint', constraintId: fc.id })}
        style={{ color: '#f87171', fontSize: 12 }}>
        Remove Constraint
      </button>
    </div>
  );
}
```

Make sure to import `FamilyConstraintElem` from `@bim-ai/core`.

### E — FamilyEditorWorkbench constraint panel

In `packages/web/src/families/FamilyEditorWorkbench.tsx`, add a "Constraints" section:

1. Find where parameters are listed (grep for `family_parameter` in the workbench file)
2. Below the parameters section, add:

```tsx
{/* Parametric Constraints */}
<div style={{ marginTop: 12 }}>
  <strong style={{ fontSize: 12 }}>Parametric Constraints</strong>
  {constraintElements.map(fc => (
    <div key={fc.id} data-testid={`family-editor-constraint-${fc.id}`}
      style={{ fontSize: 11, color: '#aaa', padding: '2px 0' }}>
      {fc.paramName} → {fc.axis.toUpperCase()} between {fc.refPlaneId1.slice(-4)} / {fc.refPlaneId2.slice(-4)}
    </div>
  ))}
  <button data-testid="family-editor-add-constraint-btn"
    onClick={() => {
      const newConstraint: FamilyConstraintElem = {
        id: crypto.randomUUID(),
        kind: 'family_constraint',
        familyId: activeFamilyId ?? '',
        paramName: '',
        refPlaneId1: '',
        refPlaneId2: '',
        axis: 'x',
      };
      onSemanticCommand?.({ type: 'addFamilyConstraint', constraint: newConstraint });
    }}
    style={{ fontSize: 11, marginTop: 4 }}>
    + Add Constraint
  </button>
</div>
```

Where `constraintElements` is derived from `elementsById` by filtering for `kind === 'family_constraint'` with the matching `familyId`. Use local variables to compute this. If the workbench doesn't already expose `elementsById` and `onSemanticCommand`, subscribe to the store directly using `useBimStore`.

You must read the actual file before editing to understand the exact props/state available.

### F — Tests

Create `packages/web/src/families/familyConstraint.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { applyFamilyConstraints } from './familyParameterEval';
import type { FamilyConstraintElem } from '@bim-ai/core';

const plane1: any = { id: 'rp1', kind: 'reference_plane', xMm: 0, yMm: 0 };
const plane2: any = { id: 'rp2', kind: 'reference_plane', xMm: 500, yMm: 0 };

const elementsById: Record<string, any> = { rp1: plane1, rp2: plane2 };

const constraint: FamilyConstraintElem = {
  id: 'c1', kind: 'family_constraint',
  familyId: 'fam1',
  paramName: 'Width',
  refPlaneId1: 'rp1',
  refPlaneId2: 'rp2',
  axis: 'x',
};

describe('applyFamilyConstraints — §15.1.3', () => {
  it('moves refPlane2 x position to match param value', () => {
    const result = applyFamilyConstraints(elementsById, [constraint], { Width: 1200 });
    expect((result['rp2'] as any).xMm).toBe(1200);
  });

  it('does not move plane when param is not in paramValues', () => {
    const result = applyFamilyConstraints(elementsById, [constraint], {});
    expect((result['rp2'] as any).xMm).toBe(500); // unchanged
  });

  it('applies y-axis constraint correctly', () => {
    const yConstraint: FamilyConstraintElem = { ...constraint, id: 'c2', axis: 'y', paramName: 'Height' };
    const result = applyFamilyConstraints(elementsById, [yConstraint], { Height: 800 });
    expect((result['rp2'] as any).yMm).toBe(800);
  });

  it('skips constraint when refPlane does not exist', () => {
    const broken: FamilyConstraintElem = { ...constraint, refPlaneId1: 'nonexistent' };
    expect(() => applyFamilyConstraints(elementsById, [broken], { Width: 1000 })).not.toThrow();
  });

  it('applies multiple constraints independently', () => {
    const c2: FamilyConstraintElem = {
      id: 'c2', kind: 'family_constraint',
      familyId: 'fam1', paramName: 'Height',
      refPlaneId1: 'rp1', refPlaneId2: 'rp2',
      axis: 'y',
    };
    const result = applyFamilyConstraints(
      elementsById,
      [constraint, c2],
      { Width: 1200, Height: 900 },
    );
    expect((result['rp2'] as any).xMm).toBe(1200);
    expect((result['rp2'] as any).yMm).toBe(900);
  });
});
```

---

## Commit and push

```
git pull --rebase origin main
git add -p
git commit -m "feat(wave21/E): family parametric constraints — FamilyConstraintElem + applyFamilyConstraints + inspector + workbench panel (§15.1.3)"
git push origin main
```

## Success criterion

`pnpm test --filter @bim-ai/web` — all tests pass.
