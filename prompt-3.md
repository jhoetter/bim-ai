# Prompt 3 - CI Gate Script Suite

## Mission

Consolidate the v1 CI verification gates into one runnable script with stable, documented exit codes so the v1 release can be gated by a single command. Today's gates are scattered across ad-hoc invocations; closeout requires one entrypoint that runs ruff, pytest, web typecheck, vitest, prettier check, and the existing evidence-package probe with a single deterministic readout.

## Target Workpackages

- WP-A04 CI verification gates (this is the primary owner).
- WP-A03 Playwright evidence baselines (gate runs the existing committed-PNG ingest probe).

## Scope

- New shell entrypoint `app/scripts/ci-gate-all.sh` (executable) that runs each gate in fixed order and prints a per-gate `[ok]` / `[fail]` line plus a final aggregate verdict. Exits non-zero on any failed gate. The gate set:
  1. `cd app && .venv/bin/ruff check bim_ai tests`
  2. `cd app && .venv/bin/pytest -x`
  3. `cd packages/web && pnpm typecheck`
  4. `cd packages/web && pnpm exec vitest run`
  5. `pnpm exec prettier --check .` (note: tracker markdown is currently a known-warning; the gate must capture-not-fail-on prettier and surface a separate `[warn]` line as documented in this prompt's run book reference)
  6. `app/scripts/ci-evidence-package-probe.sh`
- New module `app/bim_ai/ci_gate_runner.py`:
  - Pure-Python helper `summarize_ci_gate_run_v1(rows) -> dict` returning a deterministic `ciGateRunSummary_v1` manifest with `schemaVersion`, ordered per-gate result rows, aggregate digest, and final verdict.
  - No subprocess execution from Python; the shell script is the orchestrator. The Python helper exists so other tooling can ingest a JSON record of a run if produced.
- Focused unit test `app/tests/test_ci_gate_runner.py`:
  - Exercises `summarize_ci_gate_run_v1` with synthetic rows; asserts deterministic JSON, stable digest, and that any single failed gate flips overall verdict to `fail`.

## Non-goals

- Do not change existing test files, ruff config, prettier config, or vitest config.
- Do not chase the pre-existing prettier warning on the tracker — surface it as `[warn]`, do not fix it here.
- No GitHub Actions YAML in this prompt; the script is the artifact.
- Do not add new tests under `app/tests/` beyond `test_ci_gate_runner.py`.

## Validation

- `cd app && .venv/bin/ruff check bim_ai tests`
- `cd app && .venv/bin/pytest tests/test_ci_gate_runner.py -x -v`
- `bash -n app/scripts/ci-gate-all.sh`

## Tracker And Git

- Update `spec/revit-production-parity-workpackage-tracker.md` with Recent Sprint Ledger and affected rows.
- Create branch `prompt-3-ci-gate-script-suite` from `main`.
- Commit and push the branch.
- Do not open a pull request.
