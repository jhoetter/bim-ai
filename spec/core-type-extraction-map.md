# Core Type Extraction Map

Last updated: 2026-05-20

Scope: CQ-2026-05. `packages/core/src/index.ts` remains the public
`@bim-ai/core` facade. The goal is to move cohesive type families behind that
facade without changing imports for frontend, CLI, or tests.

## Current Slices

- `packages/core/src/elements/site.ts`: toposolids, subdivisions, graded
  regions, excavation, pads, shafts, hatch definitions, neighborhood massing,
  and concept seed handoff types.
- `packages/core/src/elements/building.ts`: project settings, room color
  schemes, wall/floor/roof type definitions, and level elements.

## Next Type Slices

- `elements/building.ts`: continue moving grids, walls, floors, roofs, rooms,
  openings, stairs, railings, ramps, columns, beams, beam systems, braces,
  structural connections, and building services.
- `elements/family.ts`: family definitions, family types, family instances,
  family editor solids, nested instances, custom materials, and placed assets.
- `elements/documentation.ts`: views, sheets, titleblocks, schedules, tags,
  dimensions, detail drafting, view templates, graphics overrides, markups, and
  comments.
- `commands/site.ts`: site/toposolid/concept seed commands currently re-exported
  from `elements/site.ts`; split once command parity checks exist.
- `commands/building.ts`: building authoring and edit commands.
- `commands/viewsheets.ts`: view, sheet, schedule, and documentation commands.
- `commands/family.ts`: family editor, asset placement, and material commands.

## Guardrails

- Public consumers keep importing from `@bim-ai/core`.
- Each extracted element family gets a compile-time fixture under
  `packages/core/src/type-tests/` proving membership in the exported `Element`
  union.
- Deprecated aliases stay in the facade with an explicit migration comment.
- Contract parity work in CQ-2026-14 should consume the same slices rather than
  scraping the full facade.
