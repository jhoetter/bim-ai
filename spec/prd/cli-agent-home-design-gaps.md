# PRD — CLI-authored one-family home (gaps & follow-ups)

**Status:** updated after geometry + workflow audit (2026-05-03)  
**Authoritative apply path:** [`scripts/apply-one-family-home.mjs`](../../scripts/apply-one-family-home.mjs)  
**Fixture readme:** [`spec/fixtures/cli-one-family-home.md`](../fixtures/cli-one-family-home.md)  
**Seed model UUID:** `75cd3d5c-f28c-5dd2-b8bf-8cbba71fd10f` (`uuid5(NAMESPACE_URL, "bim-ai:model:demo-main")`)

## Executive summary

Early delivery used a **static JSON** bundle with a frozen `deleteElements` list and **misaligned interior walls** (sleepers stopped short of the hall spine), which made the plan look broken and made replay **fragile**. The hardened path is **`scripts/apply-one-family-home.mjs`**, which derives delete IDs from the live snapshot and uses **T-aligned** sleeper geometry. Verification was re-run via **CLI `validate`** and **in-browser MCP** with layout **Plan + 3D**; Explorer lists the expected rooms/walls/doors.

## Problems observed (what “looked terrible”)

| Issue | Severity | Evidence | Mitigation shipped |
|-------|----------|----------|---------------------|
| Interior walls not meeting spine (“holes” in plan) | High | sleeper `x_end=9350` vs spine CL `9700` in old fixture | Revised coordinates (+ script source of truth) |
| Static `deleteElements` ID drift | High | Engine raises if any id unknown | Snapshot-driven delete in script |
| Welcome modal hides first-run canvas | Medium | MCP snapshot overlay | Doc: dismiss; product: onboarding toggle |
| Default 3D view can look empty before interaction | Medium | Blank viewport until orbit | Added `saveViewpoint` orbit seed |
| Headless PNG without JS wait unreliable | Medium | Gray screenshot previously | MCP browser path documented |

## What we validated (post-fix)

| Step | Command / observation | Expected | Actual |
|------|--------------------------|----------|--------|
| API | `GET /api/health` | 200 OK | OK |
| Contract | `bim-ai schema`, `bim-ai presets` | Returns union schema + preset ids | OK |
| Replay | `node scripts/apply-one-family-home.mjs --dry-run` | `ok: true`, `violations.length === 0` | OK |
| Commit | `node scripts/apply-one-family-home.mjs` | revision bumps, no HTTP error | revision **4**, OK |
| Advisor | `bim-ai validate` | `errorViolationCount === 0` | **0**, `violations: []` |
| Cockpit data | Explorer + schedule context | Rooms/doors/windows listed | MCP snapshot shows Bath, Kitchen, three beds, Living, façade walls |
| Layout | Switch to **Plan + 3D** | Plan + orbit column visible | Plan toolbar + canvas footer present |

### User acceptance criteria (house workflow)

| ID | Criterion |
|----|-----------|
| A1 | One command/tooling entrypoint can wipe **any** seed snapshot and rebuild the reference house **without editing JSON by hand**. |
| A2 | `apply-bundle --dry-run` reports **zero error violations** before commit. |
| A3 | Post-commit Explorer lists ≥ **6 labeled rooms**, **≥6 doors**, **≥4 windows**, façade + spine wall names recognizable. |
| A4 | **Plan + 3D** layout shows plan tooling and a canvas region without blocked UI (welcome dismissed). |

## User impact

- **Agents**: Fragile deletes erode trust (“works on my machine”). Snapshot-driven wipes remove that class of failure until an empty-model API exists.  
- **Designers**: Misaligned CAD-like walls violate expectations; hallway gaps read as tooling bugs, not design intent.

## Gap backlog (prioritized)

### P0 — Agent ergonomics

1. ~~**Empty / template models**~~ — Implemented: **`POST /api/projects/{projectId}/models`** + CLI **`bim-ai init-model`** (revision 1 empty `elements`).

2. ~~**`plan-house` emits executable commands**~~ — Implemented via **`packages/cli/lib/one-family-home-commands.mjs`** (shared with **`scripts/apply-one-family-home.mjs`**) and **`bim-ai plan-house`**.

3. **Stable visual regression** — Baseline cockpit smoke: **`packages/web/e2e/cockpit-smoke.spec.ts`** (`pnpm --filter @bim-ai/web run test:e2e`). Extend with deterministic screenshot compares when tooling stabilizes.

### P1 — Architectural realism

4. Multi-storey stacking, stair macro, slabs, roofs, garages.  
5. Site grid setbacks + property lines in command vocabulary.

### P2 — Intelligence & coordination

6. Topological checks: rooms bounded by wall graph closure; centroid heuristics replaced by egress reachability.  
7. `bim-ai export ifc|gltf|json`, `bim-ai diff`: still stubs.

### P3 — Product polish unrelated to authoring

8. Reduce onboarding friction for seeded demos (defer welcome until idle, deep-link flags). AC: MCP snapshot shows plan pane without overlay on first navigation.

## Suggested roadmap slices

| Slice | Deliverable | Est. leverage |
|-------|--------------|---------------|
| ~~A~~ | ~~Empty-model API & `bim-ai init-model`~~ | shipped |
| ~~B~~ | ~~`plan-house` + **`buildOneFamilyHomeCommands()`** extraction~~ | shipped |
| ~~C~~ | ~~Playwright cockpit smoke~~ | baseline shipped |
| D | Sheets/sections fidelity + richer 3D for slabs/roofs | next |

## Appendix — Commands in reference script

`deleteElements` (dynamic), `createLevel`, `createWall`, `createRoomOutline`, `createDimension`, `insertDoorOnWall`, `insertWindowOnWall`, `saveViewpoint`.

## See also

- [`revit-tutorial-parity-cleanroom-roadmap.md`](./revit-tutorial-parity-cleanroom-roadmap.md) — structured PRD/user-story map from an 11‑video Revit residential workflow (cleanroom-relevant gaps: levels stack, layered walls, void families, schedules/sheets).

## Appendix — Regression reproduction (old fixture)

Older static bundles lived under `spec/fixtures/cli-one-family-home.bundle.json` (removed). Recreation steps for historical debugging:

```bash
# Not supported anymore — use scripts/apply-one-family-home.mjs
```
