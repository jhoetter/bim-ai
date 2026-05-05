# Prompt 7 - Cross Surface Evidence Audit

## Mission

Walk every existing `evidence_*` and `*_evidence_*` manifest emitter and confirm — in a single deterministic audit manifest — that each emitter is reachable from the aggregated evidence package, exposed on the web Agent Review readout, and referenced by at least one tracker row. The audit is the cross-surface proof that v1 evidence is not fragmented.

## Target Workpackages

- WP-A02 Evidence package API.
- WP-A03 Playwright evidence baselines.
- WP-F02 Agent review UI.

## Scope

- New module `app/bim_ai/cross_surface_evidence_audit_v1.py`:
  - `enumerate_evidence_emitters_v1() -> list[EmitterAuditRef]` — sourced from a curated, alphabetized in-module registry of manifest keys produced by existing evidence emitters (do not parse modules at runtime — the curated list is the audit input).
  - `build_cross_surface_evidence_audit_manifest_v1(doc, *, agent_review_readout, tracker_row_index) -> dict` — returns a deterministic `crossSurfaceEvidenceAuditManifest_v1` token where each emitter row records:
    - `aggregatedEvidenceManifestPresent: bool`
    - `agentReviewReadoutPresent: bool`
    - `trackerRowReferencePresent: bool`
    - `coverage: full | partial | missing` derived from the three booleans
  - The `agent_review_readout` and `tracker_row_index` arguments are pure inputs (a dict and a list of strings) provided by the caller — this prompt does not perform I/O.
- Focused unit test `app/tests/test_cross_surface_evidence_audit_v1.py`:
  - Determinism: two manifest builds produce byte-identical JSON for the same inputs.
  - Asserts every curated emitter shows up in the manifest with one of the three coverage states.
  - Asserts the manifest aggregate digest is stable.
  - Includes one negative case where an emitter is absent from the agent review readout and asserts the row reports `partial` or `missing`.

## Non-goals

- Do not modify any existing evidence emitters or the agent review readout module.
- Do not change web/UI code in this prompt.
- Do not parse arbitrary Python modules at runtime; the curated registry is the artifact.
- Do not promote workpackages to `done` based on audit output — audit reports, it does not promote.

## Validation

- `cd app && .venv/bin/ruff check bim_ai tests`
- `cd app && .venv/bin/pytest tests/test_cross_surface_evidence_audit_v1.py -x -v`

## Tracker And Git

- Update `spec/revit-production-parity-workpackage-tracker.md` with Recent Sprint Ledger and affected rows.
- Create branch `prompt-7-cross-surface-evidence-audit` from `main`.
- Commit and push the branch.
- Do not open a pull request.
