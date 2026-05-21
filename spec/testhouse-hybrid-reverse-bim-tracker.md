# Testhouse Hybrid Reverse-BIM Execution Tracker

Last updated: 2026-05-21

Status: **Open.** This tracker turns the `testhouses/` folders into a
sequential learning benchmark for `claude-skills/hybrid-reverse-bim`.

Controlling method:

- [`claude-skills/hybrid-reverse-bim/SKILL.md`](../claude-skills/hybrid-reverse-bim/SKILL.md)
- [`spec/hybrid-reverse-bim-methodology-tracker.md`](./hybrid-reverse-bim-methodology-tracker.md)
- [`spec/reverse-bim-actual-methodology-tracker.md`](./reverse-bim-actual-methodology-tracker.md)

## Purpose

Build the real test houses in `testhouses/` through the hybrid reverse-BIM
methodology and use the runs as a hard learning loop for the software.

The goal is not a plausible house. The goal is a source-faithful, inspectable
BIM model for each source folder, with enough evidence to judge whether the
methodology and product can model the building correctly.

After these houses are attempted, the tracker must contain findings that show:

- where the methodology works;
- where source understanding breaks down;
- where MCP authoring or readback is insufficient;
- where the UI makes inspection hard;
- where rendering, sections, elevations, details, schedules, or overlays are
  missing or misleading;
- what must improve in the methodology and in the software before the next
  real-house run.

## Non-Negotiable Execution Rule

Agents executing this tracker are not allowed to stop after a first plausible
model.

For each house, the agent must keep iterating until it genuinely believes the
model is correct according to the controlling hybrid reverse-BIM methodology,
or until it records a concrete blocker that prevents correctness. A blocker is
valid only when it names the failed source fact, model fact, tool contract,
view/evidence gap, or product limitation and writes a finding in this tracker.

Only then may the agent continue to the next house.

Every finding discovered during the work must be written back here. Findings
include methodology defects, source-reading issues, wrong assumptions, missing
MCP tools, UI gaps, renderer defects, plan/section/elevation mismatches,
schedule reconciliation failures, and cases where the software unexpectedly
worked well.

## Source Inventory

| House | Source folder | Initial source character | Required modeling stance |
| --- | --- | --- | --- |
| Alpha | `testhouses/house-alpha/` | Richest folder: separate plan/elevation/section drawings plus expose, area/volume, drainage, site/legal, and administrative documents. | Treat as the primary calibration house. Use it to prove the full workflow can handle source authority, exterior views, sections, areas, volumes, drainage, and source-current-condition conflicts. |
| Beta | `testhouses/house-beta/` | Six-page scanned plan set: basement, ground floor, upper floor, sections, and exterior elevations for a new residential house on a sloped site. | Treat as the clean scanned-drawing benchmark. Emphasize visual page classification, scale/orientation recovery, terrain/building relationship, roof/elevation parity, and section reconstruction. |
| Gamma | `testhouses/house-gamma/` | Ten-page scanned drawing set for an existing or altered residential building, including floor plans, elevations, detailed sections, and detail-like roof/assembly pages. | Treat as the complex scanned-detail benchmark. Emphasize rotation/crop correction, assembly/details, facade and roof complexity, balconies, stair/level relationships, and section/detail recreation. |

### Alpha Documents

Initial role notes are based on the repository files and quick rendered-page
inspection. Exact filenames are preserved where the source folder uses German
characters.

| File | Initial role | Required use |
| --- | --- | --- |
| `Ansichten.pdf` | Exterior elevations/outside views. | Must drive source-equivalent outside view creation, facade opening placement, roof pitch/eaves/ridge, dormers, gable elevations, terrain line, and screenshot/overlay comparison. |
| `Grundrisse, Schnitt.pdf` | Combined historic plans and section. | Must drive level topology, target scope, dimensions, stair alignment, cross-section recreation, roof/level heights, and source-section overlay. |
| `EG.pdf` | Ground-floor drawing. | Must drive EG wall graph, rooms, openings, dimensions, and source plan overlay. |
| `DG.pdf` | Upper/attic-floor drawing. | Must drive DG wall graph, roof-slope implications, openings, room areas, and source plan overlay. |
| `Entwässerungsplan.pdf` | Drainage/site utility drawing. | Must drive drainage/context findings and expose missing authoring or evidence support. |
| `Wohnflächenberechnung.pdf` | Area calculation. | Must reconcile model room schedule and area rules. |
| `Umbauter Raum.pdf` | Volume calculation. | Must reconcile model volume/massing calculation. |
| `535_06 KH Exposé.pdf` | Expose/current-condition package. | Must be classified against drawings for current-condition conflicts, photos, areas, and user-visible evidence. |
| `5.11.1956 Baubeschreibung Weidenstr. 4.pdf` | Historic construction description. | Must inform materials, assemblies, construction year, and source-limited semantics. |
| Remaining legal/site/admin PDFs | Context, parcel, legal, costs, municipal responses. | Must be inventoried and classified; only model when they provide source-backed site, scope, parcel, or existing-condition facts. |

### Beta Documents

| File | Initial role | Required use |
| --- | --- | --- |
| `Grundrisse, Ansichten, Schnitt (1).pdf`, page 1 | Basement/lower-level plan with site boundaries and drainage notes. | Must drive basement model, site boundary context, terrain relationship, and source overlay. |
| Same PDF, page 2 | Ground-floor plan with site and terrace context. | Must drive EG wall graph, rooms, openings, terrace/context, and overlay. |
| Same PDF, page 3 | Upper-floor plan. | Must drive upper-floor topology, roof-facing rooms/openings, and overlay. |
| Same PDF, page 4 | Building/garage sections. | Must be recreated as source-equivalent section views and compared for level heights, roof, garage, terrain, and building cut. |
| Same PDF, pages 5-6 | Exterior elevations. | Must drive outside views for north/east/south/west style facade checking, roof pitch, openings, cladding, terrain line, and screenshot/overlay evidence. |

### Gamma Documents

| File | Initial role | Required use |
| --- | --- | --- |
| `Kannenofen.pdf`, pages 1-5 | Rotated scanned floor plans and plan-like pages. | Must drive page rotation/crop handling, floor topology, stair/core alignment, level relationships, dimensions, and overlays. |
| Same PDF, pages 6-8 | Exterior elevations and facade/roof views. | Must drive source-equivalent outside views, facade openings, balconies/guards, roof geometry, and visual parity checks. |
| Same PDF, pages 9-10 | Sections and construction/detail-like pages. | Must drive section recreation, roof/assembly/detail views, level heights, floor/roof layer assumptions, and methodology findings about detail extraction. |

## Required Product Additions

The current primary left sidebar already owns project navigation and top-level
view groups. This benchmark requires two additional navigation concepts so
agents and humans can inspect reverse-BIM houses like architects inspect a
drawing set.

| ID | Product gap | Requirement | Acceptance evidence |
| --- | --- | --- | --- |
| TH-UI-001 | Exterior/outside views are not first-class enough for reverse-BIM acceptance. | Add a primary-sidebar view group for exterior building views. It must expose named outside views such as front, rear, left gable, right gable, north, east, south, west, and any source-named facade view. These are not section cuts and must not be confused with intersection/section views. | A testhouse model can open exterior source-equivalent views from the primary sidebar, compare them to `Ansichten.pdf` or scanned elevation pages, and capture screenshots for evidence. |
| TH-UI-002 | Architectural detail views are not first-class enough for scanned sections/details. | Add a primary-sidebar view group for details or architectural detail views. It must expose source-derived detail/callout views such as roof eave, ridge, dormer, balcony/guard, stair, wall/floor/roof assembly, foundation, drainage interface, and facade opening details. | Gamma and beta can open detail views from primary navigation and attach source-page provenance, scale/crop, screenshots, and findings. |
| TH-UI-003 | Section views alone do not cover outside-view source evidence. | Keep sections as interior/cut views, and keep exterior views as orthographic outside views of the building envelope. The UI labels, icons, command palette entries, and view metadata must make that distinction obvious. | Section and exterior groups are both visible and searchable; opening an exterior view never creates a cut plane unless explicitly requested. |
| TH-UI-004 | Source-derived views need evidence state. | Exterior/detail/section rows in primary navigation should show compact evidence status: missing source link, source linked, screenshot captured, overlay compared, findings open, accepted. | At least one alpha exterior view and one beta/gamma section/detail row show evidence state during a run. |
| TH-UI-005 | Agents need view creation APIs that map source pages to UI navigation. | Provide or extend MCP/API surfaces to create/query exterior views and detail views with source-page refs, crop/scale, intended comparison type, and acceptance status. | Hybrid reverse-BIM runs can create the required views without manual UI-only setup and query them back for evidence reports. |

## Methodology Feedback Requirement

This tracker does not duplicate the methodology for every house. Each house
must be modeled according to the controlling hybrid reverse-BIM methodology.

The benchmark adds one explicit feedback requirement:

For every source section, elevation, exterior view, and architectural detail
found in a house folder, the agent must try to recreate an equivalent model
view and use it in the feedback loop. The recreated view must be compared to
the source page as evidence before the house can be accepted.

Required evidence per source-derived view:

- source document id, page, crop/region, and role;
- created model view id and view type;
- coordinate frame, scale, camera/elevation/section line/crop/depth metadata;
- screenshot path;
- overlay or visual comparison path when possible;
- deviations found;
- disposition: model repair, source-spec repair, tool gap, source conflict,
  source-limited, or accepted;
- finding ids linked back into this tracker.

## Sequential House Execution

Run the houses in this order:

1. Alpha.
2. Beta.
3. Gamma.

Alpha comes first because it has the richest document set and includes the
outside-view example that should shape the exterior-view UI. Beta follows as a
compact scanned drawing set with clear plans, sections, elevations, and sloped
site context. Gamma follows as the most demanding scanned-detail case.

The next house may start only after the current house has either:

- reached accepted model status under the methodology; or
- recorded explicit blockers and findings that explain why acceptance is not
  currently possible.

## House Alpha Tracker

Objective: model `testhouses/house-alpha/` according to the hybrid reverse-BIM
methodology and use it as the first full exterior-view/sidebar calibration run.

| ID | Work item | Status | Required result |
| --- | --- | --- | --- |
| TH-A-001 | Run global source preflight on the full alpha folder. | Open | Folder manifest, page rendering, document classification, authority ranking, and source-page index cover all alpha PDFs. |
| TH-A-002 | Resolve target scope and context. | Open | Explicit decision for full Doppelhaus, one half, one unit, or context geometry, including source-backed mask/boundary when applicable. |
| TH-A-003 | Establish levels and coordinate frames. | Open | KG/EG/DG/roof/terrain or equivalent levels are source-backed and aligned across plans, section, and elevations. |
| TH-A-004 | Extract source facts for plans. | Open | EG, DG, combined plans, cellar/basement where present, room names, dimensions, wall graphs, openings, stairs, and room areas become validated source facts. |
| TH-A-005 | Extract source facts for sections. | Open | Historic section is recreated as a model section with level heights, slab/roof relationships, stair/roof geometry, and overlay evidence. |
| TH-A-006 | Extract source facts for outside views. | Open | `Ansichten.pdf` yields front/rear/left gable/right gable or source-named exterior view facts, facade openings, roof/dormer/eave/ridge facts, and terrain-line checks. |
| TH-A-007 | Add/use primary-sidebar exterior views for alpha. | Open | Alpha exterior views are first-class navigation rows and can be opened, captured, and compared. |
| TH-A-008 | Add/use primary-sidebar detail views for alpha. | Open | Roof/dormer/eave, stair, foundation/basement, drainage interface, and facade opening details are represented when source evidence supports them. |
| TH-A-009 | Model levels and major topology through MCP. | Open | Live BIM contains real walls, slabs, rooms, openings, and stairs for all source-required levels; no empty source-required level remains. |
| TH-A-010 | Model roof, dormers, elevations, and exterior envelope through MCP. | Open | Roof pitch, eaves, ridge, dormers, gable faces, facade openings, and exterior heights match outside views and sections. |
| TH-A-011 | Model site, parcel, terrain, drainage/context where source-backed. | Open | Site facts are modeled or explicitly source-limited; drainage and parcel facts produce findings if tooling is insufficient. |
| TH-A-012 | Reconcile areas and volumes. | Open | Room/area schedule and volume/massing checks are compared against `Wohnflaechenberechnung.pdf` and `Umbauter Raum.pdf`. |
| TH-A-013 | Run per-slice readback, Advisor, constructability, integrity, physical topology, and visual evidence gates. | Open | Every failing finding is repaired or dispositioned; tolerances are only source-backed existing conditions. |
| TH-A-014 | Final alpha acceptance or blocker closeout. | Open | Alpha is either accepted with evidence, or blockers/findings are complete enough to improve methodology/software before beta starts. |

### Alpha Findings

| Finding ID | Status | Category | Evidence | Decision / next action |
| --- | --- | --- | --- | --- |
| TH-A-F001 | Open | Initial source observation | `Ansichten.pdf` is the canonical outside-view example and contains multiple exterior facade views on one scanned/photo page. | Exterior views must be first-class source-equivalent views, not treated as sections. |
| TH-A-F002 | Open | Initial source observation | Alpha has separate area and volume PDFs plus plans/elevations/section. | Acceptance must include schedule reconciliation, not only visual geometry. |

## House Beta Tracker

Objective: model `testhouses/house-beta/` according to the hybrid reverse-BIM
methodology and use it as the scanned plan/elevation/section benchmark.

| ID | Work item | Status | Required result |
| --- | --- | --- | --- |
| TH-B-001 | Run global source preflight on the beta PDF. | Open | All six scanned pages are rendered, classified by page, rotated/cropped if needed, and indexed with page roles. |
| TH-B-002 | Resolve source scale, orientation, and site frame. | Open | Plans, sections, elevations, site boundary, north arrow, and sloped terrain share a usable coordinate frame or explicit blockers. |
| TH-B-003 | Extract basement, ground-floor, and upper-floor source facts. | Open | Wall graphs, rooms, stairs, garage/terrace/context, openings, and dimensions are validated per page. |
| TH-B-004 | Recreate beta sections from page 4. | Open | Building and garage sections are modeled as source-equivalent section views with terrain/building/roof comparisons. |
| TH-B-005 | Recreate beta outside views from pages 5-6. | Open | Exterior views for the source-named orientations are first-class primary-sidebar rows with facade/roof/terrain comparison evidence. |
| TH-B-006 | Model beta house through MCP slices. | Open | Basement, EG, upper floor, roof, garage/context, terrain relation, openings, and stairs are live-authored and queried back. |
| TH-B-007 | Validate sloped-site and building interface. | Open | Terrain/toposolid, building pad/excavation, basement exposure, garage relation, and exterior grade lines are checked visually and structurally. |
| TH-B-008 | Final beta acceptance or blocker closeout. | Open | Beta is accepted with evidence, or blockers/findings are complete enough to improve methodology/software before gamma starts. |

### Beta Findings

| Finding ID | Status | Category | Evidence | Decision / next action |
| --- | --- | --- | --- | --- |
| TH-B-F001 | Open | Initial source observation | Beta is a compact six-page scan set with page-level plans, sections, and exterior elevations. | Page-level visual classification and source-derived view creation must work without relying on native PDF text. |
| TH-B-F002 | Open | Initial source observation | Beta sections/elevations show a sloped terrain/building relationship. | Acceptance must fail if terrain/building placement is flat, mirrored, offset, or missing the basement/garage exposure relationship. |

## House Gamma Tracker

Objective: model `testhouses/house-gamma/` according to the hybrid reverse-BIM
methodology and use it as the scanned detail/complex-elevation benchmark.

| ID | Work item | Status | Required result |
| --- | --- | --- | --- |
| TH-G-001 | Run global source preflight on the gamma PDF. | Open | All ten pages are rendered, page-rotated/cropped, classified, and indexed with plan/elevation/section/detail roles. |
| TH-G-002 | Resolve drawing rotations, scale, and coordinate frames. | Open | Rotated scans do not leak into wrong model orientation; source pages align to usable model frames or block with findings. |
| TH-G-003 | Extract floor plan source facts. | Open | All floor levels, walls, openings, stairs, balconies/context, dimensions, and source-required rooms become validated facts. |
| TH-G-004 | Extract exterior/facade source facts. | Open | Facades, roof forms, balconies/guards, window/door rhythms, and facade heights become exterior-view facts. |
| TH-G-005 | Extract section and detail source facts. | Open | Sections and detail-like roof/assembly pages become model section/detail view requirements with evidence rows. |
| TH-G-006 | Add/use primary-sidebar detail views for gamma. | Open | Roof, facade, balcony/guard, stair/core, wall/floor/roof assembly, and foundation details are navigable and evidence-backed when source-supported. |
| TH-G-007 | Model gamma through MCP slices. | Open | Live BIM contains all source-required levels, exterior envelope, stairs, roof, balconies/guards, details, and schedule/metadata support available from source. |
| TH-G-008 | Validate section/detail recreation. | Open | Every source section/detail page has an attempted source-equivalent model view, screenshot/comparison, and deviations/findings. |
| TH-G-009 | Final gamma acceptance or blocker closeout. | Open | Gamma is accepted with evidence, or blockers/findings are complete enough to improve methodology/software. |

### Gamma Findings

| Finding ID | Status | Category | Evidence | Decision / next action |
| --- | --- | --- | --- | --- |
| TH-G-F001 | Open | Initial source observation | Gamma scan pages are often rotated and include plan, elevation, section, and detail-like content. | Preflight must treat crop/rotation/page role as hard source-understanding work, not cosmetic cleanup. |
| TH-G-F002 | Open | Initial source observation | Gamma includes detailed facade/roof/section information beyond ordinary floor plans. | Detail views must become first-class inspection surfaces for reverse-BIM learning. |

## Cross-House Finding Ledger

Agents must append to this ledger whenever a finding applies to more than one
house or changes the methodology/product roadmap.

| Finding ID | Status | Applies to | Category | Finding | Required follow-up |
| --- | --- | --- | --- | --- | --- |
| TH-X-F001 | Open | Alpha, Beta, Gamma | Product/UI | Reverse-BIM acceptance needs exterior/outside views as primary navigation peers, distinct from sections. | Implement exterior view group, MCP/API view creation/query, command palette reachability, evidence state, and screenshot/overlay validation. |
| TH-X-F002 | Open | Alpha, Beta, Gamma | Product/UI | Reverse-BIM acceptance needs detail/callout views for architectural details and source assembly pages. | Implement detail view group, source-page provenance, crop/scale metadata, evidence state, and model/source comparison workflow. |
| TH-X-F003 | Open | Alpha, Beta, Gamma | Methodology/evidence | Source sections and elevations must be recreated as model views and compared, not merely read as supporting facts. | Ensure hybrid runs emit required view-capture plans for every source section, elevation, exterior view, and detail page. |
| TH-X-F004 | Open | Alpha, Beta, Gamma | Source reading | Native PDF text is insufficient for these folders; scans and photo-like pages require visual page understanding. | Strengthen visual reader dispatch, page role refinement, crop/rotation handling, and reader consensus for critical geometry. |
| TH-X-F005 | Open | Alpha, Beta, Gamma | Acceptance | "Advisor-clean" remains insufficient if source-equivalent views visibly mismatch. | Final acceptance must include plan, exterior, section, detail, 3D, and schedule evidence with deviations dispositioned. |

## Completion Criteria

This tracker is complete only when:

- alpha, beta, and gamma have each reached accepted model status or explicit
  blocker closeout;
- all house-specific findings discovered during the runs are recorded here;
- cross-house findings have methodology or software follow-ups;
- primary-sidebar exterior and detail view requirements have implementation
  workpackages or completed evidence;
- every source plan, exterior view/elevation, section, and detail that could be
  identified has either a recreated model view with comparison evidence or a
  source/tool blocker;
- the final summary states what the methodology can do today, what it cannot
  do yet, and what product changes are required before the next real-house
  benchmark.
