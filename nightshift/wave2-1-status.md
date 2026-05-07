# wave2-1 — FED-01 federation keystone (load-bearing slice)

**Branch:** `wave2-1`
**Worktree:** `/Users/jhoetter/repos/bim-ai-wave2-1`
**End of shift:** 2026-05-07

## Shipped commits (now on `origin/main`)

- `b05fc082` — `feat(fed): FED-01 — link_model element kind + read-only enforcement (load-bearing slice)`
- `4422ecb4` — `chore(tracker): mark FED-01 partial — load-bearing slice in b05fc082`

## What landed

The load-bearing federation slice — host model → linked source model end-to-end:

1. **Data model** — `link_model` element kind in `packages/core/src/index.ts`
   (`ElemKind` union + `Element` discriminated union) and Python
   `LinkModelElem` in `app/bim_ai/elements.py`. Single alignment mode for
   v1: `origin_to_origin`.
2. **Commands** — `CreateLinkModelCmd`, `UpdateLinkModelCmd`,
   `DeleteLinkModelCmd` in `commands.py` with engine cases in `engine.py`.
   Engine validates non-empty source UUID and same-id self-reference;
   DB-level validation in `routes_commands.py` rejects host=source, missing
   source, and BFS-detected circular link graphs.
3. **Read-only enforcement** — `_enforce_linked_readonly` in `engine.py`
   refuses any mutating command (`MoveWallEndpoints`, `UpdateElementProperty`,
   `DeleteElement`, `Pin/UnpinElement`, `MirrorElements`, etc.) targeting
   an id with the `<linkId>::<sourceElemId>` prefix. Returns
   `ValueError("linked_element_readonly: …")` which the apply route turns
   into a 400.
4. **Snapshot expansion** — `app/bim_ai/link_expansion.py`:
   `GET /api/models/:id/snapshot?expandLinks=true` inlines every linked
   source's elements with `_linkedFromLinkId` / `_linkedFromElementId` /
   `_linkedFromModelId` provenance markers. Coordinates transformed by the
   link's `positionMm` + Z-rotation; intra-source `*Id`/`*Ids` references
   are rewired to their prefixed counterparts. Single-hop only (transitive
   blowup deferred). Sources loaded at pinned revision via the existing
   undo replay path, falling back to current revision.
5. **Renderer** — `packages/web/src/viewport/linkedGhosting.ts` clones each
   mesh's material, dials opacity to 0.6, lerps tint toward `#5b8def`. Wired
   into `Viewport.tsx` after each mesh is built; triggers when the resolved
   element id contains `::`. Idempotent via `userData.linkedGhost`.
   `useWorkspaceSnapshot` now requests `?expandLinks=true` so links render
   end-to-end without further wiring.
6. **UI** — `ManageLinksDialog.tsx` (list + add UUID/position + delete)
   accessible via the new "Insert → Link Model…" entry in `ProjectMenu`.
   Reload / pin-revision / replace-source controls deferred.
7. **Tests** — 11 pytest cases in `app/tests/test_link_model.py` (engine
   apply, validation, read-only enforcement, snapshot expansion incl.
   transform + provenance + recursive-link skip + missing-source path) and
   10 vitest cases (`ManageLinksDialog.test.tsx` + `linkedGhosting.test.ts`).

## Quality gates

- `pnpm typecheck` (turbo) — **PASS** (11 packages cached + green)
- `pnpm test` (turbo) — **PASS** (1770 web tests + cached others)
- `app/tests/test_link_model.py` — **PASS** (11/11)
- Full `cd app && pytest -q --no-cov` — **PASS** (1239 + 7 skipped, all
  pre-existing skip markers)
- `make verify` — **PASS** (format-check + python-format-check + lint +
  architecture + typecheck + test + build all green)
- End-to-end smoke test (Python REPL): create link, expand snapshot with
  90° rotation transform, attempt `MoveWallEndpoints` on a `::`-prefixed
  id → blocked with `linked_element_readonly` advisory.

## Deferred (tracked as `partial` in `spec/workpackage-master-tracker.md`)

- Per-link `visibilityMode: 'host_view' | 'linked_view'`
- Revision pinning UI + drift badge (data model already supports
  `sourceModelRevision`)
- `originAlignmentMode` values beyond `origin_to_origin` (`project_origin`,
  `shared_coords`)
- VV dialog "Revit Links" tab with per-link visibility toggle
- CLI `bim-ai link / unlink / links / expand-links` subcommands
- `worksetId` field on `link_model`
- Project Browser left rail "Links" group with expand/collapse

## Observations / blockers

- The Python venv `app/.venv` was not present in the worktree; symlinked
  the main repo's venv (`ln -s /Users/jhoetter/repos/bim-ai/app/.venv .venv`)
  rather than running `make install` to keep the shift moving. Not a
  blocker — only affects worktree-local pytest invocation.
- `pnpm install` was needed in the worktree (`node_modules` was empty) —
  used `--prefer-offline` to reuse the main repo's pnpm content store.
- `coerceElement` in `state/store.ts` uses a hand-rolled per-kind switch;
  added a `link_model` branch but the pattern doesn't preserve unknown
  fields. Linked-element provenance therefore flows through the id (via
  `::` separator) rather than through extra fields on the typed elements.
  Sustainable for the load-bearing slice; if a follow-up needs the
  `_linkedFromModelId` etc. on the client, threading them through
  `coerceElement` per-kind is the next move.
- Existing eslint warnings in `doorGeometry.ts` and `PlanCanvas.tsx` are
  pre-existing and unrelated to FED-01.

## Pickup-able next WPs (Wave-1 standalone, FED-01 unblocks)

- **FED-02** (cross-link clash detection) — depends on FED-01, now unblocked
- **FED-03** (cross-link Copy/Monitor) — depends on FED-01, now unblocked
- Remaining FED-01 polish (visibilityMode, revision pinning UI) — see
  deferred list

I did not pick up a follow-up WP this shift; FED-01 with rebase + verify +
tracker took the full budget.
