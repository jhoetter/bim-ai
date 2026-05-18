# Wave 12 — WP-F: Spot Elevation 3D Viewport Label (§4.7)

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).
This prompt is self-contained — start here.

---

## Repo orientation

```
packages/core/src/index.ts                               — spot_elevation element type
packages/web/src/plan/planElementMeshBuilders.ts         — spot elevation plan renderer
packages/web/src/viewport/meshBuilders.ts                — 3D viewport mesh builders
packages/web/src/viewport/Viewport3D.tsx                 — 3D viewport rendering (CSS2D labels)
packages/web/src/plan/grip-providers/                    — spot elevation grip provider
packages/web/src/workspace/inspector/InspectorContent.tsx — inspector panel
```

Tests: co-located `*.test.ts` — run `pnpm test --filter @bim-ai/web`.
Prettier runs automatically after every Edit/Write.
**Shared-file rule**: before editing `toolGrammar.ts`, `toolRegistry.ts`, `core/index.ts`, or
`PlanCanvas.tsx`, run `git pull --rebase origin main` first.

---

## What already exists — DO NOT rebuild

Read ALL of these before writing anything:

- `spot_elevation` element in `core/index.ts` — find all fields: `positionMm`, `elevationMm`, `textPrefix`, `textSuffix`, `textOverride`. Read the full type.
- `planElementMeshBuilders.ts` — find the spot elevation renderer. Read how it draws the elevation label in plan view (text sprite or CSS2D). Use the same approach for 3D.
- `meshBuilders.ts` (3D) — find how OTHER annotation elements (text_note, leader_text, dimension strings) are rendered in 3D. Look for `CSS2DObject` usage. Use the same pattern.
- `Viewport3D.tsx` — find where 3D labels (`CSS2DObject` or `CSS2DRenderer`) are managed. The 3D spot elevation label should slot into the existing label infrastructure.
- The `spot-elevation` grip provider in `grip-providers/` — read it (it should have a position drag grip). Verify it is registered.

---

## Tasks

### A — Core type: spot elevation display fields

In `core/index.ts`, add to `spot_elevation` if missing:

```ts
/** Show this annotation in 3D viewport as a floating label. Default true. */
showIn3D?: boolean | null;

/** Elevation displayed relative to project base point (absolute) or to the active level (relative). */
elevationMode?: 'absolute' | 'relative-to-level' | null;
```

### B — 3D label: spot elevation in viewport

In `meshBuilders.ts` (3D), add a builder for `spot_elevation`:

```ts
export function spotElevationThree(
  el: Extract<Element, { kind: 'spot_elevation' }>,
  levelElevationMm: number, // base elevation of the element's level
): THREE.Object3D;
```

Build a `THREE.Group` containing:

1. A small diamond marker: `THREE.Mesh` with a `PlaneGeometry(150, 150)` rotated 45° — or a simple sphere (`SphereGeometry(80)`)
2. A `CSS2DObject` (or equivalent label sprite) showing the elevation text:
   - Format: `"${textPrefix ?? ''}${((elevationMm) / 1000).toFixed(3)} m${textSuffix ?? ''}"`
   - When `textOverride` is set, show `textOverride` instead
   - Font: 11px, same style as existing 3D labels

Position the group at `{ x: positionMm.xMm / PLAN_SCALE, y: elevationMm / PLAN_SCALE, z: -positionMm.yMm / PLAN_SCALE }` (i.e. the element's 3D world position at its elevation).

Read how other annotation elements are positioned in 3D and use the same coordinate transform.

Register this builder in whichever switch/map dispatches 3D mesh building by element kind.

### C — 3D viewport integration

In `Viewport3D.tsx` (or wherever 3D elements are built and added to the scene):

- Find the element-kind dispatch for 3D mesh building
- Add `spot_elevation` → `spotElevationThree(el, levelElevationMm)`
- Ensure the `CSS2DRenderer` is present in the scene (it should already be if text_note labels work in 3D)

### D — Inspector: elevation mode

In `InspectorContent.tsx`, for `el.kind === 'spot_elevation'`:

- **Elevation (mm)** (`data-testid="inspector-spot-elevation-mm"`): editable number input. On change: dispatches `update_element_property` for `elevationMm`.
- **Elevation mode** (`data-testid="inspector-spot-elevation-mode"`): `<select>` with `absolute` and `relative-to-level`. On change: dispatches for `elevationMode`.
- **Show in 3D** (`data-testid="inspector-spot-elevation-show3d"`): checkbox. On change: dispatches for `showIn3D`.
- **Text prefix/suffix** (`data-testid="inspector-spot-elevation-prefix"` / `"-suffix"`): text inputs. Dispatch for `textPrefix`/`textSuffix`.

If any of these already exist, do NOT duplicate — just verify they work.

### E — Tests

Write `packages/web/src/viewport/spotElevation3D.test.ts`:

```ts
describe('spotElevationThree — §4.7', () => {
  it('returns a THREE.Group', () => { ... });
  it('includes a CSS2DObject with elevation text', () => { ... });
  it('uses textOverride when set instead of computed elevation', () => { ... });
  it('formats elevation as metres with 3 decimal places', () => { ... });
  it('applies textPrefix and textSuffix around elevation value', () => { ... });
});
```

Write `packages/web/src/workspace/inspector/spotElevationInspector.test.tsx`:

```ts
describe('spot elevation inspector — §4.7', () => {
  it('renders inspector-spot-elevation-mm input with current value', () => { ... });
  it('elevation input change dispatches update_element_property for elevationMm', () => { ... });
  it('renders inspector-spot-elevation-mode select', () => { ... });
  it('renders inspector-spot-elevation-show3d checkbox', () => { ... });
});
```

---

## Commit and push

After tests pass (`pnpm test --filter @bim-ai/web`):

```
git add -p
git commit -m "feat(wave12/F): spot elevation 3D viewport label + inspector (§4.7)"
git push origin main
```

## Success criterion

`pnpm test --filter @bim-ai/web` — all tests pass including the new ones.
