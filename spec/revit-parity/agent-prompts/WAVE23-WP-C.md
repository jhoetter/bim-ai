# Wave 23 — WP-C: IFC Export Expansion — Beams, Columns, Stairs, Railings (§12.4.3)

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).
This prompt is self-contained — start here.

---

## Context

§12.4.3 "Exportieren nach CAD + IFC Export" is Partial. The IFC 2x3 exporter at `packages/web/src/export/ifcExporter.ts` currently exports: walls (`IFCWALLSTANDARDCASE`), doors (`IFCDOOR`), windows (`IFCWINDOW`), floors + roofs (`IFCSLAB`), and rooms (`IFCSPACE`). Missing: beams, columns, stairs, and railings. This task adds those four element types to the IFC exporter.

---

## Repo orientation

```
packages/core/src/index.ts               — find beam (kind: 'beam'), column (kind: 'column'), stair (kind: 'stair'), railing (kind: 'railing') type shapes
packages/web/src/export/ifcExporter.ts   — main IFC exporter (ISO 10303-21 STEP writer)
packages/web/src/export/ifcExporter.test.ts — existing tests
```

Run:
- `grep -n "kind: 'beam'\|kind: 'column'\|kind: 'stair'\|kind: 'railing'" packages/core/src/index.ts | head -10`
- Read `packages/web/src/export/ifcExporter.ts` lines 500–940 to understand the existing export pattern (how walls, doors, slabs are exported — each follows the same pattern: filter elements, loop, create geometry, create entity, add to storey aggregate).
- `grep -n "IFCSLAB\|IFCSPACE\|buildingStorey\|storeyContains" packages/web/src/export/ifcExporter.ts | head -15`

Read the beam, column, stair, and railing type shapes in `packages/core/src/index.ts` before implementing.

Tests: `pnpm test --filter @bim-ai/web`.
Prettier runs automatically. **Always `git pull --rebase origin main` before pushing.**

---

## Tasks

### A — Read the IFC exporter structure

Before editing, read `ifcExporter.ts` carefully:
1. Note the helper functions: `pt3`, `dir3`, `axis2p3d`, `localPlacement`, `shapeRep`, `productShape`, etc.
2. Note how `IFCWALLSTANDARDCASE` is created — extruded area solid approach
3. Note how the `storeyContains` array is built and how `IFCRELAGGREGATES` ties entities to storeys
4. Note the `mm2m` helper for unit conversion

### B — Add beam export (IFCBEAM)

After the room export section (IFCSPACE), add beam export. Read the beam element type:
- `startMm: XY`, `endMm: XY`, `widthMm: number`, `heightMm: number`, `levelId: string`
- The beam runs horizontally from `startMm` to `endMm` at the level elevation

```ts
// IFCBEAM for each beam element
const beams = elements.filter((e) => e.kind === 'beam') as Extract<Element, { kind: 'beam' }>[];
for (const beam of beams) {
  const level = levelElevations.get(beam.levelId) ?? 0;
  const dx = (beam.endMm.xMm - beam.startMm.xMm);
  const dy = (beam.endMm.yMm - beam.startMm.yMm);
  const lengthMm = Math.sqrt(dx * dx + dy * dy);
  if (lengthMm < 1) continue;

  const angle = Math.atan2(dy, dx);
  // Local placement at start point
  const ox = mm2m(beam.startMm.xMm), oy = mm2m(beam.startMm.yMm), oz = mm2m(level);
  const originId = pt3(ox, oy, oz);
  const axisId = dir3(0, 0, 1);
  const refDirId = dir3(Math.cos(angle), Math.sin(angle), 0);
  const placId = axis2p3d(originId, axisId, refDirId);
  const localPlaceId = localPlacement(storeyLocalPlaceId, placId);

  // Profile: rectangle widthMm × heightMm
  const profileOriginId = pt2(0, 0);
  const profileAxisId = next();
  lines.push(`#${profileAxisId}=IFCAXIS2PLACEMENT2D(${ifcRef(profileOriginId)},$);`);
  const profileId = next();
  lines.push(`#${profileId}=IFCRECTANGLEPROFILEDEF(.AREA.,$,${ifcRef(profileAxisId)},${mm2m(beam.widthMm).toFixed(6)},${mm2m(beam.heightMm).toFixed(6)});`);
  const extrudeDirId = dir3(1, 0, 0);
  const solidId = next();
  lines.push(`#${solidId}=IFCEXTRUDEDAREASOLID(${ifcRef(profileId)},${ifcRef(placId)},${ifcRef(extrudeDirId)},${mm2m(lengthMm).toFixed(6)});`);

  const shapeId = shapeRep(contextId, 'Body', 'SweptSolid', [solidId]);
  const productShapeId = productShape([shapeId]);
  const beamId = next();
  lines.push(`#${beamId}=IFCBEAM('${guid()}',$,${ifcStr(beam.name)},$,$,${ifcRef(localPlaceId)},${ifcRef(productShapeId)},$);`);
  storeyContains.push(beamId);
}
```

Note: adapt to the actual helper function signatures in the file. The code above is a pattern — read the file first.

### C — Add column export (IFCCOLUMN)

After the beam export, add column export. Read the column element type:
- `positionMm: XY`, `bMm: number`, `hMm: number`, `heightMm: number`, `levelId: string`, `rotationDeg?: number`

```ts
// IFCCOLUMN for each column element
const columns = elements.filter((e) => e.kind === 'column') as Extract<Element, { kind: 'column' }>[];
for (const col of columns) {
  const level = levelElevations.get(col.levelId) ?? 0;
  const rotRad = ((col.rotationDeg ?? 0) * Math.PI) / 180;
  const ox = mm2m(col.positionMm.xMm), oy = mm2m(col.positionMm.yMm), oz = mm2m(level);
  const originId = pt3(ox, oy, oz);
  const axisId = dir3(0, 0, 1);
  const refDirId = dir3(Math.cos(rotRad), Math.sin(rotRad), 0);
  const placId = axis2p3d(originId, axisId, refDirId);
  const localPlaceId = localPlacement(storeyLocalPlaceId, placId);

  const profileOriginId = pt2(-mm2m(col.bMm) / 2, -mm2m(col.hMm) / 2);
  const profileAxisId = next();
  lines.push(`#${profileAxisId}=IFCAXIS2PLACEMENT2D(${ifcRef(profileOriginId)},$);`);
  const profileId = next();
  lines.push(`#${profileId}=IFCRECTANGLEPROFILEDEF(.AREA.,$,${ifcRef(profileAxisId)},${mm2m(col.bMm).toFixed(6)},${mm2m(col.hMm).toFixed(6)});`);
  const extrudeDirId = dir3(0, 0, 1);
  const solidId = next();
  lines.push(`#${solidId}=IFCEXTRUDEDAREASOLID(${ifcRef(profileId)},${ifcRef(placId)},${ifcRef(extrudeDirId)},${mm2m(col.heightMm).toFixed(6)});`);

  const shapeId = shapeRep(contextId, 'Body', 'SweptSolid', [solidId]);
  const productShapeId = productShape([shapeId]);
  const colId = next();
  lines.push(`#${colId}=IFCCOLUMN('${guid()}',$,${ifcStr(col.name)},$,$,${ifcRef(localPlaceId)},${ifcRef(productShapeId)},$);`);
  storeyContains.push(colId);
}
```

### D — Add stair export (IFCSTAIR)

Read the stair element type: `runStartMm: XY`, `runEndMm: XY`, `widthMm: number`, `baseLevelId: string`. Use a simple bounding-box placeholder for the stair geometry.

```ts
// IFCSTAIR for each stair element (simplified bounding box)
const stairs = elements.filter((e) => e.kind === 'stair') as Extract<Element, { kind: 'stair' }>[];
for (const stair of stairs) {
  const level = levelElevations.get((stair as any).baseLevelId) ?? 0;
  const stairLocalPlaceId = localPlacement(storeyLocalPlaceId, axis2p3d(
    pt3(mm2m((stair as any).runStartMm.xMm), mm2m((stair as any).runStartMm.yMm), mm2m(level)),
    dir3(0, 0, 1),
    null,
  ));
  const stairId = next();
  lines.push(`#${stairId}=IFCSTAIR('${guid()}',$,${ifcStr((stair as any).name)},$,$,${ifcRef(stairLocalPlaceId)},$,$,.STRAIGHT_RUN_STAIR.);`);
  storeyContains.push(stairId);
}
```

### E — Add railing export (IFCRAILING)

Read the railing element type: probably has `pathMm: XY[]`, `levelId: string`, `heightMm: number`. Export as IFCRAILING with a simplified path-based representation.

```ts
// IFCRAILING for each railing element
const railings = elements.filter((e) => e.kind === 'railing') as Extract<Element, { kind: 'railing' }>[];
for (const rail of railings) {
  const level = levelElevations.get((rail as any).levelId) ?? 0;
  const railingLocalPlaceId = localPlacement(storeyLocalPlaceId, axis2p3d(
    pt3(0, 0, mm2m(level)),
    dir3(0, 0, 1),
    null,
  ));
  const railingId = next();
  lines.push(`#${railingId}=IFCRAILING('${guid()}',$,${ifcStr((rail as any).name ?? 'Railing')},$,$,${ifcRef(railingLocalPlaceId)},$,$,.BALUSTRADE.);`);
  storeyContains.push(railingId);
}
```

Note: Read the railing element type in `packages/core/src/index.ts` before implementing. Adapt field names. If `levelId` doesn't exist on railing, check what field names it actually uses.

### F — Tests

Add tests to `packages/web/src/export/ifcExporter.test.ts`. Find the existing tests for context. Add:

```ts
describe('IFC export — beams, columns, stairs, railings (§12.4.3)', () => {
  const baseElements = [
    { id: 'lvl1', kind: 'level', name: 'EG', elevationMm: 0 },
  ];

  it('exports beam as IFCBEAM', () => {
    const elements = [
      ...baseElements,
      {
        id: 'b1', kind: 'beam', name: 'Beam 1', levelId: 'lvl1',
        startMm: { xMm: 0, yMm: 0 }, endMm: { xMm: 5000, yMm: 0 },
        widthMm: 300, heightMm: 600,
      },
    ] as any[];
    const ifc = exportToIfc(elements, 'TestProject');
    expect(ifc).toContain('IFCBEAM');
  });

  it('exports column as IFCCOLUMN', () => {
    const elements = [
      ...baseElements,
      {
        id: 'c1', kind: 'column', name: 'Col 1', levelId: 'lvl1',
        positionMm: { xMm: 1000, yMm: 1000 }, bMm: 400, hMm: 400, heightMm: 3000,
      },
    ] as any[];
    const ifc = exportToIfc(elements, 'TestProject');
    expect(ifc).toContain('IFCCOLUMN');
  });

  it('exports stair as IFCSTAIR', () => {
    const elements = [
      ...baseElements,
      {
        id: 's1', kind: 'stair', name: 'Stair 1', baseLevelId: 'lvl1',
        runStartMm: { xMm: 0, yMm: 0 }, runEndMm: { xMm: 0, yMm: 4000 },
        widthMm: 1200, riserMm: 175, treadMm: 280,
      },
    ] as any[];
    const ifc = exportToIfc(elements, 'TestProject');
    expect(ifc).toContain('IFCSTAIR');
  });

  it('exports railing as IFCRAILING', () => {
    const elements = [
      ...baseElements,
      {
        id: 'r1', kind: 'railing', name: 'Railing 1', levelId: 'lvl1',
        heightMm: 1100,
      },
    ] as any[];
    const ifc = exportToIfc(elements, 'TestProject');
    expect(ifc).toContain('IFCRAILING');
  });
});
```

---

## Commit and push

```
git pull --rebase origin main
git add -p
git commit -m "feat(wave23/C): IFC export expansion — IFCBEAM + IFCCOLUMN + IFCSTAIR + IFCRAILING entity types (§12.4.3)"
git push origin main
```

## Success criterion

`pnpm test --filter @bim-ai/web` — all tests pass.
