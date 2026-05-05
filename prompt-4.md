# Prompt 4 - Saved 3D View Clip Export And Section Box Evidence V1

## Mission

You are implementing wave 2 of the remaining 4 scoped Revit Production Parity v1 closeout waves.

Close the remaining evidence gap around saved 3D view clipping, cutaway state, and export/readback observability. The tracker already indicates saved `orbit_3d` clip/cutaway readouts exist, but WP-E02 3D clipping / cutaways remains partial. Your mission is to make saved 3D view section box and clip state deterministic, persisted, exported, and verifiable without expanding into a full renderer or mesh clipping rewrite.

Prioritize evidence that proves the current v1 behavior is production-parity bounded: saved 3D view clip metadata survives round trips, is visible in summaries/manifests, has clear project browser/HUD evidence where appropriate, and does not regress browser performance.

## Target Workpackages

- WP-E02 3D clipping / cutaways
- WP-E03 3D geometry fidelity
- WP-X02 glTF export
- WP-C05 Project browser hierarchy
- WP-P01 Browser performance budget

## Scope

Add deterministic saved 3D view section box and clip export evidence across backend export/readback surfaces and frontend evidence surfaces as needed.

Expected implementation areas:

- Persisted clip bounds evidence:
  - Ensure saved 3D views with section box or clip/cutaway metadata expose deterministic persisted bounds.
  - Include enough fields to prove min/max bounds, enabled/disabled state, and saved view identity survive model summary/export/readback flows.
  - Prefer existing saved view, evidence, model summary, and export manifest structures over creating parallel data models.

- Hidden category counts:
  - Surface deterministic hidden category counts for saved 3D view evidence.
  - Keep this as count/readout evidence unless the existing system already has richer category-level visibility metadata.
  - Avoid changing category semantics outside the saved 3D view evidence path.

- glTF/export manifest readback:
  - Add or extend glTF/export manifest metadata so saved 3D view clip/section box state can be read back from the exported artifact or companion manifest.
  - Include saved view id/name, clip enabled state, persisted clip bounds, hidden category count, and any existing geometry fidelity summary fields that are relevant.
  - Validate through readback tests rather than only checking in-memory export inputs.

- Project browser evidence line:
  - Add a concise project browser evidence line for saved 3D views that indicates section box/clip evidence is present.
  - Keep this compatible with the current project browser hierarchy and naming conventions.
  - Do not redesign browser grouping, tree state, or view authoring.

- Browser budget impact row:
  - Add or update a browser performance budget row for the saved 3D view clip/export evidence path.
  - The row should make the expected impact explicit and bounded, especially if new metadata is displayed in `ProjectBrowser`, `Viewport`, or HUD surfaces.
  - If no frontend changes are needed, still update the evidence/budget documentation to record the expected no-regression impact.

- Tests:
  - Add backend tests for deterministic section box/clip metadata persistence, model summary evidence, export manifest generation, and manifest/readback behavior.
  - Add or update frontend tests only if `Viewport`, `ProjectBrowser`, HUD, or related display code changes.
  - Prefer focused tests that assert stable evidence fields and counts over broad snapshot churn.

## Non-goals

- Do not implement real boolean clipped mesh export unless the existing export pipeline already makes this simple and low-risk.
- Do not overhaul full 3D view authoring.
- Do not rewrite the visual renderer.
- Do not broaden saved view behavior beyond the bounded evidence needed for v1 closeout.
- Do not refactor unrelated export, project browser, or geometry fidelity systems.
- Do not add compatibility shims for unshipped branch-only behavior.

## Validation

Run focused validation first, then broaden only where your changes justify it.

Backend validation should include:

```bash
ruff check .
pytest -q tests -k "export_gltf or model_summary or evidence"
```

If the repository has narrower established test paths for these slices, run the equivalent focused tests for:

- `export_gltf`
- `model_summary`
- saved view / section box / clip evidence
- export manifest readback

Frontend validation, if `Viewport`, `ProjectBrowser`, HUD, or related web display code changes, should include:

```bash
npm run typecheck
npm run test -- --run Viewport ProjectBrowser HUD
```

If this repo uses a different package manager or test script names, use the existing equivalent web typecheck and Vitest commands for the changed frontend packages.

Record any commands that could not be run, including the reason.

## Tracker And Git

- Update `spec/revit-production-parity-workpackage-tracker.md` with Recent Sprint Ledger and affected rows.
- Create a dedicated branch from `main`, for example `prompt-4-saved-3d-clip-export-evidence`.
- Commit your changes and push the branch.
- Do not open a pull request.
