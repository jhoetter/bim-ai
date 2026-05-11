# Assumptions

- The floorplan image is treated as dimensioned source where it conflicts with the earlier approximate brief: overall plan is 14,000 mm by 10,000 mm.
- The front facade is the south edge (`y = 0`) and the main evidence view is a front-left axonometric.
- The roof court is represented as a large roof opening plus an occupied terrace floor and white return walls. Renderer support for sloped return faces is still partial, so the return walls are vertical BIM elements.
- Vertical cladding is represented with material keys and named wall/pier elements. Fine board grooves are a renderer/material tolerance, not individual modeled battens.
- The seed keeps interior partitions schematic but uses real walls, room outlines, doors, and a stair opening so the model is a usable project-initiation baseline rather than a pure exterior mass.
