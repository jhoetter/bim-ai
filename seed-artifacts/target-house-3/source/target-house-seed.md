# Target House Seed — Image-Locked Reference Spec

> **Purpose.** This file is the modelling contract for the demo seed house.
> The reference image is the source of truth. A seed that reads as a generic
> box with a normal gable roof fails this spec, even if it contains some named
> elements from the list below.

---

## 0. Source-Of-Truth Visual Read

The target is a minimalist two-storey house shown in a front-left axonometric
view. The first read must be a thick, smooth, white upper wrapper shell sitting
over a vertically-clad ground-floor base. The upper shell is not a normal roof
placed on top of a box. It is a continuous architectural frame: side walls,
front loggia frame, roof plane, roof thickness, and roof-terrace cutout returns
all read as one monolithic white folded object.

The most important visible feature is the embedded roof terrace cut into the
right-hand roof plane. It appears as a large rectangular bite removed from the
white shell near the upper-right/back portion of the roof. The cutout exposes a
flat terrace floor, vertical white return faces around the opening, a recessed
vertical glass wall at the back of the void, and a transparent side guard/glass
edge. This roof balcony must be visible from the main seed view.

The second strongest feature is the deep front upper loggia. The white shell
forms a thick rectangular/gable-like picture frame around the front upper floor.
Behind that frame is a recessed facade divided into three bays: left glazing
and wall, a central vertically-clad solid pier, and right full-height glazing.
A thin black horizontal railing line runs across the loggia opening.

---

## 1. Non-Negotiable Silhouette

The seed must create this silhouette before interior detail is considered:

- A low rectangular plinth projects beyond the building on all visible sides.
- The ground floor is a long, rectangular, vertically-clad base volume.
- The upper floor is the dominant white wrapper volume and is visually larger
  than the ground-floor support below it.
- The upper volume cantilevers left/front-left over the ground floor, leaving a
  covered shadow void below the overhang.
- The roof/wrapper is thick. It must show visible fascia/edge thickness, not a
  thin roof surface.
- The front upper facade is recessed behind the wrapper by roughly 900-1200 mm.
- The right roof terrace is carved into the roof/wrapper as a visible occupied
  void, not a hidden semantic opening.

Forbidden interpretations:

- A brown/dark pitched roof sitting on a white box.
- A wider ground floor with a smaller upper box merely placed on top.
- A roof opening that is only visible in plan or only exists as metadata.
- A shallow front balcony stuck onto the facade instead of a recessed loggia
  inside a thick white frame.

---

## 2. Coordinate And Proportion Targets

Use millimetres. The exact dimensions may be refined, but the proportions must
match the image:

- Overall plan depth: about 8000 mm.
- Ground-floor base width: about 5200-5800 mm.
- Upper white shell width: about 7600-8200 mm.
- Cantilever/overhang width: about one third of the upper-shell width.
- Floor-to-floor height: about 3000 mm.
- Ground-floor wall height: about 3000 mm.
- Upper wrapper spring/eave height above first floor: about 2100-2600 mm.
- Roof/wrapper shell thickness at visible edges: about 450-600 mm.
- Front loggia recess depth: about 1000 mm.
- Roof terrace cutout: at least 2500 mm by 3000 mm in plan, large enough to
  read as an embedded balcony with furniture/glass, not as a skylight.

---

## 3. Massing And Structure

### Ground Floor

The ground floor is a simple rectangular base with continuous vertical
board-and-batten cladding on the visible front and side faces. It supports the
upper wrapper but does not share the wrapper's full width. Its front facade has
three primary openings:

- two narrow portrait windows;
- the right portrait window aligns with a visible interior stair;
- a simple door at the far right under the upper overhang.

The stair window must reveal at least eight stair treads or a clear stair
silhouette behind the glass.

### Upper Wrapper Shell

The upper level is a white monolithic shell. It should be modelled as a thick
architectural wrapper, using walls/roof/sweeps/returns as needed to make the
visible frame read correctly in 3D:

- left and right side walls are smooth white plaster/concrete;
- the front upper plane is recessed behind the shell;
- the front frame has a thick bottom sill/beam, side returns, and roof edge;
- the roof plane is white, not brown or dark;
- visible roof edges have thickness and crisp black outline edges.

### Roof Form

The roof is an asymmetric folded shell with a ridge/crest running in the depth
direction. The right-hand roof plane contains the embedded terrace cutout. The
roof should read as a white object with shaded faces, not as a separate dark
roof material.

---

## 4. Embedded Roof Terrace / Roof Balcony

This is mandatory and must be visible in the default seed view.

The roof terrace is a rectangular void carved out of the right roof slope:

- it begins close to the ridge/upper roof area;
- it extends down toward the right/east outer roof edge;
- it has a flat occupied terrace floor;
- it has white vertical return faces on the front, back, and side edges of the
  cut, exposing the wrapper thickness;
- it has a recessed glass wall/door at the inner/back face;
- it has a transparent side guard or glass balustrade at the exposed edge;
- it contains at least one small outdoor furniture group so the void reads as a
  balcony/terrace, not a modelling artifact.

Implementation note: authoring `createRoofOpening` alone is insufficient. The
renderer/checkpoint must visibly show the missing roof area and the terrace
surfaces inside it.

---

## 5. Front Upper Loggia And Facade

The front upper storey is a recessed loggia inside the thick white shell. It is
divided into three visible bays:

- **Left bay:** a glass/wall composition with a high trapezoidal or sloped-top
  window following the roof geometry.
- **Centre bay:** a vertical board-clad pier or chimney-like solid volume,
  aligned with the loggia recess and extending upward toward the roof.
- **Right bay:** a full-height glass opening/curtain wall with a central
  horizontal mullion or door rail.

A thin black three-line horizontal guard/railing crosses the loggia opening.
The railing should sit near the front edge of the shell opening, not on the
recessed back wall.

---

## 6. Materials

- **Material A: smooth white shell.** Matte white plaster/concrete, used for
  the entire upper wrapper shell, roof plane, roof cutout returns, front frame,
  side walls, roof edge/fascia, and plinth.
- **Material B: vertical cladding.** Narrow board-and-batten siding, used on
  the ground-floor base and the central upper loggia pier. The visible board
  direction is vertical.
- **Material C: glass.** Semi-transparent neutral grey glazing for the front
  loggia, ground windows, roof terrace back wall, and roof terrace side guard.
- **Material D: black railing/linework.** Thin black rails at the upper loggia.
- **Material E: terrace floor.** Light grey walking surface inside the roof
  cutout and on any exposed terrace floor.

The roof must not use a brown/dark default roof material. If lighting makes the
white roof look brown, adjust material/renderer/geometry until the model reads
as a white shell with shaded white faces.

---

## 7. Interior Programme, Labels, And Assets

The exterior silhouette is primary. Interior elements must support the demo but
must not distort the reference massing.

Ground floor:

- Entrance / stair hall aligned with the front door and stair window.
- Guest WC near the entrance.
- Kitchen zone with cabinet run, island or prep counter, fridge/pantry marker,
  and sink marker.
- Living/dining zone with sofa, coffee table, dining table, and chairs.

First floor:

- Master bedroom with bed and wardrobe assets.
- Secondary bedroom with bed and desk/storage asset.
- Bathroom with toilet, basin, and shower/bath assets.
- Landing/circulation zone around the stair opening.

Roof terrace:

- Terrace room/zone label.
- Outdoor table/chair or lounge chair grouping inside the roof cutout.

Every placed asset should reference an indexed asset library entry and carry a
clear name. Room outlines should use meaningful `programmeCode`,
`functionLabel`, and `targetAreaM2` metadata where supported.

---

## 8. Viewpoints And Checkpoint Requirements

Required checkpoint views:

- Main front-left axonometric: must show the white wrapper, recessed upper
  loggia, cantilever, ground cladding, and roof terrace cutout.
- Roof terrace / high right axonometric: must clearly show the embedded roof
  balcony carved into the roof shell.
- Front elevation: must show the three-bay upper loggia and ground windows.
- Rear/right axonometric: must show that the roof cutout is a real void with
  interior terrace faces.

Checkpoint acceptance:

- If the main view still reads as "ordinary gable roof on a box", the phase
  fails.
- If the roof terrace cutout is not visible in at least one normal user-facing
  3D viewpoint, the phase fails.
- If the roof is dark/brown instead of white shell material, the phase fails.
- If advisor findings identify current-phase issues on authored elements, they
  must be fixed or explicitly logged as accepted tolerances.

---

## 9. Prompting Cheat-Sheet For AI

High-fidelity minimalist architectural axonometric; thick white folded shell
forming roof and upper side walls; deep recessed front loggia; large rectangular
roof-terrace void carved into the right roof plane; visible white return faces
inside the cutout; recessed glass wall inside roof balcony; cantilevered upper
wrapper over vertically-clad ground-floor base; narrow vertical board cladding;
portrait stair window with visible treads; black three-line balcony rail;
matte white plaster/concrete shell; crisp black outline linework; sharp sun
shadows.
