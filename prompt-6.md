# Prompt 6 - Agent Review Evidence Loop And Diff Ingestion Closure V1

## Mission

Close the Agent Review evidence loop so it can ingest artifact manifests, detect stale/missing evidence, compute diff metadata, and emit structured regeneration guidance — moving from passive inspection to an actionable review cycle.

## Target Workpackages

- WP-F01 (Agent generation protocol) — currently partial ~43%
- WP-F02 (Agent review UI) — currently partial ~67%
- WP-F03 (Automated evidence comparison) — currently partial ~56%

## Scope

### Backend (`app/bim_ai/`)

1. **Artifact manifest ingestion** — extend `agent_evidence_review_loop.py`:
   - `ingest_evidence_artifact_manifest_v1(doc, manifest)` → validates manifest entries against current document state, returns `{fresh, stale, missing}` artifact lists with staleness reasons.
   - Staleness detection: compare manifest digest against current evidence package digest; flag entries where document has changed since manifest was generated.

2. **Diff metadata computation** — extend `agent_evidence_review_loop.py`:
   - `compute_evidence_diff_metadata_v1(doc, previous_manifest, current_manifest)` → structured diff: added/removed/changed evidence keys with per-key delta summaries.
   - `evidenceDiffSummary_v1` on the evidence API response: total added/removed/changed counts + top-5 largest deltas.

3. **Regeneration guidance** — extend `agent_brief_acceptance_readout.py`:
   - `agent_regeneration_guidance_v1(doc, stale_artifacts, diff_summary)` → ordered list of recommended actions: which evidence to regenerate, which screenshots to retake, which tests to re-run.
   - Each action has `priority` (high/medium/low), `artifactKey`, `reason`, `suggestedCommand`.

4. **Agent Review UI surface** — extend `packages/web/src/workspace/` Agent Review panel:
   - Display evidence freshness summary (fresh/stale/missing counts).
   - Show regeneration guidance as an actionable checklist.
   - `data-testid="agent-review-evidence-freshness"` for testing.

### Tests

5. `test_agent_evidence_loop_closure.py`:
   - Ingest manifest against fresh doc → all fresh.
   - Modify doc, re-ingest same manifest → detect stale entries.
   - Compute diff between two manifests → verify added/removed/changed counts.
   - Generate regeneration guidance → verify priority ordering and action structure.
   - Verify evidence API includes `evidenceDiffSummary_v1`.

### Web Tests

6. `agent-review-evidence-freshness.render.test.tsx`:
   - Render Agent Review with fresh/stale/missing data → verify counts displayed.
   - Verify regeneration guidance checklist renders.

## Non-goals

- Automatic regeneration execution (just guidance).
- Pixel-level diff computation for screenshots.
- Multi-user evidence conflict resolution.

## Validation

```bash
cd app && .venv/bin/ruff check bim_ai tests
cd app && .venv/bin/pytest tests/test_agent_evidence_loop_closure.py tests/test_evidence_agent_review_loop.py tests/test_agent_review_readout_consistency_closure.py -x -v
cd packages/web && pnpm typecheck
cd packages/web && pnpm exec vitest run src/workspace/agent-review-evidence-freshness.render.test.tsx --reporter=verbose
```

## Tracker And Git

- Update `spec/revit-production-parity-workpackage-tracker.md`: Recent Sprint Ledger + WP-F01, WP-F02, WP-F03 rows.
- Create branch `prompt-6-agent-evidence-loop-closure` from `main`.
- Commit and push. Do not open a pull request.
