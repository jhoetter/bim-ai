# Target House 4 Visual Delta

Source checked: `Ansichten.pdf` / customer elevation sheet in `/Users/jhoetter/Desktop/Testhaus`.

## Major differences found

- Dormers: the rendered model showed roof holes but not protruding dormer boxes. The drawing has four raised dormers with cheek walls, visible front glazing, and shallow shed roofs.
- Roof: the rendered model used a plain terracotta slab. The drawing reads as a tiled steep gable roof with overhangs, a long ridge, and visible surface striping.
- Long facade: the rendered model read as a mostly blank grey wall. The drawing has a regular rhythm of punched ground-floor windows, two entries, basement windows, and attic/dormer windows.
- Basement/plinth: the rendered model showed a large exposed base with no detail. The drawing shows basement windows along the lower elevation.
- Advisor: the default advisor snapshot did not show every issue visible in the UI footer. The construction-readiness server profile reported dormer proxy warnings, attic-wall metadata warnings, and kitchen clearance errors.

## Refinement actions

- Fixed the renderer so dormer bodies are placed on the sampled roof plane instead of at the attic reference slab.
- Added visible dormer front glass and mullions directly in the dormer renderer.
- Added a constructability AABB proxy for dormers so they are no longer reported as unsupported physical geometry.
- Added a terracotta clay roof-tile material and generated roof striping for tile roof keys.
- Added front glass panels for the ground-floor windows and basement windows to make the long elevation read as the drawing.
- Added four basement front window openings.
- Moved kitchen markers away from the front wall to clear the construction-readiness furniture clearance rule.
- Added construction-readiness metadata to attic roof-attached walls.
- Added a direct `constructability-report` helper command to the sketch-to-BIM workflow so the same profile behind the UI footer can be checked from the server.
