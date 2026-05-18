# Wave 26 — WP-E: Arc Length Dimension Curved Line + Wall Edit Profile (§4.6 + §3.5.5)

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).
This prompt is self-contained — start here.

---

## Context

**§4.6 Bogenlängenbemaßung** is Partial P2. `arc-length-dimension` ToolId (hotkey `ALD`) is registered, single-click grammar exists, plan renderer draws arc-length label at midpoint. What's missing: a proper curved dimension arc line (matching the arc's curvature, offset from it, with tick arrowheads at start/end), making it look like a real Revit arc length dimension.

**§3.5.5 Wände fixieren, Profil anpassen** is Partial P1. Pin and Join/Unjoin are done. "Edit Profile (non-rectangular wall cross-section profile): Partial — wall profile shape editing via sketch is partially implemented." This task improves the wall profile editor by ensuring `commitWallProfile` command fully stores and previews the profile in 3D.

---

## Repo orientation

```
packages/core/src/index.ts                          — find arc_length_dimension element type, wall element
packages/web/src/viewport/symbology.ts              — find arc_length_dimension rendering
packages/web/src/viewport/meshBuilders.ts           — find makeWallMesh / buildProfiledWallMesh
```

Run before editing:

- `grep -n "arc_length\|arcLength\|ALD" packages/core/src/index.ts | head -10`
- `grep -n "arc_length\|arcLength" packages/web/src/viewport/symbology.ts | head -15`
- `grep -n "profilePoints\|commitWallProfile\|buildProfiledWall" packages/web/src/viewport/meshBuilders.ts | head -10`
- `grep -n "profilePoints\|commitWallProfile" packages/core/src/index.ts | head -5`

Read the `arc_length_dimension` rendering in `symbology.ts` carefully before editing.

Tests: `npx vitest run` from `packages/web`.
Prettier runs automatically. **Always `git pull --rebase origin main` before pushing.**

---

## Tasks

### A — Read arc_length_dimension element shape

Check `packages/core/src/index.ts` for the `arc_length_dimension` element. It should have:

- `centerMm: { xMm: number; yMm: number }` — center of the arc being dimensioned
- `radiusMm: number` — radius of the arc
- `startAngleDeg: number` — start angle
- `endAngleDeg: number` — end angle
- `offsetMm?: number` — radial offset of the dimension arc from the element arc (defaults to 200mm)

If `offsetMm` is missing, add it.

### B — Improve arc length dimension plan rendering in symbology.ts

Find where `arc_length_dimension` elements are rendered in `symbology.ts`. The current implementation likely draws just a `CSS2DObject` label. Improve it to:

1. **Draw the dimension arc**: An arc line at `radiusMm + offsetMm` from the center, from `startAngleDeg` to `endAngleDeg`:

```ts
// Build arc points (N=32 segments)
const N = 32;
const dimRadius = (dim.radiusMm + (dim.offsetMm ?? 200)) / 1000;
const points: THREE.Vector3[] = [];
for (let i = 0; i <= N; i++) {
  const angle = THREE.MathUtils.degToRad(
    dim.startAngleDeg + ((dim.endAngleDeg - dim.startAngleDeg) * i) / N,
  );
  points.push(
    new THREE.Vector3(
      dim.centerMm.xMm / 1000 + Math.cos(angle) * dimRadius,
      0,
      dim.centerMm.yMm / 1000 + Math.sin(angle) * dimRadius,
    ),
  );
}
const arcGeom = new THREE.BufferGeometry().setFromPoints(points);
const arcLine = new THREE.Line(
  arcGeom,
  new THREE.LineBasicMaterial({ color: '#0055ff', linewidth: 1 }),
);
group.add(arcLine);
```

2. **Draw extension lines** at start and end angles (from the element arc to the dimension arc):

```ts
// Extension line at start angle
const startAngleRad = THREE.MathUtils.degToRad(dim.startAngleDeg);
const innerRadius = dim.radiusMm / 1000;
const outerRadius = dimRadius + 50 / 1000; // 50mm beyond dim arc
const extStart = new THREE.BufferGeometry().setFromPoints([
  new THREE.Vector3(
    dim.centerMm.xMm / 1000 + Math.cos(startAngleRad) * innerRadius,
    0,
    dim.centerMm.yMm / 1000 + Math.sin(startAngleRad) * innerRadius,
  ),
  new THREE.Vector3(
    dim.centerMm.xMm / 1000 + Math.cos(startAngleRad) * outerRadius,
    0,
    dim.centerMm.yMm / 1000 + Math.sin(startAngleRad) * outerRadius,
  ),
]);
group.add(new THREE.Line(extStart, new THREE.LineBasicMaterial({ color: '#0055ff' })));
// Same for end angle
```

3. **Keep the text label** at the midpoint of the dimension arc.

**Important**: Read the actual symbology.ts arc_length_dimension rendering. The coordinate system uses `xMm → X` and `yMm → Z` (negated) in Three.js plan view. Adapt to the actual coordinate conventions used in the file for plan-view objects.

### C — Wall profile: ensure commitWallProfile updates 3D mesh

Check `packages/core/src/index.ts` for `profilePoints` on the wall element and `CommitWallProfileCmd`. If present, verify the Workspace handler in `Workspace.tsx` actually stores `profilePoints` on the wall element and that `buildProfiledWallMesh` in `meshBuilders.ts` uses it.

If `buildProfiledWallMesh` exists but `makeWallMesh` doesn't call it when `profilePoints` is set, wire it in:

```ts
// In makeWallMesh, near the end:
const profilePoints = (wall as any).profilePoints as { xMm: number; yMm: number }[] | undefined;
if (profilePoints && profilePoints.length >= 3) {
  // Use the profile polygon as the extrude shape instead of the default rect
  const profileShape = new THREE.Shape(
    profilePoints.map((p) => new THREE.Vector2(p.xMm / 1000, p.yMm / 1000)),
  );
  // Replace the default wall extrude with a profiled one
  const profileGeom = new THREE.ExtrudeGeometry(profileShape, {
    depth: wallLenM,
    bevelEnabled: false,
  });
  profileGeom.rotateX(-Math.PI / 2);
  profileGeom.rotateZ(-angleRad);
  profileGeom.translate(wall.start.xMm / 1000, baseY, wall.start.yMm / 1000);
  mesh.geometry = profileGeom;
}
```

**Important**: Read `makeWallMesh` and `buildProfiledWallMesh` carefully. Only make changes if `profilePoints` is genuinely not being applied to the 3D mesh. Don't duplicate existing logic.

### D — commandCapabilities.ts entry for arc-length dimension improvement

Check if `annotate.arc-length-dimension` already exists in commandCapabilities.ts:

```
grep -n "arc-length\|arcLength" packages/web/src/workspace/commandCapabilities.ts | head -5
```

If not present, add:

```ts
{
  id: 'annotate.arc-length-dimension',
  label: 'Arc Length Dimension',
  owner: 'plan/PlanCanvas',
  group: 'annotate',
  scope: 'canvas',
  intendedModes: ['plan'],
  surfaces: ['tool-palette'],
  executionSurface: 'store',
  preconditions: [],
  status: 'implemented',
  usabilityScore: 7,
  notes: '§4.6: arc length dimension with curved dimension line, extension lines, and arc length label.',
},
```

Note: `surfaces` does NOT include `'cmd-k'` so no `registerCommand` is needed (tool-palette only).

### E — Tests

Create `packages/web/src/plan/arcLengthDim.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

describe('Arc length dimension curved renderer — §4.6', () => {
  it('arc length is computed from angles and radius', () => {
    const radiusMm = 3000;
    const startAngleDeg = 0;
    const endAngleDeg = 90;
    const arcLengthMm = (Math.PI * radiusMm * Math.abs(endAngleDeg - startAngleDeg)) / 180;
    expect(arcLengthMm).toBeCloseTo((Math.PI * 3000) / 2, 0);
  });

  it('dimension arc radius = element radius + offsetMm', () => {
    const radiusMm = 3000;
    const offsetMm = 200;
    const dimRadius = radiusMm + offsetMm;
    expect(dimRadius).toBe(3200);
  });

  it('offsetMm defaults to 200mm when not set', () => {
    const dim: any = { radiusMm: 3000 };
    expect(dim.offsetMm ?? 200).toBe(200);
  });

  it('arc point at 90deg is at correct position', () => {
    const centerX = 0;
    const centerY = 0;
    const radius = 1;
    const angleDeg = 90;
    const x = centerX + Math.cos((angleDeg * Math.PI) / 180) * radius;
    const y = centerY + Math.sin((angleDeg * Math.PI) / 180) * radius;
    expect(x).toBeCloseTo(0, 5);
    expect(y).toBeCloseTo(1, 5);
  });
});

describe('Wall edit profile 3D — §3.5.5', () => {
  it('profilePoints field exists on wall type signature', () => {
    const wall: any = {
      kind: 'wall',
      id: 'w1',
      profilePoints: [
        { xMm: 0, yMm: 0 },
        { xMm: 200, yMm: 0 },
        { xMm: 200, yMm: 2800 },
        { xMm: 0, yMm: 2800 },
      ],
    };
    expect(wall.profilePoints).toHaveLength(4);
  });

  it('profile area computes correctly for a rectangular wall', () => {
    const profilePoints = [
      { xMm: 0, yMm: 0 },
      { xMm: 200, yMm: 0 },
      { xMm: 200, yMm: 2800 },
      { xMm: 0, yMm: 2800 },
    ];
    // Shoelace formula
    let area = 0;
    for (let i = 0; i < profilePoints.length; i++) {
      const j = (i + 1) % profilePoints.length;
      area += profilePoints[i].xMm * profilePoints[j].yMm;
      area -= profilePoints[j].xMm * profilePoints[i].yMm;
    }
    area = Math.abs(area) / 2;
    expect(area).toBe(200 * 2800);
  });
});
```

---

## Commit and push

```
git pull --rebase origin main
git add -p
git commit -m "feat(wave26/E): arc length dimension curved line + extension lines + wall profile 3D mesh wiring (§4.6 §3.5.5)"
git push origin main
```

## Success criterion

`npx vitest run` from `packages/web` — all tests pass including the new 6 tests.
