# Same-House Benchmark Suite

The suite manifest is `suite.json`. It enumerates M3 same-house scenarios and
requires every scenario to report these evidence kinds:

- `ui`
- `cmdK`
- `mcpCli`
- `advisor`
- `visual`
- `export`
- `semanticDiff`

Evidence classifications are intentionally conservative:

- `executable`: an executable runner or collected artifact exists for that
  evidence kind.
- `validated-replay`: a deterministic replay or bridge test validates the path
  against the scenario fixture, but does not prove browser-authored exact input.
- `traceability-only`: intended UI/Cmd+K affordances are mapped without an
  executable replay.
- `missing`: no evidence exists yet.

Run the suite enumerator:

```sh
node scripts/benchmarks/suite.mjs --json
node --test scripts/benchmarks/suite.test.mjs
```

The suite currently contains the closed `simple-single-storey-house` fixture and
the first M3 expansion seed, `two-storey-house-with-stair`. The second scenario
is deliberately spec-only until its MCP/CLI bundle, UI/Cmd+K traceability,
advisor, visual, export, and semantic-diff artifacts exist.
