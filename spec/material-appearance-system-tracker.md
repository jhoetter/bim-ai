# BIM AI Material Appearance System Tracker

Last updated: 2026-05-14

Purpose: plan the move from mostly color-based materials to a Revit-like material system where a material can drive 2D graphics, 3D/rendered appearance, texture mapping, surface relief, and non-visual physical/thermal metadata.

Reference baseline from Revit:

- A Revit material can contain `Identity`, `Graphics`, `Appearance`, `Physical`, and `Thermal` assets.
- `Graphics` controls drafting/display behavior such as shaded color, surface pattern, cut pattern, and transparency.
- `Appearance` controls rendered/realistic behavior such as texture images, bump/relief maps, reflectance/gloss/roughness, transparency, and texture transforms.
- `Physical` and `Thermal` are analytical assets, not visual assets.
- Revit generally does not model every brick, tile, or timber grain as geometry. It uses surface patterns, image maps, and relief/bump maps for the material look; explicit modeled courses/details are a higher-detail modeling choice.

Autodesk references:

- Material properties/assets: https://help.autodesk.com/cloudhelp/2023/ENU/Revit-Customize/files/GUID-8D1A49AB-849C-49DF-A7B9-34C596E0C6F2.htm
- Appearance editing and texture controls: https://help.autodesk.com/cloudhelp/2025/ENU/Revit-Customize/files/GUID-03A2730E-AAEE-42F6-88BC-3C9718B9F5DD.htm
- Texture editor scale/rotation/position/depth: https://help.autodesk.com/cloudhelp/2022/ENU/Revit-Customize/files/GUID-33770911-426A-4E53-B91D-67AB64110E19.htm
- Relief/bump maps: https://help.autodesk.com/cloudhelp/2024/ENU/RevitLT-Customize/files/GUID-71574CD7-4031-4E67-B1EF-A5A2264230AE.htm

## Status Legend

- `Open`: no implementation beyond existing foundations.
- `In Progress`: partial implementation exists, but acceptance is not complete.
- `Blocked`: needs a product or technical decision before implementation.
- `Done`: implemented, tested, and visually verified in plan, 3D, and relevant export/schedule paths.

Priority:

- `P0`: required to stop material assignment from feeling fake or broken.
- `P1`: required for Revit-like material workflows.
- `P2`: refinement, breadth, or performance hardening after P0/P1.

## Current Implementation Inventory

The repo already has foundations that should be reused.

| Area                         | Current State                                                                                                                                           | Main Files                                                                                                                                                   | Gap                                                                                                    |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| Web material registry        | `MaterialPbrSpec` has `baseColor`, `roughness`, `metalness`, `textureMapUrl`, `bumpMapUrl`, `normalMapUrl`, `graphics`, `physical`, `thermal`.          | `packages/web/src/viewport/materials.ts`                                                                                                                     | Map fields are metadata only; no general texture loading or UV transform pipeline.                     |
| First-class material element | `MaterialElem` supports `albedoMapId`, `normalMapId`, `roughnessMapId`, `metallicMapId`, `heightMapId`, `uvScaleMm`, `uvRotationDeg`, `hatchPatternId`. | `packages/core/src/index.ts`, `app/bim_ai/elements.py`                                                                                                       | Not unified with the web registry or material browser assignment path.                                 |
| 3D material construction     | `makeThreeMaterialForKey()` creates standard/physical materials from registry values.                                                                   | `packages/web/src/viewport/threeMaterialFactory.ts`                                                                                                          | Not yet the universal factory; most mesh builders still hand-roll `MeshStandardMaterial`.              |
| Wall appearance              | Wall and CSG walls resolve color/roughness/metalness and simple cladding boards.                                                                        | `packages/web/src/viewport/materials.ts`, `packages/web/src/Viewport.tsx`, `packages/web/src/viewport/meshBuilders.ts`                                       | Brick/stone/concrete/tile relief and texture are absent.                                               |
| Element assignment           | Material browser can now assign instance `materialKey` for supported elements; floors target first type layer.                                          | `packages/web/src/workspace/Workspace.tsx`, `packages/web/src/workspace/WorkspaceRightRail.tsx`, `packages/web/src/workspace/inspector/InspectorContent.tsx` | Assigning material still does not expose per-face or per-layer texture alignment.                      |
| Plan/section patterns        | Hatch pattern element kinds exist, and some room/detail-region hatch paths exist.                                                                       | `packages/core/src/index.ts`, `app/bim_ai/engine_helpers.py`, plan rendering files                                                                           | Material `surfacePattern` / `cutPattern` are not consistently bound to plan/section render primitives. |
| Schedules/readback           | Material keys appear in schedule derivation for some categories.                                                                                        | `app/bim_ai/schedule_derivation.py`, `app/bim_ai/schedule_field_registry.py`                                                                                 | Schedules do not expose visual asset status, texture scale, or missing-map diagnostics.                |

## Target Model

The target is a four-lane material model:

1. `Identity`: name, class, manufacturer, keynote/spec links, source.
2. `Graphics`: shaded color, transparency, surface pattern, cut pattern, pattern color, use-render-appearance flag.
3. `Appearance`: PBR values and maps, including albedo/base color, normal or bump/height, roughness, metalness, opacity/transmission, emission if needed, texture scale/rotation/offset.
4. `Analysis`: physical and thermal metadata.

The material assignment model should support:

- instance material overrides where the element schema has a `materialKey`,
- type-layer materials for compound assemblies such as walls/floors/roofs,
- per-face appearance overrides for future paint/finish workflows,
- per-material default UV transform and per-face UV transform override,
- drafting patterns independent from rendered textures, with an optional `useRenderAppearance` bridge.

## Gap Inventory

| ID          | Gap                                                                           | Impact                                                         | Priority | Status      |
| ----------- | ----------------------------------------------------------------------------- | -------------------------------------------------------------- | -------- | ----------- |
| MAT-GAP-001 | Registry and first-class `material` elements are not unified.                 | Project-authored materials cannot fully behave like built-ins. | P0       | Done        |
| MAT-GAP-002 | General texture map loading is missing.                                       | Materials look like flat colors.                               | P0       | Done        |
| MAT-GAP-003 | UV scale/rotation/offset is not applied consistently.                         | Brick/tile/wood textures cannot be dimensionally credible.     | P0       | Done        |
| MAT-GAP-004 | Normal/bump/height relief is metadata only.                                   | Brick, stone, concrete, wood grain lack surface relief.        | P0       | Done        |
| MAT-GAP-005 | Plan/section surface and cut patterns are not material-driven.                | Architectural drafting views do not match material identity.   | P0       | Done        |
| MAT-GAP-006 | Material browser edits assignment, but not appearance/graphics assets.        | Users cannot tune material behavior after assignment.          | P1       | Done        |
| MAT-GAP-007 | Layered assemblies do not expose exterior/interior finish appearance clearly. | Revit-like wall/floor/roof types are underpowered.             | P1       | Done        |
| MAT-GAP-008 | Per-face paint/finish overrides are not modeled.                              | Users cannot paint one wall face or one floor zone.            | P1       | Done        |
| MAT-GAP-009 | Material previews are not representative.                                     | Browser choice is guesswork.                                   | P1       | Done        |
| MAT-GAP-010 | Exports/schedules do not preserve the full material asset contract.           | IFC/GLTF/readback can diverge from viewport behavior.          | P1       | Done        |
| MAT-GAP-011 | Texture performance and caching strategy is undefined.                        | Real textures could degrade 3D interaction.                    | P1       | Done        |
| MAT-GAP-012 | Visual QA does not catch material regressions.                                | Textures/bump/patterns can silently disappear.                 | P1       | In Progress |
| MAT-GAP-013 | Assets and licensing/provenance are not tracked.                              | Curated texture libraries can create legal/product risk.       | P2       | Done        |

## Workpackages

### WP-MAT-01 — Canonical Material Asset Contract

- Priority: `P0`
- Status: `Done`
- Covers: `MAT-GAP-001`
- Goal: define one canonical material model shared by core schema, Python engine, web registry, browser UI, schedules, and exports.
- Product decision:
  - Keep `materialKey` as the stable assignment value.
  - Treat `MaterialElem.id` and registry `MaterialPbrSpec.key` as the same namespace, or introduce a strict resolver that maps both without ambiguity.
  - Built-in materials remain code-defined, project materials become document elements.
- Source ownership:
  - `packages/core/src/index.ts`
  - `app/bim_ai/elements.py`
  - `packages/web/src/viewport/materials.ts`
  - `packages/web/src/familyEditor/MaterialBrowserDialog.tsx`
  - `packages/web/src/familyEditor/AppearanceAssetBrowserDialog.tsx`
- Implementation steps:
  - Add `MaterialAppearanceAsset`, `MaterialGraphicsAsset`, `MaterialPhysicalAsset`, and `MaterialThermalAsset` types in core.
  - Preserve legacy flat fields on `MaterialPbrSpec` as derived/read-compatible fields during migration.
  - Add resolver functions:
    - `resolveMaterialDefinition(materialKey, elementsById?)`
    - `listMaterialDefinitions(elementsById?)`
    - `materialDefinitionToThreeSpec(def)`
    - `materialDefinitionToGraphicsSpec(def)`
  - Make project `material` elements override or extend built-ins only through explicit `source` and stable id rules.
  - Add validation that material keys referenced by elements, wall type layers, floor type layers, roof type layers, and curtain panel overrides resolve or produce a typed diagnostic.
- Acceptance:
  - Built-in material keys still resolve with no document material elements.
  - A project material element can be assigned to a wall and used in 3D rendering.
  - A project material element can supply `hatchPatternId` and appear in material browser readout.
  - Unknown material keys are surfaced as diagnostics, not silent grey unless explicitly allowed.
- Tests:
  - Unit tests for resolver precedence and unknown-key behavior.
  - Store/engine tests for `updateElementProperty(... materialKey ...)` against built-in and project material ids.
  - Snapshot test for `listMaterialDefinitions()` showing built-in + project material merge.
- Migration risk:
  - Existing tests may depend on registry-only behavior; keep compatibility layer until all callers migrate.

Evidence (2026-05-14):

- Added canonical material asset subtypes to `packages/core/src/index.ts` and matching Python `MaterialElem` fields in `app/bim_ai/elements.py`.
- Added resolver bridge in `packages/web/src/viewport/materials.ts`:
  - `resolveMaterialDefinition(materialKey, elementsById?)`
  - `listMaterialDefinitions(elementsById?)`
  - `materialDefinitionToThreeSpec(definition)`
  - `materialDefinitionToGraphicsSpec(definition)`
- Kept legacy `resolveMaterial()`, `listMaterials()`, and `materialBaseColor()` compatible while allowing project `material` elements to override/extend the built-in registry when an `elementsById` lookup is supplied.
- Added resolver-level wall surface appearance support for document material elements so render callers can consume the canonical bridge.
- Wired `MaterialBrowserDialog` / `AppearanceAssetBrowserDialog` to accept `elementsById` so project material elements appear in assignment UI.
- Verification:
  - `pnpm --filter @bim-ai/web exec vitest run src/viewport/materials.test.ts src/viewport/meshBuilders.standingSeam.test.ts src/familyEditor/MaterialBrowserDialog.test.tsx`
  - `pnpm --filter @bim-ai/web typecheck`
  - `PYTEST_ADDOPTS=--no-cov python -m pytest app/tests/api/test_mat_v3_01.py app/tests/test_material_catalog.py`

### WP-MAT-02 — Universal Three.js Material Factory

- Priority: `P0`
- Status: `Done`
- Covers: `MAT-GAP-002`, `MAT-GAP-004`, `MAT-GAP-011`
- Goal: all 3D mesh builders obtain materials through one factory that handles color, maps, relief, glass/transparency, side/depth settings, and caching.
- Source ownership:
  - `packages/web/src/viewport/threeMaterialFactory.ts`
  - `packages/web/src/viewport/materials.ts`
  - `packages/web/src/viewport/meshBuilders.ts`
  - `packages/web/src/viewport/meshBuilders.mass.ts`
  - `packages/web/src/families/geometryFns/doorGeometry.ts`
  - `packages/web/src/families/geometryFns/windowGeometry.ts`
  - `packages/web/src/viewport/familyInstance3d.ts`
- Implementation steps:
  - Expand `makeThreeMaterialForKey()` to accept:
    - `elementsById`,
    - `usage`: `wallExterior | wallInterior | floorTop | roofTop | openingFrame | structural | mass | generic`,
    - fallback category paint,
    - material side/depth options,
    - `uvTransform`.
  - Add `MaterialTextureManager` with:
    - `THREE.TextureLoader`,
    - cache by asset id or URL plus transform,
    - color-space handling (`SRGBColorSpace` for albedo, linear/no color space for normal/roughness/metalness/height),
    - anisotropy limit from renderer capabilities,
    - disposal when material registry changes.
  - Load maps into:
    - `map` for albedo,
    - `normalMap` for normal maps,
    - `bumpMap` for grayscale bump maps when normal is absent,
    - `roughnessMap`,
    - `metalnessMap`,
    - optional `displacementMap` only for high-detail future mode, not default.
  - Make glass/translucent categories use `MeshPhysicalMaterial`.
  - Migrate all materialized element builders away from hand-written `MeshStandardMaterial` where feasible.
- Acceptance:
  - One factory path covers wall, floor, roof, door, window, column, beam, sweep, family instance, mass.
  - Assigning `masonry_brick` can load an albedo texture and a bump/normal map.
  - Missing maps fall back to color without throwing.
  - Texture cache prevents duplicate network/file loads for repeated material keys.
  - Material disposal is covered when objects are rebuilt.
- Tests:
  - Unit test material factory output for color-only, glass, textured, normal-map, bump-map, and unknown-key cases.
  - Renderer smoke test that a textured wall creates a material with `map` and `normalMap` or `bumpMap`.
  - Memory/disposal test for repeated material rebuilds if feasible.
- Performance guardrails:
  - Default max texture size: 1024 or 2048 px depending on renderer budget.
  - Use compressed or downsampled assets where available.
  - Never block first model render on texture loading; render color first, update material when maps resolve.

Evidence (2026-05-14):

- Expanded `packages/web/src/viewport/threeMaterialFactory.ts` with:
  - `MaterialTextureManager` using `THREE.TextureLoader`,
  - cache keys by map kind, resolved asset URL, and UV transform,
  - `SRGBColorSpace` for albedo and `NoColorSpace` for normal/bump/roughness/metalness maps,
  - anisotropy, transform, and disposal support,
  - glass/translucent `MeshPhysicalMaterial` handling.
- Extended `MaterialPbrSpec` to carry roughness, metalness, and height map URLs from project material appearance assets.
- Migrated factory usage into wall, layered wall, floor, roof, curtain panel, door, window, column, beam, sweep, family instance, and mass rendering paths.
- Added `packages/web/src/viewport/threeMaterialFactory.test.ts` covering color fallback, glass, textured brick albedo+bump maps, project material normal-map preference, texture cache reuse, and cache disposal.
- Verification:
  - `pnpm --filter @bim-ai/web exec vitest run src/viewport/threeMaterialFactory.test.ts src/viewport/materials.test.ts src/viewport/meshBuilders.mass.test.ts src/viewport/sweepMesh.test.ts`
  - `pnpm --filter @bim-ai/web typecheck`

### WP-MAT-03 — UV Mapping And Texture Transform Pipeline

- Priority: `P0`
- Status: `Done`
- Covers: `MAT-GAP-003`
- Goal: make texture scale and orientation dimensionally credible across walls, floors, roofs, openings, columns, beams, sweeps, and masses.
- Source ownership:
  - `packages/core/src/index.ts`
  - `app/bim_ai/elements.py`
  - `packages/web/src/viewport/meshBuilders.ts`
  - `packages/web/src/families/sweepGeometry.ts`
  - `packages/web/src/viewport/sweepMesh.ts`
  - `packages/web/src/viewport/materials.ts`
- Implementation steps:
  - Extend material appearance transform to include:
    - `uvScaleMm: { uMm, vMm }`
    - `uvRotationDeg`
    - `uvOffsetMm: { uMm, vMm }`
    - `projection`: `box | wall-face | planar-xz | planar-xy | cylindrical | generated`
  - Add geometry UV generators:
    - wall front/back: U along wall length, V height,
    - wall ends: U thickness, V height,
    - floor top: U world X, V world Y/plan Y,
    - roof top: U along roof local major axis, V slope direction,
    - column/beam: box projection,
    - sweep: U along path distance, V around profile.
  - Add `applyMaterialUvTransform(texture, transform)` that sets repeat/rotation/offset consistently.
  - Add per-face material metadata hooks for future paint/align commands.
- Acceptance:
  - A 215 mm x 65 mm brick texture can be scaled so courses read at real-world size.
  - Rotating a wall does not rotate the brick courses incorrectly; U follows wall direction.
  - Floor tiles align in world coordinates and do not restart per triangle.
  - Roof standing seam/tile textures follow roof local slope orientation.
- Tests:
  - Geometry tests asserting UV ranges for a 4 m wall, 3 m height, 215 x 65 mm brick scale.
  - Floor UV test with a rectangular slab and tile scale.
  - Sweep UV test asserting U increases monotonically along path.
  - Visual Playwright screenshot for brick wall texture alignment on two perpendicular walls.

Evidence (2026-05-14):

- Extended material appearance metadata with `projection` and flat material `uvOffsetMm` / `projection` fields across core TypeScript, Python schema, and web material specs.
- Added `materialUvTransformForExtent()` and `applyMaterialUvTransform()` in `threeMaterialFactory.ts`.
- Added category defaults for real-world texture scale, including 215 mm x 75 mm brick modules, timber plank scale, stone, concrete/render, and standing-seam metal.
- Passed per-element real extents into factory UV transforms for walls, sloped/recessed walls, floors, roofs, and sweeps.
- Added unit coverage for brick repeat derivation and project material UV scale/offset/rotation application.
- Verification:
  - `pnpm --filter @bim-ai/web exec vitest run src/viewport/threeMaterialFactory.test.ts src/viewport/materials.test.ts src/viewport/sweepMesh.test.ts`
  - `pnpm --filter @bim-ai/web typecheck`

### WP-MAT-04 — Procedural Material Patterns For Offline/Generated Assets

- Priority: `P0`
- Status: `Done`
- Covers: `MAT-GAP-002`, `MAT-GAP-004`
- Goal: provide credible surface variation without depending on external bitmap assets for every material.
- Source ownership:
  - `packages/web/src/viewport/materials.ts`
  - new `packages/web/src/viewport/proceduralMaterials.ts`
  - `packages/web/src/viewport/threeMaterialFactory.ts`
- Implementation steps:
  - Add procedural texture generation for:
    - brick stretcher bond,
    - blockwork,
    - concrete noise,
    - plaster/render fine grain,
    - timber grain,
    - stone random ashlar,
    - ceramic tile grid,
    - standing seam metal.
  - Produce paired maps where useful:
    - albedo/canvas map,
    - bump/height map,
    - roughness variation map.
  - Cache generated `DataTexture` by material key, size, and UV transform.
  - Prefer bitmap asset maps when present; procedural maps are fallback when map slots are empty.
- Acceptance:
  - Brick, concrete, timber, stone, tile, and plaster visibly differ in realistic mode even without network assets.
  - Procedural brick has mortar lines and bump/height relief.
  - Procedural concrete has subtle variation, not a flat fill or noisy distraction.
  - Generated maps do not require DOM canvas in server-side test contexts without guards.
- Tests:
  - Texture generator unit tests for deterministic dimensions and non-uniform pixel data.
  - Material factory test ensuring procedural fallback appears when no asset URL/id is present.
  - Screenshot comparison matrix of six material spheres or wall panels.

Evidence (2026-05-14):

- Added `packages/web/src/viewport/proceduralMaterials.ts` using DOM-free `THREE.DataTexture` generation for brick, concrete/render, timber/cladding, stone, plaster, and standing-seam metal.
- Generated paired albedo, bump, and roughness maps with deterministic non-uniform pixel data and cache disposal support.
- Integrated procedural fallback into `makeThreeMaterialForKey()` only when a resolved material lacks authored bitmap map slots, preserving bitmap assets as the preferred path.
- Added `packages/web/src/viewport/proceduralMaterials.test.ts` covering deterministic dimensions, non-uniform data, category variation, and factory fallback maps.
- Verification:
  - `pnpm --filter @bim-ai/web exec vitest run src/viewport/proceduralMaterials.test.ts src/viewport/threeMaterialFactory.test.ts`
  - `pnpm --filter @bim-ai/web typecheck`

### WP-MAT-05 — Plan And Section Graphics Binding

- Priority: `P0`
- Status: `Done`
- Covers: `MAT-GAP-005`
- Goal: material graphics assets drive architectural 2D output, independently from 3D texture maps.
- Source ownership:
  - `packages/core/src/index.ts`
  - `app/bim_ai/engine_helpers.py`
  - `app/bim_ai/plan_projection_wire.py`
  - `packages/web/src/plan/planElementMeshBuilders.ts`
  - `packages/web/src/plan/symbology.ts`
  - `packages/web/src/workspace/sheets/sectionViewportSvg.tsx`
- Implementation steps:
  - Define material graphics asset fields:
    - `shadedColor`,
    - `surfacePatternId`,
    - `surfacePatternColor`,
    - `cutPatternId`,
    - `cutPatternColor`,
    - `transparency`,
    - `useRenderAppearance`.
  - Bind wall/floor/roof type layer materials to section cut hatches.
  - Bind exposed element materials to surface patterns in plan/elevation where visible.
  - Make detail level matter:
    - coarse: category fill/pattern only,
    - medium: layer cut patterns,
    - fine: layer boundaries plus hatch/pattern.
  - Add material pattern readouts in section documentation hints.
- Acceptance:
  - A brick wall type shows masonry cut/surface pattern in plan/section.
  - Concrete floor cut hatch differs from timber floor hatch.
  - Surface pattern and cut pattern can differ.
  - Realistic 3D texture can change without breaking drafting hatch, unless `useRenderAppearance` is explicitly enabled.
- Tests:
  - Plan projection tests for material-driven hatch ids.
  - SVG section output tests for material hint consistency.
  - Visual plan screenshot showing brick wall hatch, concrete floor hatch, and glass no-hatch behavior.

Evidence (2026-05-14):

- Added `packages/web/src/plan/materialGraphics.ts` as the 2D graphics resolver for shaded color, transparency, surface pattern, cut pattern, and `useRenderAppearance`.
- Extended web material graphics metadata to include transparency and surface/cut pattern colors from project `material` elements.
- Wired plan wall layer boundary colors and layer `userData.materialGraphics` to material graphics instead of 3D texture identity.
- Added section material hint pattern fields (`materialSurfacePatternId`, `materialCutPatternId`) in kernel section primitives and displayed cut pattern ids in sheet section documentation captions.
- Added unit coverage for built-in and project material graphics resolution plus section caption pattern readout.
- Verification:
  - `pnpm --filter @bim-ai/web exec vitest run src/plan/materialGraphics.test.ts src/workspace/sheets/sectionViewportSvg.test.ts`
  - `PYTEST_ADDOPTS=--no-cov python -m pytest app/tests/test_section_material_hatch_and_scale_evidence.py`
  - `pnpm --filter @bim-ai/web typecheck`

### WP-MAT-06 — Material Browser And Appearance Asset Editor

- Priority: `P1`
- Status: `Done`
- Covers: `MAT-GAP-006`, `MAT-GAP-009`
- Goal: upgrade material editing from pick-a-key to a Revit-like material editor with separate graphics and appearance tabs.
- Source ownership:
  - `packages/web/src/familyEditor/MaterialBrowserDialog.tsx`
  - `packages/web/src/familyEditor/AppearanceAssetBrowserDialog.tsx`
  - `packages/web/src/workspace/inspector/InspectorContent.tsx`
  - `packages/web/src/workspace/Workspace.tsx`
- Implementation steps:
  - Add tabs or segmented sections:
    - `Identity`
    - `Graphics`
    - `Appearance`
    - `Physical`
    - `Thermal`
  - For `Graphics`, expose color, transparency, surface pattern, cut pattern, and `useRenderAppearance`.
  - For `Appearance`, expose color, texture map, bump/normal map, roughness, metalness, opacity, scale, rotation, offset.
  - Add asset status badges:
    - `Color only`,
    - `Texture`,
    - `Texture + relief`,
    - `Missing map`,
    - `Project material`.
  - Add duplicate/rename/edit project material commands.
  - Ensure browser opens in assignment mode when called from selected element, and edit mode when called from material management.
- Acceptance:
  - User can assign brick to a wall, then edit brick texture scale from the same workflow.
  - User can duplicate a built-in material into a project material without mutating the built-in.
  - Appearance and graphics changes immediately update preview and selected model instance.
  - Invalid map URLs/asset ids show recoverable warnings.
- Tests:
  - React tests for material tab switching and edits.
  - Store/command tests for creating, duplicating, and editing project materials.
  - Browser tests for selected element assignment preserving target context.

Evidence (2026-05-14):

- Added an `Identity` tab, asset status badges, and duplicate-to-project workflow in `MaterialBrowserDialog`.
- Expanded `Appearance` editing to color, texture, normal/bump map metadata, opacity, reflectance, UV scale, and UV rotation.
- Expanded `Graphics` editing to shaded color, transparency, surface/cut patterns, and surface/cut pattern colors.
- Kept assignment mode intact while allowing created/duplicated project materials to be edited and then assigned from the same browser.
- Added React coverage for graphics edits, appearance UV edits, status badges, duplicate workflow, and appearance asset metadata editing.
- Verification:
  - `pnpm --filter @bim-ai/web exec vitest run src/familyEditor/MaterialBrowserDialog.test.tsx`
  - `pnpm --filter @bim-ai/web typecheck`

### WP-MAT-07 — Material Preview Renderer

- Priority: `P1`
- Status: `Done`
- Covers: `MAT-GAP-009`, `MAT-GAP-012`
- Goal: material browser previews should show more than a swatch; they should reveal texture scale, relief, roughness, transparency, and pattern identity.
- Source ownership:
  - new `packages/web/src/familyEditor/MaterialPreview.tsx`
  - `packages/web/src/viewport/threeMaterialFactory.ts`
  - `packages/web/src/viewport/materials.ts`
- Implementation steps:
  - Add lightweight preview geometry modes:
    - sphere for roughness/metal/glass,
    - flat wall panel for brick/tile/cladding,
    - floor slab for tile/timber/concrete,
    - cut hatch preview for graphics.
  - Render preview using same material factory and texture manager as main viewport.
  - Add static fallback preview for test environments without WebGL.
  - Add thumbnails to material and appearance browsers.
- Acceptance:
  - Browser preview for brick shows courses and relief.
  - Browser preview for glass shows transparency.
  - Browser preview for concrete shows rough diffuse surface.
  - Graphics preview shows surface/cut patterns separately from rendered texture.
- Tests:
  - Component tests for preview mode selection by material category.
  - Playwright screenshot matrix of preview thumbnails.

Evidence (2026-05-14):

- Added `packages/web/src/familyEditor/MaterialPreview.tsx` with deterministic static preview modes for glass, metal, brick, timber/cladding, concrete/render, stone, hatch, and color-only materials.
- Added thumbnails to material and appearance browser rows, including a relief marker when normal/bump/height maps exist.
- Added component tests for preview mode selection and static relief thumbnail rendering.
- Verification:
  - `pnpm --filter @bim-ai/web exec vitest run src/familyEditor/MaterialPreview.test.tsx src/familyEditor/MaterialBrowserDialog.test.tsx`
  - `pnpm --filter @bim-ai/web typecheck`

### WP-MAT-08 — Layered Assembly Material Semantics

- Priority: `P1`
- Status: `Done`
- Covers: `MAT-GAP-007`
- Goal: wall/floor/roof type layers should behave like compound assemblies, not just one color on the outer mesh.
- Source ownership:
  - `packages/web/src/families/wallTypeCatalog.ts`
  - `packages/web/src/workspace/authoring/MaterialLayerStackWorkbench.tsx`
  - `packages/web/src/viewport/meshBuilders.layeredWall.ts`
  - `app/bim_ai/material_assembly_resolve.py`
  - `app/bim_ai/roof_layered_prism_evidence_v1.py`
- Implementation steps:
  - Define exterior/interior/top/bottom exposed layer rules for each assembly type.
  - For walls:
    - exterior face uses exterior finish layer material,
    - interior face uses interior finish layer material,
    - cut view shows full layer stack with cut patterns,
    - openings wrap finish layers when `wrapsAtInserts` is true.
  - For floors:
    - top uses top finish material,
    - bottom/soffit uses bottom material or category fallback,
    - section cut shows layers.
  - For roofs:
    - top uses roof finish material,
    - fascia/soffit/gutter get separate material slots later.
  - Add readout explaining which layer is exposed on each face.
- Acceptance:
  - A cavity brick wall shows brick outside, plaster inside, and layered cut in section.
  - A timber floor shows top finish texture and concrete/timber structure in section.
  - Material browser assignment to selected type updates the target layer and downstream views.
- Tests:
  - Layer resolver tests for face-to-layer mapping.
  - 3D mesh tests for exterior/interior material assignment.
  - Section/render tests for layer cut pattern output.

Evidence (2026-05-14):

- Added `resolveWallAssemblyExposedLayers()` to the wall type catalog to identify exterior, interior, and cut layer material exposure.
- Added `materialExposure` group metadata and per-layer `faceExposure`, `layerFunction`, and `materialKey` metadata in layered wall meshes.
- Added kernel `exposedFaces` witness fields for wall, floor, and roof layered assembly rows.
- Added tests for cavity wall exterior/interior/cut mapping and layered wall mesh exposure metadata.
- Verification:
  - `pnpm --filter @bim-ai/web exec vitest run src/families/wallTypeCatalog.test.ts src/viewport/meshBuilders.layeredWall.test.ts`
  - `PYTEST_ADDOPTS=--no-cov python -m pytest app/tests/test_section_material_hatch_and_scale_evidence.py`
  - `pnpm --filter @bim-ai/web typecheck`

### WP-MAT-09 — Per-Face Paint And Finish Overrides

- Priority: `P1`
- Status: `Done`
- Covers: `MAT-GAP-008`
- Goal: support Revit-like paint/finish workflows where one face can carry a finish without changing the wall type.
- Source ownership:
  - `packages/core/src/index.ts`
  - `app/bim_ai/elements.py`
  - `packages/web/src/viewport/wallFaceRadialMenu.tsx`
  - `packages/web/src/Viewport.tsx`
  - `packages/web/src/viewport/meshBuilders.ts`
- Implementation steps:
  - Add `MaterialFaceOverrideElem` or per-element `faceMaterialOverrides`.
  - Face address should be stable:
    - `elementId`,
    - `faceKind`: `exterior | interior | top | bottom | left | right | generated`,
    - optional generated face id for complex geometry.
  - Extend raycast hit metadata to resolve face kind.
  - Add wall face radial menu command:
    - `Paint face...`,
    - `Align texture`,
    - `Reset face material`.
  - Apply face override at mesh construction and plan/elevation readout where relevant.
- Acceptance:
  - User can paint only the interior face of a wall without changing the wall type or exterior.
  - Reset removes face override and returns to type/instance material.
  - Schedules can distinguish host material from painted finish where needed.
- Tests:
  - Command tests for add/update/remove face material override.
  - Raycast/metadata tests for wall front/back face detection.
  - Visual 3D test with exterior brick and interior plaster on same wall.
- Evidence:
  - Added `MaterialFaceOverride` / `faceMaterialOverrides` in the TypeScript and Python element schemas.
  - Added wall BoxGeometry face-slot mapping, raycast face-kind recovery, and per-face material arrays for single-thickness wall meshes.
  - Added `Paint Face...` and `Reset Face Material` radial menu commands backed by `updateElementProperty.faceMaterialOverrides`.
  - Verification:
    - `pnpm --filter @bim-ai/web exec vitest run src/viewport/meshBuilders.faceOverrides.test.ts src/viewport/wallFaceRadialMenu.test.tsx`
    - `PYTEST_ADDOPTS=--no-cov python -m pytest app/tests/test_update_element_property_door_material.py`
    - `pnpm --filter @bim-ai/web typecheck`

### WP-MAT-10 — Texture Alignment Tools

- Priority: `P1`
- Status: `Done`
- Covers: `MAT-GAP-003`, `MAT-GAP-008`
- Goal: users can align brick/tile/wood texture on a surface without editing global material definition.
- Source ownership:
  - `packages/web/src/viewport/wallFaceRadialMenu.tsx`
  - `packages/web/src/Viewport.tsx`
  - `packages/web/src/workspace/inspector/InspectorContent.tsx`
  - material override model from `WP-MAT-09`
- Implementation steps:
  - Add commands:
    - `rotateMaterialOnFace`,
    - `moveMaterialOnFace`,
    - `scaleMaterialOnFace`,
    - `resetMaterialTransformOnFace`.
  - Add direct controls:
    - rotate 90 degrees,
    - nudge U/V,
    - numeric scale,
    - pick origin point.
  - Store transform override separate from the material definition.
  - Show transform readout in inspector when a face is selected.
- Acceptance:
  - User can align brick coursing with a wall base.
  - User can rotate wood grain on a door or beam.
  - Transform affects selected face/instance only unless explicitly applied to material.
- Tests:
  - Transform command tests.
  - UV transform application tests.
  - Screenshot before/after for rotate and offset.
- Evidence:
  - Extended face material overrides with `uvScaleMm`, `uvRotationDeg`, and `uvOffsetMm` so alignment stays instance/face-local.
  - Added radial menu commands for rotate, nudge, scale, and reset texture alignment on the addressed wall face.
  - Merged face-local UV overrides into the Three material factory transform when building simple wall face materials.
  - Added inspector readout for wall face materials and transform overrides.
  - Verification:
    - `pnpm --filter @bim-ai/web exec vitest run src/viewport/meshBuilders.faceOverrides.test.ts src/viewport/wallFaceRadialMenu.test.tsx`
    - `PYTEST_ADDOPTS=--no-cov python -m pytest app/tests/test_update_element_property_door_material.py`
    - `pnpm --filter @bim-ai/web typecheck`

### WP-MAT-11 — Asset Storage, Upload, And Provenance

- Priority: `P2`
- Status: `Done`
- Covers: `MAT-GAP-013`
- Goal: support imported texture assets safely and reproducibly.
- Source ownership:
  - asset/library code under `packages/web/src/workspace/library`
  - API upload/storage code under `app/bim_ai/routes_api.py`
  - future asset schema in core/Python
- Implementation steps:
  - Define `image_asset` element or asset-library entry shape for texture maps.
  - Store:
    - id,
    - filename,
    - MIME type,
    - dimensions,
    - byte size,
    - source/license/provenance,
    - content hash,
    - map usage hint: `albedo | normal | roughness | metalness | height | opacity`.
  - Add upload validation and max-size limits.
  - Add local project asset browser filtering by usage hint.
  - Add missing-asset recovery UI.
- Acceptance:
  - User can upload a brick albedo map and bump map and attach them to a project material.
  - Uploaded asset can be persisted, reloaded, and used by viewport texture manager.
  - License/source metadata is visible in asset inspector.
- Tests:
  - API upload validation tests.
  - Asset resolver tests by id/hash.
  - Browser tests for attaching uploaded maps to material.
- Evidence:
  - Added `image_asset` element contracts in core and Python with filename, MIME, size, dimensions, SHA-256 content hash, usage hint, license/source/provenance, and optional data URL.
  - Added material image upload validation for PNG/JPEG/WebP with a 5 MiB cap and `/api/material-assets/validate-upload`.
  - Material resolution now maps project image asset ids to data URLs for viewport texture loading when a material element references an uploaded asset.
  - Material browser appearance tab can filter project image assets by map usage and reports missing project asset ids.
  - Verification:
    - `PYTEST_ADDOPTS=--no-cov python -m pytest app/tests/api/test_material_image_assets.py`
    - `python -m ruff check app/bim_ai/material_image_assets.py app/bim_ai/routes_api.py app/bim_ai/elements.py app/tests/api/test_material_image_assets.py`
    - `pnpm --filter @bim-ai/web exec vitest run src/viewport/materials.test.ts src/familyEditor/materialImageAssets.test.ts src/familyEditor/MaterialBrowserDialog.test.tsx`
    - `pnpm --filter @bim-ai/web typecheck`

### WP-MAT-12 — Export, Import, And Schedule Fidelity

- Priority: `P1`
- Status: `Done`
- Covers: `MAT-GAP-010`
- Goal: material behavior must survive schedules and major exchange/export paths.
- Source ownership:
  - `app/bim_ai/schedule_derivation.py`
  - `app/bim_ai/schedule_field_registry.py`
  - IFC/GLTF export code and tests under `app/tests`
  - `packages/web/src/workspace/sheets/sectionViewportSvg.tsx`
- Implementation steps:
  - Add schedule fields:
    - material display name,
    - material class,
    - graphics surface/cut pattern,
    - appearance asset status,
    - texture scale,
    - physical density,
    - thermal conductivity.
  - Export GLTF material maps where available.
  - Export IFC material layer sets with material identity and relevant properties.
  - Add missing texture/export diagnostics.
- Acceptance:
  - Door/window/wall/floor/roof schedules can show material display name, not only key.
  - GLTF export includes albedo and normal maps for supported materials.
  - IFC material layer export preserves layer material names and material keys.
  - Missing assets are reported in export manifest.
- Tests:
  - Existing IFC material tests extended for appearance/identity.
  - GLTF manifest tests for texture map inclusion.
  - Schedule derivation tests for material display names and diagnostics.
- Evidence:
  - Schedule derivation now emits material class, surface/cut pattern, appearance status, texture scale, density, and conductivity for door/window material rows and material assembly layer rows.
  - Project `material` elements resolve their human names into schedule `materialDisplay`, not just built-in catalog seeds.
  - GLTF/render export metadata now includes material texture map ids and a `missingMaterialAssets` diagnostic list for unresolved project image asset references.
  - Verification:
    - `PYTEST_ADDOPTS=--no-cov python -m pytest app/tests/test_schedule_door_material_key_column.py app/tests/test_schedule_category_field_coverage.py`
    - `PYTEST_ADDOPTS=--no-cov python -m pytest app/tests/api/test_exp_v3_01.py`
    - `python -m ruff check app/bim_ai/schedule_derivation.py app/bim_ai/schedule_field_registry.py app/bim_ai/type_material_registry.py app/bim_ai/exp/render_export.py app/tests/test_schedule_door_material_key_column.py app/tests/api/test_exp_v3_01.py`

### WP-MAT-13 — Material QA And Visual Regression Suite

- Priority: `P1`
- Status: `Open`
- Covers: `MAT-GAP-012`
- Goal: prevent regressions where materials silently fall back to flat colors.
- Source ownership:
  - `packages/web/src/viewport/materials.test.ts`
  - `packages/web/src/viewport/solidMaterialDepth.test.ts`
  - Playwright or screenshot helper scripts under test/tmp conventions
- Implementation steps:
  - Add a material gallery scene with:
    - brick wall,
    - concrete slab,
    - timber beam,
    - glass window,
    - metal roof,
    - painted interior wall,
    - floor tile.
  - Capture desktop and mobile screenshots in realistic/material mode.
  - Add pixel-level checks:
    - texture non-uniformity,
    - transparent glass alpha/readback,
    - material color not washed out,
    - bump/normal map material property attached.
  - Add seeded evidence JSON for material QA.
- Acceptance:
  - CI or local verification can catch texture-map loss and flat-color fallback.
  - QA output lists material keys, map status, and render path used.
  - Screenshots are stable enough for change review.
- Tests:
  - Unit tests for material asset resolution.
  - Integration screenshot tests for gallery scene.
  - Browser smoke test for material browser preview thumbnails.

## Element Coverage Matrix

| Element Kind            | Assignment Target                    | 3D Appearance Target                               | 2D Graphics Target                                | Notes                                                                                         |
| ----------------------- | ------------------------------------ | -------------------------------------------------- | ------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `wall`                  | instance `materialKey` or type layer | exterior/interior faces, cut caps, CSG replacement | surface and cut patterns from instance/type/layer | Needs layered face rules and per-face paint.                                                  |
| `wall_type`             | first layer or selected layer        | layer-driven wall assembly                         | cut hatches per layer                             | Existing layer workbench is starting point.                                                   |
| `floor`                 | `floor_type` layer                   | top/bottom/edge faces                              | cut layer hatch, surface pattern                  | No floor instance `materialKey` currently.                                                    |
| `floor_type`            | layer                                | layer-driven slab                                  | cut hatches per layer                             | Needs top finish vs structure rules.                                                          |
| `roof`                  | instance `materialKey` or type layer | roof top/edge/fascia future                        | surface pattern in plan/elevation                 | Existing roof material render path is partial.                                                |
| `roof_type`             | layer                                | roof assembly                                      | cut hatches per layer                             | Needs top material selection semantics.                                                       |
| `door`                  | instance `materialKey`               | panel/frame; future subcomponent materials         | elevation/schedule color/pattern                  | Family type params may later expose panel/frame separately.                                   |
| `window`                | instance `materialKey`               | frame; glass remains separate category/material    | elevation/schedule                                | Need separate frame/glazing material model eventually.                                        |
| `column`                | instance `materialKey`               | box/cyl/structural material                        | cut/surface pattern                               | Rendering now can consume material key.                                                       |
| `beam`                  | instance `materialKey`               | structural material                                | projection/cut pattern                            | Rendering now can consume material key.                                                       |
| `sweep`                 | instance `materialKey`               | sweep profile material                             | projection pattern if sectioned                   | UV along path is critical.                                                                    |
| `mass`                  | instance `materialKey`               | translucent/concept material                       | simple surface color                              | May intentionally remain conceptual.                                                          |
| `pipe`                  | instance `materialKey`               | pipe material/finish                               | MEP line/category graphics                        | Needs MEP category style coordination.                                                        |
| `toposolid`             | `defaultMaterialKey`                 | terrain/base material                              | surface pattern                                   | Schema uses `defaultMaterialKey`, not `materialKey`.                                          |
| `toposolid_subdivision` | `materialKey`                        | finish region                                      | surface pattern                                   | Good candidate for paving/lawn procedural textures.                                           |
| `room`                  | no render material                   | none                                               | finish sets/color schemes                         | Room finishes should schedule wall/floor/ceiling finishes, not make room a rendered material. |
| `stair`                 | no direct material today             | category/future subcomponent                       | category graphics                                 | Add separate stair component materials later if needed.                                       |
| `railing`               | no direct material today             | category/future rail/baluster materials            | category graphics                                 | Add component materials later if needed.                                                      |

## Sequencing Plan

### Phase 1 — Make Assigned Materials Look Real

Target: 1-2 focused PRs.

1. `WP-MAT-02`: universal material factory with texture/bump loading.
2. `WP-MAT-03`: UV mapping for wall/floor/roof basic faces.
3. `WP-MAT-04`: procedural brick/concrete/timber/tile fallbacks.
4. `WP-MAT-13`: small gallery smoke test proving non-flat materials.

Exit criteria:

- Brick walls show courses and relief in 3D.
- Concrete and timber read differently from color alone.
- Texture scale survives wall rotation.
- No main viewport interaction regression.

### Phase 2 — Make Materials Draft Correctly

Target: after Phase 1 stabilizes.

1. `WP-MAT-05`: graphics asset binding for plan/section.
2. `WP-MAT-08`: layered wall/floor/roof face/cut semantics.
3. `WP-MAT-12`: schedule/export readback for material names and graphics status.

Exit criteria:

- Brick/concrete/timber materials have credible 2D hatches.
- Section output uses material layer patterns.
- Schedules show material display names and layer materials.

### Phase 3 — Make Materials Editable Like Revit

Target: after canonical model is stable enough.

1. `WP-MAT-01`: canonical material asset contract.
2. `WP-MAT-06`: browser/editor tabs.
3. `WP-MAT-07`: previews.
4. `WP-MAT-11`: asset upload/provenance.

Exit criteria:

- User can create a project material, assign it, edit graphics/appearance, and see changes in 2D/3D.
- Built-ins can be duplicated without mutation.
- Texture asset source/provenance is visible.

### Phase 4 — Per-Face Finish Workflows

Target: after layer semantics and UV transforms are mature.

1. `WP-MAT-09`: per-face paint/finish overrides.
2. `WP-MAT-10`: texture alignment tools.
3. Expand QA gallery with painted-face cases.

Exit criteria:

- User can paint one wall face.
- User can align/rotate brick or tile texture on a face.
- Reset returns to type/instance material.

## Definition Of Done For The Whole Program

The material system is considered Revit-like enough for this phase when:

- assigning a material changes more than color for material categories that need it,
- brick/stone/tile/timber/concrete/plaster/metal/glass are visually distinct in realistic 3D,
- material texture scale is controlled in real units,
- normal/bump relief works without changing actual geometry,
- plan and section hatches/patterns come from material graphics assets,
- wall/floor/roof assemblies expose layer materials correctly,
- material browser can edit both graphics and appearance properties,
- schedules and exports resolve display names and do not lose material identity,
- material QA catches flat-color regressions.

## Open Product Questions

1. Should `materialKey` always reference a `MaterialElem.id`, with built-ins injected as virtual material elements, or should registry keys and project element ids remain separate namespaces?
2. Should appearance maps be URL-based initially, asset-id-based only, or both?
3. What is the first curated built-in material set: residential EU basics only, or broader BIM defaults?
4. Should walls default to type-layer material or instance material when both are present? Current behavior favors instance override.
5. Should texture alignment be a face override only, or can users push alignment changes back to the material definition?
6. How much physical/thermal data is needed for MVP: display only, schedules, or analytical calculations?
7. Should realistic mode load full maps while shaded/material mode uses procedural/swatch-only for performance?
