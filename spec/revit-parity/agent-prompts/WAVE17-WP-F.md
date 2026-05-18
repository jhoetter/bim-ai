# Wave 17 — WP-F: Project Browser — Families + Groups Tree (§1.6.11)

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).
This prompt is self-contained — start here.

---

## Repo orientation

```
packages/web/src/workspace/project/ProjectBrowser.tsx       — main project browser
packages/web/src/workspace/project/ProjectBrowserV3.tsx     — v3 project browser (if exists)
packages/core/src/index.ts                                   — element types
packages/web/src/cmdPalette/defaultCommands.ts              — palette commands
```

Search for `ProjectBrowser`, `projectBrowser`, `familyType`, `group_instance`, `group_definition` in the codebase first. Read the full ProjectBrowser component before touching anything.

Tests: run `pnpm test --filter @bim-ai/web`.
Prettier runs automatically. **Always `git pull --rebase origin main` before pushing.**

---

## What already exists — read these first

1. `ProjectBrowser.tsx` (and/or `ProjectBrowserV3.tsx`): read the full component — understand the tree structure, how nodes are rendered, what sections exist (Views, Sheets, Levels, etc.).
2. `core/index.ts`: find `group_definition` and `group_instance` element kinds. Find `family_type` or `family_definition` kinds. Read their fields.
3. Search for `rightClick` or `contextMenu` in ProjectBrowser — read any existing context menu logic.

---

## Tasks

### A — Families section in the project browser tree

In `ProjectBrowser.tsx` (or whichever is the active one), add a "Families" collapsible section:

```tsx
// After the existing "Views" or "Sheets" section:
<ProjectBrowserSection label="Families" data-testid="pb-section-families" defaultCollapsed={true}>
  {familyTypes.map((ft) => (
    <ProjectBrowserLeaf
      key={ft.id}
      label={ft.name ?? ft.kind}
      icon="🧩"
      data-testid={`pb-family-${ft.id}`}
      onDoubleClick={() => {
        /* open family editor for this type */
      }}
    />
  ))}
</ProjectBrowserSection>
```

`familyTypes` = all elements with `kind` in `['family_extrusion', 'family_revolve', 'family_void', 'family_blend', 'family_sweep']` collected from `elementsById`.

Group by kind category:

- "Structural" — `family_extrusion`, `family_blend`, `family_sweep`
- "Voids" — `family_void`
- "Revolves" — `family_revolve`

---

### B — Groups section in the project browser tree

Add a "Groups" collapsible section:

```tsx
<ProjectBrowserSection label="Groups" data-testid="pb-section-groups" defaultCollapsed={true}>
  {groupDefinitions.map((gd) => (
    <ProjectBrowserLeaf
      key={gd.id}
      label={gd.name ?? 'Group'}
      icon="⬡"
      data-testid={`pb-group-${gd.id}`}
      secondaryLabel={`×${instanceCount(gd.id)}`}
    />
  ))}
</ProjectBrowserSection>
```

`groupDefinitions` = elements with `kind === 'group_definition'`.
`instanceCount(gdId)` = count of `group_instance` elements with matching `groupDefinitionId`.

---

### C — Right-click context menu on view nodes

If no context menu exists, add one. On right-click of a view leaf (plan_view or 3d_view node):

```tsx
const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; nodeId: string } | null>(null);

// On the leaf element:
onContextMenu={(e) => {
  e.preventDefault();
  setCtxMenu({ x: e.clientX, y: e.clientY, nodeId: view.id });
}}

// Context menu:
{ctxMenu && (
  <div
    data-testid="pb-context-menu"
    style={{ position: 'fixed', left: ctxMenu.x, top: ctxMenu.y,
      background: '#fff', border: '1px solid #ccc', borderRadius: 4,
      boxShadow: '0 2px 8px rgba(0,0,0,0.15)', zIndex: 9999 }}
    onMouseLeave={() => setCtxMenu(null)}
  >
    <button data-testid="pb-ctx-rename" onClick={() => { startRename(ctxMenu.nodeId); setCtxMenu(null); }}>
      Rename
    </button>
    <button data-testid="pb-ctx-duplicate" onClick={() => { duplicateView(ctxMenu.nodeId); setCtxMenu(null); }}>
      Duplicate View
    </button>
    <button data-testid="pb-ctx-delete" onClick={() => { deleteView(ctxMenu.nodeId); setCtxMenu(null); }}>
      Delete
    </button>
  </div>
)}
```

**Rename**: show inline text input in place of the label, on Enter dispatch `updateElementProperty` with key `'name'`, value newName.

**Duplicate**: dispatch `createElement` with a copy of the view element (new ID, name = `${original.name} Copy`).

**Delete**: dispatch `deleteElement` for the view ID (confirm first with `window.confirm`).

---

### D — Inline rename for views

When rename is triggered, replace the leaf label with an `<input>`:

```tsx
{
  renamingId === view.id ? (
    <input
      data-testid={`pb-rename-input-${view.id}`}
      defaultValue={view.name ?? ''}
      autoFocus
      onBlur={(e) => commitRename(view.id, e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') commitRename(view.id, e.currentTarget.value);
        if (e.key === 'Escape') setRenamingId(null);
      }}
    />
  ) : (
    <span>{view.name}</span>
  );
}
```

---

### E — Camera views section (if not already present)

If there is no "Camera Views" or "3D Views" section, add one listing all elements with `kind === '3d_view'` or `kind === 'perspective_camera'`. Each entry shows view name, double-click activates that camera view.

---

### F — Tests

`packages/web/src/workspace/project/projectBrowserFamilies.test.tsx`:

```ts
describe('ProjectBrowser families section — §1.6.11', () => {
  it('renders pb-section-families', () => { ... });
  it('shows one leaf per family element', () => { ... });
  it('pb-section-families is collapsed by default', () => { ... });
});
```

`packages/web/src/workspace/project/projectBrowserGroups.test.tsx`:

```ts
describe('ProjectBrowser groups section — §1.6.11', () => {
  it('renders pb-section-groups', () => { ... });
  it('shows one leaf per group_definition', () => { ... });
  it('shows instance count label', () => { ... });
});
```

`packages/web/src/workspace/project/projectBrowserContextMenu.test.tsx`:

```ts
describe('ProjectBrowser context menu — §1.6.11', () => {
  it('right-click on view shows pb-context-menu', () => { ... });
  it('pb-ctx-rename shows rename input', () => { ... });
  it('committing rename dispatches updateElementProperty', () => { ... });
  it('pb-ctx-duplicate dispatches createElement with new ID', () => { ... });
});
```

---

## Commit and push

```
git pull --rebase origin main
git add -p
git commit -m "feat(wave17/F): project browser families + groups tree + view context menu (§1.6.11)"
git push origin main
```

## Success criterion

`pnpm test --filter @bim-ai/web` — all tests pass including the new project browser tests.
