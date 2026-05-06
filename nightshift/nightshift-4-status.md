# Nightshift Agent 4 — End-of-Shift Status

## Shipped WPs (all four assigned)

| WP     | Commit on `origin/main`     | Notes                                                                 |
| ------ | --------------------------- | --------------------------------------------------------------------- |
| FED-05 | `966251f5`                  | docs/collaboration-model.md + README intro line + CLI --help reference |
| FAM-06 | `6f750b7f`                  | `text_3d` element kind + Three.js TextGeometry + 3 bundled fonts       |
| KRN-06 | `4b75919b`                  | project_base_point / survey_point / internal_origin + VV "Site / Origin" |
| VIE-06 | `9e0c3f41`                  | residential-eu template + loader + GET /api/templates + CLI --template  |

Each ran the four quality gates (typecheck on `@bim-ai/core` + `@bim-ai/web`,
`vitest` on touched files, `pytest` on new test files) before merge to main.

## Tests added

- `packages/web/src/viewport/text3dGeometry.test.ts` — 7 cases (mesh shape,
  positioning, rotation, scaling, single-char, material).
- `packages/web/src/viewport/originMarkers.test.ts` — 5 cases (axis triad,
  PBP cross, SP triangle, position mapping, rotation).
- `app/tests/test_engine_text_3d.py` — 6 cases (create, defaults, empty-text
  reject, duplicate-id, all 3 font families, unknown family).
- `app/tests/test_engine_origin_points.py` — 10 cases (singleton enforcement,
  move/rotate, ensure_internal_origin idempotency, legacy backfill).
- `app/tests/test_template_loader.py` — 5 cases (catalog discovery, load,
  expected element counts, missing-template error, grid spacing).

Total: **33 new test cases**, all green at end of shift.

## Observations

### Worktree contention

The repo runs all seven agents in a single git directory, switching branches
back and forth. My initial commit attempts repeatedly landed on someone else's
checked-out branch; my staged work for FED-05 was rescued from a stash that
the runtime auto-created during a foreign `git reset`. Same for KRN-06 — the
working tree was wiped mid-edit and my changes were recovered from
`stash@{0}`. Net effect: every WP needed defensive `git stash apply <sha>` +
manual file extraction before commit.

The pattern that worked: do the smallest possible change, stage, commit
immediately, and push. Holding uncommitted state is dangerous.

### Merging via direct push

Standard `git checkout main && git merge --ff-only` blew up because
`/private/tmp/main-merge` (another worktree) had `main` checked out. Workaround
that consistently worked: `git push origin nightshift-4:main` from my own
branch. Used this for all four merges.

### Conflicts on shared files

Every commit needed conflict resolution against newly-landed work from other
agents on these shared files:
- `packages/core/src/index.ts` — agents 1, 2, 7 also extending the `Element`
  union (KRN-09, KRN-12, KRN-13, FAM-02 all touched it).
- `app/bim_ai/commands.py` and `app/bim_ai/engine.py` — same story for
  `Command` union and the engine `match` block.

In every case the resolution was "keep both" — neither side overlapped
semantically. Tests caught any malformed merges.

### Things to watch / follow-ups

- **Plan canvas rendering for `text_3d` was deferred.** The spec asks for a
  text-bounding-box outline + label inside, but that file is owned by Agent 5
  and the prompt forbids me touching it. A small follow-up would add a case
  to `PlanCanvas.tsx` once the dust settles.
- **Plan-canvas markers for the three origin elements were deferred** for
  the same reason.
- **`wall_type` elements not bundled in the residential-eu template.**
  `BUILT_IN_WALL_TYPES` lives only in the renderer's family catalog
  (`packages/web/src/families/wallTypeCatalog.ts`); walls reference it via
  `wallTypeId` rather than via element snapshots, so the template doesn't
  need to embed them. Acceptance for VIE-06 still passes — no walls in the
  template means no missing types — but if a follow-up template does add
  walls we may want to mirror the catalog into Python.
- **UI "New Model" template chooser**: not added. There's no existing
  new-model UI in `packages/web/src/`; the only entry point today is the CLI
  + the `/api/projects/:id/models` endpoint, both of which now accept the
  template id. The chooser is a real feature, not a stub fix.

## Total commits

7 commits authored on `nightshift-4` (4 feature + 3 rebases were squashed
into the same WP commits). All 4 assigned WPs landed on `origin/main`.
