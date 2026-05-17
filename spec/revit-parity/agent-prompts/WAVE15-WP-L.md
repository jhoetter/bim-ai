# Wave 15 — WP-L: Sky / Environment Background for 3D Viewport (§14.4)

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).
This prompt is self-contained — start here.

---

## Repo orientation

```
packages/web/src/Viewport.tsx                    — main 3D viewport component; Three.js scene setup
packages/web/src/state/store.ts                  — Zustand store (may have renderStyle or envSettings)
packages/web/src/viewport/SunAnimationPanel.tsx  — example of a settings panel in the 3D viewport
```

Tests: run `pnpm test --filter @bim-ai/web`.
Prettier runs automatically. **Always `git pull --rebase origin main` before pushing.**

---

## What already exists — read these first

1. **`Viewport.tsx`**: find how `scene.background` is set today. Find where fog is configured. Find the `useEffect` that initialises the Three.js renderer, camera, and scene.
2. **`store.ts`**: check if there's already a `skyBackground` or `envBackground` field. If not, add one: `skyBackground?: 'default' | 'gradient-sky' | 'overcast' | 'solid' | null`.
3. **`SunAnimationPanel.tsx`**: use as UI pattern for the settings panel.

---

## Tasks

### A — Add `skyBackground` to the Zustand store

In `store.ts` (or `storeTypes.ts`):
```ts
skyBackground: 'default' | 'gradient-sky' | 'overcast' | 'solid';
skyBackgroundColor: string;  // hex, used for 'solid' mode; default '#87ceeb'
setSkyBackground: (bg: 'default' | 'gradient-sky' | 'overcast' | 'solid') => void;
setSkyBackgroundColor: (color: string) => void;
```

Default: `skyBackground: 'default'`.

---

### B — Apply background in `Viewport.tsx`

In the Three.js render loop or in a `useEffect` that watches `skyBackground`:

```ts
const skyBackground = useBimStore((s) => s.skyBackground);
const skyBackgroundColor = useBimStore((s) => s.skyBackgroundColor);

useEffect(() => {
  if (!scene) return;
  switch (skyBackground) {
    case 'gradient-sky': {
      // Blue-to-white gradient sky using scene.background + fog
      scene.background = new THREE.Color('#87ceeb');
      scene.fog = new THREE.Fog('#e8f4ff', 50, 500);
      break;
    }
    case 'overcast': {
      // Flat grey sky — overcast
      scene.background = new THREE.Color('#c8c8c8');
      scene.fog = new THREE.Fog('#c8c8c8', 30, 300);
      break;
    }
    case 'solid': {
      scene.background = new THREE.Color(skyBackgroundColor);
      scene.fog = null;
      break;
    }
    default: {
      // default: existing grey
      scene.background = new THREE.Color('#aaaaaa');
      scene.fog = null;
      break;
    }
  }
}, [skyBackground, skyBackgroundColor, scene]);
```

For `gradient-sky`: also set `renderer.setClearColor('#87ceeb')`. Three.js doesn't natively do a vertical gradient background, but a solid sky-blue background + exponential fog creates a convincing atmosphere.

---

### C — Sky settings panel

Create `packages/web/src/viewport/SkyBackgroundPanel.tsx`:

```tsx
export function SkyBackgroundPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const skyBackground = useBimStore((s) => s.skyBackground);
  const setSkyBackground = useBimStore((s) => s.setSkyBackground);
  const skyBackgroundColor = useBimStore((s) => s.skyBackgroundColor);
  const setSkyBackgroundColor = useBimStore((s) => s.setSkyBackgroundColor);

  if (!open) return null;

  return (
    <div data-testid="sky-background-panel"
      style={{ position: 'absolute', bottom: 48, right: 8, background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 6, padding: 12, zIndex: 100, minWidth: 180 }}>
      <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Background</div>

      {(['default', 'gradient-sky', 'overcast', 'solid'] as const).map((mode) => (
        <label key={mode} style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 4, fontSize: 12, cursor: 'pointer' }}>
          <input type="radio" name="sky-mode" data-testid={`sky-mode-${mode}`}
            checked={skyBackground === mode}
            onChange={() => setSkyBackground(mode)} />
          {mode === 'default' ? 'Grey (Default)' : mode === 'gradient-sky' ? 'Sky Blue' : mode === 'overcast' ? 'Overcast' : 'Solid Color'}
        </label>
      ))}

      {skyBackground === 'solid' && (
        <div style={{ marginTop: 4 }}>
          <label style={{ fontSize: 11, display: 'block', marginBottom: 2 }}>Color</label>
          <input type="color" data-testid="sky-solid-color"
            value={skyBackgroundColor}
            onChange={(e) => setSkyBackgroundColor(e.currentTarget.value)}
            style={{ width: '100%' }} />
        </div>
      )}

      <button data-testid="sky-panel-close" onClick={onClose}
        style={{ marginTop: 8, fontSize: 11, width: '100%' }}>Close</button>
    </div>
  );
}
```

---

### D — Wire the panel into `Viewport.tsx`

Add a small "Sky" toggle button in the viewport overlay (alongside other viewport controls):

```tsx
const [skyPanelOpen, setSkyPanelOpen] = useState(false);

// In the viewport overlay JSX:
<button data-testid="viewport-sky-btn" onClick={() => setSkyPanelOpen((o) => !o)}
  title="Sky / Background Settings"
  style={{ position: 'absolute', bottom: 8, right: 8, ... }}>
  ☁
</button>
<SkyBackgroundPanel open={skyPanelOpen} onClose={() => setSkyPanelOpen(false)} />
```

---

### E — Tests

`packages/web/src/viewport/SkyBackgroundPanel.test.tsx`:
```ts
describe('sky background panel — §14.4', () => {
  it('does not render when open=false', () => { ... });
  it('renders sky-background-panel when open=true', () => { ... });
  it('has radio buttons for all 4 modes', () => { ... });
  it('shows color picker only when solid mode is selected', () => { ... });
  it('clicking a mode radio calls setSkyBackground', () => { ... });
});
```

`packages/web/src/state/skyBackgroundStore.test.ts`:
```ts
describe('sky background store — §14.4', () => {
  it('default skyBackground is "default"', () => { ... });
  it('setSkyBackground updates the store', () => { ... });
  it('setSkyBackgroundColor updates the color', () => { ... });
});
```

---

## Commit and push

```
git pull --rebase origin main
git add -p
git commit -m "feat(wave15/L): sky/environment background options for 3D viewport (§14.4)"
git push origin main
```

## Success criterion

`pnpm test --filter @bim-ai/web` — all tests pass including the new sky background tests.
