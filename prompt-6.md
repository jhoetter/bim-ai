# Prompt 6 - Release Readiness Run Book

## Mission

Author an operator-facing v1 run book that explains, in one place, how to regenerate evidence, replay fixtures, run CI gates, read manifests, and interpret the v1 acceptance proof. Closeout is incomplete without a written procedure another operator can follow without prior conversation context.

## Target Workpackages

- WP-A03 Playwright evidence baselines (run book documents the regeneration loop).
- WP-A04 CI verification gates (run book documents how to invoke the gate suite).

## Scope

- New file `spec/release-runbook-v1.md` containing the following top-level sections in order:
  1. `# V1 Release Run Book`
  2. `## Scope statement` — verbatim restatement of the v1 scope (coherent app behavior, deterministic evidence, explicit limitations, focused validation, clean tracker, clean main).
  3. `## Pre-flight checks` — clean working tree, on `main`, matching `origin/main`.
  4. `## Running CI gates` — exact invocation of `app/scripts/ci-gate-all.sh`, expected output, and how to read the per-gate `[ok]/[fail]/[warn]` lines.
  5. `## Regenerating evidence` — ordered steps to regenerate the evidence package and how to verify the digest.
  6. `## Replaying fixtures` — pointer to the existing fixture replay tests and CLI commands.
  7. `## Reading v1 manifests` — one-paragraph each for `v1AcceptanceProofMatrix_v1`, `replayStabilityHarness_v1`, `prdTrackerReconciliationManifest_v1`, `v1LimitationsManifest_v1`, `crossSurfaceEvidenceAuditManifest_v1`.
  8. `## Known limitations and deferred blockers` — pointer to `v1_limitations_manifest.py` and PRD §16.
  9. `## Tracker and PRD alignment` — pointer to `prd_tracker_reconciliation_v1.py`.
  10. `## Acceptance verdict` — describes how to derive the final v1 verdict from the manifests above.
- Add a single new `## V1 Release` section at the bottom of `README.md` with a one-paragraph summary and a relative link to `spec/release-runbook-v1.md`. Do not restructure the rest of `README.md`.
- The run book is documentation only — no Python or TypeScript changes in this prompt.

## Non-goals

- Do not modify any source code under `app/bim_ai/` or `packages/web/`.
- Do not add new manifests or evidence emitters; the run book references manifests defined by other wave-5 prompts but does not implement them.
- Do not embed full command output snapshots in the run book; describe them.
- Do not rewrite existing README sections; one new section appended at the bottom only.

## Validation

- `pnpm exec prettier --check spec/release-runbook-v1.md README.md`
- `test -f spec/release-runbook-v1.md`
- `grep -q "## V1 Release" README.md`

## Tracker And Git

- Update `spec/revit-production-parity-workpackage-tracker.md` with Recent Sprint Ledger and affected rows.
- Create branch `prompt-6-release-readiness-runbook` from `main`.
- Commit and push the branch.
- Do not open a pull request.
