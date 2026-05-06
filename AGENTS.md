# Agent Collaboration Guide

This document defines how orchestrator and worker agents operate in this repo. Read it before writing a prompt or executing one.

---

## The two roles

### Orchestrator (you, Claude Code in the main session)

The orchestrator reads the codebase, writes workpackage prompts, launches worker agents on feature branches, reviews their output, merges to main, and updates the tracker. It never implements features itself — its job is to give workers enough context that they can act without exploring.

**Before writing a prompt:**
1. Read every file the worker will touch. Note the exact line numbers of insertion points.
2. Extract the `old_string` of every Edit call the worker will need to make.
3. Run `grep` / `sed` to surface pre-existing test failures so the worker doesn't investigate them.
4. Check what icons, i18n keys, and type exports already exist so the worker doesn't have to search.
5. Identify the correct git branch name and write the checkout command.

**After a worker finishes:**
1. Check `git log --oneline -5` on the feature branch to confirm it committed to the right branch.
2. Run `make verify` locally to confirm CI would pass.
3. Merge with `git merge --no-ff feat/wp-xxx`, resolve any conflicts, push.
4. Mark the WP as `done` in `spec/workpackage-master-tracker.md`, commit, push.

---

### Worker agent (subagent launched on a feature branch)

The worker follows the prompt. It does not explore beyond what the prompt specifies.

**Rules:**
- **Branch first, always.** The very first action is `git checkout main && git pull && git checkout -b <branch>`. Check with `git branch --show-current` before touching any file. Never commit to `main`.
- **No reconnaissance.** Do not read files to find insertion points — the prompt gives them. Do not grep for patterns that the prompt should have provided. If the prompt omits something, note it and move on rather than exploring.
- **Parallel reads.** When the prompt says to read N independent files, issue all Read calls in a single tool-call batch.
- **Parallel edits.** When multiple files can be edited independently, batch the Edit calls.
- **Minimal test scope.** Run only the test files that cover the changed code and the new test files. Do not run the full suite — it wastes time and you are not responsible for pre-existing failures.
- **Do not fix unrelated things.** If you notice a bug outside the WP scope, add a `// TODO:` comment and move on.
- **Commit exactly once.** Stage only the files listed in the prompt plus any new test files you created. Do not stage `.DS_Store`, lock files, or unrelated changes.

---

## Prompt format (mandatory structure)

Every workpackage prompt must follow this structure. Omitting sections causes the worker to spend time recovering the missing information.

```markdown
# WP-XXX — Title

**Branch:** `feat/wp-xxx`
**Tracker:** Update `spec/workpackage-master-tracker.md` WP-XXX → `done` when merged.

---

## Branch setup (run first)

\```bash
git checkout main && git pull && git checkout -b feat/wp-xxx
\```

---

## Pre-existing test failures (ignore these)

The following tests fail on `main` before your changes — do not investigate them:

- `src/workspace/SomeFile.test.tsx > some test name` — reason

---

## Files to touch

Complete list — do not read or modify any file not on this list:

| File | Change |
|---|---|
| `packages/web/src/tools/toolRegistry.ts` | Add new ToolId, palette entry |
| `packages/web/src/tools/toolGrammar.ts` | Add state + reducer |
| ... | ... |

---

## Changes

For each change: the exact file path, the exact `old_string`, and the exact `new_string`. Read each file only if needed to verify the line is still as shown.

### 1. `packages/web/src/tools/toolRegistry.ts`

**Add to ToolId union** (currently ends at line 39):

old:
\```ts
  | 'trim'
  | 'wall-join';
\```
new:
\```ts
  | 'trim'
  | 'wall-join'
  | 'wall-opening'
  | 'shaft';
\```

### 2. ... (continue for every file)

---

## New files to create

List the full path and complete content of every new file.

---

## Tests

List the exact test file(s) to run to verify the WP (not the whole suite):

\```bash
pnpm --filter web exec vitest run src/tools/toolGrammar.test.ts src/tools/ToolPalette.test.tsx
\```

Expected: all tests pass. If they do not, fix the issue in the same commit.

---

## Typecheck

\```bash
pnpm --filter web typecheck
\```

Must produce no errors. Warnings are acceptable.

---

## Commit format

\```
feat(scope): WP-XXX — short description

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
\```

Stage only the files listed in "Files to touch" plus new files.
```

---

## Why agents are slow — anti-patterns to avoid

| Anti-pattern | Cost | Fix |
|---|---|---|
| "Find where X is defined" | 3–10 file reads | Give the line number in the prompt |
| Sequential file reads | N × round-trip time | Batch independent reads in one tool call |
| Reading a file to find the old_string | 1 file read per Edit | Include old_string in the prompt |
| Running full test suite | 2–5 min | Run only changed + new test files |
| Investigating pre-existing failures | 5–15 min | List them in the prompt explicitly |
| Committing to wrong branch | Requires recovery | Branch-first rule + explicit `git branch --show-current` check |
| "Let me also check X while I'm here" | Scope creep | Worker must stay strictly in WP scope |
| Searching for icon/i18n keys | 2–3 file reads | Include exact existing entries in prompt |

---

## Orchestrator checklist before launching a worker

- [ ] Prompt includes exact branch name and `git checkout` command
- [ ] Every file to be modified is listed with its current line count
- [ ] Every Edit has an exact `old_string` extracted from the current file
- [ ] Icon keys are resolved (checked `packages/ui/src/icons.tsx`)
- [ ] i18n keys are resolved (checked `packages/web/src/i18n.ts`)
- [ ] Type union additions are shown with surrounding context
- [ ] Pre-existing failing tests are listed
- [ ] Test command covers only the relevant files
- [ ] Commit message format is given

---

## Wave lifecycle

```
Orchestrator reads codebase → writes prompts to spec/prompts/wave-NN/
  ↓
Launch Batch A workers in parallel (one per WP, separate branches)
  ↓
Both pass CI → merge --no-ff to main, push
  ↓
Launch Batch B workers (depend on Batch A state)
  ↓
All Batch B pass → merge, push
  ↓
Mark all WPs done in tracker
Delete spec/prompts/wave-NN/
Commit + push
```

**Branch naming:** `feat/wp-v2-NN-short-slug`

**Merge strategy:** Always `--no-ff` so the merge commit records the WP.

**Conflicts:** Resolve by reading both versions and understanding intent. Never `git checkout --theirs` blindly on a `.ts` file — always check what each side changed.

---

## What belongs in a WP prompt vs what does not

**Include:**
- Exact file paths + line numbers of every insertion point
- The `old_string` for every Edit
- All type exports the worker needs to import
- Icon keys and i18n keys already in use (so the worker can follow the pattern exactly)
- The feature flag name if gating behind one
- Stub pattern for unimplemented backend calls (`console.warn('stub: ...')`)

**Do not include:**
- Architecture commentary the worker doesn't need to act on
- History of how the feature got here
- Speculative future directions
- Anything that requires the worker to make a judgment call — make it yourself

---

## Example: tight vs loose prompt for a single Edit

**Loose (slow):**
> Add `wall-opening` to the ToolId union in toolRegistry.ts.

This causes the worker to: read toolRegistry.ts, find the union, verify context, then edit. ~3 tool calls.

**Tight (fast):**
> In `packages/web/src/tools/toolRegistry.ts`, the ToolId union currently ends with:
> ```ts
>   | 'trim'
>   | 'wall-join';
> ```
> Replace with:
> ```ts
>   | 'trim'
>   | 'wall-join'
>   | 'wall-opening'
>   | 'shaft';
> ```

This is a single Edit call with no reads needed. ~1 tool call.

The difference across a full WP (15–20 Edits) is the gap between a 10-minute agent and a 40-minute agent.
