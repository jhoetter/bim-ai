# Wave 29 — WP-E: Family Reference Planes (§15.1.3)

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).
This prompt is self-contained — start here.

---

## Context

§15.1.3 "Fensterbearbeitung" is Partial P1. The family editor has extrusions, voids, sweeps, blends, parameters, constraints, opening cuts, and category assignment. What's still missing: **reference planes** — in Revit, reference planes are construction aids in the family editor that define parametric origins and axes (e.g., "Width = distance between ref planes 1 and 2"). They're the backbone of parametric family geometry.

This task adds:

1. `family_reference_plane` element type in `@bim-ai/core`
2. `AddFamilyReferencePlaneCmd` command type
3. Workspace handler
4. 3D visual: dashed line rendered in the family editor 3D scene (infinite extent in the family editor)
5. FamilyEditorWorkbench "Add Ref Plane" button
6. Inspector panel for `family_reference_plane`
7. `family.add-reference-plane` capability
8. Tests

---

## Repo orientation

```
packages/core/src/index.ts                              — find family_constraint, family_parameter as pattern for element kind
packages/web/src/families/FamilyEditorWorkbench.tsx     — find "+ Component", "+ Constraint" buttons as pattern
packages/web/src/workspace/Workspace.tsx                — find addFamilyConstraint as pattern
packages/web/src/workspace/WorkspaceRightRail.tsx       — find inspector cases for family elements
```

Run before editing:

- `grep -n "family_constraint\|family_opening_cut\|family_component" packages/core/src/index.ts | head -15`
- `grep -n "family-editor-add\|Add Constraint\|Add Component" packages/web/src/families/FamilyEditorWorkbench.tsx | head -10`
- `grep -n "addFamilyConstraint\|family_constraint\|family_opening" packages/web/src/workspace/Workspace.tsx | head -10`
- `grep -n "family_constraint\|family_opening_cut\|family_component" packages/web/src/workspace/WorkspaceRightRail.tsx | head -15`

Read the `family_constraint` element type and `addFamilyConstraint` handler carefully as the pattern for this task.

Tests: `npx vitest run` from `packages/web`.
Prettier runs automatically. **Always `git pull --rebase origin main` before pushing.**

---

## Tasks

### A — Add family_reference_plane element type in core

Find where `family_constraint` is defined in `packages/core/src/index.ts`. Add a new element kind nearby:

```ts
/** §15.1.3: a construction reference plane in a family definition. Defines parametric axes and origins. */
{
  kind: 'family_reference_plane';
  id: string;
  familyId: string;
  /** Human-readable name (e.g. "Center (Left/Right)", "Width Reference"). */
  name: string;
  /** Axis direction in the family's local XZ plane: 'x' (vertical line) or 'z' (horizontal line). */
  axis: 'x' | 'z';
  /** Offset from origin along the perpendicular axis, in mm. */
  offsetMm: number;
  /** Whether this is a strong reference (can be dimensioned to from the project). */
  isReference?: boolean;
}
```

Add `'family_reference_plane'` to the element kind union. Export a `AddFamilyReferencePlaneCmd` type:

```ts
export type AddFamilyReferencePlaneCmd = {
  type: 'addFamilyReferencePlane';
  familyId: string;
  name: string;
  axis: 'x' | 'z';
  offsetMm: number;
  isReference?: boolean;
};
```

Add `| AddFamilyReferencePlaneCmd` to `SemanticCommand`.

### B — Workspace handler

Find where `addFamilyConstraint` is handled. Add nearby:

```ts
if (cmd.type === 'addFamilyReferencePlane') {
  const id = `frp-${Date.now()}`;
  useBimStore.setState((s) => ({
    elementsById: {
      ...s.elementsById,
      [id]: {
        kind: 'family_reference_plane' as const,
        id,
        familyId: cmd.familyId as string,
        name: (cmd.name as string) || 'Reference Plane',
        axis: (cmd.axis as 'x' | 'z') || 'x',
        offsetMm: (cmd.offsetMm as number) ?? 0,
        isReference: (cmd.isReference as boolean | undefined) ?? true,
      },
    },
  }));
  return;
}
```

### C — FamilyEditorWorkbench: "Add Ref Plane" button

Find the section in `FamilyEditorWorkbench.tsx` where other "Add …" buttons are defined (e.g., "Add Constraint", "+ Component"). Add:

```tsx
{
  /* §15.1.3: reference plane */
}
<button
  data-testid="family-editor-add-ref-plane-btn"
  onClick={() =>
    onSemanticCommand?.({
      type: 'addFamilyReferencePlane',
      familyId: activeFamilyId,
      name: `Ref Plane ${refPlanesCount + 1}`,
      axis: 'x',
      offsetMm: 0,
      isReference: true,
    })
  }
  style={{ fontSize: 11, padding: '2px 6px', cursor: 'pointer' }}
>
  + Ref Plane
</button>;
```

Where `refPlanesCount` = count of `family_reference_plane` elements for this family. Adapt to actual prop names.

### D — Inspector panel for family_reference_plane

In `WorkspaceRightRail.tsx` (or wherever `family_constraint` inspector case is handled), add a case for `family_reference_plane`:

```tsx
case 'family_reference_plane': {
  const frp = element as any;
  return (
    <div style={{ fontSize: 11, padding: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ fontWeight: 600, marginBottom: 4 }}>Reference Plane</div>
      <label>
        Name
        <input
          data-testid="inspector-ref-plane-name"
          type="text"
          value={frp.name ?? ''}
          onChange={(e) =>
            onSemanticCommand?.({ type: 'updateElement', id: frp.id, patch: { name: e.target.value } })
          }
          style={{ marginLeft: 6, fontSize: 11, width: 120 }}
        />
      </label>
      <label>
        Axis
        <select
          data-testid="inspector-ref-plane-axis"
          value={frp.axis ?? 'x'}
          onChange={(e) =>
            onSemanticCommand?.({ type: 'updateElement', id: frp.id, patch: { axis: e.target.value } })
          }
          style={{ marginLeft: 6, fontSize: 11 }}
        >
          <option value="x">X (vertical)</option>
          <option value="z">Z (horizontal)</option>
        </select>
      </label>
      <label>
        Offset (mm)
        <input
          data-testid="inspector-ref-plane-offset"
          type="number"
          value={frp.offsetMm ?? 0}
          onChange={(e) =>
            onSemanticCommand?.({ type: 'updateElement', id: frp.id, patch: { offsetMm: Number(e.target.value) } })
          }
          style={{ marginLeft: 6, fontSize: 11, width: 70 }}
        />
      </label>
    </div>
  );
}
```

**Important**: Read the actual inspector code to find where other family element cases are handled. Check if `updateElement` is the right command type or if there's a more specific patch command. Adapt to the actual prop/callback names.

### E — commandCapabilities.ts entry

```ts
{
  id: 'family.add-reference-plane',
  label: 'Add Family Reference Plane',
  owner: 'families/FamilyEditorWorkbench',
  group: 'family',
  scope: 'canvas',
  intendedModes: ['plan'],
  surfaces: ['family-editor', 'cmd-k'],
  executionSurface: 'store',
  preconditions: [],
  status: 'implemented',
  usabilityScore: 8,
  notes: '§15.1.3: family_reference_plane element (name, axis x|z, offsetMm, isReference) in family editor — parametric construction planes for anchoring family geometry.',
},
```

Add a matching `registerCommand` for `family.add-reference-plane` in `defaultCommands.ts`:

```ts
registerCommand({
  id: 'family.add-reference-plane',
  label: 'Add Family Reference Plane',
  keywords: ['reference plane', 'family', 'parametric', 'axis', 'construction plane', 'ref plane'],
  category: 'family',
  isAvailable: (ctx) => !!ctx.activeFamilyId,
  invoke: (ctx) => {
    if (ctx.activeFamilyId) {
      ctx.dispatchCommand?.({
        type: 'addFamilyReferencePlane',
        familyId: ctx.activeFamilyId,
        name: 'Reference Plane',
        axis: 'x',
        offsetMm: 0,
        isReference: true,
      });
    }
  },
});
```

### F — Tests

Create `packages/web/src/families/familyReferencePlane.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

describe('Family reference plane — §15.1.3', () => {
  it('AddFamilyReferencePlaneCmd has correct shape', () => {
    const cmd = {
      type: 'addFamilyReferencePlane' as const,
      familyId: 'fam1',
      name: 'Width Reference',
      axis: 'x' as const,
      offsetMm: 0,
      isReference: true,
    };
    expect(cmd.type).toBe('addFamilyReferencePlane');
    expect(cmd.axis).toBe('x');
  });

  it('reference plane has correct element shape', () => {
    const frp: any = {
      kind: 'family_reference_plane',
      id: 'frp1',
      familyId: 'fam1',
      name: 'Center (Left/Right)',
      axis: 'x',
      offsetMm: 0,
      isReference: true,
    };
    expect(frp.kind).toBe('family_reference_plane');
    expect(frp.axis).toBe('x');
  });

  it('axis can be x or z', () => {
    const axes: Array<'x' | 'z'> = ['x', 'z'];
    expect(axes).toContain('x');
    expect(axes).toContain('z');
  });

  it('offsetMm defaults to 0', () => {
    const frp: any = { kind: 'family_reference_plane', offsetMm: 0 };
    expect(frp.offsetMm).toBe(0);
  });

  it('isReference defaults to true', () => {
    const frp: any = { kind: 'family_reference_plane', isReference: true };
    expect(frp.isReference).toBe(true);
  });

  it('z axis means horizontal reference plane', () => {
    const frp: any = { axis: 'z', offsetMm: 500 };
    const label = frp.axis === 'z' ? 'horizontal' : 'vertical';
    expect(label).toBe('horizontal');
  });
});
```

---

## Commit and push

```
git pull --rebase origin main
git add -p
git commit -m "feat(wave29/E): family reference planes — family_reference_plane element type + AddFamilyReferencePlaneCmd + Workspace handler + FamilyEditorWorkbench button + inspector panel (§15.1.3)"
git push origin main
```

## Success criterion

`npx vitest run` from `packages/web` — all tests pass including the new 6 tests.
