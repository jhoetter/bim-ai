# Wave 5 — Families + Collaboration

## Goal

Family Editor V2 (template env, parametric dims, EQ, type params, void geometry, profile family) and Collaboration V2 (Worksets, Copy/Monitor, Synchronize, Purge Unused, Starting View).

## Parallel execution analysis

**Both WPs run in parallel (Batch A).**

| WP       | Branch                        | core/index.ts region         | i18n.ts region                   | other files                              |
| -------- | ----------------------------- | ----------------------------- | --------------------------------- | ---------------------------------------- |
| WP-V2-11 | `feat/wp-v2-11-family-editor` | END — appends new shapes      | adds new `familyEditor:` section  | families/types.ts, App.tsx, NEW FamilyEditorWorkbench.tsx |
| WP-V2-12 | `feat/wp-v2-12-collaboration` | MIDDLE — adds fields to existing level/wall/grid_line/floor/project_settings shapes | adds to existing `inspector.fields` | InspectorContent.tsx, store.ts, NEW PurgeUnusedPanel.tsx |

These regions do not overlap. The `|` separator line in ElemKind only changes at the terminal semicolon for V2-11 (appending after `project_param`), while V2-12 touches interior field blocks of existing shapes. There is no shared anchor between the two WPs.

## Done rule

(a) `pnpm exec tsc --noEmit` clean; (b) all new logic has vitest unit coverage; (c) `make verify` passes; (d) merged to main and pushed.

## Batch A (parallel)

```
WP-V2-11    feat/wp-v2-11-family-editor
WP-V2-12    feat/wp-v2-12-collaboration
```
