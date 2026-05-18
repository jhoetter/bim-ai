# Wave 25 — WP-B: Family Opening Cut Utility (§15.1.3)

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).
This prompt is self-contained — start here.

---

## Context

§15.1.3 "Fensterbearbeitung" is Partial. Custom window families have extrusion geometry, parametric parameters, and constraints. What's missing is **parametric opening cut** — the ability to mark a family as "wall-hosted with opening cut", so that when it's placed in a wall the wall gets a corresponding rectangular opening.

In Revit, window and door families automatically cut openings in their host walls. In bim-ai, windows/doors have a host wall and the wall gets a `windowId`/`doorId` reference, but there's no explicit opening cut element type from family authoring.

This task adds:
1. `FamilyOpeningCutElem` type — defines the cut profile within a family
2. `setFamilyOpeningCut` command to add/update the opening cut on a family
3. Workspace handler
4. Inspector toggle/input in family_extrusion case
5. Tests

---

## Repo orientation

```
packages/core/src/index.ts                         — find family_extrusion and family_void union members
packages/web/src/workspace/Workspace.tsx           — find addFamilyComponent handler as pattern
packages/web/src/workspace/inspector/InspectorContent.tsx — find case 'family_extrusion': as pattern
packages/web/src/familyEditor/FamilyEditorWorkbench.tsx   — find "Add Glazing Panel" button as pattern
```

Run before editing:
- `grep -n "kind: 'family_" packages/core/src/index.ts | head -15`
- `grep -n "family_void\|FamilyVoid" packages/core/src/index.ts | head -10`
- `grep -n "case 'family_extrusion'" packages/web/src/workspace/inspector/InspectorContent.tsx | head -5`

Tests: `npx vitest run` from `packages/web`.
Prettier runs automatically. **Always `git pull --rebase origin main` before pushing.**

---

## Tasks

### A — Add FamilyOpeningCutElem to packages/core/src/index.ts

Find the `family_void` union member. After it, add:

```ts
| {
    /** §15.1.3: parametric opening cut shape within a wall-hosted family definition.
     *  When the family is placed in a wall, this geometry defines the void cut. */
    kind: 'family_opening_cut';
    id: string;
    /** Parent family definition element ID. */
    familyId: string;
    /** Width of the opening cut in mm (local family X axis). */
    widthMm: number;
    /** Height of the opening cut in mm (local family Z axis). */
    heightMm: number;
    /** Vertical offset from sill (bottom of opening) in mm. Defaults to 0. */
    sillOffsetMm?: number;
  }
```

Add `'family_opening_cut'` to the ElemKind union.

### B — Add SetFamilyOpeningCutCmd

Find where `AddFamilyComponentCmd` is defined (near the end of core/index.ts). Add:

```ts
export type SetFamilyOpeningCutCmd = {
  type: 'setFamilyOpeningCut';
  familyId: string;
  widthMm: number;
  heightMm: number;
  sillOffsetMm?: number;
};
```

Add `| SetFamilyOpeningCutCmd` to `SemanticCommand` and export it.

### C — Workspace handler in Workspace.tsx

Find the `addFamilyComponent` handler as pattern. Add after it:

```ts
if (cmd.type === 'setFamilyOpeningCut') {
  const { elementsById: cur } = useBimStore.getState();
  // Remove any existing family_opening_cut for this family
  const without = Object.fromEntries(
    Object.entries(cur).filter(
      ([, el]) => !(el.kind === 'family_opening_cut' && (el as any).familyId === cmd.familyId),
    ),
  );
  const newId = crypto.randomUUID();
  useBimStore.setState({
    elementsById: {
      ...without,
      [newId]: {
        kind: 'family_opening_cut',
        id: newId,
        familyId: cmd.familyId as string,
        widthMm: cmd.widthMm as number,
        heightMm: cmd.heightMm as number,
        sillOffsetMm: (cmd.sillOffsetMm as number | undefined) ?? 0,
      } as any,
    },
  });
  return;
}
```

### D — Inspector case in InspectorContent.tsx

Find `case 'family_opening_cut':` — if it doesn't exist, add it near `case 'family_component':`:

```tsx
case 'family_opening_cut': {
  return (
    <div style={{ padding: 8 }}>
      <div className="text-xs font-semibold mb-2">Opening Cut</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 11, width: 60 }}>Width</span>
          <span data-testid="inspector-opening-cut-width" style={{ fontSize: 11 }}>
            {(el as any).widthMm} mm
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 11, width: 60 }}>Height</span>
          <span data-testid="inspector-opening-cut-height" style={{ fontSize: 11 }}>
            {(el as any).heightMm} mm
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 11, width: 60 }}>Sill offset</span>
          <span data-testid="inspector-opening-cut-sill" style={{ fontSize: 11 }}>
            {(el as any).sillOffsetMm ?? 0} mm
          </span>
        </div>
      </div>
    </div>
  );
}
```

### E — FamilyEditorWorkbench "Add Opening Cut" button

In `FamilyEditorWorkbench.tsx`, find the "+ Component" button. Add after it:

```tsx
<button
  data-testid="family-editor-add-opening-cut-btn"
  onClick={() =>
    onSemanticCommand?.({
      type: 'setFamilyOpeningCut',
      familyId: activeFamilyId,
      widthMm: 900,
      heightMm: 2100,
      sillOffsetMm: 0,
    })
  }
  style={{ fontSize: 12, padding: '2px 8px', borderRadius: 4, border: '1px solid #444' }}
>
  ✂ Opening Cut
</button>
```

Adapt to the actual prop names in the component.

### F — commandCapabilities.ts entry

```ts
{
  id: 'family.set-opening-cut',
  label: 'Set Family Opening Cut',
  owner: 'familyEditor/FamilyEditorWorkbench',
  group: 'family',
  scope: 'canvas',
  intendedModes: ['family-editor'],
  surfaces: ['family-editor'],
  executionSurface: 'store',
  preconditions: ['family-editor-open'],
  status: 'implemented',
  usabilityScore: 7,
  notes: '§15.1.3: defines the void cut shape within a wall-hosted family (window/door opening).',
},
```

### G — Tests

Create `packages/web/src/plan/familyOpeningCut.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

describe('FamilyOpeningCut — §15.1.3', () => {
  it('SetFamilyOpeningCutCmd has correct shape', () => {
    const cmd = {
      type: 'setFamilyOpeningCut' as const,
      familyId: 'fam-01',
      widthMm: 900,
      heightMm: 2100,
      sillOffsetMm: 0,
    };
    expect(cmd.type).toBe('setFamilyOpeningCut');
    expect(cmd.widthMm).toBe(900);
    expect(cmd.heightMm).toBe(2100);
  });

  it('sillOffsetMm defaults to 0 when omitted', () => {
    const sillOffsetMm = undefined ?? 0;
    expect(sillOffsetMm).toBe(0);
  });

  it('family_opening_cut element has required fields', () => {
    const el: any = {
      kind: 'family_opening_cut',
      id: 'oc-01',
      familyId: 'fam-01',
      widthMm: 900,
      heightMm: 2100,
      sillOffsetMm: 0,
    };
    expect(el.kind).toBe('family_opening_cut');
    expect(el.familyId).toBe('fam-01');
    expect(el.widthMm).toBe(900);
  });

  it('opening cut area computes correctly', () => {
    const widthMm = 900;
    const heightMm = 2100;
    const areaSqM = (widthMm / 1000) * (heightMm / 1000);
    expect(areaSqM).toBeCloseTo(1.89);
  });
});
```

---

## Commit and push

```
git pull --rebase origin main
git add -p
git commit -m "feat(wave25/B): family opening cut — FamilyOpeningCutElem + SetFamilyOpeningCutCmd + Workspace handler + inspector case + FamilyEditorWorkbench button (§15.1.3)"
git push origin main
```

## Success criterion

`npx vitest run` from `packages/web` — all tests pass including the new 4 tests.
