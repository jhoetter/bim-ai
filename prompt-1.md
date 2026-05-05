# Prompt 1 - V1 Acceptance Proof Matrix

## Mission

Produce a single deterministic v1 acceptance proof matrix that rolls up the PRD §15 Done Rule across every relevant subsystem and emits a manifest readout. The matrix is the artifact that proves the v1 closeout claim (per-subsystem: command/schema, engine/API, snapshot/export, web hydrate, summary/schedule/validation, CLI/fixture replay, golden/e2e/unit evidence). This is closeout work, not new feature deepening.

## Target Workpackages

- WP-A01 Golden reference command bundle (matrix anchors against PRD §15 done-rule axes).
- WP-A02 Evidence package API (manifest is emitted alongside existing evidence package artifacts).
- WP-001 Workpackage tracker (matrix output cross-references current workpackage state).

## Scope

- New module `app/bim_ai/v1_acceptance_proof_matrix.py`:
  - `build_v1_acceptance_proof_matrix_v1(doc) -> dict` returning a deterministic, key-sorted manifest with one row per relevant subsystem (residential semantic kernel, plan views, schedules/families/materials, sections/3D/sheets/export, agent loop, OpenBIM, validation/advisor, performance/collab).
  - Each row records the seven Done Rule axes as `present | partial | missing` plus a stable `evidenceTokens` list pointing at existing evidence manifest names already emitted by other modules. Do NOT add new evidence emitters; this prompt only aggregates.
  - Emit a top-level `v1AcceptanceProofMatrix_v1` token with `schemaVersion`, `axisCoverage`, and a digest.
- Wire the manifest into the existing evidence manifest aggregation surface (`app/bim_ai/evidence_manifest.py`) by adding the new key alongside other manifests; do not rename or alter existing keys.
- Focused unit test `app/tests/test_v1_acceptance_proof_matrix.py`:
  - Determinism: two builds on the same doc produce byte-identical JSON.
  - Schema shape: every subsystem row contains the seven axes with one of the three allowed states.
  - At least one explicit assertion that the matrix appears under the expected key in the aggregated evidence manifest.

## Non-goals

- No new feature work, no new evidence emitters, no PRD scope changes.
- Do not modify any other `evidence_*.py` modules. Read-only consumption only.
- Do not change tracker workpackage states; this prompt reports, it does not promote.
- No web/UI work in this prompt.

## Validation

- `cd app && .venv/bin/ruff check bim_ai tests`
- `cd app && .venv/bin/pytest tests/test_v1_acceptance_proof_matrix.py -x -v`
- `cd app && .venv/bin/pytest tests/test_evidence_manifest_closure.py -x -v`

## Tracker And Git

- Update `spec/revit-production-parity-workpackage-tracker.md` with Recent Sprint Ledger and affected rows.
- Create branch `prompt-1-v1-acceptance-proof-matrix` from `main`.
- Commit and push the branch.
- Do not open a pull request.
