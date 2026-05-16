# Wave 14 — WP-K: Create Similar Wiring + EQ Dimension Label Enforcement (§3.3.9 + §4.2.3)

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).
This prompt is self-contained — start here.

---

## Repo orientation

```
packages/web/src/plan/createSimilar.ts                  — createSimilarPayload helper
packages/web/src/plan/PlanCanvas.tsx                    — keyboard shortcuts
packages/web/src/plan/planElementMeshBuilders.ts        — permanent dimension plan renderer
packages/web/src/workspace/Workspace.tsx                — semantic command handlers
packages/core/src/index.ts                              — permanent_dimension element type, eqEnabled
```

Tests: co-located `*.test.ts` — run `pnpm test --filter @bim-ai/web`.
Prettier runs automatically after every Edit/Write.
**Shared-file rule**: before editing `toolGrammar.ts`, `toolRegistry.ts`, `core/index.ts`, or
`PlanCanvas.tsx`, run `git pull --rebase origin main` first.

---

## What already exists — DO NOT rebuild

Read ALL of these before writing anything:

- `createSimilar.ts` — read `createSimilarPayload`. Understand what it returns (a command shape to create a new element of the same kind/type as the selected one). Note if there is a `createSimilar` palette command.
- `PlanCanvas.tsx` — search for `createSimilar` or `'cs'` in the keyboard handler section. Find if `CS` shortcut is already wired. If it is, skip task A.
- `core/index.ts` — find `permanent_dimension` element type. Confirm `eqEnabled?: boolean` exists. Find `witnessPointsMm` field type.
- `planElementMeshBuilders.ts` — find `permanentDimensionThree`. Read how it renders EQ labels and the EQ toggle button. Find where `eqEnabled` is read.
- `Workspace.tsx` — find `toggle_dim_eq` handler. Find how `updateElementProperty` commands patch elements.

---

## Tasks

## Part 1: Create Similar keyboard wiring (§3.3.9)

### A — Wire `CS` keyboard shortcut in `PlanCanvas.tsx`

In the plan canvas `keydown` handler, add:

```ts
if (key === 'c' && !e.metaKey && !e.ctrlKey && !e.shiftKey) {
  // Already: Copy → handled?  No — this is 'c' without modifier.
}
// Add:
if ((key === 'c' || key === 'C') && (e.metaKey || e.ctrlKey) && e.shiftKey) {
  // already Ctrl+Shift+C? Check first.
}
```

Wait — the actual pattern is a two-key chord `CS` (press C then S). Read how other chords are handled in `PlanCanvas.tsx` (e.g. `PN` for pin). Use the same chord mechanism.

The chord `CS` should:
1. Read the first selected element ID.
2. Call `createSimilarPayload(element)` from `createSimilar.ts`.
3. Dispatch the resulting command to add a new element of the same kind.
4. Activate the appropriate tool so the user can immediately place the new element.

If the chord mechanism doesn't exist, implement it: track `lastKey` in a ref; when two keys match a chord pattern within 500ms, fire the chord action.

### B — "Create Similar" context menu entry

In the element right-click context menu (`ElementContextMenu` or wherever context menus are built), add:

```tsx
<button data-testid="context-create-similar" onClick={() => onCreateSimilar(element)}>
  Create Similar
</button>
```

---

## Part 2: EQ dimension — equal spacing enforcement (§4.2.3)

Currently, when `eqEnabled` is true on a `permanent_dimension`, the label shows "EQ" but element positions are NOT actually equalized. Add the enforcement.

### C — `equalizeWitnessSpacing` pure function

Create `packages/web/src/plan/equalizeWitnessSpacing.ts`:

```ts
/**
 * Given a dimension's witness points and the total distance from first to last,
 * compute where the witness points should be to achieve equal spacing.
 * Returns the new witnessPointsMm array.
 */
export function equalizeWitnessSpacing(
  witnessPointsMm: Array<{ xMm: number; yMm: number }>,
): Array<{ xMm: number; yMm: number }> {
  if (witnessPointsMm.length < 3) return witnessPointsMm;
  const first = witnessPointsMm[0]!;
  const last = witnessPointsMm[witnessPointsMm.length - 1]!;
  const n = witnessPointsMm.length - 1; // number of segments
  return witnessPointsMm.map((_, i) => ({
    xMm: first.xMm + (last.xMm - first.xMm) * (i / n),
    yMm: first.yMm + (last.yMm - first.yMm) * (i / n),
  }));
}
```

### D — Apply EQ enforcement in `toggle_dim_eq` handler

In `Workspace.tsx`, in the `toggle_dim_eq` handler:

When toggling `eqEnabled` to `true`:
1. Get the current `witnessPointsMm` from the dimension element.
2. Call `equalizeWitnessSpacing(witnessPointsMm)`.
3. Update the dimension element with the new `witnessPointsMm` (in addition to setting `eqEnabled: true`).

This ensures the dimension markers are visually equalized when EQ is activated. (Note: this moves the dimension witness points, NOT the model elements — full parametric element driving is a future enhancement.)

### E — Tests

`packages/web/src/plan/createSimilarShortcut.test.ts`:
```ts
describe('create similar shortcut — §3.3.9', () => {
  it('createSimilarPayload returns command for wall element', () => { ... });
  it('createSimilarPayload returns command for door element', () => { ... });
  it('createSimilarPayload returns null for level element (not applicable)', () => { ... });
});
```

`packages/web/src/plan/equalizeWitnessSpacing.test.ts`:
```ts
describe('EQ dimension enforcement — §4.2.3', () => {
  it('equalizes 3 points to equal spacing', () => { ... });
  it('equalizes 4 points to equal spacing', () => { ... });
  it('returns unchanged when only 2 points (nothing to equalize)', () => { ... });
  it('works horizontally', () => { ... });
  it('works diagonally', () => { ... });
});
```

---

## Commit and push

After tests pass (`pnpm test --filter @bim-ai/web`):
```
git add -p
git commit -m "feat(wave14/K): create similar CS chord + EQ dimension spacing enforcement (§3.3.9 + §4.2.3)"
git push origin main
```

## Success criterion

`pnpm test --filter @bim-ai/web` — all tests pass including the new ones.
