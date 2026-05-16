# Wave 3 — WP-G: Family Editor Form Types (§15.1.2–§15.1.5)

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).
This prompt is self-contained — start here.

---

## Repo orientation

```
packages/core/src/index.ts                                   — Element union + ElemKind
packages/web/src/family/FamilyEditorWorkbench.tsx            — family editor UI root
packages/web/src/family/familySketchGeometry.ts              — sketch-based family geometry helpers
packages/web/src/family/familyTemplateCatalog.ts             — built-in family templates
packages/web/src/family/familyEditorPersistence.ts           — family save/load
packages/web/src/viewport/meshBuilders.ts                    — 3D mesh builders (family preview)
packages/web/src/family/ArrayTool.test.tsx                   — existing family editor test
```

Tests: co-located `*.test.ts` / `*.test.tsx` — run `pnpm test --filter @bim-ai/web`.
Prettier runs automatically after every Edit/Write.
**Shared-file rule**: before editing `toolGrammar.ts`, `toolRegistry.ts`, `core/index.ts`, or
`PlanCanvas.tsx`, run `git pull --rebase origin main` first.

---

## What wave 1 + 2 already built — DO NOT rebuild these

- `FamilyEditorWorkbench.tsx` — opens for existing families; has a create workflow
- `familyTemplateCatalog.ts` — templates for door, window, column, generic component families
- `familySketchGeometry.ts` — sketch-based geometry helpers (custom window family creation)
- Family editor persistence (`familyEditorPersistence.ts`) — save/load
- `ArrayTool.test.tsx` — array tool in family editor (exists, tests pass)
- The family editor "Create" ribbon may already have some form types — read the actual code before
  adding duplicates

---

## Tasks

### A — Extrusion form type

Add an **Extrusion** form type to the family editor. In Revit, an extrusion is a 2D profile sketch
extruded by a depth parameter.

**A1. Data model**: Add to the family element type in `core/index.ts` (find the family form union
or add one if missing):
```ts
type FamilyExtrusion = {
  kind: 'family_extrusion';
  id: string;
  profilePoints: Array<{ x: number; y: number }>;  // closed 2D polygon in mm
  depthMm: number;                                  // extrusion depth
  materialId?: string;
};
```

**A2. Mesh builder**: In `meshBuilders.ts`, add:
```ts
export function buildFamilyExtrusionMesh(form: FamilyExtrusion): THREE.Mesh
```
Use `THREE.Shape` + `THREE.ExtrudeGeometry` with `depth: depthMm / 1000`.

**A3. UI**: In `FamilyEditorWorkbench.tsx`, add an **"Extrusion"** button to the Create ribbon
(data-testid: `"family-create-extrusion"`). Clicking it enters a sketch mode where the user draws
a closed polygon (at least click-to-place-vertex + double-click-to-close); then shows a depth
input. On confirm, the form is added to the family's form list and previewed in 3D.

Sketch mode can be minimal: accept 3+ clicked vertices on the canvas, close on double-click,
show an `<input type="number">` for depth, confirm with Enter.

---

### B — Revolve form type

Add a **Revolve** form type (profile revolved around an axis).

**B1. Data model**:
```ts
type FamilyRevolve = {
  kind: 'family_revolve';
  id: string;
  profilePoints: Array<{ x: number; y: number }>;  // profile in mm, in XZ plane
  axisMm: { x: number; z: number };                // axis line in plan (revolution axis)
  angleDeg: number;                                 // sweep angle (default 360 = full cylinder)
  materialId?: string;
};
```

**B2. Mesh builder**:
```ts
export function buildFamilyRevolveMesh(form: FamilyRevolve): THREE.Mesh
```
Use `THREE.LatheGeometry` (if the profile is a simple radial cross-section) or
`THREE.ExtrudeGeometry` with `{ steps: 32, bevelEnabled: false }` around a circular path.
For this parity milestone a `LatheGeometry` from the profile radii is sufficient.

**B3. UI**: Add a **"Revolve"** button (data-testid: `"family-create-revolve"`). Profile sketch
input + axis line input (two clicks define the axis) + angle input. Same minimal pattern as A3.

---

### C — Window family: parametric frame width

In `core/index.ts`, find the window family type (or the `window` element type). Add optional
parametric frame fields if not already present:
```ts
frameWidthMm?: number;    // default 50 mm
sillDepthMm?: number;     // default 75 mm
headProfileId?: string;   // references a profile family (optional)
```

In `meshBuilders.ts`, in the window mesh builder (search for `buildWindowMesh` or similar), when
`frameWidthMm` is set, offset the glazing panel inward by `frameWidthMm` on all four sides so the
frame has a visible thickness. If `sillDepthMm` is set, extrude the bottom frame forward by
`sillDepthMm`.

In `InspectorContent.tsx`, in the `case 'window':` block, add:
- **Frame width** — number input (mm); dispatches `{ type: 'updateElement', id, patch: { frameWidthMm } }`
- **Sill depth** — number input (mm)

---

### D — Window family: glazing panel material

In `core/index.ts`, add to the window element type (if not already):
```ts
glazingMaterialId?: string;  // defaults to a built-in glass material
```

In the window mesh builder, apply `glazingMaterialId` to the glazing panel mesh
(`MeshStandardMaterial` with `color: 0x88bbdd`, `transparent: true`, `opacity: 0.4` as default
if no material is resolved).

In the inspector, add a **Glazing material** dropdown (list available material ids from project).

---

## Tests

Add to `packages/web/src/family/familyExtrusionMesh.test.ts` (new file):
1. `buildFamilyExtrusionMesh()` returns a `THREE.Mesh` instance
2. Extruded box (4-point square profile) has correct vertex count
3. `depthMm: 0` returns empty geometry without crashing

Add to `packages/web/src/family/familyRevolveMesh.test.ts` (new file):
4. `buildFamilyRevolveMesh()` returns a `THREE.Mesh` instance
5. Full 360° revolve produces a closed mesh (min/max Y within profile bounds)

Add to window inspector tests (wherever `InspectorContent` is tested):
6. Window with `frameWidthMm: 60` shows frame width input with value 60
7. Glazing material dropdown dispatches `updateElement` patch on change

---

## Tracker update

Edit `spec/revit-parity/revit2026-parity-tracker.md`:

Update §15.1.2 description — append:
```
Extrusion form type added: `FamilyExtrusion` data model, `buildFamilyExtrusionMesh()`, Create
ribbon button. Revolve form type added: `FamilyRevolve` data model, `buildFamilyRevolveMesh()`
(LatheGeometry), Create ribbon button. 5 mesh tests.
```
Change §15.1.2 status to `Partial → Done — P1` (keep Partial if blend/sweep/void are still missing
and note them explicitly).

Update §15.1.3 + §15.1.4 + §15.1.5 descriptions — append:
```
`frameWidthMm` + `sillDepthMm` added to window element; mesh builder offsets glazing inward.
`glazingMaterialId` field + material dropdown in inspector. 2 inspector tests.
```
Change §15.1.3–§15.1.5 status to `Done — P1`.

Update summary table row for Chapter 15.
