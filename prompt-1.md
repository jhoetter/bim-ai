# Agent Prompt 1: Sheet Crop-To-Projection And Print Fidelity

## Mission

You are Agent 1 of the next parallel BIM AI parity batch. Finish the sheet viewport crop slice: viewport crop metadata already persists, but projection/export still needs to consume sheet viewport crop semantics instead of only echoing crop text. Own the sheet/projection/export spine for this wave. Do not open a pull request. Commit and push only your branch.

Target workpackages in `spec/revit-production-parity-workpackage-tracker.md`:

- `WP-E05` Sheet canvas and titleblock
- `WP-E06` SVG/PNG/PDF export
- `WP-X01` JSON snapshot and command replay
- light `WP-A03` Playwright evidence baselines

## Start Procedure

1. Use the branch/worktree assigned to you. If none exists, create one from current `origin/main`:

   ```bash
   git fetch origin
   git switch main
   git pull --ff-only origin main
   git switch -c agent/sheet-crop-projection-print
   ```

2. Read first:
   - `spec/revit-production-parity-workpackage-tracker.md`
   - `spec/prd/revit-production-parity-ai-agent-prd.md`
   - `app/bim_ai/plan_projection_wire.py`
   - `app/bim_ai/sheet_preview_svg.py`
   - `app/bim_ai/sheet_preview_pdf.py`
   - `app/bim_ai/evidence_manifest.py`
   - sheet viewport authoring/rendering files
   - existing sheet, projection, PDF/SVG, and evidence baseline tests

## File Ownership Rules

This prompt owns sheet viewport crop-to-projection/export behavior for this wave. Keep `Workspace.tsx` edits out unless unavoidable. Do not change plan-view template semantics, room derivation, IFC/OpenBIM import, or broad evidence manifest lifecycle fields owned by other prompts.

## Allowed Scope

Prefer changes in:

- `app/bim_ai/plan_projection_wire.py`, only for applying sheet viewport crop context to projected content
- `app/bim_ai/sheet_preview_svg.py`
- `app/bim_ai/sheet_preview_pdf.py`
- sheet viewport rendering/authoring helpers, only if crop semantics require it
- focused tests around replayed `viewportsMm`, crop projection, SVG/PDF, and evidence baselines
- `spec/revit-production-parity-workpackage-tracker.md`

## Non-Goals

- Do not implement a full print service.
- Do not redesign plan projection generally.
- Do not add new element kinds.
- Do not change OpenBIM import/export semantics.
- Do not open a PR.

## Implementation Checklist

- Make sheet viewport crop metadata affect at least one deterministic projected/exported representation, not just a text suffix.
- Preserve replay determinism for `upsertSheetViewports`.
- Add regression coverage proving sheet viewport crop changes the projected/exported content or its deterministic crop window.
- Keep any screenshot baseline update tightly scoped and justified.
- Document remaining full print/raster blockers in the tracker.

## Validation

Run focused checks:

```bash
cd app && ruff check bim_ai tests && pytest tests/test_upsert_sheet_viewports.py tests/test_sheet* tests/test_plan_projection_and_evidence_slices.py
cd packages/web && pnpm exec tsc -p tsconfig.json --noEmit && pnpm test -- Sheet
```

Then run, if practical:

```bash
pnpm verify
```

## Tracker Update

Update only rows you materially changed, likely `WP-E05`, `WP-E06`, `WP-X01`, and maybe `WP-A03`. Include exact crop semantics, command names, artifact/export evidence, and tests.

## Commit And Push

Do not open a PR. Commit and push your branch:

```bash
git status
git diff
git add <changed files>
git commit -m "$(cat <<'EOF'
feat(sheets): apply viewport crop to projection export

EOF
)"
git push -u origin HEAD
```

## Final Report

Return branch, commit SHA, sheet crop behavior added, export/evidence artifact changes, tracker rows updated, validation results, and shared-file merge risks.
