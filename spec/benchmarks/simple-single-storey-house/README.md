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

Benchmark check:

```sh
node --test scripts/benchmarks/simple-house.test.mjs
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
- advisor/validation placeholder in offline mode, or live validation/advisor-like
  output from the dry-run response when available
- explicit UI-equivalent path TODOs

When `--out-dir` is provided, the runner writes:

- `semantic-summary.json`
- `semantic-diff.json`
- `execution-evidence.json`
- `benchmark-result.json`

TODO for full M2 exit:

- Add a UI/Cmd+K authoring path that produces a semantically equivalent house.
- Promote the dry-run evidence to a clean live commit gate and persist command
  log/undo/collaboration evidence from the commit response.
- Render nonblank plan and 3D screenshots for the agreed views.
- Add IFC and glTF export evidence.
