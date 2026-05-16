# Wave 5 — WP-A: Attach Top / Base grammar (§8.1.1)

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).
This prompt is self-contained — start here.

---

## Repo orientation

```
packages/core/src/index.ts                               — Element union + command types
packages/web/src/tools/toolGrammar.ts                   — state machines for every tool
packages/web/src/tools/toolRegistry.ts                  — tool definitions + PALETTE_ORDER
packages/web/src/workspace/Workspace.tsx                — command queue / dispatch
packages/web/src/viewport/meshBuilders.ts               — 3D wall mesh builders
```

Tests: co-located `*.test.ts` — run `pnpm test --filter @bim-ai/web`.
Prettier runs automatically after every Edit/Write.
**Shared-file rule**: before editing `toolGrammar.ts`, `toolRegistry.ts`, `core/index.ts`, or
`PlanCanvas.tsx`, run `git pull --rebase origin main` first.

---

## What already exists — DO NOT rebuild

- `'attach'` and `'detach'` ToolIds are **already declared** in `toolRegistry.ts` — grep for them
- Wall elements already have `roofAttachmentId?: string | null` field used by `makeSlopedWallMesh`
- `meshBuilders.ts` already exports `makeSlopedWallMesh` — read it before touching anything

---

## Tasks

### A — toolGrammar.ts: `reduceAttach` state machine

Add a `reduceAttach(state, event)` grammar function for the `'attach'` tool:

```
IDLE → user clicks a wall → state: { kind: 'attach_wall_selected', wallId }
attach_wall_selected → user clicks a roof/floor/ceiling → emit AttachWallTopCmd → IDLE
attach_wall_selected → Escape → IDLE
```

The emitted command type is `attach_wall_top` with `{ wallId, hostId }`.

Similarly add `reduceDetach` for the `'detach'` tool:
```
IDLE → user clicks a wall → emit DetachWallTopCmd({ wallId }) → IDLE
```

### B — core/index.ts: command types

Add to the Command union:
```ts
type AttachWallTopCmd = { type: 'attach_wall_top'; wallId: string; hostId: string; };
type DetachWallTopCmd = { type: 'detach_wall_top'; wallId: string; };
```

### C — Workspace.tsx: command handlers

In the command switch in `Workspace.tsx`, handle `attach_wall_top`:
- Set `roofAttachmentId: cmd.hostId` on the wall element (via `elementsById` patch)

Handle `detach_wall_top`:
- Set `roofAttachmentId: null` on the wall element

### D — Tests

Write `packages/web/src/viewport/attachWallTop.test.ts`:

```ts
describe('attach/detach wall top grammar', () => {
  it('attach_wall_top sets roofAttachmentId on wall', () => { ... });
  it('detach_wall_top clears roofAttachmentId', () => { ... });
  it('reduceAttach: clicking wall then roof emits attach_wall_top command', () => { ... });
  it('reduceDetach: clicking wall emits detach_wall_top command', () => { ... });
});
```

Test by calling the grammar reducer directly and checking emitted commands; also test the command
handler by updating a mock elementsById record.

---

## Success criterion

`pnpm test --filter @bim-ai/web` — all tests pass including the new ones.
