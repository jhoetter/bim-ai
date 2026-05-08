# Revit Parity Tracker

Source: "The Complete Revit 2026 Course for Architectural Design" — 6-hour recorded session analyzed at timestamp level.
Screenshots: `/Users/jhoetter/Desktop/Revit Specs/` (local only, not committed to git).
Last updated: 2026-05-08.

---

## How to use this tracker

Each chapter file documents a set of Revit features as observed in the video. For each feature:
- **What it does** — plain-language description of the UX and behaviour
- **Screenshot** — link to the local desktop screenshot from the video
- **bim-ai status** — current parity level (see legend below)

### Status legend

| Symbol | Meaning |
|--------|---------|
| ✅ | Fully available in bim-ai with equivalent UX |
| 🟡 | Partially available — backend logic exists but UX / completeness is limited |
| ❌ | Not available — no equivalent in bim-ai |

---

## Table of Contents

| Chapter | Topic | Features |
|---------|-------|----------|
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

| ID | Feature | Chapter | bim-ai Status | Notes |
|----|---------|---------|---------------|-------|
| F-003 | Project Browser | UI & Nav | ❌ | No hierarchical view/sheet browser |
| F-004 | Properties Palette (context-sensitive) | UI & Nav | 🟡 | Basic inspector exists; no full param model |
| F-005 | Ribbon Interface (tabbed toolbar) | UI & Nav | ❌ | Different UI paradigm |
| F-006 | Quick Access Toolbar | UI & Nav | ❌ | |
| F-007 | Multi-tab view workspace | UI & Nav | ❌ | Single canvas |
| F-008 | Dark Mode | UI & Nav | ❌ | |
| F-009 | Language settings | UI & Nav | ❌ | |
| F-010 | View Scale selector | UI & Nav | ❌ | No annotation-driven scales |
| F-011 | Visual Style selector (Wireframe/Shaded/etc.) | UI & Nav | 🟡 | Some render modes exist; not per-view-type |
| F-012 | Visibility / Graphic Overrides (VV) | UI & Nav | ❌ | No per-view category override system |
| F-013 | Autodesk Account & License UI | UI & Nav | ❌ | N/A (different SaaS model) |
| F-014 | Reveal Hidden Elements mode | UI & Nav | ❌ | |
| F-015 | Link CAD (DWG/DXF) — live reference | CAD | 🟡 | DXF import only, no live link/reload |
| F-016 | Import CAD (embedded) | CAD | 🟡 | One-time DXF import exists |
| F-017 | CAD Link Options (Colors/Layers/Units/Positioning) | CAD | ❌ | No filter UI |
| F-018 | Pin / Unpin linked files | CAD | ❌ | |
| F-019 | Query tool for DWG layer visibility | CAD | ❌ | |
| F-020 | Halftone / transparency for imported files (VG) | CAD | ❌ | |
| F-021 | Align CAD with Project Base Point | CAD | ❌ | |
| F-022 | Project Base Point & Survey Point | CAD | ❌ | |
| F-023 | Work Plane assignment for linked elements | CAD | ❌ | |
| F-024 | Manage Links dialog | CAD | ❌ | |
| F-025 | Levels (datum planes) | Levels & Views | 🟡 | Data model exists; level head/symbol UX missing |
| F-026 | Rename Levels | Levels & Views | ❌ | No interactive rename UI |
| F-027 | Create Floor Plan Views from levels | Levels & Views | ❌ | |
| F-028 | Floor Plan View Types (Arch/Lighting/Power/etc.) | Levels & Views | ❌ | |
| F-029 | View Templates | Levels & Views | ❌ | |
| F-030 | Rename Views | Levels & Views | ❌ | |
| F-031 | Delete Views | Levels & Views | ❌ | |
| F-032 | Project Browser view organization by Discipline | Levels & Views | ❌ | |
| F-033 | Auto-generated elevation markers (N/S/E/W) | Levels & Views | ❌ | |
| F-034 | Wall Tool (draw by click) | Walls | 🟡 | Backend supports walls; interactive draw UX limited |
| F-035 | Wall Types / Type Selector | Walls | 🟡 | Type data exists; no rich type-selector UI library |
| F-036 | Edit Wall Assembly (layer structure) | Walls | ❌ | Single-layer only |
| F-037 | Wall Location Line (Centerline/Core/Finish Face) | Walls | ❌ | |
| F-038 | Wall Height / Top Constraint (level-linked) | Walls | 🟡 | Height data exists; no Options Bar control |
| F-039 | Wall Top Offset / Bottom Offset | Walls | ❌ | |
| F-040 | Wall Join Status (Allow/Disallow) | Walls | 🟡 | Join logic in engine; no user-facing toggle |
| F-041 | Chain drawing mode | Walls | ❌ | |
| F-042 | Offset drawing mode | Walls | ❌ | |
| F-043 | Radius (curved corner) drawing mode | Walls | ❌ | |
| F-044 | Spacebar flip wall orientation | Walls | ❌ | |
| F-045 | Measure Between Two References | Walls | ❌ | |
| F-046 | Wall Type renaming | Walls | ❌ | |
| F-047 | Temporary Hide / Isolate (sunglasses) | Walls | ❌ | |
| F-048 | Family Editor workspace | Family Editor | ❌ | No in-app parametric family editor |
| F-049 | Family templates (.rft files) | Family Editor | ❌ | |
| F-050 | Reference Planes | Family Editor | ❌ | |
| F-051 | Extrusion tool | Family Editor | ❌ | |
| F-052 | Pick Lines with Lock (sketch mode) | Family Editor | ❌ | |
| F-053 | Trim / Extend to Corner (TR) | Family Editor | ❌ | |
| F-054 | Aligned Dimension (DI) + Create Parameter | Family Editor | ❌ | |
| F-055 | Type vs. Instance Parameters | Family Editor | ❌ | |
| F-056 | Family Types dialog | Family Editor | ❌ | |
| F-057 | Material Browser | Family Editor | ❌ | No visual material browser |
| F-058 | Asset Browser (Autodesk material library) | Family Editor | ❌ | |
| F-059 | Family Element Visibility Settings | Family Editor | ❌ | |
| F-060 | Load Family Into Project | Family Editor | ❌ | |
| F-061 | Wall-hosted family placement (door/window) | Family Editor | ❌ | No automatic opening cuts |
| F-062 | Type Properties – Duplicate | Family Editor | ❌ | |
| F-063 | Nested Families | Nested Fam. | ❌ | |
| F-064 | Overwrite options when reloading families | Nested Fam. | ❌ | |
| F-065 | Family Category and Parameters dialog | Nested Fam. | ❌ | |
| F-066 | View Range in Family Editor | Nested Fam. | ❌ | |
| F-067 | Detail Component (2D annotation component) | Nested Fam. | ❌ | |
| F-068 | Align Tool (AL) + Lock | Nested Fam. | ❌ | |
| F-069 | Associate Family Parameter (Visible) | Nested Fam. | ❌ | |
| F-070 | Mirror – Draw Axis (DM) | Nested Fam. | ❌ | |
| F-071 | Symbolic Lines | Nested Fam. | ❌ | |
| F-072 | Opening (Projection) / Hidden Lines (Cut) subcategories | Nested Fam. | ❌ | |
| F-073 | Preview Visibility toggle (Family Editor) | Nested Fam. | ❌ | |
| F-074 | Instance parameters for per-placement overrides | Nested Fam. | ❌ | |
| F-075 | Family from furniture template (Metric Furniture.rft) | Param. Furn. | ❌ | |
| F-076 | EQ (Equal) constraint on dimensions | Param. Furn. | ❌ | |
| F-077 | Masking Region | Param. Furn. | ❌ | |
| F-078 | Yes/No parameter for conditional visibility | Param. Furn. | ❌ | |
| F-079 | Symbolic Lines for 2D furniture | Param. Furn. | ❌ | |
| F-080 | Snap Intersection (SI) shortcut | Param. Furn. | ❌ | |
| F-081 | Multiple Types per family (New Type button) | Param. Furn. | ❌ | |
| F-082 | Extrusion from elevation (height parameters) | Param. Furn. | ❌ | |
| F-083 | Leg geometry: circle extrusion + Leg_Radius parameter | Param. Furn. | ❌ | |
| F-084 | Leg_Offset parameter | Param. Furn. | ❌ | |
| F-085 | Detail Level control (Coarse=2D / Medium+Fine=3D) | Param. Furn. | ❌ | |
| F-086 | Backrest Depth parameter | Param. Furn. | ❌ | |
| F-087 | Project Furniture Library (warehouse .rvt) | Furn. Library | ❌ | family_catalog_format exists but no warehouse UX |
| F-088 | Dimension text repositioning | Furn. Library | ❌ | |
| F-089 | Array parameters (Array_Length_Width) | Furn. Library | ❌ | |
| F-090 | File Save Options (Max backups) | Furn. Library | ❌ | N/A (DB model) |
| F-091 | Room Tool | Rooms & Areas | 🟡 | room_derivation in backend; no interactive place |
| F-092 | Room Separation Lines | Rooms & Areas | 🟡 | plan_aa_room_separation in backend; no draw UX |
| F-093 | Room Interior Fill visibility (VG) | Rooms & Areas | ❌ | |
| F-094 | Area Boundary Lines | Rooms & Areas | ❌ | |
| F-095 | Area Tool | Rooms & Areas | ❌ | |
| F-096 | Area and Volume Computations dialog | Rooms & Areas | ❌ | |
| F-097 | Apply Area Rules toggle | Rooms & Areas | ❌ | |
| F-098 | Area Plan (Gross Building) view type | Rooms & Areas | ❌ | |
| F-099 | Discipline property for views | Rooms & Areas | ❌ | |
| F-100 | Filter tool (multi-select type filter) | Troubleshoot | ❌ | |
| F-101 | Isolate Category | Troubleshoot | ❌ | |
| F-102 | Hide Category (permanent, view-specific) | Troubleshoot | ❌ | |
| F-103 | Move tool (MV) — two-point with snap | Troubleshoot | 🟡 | Drag exists; no typed two-point Move |
| F-104 | Tab key for chain-selection | Troubleshoot | ❌ | |
| F-105 | Split Element (SL) | Troubleshoot | ❌ | |
| F-106 | Aligned Dimension for cross-checking accuracy | Troubleshoot | ❌ | |
| F-107 | Floor Tool & Edit Boundary | Floors | 🟡 | Floor elements exist; no Edit Boundary sketch UX |
| F-108 | Floor type selection | Floors | 🟡 | Type data in engine; no UI type-selector |
| F-109 | Parapet walls (Unconnected Height) | Floors | 🟡 | Walls support arbitrary height; no parapet UX |
| F-110 | Wall Top Offset (negative, sub-slab) | Floors | ❌ | |
| F-111 | 3D View rotation (Shift + Middle Click) | Floors | 🟡 | 3D viewport exists; mouse nav convention may differ |
| F-112 | Default {3D} isometric view | Floors | 🟡 | 3D canvas exists; not a named Project Browser view |
| F-113 | Graphic Display Options (shadows, depth cue, etc.) | Floors | ❌ | |
| F-114 | Placing component families in project | Furn. Place | ❌ | No interactive placement with live preview |
| F-115 | Spacebar rotation during placement | Furn. Place | ❌ | |
| F-116 | Copy (CO) tool | Furn. Place | 🟡 | Duplication exists; not a two-point Copy command |
| F-117 | Parametric living room sofa family | Furn. Place | ❌ | |
| F-118 | Parametric kitchen slab family | Furn. Place | ❌ | |
| F-119 | Parametric bathroom layout family | Furn. Place | ❌ | |
| F-120 | Parametric bed family (2D) | Furn. Place | ❌ | |
| F-121 | Align tool (AL) for furniture-to-wall | Furn. Place | ❌ | |
| F-122 | Rotate tool (about user-defined center) | Furn. Place | ❌ | |

---

## Summary Statistics

| Status | Count | % of total |
|--------|-------|-----------|
| ✅ Fully available | 0 | 0% |
| 🟡 Partially available | 23 | 19% |
| ❌ Not available | 97 | 81% |
| **Total** | **120** | **100%** |

---

## Priority areas for parity investment

Based on the frequency and centrality of features in the course. WP cross-refs point to `spec/workpackage-tracker-v3.md`.

1. **Wall tooling** (F-034–F-047) — walls are the most-touched feature across the entire course. Location line, join behavior, chain mode, and type editing are used in virtually every video. _Editing mechanics partially addressed by `EDT-V3-01` (constraint rules), `EDT-V3-02` (snap cursor), `EDT-V3-04/05` (shortcuts + loop mode), `EDT-V3-06` (drag-the-number), `EDT-V3-12` (numeric override). Wall type/assembly editing and Location Line have **no WP yet**._
2. **Visibility / Graphic Overrides** (F-012, F-020, F-093) — used constantly for visual management of linked files and model categories. _v3 deliberately does not clone the 120-toggle VG matrix (anti-pattern A8 → D8). The replacement is the status-bar discipline lens + view templates + right-click category override. No direct parity WP; by design._
3. **Project Browser + view management** (F-003, F-027–F-033) — every workflow step involves switching views; without this, navigation overhead is enormous. _`CHR-V3-07` (Project Browser refresh, status: `next`) directly addresses this._
4. **Rooms** (F-091–F-092) — backend logic exists (`room_derivation.py`); front-end interactive placement is the missing piece. _**No WP yet.**_
5. **Levels UX** (F-025–F-026) — data model exists (`datum_levels.py`); needs level head display in elevation views and interactive rename. _**No WP yet.**_
6. **Temporary Hide/Isolate** (F-047, F-101–F-102) — used in almost every chapter for selective display. _**No WP yet.**_
7. **Family Editor** (F-048–F-062) — major architectural feature gap. v3's approach is a catalog model (`family_catalog_format.py`) rather than an in-app parametric editor. _Out of scope for v3; long-term vision item._
8. **Floor Edit Boundary** (F-107) — common daily operation; sketch-mode edit of slab outlines. _`EDT-V3-13` (sketch-element grips, status: `next`) is the closest WP; full boundary re-sketch is a follow-on._
