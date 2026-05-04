# PRD — Revit Tutorial Parity & Cleanroom BIM (from 11‑video residential workflow)

## Document purpose

This PRD distills a structured **11‑video Revit tutorial series** (German walkthrough: project setup → walls by level → slabs/roof → stair → doors/windows → family editing → finishes/railings/roof slope → annotation → sections/details → sheets/schedules) into **product requirements and user stories** for BIM AI. It is framed for **general residential BIM** and for **high‑rigor domains (e.g. cleanroom engineering)** where floor build‑ups, hosted voids, view control, and quantities are business‑critical.

**Scope:** Parity is **workflow and data semantics**, not pixel‑level Revit UI. Native `.rvt` I/O remains out of scope for v1; see [openbim-compatibility.md](../openbim-compatibility.md).

**Related:** [cli-agent-home-design-gaps.md](./cli-agent-home-design-gaps.md) (agent/CLI/house demo gaps) and [revit-production-parity-ai-agent-prd.md](./revit-production-parity-ai-agent-prd.md) (deeper screenshot/video production parity requirements).

## Product principles (inherited from repo)

- Single **command‑driven** model: browser, CLI, and API share one commit path (`/api/commands`, undo stack).
- Prefer **open BIM exchange** (IFC/BCF/IDS) over proprietary lock‑in; Revit is a **compatibility target**, not the schema source of truth.

## Current BIM AI surface (baseline)

| Area                          | Today (high level)                                                             |
| ----------------------------- | ------------------------------------------------------------------------------ |
| Levels                        | Named level + elevation; no first‑class RFB/FFB/UKRD stack                     |
| Walls                         | Segments with thickness/height; layer types / structural vs finish **limited** |
| Slabs / roofs / stairs        | Not first‑class in command union for full tutorial parity                      |
| Hosted openings               | Doors/windows on walls; no parametric family editor / void solids              |
| Rooms                         | Outlines + names; no full Revit “Room” upper limit / volume semantics          |
| Sections / sheets / schedules | Partial schedule UI; sheets/plan production **not** equivalent to Revit        |
| Constraints                   | Geometric + advisory rules; not full parametric **align/lock** graph           |
| Materials / quantities        | Summary counts; **not** layered takeoffs per finish                            |

## Personas

- **Architect / technologist** — needs fast shell + documentation views.
- **Cleanroom engineer** — needs **level stack accuracy**, **leaf-to-leaf** junctions, **interlock-aware** doors, **per-room finish quantities**, and **view templates** separating disciplines.
- **External agent** — consumes schema + bundles; requires deterministic replay (see CLI PRD).

---

## Epic A — Project & level system (Videos 01–02)

### A1 Units & project metadata

**User story:** As a modeler, I want project linear units and decimal conventions explicit so scripted and manual entry stay consistent.

**Requirements**

- Persist **display vs internal** numeric conventions (comma decimal in UI localized input is UX; canonical storage stays unambiguous).
- Expose units in **`/api/schema`** or project settings payload for agents.

**Acceptance**

- Changing unit display does not corrupt stored geometry.
- CLI/agents receive a declared **canonical unit** (mm recommended for current engine).

### A2 Multi-level datum stack (FFB / RFB / UKRD pattern)

**User story:** As a cost/cleanroom lead, I want **separate datums** for finished floor, rough floor, and rough ceiling so quantities split **rough vs finished** (BIM 5D / VOB‑style).

**Requirements**

- First-class **level kinds** or **offset chains** from a primary level: e.g. `EG_FFB`, `EG_RFB` (−0.10 m from FFB), `EG_UKRD` (−0.20 m from slab datum), mirrored for OG/DG.
- Walls reference **base constraint** + **top constraint** with optional **offsets** (Video 01–02).

**Acceptance**

- Wall height resolves from constraints; changing RFB datum propagates heights without manual redraw.
- API can query “this wall spans from Datum A to Datum B ± offset.”

### A3 Stack between floors (copy vs live link)

**User story:** As a designer, I want to **duplicate** walls to OG/DG aligned to targets (Revit clipboard to level).

**Requirements**

- **Copy/paste aligned to levels** bundle or command: `{ type: "duplicateElementsAlignedToLevels", elementIds[], targetLevelIds[] }`.

**Acceptance**

- Copied shells maintain host relationships where possible.

### A4 Working context (plan underlay / ghosts)

**User story:** As a planner, I want **underlay** of EG while editing OG.

**Requirements**

- Per-view **ghost** of another level / optional tinted underlay toggle in plan cockpit.

---

## Epic B — Walls & constraints (Videos 01–02)

### B1 Composite wall types

**User story:** As a façade engineer, I want **named wall types** with multi-layer buildup (structure, insulation, finish) editable in type—not per instance hacks.

**Requirements**

- Wall **type catalog** referencing ordered layers (function + thickness + material key).
- **Basis line**: exterior structural face vs finish face (Video 01).

**Acceptance**

- Changing type updates all instances of that type unless overridden explicitly.

### B2 Constraints: dimensions & align-lock

**User story:** As a modeler, I want temporary dimensions and persistent **constraints** (“padlock”) between edges.

**Requirements**

- **Dimension-driven move** persists as offset parameter or equality constraint.
- **Align** picks **explicit edge** (Tab-cycle), not infinite axis only.

**Acceptance**

- Editing one aligned edge moves dependents within constraint graph unless explicitly broken.

---

## Epic C — Slabs, roofs, geometry join (Video 03)

### C1 Slabs bounded by walls

**User story:** As a structural planner, I want slabs picked by **wall core faces** so edges sit on masonry precisely.

**Requirements**

- `createFloor` / `createSlab`: boundary from **picked wall geometry** + material/type.
- **Join geometry** merges overlapping volumes with material priority rules (Revit‑like join order).

### C2 Layer extension / reveal at slab edge (insulation)

**User story:** As an energy/detail lead, I want outer insulation layers to **extend** past slab edge (-0.20 m reveal) without redrawing hull.

**Requirements**

- Per-layer parameters: extension top/bottom, unlocked offset from slab references.

### C3 Roofs

**User story:** As a planner, I want **roof-by-footprint** with overhang + selective hip/gable switches (Video 03).

**Requirements**

- Footprint polygon + boundary conditions (defines slope sides).
- **Attach wall tops** to roof plane (grow to underside of roof deck).

---

## Epic D — Stairs & vertical circulation (Video 04)

### D1 Stair runs between levels

**User story:** As an architect, I want **U/L runs** between level datums with code-aware risers/treads.

**Requirements**

- `createStair` with run width, stair type, justification, `#risers`, level extent.
- **Floor opening** carved in slab (`editBoundary`) + structural opening.

### D2 Rails

**User story:** As a reviewer, I want railings that **offset from path**, with segment removal against walls.

**Requirements**

- Railing hosted to path/sketch + per-segment suppression.

---

## Epic E — Doors & windows + families (Videos 05–07)

### E1 Hosted families vs types

**User story:** As a BIM manager, I need **family library** semantics: instance vs **type parameters** propagate correctly.

### E2 Finish-dependent sill/head heights

**User story:** As a draftsman placing on **RFB**, I need sill/head corrected for **FFB buildup** (+0.10 m) without mental math.

**Requirements**

- Documented **reference plane** when placing openings; automation rule for sill offset bundles.

### E3 ~~Custom window family~~ parametric solids & void cutting (cleanroom-critical)

**User story:** As a cleanroom supplier, custom doors/windows must carve **walls to exact rebate depth**, with parameterized reveals (Video 07).

**Requirements**

- **Family editor** analogue: reference planes/parameters, extrusions, **boolean void**, cut host.
- LOD visibility switches (Medium vs Fine) for glazing vs frame.

**Acceptance**

- Changing reveal width adjusts void + clash checks.

### E4 Skylounge / shafts

**User story:** As a planner, I need **shaft/atrium** edits to slab openings (opening boundary with offset corridors).

---

## Epic F — Finishes & flat roof slope (Videos 06 & 08)

### F1 View range / partial cut plane (WC high windows)

**User story:** As a verifier, tiny/high windows must appear on plan appropriately.

**Requirements**

- Plan **crop range** rectangles with local cut plane elevations (Revit Plan Region analogue).

### F2 Ceiling/floor finishes as quantifiable layers

**User story:** As a QS lead, finishes must be **per-room** slabs for epoxy/PVC/parkett mass (Video 08).

**Requirements**

- Room-bounded finish floor type; tag materials to schedule.

### F3 Shape-edited flat roof insulation (variable layer)

**User story:** As a roofer, I need **tapered insulation** on flat roof: flat bottom, sloped top (Video 08).

**Requirements**

- Roof shape edit points + “variable layer” flag for insulation.

---

## Epic G — Annotation & documentation (Video 09)

### G1 Rooms with separation lines & volume

**User story:** As an architect, open plans need **room separation lines** for logical zones and correct **upper limit** for volume.

### G2 Multi-tag & dimension chains

**User story:** As a documenter, I want **auto-tag** all windows (sill) and **aligned dimension** through openings.

**Requirements**

- Pattern-based dimension to wall faces + opening widths.

### G3 Custom tags (labels from type + comment)

**User story:** As a document controller, tag families show typname + optional comment with visibility toggle.

---

## Epic H — Sections, details, topo, view templates (Video 10)

### H1 Multi-segment sections & callouts

**User story:** As a reviewer, one section line can jog to capture multiple conditions.

### H2 Detailing (2D-only in view)

**User user story:** Detail callouts blend model cut + drafting fills/detail components/repeating regions.

### H3 Topo + building pad

**User story:** Site meshes interact with basement; **building pad** cuts topo under footprint.

### H4 View templates

**User story:** As a BIM lead, replicate visibility/scale/patterns across EG/OG in one shot.

---

## Epic I — Sheet production & schedules (Videos 06 list placement, Video 11)

### I1 Sheet layout

**User story:** As a issuer, compose titleblock with placed views + crop masks + hidden annotations.

### I2 Schedules with filters & fields

**User story:** As a QS lead, schedules filter by **level**, include From/To room for doors, export to sheets.

---

## Cross-cutting requirements (Cleanroom takeaway)

| Theme                         | Requirement                            | Risk if missing             |
| ----------------------------- | -------------------------------------- | --------------------------- |
| Parametric reveals/voids (E3) | Wall cut depth tied to supplier panels | Wrong GMP as-built aperture |
| Layer split & slab edge (C2)  | Insulation vs structure quantities     | Thermal bridge + wrong BOQ  |
| Room-bounded finishes (F2)    | Epoxy area by cleanroom class          | Compliance & cost           |
| View templates (H4)           | Discipline separation on same model    | HVAC vs arch confusion      |
| Schedules (I2)                | Filtered BOM & door matrices           | Procurement errors          |

---

## Phased roadmap (suggested)

| Phase | Goal                           | BIM AI direction                                                |
| ----- | ------------------------------ | --------------------------------------------------------------- |
| P0    | **Datums + constraints** shell | Extend level/constraints schema; cockpit underlay prototype     |
| P1    | **Slabs/roof/stair openings**  | New commands + join hooks in engine                             |
| P2    | **Families/voids (subset)**    | Parametric opening families or template-based void library      |
| P3    | **Documentation**              | Sheets, richer schedules, plan regions                          |
| P4    | **Exchange**                   | IFC export reflects layers + openings; IDS rules for cleanrooms |

---

## Traceability placeholder (tutorial → epic)

| Video | Primary epics       |
| ----- | ------------------- |
| 01    | A1–A2, B1–B2        |
| 02    | A3–A4, B wall edits |
| 03    | C1–C3               |
| 04    | D1–D2               |
| 05    | E1–E2, I2 seeds     |
| 06    | E windows, F1       |
| 07    | **E3** (cleanroom)  |
| 08    | F2–F3, D rails      |
| 09    | G1–G3               |
| 10    | H1–H4               |
| 11    | I1–I2               |

---

## Next steps for product/engineering

1. Prioritize **P0+P1** for any “Revit-parity lite” MVP (levels stack, slabs, roofs, stairs).
2. Spin **Cleanroom appendix** IDS checklist (particle class, pressure cascade, door interlocks) referencing **E3 + I2**.
3. Keep JSON command bundles the **golden replay** artifact; each new epic lands with schema + CLI + one workflow test.

## Source note

Requirements above are synthesized from user-provided **German Revit tutorial notes** (11 videos including plan production). Numeric examples (offsets, widths) are **illustrative**; final defaults should follow regional codes and internal standards.
