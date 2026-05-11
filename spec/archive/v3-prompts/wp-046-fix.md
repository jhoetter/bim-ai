# WP-046-fix — MRK-V3-03: Commit local work, add production routes, remove OUT scope creep, wire chip

**Branch:** feat/v3-mrk-v3-03-sheet-review
**Base review:** FAIL (see wp-046.md for original spec)
**Fix target:** The pushed branch is incomplete. The main worktree has uncommitted work on this branch. Step 1 is to push that work; steps 2–6 close the remaining gaps.

## Required reading

- spec/v3-prompts/wp-046.md (original spec — re-read end-to-end)
- app/bim_ai/routes_api.py (real production comment/markup routes)
- app/bim_ai/activity.py (activity stream)
- app/bim_ai/comments.py (comment model and creation handler)
- packages/web/src/workspace/TopBar.tsx
- app/tests/api/test_comments_route.py (extend this)
- app/tests/test_mrk_v3_03.py (existing test file using stub app)

## STEP 0 — push the uncommitted local changes first

The main worktree at /Users/jhoetter/repos/bim-ai is on this branch with uncommitted changes to
app/bim_ai/activity.py, comments.py, elements.py, engine.py plus untracked app/bim_ai/img/ and
packages/web/src/tools/modifierBar.ts. The review agent confirmed these represent the production-
route work that has not yet been pushed.

Commit and push those changes before applying the fixes below:
```bash
git add app/bim_ai/activity.py app/bim_ai/comments.py app/bim_ai/elements.py app/bim_ai/engine.py
# Review carefully — do NOT add modifierBar.ts (that belongs to WP-047) or anything in img/ unless
# it is directly needed for the sheet pixel-map endpoint.
git commit -m "feat(mrk): MRK-V3-03 production routes — pixel-map + resolve hook + chip dispatch"
git push origin feat/v3-mrk-v3-03-sheet-review
```

## Failures to fix

### 1. Remove OUT-V3-01 scope creep

The `routes_api.py` on this branch contains ~235 lines of OUT-V3-01 presentation routes
(`/models/{id}/presentations`, `/p/{token}`, etc.). Remove them — they are on the dedicated
WP-045 branch. Do NOT leave them here; they will cause merge conflicts.

### 2. Pixel-map endpoint missing from production routes

Task 3 of the WP requires:
```
GET /api/v3/models/{modelId}/sheets/{sheetId}/pixel-map
```
Register this in `routes_api.py` (the real FastAPI router, not the test stub). The handler should
call the same pixel-map logic already implemented in the test stub. Return a 2D array of element
IDs (or nulls) as JSON.

### 3. Bidirectional resolve hook in production routes

Task 5 requires that when `POST /comments/{commentId}/resolve` is called and the comment has an
`anchoredViewId`, the server emits a `sheet_comment_resolved` activity entry and optionally
notifies the originating view. Find the real `/comments/{commentId}/resolve` handler in
`routes_api.py` and add the hook there (not just in the test stub).

### 4. Notification chip dispatch in production routes

Task 4 requires that `POST /comments` in `routes_api.py` emits a `sheet_comment_chip` activity
entry when `anchor.kind == "sheet"` and `sourceViewId` is set. Find or add the real comment
creation handler in `routes_api.py` and add this emission.

### 5. SourceViewChip — use WebSocket, not HTTP polling

`SourceViewChip.tsx` currently does a one-shot `fetch` on mount. Replace with a WebSocket
subscription to the activity stream (the same WS connection used by the activity drawer from
WP-036). Filter for `sheet_comment_chip` events. This ensures new comments appearing after
initial load update the chip within 2 s as the spec requires.

### 6. Wire SourceViewChip into TopBar

In `packages/web/src/workspace/TopBar.tsx`, import and render `<SourceViewChip>` in the
appropriate position (right-hand section of the bar, adjacent to the view name). It should
only appear when the current view is a sheet view.

### 7. Extend test_comments_route.py

The WP acceptance requires extending `app/tests/api/test_comments_route.py` with:
- A test that POSTs a sheet comment (anchor.kind == "sheet") and asserts a `sheet_comment_chip`
  activity entry was emitted.
- A test that resolves a sheet comment and asserts the `sheet_comment_resolved` activity entry
  was emitted.

Use the real `routes_api` router (TestClient pattern), not a stub app.

## Verify gate

```bash
pnpm exec tsc --noEmit
pnpm test
make verify
```

## Commit and push

After STEP 0, make fixes and push one or more additional commits:
```bash
git add <specific files only>
git commit -m "fix(mrk): production routes, remove OUT scope creep, WS chip, TopBar wiring, route tests"
git push origin feat/v3-mrk-v3-03-sheet-review
```

## Final report

Paste back: branch, final commit SHA, make verify result, which of the 7 gaps are closed.
