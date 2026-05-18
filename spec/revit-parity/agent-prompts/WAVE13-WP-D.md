# Wave 13 — WP-D: Architectural vs Structural Column Distinction (§9.1.1)

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).
This prompt is self-contained — start here.

---

## Repo orientation

```
packages/core/src/index.ts                               — column element type
packages/web/src/tools/toolRegistry.ts                   — 'column' tool
packages/web/src/viewport/meshBuilders.ts                — makeColumnMesh()
packages/web/src/plan/planElementMeshBuilders.ts         — column plan symbol
packages/web/src/workspace/OptionsBar.tsx                — options bar (column section)
packages/web/src/workspace/inspector/InspectorContent.tsx — column inspector
```

Tests: co-located `*.test.ts` — run `pnpm test --filter @bim-ai/web`.
Prettier runs automatically after every Edit/Write.
**Shared-file rule**: before editing `toolGrammar.ts`, `toolRegistry.ts`, `core/index.ts`, or
`PlanCanvas.tsx`, run `git pull --rebase origin main` first.

---

## What already exists — DO NOT rebuild

Read ALL of these before writing anything:

- `column` element in `core/index.ts` — find ALL fields. Check if a `columnUsage` or `isStructural` field already exists. If it does, use it; do NOT add a second one.
- `makeColumnMesh()` in `meshBuilders.ts` — read how material is assigned. Find where the column box geometry is built. Read the full function.
- Column plan symbol in `planElementMeshBuilders.ts` — find the function rendering the column in plan view. Read how it determines the cross symbol or fill style.
- `OptionsBar.tsx` — find the `column` tool section. Read its current contents (level select, height, width, depth). Add the new field using the SAME pattern — do NOT restructure the section.
- `InspectorContent.tsx` → `case 'column'` — read the full block. Identify what is already present so you do not duplicate it.

---

## Tasks

### A — Core type: columnUsage field

In `core/index.ts`, add to the `column` element type if NOT already present:

```ts
/** §9.1.1: whether this column is architectural (decorative) or structural (load-bearing). */
columnUsage?: 'architectural' | 'structural' | null;
```

### B — Options bar: usage toggle

In `OptionsBar.tsx`, inside the `column` tool section, add (after existing fields):

```tsx
<div className="flex items-center gap-1">
  <span className="text-xs text-muted">Usage</span>
  <select
    data-testid="options-column-usage"
    className="text-xs bg-surface border border-border rounded px-1 py-0.5"
    value={columnUsage ?? 'architectural'}
    onChange={(e) => setColumnUsage(e.target.value as 'architectural' | 'structural')}
  >
    <option value="architectural">Architectural</option>
    <option value="structural">Structural</option>
  </select>
</div>
```

Add `columnUsage` state (`useState<'architectural' | 'structural'>('architectural')`) inside the OptionsBar component (or wherever per-tool state is held — match the existing pattern exactly).

Wire `columnUsage` into the `createColumn` command dispatch so new columns get the field set.

### C — Inspector: usage field

In `InspectorContent.tsx`, inside `case 'column'`, add (if not already present):

```tsx
<div className="flex items-center gap-2 py-0.5">
  <span className="text-xs text-muted w-28 shrink-0">Usage</span>
  <select
    data-testid="inspector-column-usage"
    className="flex-1 text-xs bg-surface border border-border rounded px-1 py-0.5"
    value={el.columnUsage ?? 'architectural'}
    onChange={(e) => onPropertyChange?.('columnUsage', e.target.value)}
  >
    <option value="architectural">Architectural</option>
    <option value="structural">Structural</option>
  </select>
</div>
```

### D — 3D mesh: material distinction

In `makeColumnMesh()` (or wherever column material is resolved):

- `columnUsage === 'structural'` → use a steel-grey material: `color: 0x708090` (slategray), `metalness: 0.4`, `roughness: 0.6`
- `columnUsage === 'architectural'` or null → keep existing material (white/plaster or whatever already exists)

Tag the mesh with `userData.columnUsage = el.columnUsage ?? 'architectural'`.

### E — Plan symbol: structural vs architectural

In the column plan symbol renderer (`planElementMeshBuilders.ts`):

- **Architectural** (default): existing symbol (diagonal cross or solid fill — whatever currently renders)
- **Structural**: add a second diagonal cross line (X pattern) in a slightly darker stroke (#666666 or similar), to visually distinguish structural from architectural

If the current plan symbol already draws an X for all columns, add a `userData.columnUsage` tag for distinguishing in tests — but do not break the existing visual.

### F — Tests

Write `packages/web/src/workspace/inspector/columnUsageInspector.test.tsx`:

```ts
describe('column usage inspector — §9.1.1', () => {
  it('renders inspector-column-usage select defaulting to architectural', () => { ... });
  it('structural option dispatches onPropertyChange for columnUsage', () => { ... });
});
```

Write `packages/web/src/viewport/columnMesh.test.ts` (or add to existing column mesh test file if one exists):

```ts
describe('makeColumnMesh — columnUsage — §9.1.1', () => {
  it('structural column mesh has userData.columnUsage = structural', () => { ... });
  it('architectural column mesh has userData.columnUsage = architectural', () => { ... });
});
```

---

## Commit and push

After tests pass (`pnpm test --filter @bim-ai/web`):

```
git add -p
git commit -m "feat(wave13/D): architectural vs structural column distinction (§9.1.1)"
git push origin main
```

## Success criterion

`pnpm test --filter @bim-ai/web` — all tests pass including the new ones.
