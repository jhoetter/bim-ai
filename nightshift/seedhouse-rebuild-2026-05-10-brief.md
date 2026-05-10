# Seedhouse Rebuild Brief — 2026-05-10

## Visual Source Read

- Reference image: `spec/target-house.jpeg`.
- Primary view: front-left axonometric looking at a modern minimalist two-storey house.
- Dominant volume: a larger smooth-white upper wrapper shell with a folded/asymmetric roof.
- Support volume: a smaller vertically-clad ground-floor rectangular base below the upper shell.
- Critical voids: deep front upper loggia recessed behind a thick white frame; large right-side roof terrace cutout visible from above/right.
- Roof: white folded/asymmetric shell, ridge running in plan depth direction, with a rectangular occupied void cut into the right roof plane.
- Facade rhythm: ground floor has narrow portrait openings and far-right front door; upper loggia has left glass bay, central vertical-clad pier, right full-height glass bay, and thin black horizontal rails.

## Structured Brief

```json
{
  "style": "minimalist modernist",
  "program": [
    { "name": "Entrance / stair hall", "level": "ground", "programmeCode": "circulation" },
    { "name": "Guest WC", "level": "ground", "programmeCode": "toilet" },
    { "name": "Kitchen", "level": "ground", "programmeCode": "kitchen" },
    { "name": "Living / dining", "level": "ground", "programmeCode": "living" },
    { "name": "Master bedroom", "level": "upper", "programmeCode": "bedroom" },
    { "name": "Secondary bedroom", "level": "upper", "programmeCode": "bedroom" },
    { "name": "Bathroom", "level": "upper", "programmeCode": "bathroom" },
    { "name": "Landing", "level": "upper", "programmeCode": "circulation" },
    { "name": "Embedded roof terrace", "level": "upper", "programmeCode": "terrace" }
  ],
  "siteOrientation": { "northDegCwFromPlanX": 90 },
  "keyDimensions": {
    "upperShellWidthMm": 8000,
    "upperShellDepthMm": 8650,
    "groundBaseWidthMm": 5600,
    "groundBaseDepthMm": 8200,
    "floorToFloorMm": 3000,
    "groundWallHeightMm": 3000,
    "upperEaveLeftMmAboveUpper": 2500,
    "upperEaveRightMmAboveUpper": 2350,
    "frontLoggiaRecessMm": 1550,
    "roofTerraceCutoutMm": [2400, 3200],
    "wrapperVisibleThicknessMm": 550
  },
  "materialIntent": [
    { "surface": "upper wrapper shell and roof", "materialKey": "white_render", "evidence": "smooth white monolithic shell in image" },
    { "surface": "ground base and upper loggia pier", "materialKey": "cladding_warm_wood", "evidence": "vertical board cladding" },
    { "surface": "glazing and roof terrace guards", "materialKey": "glass_clear", "evidence": "grey transparent panes" },
    { "surface": "loggia rails", "materialKey": "aluminium_black", "evidence": "thin black horizontal railing lines" },
    { "surface": "terrace walking surface", "materialKey": "render_light_grey", "evidence": "light grey flat occupied cutout floor" }
  ],
  "specialFeatures": {
    "asymmetricGable": { "ridgeOffsetDir": "east", "severity": "moderate" },
    "loggiaRecess": { "face": "south/front", "depthMm": 1550 },
    "roofTerraceCutout": { "face": "east/right roof plane", "dimensionsMm": [2400, 3200] }
  },
  "referenceImages": ["spec/target-house.jpeg"],
  "viewpoints": [
    { "name": "Main front-left axonometric", "sketchPanelMatched": true },
    { "name": "Front elevation", "sketchPanelMatched": true },
    { "name": "Right roof terrace axonometric", "sketchPanelMatched": true },
    { "name": "Ground plan diagnostic", "sketchPanelMatched": false }
  ]
}
```
