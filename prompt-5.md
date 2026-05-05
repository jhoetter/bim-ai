# Committed PNG Baseline Ingest Correlation Slice

## Mission

You are the future implementation agent for a narrow evidence-baseline slice in `/Users/jhoetter/repos/bim-ai`.

Create and work on a dedicated branch based on the current `main`, for example:

```bash
git fetch origin
git checkout main
git pull --ff-only origin main
git checkout -b prompt-5-committed-png-baseline-ingest
```

Implement deterministic correlation between committed PNG fixture baselines and the existing evidence manifest / agent review ingest loop. The goal is to close the current blocker from the server PNG byte ingest slice: no CI ingestion of real committed baseline PNG bytes per deterministic basename yet.

Keep this scoped to committed repository fixtures and deterministic ingest metadata. This is not a real GitHub Actions artifact upload/download feature.

## Target workpackages

- `WP-A02` Evidence package API: extend the evidence manifest package path so committed PNG baseline bytes can be read, identified, dimensioned, digested, and correlated by deterministic basename.
- `WP-A03` Playwright evidence baselines: add or update committed PNG fixtures only if needed to exercise deterministic baseline ingest correlation.
- `WP-A04` CI verification gates: make the focused backend validation prove the committed PNG fixture ingest contract without requiring network or uploaded artifacts.
- `WP-F03` Automated evidence comparison: connect the committed baseline ingest facts to the existing closure/review/fix-loop correlation fields so mismatch and success states are deterministic and inspectable.

## Ownership boundaries

Likely files:

- `app/bim_ai/evidence_manifest.py`
- `app/tests/fixtures/evidence/`
- `app/tests/test_evidence_manifest_closure.py`
- `app/tests/test_evidence_agent_review_loop.py`
- Optional Playwright evidence baseline fixture files only if the existing backend fixtures cannot cover the committed PNG path cleanly.

Use the existing names and contracts around:

- `merge_server_png_byte_ingest_into_evidence_closure_review_v1`
- `MINIMAL_PROBE_PNG_*`
- `evidenceClosureReview_v1`
- `pixelDiffExpectation`
- `artifactIngestCorrelation_v1`
- `evidenceLifecycleSignal_v1`
- `evidence_diff_ingest_fix_loop_v1`
- `ingestChecklist_v1`
- `artifact_ingest_correlation_digest_mismatch`

Prefer small helper functions in `evidence_manifest.py` over adding new modules. Keep imports at the top of each file.

## Non-goals

- Do not create a pull request.
- Do not implement real GitHub artifact uploads, GitHub API calls, artifact downloads, or issue creation.
- Do not add network requirements, credentials, tokens, or environment-dependent behavior.
- Do not alter the semantic model, geometry engine, sheet renderer, or browser UI unless a focused test proves it is necessary.
- Do not replace the existing server PNG byte ingest slice; extend it with committed fixture baseline correlation.
- Do not add broad visual regression infrastructure or full Playwright e2e coverage unless an e2e file is directly touched.

## Implementation checklist

- Start from current `main` on a dedicated branch named like `prompt-5-committed-png-baseline-ingest`.
- Inspect the current evidence manifest closure/review code and tests before editing.
- Add committed PNG fixture bytes under `app/tests/fixtures/evidence/` with deterministic, descriptive basenames.
- Ingest committed PNG bytes through a deterministic helper that records at least basename, byte length, PNG dimensions from IHDR, SHA-256 digest, and any existing manifest/checklist correlation fields required by the current contract.
- Ensure PNG parsing remains stdlib-only and deterministic. Reject or mark invalid non-PNG bytes in the same style as existing ingest code.
- Correlate fixture basenames with the existing ingest checklist / artifact correlation digest path so success and mismatch states can be asserted without real artifact uploads.
- Preserve the existing semantic digest invariant: derivative closure/review/ingest metadata must not perturb `semanticDigestSha256`.
- Add focused tests that cover:
  - successful committed PNG fixture ingest by deterministic basename;
  - PNG dimensions and digest captured from committed bytes;
  - closure/review correlation includes the committed fixture ingest facts;
  - mismatch behavior still yields the existing `artifact_ingest_correlation_digest_mismatch` remediation path;
  - semantic digest remains unaffected by derivative ingest metadata.
- Keep test fixtures minimal. A tiny valid PNG is preferred over screenshot-sized binary churn.

## Validation

Run backend formatting/lint and focused evidence tests:

```bash
cd app
.venv/bin/ruff check bim_ai tests
.venv/bin/pytest tests/test_evidence_manifest_closure.py tests/test_evidence_agent_review_loop.py
```

Run Playwright only if a Playwright e2e file or web evidence baseline is touched:

```bash
cd packages/web
pnpm exec playwright test
```

If any validation cannot be run, record the reason in the final handoff and in the tracker ledger row.

## Tracker update requirements

Update `spec/revit-production-parity-workpackage-tracker.md` in the same branch.

Required tracker edits:

- Add a `Recent Sprint Ledger` row for this slice, naming the committed PNG baseline ingest correlation behavior, key files/tests, validation commands, and remaining blockers.
- Update the `Current Workpackages` rows for `WP-A02`, `WP-A03`, `WP-A04`, and `WP-F03` with concise recent sprint deltas.
- Keep all four workpackages `partial` unless the tracker Done Rule is truly satisfied for the full PRD scope.
- Keep the tracker honest that this is deterministic committed fixture ingest correlation only, not production artifact upload/download infrastructure.

## Commit/push requirements

Commit the implementation and tracker updates on the dedicated branch.

Use a concise commit message such as:

```text
Correlate committed PNG baseline ingest
```

Push the branch to origin:

```bash
git push -u origin HEAD
```

Never create a pull request. After pushing, report the branch name, commit SHA, validation results, and the fact that no PR was created.
