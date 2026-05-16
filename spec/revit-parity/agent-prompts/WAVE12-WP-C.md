# Wave 12 — WP-C: Floor Attach to Roof (Attach Top/Base) (§3.4.1)

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).
This prompt is self-contained — start here.

---

## Repo orientation

```
packages/core/src/index.ts                               — floor element type, roof element type
packages/web/src/workspace/inspector/InspectorContent.tsx — floor inspector panel
packages/web/src/workspace/Workspace.tsx                 — command dispatch
packages/web/src/viewport/meshBuilders.ts                — 3D floor mesh (topFaceMm)
packages/web/src/cmdPalette/defaultCommands.ts           — palette commands
packages/web/src/plan/PlanCanvas.tsx                     — selection state
```

Tests: co-located `*.test.ts` — run `pnpm test --filter @bim-ai/web`.
Prettier runs automatically after every Edit/Write.
**Shared-file rule**: before editing `toolGrammar.ts`, `toolRegistry.ts`, `core/index.ts`, or
`PlanCanvas.tsx`, run `git pull --rebase origin main` first.

---

## What already exists — DO NOT rebuild

Read ALL of these before writing anything:

- `floor` element in `core/index.ts` — find all fields: `baseElevationMm`, `thicknessMm`, `levelId`, `boundaryPointsMm`, `slopeArrowTailMm`/`slopeArrowHeadMm`/`slopePercent` (slope arrow fields). Also look for any `attachedToRoofId` or `topConstraintHostId` field.
- `roof` element in `core/index.ts` — find its geometry fields (`footprintMm`, `pitchDeg`, `baseElevationMm`, `ridgeElevationMm`).
- `InspectorContent.tsx` — find the floor inspector section. Read what inputs already exist (boundary, level, offset). You will add an "Attach to Roof" button here.
- `meshBuilders.ts` — find the floor 3D mesh builder. Understand how `baseElevationMm` and `thicknessMm` set the floor slab position. The top face elevation needs to snap to the roof underside after attach.
- `attachWallTop` in the codebase — find how walls attach to roofs (if implemented). This is the reference pattern for the floor→roof attachment.

---

## Tasks

### A — Core type: floor attachment field

In `core/index.ts`, add to the `floor` element type (if not already present):

```ts
/** When set, the floor's top face is snapped to the underside of this roof element. */
attachedToRoofId?: string | null;

/** Computed or overridden top-face elevation (mm above datum).
 *  Set by the attach command; used by the mesh builder to position the slab. */
topFaceElevationMm?: number | null;
```

Also add the command type:

```ts
export type AttachFloorToRoofCmd = {
  type: 'attach_floor_to_roof';
  floorId: string;
  roofId: string;        // null = detach
};
```

Export `AttachFloorToRoofCmd`.

### B — Attach command handler

In `Workspace.tsx`, add a handler for `attach_floor_to_roof`:

```ts
case 'attach_floor_to_roof': {
  const { floorId, roofId } = cmd as AttachFloorToRoofCmd;
  const roof = elementsById[roofId];
  const floor = elementsById[floorId];
  if (!roof || roof.kind !== 'roof' || !floor || floor.kind !== 'floor') break;

  // Compute the roof underside elevation at the floor's centroid
  // For a flat/shed roof: ridgeElevationMm - thicknessMm (if available) or baseElevationMm
  // Simplification: use roof.baseElevationMm as the underside (correct for flat roofs)
  const roofUndersideElevMm = (roof as any).baseElevationMm ?? 0;

  updateElement(floorId, (el) => ({
    ...el,
    attachedToRoofId: roofId,
    topFaceElevationMm: roofUndersideElevMm,
  }));
  break;
}
```

Read the existing command handler pattern (e.g. `attach_wall_top`) and follow it exactly.

Also handle detach: if `roofId` is an empty string, clear both fields.

### C — 3D mesh: respect topFaceElevationMm

In `meshBuilders.ts`, in the floor mesh builder:
- If `floor.topFaceElevationMm != null`, set the slab top face to that elevation. The slab thickness then extends downward: `baseElevationMm = topFaceElevationMm - thicknessMm`.
- Otherwise use the existing `baseElevationMm` logic.

Keep the change minimal — a single if-check before the geometry is built.

### D — Inspector: Attach/Detach buttons

In `InspectorContent.tsx`, for `el.kind === 'floor'`:

**Attach to Roof** section:
- If `el.attachedToRoofId` is set: show **"Detach from Roof"** button (`data-testid="inspector-floor-detach"`), which dispatches `attach_floor_to_roof` with `roofId: ''`.
- If not attached: show **"Attach to Roof"** button (`data-testid="inspector-floor-attach"`). Clicking it:
  - Looks up all `roof` elements in `elementsById`
  - If exactly one roof exists: auto-attaches to it
  - If multiple roofs: shows a simple `<select>` to pick which roof, then dispatches

Show current attachment status: `"Attached to: {roof.name}"` or `"Not attached"`.

### E — Palette command

In `defaultCommands.ts`:
```ts
registerCommand({
  id: 'modify.attach-floor-to-roof',
  label: 'Attach Floor to Roof',
  keywords: ['attach', 'floor', 'roof', 'top', 'snap'],
  category: 'command',
  isAvailable: (ctx) => ctx.selectedElementIds?.some(id => ctx.elementsById?.[id]?.kind === 'floor') ?? false,
  invoke: (ctx) => ctx.attachFloorToRoof?.(),
});
```

Add `attachFloorToRoof?: () => void` to `PaletteContext` and wire it in `Workspace.tsx`.

### F — Tests

Write `packages/web/src/workspace/inspector/floorAttachRoof.test.tsx`:
```ts
describe('floor attach to roof — §3.4.1', () => {
  it('renders inspector-floor-attach button when not attached', () => { ... });
  it('renders inspector-floor-detach button when attached', () => { ... });
  it('attach button dispatches attach_floor_to_roof', () => { ... });
  it('detach button dispatches attach_floor_to_roof with empty roofId', () => { ... });
});
```

Write `packages/web/src/plan/attachFloorToRoof.test.ts`:
```ts
describe('attachFloorToRoof command handler — §3.4.1', () => {
  it('sets attachedToRoofId on floor element', () => { ... });
  it('sets topFaceElevationMm from roof baseElevationMm', () => { ... });
  it('detach clears attachedToRoofId and topFaceElevationMm', () => { ... });
});
```

---

## Commit and push

After tests pass (`pnpm test --filter @bim-ai/web`):
```
git add -p
git commit -m "feat(wave12/C): floor attach to roof — Attach Top/Base command + inspector (§3.4.1)"
git push origin main
```

## Success criterion

`pnpm test --filter @bim-ai/web` — all tests pass including the new ones.
