# Agent evidence loop (CLI + UI)

Agents and humans can produce a repeatable **evidence artifact** without mutating the model:

1. **`bim-ai evidence`** (`packages/cli/cli.mjs`) — `GET` snapshot + validate, emits JSON with `countsByKind`, `revision`, and the full validate payload (violations + summary + checks).

2. **Browser** — Workspace layout **Agent review** exposes the same checklist; **Fetch browser evidence bundle** mirrors the CLI shape via `/api/models/:id/snapshot` + `/validate`.

3. **Dry-run** — `bim-ai apply-bundle --dry-run <bundle.json>` previews commits; pair with evidence before and after when debugging agent regressions.

4. **Golden bundle** — `bim-ai plan-house …` emits the shared one-family fixture; assumptions are documented inline in Agent review and CLI bundle `meta.note`.

## Evidence package closures (API + CI)

`GET /api/models/{id}/evidence-package` (`evidencePackage_v1`) adds **deterministic rows** so agents can name PNG/SVG/PDF artifacts without guessing:

- `deterministicSheetEvidence`, `deterministic3dViewEvidence` — sheet and saved 3D viewpoints.
- `deterministicPlanViewEvidence` — per `plan_view`; `playwrightSuggestedFilenames.pngPlanCanvas` uses the same `suggestedEvidenceArtifactBasename` prefix as sheets.
- `deterministicSectionCutEvidence` — per `section_cut`; `projectionWireHref` points at `/api/models/{id}/projection/section/{sectionCutId}`; PNG hint in `pngSectionViewport`.

Row `correlation` blocks repeat `semanticDigestSha256` / `modelRevision` for freshness checks against the top-level digest (deterministic blocks are attached **after** digest computation and do not change the digest).

**agentEvidenceClosureHints** (format `agentEvidenceClosureHints_v1`) lists regeneration commands, CI-relative paths (Playwright report, `test-results/ci-evidence-correlation-hint.txt`, screenshot trees), and placeholder env keys (`GITHUB_RUN_ID`, `GITHUB_SHA`) for mapping downloaded artifacts to semantic rows.

In GitHub Actions, the `js` job writes `packages/web/test-results/ci-evidence-correlation-hint.txt` with the current `run_id` and artifact name pattern `evidence-web-{run_id}-playwright`, then uploads it with the HTML report and screenshots.
