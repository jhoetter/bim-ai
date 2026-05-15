# STL 3D Print Export Tracker

Purpose: add a deterministic STL export path for BIM AI models so a user can download a printer-oriented triangle mesh from the same model snapshot used by glTF/GLB and IFC exports.

Status legend:

- [ ] Not started
- [~] In progress
- [x] Done

## User Goal

Export the authored BIM model as an STL file suitable for downstream 3D-print preparation in slicers such as PrusaSlicer, Cura, Bambu Studio, or similar tools.

The feature must distinguish between:

- **STL format support:** deterministic binary STL bytes available through the API.
- **3D-print readiness:** mesh is closed enough for slicer ingestion, scaled in millimeters, and accompanied by diagnostics that identify geometry that may need thickening, repair, omission, or print-profile adjustment.

## Current Codebase Findings

- Backend export routing already lives in `app/bim_ai/routes_exports.py`.
- Existing 3D visual exchange exports are:
  - `GET /api/models/{model_id}/exports/model.gltf`
  - `GET /api/models/{model_id}/exports/model.glb`
  - `GET /api/models/{model_id}/exports/gltf-manifest`
- The glTF exporter already creates deterministic triangulated visual geometry in `app/bim_ai/export_gltf.py`.
- The shared geometry path currently supports visual boxes, gable roof triangles, and site pad triangles.
- Existing glTF geometry is in meters and uses Y-up coordinates.
- STL should be exported in millimeters because that is the de facto slicer expectation and matches BIM AI's authoring units.
- STL carries no materials, units, hierarchy, metadata, or semantic element ids. Any validation metadata must live in a sidecar manifest endpoint or HTTP headers, not in STL itself.
- The first STL pass reuses the server glTF geometry collection. That produces a valid STL, but it is not a print-parity exporter:
  - `room` is exported as a solid slab even though the browser renders rooms as ribbons/metadata, not printable building mass.
  - `slab_opening` can be exported as a marker solid even though it should subtract from slabs, not print as a plug.
  - browser-rendered printable categories such as `railing`, `balcony`, `column`, `beam`, `ceiling`, `soffit`, and `site` are not all represented by the server glTF kernel.
  - floor and roof footprints in the browser use polygon/roof-specific geometry while the server GLB path often falls back to bounding boxes.
  - wall exports need to respect browser-visible datum constraints, wall location line offsets, wall type thickness, and hosted opening cuts.

## Print-Readiness Principles

The first implementation will export the currently supported solid-ish visual geometry as a printer-oriented mesh. It must not overclaim that every BIM model is immediately printable. The export must provide deterministic diagnostics:

- triangle count
- included element/category counts
- bounding box in millimeters
- zero-area triangle count
- degenerate triangle count
- non-finite coordinate count
- open/non-manifold edge count
- shell/component count approximation
- minimum edge length in millimeters
- readiness status token

Accepted readiness tokens:

- `print_ready_candidate`: no fatal geometry issues detected by the lightweight STL validator.
- `needs_repair`: STL generated, but open/non-manifold or degenerate geometry was detected.
- `empty_model`: no STL triangles were generated.

## Workpackages

### WP-STL-01 - Specification Tracker

Status: [x]

Deliverables:

- Create this tracker in `spec/stl-print-export-tracker.md`.
- Record current architecture and concrete workpackage boundaries.
- Commit and push the tracker before implementation begins.

Acceptance:

- Tracker exists under `spec/`.
- Later commits can mark workpackage completion directly in this file.

### WP-STL-02 - STL Mesh Kernel

Status: [x]

Deliverables:

- Add `app/bim_ai/export_stl.py`.
- Reuse the existing deterministic visual geometry entries from the glTF exporter.
- Convert vertex positions from meters to millimeters.
- Apply node transforms to box/site-pad geometry before writing STL triangles.
- Preserve gable roof geometry, already emitted in world coordinates by the glTF path.
- Emit binary STL by default.
- Provide optional ASCII STL serialization for deterministic debug/readback tests.
- Provide a sidecar manifest builder with print-readiness diagnostics.

Acceptance:

- A document with one wall exports a binary STL with an 80-byte header, correct triangle count, and `50 + triangle_count * 50` byte length.
- Coordinates are in millimeters.
- Mesh diagnostics are deterministic for stable input.

### WP-STL-03 - API Routes and Evidence Links

Status: [x]

Deliverables:

- Add `GET /api/models/{model_id}/exports/model.stl`.
- Add `GET /api/models/{model_id}/exports/stl-manifest`.
- Return `model/stl` for STL bytes.
- Set `Content-Disposition: attachment; filename="model.stl"`.
- Add STL links to the evidence/export manifest surface where export links are collected.

Acceptance:

- Missing models return `404`.
- Valid models return STL bytes from the route.
- The evidence package exposes the STL route and STL manifest route alongside existing GLB/glTF/IFC links.

### WP-STL-04 - Tests and Validation Coverage

Status: [x]

Deliverables:

- Unit tests for binary STL structure.
- Unit tests for ASCII STL determinism.
- Unit tests for manifest/readiness diagnostics.
- Route-level tests if the existing route test harness can load a model row without large fixture setup.
- Regression tests ensuring empty models export a valid empty STL and `empty_model` manifest token.

Acceptance:

- Targeted backend tests pass.
- Existing glTF tests continue to pass.
- The STL exporter does not alter existing glTF/GLB output.

### WP-STL-05 - UI Export Reachability

Status: [x]

Deliverables:

- Add STL download reachability wherever project export links are shown in the web workspace.
- Keep the UI small and consistent with existing export links.
- Avoid changing unrelated frontend rendering/path-tracing files already dirty in the worktree.

Acceptance:

- User can discover/download STL from the existing export surface.
- Frontend tests or targeted type checks pass where practical.

### WP-STL-06 - Browser-Parity Print Mesh Scope

Status: [x]

Deliverables:

- Reassess the STL kernel against the browser renderer rather than only the server glTF exporter.
- Define which elements are printable solids, which are visual-only/documentary, and which need explicit limitations in the STL manifest.
- Preserve the existing API surface while upgrading the underlying geometry source.

Acceptance:

- Tracker records the mismatch that caused the valid-but-visually-different STL concern.
- New implementation work is scoped around print-parity categories rather than generic glTF reuse.

### WP-STL-07 - Print-Parity STL Kernel Upgrade

Status: [x]

Deliverables:

- Replace STL's dependency on `_collect_visual_geom_entries` with a dedicated printer mesh collector.
- Exclude browser non-solid concepts such as `room`, `slab_opening` markers, `roof_opening` markers, grid/detail/view/annotation records, and other documentary elements.
- Export browser-visible printable solids for:
  - walls with level/base/top constraints, location-line offsets, wall type thickness, and hosted rectangular openings for doors/windows/wall openings.
  - floors, ceilings, soffits, site pads, and mass-like polygonal solids using footprint triangulation instead of bounding-box panels when possible.
  - floors with a single axis-aligned rectangular slab opening as split printable panels, with the opening marker omitted.
  - roofs in flat, mass-box, gable, asymmetric gable, hip, and L-shape-oriented footprint modes where deterministic footprint geometry is available.
  - straight stairs with printable treads/stringers, plus conservative fallbacks for advanced stair shapes.
  - railings, balconies, columns, beams, doors, and windows as printable proxy solids matching their rendered placement.
- Keep all emitted STL triangles in millimeters with X/Y as build plate axes and Z as vertical.
- Keep sidecar diagnostics deterministic and add explicit `meshSource`/coverage notes.

Acceptance:

- A model containing walls, roof, floor, railing, column, beam, ceiling, balcony, and site elements reports all those categories in `elementCountsByKind`.
- Rooms and slab-opening markers are absent from STL triangles.
- Simple wall exports still produce closed geometry with hosted openings cut out where applicable.
- Manifest limitations describe remaining unsupported high-detail browser features without pretending the mesh is a perfect slicer-ready building union.

### WP-STL-08 - Print-Parity Regression Tests

Status: [ ]

Deliverables:

- Add tests proving non-print visual categories are excluded.
- Add tests for the new printable element category coverage.
- Add tests for wall datum/location-line behavior and hosted opening cuts.
- Add tests for floor slab opening panelization without marker solids.
- Keep the existing binary STL, ASCII STL, manifest, route, and export-link tests passing.

Acceptance:

- Targeted backend STL tests pass.
- Existing glTF tests continue to pass.
- Frontend export-link tests remain green if untouched by this upgrade.

## Non-Goals for First Pass

- Full computational solid geometry repair.
- Boolean unioning all building elements into one watertight monolithic shell.
- Slicer-specific print settings or support generation.
- Color/material STL variants.
- Exact high-detail family geometry export beyond the existing supported visual geometry kernel.

## Non-Goals for Browser-Parity Upgrade

- Boolean unioning every separate building component into one monolithic watertight shell.
- Full constructive solid geometry parity for dormer/roof openings, arbitrary curved walls, freeform sweeps, text geometry, MEP systems, imported assets, or terrain heightmaps.
- Guaranteeing a support-free print. Slicer orientation, wall thickness checks, supports, scale, and print profile remain downstream responsibilities.
- Encoding materials/colors, hierarchy, or BIM metadata in STL.

## Follow-Up Candidates

- Dedicated print profiles: `concept_mass`, `architectural_section_model`, `single_material_shell`, `site_model`.
- Geometry thickening for windows, railings, stairs, and tiny details.
- Optional category filters in query params.
- 3MF export with units, metadata, and optional color/material grouping.
- Server-side mesh repair with a geometry library if dependency policy allows it.
