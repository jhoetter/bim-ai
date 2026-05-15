# OSM Site Context Tracker

This tracker covers embedding real-world urban/suburban context geometry — neighboring
buildings, roads, trees, water, and green areas — directly into the bim-ai 3D viewer
alongside a house model. Data is sourced from OpenStreetMap via the free Overpass API
(the same source Rayon uses). No third-party service dependency; no export/import step
required.

The feature gives every project a live neighbourhood model: a set of lightweight grey
context volumes, road ribbons, and tree markers that surround the actual BIM model and
instantly communicate site position, scale, and urban density to clients and reviewers.

## Data Source

OpenStreetMap / Overpass API — free, open, globally available, no key required.

Overpass endpoint used: `https://overpass-api.de/api/interpreter`

Overpass QL query pattern for a lat/lon bounding box (radius `R` metres):

```
[out:json][timeout:25];
(
  way["building"](around:R,LAT,LON);
  way["highway"~"primary|secondary|tertiary|residential|service|footway|path"](around:R,LAT,LON);
  node["natural"="tree"](around:R,LAT,LON);
  way["natural"~"water|wood"](around:R,LAT,LON);
  way["landuse"~"grass|park|meadow|forest"](around:R,LAT,LON);
);
out geom;
```

OSM tags used per layer:

- Buildings: `building=*` ways with optional `building:levels` and `height` tags for extrusion
- Roads: `highway=*` ways; width approximated by highway class (primary 12 m, residential 6 m, footway 2 m)
- Trees: `natural=tree` nodes; rendered as point sprites
- Water: `natural=water` ways; rendered as flat blue surfaces
- Green: `natural=wood`, `landuse=grass|park|meadow|forest` ways; flat green fill

## Coordinate Projection

OSM uses WGS84 lat/lon. The bim-ai scene uses local millimetres with the project site
origin at `(0, 0, 0)`. Conversion from a known anchor `(anchorLat, anchorLon)`:

```
latRad = anchorLat × π/180
xMm = (lon − anchorLon) × cos(latRad) × 111_319_508   // east → +x
yMm = (lat − anchorLat)               × 111_319_508   // north → +y
```

At residential scales (< 1 km) the equirectangular approximation is accurate to < 0.1 %,
well within neighbourhood context tolerance.

Building extrusion height (zMm):
- `height` OSM tag (metres) × 1000 → mm
- else `building:levels` × 3000 mm per floor
- else default 9000 mm (3-storey fallback)

## Current Baseline

Implemented in bim-ai:

- `project_settings` element with free-text `projectAddress` field
- Local mm coordinate system everywhere; no georeferencing
- `makeSiteMesh()` and `makeToposolidMesh()` builders as mesh-builder patterns to follow
- `root` Three.js group that accepts additional mesh groups

Missing for this feature:

- No lat/lon anchor in `project_settings` or any schema element
- No Overpass API fetch layer
- No WGS84 → local mm projection utility
- No OSM geometry builders (buildings, roads, trees, water, green)
- No Viewport effect for context geometry
- No UI to set/edit project georeference anchor
- No layer visibility toggles for context layers
- No seed DSL field for baking a georeference into automated seeds

## Workpackage Rules

1. Keep edits scoped to the workpackage.
2. Run listed verification before marking Done.
3. Commit only the files changed for that workpackage.
4. Push immediately after each commit.
5. Do not start the next workpackage while any listed verification is red.

## Workpackages

| ID         | Status  | Goal                                                                                                      | Primary files                                                    | Required verification                                                    |
| ---------- | ------- | --------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------ |
| OSM-WP-001 | Done    | Create this tracker.                                                                                      | `spec/osm-site-context-tracker.md`                               | Markdown review, `git diff --check`                                      |
| OSM-WP-002 | Done    | Extend `project_settings` schema with optional lat/lon anchor and context radius.                         | `packages/core/src/index.ts`, `app/bim_ai/elements.py`, `engine_dispatch_properties.py` | TypeScript compile clean; Python tests pass                |
| OSM-WP-003 | Done    | Add Overpass API fetch utility and caching layer (browser-side).                                          | `packages/web/src/osm/fetchOverpass.ts`                          | TypeScript compile clean                                                 |
| OSM-WP-004 | Done    | Add WGS84 → local mm projection utility and inverse (mm → lat/lon).                                      | `packages/web/src/osm/project.ts`                                | TypeScript compile clean                                                 |
| OSM-WP-005 | Done    | Build Three.js geometry for each OSM layer (buildings, roads, trees, water, green).                       | `packages/web/src/viewport/meshBuilders.osmContext.ts`           | TypeScript compile clean; MAX_FACES guard integrated (WP-010)            |
| OSM-WP-006 | Done    | Add Viewport effect: fetch context on anchor change, build meshes, add to scene as `osmContextGroup`.     | `packages/web/src/Viewport.tsx`                                  | TypeScript compile clean                                                 |
| OSM-WP-007 | Done    | Add UI to set/edit project georeference anchor (address search or lat/lon fields) in project settings.   | `packages/web/src/workspace/inspector/InspectorContent.tsx`      | TypeScript compile clean                                                 |
| OSM-WP-008 | Done    | Add per-layer visibility toggles (Buildings / Roads / Trees / Water / Green) to the context panel.        | `packages/web/src/Viewport.tsx` HUD overlay                      | TypeScript compile clean                                                 |
| OSM-WP-009 | Done    | Seed DSL support: add `georeference` field so automated seeds can bake in a known anchor.                 | `packages/cli/lib/seed-dsl.mjs`                                  | Compiles; validation raises on bad coords                                |
| OSM-WP-010 | Done    | Performance guard: cap context geometry at 5 000 faces per layer.                                         | `packages/web/src/viewport/meshBuilders.osmContext.ts`           | `MAX_FACES = 5_000` constant enforced in all five builders               |

## OSM-WP-002 Detail: Schema Extension

Extend the `project_settings` element in `packages/core/src/index.ts` with three new
optional fields:

```typescript
export type ProjectSettingsElem = {
  // ... existing fields ...
  georeference?: {
    anchorLat: number;   // WGS84 decimal degrees
    anchorLon: number;
    contextRadiusM: number; // metres; default 300; max 1000
  };
};
```

Add a kernel command `UpdateGeoreference` that validates:
- `anchorLat` in [-90, 90]
- `anchorLon` in [-180, 180]
- `contextRadiusM` in [50, 1000]

No migration needed (field is optional; existing projects simply have no anchor).

## OSM-WP-003 Detail: Overpass Fetch Layer

File: `packages/web/src/osm/fetchOverpass.ts`

Responsibilities:
- Construct the Overpass QL query from anchor + radius
- Fetch from `https://overpass-api.de/api/interpreter` (POST with body)
- Cache result in `sessionStorage` keyed by `osm:{lat4dp}:{lon4dp}:{radius}` (4 decimal
  places ≈ 11 m resolution — good enough to avoid redundant refetches on minor drags)
- Parse the Overpass JSON response into typed `OsmFeature[]`
- Expose a single async function: `fetchOsmContext(anchor, radiusM): Promise<OsmFeature[]>`

Typed response shape:

```typescript
type OsmBuilding = { type: "building"; footprintMm: XY[]; heightMm: number };
type OsmRoad    = { type: "road"; centreline: XY[]; widthMm: number };
type OsmTree    = { type: "tree"; positionMm: XY };
type OsmWater   = { type: "water"; footprintMm: XY[] };
type OsmGreen   = { type: "green"; footprintMm: XY[] };
type OsmFeature = OsmBuilding | OsmRoad | OsmTree | OsmWater | OsmGreen;
```

## OSM-WP-005 Detail: Three.js Geometry Builders

File: `packages/web/src/viewport/meshBuilders/osmContext.ts`

One builder per layer, all returning `THREE.Group`:

**Buildings** — `makeOsmBuildingsGroup(buildings: OsmBuilding[]): THREE.Group`
- Extrude each footprint polygon to `heightMm` using `THREE.ExtrudeGeometry`
- Single merged `BufferGeometry` per call (merge all buildings into one draw call)
- Material: flat grey (`#9ca3af`), no shadows cast, `depthWrite: true`
- Mark group with `userData.osmLayer = "buildings"` for layer toggle

**Roads** — `makeOsmRoadsGroup(roads: OsmRoad[]): THREE.Group`
- Build quad strip along centreline at specified width, zMm = 0
- Material: dark grey (`#4b5563`), `polygonOffset` to avoid z-fighting with toposolid

**Trees** — `makeOsmTreesGroup(trees: OsmTree[]): THREE.Group`
- `THREE.Points` with `THREE.PointsMaterial` in green (`#86efac`), size 2500 mm (≈ 2.5 m canopy)
- Optionally a small cylinder trunk if count < 200

**Water** — `makeOsmWaterGroup(water: OsmWater[]): THREE.Group`
- Flat polygon mesh at zMm = -10 (just below grade), blue (`#93c5fd`), 40 % opacity

**Green** — `makeOsmGreenGroup(green: OsmGreen[]): THREE.Group`
- Flat polygon mesh at zMm = -5, muted green (`#bbf7d0`), 30 % opacity

All geometry must be positioned in local mm space (origin = project anchor point = 0,0,0).
The house BIM geometry is already at 0,0,0, so context geometry that is correctly
projected from the same anchor aligns automatically.

## OSM-WP-006 Detail: Viewport Integration

Add a `useEffect` in `Viewport.tsx` that:

1. Watches `projectSettings.georeference` (undefined → skip)
2. On change: calls `fetchOsmContext(anchor, radiusM)`
3. On success: calls each geometry builder, assembles into one `osmContextGroup`
4. Removes any previous `osmContextGroup` from `root`, adds the new one
5. Applies clipping planes so context respects section box

The context group must be added **before** the house geometry group in the scene tree
so depth sort keeps house elements on top in transparent views.

The group is non-selectable (`osmContextGroup.userData.nonPickable = true`) — raycasting
must skip it so picking the actual house elements is not obstructed.

## OSM-WP-007 Detail: Georeference UI

The project settings panel (wherever `projectAddress` is currently editable) gains a
"Georeference" subsection:

- Address search field → geocode via browser-native Nominatim call
  (`https://nominatim.openstreetmap.org/search?q=...&format=json`) → fills lat/lon
- Manual lat/lon inputs as fallback
- Context radius slider: 100 m / 300 m / 500 m / 1000 m
- "Clear" button to remove the anchor and hide context geometry

On save, dispatch `UpdateGeoreference` command. The Viewport effect picks up the change
and refetches automatically.

## OSM-WP-009 Detail: Seed DSL Georeference Field

Add optional top-level `georeference` to the seed recipe JSON:

```json
{
  "georeference": {
    "anchorLat": 48.8553,
    "anchorLon": 2.3471,
    "contextRadiusM": 400
  }
}
```

The seed DSL compiler emits an `UpdateGeoreference` command when the field is present.
Seeds without it remain unchanged.

## Visual Design Notes

Context geometry should read as clearly subordinate to the actual BIM model:

- Flat, unlit materials (no specular, no shadows received from context objects)
- Lower opacity for green/water fills so the ground plane reads through them
- No edge lines on context buildings (edge lines reserved for the actual model)
- Context buildings at roughly correct height but not modelled in detail — mass only
- The house BIM model should visually "pop" against the greyed-out context

In the realistic rendering style the context geometry should be hidden or replaced by
a satellite/aerial background so it does not compete with the photo-real render.
