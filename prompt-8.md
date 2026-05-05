# Prompt 8: Advisor And Agent Review Gap Navigation Slice

## Mission

You are the future implementation agent for BIM AI. Create a focused vertical slice that makes existing advisor findings and Agent Review actions easier to navigate, inspect, and diagnose.

Start from the current `main` branch and work on a dedicated implementation branch, for example:

```sh
git fetch origin
git checkout main
git pull --ff-only origin main
git checkout -b prompt-8-advisor-agent-review-gap-navigation
```

The product goal is to surface existing validation/advisor advisories, Agent Review actions, evidence refs, BCF coordination hints, and replay diagnostics in a way that helps a human get from a gap/action to the relevant UI context or diagnostic payload. Keep this as a navigation and diagnostics slice over existing capabilities.

## Target workpackages

Use `spec/revit-production-parity-workpackage-tracker.md` and `spec/prd/revit-production-parity-ai-agent-prd.md` as context. The target workpackages are:

- `WP-V01` Validation/advisor expansion: surface existing advisor findings with severity, refs, recommended view/context, and diagnostic payloads.
- `WP-F01` Agent generation protocol: preserve the existing assumption/deviation and follow-through framing without inventing a new agent protocol.
- `WP-F02` Agent review UI: improve Agent Review action discoverability, navigation affordances, and diagnostics around existing action rows.
- `WP-F03` Automated evidence comparison: expose existing evidence comparison, ingest, and blocker metadata more clearly; do not implement a new diff engine.
- `WP-D03` Schedule UI: connect existing schedule/sheet advisories and schedule placement actions to useful UI context.
- `WP-E05` Sheet canvas and titleblock: navigate to existing sheet viewport/titleblock evidence and existing sheet QA findings where possible.
- `WP-X04` BCF export/import: surface existing BCF topic/ref metadata as coordination context; do not implement real issue creation.

Relevant current tracker context includes: `schedule_sheet_viewport_missing`, `sheet_missing_titleblock`, `sheet_viewport_zero_extent`, `room_finish_metadata_hint`, gated IFC advisories, `agentReviewActions_v1`, `evidenceAgentFollowThrough_v1`, `stagedArtifactLinks_v1`, `serverPngByteIngest_v1`, `evidence_diff_ingest_fix_loop_v1`, `bcfTopicsIndex_v1`, and apply/bundle `replayDiagnostics`.

## Ownership boundaries

Likely files:

- `packages/web/src/advisor/AdvisorPanel.tsx`
- `packages/web/src/workspace/AgentReviewPane.tsx`
- `packages/web/src/lib/collaborationConflictStatus.ts`
- Focused web tests near those components/helpers.
- Existing backend constraints/evidence tests only if backend issue codes, evidence payload shapes, or advisor action payloads change.

Stay within the existing command-driven model and existing API payloads unless a tiny backend metadata addition is required to make current advisories navigable. Prefer presenting existing IDs, view refs, element refs, quick-fix command summaries, evidence refs, and diagnostic details over creating new model behavior.

If you touch TypeScript unions or enums, use exhaustive handling. Keep imports at the top of files; do not add inline imports.

## Non-goals

- Do not create real GitHub issues, PR comments, tickets, or remote issue side effects.
- Do not auto-apply command bundles or quick fixes without explicit user confirmation.
- Do not build a new validation engine, new pixel-diff engine, new BCF workflow, or new evidence artifact store.
- Do not broaden IFC/IDS replay, command replay, or OpenBIM merge semantics.
- Do not change production geometry, schedule derivation, room derivation, or sheet export behavior unless required by a narrow metadata bug discovered while wiring diagnostics.
- Do not hide missing engine behavior behind fake success states.
- Do not create a pull request.

## Implementation checklist

1. Branch setup:
   - Confirm the working tree is clean or isolate unrelated local changes.
   - Create the dedicated branch from current `main`.

2. Advisor navigation:
   - Inspect the current `AdvisorPanel` data shape and existing issue/action fields.
   - Add compact, deterministic navigation/diagnostic affordances for existing advisories: element IDs, view refs, sheet/schedule refs, quick-fix command type summaries, severity/category grouping, and a clear "recommended context" label where the payload already supports it.
   - For sheet/schedule advisories, make the UI point to existing sheet, viewport, schedule, or titleblock context rather than inventing new placement behavior.

3. Agent Review action navigation:
   - Inspect `AgentReviewPane` and existing evidence/action payloads.
   - Surface existing action targets and blockers in a way that lets a reviewer understand what to inspect next: evidence package paths, staged artifact resolution mode, BCF topic refs, ingest checklist fields, digest mismatch fields, server PNG ingest comparison, and replay conflict hints.
   - If existing actions include command payloads, show them as pending/reviewable commands or summaries only. Require explicit user intent before any apply path.

4. Replay diagnostics:
   - Reuse `collaborationConflictStatus.ts` or adjacent helpers so apply/bundle/undo conflict diagnostics are formatted consistently.
   - Add or tighten helper tests for structured `409` detail, `replayDiagnostics`, blocking violation IDs, and first blocking step hints if this formatting changes.

5. Minimal backend changes only if needed:
   - If an existing advisory lacks a stable issue code or target metadata needed for navigation, add the smallest deterministic metadata field.
   - Update focused backend tests for changed issue codes/payloads only.
   - Avoid broad constraint taxonomy changes.

6. Accessibility and UX:
   - Keep labels readable in the current panel layout.
   - Prefer stable test IDs only when existing test style uses them.
   - Make copy/helper text honest about side effects: links/actions are review aids, not automatic GitHub issue creation or command execution.

## Validation

Run focused validation based on touched files:

- Web Vitest for changed web helpers/components, for example:

```sh
cd packages/web
pnpm exec vitest run src/advisor src/workspace src/lib/collaborationConflictStatus.test.ts
```

- If you touch only specific tests, use the narrower file list that matches the repo's current test names.
- If backend constraints, evidence payloads, or issue codes change, also run targeted backend checks, for example:

```sh
cd app
.venv/bin/ruff check bim_ai tests
.venv/bin/pytest tests/test_constraints_sheet_documentation_advisory.py tests/test_constraints_schedule_sheet_link.py tests/test_evidence_agent_review_loop.py tests/test_evidence_manifest_closure.py
```

- Do not run broad suites as a substitute for focused tests unless the change genuinely crosses subsystem boundaries.
- Record the exact validation commands and results in your final handoff and tracker ledger entry.

## Tracker update requirements

Update `spec/revit-production-parity-workpackage-tracker.md` as part of the implementation branch.

Required tracker updates:

- Add a `Recent Sprint Ledger` row for this slice describing what landed, key files, tests run, and explicit blockers/non-goals.
- Update the `Current Workpackages` rows for every materially affected target WP among `WP-V01`, `WP-F01`, `WP-F02`, `WP-F03`, `WP-D03`, `WP-E05`, and `WP-X04`.
- Keep rows `partial` unless the existing Done Rule is truly satisfied.
- Keep remaining parity blockers explicit, especially no real GitHub issue creation, no command auto-apply without confirmation, no new diff engine, and no full BCF roundtrip.
- If a target WP was not materially affected, say so in the ledger rather than padding its row.

## Commit/push requirements

When implementation and validation are complete:

1. Review the diff and ensure the branch contains only the intended implementation, tests, and tracker updates.
2. Commit with a concise message that reflects the user-facing slice, for example:

```sh
git add <changed files>
git commit -m "$(cat <<'EOF'
Improve advisor and agent review gap navigation

EOF
)"
```

3. Push the branch:

```sh
git push -u origin prompt-8-advisor-agent-review-gap-navigation
```

4. Do not create a pull request under any circumstances.
5. Final response should include the branch name, commit SHA, pushed remote branch, validation commands/results, and a brief note confirming that no pull request was created.
