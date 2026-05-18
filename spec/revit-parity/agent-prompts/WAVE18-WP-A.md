# Wave 18 — WP-A: Window Frame + Glazing Geometry in Family Editor (§15.1.4 + §15.1.5)

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).
This prompt is self-contained — start here.

---

## Repo orientation

```
packages/core/src/index.ts                            — Element union (FamilyExtrusion, FamilyBlend, FamilySweep, family_parameter exist)
packages/web/src/workspace/FamilyEditorWorkbench.tsx  — family editor UI
packages/web/src/viewport/meshBuilders.ts             — mesh builder switch
packages/web/src/viewport/meshBuilders.familyBlend.ts — family blend mesh (use as pattern)
packages/web/src/workspace/inspector/InspectorContent.tsx
```

Search for `family_extrusion`, `FamilyExtrusion`, `familyExtrusion`, `buildFamilyExtrusionMesh`, `glassMaterial` in the codebase first. Read EVERYTHING found before touching anything.

Tests: run `pnpm test --filter @bim-ai/web`.
Prettier runs automatically. **Always `git pull --rebase origin main` before pushing.**

---

## What already exists — read these first

1. `core/index.ts`: find `family_extrusion` — read its full type definition. Find all `family_*` kinds.
2. `FamilyEditorWorkbench.tsx`: read fully — what UI does it expose? How are family elements created?
3. `meshBuilders.ts`: find `case 'family_extrusion':` — read `buildFamilyExtrusionMesh`.
4. `InspectorContent.tsx`: find `case 'family_extrusion':` — read what inspector fields exist.
5. Search for `glassMaterial` — read any glass material helpers.

---

## Tasks

### A — Window frame type in `core/index.ts`

Add optional fields to `family_extrusion` (if not present):

```ts
/** When this extrusion represents a frame, inner cavity width subtracted from outer to form the frame. */
frameInnerWidthMm?: number;
/** Sill depth for window frame (Z offset). */
frameSillDepthMm?: number;
/** Whether this extrusion represents a glazing panel. */
isGlazing?: boolean;
/** Material key for glazing. */
glazingMaterialKey?: string;
```

---

### B — `buildWindowFrameMesh` in a new file

Create `packages/web/src/viewport/meshBuilders.windowFrame.ts`:

```ts
import * as THREE from 'three';
import type { Element } from '@bim-ai/core';

type FamilyExtrusionEl = Extract<Element, { kind: 'family_extrusion' }>;

/**
 * Builds a rectangular window frame mesh:
 * outer rectangle minus inner rectangle = frame profile, extruded to depthMm.
 */
export function buildWindowFrameMesh(el: FamilyExtrusionEl): THREE.Mesh {
  const outerW = ((el as any).widthMm ?? 900) / 1000;
  const outerH = ((el as any).heightMm ?? 1200) / 1000;
  const frameW = ((el as any).frameInnerWidthMm ?? 50) / 1000;
  const depth = ((el as any).depthMm ?? 100) / 1000;

  const outerShape = new THREE.Shape();
  outerShape.moveTo(-outerW / 2, 0);
  outerShape.lineTo(outerW / 2, 0);
  outerShape.lineTo(outerW / 2, outerH);
  outerShape.lineTo(-outerW / 2, outerH);
  outerShape.closePath();

  // Inner hole
  const innerHole = new THREE.Path();
  innerHole.moveTo(-outerW / 2 + frameW, frameW);
  innerHole.lineTo(outerW / 2 - frameW, frameW);
  innerHole.lineTo(outerW / 2 - frameW, outerH - frameW);
  innerHole.lineTo(-outerW / 2 + frameW, outerH - frameW);
  innerHole.closePath();
  outerShape.holes.push(innerHole);

  const geo = new THREE.ExtrudeGeometry(outerShape, {
    depth,
    bevelEnabled: false,
  });
  const mat = new THREE.MeshStandardMaterial({ color: '#d4c5a9', roughness: 0.6 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.userData.bimPickId = el.id;
  return mesh;
}

/**
 * Builds a glazing panel mesh: thin flat rectangle of glass material.
 */
export function buildGlazingMesh(el: FamilyExtrusionEl): THREE.Mesh {
  const outerW = ((el as any).widthMm ?? 900) / 1000;
  const outerH = ((el as any).heightMm ?? 1200) / 1000;
  const frameW = ((el as any).frameInnerWidthMm ?? 50) / 1000;
  const glassThickness = 0.006; // 6mm glass

  const geo = new THREE.BoxGeometry(outerW - frameW * 2, outerH - frameW * 2, glassThickness);
  const mat = new THREE.MeshPhysicalMaterial({
    color: '#a8d8ea',
    transparent: true,
    opacity: 0.35,
    roughness: 0,
    metalness: 0.1,
    transmission: 0.8,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(0, (outerH - frameW * 2) / 2 + frameW, glassThickness / 2);
  mesh.userData.bimPickId = el.id;
  return mesh;
}
```

---

### C — Wire into `meshBuilders.ts`

In the `case 'family_extrusion':` branch (or near it), after building the extrusion mesh, if `el.isGlazing` is true, return `buildGlazingMesh(el)`. If `el.frameInnerWidthMm` is defined and greater than 0, return `buildWindowFrameMesh(el)` instead of the generic extrusion.

---

### D — Inspector additions

In `InspectorContent.tsx`, in `case 'family_extrusion':`, add:

```tsx
<label>Frame Inner Width (mm)
  <input type="number" data-testid="inspector-family-frame-inner-width"
    value={(el as any).frameInnerWidthMm ?? 50}
    onChange={e => onPropertyChange('frameInnerWidthMm', +e.target.value)} />
</label>
<label>Sill Depth (mm)
  <input type="number" data-testid="inspector-family-frame-sill-depth"
    value={(el as any).frameSillDepthMm ?? 100}
    onChange={e => onPropertyChange('frameSillDepthMm', +e.target.value)} />
</label>
<label>Is Glazing Panel
  <input type="checkbox" data-testid="inspector-family-is-glazing"
    checked={(el as any).isGlazing ?? false}
    onChange={e => onPropertyChange('isGlazing', e.target.checked)} />
</label>
```

---

### E — `FamilyEditorWorkbench.tsx` additions

Add two buttons to the family editor create panel (if the workbench exists):

- "Add Window Frame" — creates a `family_extrusion` with `frameInnerWidthMm: 50`, `widthMm: 900`, `heightMm: 1200`, `depthMm: 100`
- "Add Glazing Panel" — creates a `family_extrusion` with `isGlazing: true`, `widthMm: 800`, `heightMm: 1100`

Use `data-testid="family-editor-add-frame-btn"` and `data-testid="family-editor-add-glazing-btn"`.

---

### F — Tests

Create `packages/web/src/viewport/meshBuilders.windowFrame.test.ts`:

```ts
describe('buildWindowFrameMesh — §15.1.4', () => {
  it('returns a Mesh instance', () => { ... });
  it('sets bimPickId on userData', () => { ... });
  it('frame with zero inner width still renders', () => { ... });
});

describe('buildGlazingMesh — §15.1.5', () => {
  it('returns a Mesh instance', () => { ... });
  it('material is transparent', () => { ... });
  it('sets bimPickId on userData', () => { ... });
});
```

---

## Commit and push

```
git pull --rebase origin main
git add -p
git commit -m "feat(wave18/A): window frame + glazing mesh — frame profile + glass panel in family editor (§15.1.4 §15.1.5)"
git push origin main
```

## Success criterion

`pnpm test --filter @bim-ai/web` — all tests pass including the new window frame/glazing tests.
