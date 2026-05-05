# V1 Release Run Book

## Scope statement

The v1 release scope is: **coherent app behavior** (residential semantic kernel, plan views,
schedules, sections/sheets, agent loop, OpenBIM exchange, and validation/advisor subsystems
function end-to-end), **deterministic evidence** (every evidence manifest produces byte-identical
JSON across two identical runs on the same document), **explicit limitations** (all deferred items
are enumerated in `v1LimitationsManifest_v1` and cross-referenced to PRD §16), **focused
validation** (CI gates cover Python lint, unit tests, TypeScript typecheck, front-end unit tests,
prettier formatting, and the evidence-package probe), **clean tracker** (all workpackage rows
reflect current state, the Recent Sprint Ledger is up to date, and no row claims `done` unless it
satisfies the Done Rule), and **clean main** (the `main` branch is green on all CI gates, has no
uncommitted changes, and matches `origin/main`).

## Pre-flight checks

Before running any gate or regenerating evidence, verify that the workspace is in a known-good
state.

1. **Clean working tree.** Run `git status`. The output must show no modified, staged, or untracked
   files. If anything appears, stash or commit it before proceeding.
2. **On `main`.** Run `git branch --show-current` and confirm the output is `main`.
3. **Matching `origin/main`.** Run `git fetch origin` followed by `git log --oneline HEAD..origin/main`
   and `git log --oneline origin/main..HEAD`. Both ranges must be empty, meaning the local branch
   is neither ahead of nor behind the remote.

Only proceed once all three checks pass.

## Running CI gates

The single-entrypoint gate runner is `app/scripts/ci-gate-all.sh`. Invoke it from the repository
root:

```bash
bash app/scripts/ci-gate-all.sh
```

The script runs six gates in fixed order and prints one status line per gate:

| Gate             | Command                                        |
| ---------------- | ---------------------------------------------- |
| `ruff`           | `app/.venv/bin/ruff check bim_ai tests`        |
| `pytest`         | `app/.venv/bin/pytest -x`                      |
| `typecheck`      | `pnpm typecheck` (inside `packages/web`)       |
| `vitest`         | `pnpm exec vitest run` (inside `packages/web`) |
| `prettier`       | `pnpm exec prettier --check .`                 |
| `evidence-probe` | `app/scripts/ci-evidence-package-probe.sh`     |

**Reading per-gate lines.** Each line begins with a color-coded tag:

- `[ok]` — the gate exited 0; no action needed.
- `[fail]` — the gate exited non-zero; the exit code is shown in parentheses. The run terminates
  with exit code 1 after all gates have been evaluated. Investigate the failing gate before
  declaring a release.
- `[warn]` — currently used only for the `prettier` gate, which is treated as non-fatal because the
  tracker markdown file is known to trigger whitespace warnings. All other gates must be `[ok]` for
  the run to succeed.

After the per-gate lines the script prints an aggregate verdict: `All gates passed` (exit 0) or
`FAILED gates: <list>` (exit 1).

The `evidence-probe` gate is a no-op in offline CI (it checks for
`BIM_AI_EVIDENCE_PROBE_BASE_URL` and `BIM_AI_EVIDENCE_PROBE_MODEL_ID`; if either is absent it
prints a skip notice and exits 0). To run it against a live instance export those two variables
before invoking the script.

## Regenerating evidence

The evidence package is produced by the FastAPI backend and consumed by the Playwright test suite.
To regenerate it:

1. **Start the stack.**

   ```bash
   make dev
   ```

   Wait until `GET /api/health` returns `200 OK` (default: `http://127.0.0.1:8500/api/health`).

2. **Seed a document.** If no model exists yet, create one and populate it:

   ```bash
   cd app && python scripts/seed.py
   ```

   Note the model `id` printed by the seed script.

3. **Fetch the evidence package.** Replace `<MODEL_ID>` with the id from step 2:

   ```bash
   curl -s http://127.0.0.1:8500/api/models/<MODEL_ID>/evidence-package | python3 -m json.tool
   ```

   The response is a large JSON object. The top-level `semanticDigestSha256` field is the
   canonical digest for this document state.

4. **Verify the digest.** Extract and record `semanticDigestSha256` and
   `semanticDigestPrefix16`. Run the fetch a second time (without changing the document) and
   confirm the digest is byte-identical. A mismatch indicates a non-deterministic emitter; use
   `replayStabilityHarness_v1` (see §Reading v1 manifests) to identify the offending emitter.

5. **Commit Playwright PNG baselines.** If plan-view, sheet, or section screenshots have changed,
   update the committed baselines under `app/tests/fixtures/evidence/` and commit them alongside
   the evidence JSON before pushing. The `ingestChecklist_v1` inside the evidence package lists the
   expected PNG basenames; the committed files must match that list.

6. **Re-run the CI gates** to confirm the regenerated evidence passes the probe and all pytest
   gates.

## Replaying fixtures

Fixture replay proves that the command path is deterministic and that the golden bundle round-trips
without data loss.

**Golden exchange fixture.** The test `app/tests/test_golden_exchange_fixture.py` applies the
committed `app/tests/fixtures/golden_exchange_snapshot.json` bundle to an empty in-memory document
and asserts structural invariants on the resulting snapshot. Run it with:

```bash
cd app && .venv/bin/pytest tests/test_golden_exchange_fixture.py -x -v
```

**One-family bundle round-trip.** The test `app/tests/test_one_family_bundle_roundtrip.py` builds
the reference residential bundle from scratch, serializes it, and applies it again to verify
round-trip fidelity. Run it with:

```bash
cd app && .venv/bin/pytest tests/test_one_family_bundle_roundtrip.py -x -v
```

**Undo/replay constraint test.** The test `app/tests/test_undo_replay_constraint.py` exercises the
undo stack and replay diagnostics path end-to-end. Run it with:

```bash
cd app && .venv/bin/pytest tests/test_undo_replay_constraint.py -x -v
```

**Full suite (recommended before release).** Run the full pytest suite from the `app` directory:

```bash
cd app && .venv/bin/pytest -x
```

## Reading v1 manifests

### `v1AcceptanceProofMatrix_v1`

Defined in `app/bim_ai/v1_acceptance_proof_matrix.py` and emitted by
`build_v1_acceptance_proof_matrix_v1(doc)`. The matrix contains one row per PRD subsystem
(residential semantic kernel, plan views, schedules/families/materials, sections/3D/sheets/export,
agent loop, OpenBIM, validation/advisor, performance/collab). Each row records the seven Done Rule
axes as `present | partial | missing`, a stable `evidenceTokens` list pointing at existing evidence
manifest names, and a per-row digest. The top-level token carries `schemaVersion`, `axisCoverage`
(the fraction of axes that are `present` across all rows), and an overall SHA-256 digest. This is
the primary artifact for deriving the acceptance verdict (see §Acceptance verdict).

### `replayStabilityHarness_v1`

Defined in `app/bim_ai/evidence_replay_determinism_harness.py` and produced by
`run_replay_stability_pass_v1(doc)`. The harness enumerates every evidence emitter registered in
`evidence_manifest.py` via `enumerate_evidence_emitters_v1()`, runs each one twice on the same
in-memory document, JSON-encodes both outputs with sorted keys, and compares SHA-256 digests. Each
emitter row records `{stable: bool, digest: str}`. The aggregate token records `schemaVersion`,
`emitterCount`, `unstableEmitters` (a list of manifest keys that produced different digests between
the two runs), and an overall digest. A v1 release requires `unstableEmitters` to be empty.

### `prdTrackerReconciliationManifest_v1`

Defined in `app/bim_ai/prd_tracker_reconciliation_v1.py` and produced by
`build_prd_tracker_reconciliation_manifest_v1(prd_path, tracker_path)`. The manifest cross-walks
every PRD anchor (§1–§18 sections) against the workpackage tracker rows and emits one
`prdSection -> [workpackageIds]` row per anchor with a `coverage` label: `covered`, `partial`,
`deferred`, or `orphan`. A separate `staleTrackerRows` list identifies tracker rows that reference
no PRD anchor. The manifest is the authoritative record that the tracker and PRD are synchronized;
a v1 release requires no `orphan` anchors and an empty `staleTrackerRows` list.

### `v1LimitationsManifest_v1`

Defined in `app/bim_ai/v1_limitations_manifest.py` and produced by `build_v1_limitations_manifest_v1()`.
This is a pure, document-argument-free builder that returns a deterministic enumeration of every
known v1 limitation: deferred geometry (non-orthogonal joins, true cut solids, layered
extrusions), deferred export (full SVG-to-pixels raster, arbitrary IFC merge), deferred UI
(browser-rendered raster service, fully automated screenshot extraction), and deferred collaboration
(multiplayer conflict semantics, scoped undo). Each limitation row records a stable `limitationId`,
a `prdSection` pointer, a `severity` (`deferred` or `out_of_scope`), and a one-line `description`.
The manifest is the authoritative v1 scope boundary and must be reviewed before each release.

### `crossSurfaceEvidenceAuditManifest_v1`

Defined in `app/bim_ai/cross_surface_evidence_audit_v1.py` and produced by
`build_cross_surface_evidence_audit_manifest_v1(doc, *, agent_review_readout, tracker_row_index)`.
The audit manifest walks every evidence emitter and validates that its output appears on at least
two surfaces: the evidence-package API response, the Agent Review readout, and/or the tracker row
index. Each emitter row records `{manifestKey, presentOnSurfaces: [...], missingFromSurfaces: [...], stable: bool}`.
The aggregate token records `emitterCount`, `fullyCoveredCount`, `partiallyCoveredCount`, and an
overall digest. A clean audit (all emitters fully covered) is a precondition for the acceptance
verdict.

## Known limitations and deferred blockers

The canonical list of v1 limitations lives in `app/bim_ai/v1_limitations_manifest.py`. Every
limitation is cross-referenced to PRD §16 (Non-Goals and Guardrails). Before declaring v1 done,
review the manifest output to confirm that no limitation has been accidentally promoted to a
release requirement and that no new blocker has been added without a matching limitation entry.

Key limitation categories from PRD §16:

- No Revit UI pixel cloning or proprietary behavior replication.
- No second drawing-only source of truth for documentation.
- No RVT native import/export until OpenBIM semantics stabilize.
- No unreviewed AI model mutations outside the command path.
- No full browser-rendered raster service (surrogate only).
- No arbitrary unconstrained IFC merge.

## Tracker and PRD alignment

The authoritative alignment check is provided by `app/bim_ai/prd_tracker_reconciliation_v1.py`.
Invoke `build_prd_tracker_reconciliation_manifest_v1(prd_path, tracker_path)` with
`prd_path = "spec/prd/revit-production-parity-ai-agent-prd.md"` and
`tracker_path = "spec/revit-production-parity-workpackage-tracker.md"` to produce the
`prdTrackerReconciliationManifest_v1` token. Inspect:

- `staleTrackerRows` — must be empty; any row listed here references a PRD anchor that no longer
  exists or has been renumbered.
- Rows with `coverage: orphan` — must be empty; every PRD anchor must have at least one associated
  workpackage.
- Rows with `coverage: deferred` — review against `v1LimitationsManifest_v1` to confirm each
  deferred anchor has a matching limitation entry.

The human-readable tracker is `spec/revit-production-parity-workpackage-tracker.md`. The Recent
Sprint Ledger at the top of that file is the chronological record of all changes merged to `main`.

## Acceptance verdict

The v1 acceptance verdict is derived by aggregating the five manifests above:

1. **Run the CI gate suite** (`bash app/scripts/ci-gate-all.sh`) and confirm exit code 0 with no
   `[fail]` lines.

2. **Check `replayStabilityHarness_v1`.** Confirm `unstableEmitters` is empty. Any non-empty list
   is a hard blocker.

3. **Check `v1AcceptanceProofMatrix_v1`.** Confirm `axisCoverage` meets the agreed threshold and
   that no row has a critical axis in state `missing`. Rows with `partial` axes must be explicitly
   waived via a matching entry in `v1LimitationsManifest_v1`.

4. **Check `crossSurfaceEvidenceAuditManifest_v1`.** Confirm all emitters are fully covered. Any
   emitter with `missingFromSurfaces` must have a matching limitation waiver.

5. **Check `prdTrackerReconciliationManifest_v1`.** Confirm `staleTrackerRows` is empty and no
   anchor has `coverage: orphan`.

6. **Review `v1LimitationsManifest_v1`.** Confirm every deferred item is intentional and
   documented, and that no limitation silently blocks a stated v1 requirement.

If all six checks pass, the release operator may declare v1 accepted, tag the commit, and push the
tag. If any check fails, the failing manifest output identifies the specific emitter, row, or anchor
that needs attention.
