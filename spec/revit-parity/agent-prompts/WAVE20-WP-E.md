# Wave 20 — WP-E: Render Quality Panel — Shadow, Exposure, Anti-Aliasing Controls (§14.3)

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).
This prompt is self-contained — start here.

---

## Context

bim-ai has a Three.js 3D viewport (`packages/web/src/Viewport.tsx`) with real-time rendering. There is no UI to control render quality (shadow enable/disable, tone mapping exposure, pixel ratio). This wave adds a `RenderQualityPanel.tsx` that exposes these Three.js knobs, wired into the viewport via a Zustand store slice.

---

## Repo orientation

```
packages/web/src/Viewport.tsx                        — THREE.WebGLRenderer lives here
packages/web/src/state/storeTypes.ts                 — add RenderQualitySettings slice
packages/web/src/state/store.ts (or storeSlices/)    — add the slice
packages/web/src/                                     — create RenderQualityPanel.tsx
```

Read `Viewport.tsx` to find:

- Where `new THREE.WebGLRenderer(...)` is constructed (search for `WebGLRenderer`)
- Where `renderer.render(scene, camera)` is called in the animation loop
- Existing overlay buttons (sky, sun, etc.) to understand where to add the render quality toggle button

Read `storeTypes.ts` to understand the Zustand store shape.

Tests: run `pnpm test --filter @bim-ai/web`.
Prettier runs automatically. **Always `git pull --rebase origin main` before pushing.**

---

## Tasks

### A — Zustand store slice for render quality

In `storeTypes.ts`, add:

```ts
export interface RenderQualitySettings {
  shadowsEnabled: boolean;
  toneMappingExposure: number; // 0.5–3.0, default 1.0
  pixelRatioScale: 'auto' | '1x' | '2x'; // 'auto' = devicePixelRatio
}
```

Add to the store state type:

```ts
renderQuality: RenderQualitySettings;
setRenderQuality: (settings: Partial<RenderQualitySettings>) => void;
```

In the appropriate store slice file, initialise:

```ts
renderQuality: { shadowsEnabled: false, toneMappingExposure: 1.0, pixelRatioScale: 'auto' },
setRenderQuality: (settings) => set(state => ({
  renderQuality: { ...state.renderQuality, ...settings },
})),
```

### B — Wire render quality into `Viewport.tsx`

In `Viewport.tsx`, subscribe to `renderQuality` from the store. In the `useEffect` that sets up or runs the renderer, apply the settings:

```ts
const { shadowsEnabled, toneMappingExposure, pixelRatioScale } = renderQuality;

renderer.shadowMap.enabled = shadowsEnabled;
renderer.shadowMap.type = shadowsEnabled ? THREE.PCFSoftShadowMap : THREE.BasicShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = toneMappingExposure;

const pr =
  pixelRatioScale === '1x'
    ? 1
    : pixelRatioScale === '2x'
      ? 2
      : Math.min(window.devicePixelRatio ?? 1, 2);
renderer.setPixelRatio(pr);
```

Add a `useEffect` keyed on `renderQuality` that re-applies these settings when they change.

### C — `RenderQualityPanel.tsx`

Create `packages/web/src/viewport/RenderQualityPanel.tsx`:

```tsx
import { useBimStore } from '../state/store';

export function RenderQualityPanel({ onClose }: { onClose: () => void }) {
  const { renderQuality, setRenderQuality } = useBimStore((s) => ({
    renderQuality: s.renderQuality,
    setRenderQuality: s.setRenderQuality,
  }));

  return (
    <div
      data-testid="render-quality-panel"
      style={{
        position: 'absolute',
        top: 48,
        right: 8,
        background: '#1a1a2e',
        color: '#eee',
        padding: 12,
        borderRadius: 8,
        width: 220,
        zIndex: 50,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <strong>Render Quality</strong>
        <button onClick={onClose} data-testid="render-quality-close">
          ✕
        </button>
      </div>

      <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
        <input
          type="checkbox"
          data-testid="render-quality-shadows"
          checked={renderQuality.shadowsEnabled}
          onChange={(e) => setRenderQuality({ shadowsEnabled: e.target.checked })}
        />
        Shadows
      </label>

      <label style={{ display: 'block', marginBottom: 8 }}>
        Exposure
        <input
          type="range"
          data-testid="render-quality-exposure"
          min={0.5}
          max={3}
          step={0.1}
          value={renderQuality.toneMappingExposure}
          onChange={(e) => setRenderQuality({ toneMappingExposure: +e.target.value })}
          style={{ width: '100%' }}
        />
        <span data-testid="render-quality-exposure-value">
          {renderQuality.toneMappingExposure.toFixed(1)}×
        </span>
      </label>

      <label style={{ display: 'block' }}>
        Pixel Ratio
        <select
          data-testid="render-quality-pixel-ratio"
          value={renderQuality.pixelRatioScale}
          onChange={(e) => setRenderQuality({ pixelRatioScale: e.target.value as any })}
        >
          <option value="auto">Auto (device)</option>
          <option value="1x">1× (performance)</option>
          <option value="2x">2× (quality)</option>
        </select>
      </label>
    </div>
  );
}
```

### D — Wire toggle button into `Viewport.tsx`

In `Viewport.tsx`, add state and a toggle button in the viewport overlay (near the sky/sun buttons):

```tsx
const [renderQualityOpen, setRenderQualityOpen] = useState(false);

// In the overlay JSX:
<button
  data-testid="viewport-render-quality-btn"
  title="Render Quality"
  onClick={() => setRenderQualityOpen((v) => !v)}
  style={
    {
      /* match existing overlay button style */
    }
  }
>
  ⚙
</button>;
{
  renderQualityOpen && <RenderQualityPanel onClose={() => setRenderQualityOpen(false)} />;
}
```

### E — Tests

`packages/web/src/viewport/renderQualityPanel.test.tsx`:

```tsx
describe('RenderQualityPanel — §14.3', () => {
  it('renders the panel with shadows checkbox', () => { ... });
  it('renders exposure slider', () => { ... });
  it('renders pixel ratio select', () => { ... });
  it('renders close button', () => { ... });
  it('calls setRenderQuality when shadows toggled', () => { ... });
  it('displays exposure value label', () => { ... });
});
```

---

## Commit and push

```
git pull --rebase origin main
git add -p
git commit -m "feat(wave20/E): render quality panel — shadows/exposure/pixel-ratio controls wired to THREE.WebGLRenderer (§14.3)"
git push origin main
```

## Success criterion

`pnpm test --filter @bim-ai/web` — all tests pass.
