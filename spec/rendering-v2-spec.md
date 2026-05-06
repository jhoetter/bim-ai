# Rendering V2 — Architectural Visualization Spec

**Goal:** Match the visual quality of a Revit hidden-line + shaded perspective:
directional shadow, ambient occlusion in concave joins, crisp edge lines on
every element, correct PBR materials (glazing, metal, concrete, timber), and
real architectural geometry (door frames, window reveals, railing balusters,
stair treads, correct roof mesh from footprint polygon).

**Status baseline (2026-05-06):** All geometry is Three.js `BoxGeometry` or
hand-coded flat `BufferGeometry` proxies. Shadows, AO, and edge lines are
fully absent. Directional light is at a hardcoded world position. The
`EffectComposer` and post-processing chain do not exist.

**Primary file:** `packages/web/src/Viewport.tsx`  
**Rendering support:** `packages/web/src/viewport/materials.ts`  
**Camera:** `packages/web/src/viewport/cameraRig.ts`

---

## Phase R1 — Rendering Pipeline Foundation

These four work packages wire the post-processing chain and enable shadow
maps. They are independent of geometry quality and deliver immediate visual
improvement on the existing box-proxy meshes.

---

### R1-01 · Shadow map enable

**What the image shows:** Hard directional shadows cast by the building volume
onto the site slab; each element casts and receives.

**What exists today:**  
`resolveLighting()` in `materials.ts` defines `shadowMapSize: 2048` but the
value is never read. The `DirectionalLight` is created without `castShadow`.
No mesh sets `castShadow` or `receiveShadow`. `renderer.shadowMap.enabled`
is never called.

**What to build:**

1. **Enable the shadow map on the renderer** immediately after construction
   (Viewport.tsx, near `renderer = new THREE.WebGLRenderer(...)`):

   ```ts
   renderer.shadowMap.enabled = true;
   renderer.shadowMap.type = THREE.PCFSoftShadowMap;
   ```

   `PCFSoftShadowMap` gives soft penumbra edges that match the reference
   image without the harsh aliasing of `BasicShadowMap`.

2. **Configure the DirectionalLight shadow camera** when wiring the paint
   bundle (currently lines 689–694 of Viewport.tsx):

   ```ts
   sun.castShadow = true;
   sun.shadow.mapSize.set(
     paint.lighting.sun.shadowMapSize, // 2048
     paint.lighting.sun.shadowMapSize,
   );
   // Orthographic frustum must enclose the whole building.
   // Use the model bounding box (recomputed on scene rebuild).
   const frustumHalf = Math.max(sceneRadiusM * 1.2, 20);
   sun.shadow.camera.left = -frustumHalf;
   sun.shadow.camera.right = frustumHalf;
   sun.shadow.camera.top = frustumHalf;
   sun.shadow.camera.bottom = -frustumHalf;
   sun.shadow.camera.near = 0.5;
   sun.shadow.camera.far = sceneRadiusM * 4 + 50;
   sun.shadow.bias = -0.001; // eliminates shadow acne on flat surfaces
   ```

   `sceneRadiusM` = half the diagonal of the scene AABB, computed after
   all meshes are added.

3. **Tag every mesh** returned by the factory functions
   (`makeWallMesh`, `makeFloorSlabMesh`, `makeDoorMesh`, `makeWindowMesh`,
   `makeStairVolumeMesh`, `makeRailingMesh`, `makeRoofMassMesh`,
   `makeSiteMesh`):

   ```ts
   mesh.castShadow = true;
   mesh.receiveShadow = true;
   ```

   Site slab should have `castShadow = false` (it sits on the ground and
   casts no visible shadow onto anything below it).

4. **Recompute shadow camera frustum** on every scene rebuild (the scene is
   rebuilt when `elementsById` changes). After adding all meshes, compute the
   scene AABB and update `sun.shadow.camera.left/right/top/bottom/far`.

**Acceptance:** The site slab receives a hard but soft-edged shadow from the
building mass. Walls cast shadows on each other and on the floor. The shadow
moves when the camera orbits (shadows are view-independent). No shadow acne
on flat horizontal surfaces.

**Vitest:** Unit-test `resolveLighting()` to assert `shadowMapSize` is 2048
and is present (it already is). Integration coverage is via Playwright
screenshot diff — add a `shadow-enabled.png` baseline to
`e2e/ui-redesign-baselines.spec.ts`.

---

### R1-02 · Directional light from azimuth + elevation

**What exists today:**  
`resolveLighting()` returns `{ azimuthDeg: 145, elevationDeg: 35 }` but the
light is placed at a hardcoded world position `(8, 12, 6)` (Viewport.tsx line
near `sun.position.set(8, 12, 6)`). The spec-defined azimuth and elevation
are never used.

**What to build:**

Replace the hardcoded `position.set` call with a spherical → Cartesian
conversion using the values from the paint bundle:

```ts
function sunPositionFromAzEl(
  azimuthDeg: number,
  elevationDeg: number,
  radiusM = 80, // large enough to be "at infinity" for the scene
): THREE.Vector3 {
  const az = THREE.MathUtils.degToRad(azimuthDeg);
  const el = THREE.MathUtils.degToRad(elevationDeg);
  return new THREE.Vector3(
    radiusM * Math.cos(el) * Math.sin(az),
    radiusM * Math.sin(el),
    radiusM * Math.cos(el) * Math.cos(az),
  );
}

sun.position.copy(
  sunPositionFromAzEl(paint.lighting.sun.azimuthDeg, paint.lighting.sun.elevationDeg),
);
sun.target.position.set(0, 0, 0);
```

Add `azimuthDeg` and `elevationDeg` to the `LightingBundle` type in
`materials.ts` (they already exist in the return value of `resolveLighting()`
but the type does not declare them; add the fields and re-check call-sites).

**Light theme:** azimuth 145°, elevation 35° — afternoon sun from the
south-west, producing a left-to-right shadow diagonal consistent with the
reference image.

**Dark theme:** elevation unchanged; increase intensity to 0.6 (dark
background makes the same intensity look too dim).

**Acceptance:** Shadows fall in the correct compass direction matching the
azimuth. Rotating the scene in walk-mode or orbit does not move the shadow
(shadows are world-aligned, not camera-aligned).

---

### R1-03 · EffectComposer + render pass chain

**What exists today:**  
`renderer.render(scene, camera)` is called directly in `tick()`. No
`EffectComposer`, no post-processing imports.

**What to build:**

Install the Three.js addons (already a peer dep):

```ts
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
```

After renderer construction:

```ts
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
// SSAO and edge passes added by R1-04 and R1-05
composer.addPass(new OutputPass());
```

Replace `renderer.render(scene, camera)` in `tick()` with
`composer.render()`.

Resize handling: add `composer.setSize(w, h)` wherever
`renderer.setSize(w, h)` is called (the existing resize observer block).

The `EffectComposer` ref must be stored alongside `renderer` in a stable ref
so it survives React re-renders.

**Acceptance:** Visual output identical to baseline (since the only passes are
RenderPass + OutputPass). Tests: existing Playwright baselines must still
pass.

---

### R1-04 · Screen-space ambient occlusion (SSAO)

**What exists today:**  
`aoIntensity: 0.4` is defined in `resolveCategoryMaterial()` and stored in
the material bundle but is never applied to any `MeshStandardMaterial` or any
post-processing pass.

**What to build:**

```ts
import { SSAOPass } from 'three/addons/postprocessing/SSAOPass.js';
```

After the `RenderPass` in the composer chain:

```ts
const ssao = new SSAOPass(scene, camera, w, h);
ssao.kernelRadius = 0.25; // influence radius in world metres
ssao.minDistance = 0.001;
ssao.maxDistance = 0.12;
ssao.output = SSAOPass.OUTPUT.Default;
composer.addPass(ssao);
```

These values give subtle darkening in concave wall/floor junctions and eave
soffits without muddying the flat surfaces — matching the reference image
where AO is noticeable at corners but not overpowering.

**Parameter tokens** (add to `materials.ts` `resolveLighting()`):

```ts
ssao: {
  kernelRadius: 0.25,
  minDistance: 0.001,
  maxDistance: 0.12,
}
```

**Resize:** `ssao.setSize(w, h)` alongside composer resize.

**Reduced-motion / low-power:** add a check for
`window.matchMedia('(prefers-reduced-motion: reduce)').matches` — if true,
skip the SSAO pass (`ssao.enabled = false`) to reduce GPU load.

**Acceptance:** Wall/floor and eave/wall junctions are perceptibly darker than
flat surfaces. The interior soffit of the roof overhang is noticeably shaded.
No AO darkening appears on flat site slab in the open.

---

### R1-05 · Edge line pass (outline on all geometry)

**What exists today:**  
No edge geometry on any mesh. Room outlines use `THREE.LineLoop`. The section
box cage uses `THREE.LineSegments`. Selection highlight uses `EdgesGeometry`
but only on the selected element.

**What to build:**

The reference image shows crisp 1–2 px black outlines on every architectural
element. There are two viable approaches; use approach A:

**Approach A — `EdgesGeometry` overlay (correct per-mesh silhouette):**

In each factory function, after building the main mesh, create a companion
`LineSegments` from `EdgesGeometry`:

```ts
function addEdges(
  mesh: THREE.Mesh,
  thresholdAngleDeg = 15, // only edges with dihedral angle > 15°
  color = '#1a1a1a',
): THREE.LineSegments {
  const edges = new THREE.EdgesGeometry(mesh.geometry, thresholdAngleDeg);
  const mat = new THREE.LineBasicMaterial({ color, linewidth: 1 });
  const lines = new THREE.LineSegments(edges, mat);
  lines.renderOrder = 1; // draw on top
  mesh.add(lines); // child so it inherits world transform
  lines.castShadow = false;
  lines.receiveShadow = false;
  return lines;
}
```

Add `addEdges(mesh)` at the end of every factory function
(`makeWallMesh`, `makeFloorSlabMesh`, `makeDoorMesh`, `makeWindowMesh`,
`makeStairVolumeMesh`, `makeRoofMassMesh`, `makeSiteMesh`). Railing uses a
Group; add edges to each segment mesh within the group.

`thresholdAngleDeg = 15` means only edges between faces meeting at >15°
dihedral angle get a line, suppressing internal face-splits on smooth
surfaces.

**Edge color:** read from token `--color-foreground` via the existing
`readToken()` helper so edge lines are dark in light theme and light in dark
theme:

```ts
const edgeColor = readToken('--color-foreground', '#1a1a1a');
```

**Approach B (alternative for later):** `OutlinePass` from
`three/addons/postprocessing/OutlinePass.js` — GPU-based silhouette on
selected objects. Use this in R3 for selection highlight instead of color
override. Do not use for general edge lines (it doesn't capture internal
edges).

**Acceptance:** Every mesh has 1 px dark lines at dihedral angles >15°.
Box corners have 3 visible edges at each corner. Flat surfaces (floor top,
site top) have no spurious internal lines.

---

## Phase R2 — Geometry Accuracy

Replace the box proxies with architecturally correct meshes. Each WP is
independent — they all share the `materials.ts` paint bundle and follow the
same pattern: factory function → `THREE.Group` containing the component meshes
→ `addEdges()` on each sub-mesh → `castShadow = receiveShadow = true` on all.

---

### R2-01 · Wall opening cuts for doors and windows

**What exists today:**  
Walls are solid `BoxGeometry`. Door and window meshes are placed at the wall
position and approximately overlap the wall volume. There is no actual
geometric opening. In the reference image, wall reveals around windows and
doors are visible as distinct surfaces.

**What to build:**

Use `THREE.CSG` (constructive solid geometry) via the `three-bvh-csg` package
(add to devDeps: `pnpm add three-bvh-csg`) to subtract door and window
volumes from the wall.

```ts
import { Brush, Evaluator, SUBTRACTION } from 'three-bvh-csg';

function makeWallWithOpenings(
  wall: WallElem,
  hostedElements: (DoorElem | WindowElem)[],
  elevM: number,
  paint: ViewportPaintBundle | null,
): THREE.Mesh {
  // 1. Build the solid wall brush (same geometry as makeWallMesh today)
  const wallBrush = new Brush(wallGeometry, wallMaterial);
  wallBrush.updateMatrixWorld();

  // 2. For each hosted door/window, build a cutter brush
  for (const hosted of hostedElements) {
    const cutterGeom =
      hosted.kind === 'door'
        ? doorCutterGeometry(hosted, wall)
        : windowCutterGeometry(hosted, wall);
    const cutterBrush = new Brush(cutterGeom, wallMaterial);
    cutterBrush.updateMatrixWorld();
    const evaluator = new Evaluator();
    wallBrush.geometry = evaluator.evaluate(wallBrush, cutterBrush, SUBTRACTION).geometry;
  }
  const result = new THREE.Mesh(wallBrush.geometry, wallMaterial);
  result.userData.bimPickId = wall.id;
  return result;
}
```

**Cutter volumes:**

- Door cutter: same `(width, height, thickness + 0.1)` box as today's door
  proxy, placed at `hostedXZ(door, wall)` at `elevM` (floor level) so the
  cut goes to the sill.
- Window cutter: `(width, height, thickness + 0.1)` box placed at
  `elevM + sillHeight`.

**Performance:** CSG is O(n·m) in polygon count. Gate it behind a
`ENABLE_CSG` flag (`import.meta.env.VITE_ENABLE_CSG === 'true'`); default
off until R2-02 and R2-03 deliver the frame/reveal geometry that makes the
cuts visible and worth the cost.

**Acceptance:** Looking at a wall face-on, the door and window openings are
visible as holes through the wall. The wall edges around each opening are
visible as separate geometry lines from `EdgesGeometry`. Interior wall
reveal surfaces are a separate face receiving AO.

---

### R2-02 · Door frame + panel geometry

**What exists today:**  
`makeDoorMesh` returns a single `BoxGeometry(width, height, depth)` with the
wall material color. No frame, no panel, no swing arc.

**What to build:**

Replace with a `THREE.Group` containing:

```
DoorGroup
  ├── frame        THREE.Group
  │   ├── head     BoxGeometry(frameWidth + 2·jamb, frameSect, depth)
  │   ├── jamb-L   BoxGeometry(frameSect, frameWidth, depth)
  │   └── jamb-R   BoxGeometry(frameSect, frameWidth, depth)
  ├── panel        BoxGeometry(leafWidth, leafHeight, panelThick)
  └── threshold    BoxGeometry(leafWidth, 0.02, depth)
```

**Dimensions** (all in metres, derived from `DoorElem` fields):

```
leafWidth    = clamp(door.widthMm  / 1000, 0.35, 4)
leafHeight   = clamp(door.heightMm / 1000, 0.6, 2.5)
                     — use door.heightMm if present; else wall.heightMm * 0.86
panelThick   = 0.045   // 45 mm solid core leaf
depth        = clamp(wall.thicknessMm / 1000, 0.08, 0.5)
frameSect    = 0.07    // 70 mm frame section width
jambDepth    = depth   // jambs flush with wall face
```

**Materials:**

- Frame and threshold: `door` category material (brown)
- Panel: `door` category with slightly higher roughness (0.75 vs 0.6) to
  read as painted timber vs. bare frame

**Swing arc** (optional, deferred to R2-X): A `THREE.CircleGeometry`
quarter-arc flat on the floor plane at `elevM`, showing the door swing
direction based on `door.handingL` boolean (`true` = left-hinge). Can be
added as a `LineLoop` at low cost.

**Acceptance:** Door units look like door frames with a panel leaf, not
floating boxes. Frame lines are visible as `EdgesGeometry` lines. Panel has
correct depth visible from side view.

---

### R2-03 · Window frame + glazing pane geometry

**What exists today:**  
`makeWindowMesh` returns `BoxGeometry(width, height, depth)` with 84%
opacity. No frame, no glazing pane, no reveal.

**What to build:**

Replace with a `THREE.Group`:

```
WindowGroup
  ├── frame        THREE.Group (4 members: head, sill, jamb-L, jamb-R)
  │   ├── head     BoxGeometry(width, frameSect, depth)
  │   ├── sill     BoxGeometry(width, frameSect, depth)
  │   ├── jamb-L   BoxGeometry(frameSect, height, depth)
  │   └── jamb-R   BoxGeometry(frameSect, height, depth)
  ├── glazing      BoxGeometry(glazingW, glazingH, 0.006)
  └── mullion      BoxGeometry(frameSect, glazingH, 0.012)   [if width > 1.2m]
```

**Dimensions:**

```
outerW     = clamp(win.widthMm  / 1000, 0.14, 4)
outerH     = clamp(win.heightMm / 1000, 0.05, 3.5)
frameSect  = 0.06     // 60 mm frame profile
depth      = clamp(wall.thicknessMm / 1000 + 0.02, 0.06, 0.5)
glazingW   = outerW - 2 * frameSect
glazingH   = outerH - 2 * frameSect
```

**Glazing material** (new category, or use `window`):

```ts
{
  color:       readToken('--cat-glazing', '#c8d8ea'),
  roughness:   0.05,     // near-mirror glass
  metalness:   0.0,
  opacity:     0.35,     // more transparent than the current 0.84 proxy
  transparent: true,
  envMapIntensity: 1.0,  // enabled once R3-05 adds env map
  side: THREE.DoubleSide,
}
```

**Mullion:** if `outerW > 1.2m` add a vertical divider at centre; if
`outerH > 1.5m` add a horizontal transom as well.

**Reveal faces:** The space between the glazing plane and the outer wall
face is visible in the reference image as a set-back reveal. This is
automatically present if R2-01 cuts the opening: the inner wall faces
become the reveal depth.

**Acceptance:** Windows render as frame + inset glazing pane. Glazing is
clearly more transparent (0.35 opacity) than walls. Edge lines show the
frame sections separately from the glass.

---

### R2-04 · Stair tread + riser solid geometry

**What exists today:**  
`makeStairVolumeMesh` returns a single `BoxGeometry(run, rise, width)`
bounding volume proxy. It does not model individual treads.

**What to build:**

Replace with a `THREE.Group` containing one `BoxGeometry` per tread:

```ts
function makeStairTreadGroup(
  stair: StairElem,
  elementsById: Record<string, Element>,
  paint: ViewportPaintBundle | null,
): THREE.Group {
  const group = new THREE.Group();

  // Resolve level elevations
  const baseLevelElev = elevationMForLevel(stair.baseLevelId, elementsById);
  const topLevelElev = elevationMForLevel(stair.topLevelId, elementsById);
  const totalRise = Math.abs(topLevelElev - baseLevelElev);
  const riserCount = Math.max(
    stair.riserCount ?? Math.round((totalRise / (stair.riserMm ?? 175)) * 1000),
    2,
  );
  const riserH = totalRise / riserCount;
  const runStart = { x: stair.runStartMm.xMm / 1000, z: stair.runStartMm.yMm / 1000 };
  const runEnd = { x: stair.runEndMm.xMm / 1000, z: stair.runEndMm.yMm / 1000 };
  const runLen = Math.hypot(runEnd.x - runStart.x, runEnd.z - runStart.z);
  const treadDepth = runLen / riserCount;
  const stairWidth = clamp(stair.widthMm / 1000, 0.3, 4);
  const angle = Math.atan2(runEnd.z - runStart.z, runEnd.x - runStart.x);
  const treadThick = 0.04; // 40 mm tread thickness

  for (let i = 0; i < riserCount; i++) {
    const treadGeom = new THREE.BoxGeometry(treadDepth, treadThick, stairWidth);
    const treadMesh = new THREE.Mesh(treadGeom, stairMat(paint));
    // Position: advance along run, step up
    const cx = runStart.x + ((i + 0.5) / riserCount) * (runEnd.x - runStart.x);
    const cz = runStart.z + ((i + 0.5) / riserCount) * (runEnd.z - runStart.z);
    const cy = baseLevelElev + (i + 0.5) * riserH + treadThick / 2;
    treadMesh.position.set(cx, cy, cz);
    treadMesh.rotation.y = angle;
    treadMesh.castShadow = treadMesh.receiveShadow = true;
    treadMesh.userData.bimPickId = stair.id;
    addEdges(treadMesh);
    group.add(treadMesh);
  }

  // Stringer (solid side plate)
  const stringerH = totalRise;
  const stringerGeom = new THREE.BoxGeometry(runLen, stringerH, 0.025);
  // ... position at run midpoint, half the total rise
  // Two stringers: left side and right side (offset ±stairWidth/2 along perp)
  group.add(leftStringer, rightStringer);

  group.userData.bimPickId = stair.id;
  return group;
}
```

**Element fields used:** `runStartMm`, `runEndMm`, `widthMm`, `baseLevelId`,
`topLevelId`, `riserCount`, `riserMm`.

**Acceptance:** A staircase renders as individual stacked tread boxes with
correct step-up progression from base level to top level. Shadow falls from
upper treads onto lower treads. Count of treads matches `riserCount`.

---

### R2-05 · Railing post + baluster geometry

**What exists today:**  
`makeRailingMesh` (added in this session) builds rail-cap segments from
`railing.pathMm` as `BoxGeometry` segments between each path vertex, with
correct rise interpolation. No balusters or posts.

**What to build:**

Extend the existing `makeRailingMesh` function — keep the rail cap segments
and add:

**Posts** (at each path vertex):

```ts
const postH = guardHeight;
const postSect = 0.05; // 50 mm square post
const postGeom = new THREE.BoxGeometry(postSect, postH, postSect);
// Position: at each pathMm vertex, elevated to (baseLevelElev + riseAt(vertex) + postH/2)
```

**Balusters** (evenly spaced between posts):

```ts
const spacing = 0.115; // 115 mm clear gap — UK Part K maximum
const balW = 0.012; // 12 mm square baluster
const balGeom = new THREE.BoxGeometry(balW, balusterH, balW);
// Count = Math.floor(segmentLen / spacing) for each segment
// Heights interpolated between the two end-post heights for sloped sections
```

**Rail cap** (existing horizontal top bar):

```ts
const capSect = 0.045; // 45 mm handrail diameter (as square approx)
// Already built as segment boxes — keep but set correct height (top of post)
```

**Material:** metal — override category default to:

```ts
roughness: 0.35,
metalness: 0.60,    // visible as brushed stainless, consistent with reference
```

**Element fields used:** `pathMm`, `guardHeightMm`, `baseLevelElevMm`,
`topLevelElevMm` (for sloped sections on stairs), `balusterSpacingMm` (if
present; else default to 115 mm).

**Acceptance:** Railing renders with posts at path vertices, evenly spaced
balusters, and a continuous cap rail. Metal appearance clearly distinguishable
from concrete walls. Shadow falls between balusters.

---

### R2-06 · Roof from footprint polygon with true gable/hip mesh

**What exists today:**  
`makeRoofMassMesh` builds a custom `BufferGeometry` with hand-coded positions
for a single-ridge gable, but only when the bounding box has a clear dominant
axis. L-shaped and hip footprints are not handled. The ridge always runs along
the longer axis regardless of `ridge_axis` field. Overhang is an XZ extension
of the AABB, not a true polygon offset.

**What to build:**

**Stage 1 — Gable pitched rectangle (fix current):**

The existing approach is mostly correct for rectangular footprints. Fix the
following:

- Use `roof.slopeDeg` (already read), but also respect `roof.ridgeAxis`
  (`'x'` | `'z'` | null). If `ridgeAxis` is null, choose the longer bounding
  box axis.
- Overhang: offset the footprint polygon outward by `overhangMm / 1000` using
  a proper polygon offset (not AABB expansion). A simple parallel offset for
  convex polygons: shift each edge outward by `overhangMm / 1000` and
  intersect adjacent offset edges. Implement as `offsetPolygonMm(pts, dist)`.
- Eave plate height: already uses `max(wall heights at reference level)` —
  keep this.

**Stage 2 — Hip roof (new):**

A hip roof has four sloped faces converging to a ridge point (for square
footprint) or ridge line (for rectangular). Algorithm:

```ts
function makeHipRoofMesh(
  footprintMm: [number, number][],
  slopeDeg: number,
  overhangMm: number,
  eaveElevM: number,
): BufferGeometry {
  // 1. Offset footprint outward by overhangMm
  const outer = offsetPolygonMm(footprintMm, overhangMm);
  // 2. Compute hip-line intersections using the slope angle
  //    Each eave edge projects inward at slopeDeg until edges meet
  //    Standard hip: use the "equal hip" algorithm — bisect each corner,
  //    advance along bisector at tan(slopeRad) * inset
  // 3. Ridge line = locus of convergence points
  // 4. Build faces: 4 trapezia (long sides) + 4 triangles (hips at corners)
  //    or 2 trapezia + 2 gables for ridged hip
  // ...
}
```

**Stage 3 — L-shape gable (new):**

Detect L-shaped footprints (convex hull area / polygon area < 0.85). Split
the L into two overlapping rectangles along the primary recess. Build a gable
mesh for each rectangle and merge with `BufferGeometryUtils.mergeGeometries`.
The valley at the junction is a separate face.

**Acceptance (Stage 1):** Rectangular footprint gable renders with correct
ridge direction per `ridgeAxis`, correct eave plate height, and an overhang
that offsets the polygon (not just the bounding box).

**Acceptance (Stage 2):** Seed house V2 roof (35° gable per
`seed-house-v2-commands.mjs`) renders correctly from all four elevations.

**Acceptance (Stage 3):** An L-shaped house plan (e.g. the V2 seed house
wing) renders a hipped valley at the junction.

---

### R2-07 · Floor slab from boundary polygon

**What exists today:**  
`makeFloorSlabMesh` uses `xzBoundsMm(floor.boundaryMm)` — computes the AABB
of the boundary polygon and creates a `BoxGeometry(spanX, thickness, spanZ)`.
For L-shaped and irregular floor plans this is a gross approximation
(the bounding box overfills).

**What to build:**

Replace the `BoxGeometry` with `THREE.ExtrudeGeometry` from the actual
boundary polygon:

```ts
function makeFloorSlabMesh(floor: FloorElem, ...): THREE.Mesh {
  const shape = new THREE.Shape();
  const pts   = floor.boundaryMm;

  // BIM coordinate convention: boundaryMm is XY in plan space
  // Three.js extrude works in XY, we rotate to XZ afterwards
  shape.moveTo(pts[0][0] / 1000, pts[0][1] / 1000);
  for (let i = 1; i < pts.length; i++) shape.lineTo(pts[i][0] / 1000, pts[i][1] / 1000);
  shape.closePath();

  const thick = clamp(floor.thicknessMm / 1000, 0.05, 1.8);
  const geom  = new THREE.ExtrudeGeometry(shape, { depth: thick, bevelEnabled: false });
  // Rotate so the extruded axis is vertical (Y up), footprint is in XZ
  geom.rotateX(-Math.PI / 2);

  const elevM = elevationMForLevel(floor.levelId, elementsById);
  const mesh  = new THREE.Mesh(geom, floorMat(paint));
  mesh.position.y = elevM - thick;   // underside at level elevation
  mesh.castShadow = mesh.receiveShadow = true;
  mesh.userData.bimPickId = floor.id;
  addEdges(mesh, 20);   // 20° threshold to suppress internal triangulation edges
  return mesh;
}
```

**Winding order:** `floor.boundaryMm` points are CCW when viewed from above
in plan space (standard BIM convention). `THREE.Shape` expects CCW. No
reversal needed.

**Slab openings:** `slab_opening` elements have a `hostFloorId` reference.
When a slab opening exists, use it as a hole in the `THREE.Shape`:

```ts
const opening = slabOpenings.find(o => o.hostFloorId === floor.id);
if (opening) {
  const hole = new THREE.Path();
  hole.moveTo(...); // opening.boundaryMm
  shape.holes.push(hole);
}
```

**Acceptance:** L-shaped floor (V2 seed house ground floor) renders as the
correct L silhouette, not a filled bounding box. The shadow cast by walls on
the floor follows the actual floor boundary. Stair opening appears as a hole
in the floor slab.

---

### R2-08 · Site slab from boundary polygon

**What exists today:**  
`makeSiteMesh` already uses `THREE.ExtrudeGeometry` from `site.boundaryMm`.
This is mostly correct. Two gaps:

1. Thickness is read as `site.padThicknessMm ?? 150 / 1000` — the operator
   precedence is wrong: `150 / 1000 = 0.15` evaluates before `??`, so the
   nullish fallback is `0.15` m (fine), but if `padThicknessMm` is `0` this
   will return `0` not the default. Fix:

   ```ts
   const thick = clamp((site.padThicknessMm ?? 150) / 1000, 0.05, 2);
   ```

2. Site has no `castShadow` (intentional, the site is the shadow receiver, not
   caster). Confirm `receiveShadow = true` is set.

3. Site material: add `aoMapIntensity: 0` to prevent SSAO from darkening the
   exposed site plane (SSAO on a large flat plane can produce ugly banding
   artefacts near the edges of the building footprint).

**Acceptance:** Site renders at correct thickness. Building mass casts a
shadow onto the site slab. No AO banding artefact on the flat site surface.

---

## Phase R3 — Material System

### R3-01 · Per-category PBR tuning

**What exists today:**  
`resolveCategoryMaterial()` sets `roughness: 0.85, metalness: 0.0` for every
category. The only differentiation is color.

**What to build:**

Extend the `CategoryMaterialBundle` type and `resolveCategoryMaterial()` to
return category-specific physical properties. Add the following values to
`materials.ts`:

| Category     | roughness | metalness | notes                          |
| ------------ | --------- | --------- | ------------------------------ |
| wall         | 0.80      | 0.00      | painted plaster / render       |
| floor        | 0.90      | 0.00      | concrete slab                  |
| roof         | 0.85      | 0.00      | roof membrane / tiles          |
| door         | 0.70      | 0.00      | painted timber                 |
| window frame | 0.60      | 0.05      | powder-coated aluminium        |
| glazing      | 0.05      | 0.00      | float glass                    |
| stair        | 0.85      | 0.00      | concrete tread                 |
| railing      | 0.35      | 0.65      | brushed stainless steel        |
| site         | 0.95      | 0.00      | concrete pad                   |
| room         | —         | —         | no 3D mesh (wire outline only) |

Add CSS tokens for the PBR values so design can tweak without code changes:

```css
/* tokens-drafting.css */
--cat-wall-roughness: 0.8;
--cat-wall-metalness: 0;
--cat-railing-roughness: 0.35;
--cat-railing-metalness: 0.65;
/* ...etc. */
```

Read via `parseFloat(getComputedStyle(root).getPropertyValue('--cat-X-roughness'))`.

**Vitest:** Extend the existing `resolveCategoryMaterial` test suite
(currently 10 assertions in `materials.ts` test) to assert the roughness and
metalness of every category.

---

### R3-02 · Glazing material with environment map

**What exists today:**  
Window mesh uses `window` category material with `opacity: 0.84`. No
reflection, no IBL.

**What to build:**

Add an equirectangular environment map for image-based lighting. Use a
lightweight procedural sky texture (no HDR download required):

```ts
import { Sky } from 'three/addons/objects/Sky.js';

function buildEnvMap(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  sunAzimuthDeg: number,
  sunElevationDeg: number,
): THREE.Texture {
  const sky = new Sky();
  sky.scale.setScalar(450000);
  const uniforms = sky.material.uniforms;
  uniforms['turbidity'].value = 3;
  uniforms['rayleigh'].value = 0.5;
  uniforms['mieCoefficient'].value = 0.005;
  uniforms['mieDirectionalG'].value = 0.8;

  const phi = THREE.MathUtils.degToRad(90 - sunElevationDeg);
  const theta = THREE.MathUtils.degToRad(sunAzimuthDeg);
  const sunPos = new THREE.Vector3().setFromSphericalCoords(1, phi, theta);
  uniforms['sunPosition'].value.copy(sunPos);

  // Render sky into a PMREMGenerator cube
  scene.add(sky);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envMap = pmrem.fromScene(sky as unknown as THREE.Scene).texture;
  scene.remove(sky);
  pmrem.dispose();
  return envMap;
}
```

Apply `envMap` to the scene (`scene.environment = envMap`) and specifically
to the glazing material with `envMapIntensity: 1.2`.

Rebuild the env map whenever the theme changes (light/dark changes sky colour
via `sky.material.uniforms['rayleigh']`).

**Acceptance:** Window glazing shows a subtle sky reflection. Dark areas of
the sky are visible in the glazing when the camera is at a shallow angle.
Roughness 0.05 makes the reflection sharp but faint.

---

### R3-03 · Cladding surface detail

**What the image shows:** Vertical board-on-board cladding visible as parallel
vertical lines on the wall faces. This is a material/geometry detail.

**What to build — geometry option (preferred for edge-line rendering):**

For walls tagged with `wall.material === 'timber_cladding'` (or equivalent
category marker), add a `CladdingGroup` as a child of the wall mesh:

```ts
function addCladdingBoards(
  wallMesh: THREE.Mesh,
  wallLen: number,
  wallH: number,
  boardWidthMm = 120, // 120 mm board face width
  gapMm = 10, // 10 mm shadow gap
): void {
  const pitchM = (boardWidthMm + gapMm) / 1000;
  const count = Math.floor(wallLen / pitchM);
  const boardGeom = new THREE.BoxGeometry(0.012, wallH - 0.05, pitchM - 0.01);
  const boardMat = new THREE.MeshStandardMaterial({
    color: wallMesh.material.color,
    roughness: 0.85,
    metalness: 0,
  });
  for (let i = 0; i < count; i++) {
    const board = new THREE.Mesh(boardGeom, boardMat);
    board.position.set(
      0, // centred on wall (local X is wall face)
      0, // centred on wall height
      -wallLen / 2 + (i + 0.5) * pitchM,
    );
    board.castShadow = board.receiveShadow = true;
    wallMesh.add(board);
  }
}
```

**Texture option (fallback for walls not tagged with cladding):**

For untextured walls, a `NormalMap` with 2 mm vertical groove pattern can be
baked as a 512×512 canvas texture and applied to the wall material:

```ts
wallMat.normalMap = buildGrooveNormalMap(boardWidthMm, gapMm);
wallMat.normalScale.set(0.4, 0.4);
```

This is lower fidelity but has no polygon overhead.

**Acceptance:** Walls tagged as timber cladding show clearly visible vertical
board lines in the 3D view. Individual board shadows are visible on the wall
face with shadow maps enabled.

---

### R3-04 · Selection highlight via OutlinePass

**What exists today:**  
Selected element color is overridden to `paint.selection.selectedColor`
(`#fcd34d` amber). This requires rebuilding the scene every time selection
changes.

**What to build:**

Replace the color override with an `OutlinePass` from the post-processing
chain (already added in R1-03):

```ts
import { OutlinePass } from 'three/addons/postprocessing/OutlinePass.js';

const outlinePass = new OutlinePass(new THREE.Vector2(w, h), scene, camera);
outlinePass.edgeStrength = 3.0;
outlinePass.edgeGlow = 0.3;
outlinePass.edgeThickness = 1.5;
outlinePass.visibleEdgeColor.set(paint.selection.selectedColor);
outlinePass.hiddenEdgeColor.set(paint.selection.selectedColor);
composer.addPass(outlinePass); // before OutputPass
```

On selection change (`selectedId` prop change):

```ts
const selected = scene.getObjectByUserData('bimPickId', selectedId);
outlinePass.selectedObjects = selected ? [selected] : [];
```

This means the scene no longer needs to be rebuilt on selection change —
only `outlinePass.selectedObjects` is updated, which is a ref assignment.

Remove the color-override logic from all factory functions.

**Acceptance:** Selected element has a 1–2 px amber outline on its silhouette
without affecting internal geometry coloring. Selection/deselection does not
rebuild the Three.js scene.

---

## Phase R4 — Section Perspective View

The reference image appears to be a **section perspective**: the building is
sliced by a cutting plane to reveal the interior.

---

### R4-01 · Section cut interior reveal

**What exists today:**  
`SectionBox` controller (`viewport/sectionBox.ts`) defines six clipping
planes and `SectionBox.clippingPlanes()` returns them. The planes are applied
per-material in the renderer. The interior surfaces exposed by the cut are the
raw cross-sections of `BoxGeometry` faces.

**What exists currently in the scene:** When the section box clips a wall,
the interior of the wall `BoxGeometry` face is empty (the geometry has no
interior face at the cut plane). The exposed cross-section is invisible — you
see through the wall to the geometry behind.

**What to build:**

Use Three.js `Plane` stencil rendering to cap the section cut:

```ts
// For each clip plane, render a stencil-masked plane cap
// Standard Three.js clipping plane cap technique:
// 1. Render scene normally with clipping planes + stencil write
// 2. Render a full-screen quad masked by stencil for the cap faces
```

Implementation using the standard Three.js clipping cap demo pattern:

```ts
function buildClipPlaneCap(plane: THREE.Plane, capColor: string): THREE.Mesh {
  const capGeom = new THREE.PlaneGeometry(500, 500);
  const capMat = new THREE.MeshStandardMaterial({
    color: capColor,
    roughness: 0.9,
    metalness: 0,
    side: THREE.DoubleSide,
    // Stencil: only render where stencil buffer says "clipped"
    stencilWrite: true,
    stencilRef: 1,
    stencilFunc: THREE.EqualStencilFunc,
    stencilFail: THREE.KeepStencilOp,
    stencilZFail: THREE.KeepStencilOp,
    stencilZPass: THREE.ReplaceStencilOp,
  });
  const cap = new THREE.Mesh(capGeom, capMat);
  // Orient the cap mesh to face along the plane normal
  cap.onBeforeRender = (_r, _s, cam) => {
    cap.lookAt(cam.position);
    cap.position.copy(plane.normal).multiplyScalar(-plane.constant);
  };
  return cap;
}
```

Cap color: use `--color-surface-strong` (slightly off-white) to match the
Revit cut-face convention (lighter than the element body).

**Section perspective UI:** Add a "Section perspective" button in the
`Viewport3DLayersPanel` (built in T-11) that activates a half-space clip at
the active section plane defined by the first `section_cut` element. This is
distinct from the full 6-plane section box.

**Acceptance:** In section perspective mode, the building is sliced by a
vertical plane parallel to the section cut line defined in the project. The
cut face is capped in off-white. Interior spaces (floor slabs, interior
walls, stair) are visible through the cut. Edge lines from `EdgesGeometry`
appear on the cap face cross-sections.

---

### R4-02 · Ortho / parallel projection toggle

**What the image shows:** The reference image uses a perspective projection,
but Revit section views typically offer both perspective and parallel (ortho).

**What to build:**

Add an orthographic camera option alongside the perspective camera. The
`CameraRig` already tracks `target`, `radius`, `azimuth`, `elevation`.
Add an `orthoMode` boolean to `CameraRigState`:

```ts
// cameraRig.ts
orthoCamera(): THREE.OrthographicCamera {
  const snap = this.snapshot();
  const halfH = this.state.radius * Math.tan(THREE.MathUtils.degToRad(27.5));
  // 27.5° = half of default 55° fov
  return new THREE.OrthographicCamera(
    -halfH * aspect, halfH * aspect,
    halfH, -halfH,
    0.05, 500,
  );
}
```

In `Viewport.tsx`: hold both cameras. Switch active camera on a toggle button
in the 3D viewport HUD (small icon button, top-right of canvas). The
`EffectComposer`'s `RenderPass` and all passes that receive `camera` must
be updated to point at the active camera.

**Acceptance:** Toggle between perspective (default) and orthographic. Ortho
mode shows parallel projection — distant walls appear the same size as close
walls. Useful for elevation and section views.

---

## Acceptance baseline for V2

V2 is complete when:

1. A freshly seeded V2 house (`make seed`) renders in the 3D viewport with:
   - Directional shadow from south-west at 35° elevation cast on site slab
   - All walls, floors, and roof casting and receiving shadows
   - Ambient occlusion visible at wall/floor junctions and under roof overhang
   - Edge lines on every architectural element at 1 px
   - Door frames with jambs and panel leaf visible
   - Window frames with glazing pane set into reveals
   - Railing with posts, balusters, and cap rail at correct guard height
   - Stair with individual tread geometry
   - Roof with correct gable mesh from footprint polygon
   - Floor slabs matching the actual plan boundary (not bounding box)

2. A Playwright screenshot test (`e2e/rendering-v2-baselines.spec.ts`)
   captures a set of camera positions (NE isometric, south elevation, section
   perspective) in both light and dark themes.

3. Vitest unit coverage for all geometry factories asserting vertex counts
   and position ranges.

4. `pnpm --filter web typecheck` and `pnpm --filter web test run` pass.

---

## Work package summary table

| ID    | Title                                                   | Phase     | Primary file(s)            | Effort |
| ----- | ------------------------------------------------------- | --------- | -------------------------- | ------ |
| R1-01 | Shadow map enable                                       | Pipeline  | Viewport.tsx               | S      |
| R1-02 | Directional light from azimuth/elevation                | Pipeline  | Viewport.tsx, materials.ts | S      |
| R1-03 | EffectComposer + render pass chain                      | Pipeline  | Viewport.tsx               | M      |
| R1-04 | SSAO pass                                               | Pipeline  | Viewport.tsx, materials.ts | M      |
| R1-05 | EdgesGeometry overlay on all meshes                     | Pipeline  | Viewport.tsx               | M      |
| R2-01 | Wall opening cuts (CSG)                                 | Geometry  | Viewport.tsx               | L      |
| R2-02 | Door frame + panel geometry                             | Geometry  | Viewport.tsx               | M      |
| R2-03 | Window frame + glazing geometry                         | Geometry  | Viewport.tsx               | M      |
| R2-04 | Stair tread + stringer geometry                         | Geometry  | Viewport.tsx               | M      |
| R2-05 | Railing post + baluster geometry                        | Geometry  | Viewport.tsx               | M      |
| R2-06 | Roof from footprint polygon                             | Geometry  | Viewport.tsx               | L      |
| R2-07 | Floor slab from boundary polygon                        | Geometry  | Viewport.tsx               | S      |
| R2-08 | Site slab fixes                                         | Geometry  | Viewport.tsx               | S      |
| R3-01 | Per-category PBR tuning                                 | Materials | materials.ts               | S      |
| R3-02 | Glazing material + env map                              | Materials | Viewport.tsx, materials.ts | M      |
| R3-03 | Cladding surface detail                                 | Materials | Viewport.tsx               | M      |
| R3-04 | Selection via OutlinePass                               | Materials | Viewport.tsx               | M      |
| R4-01 | Section cut interior reveal (stencil cap)               | Section   | Viewport.tsx               | L      |
| R4-02 | Ortho / parallel projection toggle                      | Camera    | Viewport.tsx, cameraRig.ts | M      |
| FL-01 | Family + Type data model                                | Families  | core/src/index.ts          | M      |
| FL-02 | Built-in family catalog (doors, windows)                | Families  | new familyCatalog.ts       | L      |
| FL-03 | Renderer reads familyTypeId                             | Families  | Viewport.tsx               | M      |
| FL-04 | Additional family catalogs (stair, railing, wall types) | Families  | familyCatalog.ts           | L      |
| FL-05 | Type selector in Inspector                              | Families  | Inspector.tsx              | M      |
| FL-06 | Family library browser panel                            | Families  | new FamilyLibraryPanel.tsx | L      |
| FL-07 | Custom type authoring                                   | Families  | new FamilyTypeEditor.tsx   | L      |
| FL-08 | System family layer stack (wall/floor/roof assemblies)  | Families  | core + Viewport.tsx        | XL     |

**Effort key:** S = ½ day · M = 1 day · L = 2–3 days · XL = 1 week+.

**Recommended order:** R1 (done) → R2 → R3 → FL-01 → FL-02 → FL-03 →
R4-01 → FL-05 → FL-04 → FL-06 → FL-07 → FL-08 → R4-02.

Start with the pipeline (R1, done) — shadows and edges deliver the biggest
visual jump per hour of work and require no geometry changes. Family system
(FL) should begin once R2 geometry is stable, since FL-03 makes the renderer
consume family geometry instead of the R2 box-replacement functions.

---

## Phase FL — Family & Type System

A family system lets users choose between different door styles, window
operation types, stair configurations, etc. — exactly like Revit's loadable
family library. The geometry for each element kind is generated from a
**Family** (parametric geometry template) + **Type** (named parameter set) +
**Instance** (placed element with optional per-instance overrides).

### Background: how Revit structures this

| Tier              | What it is                                                                                  | Examples                                                                              |
| ----------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| **Family**        | Parametric geometry template; defines which parameters drive the shape                      | "Single-Flush Door", "Double-Hung Window", "Straight Stair"                           |
| **Type**          | Named snapshot of parameter values for a Family                                             | "Single-Flush : 900×2100", "Double-Hung : 1200×1500"                                  |
| **Instance**      | Placed occurrence; inherits Type params, can override some                                  | `door-001` placed in wall, `widthMm` fixed by Type, `materialKey` overridden to "oak" |
| **System family** | Special: Wall/Floor/Roof/Ceiling. Type = layer assembly (materials + thicknesses). No file. | "Exterior – Brick 90 + Insulation 100 + Stud 150"                                     |

Our current model already has `family_type` elements and `familyTypeId` on
door/window instances — the reference exists, the schema and renderer wiring
do not.

---

### FL-01 · Family + Type data model

**What exists today:**

```ts
// core/src/index.ts
{ kind: 'family_type'; id: string; discipline: 'door'|'window'|'generic';
  parameters: Record<string, unknown>; }

// door/window instances:
{ familyTypeId?: string | null; }
```

`family_type` has no `name`, no `familyId` (which template it belongs to),
and `parameters` is an untyped blob with no schema enforcement.

**What to build:**

**1. Extend `family_type` in `core/src/index.ts`:**

```ts
{
  kind:       'family_type';
  id:         string;
  name:       string;          // "Single Flush : 900×2100"
  familyId:   string;          // which FamilyDefinition this belongs to
  discipline: FamilyDiscipline;
  parameters: Record<string, unknown>;  // typed by the family's schema
  isBuiltIn?: boolean;         // true = ships with app, false = user-created
}

type FamilyDiscipline =
  | 'door' | 'window' | 'stair' | 'railing'
  | 'wall_type' | 'floor_type' | 'roof_type'    // system families
  | 'column' | 'beam'                            // structural (future)
  | 'generic';
```

**2. Add `FamilyDefinition` type** (not an Element — lives in the catalog,
not in the project model):

```ts
// packages/web/src/families/familyCatalog.ts (new file)
export interface FamilyParamDef {
  key: string;
  label: string;
  type: 'length_mm' | 'angle_deg' | 'material_key' | 'boolean' | 'option';
  default: unknown;
  options?: string[]; // for 'option' type
  min?: number; // for 'length_mm' / 'angle_deg'
  max?: number;
  instanceOverridable: boolean; // can an instance override this param?
}

export interface FamilyDefinition {
  id: string; // e.g. 'door.single-flush'
  name: string; // "Single Flush Door"
  discipline: FamilyDiscipline;
  thumbnail?: string; // base64 PNG or URL for library browser
  params: FamilyParamDef[];
  defaultTypes: Omit<FamilyTypeElement, 'kind' | 'id'>[]; // shipped types
}
```

**3. Instance-level override mechanism:**  
When the renderer resolves geometry for a door instance, the parameter
resolution order (highest to lowest priority) is:

```
instance.overrideParams[key]        // per-instance override (new field)
  ?? familyType.parameters[key]     // type-level default
  ?? familyDef.params[key].default  // family-level default
  ?? instance.widthMm / heightMm    // legacy inline fallback
```

Add `overrideParams?: Record<string, unknown>` to door/window/stair/railing
element kinds in `core/src/index.ts`.

**Acceptance:** `family_type` elements in the store have `name` and
`familyId`. Instances can carry `overrideParams`. Vitest: type-level and
instance-level override resolution tested as a pure function.

---

### FL-02 · Built-in family catalog — doors and windows

**What to build:**

A static catalog file `packages/web/src/families/familyCatalog.ts` that
exports a `BUILT_IN_FAMILIES: FamilyDefinition[]` array and a
`BUILT_IN_TYPES: Omit<FamilyTypeElement, 'kind' | 'id'>[]` array.

**Door families (minimum viable set):**

| Family ID           | Name              | Key params                                           | Notes                              |
| ------------------- | ----------------- | ---------------------------------------------------- | ---------------------------------- |
| `door.single-flush` | Single Flush Door | width, height, frameProfileMm, swing (L/R), material | Most common residential/commercial |
| `door.double-leaf`  | Double Leaf Door  | totalWidth, height, frameProfileMm, activeleaf (L/R) | Entry doors, double swing          |
| `door.sliding`      | Sliding Door      | width, height, panelCount (1/2), frameProfileMm      | Terrace / balcony                  |
| `door.bifold`       | Bifold Door       | totalWidth, height, leafCount (2/4), frameProfileMm  | Wardrobe, room divider             |

**Default types per door family (examples):**

`door.single-flush` ships with:

- "762 × 1981 — Timber" (UK standard 2'6" × 6'6")
- "838 × 1981 — Timber" (UK standard 2'9" × 6'6")
- "900 × 2100 — Timber" (metric standard)
- "900 × 2100 — Aluminium" (commercial, metalness 0.6)
- "1000 × 2100 — Timber" (wide leaf)

**Window families (minimum viable set):**

| Family ID               | Name               | Key params                                           | Notes                 |
| ----------------------- | ------------------ | ---------------------------------------------------- | --------------------- |
| `window.fixed`          | Fixed Light        | width, height, frameProfileMm, glazingLayers (1/2/3) | No operable part      |
| `window.casement`       | Casement Window    | width, height, frameProfileMm, openingDir (L/R/top)  | Side-hung or top-hung |
| `window.double-hung`    | Double-Hung Window | width, height, frameProfileMm, raisedRailMm          | Both sashes slide     |
| `window.sliding`        | Sliding Window     | width, height, frameProfileMm, panelCount (2/3)      | Horizontal slide      |
| `window.fixed-casement` | Fixed + Casement   | totalWidth, height, fixedRatio, casementSide         | Common residential    |

**Default types per window family (examples):**

`window.casement` ships with:

- "600 × 900 — Aluminium White" (bathroom / utility)
- "900 × 1200 — Aluminium White" (standard residential)
- "1200 × 1500 — Aluminium White" (living room)
- "600 × 900 — Timber" (heritage / traditional)

**Geometry function per family:**

Each `FamilyDefinition` has a geometry function signature:

```ts
type FamilyGeometryFn = (
  params: Record<string, unknown>,
  paint: ViewportPaintBundle | null,
) => THREE.Group;
```

For `door.single-flush` this is the R2-02 geometry (frame + panel) but now
parameterised by `frameProfileMm` and `material` rather than hardcoded.
For `door.sliding` the geometry is a different function (no frame reveal,
instead a track header + sliding panel).

**Acceptance:** `BUILT_IN_FAMILIES` exports at least 4 door + 5 window
families. Each has ≥3 default types. Vitest: 15+ assertions covering param
resolution, type count per family, and that each family has a geometry
function that returns a `THREE.Group` with at least one child mesh.

---

### FL-03 · Renderer reads familyTypeId

**What exists today:**
`makeDoorMesh` and `makeWindowMesh` (post R2-02/03) use inline element
params (`door.widthMm`, `door.heightMm`). `door.familyTypeId` is never read.

**What to build:**

In the scene-build loop in `Viewport.tsx`, before calling `makeDoorMesh`,
look up the family type and merge its parameters:

```ts
function resolveElementParams(
  el: DoorElem | WindowElem,
  elementsById: Record<string, Element>,
): ResolvedDoorParams | ResolvedWindowParams {
  const typeEl = el.familyTypeId
    ? (elementsById[el.familyTypeId] as FamilyTypeElement | undefined)
    : undefined;
  const familyDef = typeEl
    ? (BUILT_IN_FAMILIES.find((f) => f.id === typeEl.familyId) ??
      USER_FAMILIES.find((f) => f.id === typeEl.familyId))
    : undefined;

  // Priority: instance override > type params > family default > inline
  const get = (key: string, fallback: unknown) =>
    el.overrideParams?.[key] ??
    typeEl?.parameters[key] ??
    familyDef?.params.find((p) => p.key === key)?.default ??
    fallback;

  return {
    widthMm: get('widthMm', el.widthMm) as number,
    heightMm: get('heightMm', el.heightMm ?? 2100) as number,
    frameProfileMm: get('frameProfileMm', 70) as number,
    materialKey: get('materialKey', el.materialKey) as string | null,
    operationType: get('operationType', 'single-flush') as string,
    // ... etc.
  };
}
```

Then dispatch to the right geometry function based on `familyDef.id`:

```ts
const params = resolveElementParams(door, elementsById);
const familyId = typeEl?.familyId ?? 'door.single-flush';
const geometryFn = FAMILY_GEOMETRY_FNS[familyId] ?? defaultDoorGeometry;
const mesh = geometryFn(params, paint);
```

This means a door with `familyTypeId = "door.single-flush:900x2100-timber"`
will render the correct single-flush geometry with timber material, while a
door with `familyTypeId = "door.sliding:1800x2100-alum"` will render a
completely different sliding-door geometry.

**Acceptance:** Placing two doors with different `familyTypeId` values in the
seed model renders visually different geometry. Vitest: `resolveElementParams`
unit-tested for all three override levels.

---

### FL-04 · Additional family catalogs

Extend `familyCatalog.ts` beyond doors and windows once FL-02 and FL-03 are
stable:

**Stair families:**

| Family ID        | Name           | Key params                                                      |
| ---------------- | -------------- | --------------------------------------------------------------- |
| `stair.straight` | Straight Stair | width, riserCount, riserMm, treadMm, stringer (open/closed)     |
| `stair.l-shaped` | L-Shaped Stair | width, riserCount, riserMm, treadMm, landingSize, turnDir (L/R) |
| `stair.u-shaped` | U-Shaped Stair | width, riserCount, riserMm, treadMm, landingWidth               |
| `stair.spiral`   | Spiral Stair   | diameter, riserCount, riserMm, handedness (CW/CCW)              |

**Railing families:**

| Family ID             | Name                | Key params                                                          |
| --------------------- | ------------------- | ------------------------------------------------------------------- |
| `railing.glass-panel` | Glass Panel Railing | guardHeightMm, panelThickMm, postSpacingMm, topRailMm               |
| `railing.baluster`    | Baluster Railing    | guardHeightMm, balusterSpacingMm, balusterSect, postSect, topRailMm |
| `railing.cable`       | Cable Railing       | guardHeightMm, cableCount, cableDiameterMm, postSect                |

**Acceptance:** Each catalog has ≥2 families with ≥2 default types each.
Geometry functions return visually distinguishable results for different
families of the same discipline.

---

### FL-05 · Type selector in Inspector

**What to build:**

When a door or window is selected, the Inspector Properties tab shows a
**Type** picker at the top, above the numeric fields:

```
┌─────────────────────────────────────┐
│ Type  [Single Flush : 900×2100 ▾]  │  ← dropdown or button opening a popover
│                                     │
│ Width        900 mm                 │
│ Height      2100 mm                 │
│ Frame profile  70 mm                │
│ Material    [Timber ▾]              │
│ Swing        [Left ▾]              │
└─────────────────────────────────────┘
```

The type picker opens a popover listing all types for the same family, grouped
by family within the discipline. Changing the type fires an
`updateElementProperty` semantic command for `familyTypeId`.

**Instance override indicators:** If an instance param differs from the type
default, show a small dot next to the field label and a "Reset to type" link.

**Acceptance:** Selecting a door shows its current type name. Changing the
type in the Inspector updates the 3D mesh immediately (via store → render
loop). Vitest: type change dispatches correct semantic command.

---

### FL-06 · Family library browser panel

A dedicated panel (accessible from the Project Browser left rail or via ⌘K
`> Browse families`) showing the full built-in catalog plus any user-defined
types:

```
┌────────────────────────────────────────┐
│  Family Library              [+ New]   │
│  ────────────────────────────────────  │
│  🔍 Search families…                   │
│                                        │
│  ▾ Doors                               │
│    Single Flush Door          4 types  │
│    Double Leaf Door           3 types  │
│    Sliding Door               2 types  │
│  ▾ Windows                             │
│    Fixed Light                3 types  │
│    Casement                   4 types  │
│    Double-Hung                2 types  │
│  ▾ Stairs                              │
│    Straight Stair             2 types  │
│  ▾ Railings                            │
│    Baluster Railing           2 types  │
└────────────────────────────────────────┘
```

Clicking a type shows a thumbnail preview (rendered via an offscreen
`THREE.WebGLRenderer` into a 128×128 canvas), the parameter list, and a
**"Place"** button that sets the active tool to the corresponding element
draw tool pre-loaded with that type.

**Thumbnail generation:** On first access per type, render the family geometry
function with default params into an offscreen canvas at 128×128, store as a
blob URL in a module-level cache.

**Acceptance:** Panel lists all built-in families grouped by discipline.
Search filters by name. Clicking a type shows its params. Thumbnails render
within 200ms (cached after first render). Placing a type from the panel starts
the draw tool with the correct `familyTypeId`.

---

### FL-07 · Custom type authoring

Allow users to create their own types within a built-in family (e.g. a custom
"900 × 2400 — Black Aluminium" door type):

```
Family:  Single Flush Door
Name:    900 × 2400 Black Alum
────────────────────────────
Width        900 mm
Height      2400 mm
Frame profile  60 mm
Material     Aluminium
Swing        Left
────────────────────────────
[Cancel]              [Save type]
```

On save, a `family_type` element is added to the project model (not the
catalog) with `isBuiltIn: false`. It appears in the type selector and library
browser alongside built-in types, visually distinguished (e.g. "Custom" badge).

Custom types are persisted in the project snapshot (`elementsById`). They are
not shared across projects unless exported.

**Export/import:** A "Share type" action serialises the `family_type` element
to a JSON file that can be imported into another project.

**Acceptance:** User can create, name, edit, and delete custom types. Custom
types appear in the Inspector type picker and library browser. They persist
across page reloads (in snapshot). JSON export round-trips cleanly.

---

### FL-08 · System family layer stack (wall / floor / roof assemblies)

This is the deepest work and maps to Revit's "System Families." Instead of
walls having a single `thicknessMm` and flat color, a wall type is defined as
an ordered stack of material layers:

```ts
interface WallLayerAssembly {
  familyId: 'wall_type';
  name: string; // "Ext. Timber Cladding on Timber Frame"
  layers: {
    name: string; // "Cladding", "Air gap", "Frame + Insulation"
    thicknessMm: number;
    materialKey: string; // maps to PBR params + color token
    function: 'structure' | 'insulation' | 'finish' | 'membrane' | 'air';
    exterior?: boolean;
  }[];
}
```

**Renderer implications:** When a wall has a `familyTypeId` pointing to a
`wall_type`, the renderer extrudes each layer as a separate `BoxGeometry`
offset from the wall centreline. The exterior finish layer renders with cladding
geometry (FL-03 / R3-03). The structural layer renders with its own PBR params.

**Built-in wall assemblies (minimum viable set):**

| ID                   | Name                  | Layers                                                                         |
| -------------------- | --------------------- | ------------------------------------------------------------------------------ |
| `wall.ext-timber`    | Ext. Timber Frame     | Cladding 18mm + Air gap 25mm + Frame+Ins 140mm + VCL 3mm + Plasterboard 12.5mm |
| `wall.ext-masonry`   | Ext. Brick Cavity     | Brick 102mm + Cavity 75mm + Block 100mm + Plaster 13mm                         |
| `wall.int-partition` | Int. Timber Partition | Plasterboard 12.5mm + Stud 89mm + Plasterboard 12.5mm                          |
| `wall.int-blockwork` | Int. Blockwork        | Plaster 13mm + Block 100mm + Plaster 13mm                                      |

**Plan view impact:** Layer boundaries should draw as thin lines in the plan
canvas, matching the Revit plan drawing convention where you see the full layer
stack cross-section. This connects to B01 (plan drafting visuals).

**Acceptance:** A wall with a `wall_type` familyTypeId renders as a multi-layer
extrusion in 3D. Total thickness matches the sum of layer thicknesses. Each
layer has correct color and roughness from its `materialKey`. Plan view shows
layer boundary lines.

## Performance architecture (implemented 2026-05-06)

### Problem

The original Viewport had a single monolithic `useEffect` that **nuked the
entire Three.js scene and rebuilt every mesh synchronously on every state
change** — including every element add, every selection click, and every
category toggle. This was O(N) geometry work per edit, blocking the main
thread until complete.

Additionally, `makeWallWithOpenings` (CSG boolean subtraction) ran synchronously
on the main thread for every wall that hosted doors or windows, blocking the UI
for hundreds of milliseconds on complex models.

### Solution

**Incremental scene manager** (`Viewport.tsx` — geometry `useEffect`):

- `bimPickMapRef` (`Map<elementId, THREE.Object3D>`) serves as the persistent
  mesh cache. Meshes survive across renders; only changed elements are touched.
- On each `elementsById` change the effect **diffs** against `prevElementsByIdRef`
  to compute `addedIds`, `removedIds`, and `changedIds`.
- **Dependency propagation** ensures cascading invalidation:
  - Wall changed → hosted doors + windows also dirty (positions depend on wall)
  - Door/window added/changed/removed → host wall dirty (CSG opening changes)
  - Level elevation changed → all elements at that level dirty
  - Stair changed → hosted railings dirty
- Old meshes in `toRemove` are disposed (geometry + materials) to avoid GPU
  leaks. New meshes for `toRebuild` are built and inserted.
- Result: **O(delta) per edit** instead of O(N).

**Selection decoupled from geometry** (`[selectedId]` effect):

- The `selectedId` is no longer in the geometry effect's dependency array.
- Selection changes only update the OutlinePass object list — no mesh is
  rebuilt. This makes click-to-select free from a geometry standpoint.

**Category visibility** (`viewerCategoryHidden` in geometry effect):

- `mesh.visible` is toggled via a reference-equality check against the previous
  `catHidden` object. Only a sweep over cached meshes occurs — no geometry
  rebuild.

**Clipping planes** (separate `[viewerClipElevMm, viewerClipFloorElevMm,
sectionBoxActive]` effect):

- Clipping plane changes no longer trigger geometry reconstruction. The
  dedicated effect applies `THREE.Plane` clipping to materials on all existing
  meshes, and manages the section-box wireframe cage independently.

**CSG Web Worker** (`src/viewport/csgWorker.ts`):

- `three-bvh-csg` SUBTRACTION operations run in a dedicated `Worker` instead of
  on the main thread.
- The main thread sends a plain-number `CsgRequest` message (wall dims, cutter
  params, world pose) and immediately inserts a solid `makeWallMesh` placeholder.
- The worker transfers `Float32Array` / `Uint32Array` geometry buffers back via
  `postMessage` with the `transfer` option (zero-copy). The main thread
  reassembles the `BufferGeometry`, disposes the placeholder, and inserts the
  CSG mesh.
- **Nonce-based stale result discarding**: each wall tracks an active job nonce
  in `pendingCsgRef`. If a wall is edited again before its CSG job returns, the
  response is silently dropped.
- Worker lifecycle is tied to the mount effect: created on mount, terminated
  (and cache cleared) on unmount or theme change.

### Effect dependency summary after refactor

| Effect                   | Dependencies                                                  | Trigger                                    |
| ------------------------ | ------------------------------------------------------------- | ------------------------------------------ |
| Mount (renderer + scene) | `[theme]`                                                     | Initial mount; theme switch                |
| Incremental geometry     | `[elementsById, viewerCategoryHidden, theme]`                 | Element add/change/remove; category toggle |
| Clipping + section box   | `[viewerClipElevMm, viewerClipFloorElevMm, sectionBoxActive]` | Clip plane change; section box toggle      |
| Selection outline        | `[selectedId]`                                                | Click to select/deselect                   |
| Orbit camera             | `[orbitCameraNonce, orbitCameraPoseMm]`                       | Saved viewpoint applied                    |
| Walk mode                | `[walkActive]`                                                | Walk mode toggle                           |
| Section box sync         | `[sectionBoxActive]`                                          | Section box toggle                         |

---

### FL — Implementation notes

**Where families live:**

- Built-in catalog: `packages/web/src/families/familyCatalog.ts` — static
  module, zero runtime cost, tree-shaken for families not used
- User-defined types: in `elementsById` (project model) as `family_type`
  elements with `isBuiltIn: false`
- Geometry functions: `packages/web/src/families/geometryFns/` — one file per
  discipline (`doorGeometry.ts`, `windowGeometry.ts`, etc.)

**Parameter type safety:**

Each `FamilyDefinition.params` array is the schema. A `validateTypeParams`
function checks all required keys are present and within bounds before saving.
The renderer's `resolveElementParams` never throws — it always has a fallback.

**Extensibility:**

The catalog is designed to be extended by:

1. Adding entries to `BUILT_IN_FAMILIES` in `familyCatalog.ts`
2. Adding a geometry function to `geometryFns/`
3. Wiring the family ID into the renderer dispatch table

A third-party library of families (e.g. a furniture catalog, structural
columns) can be added as a separate npm package that exports a
`FamilyDefinition[]` array — the browser merges it with `BUILT_IN_FAMILIES`
at startup. No server required.
