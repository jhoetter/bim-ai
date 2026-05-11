# WP-041-fix — TOP-V3-01: Remove AST scope creep, add TS types, CLI surface, floor inheritance

**Branch:** feat/v3-top-v3-01-toposolid
**Base review:** FAIL (see wp-041.md for original spec)
**Fix target:** Clean the branch of scope creep, add missing TypeScript types and CLI, implement floor inheritance.

## Required reading

- spec/v3-prompts/wp-041.md (original spec — re-read end-to-end)
- packages/core/src/index.ts (TypeScript type exports)
- packages/cli/cli.mjs (CLI surface)
- app/bim_ai/elements.py, app/bim_ai/commands.py, app/bim_ai/engine.py

## Setup

```bash
git fetch origin
git checkout feat/v3-top-v3-01-toposolid
git pull origin feat/v3-top-v3-01-toposolid
git log --oneline origin/main..HEAD
```

You will see two commits: one AST commit (394e4588) and one TOP commit (c57633c9).
The AST commit does not belong here. Remove it:

```bash
# Rebase TOP commit onto main, dropping the inherited AST commit:
git rebase --onto origin/main 394e4588 HEAD
# This replays only the TOP commit on top of main.
git push --force-with-lease origin feat/v3-top-v3-01-toposolid
```

If the rebase has conflicts in files that TOP and AST both touched (commands.py, elements.py),
keep only the TOP-relevant additions. If AST-specific types (AssetLibraryEntry, etc.) were added
to elements.py, remove them — they belong on the AST branch only.

## Failures to fix (after removing AST scope creep)

### 1. TypeScript core exports missing

Add to `packages/core/src/index.ts`:
- `BoundaryPoint: { x: number; y: number }`
- `HeightSample: { point: BoundaryPoint; elevation: number }`
- `HeightmapGrid: { cols: number; rows: number; cellSizeM: number; elevations: number[] }`
- `Toposolid` interface with all fields from the Python model (boundary, heightmap, thickness, materialToken, etc.)
- Add `kind: 'toposolid'` to the `ElemKind` union
- Add `ToposolidElem` (with `kind: 'toposolid'` discriminant) to the `Element` union

### 2. CLI exposure missing (API-V3-01 §A requirement)

Add to `packages/cli/cli.mjs`:
- `bim-ai toposolid create --model <id> --boundary <json-file> --thickness <m>` → CreateToposolidCmd
- `bim-ai toposolid update --id <id> --boundary <json-file>` → UpdateToposolidCmd
- `bim-ai toposolid delete --id <id>` → DeleteToposolidCmd

Follow the pattern of existing commands. Register JSON schema tool descriptors in the Python
tool descriptor list per API-V3-01.

### 3. DeleteToposolidCmd floor-hosting warning missing

In `engine.py` `case DeleteToposolidCmd():`, scan all floor elements for `host_id == cmd.id`.
If any exist, emit a warning advisory (not an error) before deleting. Use the same advisory
pattern as other warning-emitting commands in the engine.

### 4. Floor surface elevation inheritance

When `CreateFloorCmd` or `UpdateFloorCmd` is executed on a level that intersects a toposolid:
query the toposolid's heightmap at the floor's x/y position and set the floor's elevation from it.
Add a Python test: place a toposolid with a known elevation at (5, 5) meters, create a floor at
the same level, assert the floor's z-position matches the toposolid surface.

### 5. CSG floor-cut test

Add a Python test that creates a toposolid and a building footprint (rectangle polygon), runs the
CSG subtraction helper (whatever function the engine uses for this), and asserts the result has
the expected number of boundary vertices. A simple sanity check is sufficient.

## Verify gate

```bash
pnpm exec tsc --noEmit
pnpm test
make verify
```

## Commit and push

```bash
git add <specific files only — NOT git add -A>
git commit -m "fix(top): add TS types + CLI surface + floor inheritance + floor-cut test; remove AST scope creep"
git push --force-with-lease origin feat/v3-top-v3-01-toposolid
```

## Final report

Paste back: branch, final commit SHA (after rebase), make verify result, and which of the 5 gaps above are closed.
