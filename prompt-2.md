# Agent Prompt 2: Authoritative IFC Import Replay Slice

## Mission

You are Agent 2 of the next parallel BIM AI parity batch. Turn the current OpenBIM import replay sketch into one narrow authoritative replay path. Start with a deterministic subset, such as IFC storeys/levels and spaces or walls, and produce command sketches that can be applied or compared against an existing document. Do not open a pull request. Commit and push only your branch.

Target workpackages in `spec/revit-production-parity-workpackage-tracker.md`:

- `WP-X03` OpenBIM import/edit/export round-trip
- `WP-D06` External references/imported CAD/RVT/IFC
- `WP-X05` OpenBIM validation/governance
- light `WP-X01` IFC 4.3 export identity and quantities

## Start Procedure

1. Use the branch/worktree assigned to you. If none exists, create one from current `origin/main`:

   ```bash
   git fetch origin
   git switch main
   git pull --ff-only origin main
   git switch -c agent/ifc-authoritative-replay-slice
   ```

2. Read first:
   - `spec/revit-production-parity-workpackage-tracker.md`
   - `spec/prd/revit-production-parity-ai-agent-prd.md`
   - `spec/ifc-export-wp-x03-slice.md`
   - `app/bim_ai/export_ifc.py`
   - `app/bim_ai/ifc_stub.py`
   - `app/bim_ai/commands.py`
   - `app/bim_ai/elements.py`
   - `app/tests/test_export_ifc.py`

## File Ownership Rules

Avoid broad document merge and avoid UI changes. The done slice should prove one authoritative import/replay pathway, not solve all IFC reconciliation. Do not touch schedule quantity derivation, plan/view editor UI, or evidence raster artifact work.

## Allowed Scope

Prefer changes in:

- `app/bim_ai/export_ifc.py`
- `app/bim_ai/ifc_stub.py`
- small IFC helper modules, if already present
- `app/tests/test_export_ifc.py` or adjacent IFC/offline tests
- `spec/ifc-export-wp-x03-slice.md`, if behavior changes
- `spec/revit-production-parity-workpackage-tracker.md`

## Non-Goals

- Do not implement full IFC merge/reconciliation.
- Do not add a broad command executor pathway unless it is already present and needs a narrow test hook.
- Do not introduce heavyweight mandatory dependencies for offline CI.
- Do not alter unrelated IFC export identity behavior.
- Do not open a PR.

## Implementation Checklist

- Pick one authoritative replay subset and document the subset explicitly.
- Generate deterministic command sketches from IFC-derived levels/storeys plus one model element family, such as spaces or walls.
- Include comparison/replay metadata that distinguishes authoritative replay from unsupported product reporting.
- Preserve offline behavior through `ifc_stub.py` when IfcOpenShell is unavailable.
- Add tests for deterministic command sketches, unsupported products, and offline fallback behavior.
- Update tracker rows with the exact subset implemented and the remaining import/merge blockers.

## Validation

Run focused checks:

```bash
cd app && ruff check bim_ai tests && pytest tests/test_export_ifc.py
```

Then run, if practical:

```bash
pnpm verify
```

## Tracker Update

Update `WP-X03`, `WP-D06`, `WP-X05`, and any affected `WP-X01` evidence. Add a Recent Sprint Ledger entry describing the authoritative replay subset, tests, and remaining unsupported IFC scope.

## Commit And Push

Do not open a PR. Commit and push your branch:

```bash
git status
git diff
git add <changed files>
git commit -m "$(cat <<'EOF'
feat(openbim): add authoritative ifc replay slice

EOF
)"
git push -u origin HEAD
```

## Final Report

Return branch, commit SHA, replay subset, command sketch examples, tracker rows updated, validation results, and shared-file merge risks.
