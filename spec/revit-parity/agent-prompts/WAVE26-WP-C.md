# Wave 26 — WP-C: Family Category Assignment (§15.1.2)

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).
This prompt is self-contained — start here.

---

## Context

§15.1.2 "Die Multifunktionsleiste Erstellen" is Partial. The family editor has extrusions, voids, blends, sweeps, swept-blends, nested components, parameters, constraints, and opening cuts. What's still missing is **category assignment** — in Revit, every family is assigned to a category (Doors, Windows, Furniture, Structural Columns, etc.) which determines which schedule, visibility control, and object snap behaviours apply.

This task adds:
1. `categoryKey?: string` field on the `family_definition` element type in core
2. `SetFamilyCategoryCmd` command type
3. Workspace handler
4. Inspector category selector for `family_definition` elements
5. FamilyEditorWorkbench category display/selector at the top of the workbench
6. Tests

---

## Repo orientation

```
packages/core/src/index.ts                             — find family_definition element type
packages/web/src/workspace/Workspace.tsx               — find addFamilyComponent handler as pattern
packages/web/src/workspace/inspector/InspectorContent.tsx — find case 'family_definition': or case 'family_extrusion':
packages/web/src/familyEditor/FamilyEditorWorkbench.tsx   — find existing toolbar/header area
```

Run before editing:
- `grep -n "family_definition\|familyCategoryKey\|categoryKey" packages/core/src/index.ts | head -10`
- `grep -n "family_definition\|SetFamilyCategory\|categoryKey" packages/web/src/familyEditor/FamilyEditorWorkbench.tsx | head -10`
- `grep -n "case 'family_definition'" packages/web/src/workspace/inspector/InspectorContent.tsx | head -5`

Tests: `npx vitest run` from `packages/web`.
Prettier runs automatically. **Always `git pull --rebase origin main` before pushing.**

---

## Tasks

### A — Add categoryKey to family_definition in packages/core/src/index.ts

Find the `family_definition` union member. Add:

```ts
/** Revit-style family category. Determines schedule, visibility controls, and object snap behavior. */
categoryKey?: string;
```

### B — Add SetFamilyCategoryCmd

Find where `AddFamilyComponentCmd` is defined. Add:

```ts
export type SetFamilyCategoryCmd = {
  type: 'setFamilyCategory';
  familyId: string;
  categoryKey: string;
};
```

Add `| SetFamilyCategoryCmd` to `SemanticCommand` and export it.

### C — Workspace handler in Workspace.tsx

Find the `addFamilyComponent` or `setFamilyOpeningCut` handler. Add:

```ts
if (cmd.type === 'setFamilyCategory') {
  const { elementsById: cur } = useBimStore.getState();
  const el = cur[cmd.familyId as string];
  if (!el || el.kind !== 'family_definition') return;
  useBimStore.setState({
    elementsById: { ...cur, [el.id]: { ...el, categoryKey: cmd.categoryKey as string } },
  });
  return;
}
```

### D — Standard family categories constant

Create `packages/web/src/familyEditor/familyCategories.ts`:

```ts
export const FAMILY_CATEGORIES = [
  { key: 'doors', label: 'Doors' },
  { key: 'windows', label: 'Windows' },
  { key: 'furniture', label: 'Furniture' },
  { key: 'structural_columns', label: 'Structural Columns' },
  { key: 'structural_framing', label: 'Structural Framing' },
  { key: 'casework', label: 'Casework' },
  { key: 'generic_models', label: 'Generic Models' },
  { key: 'lighting_fixtures', label: 'Lighting Fixtures' },
  { key: 'mechanical_equipment', label: 'Mechanical Equipment' },
  { key: 'plumbing_fixtures', label: 'Plumbing Fixtures' },
  { key: 'specialty_equipment', label: 'Specialty Equipment' },
] as const;

export type FamilyCategoryKey = (typeof FAMILY_CATEGORIES)[number]['key'];
```

### E — Inspector case for family_definition

Find `case 'family_definition':` in `InspectorContent.tsx`. If it exists, add a category row; if not, create the case:

```tsx
case 'family_definition': {
  const familyDef = el as any;
  return (
    <div style={{ padding: 8 }}>
      <div className="text-xs font-semibold mb-2">Family Definition</div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
        <span style={{ fontSize: 11, width: 70 }}>Category</span>
        <select
          data-testid="inspector-family-category"
          value={familyDef.categoryKey ?? ''}
          onChange={(e) =>
            onSemanticCommand?.({ type: 'setFamilyCategory', familyId: el.id, categoryKey: e.target.value })
          }
          style={{ fontSize: 11, flex: 1 }}
        >
          <option value="">-- Select Category --</option>
          {FAMILY_CATEGORIES.map((cat) => (
            <option key={cat.key} value={cat.key}>{cat.label}</option>
          ))}
        </select>
      </div>
    </div>
  );
}
```

Import `FAMILY_CATEGORIES` from `'../../familyEditor/familyCategories'` (adjust path to match actual directory structure).

**Important**: Read the actual InspectorContent.tsx to find the correct import path and whether a `family_definition` case already exists.

### F — FamilyEditorWorkbench category header

In `FamilyEditorWorkbench.tsx`, find the top header section of the workbench. Add a category selector below or beside the family name:

```tsx
// Find where activeFamilyId / familyDef is resolved, then:
<div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 8px', borderBottom: '1px solid #444' }}>
  <span style={{ fontSize: 11, color: '#aaa' }}>Category:</span>
  <select
    data-testid="family-editor-category-select"
    value={(familyDef as any)?.categoryKey ?? ''}
    onChange={(e) =>
      onSemanticCommand?.({ type: 'setFamilyCategory', familyId: activeFamilyId, categoryKey: e.target.value })
    }
    style={{ fontSize: 11 }}
  >
    <option value="">-- Select Category --</option>
    {FAMILY_CATEGORIES.map((cat) => (
      <option key={cat.key} value={cat.key}>{cat.label}</option>
    ))}
  </select>
</div>
```

Adapt prop names to the actual workbench. Import `FAMILY_CATEGORIES` from `'./familyCategories'`.

### G — commandCapabilities.ts entry

```ts
{
  id: 'family.set-category',
  label: 'Set Family Category',
  owner: 'familyEditor/FamilyEditorWorkbench',
  group: 'family',
  scope: 'canvas',
  intendedModes: ['family-editor'],
  surfaces: ['family-editor'],
  executionSurface: 'store',
  preconditions: ['family-editor-open'],
  status: 'implemented',
  usabilityScore: 7,
  notes: '§15.1.2: assigns a Revit-style category (Doors, Windows, Furniture, etc.) to a family definition.',
},
```

### H — Tests

Create `packages/web/src/familyEditor/familyCategory.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { FAMILY_CATEGORIES } from './familyCategories';

describe('Family category assignment — §15.1.2', () => {
  it('FAMILY_CATEGORIES has expected entries', () => {
    const keys = FAMILY_CATEGORIES.map((c) => c.key);
    expect(keys).toContain('doors');
    expect(keys).toContain('windows');
    expect(keys).toContain('furniture');
    expect(keys).toContain('generic_models');
  });

  it('SetFamilyCategoryCmd has correct shape', () => {
    const cmd = { type: 'setFamilyCategory' as const, familyId: 'fam-01', categoryKey: 'windows' };
    expect(cmd.type).toBe('setFamilyCategory');
    expect(cmd.categoryKey).toBe('windows');
  });

  it('categoryKey defaults to undefined (uncategorized)', () => {
    const el: any = { kind: 'family_definition', id: 'fam-01' };
    expect(el.categoryKey).toBeUndefined();
  });

  it('category label resolves from key', () => {
    const cat = FAMILY_CATEGORIES.find((c) => c.key === 'doors');
    expect(cat?.label).toBe('Doors');
  });
});
```

---

## Commit and push

```
git pull --rebase origin main
git add -p
git commit -m "feat(wave26/C): family category assignment — categoryKey on family_definition + SetFamilyCategoryCmd + Workspace handler + inspector + FamilyEditorWorkbench selector + FAMILY_CATEGORIES (§15.1.2)"
git push origin main
```

## Success criterion

`npx vitest run` from `packages/web` — all tests pass including the new 4 tests.
