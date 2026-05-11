# UX Reachability Matrix

Last updated: 2026-05-11

Runtime source of truth: `packages/web/src/workspace/commandCapabilities.ts`.

Legend:

- `Direct`: command can execute in the active view.
- `Bridge`: command is visible with an explicit route to its execution view.
- `Disabled`: command is visible only with an unavailable reason, or omitted from the direct surface.

| Capability group                        | Plan     | 3D                        | Plan + 3D                 | Section                 | Sheet          | Schedule       | Agent          | Concept        |
| --------------------------------------- | -------- | ------------------------- | ------------------------- | ----------------------- | -------------- | -------------- | -------------- | -------------- |
| Select                                  | Direct   | Direct                    | Direct                    | Direct                  | Direct         | Direct         | Direct         | Direct         |
| Plan authoring tools                    | Direct   | Bridge to Plan            | Direct                    | Bridge/Disabled by tool | Bridge to Plan | Bridge to Plan | Bridge to Plan | Bridge to Plan |
| Plan modify tools                       | Direct   | Bridge to Plan            | Bridge/Direct by tool     | Disabled                | Bridge to Plan | Bridge to Plan | Bridge to Plan | Bridge to Plan |
| Plan template/detail style              | Direct   | Disabled                  | Direct                    | Direct                  | Disabled       | Disabled       | Disabled       | Disabled       |
| 3D camera/display controls              | Disabled | Direct                    | Direct                    | Disabled                | Disabled       | Disabled       | Disabled       | Disabled       |
| 3D saved-viewpoint reset/update         | Disabled | Direct                    | Direct                    | Disabled                | Disabled       | Disabled       | Disabled       | Disabled       |
| 3D selected-element edit actions        | Disabled | Direct with selected wall/door/window/floor/roof | Direct with selected wall/door/window/floor/roof | Disabled                | Disabled       | Disabled       | Disabled       | Disabled       |
| Active-view visibility controls         | Direct   | Direct                    | Direct                    | Direct                  | Disabled       | Disabled       | Disabled       | Disabled       |
| Plan Visibility/Graphics                | Direct   | Bridge to Plan            | Direct                    | Direct                  | Disabled       | Disabled       | Disabled       | Disabled       |
| 3D layer controls                       | Disabled | Direct                    | Direct                    | Disabled                | Disabled       | Disabled       | Disabled       | Disabled       |
| Section placement/source/crop controls  | Disabled | Disabled                  | Disabled                  | Direct                  | Disabled       | Disabled       | Disabled       | Disabled       |
| Theme/language commands                 | Direct   | Direct                    | Direct                    | Direct                  | Direct         | Direct         | Direct         | Direct         |
| Drafting grid visibility                | Direct   | Disabled                  | Direct                    | Direct                  | Disabled       | Disabled       | Disabled       | Disabled       |
| Sheet viewport/titleblock/export controls | Disabled | Disabled                  | Disabled                  | Disabled                | Direct         | Disabled       | Disabled       | Disabled       |
| Schedule row/placement/definition controls | Disabled | Disabled                  | Disabled                  | Disabled                | Disabled       | Direct         | Disabled       | Disabled       |
| View navigation                         | Direct   | Direct                    | Direct                    | Direct                  | Direct         | Direct         | Direct         | Direct         |
| Project/snapshot/share/family/help/rail shell commands | Direct   | Direct                    | Direct                    | Direct                  | Direct         | Direct         | Direct         | Direct         |

Surface policy:

| Surface               | Projection rule                                                                                                                                                                                                                                       |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Topbar                | Universal shell commands and QAT shortcuts. Redo/undo expose availability; plan-tool QAT shortcuts label bridge behavior when they switch to Plan.                                                                                                    |
| Ribbon                | Uses the capability graph for mode validity, disables invalid direct commands with reasons, and exposes a test projection for mounted command reachability.                                                                                           |
| Floating palette      | Shows active-canvas tool definitions and checks capability availability plus tool preconditions; legacy perspective-only plan-tool filtering has been removed.                                                                                        |
| Options/modifier bars | Render only in plan-capable modes, so plan tool state cannot create active-looking wall/door/dimension controls over 3D, sheet, schedule, or agent canvases.                                                                                          |
| Cmd+K                 | Groups results by context badge, shows disabled/bridge state for registered commands, supports `>` tool / `@` view / `:` settings prefixes, scopes recent non-universal commands by active view/mode, and includes active-view visibility, snapshot, presentation, sheet, schedule, and universal rail routing. |
| Left rail             | Browser remains the deterministic navigation source for named views and model hierarchy.                                                                                                                                                              |
| Right rail            | Exposes stable Properties / View / Workbench / Review section tabs; selected 3D walls get explicit Door, Window, Opening, Section, Elevation, Isolate, and Hide Walls actions; selected 3D doors/windows/floors/roofs get category, host, and type actions; 3D View Controls include model-category counts plus show-all/hide-all. |
| Status bar            | Shows plan clusters in plan-like views, wires the Grid switch to actual drafting-grid visibility, and shows active view labels/detail chips in non-plan views.                                                                                        |

Regression guards:

- `packages/web/src/workspace/commandCapabilities.test.ts`
- `packages/web/src/workspace/uxAudit.test.ts`
- `packages/web/src/workspace/shell/RibbonBar.tsx` imports `evaluateCommandInMode` and exports `ribbonCommandReachabilityForMode`
- `packages/web/src/workspace/shell/AppShell.test.tsx` locks active-mode scoping for tool option surfaces
- `packages/web/src/cmdPalette/registry.ts` imports `evaluateCommandInMode`
- `packages/web/src/cmdPalette/registry.test.ts` locks mounted prefix filtering
- `packages/web/src/cmdPalette/paletteRecencyStore.test.ts` locks scoped recency behavior
- `packages/web/src/tools/ToolPalette.tsx` imports `evaluateCommandInMode`
- `packages/web/src/workspace/uxAudit.test.ts` guards that the retired `packages/web/src/cmd/CommandPalette.tsx` implementation stays deleted
