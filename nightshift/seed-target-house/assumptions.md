# Assumption log — seed-target-house

Every dimensional / material / geometric judgment call where the spec
or sketch did not give an explicit number. Each entry pins the value
to a sketch anchor so a human reviewer can audit later (SKB-08 will
formalise this with `agent_assumption` elements).

## Dimensions

| ID  | Assumption                                      | Value   | Sketch anchor                                              | Reasoning                                                                                |
| --- | ----------------------------------------------- | ------- | ---------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| A1  | Ground-floor width (E-W)                        | 7000 mm | colour-study main perspective; spec §1.6 extension+upper   | Adopted from canonical SAMPLE_BRIEF in `app/bim_ai/skb/brief.py`. Explicit in brief.     |
| A2  | Ground-floor depth (N-S)                        | 8000 mm | spec §1.2                                                  | Standard residential plan; SAMPLE_BRIEF.                                                 |
| A3  | Upper-floor width                               | 5000 mm | spec §1.2 "aligned to west edge"                           | 7000 GF − 2000 east extension.                                                           |
| A4  | F2F height                                      | 3000 mm | spec §1.2                                                  | Standard residential.                                                                    |
| A5  | West eave (eaveLeftMm)                          | 1200 mm | spec §1.2 "very low west wall"                             | Pushes pitch ratio dramatic; satisfies slope formula with eaveRight=4500.                |
| A6  | East eave (eaveRightMm)                         | 4500 mm | spec §1.2 "much higher before the roof begins"             | Same as seed-fidelity attempt; renderer fix `dea650c2` makes this geometry watertight.   |
| A7  | Ridge offset east of upper-volume center        | 1800 mm | spec §1.2 "significantly off-center east"                  | Same as seed-fidelity attempt; satisfies slope sanity at slope=45°.                      |
| A8  | Roof slope                                      | 45°     | derived                                                    | Min slope ≈ 37.5° for ridge above east eave; 45° gives 1000 mm headroom.                 |
| A9  | Loggia recess depth                             | 1500 mm | spec §1.4 "set back ~1500 mm"                              | Explicit in spec, but explicitly an approximation in spec text.                          |
| A10 | Balcony projection south of recess back wall    | 400 mm  | spec §1.4 "projects very slightly forward"                 | "Slightly" → smaller than 500 mm; balcony slab reaches the front-frame plane.            |
| A11 | Dormer width (along ridge, N-S)                 | 2400 mm | spec §1.6 "massive rectangular cut-out"                    | Spans roughly 30 % of upper depth.                                                       |
| A12 | Dormer depth (across ridge, E-W)                | 2000 mm | spec §1.6                                                  | Reaches from the east eave back into the slope, ending well short of the ridge.          |
| A13 | Dormer wall height (above east eave)            | 2400 mm | spec §1.6 floor-to-ceiling sliding doors                   | F2C ≈ 2400 mm typical residential.                                                       |
| A14 | Dormer position-on-roof (alongRidge)            |  ~+2000 mm from ridge midpoint, south end | spec §1.6 "opens onto the flat roof deck" | Place near the south end so the doors face the deck.                                    |
| A15 | East extension parapet height above F2F         | 200 mm  | spec §1.6 "low parapet"                                    | Matches typical low-deck parapets; not safety-rated for occupied terrace, but visual.    |
| A16 | Wall thickness (interior + ext)                 | 250 mm  | not in spec                                                | Standard residential exterior wall.                                                      |
| A17 | Picture-frame sweep profile                     | 200×100 mm | spec §1.4 "thick smooth white frame"                    | 200 mm thick (in-facade-plane) × 100 mm proud (out-of-facade-plane).                     |
| A18 | Door clear height                               | 2100 mm | not in spec                                                | Residential standard.                                                                    |
| A19 | Trapezoidal upper window head height            | follows roof slope | spec §1.4 "top edge slopes to follow long, low pitch"           | KRN-12 `outlineKind: 'gable_trapezoid'` + `attachedRoofId: 'hf-roof-main'`.              |
| A20 | Site orientation                                | 0° (north up) | not in spec                                          | Spec says south facade is the front, so building axis aligns to grid.                   |

## Materials (all confirmed against MAT-01 catalog)

| Surface                        | Catalog key                       |
| ------------------------------ | --------------------------------- |
| Ground walls + east extension  | `cladding_beige_grey`             |
| Upper side walls (W/N/E render)| `render_white`                    |
| Loggia recessed back wall      | `cladding_warm_wood`              |
| Roof                           | `metal_standing_seam_dark_grey`   |
| Asymmetric front sweep         | `render_white`                    |
| Balcony balustrade             | `glass_clear`                     |
| Window/door frames             | `aluminium_dark_grey` (rendered)  |
| Front door panel               | `cladding_dark_grey`              |

## Renderer-specific guards

- **Slope sanity** — eaveLeft 1200 + leftRun 4300 · tan(45°) = 5500 mm
  ridgeY → 1000 mm above east eave 4500. Avoids the seed-fidelity
  flat-roof failure.
- **Asymmetric_gable watertightness** — `dea650c2` adds the bottom-closure
  triangles so dormer CSG cuts no longer silently no-op. Trust the fix.
- **Recess setback ≤ thickness × 8** — 1500 ≤ 250 × 8 = 2000 ✓.
- **Sweep path closure** — south-face gable polygon must be 5 vertices
  (SW → SE → NE-eave → ridge-top → NW-eave → close to SW).
- **Dormer footprint within host** — 2400×2000 inside 5000×8000; 2000 mm
  depth from east eave, 2000 mm position from south edge — fits.
