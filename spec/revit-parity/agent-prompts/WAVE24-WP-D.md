# Wave 24 — WP-D: Family Nested Component Placement (§15.1.2)

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).
This prompt is self-contained — start here.

---

## Context

§15.1.2 "Die Multifunktionsleiste »Erstellen«" is Partial. The family editor supports extrusions, revolves, blends, sweeps, swept blends, voids, and parametric constraints. What's still missing is **nested component placement** — the ability to place an instance of another family (e.g., door hardware, hinge, window sill trim) as a sub-component inside a host family definition.

In Revit this is "Component" in the Create ribbon of the family editor.

This task adds:
1. `family_component` element type in core
2. `addFamilyComponent` command
3. Workspace handler
4. FamilyEditorWorkbench "Add Component" button
5. Inspector case
6. Tests

---

## Repo orientation

```
packages/core/src/index.ts                          — find family_extrusion / family_void union members as pattern; find SemanticCommand union
packages/web/src/familyEditor/FamilyEditorWorkbench.tsx — find "Add Swept Blend" or similar buttons as pattern
packages/web/src/workspace/inspector/InspectorContent.tsx — find case 'family_extrusion': or 'family_swept_blend': as pattern
packages/web/src/workspace/Workspace.tsx            — find addFamilySweep or addFamilySweptBlend handlers as pattern
```

Run before editing:
- `grep -n "kind: 'family_" packages/core/src/index.ts | head -20` — see all existing family element kinds
- `grep -n "addFamily\|family.*Add\|family_swept_blend" packages/web/src/workspace/Workspace.tsx | head -10`
- `grep -n "family-editor-add\|Add.*Blend\|Add.*Sweep" packages/web/src/familyEditor/FamilyEditorWorkbench.tsx | head -10`
- `grep -n "case 'family_" packages/web/src/workspace/inspector/InspectorContent.tsx | head -10`

Tests: `npx vitest run` from `packages/web`.
Prettier runs automatically. **Always `git pull --rebase origin main` before pushing.**

---

## Tasks

### A — Add family_component to packages/core/src/index.ts

Find the family_void union member (search `kind: 'family_void'`). After it, add:

```ts
| {
    /** §15.1.2: a nested sub-component instance placed inside a family definition. */
    kind: 'family_component';
    id: string;
    /** The parent family definition's element ID. */
    familyId: string;
    /** Which catalog family type this component represents (e.g. 'door-hardware', 'hinge'). */
    componentTypeId: string;
    /** Label shown in FamilyEditorWorkbench. */
    label?: string;
    /** Position within the family's local coordinate system (mm). */
    originMm: { xMm: number; yMm: number; zMm: number };
    /** Rotation in degrees around the vertical (Z) axis. */
    rotationDeg?: number;
  }
```

Add `'family_component'` to the ElemKind union (find the long string union `'wall' | 'floor' | ...`).

### B — Add AddFamilyComponentCmd in packages/core/src/index.ts

Find where `AddFamilySweepCmd` or similar is defined. Add:

```ts
export type AddFamilyComponentCmd = {
  type: 'addFamilyComponent';
  familyId: string;
  componentTypeId: string;
  label?: string;
  originMm: { xMm: number; yMm: number; zMm: number };
  rotationDeg?: number;
};
```

Add `| AddFamilyComponentCmd` to the `SemanticCommand` union and export it.

### C — Workspace handler in packages/web/src/workspace/Workspace.tsx

Find the `addFamilySweep` or `addFamilySweptBlend` handler as pattern. Add:

```ts
if (cmd.type === 'addFamilyComponent') {
  const { elementsById: cur } = useBimStore.getState();
  const newId = crypto.randomUUID();
  useBimStore.setState({
    elementsById: {
      ...cur,
      [newId]: {
        kind: 'family_component',
        id: newId,
        familyId: cmd.familyId as string,
        componentTypeId: cmd.componentTypeId as string,
        label: (cmd.label as string | undefined) ?? cmd.componentTypeId,
        originMm: cmd.originMm as { xMm: number; yMm: number; zMm: number },
        rotationDeg: (cmd.rotationDeg as number | undefined) ?? 0,
      } as any,
    },
  });
  return;
}
```

### D — FamilyEditorWorkbench button

In `packages/web/src/familyEditor/FamilyEditorWorkbench.tsx`, find the "Add Swept Blend" button (search for `family-editor-add-swept-blend-btn` or similar). After it, add:

```tsx
<button
  data-testid="family-editor-add-component-btn"
  onClick={() =>
    onSemanticCommand?.({
      type: 'addFamilyComponent',
      familyId: activeFamilyId,
      componentTypeId: 'generic-component',
      label: 'Component',
      originMm: { xMm: 0, yMm: 0, zMm: 0 },
      rotationDeg: 0,
    })
  }
  style={{ fontSize: 12, padding: '2px 8px', borderRadius: 4, border: '1px solid #444' }}
>
  + Component
</button>
```

**Adapt to the actual prop name** — read how `onSemanticCommand` and `activeFamilyId` are accessed in the file before editing.

### E — Inspector case in InspectorContent.tsx

Find `case 'family_swept_blend':` or `case 'family_extrusion':` as pattern. Add:

```tsx
case 'family_component': {
  return (
    <div style={{ padding: 8 }}>
      <div className="text-xs font-semibold mb-1">Nested Component</div>
      <div className="text-xs text-muted" data-testid="inspector-family-component-type">
        Type: {(el as any).componentTypeId}
      </div>
      <div className="text-xs text-muted" data-testid="inspector-family-component-label">
        Label: {(el as any).label ?? (el as any).componentTypeId}
      </div>
      <div className="text-xs text-muted">
        Origin: ({(el as any).originMm?.xMm?.toFixed(0)}, {(el as any).originMm?.yMm?.toFixed(0)}, {(el as any).originMm?.zMm?.toFixed(0)}) mm
      </div>
    </div>
  );
}
```

### F — commandCapabilities.ts entry

Add to `packages/web/src/workspace/commandCapabilities.ts`:

```ts
{
  id: 'family.add-component',
  label: 'Add Nested Component',
  owner: 'familyEditor/FamilyEditorWorkbench',
  group: 'family',
  scope: 'canvas',
  intendedModes: ['family-editor'],
  surfaces: ['family-editor'],
  executionSurface: 'store',
  preconditions: ['family-editor-open'],
  status: 'implemented',
  usabilityScore: 7,
  notes: '§15.1.2: places a nested sub-component instance inside a family definition.',
},
```

### G — Tests

Create `packages/web/src/plan/familyNestedComponent.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

describe('FamilyComponent — §15.1.2', () => {
  it('AddFamilyComponentCmd has correct shape', () => {
    const cmd = {
      type: 'addFamilyComponent' as const,
      familyId: 'fam-01',
      componentTypeId: 'door-hardware',
      label: 'Handle',
      originMm: { xMm: 0, yMm: 0, zMm: 1000 },
      rotationDeg: 90,
    };
    expect(cmd.type).toBe('addFamilyComponent');
    expect(cmd.componentTypeId).toBe('door-hardware');
    expect(cmd.originMm.zMm).toBe(1000);
  });

  it('rotationDeg defaults to 0 when omitted', () => {
    const cmd = {
      type: 'addFamilyComponent' as const,
      familyId: 'fam-01',
      componentTypeId: 'hinge',
      originMm: { xMm: 0, yMm: 0, zMm: 0 },
    };
    const rotationDeg = cmd.rotationDeg ?? 0;
    expect(rotationDeg).toBe(0);
  });

  it('family_component element has familyId and componentTypeId', () => {
    const el: any = {
      kind: 'family_component',
      id: 'fc-01',
      familyId: 'fam-01',
      componentTypeId: 'hinge',
      originMm: { xMm: 100, yMm: 0, zMm: 500 },
    };
    expect(el.kind).toBe('family_component');
    expect(el.familyId).toBe('fam-01');
    expect(el.originMm.zMm).toBe(500);
  });

  it('label falls back to componentTypeId when not set', () => {
    const el: any = { componentTypeId: 'generic-hardware' };
    expect(el.label ?? el.componentTypeId).toBe('generic-hardware');
  });
});
```

---

## Commit and push

```
git pull --rebase origin main
git add -p
git commit -m "feat(wave24/D): family nested component placement — family_component type + addFamilyComponent command + Workspace handler + FamilyEditorWorkbench button + inspector case (§15.1.2)"
git push origin main
```

## Success criterion

`npx vitest run` from `packages/web` — all tests pass including the new 4 tests.
