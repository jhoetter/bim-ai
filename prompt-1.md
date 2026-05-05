# Prompt 1 — IFC Site Export And Exchange Evidence Slice

You are a future implementation agent working in `/Users/jhoetter/repos/bim-ai`.

## Mission

Implement a narrow, evidenced OpenBIM slice that carries the existing kernel `site` element through IFC export and exchange evidence without expanding into broader IFC import/replay work.

Start from current `main`, create and work on a dedicated branch such as `prompt-1-ifc-site-export-evidence`, then commit and push that branch. Never create a pull request.

Context to inspect before editing:

- `spec/revit-production-parity-workpackage-tracker.md`, especially `Current Workpackages` and `Recent Sprint Ledger`.
- `spec/prd/revit-production-parity-ai-agent-prd.md`, especially PRD exchange requirements around IFC export/import, declared unsupported categories, IDS validation, and evidence artifacts.
- `spec/ifc-export-wp-x03-slice.md`, which documents the current IFC kernel/export/replay boundary.

## Target workpackages

Update and describe only the relevant impact for these workpackages:

- `WP-X03` IFC export/import: add a bounded `IfcSite` / site exchange evidence slice, keeping arbitrary IFC merge deferred.
- `WP-X05` IDS validation: include deterministic site identity/exchange evidence only if it fits existing IDS/read-back patterns.
- `WP-B06` Rooms and room separation: protect existing `IfcSpace` programme/QTO evidence; do not change room replay semantics unless a focused assertion needs to prove no regression.
- `WP-E03` 3D geometry fidelity: align site export evidence with existing site/glTF geometry claims, but do not add new 3D terrain features.
- `WP-X01` JSON snapshot and command replay: keep existing `site` command/snapshot behavior deterministic and ensure any new exchange evidence does not alter replay semantics.

## Ownership boundaries

Own the smallest server-side slice that proves the kernel site can participate in IFC/export evidence:

- Prefer existing `site` / `upsertSite` semantics from the current kernel. Do not invent a second site model.
- Likely files include `app/bim_ai/export_ifc.py`, `app/bim_ai/evidence_manifest.py`, `app/tests/test_export_ifc.py`, `app/tests/test_ifc_exchange_manifest_offline.py`, and existing site context tests.
- Use existing manifest/read-back helpers and naming conventions. Keep imports at the top of files.
- Keep output deterministic: sorted rows, stable IDs, stable manifest keys, offline-safe behavior when IfcOpenShell is not installed.
- If an IFC-backed path is available, represent the kernel site as `IfcSite` with deterministic identity/reference evidence. If the current architecture already creates spatial roots, extend that path rather than adding a parallel export route.
- If an offline/stub path is used, expose expected site coverage and unsupported/deferred status through the same manifest conventions used by `kernelExpectedIfcKinds`, `ifcSemanticImportScope_v0`, or adjacent exchange payloads.

## Non-goals

Do not implement any of the following:

- `IfcRoof` authoritative replay.
- Typed slab/floor replay expansion or typed slab replay refactors.
- Arbitrary IFC import, populated-document merge, or unconstrained IFC merge.
- Terrain grading, contours, survey/GIS import, context object libraries, or new site authoring UI.
- New roof/slab geometry, hosted boolean topology, or broad cut-solid changes.
- Web UI work unless a tiny readout is already required by an existing failing test.
- Tracker inflation. Rows should remain `partial` unless an existing done rule is genuinely satisfied.

## Implementation checklist

1. Create a branch from current `main`, for example:

   ```bash
   cd /Users/jhoetter/repos/bim-ai
   git fetch origin
   git switch main
   git pull --ff-only
   git switch -c prompt-1-ifc-site-export-evidence
   ```

2. Inspect the current site implementation and IFC/export evidence paths:
   - Existing `site` element and `upsertSite` behavior.
   - `export_ifc.py` spatial graph creation, `inspect_kernel_ifc_semantics()`, and `summarize_kernel_ifc_semantic_roundtrip()`.
   - IFC manifest/offline helpers and `evidence_manifest.py` evidence-package payloads.
   - Existing tests in `test_export_ifc.py`, `test_ifc_exchange_manifest_offline.py`, and site context tests.

3. Add the smallest production-shaped site exchange evidence:
   - Count or identify kernel `site` elements in IFC expected/exported/read-back evidence.
   - Add deterministic `IfcSite` identity/reference evidence where IfcOpenShell is available.
   - Ensure offline manifest output still declares expected site participation or the precise unavailable reason.
   - Preserve existing `IfcBuildingStorey`, `IfcSpace`, wall/opening, floor/slab void, and stair replay behavior.

4. Add focused tests:
   - IFC-backed test coverage in `app/tests/test_export_ifc.py` when IfcOpenShell is available.
   - Offline/manifest coverage in `app/tests/test_ifc_exchange_manifest_offline.py`.
   - Site context regression coverage in the existing site context tests if the new evidence touches site export helpers.
   - Assertions that roof replay and typed slab replay remain deferred/not emitted.

5. Update the tracker in the same branch as described below.

## Validation

Run focused backend validation before committing:

```bash
cd /Users/jhoetter/repos/bim-ai/app && .venv/bin/ruff check bim_ai tests
cd /Users/jhoetter/repos/bim-ai/app && .venv/bin/pytest tests/test_export_ifc.py tests/test_ifc_exchange_manifest_offline.py
```

Also run the relevant site context tests, using the exact file name present in the repo, for example:

```bash
cd /Users/jhoetter/repos/bim-ai/app && .venv/bin/pytest tests/test_site_context.py
```

If the touched code affects broader evidence package construction, add the smallest focused pytest covering that path. Report any validation that could not be run and why.

## Tracker update requirements

Update `spec/revit-production-parity-workpackage-tracker.md` as part of the implementation branch:

- In `Current Workpackages`, revise the rows for `WP-X03`, `WP-X05`, `WP-B06`, `WP-E03`, and `WP-X01` only where the implemented slice actually changes the current read. Keep statuses conservative.
- Add one `Recent Sprint Ledger` row for this slice. Include the branch/topic name, files or symbols touched at a high level, exact evidence keys added or extended, focused tests run, touched workpackages, and remaining blockers.
- Explicitly mention that `IfcRoof` replay, typed slab replay, arbitrary IFC merge, and broader site/terrain authoring remain deferred.
- Do not edit unrelated tracker rows except as necessary to keep the table coherent.

## Commit/push requirements

Before committing, check `git status` and ensure only intentional implementation, tests, and the required tracker update are staged.

Commit with a concise message such as:

```bash
git commit -m "$(cat <<'EOF'
Add IFC site export evidence slice

EOF
)"
```

Push the branch:

```bash
git push -u origin prompt-1-ifc-site-export-evidence
```

Never create a pull request. In the final handoff, report the branch name, commit SHA, validation results, and any remaining blockers.
