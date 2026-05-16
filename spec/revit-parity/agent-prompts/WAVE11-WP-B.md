# Wave 11 — WP-B: Element Auto-Tag by Category (§4.11.1 + §4.11.2)

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).
This prompt is self-contained — start here.

---

## Repo orientation

```
packages/core/src/index.ts                               — element types (tag, annotation, door, window, room)
packages/web/src/plan/autoTags.ts                        — existing auto-tag logic (read fully)
packages/web/src/plan/manualTags.ts                      — manual tag placement (read fully)
packages/web/src/plan/planElementMeshBuilders.ts         — tag rendering
packages/web/src/cmdPalette/defaultCommands.ts           — palette entries
packages/web/src/workspace/inspector/InspectorContent.tsx — element inspector panels
packages/web/src/plan/PlanCanvas.tsx                     — tag tool placement
```

Tests: co-located `*.test.ts` — run `pnpm test --filter @bim-ai/web`.
Prettier runs automatically after every Edit/Write.
**Shared-file rule**: before editing `toolGrammar.ts`, `toolRegistry.ts`, `core/index.ts`, or
`PlanCanvas.tsx`, run `git pull --rebase origin main` first.

---

## What already exists — DO NOT rebuild

Read ALL of these before writing anything:

- `autoTags.ts` — read end-to-end. Find `autoTagElements`, `getTagContent`, and any existing category-based tag generation. Understand what tag data the function currently derives (mark, type name, dimensions) and how it places tags relative to element centroids.
- `manualTags.ts` — read end-to-end. Understand how individually placed tags differ from auto-tags.
- The `tag` element kind in `core/index.ts` — find all fields: `targetElementId`, `categoryKind`, `content` / `fields`, `positionMm`, `leaderEndMm`. Read the full type definition.
- `planElementMeshBuilders.ts` — find the tag renderer. Understand what it renders from tag fields.
- `defaultCommands.ts` — check if `annotation.tag-all` or similar already exists. Do NOT duplicate.

---

## Tasks

### A — Tag content field enrichment

In `core/index.ts`, ensure the `tag` element type has these fields (add only missing ones):

```ts
targetElementId: string;        // id of the tagged element
categoryKind: string;           // element kind being tagged (e.g. 'door', 'window', 'room')
positionMm: { x: number; y: number };
leaderEndMm?: { x: number; y: number } | null; // tip of leader line
fields: {
  mark?: string | null;         // door/window mark number
  typeName?: string | null;     // type name
  widthMm?: number | null;
  heightMm?: number | null;
  roomName?: string | null;
  roomNumber?: string | null;
};
```

### B — autoTagElements: complete category support

In `autoTags.ts`, extend (or complete) the `autoTagElements` function to handle:

**Door tags**: `fields.mark = door.mark ?? door.id.slice(-3)`, `fields.typeName = lookupTypeName(door.doorTypeId)`, `fields.widthMm = door.widthMm`, `fields.heightMm = door.heightMm`. Position: offset 400 mm toward room-side centroid.

**Window tags**: same pattern — `fields.mark`, `fields.typeName`, `fields.widthMm`, `fields.heightMm`. Position: 400 mm above sill.

**Room tags**: `fields.roomName = room.name`, `fields.roomNumber = room.numberLabel`. Position: room centroid. Tag already exists for rooms — verify it populates `fields.roomName` and `fields.roomNumber` correctly.

**Wall tags** (if not yet implemented): `fields.typeName = lookupTypeName(wall.wallTypeId)`. Position: wall midpoint offset 300 mm perpendicular.

The function signature: `autoTagElements(elements: Element[], activeLevelId: string): Tag[]`

Each tag gets a stable `id` derived from `'auto-tag-${targetElement.id}'` so re-running doesn't create duplicates.

### C — "Tag All by Category" palette command

In `defaultCommands.ts`, add:

```ts
registerCommand({
  id: 'annotation.tag-all-by-category',
  label: 'Tag All by Category…',
  keywords: ['tag all', 'auto tag', 'annotate', 'mark', 'label all'],
  category: 'command',
  invoke: (ctx) => ctx.tagAllByCategory?.(),
});
```

In `Workspace.tsx` (or wherever element dispatch lives):
- Add `tagAllByCategory` to `PaletteContext`
- When invoked: call `autoTagElements(Object.values(elementsById), activeLevelId)` and dispatch `create_element` (or `batch_create_elements`) for each tag not already present
- Check by `id` — existing `'auto-tag-${id}'` tags are updated, not duplicated

### D — Tag rendering: leader line

In `planElementMeshBuilders.ts`, in the tag renderer:
- If `tag.leaderEndMm` is set, draw a thin line from `leaderEndMm` to `positionMm` (leader line)
- Use `THREE.Line` with a 0.5 px linewidth material (same pattern as dimension lines)
- Tag text box background: small white rectangle behind the label text sprite

If a leader line renderer already exists, verify it correctly uses `leaderEndMm` and does not crash when `null`.

### E — Inspector: tag fields

In `InspectorContent.tsx`, for `el.kind === 'tag'`:
- Show `data-testid="inspector-tag-mark"`: editable text input for `fields.mark`
- Show `data-testid="inspector-tag-type"`: read-only display of `fields.typeName`
- Show `data-testid="inspector-tag-target"`: read-only display of `targetElementId` (or the target element's name)
- On mark change: dispatch `update_element_property` for `fields.mark`

### F — Tests

Write `packages/web/src/plan/autoTagElements.test.ts`:
```ts
describe('autoTagElements — §4.11.1', () => {
  it('generates a door tag with mark and typeName', () => { ... });
  it('generates a window tag with widthMm and heightMm', () => { ... });
  it('generates a room tag with roomName and roomNumber', () => { ... });
  it('tag id is stable across repeated calls for the same element', () => { ... });
  it('does not duplicate tags for same targetElementId', () => { ... });
});
```

Write `packages/web/src/workspace/inspector/tagInspector.test.tsx`:
```ts
describe('tag inspector — §4.11.2', () => {
  it('renders inspector-tag-mark input with current mark value', () => { ... });
  it('mark input change dispatches update_element_property', () => { ... });
  it('renders inspector-tag-target read-only display', () => { ... });
});
```

---

## Commit and push

After tests pass (`pnpm test --filter @bim-ai/web`):
```
git add -p
git commit -m "feat(wave11/B): element auto-tag by category + tag inspector (§4.11.1 + §4.11.2)"
git push origin main
```

## Success criterion

`pnpm test --filter @bim-ai/web` — all tests pass including the new ones.
