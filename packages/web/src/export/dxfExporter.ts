import type { Element } from '@bim-ai/core';

type PointMm = { xMm: number; yMm: number };
type ProjectSettingsWithDxf = Extract<Element, { kind: 'project_settings' }> & {
  dxfLayerMapping?: Record<string, string>;
};
type ColumnForDxf = Extract<Element, { kind: 'column' }> & {
  widthMm?: number;
  depthMm?: number;
};
type FloorForDxf = Extract<Element, { kind: 'floor' }> & {
  perimeterMm?: PointMm[];
};
type StairForDxf = Extract<Element, { kind: 'stair' }> & {
  levelId?: string;
  startMm?: PointMm;
  endMm?: PointMm;
  runWidthMm?: number;
};

export interface DxfExportOptions {
  levelId?: string;
  units?: 'mm' | 'm';
  layerStyle?: 'revit-compatible' | 'custom';
  /** §12.4.2: per-layer name overrides. Keys are default layer names (e.g. 'A-WALL'), values are custom names. */
  layerMapping?: Record<string, string>;
}

export interface DxfPlanView {
  levelId: string;
  levelName: string;
  dxfContent: string;
}

const SCALE: Record<'mm' | 'm', number> = { mm: 1, m: 0.001 };

function dxfHeader(units: 'mm' | 'm'): string {
  const insunits = units === 'mm' ? 4 : 6;
  return [
    '0',
    'SECTION',
    '2',
    'HEADER',
    '9',
    '$ACADVER',
    '1',
    'AC1009',
    '9',
    '$INSUNITS',
    '70',
    String(insunits),
    '0',
    'ENDSEC',
  ].join('\n');
}

/** ACI color assignments per layer name (§12.4.3). */
const LAYER_ACI_COLORS: Record<string, number> = {
  'A-WALL': 7,
  'A-DOOR': 1,
  'A-GLAZ': 3,
  'A-AREA': 4,
  'S-GRID': 8,
  'A-ANNO-DIMS': 2,
  'A-REFP': 6,
  'S-COLS': 5,
  'S-BEAM': 5,
};

function dxfTablesSection(layers: string[]): string {
  const unique = [...new Set(layers)];
  const layerDefs = unique.flatMap((name) => {
    const aciColor = LAYER_ACI_COLORS[name] ?? 7;
    return ['0', 'LAYER', '2', name, '70', '0', '62', String(aciColor), '6', 'CONTINUOUS'];
  });
  return [
    '0',
    'SECTION',
    '2',
    'TABLES',
    '0',
    'TABLE',
    '2',
    'LAYER',
    '70',
    String(unique.length),
    ...layerDefs,
    '0',
    'ENDTAB',
    '0',
    'ENDSEC',
  ].join('\n');
}

function dxfLine(layer: string, x1: number, y1: number, x2: number, y2: number): string {
  return [
    '0',
    'LINE',
    '8',
    layer,
    '10',
    fmt(x1),
    '20',
    fmt(y1),
    '30',
    '0.0',
    '11',
    fmt(x2),
    '21',
    fmt(y2),
    '31',
    '0.0',
  ].join('\n');
}

function dxfPolyline(layer: string, points: [number, number][], closed = false): string {
  const flag = closed ? 1 : 0;
  const vertices = points.flatMap(([x, y]) => [
    '0',
    'VERTEX',
    '8',
    layer,
    '10',
    fmt(x),
    '20',
    fmt(y),
    '30',
    '0.0',
  ]);
  return [
    '0',
    'POLYLINE',
    '8',
    layer,
    '66',
    '1',
    '70',
    String(flag),
    ...vertices,
    '0',
    'SEQEND',
  ].join('\n');
}

function dxfArc(
  layer: string,
  cx: number,
  cy: number,
  r: number,
  startDeg: number,
  endDeg: number,
): string {
  return [
    '0',
    'ARC',
    '8',
    layer,
    '10',
    fmt(cx),
    '20',
    fmt(cy),
    '30',
    '0.0',
    '40',
    fmt(r),
    '50',
    fmt(startDeg),
    '51',
    fmt(endDeg),
  ].join('\n');
}

function dxfText(layer: string, x: number, y: number, height: number, text: string): string {
  return [
    '0',
    'TEXT',
    '8',
    layer,
    '10',
    fmt(x),
    '20',
    fmt(y),
    '30',
    '0.0',
    '40',
    fmt(height),
    '1',
    text,
  ].join('\n');
}

function dxfCircle(layer: string, cx: number, cy: number, r: number): string {
  return ['0', 'CIRCLE', '8', layer, '10', fmt(cx), '20', fmt(cy), '30', '0.0', '40', fmt(r)].join(
    '\n',
  );
}

function fmt(n: number): string {
  return n.toFixed(4);
}

function wallRect(
  sx: number,
  sy: number,
  ex: number,
  ey: number,
  thickness: number,
): [number, number][] {
  const dx = ex - sx;
  const dy = ey - sy;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const nx = (-dy / len) * thickness * 0.5;
  const ny = (dx / len) * thickness * 0.5;
  return [
    [sx + nx, sy + ny],
    [ex + nx, ey + ny],
    [ex - nx, ey - ny],
    [sx - nx, sy - ny],
  ];
}

/** §12.4.2: returns the custom layer name override, or the default name if no override is set. */
export function resolveLayerName(defaultName: string, mapping?: Record<string, string>): string {
  return mapping?.[defaultName] ?? defaultName;
}

export function exportToDxf(
  elementsById: Record<string, Element>,
  opts?: DxfExportOptions,
): DxfPlanView[] {
  const units: 'mm' | 'm' = opts?.units ?? 'mm';
  const scale = SCALE[units];

  // §12.4.2: read layerMapping from opts, or from project_settings.dxfLayerMapping
  const projectSettings = Object.values(elementsById).find(
    (e): e is Extract<Element, { kind: 'project_settings' }> => e.kind === 'project_settings',
  );
  const layerMapping: Record<string, string> | undefined =
    opts?.layerMapping ?? (projectSettings as ProjectSettingsWithDxf | undefined)?.dxfLayerMapping;

  const elements = Object.values(elementsById);
  const levels = elements.filter(
    (e): e is Extract<Element, { kind: 'level' }> => e.kind === 'level',
  );

  const targetLevels = opts?.levelId ? levels.filter((l) => l.id === opts.levelId) : levels;

  if (targetLevels.length === 0 && levels.length === 0) {
    const syntheticLevel = { id: '_default', name: 'Level 1', elevationMm: 0 };
    return [buildPlanView(elements, syntheticLevel, scale, units, layerMapping)];
  }

  if (targetLevels.length === 0)
    return levels.map((l) => buildPlanView(elements, l, scale, units, layerMapping));
  return targetLevels.map((l) => buildPlanView(elements, l, scale, units, layerMapping));
}

function buildPlanView(
  elements: Element[],
  level: { id: string; name: string; elevationMm: number },
  scale: number,
  units: 'mm' | 'm',
  layerMapping?: Record<string, string>,
): DxfPlanView {
  const entities: string[] = [];
  const usedLayers: string[] = [];

  /** §12.4.2: resolve a layer name using the mapping, or return the default. */
  function rln(defaultName: string): string {
    return resolveLayerName(defaultName, layerMapping);
  }

  function emit(layer: string, entity: string) {
    usedLayers.push(layer);
    entities.push(entity);
  }

  for (const el of elements) {
    if (el.kind === 'wall' && el.levelId === level.id) {
      const sx = el.start.xMm * scale;
      const sy = el.start.yMm * scale;
      const ex = el.end.xMm * scale;
      const ey = el.end.yMm * scale;
      const t = el.thicknessMm * scale;
      const wallLn = rln('A-WALL');
      emit(wallLn, dxfPolyline(wallLn, wallRect(sx, sy, ex, ey, t), true));
    }

    if (el.kind === 'door') {
      const wall = elements.find(
        (e): e is Extract<Element, { kind: 'wall' }> => e.kind === 'wall' && e.id === el.wallId,
      );
      if (!wall || wall.levelId !== level.id) continue;
      const t = el.alongT;
      const px = (wall.start.xMm + (wall.end.xMm - wall.start.xMm) * t) * scale;
      const py = (wall.start.yMm + (wall.end.yMm - wall.start.yMm) * t) * scale;
      const w = el.widthMm * scale;
      const dx = (wall.end.xMm - wall.start.xMm) * scale;
      const dy = (wall.end.yMm - wall.start.yMm) * scale;
      const wallLen = Math.sqrt(dx * dx + dy * dy) || 1;
      const ux = dx / wallLen;
      const uy = dy / wallLen;
      const doorLn = rln('A-DOOR');
      emit(doorLn, dxfLine(doorLn, px, py, px + ux * w, py + uy * w));
      const angleDeg = (Math.atan2(uy, ux) * 180) / Math.PI;
      emit(doorLn, dxfArc(doorLn, px, py, w, angleDeg, angleDeg + 90));
    }

    if (el.kind === 'window') {
      const wall = elements.find(
        (e): e is Extract<Element, { kind: 'wall' }> => e.kind === 'wall' && e.id === el.wallId,
      );
      if (!wall || wall.levelId !== level.id) continue;
      const t = el.alongT;
      const px = (wall.start.xMm + (wall.end.xMm - wall.start.xMm) * t) * scale;
      const py = (wall.start.yMm + (wall.end.yMm - wall.start.yMm) * t) * scale;
      const w = el.widthMm * scale;
      const dx = (wall.end.xMm - wall.start.xMm) * scale;
      const dy = (wall.end.yMm - wall.start.yMm) * scale;
      const wallLen = Math.sqrt(dx * dx + dy * dy) || 1;
      const ux = dx / wallLen;
      const uy = dy / wallLen;
      const nx = -uy * 50 * scale;
      const ny = ux * 50 * scale;
      const ex = px + ux * w;
      const ey = py + uy * w;
      const glazLn = rln('A-GLAZ');
      emit(glazLn, dxfLine(glazLn, px, py, ex, ey));
      emit(glazLn, dxfLine(glazLn, px + nx, py + ny, ex + nx, ey + ny));
      emit(glazLn, dxfLine(glazLn, px - nx, py - ny, ex - nx, ey - ny));
    }

    if (el.kind === 'room' && el.levelId === level.id) {
      const pts = el.outlineMm.map((p): [number, number] => [p.xMm * scale, p.yMm * scale]);
      const areaLn = rln('A-AREA');
      if (pts.length >= 2) emit(areaLn, dxfPolyline(areaLn, pts, true));
    }

    if (el.kind === 'level') {
      const elevation = el.elevationMm * scale;
      emit('A-FLOR-LEVL', dxfText('A-FLOR-LEVL', 0, elevation, 250 * scale, el.name));
    }

    if (el.kind === 'grid_line') {
      const x1 = el.start.xMm * scale;
      const y1 = el.start.yMm * scale;
      const x2 = el.end.xMm * scale;
      const y2 = el.end.yMm * scale;
      const bubbleR = 300 * scale;
      const gridLn = rln('S-GRID');
      emit(gridLn, dxfLine(gridLn, x1, y1, x2, y2));
      emit(gridLn, dxfCircle(gridLn, x2, y2, bubbleR));
      if (el.label) {
        emit(gridLn, dxfText(gridLn, x2, y2, 200 * scale, el.label));
      }
    }

    if (el.kind === 'reference_plane' && 'levelId' in el && el.levelId === level.id) {
      const x1 = el.startMm.xMm * scale;
      const y1 = el.startMm.yMm * scale;
      const x2 = el.endMm.xMm * scale;
      const y2 = el.endMm.yMm * scale;
      const refpLn = rln('A-REFP');
      emit(refpLn, dxfLine(refpLn, x1, y1, x2, y2));
      if (el.name) {
        const mx = (x1 + x2) / 2;
        const my = (y1 + y2) / 2;
        emit(refpLn, dxfText(refpLn, mx, my, 150 * scale, el.name));
      }
    }

    if (el.kind === 'dimension' && el.levelId === level.id) {
      const ax = el.aMm.xMm * scale;
      const ay = el.aMm.yMm * scale;
      const bx = el.bMm.xMm * scale;
      const by = el.bMm.yMm * scale;
      const ox = el.offsetMm.xMm * scale;
      const oy = el.offsetMm.yMm * scale;
      const distMm = Math.round(
        Math.sqrt((el.bMm.xMm - el.aMm.xMm) ** 2 + (el.bMm.yMm - el.aMm.yMm) ** 2),
      );
      const dimsLn = rln('A-ANNO-DIMS');
      // Extension lines from measurement points to offset (dim line)
      emit(dimsLn, dxfLine(dimsLn, ax, ay, ax + ox, ay + oy));
      emit(dimsLn, dxfLine(dimsLn, bx, by, bx + ox, by + oy));
      // Dimension line along the offset
      emit(dimsLn, dxfLine(dimsLn, ax + ox, ay + oy, bx + ox, by + oy));
      // Label at midpoint
      const mx = (ax + bx) / 2 + ox;
      const my = (ay + by) / 2 + oy;
      emit(dimsLn, dxfText(dimsLn, mx, my, 150 * scale, String(distMm)));
    }

    if (el.kind === 'text_note' && el.hostViewId === level.id) {
      const x = el.positionMm.xMm * scale;
      const y = el.positionMm.yMm * scale;
      emit('A-ANNO', dxfText('A-ANNO', x, y, el.fontSizeMm * scale, el.text));
    }

    if (el.kind === 'column' && el.levelId === level.id) {
      const column = el as ColumnForDxf;
      const cx = column.positionMm.xMm;
      const cy = column.positionMm.yMm;
      const hw = (column.widthMm ?? column.bMm ?? 300) / 2;
      const hd = (column.depthMm ?? column.hMm ?? 300) / 2;
      const pts: [number, number][] = [
        [(cx - hw) * scale, (cy - hd) * scale],
        [(cx + hw) * scale, (cy - hd) * scale],
        [(cx + hw) * scale, (cy + hd) * scale],
        [(cx - hw) * scale, (cy + hd) * scale],
      ];
      const colsLn = rln('S-COLS');
      emit(colsLn, dxfPolyline(colsLn, pts, true));
    }

    if (el.kind === 'beam' && el.levelId === level.id) {
      const sx = el.startMm.xMm;
      const sy = el.startMm.yMm;
      const ex = el.endMm.xMm;
      const ey = el.endMm.yMm;
      const beamLn = rln('S-BEAM');
      emit(beamLn, dxfLine(beamLn, sx * scale, sy * scale, ex * scale, ey * scale));
    }

    if (el.kind === 'floor' && el.levelId === level.id) {
      const floor = el as FloorForDxf;
      const pts = (floor.perimeterMm ?? floor.boundaryMm ?? []).map(
        (p: { xMm: number; yMm: number }): [number, number] => [p.xMm * scale, p.yMm * scale],
      );
      if (pts.length >= 3) emit('A-FLOR', dxfPolyline('A-FLOR', pts, true));
    }

    if (el.kind === 'stair') {
      const stair = el as StairForDxf;
      if (stair.levelId !== level.id && stair.baseLevelId !== level.id) continue;
      const sx = stair.startMm?.xMm ?? stair.runStartMm?.xMm ?? 0;
      const sy = stair.startMm?.yMm ?? stair.runStartMm?.yMm ?? 0;
      const ex = stair.endMm?.xMm ?? stair.runEndMm?.xMm ?? sx + 2000;
      const ey = stair.endMm?.yMm ?? stair.runEndMm?.yMm ?? sy;
      const w = stair.runWidthMm ?? stair.widthMm ?? 1200;
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
  }

  const tables = dxfTablesSection(usedLayers);
  const entitiesSection = ['0', 'SECTION', '2', 'ENTITIES', ...entities, '0', 'ENDSEC'].join('\n');

  const dxfContent = [dxfHeader(units), tables, entitiesSection, '0', 'EOF'].join('\n');

  return { levelId: level.id, levelName: level.name, dxfContent };
}
