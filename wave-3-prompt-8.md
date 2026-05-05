# Wave 3 Prompt 8 - Agent Review Pane Cross-Readout Consistency Closure V1

## Mission

You are implementing wave 3 of 5 of the remaining v1 closeout waves for scoped Revit Production Parity v1. This wave focuses on integration/export/evidence hardening across the app.

The Agent Review pane already shows a long list of focused readouts: `agent-brief-acceptance-readout`, `agent-generated-bundle-qa-checklist`, `agent-review-merge-preflight-readout`, `evidence-baseline-lifecycle-readout`, `agent-review-browser-rendering-budget`. What is missing is a single deterministic consistency closure: a row-level cross-check that the data shown across these readouts agrees on bundle id, evidence digest, follow-through hint set, and CI gate state, plus an advisor that fires when readouts drift.

The end state should let users and tests answer, for any Agent Review snapshot:

- Which bundles/digests/follow-through hints are seen in each readout.
- Whether each readout agrees on the active bundle and the active evidence digest.
- Which readout, if any, is stale or missing fields versus the current evidence package.
- Which advisory rules fire when readouts drift.

## Target Workpackages

- WP-A02 Evidence package
- WP-A04 Evidence agent follow-through
- WP-F02 Agent evidence closure
- WP-F03 Agent fix loop
- WP-V01 Validation/advisor expansion

## Scope

Backend behavior:

- Add `agentReviewReadoutConsistencyClosure_v1` to `GET …/evidence-package` and `POST …/commands/bundle/dry-run` (digest-excluded): rows for `briefAcceptance`, `bundleQaChecklist`, `mergePreflight`, `baselineLifecycle`, `browserRenderingBudget`, each with `expectedFieldNames`, `presentFieldNames`, `missingFieldNames`, `bundleIdSeen`, `evidenceDigestSeen`, `consistencyToken` (`aligned`, `bundle_id_drift`, `digest_drift`, `missing_fields`).
- Add a deterministic `agentReviewReadoutConsistencyClosureDigestSha256` over the rows.
- Reuse `agentEvidenceClosureHints` to enumerate readout field paths. Do not duplicate field discovery logic.
- Add advisory rules: `agent_review_readout_bundle_id_drift`, `agent_review_readout_digest_drift`, `agent_review_readout_missing_fields`. Findings must identify the readout id.

Web behavior:

- Add an Agent Review readout `data-testid="agent-review-readout-consistency-closure"` rendering rows with consistency tokens.
- Tests for rows, tokens, sort order, and advisor display.

Keep it bounded:

- Reuse existing agent review readout helpers and `agentEvidenceClosureHints`.
- Do not change individual readout shapes.
- Do not introduce a new agent review surface beyond this consistency row.

## Non-goals

- No automatic remediation.
- No new agent loop or LLM behavior.
- No schema migrations.
- No new readouts beyond the consistency closure itself.
- No unrelated refactors.

## Validation

Backend:

```bash
cd app && .venv/bin/ruff check bim_ai tests
cd app && .venv/bin/pytest tests -k "agent_brief or agent_generated_bundle or evidence_agent_follow_through or evidence_baseline or evidence_manifest or constraints"
```

Web:

```bash
cd packages/web && pnpm typecheck
cd packages/web && pnpm exec vitest run src/workspace
```

Record any commands that could not be run or failed for pre-existing reasons.

## Tracker And Git

- Update `spec/revit-production-parity-workpackage-tracker.md` with a Recent Sprint Ledger row and the affected workpackage rows. Keep them `partial`.
- Create a dedicated branch from `main`, e.g. `wave-3-prompt-8-agent-review-consistency-closure`.
- Commit your changes and push the branch.
- Do not open a pull request.
