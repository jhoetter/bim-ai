# Wave 19 — WP-C: Link IFC — ManageLinksDialog UI + Ghost Rendering (§12.1.1)

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).
This prompt is self-contained — start here.

---

## Context — what Wave 18 already delivered

Wave 18 WP-D created:
- `packages/web/src/import/ifcLinkImporter.ts` — `createIfcLink()`, `applyIfcLinkOffset()`
- `packages/web/src/import/ifcLinkImporter.test.ts` — 6 tests (all pass)

**Still missing:**
- `link_ifc` element type in `core/index.ts`
- Command types: `addIfcLink`, `removeIfcLink`, `toggleIfcLinkVisibility`
- `ManageLinksDialog.tsx` — IFC Links section with file picker + list
- `Workspace.tsx` handlers for the three commands
- Ghost rendering (blue-tint meshes) for linked IFC elements
- `ProjectBrowser.tsx` — Linked IFC subtree
- Palette command + capability graph entry

---

## Repo orientation

```
packages/core/src/index.ts
packages/web/src/import/ifcLinkImporter.ts          — createIfcLink (already exists)
packages/web/src/workspace/ManageLinksDialog.tsx     — extend this
packages/web/src/viewport/linkedGhosting.ts         — ghost rendering (read it)
packages/web/src/workspace/ProjectBrowser.tsx        — extend for IFC subtree
packages/web/src/workspace/Workspace.tsx
packages/web/src/cmdPalette/defaultCommands.ts
packages/web/src/workspace/commandCapabilities.ts
```

Read `ManageLinksDialog.tsx` fully — understand the existing bim-ai model link UI. Read `linkedGhosting.ts` — understand how `link_model` elements are rendered as ghost meshes.

Tests: run `pnpm test --filter @bim-ai/web`.
Prettier runs automatically. **Always `git pull --rebase origin main` before pushing.**

---

## Tasks

### A — `link_ifc` element type in `core/index.ts`

Add if not present:

```ts
| {
    kind: 'link_ifc';
    id: string;
    name: string;
    ifcContent: string;
    linkedElements: Element[];
    visible: boolean;
    offsetMm?: { xMm: number; yMm: number; zMm: number } | null;
    pinned?: boolean;
  }
```

Add command types:
```ts
| { type: 'addIfcLink'; element: Extract<Element, { kind: 'link_ifc' }> }
| { type: 'removeIfcLink'; linkId: string }
| { type: 'toggleIfcLinkVisibility'; linkId: string }
```

---

### B — `ManageLinksDialog.tsx` extension

Add an "IFC Links" section. Read the existing file to understand the layout pattern, then add below the existing bim-ai model links section:

```tsx
{/* IFC Links section */}
<section>
  <h4>IFC Links</h4>
  <input
    type="file"
    accept=".ifc"
    data-testid="link-ifc-file-input"
    style={{ display: 'none' }}
    ref={ifcFileInputRef}
    onChange={async e => {
      const file = e.target.files?.[0];
      if (!file) return;
      const content = await file.text();
      const link = createIfcLink(file.name, content);
      void onSemanticCommand({ type: 'addIfcLink', element: link });
    }}
  />
  <button data-testid="link-ifc-btn"
    onClick={() => ifcFileInputRef.current?.click()}>
    Link IFC…
  </button>
  <ul>
    {ifcLinks.map(link => (
      <li key={link.id} data-testid={`link-ifc-row-${link.id}`}>
        <span>{link.name}</span>
        <input type="checkbox"
          data-testid={`link-ifc-visible-${link.id}`}
          checked={link.visible}
          onChange={() => void onSemanticCommand({ type: 'toggleIfcLinkVisibility', linkId: link.id })} />
        <button data-testid={`link-ifc-remove-${link.id}`}
          onClick={() => void onSemanticCommand({ type: 'removeIfcLink', linkId: link.id })}>
          Remove
        </button>
      </li>
    ))}
  </ul>
</section>
```

Where `ifcLinks = Object.values(elementsById).filter(e => e?.kind === 'link_ifc')` passed in as prop.

---

### C — `Workspace.tsx` handlers

```ts
case 'addIfcLink':
  elementsById[cmd.element.id] = cmd.element;
  break;
case 'removeIfcLink':
  delete elementsById[cmd.linkId];
  break;
case 'toggleIfcLinkVisibility': {
  const link = elementsById[cmd.linkId];
  if (link?.kind === 'link_ifc') {
    (link as any).visible = !(link as any).visible;
  }
  break;
}
```

---

### D — Ghost rendering in `Viewport.tsx` or `linkedGhosting.ts`

Read how `link_model` elements produce ghost meshes. Extend the same logic for `link_ifc`:

For each `link_ifc` element where `visible: true`, iterate `link.linkedElements` and build meshes using the existing mesh builders, then apply a blue-tint ghost material identical to the `link_model` treatment.

If `linkedGhosting.ts` exports a function that takes a list of elements, call it with `link.linkedElements`. If it's handled inline in `Viewport.tsx`, add a parallel block for `link_ifc`.

---

### E — `ProjectBrowser.tsx` — Linked IFC subtree

Add a "Linked IFC" group below "Links". The group lists each `link_ifc` element with:
- File name
- Visibility eye icon
- Right-click context menu: Remove

Use `data-testid="browser-linked-ifc-tree"` for the container and `data-testid="browser-linked-ifc-row-{id}"` for each row.

---

### F — Palette command + capability graph

In `defaultCommands.ts`:
```ts
{ id: 'file.link-ifc', label: 'Link IFC File…',
  keywords: ['link', 'ifc', 'federated', 'import'],
  category: 'command', invoke: (ctx) => ctx.openManageLinks?.() }
```

In `commandCapabilities.ts`:
```ts
{ id: 'file.link-ifc', scope: 'document', intendedModes: ['plan', '3d'], precondition: null },
```

---

### G — Tests

`packages/web/src/workspace/IfcLinksDialog.test.tsx`:

```tsx
describe('ManageLinksDialog IFC section — §12.1.1', () => {
  it('renders the Link IFC button', () => { ... });
  it('renders a list row for each link_ifc element', () => { ... });
  it('visibility checkbox is checked when link is visible', () => { ... });
  it('clicking Remove calls onSemanticCommand removeIfcLink', () => { ... });
});
```

---

## Commit and push

```
git pull --rebase origin main
git add -p
git commit -m "feat(wave19/C): link IFC — link_ifc element type + ManageLinksDialog UI + Workspace handlers + ghost rendering (§12.1.1)"
git push origin main
```

## Success criterion

`pnpm test --filter @bim-ai/web` — all tests pass.
