# Prompt 7 — OpenBIM Authoritative Replay Next Slice

You are a future implementation agent working in `/Users/jhoetter/repos/bim-ai`.

Your job is to land one narrow, production-minded OpenBIM authoritative replay increment. This is an implementation prompt, not a planning-only task. Work carefully, keep the diff small, update the tracker, commit, and push. Do **not** open a pull request.

## Operating Instructions

1. Start from the latest `main`.
2. Create and work on a dedicated branch, for example `prompt-7-openbim-authoritative-replay`.
3. Implement the smallest coherent slice that advances the targeted workpackages.
4. Update `spec/revit-production-parity-workpackage-tracker.md`, including:
   - the `Recent Sprint Ledger`;
   - the `Current Workpackages` rows for the workpackages you materially touch.
5. Run focused validation commands. Run `pnpm verify` if practical for the final state.
6. Commit the focused changes with a clear message.
7. Push the branch.
8. Never create a PR.

## Target Workpackages

This slice should primarily advance:

- `WP-X03` IFC export/import;
- `WP-X05` IDS validation;
- `WP-D06` Cleanroom metadata and IDS;
- `WP-X01` JSON snapshot and command replay;
- light `WP-V01` Validation/advisor expansion.

Keep these rows `partial` unless the existing tracker and PRD acceptance clearly justify otherwise. This prompt expects incremental evidence, not a broad parity claim.

## Current Baseline To Preserve

The repository already has OpenBIM slices around:

- `inspect_kernel_ifc_semantics`;
- `summarize_kernel_ifc_semantic_roundtrip`;
- `qtoLinkedProducts`;
- extended `identityPsets` for slab/roof/stair `Reference`;
- `importScopeUnsupportedIfcProducts_v0`;
- `ifcSemanticImportScope_v0`;
- `kernelExpectedIfcKinds` offline manifest evidence;
- `authoritativeReplay_v0` sketches for `createLevel`, `createWall`, wall-hosted `insertDoorOnWall` / `insertWindowOnWall`, and `createRoomOutline`;
- `idsAuthoritativeReplayMap_v0`;
- `engine.try_apply_kernel_ifc_authoritative_replay_v0` additive replay with preflight diagnostics such as `merge_id_collision` and `merge_reference_unresolved`;
- gated IDS / OpenBIM advisories in constraints.

Preserve this behavior. In particular, offline behavior when `IfcOpenShell` is unavailable must continue to work and must remain explicitly covered by tests.

## Required Scope

Add **one** constrained OpenBIM replay increment. Choose the smallest option that fits the current code cleanly:

1. Slab/roof-hosted void replay sketch with explicit skip counts.
2. Populated-document preflight diagnostics hardening for authoritative replay merge.
3. Richer IDS mismatch quick-fix evidence pointing to authoritative replay rows.

Do not implement all three unless the code is already structured so tightly that a second item is effectively free and remains low risk. Prefer one complete, evidenced increment over a scattered diff.

### Option A: Slab/Roof-Hosted Void Replay Sketch

Extend the IFC semantic roundtrip / authoritative replay sketch to recognize a narrow, deterministic class of slab- or roof-hosted void candidates, then report them as replay-sketch evidence.

Constraints:

- This is a sketch/evidence increment, not a geometry kernel.
- Do not attempt boolean CSG, arbitrary `IfcOpeningElement` placement, or broad IFC import.
- Only emit replay rows for cases the existing semantic model can represent safely.
- For unsupported voids, emit explicit deterministic skip counts and reasons.
- Preserve additive merge behavior; do not mutate existing elements implicitly.
- Preserve offline manifests and skip behavior when `IfcOpenShell` is unavailable.

Examples of acceptable evidence:

- `authoritativeReplay_v0` gains a bounded `createFloorOpening` / slab-void sketch only if such a command already exists and is replayable.
- If no safe command exists, expose deterministic `slabRoofHostedVoidReplaySkipped_v0` evidence with counts by host kind and reason.
- `idsAuthoritativeReplayMap_v0` or adjacent import-scope evidence points to the relevant replay or skip rows.

### Option B: Populated-Document Preflight Hardening

Harden `try_apply_kernel_ifc_authoritative_replay_v0` or nearby merge helpers so populated documents produce better diagnostics before additive replay.

Constraints:

- Keep the merge constrained to authoritative replay rows. Do not build a broad IFC importer.
- Add deterministic preflight diagnostics for cases such as:
  - command rows that would create duplicate semantic identities;
  - host or level references that resolve ambiguously in the target document;
  - replay rows skipped because an equivalent element already exists;
  - unsupported command kinds in `authoritativeReplay_v0`.
- Diagnostics should be stable, sorted, and testable.
- Do not weaken existing `merge_id_collision` / `merge_reference_unresolved` protections.
- Preserve successful additive replay for supported empty or compatible documents.

### Option C: IDS Mismatch Quick-Fix Evidence

Make IDS mismatch advisories more actionable by pointing to authoritative replay rows and evidence paths.

Constraints:

- Do not add broad automatic fixes that mutate the model without user review.
- If a `quickFixCommand` is inappropriate, expose structured evidence that tells an agent/user exactly which `authoritativeReplay_v0` row or `idsAuthoritativeReplayMap_v0` row supports the mismatch.
- Keep advisories gated so they only appear when IFC / IDS semantic evidence exists.
- Preserve deterministic sorting and stable message text for tests.

## Suggested Files

Use the existing architecture and touch only files needed for the chosen slice. Likely files:

- `spec/ifc-export-wp-x03-slice.md`
- `app/bim_ai/export_ifc.py`
- `app/bim_ai/ifc_stub.py`
- `app/bim_ai/kernel_ifc_opening_replay_v0.py`
- `app/bim_ai/engine.py` only for constrained replay / merge helpers
- `app/bim_ai/constraints.py` only for OpenBIM / IDS advisories
- `app/tests/test_export_ifc.py`
- `app/tests/test_ifc_exchange_manifest_offline.py`
- `spec/revit-production-parity-workpackage-tracker.md`

Do not edit web UI files unless the chosen IDS/advisor evidence already has a directly relevant UI test gap and the change remains trivial. This prompt is backend/OpenBIM-first.

## Non-Goals

Do not implement:

- new geometry kernels;
- boolean CSG;
- arbitrary IFC import;
- schedules beyond incidental evidence needed for the selected replay slice;
- sheet raster work;
- room legends;
- level/datum features except existing replay commands already used by the OpenBIM path;
- broad validation framework rewrites;
- unrelated refactors or formatting churn.

## Implementation Guidance

Read the existing OpenBIM path before editing. The likely flow is:

1. Export or inspect kernel IFC semantics.
2. Summarize semantic roundtrip evidence.
3. Build or apply `authoritativeReplay_v0` rows.
4. Surface import-scope / IDS evidence.
5. Gate constraints/advisories from that evidence.

Keep the slice deterministic:

- sort generated rows by stable IDs / host IDs / IFC entity labels where available;
- include explicit counts for applied, skipped, unsupported, and diagnostic rows where relevant;
- prefer structured evidence fields over prose-only messages;
- maintain existing field names unless you are adding a clearly versioned field;
- add new `_v0` / `_v1` evidence names only when needed and document them in tests and tracker notes.

Preserve offline behavior:

- when `IfcOpenShell` is unavailable, export/manifest tests should still pass;
- offline manifests should still declare expected IFC kinds and skip state rather than failing;
- avoid imports or code paths that require `ifcopenshell` at module import time.

## Acceptance Criteria

The final branch should satisfy all of the following:

- A dedicated branch exists and is pushed.
- No PR is opened.
- The implementation adds exactly one narrow OpenBIM authoritative replay increment from the options above.
- Existing IFC export/import and offline manifest behavior remains intact when `IfcOpenShell` is unavailable.
- New or updated tests prove the chosen behavior, including deterministic skip/diagnostic/evidence rows as applicable.
- `spec/revit-production-parity-workpackage-tracker.md` is updated in both `Recent Sprint Ledger` and relevant `Current Workpackages` rows.
- `WP-X03`, `WP-X05`, `WP-D06`, `WP-X01`, and light `WP-V01` progress is described accurately without overstating parity.
- No geometry kernel, broad IFC import, schedule, sheet raster, room legend, or unrelated level/datum work is introduced.
- The diff is scoped, reviewable, and uses existing local patterns.

## Validation Commands

Run focused backend tests first. Adjust exact test selectors to match the final files touched:

```bash
cd app
python -m pytest tests/test_export_ifc.py tests/test_ifc_exchange_manifest_offline.py
python -m pytest tests/test_constraints.py -k "ifc or ids or exchange"
```

If the chosen slice touches replay/engine helpers, also run the relevant replay tests, for example:

```bash
cd app
python -m pytest tests -k "authoritative_replay or ifc_authoritative or bundle_replay"
```

Run repository verification if practical:

```bash
pnpm verify
```

If a broad verification command is too slow or fails for a pre-existing unrelated reason, record exactly what was run and what remains unverified in the final response and in the commit context if appropriate.

## Conflict-Avoidance Rules

- Before editing, check current git status and inspect relevant files.
- Do not overwrite unrelated user or branch changes.
- Keep tracker edits minimal and localized to the relevant ledger row and workpackage rows.
- Avoid renaming existing evidence fields unless tests prove every consumer is updated.
- Avoid changing snapshot/export digests except where the selected evidence increment intentionally requires it and tests are updated.
- Do not introduce mandatory runtime dependencies on `IfcOpenShell`.
- Do not move shared helpers between modules unless needed to avoid an import cycle.
- If existing code already has a helper for canonical JSON, sorted rows, replay diagnostics, or IFC offline skips, reuse it.
- If conflicts appear, resolve them in favor of preserving existing behavior plus this narrow increment; do not use destructive git commands.

## Expected Final Response From The Implementing Agent

The final response should include:

- branch name;
- commit SHA;
- push status;
- concise summary of the implemented OpenBIM replay increment;
- tracker rows updated;
- validation commands run and results;
- any remaining risks or skipped broad verification.
