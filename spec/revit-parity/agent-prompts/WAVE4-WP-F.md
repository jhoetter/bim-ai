# Wave 4 — WP-F: Project Phases Dialog + Per-Element Phase Assignment (§2.8)

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).
This prompt is self-contained — start here.

---

## Repo orientation

```
packages/core/src/index.ts                              — Element union (phaseCreated, phaseDemolished on most elements)
packages/web/src/plan/planProjection.ts                 — resolvePhaseGraphicStyle() for plan rendering
packages/web/src/workspace/inspector/InspectorContent.tsx — element inspector panels
packages/web/src/workspace/Workspace.tsx                — top-level workspace (dialogs mounted here)
packages/web/src/state/store.ts                         — project state
```

Tests: co-located `*.test.ts` — run `pnpm test --filter @bim-ai/web`.
Prettier runs automatically after every Edit/Write.
**Shared-file rule**: before editing `toolGrammar.ts`, `toolRegistry.ts`, `core/index.ts`, or
`PlanCanvas.tsx`, run `git pull --rebase origin main` first.

---

## What already exists — DO NOT rebuild

- `phaseCreated?: string | null` and `phaseDemolished?: string | null` on most element types in
  `core/index.ts` — these store phase IDs
- `resolvePhaseGraphicStyle()` in `planProjection.ts` — given element phase fields + view phase
  settings, returns `{ hidden, opacity, dashed, grey }` — already applied to plan rendering
- Phase filter mode selector in `Workspace.tsx` — dropdown visible when a plan_view has a phaseId;
  dispatches `updateElementProperty` to set `phaseFilterMode` on the active plan_view
- `phase` element type in `core/index.ts` — check if it exists; it may be called `project_phase`
  or embedded in project_settings

**READ THESE FILES before implementing** — phase infrastructure may be more complete than the
tracker suggests. Only build what is genuinely missing.

---

## Tasks

### A — Phase element type in core/index.ts

If a `phase` (or `project_phase`) element type does not exist in the Element union, add:
```ts
{
  kind: 'phase';
  id: string;
  name: string;          // e.g. 'Existing', 'Demolition', 'New Construction'
  sequenceIndex: number; // 0 = earliest, higher = later
}
```

Also add commands:
```ts
type CreatePhaseCmd  = { type: 'create_phase';  name: string; sequenceIndex: number };
type UpdatePhaseCmd  = { type: 'update_phase';  id: string; name?: string; sequenceIndex?: number };
type DeletePhaseCmd  = { type: 'delete_phase';  id: string };
```

If phase types already exist with different names, do NOT add duplicates — use the existing types.

---

### B — ManagePhasesDialog

Create `packages/web/src/workspace/phases/ManagePhasesDialog.tsx`:

A modal dialog (study `ManageRevisionsDialog.tsx` for the pattern):
- Title: "Project Phases"
- Table: rows of `phase` elements sorted by `sequenceIndex`, columns: Name (editable) + Sequence
- **Add Phase** button → dispatches `{ type: 'create_phase', name: 'New Phase', sequenceIndex: maxIndex + 1 }`
- **Delete** button on each row → dispatches `{ type: 'delete_phase', id }`
- Name cells: inline text input, dispatches `{ type: 'update_phase', id, name }` on blur

data-testid values:
- Dialog: `"manage-phases-dialog"`
- Add button: `"manage-phases-add"`
- Row: `"manage-phases-row-${id}"`
- Delete: `"manage-phases-delete-${id}"`

---

### C — Wire ManagePhasesDialog into Workspace

In `Workspace.tsx`:
1. Add `phaseDialogOpen` / `openPhaseDialog` / `closePhaseDialog` to the store (follow the
   `manageRevisionsOpen` pattern).
2. Mount `<ManagePhasesDialog>` in Workspace similarly to other dialogs.
3. Add "Manage Phases…" to the Manage ribbon tab (or the Phases group in the Modify ribbon) —
   data-testid: `"ribbon-manage-phases"`.

---

### D — Per-element phase assignment in inspector

In `InspectorContent.tsx`, for every element that has `phaseCreated` and `phaseDemolished` fields
(wall, floor, roof, door, window, column, beam, etc.), add a **Phase** section:

- **Phase Created** — `<select>` listing all `phase` elements from `elementsById`; dispatches
  `{ type: 'updateElement', id, patch: { phaseCreated: selectedPhaseId } }`
- **Phase Demolished** — `<select>` with same options + an "—" (none) option; dispatches
  `{ type: 'updateElement', id, patch: { phaseDemolished: selectedPhaseId ?? null } }`

data-testid: `"inspector-phase-created"` and `"inspector-phase-demolished"`.

Study the existing `levelId` dropdown in the inspector for the pattern — it reads project levels
from `elementsById` and follows the same dispatch flow.

Place the Phase section near the top of each element inspector (after element type/name, before
geometry fields).

---

## Tests

Add to `packages/web/src/workspace/phases/ManagePhasesDialog.test.tsx` (new file):
1. Dialog renders existing phase rows (name + delete button)
2. "Add Phase" dispatches create_phase command with next sequenceIndex
3. Editing a phase name input dispatches update_phase on blur
4. Delete button dispatches delete_phase with correct id

Add to inspector tests:
5. Wall inspector shows "Phase Created" select (data-testid inspector-phase-created)
6. Selecting a phase dispatches updateElement patch with phaseCreated
7. "Phase Demolished" select defaults to "—" when phaseDemolished is null

---

## Tracker update

Edit `spec/revit-parity/revit2026-parity-tracker.md`:

Update §2.8 description — append:
```
`phase` element type added to core/index.ts with create/update/delete commands.
`ManagePhasesDialog.tsx` (pattern: ManageRevisionsDialog): table of phases, add/delete/rename,
wired in Workspace.tsx via store. Per-element Phase Created / Phase Demolished dropdowns in
InspectorContent.tsx for all structural and architectural elements. 7 tests.
```
Change status to `Done — P1`.

Update summary table row for Chapter 2.
