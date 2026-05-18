# Wave 15 — WP-K: Project Base Point + North Arrow Polish (§2.1.3 + §5.4.1)

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).
This prompt is self-contained — start here.

---

## Repo orientation

```
packages/core/src/index.ts                              — element types union
packages/web/src/tools/toolRegistry.ts                  — tool registration
packages/web/src/plan/toolGrammar.ts                    — tool state machines
packages/web/src/plan/PlanCanvas.tsx                    — click dispatch
packages/web/src/plan/symbology.ts                      — plan mesh builder loop
packages/web/src/workspace/inspector/InspectorContent.tsx — inspector panels
packages/web/src/cmdPalette/defaultCommands.ts          — palette commands
```

Also look for:

- `north-arrow` tool — it already exists as a ToolId. Find its grammar and plan renderer.
- `annotation_symbol` with `symbolType: 'north_arrow'` in core/index.ts.
- `SheetCanvas.tsx` — north arrow rendering on sheets.

Tests: run `pnpm test --filter @bim-ai/web`.
Prettier runs automatically. **Always `git pull --rebase origin main` before pushing.**

---

## What already exists — read these first

1. Search for `'north-arrow'` in `toolRegistry.ts` and `toolGrammar.ts`. If a grammar exists, read it. If not, create one.
2. Search for `north_arrow` in `symbology.ts` and `SheetCanvas.tsx` — understand how it renders today.
3. Search for `project_base_point` in `core/index.ts` — if it already exists, read its fields. If absent, create it.
4. Search for `originMarkers` in the codebase — there may be an existing origin marker plan symbol.

---

## Part 1: Project Base Point (§2.1.3)

### A — Element type in `core/index.ts`

If `project_base_point` doesn't exist, add it:

```ts
| {
    kind: 'project_base_point';
    id: string;
    /** Position in plan (mm from project origin). Usually at (0,0). */
    positionMm: { xMm: number; yMm: number };
    /** Elevation above datum (mm). */
    elevationMm: number;
    /** True if base point is "shared" (survey coordinates). */
    isShared: boolean;
    /** Optional user label. */
    name?: string | null;
  }
```

Add `CreateProjectBasePointCmd`.

### B — Plan symbol in `symbology.ts`

Draw the Revit-style base point plan symbol: a small circle (r=150mm) with a cross inside and "PBP" label:

```ts
function basePointPlanSymbol(el: ProjectBasePointEl): THREE.Group {
  const grp = new THREE.Group();
  grp.userData.bimPickId = el.id;
  const r = 0.15; // 150mm in meters
  const cx = el.positionMm.xMm / 1000;
  const cz = -el.positionMm.yMm / 1000;
  const Y = PLAN_Y + 0.005;

  // Circle
  const circlePts: THREE.Vector3[] = [];
  for (let i = 0; i <= 32; i++) {
    const a = (i / 32) * Math.PI * 2;
    circlePts.push(new THREE.Vector3(cx + Math.cos(a) * r, Y, cz + Math.sin(a) * r));
  }
  grp.add(
    new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(circlePts),
      new THREE.LineBasicMaterial({ color: '#2563eb' }),
    ),
  );

  // Cross hair
  const crossMat = new THREE.LineBasicMaterial({ color: '#2563eb' });
  const hLine = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(cx - r, Y, cz),
    new THREE.Vector3(cx + r, Y, cz),
  ]);
  const vLine = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(cx, Y, cz - r),
    new THREE.Vector3(cx, Y, cz + r),
  ]);
  grp.add(new THREE.Line(hLine, crossMat));
  grp.add(new THREE.Line(vLine, crossMat));
  return grp;
}
```

### C — Tool registration + grammar

Register `'project-base-point'` tool (hotkey `BP`, plan mode). Grammar: single-click → dispatch `CreateProjectBasePointCmd` at clicked plan coordinates. If a base point already exists in elementsById, update its position instead of creating a new one.

### D — Inspector for project base point

In `InspectorContent.tsx`, add a section for `kind === 'project_base_point'`:

- Position X (mm), Position Y (mm), Elevation (mm) — number inputs
- Name text input
- `isShared` checkbox
- data-testids: `inspector-pbp-x`, `inspector-pbp-y`, `inspector-pbp-elevation`, `inspector-pbp-name`, `inspector-pbp-shared`

---

## Part 2: North Arrow Polish (§5.4.1)

### E — Check the north arrow grammar

Find the `north-arrow` grammar in `toolGrammar.ts`. If the grammar's single-click does NOT actually commit (`createNorthArrow` effect), fix it:

The complete grammar should be:

- activate → listening
- click → emit `{ kind: 'createNorthArrow', positionMm, rotationDeg }` where `rotationDeg` defaults to `project_settings.projectNorthAngleDeg`
- escape → idle

If the `createNorthArrow` effect is not handled in `Workspace.tsx`, add the handler:

```ts
if (cmd.type === 'create_north_arrow') {
  const id = crypto.randomUUID();
  void onSemanticCommand({
    type: 'createElement',
    element: {
      kind: 'annotation_symbol',
      id,
      symbolType: 'north_arrow',
      positionMm: cmd.positionMm,
      rotationDeg: cmd.rotationDeg ?? 0,
    },
  });
}
```

### F — North arrow plan symbol

In `symbology.ts`, for `annotation_symbol` with `symbolType === 'north_arrow'`, draw an SVG-style arrow using Three.js lines:

```ts
function northArrowPlanSymbol(el: AnnotationSymbolEl): THREE.Group {
  const grp = new THREE.Group();
  grp.userData.bimPickId = el.id;
  const cx = el.positionMm.xMm / 1000;
  const cz = -el.positionMm.yMm / 1000;
  const rot = ((el.rotationDeg ?? 0) * Math.PI) / 180;
  const Y = PLAN_Y + 0.005;
  const len = 0.5; // 500mm

  // Arrow shaft
  const tip = new THREE.Vector3(cx + Math.sin(rot) * len, Y, cz - Math.cos(rot) * len);
  const base = new THREE.Vector3(cx, Y, cz);
  const shaftGeo = new THREE.BufferGeometry().setFromPoints([base, tip]);
  grp.add(new THREE.Line(shaftGeo, new THREE.LineBasicMaterial({ color: '#000', linewidth: 2 })));

  // Arrowhead (two lines forming a V)
  const headLen = 0.1;
  const headAngle = Math.PI / 6;
  const leftHead = new THREE.Vector3(
    tip.x - Math.sin(rot + headAngle) * headLen,
    Y,
    tip.z + Math.cos(rot + headAngle) * headLen,
  );
  const rightHead = new THREE.Vector3(
    tip.x - Math.sin(rot - headAngle) * headLen,
    Y,
    tip.z + Math.cos(rot - headAngle) * headLen,
  );
  const headGeo = new THREE.BufferGeometry().setFromPoints([leftHead, tip, rightHead]);
  grp.add(new THREE.Line(headGeo, new THREE.LineBasicMaterial({ color: '#000' })));

  return grp;
}
```

---

## Tests

`packages/web/src/plan/projectBasePoint.test.ts`:

```ts
describe('project base point — §2.1.3', () => {
  it('grammar single click emits createProjectBasePoint effect', () => { ... });
  it('plan symbol has bimPickId userData', () => { ... });
  it('inspector renders pbp-x and pbp-y inputs', () => { ... });
});
```

`packages/web/src/plan/northArrow.test.ts`:

```ts
describe('north arrow — §5.4.1', () => {
  it('grammar click emits createNorthArrow with positionMm', () => { ... });
  it('north arrow plan symbol is a Group', () => { ... });
  it('north arrow rotates by rotationDeg', () => { ... });
});
```

---

## Commit and push

```
git pull --rebase origin main
git add -p
git commit -m "feat(wave15/K): project base point + north arrow polish (§2.1.3 + §5.4.1)"
git push origin main
```

## Success criterion

`pnpm test --filter @bim-ai/web` — all tests pass including the new base point and north arrow tests.
