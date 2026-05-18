# Wave 20 — WP-A: DXF Export — Columns, Beams, Floors, Stairs (§12.4.3)

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).
This prompt is self-contained — start here.

---

## Context

`packages/web/src/export/dxfExporter.ts` exports DXF plans. Currently handles: wall, door, window, room, level, grid_line, reference_plane, property_line, revision_cloud, model_line, permanent_dimension, text_note.

**Missing:** column, beam, floor, stair footprints.

---

## Repo orientation

```
packages/web/src/export/dxfExporter.ts   — extend buildPlanView() elements loop
packages/web/src/export/dxfExporter.test.ts — add tests here
packages/core/src/index.ts               — read column/beam/floor/stair element shapes
```

Read `dxfExporter.ts` fully — understand the `buildPlanView()` function, the `emit(layer, entity)` pattern, and helper functions (`dxfLine`, `dxfPolyline`, `dxfCircle`, `dxfText`). Read `core/index.ts` to find the fields on `column`, `beam`, `floor`, `stair` elements.

Tests: run `pnpm test --filter @bim-ai/web`.
Prettier runs automatically. **Always `git pull --rebase origin main` before pushing.**

---

## Tasks

### A — Add layers to the layer list

In `dxfTablesSection()` (or wherever layers are declared), add:

```
'S-COLS'       — structural columns
'S-BEAM'       — beams
'A-FLOR'       — floor slabs
'A-FLOR-STRS'  — stair footprints
```

### B — Column export in `buildPlanView()`

After the existing `el.kind === 'wall'` block, add:

```ts
if (el.kind === 'column' && (el as any).levelId === level.id) {
  const cx = (el as any).positionMm?.xMm ?? 0;
  const cy = (el as any).positionMm?.yMm ?? 0;
  const hw = ((el as any).widthMm ?? 300) / 2;
  const hd = ((el as any).depthMm ?? 300) / 2;
  const pts: [number, number][] = [
    [(cx - hw) * scale, (cy - hd) * scale],
    [(cx + hw) * scale, (cy - hd) * scale],
    [(cx + hw) * scale, (cy + hd) * scale],
    [(cx - hw) * scale, (cy + hd) * scale],
  ];
  emit('S-COLS', dxfPolyline('S-COLS', pts, true));
}
```

### C — Beam export

```ts
if (el.kind === 'beam' && (el as any).levelId === level.id) {
  const sx = (el as any).startMm?.xMm ?? 0;
  const sy = (el as any).startMm?.yMm ?? 0;
  const ex = (el as any).endMm?.xMm ?? 0;
  const ey = (el as any).endMm?.yMm ?? 0;
  emit('S-BEAM', dxfLine('S-BEAM', sx * scale, sy * scale, ex * scale, ey * scale));
}
```

### D — Floor export

```ts
if (el.kind === 'floor' && (el as any).levelId === level.id) {
  const pts = ((el as any).perimeterMm ?? (el as any).boundaryMm ?? []).map(
    (p: { xMm: number; yMm: number }): [number, number] => [p.xMm * scale, p.yMm * scale],
  );
  if (pts.length >= 3) emit('A-FLOR', dxfPolyline('A-FLOR', pts, true));
}
```

### E — Stair export

Read the `stair` element in `core/index.ts` to find footprint fields (`startMm`, `endMm`, `widthMm`, `runWidthMm`). Export a rectangle representing the stair footprint:

```ts
if (el.kind === 'stair' && (el as any).levelId === level.id) {
  const sx = (el as any).startMm?.xMm ?? 0;
  const sy = (el as any).startMm?.yMm ?? 0;
  const ex = (el as any).endMm?.xMm ?? sx + 2000;
  const ey = (el as any).endMm?.yMm ?? sy;
  const w = (el as any).runWidthMm ?? (el as any).widthMm ?? 1200;
  const dx = ex - sx;
  const dy = ey - sy;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const nx = (-uy * w * scale) / 2;
  const ny = (ux * w * scale) / 2;
  const sxS = sx * scale;
  const syS = sy * scale;
  const exS = ex * scale;
  const eyS = ey * scale;
  const pts: [number, number][] = [
    [sxS + nx, syS + ny],
    [exS + nx, eyS + ny],
    [exS - nx, eyS - ny],
    [sxS - nx, syS - ny],
  ];
  emit('A-FLOR-STRS', dxfPolyline('A-FLOR-STRS', pts, true));
}
```

### F — Tests

In `packages/web/src/export/dxfExporter.test.ts`, add a new describe block:

```ts
describe('DXF export structural elements — §12.4.3', () => {
  const level = { id: 'L1', kind: 'level', name: 'Ground', elevationMm: 0 };

  it('exports column as S-COLS rectangle', () => {
    const col = {
      kind: 'column',
      id: 'c1',
      levelId: 'L1',
      positionMm: { xMm: 5000, yMm: 5000 },
      widthMm: 400,
      depthMm: 400,
    };
    const result = exportToDxf({ [col.id]: col as any, [level.id]: level as any }, {});
    expect(result[0]?.dxf).toContain('S-COLS');
  });

  it('exports beam as S-BEAM line', () => {
    const beam = {
      kind: 'beam',
      id: 'b1',
      levelId: 'L1',
      startMm: { xMm: 0, yMm: 0 },
      endMm: { xMm: 6000, yMm: 0 },
    };
    const result = exportToDxf({ [beam.id]: beam as any, [level.id]: level as any }, {});
    expect(result[0]?.dxf).toContain('S-BEAM');
  });

  it('exports floor as A-FLOR polyline', () => {
    const floor = {
      kind: 'floor',
      id: 'f1',
      levelId: 'L1',
      perimeterMm: [
        { xMm: 0, yMm: 0 },
        { xMm: 5000, yMm: 0 },
        { xMm: 5000, yMm: 4000 },
        { xMm: 0, yMm: 4000 },
      ],
    };
    const result = exportToDxf({ [floor.id]: floor as any, [level.id]: level as any }, {});
    expect(result[0]?.dxf).toContain('A-FLOR');
  });

  it('exports stair as A-FLOR-STRS rectangle', () => {
    const stair = {
      kind: 'stair',
      id: 's1',
      levelId: 'L1',
      startMm: { xMm: 0, yMm: 0 },
      endMm: { xMm: 3000, yMm: 0 },
      runWidthMm: 1200,
    };
    const result = exportToDxf({ [stair.id]: stair as any, [level.id]: level as any }, {});
    expect(result[0]?.dxf).toContain('A-FLOR-STRS');
  });
});
```

---

## Commit and push

```
git pull --rebase origin main
git add -p
git commit -m "feat(wave20/A): DXF export — column/beam/floor/stair footprints on S-COLS/S-BEAM/A-FLOR layers (§12.4.3)"
git push origin main
```

## Success criterion

`pnpm test --filter @bim-ai/web` — all tests pass.
