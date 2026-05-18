# Wave 12 — WP-A: Group Edit Mode UI (§8.9.3)

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).
This prompt is self-contained — start here.

---

## Repo orientation

```
packages/core/src/index.ts                               — group element type + groupCommands
packages/web/src/plan/PlanCanvas.tsx                     — canvas state + selection
packages/web/src/state/store.ts                          — planTool, selectedElementIds, activeGroupEditId
packages/web/src/workspace/Workspace.tsx                 — command dispatch + modal state
packages/web/src/plan/symbology.ts                       — plan mesh rendering (ghosting)
packages/web/src/workspace/inspector/InspectorContent.tsx — inspector panels
```

Tests: co-located `*.test.ts` — run `pnpm test --filter @bim-ai/web`.
Prettier runs automatically after every Edit/Write.
**Shared-file rule**: before editing `toolGrammar.ts`, `toolRegistry.ts`, `core/index.ts`, or
`PlanCanvas.tsx`, run `git pull --rebase origin main` first.

---

## What already exists — DO NOT rebuild

Read ALL of these before writing anything:

- `group` element in `core/index.ts` — find `memberIds`, `editGroup`/`finishEditGroup` command shapes. Read the full group type definition.
- `Workspace.tsx` — search for `editGroup`, `finishEditGroup`, `activeGroupEditId`. Find what already dispatches these commands and what state is already tracked.
- `PlanCanvas.tsx` — search for `activeGroupEditId` or `groupEdit`. Find any existing selection restriction or group edit awareness.
- `store.ts` — find `activeGroupEditId` or equivalent. If it does not exist, you will add it.
- `symbology.ts` — find how plan meshes are built. Understand how to set opacity on non-group-member meshes to create ghosting.
- The double-click dispatch (added by wave 10 WP-C) that triggers `editGroup` — find `doubleClickDispatch.ts` or the equivalent handler.

---

## Tasks

### A — Store: active group edit state

In `store.ts`, add if not present:

```ts
activeGroupEditId: string | null;
setActiveGroupEditId: (id: string | null) => void;
```

Default: `null`.

### B — Workspace: command handlers

In `Workspace.tsx`, ensure the `editGroup` and `finishEditGroup` command handlers do:

**`editGroup` handler**:

```ts
case 'editGroup': {
  const groupId = cmd.groupId as string;
  store.setActiveGroupEditId(groupId);
  store.setSelectedElementIds([groupId]);
  break;
}
```

**`finishEditGroup` handler**:

```ts
case 'finishEditGroup': {
  store.setActiveGroupEditId(null);
  break;
}
```

Read what already exists — only add the missing parts.

### C — Plan ghosting: non-members

In `symbology.ts` (or wherever `rebuildPlanMeshes` is called), after building all element meshes, if `activeGroupEditId` is set:

```ts
const activeGroup = elementsById[activeGroupEditId];
const memberIds = new Set(activeGroup?.kind === 'group' ? activeGroup.memberIds : []);

for (const [elId, meshGroup] of planMeshMap) {
  if (elId === activeGroupEditId) continue;
  if (memberIds.has(elId)) continue;
  // Ghost non-members: set opacity to 0.2 on all materials
  meshGroup.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.material.opacity = 0.2;
      child.material.transparent = true;
    }
  });
}
```

Read how opacity/ghosting is currently done (phase overrides use a similar pattern) and follow the same approach. Do not break the existing phase ghosting logic.

### D — Selection restriction

In `PlanCanvas.tsx`, in the click handler, when `activeGroupEditId` is set:

- If the user clicks an element that is NOT in the active group's `memberIds`, do NOT select it
- Show a brief status hint: "Click a group member to select · Press Esc or Finish to exit group editing"
- Escape key should call `finishEditGroup`

Find the existing Escape handler chain and add `finishEditGroup` dispatch there.

### E — Finish Editing button

In `Workspace.tsx` or `PlanCanvas.tsx`, when `activeGroupEditId` is set, render a floating **"Finish Editing Group"** button:

```tsx
<button
  type="button"
  data-testid="finish-group-edit"
  onClick={() => dispatch({ type: 'finishEditGroup' })}
  style={{
    position: 'absolute',
    top: 48,
    right: 16,
    zIndex: 30,
    /* use the existing primary button style variables */
  }}
>
  Finish Editing Group
</button>
```

The button should only appear when `activeGroupEditId !== null`.

Also add an **"Edit Group"** button in the group inspector panel in `InspectorContent.tsx` (`data-testid="inspector-group-edit"`) that dispatches `editGroup`.

### F — Tests

Write `packages/web/src/workspace/groupEditMode.test.ts`:

```ts
describe('group edit mode — §8.9.3', () => {
  it('editGroup command sets activeGroupEditId', () => { ... });
  it('finishEditGroup command clears activeGroupEditId', () => { ... });
  it('finish-group-edit button dispatches finishEditGroup', () => { ... });
  it('inspector-group-edit button dispatches editGroup', () => { ... });
});
```

---

## Commit and push

After tests pass (`pnpm test --filter @bim-ai/web`):

```
git add -p
git commit -m "feat(wave12/A): group edit mode UI — ghost, selection restriction, finish button (§8.9.3)"
git push origin main
```

## Success criterion

`pnpm test --filter @bim-ai/web` — all tests pass including the new ones.
