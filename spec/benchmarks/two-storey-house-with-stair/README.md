# Two-Storey House With Stair Benchmark

This scenario is an executable M3-L fixture for the two-storey stair lane.

Run the offline semantic check:

```sh
node scripts/benchmarks/two-storey-stair.mjs --mode offline --json
```

Write local evidence files:

```sh
node scripts/benchmarks/two-storey-stair.mjs --mode offline --out-dir spec/benchmarks/two-storey-house-with-stair/live-evidence
```

Collect from a live committed target:

```sh
node scripts/benchmarks/two-storey-stair.mjs \
  --mode live \
  --base-url http://127.0.0.1:8501 \
  --model-id <isolated-model-id> \
  --parent-revision <revision> \
  --commit-live \
  --out-dir spec/benchmarks/two-storey-house-with-stair/live-evidence
```

The fixture intentionally classifies `createStair`, `createSlabOpening`, and
`createRailing` as raw bundle only. It does not claim full typed MCP/CLI parity
for vertical circulation. Advisor, visual, export, and semantic-diff evidence is
collected from route contracts or live public model routes. UI and Cmd+K evidence
remains traceability-only until a browser-authored run can create the exact
fixture geometry and compare a model snapshot.
