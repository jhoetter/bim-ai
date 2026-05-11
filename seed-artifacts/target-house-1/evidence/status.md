# Target House 1 Seed Status

This artifact has been rebuilt from a reviewable `seed-dsl.v0` recipe in
`evidence/target-house-1.recipe.json`.

The recipe uses first-class DSL primitives for levels, typed wall/floor/roof
volumes, roof opening, rooms, and viewpoints. It uses raw `cmd-v3.0` commands
only for features the v0 DSL does not yet model directly: wall-top attachment,
front loggia recess, stair and slab opening, facade openings, rail/sweep
details, roof-court return walls, plan views, section cut, sheet, and schedules.

Latest live acceptance:

- `acceptance-gates.json`: `ok: true`.
- `live/advisor-warning.json`: zero warning findings.
- `screenshot-manifest.json`: seven checkpoint screenshots captured.
- `visual-gate.json`: no blank/failing screenshots.

Remaining tolerances:

- The white folded wrapper is represented by walls, asymmetric roof, frame
  sweep, and return walls. The engine does not yet have a single folded-shell
  primitive.
- The roof court cutout is real command data via `createRoofOpening` and has
  screenshot coverage from the roof-court and main axonometric viewpoints.
- Board-and-batten cladding is material intent rather than individual battens.
- Visual comparison is marked `needs_review` because no target comparison map
  was supplied to `initiation-run`; the automated gate only checked screenshot
  content/nonblank quality.
