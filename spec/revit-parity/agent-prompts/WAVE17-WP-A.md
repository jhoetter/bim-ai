# Wave 17 — WP-A: Paint Surface Tool (§3.3.4)

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).
This prompt is self-contained — start here.

---

## Repo orientation

```
packages/core/src/index.ts                         — Element union + command types
packages/web/src/tools/toolRegistry.ts             — ToolId union
packages/web/src/tools/toolGrammar.ts              — tool state machines
packages/web/src/plan/PlanCanvas.tsx               — click/keyboard dispatch
packages/web/src/viewport/meshBuilders.ts          — mesh builder switch
packages/web/src/cmdPalette/defaultCommands.ts     — palette commands
packages/web/src/workspace/commandCapabilities.ts  — capability graph
packages/web/src/workspace/inspector/InspectorContent.tsx — inspector
```

Search for `paint`, `faceMaterial`, `materialOverride` in the codebase first. Check `toolRegistry.ts` for a `'paint'` ToolId — if it already exists, read what's there.

Tests: run `pnpm test --filter @bim-ai/web`.
Prettier runs automatically. **Always `git pull --rebase origin main` before pushing.**

---

## What already exists — read these first

1. `core/index.ts`: look for `faceMaterialOverrides` or `paintOverrides` on wall/floor/ceiling elements. If not present you will add them.
2. `toolRegistry.ts`: look for `'paint'` ToolId. Read existing paint-related code.
3. `meshBuilders.ts`: understand how wall/floor materials are currently applied.
4. Search `defaultCommands.ts` for `paint` — read what's registered.

---

## Tasks

### A — Element type extension in `core/index.ts`

Add `faceMaterialOverrides` to wall, floor, ceiling, and roof elements (if not already present):

```ts
// On wall element:
faceMaterialOverrides?: Record<string, string | null>;
// key = face ID ('front' | 'back' | 'top' | 'bottom' | 'left' | 'right')
// value = materialId (null = remove override)
```

Add command type:
```ts
| { type: 'paintFace'; elementId: string; faceKey: string; materialId: string | null }
```

---

### B — Tool registration

In `toolRegistry.ts`:
- Add `'paint'` to ToolId union (if not present).
- Register: `{ id: 'paint', hotkey: 'PT', label: 'Paint', mode: '3d' }`
- Add to `PALETTE_ORDER` near other modify tools.

---

### C — Grammar in `toolGrammar.ts`

Add `PaintState`, `PaintEvent`, `PaintEffect`, `initialPaintState`, `reducePaint`:

```ts
type PaintState =
  | { phase: 'idle' }
  | { phase: 'painting'; materialId: string };

type PaintEffect = {
  kind: 'paintFace';
  elementId: string;
  faceKey: string;
  materialId: string;
};
```

Flow:
1. **idle → painting**: tool is activated; user selects a material from the OptionsBar material picker (materialId stored in state)
2. **painting**: user clicks a face in the 3D viewport → emit `paintFace` effect with `elementId` (from `bimPickId` on clicked mesh) and `faceKey` (from `userData.faceKey` or derived from face normal)
3. Escape → idle

---

### D — PlanCanvas / Viewport wiring

In `PlanCanvas.tsx` (or `Viewport.tsx` — whichever handles 3D click events):
- Wire `reducePaint` for tool `'paint'`
- On face click → emit `paintFace` → `onSemanticCommand({ type: 'paintFace', ... })`

In `Workspace.tsx`, handle `type: 'paintFace'`:
```ts
if (cmd.type === 'paintFace') {
  void onSemanticCommand({
    type: 'updateElementProperty',
    elementId: cmd.elementId,
    key: 'faceMaterialOverrides',
    value: { ...(el.faceMaterialOverrides ?? {}), [cmd.faceKey]: cmd.materialId },
  });
}
```

---

### E — 3D mesh material override

In the wall mesh builder (or `meshBuilders.ts`), after building geometry, apply `faceMaterialOverrides`:

```ts
if (el.faceMaterialOverrides) {
  for (const [faceKey, matId] of Object.entries(el.faceMaterialOverrides)) {
    if (!matId) continue;
    const mat = materialCache.get(matId) ?? new THREE.MeshStandardMaterial({ color: '#888' });
    // Apply to the face group index matching faceKey
    // For a box: 0=back, 1=front, 2=top, 3=bottom, 4=left, 5=right
    // Set mesh.material = Array of materials, replace at the right group index
  }
}
```

---

### F — Inspector panel

In `InspectorContent.tsx`, for elements that support `faceMaterialOverrides`, add a "Face Materials" section:

```tsx
{el.faceMaterialOverrides && Object.keys(el.faceMaterialOverrides).length > 0 && (
  <div data-testid="inspector-face-material-overrides">
    {Object.entries(el.faceMaterialOverrides).map(([face, matId]) => (
      <div key={face}>
        <span data-testid={`inspector-face-${face}-label`}>{face}</span>
        <span data-testid={`inspector-face-${face}-material`}>{matId ?? '—'}</span>
        <button data-testid={`inspector-face-${face}-clear`}
          onClick={() => onPropertyChange('faceMaterialOverrides',
            { ...el.faceMaterialOverrides, [face]: null })}>×</button>
      </div>
    ))}
  </div>
)}
```

---

### G — Palette command + capability graph

In `defaultCommands.ts`:
```ts
{ id: 'tool.paint', label: 'Paint', keywords: ['paint', 'material', 'face', 'color'],
  category: 'tool', invoke: (ctx) => startPlanTool(ctx, 'paint') }
```

In `commandCapabilities.ts`:
```ts
{ id: 'tool.paint', scope: 'document', intendedModes: ['3d'], precondition: null },
```

---

### H — Tests

`packages/web/src/plan/paintTool.test.ts`:
```ts
describe('paint tool grammar — §3.3.4', () => {
  it('starts in idle state', () => { ... });
  it('tool activate transitions to painting with materialId', () => { ... });
  it('face click emits paintFace effect', () => { ... });
  it('Escape returns to idle', () => { ... });
});
```

`packages/web/src/plan/paintFace.test.ts`:
```ts
describe('paintFace command — §3.3.4', () => {
  it('sets faceMaterialOverrides on element', () => { ... });
  it('preserves other face overrides when painting one face', () => { ... });
  it('null materialId clears the override', () => { ... });
});
```

---

## Commit and push

```
git pull --rebase origin main
git add -p
git commit -m "feat(wave17/A): paint surface tool — face material override + grammar (§3.3.4)"
git push origin main
```

## Success criterion

`pnpm test --filter @bim-ai/web` — all tests pass including the new paint tool tests.
