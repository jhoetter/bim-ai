# Wave 15 — WP-F: Decal Image File Picker + Texture Rendering (§8.1.5)

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).
This prompt is self-contained — start here.

---

## Repo orientation

```
packages/core/src/index.ts                              — DecalElem type (look for kind: 'decal')
packages/web/src/viewport/meshBuilders.ts               — buildDecalMesh (~line 3757)
packages/web/src/workspace/inspector/InspectorContent.tsx — inspector panels (find decal section)
packages/web/src/plan/toolGrammar.ts                    — DecalState / reduceDecal grammar
packages/web/src/plan/PlanCanvas.tsx                    — 'decal' tool case
```

Tests: run `pnpm test --filter @bim-ai/web`.
Prettier runs automatically. **Always `git pull --rebase origin main` before pushing.**

---

## What already exists — read these first

1. **`core/index.ts`**: find `DecalElem` (kind: `'decal'`). It likely has fields: `imageAssetId`, `uvRect`, `positionMm`, `normalVec`, `imageSrc`, `widthMm`, `heightMm`, `parentSurface`, `opacity`. Read the EXACT fields before writing anything.
2. **`meshBuilders.ts`**: `buildDecalMesh` at ~line 3757. Read it fully:
   - It uses `imageAssetsById[decal.imageAssetId]` to get the URL. If `imageSrc` already exists on the element, use that directly.
   - It builds a `PlaneGeometry` and applies a `THREE.MeshBasicMaterial` with a `THREE.TextureLoader` texture.
   - If the texture is missing (no URL), it currently renders a fallback.
3. **`InspectorContent.tsx`**: find the `kind === 'decal'` section. If it is absent or minimal, add the full inspector. If it already has an image picker, extend it.
4. **`toolGrammar.ts`**: find `DecalState`. The grammar has an `'imageSrc'` field on the effect that is dispatched. Make sure `imageSrc` flows through to the element.

---

## Tasks

### A — Ensure `imageSrc` is on `DecalElem` in `core/index.ts`

If `DecalElem` doesn't have `imageSrc?: string | null`, add it. This field holds a data URL (base64 image) or an object URL. Do NOT change any other field.

---

### B — Update `buildDecalMesh` to use `imageSrc`

In `buildDecalMesh`, after reading `imageAssetsById[decal.imageAssetId]`:

```ts
const url = (decal as { imageSrc?: string | null }).imageSrc ?? imageAssetsById[decal.imageAssetId];
```

If `url` is defined, load the texture with `new THREE.TextureLoader().load(url)` and assign it to the material. If `url` is undefined/null, render a **magenta placeholder** (`color: '#ff00ff'`) so the user can see the decal placed but without an image. Preserve all existing logic for `uvRect`, `widthMm`, `heightMm`, `opacity`, `parentSurface`.

---

### C — Plan symbol for decal (2D view)

In `symbology.ts`, find where decal elements are handled (or add a case for `kind === 'decal'`).

Draw a simple rectangle outline with diagonal lines (like a picture frame placeholder):

```ts
function decalPlanSymbol(el: DecalElem): THREE.Group {
  const grp = new THREE.Group();
  grp.userData.bimPickId = el.id;
  const wM = (el.widthMm ?? 500) / 1000;
  const hM = (el.heightMm ?? 500) / 1000;
  const cx = el.positionMm?.xMm ?? 0;
  const cy = el.positionMm?.yMm ?? 0;
  // Rectangle + X diagonals in plan (XZ plane at PLAN_Y)
  const corners = [
    [-wM / 2, -hM / 2],
    [wM / 2, -hM / 2],
    [wM / 2, hM / 2],
    [-wM / 2, hM / 2],
    [-wM / 2, -hM / 2],
  ].map(([x, z]) => new THREE.Vector3(cx / 1000 + x, PLAN_Y + 0.003, -cy / 1000 + z));
  // ... add outline + diagonals using THREE.Line
  return grp;
}
```

---

### D — Inspector panel for decal

In `InspectorContent.tsx`, find or add the `kind === 'decal'` inspector section with `data-testid="inspector-decal"`:

```tsx
<CollapsibleSection title="Decal" data-testid="inspector-decal">
  {/* Image file picker */}
  <label>Image</label>
  <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
    {el.imageSrc ? (
      <img
        src={el.imageSrc}
        alt="decal preview"
        data-testid="inspector-decal-preview"
        style={{
          width: 64,
          height: 64,
          objectFit: 'contain',
          border: '1px solid var(--color-border)',
        }}
      />
    ) : (
      <div
        data-testid="inspector-decal-no-image"
        style={{
          width: 64,
          height: 64,
          background: '#f0f0f0',
          border: '1px solid var(--color-border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 10,
        }}
      >
        No image
      </div>
    )}
    <input
      type="file"
      accept="image/*"
      data-testid="inspector-decal-file-input"
      onChange={(e) => {
        const file = e.currentTarget.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
          const dataUrl = ev.target?.result as string;
          onPropertyChange('imageSrc', dataUrl);
        };
        reader.readAsDataURL(file);
      }}
      style={{ fontSize: 11 }}
    />
  </div>

  {/* Width / Height */}
  <label>Width (mm)</label>
  <input
    type="number"
    data-testid="inspector-decal-width"
    value={el.widthMm ?? 500}
    onChange={(e) => onPropertyChange('widthMm', +e.currentTarget.value)}
  />
  <label>Height (mm)</label>
  <input
    type="number"
    data-testid="inspector-decal-height"
    value={el.heightMm ?? 500}
    onChange={(e) => onPropertyChange('heightMm', +e.currentTarget.value)}
  />

  {/* Opacity */}
  <label>Opacity</label>
  <input
    type="range"
    min={0}
    max={1}
    step={0.05}
    data-testid="inspector-decal-opacity"
    value={el.opacity ?? 1}
    onChange={(e) => onPropertyChange('opacity', +e.currentTarget.value)}
  />
</CollapsibleSection>
```

---

### E — Tests

`packages/web/src/workspace/inspector/decalInspector.test.tsx`:

```ts
describe('decal inspector — §8.1.5', () => {
  it('renders inspector-decal section', () => { ... });
  it('shows no-image placeholder when imageSrc is null', () => { ... });
  it('shows image preview when imageSrc is set', () => { ... });
  it('renders file input with accept=image/*', () => { ... });
  it('renders width and height inputs', () => { ... });
  it('renders opacity slider', () => { ... });
});
```

`packages/web/src/viewport/decalMesh.test.ts`:

```ts
describe('buildDecalMesh — §8.1.5', () => {
  it('renders magenta fallback when no imageSrc or imageAssetsById entry', () => { ... });
  it('uses imageSrc when provided', () => { ... });
  it('mesh has bimPickId userData', () => { ... });
});
```

---

## Commit and push

```
git pull --rebase origin main
git add -p
git commit -m "feat(wave15/F): decal image file picker + texture rendering (§8.1.5)"
git push origin main
```

## Success criterion

`pnpm test --filter @bim-ai/web` — all tests pass including the new decal inspector and mesh tests.
