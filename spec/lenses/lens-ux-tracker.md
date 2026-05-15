# Discipline Lens UX Tracker

## Goal

Make lenses feel like professional workflows over the same BIM model, not just a visibility dropdown.

A lens must answer four questions immediately:

- Where do I select it?
- What changes in this view type?
- Which tools/properties/schedules are now foregrounded?
- Where is the lens not the right abstraction?

Facility Operations / Facility Management is intentionally excluded from implementation until the operations model exists.

## Product Model

| Concept | Meaning | UX consequence |
|---|---|---|
| Lens | How the user sees, enriches, checks, and exports the same model for a professional workflow. | View/tab-scoped selector, lens-specific overlays, inspector groups, ribbon tools, schedule suggestions. |
| View type | Plan, 3D, section, schedule, or sheet. | Determines whether the lens affects geometry, data tables, or placed viewports. |
| Perspective / workspace | Broader panel layout for a job. | May complement a lens, but should not replace the lens selector. |

The primary lens switch belongs in the **view header** because a lens is view/tab-scoped. Secondary entry points are Cmd+K, pane-local secondary sidebar guidance, and selected sheet-viewport settings. The primary project browser must stay lens-neutral because it represents project structure, not the active tab's lens state.

## Global UX Rules

- Switching lens must always produce a visible acknowledgement: selector label, right-rail notice/dashboard, and ribbon context.
- Plans, sections, elevations, and 3D views should show visual overlays or ghosting.
- Schedules should not mutate arbitrary schedule columns just because the lens changed. The lens should suggest and prioritize relevant schedule families.
- Sheets are containers. The sheet itself does not need a single active lens; selected viewports should keep lens/display settings.
- Inspectors should keep the same selected element but reorder/property-highlight by lens ownership.
- Coordination should generally preserve all model context and add issue/clash overlays rather than aggressively hiding elements.
- "All" is a visibility aggregate, not a professional lens.

## View-Type Matrix

| View type | Lens selector? | Expected behavior |
|---|---:|---|
| Plan | Yes | Strongest 2D overlays: ghosting, color by classification/status, tags, warnings, missing data. |
| Section / elevation | Yes | Same lens overlay logic as plans, plus cut-surface readouts where useful. |
| 3D | Yes | Ghosting, heatmaps, semantic coloring, issue markers, section boxes, saved lens views. |
| Schedule | Yes, but as a family filter | Show lens-relevant schedules, presets, fields, and creation shortcuts. Existing schedule definitions remain stable. |
| Sheet | Yes for selected viewport; optional sheet filter | Sheets group lens-specific deliverables. Placed viewports own their own lens/display state. |

## Ribbon Rules

- Keep universal navigation, selection, annotate, measure, review, sheet, and schedule commands stable.
- Add a contextual lens tab when a non-`all` lens is active.
- For authoring lenses, promote authoring tools.
- For analysis/review lenses, promote classification, schedules, review, export, and missing-data workflows.
- If a domain tool is not implemented yet, route the command through Cmd+K or Advisor rather than showing a fake destructive action.

## Sidebar Rules

### Primary Left Sidebar / Project Browser

The active lens should prioritize relevant project content while keeping the rest reachable:

- Architecture: floor plans, elevations, sections, sheets, room/door/window schedules.
- Structure: structural plans, framing/section views, column/beam/slab schedules.
- MEP: HVAC/plumbing/electrical plans, system schedules, coordination views.
- Energy: envelope views, thermal zone plans, energy schedules, handoff/export views.
- Fire Safety: compartment plans, escape routes, fire-door schedules, fire-safety sheets.
- Cost / Quantity: quantity schedules, DIN 276 breakdowns, takeoff sheets.
- Construction: phase views, packages, logistics, QA, progress.
- Sustainability: LCA schedules, material impact views, missing EPD reports.
- Coordination: clashes, issues, BCF viewpoints, linked models, review sheets.

### Secondary / Right Rail

When no element is selected, show a lens dashboard:

- What this lens is for.
- Which view types should change visually.
- Which schedules/sheets are relevant.
- Which next actions are expected.

When an element is selected, keep the same element but make lens-specific property groups first.

## Per-Lens UX

### Architecture / Architektur

- Purpose: default spatial/envelope/opening/documentation authoring.
- Plan/section/3D: foreground architectural elements.
- Ribbon: Wall, Floor, Roof, Door, Window, Room, Stair, Railing, annotations.
- Schedules: Room, Door, Window, Wall/Floor/Roof type schedules.
- Sheets: general arrangement, plans, sections, elevations.
- Inspector priority: type, dimensions, host/openings, materials, room relationships.

### Structure / Tragwerk

- Purpose: structural framing, load-bearing classification, engineering review.
- Plan/section/3D: foreground beams, columns, slabs, grids, load-bearing walls.
- Ribbon: Grid, Column, Beam, Structural Slab, Opening, load-bearing classification.
- Schedules: column, beam, slab, load-bearing wall, opening schedules.
- Sheets: structural plans, framing, foundation, roof structure.
- Inspector priority: structural role, load-bearing, analytical alignment, structural material.

### MEP / TGA

- Purpose: technical building services authoring and coordination.
- Plan/section/3D: foreground systems, pipes, ducts, fixtures, MEP equipment.
- Ribbon: equipment/component, systems, openings/penetration requests, coordination checks.
- Schedules: duct, pipe, equipment, fixture, system schedules.
- Sheets: HVAC, plumbing, electrical, coordination sheets.
- Inspector priority: system, service type, size, level/offset, host/opening coordination.

### Energy / Energieberatung

- Purpose: German energy consulting, GEG/iSFP/BEG handoff modeling.
- Plan/section/3D: thermal envelope, heated/unheated zones, U-value heatmaps, window shading factors.
- Ribbon: classify envelope, assign thermal zone, material lambda, U-value, thermal bridge, scenario, handoff export.
- Schedules: envelope surfaces, thermal materials, zones, windows/solar gains, handoff completeness.
- Sheets: Bestandsaufnahme, envelope summary, renovation scenarios, shading.
- Inspector priority: thermal classification, U-value, layer thermal properties, adjacency/boundary condition.

### Sustainability / Nachhaltigkeit / Oekobilanz

- Purpose: embodied carbon, EPDs, lifecycle/material impact.
- Plan/section/3D: carbon heatmap, missing EPD highlights, material mass/volume overlays.
- Ribbon: assign EPD, material impact, carbon heatmap, missing data, LCA export.
- Schedules: material quantities, element carbon, assembly carbon, missing EPD data.
- Sheets: LCA summary, material impact, carbon hotspots.
- Inspector priority: EPD source, GWP, material quantities, recycled/reuse content.

### Fire Safety / Brandschutz

- Purpose: compartments, escape routes, ratings, code-review handoff.
- Plan/section/3D: compartments, rated walls/doors, escape routes, travel distances, penetrations.
- Ribbon: compartment, escape route, fire rating, fire door, penetration, travel distance, checks.
- Schedules: fire doors, fire-rated walls, compartments, penetrations, escape routes, missing ratings.
- Sheets: Brandschutzplan, escape route plans, compartment plans.
- Inspector priority: rating required/actual, compartment boundary, door swing/compliance, firestopping.

### Cost / Quantity / Kosten und Mengen

- Purpose: quantity takeoff, DIN 276 grouping, cost scenarios.
- Plan/section/3D: color by cost group, missing classification, measured elements.
- Ribbon: DIN 276 classification, quantity takeoff, unit rates, scenario, BOQ/export.
- Schedules: quantity takeoff, cost estimate, DIN 276 breakdown, missing cost data.
- Sheets: cost summary, takeoff documentation, scenario comparison.
- Inspector priority: quantity basis, cost group, unit rate, source, scenario.

### Construction / Bauausfuehrung

- Purpose: phase, packages, progress, site logistics, QA.
- Plan/section/3D: color by phase/status/package, logistics, temporary works, issues.
- Ribbon: phase, package, logistics, progress, QA checklist, constructability report.
- Schedules: packages, QA, issues, progress, logistics.
- Sheets: construction sequence, site logistics, QA reports, package drawings.
- Inspector priority: phase, package, trade, progress status, responsible company, QA status.

### Coordination / Koordination

- Purpose: cross-discipline model QA, clash/review/issues.
- Plan/section/3D: keep disciplines visible, add clash markers, issue pins, link status, changed elements.
- Ribbon: clash check, issue, BCF, selection set, links, review status.
- Schedules: clash list, issue list, linked-model status, assignments.
- Sheets: coordination issues, clash viewpoints, review packages.
- Inspector priority: issues, clashes, linked-model conflicts, review status, BCF refs.

## Implementation Tracker

- [x] Expose all implemented lenses except Facility Operations in the selector.
- [x] Add command-palette commands for selectable implemented lenses.
- [x] Centralize lens labels, German names, view behavior, ribbon guidance, schedule families, and inspector hints.
- [x] Use the shared lens registry in the dropdown.
- [x] Add contextual ribbon lens tab for non-`all` lenses.
- [x] Add right-rail lens dashboard and clearer lens notices.
- [x] Pass lens context to schedule mode and prioritize relevant schedules without mutating existing definitions.
- [x] Add sheet-mode guidance that lens applies to placed viewports/deliverables, not the sheet as one global model state.
- [x] Extend 2D plan overlays beyond architecture/structure/MEP.
- [x] Extend section/elevation overlays.
- [x] Add full inspector property-group reordering per lens.
- [x] Keep the primary project browser lens-neutral; place lens grouping/prioritization only in pane-local secondary/right-rail surfaces.
