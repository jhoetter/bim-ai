# Wave-3 Agent 7 — FAM-01 polish + EDT-01 propagation to door/window/floor/column/beam

You are **Agent 7** of eight wave-3 agents. Theme: **finish the nested-family UX + propagate the grip protocol from walls to other element kinds**. Branch `wave3-7`.

---

## 0. Pre-flight

```bash
cd /Users/jhoetter/repos/bim-ai
git fetch origin --quiet
git worktree add /Users/jhoetter/repos/bim-ai-wave3-7 -b wave3-7 origin/main
cd /Users/jhoetter/repos/bim-ai-wave3-7
```

Read:
- `spec/workpackage-master-tracker.md` → P4 → FAM-01 detail block; P2 → EDT-01 detail block
- The FAM-01 commit `583e726c` (load-bearing slice — resolver + cycle detection + parameter bindings)
- The EDT-01 commit `e83b3ecd` (walls-only grip protocol — `gripProtocol.ts`, `tempDimensions.ts`)
- `nightshift/wave3-README.md`

### Quality gates / branch protocol / tracker / anti-laziness

Standard. Branch `wave3-7`, status `nightshift/wave3-7-status.md`. Push + merge each WP individually.

**Visual verification:** after EDT-01 propagation ships, start the dev server and try dragging a door's alongT, a floor's vertex, a column's position. The "feels like Revit" mantra applies.

---

## 1. Your assigned workpackages

Order: FAM-01 polish (M, smaller) → EDT-01 propagation (L, larger).

### 1.1 — FAM-01 polish: family-editor UI for placing nested instances + per-instance parameter editor

**Tracker:** P4 → FAM-01 detail block. Status: `partial` (data model + resolver + cycle detection landed; UI deferred).

**MUST ship to flip FAM-01 → done:**

1. **Loaded Families sidebar** in `packages/web/src/familyEditor/FamilyEditorWorkbench.tsx`:
   - New collapsible section "Loaded Families" listing every family that the host family can nest (filtered to families compatible with the host's category)
   - Each entry shows family thumbnail (from `thumbnailCache.ts`) + name + count of usages in the current family
   - Drag-and-drop a family entry into the editing canvas places a `family_instance_ref` node at the drop point

2. **Per-instance parameter editor:** when a `family_instance_ref` node is selected on canvas, the inspector shows:
   - Position fields (x/y/z mm)
   - Rotation field (degrees)
   - Parameter binding rows — for each parameter the nested family exposes:
     - Binding kind dropdown (literal / host_param / formula)
     - Value input contextual to the kind (typed input for literal; param dropdown for host_param; expression input for formula — uses FAM-04 evaluator)
   - Visibility binding (FAM-03 territory; if FAM-03 hasn't shipped yet, show a placeholder "Visibility binding (FAM-03)" disabled)

3. **Thumbnail composition** for FL-06 (the family library panel): when a family contains nested instances, the thumbnail shows the full composed geometry. Use the existing `thumbnailCache.ts` infra extended to recursively resolve the family's geometry tree (including nested instances) before rendering to canvas.

4. **Tests:**
   - `packages/web/src/familyEditor/LoadedFamiliesSidebar.test.tsx` — sidebar lists loaded families; drag-drop emits `addNestedFamilyInstance` action
   - `packages/web/src/familyEditor/NestedInstanceInspector.test.tsx` — parameter binding rows fire correct binding updates

After this WP ships, mark FAM-01 in tracker as: `done in <hash> — full nested-family system: data model + resolver + cycle detection + family-editor UI for placing nested instances + per-instance parameter editor + thumbnail composition`.

**Acceptance.** Open a host door family in the editor → drag a nested swing-arc family from Loaded Families → swing arc appears at drop point → click swing arc → Inspector shows parameter binding rows → bind `Radius` to formula `Rough Width - 2 * Frame Width` → flex the host's `Rough Width` and the swing-arc's radius updates correctly.

**Effort:** 5-6 hours.

---

### 1.2 — EDT-01 propagation to door/window/floor/column/beam

**Tracker:** P2 → EDT-01 detail block. Status: `partial` (walls-only). Propagate to other element kinds.

**Concrete scope.** For each element kind, register a grip provider following the EDT-01 protocol (`gripProtocol.ts:ElementGripProvider`).

1. **Door:** alongT slide grip on host wall. Drag commits `UpdateElementProperty` on `alongT`. Numeric override accepts a distance from wall start.

2. **Window:** same as door. Plus sill-height grip in elevation view (deferred — EDT-03 territory).

3. **Floor:** vertex grips at each `boundaryMm` corner. Dragging a vertex commits `UpdateElementProperty` on the boundary array (immutably replace one vertex).

4. **Column:** position grip at the column's footprint center; dragging commits a position update. Rotation handle for non-square columns.

5. **Beam:** endpoints grips at start and end. Dragging an endpoint commits `MoveBeamEndpoints` (new command — add to `commands.py` + `engine.py` if not present).

6. **Section line:** start and end grips on the section_cut line.

7. **Dimension:** anchor + offset grips. Anchor grip moves the dimensioned start point; offset grip moves the dim line perpendicular to the measurement.

8. **Reference plane** (KRN-05 — already shipped): endpoint grips.

For each kind, write a `<kind>GripProvider` in `packages/web/src/plan/grip-providers/` (new directory).

9. **Tests:** for each element kind, a vitest in `packages/web/src/plan/grip-providers/<kind>GripProvider.test.tsx` verifying drag fires the right command and numeric override works.

After this WP ships, mark EDT-01 in tracker as: `done in <hash> — protocol + grips for walls + doors + windows + floors + columns + beams + section lines + dimensions + reference planes; sketch elements deferred to follow-up if needed`.

**Acceptance.** Selecting a door in plan view shows an alongT grip on its host wall; dragging slides the door along the wall, committing `UpdateElementProperty`. Selecting a floor shows vertex grips; dragging a vertex commits a boundary update.

**Effort:** 5-7 hours (each element kind ~30-45 minutes once you've nailed the first one).

---

## 2. File ownership and conflict avoidance

**You own:**
- `packages/web/src/familyEditor/*` (LoadedFamiliesSidebar, NestedInstanceInspector, thumbnail composition extensions)
- `packages/web/src/plan/grip-providers/*` (new directory per element kind)
- `MoveBeamEndpoints` engine command (if not present)

**Shared territory:**
- `gripProtocol.ts` from EDT-01 — extend by registering more providers; don't restructure
- `core/index.ts`, `commands.py`, `engine.py` — append additions
- `spec/workpackage-master-tracker.md` — only FAM-01, EDT-01

**Avoid:**
- `Viewport.tsx`, `viewport/grip3d.ts` (Agent 2 — that's 3D handles, your work is plan-only)
- `meshBuilders.ts` (Agent 5)
- `SketchCanvas.tsx`, `PlanCanvas.tsx` outside the grip-layer hook (Agents 3, 4)

---

## 3. Go

Spawn worktree, ship FAM-01 polish first (smaller, finishes a partial), then EDT-01 propagation. Visually verify the propagated grips in the dev server before declaring done.
