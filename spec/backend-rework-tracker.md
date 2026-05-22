# Backend Rework Tracker

Last updated: 2026-05-22

Purpose: lift the Python backend in `app/bim_ai/` from "high-velocity research
codebase with guardrails" to a production-grade service tier. The backend is
already well-tested (~1.5x test:source ratio, 75.85% coverage, `make verify`
chain, ruff configured) but suffers from three structural debts:

1. **Untyped I/O contracts.** REST endpoints accept `dict[str, Any]` bodies and
   ~800 functions return `dict[str, Any]`. Pydantic is imported but bypassed for
   ingress/egress. Validation is hand-rolled with 232 `raise HTTPException`
   sites and 22 defensive `isinstance(..., dict)` checks in `reverse_bim.py`
   alone.
2. **Copy-paste utilities.** `_digest` / `_sha256_json` / `_read_json` /
   `_write_json` are reimplemented in **16 modules**. The same 20-line shape
   travels with every new evidence module.
3. **Flat layout with god files.** 229 modules at the package root, five files
   at or near the 3,000-LOC governance ceiling
   (`commands.py` 2,995, `api/registry.py` 2,946, `elements.py` 2,936,
   `routes_api.py` 2,909, `folder_output.py` 2,851). No `routes/` `services/`
   `models/` `io/` separation.

This tracker is a backend-only complement to
[`spec/god-file-reduction-tracker.md`](god-file-reduction-tracker.md) (which
covers cross-stack LOC budgets) and
[`spec/backend-testing-hardening.md`](backend-testing-hardening.md) (which
covers test-suite reliability). It does **not** duplicate their work packages;
it captures the architecture-level fixes those trackers leave on the table.

## Current Baseline (verified 2026-05-22)

| Signal                                                | Value                              |
| ----------------------------------------------------- | ---------------------------------- |
| Python source LOC under `app/bim_ai/`                 | ~90k                               |
| Modules at package root                               | 229                                |
| Files at or above 2,800 LOC                           | 5                                  |
| `body: dict[str, Any]` FastAPI ingress sites          | 61 in `routes_reverse_bim.py`      |
| Manual `raise HTTPException(...)` sites               | 232                                |
| Modules defining their own `_digest` / `_sha256_json` | 16                                 |
| Defensive `isinstance(x, dict)` in `reverse_bim.py`   | 22                                 |
| Test:source LOC ratio                                 | ~1.5:1                             |
| Coverage floor enforced                               | 65% (actual ~76%)                  |
| Static type enforcement                               | None (no mypy / pyright in CI)     |
| Ruff per-file ignores                                 | 7 modules carry carve-outs         |
| Logging usage                                         | 4 modules import `logging` at all  |
| Subprocess invocation sites                           | 7                                  |
| TODO / FIXME / HACK / XXX in source                   | 4                                  |
| Commit cadence                                        | ~2,900 commits / 6 months, single author |

The toolchain (ruff, uv lockfile + freshness check, `--cov-fail-under=65`,
`make verify`, conventional commits) is already in place. Every work package
below assumes that infrastructure as the floor — the goal is to make the
runtime contracts and module layout match the discipline already visible at
the commit and CI levels.

## Targets

**B+ → A territory** (the analogue to the god-file tracker's A target):

- No FastAPI route accepts `dict[str, Any]` as a request body without a
  Pydantic model behind it. **Exit:** `body: dict[str, Any]` count = 0 in
  `app/bim_ai/routes_*.py`.
- Shared `json_io` and `digest` modules exist; no module redefines `_digest`,
  `_sha256_json`, `_read_json`, or `_write_json` locally.
- No source module above 2,000 LOC; no function above 80 LOC; no function
  with more than 8 parameters.
- `mypy --strict` (or `pyright --strict`) runs in CI on `app/bim_ai/` with
  zero new errors; the baseline-suppression file shrinks each iteration.
- Per-file ruff carve-outs are reduced to zero, or each remaining carve-out
  is documented with an issue ID and an explicit exit condition.

## Operating Rules

- Work in narrow, independently-mergeable slices. Each work package below
  should land as one PR or a short series of PRs, not a long-lived branch.
- Every typed-contract slice must keep the existing JSON wire format byte-
  identical unless a versioned route is being introduced — Pydantic models
  exist to validate, not to change shape.
- Before staging, run `cd app && make verify`. Coverage floor must not drop
  below the prior commit; new typed contracts should be unit-tested at the
  edge (one valid + one invalid body per route, minimum).
- A god-file extraction is "done" when the **source** file is smaller **and**
  the extracted helper has its own focused tests. Mechanical line moves with
  no tests do not count.
- Cross-reference findings via `[[wikilink-style]]` IDs (BRT-NN) so that
  follow-ups in commit messages and other trackers stay traceable.
- Status legend (matches existing trackers):
  `**Pending**`, `**In-progress**`, `**Done**`,
  `**Done with X gap**`, `**Blocked**`, `**Blocked on BRT-NN**`,
  `**Deferred — see <ref>**`.

## Work Packages

### Theme 1 — Typed REST contracts (highest leverage)

Hand-rolled dict validation is the largest single source of defensive churn
downstream. Every dict-shaped endpoint forces every consumer to re-check
shape and types. Closing this theme removes most of the
`isinstance(..., dict)` blocks, most of the `raise HTTPException(422,
"missing X")` lines, and most of the `dict[str, Any]` return-type smell at
the same time.

| ID         | Priority | Status   | Target                                                                              | Exit signal                                                                                                |
| ---------- | -------- | -------- | ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| BRT-01     | P0       | Pending  | Introduce Pydantic request/response models for `routes_reverse_bim.py` (61 sites)   | `grep -c "body: dict\[str, Any\]" app/bim_ai/routes_reverse_bim.py` == 0; route tests use `.model_dump()`. |
| BRT-02     | P0       | Pending  | Same for `routes_api.py` (sweep the 55+ route handlers)                             | Zero `body: dict[str, Any]` in `routes_api.py`; ruff `F401`/`I001` carve-out can be removed alongside.     |
| BRT-03     | P0       | Pending  | Same for `routes_commands.py`, `routes_exports.py`, `routes_activity.py`, `routes_sketch.py` | Zero `body: dict[str, Any]` across all `routes_*.py`.                                                       |
| BRT-04     | P1       | Pending  | Lift response shapes for the highest-traffic endpoints into typed `*Response` models | At least 20 endpoints declare `response_model=` and emit shape-validated JSON.                              |
| BRT-05     | P1       | Pending  | Replace `dict[str, Any]` return types on the reverse-BIM pipeline boundary (`preflight`, `folder_output`, `reader_dispatch`, `hybrid_slice_execute`) | Pipeline entry-points return Pydantic models; downstream `isinstance` guards in [[BRT-21]] drop accordingly. |
| BRT-06     | P2       | Pending  | Add a `RouteError` exception type + global handler to replace ad-hoc `raise HTTPException(422, "missing X")` | `raise HTTPException` count drops below 50; handler emits a consistent error envelope.                      |
| BRT-07     | P2       | Pending  | Generate an OpenAPI schema dump in CI and snapshot-test it                          | `app/tests/contract/test_openapi_snapshot.py` exists; drift is a CI failure.                                |

### Theme 2 — Shared utilities (mechanical, high-value)

The 16-module `_digest` family is the loudest signal that the package has no
common low-level layer. Extracting it is mostly mechanical and unblocks
proper typing — `_digest` typed as `(BaseModel) -> str` is a one-liner;
`_digest(Any)` is not.

| ID         | Priority | Status   | Target                                                                          | Exit signal                                                                                                |
| ---------- | -------- | -------- | ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| BRT-10     | P0       | Pending  | Create `app/bim_ai/_io/json_io.py` with `read_json`, `write_json`, atomic-write | Module exists with `tests/io/test_json_io.py` covering roundtrip + atomicity + error cases.                 |
| BRT-11     | P0       | Pending  | Create `app/bim_ai/_io/digest.py` with `digest(payload)` / `sha256_json(value)` | Module exists with parity tests against the 16 existing implementations to lock in the same byte output.    |
| BRT-12     | P1       | Pending  | Migrate the 16 local `_digest`/`_sha256_json` definitions to the shared module  | `grep -rE "^def (_digest\|_sha256_json)" app/bim_ai/ --include="*.py" \| wc -l` == 0 (excluding `_io/`).     |
| BRT-13     | P1       | Pending  | Migrate the local `_read_json`/`_write_json` definitions to the shared module   | Same grep proves zero local definitions outside `_io/`.                                                     |
| BRT-14     | P2       | Pending  | Extract `_id_token`, `_timestamp_now`, and other ≥3-site helpers to `_io/util.py` | Audit script catalogues remaining cross-module duplicate definitions and the count is ≤3.                   |

### Theme 3 — God-module decomposition

These five files are within 5% of the 3,000-LOC ceiling. The existing
god-file tracker (`spec/god-file-reduction-tracker.md`) carried `registry.py`
through P1 splits; the rest are pure backend and live here. Each work
package is **one cohesive responsibility extraction**, not a line-count
shave.

| ID         | Priority | Status   | Target                                                                                  | Exit signal                                                                                                |
| ---------- | -------- | -------- | --------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| BRT-20     | P0       | Pending  | `folder_output.py:113 build_reverse_bim_folder_output` — 440-LOC function, 17 kwargs    | Function ≤ 120 LOC; each orchestration phase (render / classify / dispatch / consensus / scope / conflicts / frames / terrain / MCP-readiness) is a named callable. |
| BRT-21     | P0       | Pending  | `reverse_bim.py` — 22 defensive `isinstance(x, dict)` guards downstream of [[BRT-05]]   | Guard count ≤ 3; remaining guards each have a `# external_payload` comment naming the un-typed source.      |
| BRT-22     | P1       | Pending  | `commands.py` (2,995 LOC) — split by command-domain (geometry / hosting / schedule / …) | File below 2,000 LOC; new submodules each below 800 LOC with focused tests; dispatcher remains the public surface. |
| BRT-23     | P1       | Pending  | `elements.py` (2,936 LOC) — split by element kind family                                | File below 2,000 LOC; element-kind modules each below 800 LOC; barrel re-exports preserved.                 |
| BRT-24     | P1       | Pending  | `routes_api.py` (2,909 LOC) — finish the extraction sweep visible in commit history     | File below 1,800 LOC; ruff per-file ignore for `routes_api.py` (`B008, E402, I001, F401`) removed.          |
| BRT-25     | P2       | Pending  | `api/registry.py` (2,946 LOC) — descriptor-group split (continuation of GFR-2026-06)    | File below 2,000 LOC; descriptor groups live in `api/registry/*.py` with `registry/__init__.py` barrel.     |
| BRT-26     | P2       | Pending  | `folder_output.py` (2,851 LOC) — after [[BRT-20]], split remaining phase implementations | File below 2,000 LOC; phase modules under `reverse_bim_folder_output/` with isolated unit tests.            |

### Theme 4 — Package layering

229 modules at the package root means "where does this belong" has no
mechanical answer. Introducing four subpackages — `routes/`, `services/`,
`models/`, `_io/` — gives the rest of the tracker a place to put extractions
and makes future PRs easier to review. This work is deliberately late in the
sequence: it should land **after** Theme 1 and Theme 2 have created the
material to move, so the layering reflects real boundaries rather than
aspirational ones.

| ID         | Priority | Status   | Target                                                                                | Exit signal                                                                                                |
| ---------- | -------- | -------- | ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| BRT-30     | P1       | Pending  | Create `app/bim_ai/routes/` subpackage; move all `routes_*.py` modules into it        | Zero `routes_*.py` files at package root; `app.include_router` paths updated; route tests still green.      |
| BRT-31     | P1       | Pending  | Create `app/bim_ai/models/` for the Pydantic request/response models from Theme 1     | All `*Request` / `*Response` classes live under `models/`; routes import them, not vice versa.              |
| BRT-32     | P2       | Pending  | Create `app/bim_ai/services/` for orchestration (the engine, not the route)           | At least 8 high-traffic services moved; `commands.py` and `folder_output.py` import from `services/`.       |
| BRT-33     | P2       | Pending  | Move evidence-pack modules (`*_evidence.py`, `*_parity.py`) under `evidence/`         | Zero `*_evidence.py` files at package root; barrel re-exports preserved for downstream imports.             |
| BRT-34     | P2       | Pending  | Move reverse-BIM modules under `reverse_bim/`                                         | Zero `reverse_bim_*.py` files at package root; existing import paths preserved via `__init__.py` re-exports. |

### Theme 5 — Static type enforcement

Type hints exist throughout the package but no checker runs in CI. Without
enforcement, `dict[str, Any]` keeps creeping back even after Theme 1.

| ID         | Priority | Status   | Target                                                                                | Exit signal                                                                                                |
| ---------- | -------- | -------- | ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| BRT-40     | P0       | Pending  | Add `mypy` (or `pyright`) to `app/pyproject.toml` `[dependency-groups].dev`           | Tool installed; `make verify` invokes it.                                                                  |
| BRT-41     | P0       | Pending  | Establish a baseline-error file so existing errors are suppressed but new ones fail   | `app/mypy-baseline.json` (or equivalent) checked in; CI fails on new errors above baseline.                |
| BRT-42     | P1       | Pending  | Forbid new `dict[str, Any]` return types via a ruff custom rule or grep gate          | A `make check-typed-contracts` target exists and is part of `make verify`; baseline list shrinks each PR.   |
| BRT-43     | P2       | Pending  | Drive baseline-suppression to zero, module by module, P0 areas first                  | `mypy --strict app/bim_ai/routes/` passes; then `services/`; then the rest.                                 |

### Theme 6 — Ruff carve-out cleanup

Seven modules carry per-file ruff ignores; the `routes_api.py` carve-out
(`B008, E402, I001, F401`) is particularly load-bearing — it hides that the
file does work before its FastAPI imports.

| ID         | Priority | Status   | Target                                                                                | Exit signal                                                                                                |
| ---------- | -------- | -------- | ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| BRT-50     | P1       | Pending  | Remove `routes_api.py` carve-out after [[BRT-24]]                                     | `pyproject.toml` `[tool.ruff.lint.per-file-ignores]` no longer references `routes_api.py`.                  |
| BRT-51     | P2       | Pending  | Remove `B008` carve-outs by replacing `Body(default_factory=dict)` with Pydantic models | All five `routes_*.py` carve-outs removed; alongside [[BRT-01]]…[[BRT-03]].                                 |
| BRT-52     | P3       | Pending  | Address remaining carve-outs (`vg/compare.py` `B905`, test carve-out)                 | `[tool.ruff.lint.per-file-ignores]` is empty or each remaining entry has a comment explaining permanence.   |

### Theme 7 — Logging & observability

Only 4 modules import `logging`. The reverse-BIM pipeline is long-running and
error-prone, but failures are surfaced via raised exceptions and dict
payloads rather than structured logs.

| ID         | Priority | Status   | Target                                                                                | Exit signal                                                                                                |
| ---------- | -------- | -------- | ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| BRT-60     | P2       | Pending  | Introduce `app/bim_ai/_io/log.py` with a `get_logger(name)` helper using `structlog` or stdlib `logging` | Module exists; pipeline entry-points use it.                                                               |
| BRT-61     | P2       | Pending  | Add structured logs at each pipeline phase boundary (preflight, dispatch, slice_execute, folder_output) | Each phase emits one structured log per invocation with correlation ID; manual `print`/silent-swallow paths removed (note: source already has 0 `print()` calls). |
| BRT-62     | P3       | Pending  | Wire request-ID middleware so logs cross route → service → IO layers                  | Single request can be traced by `request_id` across logs; test asserts the propagation.                    |

### Theme 8 — Subprocess hygiene

7 subprocess invocation sites. `reverse_bim_reader_dispatch.py` does this
well (typed timeouts, narrow except paths). Other sites should match.

| ID         | Priority | Status   | Target                                                                                | Exit signal                                                                                                |
| ---------- | -------- | -------- | ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| BRT-70     | P2       | Pending  | Audit the 7 `subprocess.run`/`Popen` call sites for timeout, capture, and error class | Audit note added to this tracker; each site either matches the `reverse_bim_reader_dispatch.py` template or has an exception. |
| BRT-71     | P3       | Pending  | Extract a `run_subprocess(cmd, *, timeout, env)` helper                               | Helper exists in `_io/`; ≥5 sites migrated.                                                                |

## Sequencing

```
Theme 2 (utilities)  ──┐
                       ├──► Theme 1 (typed I/O)  ──┐
Theme 5 (type check) ──┘                            ├──► Theme 3 (god files, in priority order BRT-20..26)
                                                    │        │
                                                    │        ▼
                                                    │   Theme 6 (ruff carve-outs)
                                                    ▼
                                              Theme 4 (layering — after material exists to move)

Theme 7 (observability) and Theme 8 (subprocess) can run in parallel any time
after Theme 2 lands.
```

The critical path is **Theme 2 → Theme 1 → BRT-20 → BRT-21**. Until shared
helpers and typed request models exist, every god-file extraction either
moves untyped dicts around (no value) or duplicates utilities (negative
value).

## What This Tracker Does NOT Cover

- **Frontend / cross-stack LOC budgets.** See
  [`spec/god-file-reduction-tracker.md`](god-file-reduction-tracker.md).
- **Backend test-suite reliability / scenario coverage.** See
  [`spec/backend-testing-hardening.md`](backend-testing-hardening.md). New
  tests added under work packages here should follow that doc's conventions
  (real-app routes for new typed contracts, scenario tests for new services).
- **Reverse-BIM methodology / kernel correctness.** See
  [`spec/reverse-bim-actual-methodology-tracker.md`](reverse-bim-actual-methodology-tracker.md)
  and [`spec/hybrid-reverse-bim-methodology-tracker.md`](hybrid-reverse-bim-methodology-tracker.md).
  Pipeline behavior is out of scope; this tracker only touches the surface
  area of those modules where typing or extraction is needed.
- **Performance.** See
  [`spec/performance-quality-tracker.md`](performance-quality-tracker.md).
  Some Theme 3 extractions may incidentally help startup time; that is not
  the goal.

## Exit Criteria for the Whole Tracker

The backend rework is "done" when **all** of the following hold:

1. `grep -rE "body: dict\[str, Any\]" app/bim_ai/routes/ --include="*.py" | wc -l` == 0
2. `grep -rE "^def (_digest|_sha256_json|_read_json|_write_json)" app/bim_ai/ --include="*.py" | grep -v "/_io/" | wc -l` == 0
3. `find app/bim_ai -maxdepth 1 -name "*.py" | wc -l` < 30 (layering complete)
4. No source file above 2,000 LOC (`wc -l app/bim_ai/**/*.py | sort -rn | head` confirms)
5. No function above 80 LOC, no function with > 8 parameters (lint rule enforced)
6. `mypy --strict app/bim_ai/` (or pyright equivalent) passes in CI with an empty baseline
7. `[tool.ruff.lint.per-file-ignores]` table is empty or each remaining entry is documented
8. Coverage floor raised from 65% to at least 80%; actual coverage ≥ 85%
9. This tracker's work-package table shows all rows `**Done**` or
   `**Deferred — see <ref>**` with a written rationale

At that point the backend rates 8+ / 10 on the same axis the 2026-05-22 audit
used to score it at 6.5 / 10.
