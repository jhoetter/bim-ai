# Element Rendering Requirements

Reference for which element properties are required for each element to be
**visually present** in the 3D view, plan view, and section view. Gaps here
are the most common cause of "I added element X but it doesn't appear".

---

## Roof

### 3D view (glTF mesh)

The glTF exporter only emits a pitched roof mesh when **all** of the following
hold. Any miss causes the roof to be silently omitted from the 3D scene.

| Requirement | Value needed | Notes |
|---|---|---|
| `roofGeometryMode` | `"gable_pitched_rectangle"` | Default `"mass_box"` produces **no mesh** — it is a plan/section proxy only |
| Footprint shape | Exactly 4 axis-aligned rectangle corners (≤1 mm tolerance) | L-shapes, hip polygons → deferred, no 3D mesh yet |
| `slopeDeg` | non-null float | If `None`, roof is skipped |
| `referenceLevelId` | resolves to a `LevelElem` | Broken ref → skipped |

Extension emitted when eligible: `bim_ai_gable_roof_v0`

**Unsupported footprint shapes in 3D (deferred):**
- Concave / L-shaped → `"valley_candidate_deferred"`
- Convex polygon with >4 corners (hip) → `"hip_candidate_deferred"`

### Section view

Roofs appear in section regardless of geometry mode, as long as the footprint
intersects the section cut's crop band (`cropDepthMm / 2` on each side of the
cut line).

- `roofGeometryMode = "gable_pitched_rectangle"` → renders with ridge line +
  sloped eave edges (`proxyKind: "gablePitchedRectangleChord"`)
- Any other mode → renders a flat footprint chord with a peak point
  (`proxyKind: "footprintChord"`)

**Key code:** `app/bim_ai/section_projection_primitives.py` —
`build_section_projection_primitives()`  
**Geometry decision matrix:** `app/bim_ai/roof_geometry.py` —
`roof_geometry_support_token_v0()`

---

## Section cut

A `section_cut` element creates a section tab in the UI. The section view
renders by calling `GET /api/models/{id}/projection/section/{sectionCutId}`.

For content to appear:

| Requirement | Notes |
|---|---|
| Section line must intersect elements | Elements must fall within `cropDepthMm / 2` of the cut line (perp distance) |
| `lineStartMm` / `lineEndMm` span must cover the building footprint | Short cut lines leave out geometry |
| `cropDepthMm` large enough | For a full-building section, use ≥ building depth + some margin |

The section marker/symbol (dashed line + arrows) renders on the plan canvas
automatically when a `section_cut` element exists on that level's plan.

---

## Wall

Walls render in all views unconditionally if `levelId` resolves and
`start ≠ end`. No extra conditions.

`thicknessMm` affects plan hatch rendering. Very thin walls (< ~50 mm) may
not be distinguishable in small-scale plans.

---

## Floor / Slab

Floors render in 3D and plan unconditionally if `levelId` resolves and
`boundaryMm` has ≥ 3 non-degenerate vertices.

`roomBounded: true` causes the floor to visually clip to the room boundary
instead of the explicit polygon — only use when rooms cover the full floor area.

---

## Stair

Stairs render in 3D and plan if `baseLevelId` and `topLevelId` both resolve
and `runStartMm ≠ runEndMm`. The stair shaft must have a matching
`slab_opening` on the `hostFloorId` of the upper-level floor, otherwise the
upper slab visually occludes the stair run.

---

## Door / Window

Openings render only if their `wallId` resolves to an existing wall. The
`alongT` value (0–1 fraction along the wall) must place the full opening
within the wall extent — openings that stray outside the wall are silently
clamped or dropped.

---

## Railing

Railings render in 3D if:
- `hostedStairId` resolves (stair-hosted railing), OR
- `pathMm` has ≥ 2 points (free-standing railing)

---

## Room

Rooms render as coloured fills on the plan canvas. They do **not** produce
geometry in the 3D view (they're semantic, not geometric). `outlineMm` must
have ≥ 3 non-degenerate vertices.

---

## Viewpoint

A `saveViewpoint` command stores a named camera position. The viewpoint with
`id = "vp-001"` is loaded as the default camera when the 3D tab is first
opened. All viewpoints appear in the sidebar under **3D Views**.

---

## Grid line

Grid lines render on the plan canvas only. They have no 3D representation.

---

## Dimension

Dimensions render on the plan canvas only. `aMm` and `bMm` define the two
measurement endpoints; `offsetMm` shifts the dimension line perpendicular to
the measured direction.

---

## Summary checklist for a complete seed / demo model

- [ ] Roof: `roofGeometryMode: "gable_pitched_rectangle"` + 4-corner axis-aligned footprint + `slopeDeg` set
- [ ] Stair: has matching `slab_opening` with `isShaft: true` on the floor above
- [ ] Section cut: `cropDepthMm` ≥ building depth; line spans the full footprint
- [ ] Floors: `roomBounded` only when rooms tile the full area without gaps
- [ ] Viewpoint `vp-001` exists for the default 3D camera position
