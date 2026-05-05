# Prompt 8 - Final Hardening Sweep

## Mission

Close the small-but-real cleanups that block a clean v1 closeout: hoist inline imports introduced during wave-4, plug exception swallows on the wave-4 surface, and remove stray TODO/FIXME comments that no longer reflect work in flight. This is the closeout janitor pass — scoped, low-risk, no behavior changes.

## Target Workpackages

- WP-V01 Validation/advisor expansion (one of the lint-quiet but exception-noisy areas).
- WP-D06 Cleanroom metadata and IDS (test surface that still has inline imports).
- WP-A04 CI verification gates (cleanups make the gate suite quieter).

## Scope

- Hoist inline imports in `app/tests/test_ifc_pset_qto_deepening.py`:
  - Move every per-function `import ifcopenshell`, `import ifcopenshell.api.pset`, `import ifcopenshell.api.root`, and `from bim_ai.export_ifc import …` / `from bim_ai.ifc_property_set_coverage_evidence_v0 import …` / `from bim_ai.ifc_stub import …` to the top of the file in alphabetical order under a single `if TYPE_CHECKING` block only when an import is actually only used in type hints; otherwise hoist as a regular module-level import.
  - Preserve any pytest-skip-when-missing patterns: if `ifcopenshell` is optional, gate at module level with `pytest.importorskip("ifcopenshell")` rather than per-function try/except. Keep test behavior byte-identical.
- TODO/FIXME sweep — only on files modified during wave-4 (use `git log --since='2026-04-01' --name-only --pretty=format: | sort -u` to scope, do not touch files outside that scope):
  - Remove `# TODO`/`# FIXME` comments that describe work already landed.
  - Convert any remaining genuine TODO into a one-line `# Deferred:` note that points at the relevant `WP-*` row, instead of letting it linger as a TODO.
- Exception swallow audit — only on the same wave-4-touched file scope:
  - Find `except Exception:` / bare `except:` blocks that `pass` silently and either narrow the exception type, log via the existing module logger, or convert to a deterministic skip-marker. Do not introduce new logging frameworks.
- Add focused unit test `app/tests/test_final_hardening_sweep.py` that asserts:
  - `app/tests/test_ifc_pset_qto_deepening.py` contains zero per-function `import` lines for the names listed above (parse via `ast` over the source file).
  - The set of files changed by this prompt is a strict subset of the wave-4-touched file scope (read a curated allow-list constant at the top of the test).

## Non-goals

- Do not change any production behavior. No new logic, no schema changes, no new evidence emitters.
- Do not rewrite tests; only the inline-import hoist counts as a structural test edit.
- Do not touch files outside the wave-4 scope. Out-of-scope files are explicitly someone else's problem.
- Do not chase every TODO in the repo — only on wave-4-touched files.

## Validation

- `cd app && .venv/bin/ruff check bim_ai tests`
- `cd app && .venv/bin/pytest tests/test_ifc_pset_qto_deepening.py -x -v`
- `cd app && .venv/bin/pytest tests/test_final_hardening_sweep.py -x -v`
- `cd app && .venv/bin/pytest -x`

## Tracker And Git

- Update `spec/revit-production-parity-workpackage-tracker.md` with Recent Sprint Ledger and affected rows.
- Create branch `prompt-8-final-hardening-sweep` from `main`.
- Commit and push the branch.
- Do not open a pull request.
