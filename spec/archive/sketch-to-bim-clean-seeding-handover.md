# Sketch-to-BIM Clean Seeding Handover

Date: 2026-05-11

## Why This Exists

The seed-generation workflow has improved structurally, but the methodology is
not yet good enough. A fresh agent should continue from the cleaned artifact
system without assuming the currently packaged target house is architecturally
final.

The goal is a project-initiation workflow where an AI architect can take an
arbitrary user input folder, understand the sketch/spec deeply, create a clean
BIM seed artifact, load it through the normal software path, inspect rendered
views and advisor warnings, iterate, and leave a portable artifact that can be
committed and loaded on another machine.

## Current Repository State

- Branch: `main`.
- Relevant committed seed workflow commit: `9ca4dec3a Version target house seed artifact`.
- At the time this handover was written, local `HEAD` was
  `08fd79145 Enrich constructability issue snapshots` and `origin/main` was
  `3aa48d74f test(tst): assert refinement compare artifacts`.
- The only uncommitted file intentionally created by this handover is this file:
  `spec/sketch-to-bim-clean-seeding-handover.md`.
- Do not revert or overwrite unrelated local changes if new ones appear; several
  agents have been committing on this repository concurrently.

## What Is Now Implemented

Seed artifacts are now intended to be versioned in git under:

```text
seed-artifacts/<name>/
  manifest.json
  bundle.json
  source/
  evidence/
```

The checked-in artifact currently present is:

```text
seed-artifacts/target-house-1/
```

It contains:

- `manifest.json`
- `bundle.json`
- copied source inputs from `spec/target-house/`
- `evidence/README.md`

The loader command works:

```bash
make seed name=target-house-1
```

Expected output includes:

```text
seed: loaded 1 seed artifact(s) from .../seed-artifacts
  target-house-1:<deterministic-model-uuid>
```

The packer is:

```bash
node scripts/create-seed-artifact.mjs \
  --name target-house-1 \
  --source spec/target-house \
  --bundle /path/to/bundle.json \
  --force
```

The manifest is now portable: it should not contain `/Users/...` or any other
machine-local absolute paths.

## Important Caveat

The current `target-house-1` artifact was packaged from the best available
existing command source, not from a fully fresh methodology run. Its bundle was
derived from the old target-house command builder in the preserved worktree:

```text
.claude/worktrees/feat+seed-target-house/packages/cli/lib/one-family-home-commands.mjs
```

That was acceptable as a bridge to prove artifact packaging and loading, but it
is not the desired long-term methodology. A fresh agent should treat the current
artifact as a loadable baseline, not as proof that the sketch-to-BIM process is
solved.

## What The Next Agent Should Do

1. Read the methodology and artifact contract first:

```text
claude-skills/sketch-to-bim/SKILL.md
spec/sketch-to-bim-methodology.md
spec/seed-artifacts.md
spec/target-house/target-house-seed.md
```

2. Start from the user input folder model, not a hard-coded house:

```text
spec/target-house/
```

This folder currently holds the target images, floorplan, and detailed seed
spec. The workflow should also work for any arbitrary folder elsewhere on disk.

3. Recreate `target-house-1` from methodology, not from the old command builder.

The next bundle should be generated from an explicit sketch-understanding and
modeling pass. It should not depend on `packages/cli/lib/one-family-home-*`,
old E2E fixtures, `nightshift`, or previous generated seed data.

4. Use the software loop while authoring:

```bash
make seed name=target-house-1
make dev
```

Then inspect:

- advisor warnings and infos in the right rail;
- rendered 3D views from multiple angles;
- plan topology;
- room closure;
- room door access;
- stair placement and clearances;
- roof cutout / embedded balcony geometry;
- wall tops and roof-wall intersections;
- sheets, schedules, and saved views where expected.

5. Iterate until the model is clean enough to be a first-impression seed.

Do not accept obvious advisor issues such as:

- open room boundaries;
- rooms without doors;
- ambiguous derived interior separations;
- stairs running into walls;
- roof openings that are only metadata and not visible geometry;
- old seedhouse geometry reappearing.

6. Repackage only the final accepted artifact.

The committed artifact must be self-contained:

```text
seed-artifacts/target-house-1/manifest.json
seed-artifacts/target-house-1/bundle.json
seed-artifacts/target-house-1/source/...
seed-artifacts/target-house-1/evidence/...
```

The bundle must apply to an empty model. Loading one seed must not leak data
from another seed.

## Verification Commands

Run these before handing back:

```bash
node --check scripts/create-seed-artifact.mjs
cd app && PYTHONPATH=. .venv/bin/python -m pytest tests/test_seed_artifact_roundtrip.py -q --no-cov
make seed-clear
make seed name=target-house-1
```

If the server is needed for visual/advisor verification:

```bash
make dev
```

Then inspect `http://127.0.0.1:2000/`.

## Quality Bar

The next agent should not optimize only for "a seed loads." The real target is:

- clean file boundaries;
- reproducible artifact creation;
- committed, portable seed packages;
- no stale seed data in source folders;
- no hidden dependency on previous seed runs;
- advisor-driven iteration;
- visual comparison against the sketch;
- a model that feels intentionally authored, not merely massed.

If the current app APIs are insufficient for this, document exactly which
command/API/validator is missing and add the smallest durable improvement needed
for the workflow.
