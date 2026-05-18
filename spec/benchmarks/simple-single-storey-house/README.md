# Simple Single-Storey House Benchmark

This is the M2-D Wave 1 canonical fixture for `simple-single-storey-house`.
It covers the MCP/CLI path as a deterministic command bundle plus semantic and
evidence expectations, small enough to run in CI without a live server.

Run:

```sh
node scripts/benchmarks/simple-house.mjs
```

Today the harness validates:

- one ground level and generated plan view
- four exterior walls and two interior partitions
- three rooms with canonical names and target areas
- three hosted doors and three hosted windows
- one floor slab and one gable roof
- one 3D saved viewpoint, one sheet with plan/3D views, one opening schedule
- minimum tag and dimension evidence
- command-surface usage and forbidden private/raw command checks

TODO for full M2/M3 exit:

- Add a UI/Cmd+K authoring path that produces a semantically equivalent house.
- Run the MCP/CLI bundle through the live typed route/CLI path in dry-run and
  commit modes, then persist command log, semantic summary, advisor JSON, and
  validation output.
- Render nonblank plan and 3D screenshots for the agreed views.
- Add IFC and glTF export evidence once the live benchmark runner is wired.
