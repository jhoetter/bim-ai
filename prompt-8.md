# Prompt 8 — Evidence Artifact Pixel Diff Closure Slice

You are a senior implementation agent working in `/Users/jhoetter/repos/bim-ai`.

Your job is to land one focused, production-quality evidence-closure slice that makes failed evidence package closure more deterministic and actionable. Work on a dedicated branch, commit your changes, push the branch, and stop. Do not create a pull request.

## Operating Rules

- Create and work on a dedicated branch from the current mainline state.
- Commit all intended changes with a concise implementation-focused message.
- Push the branch to the remote.
- Never create a PR.
- Keep the work narrowly scoped to this prompt.
- Update `spec/revit-production-parity-workpackage-tracker.md`, including both `Current Workpackages` and `Recent Sprint Ledger`.
- Do not perform broad refactors, dependency churn, formatting-only sweeps, or unrelated cleanup.
- Preserve existing public behavior unless the change is required for the deterministic evidence-closure signal.
- Follow existing repo conventions for Python, TypeScript, tests, fixtures, naming, digest behavior, and UI copy.
- Keep imports at the top of files. Do not add inline imports.
- If you touch TypeScript union or enum handling, keep switches exhaustive.

## Target Workpackages

Advance these workpackages with a small evidenced slice:

- `WP-A02` Evidence package API
- `WP-A03` Playwright evidence baselines
- `WP-A04` CI verification gates
- `WP-F02` Agent review UI
- `WP-F03` Automated evidence comparison
- Light `WP-X04` BCF export/import

The target is not a large feature. It is one deterministic artifact ingest or pixel-diff metadata/enforcement signal that closes a practical gap in the evidence loop.

## Required Outcome

Add exactly one narrow, deterministic signal from this menu, choosing the option that best fits the current code:

1. A pytest-only PNG hash or diff gate for an existing evidence artifact.
2. Stricter `artifactIngestCorrelation` invariants that prove closure metadata lines up with lifecycle or manifest data.
3. Remediation action target refinement so failed closure points to the exact artifact, digest, correlation field, or screenshot root needed to fix it.
4. CI hint output that makes failed evidence closure immediately actionable and grep-friendly.

The implementation must keep derivative summary digest semantics clear. If the changed or added field is a derived summary, hint, review aid, UI affordance, or fix-loop summary, document and test whether it is excluded from canonical digest inputs. If the field is intended to be canonical, test that it participates consistently in the digest and explain why.

## Suggested Files

Use the existing architecture to decide the exact file list. The likely touch points are:

- `app/bim_ai/evidence_manifest.py`
- `app/bim_ai/agent_evidence_review_loop.py`
- `app/bim_ai/agent_review.py`, if remediation action or review package assembly changes require it
- `app/tests/test_evidence_manifest_closure.py`
- `app/tests/test_evidence_agent_review_loop.py`
- `packages/web/src/workspace/AgentReviewPane.tsx`, only if UI display or action targeting changes
- `packages/web/src/workspace/agentReviewActions.test.ts`, if action payload or routing changes
- `packages/web/e2e/evidence-baselines.spec.ts`, if Playwright mock evidence changes
- `.github/workflows/ci.yml`, only for deterministic hint output
- `spec/revit-production-parity-workpackage-tracker.md`

Do not touch unrelated files.

## Implementation Guidance

Start by reading the existing evidence package and agent review loop code, then identify where closure metadata is built, digested, displayed, and tested. Choose the smallest useful improvement that can be enforced deterministically in tests.

Good examples of acceptable slices:

- Add a pytest fixture/assertion that hashes a known PNG evidence artifact and fails with a targeted message when the bytes drift unexpectedly.
- Require `artifactIngestCorrelation_v1.ingestManifestDigestSha256` to match `evidenceLifecycleSignal_v1.artifactIngestManifestDigestSha256` when both are present, and produce a precise closure failure when they do not.
- Refine `agentReviewActions_v1` remediation targets to include fields such as `artifactIngestManifestDigestSha256`, `artifactIngestCorrelationField`, `artifactPath`, `screenshotBasename`, or `playwrightEvidenceScreenshotsRootHint` when available.
- Add deterministic CI echo output for evidence closure failures that names the missing field, expected digest, actual digest, artifact path, and exact focused test command.

Keep naming versioned if the existing manifest schema uses versioned keys. Prefer extending existing `*_v1` structures only when the contract is still compatible; otherwise add a clearly named new versioned helper. Do not introduce a second parallel concept if an existing closure, lifecycle, ingest checklist, or fix-loop structure can carry the signal cleanly.

For UI changes, keep them small: show the exact missing or mismatched closure target and expose the existing remediation action more clearly. Do not redesign the review pane.

For CI changes, keep output deterministic and local to evidence closure. Do not add network-dependent steps or broad job restructuring.

For BCF export/import, keep the contribution light. It is enough for BCF-related evidence closure or remediation targets to carry the refined artifact/digest/correlation metadata when the existing BCF path participates in the evidence loop. Do not implement a new BCF feature.

## Non-Goals

Do not implement or expand:

- Sheet raster generation
- Schedules
- OpenBIM replay
- Geometry kernels
- Room legends
- New rendering systems
- New visual diff infrastructure beyond the single deterministic signal
- Broad CI pipeline restructuring
- Large UI redesigns

## Tracker Update Requirements

Update `spec/revit-production-parity-workpackage-tracker.md` in the same commit.

In `Current Workpackages`, update the rows for the workpackages actually touched:

- `WP-A02`
- `WP-A03`, if Playwright fixtures or baseline mocks changed
- `WP-A04`, if CI output or verification gates changed
- `WP-F02`, if Agent Review UI changed
- `WP-F03`
- `WP-X04`, if BCF evidence closure metadata changed

Keep percentages conservative. Do not mark anything complete unless the repo already has broad production coverage.

In `Recent Sprint Ledger`, add a new row for this prompt. Include:

- Source: `Prompt-8 evidence artifact pixel diff closure`
- The exact signal added
- Main files or schema keys touched
- The tests run
- Remaining blockers, especially lack of true server-side pixel diff enforcement if still applicable

## Validation Commands

Run focused validation first:

```bash
python -m pytest app/tests/test_evidence_manifest_closure.py app/tests/test_evidence_agent_review_loop.py
```

If web action or UI code changes:

```bash
pnpm --filter web vitest run src/workspace/agentReviewActions.test.ts
```

If Playwright mock evidence changes and the environment is practical:

```bash
pnpm --filter web playwright test packages/web/e2e/evidence-baselines.spec.ts
```

If practical after focused tests:

```bash
pnpm verify
```

If a command is unavailable or too slow for the environment, record that in your final handoff with the reason and the focused tests that did run.

## Acceptance Criteria

- A dedicated branch is created, committed, and pushed.
- No PR is created.
- The implementation adds one deterministic artifact ingest or pixel-diff closure signal from the allowed menu.
- Evidence closure failures become more actionable through a precise test failure, remediation target, UI hint, or CI hint.
- Canonical versus derivative digest semantics are explicit in code and covered by tests.
- Existing evidence package behavior remains backward-compatible unless the current branch already introduced the unstable behavior being corrected.
- Focused Python evidence tests pass.
- Relevant web tests pass when web files are touched.
- `spec/revit-production-parity-workpackage-tracker.md` has updated `Current Workpackages` and `Recent Sprint Ledger` entries.
- Non-goals remain untouched.

## Conflict-Avoidance Rules

- Before editing, inspect the current branch status and recent changes. Do not overwrite user work.
- If files already contain newer prompt-specific changes, build on them instead of reverting them.
- If the tracker already mentions Prompt 8 or a similar evidence closure slice, update it in place rather than duplicating contradictory rows.
- Do not rename existing schema keys unless a test proves the old key is wrong and no shipped compatibility is needed.
- Do not change generated artifacts unless the selected slice explicitly requires deterministic fixture updates.
- Keep changes atomic: evidence signal, tests, tracker, and optional UI/CI hint only.
- If you hit a conflict between this prompt and existing code behavior, prefer the smallest compatible extension and document the tradeoff in the commit/final handoff.

## Final Handoff Expectations

When finished, report:

- Branch name and pushed commit SHA.
- The single deterministic signal implemented.
- Tracker rows updated.
- Validation commands run and results.
- Any skipped validation with reasons.
- Remaining evidence-closure limitations.
