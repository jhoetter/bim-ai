import type { Element } from '@bim-ai/core';

export interface DxfExportOptions {
  levelId?: string;
  units?: 'mm' | 'm';
  layerStyle?: 'revit-compatible' | 'custom';
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

function dxfTablesSection(layers: string[]): string {
  const unique = [...new Set(layers)];
  const layerDefs = unique.flatMap((name) => [
    '0',
    'LAYER',
    '2',
    name,
    '70',
    '0',
    '62',
    '7',
    '6',
    'CONTINUOUS',
  ]);
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

export function exportToDxf(
  elementsById: Record<string, Element>,
  opts?: DxfExportOptions,
): DxfPlanView[] {
  const units: 'mm' | 'm' = opts?.units ?? 'mm';
  const scale = SCALE[units];

  const elements = Object.values(elementsById);
  const levels = elements.filter(
    (e): e is Extract<Element, { kind: 'level' }> => e.kind === 'level',
  );

  const targetLevels = opts?.levelId ? levels.filter((l) => l.id === opts.levelId) : levels;

  if (targetLevels.length === 0 && levels.length === 0) {
    const syntheticLevel = { id: '_default', name: 'Level 1', elevationMm: 0 };
    return [buildPlanView(elements, syntheticLevel, scale, units)];
  }

  if (targetLevels.length === 0) return levels.map((l) => buildPlanView(elements, l, scale, units));
  return targetLevels.map((l) => buildPlanView(elements, l, scale, units));
}

function buildPlanView(
  elements: Element[],
  level: { id: string; name: string; elevationMm: number },
  scale: number,
  units: 'mm' | 'm',
): DxfPlanView {
  const entities: string[] = [];
  const usedLayers: string[] = [];

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
      emit('A-WALL', dxfPolyline('A-WALL', wallRect(sx, sy, ex, ey, t), true));
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
      emit('A-DOOR', dxfLine('A-DOOR', px, py, px + ux * w, py + uy * w));
      const angleDeg = (Math.atan2(uy, ux) * 180) / Math.PI;
      emit('A-DOOR', dxfArc('A-DOOR', px, py, w, angleDeg, angleDeg + 90));
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
      emit('A-GLAZ', dxfLine('A-GLAZ', px, py, ex, ey));
      emit('A-GLAZ', dxfLine('A-GLAZ', px + nx, py + ny, ex + nx, ey + ny));
      emit('A-GLAZ', dxfLine('A-GLAZ', px - nx, py - ny, ex - nx, ey - ny));
    }

    if (el.kind === 'room' && el.levelId === level.id) {
      const pts = el.outlineMm.map((p): [number, number] => [p.xMm * scale, p.yMm * scale]);
      if (pts.length >= 2) emit('A-AREA', dxfPolyline('A-AREA', pts, true));
    }

    if (el.kind === 'level') {
      const elevation = el.elevationMm * scale;
      emit('A-FLOR-LEVL', dxfText('A-FLOR-LEVL', 0, elevation, 250 * scale, el.name));
    }
  }

  const tables = dxfTablesSection(usedLayers);
  const entitiesSection = ['0', 'SECTION', '2', 'ENTITIES', ...entities, '0', 'ENDSEC'].join('\n');

  const dxfContent = [dxfHeader(units), tables, entitiesSection, '0', 'EOF'].join('\n');

  return { levelId: level.id, levelName: level.name, dxfContent };
}
