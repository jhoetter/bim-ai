# Agent Prompt 2: Browser-Free Sheet Raster And Production Print Contract

## Mission

You are Agent 2 of the next parallel BIM AI parity batch. Move sheet print/export closer to production by replacing the current layout-stamp raster limitation with one deterministic browser-free rasterization or print-contract slice. Do not open a pull request. Commit and push only your branch.

Target workpackages in `spec/revit-production-parity-workpackage-tracker.md`:

- `WP-E05` Sheet canvas and titleblock
- `WP-E06` SVG/PNG/PDF export
- `WP-A02` Evidence package API
- `WP-A03` Playwright evidence baselines
- light `WP-F02` Agent review UI

## Start Procedure

1. Use the branch/worktree assigned to you. If none exists, create one from current `origin/main`:

   ```bash
   git fetch origin
   git switch main
   git pull --ff-only origin main
   git switch -c agent/browser-free-sheet-raster-print
   ```

2. Read first:
   - `spec/revit-production-parity-workpackage-tracker.md`
   - `spec/prd/revit-production-parity-ai-agent-prd.md`
   - `app/bim_ai/sheet_preview_svg.py`
   - `app/bim_ai/routes_api.py`
   - `app/bim_ai/evidence_manifest.py`
   - `app/tests/test_sheet_print_raster_placeholder.py`
   - `packages/web/e2e/evidence-baselines.spec.ts`
   - existing sheet SVG/PDF/export tests

## File Ownership Rules

Own sheet raster/export contract only. Avoid schedule payloads, OpenBIM replay, plan projection semantics, room legends, geometry kernels, and broad Agent Review UI rewrites.

## Allowed Scope

Prefer changes in:

- `app/bim_ai/sheet_preview_svg.py`
- `app/bim_ai/routes_api.py`
- `app/bim_ai/evidence_manifest.py`
- focused sheet raster/export/evidence tests
- `packages/web/e2e/evidence-baselines.spec.ts`
- small `AgentReviewPane` readout only if new evidence metadata needs display
- `spec/revit-production-parity-workpackage-tracker.md`

## Non-Goals

- Do not require network services or manually installed binaries.
- Do not change sheet authoring UX.
- Do not modify schedule, room, IFC, or geometry behavior.
- Do not open a PR.

## Implementation Checklist

- Add one deterministic browser-free raster/print contract improvement over `sheetPrintRasterLayoutStamp_v1`, or clearly version a richer server-side raster surrogate.
- Preserve stable content type, headers, dimensions, hash correlation, and artifact naming.
- Update evidence manifest metadata and tests.
- Add a focused Playwright mock/assertion only if frontend evidence display changes.
- Update tracker rows with exact artifact keys, tests, and remaining print blockers.

## Validation

Run focused checks:

```bash
cd app && .venv/bin/ruff check bim_ai tests && .venv/bin/pytest tests/test_sheet* tests/test_plan_projection_and_evidence_slices.py
cd packages/web && pnpm exec playwright test e2e/evidence-baselines.spec.ts
```

Then run, if practical:

```bash
pnpm verify
```

## Tracker Update

Update `WP-E05`, `WP-E06`, `WP-A02`, `WP-A03`, and any narrow `WP-F02` evidence. Add a Recent Sprint Ledger entry describing the sheet raster/print contract slice.

## Commit And Push

Do not open a PR. Commit and push your branch:

```bash
git status
git diff
git add <changed files>
git commit -m "$(cat <<'EOF'
feat(export): improve sheet print raster contract

EOF
)"
git push -u origin HEAD
```

## Final Report

Return branch, commit SHA, raster/export behavior added, tracker rows updated, validation results, and shared-file merge risks.
