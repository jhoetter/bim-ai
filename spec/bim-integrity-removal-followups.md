# BIM Integrity Removal Follow-Ups

This ledger is for cleanup/removal candidates discovered while closing
`spec/bim-integrity-rendering-sketch-methodology-tracker.md`. It exists so work
can continue without blocking on user approval while the user is away.

Rules:

- Do not remove files from the shared worktree just because they are dirty or
  untracked.
- Do not revert unrelated edits from other agents.
- Record cleanup candidates here, keep implementing against the active tracker,
  and only remove items when they are clearly generated/disposable or after user
  review.

## Current Candidates

| ID | Status | Candidate | Reason | Safe Action |
| -- | ------ | --------- | ------ | ----------- |
| `RM-001` | Pending review | `spec/.DS_Store` | Local macOS metadata, unrelated to tracker implementation. | Remove after confirming no other agent intentionally staged it. |
| `RM-002` | Pending review | `/tmp/bim-ai-w25b-origin` | Temporary isolated worktree used by Wave 25-B for renderer closure. | Remove after Wave 25 integration is pushed and no longer needs inspection. |
| `RM-003` | Pending review | Untracked `spec/*prompt*.md` and norms/code-quality planning files | These appear to be parallel planning artifacts outside the active BIM integrity tracker. | Leave untouched until user/owning agent confirms whether to keep or move. |
| `RM-004` | Pending review | Pre-existing dirty files outside current wave ownership | Multiple app/web files were dirty before the current wave and may belong to other agents. | Leave untouched; do not include in BIM integrity commits unless a wave explicitly owns and tests them. |
