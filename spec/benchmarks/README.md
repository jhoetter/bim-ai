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
the M3-L `two-storey-house-with-stair` fixture. The stair scenario has an offline
MCP/CLI semantic runner, advisor/visual/export route evidence, and UI/Cmd+K
traceability, but stair, slab opening, and railing creation are still raw bundle
only. UI/Cmd+K remains traceability-only until a browser-authored exact replay is
available.

The M4 professional-domain suite is `professional-suite.json`. It enumerates
the first benchmark slots for `site-and-context-house`,
`structure-and-mep-lite`, `families-assets-materials`, `documentation-pack`, and
`presentation-pack`. These M4 scenarios are intentionally placeholder fixtures
until the M4-A through M4-E feature lanes land first-class descriptors and
executable or validated replay evidence.
