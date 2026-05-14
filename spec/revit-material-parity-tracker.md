# Revit Material Parity Tracker

Last updated: 2026-05-14

Owner intent: make material assignment, display, editing, documentation, and export behave close enough to Revit that a user can trust what they see. This tracker intentionally supersedes the optimistic status in `spec/material-appearance-system-tracker.md`; that file describes foundations, while this file tracks remaining product parity gaps and the order to close them.

## Revit Baseline

Autodesk documents Revit materials as a set of assets rather than a single color. A complete material can carry:

- `Identity`: user-facing name, description, manufacturer, class, cost/spec metadata.
- `Graphics`: non-rendered view appearance: shaded color, transparency, surface pattern, cut pattern, and pattern colors.
- `Appearance`: rendered, Realistic, and Ray Trace appearance: color, image maps, reflectance/roughness, transparency, texture transforms, bump/relief/normal behavior.
- `Physical`: structural/engineering data.
- `Thermal`: energy-analysis data.

References:

- https://help.autodesk.com/cloudhelp/2025/ENU/Revit-Customize/files/GUID-0AA0E65D-55A4-4391-AA29-C53C06C048F4.htm
- https://help.autodesk.com/cloudhelp/2023/ENU/Revit-Customize/files/GUID-8D1A49AB-849C-49DF-A7B9-34C596E0C6F2.htm
- https://help.autodesk.com/cloudhelp/2023/ENU/Revit-Customize/files/GUID-6E3C9EF0-F657-4F79-90BD-A2FB88B0467D.htm

Product interpretation for BIM AI:

- Shaded mode must be graphics-driven and predictable.
- Realistic mode must use appearance assets and should make brick, timber, render, concrete, glass, metal, and stone read as different materials, not merely different colors.
- Materials on compound hosts should come from the exposed type layer by default.
- Instance materials are valid for elements that are actually instance-material elements, but they must not silently mask a typed wall/floor/roof layer unless the UI explicitly calls it an override.
- Room finishes are not the same thing as room material. A room can schedule finish sets; it should not be the only place users can author material.

## Current Reality Audit

The current repo has strong foundations but incomplete parity:

- There is a central material registry and project `material` elements.
- `makeThreeMaterialForKey()` can create Three.js materials with procedural fallbacks.
- Wall/floor/roof type-layer materials exist, but not every renderer and inspector path consistently uses the exposed layer.
- Material Browser assignment exists, but the target semantics are still fragile across typed hosts, component subparts, and categories without direct `materialKey`.
- Windows and doors have only coarse instance material slots. Window glass is hard-coded to a glass material while frame/panel material is `materialKey`; there is no frame-vs-glazing-vs-hardware subcomponent model.
- Stairs, railings, ceilings, soffits, edge profiles, balconies, ducts, and many family/subcomponent paths are category/default driven rather than first-class material targets.
- Procedural maps exist but are not yet calibrated enough to pass a visual realism bar for cladding and common finish materials.
- There is no durable material coverage audit that tells us, per element kind, which source actually drives 3D, 2D, schedule, and export.

## Status Legend

- `Open`: no meaningful implementation yet.
- `In Progress`: partial implementation exists; acceptance is not satisfied.
- `Done`: implemented, tested, and committed.
- `Blocked`: needs a product decision before implementation.

## Workpackage Overview

| WP | Title | Status | Priority | Primary Outcome |
| --- | --- | --- | --- | --- |
| RMP-01 | Material Authority And Coverage Audit | Done | P0 | Every element reports its effective material source and unresolved/missing gaps. |
| RMP-02 | Typed Host Source Of Truth | In Progress | P0 | Walls/floors/roofs consistently render, display, assign, schedule, and export exposed type layers. |
| RMP-03 | Opening And Host Cut Visual Correctness | Open | P0 | Windows/doors/openings show real holes, glass remains transparent, and no wall skin fills the pane. |
| RMP-04 | Procedural Appearance Calibration | Open | P0 | Common materials look credible in Realistic without external maps. |
| RMP-05 | Subcomponent Material Model | Open | P0 | Doors/windows/stairs/railings/families expose frame, panel, glass, tread, rail, baluster, hardware material slots. |
| RMP-06 | Material Assignment UI Parity | Open | P1 | Inspector and browser explain exactly what target will change before assignment. |
| RMP-07 | Graphics Asset Binding | Open | P1 | Plans, elevations, sections, and schedules use material graphics assets consistently. |
| RMP-08 | Appearance Asset Editing And Preview | Open | P1 | Users can edit color, maps, relief, scale, opacity, roughness, and see representative previews. |
| RMP-09 | Texture Alignment And Paint Tools | Open | P1 | Per-face paint and texture alignment behave like finish overrides, not type mutation. |
| RMP-10 | Export, Import, Schedule Fidelity | Open | P1 | IFC/GLTF/schedules preserve material identity, layers, appearance status, and missing asset diagnostics. |
| RMP-11 | Visual Regression Harness | Open | P1 | Browser screenshots and material evidence catch flat-color and transparency regressions. |
| RMP-12 | Performance And Asset Lifecycle | Open | P2 | Texture caching, disposal, LOD, and provenance are controlled at production scale. |

## RMP-01 — Material Authority And Coverage Audit

Priority: `P0`

Status: `Done`

Problem:

- We cannot reliably answer "which elements are missing material support?" from code or UI.
- The same element can have an instance `materialKey`, type layer material, family fallback, face override, and category fallback. Without an explicit resolver, bugs are easy to reintroduce.

Implementation steps:

1. Add a pure TypeScript audit module that walks `elementsById`.
2. For each renderable element, report:
   - element id/kind/name,
   - effective 3D material key,
   - material display name/category/source,
   - authority source: `type-layer`, `face-override`, `instance`, `subcomponent-default`, `family-default`, `category-fallback`, `non-rendered`, `unresolved`,
   - missing capability flags: `noEditableTarget`, `no3dMaterial`, `no2dGraphics`, `noSubcomponentSlots`, `unresolvedMaterialKey`.
3. Resolve compound host source rules:
   - wall: exterior face override, then wall type exposed exterior layer, then untyped instance material, then category fallback;
   - floor: floor type top layer, then category fallback;
   - roof: roof type top layer, then roof instance fallback, then category fallback.
4. Resolve opening/component source rules:
   - door: instance material drives frame/panel unless family parameters override in a later WP;
   - window: instance material drives frame; glass is `asset_clear_glass_double` subcomponent default;
   - curtain panel: panel override material or default glass.
5. Add tests that prove a typed wall with stale internal instance material audits to the exterior type layer.
6. Add an audit summary helper with counts by kind and source.

Acceptance:

- A target-house audit can list walls, floors, roofs, doors, windows, stairs, railings, rooms, and other renderable kinds with explicit material authority.
- Typed wall/roof stale instance keys are reported as shadowed, not effective.
- Window glass default and frame material are represented as separate subcomponent facts.
- Audit output clearly distinguishes "non-rendered by design" from "missing material parity."

Tests:

- Unit test for typed wall exterior layer winning over stale instance material.
- Unit test for typed roof top layer winning over instance fallback.
- Unit test for window frame/glass subcomponent defaults.
- Unit test for summary counts by kind/source.

Commit rule:

- Commit and push this workpackage by itself.

Evidence:

- Added `packages/web/src/viewport/materialCoverageAudit.ts`.
- Added `packages/web/src/viewport/materialCoverageAudit.test.ts`.
- Audit now reports effective material source, source category, display name, editable status, shadowed stale instance material, subcomponent facts, and missing capability flags.
- Typed wall exterior layer wins over stale internal instance material.
- Typed roof top layer wins over stale roof instance material.
- Window frame and glass are reported as separate facts, with glass using `asset_clear_glass_double`.
- Stairs/railings/ceilings/etc. are distinguishable as category fallback gaps, while rooms/material/type/image elements are non-rendered by design.
- Verification:
  - `pnpm --filter @bim-ai/web exec vitest run src/viewport/materialCoverageAudit.test.ts`
  - `pnpm --filter @bim-ai/web typecheck`

## RMP-02 — Typed Host Source Of Truth

Priority: `P0`

Status: `In Progress`

Problem:

- Host objects in Revit-like modeling are usually typed assemblies. A wall/floor/roof type has layers, and the exposed layer should drive exterior/top/bottom faces.
- Current code still has multiple direct `wall.materialKey` uses in wall render paths. That is risky unless those paths are strictly untyped walls or explicit face overrides.

Implementation steps:

1. Introduce shared helpers:
   - `effectiveWallFaceMaterialKey(wall, faceKind, elementsById)`
   - `effectiveFloorFaceMaterialKey(floor, faceKind, elementsById)`
   - `effectiveRoofFaceMaterialKey(roof, faceKind, elementsById)`
2. Replace direct `wall.materialKey`, `roof.materialKey`, and floor type ad hoc logic in renderer, inspector, schedules, and exports with those helpers.
3. Mark shadowed instance keys in inspector if they exist on typed hosts.
4. Ensure Material Browser assignment for a typed host changes the type layer, while untyped hosts still edit instance material where supported.
5. Add tests around CSG wall replacements, single-thickness walls, layered walls, floors, and roofs.

Acceptance:

- Selecting `hf-gf-wall-04` no longer exposes `Timber frame + insulation` as the effective exterior finish.
- Every wall render path uses exterior layer material unless an exterior face paint override exists.
- Roof mass, roof seams, dormer roof surfaces, and roof joins use the same top material logic.
- Floors expose the top material in 3D and cut-layer materials in section.

Commit rule:

- Commit and push after helper adoption and focused renderer tests pass.

Evidence:

- Added `packages/web/src/viewport/effectiveHostMaterials.ts`.
- Added `packages/web/src/viewport/effectiveHostMaterials.test.ts`.
- `packages/web/src/viewport/meshBuilders.ts` now uses shared effective host material helpers for:
  - curved wall meshes,
  - sloped wall meshes,
  - recessed wall meshes,
  - simple wall base materials,
  - floor slab top materials,
  - roof mass top materials,
  - roof standing seam material.
- Removed remaining direct `wall.materialKey` / `roof.materialKey` render lookups from `meshBuilders.ts`.
- Verification:
  - `pnpm --filter @bim-ai/web exec vitest run src/viewport/effectiveHostMaterials.test.ts src/viewport/materialCoverageAudit.test.ts src/viewport/meshBuilders.standingSeam.test.ts src/viewport/meshBuilders.layeredWall.test.ts src/viewport/meshBuilders.faceOverrides.test.ts src/viewport/csgWallMaterial.test.ts`
  - `pnpm --filter @bim-ai/web typecheck`

## RMP-03 — Opening And Host Cut Visual Correctness

Priority: `P0`

Status: `Open`

Problem:

- User screenshots show wall-looking surfaces visible behind/inside window glass. That can be caused by one of three failures:
  - host wall geometry was not actually cut,
  - cladding/reveal overlay meshes still cross the opening,
  - glass transparency/depth sorting makes back wall faces read as pane fill.

Implementation steps:

1. Build a reproducible fixture with:
   - one typed wall,
   - one hosted window,
   - one hosted door,
   - cladding material,
   - Realistic and Shaded view modes.
2. Add mesh-level tests:
   - host wall has no front/back triangles inside opening bounds,
   - cladding overlay/board meshes do not cross opening bounds,
   - reveal meshes are only on jamb/head/sill faces.
3. Add renderer-level assertions:
   - window glass material is transparent `MeshPhysicalMaterial`,
   - glass depthWrite is false,
   - frame and glass have distinct material keys.
4. Fix CSG replacement and any old direct wall mesh paths that bypass opening cut logic.
5. Add Playwright screenshots for windows enabled/disabled and glass visible/hidden.

Acceptance:

- Looking straight at a window shows transparent/glass surface and interior/background, not host wall skin.
- Toggling windows off exposes the cut opening or no window, but never a hidden wall panel in the opening.
- Glass remains visibly glass in Shaded and Realistic modes.

Commit rule:

- Commit and push after mesh tests and screenshot evidence are produced.

## RMP-04 — Procedural Appearance Calibration

Priority: `P0`

Status: `Open`

Problem:

- Procedural materials are technically non-flat, but cladding and some masonry/render appearances are too muddy/pixelated and do not read like architectural materials.

Implementation steps:

1. Calibrate procedural texture resolution per category:
   - brick/block: visible mortar grid and slight unit variation;
   - cladding: board seams, subtle grain, no muddy noise;
   - render/plaster: fine-grain bump and low chroma variation;
   - concrete: aggregate/cloud variation without strong tiling;
   - metal roof: standing seams aligned with geometry;
   - glass: transparent, reflective, slightly blue/green edge tint.
2. Add category-specific bump scale in the material factory, not just bump maps.
3. Add texture map metadata to QA evidence:
   - unique albedo count,
   - relief map attached,
   - bump scale,
   - render path.
4. Add gallery screenshot checks for non-flat but not over-noisy output.

Acceptance:

- A brick wall is recognizably brick at normal viewport distance.
- Timber/cladding appears as boards, not green/brown noise.
- Render and plaster remain subtle.
- Metal roofs show clean seams and material roughness.

Commit rule:

- Commit and push after unit tests and one screenshot evidence folder are generated.

Evidence:

- Added category-specific bump-scale calibration in `packages/web/src/viewport/threeMaterialFactory.ts`.
- Increased default procedural map resolution in `packages/web/src/viewport/proceduralMaterials.ts`.
- Reduced cladding albedo/bump noise and emphasized board-edge relief so cladding reads as board courses rather than muddy texture noise.
- Added factory tests for brick, cladding, and render bump strength.
- Verification:
  - `pnpm --filter @bim-ai/web exec vitest run src/viewport/threeMaterialFactory.test.ts src/viewport/proceduralMaterials.test.ts src/viewport/materialQaGallery.test.ts`
  - `pnpm --filter @bim-ai/web typecheck`

## RMP-05 — Subcomponent Material Model

Priority: `P0`

Status: `Open`

Problem:

- Revit families commonly expose type/instance material parameters for subcomponents. Our door/window/stair/railing models mostly have one coarse material or hard-coded defaults.

Implementation steps:

1. Add a generic subcomponent material contract:
   - `materialSlots?: Record<string, string | null>` on relevant instance/type records or family type parameters,
   - canonical slot names per category.
2. Door slots:
   - `frame`, `panel`, `threshold`, `hardware`, `glass`.
3. Window slots:
   - `frame`, `sash`, `glass`, `spacer`, `hardware`, `shading`.
4. Stair slots:
   - `tread`, `riser`, `stringer`, `landing`, `support`, `nosing`.
5. Railing slots:
   - `topRail`, `handrail`, `baluster`, `post`, `panel`, `bracket`.
6. Family instances:
   - resolve family parameter material overrides before category fallback.
7. Inspector:
   - show a Material Slots section with assign buttons per slot.

Acceptance:

- Window glass and frame can be assigned independently.
- Door panel and frame can be assigned independently.
- Stair treads can be timber while supports are steel/concrete.
- Railings can have metal posts and glass/solid panels.

Commit rule:

- Split by element category: windows/doors first, then stairs/railings, then generic family instances.

## RMP-06 — Material Assignment UI Parity

Priority: `P1`

Status: `Open`

Problem:

- Users need to know whether assigning material changes an instance, a type layer, a painted face, or a family subcomponent.

Implementation steps:

1. Add target chips in Material Browser:
   - `Selected instance`,
   - `Wall type exterior layer`,
   - `Roof type top layer`,
   - `Window frame slot`,
   - `Window glass slot`,
   - `Painted face`.
2. Disable assignment when no material target exists, with a concrete explanation.
3. In inspector, show:
   - effective material,
   - source,
   - shadowed overrides,
   - available editable targets.
4. Add multi-select behavior:
   - all same editable target kind: enable assignment,
   - mixed target kinds: require explicit target choice.

Acceptance:

- A user can tell why a wall shows type exterior material instead of instance material.
- A room selection does not mislead users into thinking rooms own wall materials.
- Multi-selection does not accidentally mutate unrelated types.

## RMP-07 — Graphics Asset Binding

Priority: `P1`

Status: `Open`

Problem:

- A material needs drafting graphics separate from realistic appearance.

Implementation steps:

1. Resolve material graphics for plan/elevation/section from the same effective material helpers.
2. Bind surface patterns to visible faces in plan/elevation.
3. Bind cut patterns to section/cut geometry.
4. Keep `useRenderAppearance` explicit; do not let realistic albedo silently override drafting graphics unless requested.
5. Add material tags/keynotes that can target effective material, not just element.

Acceptance:

- Brick wall has brick surface/cut pattern.
- Concrete slab has concrete cut pattern.
- Glass has transparent/no-heavy-hatch behavior.
- Changing appearance texture does not accidentally change drafting pattern.

## RMP-08 — Appearance Asset Editing And Preview

Priority: `P1`

Status: `Open`

Problem:

- Appearance editing exists, but preview and edit controls are not yet robust enough to trust for real authoring.

Implementation steps:

1. Make preview use the exact material factory, transform, and procedural maps used by the viewport.
2. Add preview geometry modes:
   - sphere,
   - wall panel,
   - floor panel,
   - roof panel,
   - glass pane.
3. Add editing for:
   - base color,
   - albedo/normal/bump/roughness/metalness/height map,
   - scale/rotation/offset,
   - roughness/metalness/opacity/transmission,
   - graphics surface/cut patterns.
4. Add missing asset warnings and "duplicate asset before edit" behavior.

Acceptance:

- Preview of brick shows courses.
- Preview of glass shows transparency.
- Preview of a material with missing maps warns but still falls back gracefully.

## RMP-09 — Texture Alignment And Paint Tools

Priority: `P1`

Status: `Open`

Problem:

- Real users need to paint individual faces and align courses/tiles/planks locally.

Implementation steps:

1. Make face addressing stable across render rebuilds.
2. Add face-local material override for wall/floor/roof faces.
3. Add face-local UV transform:
   - rotate 90,
   - nudge U/V,
   - reset,
   - numeric scale.
4. Add optional "push transform to material definition" command.

Acceptance:

- One wall face can be painted without changing the type.
- Brick courses can align to a wall base.
- Reset returns to type material.

## RMP-10 — Export, Import, Schedule Fidelity

Priority: `P1`

Status: `Open`

Problem:

- What the user sees must survive schedules and external exchange.

Implementation steps:

1. Add schedule fields for:
   - effective material key,
   - display name,
   - source,
   - graphics status,
   - appearance status,
   - missing asset status.
2. Export IFC material layer sets with layer material names and keys.
3. Export GLTF/PBR metadata and maps where available.
4. Import/readback material keys without collapsing them into category colors.

Acceptance:

- Door/window/wall/floor/roof schedules show material display names.
- IFC preserves wall/floor/roof layer materials.
- GLTF includes albedo/normal metadata for supported materials.

## RMP-11 — Visual Regression Harness

Priority: `P1`

Status: `Open`

Problem:

- The current regressions were visible in screenshots. We need automated screenshot evidence for the same areas.

Implementation steps:

1. Add a deterministic material scene:
   - typed wall with window,
   - brick wall,
   - timber/cladding wall,
   - render wall,
   - glass window,
   - metal roof,
   - floor slab.
2. Run Playwright desktop screenshots in Shaded and Realistic.
3. Add pixel/readback checks:
   - texture non-uniformity,
   - transparent glass,
   - no wall-filled window opening,
   - material not category fallback when explicit material exists.
4. Store evidence under `packages/web/tmp/material-parity-*`.

Acceptance:

- A missing texture map or filled window opening fails a local verification script.

## RMP-12 — Performance And Asset Lifecycle

Priority: `P2`

Status: `Open`

Problem:

- Realistic materials can become expensive if every surface creates unique textures/materials.

Implementation steps:

1. Cache by material key, map URL, transform, and relevant render options.
2. Share immutable procedural maps where possible.
3. Dispose maps/materials on scene rebuild.
4. Add max texture size and LOD policy.
5. Track asset provenance/license/source in the browser and schedules.

Acceptance:

- Rebuilding a model does not leak textures.
- Large projects do not create one texture per face unless face overrides require it.

## Program Definition Of Done

Material parity is acceptable when:

- Every renderable element has an explainable material source.
- Typed walls/floors/roofs use exposed type layers consistently.
- Doors/windows/stairs/railings expose meaningful subcomponent material slots.
- Window openings are physically cut and glass remains visible.
- Realistic mode shows credible surfaces for brick, timber, cladding, render, concrete, metal, stone, and glass.
- Shaded/plan/section graphics are driven by graphics assets.
- Material Browser assignment says exactly what will be changed.
- Schedules/exports preserve material identity and layer assignments.
- Screenshot evidence catches regressions before users do.
