# WP-042-fix — AST-V3-01: Fix broken TypeScript bindings, CLI surface, and canvas placement

**Branch:** feat/v3-ast-v3-01-asset-library
**Base review:** FAIL (see wp-042.md for original spec)
**Fix target:** Bring the branch to a mergeable state by closing four categories of gaps.

## Required reading

- spec/v3-prompts/wp-042.md (original spec — re-read end-to-end)
- packages/core/src/index.ts (TypeScript type exports)
- packages/cli/cli.mjs (CLI surface)
- packages/web/src/assets/ (all files in the asset library feature)
- app/bim_ai/assets.py, app/bim_ai/elements.py, app/bim_ai/commands.py

## Setup

```bash
git fetch origin
git checkout feat/v3-ast-v3-01-asset-library
git pull origin feat/v3-ast-v3-01-asset-library
```

## Failures to fix — fix ALL of these before pushing

### 1. TypeScript core exports missing (build-breaking)

`packages/core/src/index.ts` is missing these exports that frontend files import:
- `AssetLibraryEntry` (type/interface)
- `AssetKind` (union or enum)
- `AssetCategory` (union or enum)
- `AssetDisciplineTag` (union or enum)
- `ParamSchemaEntry` (type/interface)

Add them to `packages/core/src/index.ts` mirroring the Python definitions in `assets.py`.
The ElemKind union must also include `"asset_library_entry"` and `"placed_asset"`.
The Element union must include `AssetLibraryEntryElem` and `PlacedAssetElem` shapes.

Do NOT add `ToposolidElem` or `PresentationLinkElem` here — those belong to WP-041 and WP-045.

### 2. CLI surface missing (API-V3-01 §A requirement)

`packages/cli/cli.mjs` must expose:
- `bim-ai asset index <file>` → calls `IndexAssetCmd`
- `bim-ai asset place <asset-id> --model <model-id> --pos x,y,z` → calls `PlaceAssetCmd`

Follow the pattern of existing commands already in cli.mjs. Add JSON schema descriptors in the Python tool descriptor list (check app/bim_ai/tools.py or wherever tool descriptors live).

### 3. No-op onPlace stub (canvas placement unimplemented)

In `packages/web/src/workspace/Workspace.tsx` (or wherever `LibraryOverlay` is mounted), the `onPlace` callback is empty. Implement it: call the `PlaceAsset` REST endpoint with the asset id and the canvas coordinates from the drop event, then add the returned element to the store. A full 60-fps associative-snap is not required in this fix — a simple HTTP call + store update that places the element at the drop location is sufficient.

### 4. Subscribed-libraries list absent from left rail

The spec requires a "subscribed libraries" list alongside category facets and discipline filter. Add a simple static list (even hardcoded to `["Built-in"]` for now) in `LibraryOverlay.tsx` under a `<ul>` with the heading "Libraries". This satisfies the acceptance criterion visually; the subscription backend is wave-7.

### 5. Scope creep — remove non-AST commands

The following commands were added to `commands.py` / `engine.py` but are NOT part of WP-042:
- `TraceImageCmd` (belongs to WP-043)
- `CreateToposolidCmd`, `UpdateToposolidCmd`, `DeleteToposolidCmd` (belong to WP-041)
- `PresentationLinkElem` (belongs to WP-045)
- `SetElementDisciplineCmd` in `cli.mjs` if it came from this branch

Remove them from this branch. If they are also on their respective dedicated branches (WP-041, WP-043, WP-045), they will land when those branches merge.

## Verify gate

```bash
pnpm exec tsc --noEmit            # must be clean
pnpm test                         # AST tests must pass
make verify                       # full CI gate
```

## Commit and push

```bash
git add <specific files only>
git commit -m "fix(ast): close TypeScript bindings, CLI surface, canvas placement, remove scope creep"
git push origin feat/v3-ast-v3-01-asset-library
```

## Final report

Paste back: branch, final commit SHA, make verify result, and which of the 5 gaps above are closed.
