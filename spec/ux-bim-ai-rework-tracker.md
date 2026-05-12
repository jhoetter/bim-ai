# BIM AI UX Rework Tracker

Last updated: 2026-05-11

Master index: [`spec/ux-bim-ai-rework-master.md`](./ux-bim-ai-rework-master.md)

Dynamic audit: [`spec/ux-bim-ai-rework-dynamic-audit.md`](./ux-bim-ai-rework-dynamic-audit.md)

This tracker maps current UI elements to the target seven-region layout model from `spec/ux-bim-ai-rework-spec.md`. Status values are for the future implementation pass:

- `Keep`: concept is correct; may still need styling cleanup.
- `Move`: feature is valuable but belongs in another region.
- `Redesign`: concept needs structural changes.
- `Remove`: no longer needed as persistent UI.
- `Audit`: needs deeper implementation review before moving.

Completeness note: this document is intended to be an implementation tracker, not a small concept note. The first pass was too high-level for the requested revamp. The expanded audit appendix below adds route-level, region-level, dialog-level, canvas-overlay-level, and command-reachability rows so the future implementation agent can work through the current UI systematically.

## Route And Page Inventory

Current top-level routes come from `packages/web/src/App.tsx`.

| Route/page                      | Current component       | Revamp relevance                                    | Target treatment                                                                          |
| ------------------------------- | ----------------------- | --------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `/` workspace                   | `Workspace`             | Primary target of this revamp                       | Apply full seven-region layout                                                            |
| `/p/:token` public presentation | `PresentationViewer`    | Public/shared read-only surface                     | Do not force full authoring chrome; keep presentation-focused shell                       |
| `/icons` icon gallery           | `IconGallery`           | Design-system/internal reference                    | Keep separate; use to select hi-fi/stroke icons for revamp                                |
| `/family-editor` family editor  | `FamilyEditorWorkbench` | Related authoring tool but not same workspace shell | Audit separately; should eventually follow the same ownership principles where applicable |

Workspace view modes:

| Workspace mode    | Current source                              | Target shell interpretation                                                                                                                   |
| ----------------- | ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Plan / floor plan | `CanvasMount` + `PlanCanvas`                | Primary nav opens named plan tabs; secondary owns plan view state; ribbon owns drawing/editing; element sidebar owns selected model element   |
| 3D                | `Viewport`                                  | Primary nav opens saved 3D tabs; secondary owns 3D view state; ribbon owns valid 3D edit/review commands; view cube remains canvas exception  |
| Plan + 3D         | Split mode through workspace mode/tab model | Treat as a view type with combined secondary settings sections and a scoped ribbon; avoid duplicating plan and 3D chrome                      |
| Section           | `SectionPlaceholderPane`/mode shell         | Secondary owns section view/crop/source state; ribbon owns detailing/placement/editing                                                        |
| Sheet             | `SheetCanvas`/mode shell                    | Secondary owns sheet-level setup; ribbon owns viewport/titleblock/revision/publish editing; element sidebar owns selected viewport/titleblock |
| Schedule          | `SchedulePanel`/mode shell                  | Secondary owns schedule definition/filter/sort/columns; ribbon owns table edits; element sidebar owns selected row/item when relevant         |
| Agent             | `AgentReviewPane`/mode shell                | Footer advisor count opens global advisor; agent mode can show detailed review workflow without polluting normal workspace chrome             |
| Concept           | `ConceptModeShell`                          | Primary nav places Concept high; secondary owns board context; ribbon owns board/markup/attachment edits                                      |

## Layout Backlog

| ID       | Current UI element                                                        | Current location/source                                              | Target location                                                         | Status   | Problem                                                                                              | Target behavior                                                                                            |
| -------- | ------------------------------------------------------------------------- | -------------------------------------------------------------------- | ----------------------------------------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| UX-L-001 | Project selector/name                                                     | Header, `TopBar` project button                                      | Primary sidebar top                                                     | Move     | Project selection is navigation context, not tab/header content                                      | Show active project at top of primary sidebar with project menu/dropdown                                   |
| UX-L-002 | User/account menu                                                         | Header right/avatar                                                  | Primary sidebar bottom                                                  | Move     | User menu competes with tabs and collaboration controls                                              | Put account/status/license/sign out at bottom of primary sidebar; keep optional tiny avatar only if needed |
| UX-L-003 | Workspace discipline switcher                                             | Header `WorkspaceSwitcher`, left rail discipline select, options bar | Secondary sidebar per view and Cmd+K                                    | Redesign | Discipline is duplicated and unclear: global workspace, view filter, or tool option                  | Define discipline as active view lens/filter; expose in secondary sidebar and Cmd+K                        |
| UX-L-004 | Mode buttons: Plan, 3D, Plan+3D, Section, Sheet, Schedule, Agent, Concept | Header mode/tab area                                                 | Primary sidebar navigation and header tabs                              | Move     | Duplicates the primary navigation and makes header less tab-focused                                  | Primary sidebar lists view groups; clicking named view opens header tab                                    |
| UX-L-005 | Header QAT authoring shortcuts                                            | Header left, `TopBar` QAT buttons                                    | Ribbon and Cmd+K                                                        | Move     | Section/measure/dimension/tag are editing/view commands, not header commands                         | Remove from header; expose in view-specific ribbon and command palette                                     |
| UX-L-006 | Undo/redo in header                                                       | Header left                                                          | Footer or compact header optional                                       | Audit    | Undo/redo are global editing status, but header is overloaded                                        | Prefer footer/global status or keep as tiny stable global controls only if tabs still dominate             |
| UX-L-007 | Thin Lines                                                                | Header QAT                                                           | Secondary sidebar for view graphics or footer compact view status       | Move     | Thin lines affects view display, not header                                                          | Expose under active view graphics                                                                          |
| UX-L-008 | Close inactive views                                                      | Header QAT/customize menu                                            | Header tab overflow/context menu and Cmd+K                              | Move     | Tab management belongs to tabs, not QAT                                                              | Put in tab strip overflow/context menu                                                                     |
| UX-L-009 | Share                                                                     | Header right                                                         | Header right                                                            | Keep     | Global collaboration action fits header                                                              | Keep compact and secondary to tabs                                                                         |
| UX-L-010 | Presence/participants                                                     | Header right overlay                                                 | Header right                                                            | Keep     | Collaboration state fits header, but current absolute overlay can overlap                            | Integrate into header flex layout with stable tab overflow                                                 |
| UX-L-011 | Cmd+K                                                                     | Header right                                                         | Header right                                                            | Keep     | Correct global escape hatch                                                                          | Keep always reachable, context-aware, with direct/bridge/unavailable states                                |
| UX-L-012 | Primary sidebar collapse                                                  | `AppShell` icon strip                                                | Primary sidebar/header                                                  | Redesign | Existing icon-only state mostly expands the same sidebar; zero-width recovery requires header button | Add resizable/zero-width state; header reveal button visible when hidden; icon strip can focus groups      |
| UX-L-013 | Primary sidebar resize                                                    | Fixed grid columns in `AppShell`                                     | Primary sidebar                                                         | Redesign | No Notion-like drag-to-zero behavior                                                                 | Add resize handle, min icon width, full hidden width, persisted width                                      |
| UX-L-014 | Browser legend                                                            | Primary sidebar                                                      | Remove                                                                  | Remove   | Legend consumes prime navigation space and explains UI instead of improving it                       | Replace with self-explanatory icons/labels/tooltips                                                        |
| UX-L-015 | Level stack editor                                                        | Primary sidebar top                                                  | Secondary sidebar for plan/section, element sidebar when level selected | Move     | Level datum editing is model/view context, not project navigation                                    | In plan/section secondary sidebar, show level context and datum controls                                   |
| UX-L-016 | Primary search project                                                    | Primary sidebar                                                      | Primary sidebar                                                         | Keep     | Search project belongs to navigation                                                                 | Keep near top under project selector                                                                       |
| UX-L-017 | Families button/tree                                                      | Primary sidebar                                                      | Ribbon Insert, secondary sidebar library, Cmd+K                         | Move     | Families are resources for editing, not navigation view groups                                       | Use Insert ribbon to open library; secondary sidebar can show current placement library in plan/concept    |
| UX-L-018 | Types tree                                                                | Primary sidebar                                                      | Secondary sidebar type manager or modal from ribbon/Cmd+K               | Move     | Types are resources and templates, not view navigation                                               | Expose under current authoring context or a dedicated project resources dialog                             |
| UX-L-019 | Concept group placement                                                   | Primary sidebar lower group                                          | Primary sidebar near top                                                | Move     | User requested Concept near top                                                                      | Order primary nav: Concept, Floor Plans, 3D Views, Sections, Sheets, Schedules                             |
| UX-L-020 | Sections nested under Views                                               | Primary sidebar                                                      | Primary sidebar top-level group                                         | Move     | Sections are a view type and should be peer to floor plans/3D/sheets                                 | Make top-level navigation group                                                                            |
| UX-L-021 | Schedules top-level                                                       | Primary sidebar                                                      | Primary sidebar                                                         | Keep     | Correct group, but should be nav-only                                                                | Keep rows opening tabs, no table controls                                                                  |
| UX-L-022 | Sheets top-level                                                          | Primary sidebar                                                      | Primary sidebar                                                         | Keep     | Correct group, but should be nav-only                                                                | Keep rows opening sheet tabs                                                                               |

## Header And Tabs

| ID       | Current UI element               | Current location/source       | Target location                           | Status        | Problem                                                           | Target behavior                                                                     |
| -------- | -------------------------------- | ----------------------------- | ----------------------------------------- | ------------- | ----------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| UX-H-001 | `TopBar` mode pills fallback     | Header                        | Remove                                    | Remove        | Header fallback encourages mode navigation instead of tab model   | Always use tab strip once workspace loaded                                          |
| UX-H-002 | `TabBar` mounted beside `TopBar` | Header wrapper in `Workspace` | Header core                               | Keep/Redesign | Good concept but visually competes with mode/QAT/project controls | Make tab strip the dominant header center                                           |
| UX-H-003 | Tab add by kind                  | Header tab add                | Header tab add menu                       | Keep          | Good tab management                                               | Add menu should create/open actual named view when possible, not generic duplicates |
| UX-H-004 | Source view chip                 | Header in sheet mode          | Header or secondary sidebar sheet context | Audit         | Source context may be useful, but can crowd tabs                  | Keep only if compact; otherwise move to sheet secondary sidebar                     |
| UX-H-005 | Sidebar hamburger                | Header left                   | Header left when sidebar visible/hidden   | Keep/Redesign | Needed for recovery after full collapse                           | Button must appear even when primary sidebar width is zero                          |
| UX-H-006 | Project menu anchor              | Header project button         | Primary sidebar project selector          | Move          | Same as UX-L-001                                                  | Re-anchor `ProjectMenu` to primary sidebar                                          |

## Secondary Left Sidebar Target Inventory

| ID       | View type     | Features to own                                                                                                                                                   | Current owners                                                                      | Target behavior                                                                                     |
| -------- | ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| UX-S-001 | Floor plan    | active plan view, level context, view range, crop, detail level, phase, plan graphics, room labels/tags, underlays, visibility/graphics, reveal hidden state      | Right rail, canvas bottom toolbar, crop overlay, Cmd+K, VV dialog                   | Persistent plan view settings in secondary left sidebar                                             |
| UX-S-002 | 3D            | sun/time, render style, background, edges, lighting, exposure, projection, walk, fit/reset, section box, clip planes, model category visibility, saved-view state | Right rail `Viewport3DLayersPanel`, `SunInspectorPanel`, saved 3D HUD, canvas hints | Persistent 3D view settings in secondary left sidebar                                               |
| UX-S-003 | Section       | active section, source plan, far clip/depth, crop, detail level, graphics, placed-on-sheet state                                                                  | Section shell, Cmd+K, right rail if selected                                        | Secondary sidebar controls section view state; ribbon edits/details                                 |
| UX-S-004 | Sheet         | active sheet, sheet size, titleblock, revision/issue metadata, viewport list, placed views, view placement availability                                           | Sheet canvas, right rail selected sheet, Cmd+K                                      | Secondary sidebar controls sheet-level state; element sidebar controls selected viewport/titleblock |
| UX-S-005 | Schedule      | active schedule, fields, columns, sort, group, filters, formatting, placed-on-sheet state                                                                         | Schedule grid/shell, Cmd+K                                                          | Secondary sidebar controls table definition and view state                                          |
| UX-S-006 | Concept       | board list/context, attachments, layers, grouping, visual organization                                                                                            | Concept shell, primary nav                                                          | Secondary sidebar controls board-level state                                                        |
| UX-S-007 | Agent/advisor | filters and detailed findings only inside dialog                                                                                                                  | Right rail                                                                          | Footer launches advisor dialog; no persistent secondary sidebar unless agent view is active         |

## Ribbon Backlog

| ID       | Current UI element                                                                                                                                         | Current location/source          | Target location                            | Status        | Problem                                                                    | Target behavior                                                               |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- | ------------------------------------------ | ------------- | -------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| UX-R-001 | Revit-like ribbon tab set: Architecture, Structure, Steel, Precast, Systems, Insert, Annotate, Analyze, Massing & Site, Collaborate, View, Manage, Add-Ins | `RibbonBar`                      | View-type ribbon definitions               | Redesign      | Same broad tabs show in every view and include invalid/duplicated concepts | Build per-view ribbon schemas                                                 |
| UX-R-002 | Architecture build tools                                                                                                                                   | Ribbon                           | Plan ribbon Create/Openings/Rooms          | Keep/Move     | Correct commands, wrong global tab model                                   | Keep in floor plan ribbon only                                                |
| UX-R-003 | Structure tools                                                                                                                                            | Ribbon                           | Plan/3D contextual ribbons where supported | Audit         | Some structure tools are plan authoring, some model edit                   | Scope each command by active view type and selection                          |
| UX-R-004 | View switch panel                                                                                                                                          | Ribbon View tab                  | Remove from ribbon                         | Remove        | View switching belongs to primary navigation/header tabs                   | Use primary sidebar and tabs                                                  |
| UX-R-005 | Visibility/graphics action                                                                                                                                 | Ribbon View/Analyze tabs         | Secondary sidebar and Cmd+K                | Move          | View setting, not editing command                                          | Secondary sidebar owns view graphics; Cmd+K opens it                          |
| UX-R-006 | Load Family                                                                                                                                                | Ribbon Insert                    | Ribbon Insert                              | Keep          | Correct authoring resource entry                                           | Keep in plan/concept/3D ribbons where placement/loading is meaningful         |
| UX-R-007 | Project Files/Project                                                                                                                                      | Ribbon Insert/Manage/Collaborate | Primary project menu or Cmd+K              | Move          | Project management is not active-view editing                              | Project selector/menu and Cmd+K                                               |
| UX-R-008 | Settings/help/add-ins                                                                                                                                      | Ribbon                           | Cmd+K/account/project menu                 | Move          | Global app/system actions dilute editing ribbon                            | Move to command palette or account/project menus                              |
| UX-R-009 | Modify contextual tab                                                                                                                                      | Ribbon when selected             | Ribbon contextual group                    | Keep/Redesign | Good idea, but should vary by selected element and active view             | Keep contextual modify group only when selection exists and command can apply |
| UX-R-010 | Floating tool palette                                                                                                                                      | Canvas via `FloatingPalette`     | Ribbon                                     | Move          | Duplicates ribbon and creates another tool system                          | Remove persistent canvas palette; ribbon is tool entry                        |
| UX-R-011 | Tool modifier/options bars                                                                                                                                 | Below ribbon via `AppShell`      | Ribbon option row                          | Redesign      | Separate bars create extra chrome and include discipline controls          | Merge into ribbon as contextual options for active tool                       |
| UX-R-012 | Plan annotate ribbon                                                                                                                                       | Canvas via `AnnotateRibbon`      | Plan ribbon Annotate group                 | Move          | A second ribbon inside canvas is inconsistent                              | Consolidate into main ribbon                                                  |

## Canvas Overlay Backlog

| ID       | Current UI element                      | Current location/source  | Target location                               | Status | Problem                                                                                | Target behavior                                                                        |
| -------- | --------------------------------------- | ------------------------ | --------------------------------------------- | ------ | -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| UX-C-001 | View cube                               | 3D canvas                | Canvas                                        | Keep   | Spatial orientation control is a valid exception                                       | Keep, but only orientation/drag-to-orbit                                               |
| UX-C-002 | 3D navigation hints                     | 3D canvas bottom         | Footer or transient canvas hint               | Audit  | Helpful but competes with workspace status                                             | Use compact footer hint or only show while interacting/first-use                       |
| UX-C-003 | Saved 3D viewpoint HUD                  | 3D canvas                | Secondary sidebar                             | Move   | Saved view state affects whole view and should not overlay model                       | Show active saved view in 3D secondary sidebar                                         |
| UX-C-004 | Empty state overlay                     | Canvas                   | Canvas                                        | Keep   | Empty canvas state belongs in canvas                                                   | Keep but avoid blocking persistent chrome                                              |
| UX-C-005 | Plan detail toolbar                     | Plan canvas bottom       | Secondary sidebar                             | Move   | Detail level is view-level setting                                                     | Move to plan secondary sidebar                                                         |
| UX-C-006 | Plan crop panel                         | Plan canvas bottom right | Secondary sidebar                             | Move   | Crop is view-level setting                                                             | Move to plan secondary sidebar                                                         |
| UX-C-007 | Zoom/fit scale widget                   | Plan canvas              | Footer or secondary sidebar                   | Audit  | Scale readout can be canvas-adjacent but commands should not become another toolbar    | Keep compact scale readout or move commands to footer/secondary                        |
| UX-C-008 | Level datum badge/line                  | Plan canvas              | Canvas                                        | Keep   | Spatial datum indicator is useful                                                      | Keep if unobtrusive                                                                    |
| UX-C-009 | North arrow                             | Plan canvas              | Canvas                                        | Keep   | Spatial drawing convention                                                             | Keep                                                                                   |
| UX-C-010 | Temp dimensions/grips/helper dimensions | Plan canvas              | Canvas                                        | Keep   | Direct manipulation must stay on canvas                                                | Keep                                                                                   |
| UX-C-011 | Numeric override input                  | Cursor/canvas            | Canvas                                        | Keep   | In-context editing input is appropriate                                                | Keep                                                                                   |
| UX-C-012 | Snap glyph layer                        | Canvas                   | Canvas                                        | Keep   | Spatial feedback                                                                       | Keep                                                                                   |
| UX-C-013 | Loop mode cursor chip                   | Canvas cursor            | Canvas                                        | Keep   | Transient tool feedback                                                                | Keep                                                                                   |
| UX-C-014 | Temporary visibility menu               | Canvas bottom right      | Secondary sidebar / element sidebar           | Move   | Visibility is view/selection state, not canvas chrome                                  | View-level temporary visibility in secondary; selected isolate/hide in element sidebar |
| UX-C-015 | Reveal hidden button                    | Canvas bottom right      | Secondary sidebar or footer                   | Move   | View display mode should not float on canvas                                           | Move to view visibility section                                                        |
| UX-C-016 | Snap settings toolbar                   | Canvas bottom right      | Ribbon options or footer compact snap cluster | Move   | Snap is tool/editing context, not canvas menu                                          | Move into ribbon tool options or footer snap popover                                   |
| UX-C-017 | Sketch editor overlay                   | Canvas                   | Canvas + ribbon                               | Audit  | Direct sketch handles belong on canvas; finish/cancel/options should align with ribbon | Keep spatial sketch geometry; move persistent options to ribbon                        |

## Element Sidebar Backlog

| ID       | Current UI element                    | Current location/source                   | Target location                                               | Status    | Problem                                                                        | Target behavior                                                                    |
| -------- | ------------------------------------- | ----------------------------------------- | ------------------------------------------------------------- | --------- | ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| UX-E-001 | Selected element properties           | Right rail `Inspector`                    | Element sidebar                                               | Keep      | Conceptually correct                                                           | Keep, restyle as right element sidebar                                             |
| UX-E-002 | No-selection right rail in 3D         | Right rail remains open for view controls | Hidden element sidebar + secondary sidebar view controls      | Redesign  | Violates selected-element-only rule                                            | Element sidebar hidden when no selection                                           |
| UX-E-003 | Scene/sun panel                       | Right rail no-selection section           | Secondary sidebar 3D                                          | Move      | Applies to whole 3D view                                                       | Move to 3D secondary sidebar                                                       |
| UX-E-004 | Active plan view editor in right rail | Right rail no-selection section           | Secondary sidebar plan                                        | Move      | Applies to active view, not selected element                                   | Move to plan secondary sidebar                                                     |
| UX-E-005 | 3D view controls                      | Right rail                                | Secondary sidebar 3D                                          | Move      | Whole-canvas controls                                                          | Move to 3D secondary sidebar                                                       |
| UX-E-006 | Selected 3D wall actions              | Right rail view section                   | Element sidebar contextual actions or ribbon contextual group | Keep/Move | Selection-scoped actions are valid, but should not be mixed with view controls | Put selection actions in element sidebar; repeated edit tools in contextual ribbon |
| UX-E-007 | Authoring workbenches                 | Right rail workbench                      | Secondary sidebar/ribbon/modals                               | Redesign  | Workbenches mix resources, authoring, and selected state                       | Split by scope: resource managers secondary/modal, edit commands ribbon            |
| UX-E-008 | AdvisorPanel                          | Right rail review section                 | Footer count + advisor dialog                                 | Move      | Advisor is global and should be always visible                                 | Footer severity badge opens dialog                                                 |
| UX-E-009 | Activity events                       | Right rail lower section                  | Footer/dialog/activity panel                                  | Move      | Global activity is not selected-element state                                  | Footer activity count opens activity drawer                                        |
| UX-E-010 | Hide Element in View                  | Inspector properties area                 | Element sidebar action                                        | Keep      | Selection-specific                                                             | Keep in element sidebar, near visibility actions                                   |
| UX-E-011 | Hide Category in View                 | Inspector properties area                 | Secondary sidebar view visibility or element sidebar shortcut | Move      | Category visibility is view-level; selected element can provide shortcut       | Primary owner secondary; optional shortcut in element sidebar                      |

## Footer Backlog

| ID       | Current UI element          | Current location/source                       | Target location             | Status    | Problem                                                                   | Target behavior                                           |
| -------- | --------------------------- | --------------------------------------------- | --------------------------- | --------- | ------------------------------------------------------------------------- | --------------------------------------------------------- |
| UX-F-001 | Advisor warning/error count | Right rail advisor list                       | Footer                      | Move      | Global model health should be visible in all views                        | Footer badge by severity opens advisor dialog             |
| UX-F-002 | Save/sync/offline           | Footer/status bar and header tiny offline dot | Footer                      | Keep/Move | Footer is correct; header dot can be redundant                            | Keep in footer; header only for severe offline if needed  |
| UX-F-003 | View label                  | Footer/status bar                             | Footer                      | Keep      | Good global context                                                       | Keep compact                                              |
| UX-F-004 | Coordinates                 | Footer/status bar                             | Footer                      | Keep      | Correct for plan-like views                                               | Keep                                                      |
| UX-F-005 | Snap/grid clusters          | Footer/status bar                             | Footer/ribbon options       | Audit     | Global readout is ok; detailed settings should be popover/options         | Keep compact status, move detailed controls out of canvas |
| UX-F-006 | Undo/redo depth             | Footer/status bar                             | Footer                      | Keep      | Good global status                                                        | Keep; decide whether header undo buttons remain           |
| UX-F-007 | Lens dropdown               | Footer/status bar                             | Secondary sidebar or footer | Audit     | If lens affects active view, secondary sidebar; if project-global, footer | Decide single scope and remove duplicates                 |
| UX-F-008 | Drift/activity counts       | Footer/status bar                             | Footer                      | Keep      | Global counts fit footer                                                  | Keep and open dialogs/drawers                             |

## View-Type Ribbon Matrix

| View type   | Ribbon groups                                                          | Include                                                                                                                                       | Exclude                                                                            |
| ----------- | ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Floor Plans | Create, Openings, Rooms/Areas, Annotate, Modify, Insert, Datum, Sketch | Wall, door, window, component, room, area, floor/roof sketch, dimension, tag, grid, reference plane, move/copy/rotate/trim when valid         | 3D camera, sheet titleblock, schedule columns                                      |
| 3D Views    | Select, Modify, Openings, Review, Documentation, Visibility Shortcuts  | Select, move/rotate if supported, insert hosted door/window/opening on selected wall, section/elevation from selection, isolate/hide selected | Plan-only wall drawing unless implemented as true 3D edit, schedule/table commands |
| Sections    | Annotate, Detail, Crop/Edit, Place on Sheet, Modify                    | dimension, tag, detail region/component, crop/depth edit, place on sheet                                                                      | Wall creation unless section authoring supports it                                 |
| Sheets      | Place Views, Viewports, Titleblock, Revisions, Publish                 | place plan/section/schedule, move/resize viewport, titleblock, revision cloud/list, export/share                                              | model wall/door creation, 3D camera                                                |
| Schedules   | Rows, Columns, Fields, Format, Place on Sheet                          | edit cell/row, show/hide columns, sort/group/filter, duplicate schedule, place on sheet                                                       | canvas drawing tools                                                               |
| Concept     | Board, Place, Arrange, Markup, Attachments                             | add board items, arrange, attach refs, annotate/markup                                                                                        | BIM model authoring commands unless intentionally supported                        |
| Agent       | Findings, Review Actions, Apply Fixes                                  | filters, accept/reject, navigate to element, quick fixes                                                                                      | drawing tools unless a fix explicitly starts a guided command                      |

## Implementation Workpackages

| WP       | Title                                                      | Depends on                | Exit criteria                                                                                          |
| -------- | ---------------------------------------------------------- | ------------------------- | ------------------------------------------------------------------------------------------------------ |
| UX-WP-01 | Layout shell with resizable primary and secondary sidebars | none                      | Primary can resize to 0; secondary exists; element sidebar can be hidden; header reveal works          |
| UX-WP-02 | Header cleanup and true tab focus                          | UX-WP-01                  | Header contains tabs, reveal, Cmd+K, share/presence only                                               |
| UX-WP-03 | Primary navigation-only sidebar                            | UX-WP-01                  | Primary contains project selector, search, Concept/Floor Plans/3D/Sections/Sheets/Schedules, user menu |
| UX-WP-04 | Secondary sidebar adapters                                 | UX-WP-01                  | Each view type has secondary sidebar content and no missing core settings                              |
| UX-WP-05 | Element sidebar isolation                                  | UX-WP-01, UX-WP-04        | Right sidebar hidden with no selection; no view-wide controls inside                                   |
| UX-WP-06 | Ribbon per view type                                       | UX-WP-02, UX-WP-04        | Ribbon schema changes by active view type; no dead buttons                                             |
| UX-WP-07 | Canvas overlay consolidation                               | UX-WP-04, UX-WP-06        | Persistent canvas docks moved; only allowed spatial/transient overlays remain                          |
| UX-WP-08 | Advisor footer/dialog                                      | UX-WP-01                  | Footer shows severity count; dialog lists and navigates findings                                       |
| UX-WP-09 | Cmd+K and reachability graph                               | UX-WP-02 through UX-WP-08 | Capability graph matches new placement; bridge states explicit                                         |
| UX-WP-10 | Visual and interaction regression suite                    | all                       | Screenshots for main view types; tests for ownership rules                                             |

## Acceptance Checklist

- Primary sidebar never contains level/type/family editors.
- Header never contains draw/measure/tag tools.
- Header tab strip is visually and functionally dominant.
- Secondary sidebar is present for every view type and owns all view-level controls.
- Ribbon content changes by view type.
- Element sidebar is hidden when no element is selected.
- Advisor is reachable globally from footer.
- Canvas contains only spatial or transient overlays.
- Cmd+K can reach every feature and labels direct/bridge/unavailable state.
- Collapsed primary sidebar can always be restored from the header.
- Icon usage is consistent: hi-fi icons for navigation recognition, stroke icons for dense commands, previews for visual result choices.

## Expanded Audit Coverage Map

| ID         | Coverage area                    | Sources inspected                                                                            | Coverage result                                                                            | Remaining risk                                                      |
| ---------- | -------------------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------- |
| UX-AUD-001 | Route shell                      | `App.tsx`, public viewer route, icon route, family editor route                              | All top-level app routes are represented in this tracker                                   | Visual parity for standalone routes still needs screenshots         |
| UX-AUD-002 | Main workspace shell             | `Workspace.tsx`, `AppShell.tsx`, `modeSurfaces.ts`                                           | Seven-region ownership conflicts identified                                                | Implementation must verify responsive grid behavior                 |
| UX-AUD-003 | Header                           | `TopBar.tsx`, `TabBar` usage in `Workspace.tsx`                                              | Header overload documented and split into tab, global action, and misplaced command groups | Exact tab overflow behavior needs design validation                 |
| UX-AUD-004 | Primary left sidebar             | `WorkspaceLeftRail.tsx`, `LeftRail.tsx`, `workspaceUtils.ts`, `ProjectBrowser.tsx`           | Navigation versus resource/editor pollution documented                                     | Some browser code may be legacy or conditionally mounted            |
| UX-AUD-005 | Secondary left sidebar target    | Current right rail, canvas docks, mode shells, dialogs                                       | Target ownership defined per view type                                                     | New component architecture still needs implementation               |
| UX-AUD-006 | Ribbon and options bars          | `RibbonBar.tsx`, `ToolModifierBar`, `OptionsBar`, command capability registry                | Ribbon command categories mapped by view type                                              | Some commands may currently be partially implemented                |
| UX-AUD-007 | Right rail and selected element  | `WorkspaceRightRail.tsx`, inspector panels, scene panels, advisor panels                     | View controls and selection properties separated                                           | Selected element taxonomy must be checked against model schema      |
| UX-AUD-008 | Plan canvas overlays             | `PlanCanvas.tsx` overlays, plan toolbar, annotate controls, temporary dimensions, snap UI    | Persistent docks identified as migration candidates                                        | Pixel-level overlay interactions need Playwright coverage           |
| UX-AUD-009 | 3D viewport overlays             | `Viewport.tsx`, `OrbitViewpointPersistedHud.tsx`, view cube, nav hints, context/radial menus | Spatial exceptions versus misplaced persistent controls separated                          | Advanced 3D edit flows need manual QA                               |
| UX-AUD-010 | Sheets                           | `SheetCanvas.tsx`, `SheetReviewSurface.tsx`, sheet mode shell                                | Sheet-level, viewport-level, review-level controls mapped                                  | Sheet feature set is broad and needs view-specific acceptance tests |
| UX-AUD-011 | Sections                         | `SectionPlaceholderPane.tsx`, section mode shell                                             | Section preview, cuts, placement, and detail controls mapped                               | Section feature maturity may affect final ribbon shape              |
| UX-AUD-012 | Schedules                        | `ScheduleModeShell`, schedule panels and tables                                              | Schedule navigation, definition, and cell editing split                                    | Table keyboard behavior needs dedicated audit                       |
| UX-AUD-013 | Concept                          | `ConceptModeShell`                                                                           | Concept board sidebar and board-edit controls mapped                                       | Board item selection rules need confirmation                        |
| UX-AUD-014 | Advisor and agent review         | `AgentReviewModeShell`, `AdvisorPanel`, footer/status references                             | Advisor moved to global footer entry with detailed dialog/workflow                         | Need severity model and navigation contract                         |
| UX-AUD-015 | Project and resource dialogs     | `ProjectMenu.tsx`, `ManageLinksDialog.tsx`, import/link flows, family/library dialogs        | Project-global versus view-context controls separated                                      | Some resource dialogs may be reachable only through commands        |
| UX-AUD-016 | Visibility and graphics dialogs  | `VVDialog.tsx`, graphics sections, layer controls                                            | View-wide graphics should move to secondary sidebar with advanced dialog bridge            | Needs consolidated schema for all view types                        |
| UX-AUD-017 | Command palette                  | `CommandPalette.tsx`, `registry.ts`, `defaultCommands.ts`, `commandCapabilities.ts`          | Cmd+K remains global escape hatch, but availability metadata must be rewritten             | Registry may contain stale surfaces after revamp                    |
| UX-AUD-018 | Collaboration                    | Share controls, presentation controls, presence strip, activity drawer                       | Header owns live collaboration; footer/activity owns status                                | Presence overflow and permissions need responsive checks            |
| UX-AUD-019 | Responsive and collapse behavior | Current fixed columns, rail collapse, left rail icon mode                                    | Notion-like primary sidebar requirement documented                                         | Exact drag thresholds and persistence are implementation decisions  |
| UX-AUD-020 | Test coverage                    | `uxAudit.test.ts`, existing web tests, screenshot tooling                                    | Existing tests can become ownership-rule regression tests                                  | New tests must be added after layout components exist               |

## Expanded Primary Sidebar Tracker

| ID         | Current UI element               | Current location/source                    | Target owner                   | Status   | Required action                                                                                |
| ---------- | -------------------------------- | ------------------------------------------ | ------------------------------ | -------- | ---------------------------------------------------------------------------------------------- |
| UX-PRI-001 | Project name button              | Header `TopBar`                            | Primary sidebar top            | Move     | Re-anchor project menu to the top of primary sidebar                                           |
| UX-PRI-002 | Recent projects                  | `ProjectMenu`                              | Primary sidebar project menu   | Keep     | Keep inside project selector dropdown, not as header chrome                                    |
| UX-PRI-003 | Seed/demo project creation       | `ProjectMenu`                              | Project selector menu          | Keep     | Treat as project management command                                                            |
| UX-PRI-004 | Snapshot/load project            | `ProjectMenu`                              | Project selector menu          | Keep     | Keep project-global, not in active view ribbon                                                 |
| UX-PRI-005 | Link IFC/DXF quick actions       | `ProjectMenu`, links dialogs               | Project selector or Insert     | Audit    | Decide whether linking is project resource management or active-view insert workflow           |
| UX-PRI-006 | Account/avatar menu              | Header right                               | Primary sidebar bottom         | Move     | Move account/status/sign-out to bottom anchored user menu                                      |
| UX-PRI-007 | Project search                   | Left rail                                  | Primary sidebar top            | Keep     | Keep below project selector; search only project navigation/resources                          |
| UX-PRI-008 | Concept navigation               | Lower browser group                        | Primary sidebar top group      | Move     | Place near top as requested                                                                    |
| UX-PRI-009 | Floor Plans navigation           | Views/Floor Plans browser                  | Primary sidebar nav            | Keep     | Rows open named plan tabs                                                                      |
| UX-PRI-010 | 3D Views navigation              | Views/3D browser                           | Primary sidebar nav            | Keep     | Rows open named 3D tabs                                                                        |
| UX-PRI-011 | Sections navigation              | Views/Sections browser                     | Primary sidebar nav            | Move     | Promote to peer group, not nested under generic views if hierarchy gets unclear                |
| UX-PRI-012 | Sheets navigation                | Browser                                    | Primary sidebar nav            | Keep     | Rows open sheet tabs                                                                           |
| UX-PRI-013 | Schedules navigation             | Browser                                    | Primary sidebar nav            | Keep     | Rows open schedule tabs                                                                        |
| UX-PRI-014 | Project levels group             | Left rail level stack/browser              | Secondary sidebar or resources | Move     | Remove from primary nav except as searchable project resource                                  |
| UX-PRI-015 | Level edit controls              | Level stack                                | Secondary/element sidebar      | Move     | View level context belongs in secondary; selected datum properties belong in element sidebar   |
| UX-PRI-016 | Types browser                    | Primary rail browser                       | Project resources dialog       | Move     | Not primary navigation; expose through resource manager and Cmd+K                              |
| UX-PRI-017 | Families browser                 | Primary rail browser and Families shortcut | Insert ribbon/resource dialog  | Move     | Resource placement belongs in Insert ribbon and family library modal                           |
| UX-PRI-018 | Browser legend                   | Primary rail                               | None                           | Remove   | Replace explanatory legend with clearer visual hierarchy                                       |
| UX-PRI-019 | Architecture/neutral selectors   | Top of left rail                           | Secondary sidebar or context   | Move     | Treat as active view/authoring context, not primary navigation                                 |
| UX-PRI-020 | Collapsed icon strip             | `AppShell` left rail collapsed mode        | Primary sidebar/header         | Redesign | Icons must either navigate directly or reveal sidebar predictably; no dead icon behavior       |
| UX-PRI-021 | Full hide to zero width          | Not currently supported as target          | Primary sidebar                | Redesign | Add drag-to-zero with header restore button                                                    |
| UX-PRI-022 | Resize handle                    | Notion-like target only                    | Primary sidebar                | Redesign | Add persistent width and keyboard accessible resize/collapse                                   |
| UX-PRI-023 | Primary nav item icons           | Mixed hi-fi/stroke use                     | Primary sidebar                | Redesign | Use strong recognizable view-type icons, not command icons                                     |
| UX-PRI-024 | Primary group ordering           | Mixed project/resources/view groups        | Primary sidebar                | Redesign | Order: project, search, Concept, Floor Plans, 3D Views, Sections, Sheets, Schedules, user menu |
| UX-PRI-025 | Primary sidebar empty states     | Browser sections                           | Primary sidebar                | Keep     | Empty view groups should offer create/import only as lightweight menu actions                  |
| UX-PRI-026 | Primary sidebar create buttons   | Browser/action affordances                 | Header tab add or contextual   | Audit    | Creating a new named view may be acceptable in nav, but editing tools must stay out            |
| UX-PRI-027 | Drag reorder of views            | If present in browser                      | Primary sidebar                | Keep     | Reorder/navigation management can stay in primary if it only affects nav organization          |
| UX-PRI-028 | Context menus on browser entries | Browser entries                            | Primary sidebar                | Keep     | Keep open/rename/duplicate/delete; route edit-specific actions to correct region               |
| UX-PRI-029 | View templates listed as nav     | Potential browser/resource area            | Secondary/resources            | Move     | Templates are view configuration resources, not navigable tabs                                 |
| UX-PRI-030 | Links listed as nav              | Project browser/link dialogs               | Project resources              | Move     | Links are project resources; visibility in active view belongs to secondary sidebar            |

## Expanded Header And Tab Tracker

| ID          | Current UI element              | Current location/source      | Target owner              | Status   | Required action                                                               |
| ----------- | ------------------------------- | ---------------------------- | ------------------------- | -------- | ----------------------------------------------------------------------------- |
| UX-HEAD-001 | Tab strip                       | Header wrapper               | Header center             | Keep     | Make visually dominant and horizontally resilient                             |
| UX-HEAD-002 | Active named view tab           | Current tab system           | Header                    | Keep     | Tabs represent named views/documents, not generic mode switches               |
| UX-HEAD-003 | Generic mode pills              | Header `TopBar`              | Primary nav and tab model | Move     | Remove from header as view navigation duplicates                              |
| UX-HEAD-004 | Add tab menu                    | Header tab controls          | Header                    | Keep     | Open/create named view choices grouped by view type                           |
| UX-HEAD-005 | Close inactive views            | Header QAT                   | Tab overflow menu         | Move     | Put tab lifecycle actions in tab context                                      |
| UX-HEAD-006 | Sidebar reveal button           | Header left                  | Header                    | Keep     | Always visible when primary sidebar is hidden                                 |
| UX-HEAD-007 | Share button                    | Header right                 | Header                    | Keep     | Keep compact and permissions-aware                                            |
| UX-HEAD-008 | Presentation/share presentation | Header or share menus        | Header/share dialog       | Keep     | Keep collaboration/export entry near share                                    |
| UX-HEAD-009 | Participant avatars             | Header absolute overlay      | Header right              | Redesign | Integrate into layout, avoid overlap with tabs                                |
| UX-HEAD-010 | Activity drawer entry           | Header/collaboration surface | Header or footer          | Audit    | Live collaboration events may fit header; system/status events may fit footer |
| UX-HEAD-011 | Cmd+K button                    | Header right                 | Header right              | Keep     | Keep as universal command/search entry                                        |
| UX-HEAD-012 | Search placeholder text         | Header command button        | Header right              | Keep     | Use concise hint; do not make header a broad search form                      |
| UX-HEAD-013 | Undo/redo                       | Header QAT                   | Header compact or footer  | Audit    | Keep only if visually secondary; otherwise move to footer/global edit status  |
| UX-HEAD-014 | Measure shortcut                | Header QAT                   | Ribbon                    | Move     | Editing/review command, not header                                            |
| UX-HEAD-015 | Section shortcut                | Header QAT                   | Ribbon                    | Move     | View creation/detail command, not header                                      |
| UX-HEAD-016 | Dimension shortcut              | Header QAT                   | Ribbon                    | Move     | Annotation command, not header                                                |
| UX-HEAD-017 | Tag shortcut                    | Header QAT                   | Ribbon                    | Move     | Annotation command, not header                                                |
| UX-HEAD-018 | Thin lines shortcut             | Header QAT                   | Secondary sidebar         | Move     | View display setting                                                          |
| UX-HEAD-019 | Project/workspace selector      | Header left                  | Primary sidebar           | Move     | Header should not be project management surface                               |
| UX-HEAD-020 | Offline/sync status             | Header overlay               | Footer                    | Move     | Global status belongs in footer unless blocking user action                   |
| UX-HEAD-021 | Source view chip                | Header in sheet context      | Secondary or tab subtitle | Audit    | Keep only if it clarifies tab identity without crowding                       |
| UX-HEAD-022 | Header height                   | Current mixed controls       | Header                    | Redesign | Size for tabs and global actions only                                         |
| UX-HEAD-023 | Header overflow                 | Current ad hoc action groups | Header                    | Redesign | Overflow tabs separately from global share/presence actions                   |
| UX-HEAD-024 | Keyboard tab navigation         | Current tab system           | Header                    | Keep     | Preserve and document keyboard navigation in implementation checklist         |

## Expanded Secondary Sidebar Tracker

| ID         | View type     | Current UI element            | Current location/source                              | Target behavior                                                                |
| ---------- | ------------- | ----------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------ |
| UX-SEC-001 | Floor plan    | Active level                  | Left rail level stack, canvas datum widgets          | Show current level/view association and level switcher                         |
| UX-SEC-002 | Floor plan    | View range                    | Right rail, dialogs, or missing consolidated surface | Own top/bottom/cut plane settings                                              |
| UX-SEC-003 | Floor plan    | Crop region                   | Canvas crop overlay and right rail                   | Own crop enable/visibility/extent summary; direct edit remains on canvas       |
| UX-SEC-004 | Floor plan    | Detail level                  | Right rail/graphics                                  | Own coarse/medium/fine view state                                              |
| UX-SEC-005 | Floor plan    | Visual style                  | Right rail/graphics                                  | Own hidden line/shaded/wire/colored where valid                                |
| UX-SEC-006 | Floor plan    | Thin lines                    | Header QAT                                           | Move to plan graphics section                                                  |
| UX-SEC-007 | Floor plan    | Visibility/graphics           | VV dialog/right rail                                 | Secondary shows common controls and opens advanced VV dialog                   |
| UX-SEC-008 | Floor plan    | Reveal hidden                 | Canvas chip/toolbar                                  | View-state toggle in secondary with temporary canvas indicator                 |
| UX-SEC-009 | Floor plan    | Underlay/reference level      | Dialog or right rail                                 | Plan view context control                                                      |
| UX-SEC-010 | Floor plan    | Phase/design option           | Scattered context controls                           | View-wide filtering controls                                                   |
| UX-SEC-011 | Floor plan    | Snap settings                 | Canvas bottom widget                                 | Secondary advanced view/input section; transient snap glyphs remain canvas     |
| UX-SEC-012 | 3D            | Sun/time                      | Right rail sun panel                                 | Move to 3D secondary sidebar                                                   |
| UX-SEC-013 | 3D            | Shadows                       | Right rail/saved view HUD                            | Move to 3D graphics section                                                    |
| UX-SEC-014 | 3D            | Ambient occlusion/depth       | Saved view HUD                                       | Move to 3D graphics section                                                    |
| UX-SEC-015 | 3D            | Exposure/background           | Saved view HUD/right rail                            | Move to 3D render section                                                      |
| UX-SEC-016 | 3D            | Edge width and outline style  | Saved view HUD/right rail                            | Move to 3D graphics section                                                    |
| UX-SEC-017 | 3D            | Projection/perspective        | Left rail/top options                                | Move to 3D camera section                                                      |
| UX-SEC-018 | 3D            | Section box                   | Viewport overlay/right rail                          | Secondary owns state; canvas owns handles and spatial summary                  |
| UX-SEC-019 | 3D            | Clip/cutaway settings         | Saved view HUD                                       | Move to 3D clipping section                                                    |
| UX-SEC-020 | 3D            | Hidden model categories       | Saved view HUD/layers panel                          | Move to 3D visibility section                                                  |
| UX-SEC-021 | 3D            | Plan overlay in 3D            | Saved view HUD                                       | Move to 3D overlays section                                                    |
| UX-SEC-022 | 3D            | Navigation mode hints         | Canvas overlay                                       | Secondary can expose mode; short transient hints may remain on canvas          |
| UX-SEC-023 | Section       | Section source/level          | Section placeholder pane                             | Own source, cut direction, depth, and linked plan                              |
| UX-SEC-024 | Section       | Crop/depth                    | Section pane/canvas                                  | Secondary owns numeric state; canvas owns direct manipulation                  |
| UX-SEC-025 | Section       | Detail/graphics               | Section pane or right rail                           | Same graphics model as plan where applicable                                   |
| UX-SEC-026 | Section       | Place on sheet context        | Section pane                                         | Secondary can show placement state; ribbon owns place command                  |
| UX-SEC-027 | Sheet         | Sheet size/titleblock         | Sheet canvas/panels                                  | Secondary owns sheet-level setup                                               |
| UX-SEC-028 | Sheet         | Viewport list                 | Sheet canvas or side panels                          | Secondary owns sheet contents outline                                          |
| UX-SEC-029 | Sheet         | Revision set                  | Sheet review/panels                                  | Secondary owns active revision context; ribbon owns revision editing           |
| UX-SEC-030 | Sheet         | Publish/export setup          | Sheet surfaces                                       | Secondary owns setup; ribbon/header owns publish/share entry                   |
| UX-SEC-031 | Schedule      | Fields                        | Schedule mode shell                                  | Secondary owns schedule definition                                             |
| UX-SEC-032 | Schedule      | Filter/sort/group             | Schedule mode shell                                  | Secondary owns table definition controls                                       |
| UX-SEC-033 | Schedule      | Formatting                    | Schedule/table controls                              | Secondary owns schedule-wide formatting                                        |
| UX-SEC-034 | Schedule      | Active selection summary      | Table/cell surface                                   | Element sidebar owns selected row/cell properties if needed                    |
| UX-SEC-035 | Concept       | Board selector/context        | Concept mode aside                                   | Secondary owns active board context                                            |
| UX-SEC-036 | Concept       | Board filters                 | Concept aside                                        | Secondary owns board-wide filters                                              |
| UX-SEC-037 | Concept       | Attachments/reference context | Concept mode shell                                   | Secondary owns board resources; ribbon owns adding/arranging                   |
| UX-SEC-038 | Agent         | Finding filters               | Agent review pane                                    | Agent view secondary owns filters, severity, category, affected scope          |
| UX-SEC-039 | Agent         | Advisor detail navigation     | Advisor panel/right rail                             | Secondary owns workflow context after footer opens advisor mode/dialog         |
| UX-SEC-040 | Split Plan+3D | Combined view controls        | Mode split surfaces                                  | Secondary uses tabs or sections for plan and 3D view context, never duplicates |

## Expanded Ribbon Command Tracker

| ID         | Command group                  | Applies to view types             | Current location/source        | Target behavior                                                          |
| ---------- | ------------------------------ | --------------------------------- | ------------------------------ | ------------------------------------------------------------------------ |
| UX-RIB-001 | Select/modify                  | All authoring views               | Ribbon/toolbars/canvas         | Always first ribbon group where editing is possible                      |
| UX-RIB-002 | Wall                           | Plan, supported 3D                | Header QAT/ribbon/plan toolbar | Plan ribbon create group; 3D only if real 3D placement is implemented    |
| UX-RIB-003 | Door                           | Plan, 3D selected wall workflows  | Ribbon/authoring panels        | Insert/openings group scoped to valid host                               |
| UX-RIB-004 | Window                         | Plan, 3D selected wall workflows  | Ribbon/authoring panels        | Insert/openings group scoped to valid host                               |
| UX-RIB-005 | Component/family placement     | Plan, sheet, concept where valid  | Families rail/ribbon           | Insert group opens library and starts placement                          |
| UX-RIB-006 | Room                           | Plan                              | Ribbon/plan toolbar            | Plan ribbon room/area group                                              |
| UX-RIB-007 | Area and area boundary         | Plan                              | Ribbon/plan toolbar            | Plan ribbon room/area group                                              |
| UX-RIB-008 | Floor/roof/sketch              | Plan                              | Ribbon/sketch surfaces         | Plan ribbon sketch group with mode-specific options                      |
| UX-RIB-009 | Ceiling                        | Plan                              | Ribbon                         | Plan ribbon create group where level/view supports it                    |
| UX-RIB-010 | Stair/railing                  | Plan/3D if supported              | Ribbon                         | Authoring ribbon only for valid view and active constraints              |
| UX-RIB-011 | Grid/level datum creation      | Plan/section                      | Left rail/canvas/ribbon        | Datum ribbon group; editing selected datum in element sidebar            |
| UX-RIB-012 | Reference plane                | Plan/section                      | Ribbon                         | Datum/reference ribbon group                                             |
| UX-RIB-013 | Dimension                      | Plan, section, sheet              | Header QAT/annotation bar      | Annotate ribbon group                                                    |
| UX-RIB-014 | Tag                            | Plan, section, sheet              | Header QAT/annotation bar      | Annotate ribbon group                                                    |
| UX-RIB-015 | Text note                      | Plan, section, sheet              | Annotation bar                 | Annotate ribbon group                                                    |
| UX-RIB-016 | Detail line/region             | Plan, section, sheet              | Annotation/canvas              | Detail ribbon group                                                      |
| UX-RIB-017 | Measure                        | Plan, 3D, sheet                   | Header QAT/canvas              | Review ribbon group; transient measurement result on canvas              |
| UX-RIB-018 | Section creation               | Plan, 3D                          | Header QAT/ribbon              | Documentation ribbon group; creates section tab/resource                 |
| UX-RIB-019 | Elevation/camera               | Plan, 3D                          | Ribbon/canvas                  | Documentation/view creation group                                        |
| UX-RIB-020 | Isolate/hide selected          | Plan, 3D, section                 | Right rail/canvas context      | Ribbon review/visibility shortcuts and element context menu              |
| UX-RIB-021 | Visibility templates           | Plan, 3D, section                 | VV dialog/right rail           | Secondary for active state; ribbon can apply template                    |
| UX-RIB-022 | Place view on sheet            | Sheet, section, plan context      | Sheet/section panes            | Sheet ribbon place views group                                           |
| UX-RIB-023 | Titleblock editing             | Sheet                             | Sheet canvas/panels            | Sheet ribbon titleblock group                                            |
| UX-RIB-024 | Revision cloud/list            | Sheet                             | Sheet review surface           | Sheet ribbon revisions group                                             |
| UX-RIB-025 | Schedule row/column operations | Schedule                          | Schedule mode/table            | Schedule ribbon rows/columns group                                       |
| UX-RIB-026 | Schedule fields                | Schedule                          | Schedule aside                 | Secondary owns definition; ribbon owns add/remove quick actions          |
| UX-RIB-027 | Concept board item add         | Concept                           | Concept shell                  | Concept ribbon board group                                               |
| UX-RIB-028 | Concept arrange                | Concept                           | Concept shell/canvas           | Concept ribbon arrange group                                             |
| UX-RIB-029 | Concept markup                 | Concept, sheet                    | Concept/sheet review           | Markup ribbon group                                                      |
| UX-RIB-030 | Advisor quick fix              | Agent/advisor context             | Advisor panel                  | Agent ribbon apply fixes group, only inside advisor workflow             |
| UX-RIB-031 | Import/link                    | Project, plan, 3D, sheet contexts | Project menu/ribbon            | Insert ribbon if placed into active view; project menu if project-global |
| UX-RIB-032 | Export/publish                 | Sheet, project, public viewer     | Header/share/sheet panels      | Header share for collaboration; sheet ribbon for publishing active sheet |
| UX-RIB-033 | Ribbon tab labels              | Current Revit-like ribbon         | Ribbon                         | Rename by task, not internal implementation category                     |
| UX-RIB-034 | Disabled commands              | Current ribbon                    | Ribbon                         | Hide irrelevant groups or show disabled with clear unavailable reason    |
| UX-RIB-035 | Ribbon personalization         | Current customize menu/QAT        | Later enhancement              | Defer until ownership model is stable                                    |

## Expanded Canvas Overlay Tracker

| ID         | Canvas surface               | Current location/source                | Target owner             | Status | Required action                                                                    |
| ---------- | ---------------------------- | -------------------------------------- | ------------------------ | ------ | ---------------------------------------------------------------------------------- |
| UX-CAN-001 | View cube                    | 3D viewport                            | Canvas exception         | Keep   | Keep as spatial orientation control                                                |
| UX-CAN-002 | 3D navigation hints          | 3D viewport overlay                    | Canvas transient         | Keep   | Keep short, dismissible or low-noise; detailed settings move to secondary          |
| UX-CAN-003 | Section box summary          | 3D viewport overlay                    | Canvas transient         | Keep   | Keep only as spatial status; editing state in secondary                            |
| UX-CAN-004 | Wall context menu            | 3D viewport                            | Canvas context menu      | Keep   | Contextual selected-element actions allowed                                        |
| UX-CAN-005 | Wall face radial menu        | 3D viewport                            | Canvas context menu      | Keep   | Keep only for direct manipulation; mirrored in ribbon/Cmd+K where useful           |
| UX-CAN-006 | Saved 3D view HUD            | `OrbitViewpointPersistedHud`           | Secondary sidebar        | Move   | Move persistent saved-view fields out of canvas                                    |
| UX-CAN-007 | Floating palette             | Workspace canvas                       | Ribbon                   | Move   | Persistent tools belong in ribbon                                                  |
| UX-CAN-008 | Plan detail toolbar          | `PlanCanvas`                           | Ribbon/secondary         | Move   | Editing commands to ribbon, display/detail settings to secondary                   |
| UX-CAN-009 | Annotation bar               | `PlanCanvas`                           | Ribbon                   | Move   | Annotation commands belong in annotate ribbon group                                |
| UX-CAN-010 | Crop properties overlay      | `PlanCanvas`                           | Secondary/element        | Move   | View crop state in secondary; selected crop boundary properties in element sidebar |
| UX-CAN-011 | Zoom/fit widget              | `PlanCanvas`                           | Canvas exception/footer  | Audit  | Fit/zoom can remain if compact; duplicate global status avoided                    |
| UX-CAN-012 | North arrow                  | `PlanCanvas`                           | Canvas exception         | Keep   | Spatial orientation belongs on canvas                                              |
| UX-CAN-013 | Level datum widgets          | `PlanCanvas`                           | Canvas direct edit       | Keep   | Keep spatial handles; settings/properties move to secondary/element                |
| UX-CAN-014 | Temporary dimensions         | `PlanCanvas`                           | Canvas transient         | Keep   | Correct as direct-manipulation feedback                                            |
| UX-CAN-015 | Grips/handles                | `PlanCanvas`                           | Canvas transient         | Keep   | Correct direct editing UI                                                          |
| UX-CAN-016 | Numeric input near cursor    | `PlanCanvas`                           | Canvas transient         | Keep   | Correct direct manipulation                                                        |
| UX-CAN-017 | Snap glyphs                  | `PlanCanvas`                           | Canvas transient         | Keep   | Correct if short-lived; settings move to secondary                                 |
| UX-CAN-018 | Loop chip                    | `PlanCanvas`                           | Canvas transient         | Keep   | Keep only while sketch loop operation is active                                    |
| UX-CAN-019 | Temporary visibility chip    | `PlanCanvas`                           | Secondary plus transient | Move   | Persistent toggle in secondary; canvas chip only indicates active temporary mode   |
| UX-CAN-020 | Empty state hint             | Workspace canvas                       | Canvas                   | Keep   | Keep concise and action-oriented; do not replace navigation/ribbon                 |
| UX-CAN-021 | Canvas local command dock    | Floor plan long dock described by user | Ribbon                   | Move   | Consolidate into view-specific ribbon                                              |
| UX-CAN-022 | Sheet markup pins            | `SheetReviewSurface`                   | Canvas spatial           | Keep   | Pins are spatial annotations; properties go to element sidebar                     |
| UX-CAN-023 | Sheet review toolbar         | `SheetReviewSurface`                   | Ribbon                   | Move   | Persistent review commands belong in sheet/markup ribbon                           |
| UX-CAN-024 | Sheet viewport handles       | `SheetCanvas`                          | Canvas direct edit       | Keep   | Direct manipulation stays on canvas; properties in element sidebar                 |
| UX-CAN-025 | Concept board items          | `ConceptModeShell` canvas              | Canvas                   | Keep   | Board content stays on canvas; board tools in ribbon                               |
| UX-CAN-026 | Agent finding list in canvas | Agent review mode                      | Agent secondary/dialog   | Move   | Findings workflow should not pollute normal canvas layout                          |
| UX-CAN-027 | Keyboard shortcut hints      | Canvas/help overlays                   | Cmd+K/help dialog        | Audit  | Keep transient hints only; avoid persistent instructional chrome                   |
| UX-CAN-028 | Loading/progress overlays    | Workspace/canvas                       | Canvas                   | Keep   | Valid when blocking active canvas                                                  |
| UX-CAN-029 | Import placement preview     | Canvas                                 | Canvas transient         | Keep   | Spatial preview correct; import command owner depends on project/view scope        |
| UX-CAN-030 | Measurement result label     | Canvas                                 | Canvas transient         | Keep   | Measurement command in ribbon; result overlay on canvas                            |

## Expanded Element Sidebar Tracker

| ID         | Selected context                   | Current owner/source                       | Target owner           | Status   | Required action                                                                            |
| ---------- | ---------------------------------- | ------------------------------------------ | ---------------------- | -------- | ------------------------------------------------------------------------------------------ |
| UX-ELE-001 | Nothing selected                   | Right rail still shows scene/view controls | Hidden                 | Redesign | Right element sidebar must disappear completely with no selection                          |
| UX-ELE-002 | Wall selected                      | Right rail inspector/context menus         | Element sidebar        | Keep     | Show wall instance properties, constraints, type, dimensions, materials                    |
| UX-ELE-003 | Door/window selected               | Right rail inspector                       | Element sidebar        | Keep     | Show hosted element properties and host relationship                                       |
| UX-ELE-004 | Family/component selected          | Right rail/library/inspector               | Element sidebar        | Keep     | Show instance properties and type switcher                                                 |
| UX-ELE-005 | Room/area selected                 | Plan inspector                             | Element sidebar        | Keep     | Show name/number/area/finish-related properties                                            |
| UX-ELE-006 | Datum selected                     | Level/grid controls                        | Element sidebar        | Keep     | Show selected datum properties; do not keep datum editor in primary sidebar                |
| UX-ELE-007 | Crop boundary selected             | Plan overlay/right rail                    | Element sidebar        | Move     | Show crop boundary properties only while selected                                          |
| UX-ELE-008 | 3D section box selected            | Viewport/right rail                        | Element sidebar        | Audit    | If section box behaves like selected object, properties can appear here                    |
| UX-ELE-009 | Sheet viewport selected            | Sheet canvas/panels                        | Element sidebar        | Keep     | Show viewport scale, title, crop, referenced view, position                                |
| UX-ELE-010 | Titleblock selected                | Sheet canvas/panels                        | Element sidebar        | Keep     | Show titleblock instance/project sheet parameters                                          |
| UX-ELE-011 | Revision cloud selected            | Sheet review/sheet canvas                  | Element sidebar        | Keep     | Show revision, status, comments                                                            |
| UX-ELE-012 | Schedule cell selected             | Schedule table                             | Element sidebar        | Audit    | Only show if cell/row has rich properties; otherwise table inline edit is enough           |
| UX-ELE-013 | Concept item selected              | Concept board                              | Element sidebar        | Keep     | Show title, type, attachments, links, status                                               |
| UX-ELE-014 | Advisor finding selected           | Advisor panel/right rail                   | Element/sidebar dialog | Audit    | In advisor workflow, finding details may use right panel, but not normal element inspector |
| UX-ELE-015 | Scene sun controls                 | Right rail no-selection                    | Secondary sidebar      | Move     | Remove from element sidebar                                                                |
| UX-ELE-016 | View graphics controls             | Right rail no-selection                    | Secondary sidebar      | Move     | Remove from element sidebar                                                                |
| UX-ELE-017 | Layers/category visibility         | Right rail                                 | Secondary sidebar      | Move     | View-wide controls                                                                         |
| UX-ELE-018 | Authoring workbenches              | Right rail                                 | Ribbon/secondary       | Move     | Editing entry points belong in ribbon; view-wide authoring context in secondary            |
| UX-ELE-019 | Advisor panel in normal right rail | Right rail                                 | Footer/dialog          | Move     | Global advisor state belongs in footer                                                     |
| UX-ELE-020 | Element sidebar close behavior     | Current right rail toggle                  | Element sidebar        | Redesign | Close means hide inspector, but selecting an element should reopen or show an affordance   |
| UX-ELE-021 | Element sidebar width              | Current right rail width                   | Element sidebar        | Redesign | Resizable optional; must not reduce canvas below usable width                              |
| UX-ELE-022 | Multi-select properties            | Inspector                                  | Element sidebar        | Keep     | Show common properties, count, batch operations                                            |
| UX-ELE-023 | Invalid selection/no properties    | Inspector                                  | Element sidebar        | Redesign | Show minimal selected entity identity and actions, not unrelated view controls             |

## Expanded Footer And Global Status Tracker

| ID         | Current/global feature          | Current location/source             | Target owner             | Status   | Required action                                                                  |
| ---------- | ------------------------------- | ----------------------------------- | ------------------------ | -------- | -------------------------------------------------------------------------------- |
| UX-FOO-001 | Advisor warning count           | Advisor panel/right rail/agent mode | Footer                   | Move     | Show global severity count in footer                                             |
| UX-FOO-002 | Advisor errors dialog           | Advisor panel                       | Footer-triggered dialog  | Move     | Clicking footer count opens grouped findings with navigation                     |
| UX-FOO-003 | Sync/offline status             | Header overlay                      | Footer                   | Move     | Footer owns persistent global status                                             |
| UX-FOO-004 | Active command status           | Canvas/ribbon                       | Footer                   | Keep     | Footer can show current command and prompt                                       |
| UX-FOO-005 | Coordinates/scale/readout       | Canvas/status                       | Footer                   | Audit    | Put global readouts in footer if useful across views                             |
| UX-FOO-006 | Selection count                 | Inspector/canvas                    | Footer                   | Audit    | Footer can show lightweight count; properties remain in element sidebar          |
| UX-FOO-007 | Undo stack status               | Header                              | Footer or compact header | Audit    | Prefer footer if header tabs become crowded                                      |
| UX-FOO-008 | Background jobs/import progress | Toasts/dialogs                      | Footer                   | Keep     | Global long-running job status belongs in footer                                 |
| UX-FOO-009 | Permissions/role status         | Header/account                      | Footer/account           | Audit    | Persistent project permission indicator can live footer; management in user menu |
| UX-FOO-010 | Model health                    | Advisor/status                      | Footer                   | Keep     | Footer global model-health capsule with details dialog                           |
| UX-FOO-011 | Footer click targets            | New target                          | Footer                   | Redesign | Each item opens a specific dialog/panel, not a vague drawer                      |
| UX-FOO-012 | Footer density                  | New target                          | Footer                   | Redesign | Keep one-line and stable; no large explanatory text                              |

## Expanded Dialog And Modal Tracker

| ID         | Dialog/surface                  | Current source              | Target owner/trigger          | Status   | Required action                                                                     |
| ---------- | ------------------------------- | --------------------------- | ----------------------------- | -------- | ----------------------------------------------------------------------------------- |
| UX-DIA-001 | Command palette                 | `CommandPalette.tsx`        | Header Cmd+K                  | Keep     | Update command registry to new layout ownership                                     |
| UX-DIA-002 | Project menu                    | `ProjectMenu.tsx`           | Primary project selector      | Move     | Re-anchor from header                                                               |
| UX-DIA-003 | Manage links                    | `ManageLinksDialog.tsx`     | Project resources/secondary   | Move     | Project link management in resources; active-view visibility in secondary           |
| UX-DIA-004 | Visibility/Graphics             | `VVDialog.tsx`              | Secondary sidebar advanced    | Move     | Use secondary as common control surface and dialog as advanced editor               |
| UX-DIA-005 | Family library                  | Family panels/browser       | Insert ribbon/resource dialog | Move     | Remove family library from primary nav                                              |
| UX-DIA-006 | Material browser                | Material/appearance dialogs | Element sidebar or resources  | Audit    | Selected element materials from element sidebar; global library from resources      |
| UX-DIA-007 | Appearance asset browser        | Appearance dialogs          | Element sidebar/resources     | Audit    | Same split as material browser                                                      |
| UX-DIA-008 | New sheet dialog                | Sheet workflows             | Sheet ribbon/add tab          | Keep     | Creating a sheet can be launched from nav add or sheet ribbon                       |
| UX-DIA-009 | Share modal                     | Header share                | Header                        | Keep     | Keep header-triggered                                                               |
| UX-DIA-010 | Share presentation modal        | Header/share workflow       | Header                        | Keep     | Presentation-specific sharing remains header/share workflow                         |
| UX-DIA-011 | Activity drawer                 | Collaboration/activity      | Header or footer              | Audit    | Split live collaboration from system/job events                                     |
| UX-DIA-012 | Milestone dialog                | Project/version workflows   | Project resources/footer      | Audit    | Milestones are project-global; do not put in ribbon unless tied to publish workflow |
| UX-DIA-013 | Onboarding tour                 | App overlay                 | Help/onboarding               | Audit    | Must be updated after revamp to avoid explaining removed UI                         |
| UX-DIA-014 | Cheatsheet/keyboard help        | Help overlay                | Cmd+K/help                    | Keep     | Keep as global help, but shortcuts must reflect new ownership                       |
| UX-DIA-015 | Recent clipboard tray           | Clipboard workflow          | Footer or Cmd+K               | Audit    | If global state, footer; if command, Cmd+K                                          |
| UX-DIA-016 | Import wizard                   | Project/import surfaces     | Project selector or Insert    | Audit    | Classify per import type: project resource versus active view placement             |
| UX-DIA-017 | Type editor                     | Type/family browser         | Resources or element sidebar  | Move     | Edit type from selected element or resource manager, not primary sidebar            |
| UX-DIA-018 | View template editor            | Graphics/view settings      | Secondary advanced dialog     | Move     | View configuration resource, launched from secondary                                |
| UX-DIA-019 | Advisor findings dialog         | New target from footer      | Footer                        | Redesign | Group by severity, category, view, element; support navigate/apply/ignore           |
| UX-DIA-020 | Unsaved changes/confirm dialogs | Various                     | Contextual                    | Keep     | Keep modal, but wording should name affected tab/view/resource                      |

## Expanded View-Mode Surface Tracker

| ID          | Mode/surface        | Current layout issue                                                             | Target layout decision                                                                       |
| ----------- | ------------------- | -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| UX-MODE-001 | Plan                | Plan has canvas docks, annotation bars, left level controls, right view controls | Consolidate into primary nav, plan secondary, plan ribbon, transient canvas overlays         |
| UX-MODE-002 | 3D                  | 3D places scene/sun/graphics in right rail and saved view HUD on canvas          | Move all view-wide settings to secondary; keep view cube and direct spatial menus on canvas  |
| UX-MODE-003 | Plan+3D             | Split mode risks duplicating two full control systems                            | Use one active tab with combined secondary sections and one scoped ribbon                    |
| UX-MODE-004 | Section             | Section placeholder pane mixes preview, cuts, evidence, placement                | Secondary owns section setup; canvas preview stays central; ribbon owns detail/place actions |
| UX-MODE-005 | Sheet               | Sheet canvas/review surfaces have local toolbars                                 | Sheet secondary for sheet setup; sheet ribbon for viewport/titleblock/review/publish         |
| UX-MODE-006 | Schedule            | Schedule mode uses its own aside and table actions                               | Secondary for definition; ribbon for rows/columns/format; table for inline edit              |
| UX-MODE-007 | Concept             | Concept mode has separate 220px aside                                            | Convert to standard secondary sidebar and concept ribbon                                     |
| UX-MODE-008 | Agent               | Advisor panel appears as a mode and also as right rail content                   | Footer is global entry; agent mode is detailed workflow                                      |
| UX-MODE-009 | Public presentation | Presentation viewer is read-only and should not inherit authoring chrome         | Keep separate focused shell                                                                  |
| UX-MODE-010 | Family editor       | Standalone authoring tool likely has its own chrome                              | Audit after workspace revamp; apply same ownership principles where possible                 |
| UX-MODE-011 | Icon gallery        | Internal design-system page                                                      | Keep separate; use as icon source and QA reference                                           |
| UX-MODE-012 | Empty workspace     | Empty state competes with chrome if too instructional                            | Primary nav and ribbon remain clear; canvas empty state offers one next action               |

## Expanded Command Reachability Tracker

| ID         | Capability             | Direct target                  | Bridge target          | Validation rule                                        |
| ---------- | ---------------------- | ------------------------------ | ---------------------- | ------------------------------------------------------ |
| UX-CMD-001 | Open floor plan        | Primary sidebar, Cmd+K         | Header tab add         | Reachable in 1 click from primary, searchable in Cmd+K |
| UX-CMD-002 | Open 3D view           | Primary sidebar, Cmd+K         | Header tab add         | Same as floor plan                                     |
| UX-CMD-003 | Open section           | Primary sidebar, Cmd+K         | Header tab add         | Same as floor plan                                     |
| UX-CMD-004 | Open sheet             | Primary sidebar, Cmd+K         | Header tab add         | Same as floor plan                                     |
| UX-CMD-005 | Open schedule          | Primary sidebar, Cmd+K         | Header tab add         | Same as floor plan                                     |
| UX-CMD-006 | Open concept           | Primary sidebar, Cmd+K         | Header tab add         | Concept appears near top                               |
| UX-CMD-007 | Draw wall              | Plan ribbon                    | Cmd+K                  | Hidden or unavailable outside valid views              |
| UX-CMD-008 | Place door/window      | Plan/3D ribbon when host-valid | Cmd+K                  | Disabled reason if no valid host/context               |
| UX-CMD-009 | Measure                | Ribbon                         | Cmd+K                  | Result appears transiently on canvas                   |
| UX-CMD-010 | Dimension/tag          | Ribbon                         | Cmd+K                  | Not present in header                                  |
| UX-CMD-011 | Change 3D sun          | 3D secondary sidebar           | Cmd+K                  | Not in element sidebar without selection               |
| UX-CMD-012 | Change view graphics   | Secondary sidebar              | Cmd+K, VV dialog       | Common controls direct, advanced dialog bridge         |
| UX-CMD-013 | Edit selected wall     | Element sidebar                | Cmd+K                  | Right sidebar opens only with selection                |
| UX-CMD-014 | Manage project links   | Project resources              | Cmd+K                  | Active-view link visibility controlled in secondary    |
| UX-CMD-015 | Open advisor           | Footer                         | Cmd+K                  | Footer count opens findings                            |
| UX-CMD-016 | Apply advisor fix      | Advisor workflow ribbon/dialog | Cmd+K                  | Only visible when finding supports fix                 |
| UX-CMD-017 | Share project          | Header                         | Cmd+K                  | Always reachable if permissions allow                  |
| UX-CMD-018 | Close inactive tabs    | Header tab overflow            | Cmd+K                  | Not a QAT button                                       |
| UX-CMD-019 | Toggle primary sidebar | Header button                  | Cmd+K                  | Works from zero-width collapsed state                  |
| UX-CMD-020 | Open keyboard help     | Cmd+K/help                     | Header help if present | Shortcuts reflect new layout                           |

## Expanded Testing And Acceptance Backlog

| ID          | Test/audit target                 | Type                    | Acceptance condition                                                                        |
| ----------- | --------------------------------- | ----------------------- | ------------------------------------------------------------------------------------------- |
| UX-TEST-001 | Primary sidebar ownership         | Unit/DOM                | Primary nav contains only project selector, search, nav groups, user menu                   |
| UX-TEST-002 | Header ownership                  | Unit/DOM                | Header does not contain draw/measure/dimension/tag/view-mode navigation buttons             |
| UX-TEST-003 | Primary collapse to zero          | Playwright              | Sidebar can resize to hidden and be restored from header                                    |
| UX-TEST-004 | Header tabs                       | Playwright              | Opening named views creates tabs and tab overflow remains usable                            |
| UX-TEST-005 | 3D no-selection right rail        | Playwright              | Element sidebar is absent when no model element is selected                                 |
| UX-TEST-006 | 3D secondary sidebar              | Playwright              | Sun, graphics, projection, section box controls are in secondary sidebar                    |
| UX-TEST-007 | Plan ribbon                       | Unit/DOM                | Plan view exposes plan authoring groups and excludes sheet/schedule-only commands           |
| UX-TEST-008 | 3D ribbon                         | Unit/DOM                | 3D view excludes nonsensical plan-only drawing commands unless context-supported            |
| UX-TEST-009 | Sheet ribbon                      | Unit/DOM                | Sheet view exposes place views/titleblock/revisions/publish and excludes model wall drawing |
| UX-TEST-010 | Schedule ribbon                   | Unit/DOM                | Schedule view exposes rows/columns/fields/format and excludes canvas drawing tools          |
| UX-TEST-011 | Canvas overlay cleanup            | Playwright screenshot   | No persistent tool dock remains on plan canvas except allowed spatial/transient overlays    |
| UX-TEST-012 | View cube preservation            | Playwright screenshot   | 3D view cube remains visible and interactive                                                |
| UX-TEST-013 | Advisor footer                    | Unit/DOM and Playwright | Footer warning count opens findings dialog/workflow                                         |
| UX-TEST-014 | Cmd+K registry                    | Unit                    | Every command has valid new surface metadata and availability state                         |
| UX-TEST-015 | Dialog trigger audit              | Unit/DOM                | Project menu, VV, links, family library are launched from target owners                     |
| UX-TEST-016 | Responsive desktop                | Playwright screenshot   | No header/sidebar/footer overlaps at desktop widths                                         |
| UX-TEST-017 | Responsive tablet/narrow          | Playwright screenshot   | Tabs overflow and sidebars collapse without losing recovery controls                        |
| UX-TEST-018 | Selection opens element sidebar   | Playwright              | Selecting wall/viewport/concept item opens relevant properties                              |
| UX-TEST-019 | Deselection hides element sidebar | Playwright              | Deselecting removes right properties panel                                                  |
| UX-TEST-020 | Accessibility                     | Keyboard/a11y           | Header, sidebars, ribbon, footer, dialogs are keyboard reachable and labelled               |

## Expanded Implementation Sequencing Detail

| ID         | Work item                          | Why it comes here                                                         | Blocks/feeds                                           |
| ---------- | ---------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------ |
| UX-SEQ-001 | Introduce region ownership model   | Prevents moving controls without a consistent target                      | All later migration                                    |
| UX-SEQ-002 | Build resizable shell regions      | Layout must exist before content moves                                    | Header, primary, secondary, element, footer migrations |
| UX-SEQ-003 | Move primary project/nav/user      | Establishes navigation-only contract                                      | Header cleanup, tab focus                              |
| UX-SEQ-004 | Make header tab-first              | Removes duplicate navigation and QAT clutter                              | Ribbon migration, command registry rewrite             |
| UX-SEQ-005 | Add secondary sidebar adapters     | Provides destination for view-wide controls                               | Right rail cleanup, canvas overlay cleanup             |
| UX-SEQ-006 | Split right rail into element only | Enables selected-element mental model                                     | Selection tests and advisor/footer migration           |
| UX-SEQ-007 | Rebuild ribbon schema by view      | Moves editing commands into one expected region                           | Canvas toolbar removal and command capability rewrite  |
| UX-SEQ-008 | Consolidate canvas overlays        | Removes inconsistent local toolbars while preserving spatial manipulation | Screenshot regression tests                            |
| UX-SEQ-009 | Move advisor to footer             | Makes model health globally visible                                       | Agent workflow refinement                              |
| UX-SEQ-010 | Rewrite command capabilities       | Cmd+K must reflect final UI ownership                                     | Final acceptance and reachability scoring              |
| UX-SEQ-011 | Update dialogs and resource flows  | Dialog triggers must align with new owners                                | Project resources, family/type/material/link flows     |
| UX-SEQ-012 | Add visual regression suite        | Prevents reintroducing inconsistent chrome                                | Release readiness                                      |

## Usability Score Inputs For Future Agent

| Metric                         | Definition                                                                  | Target threshold                                         |
| ------------------------------ | --------------------------------------------------------------------------- | -------------------------------------------------------- |
| Ownership correctness          | Percentage of audited UI elements placed in their correct region            | 100 percent for all blocking acceptance rows             |
| Direct reachability            | Common task reachable from its canonical region without Cmd+K               | 1 to 2 clicks for primary tasks                          |
| Command palette reachability   | Every command discoverable through Cmd+K with accurate availability state   | 100 percent for registered commands                      |
| Header purity                  | Share of header controls that are tabs, tab lifecycle, global collaboration | Near 100 percent; no authoring commands                  |
| Primary nav purity             | Share of primary sidebar rows that open views/project navigation            | Near 100 percent; no type/family/level editors           |
| Canvas chrome reduction        | Persistent non-spatial controls remaining on canvas                         | Zero except approved spatial/transient exceptions        |
| Element sidebar conditionality | Right sidebar visible only when selection or explicit inspector workflow    | 100 percent for normal workspace states                  |
| View-specific ribbon relevance | Visible ribbon groups valid for active view type                            | 100 percent; invalid tools hidden or clearly unavailable |
| Collapse recoverability        | Hidden primary sidebar can be restored without guessing                     | Header reveal always visible and keyboard accessible     |
| Responsive stability           | No overlap between tabs, global actions, sidebars, canvas, footer           | Pass desktop, tablet, and narrow screenshots             |

## Second-Pass Deep Audit Addendum

This addendum exists because a full revamp handoff should not depend on only broad category rows. It makes the tracker closer to an implementation queue by naming additional files and surfaces that are easy to miss.

## Source File Surface Register

| ID         | Source file/surface                               | Current responsibility                                     | Target audit decision                                                                |
| ---------- | ------------------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| UX-SRC-001 | `workspace/shell/AppShell.tsx`                    | Physical grid shell                                        | Rebuild as seven-region shell with resizable primary/secondary and conditional right |
| UX-SRC-002 | `workspace/shell/TopBar.tsx`                      | Header, project, QAT, mode switching, share/search/account | Strip to tabs support, sidebar reveal, Cmd+K, share, presence                        |
| UX-SRC-003 | `workspace/shell/TabBar.tsx`                      | Open view tabs and add/close controls                      | Keep and elevate as header core                                                      |
| UX-SRC-004 | `workspace/shell/LeftRail.tsx`                    | Collapsible primary rail mechanics                         | Refactor to true navigation-only rail with drag-to-zero behavior                     |
| UX-SRC-005 | `workspace/shell/StatusBar.tsx`                   | Footer/status controls                                     | Keep and expand as global status owner; remove view editing ambiguity                |
| UX-SRC-006 | `workspace/shell/LensDropdown.tsx`                | Lens selector in shell                                     | Move to secondary sidebar if it changes active view lens                             |
| UX-SRC-007 | `workspace/shell/SourceViewChip.tsx`              | Sheet comment/source chip                                  | Audit for header crowding; likely sheet secondary or footer/comment entry            |
| UX-SRC-008 | `workspace/shell/TemporaryVisibilityChip.tsx`     | Temporary visibility indicator                             | Footer or secondary indicator, not free-floating chrome                              |
| UX-SRC-009 | `workspace/shell/RibbonBar.tsx`                   | Global Revit-like ribbon                                   | Rewrite around active view type and command validity                                 |
| UX-SRC-010 | `tools/ToolPalette.tsx`                           | Floating tool palette                                      | Retire as persistent surface; map tools into ribbon                                  |
| UX-SRC-011 | `tools/OptionsBar.tsx`                            | Tool options                                               | Place below ribbon only as active-command modifier row                               |
| UX-SRC-012 | `tools/ToolModifierBar.tsx`                       | Active tool modifiers                                      | Keep only as contextual ribbon extension, not standalone toolbar                     |
| UX-SRC-013 | `workspace/authoring/AuthoringWorkbenchesPanel`   | Right rail authoring panels                                | Split: commands to ribbon, settings to secondary, selected properties to element     |
| UX-SRC-014 | `workspace/authoring/OptionsBar.tsx`              | Authoring options                                          | Same as active-command modifier row                                                  |
| UX-SRC-015 | `workspace/authoring/ToolModifierBar.tsx`         | Authoring modifiers                                        | Same as active-command modifier row                                                  |
| UX-SRC-016 | `workspace/authoring/RoomColorSchemePanel.tsx`    | Room color scheme controls                                 | Plan secondary sidebar for view scheme, not element sidebar                          |
| UX-SRC-017 | `workspace/authoring/SiteAuthoringPanel.tsx`      | Site authoring controls                                    | Ribbon for site edit commands, secondary for site view context                       |
| UX-SRC-018 | `workspace/authoring/SubdivisionPalette.tsx`      | Subdivision controls                                       | Ribbon/active command modifier, not persistent right rail                            |
| UX-SRC-019 | `workspace/authoring/MaterialLayerStackWorkbench` | Material layer editing                                     | Element sidebar for selected type/layer; resource dialog for type-wide editing       |
| UX-SRC-020 | `workspace/inspector/Inspector.tsx`               | Generic inspector shell                                    | Element sidebar foundation                                                           |
| UX-SRC-021 | `workspace/inspector/InspectorContent.tsx`        | Selected-object properties and contextual controls         | Keep selected properties; move view/global controls out                              |
| UX-SRC-022 | `workspace/inspector/ViewTemplateEditPanel.tsx`   | View template editing                                      | Secondary advanced view configuration dialog                                         |
| UX-SRC-023 | `workspace/inspector/SunInspectorPanel.tsx`       | Sun controls                                               | 3D secondary sidebar                                                                 |
| UX-SRC-024 | `workspace/viewport/Viewport3DLayersPanel.tsx`    | 3D layers/graphics                                         | 3D secondary sidebar                                                                 |
| UX-SRC-025 | `workspace/viewport/WallContextMenu.tsx`          | Direct wall context commands                               | Canvas context menu with command parity in ribbon/Cmd+K                              |
| UX-SRC-026 | `viewport/wallFaceRadialMenu.tsx`                 | Wall face radial commands                                  | Canvas direct manipulation exception                                                 |
| UX-SRC-027 | `OrbitViewpointPersistedHud.tsx`                  | Saved 3D view persistence controls                         | 3D secondary sidebar                                                                 |
| UX-SRC-028 | `plan/PlanCanvas.tsx`                             | Plan drawing surface plus many local overlays              | Canvas only for drawing and transient direct manipulation                            |
| UX-SRC-029 | `plan/PlanDetailLevelToolbar.tsx`                 | Detail-level toolbar                                       | Plan secondary sidebar                                                               |
| UX-SRC-030 | `plan/SnapSettingsToolbar.tsx`                    | Snap settings                                              | Footer or plan secondary, depending persistence                                      |
| UX-SRC-031 | `plan/MarkupToolbar.tsx`                          | Markup tools                                               | Sheet/plan annotate ribbon                                                           |
| UX-SRC-032 | `plan/SketchCanvas.tsx`                           | Sketch mode canvas                                         | Canvas direct edit plus ribbon finish/cancel/options                                 |
| UX-SRC-033 | `plan/StairBySketchCanvas.tsx`                    | Stair sketch mode                                          | Ribbon command mode plus canvas direct edit                                          |
| UX-SRC-034 | `plan/SketchCanvasPickWalls.tsx`                  | Pick walls sketch workflow                                 | Canvas direct selection plus ribbon finish/cancel                                    |
| UX-SRC-035 | `plan/DesignOptionChip.tsx`                       | Design option chip/dialog                                  | Plan secondary sidebar for design option; modal for promote workflow                 |
| UX-SRC-036 | `plan/SnapGlyphLayer.tsx`                         | Snap glyphs                                                | Canvas transient feedback                                                            |
| UX-SRC-037 | `plan/HelperDimChip.tsx`                          | Editable helper dimension chips                            | Canvas transient direct edit                                                         |
| UX-SRC-038 | `workspace/sheets/SheetCanvas.tsx`                | Sheet canvas, viewport handles, captions                   | Sheet canvas plus sheet ribbon/secondary/element sidebar split                       |
| UX-SRC-039 | `workspace/sheets/SheetDocumentationManifest.tsx` | Sheet evidence/readouts                                    | Sheet secondary or advisor dialog, not generic canvas clutter                        |
| UX-SRC-040 | `plan/SheetReviewSurface.tsx`                     | Review/markup surface                                      | Sheet/markup ribbon plus spatial pins on canvas                                      |
| UX-SRC-041 | `schedules/SchedulePanel.tsx`                     | Schedule panel                                             | Schedule mode content plus secondary definition controls                             |
| UX-SRC-042 | `schedules/ScheduleDefinitionToolbar.tsx`         | Schedule definition toolbar                                | Schedule secondary or ribbon quick actions                                           |
| UX-SRC-043 | `schedules/ScheduleDefinitionPresetsStrip.tsx`    | Schedule presets                                           | Schedule secondary preset section                                                    |
| UX-SRC-044 | `schedules/ScheduleRegistryChrome.tsx`            | Schedule registry chrome                                   | Primary nav for opening schedules; schedule secondary for registry filters           |
| UX-SRC-045 | `schedules/ScheduleRegistryTable.tsx`             | Schedule registry table                                    | Primary nav/resources boundary audit                                                 |
| UX-SRC-046 | `families/FamilyLibraryPanel.tsx`                 | Family library dialog                                      | Insert ribbon/resource dialog                                                        |
| UX-SRC-047 | `familyEditor/FamilyEditorWorkbench.tsx`          | Standalone family editor                                   | Separate route, later align to same ownership principles                             |
| UX-SRC-048 | `familyEditor/NestedInstanceInspector.tsx`        | Nested family instance properties                          | Family editor element sidebar equivalent                                             |
| UX-SRC-049 | `familyEditor/MaterialBrowserDialog.tsx`          | Material browser                                           | Element properties/resource dialog                                                   |
| UX-SRC-050 | `familyEditor/AppearanceAssetBrowserDialog.tsx`   | Appearance asset browser                                   | Element properties/resource dialog                                                   |
| UX-SRC-051 | `collab/ShareModal.tsx`                           | Project sharing                                            | Header share flow                                                                    |
| UX-SRC-052 | `collab/SharePresentationModal.tsx`               | Presentation sharing                                       | Header share/presentation flow                                                       |
| UX-SRC-053 | `collab/ActivityDrawer.tsx`                       | Activity stream                                            | Footer or header activity, based event type                                          |
| UX-SRC-054 | `collab/ActivityPanel.tsx`                        | Activity detail                                            | Footer/header activity dialog                                                        |
| UX-SRC-055 | `collab/MilestoneDialog.tsx`                      | Milestones                                                 | Project/global workflow, likely footer/project resources                             |
| UX-SRC-056 | `collab/PublicLinkBanner.tsx`                     | Public link state                                          | Header/share state for public viewer, footer if status-only                          |
| UX-SRC-057 | `collab/MarkupCanvas.tsx`                         | Markup drawing layer                                       | Canvas spatial markup, tools in ribbon                                               |
| UX-SRC-058 | `jobs/JobsPanel.tsx`                              | Background job list/actions                                | Footer jobs/status dialog                                                            |
| UX-SRC-059 | `advisor/AdvisorPanel.tsx`                        | Advisor list/detail                                        | Footer-triggered dialog or agent workflow                                            |
| UX-SRC-060 | `advisor/ConstructabilityReportPanel.tsx`         | Constructability report                                    | Advisor workflow detail                                                              |
| UX-SRC-061 | `coordination/ClashTestPanel.tsx`                 | Clash testing                                              | Review/coordination ribbon plus advisor/dialog                                       |
| UX-SRC-062 | `coordination/SelectionSetPanel.tsx`              | Selection sets                                             | Secondary/review workflow or resource dialog                                         |
| UX-SRC-063 | `collaboration/PurgeUnusedPanel.tsx`              | Purge unused                                               | Project resources/management dialog, not normal view chrome                          |
| UX-SRC-064 | `workspace/comments/CommentsPanel.tsx`            | Comments                                                   | Collaboration drawer/dialog, with spatial pins on canvas where applicable            |
| UX-SRC-065 | `cmd/CheatsheetModal.tsx`                         | Shortcut help                                              | Cmd+K/help                                                                           |
| UX-SRC-066 | `cmd/CommandBar.tsx`                              | Command bar                                                | Audit against Cmd+K and ribbon; avoid second global command surface                  |
| UX-SRC-067 | `onboarding/OnboardingTour.tsx`                   | Guided tour                                                | Rewrite after revamp only                                                            |
| UX-SRC-068 | `workspace/project/ProjectBrowser.tsx`            | Project browser/resource tree                              | Split nav entries from resources/editors                                             |

## Current Footer Detailed Tracker

| ID          | Current footer/status element | Current source                         | Target decision          | Required action                                                                |
| ----------- | ----------------------------- | -------------------------------------- | ------------------------ | ------------------------------------------------------------------------------ |
| UX-STAT-001 | Status bar container          | `StatusBar.tsx`                        | Keep                     | Make it the only persistent global status strip                                |
| UX-STAT-002 | View mode readout             | `statusbar-view-mode`                  | Keep/Audit               | Keep as low-priority context; primary nav and tabs remain source of navigation |
| UX-STAT-003 | Active level dropdown         | `StatusBar.tsx`                        | Audit                    | Level switching may fit plan secondary better than footer                      |
| UX-STAT-004 | Level elevation readout       | `statusbar-level-elevation`            | Audit                    | If global readout, footer; if editable view context, secondary                 |
| UX-STAT-005 | Active tool readout           | `StatusBar.tsx`                        | Keep                     | Footer can show current command/prompt                                         |
| UX-STAT-006 | Snap mode toggles             | `StatusBar.tsx`                        | Audit                    | Persistent snap toggles can be footer if global; advanced settings secondary   |
| UX-STAT-007 | Grid toggle                   | `StatusBar.tsx`                        | Audit                    | If view display setting, secondary; if universal drawing aid, footer           |
| UX-STAT-008 | Coordinate readout            | `StatusBar.tsx`                        | Keep                     | Footer is correct for passive cursor/model coordinates                         |
| UX-STAT-009 | Undo button                   | `StatusBar.tsx` and header QAT         | Keep in footer           | Remove duplicate header undo if footer owns it                                 |
| UX-STAT-010 | Redo button                   | `StatusBar.tsx` and header QAT         | Keep in footer           | Remove duplicate header redo if footer owns it                                 |
| UX-STAT-011 | Workspace connection status   | `StatusBar.tsx`                        | Keep                     | Footer global status                                                           |
| UX-STAT-012 | Save state                    | `StatusBar.tsx`                        | Keep                     | Footer global status                                                           |
| UX-STAT-013 | Activity entry                | `status-bar-activity-entry`            | Keep/Audit               | Footer is good for event stream if not collaboration presence                  |
| UX-STAT-014 | Activity badge                | `status-bar-activity-badge`            | Keep                     | Footer badge for unread/background events                                      |
| UX-STAT-015 | Conflict pill                 | `conflict-pill`                        | Keep                     | Footer status dialog is appropriate                                            |
| UX-STAT-016 | Conflict queue dialog         | `collaboration-conflict-queue-readout` | Keep                     | Footer-triggered global dialog                                                 |
| UX-STAT-017 | Temporary visibility chip     | `TemporaryVisibilityChip.tsx`          | Move to footer/secondary | If global temporary mode, footer; if view graphics mode, secondary             |
| UX-STAT-018 | Advisor status count          | New footer target                      | Add                      | Add severity counts and click-through                                          |
| UX-STAT-019 | Jobs/progress status          | `JobsPanel.tsx`                        | Add                      | Footer entry for running/failed jobs                                           |
| UX-STAT-020 | Footer overflow               | New target                             | Redesign                 | Low-priority readouts collapse before critical advisor/sync states             |

## Tool And Active Command Tracker

| ID          | Tool/control                  | Current location/source      | Target owner             | Required action                                                                 |
| ----------- | ----------------------------- | ---------------------------- | ------------------------ | ------------------------------------------------------------------------------- |
| UX-TOOL-001 | Global command bar            | `cmd/CommandBar.tsx`         | Cmd+K or ribbon          | Avoid a second always-visible command entry unless explicitly scoped            |
| UX-TOOL-002 | Tool palette                  | `ToolPalette.tsx`            | Ribbon                   | Retire persistent floating palette                                              |
| UX-TOOL-003 | Options bar                   | `OptionsBar.tsx`             | Active ribbon modifier   | Show only while a command needs options                                         |
| UX-TOOL-004 | Tool modifier bar             | `ToolModifierBar.tsx`        | Active ribbon modifier   | Attach to ribbon area, not canvas                                               |
| UX-TOOL-005 | Wall tool options             | Tool modifier/options bars   | Ribbon modifier          | Scope by plan/valid 3D edit context                                             |
| UX-TOOL-006 | Door/window placement options | Tool modifier/options bars   | Ribbon modifier          | Show host/type options only during placement                                    |
| UX-TOOL-007 | Room/area options             | Tool modifier/options bars   | Ribbon modifier          | View-specific plan command modifier                                             |
| UX-TOOL-008 | Dimension options             | Tool modifier/options bars   | Ribbon modifier          | Annotation command modifier                                                     |
| UX-TOOL-009 | Tag options                   | Tool modifier/options bars   | Ribbon modifier          | Annotation command modifier                                                     |
| UX-TOOL-010 | Measure options               | Tool modifier/options bars   | Ribbon modifier          | Review command modifier; result on canvas                                       |
| UX-TOOL-011 | Sketch finish/cancel          | Sketch canvases              | Ribbon command state     | Finish/cancel in ribbon modifier row and keyboard                               |
| UX-TOOL-012 | Pick walls mode               | `SketchCanvasPickWalls.tsx`  | Ribbon plus canvas       | Ribbon owns command, canvas owns direct picks                                   |
| UX-TOOL-013 | Stair by sketch controls      | `StairBySketchCanvas.tsx`    | Ribbon plus canvas       | Treat as command mode with explicit finish/cancel                               |
| UX-TOOL-014 | Padlock constraints           | Plan canvas                  | Canvas transient/element | Inline padlock remains spatial; selected constraint properties in element panel |
| UX-TOOL-015 | Helper dimension edit         | `HelperDimChip.tsx`          | Canvas transient         | Keep near geometry while editing                                                |
| UX-TOOL-016 | Snap glyphs                   | `SnapGlyphLayer.tsx`         | Canvas transient         | Keep as non-persistent drawing feedback                                         |
| UX-TOOL-017 | Snap settings toolbar         | `SnapSettingsToolbar.tsx`    | Footer/secondary         | Do not leave as floating plan toolbar                                           |
| UX-TOOL-018 | Detail level toolbar          | `PlanDetailLevelToolbar.tsx` | Plan secondary           | Move                                                                            |
| UX-TOOL-019 | Markup toolbar                | `MarkupToolbar.tsx`          | Markup ribbon            | Consolidate plan/sheet markup commands                                          |
| UX-TOOL-020 | Design option chip            | `DesignOptionChip.tsx`       | Plan secondary           | Active design option is view/model context                                      |
| UX-TOOL-021 | Promote design option dialog  | `DesignOptionChip.tsx`       | Contextual modal         | Keep modal, launched from secondary/context command                             |
| UX-TOOL-022 | Active command prompts        | Status bar/canvas            | Footer plus canvas cue   | Footer owns text prompt; canvas may show spatial cue                            |
| UX-TOOL-023 | Cancel active command         | Escape/buttons scattered     | Ribbon modifier/footer   | Provide one visible command-state cancel affordance                             |
| UX-TOOL-024 | Tool keyboard shortcuts       | Toolbars/help                | Cmd+K/help               | Update shortcut docs after command migration                                    |

## Project Resource And Browser Deep Tracker

| ID         | Resource/browser item            | Current location/source      | Target owner                  | Required action                                                            |
| ---------- | -------------------------------- | ---------------------------- | ----------------------------- | -------------------------------------------------------------------------- |
| UX-RES-001 | Project browser root             | `ProjectBrowser.tsx`         | Split                         | Separate navigable views from resources and editors                        |
| UX-RES-002 | Floor plan browser entry         | Project browser              | Primary sidebar               | Open named tab                                                             |
| UX-RES-003 | 3D view browser entry            | Project browser              | Primary sidebar               | Open named tab                                                             |
| UX-RES-004 | Section browser entry            | Project browser              | Primary sidebar               | Open named tab                                                             |
| UX-RES-005 | Sheet browser entry              | Project browser              | Primary sidebar               | Open named tab                                                             |
| UX-RES-006 | Schedule browser entry           | Project browser              | Primary sidebar               | Open named tab                                                             |
| UX-RES-007 | Concept browser entry            | Project browser              | Primary sidebar               | Open named tab, high placement                                             |
| UX-RES-008 | Browser rename entry             | Project browser context menu | Primary/sidebar context       | Valid for navigation objects                                               |
| UX-RES-009 | Browser duplicate view           | Project browser context menu | Primary/sidebar context       | Valid for navigable views                                                  |
| UX-RES-010 | Browser delete view              | Project browser context menu | Primary/sidebar context       | Confirm with view name and open tab impact                                 |
| UX-RES-011 | Browser create view              | Browser action               | Header tab add/primary        | Allowed if creating a navigable view, not model element                    |
| UX-RES-012 | Level resource                   | Project browser/left rail    | Secondary/resources           | Do not show as primary nav editor                                          |
| UX-RES-013 | Family resource                  | Project browser/family panel | Insert ribbon/resource dialog | Remove from primary nav                                                    |
| UX-RES-014 | Type resource                    | Project browser/type tree    | Resource dialog/element       | Edit selected type via element sidebar or resources                        |
| UX-RES-015 | View template resource           | Project browser/graphics     | Secondary advanced dialog     | Apply/edit through view settings                                           |
| UX-RES-016 | Material resource                | Material browser             | Resource dialog               | Global material library outside primary nav                                |
| UX-RES-017 | Link resource                    | Manage links dialog          | Project resources             | Link management not normal view navigation                                 |
| UX-RES-018 | Worksets if present              | Inspector/project resources  | Project resources/secondary   | Project resource unless active view filter                                 |
| UX-RES-019 | Phases if present                | View settings/resources      | Secondary/resources           | Active phase in secondary, phase definitions in resources                  |
| UX-RES-020 | Design options                   | Design option chip/resources | Secondary/resources           | Active option secondary, management resource dialog                        |
| UX-RES-021 | Browser evidence/readout         | `projectBrowserEvidence.ts`  | Advisor/details               | Evidence supports advisor, not primary nav clutter                         |
| UX-RES-022 | Browser rendering budget readout | Readout tests                | Developer/advisor             | Do not expose as user-facing primary nav                                   |
| UX-RES-023 | Purge unused                     | `PurgeUnusedPanel.tsx`       | Project management dialog     | Project-global cleanup workflow                                            |
| UX-RES-024 | Resource search                  | Primary search/Cmd+K         | Cmd+K/resource dialog         | Primary search can find resources but should not turn them into nav groups |

## Plan And Sketch Deep Tracker

| ID          | Plan/sketch surface        | Current location/source  | Target owner                  | Required action                                               |
| ----------- | -------------------------- | ------------------------ | ----------------------------- | ------------------------------------------------------------- |
| UX-PLAN-001 | Plan canvas base           | `PlanCanvas.tsx`         | Canvas                        | Keep model drawing surface                                    |
| UX-PLAN-002 | Wall drawing               | Plan tools/ribbon        | Plan ribbon                   | Main create group                                             |
| UX-PLAN-003 | Wall preview               | Plan canvas              | Canvas transient              | Keep direct preview                                           |
| UX-PLAN-004 | Opening placement preview  | Plan canvas              | Canvas transient              | Keep direct preview                                           |
| UX-PLAN-005 | Room placement preview     | Plan canvas              | Canvas transient              | Keep direct preview                                           |
| UX-PLAN-006 | Area boundary sketch       | Plan/sketch canvas       | Ribbon plus canvas            | Ribbon starts/finishes; canvas draws                          |
| UX-PLAN-007 | Floor sketch               | Sketch canvas            | Ribbon plus canvas            | Sketch command mode                                           |
| UX-PLAN-008 | Roof sketch                | Sketch canvas            | Ribbon plus canvas            | Sketch command mode                                           |
| UX-PLAN-009 | Stair sketch               | Stair sketch canvas      | Ribbon plus canvas            | Sketch command mode                                           |
| UX-PLAN-010 | Open-loop status           | Sketch canvas status     | Footer/canvas transient       | Footer command status plus local visual cue                   |
| UX-PLAN-011 | Ready-to-finish status     | Sketch canvas status     | Footer/ribbon modifier        | Finish affordance in ribbon modifier                          |
| UX-PLAN-012 | Validation errors          | Sketch canvas            | Footer/advisor/modal          | Blocking command errors visible in footer and command context |
| UX-PLAN-013 | Padlock constraints        | Plan canvas              | Canvas/element                | Spatial locks on canvas, selected lock details in element     |
| UX-PLAN-014 | Temporary dimensions       | Plan canvas              | Canvas transient              | Keep                                                          |
| UX-PLAN-015 | Helper dimension chips     | Helper dim chip          | Canvas transient              | Keep                                                          |
| UX-PLAN-016 | Snap glyph layer           | Snap glyph layer         | Canvas transient              | Keep                                                          |
| UX-PLAN-017 | Snap configuration         | Snap toolbar/status      | Footer/secondary              | Consolidate settings                                          |
| UX-PLAN-018 | Plan detail level          | Detail toolbar           | Plan secondary                | Move                                                          |
| UX-PLAN-019 | Plan visual style          | Right rail/header/canvas | Plan secondary                | Move                                                          |
| UX-PLAN-020 | Plan crop edit             | Canvas overlay           | Secondary plus canvas handles | Move persistent properties, keep direct handles               |
| UX-PLAN-021 | Reveal hidden mode         | Canvas/status            | Secondary/footer indicator    | Persistent mode in secondary; status chip in footer           |
| UX-PLAN-022 | Temporary hide/isolate     | Canvas/context           | Ribbon plus transient status  | Ribbon/context command, footer status                         |
| UX-PLAN-023 | Design option active state | Design option chip       | Plan secondary                | Move                                                          |
| UX-PLAN-024 | Promote design option      | Modal                    | Secondary/context modal       | Keep modal, triggered from correct context                    |
| UX-PLAN-025 | Plan annotation commands   | Annotation bar           | Ribbon                        | Move all persistent annotation commands                       |
| UX-PLAN-026 | Plan markup commands       | Markup toolbar           | Ribbon                        | Move                                                          |
| UX-PLAN-027 | Plan empty/error state     | Workspace helpers        | Canvas                        | Keep concise, no duplicated layout teaching                   |
| UX-PLAN-028 | Plan import placement      | Canvas/import workflow   | Insert ribbon plus canvas     | Command owner in ribbon, placement on canvas                  |

## Three-D View Deep Tracker

| ID        | 3D surface/control          | Current location/source          | Target owner              | Required action                              |
| --------- | --------------------------- | -------------------------------- | ------------------------- | -------------------------------------------- |
| UX-3D-001 | 3D canvas                   | `Viewport.tsx`                   | Canvas                    | Keep                                         |
| UX-3D-002 | View cube                   | `Viewport.tsx`                   | Canvas exception          | Keep                                         |
| UX-3D-003 | Orbit/pan/zoom hints        | `Viewport.tsx`                   | Canvas transient/help     | Keep minimal                                 |
| UX-3D-004 | Walk mode controls          | `Viewport.tsx`/right rail        | 3D secondary plus canvas  | Secondary owns mode; canvas owns live hint   |
| UX-3D-005 | Viewpoint persistence HUD   | `OrbitViewpointPersistedHud.tsx` | 3D secondary              | Move persistent saved-view controls          |
| UX-3D-006 | Saved view name/state       | 3D HUD                           | Header tab plus secondary | Tab names view, secondary owns view settings |
| UX-3D-007 | Section box display         | Viewport/right rail              | 3D secondary plus canvas  | Settings secondary, handles on canvas        |
| UX-3D-008 | Clip cap/floor              | 3D HUD                           | 3D secondary              | Move                                         |
| UX-3D-009 | Cutaway                     | 3D HUD                           | 3D secondary              | Move                                         |
| UX-3D-010 | Hidden kinds/categories     | 3D HUD/layers panel              | 3D secondary              | Move                                         |
| UX-3D-011 | Shadows                     | 3D HUD/right rail                | 3D secondary              | Move                                         |
| UX-3D-012 | Ambient occlusion           | 3D HUD/right rail                | 3D secondary              | Move                                         |
| UX-3D-013 | Depth cueing                | 3D HUD/right rail                | 3D secondary              | Move                                         |
| UX-3D-014 | Edge width                  | 3D HUD/right rail                | 3D secondary              | Move                                         |
| UX-3D-015 | Exposure                    | 3D HUD/right rail                | 3D secondary              | Move                                         |
| UX-3D-016 | Plan overlay source         | 3D HUD                           | 3D secondary              | Move                                         |
| UX-3D-017 | Plan overlay opacity/offset | 3D HUD                           | 3D secondary              | Move                                         |
| UX-3D-018 | Plan annotations overlay    | 3D HUD                           | 3D secondary              | Move                                         |
| UX-3D-019 | Sun inspector               | `SunInspectorPanel.tsx`          | 3D secondary              | Move                                         |
| UX-3D-020 | 3D layers panel             | `Viewport3DLayersPanel.tsx`      | 3D secondary              | Move                                         |
| UX-3D-021 | Wall context menu           | `WallContextMenu.tsx`            | Canvas context            | Keep                                         |
| UX-3D-022 | Wall face radial menu       | `wallFaceRadialMenu.tsx`         | Canvas context            | Keep                                         |
| UX-3D-023 | Selected wall properties    | Right rail inspector             | Element sidebar           | Keep after right rail split                  |
| UX-3D-024 | No-selection scene panel    | Right rail                       | 3D secondary              | Move                                         |
| UX-3D-025 | 3D measure command          | Header/canvas/ribbon             | 3D ribbon                 | Move                                         |
| UX-3D-026 | 3D isolate/hide             | Context/right rail               | Ribbon/context            | Keep context, add ribbon discoverability     |
| UX-3D-027 | 3D empty/loading state      | Canvas                           | Canvas                    | Keep                                         |
| UX-3D-028 | 3D camera creation          | Ribbon/canvas                    | 3D ribbon                 | Add/keep based on feature availability       |

## Sheet And Review Deep Tracker

| ID           | Sheet/review surface                 | Current location/source          | Target owner                   | Required action                                                       |
| ------------ | ------------------------------------ | -------------------------------- | ------------------------------ | --------------------------------------------------------------------- |
| UX-SHEET-001 | Sheet canvas                         | `SheetCanvas.tsx`                | Canvas                         | Keep                                                                  |
| UX-SHEET-002 | Recommended viewports button         | `SheetCanvas.tsx`                | Sheet ribbon                   | Move command out of canvas chrome                                     |
| UX-SHEET-003 | Empty viewports state                | Sheet SVG                        | Canvas                         | Keep as sheet content state                                           |
| UX-SHEET-004 | Viewport rectangles                  | Sheet SVG                        | Canvas                         | Keep direct manipulation                                              |
| UX-SHEET-005 | Viewport resize handles              | Sheet SVG                        | Canvas direct edit             | Keep                                                                  |
| UX-SHEET-006 | Viewport detail label                | Sheet SVG                        | Canvas annotation              | Keep display; selected properties in element sidebar                  |
| UX-SHEET-007 | Viewport scale caption               | Sheet SVG                        | Canvas display                 | Keep display; edit in element sidebar/secondary                       |
| UX-SHEET-008 | Schedule caption                     | Sheet SVG                        | Canvas display                 | Keep display                                                          |
| UX-SHEET-009 | Plan legend caption                  | Sheet SVG                        | Canvas display                 | Keep display                                                          |
| UX-SHEET-010 | Revision issue doc token             | Sheet canvas                     | Footer/advisor/sheet secondary | Audit status versus sheet metadata                                    |
| UX-SHEET-011 | Sheet documentation manifest         | `SheetDocumentationManifest.tsx` | Sheet secondary/advisor        | Move evidence/readouts out of central authoring surface if persistent |
| UX-SHEET-012 | Sheet manifest advisor               | Manifest                         | Advisor workflow               | Route to footer advisor/detail                                        |
| UX-SHEET-013 | Viewport evidence readouts           | Manifest                         | Advisor/details                | Keep as details, not always-visible chrome                            |
| UX-SHEET-014 | Room legend readouts                 | Manifest                         | Sheet secondary/advisor        | Treat as sheet documentation validation                               |
| UX-SHEET-015 | Detail callout readout               | Manifest                         | Sheet secondary/advisor        | Treat as documentation validation                                     |
| UX-SHEET-016 | Section-on-sheet integration readout | Manifest                         | Sheet secondary/advisor        | Treat as documentation validation                                     |
| UX-SHEET-017 | Room color scheme legend readout     | Manifest                         | Sheet secondary/advisor        | Treat as documentation validation                                     |
| UX-SHEET-018 | Sheet review surface                 | `SheetReviewSurface.tsx`         | Sheet/markup mode              | Keep focused review mode, align chrome                                |
| UX-SHEET-019 | Review markup pins                   | Sheet review surface             | Canvas spatial                 | Keep                                                                  |
| UX-SHEET-020 | Review comment panel                 | Sheet review surface/comments    | Collaboration dialog/element   | Comments drawer/detail, not arbitrary canvas panel                    |
| UX-SHEET-021 | Review toolbar                       | Sheet review surface             | Sheet markup ribbon            | Move                                                                  |
| UX-SHEET-022 | New sheet dialog                     | `NewSheetDialog.tsx`             | Sheet ribbon/tab add           | Keep modal trigger from sheet context                                 |
| UX-SHEET-023 | Titleblock editing                   | Sheet canvas                     | Sheet ribbon/element sidebar   | Ribbon command and selected titleblock properties                     |
| UX-SHEET-024 | Place schedule on sheet              | Schedule/sheet surfaces          | Sheet ribbon                   | Sheet-specific placement command                                      |
| UX-SHEET-025 | Place section on sheet               | Section/sheet surfaces           | Sheet ribbon                   | Sheet-specific placement command                                      |
| UX-SHEET-026 | Publish/export sheet                 | Sheet/share surfaces             | Sheet ribbon/header share      | Separate sheet publish from project share                             |

## Schedule Deep Tracker

| ID         | Schedule surface             | Current location/source              | Target owner                 | Required action                                                   |
| ---------- | ---------------------------- | ------------------------------------ | ---------------------------- | ----------------------------------------------------------------- |
| UX-SCH-001 | Schedule panel               | `SchedulePanel.tsx`                  | Schedule content             | Keep as central schedule view                                     |
| UX-SCH-002 | Schedule view                | `ScheduleView.tsx`                   | Schedule canvas/content      | Keep table as main content                                        |
| UX-SCH-003 | Definition toolbar           | `ScheduleDefinitionToolbar.tsx`      | Secondary/ribbon split       | Definition state secondary, quick actions ribbon                  |
| UX-SCH-004 | Presets strip                | `ScheduleDefinitionPresetsStrip.tsx` | Schedule secondary           | Move to secondary as schedule-wide setup                          |
| UX-SCH-005 | Registry chrome              | `ScheduleRegistryChrome.tsx`         | Primary/resources split      | Opening schedules primary; filtering registry secondary/resources |
| UX-SCH-006 | Registry table               | `ScheduleRegistryTable.tsx`          | Schedule/resource content    | Audit whether it is a navigable view or resource manager          |
| UX-SCH-007 | Sort keys                    | Schedule panel                       | Schedule secondary           | View-wide table definition                                        |
| UX-SCH-008 | Filters                      | Schedule panel                       | Schedule secondary           | View-wide table definition                                        |
| UX-SCH-009 | Grouping                     | Schedule panel                       | Schedule secondary           | View-wide table definition                                        |
| UX-SCH-010 | Field selection              | Schedule panel                       | Schedule secondary           | View-wide table definition                                        |
| UX-SCH-011 | Column visibility            | Schedule panel                       | Schedule secondary           | View-wide table definition                                        |
| UX-SCH-012 | Cell editing                 | Schedule table                       | Table inline/element sidebar | Inline for simple edit; element sidebar for rich selected row     |
| UX-SCH-013 | Row operations               | Schedule toolbar                     | Schedule ribbon              | Move                                                              |
| UX-SCH-014 | Column operations            | Schedule toolbar                     | Schedule ribbon              | Move                                                              |
| UX-SCH-015 | Place on sheet               | Schedule/sheet UI                    | Schedule or sheet ribbon     | Available where placement context exists                          |
| UX-SCH-016 | Export parity readout        | Schedule readout                     | Advisor/sheet secondary      | Validation readout, not main toolbar                              |
| UX-SCH-017 | Opening advisories readout   | Schedule readout                     | Advisor workflow             | Move to advisor/details                                           |
| UX-SCH-018 | Room finish evidence readout | Schedule readout                     | Advisor/details              | Move to advisor/details                                           |
| UX-SCH-019 | Stair evidence readout       | Schedule readout                     | Advisor/details              | Move to advisor/details                                           |
| UX-SCH-020 | Plans/sheets schedule UI     | Schedule tests/UI                    | Schedule secondary/sheet     | Split by active context                                           |

## Collaboration Jobs Advisor Coordination Tracker

| ID         | Surface/workflow              | Current location/source           | Target owner                  | Required action                                                                   |
| ---------- | ----------------------------- | --------------------------------- | ----------------------------- | --------------------------------------------------------------------------------- |
| UX-COL-001 | Share modal                   | `ShareModal.tsx`                  | Header share                  | Keep                                                                              |
| UX-COL-002 | Share presentation modal      | `SharePresentationModal.tsx`      | Header share                  | Keep                                                                              |
| UX-COL-003 | Public link banner            | `PublicLinkBanner.tsx`            | Public/share state            | Keep outside authoring chrome                                                     |
| UX-COL-004 | Presence avatars              | Header                            | Header                        | Keep, but integrate with tab overflow                                             |
| UX-COL-005 | Activity drawer               | `ActivityDrawer.tsx`              | Footer/header activity        | Use footer for system/job/history events, header for live collaboration if needed |
| UX-COL-006 | Activity panel                | `ActivityPanel.tsx`               | Activity dialog               | Keep                                                                              |
| UX-COL-007 | Comments panel                | `CommentsPanel.tsx`               | Collaboration drawer          | Do not place persistent comments in primary nav                                   |
| UX-COL-008 | Source view comments chip     | `SourceViewChip.tsx`              | Sheet secondary/header audit  | Avoid crowding header tabs                                                        |
| UX-COL-009 | Markup canvas                 | `MarkupCanvas.tsx`                | Canvas spatial layer          | Keep spatial layer, move tools to ribbon                                          |
| UX-COL-010 | Milestone dialog              | `MilestoneDialog.tsx`             | Project/footer workflow       | Project-global, not view ribbon unless publishing                                 |
| UX-COL-011 | Jobs panel                    | `JobsPanel.tsx`                   | Footer jobs dialog            | Footer entry for queued/running/failed jobs                                       |
| UX-COL-012 | Job retry/cancel actions      | `JobsPanel.tsx`                   | Jobs dialog                   | Keep inside footer-triggered jobs panel                                           |
| UX-COL-013 | Advisor panel                 | `AdvisorPanel.tsx`                | Footer-triggered advisor      | Move from right rail                                                              |
| UX-COL-014 | Constructability report       | `ConstructabilityReportPanel.tsx` | Advisor workflow detail       | Keep as advisor detail                                                            |
| UX-COL-015 | Advisor navigation to element | Advisor panel                     | Advisor dialog/agent workflow | Selecting finding opens element/view and element sidebar if applicable            |
| UX-COL-016 | Advisor quick fixes           | Advisor panel                     | Agent/advisor ribbon          | Only visible in advisor workflow                                                  |
| UX-COL-017 | Clash test panel              | `ClashTestPanel.tsx`              | Coordination/advisor workflow | Review ribbon to run, advisor/detail to inspect results                           |
| UX-COL-018 | Selection set panel           | `SelectionSetPanel.tsx`           | Secondary/review workflow     | Treat as coordination resource, not primary nav                                   |
| UX-COL-019 | Purge unused panel            | `PurgeUnusedPanel.tsx`            | Project management dialog     | Launch from project resources/Cmd+K                                               |
| UX-COL-020 | Conflict queue                | Status bar                        | Footer dialog                 | Keep                                                                              |
| UX-COL-021 | Collaboration conflict retry  | Status bar conflict dialog        | Footer dialog                 | Keep                                                                              |
| UX-COL-022 | Activity shortcut Cmd+H       | Status bar activity entry         | Footer/Cmd+K                  | Confirm shortcut does not conflict with new command model                         |

## Family Material And Standalone Editor Tracker

| ID         | Surface/workflow                | Current location/source            | Target owner                  | Required action                                        |
| ---------- | ------------------------------- | ---------------------------------- | ----------------------------- | ------------------------------------------------------ |
| UX-FAM-001 | Family library dialog           | `FamilyLibraryPanel.tsx`           | Insert ribbon/resource dialog | Remove primary rail shortcut as persistent nav         |
| UX-FAM-002 | Family search                   | Family library                     | Dialog                        | Keep in dialog                                         |
| UX-FAM-003 | Family groups                   | Family library                     | Dialog                        | Keep, with icons/previews                              |
| UX-FAM-004 | Family rendered thumbnails      | Family library                     | Dialog                        | Keep visual previews                                   |
| UX-FAM-005 | Custom/catalog badges           | Family library                     | Dialog                        | Keep                                                   |
| UX-FAM-006 | Load catalog family             | Family library                     | Dialog command                | Keep                                                   |
| UX-FAM-007 | Place loaded family             | Family library/ribbon              | Insert ribbon plus dialog     | Ribbon starts placement, dialog selects asset          |
| UX-FAM-008 | Wall type thumbnails            | Family library                     | Resource/type dialog          | Keep in type/library dialog                            |
| UX-FAM-009 | Array formula editor            | Family library                     | Type/family editor            | Not primary nav                                        |
| UX-FAM-010 | Family editor workbench         | `/family-editor` route             | Standalone shell              | Separate route, later align to seven-region principles |
| UX-FAM-011 | Nested instance inspector       | Family editor                      | Family editor element sidebar | Keep selected nested instance properties               |
| UX-FAM-012 | Family editor detail visibility | Family editor                      | Family secondary equivalent   | Align with view-wide visibility principle              |
| UX-FAM-013 | Family editor material browser  | `MaterialBrowserDialog.tsx`        | Material dialog               | Keep modal, trigger from selected material/type        |
| UX-FAM-014 | Appearance asset browser        | `AppearanceAssetBrowserDialog.tsx` | Asset dialog                  | Keep modal, trigger from selected material/type        |
| UX-FAM-015 | Material layer stack workbench  | Authoring workbench                | Element/type sidebar          | Move out of generic right rail unless selected context |
| UX-FAM-016 | Room color scheme panel         | Authoring panel                    | Plan secondary                | View-wide graphics/classification                      |
| UX-FAM-017 | Site authoring panel            | Authoring panel                    | Ribbon/secondary split        | Commands to ribbon, site context to secondary          |
| UX-FAM-018 | Subdivision palette             | Authoring panel                    | Ribbon modifier               | Command-specific, not persistent panel                 |

## Inspector And Property Taxonomy Tracker

| ID          | Property category              | Current owner/source          | Target owner                                | Required action                                                      |
| ----------- | ------------------------------ | ----------------------------- | ------------------------------------------- | -------------------------------------------------------------------- |
| UX-PROP-001 | Instance identity              | Inspector                     | Element sidebar                             | Name/id/category/level/host for selected element                     |
| UX-PROP-002 | Type selector                  | Inspector/type browser        | Element sidebar                             | Type switcher for selected element                                   |
| UX-PROP-003 | Type editing                   | Type browser/inspector        | Resource dialog or expanded element sidebar | Avoid primary nav                                                    |
| UX-PROP-004 | Geometry dimensions            | Inspector/helper dims         | Element sidebar and canvas                  | Numeric properties in sidebar; spatial handles on canvas             |
| UX-PROP-005 | Constraints                    | Inspector/canvas padlocks     | Element sidebar and canvas                  | Constraints in sidebar; lock glyphs on canvas                        |
| UX-PROP-006 | Materials                      | Inspector/material browser    | Element sidebar/dialog                      | Selected element material properties                                 |
| UX-PROP-007 | Phasing                        | Inspector/view settings       | Element or secondary split                  | Element phase property if selected; active phase filter in secondary |
| UX-PROP-008 | Design option membership       | Inspector/design option chip  | Element or secondary split                  | Element membership in sidebar, active option in secondary            |
| UX-PROP-009 | Workset                        | Inspector                     | Element sidebar/resources                   | Selected element workset in sidebar; workset management in resources |
| UX-PROP-010 | Pin/lock state                 | Inspector/canvas              | Element sidebar/canvas                      | Property plus spatial affordance                                     |
| UX-PROP-011 | View template assignment       | Inspector/view template panel | Secondary                                   | Active view template belongs to view context                         |
| UX-PROP-012 | Sun/view graphics              | Inspector/right rail          | Secondary                                   | Remove from element sidebar                                          |
| UX-PROP-013 | Advisor metadata               | Inspector/advisor             | Advisor workflow                            | Findings are not element properties unless tied to selected element  |
| UX-PROP-014 | Multi-select common properties | Inspector                     | Element sidebar                             | Common fields plus mixed-value handling                              |
| UX-PROP-015 | Multi-select batch actions     | Inspector/ribbon              | Ribbon/element sidebar                      | Common edit commands ribbon; properties sidebar                      |
| UX-PROP-016 | Empty inspector state          | Inspector                     | Hidden                                      | No empty right rail in normal workspace                              |
| UX-PROP-017 | Pinned inspector               | Inspector pin tests           | Audit                                       | Pinned inspector can conflict with hidden-when-no-selection rule     |
| UX-PROP-018 | Monitor/source metadata        | Inspector tests               | Element sidebar                             | Selected linked/monitored element metadata                           |
| UX-PROP-019 | Duplicate type command         | Right rail type commands      | Element sidebar/resource                    | Keep reachable from selected element/type context                    |
| UX-PROP-020 | Type rename input              | Left rail/browser             | Resource/type editor                        | Move out of primary sidebar                                          |

## Full-Coverage Risk Register

| ID          | Risk                                | Why it matters                                                | Mitigation                                                                                                            |
| ----------- | ----------------------------------- | ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| UX-RISK-001 | Line count mistaken for quality     | A 1000-line tracker can still miss key behavior               | Use source coverage, screenshot coverage, and command registry coverage as criteria                                   |
| UX-RISK-002 | Legacy code mistaken for live UI    | Some components may be unused or conditionally mounted        | Future agent must verify route/state reachability before deleting                                                     |
| UX-RISK-003 | Hidden mode state missed            | Some UI appears only during active commands or selections     | Add Playwright scripts that enter representative command states                                                       |
| UX-RISK-004 | Context menus missed                | Right-click/radial menus are not visible in static screenshot | Fixed for primary browser entries with mouse and keyboard tests; wall/radial menus retain existing component coverage |
| UX-RISK-005 | Dialog trigger regressions          | Moving controls can orphan dialogs                            | Command reachability test must cover every dialog trigger                                                             |
| UX-RISK-006 | Ribbon over-pruning                 | Hiding invalid tools can accidentally remove real workflows   | Pair each removed visible command with Cmd+K entry and availability reason                                            |
| UX-RISK-007 | Secondary sidebar overload          | Moving all view controls left can create a new junk drawer    | Group by view-wide state, advanced dialogs, and progressive disclosure                                                |
| UX-RISK-008 | Footer overload                     | Advisor/jobs/sync/conflicts can crowd a small strip           | Prioritize severity and collapse low-priority readouts                                                                |
| UX-RISK-009 | Public viewer polluted              | Authoring chrome should not leak into shared presentation     | Fixed with public presentation regression proving authoring shell regions are absent                                  |
| UX-RISK-010 | Family editor ignored               | Standalone editor can remain inconsistent                     | Track as follow-up revamp after workspace shell                                                                       |
| UX-RISK-011 | Mobile/narrow layout forgotten      | Resizable sidebars and tabs can overlap                       | Fixed with narrow auto-hide, recovery, and tablet region-stability screenshots                                        |
| UX-RISK-012 | Cmd+K stale metadata                | Command palette can point users to old surfaces               | Fixed with command capability guards for canonical surfaces and universal Cmd+K fallback                              |
| UX-RISK-013 | Test IDs tied to old chrome         | Tests may pass while UI ownership is wrong                    | Add semantic ownership tests, not only presence tests                                                                 |
| UX-RISK-014 | Advisor severity not globally clear | Advisor is a core differentiator                              | Footer severity count is release blocker                                                                              |
| UX-RISK-015 | Primary sidebar collapse trap       | User explicitly called out current bad behavior               | Zero-width recovery button is release blocker                                                                         |

## Definition Of Full Coverage

The tracker should be considered full enough for implementation only when all of these are true:

- Every always-visible workspace region has an ownership contract and test row.
- Every top-level route has an explicit target treatment.
- Every active workspace mode has secondary sidebar, ribbon, canvas, element sidebar, and footer rows.
- Every persistent toolbar/dock/panel has a move, keep, redesign, or remove decision.
- Every major dialog has a canonical trigger region.
- Every command in the command registry has a canonical surface and availability reason.
- Every right-rail panel is classified as selected-element, view-wide, global/advisor, or resource management.
- Every canvas overlay is classified as spatial, transient, or misplaced persistent chrome.
- Every global status item is classified as footer, header collaboration, or modal detail.
- Screenshot coverage exists for no-selection, selected-element, active-command, dialog-open, and collapsed-sidebar states.

## Seeded Dynamic Audit Follow-Ups

These rows come from `spec/ux-bim-ai-rework-dynamic-audit.md` and should be treated as high-priority because they were confirmed in the running seeded app.

| ID          | Live finding                                                                                                       | Target owner                      | Status    | Required action                                                                             |
| ----------- | ------------------------------------------------------------------------------------------------------------------ | --------------------------------- | --------- | ------------------------------------------------------------------------------------------- |
| UX-LIVE-001 | Bare Vite without seeded API produced 500 empty states.                                                            | Testing/empty state               | Audit     | Keep as degraded-state regression, but do not use as primary UX baseline.                   |
| UX-LIVE-002 | `make seed name=target-house-3` loaded successfully, but UI label showed `Seed Library / target-house-1`.          | Project selector                  | Fixed     | Targeted seed runs now rebuild the seed project; live screenshot confirms `target-house-3`. |
| UX-LIVE-003 | Header overload persisted in every seeded mode.                                                                    | Header                            | Redesign  | Header cleanup must happen before polishing any view-specific controls.                     |
| UX-LIVE-004 | Primary sidebar contained editable levels, types, families, browser legend, and view navigation together.          | Primary/secondary/resources       | Redesign  | Split navigation from model resources and view state.                                       |
| UX-LIVE-005 | Collapsed primary sidebar showed no useful left rail content.                                                      | Primary/header                    | Redesign  | Header restore button and collapse state rules are release blockers.                        |
| UX-LIVE-006 | Generic Architecture ribbon stayed visible in sheet, schedule, agent, concept, 3D, and plan states.                | Ribbon                            | Redesign  | Build ribbon schema from active view type.                                                  |
| UX-LIVE-007 | Plan canvas retained floating palette, command dock, snap toolbar, reveal hidden, scale, and north/readout chrome. | Ribbon/secondary/footer/canvas    | Move      | Move persistent controls out of canvas, keep direct manipulation only.                      |
| UX-LIVE-008 | 3D no-selection state showed sun, scene, graphics, layers, projection, and section box in right rail.              | Secondary sidebar                 | Move      | Move all 3D view-wide state to secondary sidebar.                                           |
| UX-LIVE-009 | Selected 3D roof state showed useful element inspector plus 3D view controls in the same right rail.               | Element sidebar/secondary sidebar | Redesign  | Keep selected roof properties in element sidebar and move view controls left.               |
| UX-LIVE-010 | Sheet mode showed real sheet canvas, manifest, review toolbar, and advisor errors under generic chrome.            | Sheet secondary/ribbon/footer     | Redesign  | Sheet needs dedicated sheet ribbon, secondary setup, element sidebar, footer advisor.       |
| UX-LIVE-011 | Schedule mode showed real schedules with row/place/duplicate actions under generic chrome.                         | Schedule secondary/ribbon         | Redesign  | Schedule definition controls to secondary, row/column/table actions to schedule ribbon.     |
| UX-LIVE-012 | Agent findings appeared in agent canvas and also in right rail review content.                                     | Footer/advisor workflow           | Move      | Footer advisor count is global entry; agent mode is detailed workflow only.                 |
| UX-LIVE-013 | Active wall command showed tool modifier/options bar and status-bar command text.                                  | Ribbon modifier/footer            | Keep/Move | Preserve modifiers but attach to ribbon/options area; footer keeps active command prompt.   |
| UX-LIVE-014 | Cmd+K showed strong context grouping and badges during active command.                                             | Header Cmd+K                      | Keep      | Preserve and update command capability metadata after regions move.                         |
| UX-LIVE-015 | Activity drawer is already footer-triggered with global filters.                                                   | Footer                            | Keep      | Use as pattern for jobs/advisor/conflicts if density stays controlled.                      |
