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

The seed currently models all features in the architectural description above (S1–S4 fixes shipped via `app/scripts/seed.py`; `vp-ssw` viewpoint at `(-5000, -14000, 11000)`; `white_cladding` and `white_render` material keys applied; annex south wall protrudes 500 mm).

Remaining renderer gaps (`GAP-R5` slab edge expression, `GAP-R7` interior visible through glass) are tracked in [`workpackage-master-tracker.md`](workpackage-master-tracker.md).

---
