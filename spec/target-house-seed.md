# Target House Seed — Precision Reference Spec

> **Purpose.** Authoritative reference for what the demo seed house should look
> like when perfectly modelled in BIM AI.

---

## 1. Geometry & Massing Logic

The building is a monochromatic white architectural study composed of two primary intersecting volumes and one "wrapper" shell.

Ground Volume: A rectangular cuboid with a 1:2 aspect ratio.

Upper Volume (The Shift): A larger rectangular cuboid placed atop the ground floor, offset to the left. This creates a cantilever exactly 1/3 the width of the building, leaving a covered void beneath it on the left side.

The "Wrapper" Shell: A continuous, thick (approx. 0.5 units) white band that forms the side walls and the roof. This shell creates a deeply recessed frontal plane (approx. 1 meter deep) for the upper floor.

---

## 2. Roof Subtractions (Boolean Ops)

The roof is the most complex element and requires specific instructions:

Profile: An asymmetrical pitched gable. The ridge is off-center to the right.

The Cutout: On the right-hand slope, a large rectangular section is subtracted (Boolean difference), extending from the ridge down to the gutter line. This creates an "L-shaped" roof profile when viewed from the side and reveals a hidden upper-level terrace.

The Inset: Within this cutout, there is a recessed vertical glass wall and a flat floor plane.

---

## 3. Facade Composition & Fenestration

The Recessed Upper Front: Divided into three vertical zones:

Left: A solid wall segment with a high-set, trapezoidal window following the roof's pitch.

Center: A protruding vertical chimney-like volume clad in vertical siding.

Right: A double-height "curtain wall" of glass divided by a central horizontal mullion.

The Ground Front:

- Two identical portrait-oriented rectangular windows. The right-most window reveals an interior staircase with at least 8 visible treads.
- A simple, recessed rectangular door on the far right.

The Balcony: A horizontal void across the entire upper front width. The railing consists of three thin, continuous black horizontal cables/rails fixed to the inner edge of the white shell.

---

## 4. Material Specification & Mapping

Material A (Primary Shell): Matte white, seamless plaster/concrete with zero specular reflection. Applied to the roof, the side walls of the second floor, and the floor slabs.

Material B (Cladding): High-definition vertical board-and-batten siding. The boards are narrow (approx. 10cm width). This texture is applied to all ground-floor walls and the central recessed section of the second floor.

Material C (Glazing): Semi-transparent, neutral-tinted glass.

Material D (Plinth): A low-profile, flat white rectangular base that extends exactly 0.5 units beyond the building's footprint on all sides.

---

## 5. Lighting & Rendering Parameters

Perspective: Axonometric/Isometric view from the front-left.

Lighting: Strong directional "Sun" light from the top-left-front.

Shadows: Sharp-edged (Ray-traced). Note the triangular shadow cast by the roof overhang onto the recessed siding and the large rectangular shadow cast by the cantilever onto the ground plinth.

Line Work: Thin, black ambient occlusion lines or "outline" rendering style (0.5pt thickness) highlighting every geometric edge.

---

## 6. Prompting Cheat-Sheet for AI

High-fidelity architectural concept, axonometric view, asymmetrical pitched roof with a rectangular Boolean subtraction on the right slope, cantilevered second floor overhang, white plaster shell, vertical board-and-batten siding, three-rail horizontal balustrade, interior staircase visible through ground window, sharp directional shadows, minimalist 3D clay model style.
