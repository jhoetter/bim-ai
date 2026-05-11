# Target House 2 Assumptions

- `target-house-2.png` is the primary visual target. It appears to show the same 14 m x 10 m house from the opposite/front-right axonometric corner relative to `target-house-1.png`.
- The floorplan image is treated as the dimensional source of truth: 14,000 mm overall width, 10,000 mm overall depth, 3,000 mm floor-to-floor.
- The folded white upper wrapper is represented with typed walls, an asymmetric roof, recess zones, roof-court returns, and railings. There is no single native folded-shell primitive in `seed-dsl.v0`.
- Board-and-batten cladding is represented through wall types and material intent, not individual batten geometry.
- Interior furniture, casework, plumbing, and terrace items are indexed/placed asset markers. They communicate programme and plan use; they are not manufacturer-specific BIM families.
- Long-span ground and upper slabs carry concept structural-system metadata in the bundle via `set_element_prop`; beam/grid sizing remains a later engineering pass.
- Browser/right-rail evidence could not be captured in this run because `http://127.0.0.1:2000` returned 404 during `sketch_bim.py doctor --require-live`.
