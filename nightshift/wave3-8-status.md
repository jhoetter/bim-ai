# wave3-8 — FED-01 polish (Path B) status

**Branch:** `wave3-8` (worktree at `/Users/jhoetter/repos/bim-ai-wave3-8`)

## Triage outcome

```
IFC-03 → done
IFC-04 → partial   (load-bearing slice shipped by wave2-8; remaining items
                    are explicit `Deferred:` scope per the wave2-8 commit, not
                    "wave2-8 didn't finish")
VIE-02 → done
```

None of {IFC-03, IFC-04, VIE-02} is `open`, so the Path A trigger doesn't
fire. Path B (FED-01 polish) chosen.

## Path B — FED-01 polish (flips FED-01 from `partial` → `done`)

All seven mandatory deliverables shipped:

1. **Per-link visibility modes** — `link_model.visibilityMode:
   'host_view' | 'linked_view'` on the schema (TS + Python). Inlined linked
   elements carry `_linkedVisibilityMode` so renderers / VV can group them.
2. **Origin alignment modes beyond `origin_to_origin`** — `'project_origin'`
   aligns source PBP → host PBP (rotation gets trueNorth delta);
   `'shared_coords'` aligns survey points and reconciles
   `sharedElevationMm`. Falls back to `origin_to_origin` semantics when the
   required anchor is missing on either side.
3. **Revision pinning UI + drift badge** — per-row Pin / Follow-latest
   toggle in `ManageLinksDialog`. Snapshot now includes
   `linkSourceRevisions` so the dialog renders a yellow `+N revisions`
   badge when a pinned link's source has advanced; clicking `Update` bumps
   the pinned revision.
4. **VV dialog "Revit Links" tab** — new fourth tab in `VVDialog.tsx`
   listing every `link_model` with a per-link visibility checkbox.
5. **Project Browser left rail "Links" group** — collapsible group lists
   link_models with eye toggle and drift badge.
6. **CLI subcommands** — `bim-ai link --source <uuid> --pos x,y,z [--align
   <mode>] [--name <s>] [--visibility <mode>]`, `bim-ai unlink <link_id>`,
   `bim-ai links` (JSON list with pin / drift status). CLI test script wired
   via `node --test`.
7. **Tests** — all 6 required test files added; full suite green:
   - `app/tests/test_link_model_visibility_mode.py` (5 tests)
   - `app/tests/test_link_model_alignment_modes.py` (6 tests)
   - `app/tests/test_link_model_revision_pinning.py` (4 tests)
   - `packages/web/src/workspace/ManageLinksDialog.driftBadge.test.tsx` (4 tests)
   - `packages/web/src/workspace/VVDialog.linksTab.test.tsx` (4 tests)
   - `packages/cli/cli.linkSubcommands.test.mjs` (4 tests)

## Verification

- `pytest app/tests` — 1346 passed, 7 skipped (full suite, no regressions).
- `vitest run packages/web/src` — 1968 passed across 187 files.
- `node --test packages/cli/cli.linkSubcommands.test.mjs` — 4/4 passing.
- `tsc -p packages/web/tsconfig.json --noEmit` — clean.

## Tracker

`spec/workpackage-master-tracker.md` FED-01 row flipped to `done` with the
full enumeration of polish items and the test list.

## Commit

Single keystone commit on `wave3-8` (push + merge per protocol).
