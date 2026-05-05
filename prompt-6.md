# Prompt 6 - Evidence Artifact Signing And Staged Upload Closure V1

## Mission

You are implementing wave 2 of the remaining Revit Production Parity v1 closeout work. Close the signed and staged evidence artifact flow without introducing live upload side effects or broadening the v1 scope.

The tracker indicates deterministic package rows and artifact upload/readouts already exist, but the signed/staged artifact flow remains incomplete. Your task is to make evidence artifacts auditable end-to-end: deterministic local digest/signature rows, clear staged upload eligibility, explicit missing artifact reasons, CI provider hints, Agent Review readouts, digest exclusion rules, and focused tests.

## Target Workpackages

- WP-A02 Evidence package API
- WP-A03 Playwright evidence baselines
- WP-A04 CI verification gates
- WP-F03 Automated evidence comparison
- WP-F02 Agent review UI

## Scope

Implement deterministic artifact signing and staged upload closure evidence across the backend and Agent Review UI.

Required backend/API behavior:

- Add or complete local signature and digest rows for evidence artifacts in the evidence package API.
- Ensure digest/signature output is deterministic across repeated runs when artifact content and metadata are unchanged.
- Represent staged upload eligibility for each artifact without performing real uploads.
- Surface missing artifact reasons in structured output, including when an artifact is not present, excluded from digesting, not upload-eligible, or blocked by validation.
- Include a CI provider hint in evidence package/readout data so CI verification gates can explain which provider context was inferred or selected.
- Define and enforce digest exclusion rules for files or metadata that must not affect deterministic package digests.
- Preserve existing deterministic package row behavior and artifact upload/readout behavior unless the change is required for signed/staged artifact closure.

Required Agent Review UI behavior:

- Update Agent Review readouts so reviewers can see artifact digest/signature state, staged upload eligibility, missing artifact reasons, and CI provider hint.
- Keep the UI readout deterministic and review-friendly.
- Prefer existing Agent Review pane patterns and components. Avoid broad UI redesign.

Required evidence comparison/baseline behavior:

- Extend automated evidence comparison to account for signature/digest rows and digest exclusion rules.
- Ensure Playwright evidence baseline lifecycle readouts explain staged upload state without committing or mutating baselines automatically.
- Keep generated or derived evidence stable enough for CI verification gates.

Required tests:

- Add or update backend tests covering deterministic digest/signature rows, staged upload eligibility, missing artifact reasons, CI provider hint, and digest exclusion rules.
- Add or update Agent Review UI tests covering artifact readouts in `AgentReviewPane` or the existing artifact readout components.
- Add or update evidence comparison/baseline lifecycle tests so the new fields are verified without requiring real upload effects.

## Non-goals

- Do not perform real upload side effects.
- Do not serialize secrets, tokens, credentials, signed upload URLs, or provider-specific secret material.
- Do not mutate GitHub state or call GitHub APIs that create, update, or delete remote data.
- Do not automatically commit evidence baselines.
- Do not open a pull request.
- Do not broaden Revit Production Parity v1 beyond the target workpackages listed above.
- Do not replace the existing evidence package model if a focused extension will close the gap.
- Do not introduce nondeterministic timestamps, random IDs, machine-local absolute paths, or environment-specific values into package digests.

## Validation

Run focused backend validation:

```bash
ruff check .
pytest tests/test_evidence_manifest_closure.py tests/test_evidence_agent_follow_through.py tests/test_evidence_baseline_lifecycle_readout.py
```

Run focused web validation for Agent Review pane and artifact readouts:

```bash
npm run typecheck
npm run vitest -- AgentReviewPane artifact readout
```

If this repository uses package-manager workspaces or scoped web commands, use the repo-local equivalent for the web app typecheck and Vitest targets. Report any command that cannot be run, why it could not be run, and what narrower validation you ran instead.

## Tracker And Git

- Update `spec/revit-production-parity-workpackage-tracker.md` with Recent Sprint Ledger and affected rows.
- Create a dedicated branch from `main`, for example `prompt-6-evidence-artifact-signing-staged-upload`.
- Commit your changes and push the branch.
- Do not open a pull request.
