# Wave 6 — WP-B: Steel Connection Tool + Inspector (§9.5.1)

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).
This prompt is self-contained — start here.

---

## Repo orientation

```
packages/core/src/index.ts                               — steel_connection element type + CreateSteelConnectionCmd
packages/web/src/viewport/meshBuilders.ts               — buildSteelConnectionMesh (already implemented)
packages/web/src/viewport/steelConnectionMesh.test.ts   — existing mesh tests (keep passing)
packages/web/src/tools/toolRegistry.ts                  — tool registration
packages/web/src/tools/toolGrammar.ts                   — grammar state machines
packages/web/src/workspace/inspector/InspectorContent.tsx — inspector panels
packages/web/src/plan/planElementMeshBuilders.ts        — plan symbols
```

Tests: co-located `*.test.ts` — run `pnpm test --filter @bim-ai/web`.
Prettier runs automatically after every Edit/Write.
**Shared-file rule**: before editing `toolGrammar.ts`, `toolRegistry.ts`, `core/index.ts`, or
`PlanCanvas.tsx`, run `git pull --rebase origin main` first.

---

## What already exists — DO NOT rebuild

Read these files before writing anything:

- `steel_connection` element type in `core/index.ts` — has `connectionType: 'end_plate'|'bolted_flange'|'shear_tab'`, `hostElementId`, `targetElementId?`, `positionT?`, `plateSizeMm?`, `boltRows?`, `boltCols?`, `boltDiameterMm?`
- `buildSteelConnectionMesh(conn)` in `meshBuilders.ts` — already builds a THREE.Group with plate + bolt meshes; tests at `steelConnectionMesh.test.ts` already pass
- `CreateSteelConnectionCmd` and `UpdateSteelConnectionCmd` in `core/index.ts` — read their exact shapes

---

## Tasks

### A — Tool registration (§9.5.1)

In `toolRegistry.ts`, add:
```ts
'steel-connection': {
  id: 'steel-connection',
  hotkey: 'SC',
  modes: ['plan', '3d'],
  category: 'structural',
}
```

Also add `'steel-connection'` to `TOOL_CAPABILITIES` in `commandCapabilities.ts` with appropriate
`surfaces` (include `'cmd-k'`).

### B — Grammar state machine

In `toolGrammar.ts`, add `SteelConnectionState` and `reduceSteelConnection`:

```ts
type SteelConnectionState =
  | { phase: 'idle' }
  | { phase: 'pick-host'; connectionType: 'end_plate' | 'bolted_flange' | 'shear_tab' }
  | { phase: 'pick-target'; hostElementId: string; connectionType: string };
```

Events:
- `activate` with `connectionType` optional (default `'end_plate'`) → moves to `pick-host`
- `click` with `pickedElementId` in `pick-host` → moves to `pick-target` with `hostElementId`
- `click` with `pickedElementId` in `pick-target` → emits `createSteelConnection` effect,
  returns to `idle`
- `cancel` / `deactivate` → idle

The `createSteelConnection` effect: `{ type: 'createSteelConnection', hostElementId, targetElementId?, connectionType, positionT: 1.0 }`

Wire into `PlanCanvas.tsx` (follow the same pattern as other structural tools — `case 'steel-connection'`: dispatch `click` on canvas click with `pickedBimId` from raycaster, `Escape` dispatches `cancel`).

### C — Plan symbol

In `planElementMeshBuilders.ts` (or `symbology.ts`, whichever has the structural loop), add
`steelConnectionPlanThree(conn)`:
- A small filled circle (radius ~100 mm = 0.1 m) at the connection point
- Color: `#cc3333` (red)
- `userData.bimPickId = conn.id`
- `userData.bimKind = 'steel_connection'`

Position: use `hostElementId` to look up the host beam/column from elementsById; place the circle
at the host element's endpoint (`positionT=1.0` → end). If host not found, place at origin.

Wire into `symbology.ts` `rebuildPlanMeshes` loop (after braces).

### D — Inspector panel

In `InspectorContent.tsx`, detect `el.kind === 'steel_connection'` and render:
- `data-testid="inspector-steel-connection-type"` — `<select>` with `end_plate`, `bolted_flange`, `shear_tab`; on change dispatch `update_element_property` for `connectionType`
- `data-testid="inspector-steel-plate-width"` — number input for `plateSizeMm.width` (mm), default 150
- `data-testid="inspector-steel-plate-height"` — number input for `plateSizeMm.height` (mm), default 200
- `data-testid="inspector-steel-bolt-rows"` — number input for `boltRows`, integer 1–8
- `data-testid="inspector-steel-bolt-cols"` — number input for `boltCols`, integer 1–8
- `data-testid="inspector-steel-bolt-diameter"` — number input for `boltDiameterMm`, default 20

On change dispatch `update_element_property` for each field.

### E — Tests

Write `packages/web/src/viewport/steelConnectionTool.test.ts`:
```ts
describe('steel connection grammar — §9.5.1', () => {
  it('activate transitions from idle to pick-host', () => { ... });
  it('click in pick-host transitions to pick-target with hostElementId', () => { ... });
  it('second click emits createSteelConnection effect', () => { ... });
  it('cancel from pick-host returns to idle', () => { ... });
  it('cancel from pick-target returns to idle', () => { ... });
});
```

Write `packages/web/src/workspace/inspector/steelConnectionInspector.test.tsx`:
```ts
describe('steel connection inspector — §9.5.1', () => {
  it('renders connection type select', () => { ... });
  it('changing type dispatches update_element_property', () => { ... });
  it('bolt rows input exists', () => { ... });
});
```

---

## Success criterion

`pnpm test --filter @bim-ai/web` — all tests pass including the new ones.
