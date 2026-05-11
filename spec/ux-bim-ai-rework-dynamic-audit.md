# BIM AI UX Rework Dynamic Audit

Last updated: 2026-05-11

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

## Dynamic Coverage Gaps

| Gap                           | Why it remains                                                                                      | Required follow-up                                                                                                             |
| ----------------------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Plan element selection        | A single coordinate click did not reliably select a plan element in the automated audit.            | Add a deterministic Playwright helper that clicks a known seeded element by SVG/data-testid or selects from store/URL state.   |
| Context menus                 | Right-click/radial menus were not captured in the seeded pass.                                      | Capture wall context menu, wall-face radial menu, browser row context menu, sheet viewport context menu.                       |
| Dialogs after seeded state    | Project menu/family library were captured earlier but not fully recaptured after seed in this pass. | Capture project menu, family library, visibility/graphics, manage links, share, jobs/activity/advisor dialogs in seeded state. |
| Narrow responsive states      | Only desktop `1440x900` was captured.                                                               | Capture tablet/narrow widths after shell layout is implemented.                                                                |
| Full command registry mapping | Static command scan counted current commands and stale surfaces but did not rewrite the registry.   | Add implementation task to rewrite command capability surfaces after new regions exist.                                        |

## Command Registry Findings

Current command data confirms that the old surface model is encoded, not just visually present.

| Finding                                                                                   | Evidence                                                                                                                                                        | Required change                                                                                                             |
| ----------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Cmd+K is broad and valuable.                                                              | `defaultCommands.ts` registers 90 command IDs in the current static scan.                                                                                       | Preserve Cmd+K as the global escape hatch.                                                                                  |
| Capability metadata still names old regions.                                              | `commandCapabilities.ts` uses surfaces such as `topbar`, `left-rail`, `right-rail`, `floating-palette`, `ribbon`, `sheet-canvas`, `schedule-grid`, `statusbar`. | Replace surfaces with canonical revamp regions and direct/bridge/unavailable metadata.                                      |
| Topbar is currently treated as a command surface.                                         | Static scan found navigation, theme/language, project, help, tabs, and shell commands assigned to `topbar`.                                                     | Header should expose only tabs, sidebar reveal, share/presence, Cmd+K, and maybe compact global status if proven necessary. |
| Left rail is currently a command surface beyond project navigation.                       | Static scan found mode navigation, workspace/lens navigation, and family library in `left-rail`.                                                                | Primary sidebar should expose only project/search/view navigation/user menu; resource commands move out.                    |
| Right rail is currently a command surface for view controls and selected-wall 3D actions. | Static scan found 3D fit/reset/projection/walk/section-box/render/layers plus selected wall commands in `right-rail`.                                           | Split to secondary sidebar for view controls, element sidebar/context menu for selected-element actions.                    |
| Tool capabilities are still advertised through floating palette, ribbon, and Cmd+K.       | `buildToolCapabilities()` assigns tool commands to `floating-palette`, `ribbon`, and `cmd-k`.                                                                   | Remove persistent floating palette from canonical command exposure; ribbon plus Cmd+K should remain.                        |

## Implementation Readiness Judgment

The specification set is now strong enough to start implementation only if the first implementation work is structural and test-backed. It is not appropriate to start by manually moving isolated buttons.

Start implementation with:

1. Region shell and ownership tests.
2. Primary sidebar navigation-only rebuild.
3. Header tab-first cleanup.
4. Secondary sidebar destination components.
5. Right rail split into selected-element-only behavior.
6. Ribbon schema by active view type.

Do not start implementation with:

- restyling the current right rail,
- adding more ribbon tabs to the current generic ribbon,
- polishing current canvas toolbars,
- or moving individual commands without updating command capability metadata.
