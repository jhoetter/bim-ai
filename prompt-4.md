# Agent Prompt 4: OpenBIM Space/Room Replay And IDS Mapping Slice

## Mission

You are Agent 4 of the next parallel BIM AI parity batch. Extend `authoritativeReplay_v0` beyond levels/walls with one narrow room/space or opening replay path, plus IDS mismatch mapping that remains deterministic and offline-safe. Do not open a pull request. Commit and push only your branch.

Target workpackages in `spec/revit-production-parity-workpackage-tracker.md`:

- `WP-X03` IFC export/import
- `WP-D06` Cleanroom metadata and IDS
- `WP-X05` IDS validation
- `WP-X01` JSON snapshot and command replay
- light `WP-B06` Rooms and room separation

## Start Procedure

1. Use the branch/worktree assigned to you. If none exists, create one from current `origin/main`:

   ```bash
   git fetch origin
   git switch main
   git pull --ff-only origin main
   git switch -c agent/openbim-space-room-replay
   ```

2. Read first:
   - `spec/revit-production-parity-workpackage-tracker.md`
   - `spec/prd/revit-production-parity-ai-agent-prd.md`
   - `spec/ifc-export-wp-x03-slice.md`
   - `app/bim_ai/export_ifc.py`
   - `app/bim_ai/ifc_stub.py`
   - `app/bim_ai/commands.py`
   - existing IFC/offline/IDS tests

## File Ownership Rules

Own OpenBIM replay and IDS mapping only. Avoid engine-side document merge unless the slice is purely compare/apply-sketch metadata. Do not touch schedule UI, evidence diff UI, material catalog work, or roof/stair geometry.

## Allowed Scope

Prefer changes in:

- `app/bim_ai/export_ifc.py`
- `app/bim_ai/ifc_stub.py`
- `spec/ifc-export-wp-x03-slice.md`
- IFC/offline tests
- IDS mapping/advisory tests only when directly tied to the replay slice
- `spec/revit-production-parity-workpackage-tracker.md`

## Non-Goals

- Do not implement full IFC document merge.
- Do not require IfcOpenShell for offline tests.
- Do not change schedule derivation or UI.
- Do not add broad command execution from IFC unless it remains sketch/metadata only.
- Do not open a PR.

## Implementation Checklist

- Add one narrow replay extension, such as `IfcSpace` to room/space command sketch metadata or an opening replay sketch.
- Keep outputs deterministic and explicitly versioned.
- Preserve offline fallback behavior through `ifc_stub.py`.
- Add IDS mismatch mapping only for the chosen subset.
- Add tests for available and offline behavior.
- Update tracker rows with exact replay subset and remaining OpenBIM blockers.

## Validation

Run focused checks:

```bash
cd app && ruff check bim_ai tests && pytest tests/test_export_ifc.py tests/test_ifc_exchange_manifest_offline.py tests/test_exchange_ifc_geometry_skips_advisory.py
```

Then run, if practical:

```bash
pnpm verify
```

## Tracker Update

Update `WP-X03`, `WP-D06`, `WP-X05`, `WP-X01`, and any narrow `WP-B06` evidence. Add a Recent Sprint Ledger entry describing the OpenBIM replay/IDS mapping slice.

## Commit And Push

Do not open a PR. Commit and push your branch:

```bash
git status
git diff
git add <changed files>
git commit -m "$(cat <<'EOF'
feat(openbim): add space replay ids mapping slice

EOF
)"
git push -u origin HEAD
```

## Final Report

Return branch, commit SHA, replay subset, IDS mapping behavior, tracker rows updated, validation results, and shared-file merge risks.
