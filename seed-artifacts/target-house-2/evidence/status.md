# Target House 2 Seed Status

This artifact creates a reviewable `seed-dsl.v0` recipe for `target-house-2` based on `spec/target-house/target-house-2.png`, `floorplan.png`, and the image-locked target-house seed spec.

Current state:

- Offline compile succeeds and writes `bundle.json`.
- The material intent check passes with five material intents represented in the compiled bundle.
- `make seed name=target-house-2` succeeds through `sketch_bim.py seed --seed target-house-2 --clear`.
- Live CLI Advisor was captured for model `b2232151-47ff-5b16-a699-5dde379e906d`.
- Strict phase/final acceptance is blocked by Advisor warnings in `evidence/phase-1/advisor-warning.json`.
- Browser screenshots, right-rail text, and Advisor parity are blocked because the API is reachable but the web app at `http://127.0.0.1:2000` returned 404.

Remaining warnings from the latest live Advisor capture:

- `door_operation_clearance_conflict`: 5 findings, mostly around the loggia/roof-court door zones and remaining placed assets.
- `furniture_wall_hard_clash`: 2 findings around the feature screen / wall-adjacent placed assets.
- `physical_hard_clash`: 2 findings among remaining placed assets.
- `room_without_door_access`: service room access still needs a door midpoint/boundary correction.
- `window_operation_clearance_conflict`: 3 findings around the ground kitchen/living glazing and kitchen run.

No final live acceptance is claimed for this artifact.
