# Agent Prompt 2: Sheet Print Raster Service And Viewport Geometry Evidence

## Mission

You are Agent 2 of the next parallel BIM AI parity batch. Move sheet export beyond the current 1x1 hash placeholder by adding one deterministic local print-raster service slice or richer production viewport geometry evidence. The goal is to make sheet export closer to production documentation without changing schedule definitions or model kernels. Do not open a pull request. Commit and push only your branch.

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
   git switch -c agent/sheet-print-raster-viewport-evidence
   ```

2. Read first:
   - `spec/revit-production-parity-workpackage-tracker.md`
   - `spec/prd/revit-production-parity-ai-agent-prd.md`
   - `app/bim_ai/sheet_preview_svg.py`
   - `app/bim_ai/routes_api.py`
   - `app/bim_ai/evidence_manifest.py`
   - `packages/web/src/workspace/AgentReviewPane.tsx`
   - existing sheet SVG/PDF/raster/evidence tests and Playwright evidence baselines

## File Ownership Rules

Own sheet export and evidence-package surface only. Avoid changing plan projection semantics, schedule payloads, OpenBIM replay, room derivation, section primitive generation, and general Workspace UI.

## Allowed Scope

Prefer changes in:

- `app/bim_ai/sheet_preview_svg.py`
- `app/bim_ai/routes_api.py`
- `app/bim_ai/evidence_manifest.py`
- focused sheet export/raster/evidence tests
- `packages/web/e2e/evidence-baselines.spec.ts`
- small `AgentReviewPane` readout only if new evidence metadata needs display
- `spec/revit-production-parity-workpackage-tracker.md`

## Non-Goals

- Do not require an external browser service or network dependency.
- Do not rewrite sheet canvas authoring.
- Do not change schedule or plan crop behavior.
- Do not add broad image-processing dependencies unless already present and justified.
- Do not open a PR.

## Implementation Checklist

- Replace or extend the placeholder raster path with a deterministic locally generated PNG contract, or add richer viewport interior geometry evidence that closes a print/export blocker.
- Preserve stable hashes, filenames, and evidence manifest keys.
- Add route/export tests that assert content type, stable headers/metadata, and correlation with sheet SVG.
- If the UI displays new metadata, add a focused Vitest or Playwright assertion.
- Update tracker rows with exact artifact keys, route/test names, and remaining print-raster blockers.

## Validation

Run focused checks:

```bash
cd app && .venv/bin/ruff check bim_ai tests && .venv/bin/pytest tests/test_sheet* tests/test_evidence_manifest_closure.py tests/test_sheet_print_raster_placeholder.py
cd packages/web && pnpm exec vitest run src/workspace && pnpm exec playwright test e2e/evidence-baselines.spec.ts
```

Then run, if practical:

```bash
pnpm verify
```

## Tracker Update

Update `WP-E05`, `WP-E06`, `WP-A02`, `WP-A03`, and any narrow `WP-F02` evidence. Add a Recent Sprint Ledger entry describing the sheet print/export slice.

## Commit And Push

Do not open a PR. Commit and push your branch:

```bash
git status
git diff
git add <changed files>
git commit -m "$(cat <<'EOF'
feat(export): add deterministic sheet print raster slice

EOF
)"
git push -u origin HEAD
```

## Final Report

Return branch, commit SHA, export/raster behavior added, tracker rows updated, validation results, and shared-file merge risks.
