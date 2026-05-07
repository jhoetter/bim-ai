# Wave-2 Agent 1 — Federation Keystone (FED-01 load-bearing slice)

You are **Agent 1** of eight parallel AI engineers in the wave-2 sprint, plus the seed-fidelity sprint running concurrently. Your theme is **federation / linked external models** — the load-bearing slice of the FED-01 keystone. You own branch `wave2-1`. The user is asleep. Do not stop until your WP is done.

---

## 0. Pre-flight (read every word)

### Repo + worktree

`/Users/jhoetter/repos/bim-ai`. **Spawn a per-agent worktree first** to avoid contention with the seven other concurrent agents:

```bash
git worktree add /Users/jhoetter/repos/bim-ai-wave2-1 wave2-1
cd /Users/jhoetter/repos/bim-ai-wave2-1
```

Read these in full before starting:
- `spec/workpackage-master-tracker.md` → Strategic Primitive 1 → FED-01 detail block
- `nightshift/wave2-README.md` for overall coordination

### Concurrent agents

Eight wave-2 agents (`wave2-1` through `wave2-8`) plus the **seed-fidelity** sprint owning KRN-14, KRN-15, KRN-16 are all running. Expect rebase conflicts on `spec/workpackage-master-tracker.md`, `packages/core/src/index.ts`, `app/bim_ai/elements.py`, `app/bim_ai/commands.py`, `app/bim_ai/engine.py`. Resolve conflicts by keeping both edits (they're additive — different element kinds, different command branches).

### Quality gates (every commit must pass)

1. `pnpm exec tsc --noEmit`
2. `pnpm vitest run` (touched packages)
3. `cd app && .venv/bin/pytest -q --no-cov tests/<files-you-touched>`
4. `make verify` before merging to main

Never `--no-verify`, never delete failing tests, never bypass hooks. Fix root causes.

### Branch + merge protocol per WP

```bash
git add -A
git commit -m "feat(<scope>): <WP-ID> — <one-line summary>

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
git push origin wave2-1
git fetch origin
git rebase origin/main
git push origin wave2-1 --force-with-lease
git push origin wave2-1:main   # direct push works around locked-main-worktree issue
```

Never force-push to main. `--force-with-lease` only on your own branch. If `--ff-only` fails 5 times, document `merge-blocked` and continue.

### Tracker update protocol

After WP lands on main: change row's `State` → `done` (or `partial` if you ship a slice with explicit deferred items). Add `done in <commit-hash>` (or `partial in <hash> — <what's deferred>`). Commit separately as `chore(tracker): mark FED-01 partial — load-bearing slice`. Push, rebase, push to main.

### Anti-laziness directive

Done means: code written, tests added, all four gates pass, branch merged to main, tracker updated, commit visible on `origin/main`. Tests passing isn't enough — the user has been burned by agents declaring victory at the test-pass mark. **Sanity-check via API/snapshot or via the dev server before declaring done.**

- If the WP is bigger than expected, finish the load-bearing slice. Document deferred polish in the tracker note.
- After this WP ships, **do not stop**. Pick a Wave-0 or Wave-1 standalone WP from the tracker (avoid anything other agents are claiming — check `origin` for active branches first), claim with `partial — in flight wave2-1`, and continue.

### End-of-shift summary

Append `nightshift/wave2-1-status.md` with shipped commits, blockers, observations. Then stop.

---

## 1. Your assigned workpackage

### FED-01 — `link_model` element kind + read-only enforcement (load-bearing slice)

**Tracker entry:** `spec/workpackage-master-tracker.md` → "Strategic Primitive 1 — Federation" → FED-01.

**Reality check.** The full FED-01 spec is L (2-3 weeks). You **will not** finish all of it in one shift. Ship the **load-bearing slice** that proves federation works end-to-end with one model linked into another. Defer the polish (per-link visibility modes, revision pinning UI, drift badges) and explicitly call out the deferred items.

**MUST ship (load-bearing — mark `partial` in tracker):**

1. **Data model.** New element kind in `packages/core/src/index.ts`:

   ```ts
   {
     kind: 'link_model';
     id: string;
     name: string;
     sourceModelId: string;                    // UUID of another bim-ai model
     sourceModelRevision?: number | null;       // null = follow latest
     positionMm: { xMm: number; yMm: number; zMm: number };
     rotationDeg: number;
     originAlignmentMode: 'origin_to_origin';   // start with just one mode; defer 'project_origin' / 'shared_coords'
     hidden?: boolean;
     pinned?: boolean;
   }
   ```

   Mirror in `app/bim_ai/elements.py` as `LinkModelElem`.

2. **Engine commands** in `app/bim_ai/commands.py` + `engine.py`:
   - `CreateLinkModel` — validates `sourceModelId` exists in DB; rejects self-reference; rejects circular link (BFS the link graph)
   - `UpdateLinkModel` — change position / rotation / hidden / pinned
   - `DeleteLinkModel` — delete the link (does not delete the source model)

3. **Read-only enforcement.** Linked elements have a deterministic prefix in their resolved id (e.g. `<link_id>::<source_element_id>`). Any command (`MoveWallEndpoints`, `UpdateElementProperty`, `DeleteElement`, etc.) targeting an id with `::` returns `linked_element_readonly` (severity error, blocking).

4. **Snapshot expansion.** Extend `GET /api/models/:id/snapshot` with optional query parameter `?expandLinks=true`. When set:
   - Fetch the host's elements as today
   - For each `link_model` element, fetch the source's elements (at the pinned revision or latest) and include them in the response with provenance markers `_linkedFromLinkId: <link_id>`, `_linkedFromElementId: <source_id>`, `_linkedFromModelId: <source_uuid>`. Apply position + rotation transforms to coordinates.
   - Default snapshot (no `expandLinks`) omits linked elements (small payload)

5. **Renderer.** In `Viewport.tsx` and `meshBuilders.ts`:
   - When the snapshot includes elements with `_linkedFromLinkId`, render them with reduced opacity (e.g. `material.opacity = 0.6`, `material.transparent = true`) and a slight blue tint
   - Selection works on linked elements but the inspector shows fields disabled with tooltip `"Linked from <link.name> — open in source to edit"`

6. **Basic UI.** New `packages/web/src/workspace/ManageLinksDialog.tsx` — a minimal dialog accessible from a new menu entry "Insert → Link Model" that:
   - Lists existing links in the model
   - "Add Link" button: enter source model UUID + position, commits `CreateLinkModel`
   - Per-link "Delete" button (commits `DeleteLinkModel`)
   - Defer reload/pin/unpin UI

7. **Tests:**
   - `app/tests/test_link_model.py` — engine validation (self-reference rejected, circular rejected, snapshot expansion shape correct, read-only enforcement)
   - `packages/web/src/workspace/ManageLinksDialog.test.tsx` — basic dialog interaction
   - `packages/web/src/Viewport.linkedElements.test.tsx` (or extend existing) — verify ghosted opacity on linked elements

**MAY defer (mark in tracker note as `partial`):**

- `originAlignmentMode` values beyond `origin_to_origin` (project_origin, shared_coords)
- `visibilityMode: 'host_view' | 'linked_view'` per-link visibility
- Pin/unpin revision UI + drift badge
- VV dialog "Revit Links" tab integration
- CLI `bim-ai link/unlink/links` commands
- `worksetId` field on link_model
- Project Browser left rail "Links" group with expand/collapse

After this WP ships, mark FED-01 in tracker as: `partial in <hash> — load-bearing slice (data model + 3 commands + read-only enforcement + snapshot expansion + ghosted renderer + basic Manage Links dialog) shipped; per-link visibility modes, revision pinning UI, alignment modes beyond origin_to_origin, CLI subcommands deferred to follow-up`.

**Acceptance.** Two seeded models exist (the demo seed at `75cd3d5c-…` plus a small `structure-demo` model — create a fresh model via `POST /api/projects/:projectId/models` if needed). The host model can have a `link_model` element pointing at the structure model. Snapshot with `?expandLinks=true` returns combined elements with provenance markers. The Viewport renders the linked structural geometry as ghosted opacity. Trying to commit `MoveWallEndpoints` on a linked wall id returns the `linked_element_readonly` advisory.

**Files you'll touch:**
- `packages/core/src/index.ts` (add `link_model` kind to `Element` union — append at end)
- `app/bim_ai/elements.py` (add `LinkModelElem`)
- `app/bim_ai/commands.py` (add `CreateLinkModelCmd`, `UpdateLinkModelCmd`, `DeleteLinkModelCmd`)
- `app/bim_ai/engine.py` (apply handlers + read-only enforcement)
- `app/bim_ai/routes_*.py` (extend snapshot endpoint)
- `packages/web/src/Viewport.tsx` (ghosted rendering)
- `packages/web/src/viewport/meshBuilders.ts` (opacity hookup)
- `packages/web/src/workspace/ManageLinksDialog.tsx` (new file)
- `packages/web/src/workspace/Workspace.tsx` (Insert → Link Model menu entry — find the existing menu pattern)
- New tests in `app/tests/` and `packages/web/`

**Effort:** 6-8 hours for the load-bearing slice. Don't over-scope.

---

## 2. File ownership and conflict avoidance

**You own:**
- `link_model` data model + commands + engine logic
- `ManageLinksDialog.tsx`
- Snapshot-expansion query parameter
- Linked-element ghosting in Viewport

**Shared territory (expect rebase conflicts — additive, easy to resolve):**
- `packages/core/src/index.ts` — append `link_model` at end of Element union
- `app/bim_ai/elements.py`, `commands.py`, `engine.py` — append your additions
- `spec/workpackage-master-tracker.md` — only your FED-01 row

**Avoid:**
- `packages/web/src/plan/PlanCanvas.tsx` (Agents 2, 3, 5)
- `packages/web/src/familyEditor/*` (Agent 6)
- `packages/web/src/viewport/meshBuilders.ts` outside the linked-element opacity hookup (seed-fidelity is consolidating heavy geometry there)
- `app/bim_ai/export_ifc.py` (Agent 8)

---

## 3. Go

Spawn the worktree, read the tracker entry for FED-01, then start the WP. Do not pause until the End-of-shift summary step. After FED-01 partial lands, pick up a standalone Wave-1 WP if time permits.
