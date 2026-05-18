# Two-Storey House With Stair Benchmark

This scenario is an executable M3-G fixture for the two-storey stair lane.

Run the offline semantic check:

```sh
node scripts/benchmarks/two-storey-stair.mjs --mode offline --json
```

Write local evidence hook files:

```sh
node scripts/benchmarks/two-storey-stair.mjs --mode offline --out-dir spec/benchmarks/two-storey-house-with-stair/live-evidence
```

The fixture intentionally classifies `createStair`, `createSlabOpening`, and
`createRailing` as raw bundle only. It does not claim full typed MCP/CLI parity
for vertical circulation. UI and Cmd+K evidence is traceability-only until a
browser-authored run can create the exact fixture geometry and compare a model
snapshot.
