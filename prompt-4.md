# Saved 3D View Clip Authoring And Cutaway Style Slice

## Mission

You are the future implementation agent for this slice. Create and work on a dedicated branch based on the current `main`, for example:

```sh
git fetch origin
git checkout main
git pull --ff-only origin main
git checkout -b prompt-4-3d-view-clip-authoring
```

Implement a focused saved-3D-view authoring slice for persisted viewpoint clip controls and, if it fits cleanly, a small persisted cutaway-style enum. The user-facing goal is that an orbit 3D saved view can be edited as a saved definition: clip cap elevation, clip floor elevation, hidden 3D semantic kinds, and optionally an explicit cutaway style are persisted, replayed, hydrated, and reflected in the 3D HUD / Project Browser evidence readouts.

Do not build a full section/cut-kernel geometry system. This is an authoring and persistence slice for saved viewpoint controls that current rendering/evidence paths can consume.

## Target workpackages

- `WP-E02` — 3D clipping / cutaways. Move from read-only persisted HUD toward editable saved-view clip definitions.
- `WP-E03` — 3D geometry fidelity. Keep this limited to existing clip/cutaway display and evidence semantics; do not introduce true boolean cut solids.
- `WP-C05` — Browser saved views / view properties. Add authoring controls where they naturally belong in the existing saved-view UI/HUD flow.
- `WP-X01` — JSON snapshot and command replay. Ensure all new persisted fields round-trip through commands, snapshots, TypeScript core types, and web hydration.

Current tracker context: `Prompt 5 saved 3D viewpoint clip HUD` already landed a read-only `OrbitViewpointPersistedHud` in `Viewport`, `viewpointOrbit3dEvidenceLine` `cut:` tokens, Project Browser saved-3D-view subtitles, and Vitest coverage. Its known limitation is that there is no separate persisted cutaway-style enum and the HUD is read-only. This prompt should close that specific gap without broadening into production cut geometry.

## Ownership boundaries

Likely files include:

- `app/bim_ai/elements.py` for viewpoint schema fields if a new persisted property is needed.
- `app/bim_ai/commands.py` and `app/bim_ai/engine.py` if command/property support needs to allow the new viewpoint fields.
- `packages/core/src/index.ts` for shared element/command typing.
- `packages/web/src/Viewport.tsx` and `packages/web/src/OrbitViewpointPersistedHud.tsx` for the authoring/readout UI.
- Existing store and UI tests near saved viewpoint, plan projection, Project Browser, or HUD behavior.

Prefer existing command paths such as `updateElementProperty` if they already support safely updating viewpoint fields. Add a new command only if the existing command model cannot express the slice cleanly.

Keep imports at the top of files. For TypeScript unions or enums, use exhaustive handling consistent with repository rules.

## Non-goals

- Do not implement true section boxes, arbitrary clipping planes, CSG, wall/floor/roof/stair cut solids, layered cut surfaces, or cut hatches.
- Do not rewrite the 3D renderer or material system.
- Do not add full view-template editing.
- Do not create a pull request.
- Do not leave prompt files or scratch planning artifacts behind unless they are part of the requested implementation.
- Do not mark any tracker row `done` unless the tracker Done Rule is actually satisfied.

## Implementation checklist

1. Start from current `main` on a dedicated branch such as `prompt-4-3d-view-clip-authoring`.
2. Inspect the existing `viewpoint` element shape, saved viewpoint commands, `updateElementProperty`, `OrbitViewpointPersistedHud`, Project Browser saved-view readouts, and current tests.
3. Add editable controls for saved orbit-3D viewpoint clip fields:
   - `viewerClipCapElevMm`
   - `viewerClipFloorElevMm`
   - `hiddenSemanticKinds3d`
   - optional explicit `cutawayStyle` enum if it is small, persisted, and useful beyond deriving from cap/floor presence.
4. Persist edits through the command/replay path, not local UI-only state.
5. Hydrate persisted values back into the store and active 3D view behavior/readouts.
6. Keep evidence strings deterministic. If a cutaway-style enum is added, make the existing `cut:` token/readout prefer the explicit enum while preserving sensible derived labels for older viewpoints that only have clip fields.
7. Add focused tests:
   - backend property/replay tests if Python schema or command/property allowlists change;
   - `packages/core` typing tests if shared types change;
   - web Vitest coverage for HUD controls, store hydration/readout, and cutaway-style token behavior.
8. Update `spec/revit-production-parity-workpackage-tracker.md` as described below.

## Validation

Run the narrowest relevant checks first, then the required web suite:

```sh
cd packages/web && pnpm test
```

If backend schema, command, or property support changes, also run focused backend checks for the changed area, for example property/replay tests under `app/tests`, plus lint for touched Python paths:

```sh
cd app && .venv/bin/ruff check bim_ai tests
cd app && .venv/bin/pytest <focused-property-or-replay-tests>
```

If `packages/core/src/index.ts` changes, run the repository's package-level typecheck/test command used by nearby work, for example:

```sh
cd packages/core && pnpm typecheck && pnpm test
```

Record exact validation commands and results in the final handoff and in the tracker ledger row.

## Tracker update requirements

Update `spec/revit-production-parity-workpackage-tracker.md` in the same implementation branch.

Required tracker edits:

- Add a `Recent Sprint Ledger` row for this slice. Mention the branch/work source, the exact persisted fields/UI behavior, tests run, and the remaining blockers.
- Update the Current Workpackages rows for `WP-E02`, `WP-E03`, `WP-C05`, and `WP-X01`.
- Keep those rows `partial` unless their full Done Rule is genuinely met.
- For `WP-E02`, emphasize editable persisted saved-view clip controls and evidence readouts.
- For `WP-E03`, explicitly state that true cut solids / full cut-kernel geometry remain deferred.
- For `WP-C05`, mention saved 3D view property authoring and Project Browser/HUD integration.
- For `WP-X01`, mention JSON snapshot/command replay coverage for any new viewpoint properties or enum.

## Commit/push requirements

After implementation and validation:

1. Review the diff for scope control. Only implementation, tests, and the tracker should change.
2. Commit the branch with a concise message describing the saved 3D view clip authoring slice.
3. Push the branch to origin:

```sh
git push -u origin HEAD
```

Never create a pull request. In the final response, report the branch name, commit hash, pushed status, validation commands/results, and any remaining limitations.
