# Wave 10 — WP-C: Double-Click to Edit in Context (§1.8.3)

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).
This prompt is self-contained — start here.

---

## Repo orientation

```
packages/web/src/plan/PlanCanvas.tsx                     — all canvas mouse/keyboard handlers
packages/web/src/state/store.ts                          — planTool, selectedElementIds
packages/web/src/tools/toolRegistry.ts                   — tool ids (floor-sketch, roof-sketch, etc.)
packages/core/src/index.ts                               — element types
```

Tests: co-located `*.test.ts` — run `pnpm test --filter @bim-ai/web`.
Prettier runs automatically after every Edit/Write.
**Shared-file rule**: before editing `toolGrammar.ts`, `toolRegistry.ts`, `core/index.ts`, or
`PlanCanvas.tsx`, run `git pull --rebase origin main` first.

---

## What already exists — DO NOT rebuild

Read ALL of these before writing anything:

- `PlanCanvas.tsx` — find the `onDoubleClick` handler (or `dblclick`). Read what it currently does. Find the raycasting / hit-test logic used for single clicks to understand how to identify the element under the double-click.
- `planTool` state — setting this to a tool id activates that tool. Double-click to edit works by selecting the element AND switching to the relevant sketch tool pre-seeded with that element's id.
- Existing "Edit Boundary" button in the floor inspector — this is already wired; double-clicking a floor should do the same thing. Read how that button works to replicate it.
- `floor-sketch`, `roof-sketch`, `wall` tools — these are the edit targets.

---

## Tasks

### A — Double-click dispatch table

In `PlanCanvas.tsx`, in the `onDoubleClick` (or equivalent) handler, add a dispatch table for `select` tool mode:

```
wall element      → activate wall editing: set planTool = 'wall', set activeWallId context
floor element     → activate 'floor-sketch' with the floor's boundary pre-loaded (same as "Edit Boundary" button)
roof element      → activate 'roof-sketch' with the roof's footprint pre-loaded
room element      → open room inspector (set selectedElementIds = [room.id], focus inspector)
dimension element → select element + focus inspector (same as single click, no special mode)
group element     → enter group edit mode (dispatch 'editGroup' command)
```

Implementation steps:
1. In the dblclick handler, raycast to find the hit element (or use `selectedElementIds[0]` if already selected)
2. Switch on `el.kind` and dispatch the appropriate action
3. For floor: dispatch the same command that "Edit Boundary" button fires — find it in `InspectorContent.tsx` and replicate
4. For roof: same pattern
5. For group: dispatch `{ type: 'editGroup', groupId: el.id }`

### B — Double-click on wall: edit profile hint

For walls, double-click should:
- Select the wall (if not already selected)
- Show a toast/status hint: "Double-clicked wall — use Edit Profile in the inspector to modify the cross-section shape"
- OR: if the wall has a custom `profilePoints` field, enter profile sketch mode (check if this exists)

Keep it simple: if full profile editing is not yet implemented, just select + show a `console.info` or status bar message. Do not implement profile editing from scratch.

### C — Visual feedback: double-click pulse

When a double-click triggers an edit mode switch, briefly highlight the element with a flash:
- Set `userData.editFlash = true` on the element's plan mesh
- In the render loop: if `editFlash`, animate opacity 1→0.3→1 over 300 ms, then clear the flag

This is optional — skip if it significantly complicates the implementation.

### D — Tests

Write `packages/web/src/plan/doubleClickEdit.test.ts`:
```ts
describe('double-click to edit — §1.8.3', () => {
  it('double-click on floor element triggers floor boundary edit mode', () => { ... });
  it('double-click on roof element triggers roof footprint edit mode', () => { ... });
  it('double-click on group dispatches editGroup command', () => { ... });
  it('double-click on room sets selectedElementIds to that room', () => { ... });
  it('double-click on wall selects wall without crashing', () => { ... });
});
```

---

## Commit and push

After tests pass (`pnpm test --filter @bim-ai/web`):
```
git add -p
git commit -m "feat(wave10/C): double-click to edit in context for floor/roof/group/room (§1.8.3)"
git push origin main
```

## Success criterion

`pnpm test --filter @bim-ai/web` — all tests pass including the new ones.
