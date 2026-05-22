# Target-House-1 BIM Information Requirements Draft

Status: no-seed planning draft. Do not create `seed-artifacts/target-house-1`
from this document without an explicit generation approval.

Sources:

- `spec/target-house/target-house-1.png`
- `spec/target-house/target-house-2.png`
- `spec/target-house/floorplan.png`
- `spec/target-house/target-house-seed.md`
- `spec/methodology/sketch-to-bim-methodology.md`

## Exchange Goal

Target-house-1 is a `project_initiation_bim` seed. Acceptance requires a
visually faithful BIM model that can be continued by another user, not only a
rendered massing study.

Required model uses:

- visual fidelity against the two axonometric references;
- room programme and room schedule starter;
- element category/type/material schedule starter;
- coordination sanity for stair, slab openings, roof opening, guards, wet rooms,
  and access;
- saved views and evidence package;
- IFC, GLB, PDF/sheet, schedule, and source-bundle export readiness.

## Source Scale And Assumptions

The dimensioned floorplan is 14.0 m wide by 10.0 m deep. The earlier image-locked
seed spec records smaller proportion targets. The generation run must resolve
this before authoring:

| Assumption         | Draft Decision                                                                                | Acceptance Impact                                                                          |
| ------------------ | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Scale basis        | Use the floorplan's 14.0 m by 10.0 m footprint for target-house-1.                            | Any alternate uniform scale must be written as a tolerance before phase 1.                 |
| Project north/site | Use plan-up as project north with explicit concept base point, survey point, parcel, and terrain. | Replace concept datums when a legal survey or north arrow is supplied.                     |
| Shell construction | Author as BIM elements: walls, roof, floors, fascia/sweeps, returns, hosted openings, guards. | Final acceptance fails if translucent mass placeholders remain in the envelope.            |
| Room derivation    | Open-plan rooms may use limited room separation only where architecturally open.              | Advisor room ambiguity warnings block phase acceptance.                                    |

## Rooms And Spaces

Room and space data must be present, schedulable, and bounded enough for Advisor
checks. Target areas are draft values from the floorplan labels.

| ID                        | Level  | Name                          | Target Area | Function               | Access/Schedule Requirement                                              |
| ------------------------- | ------ | ----------------------------- | ----------: | ---------------------- | ------------------------------------------------------------------------ |
| `room_gf_kitchen_dining`  | Ground | Kitchen / dining              |     18.4 m2 | Cooking and dining     | Door/path to living and entry; include fixtures/cabinet markers.         |
| `room_gf_living`          | Ground | Living area                   |     19.8 m2 | Living                 | Door/path to entry; include sofa/media markers.                          |
| `room_gf_entry`           | Ground | Entry / stair hall            |      3.4 m2 | Entry and stair access | Exterior door plus stair access.                                         |
| `room_gf_bath_laundry`    | Ground | Bath / laundry                |      4.8 m2 | Wet room/laundry       | Door from utility/circulation; toilet, basin, shower/laundry markers.    |
| `room_gf_utility`         | Ground | Utility                       |      3.4 m2 | Service/storage        | Door access; service placeholder.                                        |
| `room_gf_carport`         | Ground | Recessed garage / carport     |     19.3 m2 | Covered parking        | Exterior/open access; schedule as covered external space.                |
| `room_l1_primary_bedroom` | First  | Primary bedroom               |     17.6 m2 | Sleeping               | Door from landing; bed and wardrobe markers.                             |
| `room_l1_walk_in_closet`  | First  | Walk-in closet                |      4.7 m2 | Storage                | Door from primary suite zone.                                            |
| `room_l1_ensuite`         | First  | Ensuite                       |      5.2 m2 | Wet room               | Door access; toilet, basins, shower marker.                              |
| `room_l1_hall_landing`    | First  | Hall / landing                |     11.1 m2 | Circulation            | Stair opening and doors to all first-floor rooms.                        |
| `room_l1_bedroom_2`       | First  | Bedroom 2                     |     12.2 m2 | Sleeping               | Door from landing; bed/desk/storage markers.                             |
| `room_l1_deep_loggia`     | First  | Deep balcony / loggia         |     16.5 m2 | Covered outdoor space  | Access from upper facade; guard rail required.                           |
| `room_l1_roof_court`      | First  | Open-to-sky roof court / void |     22.3 m2 | Open terrace/void      | Access door/glazing from landing or bedroom zone; guard/edge protection. |

Blocking room checks:

- no `room_boundary_open`, `room_unenclosed`, or room ambiguity warnings;
- no interior room without a door/path;
- stair and slab openings must be coordinated in both plan views;
- room schedule includes level, name, number/id, function, target area, bounded
  status, and schedule inclusion flag.

## Element Semantics

| Element Set                           | BIM Category Intent              | Export Intent                                  | Minimum Metadata                                                              |
| ------------------------------------- | -------------------------------- | ---------------------------------------------- | ----------------------------------------------------------------------------- |
| Ground base exterior walls            | Exterior wall                    | IFC wall                                       | Type, exterior flag, cladding material/layer intent, load-bearing assumption. |
| Upper wrapper side/front return walls | Exterior wall/shell wall         | IFC wall                                       | White shell material, thickness intent, exterior flag, shell feature id.      |
| Roof/folded shell                     | Roof                             | IFC roof/slab where product supports it        | White shell roof type, thickness/layer placeholder, host openings.            |
| Plinth and floors                     | Floor/slab                       | IFC slab                                       | Level, type, material, thickness, exterior/interior role.                     |
| Roof terrace floor                    | Exterior floor/terrace slab      | IFC slab                                       | Walking surface, drainage tolerance, guard/access relation.                   |
| Doors and windows                     | Hosted openings/family instances | IFC door/window                                | Host id, type id, width/height, room access relation where applicable.        |
| Loggia and roof guards                | Railing/guard                    | IFC railing/proxy as supported                 | Height, material, hosted edge/feature relation.                               |
| Stairs and slab opening               | Stair plus opening               | IFC stair/opening                              | Level-to-level relation, direction, comfort checks, clearance.                |
| Furniture/equipment markers           | Asset/family instances           | IFC furnishing/equipment proxy where supported | Type id, room id, schedule category, evidence role.                           |

## Type, Material, And Layer Intent

| Type                          | Draft Intent                                                                                      |
| ----------------------------- | ------------------------------------------------------------------------------------------------- |
| `EXT-GF-CLAD-200`             | Exterior wall, approx. 200 mm structural/core placeholder plus vertical board-and-batten finish.  |
| `EXT-UPPER-WHITE-SHELL-500`   | Smooth matte white shell wall/return, approx. 450-600 mm visual thickness at exposed edges.       |
| `ROOF-WHITE-FOLDED-SHELL-500` | White roof/wrapper with thickness placeholder and roof opening host support.                      |
| `SLAB-GROUND-PLINTH-200`      | Light concrete/plinth slab, scheduleable as floor/slab.                                           |
| `SLAB-TERRACE-WALKING-150`    | Light grey terrace walking surface with waterproofing/drainage placeholder.                       |
| `INT-PARTITION-100`           | Interior partitions for bedrooms, bathrooms, utility, closet, and circulation.                    |
| `GLAZING-NEUTRAL-GREY`        | Semi-transparent neutral glazing for large facade panels, windows, roof-court access, and guards. |
| `RAIL-BLACK-LINEWORK`         | Thin black guard/rail members at loggia and roof-court exposed edges.                             |

Layer metadata can be placeholder quality, but type names, material assignments,
thickness intent, exterior/interior role, and schedule participation must be
present.

## Classification Requirements

Rooms need DIN 277-like placeholder use classes:

- living/sleeping/cooking: usable area;
- circulation: circulation area;
- wet rooms/utility: service/usable area as appropriate;
- loggia, carport, roof court: external/covered or open ancillary area.

Elements need DIN 276-like placeholder cost groups:

- walls and envelope: 330/340 placeholder;
- roof and roof opening returns: 360 placeholder;
- floors/slabs/plinth: 320/350 placeholder;
- openings/glazing: 330/340 placeholder;
- stair/rail/guards: 370 placeholder;
- fixed equipment/furniture markers: 600 placeholder where represented.

IFC entity intent must be recorded for walls, slabs/floors, roofs, spaces, doors,
windows, stairs, railings, and furnishing/equipment proxies.

## Structure-Lite

Required assumptions:

- upper wrapper and roof are treated as load-bearing shell intent unless product
  structure tools create a separate support model;
- ground base walls and stair core/screen zone are primary support candidates;
- carport/recess and upper overhang require a load-path note and a tolerance if
  no beam/column-lite elements are authored;
- roof opening returns need coordination notes for shell continuity;
- stair opening in first-floor slab must align with stair geometry.

## MEP-Lite

Required placeholders:

- wet-room stacking/adjacency note for ground bath/laundry and first-floor
  ensuite;
- vertical service riser or service zone placeholder near utility/stair/wet
  rooms;
- kitchen sink/cabinet marker and laundry/bath equipment markers;
- opening requests or coordination notes where ducts/pipes would cross the
  shell, roof court, or slab opening;
- MEP route placeholders may remain schematic but must not conflict with stair,
  doors, or rooms.

## Planning And Site

The seed must carry concept site data as explicit model elements rather than
tolerance-only notes:

- use floorplan up as project north until a north arrow or legal survey is
  supplied;
- set the project base point at the front-left/south-west ground-floor footprint
  corner at elevation 0;
- create a survey point at the local origin/shared elevation 0 as the concept
  shared-coordinate datum;
- create a concept parcel/site boundary, four property lines with setback
  metadata, and a terrain toposolid around the target-house footprint;
- treat sun/shadow only as visual-evidence support until geographic location and
  true north are known;
- keep B-plan constraints and permit confirmations out of scope until supplied;
- use Germany-oriented DIN 277/DIN 276 placeholders and residential stair comfort
  checks as concept assumptions, not permit confirmation.

## Sustainability / Material Passport Starter

The seed does not need a full LCA, but every major material key from the layer
sets must have starter passport data:

| Material Key                | Required Starter Data                                                                  |
| --------------------------- | -------------------------------------------------------------------------------------- |
| `mat_smooth_white_shell`    | EPD/source confidence placeholder, carbon placeholder, quantity source from shell area |
| `mat_wall_core`             | Core wall material placeholder, quantity source from ground wall layer volume          |
| `mat_vertical_board_batten` | Cladding product placeholder, reuse/recyclability notes, facade area quantity source   |
| `mat_light_concrete`        | Concrete/plinth placeholder, aggregate recycling note, slab volume quantity source     |
| `mat_roof_waterproofing`    | Membrane/product placeholder, take-back/disposal note, roof/terrace area source        |

## Export And Evidence Requirements

The generation run must produce:

- current-head evidence package with git head, model revision, and Advisor rule
  digest;
- Advisor warning/info payloads and constructability `construction_readiness`
  report;
- screenshots for `main_front_left`, `front_elevation`, `rear_right_axon`,
  `roof_high`, `front_loggia`, `ground_floor_plan`, `first_floor_plan`, and
  `wire_diagnostic`;
- room schedule and door/window schedule;
- export manifests for IFC, GLB, PDF/sheets, schedules, evidence package, and
  source bundle;
- tolerance ledger for any unresolved partial capability or software limitation.
