# Seedhouse Rebuild Assumptions — 2026-05-10

- The source image has no explicit scale; the upper white shell width is calibrated to 8000 mm from `spec/target-house-seed.md` and the visible ground base is set to 5600 mm.
- The front wrapper face projects 450 mm forward of the ground facade to create the visible cantilever shadow.
- The loggia back wall is set 1550 mm behind the front wrapper face; this is deeper than the spec minimum so the recess reads clearly in the renderer.
- The roof ridge runs in the depth direction. The roof footprint depth is 8650 mm including the front wrapper projection so the renderer selects the correct ridge orientation for the analytic roof opening.
- The roof terrace cutout is 2400 mm by 3200 mm and reaches the east roof edge, matching the image's open right-side bite.
- Roof cutout return faces are represented with white wall and mass geometry in addition to `createRoofOpening`, because the spec requires the void to render as occupied architecture.
- Interior room outlines follow real wall centerlines. No room-separation rectangles are used.
- Some interior partitions are simplified from an actual design set; they are arranged to keep all occupied rooms accessible and advisor-clean for project initiation.
