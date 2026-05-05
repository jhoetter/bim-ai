# Wave 3 Prompt 6 - Evidence Package Semantic Digest Invariants And Digest-Excluded Enforcement V1

## Mission

You are implementing wave 3 of 5 of the remaining v1 closeout waves for scoped Revit Production Parity v1. This wave focuses on integration/export/evidence hardening across the app.

The evidence package surface has grown rapidly: `semanticDigestSha256`, `digestExclusionRules_v1`, `agentEvidenceClosureHints`, `evidenceBaselineLifecycleReadout_v1`, `agentBriefAcceptanceReadout_v1`, `agentGeneratedBundleQaChecklist_v1`, `prdAdvisorMatrix_v1`. What is missing is an explicit invariants layer: deterministic proof that the semantic digest is stable under permutations that should not affect it, and that every digest-excluded key is enumerated, justified, and actually excluded from the digest computation.

The end state should let users and tests answer, for any evidence package:

- Which top-level keys contribute to the semantic digest vs are explicitly excluded.
- Whether reordering elements/inputs that should not affect semantic content changes the digest.
- Which keys were added since the last invariants snapshot, and whether they are in the digest set or the excluded set.
- Which advisory rules fire when an unknown top-level key appears that is neither in the included nor excluded sets.

## Target Workpackages

- WP-A02 Evidence package
- WP-A03 Evidence digest
- WP-A04 Evidence agent follow-through
- WP-F02 Agent evidence closure
- WP-V01 Validation/advisor expansion

## Scope

Backend behavior:

- Add `evidencePackageDigestInvariants_v1` to `GET …/evidence-package`: ordered list of `digestIncludedTopLevelKeys`, ordered list of `digestExcludedTopLevelKeys` (with rationale rows from existing `digest_exclusion_rules_v1`), `unknownTopLevelKeys` (any key not in either list), and a stable `evidencePackageDigestInvariantsDigestSha256` over those three lists.
- Add focused tests proving the semantic digest does not change under deterministic input permutations (e.g., command id ordering shifts).
- Add advisory rule `evidence_package_unknown_top_level_key`. Finding must identify the key name.
- Reuse `evidence_manifest`, `routes_api`, and the existing exclusion rules. Do not invent a new digest algorithm.

Web behavior:

- Extend the Agent Review pane with a focused readout `data-testid="evidence-package-digest-invariants-readout"` showing included/excluded/unknown counts and the invariants digest.
- Tests for readout content and ordering.

Keep it bounded:

- Reuse existing evidence package digest plumbing.
- Do not retroactively re-categorize existing keys silently.
- Do not change the existing semantic digest formula.

## Non-goals

- No new digest hashing algorithm.
- No deletion of existing evidence keys.
- No baseline regeneration.
- No schema migrations.
- No unrelated refactors.

## Validation

Backend:

```bash
cd app && .venv/bin/ruff check bim_ai tests
cd app && .venv/bin/pytest tests -k "evidence_manifest or evidence_agent_follow_through or evidence_baseline or constraints"
```

Web:

```bash
cd packages/web && pnpm typecheck
cd packages/web && pnpm exec vitest run src/workspace
```

Record any commands that could not be run or failed for pre-existing reasons.

## Tracker And Git

- Update `spec/revit-production-parity-workpackage-tracker.md` with a Recent Sprint Ledger row and the affected workpackage rows. Keep them `partial`.
- Create a dedicated branch from `main`, e.g. `wave-3-prompt-6-evidence-digest-invariants`.
- Commit your changes and push the branch.
- Do not open a pull request.
