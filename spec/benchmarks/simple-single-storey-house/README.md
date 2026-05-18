# Simple Single-Storey House Benchmark

This is the M2-D/M2-I canonical benchmark for
`simple-single-storey-house`. It covers the MCP/CLI path as a deterministic
command bundle plus semantic and execution evidence, small enough to run in CI
without a live server.

Offline fixture mode:

```sh
node scripts/benchmarks/simple-house.mjs --mode offline
node scripts/benchmarks/simple-house.mjs --mode offline --json --out-dir /tmp/simple-house-evidence
```

Auto/live dry-run mode:

```sh
BIM_AI_BASE_URL=http://127.0.0.1:8500 \
BIM_AI_MODEL_ID=<model-id> \
BIM_AI_PARENT_REVISION=<revision> \
node scripts/benchmarks/simple-house.mjs --json --out-dir /tmp/simple-house-live-evidence
```

`--mode auto` is the default. It stays offline unless both `BIM_AI_BASE_URL`
and `BIM_AI_MODEL_ID` are present. `--mode live` requires a base URL and model
id and posts a dry-run request through the public CMD-v3 bundle API:

```text
POST /api/models/{model_id}/bundles
{ "bundle": <cmd-v3 bundle>, "mode": "dry_run", "userId": "benchmark-agent" }
```

Live commit mode mutates the target model and therefore requires the explicit
`--commit-live` flag:

```sh
BIM_AI_BASE_URL=http://127.0.0.1:8500 \
BIM_AI_MODEL_ID=<disposable-model-id> \
BIM_AI_PARENT_REVISION=<revision> \
node scripts/benchmarks/simple-house.mjs --mode live --commit-live --json --out-dir /tmp/simple-house-live-commit-evidence
```

With `--commit-live`, the runner dry-runs first, then posts the same bundle with
`mode: "commit"`, and captures the commit response plus post-commit command-log
and snapshot summaries when the server exposes those endpoints. It also reads
committed-model evidence from public advisor, validation, evidence-package, and
export endpoints. To inspect an already committed target without mutating it,
use `--collect-committed-evidence` instead of `--commit-live`.

Disposable live evidence runner:

```sh
BIM_AI_BASE_URL=http://127.0.0.1:8500 \
BIM_AI_PROJECT_ID=<project-id> \
node scripts/benchmarks/simple-house-live-evidence.mjs --out-dir /tmp/simple-house-live-evidence
```

The M2-P runner creates a disposable model through
`POST /api/projects/{project_id}/models`, captures live dry-run evidence, and
normalizes the artifact names consumed by the Wave 3/Wave 4 audit path. It does
not require secrets and rejects base URLs containing credentials.

To collect commit evidence against the disposable model:

```sh
BIM_AI_BASE_URL=http://127.0.0.1:8500 \
BIM_AI_PROJECT_ID=<project-id> \
node scripts/benchmarks/simple-house-live-evidence.mjs \
  --commit-live \
  --out-dir /tmp/simple-house-live-commit-evidence
```

Targeting an already isolated model is supported for dry-runs:

```sh
BIM_AI_BASE_URL=http://127.0.0.1:8500 \
BIM_AI_MODEL_ID=<isolated-model-id> \
BIM_AI_PARENT_REVISION=<revision> \
node scripts/benchmarks/simple-house-live-evidence.mjs --out-dir /tmp/simple-house-live-evidence
```

Commit against an existing model is intentionally refused unless both
`--commit-live` and `--allow-existing-model-commit` are passed, and
`--parent-revision` or `BIM_AI_PARENT_REVISION` is present. This keeps live
mutation explicit and revision-scoped. If disposable model creation is not
available on the backend, the runner fails before running the benchmark and
reports the missing capability instead of silently mutating another model.

Runner environment and flags:

- `BIM_AI_BASE_URL` / `--base-url`: live backend URL, without credentials.
- `BIM_AI_PROJECT_ID` / `--project-id`: project where a disposable model is
  created.
- `BIM_AI_MODEL_ID` / `--model-id`: already isolated live model target.
- `BIM_AI_PARENT_REVISION` / `--parent-revision`: existing model revision.
- `BIM_AI_TEMPLATE_ID` / `--template-id`: optional model template for creation.
- `BIM_AI_SIMPLE_HOUSE_EVIDENCE_DIR` / `--out-dir`: artifact directory.
- `--allow-existing-out-dir`: permit writing into a non-empty artifact
  directory.

Committed evidence surfaces:

- `GET /api/models/{model_id}/validate`
- `POST /api/models/{model_id}/qa/advisor`
- `GET /api/models/{model_id}/evidence-package`
- `GET /api/models/{model_id}/snapshot`
- `GET /api/models/{model_id}/summary`
- `GET /api/models/{model_id}/exports/gltf-manifest`
- `GET /api/models/{model_id}/exports/ifc-manifest`
- `GET /api/models/{model_id}/exports/sheet-print-raster.png?sheetId=ssh-sheet-a101`
- `GET /api/models/{model_id}/exports/sheet-preview.pdf?sheetId=ssh-sheet-a101`

Benchmark check:

```sh
node --test scripts/benchmarks/simple-house.test.mjs
node --test scripts/benchmarks/simple-house-live-evidence.test.mjs
```

Today the harness emits:

- one ground level and generated plan view
- four exterior walls and two interior partitions
- three rooms with canonical names and target areas
- three hosted doors and three hosted windows
- one floor slab and one gable roof
- one 3D saved viewpoint, one sheet with plan/3D views, one opening schedule
- minimum tag and dimension evidence
- command-surface usage and forbidden private/raw command checks
- semantic summary and semantic diff
- offline fixture evidence or live dry-run response evidence
- live commit response evidence when `--commit-live` is set, including revision,
  changed ids when returned, command-log summary, and snapshot summary
- advisor/validation placeholder in offline mode, or live validation/advisor-like
  output from the dry-run response when available
- committed validation/advisor JSON, evidence-package visual hints, deterministic
  server-side sheet raster substitute, and export artifact/manifest checks when
  `--commit-live` or `--collect-committed-evidence` is set
- explicit UI/Cmd+K traceability markers and remaining executable UI blockers

When `--out-dir` is provided, the runner writes:

- `semantic-summary.json`
- `semantic-diff.json`
- `execution-evidence.json`
- `committed-evidence.json`
- `advisor-validation.json`
- `visual-evidence.json`
- `export-evidence.json`
- `benchmark-result.json`
- `live-dry-run-evidence.json` in live commit mode
- `live-commit-evidence.json` in live commit mode
- `command-log-summary.json` in live commit mode
- `snapshot-summary.json` in live commit mode

The disposable live evidence runner always normalizes these audit-facing names
when it runs:

- `benchmark-result.json`
- `execution-evidence.json`
- `live-dry-run-evidence.json`
- `live-commit-evidence.json` with `mode: "not-requested"` when no commit was
  requested
- `command-log-summary.json` with `null` when no commit log is available
- `snapshot-summary.json` with `null` when no committed snapshot is available
- `committed-evidence.json` when the underlying benchmark collects it
- `live-runner-manifest.json` with target provenance and safety settings

UI/Cmd+K traceability:

- `ui-cmdk-traceability.json` lists the current command-palette steps that map
  to the simple-house semantic outputs, including capability ids, execution
  kinds, agent-equivalent ids where available, and known blockers.
- This path is traceability-only. It does not run browser gestures, produce a
  UI-authored model, or compute a semantic diff against the MCP/CLI fixture.
- Web test coverage in `packages/web/src/cmdPalette/simpleHouseUiTraceability.test.ts`
  verifies the referenced Cmd+K ids exist and that activator/navigation steps
  are not misclassified as committed benchmark output.

TODO for full M2 exit:

- Add an executable UI/Cmd+K authoring path that produces a semantically
  equivalent house and diffs it against the MCP/CLI fixture.
- Capture browser-rendered nonblank plan and 3D screenshots for the agreed
  views; the current helper records the deterministic server-side sheet raster
  substitute explicitly.
- Add command-log/undo/collaboration proof through stable public endpoints; the
  current helper uses the public command-log endpoint when present and falls
  back to commit response changed ids plus snapshot/summary.
- Add IFC/glTF export round-trip checks; the current helper verifies at least
  one export artifact or manifest is returned.
