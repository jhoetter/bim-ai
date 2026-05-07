# Wave-3 Agent 1 — Federation downstream (FED-02 + FED-03 + FED-04)

You are **Agent 1** of eight wave-3 agents. Your theme is **federation downstream** — building on the FED-01 keystone (load-bearing slice already on main at `b05fc082`). Branch `wave3-1`. Three WPs.

---

## 0. Pre-flight

```bash
cd /Users/jhoetter/repos/bim-ai
git fetch origin --quiet
git worktree add /Users/jhoetter/repos/bim-ai-wave3-1 -b wave3-1 origin/main
cd /Users/jhoetter/repos/bim-ai-wave3-1
```

Read:
- `spec/workpackage-master-tracker.md` → P1 → FED-02, FED-03, FED-04 detail blocks
- `nightshift/wave3-README.md`
- The FED-01 commit `b05fc082` to understand the load-bearing slice you're building on (`link_model` element kind, snapshot expansion via `?expandLinks=true`, read-only enforcement, `ManageLinksDialog`)

### Quality gates / branch protocol / tracker / anti-laziness

Same pattern as prior waves:
- Quality gates: `pnpm exec tsc --noEmit`, `pnpm vitest run` (touched), `cd app && .venv/bin/pytest -q --no-cov tests/<touched>`, `make verify` before merging to main
- Branch: commit on `wave3-1` → push → rebase origin/main → push --force-with-lease → `git push origin wave3-1:main`
- Tracker: update each WP row to `done` (or `partial` with deferred items) with commit hash, in a separate `chore(tracker)` commit per WP
- **Anti-laziness:** push the branch + push to main BEFORE writing the status file. Wave 2's #1 failure mode was finished-but-unpushed work.

End-of-shift status: `nightshift/wave3-1-status.md`.

---

## 1. Your assigned workpackages

Order: FED-02 (smallest of the three) → FED-03 → FED-04.

### 1.1 — FED-02: Cross-link clash detection

**Tracker:** P1 → FED-02 detail block.

**Concrete scope:**

1. Extend `SelectionSetRule` in `packages/core/src/index.ts` (and `app/bim_ai/elements.py`):

   ```ts
   export type SelectionSetRule = {
     field: 'category' | 'level' | 'typeName';
     operator: 'equals' | 'contains';
     value: string;
     linkScope?: 'host' | 'all_links' | { specificLinkId: string };  // default 'host'
   };
   ```

2. **Engine** in `app/bim_ai/engine.py`: the existing clash-test apply path expands selection sets. Extend it to walk through `link_model` elements when `linkScope === 'all_links'` or `specificLinkId`. For each linked element, transform its AABB by the link's `positionMm` + `rotationDeg` before clash-checking against host elements.

3. **`ClashResult` rows** gain `linkChainA: string[]` and `linkChainB: string[]` fields (empty for host elements; otherwise a single-element array `[linkId]`).

4. **UI** in the existing clash-test panel (find via grep for `clash_test` in `packages/web/src/`): Set A / Set B rule editor adds a "Scope" dropdown (Host only / All links / Specific link). Result list shows link chain in element pair labels (e.g. `STR/Beams/B-12 ↔ MEP/Ducts/D-04`). Camera fly-to handles cross-link transforms.

5. **Tests:**
   - `app/tests/test_clash_test_cross_link.py` — host wall + linked structural beam clash detected, link chains populated correctly
   - `packages/web/src/workspace/ClashTestPanel.linkScope.test.tsx` (or similar) — UI flow

**Acceptance.** Loading the demo with a structural-discipline link, configuring clash test "All Architecture walls vs Structure beams", running it, seeing pairs identified with link chains. Clicking a result flies the camera correctly across the link boundary.

**Effort:** 4-5 hours.

---

### 1.2 — FED-03: Cross-link Copy/Monitor

**Tracker:** P1 → FED-03 detail block.

**Concrete scope:**

1. Migrate `monitorSourceId: string` → `monitorSource: { linkId?: string; elementId: string; sourceRevisionAtCopy: number }` (read legacy string as `{ elementId: string }`). Add to `packages/core/src/index.ts` element shape and `app/bim_ai/elements.py`.

2. New command `BumpMonitoredRevisions` in `commands.py` + `engine.py`. Walks all elements with `monitorSource`, looks up the source link's current revision, marks drift if any monitored field differs.

3. **Drift detection.** Configurable list of monitored fields per element kind (start small: for grids, `lineStartMm`/`lineEndMm`/`name`). Drift surfaces as advisory `monitored_source_drift` (warning).

4. **UI:** Inspector "Monitored from" field shows link name + element ID + revision-at-copy. "Reconcile" button: Accept-source (overwrite host fields) or Keep-host (bump revision-at-copy).

5. **Canvas badge:** yellow triangle on the element when source has drifted.

6. **Tests:**
   - `app/tests/test_cross_link_copy_monitor.py` — copy linked grid into host; modify source; reopen host; drift advisory present; accept-source updates host
   - vitest for inspector field display + badge rendering

**Acceptance.** Copy a structural grid line from a linked Structure model into Architecture host; modify the line in the source; reopen the host; see drift badge + advisory; accept-source updates host.

**Effort:** 5-6 hours.

---

### 1.3 — FED-04: IFC / DXF → shadow-model link import

**Tracker:** P1 → FED-04 detail block.

**Reality check:** Full FED-04 is L (3 weeks). Ship the **IFC half** as the load-bearing slice; defer DXF + Revit.

**MUST ship:**

1. **API endpoint** `POST /api/models/:hostId/import-ifc?file=<path>` (or accept multipart upload). Server:
   - Parses the IFC via existing `ifcopenshell` integration
   - Generates the `authoritativeReplay_v0` command bundle (already shipped — `app/bim_ai/export_ifc.py:build_kernel_ifc_authoritative_replay_sketch_v0`)
   - Creates a brand-new bim-ai model in the same DB by calling existing `POST /api/projects/:projectId/models`
   - Applies the replay bundle to that new model
   - Returns `{ linkedModelId, suggestedLinkPosition: { xMm: 0, yMm: 0, zMm: 0 } }`

2. **Auto-create `link_model` element** in the host: after the import, fire `CreateLinkModel` against the host with `sourceModelId: linkedModelId` and the suggested position.

3. **UI:** File menu → Insert → Link IFC. After import completes, focus opens the existing `ManageLinksDialog` (FED-01) with the new entry highlighted.

4. **DXF and Revit:** out of scope for this WP. Add menu entries "Link DXF" / "Link Revit" but disabled with tooltip explaining they're future work.

5. **Tests:**
   - `app/tests/test_ifc_shadow_import.py` — import a small IFC fixture (use seed-export output as the fixture), confirm new bim-ai model created with expected element counts, host has new `link_model` referencing it

**MAY defer (mark in tracker as `partial` if needed):**
- DXF import (separate parser via `ezdxf`, only 2D underlay)
- Revit `.rvt` import (out of scope — wait for OpenBIF / Forge)
- Polished progress reporting during long imports

**Acceptance.** Uploading a small IFC file via the new endpoint creates a new bim-ai shadow model in the same DB and a `link_model` in the host pointing at it. The shadow model contains the IFC's elements via authoritative replay.

**Effort:** 6-8 hours.

---

## 2. File ownership and conflict avoidance

**You own:**
- Cross-link clash extension (engine + clash-test panel)
- Cross-link Copy/Monitor migration + drift detection + reconcile UI
- IFC shadow-model import endpoint + orchestration

**Shared territory (rebase conflicts expected):**
- `core/index.ts`, `elements.py`, `commands.py`, `engine.py` — append additions
- `app/bim_ai/routes_*.py` — append your endpoints
- `spec/workpackage-master-tracker.md` — only FED-02, FED-03, FED-04

**Avoid:**
- `packages/web/src/plan/PlanCanvas.tsx` heavy edits (Agents 2, 3, 4)
- `packages/web/src/viewport/meshBuilders.ts` (Agents 2, 5, 7)
- `packages/web/src/familyEditor/*` (Agent 7)

---

## 3. Go

Spawn worktree, ship FED-02 → FED-03 → FED-04 in order. Push and merge each WP individually before starting the next.
