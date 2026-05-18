# Wave 9 — WP-B: Per-Element Graphics Override (§2.1.4)

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).
This prompt is self-contained — start here.

---

## Repo orientation

```
packages/core/src/index.ts                               — element types (wall, floor, column, etc.)
packages/web/src/plan/symbology.ts                       — plan rendering (where colors/materials are applied)
packages/web/src/viewport/meshBuilders.ts               — 3D mesh material assignment
packages/web/src/workspace/inspector/InspectorContent.tsx — inspector panels
```

Tests: co-located `*.test.ts` — run `pnpm test --filter @bim-ai/web`.
Prettier runs automatically after every Edit/Write.
**Shared-file rule**: before editing `toolGrammar.ts`, `toolRegistry.ts`, `core/index.ts`, or
`PlanCanvas.tsx`, run `git pull --rebase origin main` first.

---

## What already exists — DO NOT rebuild

Read ALL of these before writing anything:

- `room` element already has `roomFillOverrideHex` and `roomFillPatternOverride` — use this as the pattern for a generic override field.
- `wall` element in `core/index.ts` — check all existing fields including optional ones.
- `symbology.ts` — find where wall/floor/column plan colors are set. Find how `roomFillOverrideHex` is applied to rooms — use the same pattern for other element types.
- `InspectorContent.tsx` — for walls: find where material/type inputs exist. Add the override UI nearby.
- `update_element_property` command — dispatches property changes.

---

## Tasks

### A — graphicsOverride field

Add to `wall`, `floor`, `column`, `beam`, `ceiling`, `roof` element types in `core/index.ts`:

```ts
graphicsOverride?: {
  /** Override fill color in plan view (hex string, e.g. '#FF0000'). Null = use category default. */
  fillColorHex?: string | null;
  /** Override line color in plan view. */
  lineColorHex?: string | null;
  /** Override surface color in 3D view. */
  surfaceColorHex?: string | null;
} | null;
```

### B — Apply override in plan renderer

In `symbology.ts`, for each element type that renders with a fill or line color:

- After computing the default color, check `el.graphicsOverride?.fillColorHex` — if set, use it instead
- Check `el.graphicsOverride?.lineColorHex` for line/outline materials
- Pattern: find how `roomFillOverrideHex` is applied and do the same

### C — Apply override in 3D renderer

In `meshBuilders.ts` (or whichever mesh builder handles wall/floor/column materials):

- After computing the default material color, check `el.graphicsOverride?.surfaceColorHex`
- If set: override the `MeshStandardMaterial` color

### D — Inspector: Override Graphics section

In `InspectorContent.tsx`, for `el.kind === 'wall'` (and similarly for floor, column):

Add a collapsible "Override Graphics" section below existing properties:

**Fill color** (`data-testid="inspector-override-fill-color"`):

- `<input type="color">` + a "Clear" button
- Value = `el.graphicsOverride?.fillColorHex ?? '#000000'`
- On change: dispatch `update_element_property` for `graphicsOverride` (merge with existing override)
- On clear: dispatch `update_element_property` for `graphicsOverride` with `fillColorHex: null`

**Surface color** (`data-testid="inspector-override-surface-color"`):

- Same pattern for `surfaceColorHex`

Keep the UI minimal: two color pickers + two clear buttons, under a "Graphics Override" label.

### E — Override utility helper

Create `packages/web/src/plan/graphicsOverride.ts`:

```ts
export function resolveElementFillColor(
  defaultHex: string,
  override: { fillColorHex?: string | null } | null | undefined,
): string;

export function resolveElementSurfaceColor(
  defaultHex: string,
  override: { surfaceColorHex?: string | null } | null | undefined,
): string;
```

Both return the override if non-null/non-undefined, else the default.

### F — Tests

Write `packages/web/src/plan/graphicsOverride.test.ts`:

```ts
describe('resolveElementFillColor — §2.1.4', () => {
  it('returns default when no override', () => { ... });
  it('returns default when override is null', () => { ... });
  it('returns default when fillColorHex is null', () => { ... });
  it('returns override color when set', () => { ... });
  it('resolveElementSurfaceColor: returns surfaceColorHex when set', () => { ... });
});
```

Write `packages/web/src/workspace/inspector/graphicsOverrideInspector.test.tsx`:

```ts
describe('graphics override inspector — §2.1.4', () => {
  it('renders inspector-override-fill-color for wall', () => { ... });
  it('renders inspector-override-surface-color for wall', () => { ... });
  it('color change dispatches update_element_property for graphicsOverride', () => { ... });
});
```

---

## Commit and push

After all tasks are done and tests pass (`pnpm test --filter @bim-ai/web`), commit:

```
git add -p
git commit -m "feat(wave9/B): per-element graphics override (color) in plan + 3D (§2.1.4)"
git push origin main
```

## Success criterion

`pnpm test --filter @bim-ai/web` — all tests pass including the new ones.
