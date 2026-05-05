# Prompt 4 - PRD Tracker Reconciliation Evidence

## Mission

Auto-generate a coverage map that reconciles the PRD requirements against the workpackage tracker so wave-5 closeout can prove every PRD acceptance axis has a tracker home (or is explicitly deferred). The reconciliation surfaces orphan PRD requirements and stale tracker rows in a single deterministic manifest.

## Target Workpackages

- WP-001 Workpackage tracker (reconciliation is a tracker-quality artifact).
- WP-A02 Evidence package API (manifest joins the evidence aggregation surface).

## Scope

- New module `app/bim_ai/prd_tracker_reconciliation_v1.py`:
  - `parse_prd_section_anchors_v1(prd_path) -> list[PrdAnchor]` — pure-string parse of `spec/prd/revit-production-parity-ai-agent-prd.md` headings (`##`, `###`) into a sorted list of `(sectionId, title)`.
  - `parse_tracker_workpackages_v1(tracker_path) -> list[TrackerRow]` — pure-string parse of the `## Current Workpackages` table into ordered rows (`id`, `title`, `state`).
  - `build_prd_tracker_reconciliation_manifest_v1(prd_path, tracker_path) -> dict` — emits a deterministic `prdTrackerReconciliationManifest_v1` token with `schemaVersion`, anchor-to-workpackage rows (`prdSection -> [workpackageIds]` with `coverage: covered | partial | deferred | orphan`), a separate `staleTrackerRows` list for tracker rows that match no PRD anchor, and an aggregate digest.
- The mapping table from PRD section to workpackage IDs is hard-coded inside this module (a single deterministic dict). Closeout, not magic — that mapping is itself the artifact.
- Focused unit test `app/tests/test_prd_tracker_reconciliation_v1.py`:
  - Determinism: two manifest builds produce byte-identical JSON.
  - Asserts every `WP-*` ID in the parsed tracker either appears in the mapping table or shows up under `staleTrackerRows`.
  - Asserts every PRD §5 / §6 / §7 / §8 / §9 / §11 / §12 / §13 / §15 anchor has at least one workpackage assigned (or an explicit `deferred` marker).

## Non-goals

- Do not edit the PRD or the tracker text content as part of this prompt's scope (the tracker ledger update at the end of the prompt is mandatory; that is the only allowed tracker edit).
- Do not change existing evidence emitters or workpackage states.
- No web/UI surface in this prompt.
- Do not auto-generate the mapping; an explicit hand-curated dict in the module is the artifact.

## Validation

- `cd app && .venv/bin/ruff check bim_ai tests`
- `cd app && .venv/bin/pytest tests/test_prd_tracker_reconciliation_v1.py -x -v`

## Tracker And Git

- Update `spec/revit-production-parity-workpackage-tracker.md` with Recent Sprint Ledger and affected rows.
- Create branch `prompt-4-prd-tracker-reconciliation` from `main`.
- Commit and push the branch.
- Do not open a pull request.
