# Wave 16 — WP-C: Section View Head Bubbles + View Title (§6.1.6)

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).
This prompt is self-contained — start here.

---

## Repo orientation

```
packages/web/src/plan/symbology.ts                        — plan mesh builder loop (section marker plan symbol here)
packages/web/src/workspace/sheets/sectionViewportSvg.tsx  — section view SVG renderer
packages/core/src/index.ts                                — section_view element type
```

Search for `section_view`, `sectionMarker`, `section-marker`, `section_marker` in the codebase to find all rendering code for section markers and section views.

Tests: run `pnpm test --filter @bim-ai/web`.
Prettier runs automatically. **Always `git pull --rebase origin main` before pushing.**

---

## What already exists — read these first

1. Search for `section_marker` or `section-marker` in `symbology.ts` — find the plan symbol for section markers. Read the full function.
2. Read `sectionViewportSvg.tsx` fully — understand what it renders and what props it receives.
3. `core/index.ts`: find `section_view` and any `section_marker` element kind. Read their fields (name, direction, cutPlane position, etc.).

---

## Tasks

### A — Section head bubble in plan view (`symbology.ts`)

Find the function that renders section markers in the plan view. Extend it to add a **head bubble** at each endpoint of the section line:

A section head bubble consists of:

- A filled circle (radius ~200mm) at the tail end and reference end of the section line
- The section view name (short — first 6 chars) as a text label inside the circle (use CSS2DObject or a canvas-drawn label at fixed pixel size)
- The bubble colour matches the section line colour

Implementation:

```ts
// At each endpoint, add a circle mesh
const bubbleGeo = new THREE.CircleGeometry(0.2, 16); // 200mm radius
const bubbleMat = new THREE.MeshBasicMaterial({ color: '#1d4ed8', side: THREE.DoubleSide });
const bubble = new THREE.Mesh(bubbleGeo, bubbleMat);
bubble.position.set(endX, PLAN_Y + 0.003, endZ);
bubble.rotation.x = -Math.PI / 2; // lay flat
grp.add(bubble);
```

Add `data-testid` markers via `userData`:

- `bubble.userData.sectionBubble = true`
- `bubble.userData.sectionViewId = el.id`

---

### B — View title below section viewport (`sectionViewportSvg.tsx`)

At the bottom of the section SVG, add a view title group:

```tsx
{
  /* View title */
}
<g transform={`translate(0, ${viewHeight + 8})`}>
  <line x1="0" y1="0" x2={viewWidth * 0.5} y2="0" stroke="#222" strokeWidth="1" />
  <text
    x="4"
    y="14"
    fontSize="10"
    fontFamily="sans-serif"
    fill="#222"
    data-testid="section-view-title"
  >
    {view.name ?? 'Section'}
  </text>
  <text
    x="4"
    y="26"
    fontSize="8"
    fontFamily="sans-serif"
    fill="#666"
    data-testid="section-view-scale"
  >
    1:{Math.round(1000 / (view.scale ?? 100))}
  </text>
</g>;
```

Increase the SVG height by 36px to accommodate the title.

---

### C — Section bubble symbol in plan at section marker

If the section marker is represented differently (e.g. as a rectangle or line with arrows), also ensure that:

1. The arrowhead end gets a filled bubble with the section number/name
2. The reference (tail) end gets an open circle or half-bubble

For the arrowhead bubble: filled dark-blue circle, white text label (view name abbreviation)
For the tail bubble: unfilled circle with same colour border

---

### D — Tests

`packages/web/src/plan/sectionBubble.test.ts`:

```ts
describe('section view head bubble — §6.1.6', () => {
  it('section marker plan symbol includes bubble meshes', () => { ... });
  it('bubble userData has sectionBubble=true', () => { ... });
  it('bubble userData has sectionViewId set', () => { ... });
});
```

`packages/web/src/workspace/sheets/sectionViewTitle.test.tsx`:

```ts
describe('section view title — §6.1.6', () => {
  it('renders section-view-title element', () => { ... });
  it('renders section-view-scale element', () => { ... });
  it('title contains view name', () => { ... });
});
```

---

## Commit and push

```
git pull --rebase origin main
git add -p
git commit -m "feat(wave16/C): section view head bubbles + view title label (§6.1.6)"
git push origin main
```

## Success criterion

`pnpm test --filter @bim-ai/web` — all tests pass including the new section bubble tests.
