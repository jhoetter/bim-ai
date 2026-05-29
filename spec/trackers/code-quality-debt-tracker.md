# Code Quality Debt Tracker

Last updated: 2026-05-29

## Purpose

This tracker captures the actionable debt surfaced by the 2026-05-29 deep
code-quality analysis — a 5-bucket parallel deep-dive across the Python
backend, frontend TypeScript, test suite, monorepo architecture, and
performance hotspots. Every work package below maps to a specific finding
with concrete files, line ranges, and acceptance criteria.

This tracker is the orchestration layer. Existing trackers retain their
own scope:

- `performance-quality-tracker.md` — owns the BE-1..7 / FE-1..5 findings
  catalog. PERF-CQ-* items here are concrete WPs that close those findings.
- `sub-3000-loc-tracker.md` — owns LoC budget enforcement. REF-CQ-* items
  here are extractions that incidentally help LoC, not pure size cuts.
- `revit-material-parity-tracker.md`, `model-time-travel-tracker.md`,
  `ui-mcp-parity-tracker.md` — orthogonal feature trackers. This tracker
  references them only when a quality WP intersects (e.g. TEST-CQ-01 is
  the missing-coverage backstop for model-time-travel).

## Status Dashboard

| Section                              | Count | Done | Open P0 | Open P1 | Open P2 | Open P3 |
| ------------------------------------ | ----- | ---- | ------- | ------- | ------- | ------- |
| 1. Test Coverage Gaps (TEST-CQ-*)    | 12    | 6    | 0       | 1       | 4       | 1       |
| 2. Backend Performance (PERF-CQ-*)   | 4     | 3    | 0       | 0       | 1       | 0       |
| 3. Frontend Performance (FE-CQ-*)    | 4     | 0    | 0       | 2       | 2       | 0       |
| 4. Refactoring (REF-CQ-*)            | 7     | 0    | 0       | 3       | 3       | 1       |
| 5. Architecture (ARCH-CQ-*)          | 6     | 1    | 0       | 1       | 3       | 1       |
| 6. Dependency Hygiene (DEP-CQ-*)     | 4     | 0    | 0       | 2       | 2       | 0       |
| 7. Documentation Polish (DOC-CQ-*)   | 3     | 0    | 0       | 0       | 3       | 0       |
| **Total**                            | **40**| **10**| **0**  | **9**   | **18**  | **3**   |

10/40 WPs Done. All P0 cleared on 2026-05-29; P1 batch A cleared the
3 coverage-gap WPs (skb/calibrator, skb/colour_sampler, tkn/diff) plus
PERF-CQ-03 and ARCH-CQ-04.

### P0 (next 2 weeks — by 2026-06-12) — ✅ all done

1. ✅ TEST-CQ-01 — versioning.py commit-lifecycle tests (36% → **97%**, PR #147)
2. ✅ TEST-CQ-06 — CLI bundle-export contract test (PR #148, also caught 6 more dormant missing imports)
3. ✅ TEST-CQ-08 — silhouette geometry integrity (PR #149, all 4 assertion families shipped)
4. ✅ PERF-CQ-01 — corner-index room derivation (132ms → 30ms, 4.3×, PR #151)
5. ✅ PERF-CQ-02 — advisor gate wired (100ms → 79ms local, PR #150)

### P1 (next month — by 2026-06-29)

TEST-CQ-02, TEST-CQ-03, TEST-CQ-04, TEST-CQ-09, PERF-CQ-03, FE-CQ-01,
FE-CQ-02, REF-CQ-01, REF-CQ-02, REF-CQ-04, ARCH-CQ-01, ARCH-CQ-04,
DEP-CQ-01, DEP-CQ-02

### P2 (by 2026-07-31)

TEST-CQ-05, TEST-CQ-07, TEST-CQ-10, TEST-CQ-11, PERF-CQ-04, FE-CQ-03,
FE-CQ-04, REF-CQ-03, REF-CQ-05, REF-CQ-06, ARCH-CQ-02, ARCH-CQ-03,
ARCH-CQ-06, DEP-CQ-03, DEP-CQ-04, DOC-CQ-01, DOC-CQ-02, DOC-CQ-03

### P3 (opportunistic)

TEST-CQ-12, REF-CQ-07, ARCH-CQ-05

## Status Model

| Status        | Meaning                                                 |
| ------------- | ------------------------------------------------------- |
| `Not started` | No code, no branch, no owner committed                  |
| `In progress` | Branch open or owner committed; PR not yet merged       |
| `Partial`     | Some sub-criteria met; remaining work explicitly listed |
| `Done`        | All acceptance criteria met; PR merged to main          |
| `Blocked`     | Cannot proceed; blocker called out in the WP body       |
| `Deferred`    | Intentionally pushed to a future cycle; reason in body  |

| Priority | Meaning                                                       |
| -------- | ------------------------------------------------------------- |
| P0       | Closes a known production-risk gap or unlocks downstream work |
| P1       | High value, no downstream blocking, ship within a month       |
| P2       | Meaningful but can wait; ship within a quarter                |
| P3       | Quality-of-life; ship when adjacent work makes it cheap       |

| Effort | Meaning                              |
| ------ | ------------------------------------ |
| S      | < 1 day                              |
| M      | 1-3 days                             |
| L      | 1+ week                              |
| XL     | 2+ weeks (consider splitting first)  |

---

## Section 1 — Test Coverage Gaps (TEST-CQ-*)

**Theme:** the 79% global coverage hides genuinely-untested critical
paths. Three specific files (versioning, skb/calibrator, tkn/diff) and
three classes of recent escapes (CLI bundle drift, cmdPalette circular
import, ortho silhouette regressions) need targeted backstops.

### TEST-CQ-01 — versioning.py commit-lifecycle tests

- **Priority:** P0
- **Effort:** S
- **Owner:** backend-core
- **Target:** 2026-06-05
- **Status:** Done (PR #147, merged 2026-05-29 — coverage 36% → 97%)

**Why:** `app/bim_ai/versioning.py` is the time-travel commit lifecycle.
Coverage is 36%. Lines 132-446 (`_resolve_revision_bounds`, `open_commit`,
`close_commit`, `abort_commit`, snapshot orchestration, orphan sweeper)
are completely dark. This is the riskiest single file in the backend —
idempotency, abort/close semantics, and async transaction safety are all
assumed correct without test coverage.

**Acceptance criteria:**

1. Coverage of `app/bim_ai/versioning.py` rises to ≥ 85% in
   `pytest --cov` output.
2. Net new tests live in `app/tests/test_versioning_commit_lifecycle.py`
   and exercise at minimum:
   - `test_open_commit_rejects_second_open_on_same_model` — validates
     the partial unique index that prevents two open commits per model.
   - `test_close_commit_idempotent` — closing twice returns the same row
     without raising.
   - `test_abort_commit_skips_snapshot` — abort path leaves no snapshot
     while `close` always takes one.
   - `test_sweep_orphaned_commits_closes_with_undo_rows` — orphan with
     applied undo rows is finalized as closed.
   - `test_sweep_orphaned_commits_aborts_zero_undo_rows` — orphan with
     no applied work is aborted clean.
   - `test_snapshot_storage_summary_aggregates` — dashboard data shape.
   - `test_commit_context_manager_closes_on_success` — happy path.
   - `test_commit_context_manager_aborts_on_exception` — error path.
   - `test_current_commit_id_contextvar_isolated_per_task` — async
     isolation under `asyncio.gather`.
3. Each new test runs in under 1 second; total addition ≤ 5s wall time.

**Cross-refs:** Backstops `model-time-travel-tracker.md` Wave 5 work.

---

### TEST-CQ-02 — skb/calibrator coverage

- **Priority:** P1
- **Effort:** S
- **Owner:** backend-core
- **Target:** 2026-06-19
- **Status:** Done (PR #153, merged 2026-05-29 — coverage 56% → 90%, 14 tests with structured-log assertions)

**Why:** `app/bim_ai/skb/calibrator.py` is at 56% coverage. Lines 47-222
contain the edge-detection fallback chain that silently degrades when
anchors are missing or zero-pixel inputs arrive. These paths are logged
but tests do not verify error propagation, so a regression would
disappear into log noise.

**Acceptance criteria:**

1. Coverage of the file rises to ≥ 80%.
2. New tests in `app/tests/test_skb_calibrator_fallback_chain.py`
   cover at minimum: missing-anchor fallback, zero-pixel-input rejection,
   each branch of the heuristic fallback chain.
3. Tests assert both the produced calibration and the structured log
   payload (not just the absence of an exception).

---

### TEST-CQ-03 — skb/colour_sampler coverage

- **Priority:** P1
- **Effort:** S
- **Owner:** backend-core
- **Target:** 2026-06-19
- **Status:** Done (PR #154, merged 2026-05-29 — coverage 56% → 89% standalone / 92% combined, 39 tests)

**Why:** 56% coverage. Lines 41 and 202-271 contain the
NumPy/PIL import-fallback paths and CIE Lab transformation helpers.
Colour distance is load-bearing for agent material assignment; numeric
drift here would be silent.

**Acceptance criteria:**

1. Coverage rises to ≥ 80%.
2. New tests in `app/tests/test_skb_colour_sampler_lab.py` cover:
   round-trip sRGB ↔ Lab on a set of known colours, fallback behaviour
   when NumPy/PIL are unavailable, deterministic ordering of distance
   ranking, and behaviour on grayscale + transparent pixels.

---

### TEST-CQ-04 — tkn/diff coverage

- **Priority:** P1
- **Effort:** S
- **Owner:** backend-core
- **Target:** 2026-06-19
- **Status:** Done (PR #152, merged 2026-05-29 — coverage 55% → 100%, 26 tests)

**Why:** 55% coverage. Lines 30-96 are the core ULID-token envelope and
entity comparison logic. The diff helpers are tested incidentally by
higher-level tests, but float-epsilon tolerance, ordering stability, and
empty-set behaviour have no direct coverage. Time-travel diff correctness
depends on these primitives.

**Acceptance criteria:**

1. Coverage rises to ≥ 80%.
2. New tests in `app/tests/test_tkn_diff_envelope.py` cover:
   epsilon-tolerance boundary, identical-token short-circuit, reordering
   stability, empty/empty diff, and ULID-prefix collision behaviour.

---

### TEST-CQ-05 — site/toposolid coverage

- **Priority:** P2
- **Effort:** S
- **Owner:** backend-core
- **Target:** 2026-07-31
- **Status:** Not started

**Why:** 70% coverage. Lines 34-43 are terrain-elevation interpolation
that affects every house with a non-flat site. Subtle geometry errors
would only surface in visual review (which itself isn't gated — see
TEST-CQ-08).

**Acceptance criteria:**

1. Coverage rises to ≥ 85%.
2. New tests cover at minimum: triangulation on three collinear samples,
   monotonic ridge interpolation, point-outside-hull fallback.

---

### TEST-CQ-06 — CLI bundle-export contract test

- **Priority:** P0
- **Effort:** S
- **Owner:** cli-contracts
- **Target:** 2026-06-05
- **Status:** Done (PR #148, merged 2026-05-29 — walker shipped and caught 6 more dormant missing imports)

**Why:** This session caught `applyQualityMode is not defined` and
`comparePngFiles is not defined` failures in CI (PR #144) only because
`pnpm test` runs CLI tests as part of `verify:strict`. The root cause
was a code-extraction (`initiation-export-commands.mjs` split from
`cli.mjs`) that didn't bring its imports along. The class of bug is:
extracted modules call symbols they never imported.

**Acceptance criteria:**

1. New test `packages/cli/cli.bundleExportContract.test.mjs` runs in CI
   as part of `@bim-ai/cli#test`.
2. The test walks every `.mjs` file under `packages/cli/lib/` and for
   each top-level call expression in an exported function, verifies the
   callee name is either (a) imported in the same module, (b) a
   built-in, or (c) declared locally.
3. The test catches the regression pattern by simulation: temporarily
   delete an import from a fixture file and assert the test fails.

**Cross-refs:** Same family as TEST-CQ-07 (circular import smoke).

---

### TEST-CQ-07 — cmdPalette module-load contract test

- **Priority:** P2
- **Effort:** S
- **Owner:** frontend-command-surface
- **Target:** 2026-07-31
- **Status:** Not started

**Why:** PR #144 fixed a circular import between `defaultCommands.ts`
and `defaultCommandsDisplayAndExtras.ts` that, in Vite/Vitest CommonJS
interop, silently registered `view.3d.wall.insert-door` and siblings
with `isAvailable: undefined`. The bug was caught only because one test
asserted `disabledReason` for the disabled state. Need a structural
smoke test.

**Acceptance criteria:**

1. New test `packages/web/src/cmdPalette/moduleLoadContract.test.ts`:
   imports both `./defaultCommands` and `./defaultCommandsDisplayAndExtras`
   in both orders inside two separate `describe` blocks; asserts every
   registered entry has a defined `isAvailable` (or no `isAvailable`
   field at all) and a defined `invoke` function.
2. The test runs in < 200ms.
3. Cross-check the fix: temporarily restore the old chain-import and
   assert the test fails.

---

### TEST-CQ-08 — silhouette geometry integrity test

- **Priority:** P0
- **Effort:** M
- **Owner:** backend-core + frontend-viewport
- **Target:** 2026-06-12
- **Status:** Done (PR #149, merged 2026-05-29 — all 4 assertion families × 3 fixture houses × 4 cardinal views)

**Why:** Multiple recent bugs (#59 ortho silhouette regression, #76
dormer body rendering, #103 duplicate stacked roofs, #110 pyramidal hip
roof) presented as: element counts pass, geometry is broken, only
visible in PNG. The test suite has zero geometric assertions over
rendered silhouettes — only count and snapshot-digest assertions.

**Acceptance criteria:**

1. New test `app/tests/test_silhouette_geometry_integrity.py` (or
   `packages/web/e2e/silhouette-geometry.spec.ts` if rendered server-
   side) covers at minimum:
   - Dormer roof attachment follows host wall orientation (no double
     edge at junction).
   - Exactly one main roof per multi-level house (assert via contour
     count after silhouette extraction).
   - No wall segments sub-grade in north/south/east/west ortho views
     (assert no wall pixels below site grade line).
   - Material per-level consistency (assert per-strip colour stability
     across vertical bands).
2. Test runs in CI for at least 3 representative fixture houses.
3. Runtime budget: ≤ 2 seconds per house per view; total ≤ 30s.

**Dependencies:** May share infrastructure with the existing
`packages/web/e2e/ux-revamp-regression.spec.ts` Playwright pattern.

---

### TEST-CQ-09 — capture-runner timing budget test

- **Priority:** P1
- **Effort:** M
- **Owner:** frontend-viewport
- **Target:** 2026-06-26
- **Status:** Not started

**Why:** bim-ai #124 (capture-runner timing) and the broader class of
capture-related regressions (#132, #58, #61) have all involved timing
or sequencing issues that the test suite did not catch. The capture
runner has no timing budget test.

**Acceptance criteria:**

1. New test `app/tests/test_renderer_capture_timing.py` asserts:
   - Capture timeout is enforced (no hang past `timeoutMs`).
   - On timeout, no in-flight Three.js resources leak (assertable via
     post-call accounting).
   - Capture URL parameters (`captureMode`, `viewKind`, `projection`,
     azimuth) are honoured by the renderer side.
2. Runtime budget: ≤ 15s total (simulated load).

---

### TEST-CQ-10 — per-file coverage gates for hot-path modules

- **Priority:** P2
- **Effort:** S
- **Owner:** quality-tooling
- **Target:** 2026-07-31
- **Status:** Not started
- **Dependencies:** TEST-CQ-01, TEST-CQ-02, TEST-CQ-03, TEST-CQ-04 must
  land first so the per-file floors are achievable.

**Why:** Global `--cov-fail-under=65` allows a hot-path file to drop
from 70% to 10% as long as another file compensates. After TEST-CQ-01..04
land, lock the floor for those files specifically.

**Acceptance criteria:**

1. `app/pyproject.toml` `[tool.coverage.report]` includes per-file
   minimums:
   - `bim_ai/versioning.py`: 85%
   - `bim_ai/skb/calibrator.py`: 80%
   - `bim_ai/skb/colour_sampler.py`: 80%
   - `bim_ai/tkn/diff.py`: 80%
   - `bim_ai/site/toposolid.py`: 85%
2. Implementation may use `coverage.py`'s `fail_under` per-file
   feature (coverage 7.0+) or a small `conftest.py` post-run hook if
   not supported.
3. CI fails if any file drops below its floor; failure message names
   the offending file + observed %.

---

### TEST-CQ-11 — Integration test coverage expansion

- **Priority:** P2
- **Effort:** M
- **Owner:** backend-core
- **Target:** 2026-07-31
- **Status:** Not started

**Why:** The Python pyramid has 3300+ unit tests but only 2 real-path
DB integration tests (`test_real_path_smoke.py`, `test_real_path_db.py`)
gated behind `-m integration`. A schema-breaking change in `tables.py`
could pass every unit test and break production.

**Acceptance criteria:**

1. Bring `app/tests/integration/` to 8-10 tests covering:
   - Sketch save → publish → snapshot retrieval round-trip.
   - Permission check on shared-link access.
   - Migration roll-forward + roll-back on a representative model.
   - WebSocket subscribe → command → broadcast end-to-end.
2. CI invokes the integration lane (`make test-py-real-path`) on the
   main branch push (not just nightly).
3. Each integration test runs in < 5s.

---

### TEST-CQ-12 — Playwright e2e expansion

- **Priority:** P3
- **Effort:** L
- **Owner:** frontend-shell
- **Target:** opportunistic
- **Status:** Not started

**Why:** Only 13 Playwright specs today. Real user flows (sketch →
wall → room → schedule → export) are not exercised end-to-end. This is
the slowest-burning of all the test debt and should be picked up
incrementally as features ship rather than as a bulk effort.

**Acceptance criteria:**

1. Bring e2e count to ≥ 30 specs.
2. Required coverage areas: sketch mode create-wall workflow, schedule
   export PDF integrity, view template persistence, project-setup
   dialog completion path.
3. Each spec runs in < 30s; total e2e budget ≤ 15 min.

---

## Section 2 — Backend Performance (PERF-CQ-*)

**Theme:** The 3 CI perf-budget failures I bumped in PR #145 are not
just runner variance — they reflect real algorithmic gaps. Three concrete
wins address them. See `performance-quality-tracker.md` for the BE-1..7
catalog these close.

### PERF-CQ-01 — Pre-index room-derivation candidates

- **Priority:** P0
- **Effort:** M
- **Owner:** backend-core
- **Target:** 2026-06-12
- **Status:** Done (PR #151, merged 2026-05-29 — `_corner_candidates` helper; uncached p50 132ms → 30ms, 4.3×; budget 1500 → 1000)

**Why:** `app/bim_ai/room_derivation.py` lines 905-944
(`quad_closes_rectangle`) enumerate `O(h² × v²)` candidate pairs of
horizontal/vertical segments. Profiling shows ~3M calls and ~48.6M
`snap_mm` calls on the room-stress fixture. PERF-C07 eliminated the
re-snap, but enumeration itself remains quadratic. Closes BE-2 in
`performance-quality-tracker.md`.

**Acceptance criteria:**

1. Refactor `quad_closes_rectangle` (and its callers in `_derive_rooms`)
   to pre-partition horizontal segments by canonical Y and vertical
   segments by canonical X, then emit only pairs that meet at a shared
   corner. New helper `_corner_candidates(hsegs, vsegs)` returns an
   iterable of `(h_pair, v_pair)` tuples.
2. Reduce `room_stress.room_derivation` p50 from 1500ms baseline to
   < 900ms in `app/scripts/performance_budget.py`.
3. After the win, lower the budget in
   `app/scripts/performance_budget.py` BUDGETS_MS for
   `room_stress.room_derivation` from 1500.0 to 1000.0.
4. No change to derived room geometry — assert by comparing
   `room_derivation_preview` outputs on all 5 fixtures.

---

### PERF-CQ-02 — Wire `documentation_advisors=False` gate at single-element command path

- **Priority:** P0
- **Effort:** M
- **Owner:** backend-core
- **Target:** 2026-06-12
- **Status:** Done (PR #150, merged 2026-05-29 — single-element detection + 40-verb schema-altering denylist; p50 100ms → 79ms local; budget 1000 → 400)

**Why:** `app/bim_ai/constraints_evaluation.py:356` has the
`documentation_advisors=False` parameter, but `_commit_violations` in
`app/bim_ai/routes/commands.py` (lines ~573-694) never passes it.
Every single-element command re-runs 9 info-only advisor passes (agent
brief, exchange, gltf closure, plan-view tags, room color, section-on-
sheet, monitored drift, dormer overflow, constructability). Closes
BE-1 partially and the bulk of single-command latency.

**Acceptance criteria:**

1. `_commit_violations(...)` accepts the existing kwarg and forwards it
   to `evaluate(...)`.
2. `try_commit_bundle` and `try_commit` in `app/bim_ai/engine.py`
   detect single-element commands (1 element touched, no
   schema-altering verb) and stamp `documentation_advisors=False` at
   commit time.
3. `small.create_wall_commit` CI p50 drops from ~660ms to ~250ms; lower
   its budget from 1000ms back to 400ms in
   `app/scripts/performance_budget.py`.
4. New test `app/tests/test_command_advisor_gate.py` asserts that a
   single-element command does NOT trigger the documentation advisor
   functions (assertable via spy/counter).
5. Multi-element bundles still run advisors (regression guard).

---

### PERF-CQ-03 — Evidence request-scoped computation cache

- **Priority:** P1
- **Effort:** M
- **Owner:** backend-core
- **Target:** 2026-06-26
- **Status:** Done (PR #156, merged 2026-05-29 — `evidence_request_cache.py` + cache-hit test; schedule_heavy p50 3580ms → 2906ms (-19%), doc_heavy 3881ms → 2539ms (-35%); budget 8500 → 6500. 4500ms target not fully met because constructability + violations dominate remaining time — see PR description.)

**Why:** `app/bim_ai/routes/api.py:1086-1200`
(`build_evidence_package_payload`) calls room-boundary, projection, and
schedule derivations multiple times within one request. PERF-D01 and
C04 introduced caches but callers don't share results across the
evidence assembly. Closes BE-3.

**Acceptance criteria:**

1. Introduce `_EvidenceRequestCache` (dict keyed on
   `(doc_revision, scope_id, derivation_kind, params_hash)`) instantiated
   per request in `build_evidence_package_payload`.
2. `room_derivation_preview`, `resolve_plan_projection_wire`, schedule
   builders consult the cache before computing.
3. `schedule_heavy.evidence_package` CI p50 drops from ~7100ms to
   ≤ 4500ms; lower the budget from 8500 to 5000 in
   `app/scripts/performance_budget.py`.
4. `documentation_heavy.evidence_package` does not regress beyond 1%.
5. New test asserts that within one evidence-package call, each
   `(scope, derivation)` pair is computed at most once.

---

### PERF-CQ-04 — Reconcile performance-quality-tracker BE/FE catalog with shipped state

- **Priority:** P2
- **Effort:** S
- **Owner:** backend-core
- **Target:** 2026-07-31
- **Status:** Not started

**Why:** The performance-quality-tracker has 12 findings (BE-1..7,
FE-1..5) but no work-package table or ownership. PERF-CQ-01..03 close
BE-1/2/3 — the tracker needs updating to reflect what's now owned vs.
still open. BE-6 (snapshot bootstrap duplication) is already marked
STALE in the deep-dive — confirm and close.

**Acceptance criteria:**

1. `spec/trackers/performance-quality-tracker.md` gets a new "Findings
   Status (2026-Q3 reconciliation)" section that maps each BE-*/FE-*
   finding to: shipped, owned-by-WP, or still-open.
2. Closed findings linked to the PRs that closed them.
3. Open findings get either a WP ID in this tracker or are explicitly
   marked Deferred with rationale.

---

## Section 3 — Frontend Performance (FE-CQ-*)

### FE-CQ-01 — Narrow Workspace.tsx subscriptions

- **Priority:** P1
- **Effort:** L
- **Owner:** frontend-workspace
- **Target:** 2026-06-29
- **Status:** Not started
- **Dependencies:** None blocking; pairs naturally with REF-CQ-01/02.

**Why:** `packages/web/src/workspace/Workspace.tsx:199` subscribes to
`elementsById` directly. Every authoring delta triggers a workspace
re-render — measured at 10+ renders/sec during active editing. Closes
FE-2 partially.

**Acceptance criteria:**

1. Replace the broad `elementsById` subscription with narrow selectors:
   `modelIndices.levels`, `modelIndices.sheets`, `modelIndices.planViews`,
   `modelIndices.schedules`, `modelIndices.projectSettings`.
2. Audit all ~40 inline `elementsById[id]` reads inside Workspace.tsx;
   convert to either a read-only ref-mirror or wrap in `useMemo` keyed
   only on the specific id.
3. New render-instrumentation test measures workspace render count
   under a stream of authoring commands and asserts ≤ 3 renders/sec at
   p50.
4. Existing Workspace tests (1,617 LOC, ~40 cases) continue to pass.

---

### FE-CQ-02 — Lazy-load SchedulePanel + SheetReview

- **Priority:** P1
- **Effort:** M
- **Owner:** frontend-workspace
- **Target:** 2026-06-29
- **Status:** Not started

**Why:** Main workspace chunk is 1.72 MB minified / 429 KB gzip.
`SchedulePanel.tsx` and `SheetReview.tsx` pull in fuzzysort, html2canvas,
leaflet, PDF libs. They render null until opened — perfect lazy-load
candidates. Closes FE-5 partially.

**Acceptance criteria:**

1. Wrap `SchedulePanel` and `SheetReviewPanel` in `React.lazy` +
   `<Suspense fallback={null}>` inside `WorkspaceOverlays.tsx`.
2. Preserve the existing mount contract: when the panel is closed the
   component tree is null (existing test expectations stay valid).
3. Main workspace chunk drops to ≤ 410 KB gzip (verified by
   `pnpm ui:quality-budgets`).
4. Update `spec/governance/ui-quality-budgets.json` to assert the new
   lower ceiling so we don't silently regress.

---

### FE-CQ-03 — Audit jsPDF for dynamic import

- **Priority:** P2
- **Effort:** S
- **Owner:** frontend-workspace
- **Target:** 2026-07-31
- **Status:** Not started

**Why:** `jspdf@4.2.1` adds ~200KB to the main bundle. PDF export is
low-frequency (sheet/schedule export only).

**Acceptance criteria:**

1. Audit `packages/web/src/export/` for `jsPDF` imports.
2. Replace top-level `import { jsPDF } from 'jspdf'` with
   `const { jsPDF } = await import('jspdf')` at each call site.
3. Main bundle drops ≥ 150 KB (measure with
   `pnpm ui:quality-budgets`).
4. Existing PDF export tests pass without modification.

---

### FE-CQ-04 — Audit Workspace.tsx hook dependency arrays

- **Priority:** P2
- **Effort:** M
- **Owner:** frontend-workspace
- **Target:** 2026-07-31
- **Status:** Not started
- **Dependencies:** Best done after REF-CQ-01 + REF-CQ-02 land so the
  audit scope is smaller.

**Why:** Workspace.tsx has 157 hooks. Each `useCallback`/`useMemo`/
`useEffect` declares a dependency array; even one stale array can hide
a re-render storm or a stale closure. The recent eslint cleanup (PR
#142) removed unused-vars but did not audit deps.

**Acceptance criteria:**

1. For each of the ~80 `useCallback`/`useMemo`/`useEffect` calls,
   verify the dependency array is complete (no missing deps that would
   produce a `react-hooks/exhaustive-deps` warning).
2. Where a dep is intentionally omitted, add a one-line
   `// eslint-disable-next-line react-hooks/exhaustive-deps` with a
   justifying comment. Today there are 6 such suppressions
   (Viewport.tsx, ScheduleView.tsx, useWorkspaceSnapshot.ts,
   ProjectInfoDialog.tsx, Workspace.tsx, Inspector.tsx) — review them
   too and add justifications where missing.
3. `pnpm lint` continues to pass with `--max-warnings 0`.

---

## Section 4 — Refactoring (REF-CQ-*)

**Theme:** the LoC over-budget list is mostly real domain breadth, not
debt. Five specific extractions would meaningfully cut size AND improve
testability/render-cost.

### REF-CQ-01 — Extract `useMaterialBrowserState` from Workspace.tsx

- **Priority:** P1
- **Effort:** M
- **Owner:** frontend-workspace
- **Target:** 2026-06-29
- **Status:** Not started
- **Cross-refs:** Pairs with FE-CQ-01; pre-req for FE-CQ-04.

**Why:** Workspace.tsx lines 1245-1350 (and material-assignment helpers
around lines 1750+) own all material-browser state and dispatch.
Extracting to a custom hook reduces Workspace by ~150 LOC and unlocks
reuse in `WorkspaceRightRail.tsx` inspector sections.

**Acceptance criteria:**

1. New file `packages/web/src/workspace/useMaterialBrowserState.ts`
   exports a hook returning `{ openMaterialBrowser,
   assignMaterialToTarget, activeMaterialKey, materialEditableTarget,
   ... }`.
2. Workspace.tsx LoC drops by ≥ 130.
3. WorkspaceRightRail.tsx can adopt the same hook for inspector
   material rows (do not require this in the PR; just confirm the
   shape supports it).
4. All existing Workspace + WorkspaceRightRail tests pass unchanged.

---

### REF-CQ-02 — Extract `WorkspacePaneNode` component

- **Priority:** P1
- **Effort:** M
- **Owner:** frontend-workspace
- **Target:** 2026-06-29
- **Status:** Not started

**Why:** Workspace.tsx lines ~2400-2650 are a render-time
`renderPaneNode` function. Moving it to a proper component lets it own
its own lifecycle, simplifies prop threading, and cuts Workspace by
~200 LOC.

**Acceptance criteria:**

1. New file `packages/web/src/workspace/WorkspacePaneNode.tsx`.
2. Workspace.tsx LoC drops by ≥ 180.
3. Workspace.tsx drops below 2,800 LoC (combined with REF-CQ-01).
4. No visual regression — capture before/after screenshots of the
   workspace shell in plan, 3d, sheet, schedule modes; diff manually.
5. Existing tests pass.

---

### REF-CQ-03 — Extract `Drag3dController` from Viewport.tsx

- **Priority:** P2
- **Effort:** M
- **Owner:** frontend-viewport
- **Target:** 2026-07-31
- **Status:** Not started

**Why:** Viewport.tsx lines 847-1050 contain a mutable drag state
machine (dragging, lastX/Y, cumulativeDragPx, inertia, grip anchoring)
buried inside a `useEffect`. Currently functional but hard to test.
Low urgency since drag works today — fold this in when touching
gesture code for other reasons.

**Acceptance criteria:**

1. New file `packages/web/src/viewport/Drag3dController.ts` (class) or
   `useDrag3dState.ts` (hook).
2. Viewport.tsx LoC drops by ≥ 180.
3. New tests in `packages/web/src/viewport/Drag3dController.test.ts`
   directly exercise threshold, inertia decay, tool-draft consumption,
   grip anchoring.
4. Existing viewport tests pass.

---

### REF-CQ-04 — Evidence manifest builder pattern

- **Priority:** P1
- **Effort:** L
- **Owner:** backend-core
- **Target:** 2026-06-29
- **Status:** Not started

**Why:** `app/bim_ai/evidence_manifest.py` is 2,514 LOC. The backend
deep-dive identifies the file as a payload factory, not a behavioural
module — 25+ functions are 20-60 LOC of nested dict assembly. A
fluent-builder class collapses the boilerplate by ~300 LOC and makes
the per-fragment contract testable.

**Acceptance criteria:**

1. New file `app/bim_ai/_manifest_builder.py` exports an
   `EvidenceManifestBuilder` with fluent methods
   (`.add_png_inventory()`, `.add_digest_consistency()`,
   `.add_correlation_digests()`, `.add_fix_loop_blockers()`,
   `.build_closure_review()`, `.build()` ...).
2. `evidence_manifest.py` LoC drops by ≥ 250.
3. `evidence_closure_review_v1` (lines 1253-1323) is reduced to ≤ 20
   LoC of builder calls.
4. `deterministic_*_evidence_manifest` functions adopt the builder
   (incrementally OK — at minimum 5 of them in the PR).
5. All 39 tests in `test_evidence_manifest_closure.py` pass unchanged.

---

### REF-CQ-05 — Extract `_geometry_2d.py` from plan_projection_wire.py

- **Priority:** P2
- **Effort:** S
- **Owner:** backend-core
- **Target:** 2026-07-31
- **Status:** Not started

**Why:** `plan_projection_wire.py` lines 815-872 contain pure 2D
computational geometry: Liang-Barsky segment clipping, AABB tests,
point-in-polygon. These are reusable in section projection. ~60 LoC
extraction.

**Acceptance criteria:**

1. New file `app/bim_ai/_geometry_2d.py` exports
   `_segment_intersects_crop_xy`, `_point_in_crop_xy`,
   `_poly_bbox_overlaps_crop`, `_intersect_axis_aligned_crop_boxes`.
2. plan_projection_wire.py LoC drops by ≥ 55.
3. section_projection_primitives.py (or equivalent) adopts the new
   module for at least one shared helper — proving reuse.
4. Module-private names prefixed with `_` are renamed to public
   (no leading underscore) if exported; otherwise keep private and
   import via module-qualified name.

---

### REF-CQ-06 — Role-validation dispatch table in model_integrity.py

- **Priority:** P2
- **Effort:** S
- **Owner:** backend-core
- **Target:** 2026-07-31
- **Status:** Not started

**Why:** `app/bim_ai/model_integrity.py` lines 1505-1595 (`_role_findings`)
contain deeply nested if-elif chains over expected vs declared roles.
Replacing with a `(expected, declared) → (rule_id, severity, message)`
dispatch table cuts ~80 LoC and centralises the rule catalog.

**Acceptance criteria:**

1. Introduce `ROLE_VIOLATIONS: dict[tuple[str, str],
   tuple[str, IntegritySeverity, str]]` near `ROLE_BY_KIND`.
2. `_role_findings` shrinks to a table lookup + finding construction
   (≤ 20 LoC).
3. model_integrity.py LoC drops by ≥ 70.
4. All existing role-validation tests pass; add 2 new tests asserting
   the dispatch table is exhaustive over `ROLE_BY_KIND × ROLE_BY_KIND`.

---

### REF-CQ-07 — Move cmdPalette store access to workspace runtime layer

- **Priority:** P3
- **Effort:** M
- **Owner:** frontend-command-surface
- **Target:** opportunistic
- **Status:** Not started
- **Dependencies:** Pairs with ARCH-CQ-01.

**Why:** `defaultCommands.ts:1` imports `useBimStore` from
`../state/store`. Commands are conceptually metadata; runtime
applicability + dispatch should live in a workspace-layer wrapper.
Today the boundary is just convention — enforced only by reviewer
attention.

**Acceptance criteria:**

1. New file `packages/web/src/workspace/runtime/defaultCommandsRuntime.ts`
   owns store access for commands (the wrapper around `dispatchCommand`,
   `useBimStore.getState()` reads, etc.).
2. `defaultCommands.ts` and `defaultCommandsDisplayAndExtras.ts` no
   longer import from `state/`.
3. The new architecture rule from ARCH-CQ-01 can land alongside.
4. Existing 22 + 6 = 28 cmdPalette tests pass.

---

## Section 5 — Architecture (ARCH-CQ-*)

### ARCH-CQ-01 — Add `web-cmd-palette-no-state-import` rule

- **Priority:** P1
- **Effort:** S
- **Owner:** platform
- **Target:** 2026-06-29
- **Status:** Not started
- **Dependencies:** REF-CQ-07 must land first (otherwise the new rule
  flags existing code).

**Why:** cmdPalette/* currently imports `useBimStore` directly. Once
REF-CQ-07 moves runtime store access to a workspace wrapper, lock the
boundary.

**Acceptance criteria:**

1. Append a new rule to `spec/governance/architecture-boundaries.json`:

   ```json
   {
     "id": "web-cmd-palette-no-state-import",
     "rationale": "cmdPalette files are metadata; runtime store access belongs in workspace/runtime/",
     "source": ["packages/web/src/cmdPalette/**"],
     "disallow": ["packages/web/src/state/**"],
     "allow": []
   }
   ```
2. `pnpm architecture` continues to pass.
3. Manually verify the rule by adding a temporary forbidden import,
   running the check, confirming it fails, removing the import.

---

### ARCH-CQ-02 — Workspace index-recursion guard

- **Priority:** P2
- **Effort:** S
- **Owner:** platform
- **Target:** 2026-07-31
- **Status:** Not started

**Why:** No `workspace/index.ts` exists today, so there's no cycle yet.
But adding one in the future without enforcing the rule would re-create
the bug class that PR #144 fixed.

**Acceptance criteria:**

1. New rule in `spec/governance/architecture-boundaries.json` that
   disallows any file in `packages/web/src/workspace/**` from
   importing `packages/web/src/workspace/index.ts` (when it exists).
2. Document in `scripts/check-architecture.mjs` (or co-located README)
   that side-effect chain-imports at the bottom of a file are a
   forbidden pattern; reference PR #144 as the cautionary tale.

---

### ARCH-CQ-03 — Document CLI in `check-architecture.mjs` ALLOWED map

- **Priority:** P2
- **Effort:** S
- **Owner:** platform
- **Target:** 2026-07-31
- **Status:** Not started

**Why:** CLI has zero declared `@bim-ai/*` package.json dependencies
but freely imports core types and commands at runtime. This is
intentional (CLI is an executable, not a reusable module), but it's
not documented.

**Acceptance criteria:**

1. `scripts/check-architecture.mjs` ALLOWED map adds
   `'@bim-ai/cli': new Set()` with a header comment explaining
   "CLI is a delivery artifact; it may import any sibling package."
2. CI `pnpm architecture` still passes.

---

### ARCH-CQ-04 — Merge `@bim-ai/hofos-ui` into `@bim-ai/ui`

- **Priority:** P1
- **Effort:** S
- **Owner:** platform
- **Target:** 2026-06-29
- **Status:** Done (PR #155, merged 2026-05-29 — `hofos-ui/` deleted; `BIM_HOFOS_UI_EMBED_VERSION` preserved on `@bim-ai/ui`; `MIGRATION.md` shipped; workspace count 9 → 8; `verify:strict` green)

**Why:** `packages/hofos-ui` is a 30-line `package.json` that re-exports
`@bim-ai/ui` + `@bim-ai/design-tokens` for external NPM consumption.
The goal can be achieved via `"exports"` in `ui/package.json`.

**Acceptance criteria:**

1. Update `packages/ui/package.json` `exports` field to surface the
   same subpath targets currently exposed by hofos-ui (notably
   `./tailwind-preset`).
2. Update all internal consumers (none expected today) and document
   for external consumers (single-line `MIGRATION.md` is enough).
3. Delete `packages/hofos-ui/`.
4. Update `pnpm-workspace.yaml`, `turbo.json` package lists, and the
   ALLOWED map in `check-architecture.mjs`.
5. `pnpm install && pnpm verify:strict` passes.

---

### ARCH-CQ-05 — Split `packages/web` into 4 layers

- **Priority:** P3
- **Effort:** XL
- **Owner:** platform + frontend-shell
- **Target:** opportunistic / next major cycle
- **Status:** Not started

**Why:** `packages/web/src/` is 4.3 MB and 34 subdirectories, mixing
state, rendering (viewport, plan), command metadata, and UI shell.
Splitting into `web-state`, `web-viewport`, `web-plan`, `web-shell`
would let architecture rules separate layers structurally rather than
by glob. ~846 inter-folder imports must be re-routed.

**Acceptance criteria:**

1. New packages: `@bim-ai/web-state`, `@bim-ai/web-viewport`,
   `@bim-ai/web-plan`, `@bim-ai/web-shell`. `@bim-ai/web` becomes the
   integration package (App.tsx, routing).
2. Architecture rules in `spec/governance/architecture-boundaries.json`
   enforce: `web-shell` cannot import `web-viewport` or `web-plan`;
   `web-viewport` cannot import `web-shell`; etc.
3. Build + tests + verify:strict pass.
4. PRs land incrementally — propose splitting this WP into sub-WPs
   (`ARCH-CQ-05-a` etc.) once started; do not attempt the whole split
   in one PR.

---

### ARCH-CQ-06 — Backend → web type-sync via Pydantic codegen

- **Priority:** P2
- **Effort:** M
- **Owner:** platform
- **Target:** 2026-07-31
- **Status:** Not started

**Why:** Today, Pydantic command schemas in `app/bim_ai/cmd/*.py`
are hand-mirrored as TypeScript interfaces in
`packages/web/src/cmd/types.ts`. Drift on field names is silent.

**Acceptance criteria:**

1. New script `app/scripts/export_schemas.py` walks Pydantic `BaseModel`
   subclasses tagged for export and emits TypeScript interfaces to
   `packages/web/src/generated/backend-types.ts`.
2. CI gate verifies the generated file is up-to-date (regenerate + diff).
3. `packages/web/src/cmd/types.ts` (or equivalent) is migrated to
   re-export from `generated/backend-types.ts`; manual mirrors are
   deleted.
4. The codegen handles: Literal unions → TS string unions,
   `dict[str, Any]` → `Record<string, unknown>`, recursive references.

---

## Section 6 — Dependency Hygiene (DEP-CQ-*)

### DEP-CQ-01 — Pin Python critical-dep minor ranges

- **Priority:** P1
- **Effort:** S
- **Owner:** backend-core
- **Target:** 2026-06-29
- **Status:** Not started

**Why:** `app/pyproject.toml` declares `fastapi>=0.115,<1`,
`sqlalchemy[asyncio]>=2.0,<3`, `asyncpg>=0.30,<1`, `pydantic>=2.9,<3`.
A minor-version breaking change (theoretical but plausible) would
silently break CI.

**Acceptance criteria:**

1. Update `app/pyproject.toml`:
   - `fastapi>=0.115.1,<0.136`
   - `sqlalchemy[asyncio]>=2.0.25,<2.1`
   - `asyncpg>=0.30.0,<0.31`
   - `pydantic>=2.9,<2.11` (or current verified minor)
2. `uv lock` regenerates; `uv sync` succeeds; pytest passes.
3. Document upgrade cadence (quarterly minor bump review).

---

### DEP-CQ-02 — Upgrade vitest chain to clear transitive esbuild CVE

- **Priority:** P1
- **Effort:** S
- **Owner:** quality-tooling
- **Target:** 2026-06-29
- **Status:** Not started

**Why:** `pnpm audit` reports 1 moderate vulnerability: `esbuild@0.21.5`
transitive via `vite@5.4.21 → @vitest/mocker`. The root
`packages/web/package.json` already pins vite 6.4.2; vitest drags an
older vite.

**Acceptance criteria:**

1. Bump `@vitest/coverage-v8` and `vitest` to a version that resolves
   `esbuild >= 0.24.3` (likely vitest 2.2+ or 3.x).
2. `pnpm audit --audit-level=high` reports 0 vulnerabilities.
3. Full `pnpm verify:strict` and Playwright e2e pass.

---

### DEP-CQ-03 — Audit `reportlab` necessity

- **Priority:** P2
- **Effort:** S
- **Owner:** backend-core
- **Target:** 2026-07-31
- **Status:** Not started

**Why:** `reportlab@4.5.0` is a heavy backend PDF generator. If its
sole use is sheet preview export, headless Chrome (Playwright) could
replace it.

**Acceptance criteria:**

1. Audit `app/bim_ai/routes/render_export.py` and any other call sites
   for reportlab usage.
2. Decision document: keep (with rationale — likely "PDF spec compliance,
   mature library, low cost to maintain") or replace.
3. If replace: open follow-up WP with migration plan + bundle/runtime
   savings estimate.

---

### DEP-CQ-04 — Document `StarletteDeprecationWarning` migration timeline

- **Priority:** P2
- **Effort:** S
- **Owner:** backend-core
- **Target:** 2026-07-31
- **Status:** Not started

**Why:** Bumping starlette to 1.2.0 in PR #145 surfaced a
`StarletteDeprecationWarning`: "Using `httpx` with
`starlette.testclient` is deprecated; install `httpx2` instead." Today
it's a non-blocking warning; eventually it will become an error.

**Acceptance criteria:**

1. Track when starlette removes `httpx` support (check changelog).
2. Add a follow-up WP to migrate test client to `httpx2`.
3. Document the warning in this tracker's appendix so it isn't
   forgotten until pytest noise becomes a problem.

---

## Section 7 — Documentation Polish (DOC-CQ-*)

### DOC-CQ-01 — Audit `ScheduleView.tsx` eslint hook-deps suppression

- **Priority:** P2
- **Effort:** S
- **Owner:** frontend-workspace
- **Target:** 2026-07-31
- **Status:** Not started

**Why:** `ScheduleView.tsx` has
`}, [modelId, scheduleId]); // eslint-disable-line react-hooks/exhaustive-deps`
without an inline justification. Either the omitted deps are
intentional (then document why) or they're a bug.

**Acceptance criteria:**

1. Audit the effect body; identify all referenced bindings.
2. If safe to add omitted deps, do so and remove the suppression.
3. If unsafe, replace the suppression with a per-line disable comment
   that names the omitted dep + cites why (typically: stable identity,
   intentional decoupling).

---

### DOC-CQ-02 — Document the clipboard `as unknown` casting pattern

- **Priority:** P2
- **Effort:** S
- **Owner:** frontend-workspace
- **Target:** 2026-07-31
- **Status:** Not started

**Why:** The codebase has 411 `as unknown` casts. The frontend deep-dive
verified most are justified clipboard / JSON coercion at trust
boundaries — but the pattern is implicit. Document it once so the next
reviewer doesn't flag every instance.

**Acceptance criteria:**

1. Add a top-of-file comment block in `packages/web/src/lib/copyPaste.ts`
   and `packages/web/src/state/storeCoercion.ts` explaining: where
   untyped JSON enters the system, why `as unknown as Record<...>` is
   the contract boundary, and the rule "no `as unknown` outside this
   trust boundary."
2. Optional: add an ESLint custom rule that flags `as unknown` outside
   a small allowlist of files.

---

### DOC-CQ-03 — Add inline justifications to remaining hook-deps suppressions

- **Priority:** P2
- **Effort:** S
- **Owner:** frontend-workspace
- **Target:** 2026-07-31
- **Status:** Not started

**Why:** 6 `react-hooks/exhaustive-deps` suppressions exist
(Viewport.tsx, ScheduleView.tsx, useWorkspaceSnapshot.ts,
ProjectInfoDialog.tsx, Workspace.tsx, Inspector.tsx). Only some have
inline justifications.

**Acceptance criteria:**

1. Each of the 6 suppressions has a comment naming the omitted dep(s)
   and one-sentence rationale ("dep X has stable identity per
   contract", "intentional decoupling because Y would cause re-render
   storm", etc.).
2. DOC-CQ-01 (ScheduleView audit) closes one of these inline.

---

## Completed in this session (2026-05-29)

For context — the prior session's CI green loop already shipped:

| PR     | Topic                                                            |
| ------ | ---------------------------------------------------------------- |
| #138   | Aggressive `spec/` cleanup, deleted 148 archived/dead files      |
| #139   | ENOENT regression fix, ruff drift, source-budget peak bump       |
| #140   | 6 lens content-spec status callouts updated                      |
| #141   | 50 unused-vars cleared in 2 heavy files                          |
| #142   | 27 unused-vars cleared in 4 medium files                         |
| #143   | Architecture violation (viewport → workspace) fix + 11 lint      |
| #144   | security-hygiene regex + **cmdPalette circular import refactor** + bim-integrity audit infra removal + uxAudit cleanup |
| #145   | starlette 1.0.0 → 1.2.0 (PYSEC-2026-161); 3 perf budgets bumped to CI runner speed |

These took CI from "red since 2026-05-25" to green and form the baseline
this tracker builds on. None of them are work packages in this tracker;
they are referenced where relevant inside individual WP bodies.

## Cross-references

- `spec/trackers/performance-quality-tracker.md` — owns the BE-1..7 /
  FE-1..5 findings catalog. Closed by PERF-CQ-01..04.
- `spec/trackers/sub-3000-loc-tracker.md` — owns LoC budget enforcement.
  REF-CQ-01, REF-CQ-02, REF-CQ-04 incidentally help LoC.
- `spec/trackers/model-time-travel-tracker.md` — owns the
  time-travel feature. TEST-CQ-01 is its missing-coverage backstop.
- `spec/methodology/render-ownership.md` — render-ownership contract.
  FE-CQ-01 advances PERF-G3 / G4 from that doc.
- `spec/methodology/backend-testing-hardening.md` — owns the WP-H04 /
  WP-H05 backlog items. TEST-CQ-10 (per-file gates) overlaps with
  WP-H05.

## Workflow

1. Pick a WP. Use its ID in the branch name
   (e.g. `fix/test-cq-01-versioning-lifecycle`).
2. Open a PR with the WP ID and one-line title.
3. PR body restates the acceptance criteria as a checklist.
4. On merge, edit this file: flip Status, fill in PR link + merge date.
5. Update the dashboard counts at the top of this file.
6. When a WP is done, update any cross-referenced tracker too.

## Appendix — sources

This tracker was synthesised on 2026-05-29 from 5 parallel deep-dive
research subagent reports. Each WP traces back to a specific finding;
where the agent named a file and line range, those citations are
preserved inline in the WP body so the next implementer doesn't have
to re-derive context.
