# WP-044-fix — CAN-V3-01: Fix line-weight step values, thread weights into draw calls, add brand-swap test

**Branch:** feat/v3-can-v3-01-line-weight-hierarchy
**Base review:** FAIL (see wp-044.md for original spec)
**Fix target:** Three critical gaps: (a) correct step values, (b) actually apply weights in draw calls, (c) brand-swap CI test.

## Required reading

- spec/v3-prompts/wp-044.md (original spec — re-read end-to-end)
- packages/web/src/plan/ (plan canvas renderer, especially the wire-mesh rebuild path)
- packages/web/src/__tests__/brandSwap.test.ts (brand-swap invariant test)
- packages/web/src/plan/lineWeights.ts (or wherever the weight computation lives)

## Setup

```bash
git fetch origin
git checkout feat/v3-can-v3-01-line-weight-hierarchy
git pull origin feat/v3-can-v3-01-line-weight-hierarchy
```

## Failures to fix

### 1. Wrong step values (the single biggest correctness issue)

The current implementation uses a continuous formula `base * 50/scale`. The WP specifies discrete steps:

```
Scale 1:50  (plotScale=50):   cutMajor=0.50, cutMinor=0.25, projMajor=0.25, projMinor=0.18, witness=0.50
Scale 1:100 (plotScale=100):  cutMajor=0.35, cutMinor=0.18, projMajor=0.18, projMinor=0.12, witness=0.50
Scale 1:200 (plotScale=200):  cutMajor=0.25, cutMinor=0.12, projMajor=0.12, projMinor=0.09, witness=0.50
Scale 1:500 (plotScale=500):  cutMajor=0.40, cutMinor=0.20, projMajor=null, projMinor=null, witness=0.50
```

Key rules from the spec:
- `witness` is always 0.50 px regardless of scale (hairline, does not scale).
- At 1:500, `projMajor` and `projMinor` are null (suppressed) — only cut lines show.
- At 1:500, `cutMajor` is 0.40 (not 0.20 from the continuous formula).

Replace the continuous formula with a lookup table. For scales between defined steps,
interpolate linearly between the nearest two step entries. Update all tests to assert the
correct values.

### 2. Computed weights not applied to draw calls

`cutMajor`, `cutMinor`, `projMajor`, `projMinor` are computed but never actually passed to
the material or `line.linewidth` in the Three.js draw calls. Fix `rebuildPlanMeshesFromWire`
(and the fallback `rebuildPlanMeshes` path) to:

- Set wall cut-line linewidth to `lineWeights.cutMajor`
- Set wall projection-line linewidth to `lineWeights.projMajor` (or skip if null)
- Set stair/column projection linewidth to `lineWeights.projMinor` (or skip if null)
- Set witness/dimension linewidth to `lineWeights.witness`

Follow the same approach used for `suppressProjection` (the only field currently read) —
use the same guard pattern.

### 3. Brand-swap CI invariant test missing

The acceptance criterion says: "Brand-swap CI invariant test asserts these line weights are
byte-identical when only `--brand-accent` changes."

In `packages/web/src/__tests__/brandSwap.test.ts`, in the `LAYER_A_REQUIRED` or equivalent
list, add the line-weight CSS custom properties:
```
'--draft-lw-cut-major'
'--draft-lw-cut-minor'
'--draft-lw-proj-major'
'--draft-lw-proj-minor'
'--draft-lw-witness'
```

And add a test case: render the plan canvas at 1:50 with brand-A tokens and brand-B tokens
(different `--brand-accent`), assert the rendered line widths are identical in both renders.

## Verify gate

```bash
pnpm exec tsc --noEmit
pnpm test                 # lineWeights tests must assert new step values
make verify
```

## Commit and push

```bash
git add <specific files only>
git commit -m "fix(can): correct line-weight step values, thread into draw calls, add brand-swap invariant test"
git push origin feat/v3-can-v3-01-line-weight-hierarchy
```

## Final report

Paste back: branch, final commit SHA, make verify result, which of the 3 gaps are closed.
