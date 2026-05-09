# bim-ai Rendering Quality Tracker

> **Goal**: Make bim-ai visually indistinguishable from the best architectural software on the market — plan view quality matching Rayon, 3D quality matching Rhino/Enscape, navigation feel matching the best web-native CAD tools.
>
> **Written**: 2026-05-09 after deep investigation of current rendering architecture.
>
> Screenshot evidence: first-floor plan showing wall-join artifacts, no hatching, small canvas.

---

## Executive Summary — What's Wrong

### Plan View

The current plan view has **three root architectural flaws** that make it look unprofessional:

1. **Wall hatching (Schraffierung) is completely invisible** — the `buildWallCutHatch()` function renders `LineSegments` at `PLAN_Y + 0.0001` with `depthTest: true`. The 0.0001m Y-offset (0.1mm) is below depth buffer precision at the camera's far plane distance, so the depth test fails and hatch lines are never drawn. They are completely hidden behind the wall fill mesh. This is a one-line fix.

2. **Walls render as overlapping boxes — no miter joins** — each wall is a `BoxGeometry(len, height, thick)`. At L-junctions and T-junctions, walls simply overlap in 3D space. From above, this creates:
   - Visible "step" artifacts at wall corners (where one box overlaps another)
   - Grey "gaps" at junction faces (the wall face is visible inside the corner)
   - No visual indication that walls are connected — they look like stacked Lego bricks
   
   Professional BIM software (Revit, ArchiCAD, Vectorworks, Rayon) computes proper 2D miter geometry: at an L-junction, each wall is clipped to an angled miter point; at a T-junction, the butting wall is clipped at the face of the through-wall. This produces a single clean polygon for each connected wall group.

3. **Wall rendering mode is wrong for plan views** — `BoxGeometry` (a 3D extruded solid) viewed from above is technically correct but gives:
   - No ability to separately control cut-outline vs projected lines
   - No hatching of the solid section region (Schraffierung requires a 2D polygon fill)
   - No proper line weight hierarchy (section-cut lines should be 2× heavier than projection lines)
   
   The correct approach: compute the **2D section-cut polygon** for each wall group (with miter joins) and render it as `ShapeGeometry` fill + outline, exactly like how floors are already rendered.

### 3D View

The 3D view is "good but flat" — materials work, SSAO is present, edges exist. Issues:

1. **Edge lines too prominent** — `EdgesGeometry` at threshold 15° with full foreground color creates busy, harsh edges. Rhino uses feathered, thin, near-invisible edges.
2. **No tone mapping** — renderer uses default Three.js sRGB output. ACESFilmic would give much warmer, richer results.
3. **Material roughness calibration** — walls/floors need different roughness values. Current values are uniform.
4. **No environment map** — even a simple procedural sky environment would improve material reflections.
5. **Camera orbit deceleration** — current controls feel "sticky" compared to Rhino's smooth glide.

### UX / Navigation

1. **Model tiny on load** — the canvas doesn't auto-fit to the model. User sees a small floor plan in the center of a very large empty canvas.
2. **Left rail is just collapse arrows** — no tabs, no structured navigation.
3. **No keyboard shortcut hints** visible in the toolbar (shortcuts only discoverable via Cmd+K).

---

## Section A: Plan View — Critical Architecture Fixes

### A1. Fix Wall Hatching Depth (1-hour fix, immediate)

**Root cause**: `buildWallCutHatch()` in `planElementMeshBuilders.ts` line 201-205:
```typescript
const mat = new THREE.LineBasicMaterial({
  color: new THREE.Color(hatchColor),
  transparent: true,
  opacity: 0.22,
  // depthTest defaults to true — WRONG for overlay geometry
});
lines.position.set(..., PLAN_Y + 0.0001, ...);  // 0.1mm offset — below depth precision
```

**Fix required**:
- Set `depthTest: false` on the hatch material (like all other plan overlay lines)
- Increase Y-offset to `PLAN_Y + 0.003` (3mm — matches floor outline offset pattern)
- Increase opacity from 0.22 to 0.35 (more visible against dark wall fill)
- Set `renderOrder = 5` (ensures lines render after opaque geometry)

**File**: `packages/web/src/plan/planElementMeshBuilders.ts` lines 134-213

**Impact**: HIGH — wall hatching becomes visible immediately. This is the single highest-impact 1-line fix.

---

### A2. Wall Section-Cut Polygon Rendering (the core architecture fix)

**Current architecture (wrong)**:
```
Wall element → BoxGeometry(len, height, thick) → camera looks down → appears rectangular
```

**Target architecture (correct)**:
```
Wall element → 2D miter-joined polygon → ShapeGeometry fill + LineLoop outline
```

**What needs to change**:

#### A2a. Server-side: Compute wall section polygons

Modify `app/bim_ai/plan_projection_wire.py` to include `outlineMm` in the wall wire payload.

For each wall, the section-cut polygon is computed as:
1. Start with the 4-corner rectangle: `[p0, p1, p2, p3]` (two corners per end)
2. For each endpoint, look up connected walls from the `wallCornerJoinSummary_v1` join data
3. Apply join transformation:
   - **Butt join** (T-junction endpoint): clip the butting wall at the face of the through-wall. The two corners of that end are replaced by the intersection points of the wall faces with the through-wall face.
   - **Miter join** (L-junction): compute the intersection point of each side face line of both walls. Replace the two corners with one or two miter points.
   - **No join** (free end): keep the original square end
4. Return the resulting polygon as `outlineMm: [[x,y], ...]`

The `wallCornerJoinSummary_v1` already classifies each join as `butt`, `miter_candidate`, or `unsupported_skew` — use this classification to select the right algorithm.

**Algorithm for butt join** (most common: T-junction):
```
Wall A passes through (e.g., runs from x=0 to x=10, thickness=200mm)
Wall B butts into it at x=5, perpendicular

Wall B's end polygon corners:
  p0 = (5, 100) — start, right side
  p1 = (5, -100) — start, left side

Since Wall A's right face is at y=100 and left face at y=-100,
Wall B's start corners should be clipped to:
  p0_clipped = intersection of Wall B's right face line with Wall A's right face
  p1_clipped = intersection of Wall B's left face line with Wall A's left face
```

**Algorithm for miter join** (most common: L-junction):
```
Wall A: runs west→east (angle=0°), thickness=200mm
Wall B: runs south→north (angle=90°), thickness=200mm, ends at Wall A's start

Miter point on "outside" corner: intersection of Wall A's south face with Wall B's east face
Miter point on "inside" corner: intersection of Wall A's north face with Wall B's west face

Wall A's start polygon corners become:
  outside corner: (0, -100) becomes miter intersection = (100, -100)... computed from face lines
```

**Python implementation sketch**:
```python
def _compute_wall_section_polygon(
    wall: WallElem,
    joins_by_wall_id: dict[str, list[JoinRecord]],
) -> list[tuple[float, float]]:
    """Returns CW polygon in mm coordinates representing the plan section cut."""
    ...
```

#### A2b. Client-side: Render wall polygons via ShapeGeometry

Add `planWallSectionMesh()` function to `planElementMeshBuilders.ts`:
```typescript
export function planWallSectionMesh(
  wall: Extract<Element, { kind: 'wall' }>,
  outlineMm: Array<{ xMm: number; yMm: number }>,
  selectedId?: string,
): THREE.Group {
  // 1. Build ShapeGeometry from outlineMm (like horizontalOutlineMesh)
  // 2. Fill with --plan-wall color (MeshBasicMaterial, depthWrite: false)
  // 3. Overlay LineLoop outline (--draft-cut color, 2px)
  // 4. Add hatch overlay (diagonal lines, depthTest: false)
  // 5. Return group with bimPickId
}
```

#### A2c. Migration path

- When `wirePrimitives.walls[i].outlineMm` is present: use polygon rendering
- When absent (old clients, offline mode): fall back to current `BoxGeometry` path
- Both paths coexist until server change is deployed everywhere

**Files to change**:
- `app/bim_ai/plan_projection_wire.py` — add polygon computation
- `packages/web/src/plan/planElementMeshBuilders.ts` — new polygon render function
- `packages/web/src/plan/symbology.ts` — choose polygon vs box path per wall

**Impact**: VERY HIGH — eliminates the #1 visual quality complaint (overlapping wall boxes)

---

### A3. Line Weight Hierarchy for Wall Outlines

**Current state**: All wall outlines render at the same visual weight.

**Target**: Architectural drafting line weights:
- Section-cut boundary (outer wall edge where it's cut): `--draft-lw-cut` = 2px
- Section-cut interior lines (layer boundaries): `--draft-lw-cut-minor` = 1.4px  
- Projection lines (element edges below cut plane): `--draft-lw-projection` = 1px
- Hidden lines: `--draft-lw-hidden` = 0.7px dashed

**Implementation**: When rendering wall section polygon outline (A2b), separate into:
- Outer boundary loop: thick `LineLoop` at `--draft-lw-cut` weight
- Internal layer boundaries: thin `Line` segments at `--draft-lw-cut-minor`

Three.js `linewidth` only works in `WebGL2` with `WEBGL_multi_draw` extension — use `THREE.Line2` from `three/addons/lines/Line2.js` for fat lines (this renders lines as thin quads, bypassing the GPU linewidth limit).

**Files**: `planElementMeshBuilders.ts` (new wall polygon mesh builder)

**Impact**: HIGH — immediately makes the plan look more professional. Cut lines are the dominant visual feature.

---

### A4. Floor Hatch Pattern (Three.js, not SVG)

**Current state**: Floors render as solid colored polygons (MeshBasicMaterial). The `HatchRenderer.ts` SVG system exists but is not connected to the Three.js plan view. Floor hatch is therefore invisible in the Three.js plan canvas.

**Target**: Render herringbone (or material-appropriate) hatch pattern INSIDE each floor polygon, ON TOP of the fill color.

**Implementation options**:

Option A — **Repeating canvas texture on ShapeGeometry**:
1. Create a small `OffscreenCanvas` (or `canvas`) with the hatch pattern tile
2. Use it as a `THREE.CanvasTexture` on a second `MeshBasicMaterial`
3. Apply `texture.repeat = new THREE.Vector2(W, H)` scaled to current plot scale
4. Set `texture.wrapS = texture.wrapT = THREE.RepeatWrapping`

Option B — **Line segment grid inside polygon** (CPU-intensive but no texture):
1. Compute the AABB of the floor polygon
2. Generate diagonal line segments across the AABB
3. Clip each line to the polygon using 2D line-polygon intersection
4. Render as LineSegments with depthTest:false

Option A (texture) is strongly preferred for performance. The texture scale needs to update when the camera zooms.

**Note on zoom reactivity**: When the camera half-size changes, the texture repeat must update. Track `camRef.current.half` changes and update `texture.repeat` proportionally.

**Files**: `planElementMeshBuilders.ts`, `symbology.ts`

**Impact**: HIGH — fills a major visual gap (floor hatch was one of Rayon's most visible features)

---

### A5. Wall Outline Rendering — Correct Plan Symbol

**Current state**: Walls render as 3D boxes. From above, the top face of the box is the "section cut" but there's no distinction between the top face boundary and the wall side faces.

**Problem with BoxGeometry approach**:
- The box renders SIX faces (top, bottom, 4 sides)
- From above, you see the top face + the top edges of the side faces
- This looks like a thick solid block, not a 2D plan section symbol

**Architectural convention for plan symbols**:
- Wall body: solid fill (black for cut, or material hatch)
- Cut line: thick closed outline (2px minimum) around the entire section
- NO visible "side faces" — the wall is a 2D polygon, not a 3D box

**Fix**: Replace `BoxGeometry` with flat `PlaneGeometry` (zero thickness) + outline loop.
- Section fill: `PlaneGeometry(len, thick)` → `MeshBasicMaterial({color: '#1c1917'})`
- Section outline: `LineLoop(4-corner rectangle)` → thick line material

This eliminates the 3D-box-from-above look and gives a clean 2D plan section.

If combined with A2 (miter joins), the result would be perfect.

---

### A6. Door/Window Plan Symbol Quality

**Current state**: Doors show a white gap in the wall + swing arc. Windows show a white gap + glass centerline. These are implemented but may have rendering artifacts.

**Issues observed**:
- Door swing arc may have z-fighting (multiple meshes at same Y)
- Window glass line weight may be too thin/thick
- Sill lines for windows not shown

**Target**: Clean architectural symbols:
- Door: 90° arc from door face, with door leaf (1px arc, 0.7px door leaf line)
- Window: outer sill line + glass line + inner sill line (3 parallel lines of decreasing weight)
- Opening: clean white gap through wall body (gap geometry cuts through fill)

**Files**: `planElementMeshBuilders.ts` door/window functions

---

## Section B: 3D Rendering Quality

### B1. Tone Mapping — ACESFilmic

**Current state**: No explicit tone mapping. Three.js defaults to linear sRGB output.

**Fix**: Add ACESFilmic tone mapping for warmer, more cinematic results:
```typescript
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
```

**Impact**: MEDIUM — immediately warms up the 3D render, makes materials look richer. Mimics Rhino's rendering warmth.

**File**: `packages/web/src/Viewport.tsx`

---

### B2. Edge Line Quality

**Current state**: `addEdges()` in `sceneHelpers.ts` uses threshold 15° with foreground color lines at renderOrder=1.

**Problems**:
- `THREE.LineBasicMaterial` has linewidth=1 (hardware limit — can't be wider)
- On Retina displays, 1px lines look too thin and "dotty"
- Foreground color (dark) makes edges too harsh/heavy on light materials

**Fix options**:

Option A — **LINE2 (fat lines)**:
Use `Line2` from `three/addons/lines/Line2.js` for consistent 1.5px lines across DPR.

Option B — **Edge opacity control**:
Set edge line opacity to 0.35 instead of full foreground color — gives softer, Rhino-like edges.

Option C — **Threshold adjustment**: 20° threshold (less edges, cleaner look)

**Recommended**: Combine B + C:
- `new THREE.LineBasicMaterial({ color: edgeColor, opacity: 0.4, transparent: true })`
- Threshold: 20°
- Edge color: `--draft-cut` (#1d2330) not `--color-foreground`

**File**: `packages/web/src/sceneHelpers.ts`

---

### B3. Material Roughness Calibration

**Current state**: All materials use `roughness: 0.82, metalness: 0.02` (from default material setup).

**Target per-category roughness** (Rhino-like):
- `--cat-wall` (plaster): roughness 0.92, metalness 0.0 — very matte
- `--cat-floor` (concrete): roughness 0.88, metalness 0.0 — slightly smoother than plaster
- `--cat-roof` (clay tile): roughness 0.85, metalness 0.0
- `--cat-door` (wood/metal): roughness 0.70, metalness 0.02
- `--cat-window` (glass): roughness 0.05, metalness 0.1, transparent 0.7 — critical for spatial depth
- `--cat-stair` (concrete): roughness 0.86, metalness 0.0
- `--cat-railing` (metal): roughness 0.45, metalness 0.35

Window transparency is especially important — currently windows appear as solid colored faces. Making them semi-transparent (opacity 0.35, transparent:true) adds enormous spatial depth.

**File**: `packages/web/src/viewport/materials.ts`

---

### B4. Ambient Occlusion Tuning

**Current state**: `SSAOPass` with `kernelRadius: Math.min(..., 0.18)` capped.

**Rhino AO characteristics**: Very subtle, soft. Not the heavy "cave corner" look of raw SSAO.

**Improvements**:
- `ssao.minDistance = 0.001` (very fine details)
- `ssao.maxDistance = 0.12` (reduced from current)
- `ssao.kernelRadius = 0.12` (smaller radius = more focused on surface details)
- `ssao.output = SSAOPass.OUTPUT.Default` (not debug mode)

Consider adding a `UnrealBloomPass` at very low intensity (0.05, radius 0.4) for subtle glow on bright surfaces — matches Rhino's "subtle material glow" look.

**File**: `packages/web/src/Viewport.tsx`

---

### B5. Camera Interaction Feel

**Current state**: Three.js OrbitControls (or equivalent) with default parameters.

**Rhino feel**:
- Very smooth deceleration (high damping factor)
- Orbit around geometry centroid, not world origin
- Right-click = rotate, Middle-click = pan, Scroll = dolly
- Smooth zoom with momentum

**Target settings**:
```typescript
controls.enableDamping = true;
controls.dampingFactor = 0.08;  // High = more "float" on release
controls.screenSpacePanning = true;
controls.rotateSpeed = 0.6;
controls.zoomSpeed = 0.8;
```

**File**: `packages/web/src/Viewport.tsx` (controls setup)

---

### B6. Environment / Sky

**Current state**: Just HemiLight + DirectionalLight. No environment map. Background = `--draft-paper` (off-white).

**Rhino-like environment**:
- Subtle gradient sky: warm white overhead, warm ochre ground (matches HemiLight colors)
- Option: Three.js `PMREMGenerator` with a simple equirectangular sky texture
- Option: `THREE.Sky` from addons (Rayleigh scattering sky shader)

**Minimum viable improvement**: A subtle vertical gradient background (CSS gradient behind the Three.js canvas) showing sky-blue at top, warm-sand at bottom.

**File**: `packages/web/src/Viewport.tsx`

---

### B7. Shadow Quality

**Current state**: `THREE.PCFSoftShadowMap` with existing settings.

**Improvements**:
- `shadow.mapSize = new THREE.Vector2(2048, 2048)` — higher resolution shadow map
- `shadow.camera.near = 0.5, far = 200` — tighter frustum
- `shadow.bias = -0.001` — reduce shadow acne

**File**: `packages/web/src/Viewport.tsx`

---

## Section C: UX and Navigation

### C1. Auto-Fit on Model Load

**Current state**: Camera initializes to a fixed position. When elements are loaded, the model may appear tiny (as seen in screenshot — building is small in center of large canvas).

**Target**: When a plan view activates and elements are present, auto-fit the camera to show all elements at comfortable zoom level.

**Implementation**:
1. Compute AABB of all wall start/end points and floor boundaries
2. Set `camRef.current.half = max(AABB.width, AABB.height) * 0.6 / 1000`  (in world units)
3. Center camera on AABB centroid
4. Trigger `resizeCam()`

**Trigger**: When `elementsById` goes from empty to non-empty, OR when the active level changes.

**File**: `packages/web/src/plan/PlanCanvas.tsx`

---

### C2. Left Rail Tab Structure

**Current state**: Left rail shows a list of chevron ">" arrows (collapsed category sections).

**Target**: Rayon-like left rail with tabs:
- **Layers** tab — element categories, visibility toggles, color overrides
- **Elements** tab — project tree (levels → walls/floors/doors...)
- **Styles** tab — wall types, materials, hatch patterns
- **Pages** tab — plan views, sheets, schedules

**Implementation**: Add a tab strip at the top of the `LeftRail` component. The existing tree content becomes the "Elements" tab. Other tabs can be minimal (search/filter focused) initially.

**File**: `packages/web/src/workspace/LeftRail.tsx`

---

### C3. Keyboard Shortcut Visibility

**Current state**: Shortcuts are discoverable only via Cmd+K palette. ToolPalette buttons show a `ShortcutChip` but it's very small.

**Target**: Rayon-style tooltip on hover showing both action name AND keyboard shortcut prominently:
```
"Wall (W)" — shown on hover delay 400ms
```

**Current implementation is close** — `title` attribute already includes the shortcut. But `title` tooltip is browser-default styled (ugly). Could use a proper Radix `Tooltip` component.

**File**: `packages/web/src/tools/ToolPalette.tsx`

---

### C4. Zoom / Pan Feel in Plan View

**Current state**: Scroll wheel zooms by adjusting `camRef.current.half`. Space+drag pans.

**Issues**:
- Scroll zoom is not smooth (jumpy)
- Space+drag is unintuitive (vs right-click drag or middle-click drag)
- No zoom-to-pointer (zooms to canvas center, not cursor position)

**Target**:
- Smooth scroll zoom with lerp/easing
- Middle mouse button (or scroll-click) drag = pan (standard CAD convention)
- Zoom-to-pointer: translate camera so the point under cursor stays fixed during zoom

**File**: `packages/web/src/plan/PlanCanvas.tsx` (wheel event handler)

---

### C5. Canvas Size and Padding

**Current state**: Plan canvas has no padding — model renders edge-to-edge.

The model appears small because the canvas is very large (full workspace) and the model is small in model coordinates.

**Fix**: When model elements exist, auto-fit should ensure the model fills ~75% of the canvas width. Combined with C1 (auto-fit), this is resolved.

---

### C6. Status Bar Improvements

**Current state**: Status bar shows coordinate HUD + snap status.

**Target**:
- Show current tool name in plain language: "Wall tool — click to set start point"
- Show snap description: "Endpoint snap active"
- Current level name visible
- Undo/redo step count visible (already has undo/redo buttons)

---

## Section D: Plan View Visual Completeness

### D1. Rayon-Style Floor Hatch — What We See vs Target

| Feature | Current | Target |
|---------|---------|--------|
| Floor fill | Solid color at 42% opacity | Solid color at 30% + hatch pattern overlay |
| Floor hatch | SVG system not connected to Three.js | Herringbone lines rendered in Three.js at proper density |
| Wall section | Solid black box | Solid fill + visible Schraffierung (diagonal lines) |
| Wall outline | BoxGeometry face edges | Clean LineLoop at --draft-lw-cut weight |
| Room fill | Sage green at 26% | Solid sage at 20% + subtle texture variation |
| Door symbol | White gap + arc | Gap + arc + thin door leaf line |
| Window symbol | White gap + glass line | Gap + triple sill lines (outer/glass/inner) |

### D2. Section Hatch Patterns (Schraffierung)

In architectural drawing, every element in a section cut shows a hatch pattern indicating material:
- **Brick/masonry**: horizontal lines with vertical joints (stretcher bond)
- **Concrete**: uniform diagonal at 45° (standard diagonal hatch)
- **Timber frame**: diagonal lines with insulation fill (zig-zag between studs)
- **Stone**: irregular horizontal lines (bedded stone)

Current `CATEGORY_DEFAULT_HATCH` in `HatchRenderer.ts`:
```
wall: 'brick'
floor: 'herringbone' (was: concrete)
roof: 'tile'
stair: 'concrete'
```

The SVG hatch definitions exist but are not rendered in Three.js plan view. Need to:
1. Generate hatch geometry from `BUILT_IN_HATCH_DEFS` into Three.js LineSegments
2. Clip to element polygon boundaries
3. Overlay at low opacity with depthTest:false

---

## Section E: Technical Architecture Decisions

### E1. Should We Use a Different Renderer?

**Verdict: NO — Three.js is the right choice.**

Three.js can render at professional quality. The issues are in HOW we use it, not the renderer itself. Rayon (2D), Speckle (3D), Archicad cloud viewer, and Rhino Inside all use web-based 3D rendering and achieve professional results.

The Three.js `WebGLRenderer` with EffectComposer post-processing pipeline is exactly right. We need to:
1. Fix the plan view rendering architecture (geometry approach)
2. Tune material + lighting parameters
3. Add ACESFilmic tone mapping

No renderer change is needed or recommended.

### E2. Why BoxGeometry is Wrong for Plan Views

BoxGeometry renders a 3D solid. When viewed orthographically from above:
- You see the TOP face (the section cut surface) — correct
- You see the TOP EDGES of the SIDE faces — artifacts
- Two overlapping boxes show Z-fighting or visible "cracks"
- No ability to apply 2D drafting conventions (thick outlines, section fill, line weights)

`ShapeGeometry` from a 2D polygon outline is the correct approach:
- Pure 2D — no Z-edge artifacts
- Can apply fill color + overlay hatch + thick outline separately
- Clean polygon intersection/miter possible
- Matches how Rayon, AutoCAD, etc. render plan sections

### E3. Wall Join Geometry — Client vs Server

**Server-side (recommended)**:
- Python has `shapely` or can compute intersections natively
- Wall join topology is already available in server memory
- Single source of truth — no duplication of wall geometry logic
- Adds `outlineMm` field to existing wire payload

**Client-side (fallback)**:
- Works offline
- Can use wall join metadata (`wallCornerJoinSummary_v1`) already in wire payload (currently unused)
- Requires TypeScript implementation of 2D polygon intersection math

**Decision**: Implement BOTH:
1. Server: add `outlineMm` to wall wire payload (primary path)
2. Client: when `outlineMm` absent, compute outline from start/end/thickness/joins (offline/fallback)

---

## Implementation Waves

### Wave 1 — Immediate Fixes ✅ COMPLETE

| ID | Fix | Status |
|----|-----|--------|
| W1-01 | Wall hatch `depthTest: false` + Y-offset 0.003 + opacity 0.35 | ✅ DONE |
| W1-02 | ACESFilmic tone mapping + exposure 1.05 | ✅ DONE |
| W1-03 | Edge line opacity 0.38, threshold 20°, `--draft-cut` color | ✅ DONE |
| W1-04 | Per-category PBR calibration (glass roughness 0.05, matte plaster 0.92) | ✅ DONE |
| W1-05 | Camera INERTIA_DECAY 0.92 (smoother Rhino-like glide) | ✅ DONE |
| W1-06 | Auto-fit camera on level load/switch | ✅ DONE |

### Wave 2 — Plan View Architecture ✅ MOSTLY COMPLETE

| ID | Fix | Status |
|----|-----|--------|
| W2-01 | Server polygon outlines (plan_projection_wire.py) | ⬜ Not needed — client fallback works, server already sends wallCornerJoinSummary_v1 |
| W2-02 | `planWallSectionMesh()` — ShapeGeometry fill + polygon-clipped hatch | ✅ DONE |
| W2-03 | Floor hatch — 45° diagonal via `hatchPolygon2D()` scanline | ✅ DONE |
| W2-04 | Wall section outline LineLoop | ✅ DONE (in planWallSectionMesh) |
| W2-05 | Client-side miter/butt polygon computation via wallCornerJoinSummary_v1 | ✅ DONE |

### Wave 3 — 3D Material & Lighting Polish ✅ DONE

| ID | Fix | Status |
|----|-----|--------|
| W3-01 | Per-category roughness/metalness | ✅ DONE |
| W3-02 | Shadow map 2048, bias -0.001 | ✅ DONE (was already 2048) |
| W3-03 | SSAO kernel radius 0.12 | ✅ DONE |
| W3-04 | Subtle environment gradient sky | ⬜ LOW — deferred |

### Wave 4 — UX & Navigation (partial)

| ID | Fix | Status |
|----|-----|--------|
| W4-01 | Left rail tab structure | ⬜ MED — future sprint |
| W4-02 | Radix Tooltip for tool shortcuts | ⬜ MED — needs dep install |
| W4-03 | Zoom-to-pointer | ✅ DONE (already implemented) |
| W4-04 | Status bar tool guidance text | ⬜ LOW — deferred |

---

## Success Criteria

The implementation is complete when:

1. **Plan view wall joins**: At every L-junction and T-junction, walls show clean miter/butt geometry with no overlapping box artifacts
2. **Schraffierung visible**: Every wall section shows diagonal hatch lines clearly visible at 1:100 scale
3. **Floor hatch visible**: Herringbone pattern clearly visible inside floor fills
4. **Line weight hierarchy**: Cut lines (2px) clearly heavier than projection lines (0.7px)
5. **3D materials**: Window elements are semi-transparent; wall/floor materials have clearly different roughness
6. **3D edges**: Edge lines are present but subtle (not harsh/heavy)
7. **Auto-fit**: Canvas fills appropriately with model on load/level switch
8. **Performance**: No frame rate drop below 30fps on a MacBook Pro with 100+ elements

---

## Open Questions

1. **Wall polygon holes**: When a door or window is in a wall, the wall section polygon needs a HOLE for the opening. Does the server's `outlineMm` need to include hole polygons for openings? Answer: Yes, this requires `THREE.Path` holes in `THREE.Shape`.

2. **Curved walls**: bim-ai may support curved walls in future. The polygon approach (ShapeGeometry) handles curved outlines natively via `Shape.quadraticCurveTo()`. BoxGeometry cannot handle curves.

3. **Wall layer visualization in plan**: Should the wall section fill be one solid color (the wall category color) or should each layer show a different material hatch? The latter is the architectural standard (Revit shows per-layer hatches) but is much more complex. For now: single fill + single hatch pattern per wall.

4. **Performance of polygon-per-wall**: For a large building (200+ walls), creating ShapeGeometry per wall vs merging into a single geometry. Merged geometry is faster to render but harder to handle selection. Recommendation: use `Merge` only for background walls, keep selected wall as separate mesh.
