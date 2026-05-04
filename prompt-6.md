# Prompt 6 — Layered Assembly Geometry Witness Slice

You are a senior implementation agent working in `/Users/jhoetter/repos/bim-ai`.

Your task is to implement one small, production-parity-oriented geometry evidence slice for layered assemblies. This is a bounded physical fidelity improvement, not a broad modeling rewrite.

## Operating Rules

- Create and work on a dedicated branch from the current base branch before editing code.
- Commit your changes and push the branch when complete.
- Do not create a pull request.
- Keep the diff focused on this prompt. Do not opportunistically refactor unrelated systems.
- Update `spec/revit-production-parity-workpackage-tracker.md`, including both:
  - `Current Workpackages`
  - `Recent Sprint Ledger`
- Preserve existing tracker history. If prior rows mention other Prompt 6 work, do not rewrite them except where a narrow update is required for this new slice.
- Do not introduce full constructive solid geometry. This prompt asks for witness metadata and alignment evidence, not per-layer boolean solids.

## Target Workpackages

Advance these tracker rows only as far as the implemented evidence supports:

- `WP-B02` Walls, doors, windows, hosted openings
- `WP-B03` Floors/slabs and slab openings
- `WP-B04` Roofs
- `WP-D05` Materials/layer catalogs
- `WP-E03` 3D geometry fidelity
- `WP-E04` Section/elevation views
- `WP-X02` glTF export

Expected status outcome: rows should generally remain `partial` unless an existing tracker rule clearly says the slice closes acceptance. This work should add evidenced progress, not claim complete Revit parity.

## Goal

Add one bounded layered assembly geometry witness slice that makes material/layer stack information visible and testable across section and glTF/export paths.

Choose exactly one primary physical fidelity improvement from this list:

1. Roof typed stack evidence
2. Per-layer stack witness metadata
3. Mitred/merged join evidence
4. Layer-aware cut/export hints

Prefer a slice that can share helper logic across section projection and glTF/export. For example, a typed roof/floor/wall layer stack resolver that produces deterministic witness rows can feed both `section_projection_primitives` and `export_gltf` without creating real per-layer solids.

## Suggested Files

Inspect the repository first and follow existing local patterns. Likely files include:

- `app/bim_ai/material_assembly_resolve.py`
- `app/bim_ai/section_projection_primitives.py`
- `app/bim_ai/export_gltf.py`
- `app/bim_ai/cut_solid_kernel.py` if the selected slice needs cut/export alignment hints
- `app/bim_ai/wall_join_evidence.py` if the selected slice is join evidence
- `app/tests/test_layered_assembly_cut_alignment.py`
- `app/tests/test_export_gltf.py`
- `app/tests/test_material_assembly_schedule.py`

Use the suggested files only where appropriate. If the existing code has better homes for this logic, use them, but keep the implementation narrow.

## Recommended Implementation Shape

Start by locating the current typed material assembly flow for walls, floors/slabs, and roofs. Identify how layer catalogs are resolved, how section primitives currently expose wall/floor/roof metadata, and how glTF manifest extension payloads are assembled.

Then implement a single deterministic helper that turns an element plus its resolved type/material assembly into a compact witness payload. The witness should be stable under replay and suitable for tests. Include only fields that are backed by existing model data or clearly derived from it, such as:

- element id
- host kind, such as `wall`, `floor`, `roof`
- type id, when available
- layer count
- total layer thickness in millimeters
- per-layer material ids or names if already available
- per-layer thicknesses in millimeters
- cut/export thickness used by the mono-prism or mono-slab proxy
- boolean or reason code showing whether the layer stack matches the proxy cut thickness
- unsupported or skipped reason when data is incomplete

Make this helper reusable from both section and export paths where practical. Avoid duplicating stack math separately in `section_projection_primitives.py` and `export_gltf.py`.

If you choose roof typed stack evidence, ensure typed roofs are included in the witness payload and that existing wall/floor behavior is not regressed.

If you choose per-layer stack witness metadata, expose compact layer summaries in section primitives and in the glTF/export manifest extension payload.

If you choose mitred/merged join evidence, keep it evidence-only: deterministic join rows, adjacency/angle classification, and merge/mitre hints are acceptable; real merged mesh CSG is out of scope.

If you choose layer-aware cut/export hints, encode the alignment between the resolved layer stack and the existing cut/export proxy. Do not create per-layer solids.

## Non-Goals

Do not implement any of the following:

- Schedule UI
- Sheet raster or print raster behavior
- OpenBIM replay/import/export expansion beyond any existing glTF witness payload touched by this slice
- Room legends
- Broad web UI
- Full CSG
- True per-layer mesh generation
- Large geometry kernel rewrites

## Tracker Update Requirements

Update `spec/revit-production-parity-workpackage-tracker.md` after implementation.

In `Current Workpackages`, update only the rows directly supported by the new evidence. Mention the exact helper, payload, or tests added. Keep status/progress conservative.

In `Recent Sprint Ledger`, add a new row for this branch. The row should summarize:

- the selected Prompt 6 slice
- the new helper or payload names
- which section/export surfaces expose the witness
- the focused tests added or updated
- explicit blockers, especially that meshes remain mono-prism/mono-slab or evidence-only where applicable
- the touched workpackages from the target list

Do not delete or rewrite unrelated ledger rows.

## Acceptance Criteria

The implementation is acceptable when all of the following are true:

- A dedicated branch exists and contains the implementation.
- Changes are committed and pushed.
- No pull request is created.
- Exactly one bounded physical fidelity improvement from this prompt is implemented.
- Shared helper logic is used across section and glTF/export paths where practical.
- Section/elevation evidence exposes the new layered assembly witness or hint for the selected host kinds.
- glTF/export evidence exposes the same conceptual witness through the existing manifest or extension pattern.
- Tests cover the new witness payload and at least one replay-stable deterministic ordering case.
- Tests prove incomplete or unsupported assembly data is handled deterministically, without crashing.
- Tracker updates include `Current Workpackages` and `Recent Sprint Ledger`.
- The final response reports the branch name, commit hash, push status, validation commands run, and any skipped validation.

## Validation Commands

Run focused tests first. Adjust exact test selectors to match the repository's test layout:

```bash
pnpm --dir app test -- test_layered_assembly_cut_alignment
pnpm --dir app test -- test_export_gltf
pnpm --dir app test -- test_material_assembly_schedule
```

If the repository uses `pytest` directly for app tests, use the equivalent focused commands, for example:

```bash
pytest app/tests/test_layered_assembly_cut_alignment.py app/tests/test_export_gltf.py app/tests/test_material_assembly_schedule.py
```

Run broader verification if practical:

```bash
pnpm verify
```

If `pnpm verify` is too slow or blocked by an existing unrelated failure, report that clearly and include the focused test results.

## Conflict-Avoidance Rules

- Before editing, inspect `git status` and the target files. Treat existing uncommitted changes as user work unless you know you created them.
- Do not overwrite unrelated changes in shared files.
- If a file has unrelated edits, make the smallest possible patch around the required code.
- Do not run destructive git commands such as `git reset --hard` or `git checkout --` unless explicitly authorized.
- If the tracker already has nearby entries for layered assemblies or prior Prompt 6 work, append a distinct row for this slice rather than collapsing history.
- Keep new identifiers versioned and explicit, for example `layeredAssemblyWitness_v0`, `roofTypedStackEvidence_v0`, or a similarly local convention that matches existing payload names.
- Keep deterministic ordering stable: sort witness rows by host kind, element id, and type id or by the repository's existing canonical ordering convention.
- Keep numeric output stable: round or normalize millimeter values using existing helper conventions rather than ad hoc formatting.
- Avoid inline imports. Keep imports at the top of files.
- For TypeScript union or enum edits, use exhaustive switch handling.
