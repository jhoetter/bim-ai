# Prompt 7 - PRD Blocking Advisor Matrix And V1 Scope Waivers V1

## Mission

Implement the remaining v1 closeout wave 2 of 4 for scoped Revit Production Parity v1 by adding deterministic PRD blocking advisor coverage and v1 scope-waiver evidence. This is a focused implementation wave, not a declaration that v1 is complete.

The current tracker indicates PRD traceability and the v1 closeout readiness manifest exist, but PRD-wide blocking validation remains incomplete. Close that gap by making the system able to explain, in a reproducible and testable way, which PRD sections are protected by required rules, which sections are passing, warning, blocking, or deferred, and which deferrals are backed by explicit v1 scope-waiver evidence.

## Target Workpackages

- WP-V01 Validation/advisor expansion
- WP-A01 Golden reference command bundle
- WP-A04 CI verification gates
- WP-F01 Agent generation protocol
- WP-A02 Evidence package API

## Scope

Add a deterministic PRD blocking advisor matrix that is generated from checked-in, versioned source data rather than manual interpretation. The matrix must cover required rule ids by PRD section, current status, waiver evidence, golden bundle coverage, and closeout manifest integration.

The implementation must include:

- Required rule ids by PRD section, with stable identifiers and deterministic ordering.
- A current status for each PRD section using only `pass`, `warn`, `block`, or `deferred`.
- Explicit waiver reason codes for any `deferred` item. Waivers must be structured data, not prose-only notes.
- Golden bundle coverage links for applicable PRD sections and rules, including command bundle references from WP-A01.
- Integration into the v1 closeout readiness manifest so blocking, warning, passing, and deferred PRD sections are visible in closeout evidence.
- Evidence package API support for retrieving or serializing the PRD advisor matrix and waiver details as part of WP-A02.
- Agent generation protocol updates so future generated evidence includes the advisor matrix and waiver fields consistently.
- Tests that prove the matrix is deterministic, that unsupported/missing waiver reason codes fail validation, and that blocking statuses are surfaced in the readiness manifest.

Keep the implementation bounded. Prefer extending existing traceability, readiness manifest, constraints, golden bundle, and evidence package structures over introducing a parallel reporting system. If the repository already has canonical rule id, PRD section, waiver, or manifest types, reuse them.

## Non-goals

- Do not claim v1 is done or production ready.
- Do not broadly rewrite CI workflows.
- Do not replace existing traceability or readiness manifest systems with a new separate framework.
- Do not add vague, manual-only checks that cannot be verified by tests.
- Do not broaden the v1 scope beyond the listed workpackages.
- Do not create a PR.

## Validation

Run focused validation for the changed surfaces before committing:

```bash
cd /Users/jhoetter/repos/bim-ai
ruff check backend
pytest tests/test_prd_traceability_matrix.py tests/test_v1_closeout_readiness_manifest.py tests/test_constraints.py tests/test_one_family_bundle_roundtrip.py
npx prettier --check spec/revit-production-parity-workpackage-tracker.md
```

If the repository uses wrapper commands for Python, pytest, or frontend tooling, use the established local wrappers while preserving the same validation intent and test coverage.

Validation must demonstrate:

- The PRD blocking advisor matrix is deterministic across repeated runs.
- Every PRD section with required v1 validation has an explicit `pass`, `warn`, `block`, or `deferred` status.
- Every `deferred` item has an allowed waiver reason code and evidence link.
- Missing required rule ids or missing waiver evidence fail validation.
- Golden reference command bundle coverage is linked where required.
- The v1 closeout readiness manifest surfaces PRD blocking and deferred state without claiming v1 completion.

## Tracker And Git

- Update `spec/revit-production-parity-workpackage-tracker.md` with Recent Sprint Ledger and affected rows.
- Create a dedicated branch from `main`, for example `prompt-7-prd-blocking-advisor-waivers`.
- Commit your changes and push the branch.
- Do not open a pull request.
