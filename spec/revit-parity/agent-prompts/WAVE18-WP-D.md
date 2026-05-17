# Wave 18 — WP-D: Link IFC File (§12.1.1)

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).
This prompt is self-contained — start here.

---

## Repo orientation

```
packages/core/src/index.ts                          — Element union (link_model exists)
packages/web/src/workspace/ManageLinksDialog.tsx    — manage linked models UI
packages/web/src/viewport/linkedGhosting.ts         — ghost rendering for linked elements
packages/web/src/import/ifcParser.ts                — STEP parser (wave 16)
packages/web/src/import/ifcImportConverter.ts       — IFC → element converter (wave 16)
packages/web/src/cmdPalette/defaultCommands.ts
packages/web/src/workspace/commandCapabilities.ts
```

Search for `link_model`, `LinkModel`, `linkedModel`, `ManageLinksDialog`, `ifcParser`, `ifcImportConverter`, `link_ifc` in the codebase. Read EVERYTHING found before touching anything.

Tests: run `pnpm test --filter @bim-ai/web`.
Prettier runs automatically. **Always `git pull --rebase origin main` before pushing.**

---

## What already exists — read these first

1. `core/index.ts`: find `link_model` — read its full type. Find all `link_*` kinds.
2. `ManageLinksDialog.tsx`: read fully — what UI does it expose? What commands does it dispatch?
3. `linkedGhosting.ts`: read how linked model elements are rendered (ghost/blue-tint).
4. `ifcParser.ts` + `ifcImportConverter.ts`: read how IFC parsing and conversion work. Understand the return types.
5. `defaultCommands.ts`: find any `file.import-ifc` or `file.link-*` commands.

---

## Tasks

### A — `link_ifc` element type in `core/index.ts`

Add if not present:

```ts
| {
    kind: 'link_ifc';
    id: string;
    /** Display name of the linked IFC file. */
    name: string;
    /** The raw IFC STEP string content (stored for re-parsing). */
    ifcContent: string;
    /** Converted bim-ai elements derived from the IFC. */
    linkedElements: Element[];
    /** Whether the linked IFC is visible. */
    visible: boolean;
    /** Translation offset applied to all linked elements. */
    offsetMm?: { xMm: number; yMm: number; zMm: number };
    /** Whether the link is pinned (cannot be accidentally moved). */
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

### B — `IfcLinkImporter.ts`

Create `packages/web/src/import/ifcLinkImporter.ts`:

```ts
import { parseIfc } from './ifcParser';
import { convertIfcToElements } from './ifcImportConverter';
import type { Element } from '@bim-ai/core';

type LinkIfcEl = Extract<Element, { kind: 'link_ifc' }>;

/**
 * Parses an IFC STEP string and creates a link_ifc element.
 */
export function createIfcLink(
  name: string,
  ifcContent: string,
): LinkIfcEl {
  const entities = parseIfc(ifcContent);
  const linkedElements = convertIfcToElements(entities);
  return {
    kind: 'link_ifc',
    id: crypto.randomUUID(),
    name,
    ifcContent,
    linkedElements,
    visible: true,
    pinned: false,
  };
}

/**
 * Applies an offset to all linked element positions.
 */
export function applyIfcLinkOffset(
  link: LinkIfcEl,
  offsetMm: { xMm: number; yMm: number; zMm: number },
): LinkIfcEl {
  return { ...link, offsetMm };
}
```

---

### C — `ManageLinksDialog.tsx` extension

Add an "IFC Links" section below the existing bim-ai model links section.

The IFC Links section should have:
- A file input `<input type="file" accept=".ifc" data-testid="link-ifc-file-input">` that reads the file content
- On file load: call `createIfcLink(file.name, content)`, dispatch `addIfcLink` command
- A list of current IFC links (from `elementsById` filtered by `kind === 'link_ifc'`)
- Per-link row: name + visibility checkbox (`data-testid="link-ifc-visible-{id}"`) + remove button (`data-testid="link-ifc-remove-{id}"`)
- A "Link IFC…" button (`data-testid="link-ifc-btn"`) that triggers the file input

---

### D — `Workspace.tsx` handlers

Handle the three new commands:

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

### E — Linked element rendering

In `Workspace.tsx` or wherever `linkedGhosting.ts` is used, extend the ghost rendering to also handle `link_ifc` elements. For each `link_ifc` element where `visible: true`, build meshes for each `linkedElement` in `link.linkedElements`, apply a blue ghost tint (same as `link_model`), and add them to the scene with `userData.isLinkedElement = true`.

If `linkedGhosting.ts` has a `buildLinkedModelMeshes()` function, extend it to accept `link_ifc` linked elements. If not, add the ghost rendering inline in Viewport.tsx following the existing `link_model` pattern.

---

### F — ProjectBrowser integration

In `ProjectBrowser.tsx`, add a "Linked IFC" subtree below "Links" (which shows `link_model` elements). The IFC subtree lists `link_ifc` elements with an eye icon for visibility toggle and a right-click menu (Remove).

Use `data-testid="browser-linked-ifc-tree"` for the subtree container.

---

### G — Palette command + capability graph

In `defaultCommands.ts`:
```ts
{ id: 'file.link-ifc', label: 'Link IFC File…',
  keywords: ['link', 'ifc', 'import', 'federated'],
  category: 'command', invoke: (ctx) => ctx.openManageLinks?.() }
```

In `commandCapabilities.ts`:
```ts
{ id: 'file.link-ifc', scope: 'document', intendedModes: ['plan', '3d'], precondition: null },
```

---

### H — Tests

`packages/web/src/import/ifcLinkImporter.test.ts`:

```ts
describe('createIfcLink — §12.1.1', () => {
  it('returns a link_ifc element', () => { ... });
  it('visible defaults to true', () => { ... });
  it('name is set from argument', () => { ... });
  it('linkedElements is an array', () => { ... });
});

describe('applyIfcLinkOffset — §12.1.1', () => {
  it('sets offsetMm on the link', () => { ... });
  it('does not mutate original link', () => { ... });
});
```

---

## Commit and push

```
git pull --rebase origin main
git add -p
git commit -m "feat(wave18/D): link IFC file — link_ifc element type + importer + ManageLinksDialog + ghost rendering (§12.1.1)"
git push origin main
```

## Success criterion

`pnpm test --filter @bim-ai/web` — all tests pass including the new IFC link tests.
