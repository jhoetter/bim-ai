# UX Reachability Matrix

Last updated: 2026-05-11

Runtime source of truth: `packages/web/src/workspace/commandCapabilities.ts`.

Legend:

- `Direct`: command can execute in the active view.
- `Bridge`: command is visible with an explicit route to its execution view.
- `Disabled`: command is visible only with an unavailable reason, or omitted from the direct surface.

| Capability group                   | Plan     | 3D                        | Plan + 3D                 | Section                 | Sheet          | Schedule       | Agent          |
| ---------------------------------- | -------- | ------------------------- | ------------------------- | ----------------------- | -------------- | -------------- | -------------- |
| Select                             | Direct   | Direct                    | Direct                    | Direct                  | Direct         | Direct         | Direct         |
| Plan authoring tools               | Direct   | Bridge to Plan            | Direct                    | Bridge/Disabled by tool | Bridge to Plan | Bridge to Plan | Bridge to Plan |
| Plan modify tools                  | Direct   | Bridge to Plan            | Bridge/Direct by tool     | Disabled                | Bridge to Plan | Bridge to Plan | Bridge to Plan |
| 3D camera/display controls         | Disabled | Direct                    | Direct                    | Disabled                | Disabled       | Disabled       | Disabled       |
| 3D selected-wall edit actions      | Disabled | Direct with selected wall | Direct with selected wall | Disabled                | Disabled       | Disabled       | Disabled       |
| Plan Visibility/Graphics           | Direct   | Bridge to Plan            | Direct                    | Direct                  | Disabled       | Disabled       | Disabled       |
| 3D layer controls                  | Disabled | Direct                    | Direct                    | Disabled                | Disabled       | Disabled       | Disabled       |
| Theme commands                     | Direct   | Direct                    | Direct                    | Direct                  | Direct         | Direct         | Direct         |
| Drafting grid visibility           | Direct   | Disabled                  | Direct                    | Direct                  | Disabled       | Disabled       | Disabled       |
| View navigation                    | Direct   | Direct                    | Direct                    | Direct                  | Direct         | Direct         | Direct         |
| Project/family/help shell commands | Direct   | Direct                    | Direct                    | Direct                  | Direct         | Direct         | Direct         |

Surface policy:

| Surface          | Projection rule                                                                                                                                                                |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Topbar           | Universal shell commands and QAT shortcuts. Redo/undo expose availability.                                                                                                     |
| Ribbon           | Uses the capability graph for mode validity and disables invalid direct commands with reasons.                                                                                 |
| Floating palette | Shows active-canvas tool definitions and checks capability availability plus tool preconditions.                                                                               |
| Cmd+K            | Shows capability badges and disabled/bridge state for registered commands.                                                                                                     |
| Left rail        | Browser remains the deterministic navigation source for named views and model hierarchy.                                                                                       |
| Right rail       | Exposes stable Properties / View / Workbench / Review section tabs; selected 3D walls get explicit Door, Window, Opening, Section, Elevation, Isolate, and Hide Walls actions. |
| Status bar       | Shows plan clusters in plan-like views, wires the Grid switch to actual drafting-grid visibility, and shows view-mode state in non-plan views.                                  |

Regression guards:

- `packages/web/src/workspace/commandCapabilities.test.ts`
- `packages/web/src/workspace/uxAudit.test.ts`
- `packages/web/src/workspace/shell/RibbonBar.tsx` imports `evaluateCommandInMode`
- `packages/web/src/cmdPalette/registry.ts` imports `evaluateCommandInMode`
- `packages/web/src/tools/ToolPalette.tsx` imports `evaluateCommandInMode`
