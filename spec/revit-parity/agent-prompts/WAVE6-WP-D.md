# Wave 6 — WP-D: Group Edit Mode UI (§8.9.3)

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).
This prompt is self-contained — start here.

---

## Repo orientation

```
packages/web/src/groups/groupCommands.ts                 — EditGroupCommand, FinishEditGroupCommand, applyEditGroup?
packages/web/src/groups/groupTypes.ts                    — GroupDefinition, GroupInstance, GroupRegistry
packages/web/src/state/storeTypes.ts                     — StoreState (groupRegistry, setGroupRegistry)
packages/web/src/state/store.ts                          — Zustand store
packages/web/src/workspace/Workspace.tsx                 — command dispatch, modal state
packages/web/src/workspace/WorkspaceLeftRail.tsx         — project browser context menus
packages/web/src/workspace/project/ProjectBrowser.tsx    — groups subtree (B5 — already done)
```

Tests: co-located `*.test.ts` — run `pnpm test --filter @bim-ai/web`.
Prettier runs automatically after every Edit/Write.
**Shared-file rule**: before editing `toolGrammar.ts`, `toolRegistry.ts`, `core/index.ts`, or
`PlanCanvas.tsx`, run `git pull --rebase origin main` first.

---

## What already exists — DO NOT rebuild

Read ALL of these files before writing anything:
- `groups/groupCommands.ts` — `EditGroupCommand { type: 'editGroup'; groupDefinitionId }` and
  `FinishEditGroupCommand { type: 'finishEditGroup' }` command interfaces exist. Read what logic
  functions exist (e.g. `applyCreateGroup`, `applyPlaceGroup`, `applyRenameGroup`).
- `groups/groupTypes.ts` — `GroupDefinition { id, name, elementIds[] }` and `GroupInstance`.
- `state/storeTypes.ts` — `groupRegistry: GroupRegistry`, `setGroupRegistry`. Note whether
  `groupEditModeDefinitionId` already exists; do NOT add duplicates.
- `workspace/project/ProjectBrowser.tsx` — "Groups" subtree (ProjectBrowserGroupsGroup component)
  has right-click context menu. Read it before adding "Edit Group".
- `workspace/Workspace.tsx` — how other modal/mode state (e.g. `selectionFilterOpen`) is managed.

---

## Tasks

### A — Store state

In `state/storeTypes.ts`, add (if not present):
```ts
groupEditModeDefinitionId: string | null;
setGroupEditModeDefinitionId: (id: string | null) => void;
```

In the store slice that handles `groupRegistry`, implement:
```ts
groupEditModeDefinitionId: null,
setGroupEditModeDefinitionId: (id) => set({ groupEditModeDefinitionId: id }),
```

### B — Edit mode activation

In `Workspace.tsx`, handle an `'editGroup'` semantic command (dispatched via the palette or
context menu):
```ts
case 'editGroup':
  useBimStore.getState().setGroupEditModeDefinitionId(cmd.groupDefinitionId);
  break;
case 'finishEditGroup':
  useBimStore.getState().setGroupEditModeDefinitionId(null);
  break;
```

### C — "Edit Group" context menu entry

In `ProjectBrowser.tsx` (or `WorkspaceLeftRail.tsx` — whichever has the Groups subtree context
menu), add a context menu item "Edit Group" (`data-testid="group-ctx-edit"`) that dispatches
`{ type: 'editGroup', groupDefinitionId: def.id }` into the command queue.

### D — Finish Editing Group floating button

In `Workspace.tsx` (or a new component `GroupEditModeBar.tsx`), when
`groupEditModeDefinitionId !== null`, render a floating bar at the bottom of the canvas:

```tsx
<div data-testid="group-edit-mode-bar" style={{ position: 'fixed', bottom: 16, left: '50%', transform: 'translateX(-50%)' }}>
  <span>Editing group: {groupName}</span>
  <button data-testid="finish-edit-group-btn" onClick={finishEditing}>Finish Editing Group</button>
</div>
```

`finishEditing` dispatches `{ type: 'finishEditGroup' }` and calls `setGroupEditModeDefinitionId(null)`.

### E — Selection restriction

In `Workspace.tsx` (or wherever `selectedIds` is managed), when `groupEditModeDefinitionId !== null`:
- Filter the selectable elements so only those in `groupRegistry.definitions[groupEditModeDefinitionId].elementIds` can be selected.
- If a click tries to select an element NOT in the group, do NOT add it to `selectedIds`.
- Implement this by wrapping the `setSelectedIds` call: check membership in `groupEditModeDefinitionId`'s `elementIds`.

This is the key behaviour: during group edit mode, clicking non-group elements does nothing.

### F — Tests

Write `packages/web/src/groups/groupEditMode.test.ts`:
```ts
describe('group edit mode — §8.9.3', () => {
  it('setGroupEditModeDefinitionId sets groupEditModeDefinitionId in store', () => { ... });
  it('finishEditGroup clears groupEditModeDefinitionId', () => { ... });
  it('editGroup with unknown id does not crash', () => { ... });
  it('group definition elementIds are accessible for filtering', () => { ... });
});
```

Write `packages/web/src/groups/groupEditModeBar.test.tsx`:
```ts
describe('GroupEditModeBar — §8.9.3', () => {
  it('renders group-edit-mode-bar when groupEditModeDefinitionId is set', () => { ... });
  it('does not render when groupEditModeDefinitionId is null', () => { ... });
  it('finish-edit-group-btn clears edit mode', () => { ... });
});
```

---

## Success criterion

`pnpm test --filter @bim-ai/web` — all tests pass including the new ones.
