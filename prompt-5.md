# Prompt 5 - V1 Limitations And Deferred Blockers Manifest

## Mission

Make the v1 scope honest by emitting an explicit "not in v1" ledger as a deterministic manifest that names every known limitation, deferred blocker, and explicit non-goal — sourced from the tracker's `deferred` rows, the PRD §16 non-goals, and the standing `WP-X06 RVT bridge` decision. Closeout requires this artifact so v1 release claims cannot be misread as full Revit parity.

## Target Workpackages

- WP-A02 Evidence package API (manifest joins the evidence aggregation surface).
- WP-X06 RVT bridge (the canonical deferred workpackage).

## Scope

- New module `app/bim_ai/v1_limitations_manifest.py`:
  - `build_v1_limitations_manifest_v1() -> dict` — pure, no-doc-arg builder that returns a deterministic `v1LimitationsManifest_v1` token with:
    - `schemaVersion`
    - `deferredWorkpackages: list[{id, title, reason}]` (hard-coded curated list, including `WP-X06`)
    - `nonGoals: list[str]` mirrored verbatim from PRD §16
    - `partialAreas: list[{area, parityRead}]` mirrored from the parity dashboard rows that remain `partial` at v1 closeout
    - `aggregateDigest: str`
  - All content is curated as in-module constants. Do NOT parse the tracker or PRD at runtime here — this manifest is the audited closeout statement and must not silently drift if the tracker is edited.
- Focused unit test `app/tests/test_v1_limitations_manifest.py`:
  - Determinism: two builds produce byte-identical JSON.
  - Asserts `WP-X06` is present in `deferredWorkpackages` with a non-empty reason.
  - Asserts `nonGoals` is non-empty and contains the RVT-native and "second drawing-only source of truth" entries.
  - Asserts the digest is a stable hex string of the expected length.

## Non-goals

- Do not edit PRD §16 or any tracker workpackage state.
- Do not wire this manifest into the web UI in this prompt — Prompt 7 owns cross-surface wiring.
- Do not auto-derive content from the tracker; the curated in-module list is intentional.
- No new schedule/export logic, no new advisor rules.

## Validation

- `cd app && .venv/bin/ruff check bim_ai tests`
- `cd app && .venv/bin/pytest tests/test_v1_limitations_manifest.py -x -v`

## Tracker And Git

- Update `spec/revit-production-parity-workpackage-tracker.md` with Recent Sprint Ledger and affected rows.
- Create branch `prompt-5-v1-limitations-manifest` from `main`.
- Commit and push the branch.
- Do not open a pull request.
