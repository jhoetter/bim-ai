# Wave 2 — View System + Wall Depth + Openings

**Delete this entire `wave-02/` directory once all WPs are merged to main.**

## What this wave accomplishes

- Adds the Visibility/Graphics (VV) dialog — per-category line weight/color overrides applied to plan views
- Adds View Filters + View Range / Underlay / Crop UI (view range data already in store, just needs UI)
- Deepens wall geometry: location line offset applied to 3D mesh + plan wire; Wall Joins modify tool
- Adds Wall Opening and Shaft Opening tools (CSG cuts already work; R2-01 is closed)

## Status note — R2-01 already done

`three-bvh-csg` is already a dependency. `src/viewport/csgWorker.ts` fully implements door/window subtraction running in a Web Worker. `CSG_ENABLED` defaults to `true` (disabled only if `VITE_ENABLE_CSG=false`). WP-V2-04 therefore only needs the authoring tools — not the rendering.

## Execution order

### Batch A — run in parallel

No shared file conflicts between these two.

| Prompt                       | Branch                         | Files touched                                                                              |
| ---------------------------- | ------------------------------ | ------------------------------------------------------------------------------------------ |
| `WP-V2-02-wall-depth.md`     | `feat/wp-v2-02-wall-depth`     | `meshBuilders.ts`, `planElementMeshBuilders.ts`, `toolRegistry.ts`, `toolGrammar.ts`, `PlanCanvas.tsx` |
| `WP-V2-03a-vv-dialog.md`     | `feat/wp-v2-03a-vv-dialog`     | New `VVDialog.tsx`, `store.ts`, `planProjection.ts`, `AppShell.tsx`                        |

### Batch B — run in parallel after Batch A is merged

No shared file conflicts between these two.

| Prompt                           | Branch                             | Files touched                                                                       |
| -------------------------------- | ---------------------------------- | ----------------------------------------------------------------------------------- |
| `WP-V2-04-openings.md`           | `feat/wp-v2-04-openings`           | `toolRegistry.ts`, `toolGrammar.ts`, `PlanCanvas.tsx`                               |
| `WP-V2-03b-view-filters.md`      | `feat/wp-v2-03b-view-filters`      | `store.ts`, New `ViewFiltersPanel.tsx`, `InspectorContent.tsx`, `planProjection.ts` |

## Git workflow for each agent

```bash
git checkout main && git pull
git checkout -b <branch-name>
# ... implement, test ...
pnpm exec tsc --noEmit            # must be clean
pnpm exec vitest run src          # all tests pass
make verify                       # full CI gate
git add <specific files>
git commit -m "feat(scope): subject\n\nCo-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
git push -u origin <branch-name>
```

After both branches in a batch pass CI, merge both to main (`git merge --no-ff`), resolve any conflicts, push. Then update `spec/workpackage-master-tracker.md` WP states to `done` and commit.

## After all Wave 2 WPs are done

```bash
rm -rf spec/prompts/wave-02
git add spec/prompts/wave-02
git commit -m "chore: remove wave-02 prompt files — all WPs merged"
git push
```
