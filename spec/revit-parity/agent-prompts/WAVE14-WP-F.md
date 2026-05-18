# Wave 14 — WP-F: Room Net Area in Inspector + Furniture Schedule Preset (§13.1.4 + §13.3.1)

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).
This prompt is self-contained — start here.

---

## Repo orientation

```
packages/web/src/plan/roomArea.ts                          — roomNetAreaM2 helper
packages/web/src/workspace/inspector/InspectorContent.tsx  — room inspector case
packages/web/src/schedules/scheduleDefinitionPresets.ts    — schedule preset definitions
packages/web/src/schedules/SchedulePanel.tsx               — schedule panel UI
packages/web/src/schedules/roomFinishScheduleEvidenceReadout.ts — room finish schedule
```

Tests: co-located `*.test.ts` — run `pnpm test --filter @bim-ai/web`.
Prettier runs automatically after every Edit/Write.
**Shared-file rule**: before editing `toolGrammar.ts`, `toolRegistry.ts`, `core/index.ts`, or
`PlanCanvas.tsx`, run `git pull --rebase origin main` first.

---

## What already exists — DO NOT rebuild

Read ALL of these before writing anything:

- `roomArea.ts` — find `roomNetAreaM2`. Read its signature: it takes a room element and a list of hosted/overlapping elements (walls/columns). Understand the return value.
- `InspectorContent.tsx` — find `case 'room':`. Find the area display field. Note whether net area is already shown. If it is, skip task A and add only what's missing.
- `scheduleDefinitionPresets.ts` — read the full file. Find the `SchedulePreset` type and how presets are structured (category, columns, label). Find the list of exported presets. Confirm there is no furniture/component preset yet.
- `SchedulePanel.tsx` — read how presets are selected and rendered. Understand how element filtering by `kind` works.
- `roomFinishScheduleEvidenceReadout.ts` — read what it computes (room finish materials, areas per finish type). Note if net area is already included.

---

## Tasks

### A — Net area display in room inspector

In `InspectorContent.tsx`, `case 'room':`:

1. Check if "Net Area" is already shown. If not, add it.
2. To compute net area, call `roomNetAreaM2(roomEl, wallElements, columnElements)` from `roomArea.ts`, where `wallElements` and `columnElements` are filtered from `elementsById` by kind.
3. Render:

```tsx
<div className="flex items-center gap-2 py-0.5" data-testid="inspector-room-net-area">
  <span className="text-xs text-muted w-28 shrink-0">Net Area</span>
  <span className="text-xs">{netAreaM2.toFixed(2)} m²</span>
</div>
```

4. Also display gross area if not already shown: `data-testid="inspector-room-gross-area"`.

Note: `elementsById` must be accessible in InspectorContent. Read how other inspector cases access the full element map (e.g. for type selectors). Use the same pattern.

### B — Furniture / component schedule preset

In `scheduleDefinitionPresets.ts`, add a new preset:

```ts
{
  id: 'furniture',
  label: 'Furniture & Components',
  category: 'component',  // or whichever kind string matches placed furniture/component elements
  description: 'List all placed furniture and component elements with type, level, and location.',
  columns: [
    { fieldKey: 'name', label: 'Name', token: 'required' },
    { fieldKey: 'typeName', label: 'Type', token: 'optional' },
    { fieldKey: 'levelId', label: 'Level', token: 'optional', resolver: 'levelName' },
    { fieldKey: 'widthMm', label: 'Width (mm)', token: 'optional', unitHint: 'mm' },
    { fieldKey: 'depthMm', label: 'Depth (mm)', token: 'optional', unitHint: 'mm' },
    { fieldKey: 'heightMm', label: 'Height (mm)', token: 'optional', unitHint: 'mm' },
    { fieldKey: 'count', label: 'Count', token: 'optional', aggregation: 'count' },
  ],
}
```

Read the existing preset structure carefully and match the exact field shape. If `category` must be a ScheduleCategory enum value, use the one that corresponds to components/furniture.

### C — Room finish schedule: add net area column

In `roomFinishScheduleEvidenceReadout.ts`, if the room finish schedule rows don't already include a `netAreaM2` field, add it:

- Call `roomNetAreaM2` for each room and include the result as `netAreaM2` in each row.
- In the schedule panel rendering (or via the column definition), label this column "Net Area (m²)".

### D — Tests

`packages/web/src/workspace/inspector/roomNetAreaInspector.test.tsx`:

```ts
describe('room net area inspector — §13.1.4', () => {
  it('renders inspector-room-net-area with computed value', () => { ... });
  it('renders inspector-room-gross-area', () => { ... });
  it('net area is less than or equal to gross area', () => { ... });
});
```

`packages/web/src/schedules/furnitureSchedulePreset.test.ts`:

```ts
describe('furniture schedule preset — §13.3.1', () => {
  it('furniture preset exists in schedule definition presets', () => { ... });
  it('furniture preset category matches component element kind', () => { ... });
  it('furniture preset has name, type, level, count columns', () => { ... });
});
```

---

## Commit and push

After tests pass (`pnpm test --filter @bim-ai/web`):

```
git add -p
git commit -m "feat(wave14/F): room net area inspector + furniture schedule preset (§13.1.4 + §13.3.1)"
git push origin main
```

## Success criterion

`pnpm test --filter @bim-ai/web` — all tests pass including the new ones.
