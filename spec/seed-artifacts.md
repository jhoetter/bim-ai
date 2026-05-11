# Seed Artifact Contract

Seed artifacts are the handoff format between sketch-to-BIM generation and the
local seeded project loader. A seed artifact is named, self-contained, and safe
to load without referencing another seed run.

## Goals

- Keep user source material, generated bundles, advisor output, screenshots, and
  acceptance notes in one isolated folder per seed.
- Let `make seed` load all available artifacts into separate local models.
- Let `make seed name=<seed-name>` load or refresh one artifact.
- Avoid generated seed data in `packages/cli/lib`, `nightshift`, E2E fixtures, or
  other shared source folders.
- Keep loadable seed artifacts versioned under `seed-artifacts/<name>/` so a
  clean checkout can run `make seed name=<name>` without regenerating bundles.
- Make cleanup trivial: delete an artifact folder and run `make seed`, or run
  `make seed-clear`.

## Default Location

Generated artifacts live under:

```text
seed-artifacts/<name>/
```

`seed-artifacts/<name>/` folders are tracked by git. Runtime scratch files,
temporary captures, and large exploratory evidence should stay out of artifact
folders until they are part of the accepted, portable artifact package.

## Layout

```text
seed-artifacts/<name>/
  manifest.json
  bundle.json
  source/
  evidence/
```

Required files:

- `manifest.json`: metadata and file pointers.
- `bundle.json`: `cmd-v3.0` command bundle or a raw command array.
- `source/`: copied user input folder, excluding transient build/cache folders.
- `evidence/`: validation, advisor JSON, screenshots, visual readout, and notes.

## Manifest

```json
{
  "schemaVersion": "bim-ai.seed-artifact.v1",
  "name": "target-house-1",
  "slug": "target-house-1",
  "title": "Target House 1",
  "description": "Modern two-level house from customer sketch.",
  "bundle": "bundle.json",
  "sourceRoot": "source",
  "evidenceRoot": "evidence",
  "generatedBy": {
    "tool": "scripts/create-seed-artifact.mjs",
    "version": 1
  },
  "inputPaths": {
    "source": "spec/target-house",
    "bundle": "target-house-1-bundle.json"
  },
  "bundleSha256": "...",
  "commandCount": 144,
  "entryComment": {
    "body": "Seed artifact loaded from target-house-1."
  }
}
```

`name` and `slug` must use lowercase letters, digits, `.`, `_`, or `-`.

## Creation

Package a source folder and generated bundle:

```bash
node scripts/create-seed-artifact.mjs \
  --name target-house-1 \
  --source /path/to/customer-house-folder \
  --bundle /path/to/generated/bundle.json
```

The packer copies the full source folder into `source/`, filters cache/build
directories, copies the bundle to `bundle.json`, creates `evidence/`, and writes
the manifest. Manifest provenance paths are portable labels only; do not commit
machine-local absolute paths such as `/Users/...`.

## Loading

Load all artifacts:

```bash
make seed
```

Load or refresh one artifact:

```bash
make seed name=target-house-1
```

Clear seed-managed local models:

```bash
make seed-clear
```

The exact command `make seed --name target-house-1` is not supported because
GNU make consumes `--name` before the recipe can receive it.

## Isolation Rules

- A seed artifact must not read source files outside its own directory at load
  time.
- `bundle.json` is applied to an empty `Document`; no previous model state is
  reused.
- Loading all artifacts clears and rebuilds the local seed project from the
  artifact root.
- Loading one artifact overwrites only that deterministic model id.
- Legacy `demo/main` seed models are cleared before any seed load, so old
  hard-coded seedhouse data cannot appear in the UI.

## UI Behavior

All loaded artifact models appear in the top-left project menu under **Seeded
projects**. Selecting a row hydrates that model and reconnects WebSocket state to
the selected model id.
