# Target House Seed — Precision Reference Spec

> **Purpose.** This document is the authoritative reference for what the demo seed
> house should look like when perfectly modelled in BIM AI. It contains an
> architect-quality verbal description precise enough to redraw from memory,
> the current modelling status, and a pinned list of renderer/feature gaps that
> block a perfect result.

---

## 1. Architectural Description (ground truth)

_Read as architect's field notes. Every measurement is intent, not survey._

### 1.1 Viewpoint

South-south-west isometric, camera elevated ~30–35° above the ground plane,
horizontal angle ~25–30° west of due south. The **south facade** (gable end)
occupies roughly 70% of the composition width; the **east facade** with the
annex is visible to the right. The west facade is visible as a thin vertical
slice (~15% of south face width) at the left edge.

---

### 1.2 Main Volume

**Plan:** Rectangular, 7 000 mm east–west × 8 000 mm north–south.

**Storeys:**

| Zone                  | Elevation range    | Height    |
| --------------------- | ------------------ | --------- |
| Ground floor          | ±0 – +3 000 mm     | 3 000 mm  |
| Upper floor           | +3 000 – +5 800 mm | 2 800 mm  |
| Roof (eave to ridge)  | +5 800 – +8 300 mm | ~2 500 mm |
| Total ground to ridge |                    | ~8 300 mm |

**Roof:** Gable, ridge running **north–south** (perpendicular to the south
facade, i.e. the ridge is the long axis). Consequently the south face is the
**gable end** — a perfect isosceles triangle sitting directly above the
rectangular wall. Pitch ≈ **32–35°**. Eave overhang ≈ 300–400 mm on south
and north. Roof surface: light grey (no vivid colour).

---

### 1.3 South Facade — Ground Floor (0–3 000 mm)

- Full 7 000 mm width clad in **white/off-white vertical board-and-batten**.
  Boards ≈ 100–150 mm wide, narrow shadow gap, running floor-to-ceiling without
  horizontal breaks.
- **Floor edge plate** at 3 000 mm: a thin horizontal strip ≈ 100–150 mm deep,
  slightly projecting from the wall plane. This expresses the upper-floor slab
  edge and runs the full 7 000 mm width.
- **One door:** single-leaf, ≈ 1 000 mm wide × 2 200 mm tall. Positioned
  ≈ 4 500 mm from the west end (right-of-centre, adjacent to the annex
  junction). Dark solid-panel appearance.
- **One window (or two):** portrait-format tall-narrow glazing, ≈ 850 mm wide
  × 2 100 mm tall, sill ≈ 100 mm. Positioned in the left third of the ground
  floor facade (≈ 1 000–2 500 mm from west end). A staircase is faintly visible
  through/behind this glazing.

### 1.4 South Facade — Upper Floor + Gable Triangle (3 000–8 300 mm)

- The **entire upper half** — rectangular zone + triangular gable above — is
  one continuous **curtain wall system**. No horizontal break between the
  rectangular zone and the gable triangle.
- Vertical mullions at ≈ **900–1 000 mm centres** (7–8 bays). Mullions are
  **thin**: ≈ 60–80 mm wide, dark grey aluminium, nearly invisible at scale.
  No visible horizontal transom in the upper zone.
- Glass: clear, transparent, floor-to-ceiling in each bay.
- **Balcony** at exactly +3 000 mm: a slim slab ≈ 150 mm thick projecting
  ≈ 600–700 mm from the south face, running the **full 7 000 mm** width.
- **Glass balustrade** atop the balcony: frameless (or near-frameless) glass
  panels ≈ 1 050 mm tall. Transparent. No solid posts visible.

### 1.5 West Facade

- Visible as a thin strip to the left in the sketch view.
- **White vertical board-and-batten**, matching south facade.
- No openings visible from this angle.

### 1.6 East Facade (upper, above annex roof)

- Clad in **white vertical board-and-batten** matching south facade.
- One small window ≈ 1 000–1 200 mm wide × 1 000 mm tall, sill ≈ 900 mm,
  positioned ≈ 2 000 mm from south end.

---

### 1.7 Annex Volume

**Plan:** 4 000 mm east–west × 6 000 mm north–south. Attached to the east end
of the main volume. South face of annex is flush with or ≈ 500 mm further south
than the main volume south face.

**Height:** Single storey. Top of parapet ≈ **3 000–3 200 mm** — matching
almost exactly the main building's upper-floor slab level. It reads as a low
plinth extension.

**Roof:** **Absolutely flat.** Parapet edge ≈ 100–150 mm tall, crisply cut.
No eave overhang. Roof surface: light grey/white.

**Exterior:** **Smooth white render** — no cladding boards, no texture, plain.
Clearly a different finish from the main volume's board-and-batten.

**Openings:**

- South face: plain (no openings visible from sketch angle), or optionally a
  narrow vertical window near the east end.
- East face: one small **square window** ≈ 700–800 mm × 700–800 mm, sill
  ≈ 1 400–1 500 mm, horizontally centred.

**Junction with main volume:** Clean right-angle butt joint. The annex parapet
sits visibly lower than the main building east eave. No flashing detail visible.

---

### 1.8 Interior (visible through glazing)

- A **floating open-tread staircase** is visible through the south curtain wall.
  Runs from ground floor (east side) upward to the upper floor.
- Upper floor is open-plan (no internal partitions visible through glazing).

---

### 1.9 Material + Colour Summary

| Surface                  | Material                  | Colour                        |
| ------------------------ | ------------------------- | ----------------------------- |
| Main volume walls        | Vertical board-and-batten | Bright white / off-white      |
| Annex walls              | Smooth render             | Bright white                  |
| South curtain wall glass | Clear glazing             | Transparent, slight blue tint |
| Balcony balustrade       | Frameless glass           | Transparent                   |
| Main gable roof          | —                         | Light grey                    |
| Annex flat roof          | —                         | Light grey / white            |
| Doors                    | Solid panel               | Dark / mid-tone               |
| Mullions                 | Aluminium profile         | Dark grey                     |
| Floor edge plate         | Concrete / steel          | Light grey                    |

---

## 2. Seed Accuracy Status

### 2.1 What is already modelled

| Feature                                                         | Status |
| --------------------------------------------------------------- | ------ |
| Two-storey main volume, correct plan dimensions (7 000 × 8 000) | ✅     |
| Gable roof, ridge N–S, gable on south + north                   | ✅     |
| Upper south wall as curtain wall (glass grid)                   | ✅     |
| Annex single storey, attached east                              | ✅     |
| Staircase (open-tread, ground→upper)                            | ✅     |
| Ground-floor south door (right-of-centre)                       | ✅     |
| Ground-floor south windows (portrait, left zone)                | ✅     |
| Annex east window                                               | ✅     |
| SE + SW viewpoints saved                                        | ✅     |
| Rooms, dimensions, section cut                                  | ✅     |

### 2.2 Seed fixes possible today (no new renderer features needed)

| #   | Gap                                                                                              | Fix                                                                       |
| --- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------- |
| S1  | **Primary viewpoint is SE; annex appears left** — sketch shows SSW angle with annex to the right | Change `vp-se` camera to SSW: `xMm: -5000, yMm: -14000, zMm: 11000`       |
| S2  | **Main volume walls are orange-brown timber** — sketch needs white vertical board-and-batten     | Change `materialKey` to `"white_cladding"` once renderer supports it      |
| S3  | **Annex walls are blue-grey default** — sketch needs smooth white render                         | Add `materialKey: "white_render"` once renderer supports it               |
| S4  | **Annex south wall is flush with main south** — sketch protrudes ≈ 500 mm south                  | Move annex south wall to `yMm: -500`; add 500 mm return segment at x=7000 |

---

## 3. Renderer / Feature Gaps

These require new development work before the seed can model them.

### GAP-R1 — White board-and-batten cladding (`white_cladding`)

**Description:** `timber_cladding` renders vertical boards in orange-brown
`#8B6340`. The sketch needs the identical board geometry in **bright white**.
Need a second materialKey `white_cladding` that reuses `addCladdingBoards()`
but with colour `#f4f4f0` (off-white) and a matching white base-wall colour.

**Effort:** XS — add one branch in `makeWallMesh` and the CSG path.

---

### GAP-R2 — Smooth white render material (`white_render`)

**Description:** Annex walls need a plain smooth white surface with no board
texture. Currently walls without a materialKey render as blue-grey (wall
category colour). Need a `white_render` materialKey that overrides the base
colour to white without adding cladding boards.

**Effort:** XS — one colour override, no geometry change.

---

### GAP-R3 — Gable triangle glazing (curtain wall continuation into gable)

**Description:** The curtain wall renderer (`makeCurtainWallMesh`) creates a
flat rectangular plane at wall height. The gable triangle above the wall top is
rendered as solid roof geometry. The sketch shows the glass + mullion grid
**continuing up through the triangular gable area** to the ridge apex.

Requires: the curtain wall mesh generator needs to know the attached roof's
geometry and build a triangular glass panel above the rectangular zone, clipping
the mullion grid at the roof slope lines.

**Effort:** M — extends `makeCurtainWallMesh` to accept an optional roof
element; uses `roofHeightAtPoint` to calculate the triangle vertices; adds a
triangular glass mesh + angled mullions above the rectangular section.

---

### GAP-R4 — Balcony slab + glass balustrade at upper-floor level

**Description:** The sketch has a full-width projecting balcony slab (≈ 600 mm
deep) with a frameless glass balustrade (≈ 1 050 mm tall) at exactly 3 000 mm
elevation. There is no `balcony` element type and no way to model this today.

Requires: either a new `createBalcony` command (a floor sub-type that is
wall-hosted and projects outward) or extending the `createFloor` command to
support `overhangMm` + an optional `balustradeKind` property. The 3D renderer
must extrude the slab and place vertical glass panels.

**Effort:** L — new element type + seed command + renderer.

---

### GAP-R5 — Floor slab edge expression

**Description:** The thin horizontal shadow line / projecting plate at the
upper-floor slab level (3 000 mm) is not rendered. This expresses the concrete
or steel edge of the floor slab and is an important articulation in the facade.

Requires: the floor renderer or wall renderer should extrude a thin horizontal
strip at the wall's base elevation (for upper-floor walls) or detect the slab
edge from the floor element.

**Effort:** S — add a thin horizontal strip mesh to `makeWallMesh` when the
wall's reference level elevation > 0.

---

### GAP-R6 — Annex flat roof rendered with wrong colour / slight pitch

**Description:** Annex roof currently uses `slopeDeg: 5` (minimum clamp) and
renders in the same dark reddish-brown as the main gable roof. The sketch
requires a **flat** (0° or near-0°) roof in **light grey/white**.

Two sub-issues:

- `slopeDeg: 5` is the minimum accepted; 0° is rejected. Need either a `flat`
  roof mode or allow `slopeDeg: 0`.
- Roof material is always the roof category colour. Need per-roof colour or a
  flat-roof materialKey.

**Effort:** S — add `roofGeometryMode: "flat"` that bypasses the gable
geometry; add optional `materialKey` on roofs.

---

### GAP-R7 — Interior not visible (staircase, open plan)

**Description:** The sketch shows a floating staircase and interior visible
through the curtain wall. The 3D renderer does not render the interior or stair
as visible-through-glass. The stair element is placed in the model but the
curtain wall glass occludes any interior view.

**Effort:** This is fundamentally a renderer limitation (no interior lighting
pass or glass transparency to interior). Consider as a future aspirational
feature.

---

## 4. Modelling Roadmap

| Priority | Item                                       | Gap ref | Effort    |
| -------- | ------------------------------------------ | ------- | --------- |
| P0       | White cladding + white render materialKeys | R1, R2  | XS        |
| P0       | Fix viewpoint to SSW                       | S1      | seed-only |
| P1       | Flat roof mode / 0° pitch                  | R6      | S         |
| P1       | Slab edge strip at elevated wall base      | R5      | S         |
| P2       | Gable triangle glazing                     | R3      | M         |
| P2       | Annex protrusion detail                    | S4      | seed-only |
| P3       | Balcony + glass balustrade                 | R4      | L         |
| P4       | Interior visibility                        | R7      | XL        |
