# Sketch-to-BIM brief — target house seed

> Filled per SKB-21 from `spec/target-house-seed.md` + the two reference
> PNGs (`spec/target-house-seed-vis.png`, `spec/target-house-vis-colored.png`).
> Calibrated values match the canonical `SAMPLE_BRIEF` in
> `app/bim_ai/skb/brief.py`, which was authored for this exact house.

## title

Asymmetric two-storey demo house

## styleHint / archetypeHint

- styleHint: `modernist`
- archetypeHint: `modernist_gable_two_story` (no exact archetype in
  SKB-09; closest is `single_family_two_story_modest` but the brief
  diverges enough on massing that we author from blank per user choice)

## siteOrientationDeg

`0.0` — the south facade in the spec faces +Y as drawn; we adopt the
spec's south-as-front-face convention (camera SSW iso means viewer is
south-south-west of the building).

## Coordinate convention

- `+X` = east
- `+Y` = up (height; Three.js render axis)
- `+Z` = north (so south facade has the smallest Z)
- Plan footprints `XY[]` use `xMm` = east, `yMm` = north (so y=0 is
  south edge, y=8000 is north edge)
- Heights use `zMm` (level elevations) → render axis Y

## program

| name                            | targetAreaM2 | storeyHint |
| ------------------------------- | -----------: | ---------- |
| Open-plan kitchen + living      |         56.0 | Ground     |
| Bedroom 1 (master)              |         18.0 | First      |
| Bedroom 2                       |         12.0 | First      |
| Bathroom                        |          6.0 | First      |
| Loggia (covered balcony)        |         10.0 | First      |
| Roof terrace (east deck)        |         16.0 | First      |

## keyDimensions

| label                                            |  valueMm | confidence | sketchAnchor                                |
| ------------------------------------------------ | -------: | ---------- | ------------------------------------------- |
| ground-floor footprint width  (E-W)              |     7000 | explicit   | spec §1.6 "wide ground floor extends right" |
| ground-floor footprint depth  (N-S)              |     8000 | explicit   | spec §1.2 typical small-house depth         |
| first-floor footprint width  (E-W)               |     5000 | inferred   | spec §1.2 upper aligned to west; ext = 2000 |
| first-floor footprint depth  (N-S)               |     8000 | inferred   | upper depth matches ground depth            |
| ground-to-first floor height  (F2F)              |     3000 | explicit   | spec §1 typical residential                 |
| east extension flat-roof parapet                 |     3200 | inferred   | spec §1.6 "low parapet" → +200mm above F2F  |
| ridge height above ground (Y)                    |     7500 | inferred   | spec §1.2 "high off-center ridge"           |
| east upper-floor wall height (eaveRight)         |     4500 | inferred   | spec §1.2 "much higher before the roof"     |
| west upper-floor wall height (eaveLeft)          |     1200 | inferred   | spec §1.2 "very low west wall"              |
| ridge offset east of upper-volume center         |     1800 | inferred   | spec §1.2 "significantly off-center east"   |
| roof slope (deg)                                 |       45 | inferred   | satisfies eaveLeft + leftRun·tan > eaveRight|
| upper-floor wall thickness                       |      250 | inferred   | residential interior+ext                    |
| ground-floor wall thickness                      |      250 | inferred   | residential                                 |
| picture-frame sweep profile (south face)         |  200×100 | inferred   | spec §1.4 "thick smooth white frame"        |
| loggia recess depth (setbackMm)                  |     1500 | explicit   | spec §1.4 "set back ~1500 mm"               |
| balcony projection south of recess back wall     |      400 | inferred   | spec §1.4 "projects very slightly forward"  |
| dormer width (along ridge / N-S)                 |     2400 | inferred   | spec §1.6 "massive rectangular cut-out"     |
| dormer depth (across ridge / E-W)                |     2000 | inferred   | spec §1.6                                   |
| dormer wall height (above east eave)             |     2400 | inferred   | floor-to-ceiling glass doors                |

## Roof slope sanity check

Per `_buildAsymmetricGableGeometry`'s formula
`ridgeY = eaveLeftMm + leftRunMm · tan(slopeDeg)`, with `ridgeAlongX=false`
(ridge parallel to N-S axis, asymmetric in E-W):

- `halfSpan = (5000) / 2 = 2500 mm`
- `offset = +1800 mm` (ridge shifted east of upper-volume center)
- `leftRun = halfSpan + offset = 4300 mm` (west edge → ridge plan distance)
- `ridgeY = 1200 + 4300 · tan(45°) = 1200 + 4300 = 5500 mm`
- Required `> eaveRightMm = 4500 mm` ✓

So with `slopeDeg=45`, the ridge sits 1000 mm above the east eave — the
classic seed-fidelity flat-roof failure mode is avoided.

Actual ridge height above ground floor (F2F=3000): `3000 + 5500 = 8500 mm`
plan-frame total Y. Note: spec says "ridge height ~7500 mm" (inferred);
8500 mm is slightly above that. Tolerable per skill's ±5% rule on
footprint dims; ridge is not dimensioned explicitly in the spec.

## materialIntent

| surface                              | description                              | catalogKey                       |
| ------------------------------------ | ---------------------------------------- | -------------------------------- |
| ground walls + east extension        | light beige/grey vertical siding         | `cladding_beige_grey`            |
| upper side walls (west, north, east) | smooth white render                      | `render_white`                   |
| loggia recessed back wall            | warm natural wood vertical siding        | `cladding_warm_wood`             |
| roof                                 | dark grey standing-seam metal            | `metal_standing_seam_dark_grey`  |
| asymmetric front frame (sweep)       | smooth white render                      | `render_white`                   |
| balcony balustrade                   | frameless transparent glass              | `glass_clear`                    |
| windows + door frames                | dark grey aluminium                      | `aluminium_dark_grey`            |
| front door                           | solid panel with vertical glass insert   | `cladding_dark_grey` + `glass_clear` |

## specialFeatures

- **Loggia** — recessed covered balcony on south upper facade.
  ~1500 mm setback, frameless glass balustrade (~1100 mm guard), wood
  floor (`cladding_warm_wood`) on the recess back wall.
- **Asymmetric gable** — ridge ~1800 mm east of upper-volume center;
  west eave 1200 mm, east eave 4500 mm above first-floor level; slope 45°.
- **Picture-frame outline** — KRN-15 sweep tracing the south-face gable
  pentagon (5 vertices) in `render_white`, 200×100 mm rectangular profile.
- **Dormer cut-out** — KRN-14 dormer on east roof slope, 2400 (along
  ridge) × 2000 (across ridge), 2400 mm wall height, flat roof,
  `render_white` walls. Floor-to-ceiling sliding glass doors host on
  the dormer's east face opening to the roof terrace below.
- **East extension flat-roof deck** — wide ground-floor block extending
  +2000 mm east of the upper-volume east edge. Top forms a flat roof
  terrace surrounded by a low parapet (~200 mm above F2F).

## referenceImages

- `spec/target-house-vis-colored.png` — SSW iso colour study + 3 panels
  (front elev, side elev, rear axo). presetId: `vp-main-iso`.
- `spec/target-house-seed-vis.png` — SSW iso line sketch. presetId: `vp-main-iso`.

## Viewpoints to author (Phase 7)

Per SKB-16 presets matched to the colour-study panels:

- `vp-main-iso` — SSW iso (azimuth -25°, elevation 30°, distance×1.6)
- `vp-front-elev` — south orthographic
- `vp-side-elev-east` — east orthographic (shows the asymmetric gable side profile)
- `vp-rear-axo` — NE iso (shows the dormer cut-out + east deck)

## Phase plan

1. **Massing** — 3 mass primitives:
   - `mass-gf` (ground floor): 7000×8000, height 3000, level Ground
   - `mass-uf` (upper west-aligned): 5000×8000, height 4500 (top of east eave), level Upper
   - `mass-ext-east` (east extension): 2000×8000, height 200 (the parapet block), level Upper, sits on top of ground floor
2. **Skeleton** — `materializeMassToWalls` each mass; floors at every level; flat roof footprint on the upper east extension as the parapet floor.
3. **Envelope** — convert flat upper-volume roof to `asymmetric_gable`; attach upper walls to roof; primary materialKeys; KRN-15 sweep along the south-face gable polygon for the picture-frame.
4. **Openings** — front door, two GF south windows + one extension window; on the upper south wall set `recessZones: [{ alongTStart: 0.10, alongTEnd: 0.90, setbackMm: 1500 }]`; sliding-glass door + trapezoidal `outlineKind: 'gable_trapezoid'` window in the recess.
5. **Interior** — open-plan GF room with stairs, slab opening for stair, 4 rooms upper, partitions, balcony+stair railings.
6. **Detail** — `createBalcony` projecting south of the recess back wall (frameless glass); KRN-14 dormer on east roof slope; sliding glass doors on the dormer face; standing-seam roof material applied.
7. **Documentation** — sheets, schedules, plan_views, viewpoints (SKB-16 presets), section_cuts, dimensions.

Each phase: commit → Playwright screenshot at `vp-main-iso` (and the panel-specific viewpoint where applicable) → compare to target → refine up to 10 iterations → advance.
