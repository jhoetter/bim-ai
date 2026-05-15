# BIM AI Ray Tracing Rendering Tracker

Last updated: 2026-05-15

Purpose: specify how BIM AI should move from the current ray-trace-style raster fallback to actual ray/path tracing without damaging the interactive modeling viewport.

Related specs:

- [`spec/ux-bim-ai-next-tracker.md`](./ux-bim-ai-next-tracker.md)
- [`spec/material-appearance-system-tracker.md`](./material-appearance-system-tracker.md)
- [`spec/revit-material-parity-tracker.md`](./revit-material-parity-tracker.md)

External references:

- `three-gpu-pathtracer`: https://github.com/gkjohnson/three-gpu-pathtracer
- `three-mesh-bvh`: https://github.com/gkjohnson/three-mesh-bvh
- Three.js path tracer example: https://threejs.org/examples/webgl_renderer_pathtracer.html

## Terminology

- `Realistic`: an interactive raster visual style. It uses Three.js PBR materials, texture maps, tone mapping, environment lighting, SSAO, and shadow maps.
- `Ray trace` today: a high-fidelity raster fallback label. It is not actual path tracing.
- `Path trace preview`: the target real renderer. It progressively accumulates Monte Carlo samples using ray/path tracing and converges toward physically plausible lighting.
- `CPU ray tracing`: possible for still images or server/offline export, but not appropriate as the default browser modeling viewport.
- `GPU path tracing`: the practical client-side path for this app. It runs path tracing shaders through WebGL2 or WebGPU, not through direct browser access to hardware RT cores.

## Current Implementation Inventory

| Area | Current State | Main Files | Impact |
| --- | --- | --- | --- |
| Render loop | One Three.js `WebGLRenderer` with `EffectComposer`, `RenderPass`, `SSAOPass`, `OutlinePass`, and `OutputPass`. | `packages/web/src/Viewport.tsx` | Path tracing must either integrate into this loop or run as a mode-specific renderer beside it. |
| Visual styles | `realistic` and `ray-trace` both restore `MeshStandardMaterial` and enable texture maps. | `packages/web/src/Viewport.tsx`, `packages/web/src/viewport/visualStyleMaterials.ts` | Current `ray-trace` is only a raster style variant. |
| Ray-trace difference today | `ray-trace` switches shadow maps to `THREE.VSMShadowMap`; it does not trace rays. | `packages/web/src/Viewport.tsx` | Rename or clarify before adding real path tracing. |
| Materials | `makeThreeMaterialForKey()` creates `MeshStandardMaterial` / `MeshPhysicalMaterial`, applies albedo/normal/bump/roughness/metalness maps, UV transforms, glass transmission, and procedural maps. | `packages/web/src/viewport/threeMaterialFactory.ts` | Good base for path tracing, but compatibility must be validated against the chosen path tracer material model. |
| Material specs | Material registry includes base color, roughness, metalness, texture map URLs, bump/normal maps, physical/thermal metadata, and lighting tokens. | `packages/web/src/viewport/materials.ts` | Enough to produce visible benefit from path tracing. |
| Geometry | Model geometry is already Three.js meshes; CSG walls are generated into `BufferGeometry`. | `packages/web/src/Viewport.tsx`, `packages/web/src/viewport/meshBuilders.ts`, `packages/web/src/viewport/csgWorker.ts` | Path tracer can consume scene meshes after filtering overlays/non-renderable helpers. |
| Overlays | Selection outlines, grids, plan overlays, view cube, handles, clipping caps, and helper geometry share the same scene/render pass. | `packages/web/src/Viewport.tsx` | Must be excluded from path tracing or composited as raster overlays. |

## Product Decision

Do not make real path tracing the normal authoring viewport.

The target UX should be:

1. `Realistic`: fast interactive PBR raster mode for modeling and review.
2. `High fidelity`: rename the current `Ray trace` raster fallback unless it is replaced immediately.
3. `Path trace preview`: a separate still/progressive preview mode for presentation-quality review.

The path trace preview should feel like a render preview, not like a drafting/editing mode. The user should be able to orbit, pan, change materials, and section the model, but the image should reset and progressively refine after each change.

## GPU vs CPU Decision

Client-side real-time or near-real-time path tracing needs GPU execution.

Use a GPU path tracing library for the browser path:

- `three-gpu-pathtracer` is built for Three.js, uses `three-mesh-bvh`, and runs through WebGL2.
- It supports physically based materials, material information, textures, normal maps, emission, environment maps, tiled rendering, sample accumulation, and progressive rendering.
- It exposes `WebGLPathTracer`, `setScene()`, `setSceneAsync()`, `updateCamera()`, `updateMaterials()`, `updateEnvironment()`, `updateLights()`, `renderSample()`, `reset()`, and sample counters.

CPU is still possible, but it should be treated as a separate offline/export path:

- Browser JavaScript CPU path tracing is not acceptable for BIM-size scenes except as a diagnostic toy. It will be slow, battery-heavy, and hard to keep responsive.
- Server-side CPU rendering is viable for still exports using a native renderer or headless pipeline, but that is a backend feature with queueing, asset packaging, and result storage.
- CPU can help client-side by building BVHs in a worker, preparing scene data, and running validation, but final sample rendering should be GPU for the browser feature.

Dedicated hardware RT cores are not a requirement for the browser implementation. WebGL2 path tracers run shader code on the GPU and use BVHs/textures to represent acceleration structures. WebGPU may become the better long-term path, but WebGL2 is the pragmatic near-term target because the current viewport is already WebGL-based.

Path tracing must not become a hardware requirement for using BIM AI. Older laptops, weaker integrated GPUs, remote desktop sessions, and mobile devices should keep the raster `Realistic` / `High fidelity` paths as the reliable baseline. Better GPUs should make path trace preview faster and cleaner, but weaker hardware should receive clear capability messaging and fallbacks rather than a broken or unusable viewport.

## Target Architecture

Introduce a path tracing subsystem beside the existing raster renderer:

```text
Viewport.tsx
  |-- RasterRendererController
  |   |-- WebGLRenderer
  |   |-- EffectComposer
  |   |-- SSAOPass / OutlinePass / OutputPass
  |   `-- interactive overlays
  `-- PathTracePreviewController
      |-- WebGLPathTracer
      |-- filtered render scene
      |-- path-trace material compatibility adapter
      |-- progressive sample state
      `-- raster overlay composite
```

The path tracer should not own BIM state. It should consume a filtered Three.js scene derived from the live viewport scene and reset when the live scene changes.

## Render Mode Behavior

### Entering Path Trace Preview

- Detect support: WebGL2, float textures/render targets as required by the library, acceptable device memory/performance hints where available.
- If unsupported, disable the mode and show the current raster high-fidelity fallback.
- Hide or exclude helper objects from the traced scene:
  - grid,
  - selection outlines,
  - hover outlines,
  - transform/direct-authoring handles,
  - view cube,
  - labels/readouts,
  - crop/section widgets,
  - plan overlay guides,
  - non-physical markers.
- Keep a raster overlay pass for selection, view cube, labels, and controls.
- Call `setSceneAsync()` where possible so BVH/scene preparation can report progress without freezing the viewport.
- Start with low sample count and progressive refinement.

### While Camera Is Moving

- Pause high-quality accumulation.
- Either show the raster renderer, a low-resolution path trace pass, or the last converged image with a visible "updating" state.
- On camera settle:
  - call `updateCamera()`,
  - call `reset()`,
  - resume `renderSample()` until target samples are reached.

### While Model Or Materials Change

- For camera-only changes, call `updateCamera()` then `reset()`.
- For material property changes, call `updateMaterials()` then `reset()`.
- For environment/background changes, call `updateEnvironment()` then `reset()`.
- For light changes, call `updateLights()` then `reset()`.
- For geometry changes, rebuild the path trace scene with `setScene()` / `setSceneAsync()` because geometry/BVH changes are expensive.

### Leaving Path Trace Preview

- Dispose path tracer buffers and temporary scene clones.
- Restore normal raster composer rendering.
- Preserve user GDO settings.

## Scene Filtering Rules

Path tracing should operate only on physical model geometry.

Include:

- walls, floors, roofs, slabs, stairs, railings,
- doors/windows/framing/glazing,
- massing/site geometry when visible,
- furniture/family instances if represented by real meshes,
- clipping caps only if they are intended to appear as cut material surfaces.

Exclude:

- grids and axes,
- selection/hover/outline meshes,
- line-only helpers and witness graphics,
- direct authoring grips/handles,
- invisible hit targets,
- room labels and annotations,
- debug geometry,
- view cube and HUD geometry.

Implementation requirement: add a stable `userData.renderRole` or equivalent enum instead of relying on fragile name/class heuristics.

Proposed roles:

- `model`
- `materializedCutSurface`
- `helper`
- `overlay`
- `hitTarget`
- `annotation`
- `debug`

Only `model` and explicitly allowed `materializedCutSurface` should enter the traced scene.

## Material Mapping

Reuse `makeThreeMaterialForKey()` as the primary material source, then add a path-trace compatibility adapter.

Required material support:

- base color / albedo texture,
- roughness,
- metalness,
- normal maps,
- bump maps where supported or converted,
- roughness maps,
- metalness maps,
- opacity/alpha for cutouts where needed,
- glass with transmission/IOR/thickness approximations,
- emission for light-emitting materials later.

Constraints:

- Transparent glass may need renderer-specific settings. Confirm whether current `MeshPhysicalMaterial` transmission behavior maps directly.
- `envMapIntensity` and raster-only tuning may not produce the same result in path tracing. Path trace preview should favor physically meaningful lights and environment strength over raster compensation values.
- Procedural texture canvases must be converted to supported textures before scene upload.
- Texture size packing can create memory pressure. Start with a conservative texture atlas size and expose a quality setting later.

## Lighting Model

Near-term:

- Use the current directional sun plus environment map as the first lighting model.
- Map the existing sun azimuth/elevation/intensity into path tracer lights.
- Use environment lighting for sky contribution.
- Keep exposure controls shared with realistic mode.

Mid-term:

- Add rectangular/area light support for interior rendering.
- Add per-light physical units if the project introduces lighting fixtures.
- Support IES profiles only after core path trace preview is stable.

Do not treat SSAO as part of the path traced image. SSAO is a raster approximation and should be disabled for the traced base image.

## Clipping And Section Boxes

This is one of the highest-risk areas.

Options:

1. Geometry bake: create temporary clipped geometries and caps before passing the scene to the path tracer.
2. Shader clipping: rely on clipping plane support if the chosen path tracer can honor it.
3. MVP limitation: disable path trace preview when active section boxes are present, then add geometry baking later.

Recommendation:

- MVP should support no clipping or simple section-box disabled fallback.
- Production path should use geometry bake so cut faces are physically present and can receive material/cut-surface appearances.

## Performance Strategy

Initial defaults:

- render scale: `0.5` to `0.75` on first release,
- target samples: `64` for interactive preview, `256` for still preview,
- bounces: `4` to `6` for BIM interiors/exteriors,
- tiles enabled for responsiveness,
- dynamic low-res preview enabled if supported,
- reset accumulation on every camera/model/material/environment change.

Performance guardrails:

- cap path trace mode by triangle count and texture count at MVP,
- show preparation progress during BVH/scene build,
- add cancellation if user leaves mode mid-build,
- avoid rebuilding the tracer for camera-only changes,
- debounce material/model rebuilds during active authoring,
- prefer worker-backed async scene preparation.

## Capability Detection And User Warnings

Path trace preview should be capability-gated before the user enters the mode.

Detection inputs:

- WebGL2 availability and required extensions for float/half-float render targets,
- maximum texture size and render target constraints,
- renderer/vendor strings where available through WebGL debug info, treated as hints only,
- browser and platform constraints where known,
- `navigator.deviceMemory`, `hardwareConcurrency`, and mobile/touch heuristics where available,
- measured startup benchmark: compile tracer, build a tiny BVH, render a small number of samples, and record time,
- scene complexity: triangle count, material count, texture count, estimated texture memory, and active clipping state.

Detection outputs:

- `supported`: path tracing can run with current scene and device.
- `degraded`: path tracing can run, but should start at lower render scale/sample count and show a warning.
- `unsupported`: hide or disable path trace preview and route the user to raster high-fidelity mode or a backend render job.
- `unknown`: allow a guarded trial with conservative defaults and visible cancel/fallback.

Warnings should be specific and actionable:

- "Path trace preview may be slow on this device. Starting in low-resolution preview."
- "This scene exceeds the browser path trace preview budget. Use high-fidelity raster mode or a backend render job."
- "Path trace preview is unavailable in this browser/GPU configuration."
- "Section boxes are active; path trace preview is disabled until clipped-geometry rendering is available."

Do not rely on a brittle allowlist of laptop models. Hardware names can be used for diagnostics, but the product decision should come from feature checks plus measured performance. Capability results should be stored only as local runtime hints and invalidated when the browser, GPU, driver, or app version changes.

If backend rendering exists, weak browser capability should not be treated as a dead end. In local development or single-user deployments, that backend can literally be the same MacBook running the API process. The UI should offer a backend render action for still images while keeping the local raster viewport fully usable.

Important quality note: browser path tracing without denoising can remain visibly noisy even at 1024+ samples, especially on large flat walls, roofs, dark interiors, and high-frequency procedural textures. Higher samples reduce Monte Carlo noise, but they do not replace denoising or a final-render pipeline. Product copy should call the WebGL path tracer a preview until a denoised backend/native render path exists.

## State And UI Contract

Add a new render style instead of overloading the current value:

```ts
export type ViewerRenderStyle =
  | 'shaded'
  | 'wireframe'
  | 'consistent-colors'
  | 'hidden-line'
  | 'realistic'
  | 'high-fidelity'
  | 'path-trace-preview';
```

Migration:

- Keep reading persisted `ray-trace` as `high-fidelity`.
- Do not persist unsupported `path-trace-preview` on devices that fail capability checks.

UI requirements:

- Label the real mode `Path trace`.
- Show sample count / target samples while refining.
- Show a capability message when unsupported.
- Show a performance warning before entering degraded local path tracing.
- Show "preview pauses while editing" behavior, not an error.
- Keep the existing GDO panel controls for exposure and background.
- Add quality presets only after MVP:
  - `Draft`: low render scale, low samples.
  - `Review`: medium render scale/samples.
  - `Export`: high samples for still capture.

## Workpackages

### WP-RT-01 - Naming And Capability Cleanup

- Priority: `P0`
- Status: `Done`
- Goal: stop calling the current raster fallback real ray tracing.
- Source ownership:
  - `packages/web/src/state/storeTypes.ts`
  - `packages/web/src/Viewport.tsx`
  - `packages/web/src/workspace/viewport/Viewport3DLayersPanel.tsx`
- Implementation:
  - Rename persisted-visible `ray-trace` label to `High fidelity` or `Preview`.
  - Keep backward compatibility for stored `ray-trace` values.
  - Update fidelity note to say it is raster/PBR, not path tracing.
- Acceptance:
  - Existing saved views using `ray-trace` still load.
  - UI no longer implies actual ray tracing for the fallback mode.

Evidence (2026-05-15):

- Added `high-fidelity` and `path-trace-preview` render styles while keeping legacy `ray-trace` normalized to `high-fidelity`.
- Updated the graphics panel labels and notes so only `Path trace` describes real progressive ray/path sampling.
- Added render-style helper tests.

### WP-RT-02 - Path Tracer Feasibility Spike

- Priority: `P0`
- Status: `Done`
- Goal: prove `three-gpu-pathtracer` can render a filtered BIM scene from the current viewport.
- Source ownership:
  - new `packages/web/src/viewport/pathTracing/*`
  - `packages/web/src/Viewport.tsx`
- Implementation:
  - Add dependency on `three-gpu-pathtracer`.
  - Build `PathTracePreviewController`.
  - Render a small seeded house scene with walls, floors, roof, glass, and one procedural material.
  - Use current perspective camera and environment.
  - Track samples and reset on camera movement.
  - Add the first capability probe for WebGL2/support extension checks and a tiny startup benchmark.
- Acceptance:
  - A seeded model renders with progressive accumulation.
  - Camera changes reset and resume accumulation.
  - Materials are recognizable against realistic raster mode.
  - Unsupported WebGL2/device path falls back cleanly.
  - Weak or uncertain hardware enters a guarded low-resolution path rather than the full-quality path.

Evidence (2026-05-15):

- Added `three-gpu-pathtracer@0.0.23` and `xatlas-web`, loaded by dynamic import when path trace preview is entered.
- Added `PathTracePreviewController` with async scene preparation, progressive `renderSample()` accumulation, camera reset handling, sample targets, and status callbacks.
- Integrated path trace rendering into the existing `Viewport.tsx` render loop with raster fallback for unsupported/error states.
- Verified with `pnpm --filter @bim-ai/web typecheck`, focused Vitest coverage, and `pnpm --filter @bim-ai/web build`.

### WP-RT-02A - Local Capability Gate And Warnings

- Priority: `P0`
- Status: `Done`
- Goal: make path tracing optional and hardware-aware so older machines remain first-class users of the app.
- Source ownership:
  - new `packages/web/src/viewport/pathTracing/capabilities.ts`
  - `packages/web/src/workspace/viewport/Viewport3DLayersPanel.tsx`
  - viewport HUD/status area.
- Implementation:
  - Create `detectPathTraceCapability(sceneStats)` returning `supported`, `degraded`, `unsupported`, or `unknown`.
  - Include WebGL2/extension checks, texture/render target limits, coarse device hints, measured startup timing, and current scene complexity.
  - Add warning copy for degraded and unsupported states.
  - Add a user-visible route to backend render when local path tracing is unsupported and backend rendering is available.
  - Cache capability results locally with version invalidation.
- Acceptance:
  - Path trace preview is not offered as a hard requirement for using 3D.
  - Older/weak devices fall back to raster modes with clear explanation.
  - Degraded devices use conservative render scale/sample defaults.
  - Capability checks are testable without depending on exact GPU model names.

Evidence (2026-05-15):

- Added `detectPathTraceCapability()` and `collectPathTraceSceneStats()` with WebGL2/float render target checks, scene complexity limits, mobile/low-memory/low-core degraded defaults, clipping fallback, and user-facing reasons.
- Added viewport status HUD for unsupported, degraded, preparing, rendering, and complete states.
- Added capability tests that do not depend on specific GPU model names.

### WP-RT-03 - Scene Role Tagging

- Priority: `P0`
- Status: `Done`
- Goal: make renderer inclusion/exclusion explicit.
- Source ownership:
  - mesh builders,
  - overlay builders,
  - `Viewport.tsx`,
  - path tracing scene filter.
- Implementation:
  - Add a typed `RenderRole`.
  - Tag model meshes and helper/overlay meshes at creation time.
  - Add a filter that clones or references only traceable model geometry.
- Acceptance:
  - Grid, handles, labels, hit targets, view cube, and selection outlines do not appear in path traced output.
  - Physical model geometry still appears.
  - Tests cover role filtering.

Evidence (2026-05-15):

- Added render-role tagging for physical model geometry, CSG wall meshes, helpers, transient previews, section cage helpers, and overlay sprites.
- Added `buildPathTraceScene()` to construct a filtered scene from traceable roles only.
- Added scene-filter tests covering model inclusion, helper exclusion, and cut-surface material normalization.

### WP-RT-04 - Material Compatibility Layer

- Priority: `P1`
- Status: `In Progress`
- Goal: preserve BIM material identity in path tracing.
- Source ownership:
  - `packages/web/src/viewport/threeMaterialFactory.ts`
  - new path tracing material adapter.
- Implementation:
  - Audit which `MeshStandardMaterial` / `MeshPhysicalMaterial` fields the chosen path tracer consumes.
  - Normalize unsupported fields before scene upload.
  - Add glass fallback rules.
  - Add texture size and map-kind limits.
- Acceptance:
  - Brick/concrete/timber/metal/glass remain visually distinct.
  - Glass is transparent/refractive or has a documented MVP approximation.
  - Procedural material maps survive scene upload.

Evidence (2026-05-15):

- Path trace scene upload preserves existing `MeshStandardMaterial` and `MeshPhysicalMaterial` instances from the material factory.
- Unsupported non-PBR helper/basic materials are normalized to `MeshStandardMaterial` only when explicitly included.
- Remaining risk: glass/transmission fidelity and procedural map behavior need browser visual QA on representative models.

### WP-RT-05 - Progressive Rendering UX

- Priority: `P1`
- Status: `Done`
- Goal: make path tracing understandable and controllable.
- Source ownership:
  - `Viewport3DLayersPanel.tsx`
  - viewport bottom bar / HUD area,
  - `Viewport.tsx`
- Implementation:
  - Add sample progress readout.
  - Add `Pause`, `Resume`, and `Restart` actions if needed.
  - Add quality presets after the feasibility spike.
  - Use raster mode during active camera movement if path tracing is too noisy.
- Acceptance:
  - User can tell whether the image is refining, paused, or unsupported.
  - Interactions do not feel broken while accumulation resets.

Evidence (2026-05-15):

- Added viewport HUD with phase, message, sample count, target samples, and progress bar.
- Accumulation resets automatically when camera matrices change.
- Degraded/unsupported capability messages are visible in the viewport.

### WP-RT-06 - Clipping, Sections, And Cut Materials

- Priority: `P1`
- Status: `In Progress`
- Goal: handle section boxes and cut planes correctly.
- Source ownership:
  - clipping plane code,
  - CSG/cap generation,
  - path tracing scene filter.
- Implementation:
  - Decide MVP fallback for active clipping.
  - Build temporary clipped geometry and caps for production path.
  - Apply cut-surface material appearance.
- Acceptance:
  - Sectioned models render without leaking hidden geometry.
  - Cut faces are visible and use credible material colors/pattern approximations.

Evidence (2026-05-15):

- MVP fallback implemented: active section/clipping state marks local path tracing unsupported and keeps raster rendering available.
- Geometry-baked cut faces remain open for production-quality sectioned path tracing.

### WP-RT-07 - Still Export Path

- Priority: `P2`
- Status: `Open`
- Goal: provide presentation stills from path tracing.
- Source ownership:
  - viewport export command,
  - path trace controller,
  - file/export UI.
- Implementation:
  - Add high-sample still export.
  - Allow the render to continue until target samples or user cancellation.
  - Save image with metadata: samples, bounces, exposure, render style, model revision.
- Acceptance:
  - Exported still is higher quality than screen preview.
  - Export metadata is deterministic enough for support/debugging.

### WP-RT-08 - Optional Backend Render Job

- Priority: `P3`
- Status: `Partially implemented`
- Goal: support offline CPU/GPU rendering outside the browser if needed. In a local setup, "backend" may be the user's own MacBook running the BIM AI API process; in hosted deployments it may be a remote GPU worker.
- Source ownership:
  - backend export/render service,
  - asset packaging,
  - job queue/storage.
- Implementation:
  - Implemented local API render endpoint: `POST /api/models/{modelId}/renders/backend-raytrace.png`.
  - The endpoint exports the current BIM document to GLB, invokes Blender/Cycles headlessly, enables denoising, prefers GPU devices such as Metal/OptiX/CUDA/HIP/oneAPI when Blender exposes them, and falls back to Cycles CPU rendering inside Blender.
  - The viewport sends the current orbit camera pose and opens the returned PNG as a high-sample still render.
  - Capability probe: `GET /api/renderers/backend-raytrace/capabilities` reports whether Blender is available. Local development can point at a custom Blender binary with `BIM_AI_BLENDER_PATH`.
  - Remaining work: replace the synchronous endpoint with persistent queued jobs, progress streaming, cancellation, output storage, and retained logs.
- Acceptance:
  - Browser can request a high-quality backend still render from path trace preview mode.
  - Response headers include renderer, device, sample count, and output size.
  - Local backend jobs make it clear that they use the user's machine and may consume CPU/GPU for minutes.

## Open Decisions

| ID | Decision | Owner | Notes |
| --- | --- | --- | --- |
| RT-DEC-001 | Should MVP allow path tracing with active section boxes, or disable it until geometry bake exists? | Product + Rendering | Disabling is safer for first release. |
| RT-DEC-002 | Is `three-gpu-pathtracer` acceptable as an added dependency? | Engineering | Needs bundle/performance/license review. |
| RT-DEC-003 | Should path trace preview use the same canvas or an overlaid canvas? | Engineering | Same renderer is simpler; overlay can isolate raster HUD. |
| RT-DEC-004 | What target sample counts should ship for draft/review/export? | Product + Rendering | Start conservative and tune with seeded models. |
| RT-DEC-005 | Is backend CPU/GPU rendering in scope, or is client GPU preview enough? | Product | CPU/GPU backend path is separate from interactive viewport work. |
| RT-DEC-006 | Should weak local devices show backend render as the primary path trace action? | Product | Keeps older laptops viable without hiding the feature entirely. Local backend can be the user's own MacBook. |
| RT-DEC-007 | What measured startup/render threshold separates `degraded` from `unsupported`? | Rendering | Must be tuned with seeded models and representative older hardware. |

## Acceptance For "Actual Ray Tracing"

The feature can be called actual ray/path tracing only when:

- rays/path samples are progressively accumulated,
- direct and indirect lighting contribute to the image,
- shadows are traced rather than only shadow-mapped,
- material roughness/metalness/glass meaningfully affect traced light transport,
- sample count and convergence are visible or inspectable,
- the code path uses a path tracing renderer, not only raster PBR + SSAO + shadow maps.

Until then, the UI must avoid the plain `Ray trace` label for the current fallback.
