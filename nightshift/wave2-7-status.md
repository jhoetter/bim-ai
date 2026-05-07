# Wave 2 — Agent 7 — End-of-shift status

**Branch.** `wave2-7`
**Theme.** Component catalog (FAM-08) + closed iterative-correction agent loop (AGT-01)
**Status.** Both WPs shipped; tracker marked `done`.

---

## FAM-08 — Component tool + external family catalog

**Modules added**

- `app/bim_ai/family_catalog_format.py` — pydantic schema (`CatalogPayload`,
  `FamilyDefinition`, `FamilyParamDef`, `FamilyDefaultType`,
  `CatalogIndexEntry`) plus `load_catalog_index`, `load_catalog_by_id`,
  `find_family_in_catalog`, `list_catalog_files`. Catalogs live as JSON
  in `app/bim_ai/family_catalogs/`.
- `app/bim_ai/family_catalogs/living-room-furniture.json` — 6 families
  (3-seat sofa, armchair, coffee table, side table, floor lamp, area rug).
- `app/bim_ai/family_catalogs/bathroom-fixtures.json` — toilet, washbasin,
  shower tray, bathtub.
- `app/bim_ai/family_catalogs/kitchen-fixtures.json` — counter, sink,
  oven, fridge.

**Wire / engine plumbing**

- `FamilyTypeElem.catalogSource: FamilyCatalogSource | None` (Python)
  with `{catalogId, familyId, version}` triple; matching alias-camel TS
  field on the `family_type` union member in `packages/core/src/index.ts`;
  state-store reader threads `catalogSource` through.
- `UpsertFamilyTypeCmd.catalogSource: FamilyCatalogSourceCmd | None` —
  the engine handler stamps the provenance onto the produced
  `FamilyTypeElem` so a snapshot round-trip preserves it.
- New routes appended to `app/bim_ai/routes_api.py`:
  - `GET /api/family-catalogs` → `{ catalogs: [{ catalogId, name,
    description, version, thumbnailsBaseUrl, familyCount }] }`
  - `GET /api/family-catalogs/:catalog_id` → full `CatalogPayload`
    (404 on unknown id).

**UI**

- `FamilyLibraryPanel` now exposes "In Project" + "External Catalogs"
  tabs. The external tab fetches the index, lazy-loads each catalog on
  expand, and renders a Place button per family. Clicking Place:
  1. Calls `onPlaceCatalogFamily(placement)` and closes the panel.
  2. The new `Workspace.handlePlaceCatalogFamily` callback issues
     `applyCommandBundle(modelId, [{type:'upsertFamilyType', …,
     catalogSource}])` and stages a pending placement keyed to the
     family's discipline.
- The In Project tab gains a `family-row-<id>-catalog-badge` that shows
  the source catalogId for catalog-loaded family_types.
- A `Components` (discipline `generic`) section was added to the
  in-project list so catalog-loaded families that don't fall under
  doors/windows/etc. surface there.

**Tests**

- `app/tests/test_family_catalog_format.py` — schema validation, three
  bundled fixtures resolved, default-type / family-id consistency,
  `find_family_in_catalog`, invalid-JSON / shape-mismatch error paths.
- `app/tests/test_family_catalog_endpoint.py` — index + single-catalog
  endpoint shape, 404 path, camelCase aliases.
- `packages/web/src/families/FamilyLibraryPanel.externalCatalogs.test.tsx`
  — tab toggle, server-driven catalog list, lazy-load on expand, Place
  payload shape (catalogId/version/family/defaultType), provenance
  badge in the In Project tab, error path on listCatalogs reject.

**Acceptance walk**

Loading the "Living Room Furniture" catalog from the panel into a
project creates a `family_type` element carrying `catalogSource`;
clicking Place on the sofa family stages a placement (the existing
component-placement plumbing in Workspace consumes
`pendingPlacement`); the in-project entry shows the catalog provenance
badge. Endpoint and panel are independently covered by unit tests.

---

## AGT-01 — Closed iterative-correction agent loop

**Modules added**

- `app/bim_ai/agent_loop.py`
  - `AgentIterateRequest` / `AgentIterateResponse` wire types.
  - One-method backend abstraction (`generate_patch(request)`). Backend
    selection via `BIM_AI_AGENT_BACKEND` env var (or per-request
    `backendOverride`).
  - `_backend_test` — deterministic backend that extracts the first
    fenced JSON block from the goal markdown (accepts `commands`,
    `patch`, or a bare list shape).
  - `_backend_claude` — shells out to the `claude` CLI with the goal +
    snapshot + advisories as context and parses the first JSON code
    block from its stdout. Falls back gracefully (clear error) if the
    binary is missing.
  - Progress heuristic helpers (`count_blocking_advisories`,
    `goal_keyword_overlap`, `progress_score`) used by the CLI loop.

**Endpoint**

- `POST /api/models/{model_id}/agent-iterate` (mounted in
  `routes_api.py`). Returns
  `{ patch: Command[], rationale: string, confidence: number, backend }`.
  Honors `BIM_AI_AGENT_BACKEND` and per-request `backendOverride`.

**CLI**

- `bim-ai agent-loop --goal <path|-> --max-iter <n> --evidence-out <dir>
  [--backend <name>]` in `packages/cli/cli.mjs`. Per iteration it
  writes `iter-NN/{snapshot,validate,evidence,patch,dry-run,apply,
  snapshot.after,validate.after,status}.json`. On regression it issues
  `POST /api/models/:id/undo` and stops; on no-progress it stops; on
  empty patch it stops with status `no-patch`.

**Tests**

- `app/tests/test_agent_iterate.py` — test backend determinism (three
  fenced-JSON shapes), unknown-backend rejection, blocking-advisory
  counter, progress heuristic monotonicity, and a TestClient endpoint
  exerciser using the test backend.
- `app/tests/test_cli_agent_loop.py` — three end-to-end CLI runs
  driving a stub HTTP server: progressing convergence (writes the full
  per-iter dump), regression rollback (asserts /undo was hit), and
  empty-patch bail.

**Acceptance walk**

`BIM_AI_AGENT_BACKEND=test bim-ai agent-loop --goal sample-goal.md
--max-iter 3 --evidence-out /tmp/loop` against the stubbed model
converges in one iteration (the goal markdown's JSON block names a
`createLevel`); the per-iteration dump is written to
`/tmp/loop/iter-01/`. Rolling back on regression goes through the
production undo route; the loop exits and writes
`status: regression-rolled-back`.

---

## Verification

- `cd app && python -m pytest tests/ --no-cov -q` → **1258 passed, 7
  skipped**.
- `cd packages/web && pnpm test` → **1766 tests passed in 157 files**.
- `pnpm exec tsc -p packages/web/tsconfig.json --noEmit` → clean.
- `pnpm exec tsc -p packages/core/tsconfig.json --noEmit` → clean.
- `pnpm exec eslint packages/web/src/families/* packages/web/src/state/store.ts
  packages/web/src/workspace/Workspace.tsx --max-warnings 0` → clean.

## Tracker updates

- FAM-08 row → `done`; mermaid node `FAM08` → `done`; FAM-08 detail
  block has a fresh `Status.` paragraph with the closure summary.
- AGT-01 row → `done (wave-2-7)`.

## Files touched (high-level)

- `app/bim_ai/family_catalog_format.py` (new)
- `app/bim_ai/family_catalogs/{living-room-furniture,bathroom-fixtures,
  kitchen-fixtures}.json` (new)
- `app/bim_ai/agent_loop.py` (new)
- `app/bim_ai/elements.py` — `FamilyCatalogSource`, `catalog_source` on
  `FamilyTypeElem`
- `app/bim_ai/commands.py` — `FamilyCatalogSourceCmd`, `catalog_source`
  on `UpsertFamilyTypeCmd`
- `app/bim_ai/engine.py` — wire `catalog_source` through the
  `upsertFamilyType` handler
- `app/bim_ai/routes_api.py` — catalog endpoints + agent-iterate
  endpoint
- `packages/cli/cli.mjs` — `agent-loop` subcommand + helpers
- `packages/core/src/index.ts` — `catalogSource` on the `family_type`
  union member
- `packages/web/src/state/store.ts` — read `catalogSource` from raw
  snapshot rows
- `packages/web/src/families/FamilyLibraryPanel.tsx` — tabs +
  External Catalogs UI + provenance badge
- `packages/web/src/families/FamilyLibraryPanel.externalCatalogs.test.tsx`
  (new)
- `packages/web/src/workspace/Workspace.tsx` —
  `handlePlaceCatalogFamily`
- `app/tests/test_family_catalog_format.py` (new)
- `app/tests/test_family_catalog_endpoint.py` (new)
- `app/tests/test_agent_iterate.py` (new)
- `app/tests/test_cli_agent_loop.py` (new)
- `spec/workpackage-master-tracker.md` — FAM-08 + AGT-01 status

## Notes / follow-ups

- The In Project tab's `Components` section uses placeholder
  placeKind=`door` for the `generic` discipline. A future Component
  placement tool should give `generic` its own placeKind so a
  furniture click can drop a 2D outline + 3D bbox via the next
  available drawing tool. For now the catalog placement issues an
  `upsertFamilyType` and stages `pendingPlacement` keyed to the
  family discipline.
- The `claude` agent backend is intentionally a thin wrapper —
  shelling out keeps API keys out of the server. If the
  internal-platform team prefers an HTTP-direct backend, slot it into
  `_BACKENDS` without touching callers; the abstraction surface is
  one method.
- Pydantic 2.12 emits three benign `UnsupportedFieldAttributeWarning`
  warnings for the `Field(alias=...)` decoration on
  `currentSnapshot`, `currentValidate`, `backendOverride`. The
  aliases still resolve correctly through pydantic's BaseModel path
  (verified by tests). Migrating to `Annotated[…, Field(alias=…)]`
  would silence them but is non-functional.
