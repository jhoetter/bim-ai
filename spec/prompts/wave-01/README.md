# Wave 1 — Interaction Foundation + Plan Canvas

**Delete this entire `wave-01/` directory once all WPs are merged to main.**

## What this wave accomplishes

- Closes WP-UI-B01/B02/B03 (plan canvas partial gaps)
- Adds the Options Bar context strip (Revit-style per-tool options row)
- Adds Align (AL), Split (SD), Trim/Extend (TR) modify tools
- Wires crossing vs window selection direction

## Execution order

### Batch A — start these in parallel

Each runs on its own branch. No shared file conflicts between them.

| Prompt | Branch | What it touches |
|---|---|---|
| `WP-V2-01a-options-bar.md` | `feat/wp-v2-01a-options-bar` | New `OptionsBar.tsx`, `AppShell.tsx`, `store.ts` |
| `WP-V2-14-plan-canvas.md` | `feat/wp-v2-14-plan-canvas` | `PlanCanvas.tsx`, `planCanvasState.ts` |

When both Batch A branches pass CI, merge them both to main (resolve any conflicts — they touch mostly disjoint files). Commit + push after each merge.

### Batch B — start after Batch A is fully on main

| Prompt | Branch | What it touches |
|---|---|---|
| `WP-V2-01b-modify-tools.md` | `feat/wp-v2-01b-modify-tools` | `toolRegistry.ts`, `toolGrammar.ts`, `PlanCanvas.tsx` |

## Git workflow for each agent

```bash
git checkout main && git pull
git checkout -b <branch-name>
# ... implement, test ...
pnpm exec tsc --noEmit            # must be clean
pnpm exec vitest run src          # all tests pass
make verify                       # full CI gate
git add <specific files>
git commit -m "feat(scope): subject\n\nCo-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
git push -u origin <branch-name>
```

After the branch is pushed, the human operator merges it to main via `git merge --no-ff` or a PR. After merge:

```bash
git checkout main && git pull
# Update spec/workpackage-master-tracker.md: change WP state to `done`
git add spec/workpackage-master-tracker.md
git commit -m "chore: mark WP-V2-XXX done in master tracker"
git push
```

## After all Wave 1 WPs are done

```bash
rm -rf spec/prompts/wave-01
git add spec/prompts/wave-01
git commit -m "chore: remove wave-01 prompt files — all WPs merged"
git push
```
