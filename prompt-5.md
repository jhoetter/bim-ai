# Agent Prompt 5: Agent Evidence Closure And CI Artifact Freshness

## Mission

You are Agent 5 of 5 parallel BIM AI parity agents. Advance the AI-agent evidence loop: stale/missing artifact detection, digest/revision mismatch guidance, Playwright artifact metadata ingestion, and deterministic regeneration hints. Stay isolated from feature authoring surfaces, schedule semantics, room validation, sheet viewport placement, and geometry/export implementation.

Target workpackages in `spec/revit-production-parity-workpackage-tracker.md`:

- `WP-A02` Evidence package API
- `WP-A03` Playwright evidence baselines
- `WP-A04` CI verification gates
- `WP-F02` Agent review UI
- `WP-F03` Automated evidence comparison

The product invariant is: agents must be able to connect model/view/sheet rows to deterministic evidence artifacts and understand what is stale or missing without guessing.

## Start Procedure

1. Start from a clean and current `main`:

   ```bash
   git fetch origin
   git switch main
   git pull --ff-only origin main
   git switch -c agent/evidence-loop
   ```

2. Before editing, inspect:
   - `spec/revit-production-parity-workpackage-tracker.md`
   - `spec/prd/revit-production-parity-ai-agent-prd.md`
   - `spec/agent-evidence-loop.md`, if present
   - `app/bim_ai/evidence_manifest.py`
   - `app/bim_ai/routes_api.py`, `evidence_package` path only
   - `app/scripts/ci-evidence-package-probe.sh`
   - `app/tests/test_evidence_package_digest.py`
   - `app/tests/test_plan_projection_and_evidence_slices.py`
   - `packages/web/src/workspace/AgentReviewPane.tsx`
   - `packages/web/src/Workspace.tsx`, only the `agent_review` tab wiring
   - `packages/web/e2e/evidence-baselines.spec.ts`
   - `packages/web/playwright.config.ts`
   - `.github/workflows/ci.yml`

## Allowed Scope

Prefer changes in these files:

- `app/bim_ai/evidence_manifest.py`
- `app/bim_ai/routes_api.py`, evidence-package function/route only
- `app/scripts/ci-evidence-package-probe.sh`
- `app/tests/test_evidence_package_digest.py`
- `app/tests/test_plan_projection_and_evidence_slices.py`
- `packages/web/src/workspace/AgentReviewPane.tsx`
- `packages/web/src/Workspace.tsx`, only `agent_review` wiring if unavoidable
- `packages/web/e2e/evidence-baselines.spec.ts`, evidence package mocks and artifact expectations only
- `packages/web/playwright.config.ts`, only if artifact/report behavior requires it
- `.github/workflows/ci.yml`, only CI artifact upload/correlation/probe paths
- `spec/agent-evidence-loop.md`, if updating evidence-loop documentation
- `spec/revit-production-parity-workpackage-tracker.md`

## Non-Goals And Hard Boundaries

Do not edit these areas unless a minimal compatibility fix is required:

- Plan/sheet authoring commands.
- Sheet viewport placement UI.
- Schedule derivation, CSV, CLI, or filter/group semantics.
- Room derivation, room programme validation, or advisor quick fixes unrelated to evidence.
- IFC/glTF export implementation.
- Geometry kernel or section projection behavior.
- General Workspace layout outside the Agent Review tab wiring.

Preserve `evidencePackage_v1` field names consumed by Agent Review and Playwright mocks. If you change digest inputs, deterministic filenames, or correlation shapes, update server tests, Playwright mocks, and UI parsing in the same commit.

## Implementation Goals

Deliver a focused evidence-loop slice:

1. Improve evidence package metadata:
   - expose deterministic artifact expectations for sheet/3D/plan/section rows;
   - surface revision/digest/freshness hints without breaking existing clients;
   - keep semantic digest canonical and tested.
2. Improve Agent Review:
   - detect missing suggested screenshot filenames;
   - detect stale digest/revision mismatches;
   - present actionable regeneration hints for agents.
3. Improve CI evidence correlation:
   - ensure Playwright reports and screenshots are uploaded with paths agents can map back to evidence rows;
   - keep optional `ci-evidence-package-probe.sh` behavior compatible with unset env vars.
4. Avoid visual churn:
   - do not change screenshots or layout unless evidence UI itself intentionally changes;
   - if a baseline update is unavoidable, document why.

## Validation Commands

Run focused validation first:

```bash
cd app && ruff check bim_ai tests && pytest tests/test_evidence_package_digest.py tests/test_plan_projection_and_evidence_slices.py
cd packages/web && pnpm exec tsc -p tsconfig.json --noEmit && pnpm test
cd packages/web && CI=true pnpm exec playwright test e2e/evidence-baselines.spec.ts
```

Then, if time allows before committing:

```bash
pnpm verify
```

If digest snapshots or Playwright mocks change, explicitly explain the contract change in the final report.

## Tracker Update Rules

Update `spec/revit-production-parity-workpackage-tracker.md` before committing:

- Update only rows you materially affected: likely `WP-A02`, `WP-A03`, `WP-A04`, `WP-F02`, and `WP-F03`.
- Mention evidence package tests, Agent Review behavior, CI artifact upload paths, and Playwright checks.
- Keep remaining blockers strict: signed/staged artifact URLs, true pixel-diff ingestion, deployment correlation, and full automated issue loops likely remain unless actually implemented.
- Do not mark a row `done` unless it satisfies the tracker Done Rule.

## Commit And Push

Commit only your focused branch:

```bash
git status
git diff
git add <changed files>
git commit -m "$(cat <<'EOF'
feat(evidence): improve agent artifact freshness guidance

EOF
)"
git push -u origin agent/evidence-loop
```

Do not push to `main`.

## Final Report

Return:

- Branch name and commit SHA.
- Evidence metadata or Agent Review guidance added.
- Any `evidencePackage_v1` compatibility notes.
- Tracker rows updated.
- Validation commands run and results.
- Any screenshot baseline or CI artifact changes.
- Merge risks with the other four agents.
