# Wave 17 — WP-J: Family Editor Parametric Parameters (§15.1.3)

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).
This prompt is self-contained — start here.

---

## Repo orientation

```
packages/core/src/index.ts                          — Element union (FamilyExtrusion, FamilyBlend, FamilySweep exist)
packages/web/src/workspace/FamilyEditorWorkbench.tsx — family editor UI (may exist)
packages/web/src/workspace/inspector/InspectorContent.tsx — inspector
packages/web/src/cmdPalette/defaultCommands.ts      — palette commands
packages/web/src/workspace/commandCapabilities.ts   — capability graph
```

Search for `FamilyEditor`, `family_editor`, `familyEditor`, `family_parameter`, `familyParameter`, `FamilyWorkbench` in the codebase first. Read EVERYTHING found before touching anything.

Tests: run `pnpm test --filter @bim-ai/web`.
Prettier runs automatically. **Always `git pull --rebase origin main` before pushing.**

---

## What already exists — read these first

1. `core/index.ts`: find all `family_*` element kinds. Read their fields. Find `family_parameter` — if it exists, read it.
2. `FamilyEditorWorkbench.tsx` (if exists): read the full component — what UI does it show?
3. Search for `familyTemplateCatalog`, `familyEditorPersistence` — read these files.
4. `InspectorContent.tsx`: find all `case 'family_*':` — read them.

---

## Tasks

The goal is to add a parametric parameter system to the family editor: users can define named parameters (e.g. "Width", "Height") and link them to dimension values on family geometry.

### A — `family_parameter` element type in `core/index.ts`

Add (if not present):

```ts
| {
    kind: 'family_parameter';
    id: string;
    /** Human-readable parameter name (e.g. "Width", "Breite"). */
    name: string;
    /** Parameter type. */
    paramType: 'length' | 'angle' | 'number' | 'boolean' | 'string';
    /** Current default value (in mm for length, degrees for angle). */
    defaultValue: number | boolean | string;
    /** Whether this parameter is an instance parameter (vs type parameter). */
    isInstance: boolean;
    /** Family ID this parameter belongs to. */
    familyId: string | null;
    /** Optional: link to a dimension on a geometry element. */
    linkedDimensionId?: string | null;
    /** Optional: which property of the geometry element is driven (e.g. 'widthMm', 'heightMm'). */
    linkedProperty?: string | null;
  }
```

Add command types:

```ts
| { type: 'addFamilyParameter'; parameter: Extract<Element, { kind: 'family_parameter' }> }
| { type: 'deleteFamilyParameter'; parameterId: string }
| { type: 'setFamilyParameterValue'; parameterId: string; value: number | boolean | string }
```

---

### B — `FamilyParameterPanel.tsx`

Create `packages/web/src/workspace/FamilyParameterPanel.tsx`:

```tsx
import React, { useState } from 'react';
import type { Element } from '@bim-ai/core';

type FamilyParam = Extract<Element, { kind: 'family_parameter' }>;

interface Props {
  parameters: FamilyParam[];
  onAdd: (param: Omit<FamilyParam, 'id'>) => void;
  onDelete: (id: string) => void;
  onValueChange: (id: string, value: number | boolean | string) => void;
}

export function FamilyParameterPanel({ parameters, onAdd, onDelete, onValueChange }: Props) {
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<FamilyParam['paramType']>('length');

  return (
    <div data-testid="family-parameter-panel">
      <h4>Parameters</h4>
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Type</th>
            <th>Value</th>
            <th>Instance</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {parameters.map((p) => (
            <tr key={p.id} data-testid={`family-param-row-${p.id}`}>
              <td data-testid={`family-param-name-${p.id}`}>{p.name}</td>
              <td data-testid={`family-param-type-${p.id}`}>{p.paramType}</td>
              <td>
                <input
                  data-testid={`family-param-value-${p.id}`}
                  type={p.paramType === 'boolean' ? 'checkbox' : 'number'}
                  value={p.paramType !== 'boolean' ? (p.defaultValue as number) : undefined}
                  checked={p.paramType === 'boolean' ? (p.defaultValue as boolean) : undefined}
                  onChange={(e) =>
                    onValueChange(
                      p.id,
                      p.paramType === 'boolean' ? e.target.checked : +e.target.value,
                    )
                  }
                />
              </td>
              <td>
                <input
                  type="checkbox"
                  data-testid={`family-param-instance-${p.id}`}
                  checked={p.isInstance}
                  readOnly
                />
              </td>
              <td>
                <button data-testid={`family-param-delete-${p.id}`} onClick={() => onDelete(p.id)}>
                  ×
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Add new parameter */}
      <div data-testid="family-param-add-row" style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <input
          data-testid="family-param-new-name"
          placeholder="Parameter name"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
        />
        <select
          data-testid="family-param-new-type"
          value={newType}
          onChange={(e) => setNewType(e.target.value as FamilyParam['paramType'])}
        >
          <option value="length">Length (mm)</option>
          <option value="angle">Angle (°)</option>
          <option value="number">Number</option>
          <option value="boolean">Boolean</option>
        </select>
        <button
          data-testid="family-param-add-btn"
          disabled={!newName.trim()}
          onClick={() => {
            onAdd({
              kind: 'family_parameter',
              name: newName.trim(),
              paramType: newType,
              defaultValue: newType === 'length' ? 1000 : newType === 'boolean' ? false : 0,
              isInstance: true,
              familyId: null,
            });
            setNewName('');
          }}
        >
          Add
        </button>
      </div>
    </div>
  );
}
```

---

### C — `evaluateFamilyParameters` utility

Create `packages/web/src/plan/familyParameterEval.ts`:

```ts
import type { Element } from '@bim-ai/core';

type FamilyParam = Extract<Element, { kind: 'family_parameter' }>;

/**
 * Applies family parameter values to the linked geometry element.
 * If a parameter has linkedDimensionId + linkedProperty, updates that property.
 */
export function applyFamilyParameters(
  parameters: FamilyParam[],
  elementsById: Record<string, Element | undefined>,
): Record<string, Partial<Record<string, unknown>>> {
  const updates: Record<string, Partial<Record<string, unknown>>> = {};

  for (const param of parameters) {
    if (!param.linkedDimensionId || !param.linkedProperty) continue;
    const target = elementsById[param.linkedDimensionId];
    if (!target) continue;
    updates[param.linkedDimensionId] = {
      ...(updates[param.linkedDimensionId] ?? {}),
      [param.linkedProperty]: param.defaultValue,
    };
  }

  return updates;
}

/**
 * Validates that all parameter names are unique within a family.
 */
export function validateFamilyParameters(parameters: FamilyParam[]): string[] {
  const errors: string[] = [];
  const seen = new Set<string>();
  for (const p of parameters) {
    if (seen.has(p.name)) {
      errors.push(`Duplicate parameter name: "${p.name}"`);
    }
    seen.add(p.name);
    if (!p.name.trim()) {
      errors.push('Parameter name cannot be empty');
    }
  }
  return errors;
}
```

---

### D — Wire into `FamilyEditorWorkbench.tsx`

If `FamilyEditorWorkbench.tsx` exists, integrate `FamilyParameterPanel`:

```tsx
// Add to the family editor UI:
<FamilyParameterPanel
  parameters={familyParameters}
  onAdd={(param) =>
    void onSemanticCommand({
      type: 'addFamilyParameter',
      parameter: { ...param, id: crypto.randomUUID() },
    })
  }
  onDelete={(id) => void onSemanticCommand({ type: 'deleteFamilyParameter', parameterId: id })}
  onValueChange={(id, value) =>
    void onSemanticCommand({
      type: 'setFamilyParameterValue',
      parameterId: id,
      value,
    })
  }
/>
```

`familyParameters` = elements with `kind === 'family_parameter'` filtered by the current family's ID.

---

### E — Workspace handlers

In `Workspace.tsx`, handle the new command types:

```ts
case 'addFamilyParameter':
  // Add as a regular element
  elementsById[cmd.parameter.id] = cmd.parameter;
  break;

case 'deleteFamilyParameter':
  delete elementsById[cmd.parameterId];
  break;

case 'setFamilyParameterValue':
  const p = elementsById[cmd.parameterId];
  if (p?.kind === 'family_parameter') {
    (p as any).defaultValue = cmd.value;
    // If linked, also update the linked element's property
    const updates = applyFamilyParameters(
      [{ ...(p as any), defaultValue: cmd.value }],
      elementsById
    );
    for (const [elId, props] of Object.entries(updates)) {
      for (const [key, val] of Object.entries(props)) {
        void onSemanticCommand({ type: 'updateElementProperty', elementId: elId, key, value: val });
      }
    }
  }
  break;
```

---

### F — Inspector for `family_parameter`

In `InspectorContent.tsx`, add `case 'family_parameter':`:

```tsx
case 'family_parameter': {
  const el = selectedElement as Extract<Element, { kind: 'family_parameter' }>;
  return (
    <div>
      <label>Name
        <input data-testid="inspector-family-param-name"
          value={el.name}
          onChange={e => onPropertyChange('name', e.target.value)} />
      </label>
      <label>Type
        <span data-testid="inspector-family-param-type">{el.paramType}</span>
      </label>
      <label>Default Value
        <input type="number" data-testid="inspector-family-param-value"
          value={el.defaultValue as number}
          onChange={e => onPropertyChange('defaultValue', +e.target.value)} />
      </label>
      <label>Instance Parameter
        <input type="checkbox" data-testid="inspector-family-param-instance"
          checked={el.isInstance}
          onChange={e => onPropertyChange('isInstance', e.target.checked)} />
      </label>
    </div>
  );
}
```

---

### G — Palette command + capability graph

In `defaultCommands.ts`:

```ts
{ id: 'family.add-parameter', label: 'Add Family Parameter…',
  keywords: ['family', 'parameter', 'dimension', 'constraint'],
  category: 'command', invoke: (ctx) => ctx.openFamilyEditor?.() }
```

In `commandCapabilities.ts`:

```ts
{ id: 'family.add-parameter', scope: 'document', intendedModes: ['plan', '3d'], precondition: null },
```

---

### H — Tests

`packages/web/src/plan/familyParameterEval.test.ts`:

```ts
describe('applyFamilyParameters — §15.1.3', () => {
  it('returns empty object when no parameters have links', () => { ... });
  it('updates linked element property from parameter value', () => { ... });
  it('skips parameters without linkedDimensionId', () => { ... });
});

describe('validateFamilyParameters — §15.1.3', () => {
  it('returns no errors for valid unique parameters', () => { ... });
  it('returns error for duplicate names', () => { ... });
  it('returns error for empty name', () => { ... });
});
```

`packages/web/src/workspace/FamilyParameterPanel.test.tsx`:

```ts
describe('FamilyParameterPanel — §15.1.3', () => {
  it('renders family-parameter-panel', () => { ... });
  it('renders one row per parameter', () => { ... });
  it('Add button is disabled when name is empty', () => { ... });
  it('entering a name and clicking Add calls onAdd', () => { ... });
  it('clicking delete calls onDelete with correct id', () => { ... });
});
```

---

## Commit and push

```
git pull --rebase origin main
git add -p
git commit -m "feat(wave17/J): family editor parametric parameters — family_parameter type + panel + eval (§15.1.3)"
git push origin main
```

## Success criterion

`pnpm test --filter @bim-ai/web` — all tests pass including the new family parameter tests.
