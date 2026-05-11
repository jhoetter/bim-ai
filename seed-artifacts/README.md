# Seed Artifacts

Generated seed artifact sets live here by default, one directory per seed name:

```text
seed-artifacts/<name>/
  manifest.json
  bundle.json
  source/
  evidence/
```

This directory is intentionally ignored by git except for this README and
`.gitkeep`, so seed runs do not leak generated houses, screenshots, or advisor
evidence into unrelated commits.

Create an artifact from any source folder and a generated command bundle:

```bash
node scripts/create-seed-artifact.mjs \
  --name target-house-1 \
  --source /path/to/source-folder \
  --bundle /path/to/bundle.json
```

Load all artifacts into the local seed project:

```bash
make seed
```

Load or refresh one named artifact:

```bash
make seed name=target-house-1
```

Clear every seed-managed local model:

```bash
make seed-clear
```
