# Prompt 2 - Deterministic Replay Stability Harness

## Mission

Lock determinism across the full set of evidence manifests by adding a focused replay-stability harness that re-runs every existing evidence emitter twice on the same in-memory document and asserts byte-identical JSON. This proves the v1 determinism claim and prevents silent drift in future changes.

## Target Workpackages

- WP-A02 Evidence package API (determinism is a load-bearing property).
- WP-A03 Playwright evidence baselines (replay determinism backs visual baselines).
- WP-X01 JSON snapshot and command replay.

## Scope

- New module `app/bim_ai/evidence_replay_determinism_harness.py`:
  - `enumerate_evidence_emitters_v1() -> list[EmitterRef]` — a deterministic, alphabetized list of `(manifestKey, callable)` pairs covering the existing evidence manifest emitters (do not invent new ones; discover via the existing aggregation surface in `evidence_manifest.py`).
  - `run_replay_stability_pass_v1(doc) -> dict` — for each emitter, run twice, JSON-encode with sorted keys, compare digests, return a per-emitter `{stable: bool, digest: str}` row plus an aggregate `replayStabilityHarness_v1` token with `schemaVersion`, `emitterCount`, `unstableEmitters`, and overall digest.
  - Pure-Python; no I/O; no fixture writing.
- Focused unit test `app/tests/test_evidence_replay_determinism_harness.py`:
  - Asserts every discovered emitter is stable on a representative seeded doc.
  - Asserts the harness aggregate digest is itself stable across two runs.
  - Asserts unstable emitters surface clearly (use a deliberate stub-callable injected into a copy of the registry to verify the failure path; do not pollute the real registry).

## Non-goals

- Do not modify existing emitter modules.
- Do not introduce new evidence emitters or change schemas of existing ones.
- No fixture regeneration, no Playwright work, no UI changes.
- Do not gate CI here — Prompt 3 owns CI gate wiring.

## Validation

- `cd app && .venv/bin/ruff check bim_ai tests`
- `cd app && .venv/bin/pytest tests/test_evidence_replay_determinism_harness.py -x -v`
- `cd app && .venv/bin/pytest tests/test_evidence_package_digest.py -x -v`

## Tracker And Git

- Update `spec/revit-production-parity-workpackage-tracker.md` with Recent Sprint Ledger and affected rows.
- Create branch `prompt-2-replay-determinism-harness` from `main`.
- Commit and push the branch.
- Do not open a pull request.
