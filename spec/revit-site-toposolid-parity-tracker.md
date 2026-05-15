# Revit Site / Toposolid Parity Tracker

This tracker captures the site-slope work needed for sketch-to-BIM seeds such
as `target-house-4`, where the source drawing shows the house sitting on a
non-flat site. It is intentionally implementation-oriented: each workpackage
must land as an independently committed and pushed change before the next
workpackage starts.

## Source Behavior

Autodesk Revit treats terrain as a site object, not as a tilted building datum.
The building levels, walls, floors, and roof remain authored from architectural
levels unless deliberately hosted or offset. The site surface is modeled as a
Toposolid/topography object with height points, subdivisions, graded regions,
and excavation/cut relationships.

Reference behaviors to match:

- Toposolid excavation: a floor, roof, or another toposolid that intersects the
  host toposolid can cut volume from it. Revit reports adjusted host volume and
  per-cutter excavation volume.
  <https://help.autodesk.com/cloudhelp/2025/ENU/Revit-Model/files/GUID-21047A44-6030-49E8-B1B9-03366EA6A0C2.htm>
- Excavation volume parameters: Revit exposes individual excavation volumes on
  cutter elements and total excavation volume on the cut host, and these values
  can be scheduled.
  <https://help.autodesk.com/cloudhelp/2026/ENU/RevitLT-Model/files/GUID-CF284C55-7CBF-40DD-B4D5-4DB6DED7A843.htm>
- Graded regions: Revit creates a proposed site by copying an existing
  topography/toposolid surface, demolishing the original in the current phase,
  and editing the copied points for cut/fill analysis.
  <https://help.autodesk.com/cloudhelp/2024/ENU/Revit-Model/files/GUID-31E2EF0E-875C-4A68-958E-A06E5F2C0838.htm>
- Legacy building pads: Revit building pads are closed loops sketched on a
  toposurface and can define a level/offset, structure depth, openings, and a
  slope. For modern Toposolid workflows this maps to excavation plus a slab or
  pad-like floor.
  <https://help.autodesk.com/cloudhelp/2023/ENU/Revit-Model/files/GUID-A964AA13-39B6-4A4C-A230-9F69C8AA5D3A.htm>

## Current bim-ai Baseline

Implemented:

- Kernel commands: `CreateToposolid`, `UpdateToposolid`, `DeleteToposolid`,
  `create_toposolid_subdivision`, `update_toposolid_subdivision`,
  `delete_toposolid_subdivision`, `CreateGradedRegion`,
  `UpdateGradedRegion`, and `DeleteGradedRegion`.
- Core data types: `ToposolidElem`, `ToposolidSubdivisionElem`,
  `GradedRegionElem`.
- Site-aware envelope hooks: floor/wall host relationships can record or derive
  `toposolidElevationMm`/`siteHostId`.
- Constructability rule: `toposolid_pierce_check` warns when floors intersect a
  toposolid without a slab opening/excavation-style resolution.
- CLI command path: `packages/cli/cli.mjs toposolid create/update/delete`.
- Tests: `app/tests/api/test_top_v3_02.py`, `app/tests/api/test_top_v3_04.py`,
  and related Toposolid/graded-region coverage.

Missing or insufficient for `target-house-4`:

- The sketch-to-BIM seed DSL cannot author toposolids, subdivisions, or graded
  regions directly; authors must fall back to raw commands.
- There is no explicit excavation relationship command or quantity record that
  connects a house slab/foundation to a host toposolid.
- 3D evidence does not yet force a visible terrain-grade comparison in the
  target-house review viewpoints.
- Elevation/section views need grade lines and basement exposure cues so the
  drawing's sloped ground is visible from front/gable viewpoints.
- Advisor and construction-readiness reports need site-specific blocking
  findings, not only generic overlap/pierce warnings.

## Target-House-4 Site Read

The source drawing shows a house on sloped ground:

- The long front/elevation ground line is not a level horizontal pad. It rises
  and falls around doors, garden edges, and basement openings.
- The gable elevations show the site line crossing the facade at different
  heights, exposing more basement/lower wall on one side than the other.
- The building itself should remain plumb and level; the terrain should meet,
  cut, or reveal the basement/foundation differently around the perimeter.
- The model needs a visible site solid extending beyond the house footprint, a
  near-building graded zone, and an excavation/pad cut where the basement and
  slab occupy the terrain.

Initial modeling assumption until a measured site plan is available:

- Use `Erdgeschoss` as architectural datum `0 mm`.
- Keep `Kellergeschoss` at `-2500 mm` and `Dachgeschoss` at `3000 mm`.
- Add a Toposolid wider/deeper than the house with height samples that create a
  gable-direction and front/back grade difference.
- Add one flat or gently sloped graded region near the building footprint to
  represent worked ground.
- Treat the basement/foundation footprint as a future excavation cutter, not as
  a reason to tilt floors or walls.

## Workpackage Rules

For every workpackage:

1. Keep edits scoped to the workpackage.
2. Run the listed verification, plus any narrower tests touched by the change.
3. Commit only the files changed for that workpackage.
4. Push immediately after the commit.
5. Do not advance while the relevant sketch-to-BIM or Advisor acceptance is red.

## Workpackages

| ID          | Status  | Goal                                                                                              | Primary files                                            | Required verification                                                            |
| ----------- | ------- | ------------------------------------------------------------------------------------------------- | -------------------------------------------------------- | -------------------------------------------------------------------------------- |
| SITE-WP-001 | Done    | Create this tracker and source-behavior map.                                                      | `spec/revit-site-toposolid-parity-tracker.md`            | Markdown review, `git diff --check`                                              |
| SITE-WP-002 | Done    | Add first-class seed DSL authoring for Toposolid, Toposolid subdivisions, and graded regions.     | `packages/cli/lib/seed-dsl.mjs`, CLI tests               | Seed DSL unit tests                                                              |
| SITE-WP-003 | Pending | Apply sloped terrain to `target-house-4` recipe and regenerate bundle/evidence.                   | `seed-artifacts/target-house-4/**`                       | `make seed name=target-house-4`, construction-readiness report, browser evidence |
| SITE-WP-004 | Pending | Add explicit excavation relationships between host toposolids and cutter floors/roofs/toposolids. | `app/bim_ai/commands.py`, site dispatch, elements, tests | Python site/excavation tests, Advisor report                                     |
| SITE-WP-005 | Pending | Render terrain, subdivisions, grade cuts, and excavation edges clearly in 3D.                     | `packages/web/src/viewport/**`                           | Focused Vitest, Playwright screenshot evidence                                   |
| SITE-WP-006 | Pending | Show grade lines and basement exposure in elevation/section saved views.                          | view derivation/rendering, saved viewpoint data          | Browser evidence from long and gable elevations                                  |
| SITE-WP-007 | Pending | Add cut/fill and excavation quantity reporting.                                                   | schedules, constructability, export manifests            | Python schedule/report tests                                                     |
| SITE-WP-008 | Pending | Add UI authoring controls for site points, graded regions, and excavation toggles.                | workspace/ribbon/site authoring UI                       | Web unit tests, manual authoring smoke                                           |
| SITE-WP-009 | Pending | Export site/excavation evidence to IFC/glTF/STL-like downstream outputs.                          | exporters and manifests                                  | Export tests and manifest checks                                                 |
| SITE-WP-010 | Pending | Close `target-house-4` acceptance with site-aware final evidence.                                 | seed artifact evidence/status                            | `sketch_bim.py accept --seed target-house-4 --clear`                             |

## SITE-WP-002 Detail: Seed DSL Site Primitives

Deliverables:

- Add `recipe.toposolids[]`.
- Add `recipe.toposolids[].subdivisions[]`.
- Add `recipe.gradedRegions[]`.
- Validate IDs, boundaries, sample points, heightmap shape, material keys, and
  flat/slope target modes.
- Preserve escape hatch behavior: raw `recipe.commands[]` still runs after
  compiled site primitives.

Proposed recipe shape:

```json
{
  "toposolids": [
    {
      "id": "t4-site-existing",
      "name": "Target-house-4 sloped site",
      "boundaryMm": [{ "xMm": -9000, "yMm": -7000 }],
      "heightSamples": [{ "xMm": -9000, "yMm": -7000, "zMm": -900 }],
      "thicknessMm": 1800,
      "baseElevationMm": -2200,
      "defaultMaterialKey": "site_grass",
      "subdivisions": [
        {
          "id": "t4-entry-path",
          "boundaryMm": [{ "xMm": -1500, "yMm": -6500 }],
          "finishCategory": "paving",
          "materialKey": "paving_concrete"
        }
      ]
    }
  ],
  "gradedRegions": [
    {
      "id": "t4-building-graded-platform",
      "hostToposolidId": "t4-site-existing",
      "boundaryMm": [{ "xMm": -7200, "yMm": -5200 }],
      "targetMode": "slope",
      "slopeAxisDeg": 90,
      "slopeDegPercent": 4
    }
  ]
}
```

Acceptance:

- Compiler emits `CreateToposolid` before subdivisions and graded regions.
- Compiler rejects degenerate boundaries and invalid graded-region modes.
- A seed recipe can create a visible sloped site without raw commands.

## SITE-WP-003 Detail: Target-House-4 Sloped Site

Deliverables:

- Add a Toposolid large enough to read in all saved exterior views.
- Use height samples that express the hillside shown in front/gable drawings.
- Add a worked-ground graded region around the house perimeter.
- Add a paving/path subdivision near primary entrances if the source drawing
  requires it.
- Update phase evidence so the long elevation and gable elevation show the
  sloped grade against the facade.

Acceptance:

- `target-house-4` no longer reads as if placed on an infinite flat slab.
- Basement exposure differs by facade, matching the drawing more closely.
- Advisor has no warning/error caused by the site addition.
- The source recipe remains reviewable; no hidden raw-command-only site logic.

## SITE-WP-004 Detail: Excavation Relationships

Deliverables:

- Add an explicit excavation relation, for example
  `CreateToposolidExcavation`, with:
  - `id`
  - `hostToposolidId`
  - `cutterElementId`
  - `cutMode`: `to_top_of_cutter`, `to_bottom_of_cutter`, or `custom_depth`
  - optional `offsetMm`
  - computed or stored `estimatedVolumeM3`
- Add update/delete behavior.
- Extend `toposolid_pierce_check` so an intersecting floor is allowed only when
  an excavation relation, slab opening, or explicit tolerance exists.
- Add schedule/report fields for host total excavation and cutter individual
  excavation.

Acceptance:

- A basement/foundation floor can legally intersect a sloped Toposolid when an
  excavation relation exists.
- A plain unresolved overlap still produces a blocking Advisor finding.
- Total and individual estimated excavation volumes are visible in reports.

## SITE-WP-005 Detail: 3D Terrain Rendering

Deliverables:

- Render Toposolid surfaces from triangulated height samples/heightmaps.
- Render thickness side faces or a clean skirt so the site reads as a solid.
- Render subdivisions as surface overlays with material differentiation.
- Render graded regions with distinct proposed-surface styling.
- Render excavation cut edges and exposed vertical faces where supported.
- Add contour/edge hints that can be toggled without obscuring the building.

Acceptance:

- Saved perspective/elevation-like exterior views make the terrain slope
  obvious.
- Browser screenshots show non-flat ground at the house perimeter.
- Site material colors do not dominate or hide facade details.

## SITE-WP-006 Detail: Elevation And Section Grade Lines

Deliverables:

- Project Toposolid intersection/near-facade samples into elevation views.
- Draw grade lines in saved long and gable elevations.
- Clip or visually expose basement/foundation walls according to grade.
- Add semantic screenshot checklist items for "visible sloped grade line" and
  "basement exposure matches reference side."

Acceptance:

- Long elevation and both gable elevations show ground lines, not only the roof
  and walls.
- The target-house-4 evidence packet can be judged against the paper drawing's
  sloping site.

## SITE-WP-007 Detail: Reporting And Advisor

Deliverables:

- Add construction-readiness findings for:
  - terrain missing when source read requires slope;
  - Toposolid/floor overlap without excavation;
  - graded region outside host boundary;
  - building level tilted or misused as terrain compensation;
  - excavation volume unavailable for declared excavation.
- Add cut/fill and excavation report rows.
- Add issue-ledger mapping from site findings to seed recipe source.

Acceptance:

- The Advisor can catch the exact failure mode from the earlier attempt: a
  target-house model built on a visually flat surface despite a sloped source.
- Site-specific warnings/errors are available through the server report, not
  only as screenshot interpretation.

## SITE-WP-008 Detail: UI Authoring

Deliverables:

- Site authoring panel actions for adding height samples, subdivisions, graded
  regions, and excavation relations.
- Direct selection of host/cutter elements for excavation.
- Numeric fields for target elevation, slope axis, and slope percent.
- Undo/redo integration and model-category visibility controls.

Acceptance:

- A user can reproduce the target-house-4 sloped site without hand-editing a
  JSON recipe.
- UI-created site elements pass the same Advisor rules as seed-created site
  elements.

## SITE-WP-009 Detail: Export Evidence

Deliverables:

- Include Toposolid, subdivisions, graded regions, and excavation metadata in
  glTF/export manifests.
- Add IFC site/topography mapping evidence where supported.
- Preserve material keys and cut/fill quantities in export summaries.

Acceptance:

- Downstream export consumers can tell that the house sits on a sloped site and
  that the basement/foundation excavates the terrain.

## SITE-WP-010 Detail: Final Target-House-4 Acceptance

Deliverables:

- Regenerate `target-house-4` from the checked-in recipe.
- Capture live browser evidence from:
  - long front elevation;
  - long rear/equivalent elevation;
  - left gable;
  - right gable;
  - attic/roof perspective;
  - plan/wire diagnostic view.
- Run final strict sketch-to-BIM acceptance at current `HEAD`.
- Update target-house-4 status to `accepted` only if all gates pass.

Acceptance:

- `python3 claude-skills/sketch-to-bim/sketch_bim.py accept --seed target-house-4 --clear`
  passes.
- The final evidence packet shows the site slope and no blocking Advisor
  warning/error remains.

## Open Technical Questions

- Should excavation relations be stored as first-class elements or as a
  relation table/metadata attached to the host Toposolid? First-class elements
  are easier to schedule, select, and explain in Advisor output.
- Should graded regions be destructive copies of Toposolids by phase, matching
  Revit, or remain explicit overlay elements until phasing is stronger? The
  short-term implementation can keep explicit overlays, but final parity should
  support existing/proposed phase copies.
- Should Toposolid triangulation happen in the backend, frontend, or both? The
  renderer needs triangles, but Advisor/quantity checks need deterministic
  backend sampling too.
- How precise should cut/fill volumes be for sketch-to-BIM initiation? A stable
  approximate prism/triangulated estimate is acceptable initially if labeled as
  estimated and tested for determinism.
