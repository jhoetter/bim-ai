# Revit Parity Tracker

Source: "The Complete Revit 2026 Course for Architectural Design" — 6-hour recorded session analyzed at timestamp level.
Screenshots: `/Users/jhoetter/Desktop/Revit Specs/` (local only, not committed to git).
Last updated: 2026-05-09.

---

## How to use this tracker

Each chapter file documents a set of Revit features as observed in the video. For each feature:

- **What it does** — plain-language description of the UX and behaviour
- **Screenshot** — link to the local desktop screenshot from the video
- **bim-ai status** — current parity level (see legend below)

### Status legend

| Symbol | Meaning |
| ------ | ------- |
| ✅     | Fully available in bim-ai with equivalent UX |
| 🟡     | Partially available — backend logic exists but UX / completeness is limited |
| ❌     | Not available — no equivalent in bim-ai |

---

## Table of Contents

| Chapter | Topic | Features |
| ------- | ----- | -------- |
| [Ch 01](ch01-ui-navigation.md) | UI & Navigation | F-001 – F-014 |
| [Ch 02](ch02-cad-linking.md) | CAD Linking & Import | F-015 – F-024 |
| [Ch 03](ch03-levels-views.md) | Levels & Plan Views | F-025 – F-033 |
| [Ch 04](ch04-walls.md) | Wall Tools | F-034 – F-047 |
| [Ch 05](ch05-family-editor.md) | Family Editor (Doors) | F-048 – F-062 |
| [Ch 06](ch06-nested-families.md) | Window & Nested Families | F-063 – F-074 |
| [Ch 07](ch07-parametric-furniture.md) | Parametric Furniture (2D+3D) | F-075 – F-086 |
| [Ch 08](ch08-furniture-library.md) | Project Furniture Library | F-087 – F-090 |
| [Ch 09](ch09-rooms-areas.md) | Rooms & Areas | F-091 – F-099 |
| [Ch 10](ch10-troubleshooting.md) | Troubleshooting & Fixes | F-100 – F-106 |
| [Ch 11](ch11-floors-parapet.md) | Floors & Parapet Walls | F-107 – F-113 |
| [Ch 12](ch12-furniture-placement.md) | Furniture Placement | F-114 – F-122 |

---

## Full Feature Status Table

> **Paradigm note — F-001 & F-002 excluded intentionally.** Revit's Home Screen and New Project Dialog are not parity targets. bim-ai uses a **Drive-like file browser** (create/open models like Google Docs) and **continuous versioning with milestones** instead of File → Save (T3 COL-V3-01/02). See `ch01-ui-navigation.md` for the full rationale.

| ID    | Feature                                              | Chapter        | bim-ai Status | Notes                                                                                                                |
| ----- | ---------------------------------------------------- | -------------- | ------------- | -------------------------------------------------------------------------------------------------------------------- |
| F-003 | Project Browser                                      | UI & Nav       | 🟡            | Plan views, 3D/section/elevation/sheet/schedule groups and family type rows exist; family rows support right-click select/rename/duplicate. Missing legends/groups subtree and subdiscipline/phase sorting |
| F-004 | Properties Palette (context-sensitive)               | UI & Nav       | 🟡            | Right-rail inspector with editable fields; missing type/instance separation and Edit Type button                     |
| F-005 | Ribbon Interface (tabbed toolbar)                    | UI & Nav       | ❌            | Different UI paradigm                                                                                                |
| F-006 | Quick Access Toolbar                                 | UI & Nav       | ✅            | Undo/Redo, Section, Measure, Thin Lines, Close Inactive Views, Aligned Dimension, Tag by Category, and 3D View quick-access entries are wired; configurable QAT entries support local pin/unpin |
| F-007 | Multi-tab view workspace                             | UI & Nav       | ✅            | TabBar + tabsModel (plan/3d/section/sheet/schedule/agent); Close Inactive Views added to tab bar                    |
| F-008 | Dark Mode                                            | UI & Nav       | ✅            | Full toggle with URL hash + localStorage + prefers-color-scheme cascade                                              |
| F-009 | Language settings                                    | UI & Nav       | ✅            | EN/DE toggle via language selector in TopBar; localStorage persistence                                              |
| F-010 | View Scale selector                                  | UI & Nav       | ✅            | Live 1:N scale bar + preset menu; missing annotation-driven plot scale lock                                          |
| F-011 | Visual Style selector (Wireframe/Shaded/etc.)        | UI & Nav       | 🟡            | Plan: detail level + style selectors (coarse/medium/fine + opening_focus/room_scheme). 3D: Shaded, Consistent Colors, Wireframe, Hidden Line via GDO panel. Missing: Realistic, Ray Trace, photographic exposure, ambient occlusion |
| F-012 | Visibility / Graphic Overrides (VV)                  | UI & Nav       | 🟡            | VVDialog (VV hotkey) covers 15 model categories and 14 annotation categories with per-category visibility, color, line weight, pattern overrides, and halftone toggle wired through to hiddenSemanticKinds. Missing: full ~120-category Revit catalogue, transparency slider, projection vs. cut pattern split |
| F-013 | Autodesk Account & License UI                        | UI & Nav       | ❌            | N/A (different SaaS model)                                                                                           |
| F-014 | Reveal Hidden Elements mode                          | UI & Nav       | ✅            | 💡 toggle shows hidden elements in magenta; right-click on hidden element → "Unhide in View: <category>" restores visibility; magenta chip while active |
| F-015 | Link CAD (DWG/DXF) — live reference                 | CAD            | 🟡            | DXF import backend + multipart upload endpoint implemented; frontend file-picker now enabled (Insert → Link DXF…) wired to upload-dxf-file; underlay appears via WebSocket broadcast. No live reload on source-file change |
| F-016 | Import CAD (embedded)                                | CAD            | 🟡            | Same backend + frontend file-picker as F-015; linked vs. embedded distinction not present (single link_dxf element kind) |
| F-017 | CAD Link Options (Colors/Layers/Units/Positioning)   | CAD            | 🟡            | ManageLinksDialog DXF Links section: per-link opacity slider (0–100%) and color mode toggle (B&W / Custom hex); missing layer visibility filtering, "Preserve original colors", and unit/positioning controls at import time |
| F-018 | Pin / Unpin linked files                             | CAD            | 🟡            | ManageLinksDialog has revision pinning with drift badge + Update button; no spatial position lock                    |
| F-019 | Query tool for DWG layer visibility                  | CAD            | ❌            | DXF layer metadata not preserved; no per-layer visibility UI                                                         |
| F-020 | Halftone / transparency for imported files (VG)      | CAD            | 🟡            | Per-link opacity now configurable (0–100%) via ManageLinksDialog; missing per-view opacity override in VVDialog and full-opacity (non-halftone) mode as a dropdown choice within VV |
| F-021 | Align CAD with Project Base Point                    | CAD            | 🟡            | ManageLinksDialog has origin/project base point/shared coords for link_model; missing for link_dxf                   |
| F-022 | Project Base Point & Survey Point                    | CAD            | ✅            | First-class elements in core; 3D/plan markers rendered; inspector edits N/S/E/W coordinates and persisted Clip/Unclip state |
| F-023 | Work Plane assignment for linked elements            | CAD            | 🟡            | `link_dxf` `levelId` field controls which level (work plane) the underlay is associated with; current level shown in inspector (`case 'link_dxf':`); changeable via ManageLinksDialog DXF Links section. Missing: level-dropdown in inspector (read-only display); Revit-style "Set Work Plane" dialog |
| F-024 | Manage Links dialog                                  | CAD            | 🟡            | ManageLinksDialog lists link_model rows (delete/alignment/visibility/pin) AND link_dxf underlays (opacity + color mode); missing IFC/PDF/image types, unload/reload controls, file-path change |
| F-025 | Levels (datum planes)                                | Levels & Views | 🟡            | LevelStack inline create/rename; SectionViewportSvg renders blue dashed datum lines with circle head + "Name \| ±X.XXX m" label; StatusBar shows elevation value for current level. Missing: elevation datum line across the plan canvas |
| F-026 | Rename Levels                                        | Levels & Views | ✅            | LevelStack inline rename via double-click; commits via updateElementProperty                                         |
| F-027 | Create Floor Plan Views from levels                  | Levels & Views | ✅            | LevelStack "+" per level fires upsertPlanView; newly created views appear in Project Browser                         |
| F-028 | Floor Plan View Types (Arch/Lighting/Power/etc.)     | Levels & Views | 🟡            | planViewSubtype field (floor_plan/lighting_plan/power_plan/coordination_plan) in plan_view; "View Type" dropdown in InspectorPlanViewEditor; missing default view template association and type-specific Project Browser grouping |
| F-029 | View Templates                                       | Levels & Views | 🟡            | view_template elements in ProjectBrowser; create/duplicate/delete/apply; missing save-current-as-template            |
| F-030 | Rename Views                                         | Levels & Views | ✅            | ProjectBrowser inline rename for plan views via double-click; commits via updateElementProperty                      |
| F-031 | Delete Views                                         | Levels & Views | ✅            | ProjectBrowser delete buttons for plan views, section cuts, and elevation views; guarded by confirm()                |
| F-032 | Project Browser view organization by Discipline      | Levels & Views | 🟡            | Discipline-header grouping when views have explicit arch/struct/mep tags; missing full Revit hierarchy               |
| F-033 | Auto-generated elevation markers (N/S/E/W)           | Levels & Views | ✅            | New project creation seeds grouped North/South/East/West elevation_view markers; snapshots hydrate them in web state; double-click opens elevation tab |
| F-034 | Wall Tool (draw by click)                            | Walls          | ✅            | Full interactive draw mode: click-to-place, real-time preview, snap, chain, flip, type/height/location-line options  |
| F-035 | Wall Types / Type Selector                           | Walls          | ✅            | OptionsBar "Type:" dropdown lists all wall_type elements; selection stored in useBimStore.activeWallTypeId           |
| F-036 | Edit Wall Assembly (layer structure)                 | Walls          | 🟡            | MaterialLayerStackWorkbench supports multi-layer wall/floor/roof types with add/remove/reorder; missing layer wrapping behavior UI |
| F-037 | Wall Location Line (Centerline/Core/Finish Face)     | Walls          | ✅            | OptionsBar has all 6 location-line options for the wall tool                                                         |
| F-038 | Wall Height / Top Constraint (level-linked)          | Walls          | ✅            | OptionsBar Height input (step 100, min 100); wallDrawHeightMm in store; passed as heightMm to createWall            |
| F-039 | Wall Top Offset / Bottom Offset                      | Walls          | ✅            | InspectorContent wall case has editable Base Offset and Top Offset inputs; fires updateElementProperty               |
| F-040 | Wall Join Status (Allow/Disallow)                    | Walls          | 🟡            | wall-join tool cycles miter/butt/square variants via Enter; per-endpoint Allow/Disallow via inspector checkboxes and right-click context menu (fires setWallJoinDisallow). Missing: geometry enforcement (mesh-layer join cleanup not yet gated on the flag) |
| F-041 | Chain drawing mode                                   | Walls          | ✅            | TOOL_CAPABILITIES.wall.chainable=true; OptionsBar Chain checkbox; PlanCanvas chainAnchor logic                       |
| F-042 | Offset drawing mode                                  | Walls          | ✅            | OptionsBar wall offset input; wallDrawOffsetMm in store; perpendicular shift applied in PlanCanvas                   |
| F-043 | Radius (curved corner) drawing mode                  | Walls          | ❌            |                                                                                                                      |
| F-044 | Spacebar flip wall orientation                       | Walls          | ✅            | PlanCanvas handles Space during wall draw; toggles wallFlipRef; resets after commit                                  |
| F-045 | Measure Between Two References                       | Walls          | ✅            | measure tool (hotkey ME); two-click distance readout chip; no permanent element                                      |
| F-046 | Wall Type renaming                                   | Walls          | ✅            | WorkspaceLeftRail F2 rename overlay for wall_type/floor_type/roof_type; commits via updateElementProperty            |
| F-047 | Temporary Hide / Isolate (sunglasses)                | Walls          | ✅            | PlanCanvas sunglasses menu supports temporary isolate/hide by category or selected element; TemporaryVisibilityChip displays active category/id targets and resets |
| F-048 | Family Editor workspace                              | Family Editor  | ❌            | No in-app parametric family editor                                                                                   |
| F-049 | Family templates (.rft files)                        | Family Editor  | ❌            |                                                                                                                      |
| F-050 | Reference Planes                                     | Family Editor  | ❌            |                                                                                                                      |
| F-051 | Extrusion tool                                       | Family Editor  | ❌            |                                                                                                                      |
| F-052 | Pick Lines with Lock (sketch mode)                   | Family Editor  | ❌            |                                                                                                                      |
| F-053 | Trim / Extend to Corner (TR)                         | Family Editor  | ❌            | No 2D sketch cleanup tools                                                                                           |
| F-054 | Aligned Dimension (DI) + Create Parameter            | Family Editor  | ❌            |                                                                                                                      |
| F-055 | Type vs. Instance Parameters                         | Family Editor  | ❌            |                                                                                                                      |
| F-056 | Family Types dialog                                  | Family Editor  | ❌            |                                                                                                                      |
| F-057 | Material Browser                                     | Family Editor  | ❌            | No visual material browser                                                                                           |
| F-058 | Asset Browser (Autodesk material library)            | Family Editor  | ❌            |                                                                                                                      |
| F-059 | Family Element Visibility Settings                   | Family Editor  | ❌            |                                                                                                                      |
| F-060 | Load Family Into Project                             | Family Editor  | ❌            |                                                                                                                      |
| F-061 | Wall-hosted family placement (door/window)           | Family Editor  | ❌            | No automatic opening cuts                                                                                            |
| F-062 | Type Properties – Duplicate                          | Family Editor  | ❌            |                                                                                                                      |
| F-063 | Nested Families                                      | Nested Fam.   | ❌            |                                                                                                                      |
| F-064 | Overwrite options when reloading families            | Nested Fam.   | ❌            |                                                                                                                      |
| F-065 | Family Category and Parameters dialog                | Nested Fam.   | ❌            |                                                                                                                      |
| F-066 | View Range in Family Editor                          | Nested Fam.   | ❌            |                                                                                                                      |
| F-067 | Detail Component (2D annotation component)           | Nested Fam.   | ❌            |                                                                                                                      |
| F-068 | Align Tool (AL) + Lock                               | Nested Fam.   | ❌            | No interactive align + lock in family editor context                                                                 |
| F-069 | Associate Family Parameter (Visible)                 | Nested Fam.   | ❌            |                                                                                                                      |
| F-070 | Mirror – Draw Axis (DM)                              | Nested Fam.   | 🟡            | Mirror tool two-click interaction implemented for project elements; missing family-editor context and pick-axis mode  |
| F-071 | Symbolic Lines                                       | Nested Fam.   | ❌            |                                                                                                                      |
| F-072 | Opening (Projection) / Hidden Lines (Cut) subcats   | Nested Fam.   | ❌            |                                                                                                                      |
| F-073 | Preview Visibility toggle (Family Editor)            | Nested Fam.   | ❌            |                                                                                                                      |
| F-074 | Instance parameters for per-placement overrides      | Nested Fam.   | ❌            |                                                                                                                      |
| F-075 | Family from furniture template (Metric Furniture.rft)| Param. Furn.  | ❌            |                                                                                                                      |
| F-076 | EQ (Equal) constraint on dimensions                  | Param. Furn.  | ❌            |                                                                                                                      |
| F-077 | Masking Region                                       | Param. Furn.  | ✅            | masking_region supports sketch creation, VV visibility, inspector fill color, editable boundary vertex grips, and optional void loops for negative cutouts |
| F-078 | Yes/No parameter for conditional visibility          | Param. Furn.  | ❌            |                                                                                                                      |
| F-079 | Symbolic Lines for 2D furniture                      | Param. Furn.  | ❌            |                                                                                                                      |
| F-080 | Snap Intersection (SI) shortcut                      | Param. Furn.  | 🟡            | One-shot snap override shortcuts during drawing: SI (Intersection), SE (Endpoint), SM (Midpoint), SP (Perpendicular), SX (Extension). Two-letter key sequence activates override for next pick only, then resets; shown as amber status chip. Missing: SN/SC/SW overrides, right-click context-menu override |
| F-081 | Multiple Types per family (New Type button)          | Param. Furn.  | ❌            |                                                                                                                      |
| F-082 | Extrusion from elevation (height parameters)         | Param. Furn.  | ❌            |                                                                                                                      |
| F-083 | Leg geometry: circle extrusion + Leg_Radius param    | Param. Furn.  | ❌            |                                                                                                                      |
| F-084 | Leg_Offset parameter                                 | Param. Furn.  | ❌            |                                                                                                                      |
| F-085 | Detail Level control (Coarse=2D / Medium+Fine=3D)    | Param. Furn.  | ❌            |                                                                                                                      |
| F-086 | Backrest Depth parameter                             | Param. Furn.  | ❌            |                                                                                                                      |
| F-087 | Project Furniture Library (warehouse .rvt)           | Furn. Library | ❌            | family_catalog_format exists but no warehouse UX                                                                     |
| F-088 | Dimension text repositioning                         | Furn. Library | ✅            | Dimension labels support `textOffsetMm`; inspector X/Y + Reset; on-canvas circular text grip snaps along the dimension axis; double-clicking the text grip resets to default |
| F-089 | Array parameters (Array_Length_Width)                | Furn. Library | ❌            |                                                                                                                      |
| F-090 | File Save Options (Max backups)                      | Furn. Library | ❌            | N/A (DB model)                                                                                                       |
| F-091 | Room Tool                                            | Rooms & Areas | 🟡            | tool registered; PlanCanvas click-to-place vertex logic; room labels via plan view inspector; missing auto-snap-to-boundary |
| F-092 | Room Separation Lines                                | Rooms & Areas | 🟡            | SketchCanvas for room_separation; room_separation in VVDialog annotation tab; missing pick-walls shortcut            |
| F-093 | Room Interior Fill visibility (VG)                   | Rooms & Areas | 🟡            | room category in VV; planRoomFillOpacityScale slider in InspectorPlanViewEditor; missing per-room-instance color override |
| F-094 | Area Boundary Lines                                  | Rooms & Areas | 🟡            | area-boundary sketch tool (hotkey AR); area_boundary in VVDialog; missing auto-snap to wall faces                   |
| F-095 | Area Tool                                            | Rooms & Areas | 🟡            | area-boundary sketch tool stores area elements; right-rail shows computed area/rule set; missing auto-close snap     |
| F-096 | Area and Volume Computations dialog                  | Rooms & Areas | ✅            | Project settings expose Volume Computed At and Room Area Computation Basis; OptionsBar dialog edits both; backend room derivation consumes area basis and volume basis with evidence fields |
| F-097 | Apply Area Rules toggle                              | Rooms & Areas | 🟡            | "Apply Area Rules" checkbox (data-testid="options-bar-apply-area-rules") in OptionsBar when area-boundary tool is active; stored in useBimStore.applyAreaRules; missing backend consumption to snap boundary lines to wall faces |
| F-098 | Area Plan (Gross Building) view type                 | Rooms & Areas | 🟡            | Area Plan view subtype added to Project Browser; missing area scheme association and gross/rentable distinction       |
| F-099 | Discipline property for views                        | Rooms & Areas | 🟡            | plan views have discipline field editable in InspectorPlanViewEditor; missing full Revit sub-discipline tree         |
| F-100 | Filter tool (multi-select type filter)               | Troubleshoot   | 🟡            | Ctrl+Click multi-select + count chip; Filter popover with category checkboxes; box-select (drag marquee) for walls/columns/placed_assets/floors/rooms/areas. Missing: Tab to add connected elements to multi-select |
| F-101 | Isolate Category                                     | Troubleshoot   | ✅            | Temporary Hide/Isolate sunglasses menu supports category and element targets for isolate/hide, scoped to the active view and resettable from TemporaryVisibilityChip |
| F-102 | Hide Category (permanent, view-specific)             | Troubleshoot   | ✅            | VVDialog permanent per-view category hide; inspector "Hide Category in View" button; TemporaryVisibilityChip hide mode; Reveal Hidden (💡) shows hidden elements in magenta with right-click "Unhide in View" |
| F-103 | Move tool (MV) — two-point with snap                 | Troubleshoot   | ✅            | Two-point MV tool in Modify palette; supports walls, columns, placed_assets, floors, rooms, areas via moveElementsDelta; Shift constrains to horizontal/vertical; grip + Δx/Δy inspector fallbacks. Minor gap: typed distance entry |
| F-104 | Tab key for chain-selection                          | Troubleshoot   | 🟡            | Tab cycles snap candidates (EDT-05) and advances wall selection to next endpoint-connected wall in select mode (round-robin). Missing: bulk multi-select of an entire wall loop in one Tab sequence |
| F-105 | Split Element (SL)                                   | Troubleshoot   | ✅            | PlanCanvas split tool; splitWallAt fires on click within 900 mm of wall; SplitWallAtCmd persists                    |
| F-106 | Aligned Dimension for cross-checking accuracy        | Troubleshoot   | ✅            | dimension tool two-click placement; createDimension persists; rendered by planElementMeshBuilders + symbology        |
| F-107 | Floor Tool & Edit Boundary                           | Floors         | ✅            | floor-sketch tool (Shift+F) with full SketchCanvas, wall-snap, auto-close, Finish/Cancel; backend creates floor      |
| F-108 | Floor type selection                                 | Floors         | ✅            | OptionsBar "Type:" select when floor tool active; activeFloorTypeId in store; passed via SketchCanvas to emitter     |
| F-109 | Parapet walls (Unconnected Height)                   | Floors         | ✅            | Standard wall tool with OptionsBar height and location-line; matches Revit workflow exactly                          |
| F-110 | Wall Top Offset (negative, sub-slab)                 | Floors         | ✅            | InspectorContent Base Offset and Top Offset support negative values; enables sub-slab placement                      |
| F-111 | 3D View rotation (Shift + Middle Click)              | Floors         | ✅            | cameraRig.ts classifyPointer returns 'orbit' for Shift+MMB; matches Revit convention                                |
| F-112 | Default {3D} isometric view                          | Floors         | ✅            | 3D canvas with orbit/pan/zoom, ViewCube, H reset; auto-loads vp-main-iso; "3D" button in TopBar opens 3D tab directly |
| F-113 | Graphic Display Options (shadows, depth cue, etc.)   | Floors         | 🟡            | GDO toggle button in 3D viewport opens panel with Visual Style (Shaded/Consistent Colors/Wireframe/Hidden Line), Background (White/Light Grey/Dark), and Edge display (Normal/None). Missing: silhouette edge width, depth cue, photographic exposure, shadows, ambient occlusion |
| F-114 | Placing component families in project                | Furn. Place   | 🟡            | Component tool (hotkey CC) places placed_asset elements; asset selector in OptionsBar; live ghost preview follows cursor; Spacebar rotation (0→90→180→270°) works correctly before placement. Missing: interactive parameter editing after placement; built-in furniture asset library |
| F-115 | Spacebar rotation during placement                   | Furn. Place   | ✅            | Spacebar cycles pendingComponentRotationDeg by 90° (0→90→180→270); live ghost preview rectangle tracks cursor rotation in real time; passed to PlaceAsset on click |
| F-116 | Copy (CO) tool                                       | Furn. Place   | ✅            | Two-point CP tool in Modify palette; multi-copy "Multiple" mode (default on) keeps tool active for further copies; Ctrl+C/V clipboard also available. Minor gaps: clipboard persistence across reload, copy to a different level |
| F-117 | Parametric living room sofa family                   | Furn. Place   | ❌            |                                                                                                                      |
| F-118 | Parametric kitchen slab family                       | Furn. Place   | ❌            |                                                                                                                      |
| F-119 | Parametric bathroom layout family                    | Furn. Place   | ❌            |                                                                                                                      |
| F-120 | Parametric bed family (2D)                           | Furn. Place   | ❌            |                                                                                                                      |
| F-121 | Align tool (AL) for furniture-to-wall                | Furn. Place   | 🟡            | Two-click workflow: first click = reference point (shows dashed crosshair SVG + coordinate label), second click snaps nearest wall (≤900 mm) via `alignElementToReference`. Missing: arbitrary face alignment, Lock constraint, non-wall elements |
| F-122 | Rotate tool (about user-defined center)              | Furn. Place   | 🟡            | General-purpose two-click RO tool: first click = center, second click = snapped end angle; supports wall, column, placed_asset, floor, room, area. Missing: numeric typed-angle dialog and start-angle reference ray |

---

## Summary Statistics

_Last audited: 2026-05-09 against codebase at commit `docs/tracker-sync-wave-11`._

| Status                 | Count   | % of total |
| ---------------------- | ------- | ---------- |
| ✅ Fully available     | 34      | 28%        |
| 🟡 Partially available | 39      | 33%        |
| ❌ Not available       | 47      | 39%        |
| **Total**              | **120** | **100%**   |

---

## Priority areas for parity investment

Based on the frequency and centrality of features in the course. WP cross-refs point to `spec/workpackage-tracker-v3.md`.

1. **Wall tooling** (F-034–F-047) — walls are the most-touched feature across the entire course. Location line, join behavior, chain mode, and type editing are used in virtually every video. _Editing mechanics partially addressed by `EDT-V3-01` (constraint rules), `EDT-V3-02` (snap cursor), `EDT-V3-04/05` (shortcuts + loop mode), `EDT-V3-06` (drag-the-number), `EDT-V3-12` (numeric override). Wall type/assembly editing and Location Line have **no WP yet**._
2. **Visibility / Graphic Overrides** (F-012, F-020, F-093) — used constantly for visual management of linked files and model categories. _v3 deliberately does not clone the 120-toggle VG matrix (anti-pattern A8 → D8). The replacement is the status-bar discipline lens + view templates + right-click category override. No direct parity WP; by design._
3. **Project Browser + view management** (F-003, F-027–F-033) — every workflow step involves switching views; without this, navigation overhead is enormous. _`CHR-V3-07` (Project Browser refresh, status: `next`) directly addresses this._
4. **Rooms** (F-091–F-092) — backend logic exists (`room_derivation.py`); front-end interactive placement is the missing piece. _**No WP yet.**_
5. **Levels UX** (F-025–F-026) — data model exists (`datum_levels.py`); needs level head display in elevation views and interactive rename. _**No WP yet.**_
6. **Temporary Hide/Isolate** (F-047, F-101–F-102) — F-047 and F-101 are ✅: PlanCanvas sunglasses menu supports temporary isolate/hide by category and by selected element, with `TemporaryVisibilityChip` reset. F-102 is ✅ for permanent view-specific hide via VVDialog plus inspector Hide Element/Hide Category. F-014 is ✅ — lightbulb reveal mode shows hidden elements in magenta with unhide actions.
7. **Family Editor** (F-048–F-062) — major architectural feature gap. v3's approach is a catalog model (`family_catalog_format.py`) rather than an in-app parametric editor. _Out of scope for v3; long-term vision item._
8. **Floor Edit Boundary** (F-107) — common daily operation; sketch-mode edit of slab outlines. _`EDT-V3-13` (sketch-element grips, status: `next`) is the closest WP; full boundary re-sketch is a follow-on._
