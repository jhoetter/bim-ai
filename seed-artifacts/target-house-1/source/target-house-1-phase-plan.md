# Target-House-1 Phase Plan

Status: no-seed planning draft. This plan defines the later generation run; it
does not authorize model creation.

## Phase Gates

Every phase uses this loop:

1. Build or update a deterministic `cmd-v3.0` bundle/recipe for the phase.
2. Run dry-run against the current model revision.
3. Commit only when dry-run is clean.
4. Collect Advisor warning/info payloads and constructability evidence where
   applicable.
5. Capture required views for that phase.
6. Fix current-phase warnings or record a scoped tolerance with expiry.
7. Run phase acceptance before advancing.

## Phases

| Phase                                   | Scope                                                                                                  | Critical Feature IDs                                                         | Entry Criteria                                                   | Exit Evidence                                                                                                   |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------- | ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| P0 Readiness preflight                  | Confirm sources, scale basis, IR, capability map, and no-seed authorization.                           | All                                                                          | This packet reviewed; no `seed-artifacts/target-house-1` exists. | Filled readiness checklist; IR validation packet in a temporary or approved evidence path.                      |
| P1 Massing and plinth                   | Levels, 14 m by 10 m footprint basis, plinth, ground base, upper volume extents, first view set.       | `primary_massing_envelope`                                                   | Scale assumption accepted.                                       | Main/rear 3D screenshots; no final mass placeholders committed beyond temporary studies.                        |
| P2 Folded shell and roof form           | White upper wrapper, roof plane, thick fascia/returns, roof-wall profile, overhang/cantilever.         | `folded_white_wrapper_shell`, `asymmetric_gable_envelope`                    | P1 silhouette passes.                                            | Main, front elevation, rear/right, wire diagnostic; roof/wall seam warnings fixed or tolerated.                 |
| P3 Roof terrace cutout                  | Roof opening, terrace floor, return faces, glass guard, access glazing/door, terrace room/zone.        | `roof_terrace_cutout`                                                        | P2 shell accepted.                                               | Roof-high and rear/right screenshots proving real void; Advisor has no opening-host or terrace-access blockers. |
| P4 Front loggia, openings, and cladding | Recessed upper facade, three-bay rhythm, upper guard rail, ground openings, cladding zones.            | `front_deep_loggia`, `opening_and_glazing_rhythm`, `vertical_cladding_zones` | P2 shell accepted; P3 not visually regressed.                    | Main/front screenshots; door/window schedule draft; no host-opening blockers.                                   |
| P5 Rooms, stair, and interiors          | Ground and first-floor rooms, real partitions, stair, slab opening, access doors, key fixtures/assets. | `room_access_and_enclosure`                                                  | Envelope/opening hosts stable.                                   | Ground and first-floor plans; wire diagnostic; no room/stair/door blockers.                                     |
| P6 BIM data and coordination            | Types, materials, layer placeholders, classifications, structure-lite and MEP-lite placeholders.       | All BIM data features                                                        | P5 room topology accepted.                                       | BIM data quality checklist; material/type schedule; classification and structure/MEP notes.                     |
| P7 Documentation and export prep        | Saved views, schedules, sheet/PDF starter, IFC/GLB/export manifests, final evidence packet.            | `documentation_evidence_set`                                                 | P6 clean or tolerated.                                           | Current-head evidence package; screenshots; schedules; export manifests; final acceptance checklist.            |

## Phase Acceptance Rules

- P1 and P2 cannot pass if the house reads as a generic roof-on-box model.
- P3 cannot pass unless the roof terrace cutout is visible as a real void in at
  least one normal user-facing 3D view and the roof-high view.
- P4 cannot pass if the loggia is a flat attached balcony or if cladding crosses
  hosted openings.
- P5 cannot pass with `room_boundary_open`, `room_no_door`,
  `room_derived_interior_separation_ambiguous`, stair comfort, or slab opening
  blockers.
- P6 cannot pass unless rooms, elements, types, materials, layer placeholders,
  classifications, and schedule flags satisfy the BIM information requirements.
- P7 cannot pass with stale git head, stale model revision, stale Advisor rules,
  missing required screenshots, missing schedules, or unresolved export blockers.

## Evidence Directory Policy

This planning packet intentionally creates no seed artifacts. During the later
approved generation run, evidence may be written under the approved seed
artifact path only after the user authorizes target-house-1 generation. Before
that approval, any validation output must go to ignored temporary paths such as
`tmp/target-house-1-readiness-*`.
