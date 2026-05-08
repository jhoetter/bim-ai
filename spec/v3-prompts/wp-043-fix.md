# WP-043-fix — IMG-V3-01: Fix missing pipeline steps, scope creep, and acceptance tests

**Branch:** feat/v3-img-v3-01-image-to-layout
**Base review:** FAIL (see wp-043.md for original spec)
**Fix target:** Bring the branch to a mergeable state by closing five categories of gaps.

## Required reading

- spec/v3-prompts/wp-043.md (original spec — re-read end-to-end)
- app/bim_ai/img/pipeline.py (the CV pipeline)
- app/bim_ai/routes_api.py (REST routes)
- packages/cli/cli.mjs (CLI surface)
- app/tests/test_img_v3_01.py (existing test file)
- app/bim_ai/jobs/ (JOB-V3-01 queue — already merged on main)

## IMPORTANT: branch dependency

This branch was started from feat/v3-top-v3-01-toposolid (not from main).
WP-041 (TOP-V3-01) must merge to main BEFORE this fix is pushed.
After WP-041 merges, rebase this branch onto main:

```bash
git fetch origin
git rebase origin/main
# resolve any conflicts, then continue
git push --force-with-lease origin feat/v3-img-v3-01-image-to-layout
```

## Setup

```bash
git fetch origin
git checkout feat/v3-img-v3-01-image-to-layout
git pull origin feat/v3-img-v3-01-image-to-layout
```

## Failures to fix — fix ALL of these before pushing

### 1. SKB-04 calibrator not wired

`pipeline.py` must call `bim_ai.skb.calibrator.calibrate(edges)` as pipeline step 1 to derive
`mm_per_px`. Replace the hardcoded `_DEFAULT_SCALE_MM_PER_PX = 1.0` with the calibrator output.
If `bim_ai.skb.calibrator` does not yet exist (the module may be a stub), create a minimal
implementation that reads the image's largest detected rectangular room and uses standard room
dimensions (e.g. 3600 mm wide) to estimate the scale. This is the deterministic CV approach
specified in the WP; it does not need to be perfect, just non-hardcoded.

### 2. SKB-07 colour sampler not called

After room polygon detection, call `bim_ai.skb.colour_sampler.sample(image, polygon)` for each
room to populate `detectedTypeKey` (e.g. "bedroom", "kitchen", "bathroom"). If the colour_sampler
module is a stub, implement a minimal version: sample the average hue of the room interior pixels
and return a type key based on hue range (warm → "living", cool → "bathroom", etc.). The exact
accuracy is not the acceptance criterion — the field must be non-null for at least 50% of rooms.

### 3. JOB-V3-01 queue not invoked for large images

The `POST /api/v3/trace` handler's large-file path (>2 MB) returns a fake job ID without calling
the jobs queue. Fix it: import from `app.bim_ai.jobs` (already on main from WP-022) and call
`jobs.queue.enqueue(trace_job, image_path, model_id)`. The job function should call the same
`pipeline.run()` logic and write the result to the job's output. Follow the JOB-V3-01 pattern
from `app/bim_ai/jobs/`.

### 4. Scope creep — remove OUT-V3-01 routes from this branch

`routes_api.py` in this branch contains ~235 lines of presentation URL routes
(`/models/{id}/presentations`, `/presentations/{id}/revoke`, `/p/{token}`, `/p/{token}/ws`).
These belong to WP-045 (OUT-V3-01) which has its own dedicated branch
`feat/v3-out-v3-01-live-web-link`. Remove them from this branch entirely — they will land when
WP-045 merges. This avoids a double-merge conflict.

If `element-set-discipline` CLI command was added to `cli.mjs` by this branch and does not
belong to IMG-V3-01, remove it too — it belongs to WP-040 (DSC-V3-01).

### 5. Add agent-callable layer tests

Per §A Agent Instructions, add HTTP-layer tests to `app/tests/test_img_v3_01.py`:
- `test_trace_image_small_file` — POSTs a <2 MB synthetic PNG to `POST /api/v3/trace`,
  asserts HTTP 200 and that the response body has `rooms` and `walls` arrays.
- `test_trace_image_large_file` — POSTs a >2 MB stub image, asserts HTTP 202 and
  `{"jobId": <uuid>}` response.
- `test_no_walls_advisory` — sends an image that produces no walls, asserts HTTP 422
  with `advisories` containing `"no_walls_detected"`.

Use `httpx.AsyncClient` / `TestClient` pattern matching the existing API tests in the repo.

## Verify gate

```bash
pnpm exec tsc --noEmit
pnpm test
make verify
```

## Commit and push

```bash
git add <specific files only>
git commit -m "fix(img): wire calibrator+sampler, real job queue, remove OUT scope creep, add HTTP tests"
git push origin feat/v3-img-v3-01-image-to-layout
```

## Final report

Paste back: branch, final commit SHA, make verify result, and which of the 5 gaps above are closed.
