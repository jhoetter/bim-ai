# Wave-2 Agent 7 — Component catalog (FAM-08) + Closed agent loop (AGT-01)

You are **Agent 7** of eight wave-2 agents. Theme: **external family catalog + closed iterative-correction agent loop**. Branch `wave2-7`. Two WPs.

---

## 0. Pre-flight

```bash
git worktree add /Users/jhoetter/repos/bim-ai-wave2-7 wave2-7
cd /Users/jhoetter/repos/bim-ai-wave2-7
```

Read `spec/workpackage-master-tracker.md` → P4 → FAM-08; CLI/Agent → AGT-01; `nightshift/wave2-README.md`.

### Concurrent agents

Agent 6 (`wave2-6`) is also working family-system internals. Coordinate via file boundaries: Agent 6 owns family-resolver extensions + clipboard; you own external catalog format + Component placement tool + agent-loop runner.

### Quality gates / branch protocol / tracker / anti-laziness

Same as Agent 1. Branch `wave2-7`. End-of-shift `nightshift/wave2-7-status.md`.

---

## 1. Your assigned workpackages

### 1.1 — FAM-08: Component tool + external family catalog

**Tracker:** P4 → FAM-08 detail block.

**Scope:**

1. **Catalog file format** in `app/bim_ai/family_catalog_format.py`:

   ```python
   {
     "catalogId": str,
     "name": str,
     "version": str,
     "description": str,
     "thumbnailsBaseUrl": str | None,
     "families": [FamilyDefinition, ...],   # same shape as in-project family_type
   }
   ```

   Catalogs live as JSON files at `app/bim_ai/family_catalogs/<catalog-id>.json`. Ship at least three catalogs in v1:
   - `living-room-furniture.json` — sofa, coffee table, lamp, armchair (~6 families)
   - `bathroom-fixtures.json` — toilet, washbasin, shower, bathtub
   - `kitchen-fixtures.json` — counter, sink, oven, fridge

2. **API endpoint** `GET /api/family-catalogs` returns catalog index `[{ catalogId, name, description, thumbnailsBaseUrl, familyCount }, ...]`. `GET /api/family-catalogs/:id` returns full catalog content.

3. **`family_type` element gains `catalogSource`** field:

   ```ts
   {
     // existing family_type fields
     catalogSource?: { catalogId: string; familyId: string; version: string };
   }
   ```

   When a `family_type` is loaded from a catalog, this field is set so the UI can show provenance.

4. **Component tool** in Architecture / Structure / MEP ribbons: a "Component" button opens an extended FL-06 panel (the existing Family Library Browser) with two tabs:
   - "In Project" — existing in-project families
   - "External Catalogs" — fetches from `/api/family-catalogs`, browsable + searchable
   
   Clicking "Place" on an external-catalog family loads the family into the project (creates `family_type` element with `catalogSource`) and starts the component-placement tool.

5. **Tests:**
   - `app/tests/test_family_catalog_endpoint.py` — endpoint returns catalogs
   - `app/tests/test_family_catalog_format.py` — schema validation
   - `packages/web/src/families/FamilyLibraryPanel.externalCatalogs.test.tsx` — UI shows catalogs + Place loads family

**Acceptance.** Loading a sample "Living Room Furniture" catalog from the panel into a project creates `family_type` elements with `catalogSource` provenance; placing a sofa via Component tool puts a sofa in the model; sofa appears in 3D and is selectable; Family Library panel shows the catalog name in the family entry.

**Effort:** 5-6 hours.

---

### 1.2 — AGT-01: Closed iterative-correction agent loop

**Tracker:** CLI/Agent → AGT-01.

**Scope:**

1. New CLI command `bim-ai agent-loop` in `packages/cli/cli.mjs`:

   ```
   bim-ai agent-loop \
     --goal goal.md \           # markdown describing the design intent
     --max-iter 5 \              # max iterations before giving up
     --evidence-out ./out/ \     # where to dump per-iter evidence
   ```

   Each iteration:
   1. Read goal.md
   2. `bim-ai snapshot` → current state
   3. `bim-ai validate` → current advisories
   4. `bim-ai evidence` → counts + checks
   5. **Patch generation** — call out to a model (configurable via `BIM_AI_AGENT_BACKEND` env var; default: shell out to `claude` CLI with the goal + snapshot + advisories as context). Receive a patch bundle (JSON command list).
   6. `bim-ai apply-bundle --dry-run patch.json` → check viability
   7. If clean: `bim-ai apply-bundle patch.json`
   8. Re-evaluate against goal: did the new state move closer? (Heuristic: fewer blocking advisories OR a model-side diff that matches goal keywords)
   9. If progress: continue. If regression / no progress: rollback (apply inverse via the command-log) and stop.

2. **Server-side endpoint** `POST /api/models/:id/agent-iterate` with body `{ goal: string, currentSnapshot, currentValidate, evidence }` → returns `{ patch: Command[], rationale: string, confidence: number }`. Server uses a small backend abstraction to call the configured AI provider.

3. **Telemetry**: each iteration writes to `out/iter-NN/` with snapshot, validate, evidence, patch, rationale, confidence, status.

4. **Test mode (no AI):** when `BIM_AI_AGENT_BACKEND=test`, the patch generator returns a deterministic patch from `goal.md`'s code blocks (so tests don't depend on a real model).

5. **Tests:**
   - `app/tests/test_agent_iterate.py` — endpoint shape + test backend determinism
   - `app/tests/test_cli_agent_loop.py` — CLI wraps the endpoint correctly; rollback on regression

**Acceptance.** With `BIM_AI_AGENT_BACKEND=test` set, running `bim-ai agent-loop --goal sample-goal.md --max-iter 3 --evidence-out /tmp/loop` against an empty model converges to the expected state in ≤3 iterations and writes one evidence subdir per iteration. Rollback path works on regression.

**Effort:** 6-8 hours. The agent-backend abstraction is the largest design surface — keep it small (one method `generatePatch(context) -> patch` with a "test" implementation that reads code blocks out of the goal markdown).

---

## 2. File ownership and conflict avoidance

**You own:**
- `app/bim_ai/family_catalogs/` directory (new, with 3 sample catalogs)
- `app/bim_ai/family_catalog_format.py` (new)
- `app/bim_ai/agent_loop.py` (new)
- `packages/cli/cli.mjs` `agent-loop` subcommand
- The "External Catalogs" tab in `FamilyLibraryPanel.tsx`
- `family_type.catalogSource` field
- New API endpoints

**Shared territory:**
- `core/index.ts`, `elements.py` — minimal additions (catalogSource field)
- `app/bim_ai/routes_api.py` — append your endpoints
- `packages/web/src/families/FamilyLibraryPanel.tsx` — Agent 6 might also touch family-related UI; coordinate via tabs (your tab vs theirs)
- `packages/cli/cli.mjs` — append the `agent-loop` subcommand
- `spec/workpackage-master-tracker.md` — only FAM-08, AGT-01

**Avoid:**
- Family editor internals (Agent 6)
- `app/bim_ai/export_ifc.py` (Agent 8)
- Plan canvas / sketch / grip files (Agents 2, 3, 5)

---

## 3. Go

Spawn worktree. Ship FAM-08 first, then AGT-01.
