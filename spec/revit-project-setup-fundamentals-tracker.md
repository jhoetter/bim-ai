# Revit Project Setup Fundamentals Tracker

Date: 2026-05-14

Scope: official Autodesk/Revit project setup, model datum, and standards workflows that sit before or underneath day-to-day modeling and view authoring. This is intentionally different from the older course-derived parity tracker in `spec/archive/revit-parity/`, which mostly verifies that many visible Revit tools exist somewhere in bim-ai.

## Executive Summary

The product is not missing the concept of floors/levels entirely. Levels are first-class elements (`level`), with absolute elevation, optional parent/offset datum chains, automatic plan-view creation, validation, propagation evidence, plan/elevation rendering, and a small `LevelStack` UI. In that narrow sense, "how many floors are there and how high are they?" is supported.

The real gap is product framing. Revit exposes project setup as a coherent workflow: choose a template, enter project information, define positioning, create phases, establish levels/grids, configure project units and standards, then derive views/sheets/schedules from that foundation. In bim-ai, those pieces are scattered across the project menu, left rail, inspector, options bar, command palette, and hidden/selected-element panels. Some are only model primitives or backend commands. A user looking for "basic project setup" will not know where to go.

Recommended direction: add a first-class **Project Setup** workspace/panel that acts as a setup cockpit. It should expose Level/Storey Setup, Grids, Units, Location/Coordinates/North, Project Info, Phases, Templates/Standards, View Defaults, Links, and Collaboration in one place. This does not replace direct Revit-like authoring; it organizes the already-present primitives into the mental model users expect at project start.

Highest priority gaps:

1. P0: Project Setup entry point and setup checklist.
2. P0: Storey/Level table with count, floor-to-floor heights, batch add/remove, rename, plan-view creation, and wall/top constraint propagation preview.
3. P0: Project Info and Project Units dialog, not just internal mm storage.
4. P0: Positioning dialog: geographic location, Project Base Point, Survey Point, Project North/True North, sun settings, and link alignment in one coherent surface.
5. P1: Phasing manager with ordered phases and phase filters, instead of mostly backend/project-browser visibility.
6. P1: Project standards manager for object styles, line styles, fill patterns, materials, hatch patterns, snaps, detail levels, and view defaults.
7. P1: Template story: new project from residential/commercial/discipline template, plus "save as template" semantics.

## Research Sources

Official Autodesk sources reviewed:

- Set Up the Project: https://help.autodesk.com/cloudhelp/2025/ENU/Revit-GetStarted/files/GUID-C30F8961-0128-4F66-AA4D-CD21ABA51776.htm
- Project Templates: https://help.autodesk.com/cloudhelp/2026/ENU/RevitLT-Customize/files/GUID-4C16B54A-7ADA-4DEB-A278-C199B1BC4207.htm
- Project Template Settings: https://help.autodesk.com/cloudhelp/2022/ENU/Revit-Customize/files/GUID-C63C8425-A2A6-4318-BF84-EE3E67029EC3.htm
- Create a Project Template: https://help.autodesk.com/cloudhelp/2025/ENU/Revit-Customize/files/GUID-601F73FA-D583-48F7-B4DE-C2CA5E791A8E.htm
- Project Settings: https://help.autodesk.com/cloudhelp/2022/ENU/Revit-Customize/files/GUID-134DDCEF-0E61-4EA1-B606-530BE7409AA6.htm
- Set Project Units: https://help.autodesk.com/cloudhelp/2024/ENU/RevitLT-Customize/files/GUID-3128F39D-34A3-4D09-A5BC-86C8D7300895.htm
- Add Levels and Grids: https://help.autodesk.com/cloudhelp/2026/ENU/Revit-GetStarted/files/GUID-472CE975-AEFC-48A1-8722-E7357F80B90C.htm
- About Levels: https://help.autodesk.com/cloudhelp/2023/ENU/Revit-Model/files/GUID-10A920FD-1A4C-457B-8827-D36AD7EA2D23.htm
- Add Grids: https://help.autodesk.com/cloudhelp/2024/ENU/Revit-Model/files/GUID-9BCDC86A-A211-41CA-88C2-99B654472690.htm
- Grids: https://help.autodesk.com/cloudhelp/2025/ENU/RevitLT-Model/files/GUID-DBD917DB-B9F6-417B-B799-5F412A624EB4.htm
- About Plan Views: https://help.autodesk.com/cloudhelp/2025/ENU/Revit-DocumentPresent/files/GUID-D14C26D1-0BE6-41E4-A4CC-870459A0819B.htm
- Create a Plan View: https://help.autodesk.com/cloudhelp/2022/ENU/Revit-DocumentPresent/files/GUID-3FE4DAED-82D8-4C56-A017-737BDA740E50.htm
- View Range Properties: https://help.autodesk.com/cloudhelp/2025/ENU/RevitLT-DocumentPresent/files/GUID-D5545CBE-822F-4A55-820E-6813AAA63888.htm
- View Properties: https://help.autodesk.com/cloudhelp/2025/ENU/Revit-DocumentPresent/files/GUID-8BEBCEF0-CE2C-4635-8C7C-9D03503C0B79.htm
- View Templates: https://help.autodesk.com/cloudhelp/2026/ENU/Revit-HaveYouTried/files/GUID-DD1AF833-EAA0-4C91-8CF3-EA8BB8B5C3D5.htm
- About View Types: https://help.autodesk.com/cloudhelp/2023/ENU/Revit-DocumentPresent/files/GUID-23418A27-8135-40C7-8078-233FA0B8526B.htm
- Visibility and Graphic Display in Project Views: https://help.autodesk.com/cloudhelp/2025/ENU/Revit-DocumentPresent/files/GUID-A2FC119B-51D7-4C2E-84ED-CD51983EC532.htm
- Object Styles: https://help.autodesk.com/cloudhelp/2024/ENU/Revit-Customize/files/GUID-01DE5723-A5DD-41FE-B7C7-3C9B37B5C8C2.htm
- Line Styles: https://help.autodesk.com/cloudhelp/2024/ENU/Revit-Customize/files/GUID-A4E8ACE9-F03A-487C-9C25-8C41DBBBB450.htm
- Fill Patterns: https://help.autodesk.com/cloudhelp/2024/ENU/Revit-Customize/files/GUID-BC72C8DB-D7B5-425B-B124-998BF0128A59.htm
- About Fill Patterns: https://help.autodesk.com/cloudhelp/2023/ENU/Revit-Customize/files/GUID-95901FEE-A18F-4345-B9D0-6C1E939C7D8B.htm
- About Positioning: https://help.autodesk.com/cloudhelp/2022/ENU/Revit-Model/files/GUID-9DD9DCDB-F80F-4FCE-BA87-FE49B66936CF.htm
- Positioning: https://help.autodesk.com/cloudhelp/2024/ENU/Revit-Model/files/GUID-D5CF2C0C-FFC9-4D2C-BE3F-B85D8EC4AE9D.htm
- Project Base Points and Survey Points: https://help.autodesk.com/cloudhelp/2017/ENU/RevitLT-Model/files/GUID-68611F67-ED48-4659-9C3B-59C5024CE5F2.htm
- Define the Project Base Point: https://help.autodesk.com/cloudhelp/2024/ENU/Revit-Model/files/GUID-30D76259-CC67-4498-B06B-91F7517F9B65.htm
- About Project North and True North: https://help.autodesk.com/cloudhelp/2026/ENU/Revit-Model/files/GUID-ED5BC6E5-0B9D-477C-8F08-692A44E28646.htm
- Creating Phases: https://help.autodesk.com/cloudhelp/2014/ENU/Revit/files/GUID-046BA65B-9C09-49A5-A15F-E07F1913C676.htm
- Apply a Phase Filter: https://help.autodesk.com/cloudhelp/2026/ENU/RevitLT-DocumentPresent/files/GUID-05ED6E8E-DE1D-4B3C-B180-AA65DD2ACC03.htm
- Phase Filters: https://help.autodesk.com/cloudhelp/2023/ENU/Revit-DocumentPresent/files/GUID-FE4C8D4D-F51D-486F-81E9-53A530E833A2.htm
- Design Options: https://help.autodesk.com/cloudhelp/2022/ENU/Revit-Model/files/GUID-D48B1E7E-BC34-414E-85BD-790F199BB2C0.htm
- Workflow: Design Options: https://help.autodesk.com/cloudhelp/2026/ENU/Revit-Model/files/GUID-D6D4E961-8E43-498D-8405-EDE3BB11A4BD.htm
- Managing Links: https://help.autodesk.com/cloudhelp/2023/ENU/Revit-Collaborate/files/GUID-C7094D06-D4C5-4CCB-8E7B-5C8188EC3272.htm
- Default Worksets: https://help.autodesk.com/cloudhelp/2022/ENU/Revit-Collaborate/files/GUID-559664E7-9232-448A-A5AD-60F1B4E70636.htm
- Project Parameters: https://help.autodesk.com/cloudhelp/2024/ENU/Revit-Model/files/GUID-24033B80-62D4-4E04-AC15-FA8A6194A64F.htm
- Shared Parameters: https://help.autodesk.com/cloudhelp/2024/ENU/Revit-Model/files/GUID-E7D12B71-C50D-46D8-886B-8E0C2B285988.htm

## Local Coverage Evidence

Relevant local files observed:

- `packages/core/src/index.ts`: first-class `project_settings`, `level`, `grid_line`, `plan_view`, `view_template`, `project_base_point`, `survey_point`, `phase`, `shared_param_file`, `project_param`, and `hatch_pattern_def` element types.
- `app/bim_ai/commands.py`: `createLevel`, `createGridLine`, project/survey point commands, sun settings commands, phasing commands, view template commands, and plan view commands.
- `app/bim_ai/datum_levels.py`: parent/offset datum graph propagation.
- `app/tests/test_level_datum_chain.py`: validation and propagation coverage for dependent level elevation chains and wall constraint tracking.
- `packages/web/src/levels/LevelStack.tsx`: compact level list with add, select, rename, elevation edit, and create-plan button.
- `packages/web/src/workspace/authoring/LevelDatumStackWorkbench.tsx`: selected-level read-only datum stack and propagation evidence.
- `packages/web/src/workspace/inspector/InspectorContent.tsx`: plan view properties, view range, crop, templates, phase filter, project point inspector, workset readouts.
- `packages/web/src/workspace/project/ProjectMenu.tsx`: snapshots, save-as backups, material resources, link/import DXF/IFC, DXF positioning and units.
- `packages/web/src/workspace/project/ProjectBrowser.tsx`: views, view templates, links/imports, phases.
- `packages/web/src/workspace/project/VVDialog.tsx`: visibility/graphics category controls.
- `packages/web/src/workspace/authoring/SiteAuthoringPanel.tsx`: site boundary/context and a north-angle field.
- `packages/web/src/workspace/inspector/SunInspectorPanel.tsx` and `app/api/schemas/sun_settings.json`: sun/geographic inputs.
- `docs/collaboration-model.md`: explicit non-Revit worksharing model; no user-managed worksets.

## Product Fit

Use Revit vocabulary where it makes project setup discoverable, but keep bim-ai primitives simpler:

- "Levels" should stay first-class, but add a "Storeys" setup affordance for non-Revit users. A storey is a named level interval; a Revit user can still see level datums.
- "Layers" should not be the primary term for floors. In Revit, "levels" define floors/storeys; "layers" usually refers to wall/floor/roof compound assemblies or imported CAD layer visibility.
- "Project Setup" should be a task workspace, not only a left-rail row. It is a multi-step operation: template -> info -> units -> levels/grids -> coordinates/north -> phases -> standards -> view defaults.
- Worksets should remain intentionally de-emphasized unless enterprise customers need Revit import/export parity. Our collaboration model already replaces checkout/sync rituals with server-ordered commands.

## Tracker

| ID      | Area                             | Revit setup expectation                                                                             | Current bim-ai coverage                                                                                                                                           | Gap / recommendation                                                                                              | Priority       |
| ------- | -------------------------------- | --------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | -------------- |
| PSU-001 | Setup cockpit                    | Revit "Set Up the Project" starts with create project, project info, positioning, and phases.       | No unified setup surface; capabilities are scattered.                                                                                                             | Add `Project Setup` workspace/panel with checklist and completion state.                                          | P0             |
| PSU-002 | Setup checklist                  | Users can understand what must be configured before modeling.                                       | No explicit checklist.                                                                                                                                            | Checklist: Template, Info, Units, Levels, Grids, Positioning, Phases, View Defaults, Links, Standards.            | P0             |
| PSU-003 | New project template             | Revit creates projects from discipline/project templates.                                           | Server loads `app/bim_ai/templates/residential-eu.json`; project menu has seeded models.                                                                          | Add visible template picker for residential, commercial, structural, MEP, blank metric/imperial.                  | P1             |
| PSU-004 | Save as template                 | Revit can create reusable project templates with settings/views/families.                           | Snapshot save/restore exists; no project-template authoring concept.                                                                                              | Add "Save current setup as template" storing settings, standards, levels, views, families, sheets.                | P2             |
| PSU-005 | Template settings inventory      | Templates include units, patterns, line styles, view templates, families, views, sheets, params.    | Many elements exist independently.                                                                                                                                | Define a canonical `project_template` bundle contract and coverage manifest.                                      | P1             |
| PSU-006 | Project information              | Revit project info includes project name, number, client, address, status, etc.                     | `project_settings` has `name`, units, starting view, retention, room computations. Titleblock code references projectNumber, but no broad project info UI/schema. | Add project info schema and inspector/dialog; bind title blocks and exports.                                      | P0             |
| PSU-007 | Project address/location         | Revit setup asks for project address/geographic location.                                           | Site and sun settings carry some location inputs; no project address record.                                                                                      | Add address, latitude/longitude, timezone, geocode confidence.                                                    | P1             |
| PSU-008 | Project units                    | Revit has Project Units by discipline, unit type, rounding, symbols.                                | Internal mm; DXF import units; inspector local unit cycling; `project_settings.lengthUnit` only.                                                                  | Add Project Units dialog: length, area, volume, angle, slope, currency? include rounding/symbol/locale.           | P0             |
| PSU-009 | Unit display consistency         | Revit units affect display, dimensions, schedules, printouts.                                       | Mixed mm labels and local input conversions.                                                                                                                      | Route dimensions, inspector fields, schedules, sheets through project unit display settings.                      | P1             |
| PSU-010 | Snapping settings                | Revit templates/settings include snaps.                                                             | `SnapSettingsToolbar` and localStorage settings exist.                                                                                                            | Promote snap settings into project/template settings, not only browser-local state.                               | P2             |
| PSU-011 | Temporary dimension settings     | Revit project settings include temporary dimension preferences.                                     | Temporary/helper dimensions exist, but no project-level temp dimension settings.                                                                                  | Add temp-dimension target preference and persistence.                                                             | P2             |
| PSU-012 | Detail level defaults            | Revit project settings define detail levels by view scale.                                          | Views/templates have detail level; no project-default mapping by scale.                                                                                           | Add project standards table: scale ranges -> coarse/medium/fine.                                                  | P2             |
| PSU-013 | Levels as story datums           | Revit creates one level per known story or reference plane.                                         | Strong model support: `level` with elevation, name, parent/offset, plan count, propagation.                                                                       | Keep; make it more discoverable and batch editable.                                                               | Done/P0 UX     |
| PSU-014 | Storey count                     | User expects "number of floors/storeys" setup.                                                      | No direct "number of floors" wizard; users add individual levels.                                                                                                 | Add Storey Setup wizard: count, ground elevation, typical floor-to-floor height, roof/parapet levels.             | P0             |
| PSU-015 | Floor-to-floor heights           | Revit levels imply vertical spacing; users edit elevations.                                         | Elevation editable in `LevelStack`; parent/offset chain in backend/readout.                                                                                       | Add tabular "height above previous" editing and preview dependent changes.                                        | P0             |
| PSU-016 | Batch level creation             | Revit can create levels in elevation/section; templates can predefine them.                         | Single plus creates next level; command supports one level.                                                                                                       | Add batch add/remove and duplicate levels with associated plan views.                                             | P1             |
| PSU-017 | Level naming conventions         | Revit plans and levels are named/renamed with relationship prompts.                                 | Level rename and view rename separate; no rename-linked-plan prompt.                                                                                              | Add "rename associated views?" flow or batch naming rules.                                                        | P2             |
| PSU-018 | Level deletion                   | Revit deletion impacts hosted views/elements.                                                       | Generic delete exists; not clear if level-specific warnings are surfaced.                                                                                         | Add level deletion impact preview: hosted elements, plans, sections, dimensions, constraints.                     | P1             |
| PSU-019 | Associated plan views            | Revit can create plan views automatically when levels are added.                                    | `createLevel.alsoCreatePlanView`; level row plus plan view creation.                                                                                              | In setup table expose per-level plan/RCP/structural plan checkboxes.                                              | P1             |
| PSU-020 | RCP/structural plans             | Revit can auto-create floor, reflected ceiling, structural plans per level.                         | Plan subtype supports floor/area/lighting/power/coordination; no explicit RCP subtype found.                                                                      | Add reflected ceiling plan and structural plan creation defaults if target workflows need them.                   | P1             |
| PSU-021 | View range                       | Revit plan view range has top, cut, bottom, view depth tied to levels/offsets.                      | `viewRangeBottomMm`, `viewRangeTopMm`, `cutPlaneOffsetMm` as raw mm.                                                                                              | Upgrade to Revit-like level+offset controls, including View Depth.                                                | P1             |
| PSU-022 | Level datum visibility           | Revit level datums show in elevations/sections and can have extents.                                | Section/elevation datum rendering and plan badge exist.                                                                                                           | Add datum extents/2D-3D extents controls if documentation quality requires it.                                    | P2             |
| PSU-023 | Grids                            | Revit grids organize layout and structure, with labels, arcs/multi-segment, extents.                | `grid_line` and grid tool exist; label/start/end/level optional.                                                                                                  | Add grid setup table/spacing generator, bubble controls, multi-segment/arcs, and datum extents.                   | P1             |
| PSU-024 | Grid system                      | Revit users often create A/B/C and 1/2/3 grids early.                                               | Individual grid lines; no grid-system wizard found.                                                                                                               | Add rectangular grid wizard: axes, spacing, labels, offsets, extents.                                             | P1             |
| PSU-025 | Reference planes                 | Revit uses reference planes for setup and families.                                                 | `reference_plane` exists in project and family contexts.                                                                                                          | Include reference-plane visibility and naming in setup standards.                                                 | P2             |
| PSU-026 | Project Base Point               | Revit project base point sets local coordinate reference.                                           | `project_base_point` exists; commands and inspector for x/y/clipped; angle rendered in 3D markers.                                                                | Add setup UI for create/move/angle/elevation and relation to Project North/True North.                            | P0             |
| PSU-027 | Survey Point                     | Revit survey point ties to real-world coordinates/shared coords.                                    | `survey_point` exists; inspector x/y/clipped and shared elevation read-only.                                                                                      | Add editable shared elevation, northing/easting semantics, import/export readout.                                 | P1             |
| PSU-028 | Internal origin                  | Revit has an internal origin.                                                                       | `internal_origin` element kind exists.                                                                                                                            | Expose read-only origin in Positioning setup and diagnostics.                                                     | P2             |
| PSU-029 | Project North                    | Revit Project North aligns building axes/sheets.                                                    | Site authoring has `northDegCwFromPlanX`; project base point has angle to True North.                                                                             | Clarify one canonical model orientation field and expose per-view orientation.                                    | P0             |
| PSU-030 | True North                       | Revit True North supports site, sun, energy, rendering.                                             | Sun settings have lat/lon/date/time; base-point angle exists.                                                                                                     | Connect True North to sun/rendering/link alignment and show it in setup.                                          | P0             |
| PSU-031 | Geographic location              | Revit location dialog sets real-world location.                                                     | Sun settings likely hold lat/lon; site panel has context.                                                                                                         | Add Geographic Location panel: lat/lon, address, timezone, elevation, north strategy.                             | P1             |
| PSU-032 | Link positioning                 | Revit link/import options include positioning and shared coordinates.                               | DXF options include origin, project origin, shared coords, units, color; Manage Links exists.                                                                     | Surface link alignment inside Project Setup Positioning and flag missing base/survey points.                      | P1             |
| PSU-033 | Manage links                     | Revit Manage Links handles Revit/IFC/CAD/DWF/point clouds/PDF/images.                               | Manage Links supports model, DXF, IFC paths/metadata; PDF/images/point-cloud not obviously general.                                                               | Track link formats and status in setup checklist.                                                                 | P2             |
| PSU-034 | Project phases                   | Revit default phases include Existing and New; additional phases can be added.                      | `phase` element and backend phase commands exist; Project Browser lists phases.                                                                                   | Add Phases manager UI with ordered table, create/rename/delete/reorder.                                           | P1             |
| PSU-035 | Phase immutability/order         | Revit warns about phase ordering; order drives status.                                              | Backend has `ord`; reorder command exists.                                                                                                                        | UI must explain downstream effect and block destructive reorder mistakes.                                         | P2             |
| PSU-036 | Element phase created/demolished | Revit elements store Phase Created and Phase Demolished.                                            | Many elements carry `phaseCreated` and `phaseDemolished`; backend set commands exist.                                                                             | Add inspector fields and batch assign UI for selected elements.                                                   | P1             |
| PSU-037 | Phase filters                    | Revit phase filters are view rules for New/Existing/Demolished/Temporary.                           | `PhaseFilter` enum is simplified: all/existing/demolition/new; plan inspector/dropdown has it.                                                                    | Add custom phase-filter rules and graphics overrides if documentation parity needed.                              | P1             |
| PSU-038 | Phase graphics                   | Revit phase graphic overrides style existing/demolished/temp elements.                              | Phase visibility exists; broad graphics controls exist separately.                                                                                                | Add phase graphics table or map phase statuses into view templates/VG.                                            | P2             |
| PSU-039 | View templates                   | Revit view templates enforce view consistency.                                                      | Strong coverage: `view_template`, Project Browser, create/duplicate/apply/edit, control matrix.                                                                   | Include default view-template assignment in setup wizard.                                                         | Done/P1 UX     |
| PSU-040 | View types                       | Revit view types can apply templates to new views.                                                  | Plan subtypes and default template associations exist in older tracker.                                                                                           | Add setup table for default template by view type/subtype/discipline.                                             | P1             |
| PSU-041 | Browser organization             | Revit Project Browser groups by discipline/type/phase/custom schemes.                               | Project Browser groups by discipline/subdiscipline/type/phase when metadata exists.                                                                               | Add explicit browser organization settings if large projects need custom schemes.                                 | P2             |
| PSU-042 | Project views                    | Revit templates predefine plans, schedules, legends, sheets.                                        | Views/schedules/sheets exist; seed models include some.                                                                                                           | Project Setup should show generated documentation set completeness.                                               | P1             |
| PSU-043 | Sheets/titleblocks               | Revit templates often include sheets/titleblocks.                                                   | Sheet/titleblock elements exist.                                                                                                                                  | Add template-driven sheet package selection.                                                                      | P2             |
| PSU-044 | Schedules                        | Revit templates can predefine schedules/view lists/sheet lists.                                     | Schedules exist with field registry and sheet placement.                                                                                                          | Add setup-generated default schedules by project type.                                                            | P2             |
| PSU-045 | Object styles                    | Revit project Object Styles define category line weights/colors/patterns/materials.                 | VV/VG category controls and material systems exist; no single project-level Object Styles manager found.                                                          | Add Object Styles manager and cascade: project -> view template -> view override -> element override.             | P1             |
| PSU-046 | Line styles                      | Revit project line styles include name, weight, color, pattern.                                     | Detail lines have style; no project line-style catalog found.                                                                                                     | Add line style catalog and bind annotations/detail lines/reference planes.                                        | P2             |
| PSU-047 | Line weights                     | Revit line weights define pen widths by scale.                                                      | Plan category graphics has line weights; no project-wide line weight table.                                                                                       | Add line-weight standards table per scale.                                                                        | P2             |
| PSU-048 | Line patterns                    | Revit line patterns are reusable dash/dot definitions.                                              | Some style literals exist.                                                                                                                                        | Add named line pattern definitions.                                                                               | P2             |
| PSU-049 | Fill/hatch patterns              | Revit fill patterns can be model/drafting and material graphics.                                    | `hatch_pattern_def` exists; hatch renderer and material graphics tracker exist.                                                                                   | Add Fill Patterns manager with model/drafting distinction and import/export.                                      | P1             |
| PSU-050 | Materials                        | Revit templates include materials and material graphics.                                            | Strong material browser/appearance work exists in material tracker.                                                                                               | Include material standards in Project Setup but avoid duplicating the full browser.                               | Done/P1 UX     |
| PSU-051 | Compound assemblies              | Revit walls/floors/roofs have layered type structures.                                              | Wall/floor/roof types with layers exist; material layer workbench exists.                                                                                         | Ensure "layers" language routes to compound assembly editor, not floor count.                                     | P1             |
| PSU-052 | Project parameters               | Revit project parameters attach project-specific fields to categories.                              | `project_param` and `shared_param_file` element kinds exist.                                                                                                      | Add project parameter manager UI and category binding editor.                                                     | P1             |
| PSU-053 | Shared parameters                | Revit shared parameter file enables reusable/taggable/schedulable params.                           | `shared_param_file` kind exists; exact UI unclear.                                                                                                                | Add shared parameter import/assignment workflow.                                                                  | P2             |
| PSU-054 | Families                         | Revit templates can preload system and component families.                                          | Family library/editor/assets exist.                                                                                                                               | Add template preload and required-family checklist.                                                               | P2             |
| PSU-055 | Annotation styles                | Revit project settings include text/dimension/tag styles.                                           | Tags/dimensions exist; plan tag styles exist.                                                                                                                     | Add annotation standards manager for dimensions, text, tags, leaders.                                             | P2             |
| PSU-056 | Print settings                   | Revit templates may define print settings.                                                          | PDF/sheet export exists; no broad print settings manager found.                                                                                                   | Add print/export presets when documentation matures.                                                              | P3             |
| PSU-057 | Worksharing/worksets             | Revit worksharing creates user worksets, family/view/project standards worksets.                    | `worksetId` fields and workset icons/readouts exist; docs explicitly replace worksets with server-ordered collaboration.                                          | Keep not-a-primary-workflow; add "Revit compatibility/worksets" readout only if exchange requires it.             | Intentional/P2 |
| PSU-058 | Synchronize/reload/latest        | Revit has central/local sync rituals.                                                               | `docs/collaboration-model.md` explains no sync rituals; realtime command log.                                                                                     | Add onboarding note in Project Setup collaboration section.                                                       | P2             |
| PSU-059 | Design options                   | Revit supports option sets, primary/secondary options, dedicated views, acceptance into main model. | Document-level `designOptionSets`; agent proposal paths use options; plan views have option locks.                                                                | Add design options manager UI if design-alternative workflow is product target.                                   | P1             |
| PSU-060 | Option visibility per view       | Revit dedicated views display options.                                                              | `optionLocks` on plan views.                                                                                                                                      | Expose in view/setup UI with option set/option selectors.                                                         | P1             |
| PSU-061 | Rooms/areas setup                | Revit area/volume computations and area schemes are project setup items.                            | Area/volume computations in OptionsBar and inspector; area schemes on plan views.                                                                                 | Move area/volume settings into Project Setup while preserving tool-local access.                                  | P1             |
| PSU-062 | Site setup                       | Revit setup includes site, topo, property lines, location.                                          | Site/toposolid/property lines and site panel exist.                                                                                                               | Fold site setup into Positioning/Site step: property line, topo, north, location.                                 | P1             |
| PSU-063 | Sun/solar settings               | Revit True North/geographic location impacts sun and rendering.                                     | Sun singleton, NOAA calculation, 3D scene controls exist.                                                                                                         | Connect setup location/north to sun settings and warn when inconsistent.                                          | P1             |
| PSU-064 | View orientation                 | Revit plan views can orient to Project North or True North.                                         | View orientation beyond camera/view cube not clearly exposed for plan views.                                                                                      | Add plan view orientation property: Project North / True North / custom rotation.                                 | P2             |
| PSU-065 | Scope boxes                      | Revit views can bind crop to scope boxes.                                                           | Plan crop exists; no scope box element found.                                                                                                                     | Add scope boxes for multi-view crop consistency.                                                                  | P2             |
| PSU-066 | Starting view                    | Revit templates can specify starting view.                                                          | `project_settings.startingViewId` exists.                                                                                                                         | Add setup control for starting view.                                                                              | P2             |
| PSU-067 | Standards transfer               | Revit can transfer project standards between projects.                                              | Material/template/snapshot capabilities exist; no standards transfer dialog found.                                                                                | Add Import Standards from project/template: units, styles, materials, view templates, parameters.                 | P2             |
| PSU-068 | Purge unused                     | Revit project cleanup includes purge unused.                                                        | PurgeUnusedPanel exists.                                                                                                                                          | Include cleanup in Project Setup/Standards maintenance.                                                           | P3             |
| PSU-069 | Model health after setup         | Revit users validate setup through views/constraints.                                               | Advisor/violations/evidence exist.                                                                                                                                | Add setup validation group: missing levels, no plan per level, no base point, no units, no phases.                | P0             |
| PSU-070 | AI/project brief bridge          | bim-ai should infer setup from sketch/brief.                                                        | Sketch-to-BIM seeds levels/elements; agent commands can create levels.                                                                                            | Add "Extract setup from brief/sketch" step producing editable levels, units, site, phases before geometry commit. | P0             |

## Proposed Project Setup Workspace

The first implementation should be mostly orchestration around existing data, not a new modeling engine.

### Tab 1: Project

- Project name, number, client, address, status.
- Template source and discipline.
- Starting view.
- Save-as backup retention.
- Export defaults.

### Tab 2: Units

- Length, area, volume, angle, slope display.
- Rounding and symbol settings.
- Locale/digit grouping.
- Default dimension display.

### Tab 3: Levels / Storeys

- Table columns: level name, absolute elevation, height above previous, parent level, offset, associated plan/RCP/structural/area views, hosted element count.
- Actions: add one, batch generate, duplicate, rename with associated views, delete with impact preview.
- Defaults: typical floor-to-floor height, wall default height/top constraint, roof/parapet reference.

### Tab 4: Grids

- Grid wizard: X/Y axes, count, spacing, start label, extents.
- Existing grid table with label, length, level/scope, pinned, bubble ends.
- Future: arcs/multi-segment, scope extents.

### Tab 5: Positioning / Site

- Internal origin readout.
- Project Base Point: E/W, N/S, elevation, angle to True North, clipped/pinned.
- Survey Point: coordinates, shared elevation, clipped/pinned.
- Geographic location: address, lat/lon, timezone.
- Project North and True North strategy.
- Site boundary/property/toposolid overview.
- Link alignment diagnostics.

### Tab 6: Phases

- Ordered phase table.
- Existing/New default creation status.
- Element phase assignment summary.
- Phase filter table and graphics overrides.
- Warnings for demolished-before-created or missing view phase.

### Tab 7: Views / Documentation Defaults

- Default plan/RCP/structural/area view per level.
- View type -> default template mapping.
- View range defaults by view type.
- Browser organization.
- Starting sheets and schedules.

### Tab 8: Standards

- Object styles.
- Line styles/weights/patterns.
- Fill/hatch patterns.
- Materials and material graphics.
- Annotation/dimension/tag styles.
- Project/shared parameters.
- Transfer standards/import from template.

### Tab 9: Collaboration / Exchange

- Explain no local/central sync ritual in bim-ai.
- Revit compatibility workset mapping if present.
- Manage Links summary.
- IFC/DXF link unit/position health.

## Acceptance Criteria For P0 Slice

1. A user can open a visible Project Setup entry from the primary navigation, command palette, and project menu.
2. The setup panel summarizes whether the project has project info, units, at least one level, plan views for levels, at least one grid system, base/survey points, north/location, and default phases.
3. A user can set "3 floors, 3000 mm floor-to-floor, roof at 9000 mm" in one flow and see three levels plus associated plan views.
4. Editing a floor-to-floor height previews dependent level moves and constrained wall height effects before commit.
5. Project units change display labels in the setup panel and at least one inspector/dimension readout.
6. Positioning UI shows Project Base Point, Survey Point, Project North, True North, and sun/location values together.
7. Setup validation creates typed advisories for missing setup fundamentals.
8. The implementation reuses existing commands where available and adds only missing command/UI surfaces.

## Missing Implementation Specs

These are the concrete build specs still open after the first setup-cockpit slice. They turn the tracker above into implementation-sized work.

| ID           | Spec                                    | User outcome                                                                                                                       | Backing model/commands                                                       | Status      |
| ------------ | --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ----------- |
| PSU-SPEC-001 | Project Setup shell                     | Open one setup surface from Cmd-K, primary project navigation, and Project menu.                                                   | `project.open-settings`, `ProjectMenu`, `Workspace` modal state.             | Implemented |
| PSU-SPEC-002 | Setup health checklist                  | See project info, units, levels, grids, positioning, location/sun, phases, links, templates, and standards readiness.              | Derived from `elementsById`.                                                 | Partial     |
| PSU-SPEC-003 | Editable project information            | Edit name, number, client, address, status.                                                                                        | `project_settings`, `upsertProjectSettings`, `updateElementProperty`.        | Implemented |
| PSU-SPEC-004 | Basic project units                     | Edit length unit, angle unit, display locale.                                                                                      | `project_settings.lengthUnit`, `angularUnitDeg`, `displayLocale`.            | Partial     |
| PSU-SPEC-005 | Full Revit-style unit formats           | Configure area, volume, slope, rounding, symbols, digit grouping, discipline unit groups.                                          | Needs expanded `project_settings` schema and display-format service.         | Open        |
| PSU-SPEC-006 | Storey generator                        | Create N storeys from base elevation, typical floor-to-floor height, and name prefix.                                              | `createLevel`, `moveLevelElevation`, `upsertPlanView`.                       | Implemented |
| PSU-SPEC-007 | Editable level schedule                 | Edit each level name, absolute elevation, and height above previous level inline.                                                  | `updateElementProperty`, `moveLevelElevation`, `upsertPlanView`.             | Implemented |
| PSU-SPEC-008 | Level deletion impact preview           | Before deleting a level, show hosted elements, constrained walls, views, dimensions, and references.                               | Needs level dependency query/advisory helper.                                | Open        |
| PSU-SPEC-009 | Associated view controls per level      | Choose floor plan, RCP, structural plan, area plan per level.                                                                      | `upsertPlanView`, plan subtype expansion.                                    | Open        |
| PSU-SPEC-010 | Wall/top constraint propagation preview | Show which walls/hosted elements move before level elevation commit.                                                               | Existing datum propagation evidence plus setup preview UI.                   | Open        |
| PSU-SPEC-011 | Grid system wizard                      | Generate rectangular grid systems with X/Y counts, spacing, origin, extents, numeric and alphabetic labels.                        | `createGridLine`.                                                            | Implemented |
| PSU-SPEC-012 | Grid schedule editor                    | Edit grid labels, endpoints, extents, pinned state, and level scope.                                                               | `moveGridLineEndpoints`, `updateElementProperty` extensions.                 | Open        |
| PSU-SPEC-013 | Project Base Point setup                | Create/update local base point and true north angle.                                                                               | `createProjectBasePoint`, `rotateProjectBasePoint`, `updateElementProperty`. | Implemented |
| PSU-SPEC-014 | Survey Point setup                      | Create/update survey point and shared elevation.                                                                                   | `createSurveyPoint`, `moveSurveyPoint`.                                      | Implemented |
| PSU-SPEC-015 | Location and sun setup                  | Create/update latitude, longitude, date, time, and daylight saving strategy from Project Setup.                                    | `createSunSettings`, `updateSunSettings`.                                    | Implemented |
| PSU-SPEC-016 | Geographic address and timezone         | Store address-geocode data, timezone, project elevation, confidence, and source.                                                   | Needs schema beyond current sun settings.                                    | Open        |
| PSU-SPEC-017 | Link positioning diagnostics            | Flag links/imports whose position mode conflicts with missing base/survey/shared coordinates.                                      | Link elements plus setup validator.                                          | Open        |
| PSU-SPEC-018 | Default phase bootstrap                 | Create default Revit-like phases when missing.                                                                                     | `createPhase`.                                                               | Implemented |
| PSU-SPEC-019 | Phase manager table                     | Rename/reorder/delete phases with downstream warnings.                                                                             | `renamePhase`, `reorderPhase`, `deletePhase`.                                | Open        |
| PSU-SPEC-020 | View phase defaults                     | Assign new/existing phases and phase filters to plan views and templates.                                                          | `setViewPhase`, `setViewPhaseFilter`, view template updates.                 | Open        |
| PSU-SPEC-021 | Template picker                         | Start from blank/residential/commercial/structural/MEP templates.                                                                  | Template bundle registry.                                                    | Open        |
| PSU-SPEC-022 | Save current setup as template          | Persist project info, units, levels, grids, phases, standards, views, sheets, and families into a reusable template.               | Needs `project_template` bundle contract.                                    | Open        |
| PSU-SPEC-023 | Standards overview                      | Show object styles, line styles, fill patterns, materials, annotation styles, parameters, and view templates as project standards. | Existing element catalogs plus missing managers.                             | Partial     |
| PSU-SPEC-024 | Standards editors                       | Edit object styles, line styles/weights/patterns, fill patterns, annotation styles, project/shared parameters.                     | Needs dedicated project standard commands/UI.                                | Open        |
| PSU-SPEC-025 | Setup advisories                        | Emit typed model-health findings for missing setup fundamentals.                                                                   | Existing advisor framework plus setup rules.                                 | Open        |
| PSU-SPEC-026 | AI setup extraction                     | Parse project brief/sketch into editable units, levels, grids, site, phases before geometry commit.                                | Agent proposal pipeline.                                                     | Open        |

## Product Answer To The Original Question

Where do we define how many floors/layers there are today?

- Floors/storeys are represented by `level` elements, not "layers".
- Individual floor slabs are `floor` elements.
- Wall/floor/roof physical layers are type-layer stacks (`wall_type`, `floor_type`, `roof_type`).
- The user-visible place to define levels today is the small Levels panel and selected-level datum workbench, but that is too hidden and too low-level for project setup.

So the product is not fundamentally missing Revit's datum model, but it is missing the top-level project setup workflow that makes the datum model obvious, batch-editable, and connected to units, grids, coordinates, phases, and view defaults.
