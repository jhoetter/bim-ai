# Target House 4 - Testhaus Source Brief

## Source Package

Customer source folder: `/Users/jhoetter/Desktop/Testhaus`

Primary architectural sources reviewed:

- `EG.pdf`: ground floor plan, scale 1:100.
- `DG.pdf`: roof/attic floor plan, scale 1:100.
- `Grundrisse, Schnitt.pdf`: combined floor plans and cross section.
- `Ansichten.pdf`: long elevations and left/right gable elevations.
- `Wohnflaechenberechnung.pdf` and `Umbauter Raum.pdf`: area/volume support sources.

## Visual Readout

The house is a post-war German two-family semi-detached residence, drawn as
two mirrored dwellings inside one long rectangular building. The footprint is
approximately 19.80 m wide and 9.90 m deep. The plan reads as two 9.90 m wide
halves split by a central party wall. Each half has its own entrance and stair,
with living/bedroom rooms along the rear side and compact kitchen/bath/child
rooms near the front side.

The main exterior character is traditional: light rendered masonry walls,
a steep tiled gable roof with the ridge running along the long 19.80 m axis,
overhanging eaves, paired dormers on the long roof faces, small punched
windows, and a darker horizontal cladding/band zone below the eaves in the
long elevations. The gable elevations show the full triangular roof profile
with small upper gable windows and lower larger rectangular openings.

## Model Scope

This seed targets project-initiation BIM, not a construction-document replica.
It captures the loadable architectural starting point:

- full basement, ground floor, and attic/roof floor levels;
- full-width semi-detached envelope;
- repeated left/right dwelling room layout;
- central party wall and stair cores;
- steep long-ridge gable roof;
- four dormers matching the paired elevation rhythm;
- primary exterior wall openings for doors and windows;
- material contrast between rendered masonry, darker eave band, red tiled roof,
  glass, and interior partitions;
- saved plan, section, and 3D viewpoints for review.

## Assumptions

- The old sheets are photographed/scanned and visibly distorted by paper folds,
  so dimensions are normalized to the repeated dimension strings visible in
  the plans: 19.80 m overall width and 9.90 m overall depth.
- Each dwelling half is modeled as 9.90 m by 9.90 m.
- The attic floor is represented at 3.00 m above ground with knee walls attached
  to the gable roof.
- The basement is included as a simple structural level with storage rooms,
  not as a fully detailed MEP or foundation model.
- Doors are authored as typed door elements where they matter for access and
  schedules. Window proportions are kept as wall openings because typed window
  operation clearances produced false-positive conflicts against the compact
  1956 partition layout.
