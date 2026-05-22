# Hunyuan3D Asset Generation Integration Spec

Status: research/spec only. No implementation yet.

## Goal

Prototype image-to-3D asset generation for furniture and generic interior objects, then define a path to production if the generated assets are useful in product.

The first product value is visual placement: a user uploads a source image of a chair, sofa, table, lamp, appliance, etc.; the system generates a GLB; the user reviews it; then the asset can be placed from the asset library in plan and 3D views.

This should not initially be treated as BIM-family generation. Hunyuan3D outputs visual meshes, not manufacturer-verified parametric BIM components.

## References

- Hugging Face Space: https://huggingface.co/spaces/tencent/Hunyuan3D-2
- Space API helper: https://huggingface.co/spaces/tencent/Hunyuan3D-2/agents.md
- Space API schema: https://tencent-hunyuan3d-2.hf.space/gradio_api/info
- Space config: https://tencent-hunyuan3d-2.hf.space/config
- Hunyuan3D GitHub: https://github.com/Tencent-Hunyuan/Hunyuan3D-2
- Hunyuan3D license: https://raw.githubusercontent.com/Tencent-Hunyuan/Hunyuan3D-2/main/LICENSE
- Hugging Face Spaces API docs: https://huggingface.co/docs/hub/en/spaces-api-endpoints
- Gradio ZeroGPU rate-limit docs: https://www.gradio.app/docs/python-client/using-zero-gpu-spaces

## Current Product Fit

Current asset-library model:

- `packages/core/src/index.ts` defines `AssetLibraryEntry` and `PlacedAssetElem`.
- `AssetLibraryEntry` is metadata oriented: category, tags, thumbnail kind, schematic dimensions, plan symbol, render proxy, params.
- `PlacedAssetElem` references `assetId`, `levelId`, position, rotation, optional params, and optional host.
- `packages/web/src/viewport/placedAssetRendering.ts` renders placed assets as procedural proxy meshes.
- There is no first-class mesh asset URL/blob/digest field in the core asset-library types yet.

Implication:

- Prototype can store generated GLBs outside the document model and manually associate them with a library entry.
- Product integration needs a small schema extension so assets can reference generated mesh binaries and previews.

## Integration Modes

### Mode A: Public Hugging Face Space Prototype

Use the existing public Space through Gradio.

Pros:

- Fastest proof of concept.
- No GPU setup.
- Lets us evaluate output quality and UX before changing infrastructure.

Cons:

- Public Space may be rate-limited, queued, changed, unavailable, or texture-disabled.
- User/customer images leave our environment.
- Not suitable for production privacy, reliability, or licensing control.
- ZeroGPU Spaces are rate-limited and need careful queue handling.

Use only with non-sensitive test images.

### Mode B: Duplicated Private Hugging Face Space

Duplicate the Space into our Hugging Face org, configure secrets and GPU hardware, and call that Space from our backend.

Pros:

- Better control over runtime, version, visibility, and secrets.
- Still easier than self-hosting.
- Good pilot path if prototype works.

Cons:

- Still depends on Hugging Face Space runtime semantics.
- GPU cost and cold starts need management.
- License/privacy still need review.

### Mode C: Self-hosted Hunyuan3D API Server

Run Tencent's `api_server.py` or a forked service on our own GPU infrastructure.

Pros:

- Best production control.
- Stable API contract.
- Easier to isolate customer data.
- Allows version pinning, observability, job queues, and storage integration.

Cons:

- Requires GPU operations.
- Requires model dependency maintenance.
- Texture generation and mesh processing can add operational complexity.

## Prototype Scope

The prototype should answer:

1. Can a user upload a furniture/product image and get a plausible GLB?
2. Is latency acceptable for an async job flow?
3. Are generated meshes usable in our Three.js viewport after normalization?
4. Can we derive bounding dimensions and metadata for placement?
5. Does generated asset quality justify production investment?

Out of scope for the prototype:

- Parametric family creation.
- IFC/Revit family export.
- Manufacturer accuracy.
- Automatic code changes to schedules/specifications.
- Full production storage, auth, billing, or admin workflows.

## Prototype User Flow

1. User opens an internal "Generate asset" prototype tool.
2. User uploads an image and selects category, for example `furniture`, `kitchen`, `bathroom`, or `casework`.
3. Backend starts an async generation job.
4. Backend calls Hunyuan3D.
5. Backend downloads the returned GLB.
6. Backend post-processes the GLB:
   - validate file type and size
   - compute bounding box
   - normalize origin to floor-center or object-center
   - normalize units to meters/mm
   - optionally simplify mesh
   - generate thumbnail
   - compute SHA-256 digest
7. User reviews generated asset in a preview.
8. User accepts it into the asset library.
9. User places it in plan/3D through the existing asset placement flow.

## Public Space API Details

The Space exposes a Gradio endpoint named `/shape_generation`.

Observed parameters:

- `caption`: optional text prompt
- `image`: uploaded image file data
- `mv_image_front`: optional multiview input
- `mv_image_back`: optional multiview input
- `mv_image_left`: optional multiview input
- `mv_image_right`: optional multiview input
- `steps`: default observed as 30
- `guidance_scale`: default observed as 5.0
- `seed`: default observed as 1234
- `octree_resolution`: default observed as 256
- `check_box_rembg`: remove background, default observed as true
- `num_chunks`: default observed as 8000
- `randomize_seed`: default observed as true

Observed returns:

- generated mesh file
- output viewer HTML
- mesh stats JSON
- resolved seed

Recommended prototype call path:

```python
from gradio_client import Client, handle_file

client = Client("tencent/Hunyuan3D-2", token=HF_TOKEN)
job = client.submit(
    caption=None,
    image=handle_file("chair.png"),
    mv_image_front=None,
    mv_image_back=None,
    mv_image_left=None,
    mv_image_right=None,
    steps=30,
    guidance_scale=5.0,
    seed=1234,
    octree_resolution=256,
    check_box_rembg=True,
    num_chunks=8000,
    randomize_seed=False,
    api_name="/shape_generation",
)
result = job.result()
```

Lower-level HTTP flow from `agents.md`:

1. Read API schema:
   - `GET https://tencent-hunyuan3d-2.hf.space/gradio_api/info`
2. Read config and find `fn_index`:
   - `GET https://tencent-hunyuan3d-2.hf.space/config`
   - find the dependency whose `api_name` matches `/shape_generation`
3. Upload input file:
   - `POST https://tencent-hunyuan3d-2.hf.space/gradio_api/upload`
   - multipart form: `files=@file.ext`
   - use returned path as `{"path": "<returned-path>", "meta": {"_type": "gradio.FileData"}, "orig_name": "file.ext"}`
4. Join queue:
   - `POST https://tencent-hunyuan3d-2.hf.space/gradio_api/queue/join`
   - body: `{"data": [...], "fn_index": <fn_index>, "session_hash": "<random-uuid>"}`
5. Stream queue events:
   - `GET https://tencent-hunyuan3d-2.hf.space/gradio_api/queue/data?session_hash=<same-uuid>`
6. Fetch returned file URL/path from the completed event.

Authentication:

- Use `Authorization: Bearer $HF_TOKEN`.
- The token should only live server-side.

## Local/Self-Hosted API Details

Tencent's repo includes an API server. The documented local command is:

```bash
python api_server.py --host 0.0.0.0 --port 8080
```

The documented image-to-3D request shape is a base64 image POST to `/generate`, returning a GLB:

```bash
img_b64_str=$(base64 -i assets/demo.png)
curl -X POST "http://localhost:8080/generate" \
  -H "Content-Type: application/json" \
  -d '{"image": "'"$img_b64_str"'"}' \
  -o asset.glb
```

The server supports options in code such as:

- `seed`
- `octree_resolution`
- `num_inference_steps`
- `guidance_scale`
- `texture`
- `face_count`
- `type`

This is the preferred production direction if legal and product validation pass.

## Data Model Additions

Add a generated mesh descriptor to `AssetLibraryEntry` or as a linked asset record.

Proposed shape:

```ts
export type GeneratedMeshAsset = {
  provider: 'hunyuan3d';
  providerModel: string;
  sourceImageAssetId?: string;
  meshUrl: string;
  meshFormat: 'glb' | 'gltf' | 'obj' | 'ply' | 'stl';
  previewImageUrl?: string;
  sha256: string;
  fileSizeBytes: number;
  vertexCount?: number;
  faceCount?: number;
  bboxMm: { widthMm: number; depthMm: number; heightMm: number };
  unitScaleToMeters: number;
  originPolicy: 'floor_center' | 'object_center' | 'raw';
  generationParams: {
    seed?: number;
    steps?: number;
    guidanceScale?: number;
    octreeResolution?: number;
    removeBackground?: boolean;
  };
  status: 'generated' | 'approved' | 'rejected' | 'archived';
  createdAt: string;
};
```

For product quality, generated meshes should be immutable by digest. If a user edits or regenerates, create a new version instead of mutating the old file.

## Backend Components

Prototype:

- `POST /api/assets/generation-jobs`
  - accepts image upload or image asset id, category, optional name/tags
  - creates a generation job
- background worker
  - calls Hunyuan3D
  - downloads GLB
  - post-processes
  - stores artifacts
- `GET /api/assets/generation-jobs/:id`
  - returns status, progress, errors, preview URL, mesh metadata
- `POST /api/assets/generation-jobs/:id/accept`
  - creates an `IndexAsset` entry or future asset-library record

Production:

- durable queue with retry/backoff
- object storage for source images, GLBs, thumbnails, logs
- model-provider abstraction
- quota/rate limiting per org/user
- audit log for generated content
- admin controls for provider/runtime selection

## Frontend Components

Prototype UI:

- Add a hidden/internal "Generate asset" entry point in asset library.
- Upload image.
- Select category and name.
- Show async job state.
- Show generated 3D preview and thumbnail.
- Accept/reject.
- On accept, show in library.

3D viewport change:

- Add GLB loading for accepted generated assets.
- Fallback to existing procedural proxy if mesh fails to load.
- Use generated `bboxMm` for plan footprint and placement grips.

Plan view:

- Continue using existing schematic symbols at first.
- Use `thumbnailWidthMm` and `thumbnailHeightMm` from generated bounding box.
- Later, optional 2D silhouette extraction from mesh top-down projection.

## Post-Processing Requirements

Minimum prototype processing:

- GLB validation with a size limit.
- Bounding box extraction.
- Unit normalization.
- Recenter origin.
- Ground object on Z=0.
- Thumbnail render.
- Mesh stats extraction.
- SHA-256 digest.

Recommended production processing:

- mesh simplification / LOD generation
- Draco or meshopt compression
- texture size caps
- material cleanup
- normals/tangents validation
- malicious-file checks
- timeout and memory guardrails
- visual QA thumbnails from multiple angles

## Privacy And Security

Prototype rules:

- Use non-sensitive images only.
- Do not send customer project data to the public Space.
- Store HF token server-side only.
- Keep generated files in a temporary prototype bucket or local artifact folder.

Production rules:

- Use private/self-hosted inference.
- Define retention for source images and generated outputs.
- Add org-level audit logs.
- Add content scanning and file validation.
- Add DPA/vendor review if any third-party hosted inference remains in path.

## Licensing And Legal Review

This is a gating item before customer-facing production use.

The Hunyuan3D 2.0 license observed in the upstream repo says:

- The license territory excludes the EU, UK, and South Korea.
- Outputs by themselves are not deemed model derivatives.
- Tencent claims no rights in outputs, conditioned on license compliance.
- There are additional commercial terms for products over a monthly active user threshold.
- Use must comply with acceptable-use restrictions.

Because this repo/user context is in Europe/Berlin and the product may serve EU users, legal review is required before any commercial or customer-facing deployment.

## Prototype Milestones

### P0: Spike

- Use a local Python script with `gradio_client`.
- Input: a local test PNG/JPG.
- Output: downloaded GLB and stats.
- Record latency, queue behavior, file size, face count, and visual quality.

Acceptance:

- At least 5 furniture-like test images produce downloadable GLBs.
- At least 3 are visually useful enough to preview in a 3D viewer.

### P1: Backend Job Prototype

- Add server-side generation job endpoint.
- Store generated GLB and metadata in a prototype artifact location.
- No schema migration required if this remains a prototype-only artifact.

Acceptance:

- Upload image through backend.
- Poll job until complete.
- Download generated GLB from our backend.

### P2: Asset Library Prototype

- Add minimal mesh metadata to a generated asset entry or sidecar registry.
- Show generated asset in asset library.
- Place generated asset with existing `PlaceAsset`.
- Load GLB in 3D when available; fallback to proxy rendering.

Acceptance:

- Accepted generated asset appears in library.
- User can place it on a level.
- Plan footprint is dimensionally plausible.
- 3D view renders the generated GLB.

### P3: Production Readiness Decision

- Evaluate legal result.
- Evaluate cost/latency/reliability.
- Decide between private HF Space and self-hosted API.
- Define quota, storage retention, and admin controls.

## Production Migration Plan

If prototype works:

1. Freeze provider contract behind `AssetGenerationProvider`.
2. Move from public Space to duplicated private Space or self-hosted API.
3. Add durable job queue and object storage.
4. Add schema migration for generated mesh assets.
5. Add GLB loader with cache and fallback.
6. Add review/approval state to asset library.
7. Add org/user quotas and observability.
8. Add legal/compliance gates before customer release.
9. Add test suite:
   - provider adapter unit tests
   - job lifecycle tests
   - schema validation tests
   - GLB metadata extraction tests
   - viewport fallback/render tests

## Open Questions

- Is our first target internal demos only, beta customers, or general users?
- Are generated assets stored per project, per org library, or global curated library?
- Do we need textured output for MVP, or is geometry-only enough?
- Should source images be retained after generation?
- What max file size and max triangle count should the viewer support?
- Should accepted generated assets be shareable across projects?
- Do we need vendor-specific disclaimers in the UI?

## Recommended Next Step

Build P0 as a small local/backend-only spike with non-sensitive test images. Do not touch the main workspace UI until we have concrete GLB quality, latency, and licensing signal.
