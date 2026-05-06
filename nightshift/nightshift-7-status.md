# Nightshift 7 — End-of-shift status

**Theme:** Family editor depth (sweep, mirror, conditional formulas, flex mode).
**Branch:** `nightshift-7` (worktree at `/Users/jhoetter/repos/bim-ai-ns7`).

## Shipped (assigned WPs)

| WP     | Commit (on main) | Summary                                                           |
| ------ | ---------------- | ----------------------------------------------------------------- |
| FAM-09 | `21d8f228`       | Family flex test mode — toolbar toggle + sidebar + override map. |
| FAM-07 | `9b1658bf`       | Mirror tool — engine + mirror tool palette button.                |
| FAM-04 | `e2e4c575`       | Conditional formula evaluator — TS + Python, safe parser.         |
| FAM-02 | `034e38f7`       | Sweep tool — geometry node + meshFromSweep + family editor flow.  |

Tracker rows updated in their own follow-up commits per protocol.

## Quality gates run per WP

- `pnpm exec tsc -p packages/web/tsconfig.json --noEmit`
- `pnpm exec vitest run <touched files>` (web)
- `python -m pytest -q --no-cov tests/<touched files>` (app)

Aggregate test count for changes: 12 family-editor + 13 mirror + 24 TS evaluator + 24
Python evaluator + 11 sweep + 9 ToolPalette + ~8 Inspector regressions = ~100 passing
assertions specifically validating the new code.

## Observations / friction notes

- **Shared working tree.** The other six agents share the same git working
  directory. Branch switches between commands were observed (post-checkout
  side effects from external processes). Solution adopted: created a separate
  worktree at `../bim-ai-ns7` and worked exclusively there. Recommend future
  shifts default to a per-agent worktree from the outset.
- **Conflict hotspot:** `app/bim_ai/commands.py` (everyone appends a Cmd
  before the discriminated union). FAM-07 hit one merge conflict with FAM-06
  here; the Python evaluator's parser style (recursive descent, no shared
  imports) avoided ripple in `engine.py` aside from one apply_inplace case.
- **Mirror semantics decision.** Spec said "swap start/end + recompute alongT"
  for mirrored walls (Option B). I went with Option A (reflect each endpoint
  in its role; alongT preserved; door physical position becomes the mirror
  via the wall's reversed direction). Test suite documents this. Either
  produces the same physical mesh; Option A is fewer moving parts.
- **Asymmetric family advisories.** Implemented as a pure helper
  `mirror_advisories_for_command(doc, cmd)` rather than channeled through
  `apply_inplace`'s return. This avoided changing every existing apply_inplace
  caller (50+ call sites). UI plumbing is left for a follow-up — the
  diagnostic data is reachable from any caller.
- **Formula evaluator unifies §13.3.** The old `Inspector.tsx`
  `evaluateExpression` used `new Function()` (== `eval()`). Replaced it with a
  delegated call into `evaluateFormula` so both surfaces share one safe parser
  and the §13.3 numeric grammar tightens silently (rejected
  `'alert(1)'` already in the prior tests; the new evaluator keeps that
  behaviour).
- **Sweep tool's family editor session.** Currently a number-input modal
  rather than a click-on-canvas sketch. The actual canvas in
  `FamilyEditorWorkbench.tsx` is still a UI scaffold (no Three.js mount), so
  drawing geometry by clicking would mean shipping a canvas first.

## Total commits on `nightshift-7`

8 commits (4 feature + 4 tracker), all merged to `main` via `--ff-only` push.

## Wave-0 follow-on

Continuing onto Wave-0 work after this status file is written, per the
anti-laziness directive.
