# Testhouse Hybrid Reverse-BIM Execution Tracker

Last updated: 2026-05-22

Status: **Iteration-1 blocker closeout.** Run 1 completed the full source
preflight and an initial multimodal-reader pass against each of `house-alpha`,
`house-beta`, and `house-gamma`, lifted alpha + beta to
`source_understanding_blocked`, and landed the TH-UI-001..005 sidebar /
MCP-descriptor additions. The houses did not reach accepted-model status — the
tracker now reflects the truth, including which methodology and software gaps
must close before iteration 2.

This tracker turns the `testhouses/` folders into a sequential learning
benchmark for `claude-skills/hybrid-reverse-bim`.

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
| TH-UI-001 | Exterior/outside views are not first-class enough for reverse-BIM acceptance. | Add a primary-sidebar view group for exterior building views. It must expose named outside views such as front, rear, left gable, right gable, north, east, south, west, and any source-named facade view. These are not section cuts and must not be confused with intersection/section views. | A testhouse model can open exterior source-equivalent views from the primary sidebar, compare them to `Ansichten.pdf` or scanned elevation pages, and capture screenshots for evidence. **Landed (iteration 1).** Renamed the existing first-class `elevation_view` group in the project browser to "Exterior Views" with a tooltip describing the distinction from sections and the source-named facades (front/rear/left gable/right gable/N/E/S/W). N/S/E/W generator preserved. Group exposes `data-th-ui="exterior-views-group"` for tests. See `packages/web/src/workspace/project/ProjectBrowser.tsx`. |
| TH-UI-002 | Architectural detail views are not first-class enough for scanned sections/details. | Add a primary-sidebar view group for details or architectural detail views. It must expose source-derived detail/callout views such as roof eave, ridge, dormer, balcony/guard, stair, wall/floor/roof assembly, foundation, drainage interface, and facade opening details. | Gamma and beta can open detail views from primary navigation and attach source-page provenance, scale/crop, screenshots, and findings. **Landed (iteration 1).** New "Detail Views" sidebar group filters `plan_view` elements with `planViewSubtype === 'callout'`, with `+` action that creates a callout `plan_view` on the first level. Carries `data-th-ui="detail-views-group"` and `data-testid="project-browser-detail-views-group"`. Reverse-BIM source detail pages (eave/ridge/dormer/balcony/stair/assembly/foundation/drainage/facade-opening) all land here. Promotion to a dedicated `detail_view` element kind tracked as [[TH-X-F006]]. |
| TH-UI-003 | Section views alone do not cover outside-view source evidence. | Keep sections as interior/cut views, and keep exterior views as orthographic outside views of the building envelope. The UI labels, icons, command palette entries, and view metadata must make that distinction obvious. | Section and exterior groups are both visible and searchable; opening an exterior view never creates a cut plane unless explicitly requested. **Landed (iteration 1).** "Sections & elevations" group renamed to "Sections" (cuts only) and carries `data-th-ui="sections-group"`; "Exterior Views" is a separate sibling group. Both tooltips explicitly state the distinction. The existing `elevation_view` kind has always been distinct from `section_cut` in the data model, so the UI now mirrors that. Icon refresh and command-palette parity are tracked as polish in [[TH-X-F007]]. |
| TH-UI-004 | Source-derived views need evidence state. | Exterior/detail/section rows in primary navigation should show compact evidence status: missing source link, source linked, screenshot captured, overlay compared, findings open, accepted. | At least one alpha exterior view and one beta/gamma section/detail row show evidence state during a run. **Landed as UI-stub (iteration 1).** A `SourceEvidencePill` component renders on every `section_cut`, `elevation_view`, and detail (callout `plan_view`) row showing the six tracker states with explicit tooltips. State is currently derived from a name heuristic (`[accepted]`, `[overlay]`, `[shot]`, `src:` markers) so the UI works end-to-end before a backing schema lands. Persistent backing via a new `source_view_evidence` element kind is the next-iteration work, tracked as [[TH-X-F006]]. Rows expose `data-th-ui-evidence-state`, `data-th-ui-evidence-category`, and `data-th-ui-evidence-view-id` for tests. |
| TH-UI-005 | Agents need view creation APIs that map source pages to UI navigation. | Provide or extend MCP/API surfaces to create/query exterior views and detail views with source-page refs, crop/scale, intended comparison type, and acceptance status. | Hybrid reverse-BIM runs can create the required views without manual UI-only setup and query them back for evidence reports. **Landed as descriptor-only (iteration 1).** Added MCP/API tool descriptors `reverse_bim.exterior_view_create`, `reverse_bim.detail_view_create`, `reverse_bim.section_view_create`, and `reverse_bim.source_view_evidence_upsert` in `app/bim_ai/api/descriptors/source_reverse_bim.py`. The first three wrap the existing kernel commands (`createElevationView`, `upsertPlanView` with callout subtype, `createSectionCut`) and accept source-page provenance arguments. The evidence-upsert tool references a kernel command (`upsertSourceViewEvidence`) whose Pydantic/engine backing has not yet shipped — this is the same backing work as [[TH-X-F006]]. |

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
| TH-A-001 | Run global source preflight on the full alpha folder. | **Done** | `source.prepare_ai_visual_trace_run` + `reverse_bim.folder_output` against `testhouses/house-alpha/` produced a 16-document manifest (`source-manifest.json`), 68 rendered pages at 160 DPI, document classifications, native text extractions, source-page index, AI visual trace packet, work order with 6 work packages, 12 reader requests, and 20 reader assignments (2 critical packages × 2 independent reader passes). Artifacts under `tmp/reverse-bim/house-alpha/source/` and `tmp/reverse-bim/house-alpha/ai-reading/`. See finding [[TH-A-F003]] for low-DPI dimension legibility. |
| TH-A-002 | Resolve target scope and context. | **Blocked** | Both reader passes converged on a conflict: the 1956 ENTWURF (`EG.pdf`, `DG.pdf`, `Grundrisse, Schnitt.pdf`) depicts the full Doppelhaus by Firma Arnold Reinecke, while the Exposé pages 14-16 in `535_06 KH Exposé.pdf` and the modern photos in expose page 9 show only one half (the present east-half unit). Folder-output acceptance reports `buildingScopeBlockerCount=2`. Resolving target requires an explicit `scopeDecisions` disposition + a source-backed mask; see finding [[TH-A-F004]]. |
| TH-A-003 | Establish levels and coordinate frames. | **Partially blocked** | KG/EG/DG levels were source-asserted by both reader passes (3 level facts each). Acceptance reports `missingSourceLevelFacts=1` (KG plan is only present in the Exposé and not dimensioned in the 1956 set) and `coordinateFrameAlignmentBlockerCount=4` (the 1956 plans, the modern Exposé plans, and the section/elevation pages need control-point alignment to a shared model frame). Coordinate-frame worklist artifact at `understanding/coordinate-frame-worklist.json`. |
| TH-A-004 | Extract source facts for plans. | **Done (initial pass)** | Two independent reader passes (`reader-pass-01` + `reader-pass-02`) on `wp-dimensional-floorplans` produced 50 + 55 = 105 source facts spanning building_scope, level, wall_chain, wall_thickness, room (27 + 18), opening, stair, slab_opening, area, and conflict kinds. Response files under `ai-reading/responses/reader-pass-0{1,2}/...wp-dimensional-floorplans.json`. 9 alpha area-consistency checks remain blocked (see [[TH-A-F005]]). |
| TH-A-005 | Extract source facts for sections. | **Done (initial pass)** | Reader pass-01 + pass-02 on `wp-sections-elevations-roof` produced 29 + 40 = 69 facts including roof type (Satteldach/Pfettendach), pitch (~48-50°), eave (~5.0-5.3 m), ridge (~6.875 m above EG-FFL), per-facade openings, two Schleppgaube dormers on long slopes, and ridge chimney. Section recreation as a model section is deferred until coordinate-frame alignment lands ([[TH-A-F004]]). |
| TH-A-006 | Extract source facts for outside views. | **Done (initial pass)** | Same reader pair identified all four 1956 elevation panels by source name (`BERG-ANSICHT`, `LINKE GIEBELANSICHT`, `TAL-ANSICHT`, `RECHTE GIEBELANSICHT`). German `Berg/Tal` orient the long facades up-/down-slope rather than N/S/E/W; expressing them in cardinal directions requires a site/orientation fact pass ([[TH-A-F006]]). |
| TH-A-007 | Add/use primary-sidebar exterior views for alpha. | **Infra-ready, model-blocked** | TH-UI-001 sidebar group landed and `reverse_bim.exterior_view_create` MCP descriptor exists. No alpha model has been authored yet, so no exterior `elevation_view` rows can be created on the model side. Will be done in iteration 2 after [[TH-A-F004]] resolves and an alpha model is authored. |
| TH-A-008 | Add/use primary-sidebar detail views for alpha. | **Infra-ready, model-blocked** | TH-UI-002 Detail Views sidebar group landed. Source detail pages in alpha are limited (no detail-page roles in this folder); detail views will be created in iteration 2 if/when the source spec calls for eave/dormer/foundation details and an alpha model exists. |
| TH-A-009 | Model levels and major topology through MCP. | **Blocked on TH-A-002/003** | 45 facts are MCP-ready in folder-output, but the building-scope and coordinate-frame blockers prevent authoring (`packageState: source_understanding_blocked`). Authoring would risk modeling the wrong building, which the hybrid-reverse-bim methodology explicitly forbids. |
| TH-A-010 | Model roof, dormers, elevations, and exterior envelope through MCP. | **Blocked on TH-A-009** | `roofDormerBlockerCount=11` open in folder-output acceptance — section/elevation alignment + precise source geometry required. |
| TH-A-011 | Model site, parcel, terrain, drainage/context where source-backed. | **Blocked** | `siteTerrainBlockerCount=1`; the 16 non-plan PDFs (`Entwässerungsplan.pdf`, `Grundstücksflächen_Timonline.pdf`, `GB v_ Schalksmühle Blatt 218…`, parcel/legal/admin docs) generated 4 reader-assignment parts for `wp-site-parcel-terrain` (12+12+12+10 images = 46 pages) and a 1-image `wp-drainage-services` assignment, both of which were not dispatched in iteration 1 — see [[TH-A-F007]]. |
| TH-A-012 | Reconcile areas and volumes. | **Blocked** | `wp-area-volume-schedules` (`Wohnflächenberechnung.pdf` + `Umbauter Raum.pdf`) has 2 reader-assignment parts (12 + 5 images) that were not dispatched in iteration 1. `sourceAreaConsistencyBlockerCount=9`. See [[TH-A-F007]]. |
| TH-A-013 | Run per-slice readback, Advisor, constructability, integrity, physical topology, and visual evidence gates. | **Blocked on TH-A-009..012** | No live model yet; gates cannot run. |
| TH-A-014 | Final alpha acceptance or blocker closeout. | **Blocker closeout (iteration 1)** | Alpha closes iteration 1 with: package state `source_understanding_blocked`, 174 normalized facts (45 MCP-ready), 19 open conflicts, 11 open blockers, 65 open repair requests, full source-repair plan at `ai-reading/source-repair-plan.md`, and findings TH-A-F001..F008 + cross-house findings recorded. Iteration 2 is unblocked by: scope decision ([[TH-A-F004]]), dispatching the remaining 16 reader assignments ([[TH-A-F007]]), and a higher-DPI re-render ([[TH-A-F003]]). |

### Alpha Findings

| Finding ID | Status | Category | Evidence | Decision / next action |
| --- | --- | --- | --- | --- |
| TH-A-F001 | Resolved (iteration 1) | Initial source observation | `Ansichten.pdf` is the canonical outside-view example and contains multiple exterior facade views on one scanned/photo page. | Confirmed: `Ansichten.pdf` p.1 holds four labelled panels — `BERG-ANSICHT`, `LINKE GIEBELANSICHT`, `TAL-ANSICHT`, `RECHTE GIEBELANSICHT`. The new "Exterior Views" sidebar group is the home for these once a model is authored. Closed: drives TH-UI-001 acceptance and feeds [[TH-A-F006]] for cardinal-direction mapping. |
| TH-A-F002 | Open | Initial source observation | Alpha has separate area and volume PDFs plus plans/elevations/section. | Acceptance must include schedule reconciliation, not only visual geometry. The `wp-area-volume-schedules` work package was not dispatched in iteration 1 (see [[TH-A-F007]]); area/volume reconciliation deferred to iteration 2. |
| TH-A-F003 | Open | Source quality | Reader pass-01 + pass-02 both reported that explicit dimension chains along the bottom and right edges of `EG.pdf` / `DG.pdf`, room-area handwriting on Exposé floor plans, section heights on `Grundrisse, Schnitt.pdf`, and Ansichten dimension strings are partially smeared/illegible at 160 DPI. Most wall thicknesses had to be inferred from era convention (365 mm exterior / 240 mm party / 115 mm partition) with confidence 0.4-0.55. | Re-render the critical pages at ≥300 DPI before iteration 2 reader dispatches: `source.render_pdf_pages --dpi 300` for `EG.pdf`, `DG.pdf`, `Grundrisse, Schnitt.pdf`, `Ansichten.pdf`, `Wohnflächenberechnung.pdf`, `Umbauter Raum.pdf`. Recurring failure mode worth a methodology note: low-DPI renders silently degrade dimensional source facts. |
| TH-A-F004 | Open | Source / scope | Reader passes converged on a hard scope conflict: 1956 plans show full Doppelhaus, Exposé pages 14-16 + page-9 photos show one half (current as-is). Both passes flagged this as a `scope_unresolved` conflict; `folder_output.summary.buildingScopeBlockerCount=2`. Modeling either scope without an explicit decision risks authoring the wrong building. | Add a `scopeDecisions` disposition to the next folder-output call: `decision=target_half`, `reason=current-as-is unit matches Exposé and modern photos`, `evidence={Exposé page 14-16, page 9 photos}`, and a source-backed mask (party-wall axis line in mm) before authoring. Then re-run `reverse_bim.source_building_scope` and `reverse_bim.folder_output`. |
| TH-A-F005 | Open | Source / area reconciliation | Reader pass-02 raised an as-designed vs as-is program conflict: 1956 EG has Garage + Speisekammer + Flur; current Exposé EG replaces that with Bad/WC, Küche, Kinderzimmer. 9 area-consistency checks remain blocked because the area schedule rows have not been bound to a unique room boundary set. | Resolve in iteration 2 by (a) deciding which phase the target model represents (likely as-is current condition based on [[TH-A-F004]]); (b) dispatching the `wp-area-volume-schedules` reader assignment so `Wohnflächenberechnung.pdf` / `Umbauter Raum.pdf` produce reconcilable area facts; (c) reopening conflicting plan facts via `reverse_bim.source_spec_revision`. |
| TH-A-F006 | Open | Source / orientation | Both reader passes confirmed the 1956 elevations are labelled in German `Berg/Tal/Linke/Rechte` (hillside/valley/left/right gable) rather than N/S/E/W. Cardinal mapping cannot be inferred from these labels alone — it requires the site plans (`GB v_ Schalksmühle Blatt 218…`, `Grundstücksflächen_Timonline.pdf`) and a north arrow. | Iteration 2: dispatch `wp-site-parcel-terrain` reader assignments so cardinal direction can be derived. Until then, exterior views are correctly named by source label (`Berg-Ansicht`, etc.) per TH-UI-001, and `direction='custom'` with `customAngleDeg` set per source-derived facade angle. |
| TH-A-F007 | Open | Methodology coverage | Iteration 1 dispatched only the 4 highest-priority reader assignments (`wp-dimensional-floorplans` × 2, `wp-sections-elevations-roof` × 2). 16 reader assignments remain `waiting_for_reader` across `wp-current-condition` (3 parts × 2 passes = 6), `wp-site-parcel-terrain` (4 parts × 2 passes = 8), `wp-area-volume-schedules` (2 parts × 2 passes = 4 — note inputs ready), and `wp-drainage-services` (1 × 1 = 1). | Iteration 2 must dispatch the missing assignments before MCP authoring. Recommendation: parallelize via 8 subagents per wave, accept human/subagent reads, run `reverse_bim.folder_output` after each wave. |
| TH-A-F008 | Open | Methodology / reader-pass-id parity | The reader-pass-manifest expects 2 independent passes for `wp-sections-elevations-roof`. Iteration 1 ran pass-01 + pass-02 for floorplans but only pass-01 for `wp-sections-elevations-roof` (consensus pair filled, but the actual assignment file for sections pass-02 already existed and was not dispatched). | Iteration 2: dispatch the alpha sections-elevations-roof pass-02 assignment for consensus before accepting the package. |

## House Beta Tracker

Objective: model `testhouses/house-beta/` according to the hybrid reverse-BIM
methodology and use it as the scanned plan/elevation/section benchmark.

| ID | Work item | Status | Required result |
| --- | --- | --- | --- |
| TH-B-001 | Run global source preflight on the beta PDF. | **Done with classifier gap** | `source.prepare_ai_visual_trace_run` + `reverse_bim.folder_output` against `testhouses/house-beta/` rendered all 6 pages of `Grundrisse, Ansichten, Schnitt (1).pdf` at 160 DPI. **Critical finding [[TH-B-F003]]**: document-level classification assigned `floor_plan` to the whole PDF because of the filename; only `wp-dimensional-floorplans` and `wp-sections-elevations-roof` received images, and even those received all 6 pages. Pages 4 (sections), 5 (Ost/Nord elevations), and 6 (Süd/West elevations) were routed to the floor plans assignment and flagged by both reader passes as `page_role_misclassified` conflicts. Page-level visual classification is required. |
| TH-B-002 | Resolve source scale, orientation, and site frame. | **Partially done** | Both passes converged on Bauherr Srichander Ramaswamy, Architekt Boss, Emattweg, Rickenbach-Hütten (1:100, 27.09.07). Site frame established: BEZ 843.50 m üNN for the house, garage at 843.20 m üNN (~30 cm below), terrain drops ~5 m across the parcel. North arrow not explicitly captured in iteration 1 reads. `coordinateFrameAlignmentBlockerCount=6` remains. |
| TH-B-003 | Extract basement, ground-floor, and upper-floor source facts. | **Done (initial pass)** | Two independent reader passes on `wp-dimensional-floorplans` produced 38 + 54 = 92 source facts spanning the three storeys: KG (Untergeschoss, ~ -2.86 m), EG (±0.00 = 843.80 üNN), DG with three Velux-style DFF skylights. Rooms identified: KG (Vorrat, DU/WC, Vorraum, Arbeiten, Gast, Technik, Geräte), EG (Küche, Diele, DU/WC, Gast, Wohnen/Essen, Garage, Balkon), DG (Schlafen, Bad, Flur, 2× Kind). Exterior walls 300-317 mm, interior partitions ~122 mm. Wohnflächenberechnung schedule not in source — see [[TH-B-F004]]. |
| TH-B-004 | Recreate beta sections from page 4. | **Source-read, model-blocked** | Reader pass-01 of `wp-sections-elevations-roof` captured 21 facts including `Schnitt Gebäude` and `Schnitt Garage`: main roof `Pfettendach` at 30°, Kniestock 125 cm, EG 843.80, UG 840.96, DG 846.77, garage Vordach 30°, flat green-roof garage (`FLD-extensive Begrünung`) at 2% fall, southern shed dormer (DFF). Sloped-site relationships and walk-out basement geometry captured. Model section recreation is blocked on TH-B-006/007. |
| TH-B-005 | Recreate beta outside views from pages 5-6. | **Source-read, model-blocked** | Same reader pass-01 identified all four elevations by source label (`OSTEN` street side at Strasse Emattweg, `NORDEN`, `SÜDEN` with BEZ 843.50 reference, `WESTEN` with existing vs proposed grade lines). Sloped-site terrain captures left vs right ground elevation per facade — basement exposed on south/west, hidden on east/north. Modeling deferred to iteration 2. |
| TH-B-006 | Model beta house through MCP slices. | **Blocked** | 53 facts MCP-ready; package state `source_understanding_blocked` due to: 1 building-scope blocker, 2 missing source-required levels (KG and DG elevations under-cited), 6 coordinate-frame alignments needed, 8 roof/dormer blockers, 18 material-assembly scopes lacking source-backed layer facts, 37 missing room access refs, 48 missing adjacent-room refs. Authoring blocked by methodology gate. |
| TH-B-007 | Validate sloped-site and building interface. | **Blocked on TH-B-006** | Source facts are rich (BEZ 843.50, 843.20, 840.00, 838.00 üNN explicit) but no model exists yet. Iteration 2 toposolid authoring with explicit walk-out basement detail is the path. |
| TH-B-008 | Final beta acceptance or blocker closeout. | **Blocker closeout (iteration 1)** | Beta closes iteration 1 with: package state `source_understanding_blocked`, 113 normalized facts (53 MCP-ready), 22 open conflicts, 11 open blockers. Findings TH-B-F001..F005 + cross-house findings recorded. Iteration 2 needs the page-level classifier ([[TH-B-F003]]), area schedule reader ([[TH-B-F004]]), and a higher-DPI re-render. |

### Beta Findings

| Finding ID | Status | Category | Evidence | Decision / next action |
| --- | --- | --- | --- | --- |
| TH-B-F001 | Confirmed (iteration 1) | Initial source observation | Beta is a compact six-page scan set with page-level plans, sections, and exterior elevations. | Confirmed in iteration 1: pages 1-3 are KG/EG/DG plans, page 4 is two sections (Gebäude + Garage), pages 5-6 are four elevations (Ost/Nord, Süd/West). Reinforces [[TH-B-F003]] — page-level classification is mandatory for compound scan sets. |
| TH-B-F002 | Confirmed (iteration 1) | Initial source observation / acceptance criterion | Beta sections/elevations show a sloped terrain/building relationship. | Reader pass-01 captured concrete sloped-site evidence: BEZ 843.50 (house), 843.20 (garage), 840.00 / 838.00 üNN (parcel reference points), Süden / Westen elevations show existing vs proposed grade lines with the basement exposed on the south/west side. Iteration 2 toposolid authoring must reproduce this; visual-geometry gate must reject a flat or mirrored terrain. |
| TH-B-F003 | Open | Methodology / classifier defect | `reverse_bim.folder_output.summary.classificationCounts={floor_plan: 1}` for `Grundrisse, Ansichten, Schnitt (1).pdf`. The whole 6-page PDF is classified as a single floor-plan document because the heuristic is filename + first-page based. The two work packages that ran (`wp-dimensional-floorplans`, `wp-sections-elevations-roof`) both received all 6 pages, and pages 4-6 were routed to the floor-plans assignment, where both reader passes raised `page_role_misclassified` conflicts. | Add per-page visual classification to `source.classify_documents` (or a new `source.classify_pages` step) for any PDF where the document classifier is `unknown` or where the page-count exceeds the role's expected size. Page-level classification must use the rendered PNGs, not native text (the scans have no extractable text). Recurrence shows up in [[TH-G-F003]] too. |
| TH-B-F004 | Open | Source coverage / area reconciliation | Beta has no explicit Wohnflächenberechnung schedule in the source folder, but plans carry room labels with room-number prefixes (014, 033, 026, etc.) consistent with an external schedule. Both reader passes returned area facts as `null` because room area values were not visible at 160 DPI. | Iteration 2: re-render plan pages at 300 DPI to recover handwritten/typeset room areas; if still missing, mark area facts `source_unavailable` with explicit disposition so the area-reconciliation gate can be cleared rather than blocked. |
| TH-B-F005 | Open | Methodology / single-pass coverage | Beta `wp-sections-elevations-roof` only ran reader pass-01 in iteration 1. The reader-pass-manifest lists `reader-pass-02` for the same package as `waiting_for_reader`. | Iteration 2: dispatch `reader-pass-02` for beta sections/elevations/roof before accepting consensus on roof type (Pfettendach), pitch (30°), Kniestock (125 cm), and the sloped terrain/building relationship. |

## House Gamma Tracker

Objective: model `testhouses/house-gamma/` according to the hybrid reverse-BIM
methodology and use it as the scanned detail/complex-elevation benchmark.

| ID | Work item | Status | Required result |
| --- | --- | --- | --- |
| TH-G-001 | Run global source preflight on the gamma PDF. | **Done with hard classifier failure** | `source.prepare_ai_visual_trace_run` rendered all 10 pages of `Kannenofen.pdf` at 160 DPI and built the source registry. **Critical finding [[TH-G-F003]]**: document classification returned `{classificationCounts: {unknown: 1}}` because the filename gives no hint and the document classifier is not page-level. As a result, 5 of 6 work packages (`wp-dimensional-floorplans`, `wp-sections-elevations-roof`, `wp-site-parcel-terrain`, `wp-area-volume-schedules`, `wp-drainage-services`) returned `status: missing_inputs` with 0 images each; only `wp-current-condition` received the 10 pages because that work package accepts any pages. |
| TH-G-002 | Resolve drawing rotations, scale, and coordinate frames. | **Blocked on TH-G-001** | Cannot run coordinate-frame worklist until page roles are known. Tracker initial finding TH-G-F001 (rotated scans) was confirmed by the gamma rescue subagent — see [[TH-G-F004]]. |
| TH-G-003 | Extract floor plan source facts. | **Run via rescue reader (iteration 1)** | Because the system-side dispatcher could not route plan pages to `wp-dimensional-floorplans`, iteration 1 dispatched a single "rescue" reader subagent that read all 10 pages and classified per-page roles, captured rotation state, and emitted 70 facts under a single consolidated response file. Source identified: 1993 Doppelhaushälfte + Praxis at Am Kannenofen 45, Siegburg, by Dipl.-Ing. Uwe Berkemeyer; client Winkelmeier-Hoetter; 9 drawing sheets at 1:50 + 1 cover letter. Per-page roles: p1 KG, p2 EG (Praxis), p3 OG (Wohnen), p4 DG (Kinder), p5 Spitzboden+Flachdach, p6 Strassenansicht + Detail Flachdach 1:10, p7 Eingangsansicht, p8 Gartenansicht + Detail Dachgaube 1:10, p9 Schnitt A-A + B-B, p10 cover letter. Floor-plan facts: 5 levels (KG/EG/OG/DG/Spitzboden) with OKFFB heights, 22 named rooms across all storeys, exterior wall thickness ~30 cm, footprint rectangle + rear polygonal bay. Output at `tmp/reverse-bim/house-gamma/ai-reading/responses/reader-pass-01/ai-visual-run-gamma-001-wp-all-rescue.json` + `gamma-page-classification-notes.md`. Folder-output normalization of the rescue file is iteration-2 work — see [[TH-G-F003]] and [[TH-X-F009]]. |
| TH-G-004 | Extract exterior/facade source facts. | **Run via rescue reader (iteration 1)** | Same rescue subagent extracted 3 elevation facts (Strassenansicht, Eingangsansicht, Gartenansicht) plus dormer (2× Schleppgaube), roof (gable ~45° + Flachdach on Spitzboden, ridge +11.39 m), and per-facade opening rhythm. |
| TH-G-005 | Extract section and detail source facts. | **Run via rescue reader (iteration 1)** | Same rescue subagent extracted Schnitt A-A and B-B section facts plus 2 detail observations (Flachdach 1:10 + Dachgaube 1:10) and 5 material/layer facts including roof Kniestock area. |
| TH-G-006 | Add/use primary-sidebar detail views for gamma. | **Infra-ready, model-blocked** | TH-UI-002 Detail Views sidebar group landed and `reverse_bim.detail_view_create` MCP descriptor exists. No gamma model exists yet. |
| TH-G-007 | Model gamma through MCP slices. | **Blocked** | Folder-output cannot accept the rescue reader's per-package fact distribution until the per-page classifier ([[TH-G-F003]]) routes pages to the matching work packages. Until then `wp-dimensional-floorplans` etc. remain `missing_inputs` and authoring is blocked by the methodology gate. |
| TH-G-008 | Validate section/detail recreation. | **Blocked on TH-G-007** | No live model yet. |
| TH-G-009 | Final gamma acceptance or blocker closeout. | **Blocker closeout (iteration 1)** | Gamma closes iteration 1 with: package state `source_understanding_blocked` (folder-output re-run with rescue file on disk), 70 normalized facts (rescue), 0 MCP-ready facts, 6 open conflicts, 6 open blockers, rescue response indexed as `status=missing_inputs` because the per-page routing did not match (see [[TH-G-F005]]). The critical iteration-2 blockers are the page-level classifier ([[TH-G-F003]] / [[TH-X-F008]]) and response routing ([[TH-G-F005]] / [[TH-X-F009]]). Without those, the rescue facts cannot enter the consolidated source spec. Findings TH-G-F001..F007 + cross-house findings recorded. |

### Gamma Findings

| Finding ID | Status | Category | Evidence | Decision / next action |
| --- | --- | --- | --- | --- |
| TH-G-F001 | Open | Initial source observation | Gamma scan pages are often rotated and include plan, elevation, section, and detail-like content. | Preflight must treat crop/rotation/page role as hard source-understanding work, not cosmetic cleanup. Reaffirmed in iteration 1 by [[TH-G-F004]]. |
| TH-G-F002 | Open | Initial source observation | Gamma includes detailed facade/roof/section information beyond ordinary floor plans. | Detail Views sidebar group (TH-UI-002) now exists to host these. Modeling deferred until [[TH-G-F003]] resolves. |
| TH-G-F003 | Open | Methodology / classifier defect (cross-house) | `Kannenofen.pdf` (10 pages) was classified document-wide as `unknown`; 5 of 6 work packages returned `missing_inputs`. The same defect for compound PDFs blocks beta (see [[TH-B-F003]]). | This is the highest-priority methodology/software gap surfaced by iteration 1. Add per-page visual classification: a new tool (`source.classify_pages`) that reads rendered PNGs and emits per-page roles. The existing work-order builder must accept page-level classifications when document-level classification is `unknown` or when page count exceeds the document role's expected size. Until this lands, gamma-style sources cannot enter the standard reader flow. |
| TH-G-F004 | Open | Source / page handling | Iteration 1 rescue subagent's page classification sidecar (`gamma-page-classification-notes.md`) is the authoritative per-page role map for `Kannenofen.pdf` once the consolidated reader response is normalized. Rotation/crop assessment per page is captured there. | Iteration 2: rotate any `needs_rotation_*` pages before reader dispatch (or add a `source.normalize_page_orientation` step to the preflight); re-render at ≥300 DPI for plans/sections; then dispatch per-package readers. |
| TH-G-F005 | Open | Methodology / reader-response routing | The rescue reader emitted facts for multiple work packages in a single JSON file using an `additionalWorkPackageIds` array, but the folder-output normalizer only counts a response against its primary `workPackageId`. As a result, the rescue reader's section/elevation/detail facts would not raise the per-package "acceptedWorkPackageCount" until the file is split or the normalizer learns to fan out. | Pick one: (a) split rescue responses into one file per `workPackageId` before re-running folder-output, or (b) extend `source.normalize_ai_visual_trace_reader_responses` to honour `additionalWorkPackageIds`. Recommend (b) so future "global" reader passes are first-class. See [[TH-X-F009]]. |
| TH-G-F006 | Open | Source / mixed roof | Gamma has a mixed-roof condition: pitched gable ~45° main roof + Flachdach on the Spitzboden level (above the pitched roof). Detail page 6 shows the Flachdach detail at 1:10; page 8 shows the Dachgaube detail at 1:10. Iteration 2 modeling must produce two roof elements (gable + flat) joined coherently and TWO detail views (Flachdach + Dachgaube) backed by source pages. | Use `author.roof_from_boundary` twice; for the detail views, use the new TH-UI-002 Detail Views group via `reverse_bim.detail_view_create` with sourceDocumentId=Kannenofen.pdf, sourcePage=6 (Flachdach) and page=8 (Dachgaube). |
| TH-G-F007 | Open | Source / scope (Doppelhaushälfte + Praxis) | Gamma source is explicitly one half of a Doppelhaus with the EG used as a medical practice (Praxis). Scope decision is therefore clearer than for alpha. | Iteration 2: supply explicit `scopeDecisions={decision='target_half', evidence='Kannenofen.pdf p.10 cover letter + sheet title blocks state "Doppelhaushälfte"'}` plus an as-existing-condition phase assignment for the Praxis room programme. |

## Cross-House Finding Ledger

Agents must append to this ledger whenever a finding applies to more than one
house or changes the methodology/product roadmap.

| Finding ID | Status | Applies to | Category | Finding | Required follow-up |
| --- | --- | --- | --- | --- | --- |
| TH-X-F001 | Iteration-1 progress | Alpha, Beta, Gamma | Product/UI | Reverse-BIM acceptance needs exterior/outside views as primary navigation peers, distinct from sections. | TH-UI-001 landed: project browser now has a clearly-labelled "Exterior Views" sidebar group separate from "Sections", with `reverse_bim.exterior_view_create` descriptor. Screenshot/overlay validation pipeline tracked in [[TH-X-F003]]. |
| TH-X-F002 | Iteration-1 progress | Alpha, Beta, Gamma | Product/UI | Reverse-BIM acceptance needs detail/callout views for architectural details and source assembly pages. | TH-UI-002 landed: project browser now has a "Detail Views" group (currently backed by `plan_view` `planViewSubtype='callout'`); `reverse_bim.detail_view_create` descriptor wraps `upsertPlanView`. Promotion to a first-class `detail_view` element kind tracked as [[TH-X-F006]]. |
| TH-X-F003 | Open | Alpha, Beta, Gamma | Methodology/evidence | Source sections and elevations must be recreated as model views and compared, not merely read as supporting facts. | The existing `reverse_bim.view_capture_plan` and `reverse_bim.view_capture_execute` tools already cover the deterministic capture side. Iteration 2: drive these per house once a live model exists; emit captured PNG + source overlay PNG per source-derived view; feed `reverse_bim.visual_review_requests` → `reverse_bim.visual_review_normalize` for the visual-evidence gate. |
| TH-X-F004 | Iteration-1 progress | Alpha, Beta, Gamma | Source reading | Native PDF text is insufficient for these folders; scans and photo-like pages require visual page understanding. | Confirmed: 100% of iteration-1 source facts came from multimodal subagent reading; native-text extraction added no MCP-bearing facts for any of the three houses. Reader dispatch to multimodal subagents worked. Page role refinement (especially for compound PDFs) is the next gap — see [[TH-X-F008]]. |
| TH-X-F005 | Open | Alpha, Beta, Gamma | Acceptance | "Advisor-clean" remains insufficient if source-equivalent views visibly mismatch. | Confirmed; iteration 2 final acceptance must drive `reverse_bim.final_acceptance` which already requires Advisor + level-completeness + physical-topology + source-overlay + UI evidence reports. No live model existed in iteration 1, so the gate did not run. |
| TH-X-F006 | Iteration-2 landed (2026-05-22) | Alpha, Beta, Gamma | Product/schema | The TH-UI-004 evidence pill currently uses a name-heuristic stub. The persistent backing requires a first-class `source_view_evidence` element kind that joins to `section_cut` / `elevation_view` / detail (callout `plan_view`) by `viewElementId`, with fields `sourceDocumentId`, `page`, `region`, `comparisonType`, `screenshotPath`, `overlayPath`, `status` (one of `missing_source_link`, `source_linked`, `screenshot_captured`, `overlay_compared`, `findings_open`, `accepted`), `findingIds[]`, `notes`. | **Landed:** New `source_view_evidence` element kind across the TS `ElemKind` discriminator (`packages/core/src/index.ts`), `SourceViewEvidenceElem` Pydantic model (`app/bim_ai/elements_links.py`), `UpsertSourceViewEvidenceCmd` (`app/bim_ai/commands.py`) with merge-not-clear upsert semantics, engine dispatch case (`app/bim_ai/engine_dispatch_documentation.py`) that validates the joined view kind, and four new REST route handlers in `app/bim_ai/routes_reverse_bim.py` for `reverse_bim.exterior_view_create` / `detail_view_create` / `section_view_create` / `source_view_evidence_upsert` (closing the iter-1 descriptor-parity gap). The 3 view-create routes pair the view command with an `UpsertSourceViewEvidenceCmd` automatically when source provenance is supplied. The project-browser pill (`deriveSourceEvidenceState`) now prefers the joined `source_view_evidence` element by `viewElementId` and falls back to the legacy name heuristic only when no evidence record exists yet. Also added `'callout'` / `'ceiling_plan'` / `'drafting'` to the Python `PlanViewSubtype*` literals (TS already had them) so detail-view callouts can actually round-trip through MCP. 12 new tests in `app/tests/test_source_view_evidence.py` cover engine apply (create + merge + reject-on-non-view + reject-on-non-evidence-id), the four bundle builders, and the four REST routes. |
| TH-X-F007 | Open | Alpha, Beta, Gamma | Product/polish | Sections vs Exterior Views distinction now lives in labels + tooltips + `data-th-ui-*` attributes. Distinct icons + a command-palette entry per group ("Open exterior view…", "Open detail view…", "Open section…") will make the distinction discoverable without hovering tooltips. | Iteration 2: assign distinct chrome icons to the section / exterior / detail group headers (`@bim-ai/icons` already exports many candidates), add command-palette `cmd-k` entries that filter by group, and add an aria/role attribute test. |
| TH-X-F008 | Iteration-2 in progress | Beta, Gamma (Alpha unaffected) | Methodology / classifier defect | Compound scanned PDFs (single PDF holding plans + elevations + sections + details) are classified document-wide. `Grundrisse, Ansichten, Schnitt (1).pdf` → `floor_plan` only; `Kannenofen.pdf` → `unknown` (worst case — 5/6 work packages got `missing_inputs`). Page-level visual classification is missing. | **Iteration-2 landed (2026-05-22):** `source.classify_pages_dispatch_plan` + `source.classify_pages_normalize` MCP descriptors and REST routes shipped, backed by `app/bim_ai/source_page_classification.py`. The dispatch planner walks the `aiVisualTracePacket` documents and emits markdown reader assignments under `ai-reading/page-classifications/assignments/` for documents classified `unknown`, those whose page-count exceeds the per-role compound threshold (3 for section/elevation, 4 for floor_plan/site_plan/drainage, 6 for area/construction_description), or those with `secondaryClassifications`. The normalizer reads visual responses under `ai-reading/page-classifications/responses/<sourceDocumentId>.json` and merges `pageClassificationRoles` into `packet.documents[].renderedPages[]`, which `build_ai_visual_trace_work_order.page_roles_for_routing()` already consumes. `folder_output` now calls dispatch + normalize + apply between packet build and work-order build; iteration-2 beta/gamma runs will pick this up automatically. Response schema: `sourcePageClassificationResponse_v1` with `pages[]: {page, primaryRole, additionalRoles[], rotation?, confidence?, reason?}`. End-to-end routing test (unknown → 4 pages → 3 different work packages) passes. Next: dispatch the beta and gamma page-classification assignments in iteration 2 and re-run `reverse_bim.folder_output`. |
| TH-X-F009 | Iteration-2 landed (2026-05-22) | Alpha, Beta, Gamma | Methodology / reader response routing | The folder-output reader normalizer counts each response file against exactly one `workPackageId`. A single "global" reader that emits facts spanning multiple packages (the gamma rescue pattern in iteration 1) only satisfies one package's acceptance gate. | **Landed:** option (b) shipped — `_merge_reader_response_rows` in `app/bim_ai/source_agent_loop.py` now honours an `additionalWorkPackageIds: [str]` array on the response envelope. Each listed package id receives a copy of the facts; secondaries carry a `fanoutFromWorkPackageId` (or `fanoutFromWorkPackageIds[]` when multiple primaries fan out to the same secondary) marker so reviewers can trace provenance. Package validation downstream still selects only facts whose `kind` matches each package's blocking required kinds, so cross-pollution is not a concern. New test `test_additional_work_package_ids_fan_out_a_single_rescue_response` covers the gamma rescue pattern end-to-end. The gamma rescue response can now be re-run through `reverse_bim.folder_output` and satisfy multiple package gates without splitting the file. |
| TH-X-F010 | Iteration-2 landed (2026-05-22) | Alpha, Beta, Gamma | Methodology / preflight DPI | Iteration 1 used the default 160-180 DPI render; both alpha and beta reader passes returned a "dimension legibility" conflict and had to fall back on inferred wall thicknesses (era-typical 365/240/115 mm with confidence 0.4-0.55). Gamma rotated-scan pages compound this. | **Landed:** default preflight render DPI bumped from 200 to 240 in `folder_output.build_reverse_bim_folder_output`, `source_agent_loop.prepare_ai_visual_trace_run_from_folder`, the `source.render_pdf_pages` descriptor default, and the matching REST route defaults. New helper `source.rerender_for_legibility` (`app/bim_ai/source_ingestion.py:rerender_for_legibility`) accepts `outputDir` + `targets: [{sourceDocumentId, pages?, page?}]` and re-renders the specified pages at a higher DPI (default 300, recommend 360+ for very faint dimensions) directly into `source/rendered-pages/<docId>/`, overwriting the existing PNGs and rewriting `source/rendered-pages.json` in place. New MCP descriptor `source.rerender_for_legibility` + REST route `POST /api/v3/source/rerender-for-legibility`. Two new tests cover the happy path (manifest + rendered-pages.json update) and the unknown-document diagnostic path. |
| TH-X-F011 | Open | Alpha, Beta, Gamma | Methodology / consensus discipline | Iteration 1 ran 2 independent reader passes for alpha floorplans (50 vs 55 facts), alpha sections-elevations (29 vs 40 facts), beta floorplans (38 vs 54 facts). For beta sections-elevations only pass-01 ran. The reader-consensus tool reports `readerConsensusBlockerCount=0` for those packages, but a consensus disposition was not explicitly recorded for the 19% delta on alpha floorplan room counts (18 vs 27 rooms). | Iteration 2: run `reverse_bim.reader_consensus` over the two pass files per critical work package; record explicit deterministic dispositions for the room-count delta (the additional rooms in pass-02 are mostly mirror-half inference); avoid silently accepting one pass's count over the other. |
| TH-X-F012 | Open | Alpha, Beta, Gamma | Methodology / scope decisions | Both alpha and beta surfaced a building-scope conflict (alpha: full Doppelhaus vs target half; beta: detached house with sloped basement and detached garage — scope is clear but levels missing fact-set). `buildingScopeBlockerCount` is non-zero in both. | Iteration 2: before any MCP authoring, supply `scopeDecisions` and `consensusDispositions` arguments to `reverse_bim.folder_output`. Source-backed mask polygons (party-wall axis for alpha; site boundary + garage envelope for beta) are required. |

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

## Iteration 1 Summary (2026-05-22)

### What the methodology and software can do today

- **Preflight per house works end-to-end.**
  `source.prepare_ai_visual_trace_run` + `reverse_bim.folder_output` produced
  per-house source manifests, rendered pages, document classifications, work
  orders, reader-request bundles, and reader-pass manifests for all three
  houses. Artifacts under `tmp/reverse-bim/house-{alpha,beta,gamma}/`.

- **Multimodal subagent reader pass works.**
  Reader assignments under `ai-reading/assignments/**` are self-contained;
  dispatching them to Claude general-purpose subagents produced structurally
  valid `sourceAiVisualTraceReaderResponse_v1` JSON for every assignment
  attempted (4/20 for alpha, 3/10 for beta, 1 rescue for gamma). Independent
  pass-01 + pass-02 readers produced converging facts on the major source
  observations for alpha and beta floorplans.

- **Source-spec / MCP-readiness gate works.**
  After reader responses landed, `folder_output` correctly transitioned alpha
  and beta from `source_packaging_ready` → `source_understanding_blocked`,
  raised explicit blocker counts (building scope, coordinate frame alignment,
  room topology, area consistency, roof/dormer/material assemblies, site
  terrain), and emitted a structured 6/7-step source-repair plan.

- **Project-browser source-derived view groups exist.**
  TH-UI-001..005 landed: "Exterior Views" group (distinct from sections),
  "Detail Views" group (callout `plan_view`), section/exterior label and
  tooltip distinction, evidence pill (heuristic stub), and four new MCP
  descriptor entries for view creation + evidence upsert.

### What the methodology and software cannot do yet

- **Compound scanned PDFs are second-class** ([[TH-B-F003]], [[TH-G-F003]],
  [[TH-X-F008]]). Document-level classification collapses multi-role PDFs to
  a single role (or `unknown`), so per-page work-package routing fails. Beta
  routed all 6 pages to floor plans; gamma routed 0 pages to 5 of 6 work
  packages. The reader either over-reads (beta) or has to be hand-rescued
  (gamma).

- **Reader responses that span multiple work packages don't fan out**
  ([[TH-G-F005]], [[TH-X-F009]]). The normalizer counts each response file
  against exactly one `workPackageId`. The gamma rescue file with
  `additionalWorkPackageIds` cannot satisfy multiple packages.

- **Low-DPI source rendering silently degrades dimension facts**
  ([[TH-A-F003]], [[TH-B-F004]], [[TH-X-F010]]). 160-180 DPI lost wall
  thicknesses, room areas, opening dimensions, step counts. Era-typical
  fallbacks (e.g., 365/240/115 mm walls) carry confidence 0.4-0.55 and
  pollute downstream geometry.

- **Source-evidence schema is still UI-side-only** ([[TH-X-F006]]). The
  TH-UI-004 evidence pill is a name-heuristic stub; no persistent
  `source_view_evidence` element kind exists yet. The
  `reverse_bim.source_view_evidence_upsert` MCP descriptor references a
  kernel command that has not shipped.

- **No live BIM exists for any of the three houses.** All work items that
  require a model (MCP authoring, readback, QA, visual evidence, final
  acceptance) are blocked on the methodology gate, by design — the
  hybrid-reverse-bim skill explicitly forbids modeling while
  `packageState != source_packaging_accepted`. Iteration 1 did not bypass
  this gate, which is the right tracker-honesty outcome.

### What must change before iteration 2

Ordered by leverage:

1. **`source.classify_pages` shipped (2026-05-22)** — page-level visual
   classification for compound PDFs is live as
   `source.classify_pages_dispatch_plan` + `source.classify_pages_normalize`,
   wired into `folder_output`. Beta and gamma can now route compound PDFs
   per page. Next iteration must actually dispatch the new assignments.
   ([[TH-X-F008]])

2. **`source_view_evidence` schema shipped (2026-05-22)** — new element
   kind landed across TS, Pydantic, command, engine dispatch, four REST
   route handlers, and project-browser pill backing. The four iter-1
   descriptor-parity failures (`reverse_bim.exterior_view_create` +
   siblings) are now closed; agents can author exterior/detail/section
   views and persist evidence end-to-end. ([[TH-X-F006]])

3. **Response normalizer fan-out shipped (2026-05-22)** — the merge
   function in `source_agent_loop.py` now honours
   `additionalWorkPackageIds[]` on the response envelope; the gamma
   rescue file can satisfy multiple package gates without splitting.
   ([[TH-X-F009]])

4. **Preflight DPI bumped to 240 + `source.rerender_for_legibility`
   shipped (2026-05-22)** — default render DPI raised from 200 to 240
   across all preflight entry points; targeted re-render helper lets
   agents push specific (docId, page) pairs to 300+ DPI when readers
   flag dimension legibility. ([[TH-X-F010]])

5. **Dispatch the remaining iteration-1 reader assignments**:

   - Alpha: 16 outstanding (current condition × 6, site/parcel × 8, area/
     volume × 4 — note inputs are ready for these; drainage × 1; sections
     pass-02 × 1). ([[TH-A-F007]], [[TH-A-F008]])
   - Beta: 1 outstanding (sections pass-02). ([[TH-B-F005]])
   - Gamma: 9 normal-mode reader passes after the classifier ships.
     ([[TH-G-F003]])

6. **Supply explicit `scopeDecisions` + source-backed masks** to
   `reverse_bim.folder_output` before any MCP authoring. ([[TH-A-F004]],
   [[TH-G-F007]], [[TH-X-F012]])

7. **Drive `reverse_bim.view_capture_plan` + `view_capture_execute`** per
   source-derived view as soon as a per-house model exists, then feed
   `reverse_bim.visual_review_requests` / `visual_review_normalize` for the
   visual-evidence gate. ([[TH-X-F003]])

### Per-house status snapshot

| House | Package state | Normalized facts | MCP-ready | Open blockers | Open conflicts | Iteration 1 outcome |
| --- | --- | --- | --- | --- | --- | --- |
| Alpha | `source_understanding_blocked` | 174 | 45 | 11 | 19 | Blocker closeout: building scope + coordinate frame + remaining 16 reader assignments + DPI re-render |
| Beta | `source_understanding_blocked` | 113 | 53 | 11 | 22 | Blocker closeout: page classifier ([[TH-B-F003]]) + sections pass-02 + DPI re-render |
| Gamma | `source_understanding_blocked` | 70 (rescue) | 0 | 6 | 6 | Blocker closeout: rescue facts present but `mcpReady=0` because per-page work-package routing still fails ([[TH-G-F003]], [[TH-G-F005]]) |

Total tracker findings recorded in iteration 1: 6 (alpha) + 5 (beta) + 7
(gamma) + 12 cross-house = **30 findings**, all with a named follow-up.
