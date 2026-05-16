# Wave 13 — WP-E: Room Tags — Name / Number / Area Display (§13.1.2)

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).
This prompt is self-contained — start here.

---

## Repo orientation

```
packages/core/src/index.ts                               — placed_tag element type, room element type
packages/web/src/plan/planElementMeshBuilders.ts         — placed_tag plan rendering (tag renderer)
packages/web/src/plan/planRoomLabelLayout.ts             — room label / tag layout helper
packages/web/src/workspace/inspector/InspectorContent.tsx — placed_tag inspector
packages/web/src/cmdPalette/defaultCommands.ts           — palette commands
```

Tests: co-located `*.test.ts` — run `pnpm test --filter @bim-ai/web`.
Prettier runs automatically after every Edit/Write.
**Shared-file rule**: before editing `toolGrammar.ts`, `toolRegistry.ts`, `core/index.ts`, or
`PlanCanvas.tsx`, run `git pull --rebase origin main` first.

---

## What already exists — DO NOT rebuild

Read ALL of these before writing anything:

- `placed_tag` in `core/index.ts` — read all fields: `hostElementId`, `hostViewId`, `positionMm`, `categoryKind`, `leaderEndMm`, `fields` (mark, typeName, widthMm, heightMm, roomName, roomNumber). Find if `roomArea` already exists in `fields`. Do NOT add fields that already exist.
- `room` element in `core/index.ts` — find `areaMm2`, `name`, `number` fields.
- `planElementMeshBuilders.ts` — find the `placed_tag` renderer. Read what it currently draws (text sprite or CSS2DObject). Read how it accesses `el.fields`.
- `planRoomLabelLayout.ts` — read the full file. Understand if it computes/positions room labels automatically. Do NOT rewrite this logic.
- `InspectorContent.tsx` → search for `placed_tag` case. Read what is already there. If the inspector for `placed_tag` is missing or minimal, add the full panel.
- `defaultCommands.ts` — search for `annotation.place-room-tag`. If it exists, do NOT add it again.

---

## Tasks

### A — Core type: room area in placed_tag fields

In `core/index.ts`, add to `placed_tag.fields` if NOT already present:
```ts
roomArea?: number | null; // area in mm²
```

Also add display control fields to the `placed_tag` type itself if not present:
```ts
/** Which fields are shown in the tag label. */
showRoomName?: boolean | null;      // default true
showRoomNumber?: boolean | null;    // default true
showRoomArea?: boolean | null;      // default false
```

### B — Room tag plan renderer

In `planElementMeshBuilders.ts`, in the `placed_tag` renderer:

When `el.categoryKind === 'room'`:
- Compose the tag text from the enabled fields:
  - If `showRoomNumber !== false`: first line = `el.fields?.roomNumber ?? ''`
  - If `showRoomName !== false`: second line = `el.fields?.roomName ?? ''`
  - If `showRoomArea === true` and `el.fields?.roomArea != null`: third line = `"${(el.fields.roomArea / 1e6).toFixed(2)} m²"`
- Render a CSS2DObject (or existing text sprite — use the same approach as other tags in this file) with the composed text
- Draw a thin rectangular border around the tag label (width ≈ 800mm, height ≈ 500mm in plan units)
- If `el.leaderEndMm` is set, draw a leader line from `positionMm` to `leaderEndMm`

Tag the group with `userData.placedTagKind = 'room'` and `userData.elementId = el.id`.

### C — Auto-populate room area when placing/updating tag

In `Workspace.tsx` (or wherever the `placed_tag` update logic runs), when a `placed_tag` with `categoryKind === 'room'` is created or the host room changes:
- Resolve the host room element from `elementsById` by `hostElementId`
- Copy `room.areaMm2` → `tag.fields.roomArea`
- Copy `room.name` → `tag.fields.roomName`
- Copy `room.number` → `tag.fields.roomNumber`

This ensures the tag always reflects the current room data.

### D — Inspector for placed_tag (room)

In `InspectorContent.tsx`, for `el.kind === 'placed_tag'` and `el.categoryKind === 'room'`:

```tsx
<div className="flex flex-col gap-2">
  <div className="text-xs font-semibold text-muted">Room Tag Fields</div>
  <label className="flex items-center gap-2 text-xs">
    <input
      type="checkbox"
      data-testid="inspector-tag-show-number"
      checked={el.showRoomNumber !== false}
      onChange={(e) => onPropertyChange?.('showRoomNumber', e.target.checked)}
    />
    Show Room Number
  </label>
  <label className="flex items-center gap-2 text-xs">
    <input
      type="checkbox"
      data-testid="inspector-tag-show-name"
      checked={el.showRoomName !== false}
      onChange={(e) => onPropertyChange?.('showRoomName', e.target.checked)}
    />
    Show Room Name
  </label>
  <label className="flex items-center gap-2 text-xs">
    <input
      type="checkbox"
      data-testid="inspector-tag-show-area"
      checked={el.showRoomArea === true}
      onChange={(e) => onPropertyChange?.('showRoomArea', e.target.checked)}
    />
    Show Area (m²)
  </label>
  <FieldRow label="Area" value={el.fields?.roomArea != null ? `${(el.fields.roomArea / 1e6).toFixed(2)} m²` : '—'} />
</div>
```

If the `placed_tag` inspector case does not exist yet, add the full case for `'placed_tag'` with this room sub-section.

### E — Tests

Write `packages/web/src/workspace/inspector/roomTagInspector.test.tsx`:
```ts
describe('room tag inspector — §13.1.2', () => {
  it('renders inspector-tag-show-number checkbox checked by default', () => { ... });
  it('renders inspector-tag-show-area checkbox unchecked by default', () => { ... });
  it('show-area change dispatches onPropertyChange for showRoomArea', () => { ... });
  it('shows computed area from fields.roomArea', () => { ... });
});
```

Write `packages/web/src/plan/roomTagRenderer.test.ts`:
```ts
describe('room tag plan renderer — §13.1.2', () => {
  it('composes tag text with room number and name by default', () => { ... });
  it('includes area line when showRoomArea is true', () => { ... });
  it('omits name line when showRoomName is false', () => { ... });
});
```

---

## Commit and push

After tests pass (`pnpm test --filter @bim-ai/web`):
```
git add -p
git commit -m "feat(wave13/E): room tags — name/number/area display + inspector (§13.1.2)"
git push origin main
```

## Success criterion

`pnpm test --filter @bim-ai/web` — all tests pass including the new ones.
