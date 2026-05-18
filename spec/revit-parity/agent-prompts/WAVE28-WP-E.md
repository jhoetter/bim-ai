# Wave 28 — WP-E: Family Parameter Formula Evaluation (§15.1.2)

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).
This prompt is self-contained — start here.

---

## Context

§15.1.2 "Die Multifunktionsleiste »Erstellen«" is Partial P1. The family editor already has:

- `family_parameter` element kind with name, paramType, defaultValue, isInstance, linkedDimensionId, linkedProperty
- `FamilyParameterPanel.tsx` with add/delete/value-change UI
- `familyParameterEval.ts` with `applyFamilyParameters()` and `validateFamilyParameters()`

What's still missing: **formula evaluation** — in Revit, a parameter can have a formula like `= Width / 2` or `= IF(isDouble, 900, 600)`. This is a key differentiator for parametric families.

This task adds:

1. `formula?: string` field on `family_parameter` element
2. `evaluateFamilyParameterFormula(formula, params)` utility function
3. `applyFamilyParameters` updated to evaluate formulas
4. `FamilyParameterPanel.tsx` formula input field
5. Tests

---

## Repo orientation

```
packages/core/src/index.ts                              — find family_parameter element type
packages/web/src/familyEditor/familyParameterEval.ts    — find applyFamilyParameters, validateFamilyParameters
packages/web/src/familyEditor/FamilyParameterPanel.tsx  — find parameter panel UI
```

Run before editing:

- `grep -n "family_parameter\|formula\|defaultValue" packages/core/src/index.ts | head -10`
- `grep -n "applyFamilyParameters\|evaluateFormula\|formula" packages/web/src/familyEditor/familyParameterEval.ts | head -10`
- `grep -n "formula\|input\|onChange" packages/web/src/familyEditor/FamilyParameterPanel.tsx | head -15`
- `ls packages/web/src/familyEditor/`

Read `familyParameterEval.ts` carefully before editing. Read `family_parameter` type in core.

Tests: `npx vitest run` from `packages/web`.
Prettier runs automatically. **Always `git pull --rebase origin main` before pushing.**

---

## Tasks

### A — Add formula field to family_parameter in core

Find the `family_parameter` element type in `packages/core/src/index.ts`. Add:

```ts
/** §15.1.2: optional formula string (e.g. "Width / 2" or "Height * 0.6"). Evaluated at apply time. */
formula?: string;
```

### B — Create evaluateFamilyParameterFormula utility

In `packages/web/src/familyEditor/familyParameterEval.ts`, add:

```ts
/**
 * §15.1.2: evaluates a simple arithmetic formula string against a parameter
 * value map. Supports: +, -, *, /, parentheses, numeric literals, and
 * other parameter names as identifiers.
 *
 * Example: evaluateFamilyParameterFormula("Width / 2", { Width: 900 }) → 450
 * Returns NaN if the formula is invalid or references unknown params.
 */
export function evaluateFamilyParameterFormula(
  formula: string,
  params: Record<string, number>,
): number {
  // Replace parameter name references with their values
  let expr = formula.trim();
  // Replace each known param name with its numeric value
  for (const [name, value] of Object.entries(params)) {
    // Use word-boundary replacement to avoid partial matches
    expr = expr.replace(new RegExp(`\\b${name}\\b`, 'g'), String(value));
  }
  // Safety: only allow digits, operators, parens, dots, spaces
  if (!/^[\d\s\+\-\*\/\(\)\.]+$/.test(expr)) return NaN;
  try {
    // eslint-disable-next-line no-new-func
    const result = Function(`"use strict"; return (${expr})`)();
    return typeof result === 'number' ? result : NaN;
  } catch {
    return NaN;
  }
}
```

### C — Update applyFamilyParameters to evaluate formulas

Find `applyFamilyParameters` in `familyParameterEval.ts`. After computing parameter values, evaluate any formulas:

```ts
// §15.1.2: evaluate formula-driven params (second pass after resolving base values)
for (const param of familyParams) {
  if ((param as any).formula) {
    const formulaResult = evaluateFamilyParameterFormula(
      (param as any).formula as string,
      resolvedValues, // the map of paramName → numeric value
    );
    if (!isNaN(formulaResult)) {
      resolvedValues[param.name] = formulaResult;
    }
  }
}
```

**Important**: Read the actual `applyFamilyParameters` code carefully. Adapt to how it currently computes values and where to insert the formula pass.

### D — FamilyParameterPanel.tsx: formula input

In `FamilyParameterPanel.tsx`, for each parameter row, add a formula input below the value input:

```tsx
<input
  data-testid={`family-param-formula-${param.name}`}
  type="text"
  placeholder="= formula (e.g. Width / 2)"
  value={(param as any).formula ?? ''}
  onChange={(e) => onUpdateParam?.(param.name, { formula: e.target.value || undefined })}
  style={{
    fontSize: 10,
    padding: '1px 4px',
    border: '1px solid var(--border, #555)',
    borderRadius: 2,
    background: 'transparent',
    color: '#a78bfa',
    width: '100%',
    boxSizing: 'border-box',
  }}
/>
```

**Important**: Read `FamilyParameterPanel.tsx` carefully to understand the `onUpdateParam` callback signature. If it doesn't exist with that signature, adapt to the actual update mechanism.

### E — commandCapabilities.ts entry

```ts
{
  id: 'family.parameter-formula',
  label: 'Family Parameter Formula',
  owner: 'familyEditor/familyParameterEval',
  group: 'family',
  scope: 'canvas',
  intendedModes: ['plan'],
  surfaces: ['family-editor', 'cmd-k'],
  executionSurface: 'local-state',
  preconditions: [],
  status: 'implemented',
  usabilityScore: 8,
  notes: '§15.1.2: family_parameter.formula field + evaluateFamilyParameterFormula() evaluates arithmetic expressions against other param values at apply time.',
},
```

Add a matching `registerCommand` for `family.parameter-formula` in `defaultCommands.ts`.

### F — Tests

Create `packages/web/src/familyEditor/familyParameterFormula.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { evaluateFamilyParameterFormula } from './familyParameterEval';

describe('Family parameter formula evaluation — §15.1.2', () => {
  it('evaluates simple division formula', () => {
    const result = evaluateFamilyParameterFormula('Width / 2', { Width: 900 });
    expect(result).toBe(450);
  });

  it('evaluates multiplication formula', () => {
    const result = evaluateFamilyParameterFormula('Height * 0.6', { Height: 3000 });
    expect(result).toBeCloseTo(1800);
  });

  it('evaluates formula with two params', () => {
    const result = evaluateFamilyParameterFormula('Width + Depth', { Width: 600, Depth: 400 });
    expect(result).toBe(1000);
  });

  it('returns NaN for unknown param reference', () => {
    const result = evaluateFamilyParameterFormula('Unknown / 2', { Width: 900 });
    expect(isNaN(result)).toBe(true);
  });

  it('returns NaN for invalid formula', () => {
    const result = evaluateFamilyParameterFormula('Width; alert(1)', { Width: 900 });
    expect(isNaN(result)).toBe(true);
  });

  it('evaluates numeric literal formula', () => {
    const result = evaluateFamilyParameterFormula('100 + 50', {});
    expect(result).toBe(150);
  });
});
```

---

## Commit and push

```
git pull --rebase origin main
git add -p
git commit -m "feat(wave28/E): family parameter formula evaluation — formula field on family_parameter + evaluateFamilyParameterFormula() utility + FamilyParameterPanel formula input (§15.1.2)"
git push origin main
```

## Success criterion

`npx vitest run` from `packages/web` — all tests pass including the new 6 tests.
