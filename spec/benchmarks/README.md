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
the M3-G executable `two-storey-house-with-stair` fixture. The stair scenario has
an offline MCP/CLI semantic runner and UI/Cmd+K traceability, but stair, slab
opening, and railing creation are still raw bundle only; advisor, visual, and
export evidence remain live hooks until collected against a committed target.
