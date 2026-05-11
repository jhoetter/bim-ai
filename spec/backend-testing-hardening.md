# Backend Testing Hardening Plan

Last updated: 2026-05-11

Scope: backend reliability for the product path where users create, edit, validate, review, and persist modeled houses. Exchange/import/export coverage is tracked as a secondary risk because it is not the immediate reliability priority.

## Current Signal

The backend suite is broad, but it is not yet a release-quality confidence net.

Latest local command:

```sh
cd app
uv run pytest -q -m 'not integration' --no-cov
```

Observed result before this hardening pass:

```text
2 failed, 2538 passed, 93 skipped, 1 deselected
```

The remaining failures were stale closeout-manifest tests expecting removed one-family bundle gates after the seed-artifact flow replaced those anchors.

Coverage from the full backend run:

```text
TOTAL 30734 statements, 7423 missing, 75.85% covered
```

Observed result after WP-H01 through WP-H03 in this pass:

```text
2533 passed, 93 skipped, 1 deselected, 3 warnings
```

Coverage after WP-H01 through WP-H03:

```text
TOTAL 30304 statements, 7253 missing, 76.07% covered
```

The configured coverage gate is only `--cov-fail-under=65`, which is too low to support a claim that the backend is comprehensively tested.

## Reliability Definition

For modeled houses, "really works" means the backend can repeatedly do all of the following without hidden corruption:

1. Accept a realistic command bundle with assumptions and a matching parent revision.
2. Materialize a house into coherent BIM primitives: levels, walls, floors, roofs, rooms, hosted doors/windows, views, sheets, and schedules.
3. Reject impossible or dangerous geometry before commit.
4. Preserve stable IDs and references across replay, serialization, and validation.
5. Increment revisions predictably and keep the original document immutable on pure operations.
6. Produce useful advisor output for fixable warnings while blocking structurally invalid models.
7. Keep route-layer behavior aligned with the pure engine path.

## High-Priority Gaps

### 1. Real App Route Coverage Is Thin

Many API tests build stub FastAPI apps that mirror route behavior instead of importing the real app, router dependencies, lifespan, and DB wiring. This is useful for fast behavior tests, but it leaves the real deployed surface under-tested.

Risk:

- route registration drift can pass tests
- dependency overrides can differ from production dependencies
- lifespan and websocket setup can break independently
- response serialization can differ from stub route responses

Needed:

- a real-app smoke suite for `/api/health`, `/api/schema`, templates, family catalogs, v3 tools, and selected model operations
- route tests that use the actual `api_router` with controlled dependency overrides
- at least one end-to-end model lifecycle test against the real route stack

### 2. House Modeling Needs Scenario Tests, Not Only Unit Tests

There are many strong focused tests for individual commands and geometry rules. The missing layer is scenario-level confidence that a believable house can be built, validated, serialized, and replayed as one product workflow.

Needed:

- realistic house command bundle smoke test
- mass-to-walls house materialization test with rooms, openings, floors, roofs, and schedules
- invalid-house bundle tests proving rollback/no partial commit
- serialization roundtrip and validation invariants after each major workflow
- deterministic replay assertions for the same command inputs

### 3. Closeout / Traceability Gates Must Track Current Architecture

The repository is moving from old one-family bundle anchors to seed artifacts. Tests and readiness manifests must use one source of truth.

Needed:

- closeout tests asserting `seed_artifact_contract`
- closeout tests asserting `pytest_seed_artifact_roundtrip`
- remove stale expectations for deleted one-family bundle helpers
- keep path-existence gates strict so stale references fail fast

### 4. Route Modules Have Low Coverage

The biggest application-facing modules have low coverage:

```text
bim_ai/routes_api.py        24%
bim_ai/routes_commands.py   22%
bim_ai/routes_exports.py    29%
bim_ai/routes_sketch.py     29%
bim_ai/routes_activity.py   44%
bim_ai/main.py               0%
```

Exchange/export endpoints are lower priority for this phase, but `routes_api.py`, `routes_commands.py`, `routes_sketch.py`, and `routes_activity.py` contain core application workflows and need higher confidence.

Needed:

- real route smoke tests
- failure-path route tests for missing model, stale revision, invalid command, and blocking constraints
- websocket smoke tests using actual `Hub` behavior where practical

### 5. Persistence/DB Confidence Is Limited

The backend defaults to PostgreSQL. Most current tests avoid the real DB path. That is fast, but it means startup, schema creation, SQLAlchemy model mapping, and session dependency behavior can regress without immediate test failures.

Needed:

- one integration lane backed by the dev Postgres service
- migration/schema creation smoke
- create project/model/apply bundle/activity restore smoke
- explicit CI marker so DB integration can be run separately from unit tests

### 6. Skips Hide Optional Capability Risk

Local run skipped 93 tests, mostly because optional IFC/DXF dependencies were absent. Exchange/import is not the highest priority for modeled-house reliability, but skipped tests should be visible in CI reporting.

Needed:

- keep optional exchange/import skips documented
- add a separate optional dependency CI lane when exchange reliability becomes a priority
- ensure skipped optional tests do not mask core house workflow failures

## Workpackages

### WP-H01: Closeout Gate Repair

Goal: make the backend suite green against the current seed-artifact architecture.

Acceptance:

- `app/tests/test_v1_closeout_readiness_manifest.py` no longer expects deleted one-family bundle gates
- focused closeout tests pass
- full backend unit suite has zero failures, excluding documented optional skips

Status: implemented in this pass.

### WP-H02: Core House Reliability Scenario Suite

Goal: prove realistic modeled houses work through the pure backend path.

Acceptance:

- new scenario test builds a house with levels, walls, floor, roof, rooms, hosted openings, sheets/schedules where practical
- validation returns no blocking violations
- serialization roundtrip preserves element kinds and references
- invalid geometry is blocked with no committed partial model

Status: implemented in this pass with `app/tests/test_house_model_reliability.py`.

### WP-H03: Real Route Smoke Coverage

Goal: ensure the actual route stack is alive for application-critical endpoints.

Acceptance:

- tests import the actual router or app rather than route replicas
- health/schema/catalog/tool endpoints respond
- one model command route test exercises dependency overrides against production route handlers

Status: partially implemented in this pass with no-DB real-app smoke coverage for health, schema, templates, family catalogs, and v3 tools. DB-backed model command route coverage remains in WP-H04.

### WP-H04: Persistence Integration Lane

Goal: prove the real database/session lifecycle works when the dev service is available.

Acceptance:

- integration marker remains excluded from standard fast unit tests
- DB-backed smoke can create schema, project, model, bundle commit, and activity row
- failures are explicit when Postgres is unavailable

### WP-H05: Coverage Gate Ratchet

Goal: prevent important backend reliability from drifting backward.

Acceptance:

- raise global floor only after suite is green
- add per-module or per-package floors for core modules if feasible
- exclude or separately gate optional exchange/import modules until prioritized

## Done Criteria For This Phase

This phase is complete when:

- standard backend unit suite is green
- closeout gates match seed-artifact architecture
- modeled-house scenario tests exist and pass
- core route smoke tests cover the real route stack
- this document records remaining lower-priority exchange/import gaps honestly
