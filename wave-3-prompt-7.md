# Wave 3 Prompt 7 - PRD Blocking Advisor / Closeout Readiness / Traceability Matrix Cross-Correlation V1

## Mission

You are implementing wave 3 of 5 of the remaining v1 closeout waves for scoped Revit Production Parity v1. This wave focuses on integration/export/evidence hardening across the app.

Three v1 closeout surfaces already exist independently: `prdAdvisorMatrix_v1` (PRD §11–§15 status per section), `v1CloseoutReadinessManifest_v1` (CI gates and pytest gates), and `prd_traceability_matrix` tests. They were assembled in earlier waves and partially correlate, but there is no single deterministic cross-correlation row showing that every PRD section is represented across all three surfaces, with consistent status and reason codes.

The end state should let users and tests answer, for any v1 closeout snapshot:

- Whether every PRD §11–§15 section appears in all three surfaces.
- Whether the section status agrees across surfaces (e.g., a PRD section marked `block` in the advisor matrix is also reflected in the closeout readiness manifest).
- Where reason codes diverge between the PRD blocking advisor matrix and the closeout readiness manifest.
- Which advisory rules fire when correlation drift exists.

## Target Workpackages

- WP-A01 PRD anchor / closeout
- WP-A02 Evidence package
- WP-A04 Evidence agent follow-through
- WP-F01 Agent acceptance gates
- WP-V01 Validation/advisor expansion

## Scope

Backend behavior:

- Add `prdCloseoutCrossCorrelationManifest_v1`: deterministic rows correlating PRD section id → advisor matrix status → readiness manifest gate status → traceability test ids. Include `crossCorrelationToken` per row (`aligned`, `advisor_only`, `readiness_only`, `status_drift`, `reason_code_drift`) and a top-level `prdCloseoutCrossCorrelationDigestSha256`.
- Reuse `prd_blocking_advisor_matrix`, `v1_closeout_readiness_manifest`, and the traceability matrix test list. Do not invent a new manifest authority.
- Add advisory rules: `prd_closeout_advisor_readiness_status_drift`, `prd_closeout_section_missing_in_readiness`, `prd_closeout_reason_code_drift`. Findings must identify the PRD section id.
- Embed the new manifest on the v1 closeout readiness manifest payload (not on the per-element evidence package, to avoid digest churn).

Web behavior:

- Add a focused Agent Review readout `data-testid="prd-closeout-cross-correlation-readout"` rendering one row per PRD section with the cross-correlation token.
- Tests for readout content, sort order, and tokens.

Keep it bounded:

- Reuse existing PRD/readiness/traceability infrastructure.
- Do not change PRD section ids.
- Do not relabel readiness gates.

## Non-goals

- No new PRD sections.
- No re-derivation of the traceability matrix tests.
- No automatic remediation.
- No schema migrations.
- No unrelated refactors.

## Validation

Backend:

```bash
cd app && .venv/bin/ruff check bim_ai tests
cd app && .venv/bin/pytest tests -k "prd_traceability or prd_blocking_advisor or v1_closeout_readiness or constraints"
```

Web:

```bash
cd packages/web && pnpm typecheck
cd packages/web && pnpm exec vitest run src/workspace
```

Record any commands that could not be run or failed for pre-existing reasons.

## Tracker And Git

- Update `spec/revit-production-parity-workpackage-tracker.md` with a Recent Sprint Ledger row and the affected workpackage rows. Keep them `partial`.
- Create a dedicated branch from `main`, e.g. `wave-3-prompt-7-prd-closeout-cross-correlation`.
- Commit your changes and push the branch.
- Do not open a pull request.
