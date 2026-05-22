# Target-House-1 Capability Map

Status: no-seed planning draft. Based on
`spec/data/sketch-to-bim-capability-matrix.json` and the draft IR at
`spec/target-house/target-house-1-sketch-ir.draft.json`.

## Coverage Summary

| Feature                     | Priority | Capability                                                                   | Status            | Required Evidence                                                                            | Fallback/Tolerance                                                                                  |
| --------------------------- | -------- | ---------------------------------------------------------------------------- | ----------------- | -------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Primary massing envelope    | Critical | `cap.primary_massing_envelope`                                               | Supported         | Main 3D, rear/right 3D, model stats with no final masses.                                    | Do not proceed to detail if upper/lower hierarchy reads as generic box.                             |
| Folded white wrapper shell  | Critical | `cap.folded_white_wrapper_shell`                                             | Partial           | Main screenshot, side/rear screenshot, wire diagnostic, material/type evidence.              | Use explicit walls/roof/fascia/returns; final masses are not accepted.                              |
| Roof terrace cutout         | Critical | `cap.roof_opening_occupied_terrace`                                          | Partial           | Roof-high screenshot, side/rear screenshot, Advisor with no opening/terrace access blockers. | If subtraction does not render as a real void, stop and file renderer/authoring gap before seeding. |
| Front deep loggia           | Critical | `cap.recessed_loggia`                                                        | Supported         | Main/front screenshot, first-floor plan, Advisor with no room/access blockers.               | Model as real set-back walls/returns before rail and glazing detail.                                |
| Asymmetric gable envelope   | Critical | `cap.roof_attached_wall_profile` and `cap.standard_roof_forms`               | Supported/Partial | Front elevation, main 3D, wire seam diagnostic.                                              | If roof-wall profile samples incorrectly, repair envelope before openings.                          |
| Vertical cladding zones     | High     | `cap.vertical_cladding`                                                      | Partial           | Front and side screenshots showing ground base and central pier rhythm.                      | Prefer clean material intent over unreliable fake strips; record if renderer cannot show battens.   |
| Opening and glazing rhythm  | High     | `cap.opening_and_glazing_rhythm`                                             | Supported         | Front elevation, door/window schedule, host-opening Advisor checks.                          | Hosted openings first; decorative mullions cannot substitute for cuts.                              |
| Room access and enclosure   | Critical | `cap.room_access_and_enclosure` and `cap.room_programme_layout`              | Supported/Partial | Ground and first-floor plans, wire diagnostic, Advisor with zero room/stair blockers.        | Redesign geometry; do not hide issues with universal room-separation lines.                         |
| Site orientation and plinth | Medium   | `cap.site_orientation_and_sun`                                               | Partial           | Assumption log, main screenshot with orientation metadata.                                   | Site north remains a tolerance until supplied.                                                      |
| Documentation evidence set  | High     | `cap.documentation_views_schedules` and `cap.saved_view_and_evidence_packet` | Partial           | Screenshot manifest, schedules, evidence package, status packet.                             | Do not claim documentation readiness until artifacts exist.                                         |

## Product Surface Map

| Need                                  | Preferred Surface                                                      | Current Surface Decision                                                  |
| ------------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Validate IR and capability coverage   | CLI `sketch ir validate` or `initiation-check`                         | Use CLI until API/MCP routes cover the richer packet.                     |
| Compile semantic seed recipe          | CLI `sketch seed compile` / `seed-dsl compile`                         | CLI-only compiler is acceptable; API route is contract-only.              |
| Apply phase bundles                   | CLI `sketch phase apply` or generic bundle API                         | Use dry-run first, then commit only after phase review.                   |
| Advisor and constructability evidence | CLI `advisor`, `qa advisor`, `initiation-run`, backend evidence routes | Collect warning and info payloads after every phase.                      |
| Visual evidence                       | Browser/evidence automation plus product screenshot manifest           | Required for partial features; nonblank screenshots alone are not enough. |
| Phase acceptance                      | CLI `sketch phase accept` / `initiation-check` packet                  | Accept only with blockers fixed or explicit tolerances.                   |

## Capability Risks Requiring Evidence

- `cap.roof_opening_occupied_terrace` is partial. The generation run must prove
  that the roof opening cuts the rendered mesh and reads as an occupied terrace.
- `cap.folded_white_wrapper_shell` is partial. The generation run must prove the
  shell reads as one thick white object without mass placeholders.
- `cap.vertical_cladding` is partial. Visual rhythm can be material-based if
  explicit battens create artifacts.
- `cap.room_programme_layout` is partial. Room and stair evidence must be
  inspected before adding documentation/export work.
- `cap.documentation_views_schedules` is partial. The final packet must include
  durable saved views and schedules, not transient UI state.
