# BIM AI UX Rework Dynamic Audit

Last updated: 2026-05-12

Master index: [`spec/ux-bim-ai-rework-master.md`](./ux-bim-ai-rework-master.md)

This document records the live UI audit performed after the static specification/tracker pass. It exists because the revamp cannot be judged from code inspection alone: several important surfaces only appear after seeding a model, switching view modes, selecting an element, opening Cmd+K, or entering an active tool state.

## Audit Setup

| Item                 | Value                                                     |
| -------------------- | --------------------------------------------------------- |
| Web                  | `http://127.0.0.1:2000/`                                  |
| API                  | `http://127.0.0.1:8500/`                                  |
| Correct seed command | `make seed name=target-house-3`                           |
| Seed result          | `target-house-3:9bb9a145-d9ce-5a2f-a748-bb5be3301b30`     |
| Screenshot output    | `tmp/ux-rework-dynamic-audit-seeded/`                     |
| Summary JSON         | `tmp/ux-rework-dynamic-audit-seeded/dynamic-summary.json` |

Important correction: the first live audit was run against the Vite frontend without the proper seeded API state. That produced `500 Internal Server Error` empty states. This is useful for fallback-state coverage, but it is not a valid primary UX audit state. The seeded audit supersedes it for normal workspace behavior.

## Captured States

| State                       | Screenshot                                                           | Why captured                                       |
| --------------------------- | -------------------------------------------------------------------- | -------------------------------------------------- |
| Initial seeded workspace    | `tmp/ux-rework-dynamic-audit-seeded/01-initial-seeded.png`           | Baseline populated workspace                       |
| Primary sidebar collapsed   | `tmp/ux-rework-dynamic-audit-seeded/02-primary-collapsed-seeded.png` | Collapse/recovery behavior                         |
| Plan mode                   | `tmp/ux-rework-dynamic-audit-seeded/03-plan-seeded.png`              | Floor plan chrome and overlays                     |
| 3D mode                     | `tmp/ux-rework-dynamic-audit-seeded/04-3d-seeded.png`                | 3D view controls and right rail behavior           |
| Sheet mode                  | `tmp/ux-rework-dynamic-audit-seeded/05-sheet-seeded.png`             | Sheet/review surface and sheet manifest behavior   |
| Schedule mode               | `tmp/ux-rework-dynamic-audit-seeded/06-schedule-seeded.png`          | Schedule table and schedule actions                |
| Agent mode                  | `tmp/ux-rework-dynamic-audit-seeded/07-agent-seeded.png`             | Advisor workflow in canvas/right rail              |
| Concept mode                | `tmp/ux-rework-dynamic-audit-seeded/08-concept-seeded.png`           | Concept board shell                                |
| Plan click attempt          | `tmp/ux-rework-dynamic-audit-seeded/09-plan-click-selection.png`     | Plan selection behavior and status feedback        |
| 3D selected element         | `tmp/ux-rework-dynamic-audit-seeded/10-3d-click-selection.png`       | Selected roof inspector and mixed right rail state |
| Active wall command         | `tmp/ux-rework-dynamic-audit-seeded/11-wall-command-seeded.png`      | Active command modifiers/options                   |
| Cmd+K during active command | `tmp/ux-rework-dynamic-audit-seeded/12-command-palette-seeded.png`   | Command palette grouping and availability          |

## High-Confidence Live Findings

Historical baseline note (2026-05-12): this table documents the original seeded findings before implementation. Each item is now reconciled in tracker closure rows and regression coverage.

| ID         | Finding                                                                                                              | Evidence                                                                                                                                                                                       | Revamp implication                                                                                                                       |
| ---------- | -------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| UX-DYN-001 | Header remains heavily overloaded in every captured mode.                                                            | Topbar consistently contains project selector, workspace switcher, undo/redo, QAT authoring shortcuts, mode buttons, share, Cmd+K, presence, account, and open-tab affordances.                | Header cleanup is a first-order workpackage, not cosmetic cleanup.                                                                       |
| UX-DYN-002 | Primary sidebar is not navigation-only.                                                                              | Seeded left rail contains discipline/lens controls, family library, editable levels/elevations, browser legend, view navigation, sheets, schedules, concept, types, and family groups.         | Primary sidebar must be rebuilt around project selector, search, view navigation, and user menu only.                                    |
| UX-DYN-003 | Collapsed primary sidebar can become effectively empty.                                                              | Collapsed screenshot shows no useful left rail content while recovery depends on the header toggle.                                                                                            | The Notion-like resize/collapse contract must include a visible header restore button and direct behavior rules for any icon-only state. |
| UX-DYN-004 | Ribbon is not view-type-specific enough.                                                                             | Same broad Architecture ribbon remains visible in plan, 3D, sheet, schedule, agent, and concept states; sheet/schedule still show Wall/Door/Window commands.                                   | Ribbon schema must be derived from active view type, not generic global tabs.                                                            |
| UX-DYN-005 | Plan canvas still hosts persistent tool chrome.                                                                      | Plan mode shows a floating tool palette, long command dock, snap settings, reveal hidden chip, scale/north/readouts, and direct overlays.                                                      | Persistent commands move to ribbon/secondary/footer; canvas keeps direct manipulation and transient cues only.                           |
| UX-DYN-006 | Right rail still mixes selected-element, view-wide, workbench, and advisor content.                                  | No-selection plan/3D states show Scene, sun, room separation/workbench, graphics, layers, and advisor content in the right rail.                                                               | Right rail must be split: secondary sidebar for view-wide state, element sidebar only for selection, footer/dialog for advisor.          |
| UX-DYN-007 | Selected 3D element confirms the right rail can show useful element properties, but still keeps view controls below. | Selecting the roof opens `inspector`, `selected-3d-element-actions`, roof type/constraints/evidence, plus `viewport3d-layers-panel`.                                                           | Element sidebar should keep roof properties/actions; 3D view controls must move to secondary sidebar.                                    |
| UX-DYN-008 | Sheet mode has real sheet content but still uses generic authoring chrome.                                           | Sheet screenshot shows sheet canvas, viewports, titleblock, sheet documentation manifest, review toolbar, and advisor errors while global Architecture ribbon remains visible.                 | Sheet needs its own secondary and ribbon: place views, viewport editing, titleblock, revisions, publish/review.                          |
| UX-DYN-009 | Schedule mode has real schedule registry/table actions but generic ribbon.                                           | Schedule state shows Door/Room/Window schedules, Open row, Place on sheet, Duplicate, columns/rows, while Architecture ribbon remains.                                                         | Schedule ribbon and secondary must own rows/columns/fields/filter/sort/place-on-sheet; model drawing commands must disappear.            |
| UX-DYN-010 | Agent/advisor appears both as a mode and as right-rail review content.                                               | Agent mode shows advisor findings in canvas, while right rail also contains advisor/review content in other modes.                                                                             | Footer advisor count should be the global entry; agent mode should be a focused workflow, not duplicated chrome.                         |
| UX-DYN-011 | Active command state has a useful modifier bar, but ownership is unclear.                                            | Wall command shows `tool-modifier-bar`, `options-bar-wall-type`, `options-bar-wall-offset`, `options-bar-wall-height`, radius controls, status "Drawing wall", and still the floating palette. | Keep active-command modifiers, but attach them to ribbon/options area and remove persistent canvas tool duplication.                     |
| UX-DYN-012 | Cmd+K is already context-aware enough to preserve as a global bridge.                                                | Palette groups show Plan/Plan+3D commands, Universal commands, navigation commands, badges, shortcuts, and unavailable/bridged states.                                                         | Cmd+K should remain in header and become the reachability safety net after surfaces move.                                                |
| UX-DYN-013 | Activity drawer is footer-triggered already, but it opens as a global rail/drawer.                                   | Status bar has `status-bar-activity-entry`, `activity-drawer`, filters, and unread/event affordance.                                                                                           | This pattern is acceptable for footer global events; advisor/jobs can follow this model if density is controlled.                        |
| UX-DYN-014 | The project label after seeding is potentially confusing.                                                            | `make seed name=target-house-3` succeeded, but the header label in captures reads `Seed Library / target-house-1`.                                                                             | Verify seed/project naming so audits and user context are not misleading.                                                                |
| UX-DYN-015 | The failed unseeded run should become a regression scenario, not the main design state.                              | Bare Vite run produced 500s for presets/family catalogs and empty level fallbacks.                                                                                                             | Add degraded-state acceptance: empty/error states should not break layout ownership or bury recovery actions.                            |

Status (2026-05-12): the above findings are now reconciled in implementation and tracker evidence. The remaining content below is retained as historical pre-rework baseline context.

## Dynamic Coverage Follow-Ups (Closed)

| Gap area                      | Resolution status | Evidence                                                                                                                                        |
| ----------------------------- | ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Plan element selection        | Fixed             | Playwright and workspace tests now select deterministic seeded elements (`window.__bimStore` helper path used in e2e coverage).                 |
| Context menus                 | Fixed             | Primary navigation context menu ownership is captured in `ux-revamp-regression.spec.ts` (`captures primary navigation context menu ownership`). |
| Dialogs after seeded state    | Fixed             | Seeded dialog ownership captures now cover project/resources/family/visibility/advisor/jobs/activity flows.                                     |
| Narrow responsive states      | Fixed             | Narrow and tablet shell states are covered by dedicated Playwright regressions and seeded captures.                                             |
| Full command registry mapping | Fixed             | `commandCapabilities.ts` canonical surfaces are enforced by tests and Cmd+K reachability coverage.                                              |

## Command Registry Findings

Current command data now reflects canonical revamp surfaces; this section records the historical issue and current closure.

| Finding                                                                                   | Evidence                                                                  | Required change                                                                                                                       |
| ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Cmd+K is broad and valuable.                                                              | `defaultCommands.ts` registers 90 command IDs in the current static scan. | Preserve Cmd+K as the global escape hatch.                                                                                            |
| Capability metadata still names old regions.                                              | Historical finding from initial scan.                                     | Closed: capability surfaces now map to canonical regions (`cmd-k`, `primary-sidebar`, `secondary-sidebar`, `ribbon`, `footer`, etc.). |
| Topbar is currently treated as a command surface.                                         | Historical finding from initial scan.                                     | Closed: header ownership now remains tab-first with global actions only.                                                              |
| Left rail is currently a command surface beyond project navigation.                       | Historical finding from initial scan.                                     | Closed: primary sidebar is navigation-only with project/search/views/user menu.                                                       |
| Right rail is currently a command surface for view controls and selected-wall 3D actions. | Historical finding from initial scan.                                     | Closed: view-wide controls moved to secondary; selected-element controls remain in element sidebar.                                   |
| Tool capabilities are still advertised through floating palette, ribbon, and Cmd+K.       | Historical finding from initial scan.                                     | Closed: persistent floating palette ownership removed; ribbon + Cmd+K remain canonical.                                               |

## Implementation Closeout Judgment

As of 2026-05-12, the implementation sequence above is completed and validated through:

1. Canonical shell + ownership tests.
2. Primary navigation-only sidebar.
3. Tab-first header cleanup.
4. Secondary sidebar per-view adapters.
5. Conditional selected-element sidebar behavior.
6. View-type ribbon schemas.
7. Canvas persistent-chrome cleanup.
8. Footer advisor/jobs/activity/status consolidation.
9. Command capability surface reconciliation.
10. Broad Playwright regression and seeded runtime checks.

Future work should be incremental enhancements on top of the canonical ownership model, not re-introductions of mixed-scope chrome.
