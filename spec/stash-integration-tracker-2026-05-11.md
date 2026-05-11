# Stash Integration Tracker - 2026-05-11

Purpose: record the recovery pass over the local stash stack before clearing it.

Backup: `/Users/jhoetter/repos/bim-ai-stash-backup-2026-05-11-184836`

Method:

1. Exported every stash diff and hash to the backup directory before dropping anything.
2. Skipped known noise-only entries: `stash@{7}`, `stash@{26}`, `stash@{27}`, `stash@{37}`, `stash@{47}`, `stash@{48}`, `stash@{49}`.
3. Applied only the missing non-duplicative code found during review.
4. Treated stashes as superseded when the same behavior is already present on `main` under the current refactored paths.

Integrated code:

| Source | Result |
| --- | --- |
| `stash@{8}` | Recovered contextual tool-palette filtering: `FloatingPalette.allowedToolIds` now passes through to `ToolPalette`, and `ToolPalette` filters its mode palette when the set is provided. |

Superseded or already present on `main`:

| Source | Topic | Main state |
| --- | --- | --- |
| `stash@{0}` | Property-line bearing tables, curved walls, permissions, workspace switcher, grip/radial-menu work | Already present in split dispatch/modules and web workspace code; matching tests and tracker entries exist on `main`. |
| `stash@{1}` | DXF/link CAD, Manage Links, sketch-to-BIM methodology, target-house snapshot work | Already present on `main` through DXF parser/routes/tests, Manage Links UI, SKB skill/spec, and later seed methodology work. |
| `stash@{2}`, `stash@{3}` | Public presentation route and family-library/catalog UI | Already present or replaced by the current presentation viewer and family/catalog implementation. |
| `stash@{4}` | Topbar declutter, icon gallery, furniture/revit parity notes | Already present or superseded by the merged UX command-reachability work and current icon modules. |
| `stash@{5}`, `stash@{6}` | Parity tracker/readme sync, plan-view subtype, apply area rules, one-family-home seed edits | Already present in current store coercion/runtime slices, inspector/options bar, Revit parity docs, and later seed artifacts. |
| `stash@{9}`-`stash@{13}` | V3 render compare, schedules, PBR material/decal, hatch/canvas work | Already present or superseded by current schedule endpoint, material/decal helpers, and current V3 tracker state. |
| `stash@{14}`-`stash@{17}` | Image-clean/SKB calibrator, colour sampler, tables, drafting standards | Already present or superseded by current `skb`, trace-image, route, and drafting-standard modules. |
| `stash@{18}`-`stash@{25}` | Discipline primitives, detail-level rendering, design options, collaboration/share, topographic/toposolid WIP | Already present in split engine dispatch, current V3 kernel/site modules, or superseded by later tracker/docs. |
| `stash@{28}`-`stash@{35}` | Activity stream, 3D comments, wall sweeps/reveals, phasing/design-option mixed WIP | Already present or superseded by current comments/activity/routes, wall sweep/reveal tests, and design-option handling. |
| `stash@{36}`, `stash@{38}`-`stash@{46}` | Roof joins, plan regions, tokenisation, DXF/IFC/site recovery WIP | Already present or superseded by current roof/site/DXF/IFC/tokenisation modules and tests. |
| `stash@{50}`-`stash@{55}` | Door/window setters, Text3D, roof/profile work, collaboration model, tool grammar | Already present in current property dispatch, Text3D geometry, core schema, docs, and tool registry/grammar. |
| `stash@{56}`-`stash@{59}` | Type catalog/icon redesign, curtain wall renderer, outline-selection UI | Already present or superseded by current icon packages, `meshBuilders.makeCurtainWallMesh`, Viewport selection/grip code, and workspace shell. |
| `stash@{60}`-`stash@{75}` | Evidence/IFC/sheet/section/schedule/agent-review production parity WIP | Already present or superseded by current evidence manifest, closeout readiness, browser rendering budget readouts, schedule target-area handling, plan projection, and agent review modules. |

Retained externally:

The exported backup contains `stash-list.txt`, `stash-hashes.txt`, and one patch file per stash. If any disposition above needs to be audited later, recover from that backup rather than from the cleared stash stack.
