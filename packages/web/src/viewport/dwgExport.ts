import type { Element } from '@bim-ai/core';

// ---------------------------------------------------------------------------
// §12.4.3 — Named DXF layers per element category (German practice)
// ---------------------------------------------------------------------------

const LAYER_MAP: Record<string, { name: string; color: number }> = {
  wall: { name: 'A-WAND', color: 7 }, // white
  floor: { name: 'A-DECKE', color: 3 }, // green
  door: { name: 'A-TUERE', color: 4 }, // cyan
  window: { name: 'A-FENSTER', color: 4 },
  room: { name: 'A-RAUM', color: 2 }, // yellow
  column: { name: 'A-STUETZE', color: 1 }, // red
  beam: { name: 'A-BALKEN', color: 1 },
  stair: { name: 'A-TREPPE', color: 5 }, // blue
  ramp: { name: 'A-RAMPE', color: 5 },
  roof: { name: 'A-DACH', color: 6 }, // magenta
  grid: { name: 'A-RASTER', color: 8 }, // grey
  dimension: { name: 'A-BEMASSUNG', color: 3 },
  text_tag: { name: 'A-BESCHRIFT', color: 7 },
  default: { name: '0', color: 7 },
};

export function layerFor(kind: string): { name: string; color: number } {
  return LAYER_MAP[kind] ?? LAYER_MAP.default!;
}

// ---------------------------------------------------------------------------
// DXF TABLES — LAYER table declaration
// ---------------------------------------------------------------------------

let _handleCounter = 1;
function nextHandle(): string {
  return (_handleCounter++).toString(16).toUpperCase();
}

export function dxfLayerTable(layers: typeof LAYER_MAP): string {
  const entries = Object.values(layers)
    .map(
      (l) =>
        `0\nLAYER\n5\n${nextHandle()}\n100\nAcDbSymbolTableRecord\n100\nAcDbLayerTableRecord\n2\n${l.name}\n70\n0\n62\n${l.color}\n6\nContinuous`,
    )
    .join('\n');
  return `0\nTABLE\n2\nLAYER\n5\n2\n100\nAcDbSymbolTableRecord\n100\nAcDbLayerTable\n70\n${Object.keys(layers).length}\n${entries}\n0\nENDTAB\n`;
}

// ---------------------------------------------------------------------------
// Entity helpers
// ---------------------------------------------------------------------------

export function wallToLwPolyline(el: Extract<Element, { kind: 'wall' }>, scale = 1): string {
  const halfT = (el.thicknessMm ?? 200) / 2;
  const dx = el.end.xMm - el.start.xMm;
  const dy = el.end.yMm - el.start.yMm;
  const len = Math.hypot(dx, dy) || 1;
  const nx = (-dy / len) * halfT;
  const ny = (dx / len) * halfT;

  const s = el.start;
  const e = el.end;

  const corners = [
    { x: (s.xMm + nx) * scale, y: (s.yMm + ny) * scale },
    { x: (e.xMm + nx) * scale, y: (e.yMm + ny) * scale },
    { x: (e.xMm - nx) * scale, y: (e.yMm - ny) * scale },
    { x: (s.xMm - nx) * scale, y: (s.yMm - ny) * scale },
  ];

  const layer = layerFor('wall').name;
  const verts = corners.map((c) => `10\n${c.x.toFixed(1)}\n20\n${c.y.toFixed(1)}`).join('\n');
  return `0\nLWPOLYLINE\n8\n${layer}\n70\n1\n90\n${corners.length}\n${verts}\n`;
}

export function doorToLines(
  el: Extract<Element, { kind: 'door' }> | Extract<Element, { kind: 'window' }>,
  scale = 1,
): string {
  // For door/window, draw a simple cross symbol using widthMm
  const posX = 0;
  const posY = 0;
  const w = ((el as { widthMm?: number }).widthMm ?? 900) / 2;
  const layer = layerFor(el.kind === 'door' ? 'door' : 'window').name;
  return (
    [
      `0\nLINE\n8\n${layer}\n10\n${((posX - w) * scale).toFixed(1)}\n20\n${(posY * scale).toFixed(1)}\n11\n${((posX + w) * scale).toFixed(1)}\n21\n${(posY * scale).toFixed(1)}`,
      `0\nLINE\n8\n${layer}\n10\n${(posX * scale).toFixed(1)}\n20\n${((posY - w) * scale).toFixed(1)}\n11\n${(posX * scale).toFixed(1)}\n21\n${((posY + w) * scale).toFixed(1)}`,
    ].join('\n') + '\n'
  );
}

export function floorToLwPolyline(el: Extract<Element, { kind: 'floor' }>, scale = 1): string {
  // The floor type uses boundaryMm for its perimeter points
  const pts = el.boundaryMm ?? [];
  if (pts.length < 3) return '';
  const layer = layerFor('floor').name;
  const verts = pts
    .map(
      (p: { xMm: number; yMm: number }) =>
        `10\n${(p.xMm * scale).toFixed(1)}\n20\n${(p.yMm * scale).toFixed(1)}`,
    )
    .join('\n');
  return `0\nLWPOLYLINE\n8\n${layer}\n70\n1\n90\n${pts.length}\n${verts}\n`;
}

export function roomToText(el: Extract<Element, { kind: 'room' }>, scale = 1): string {
  // Use centroid of outline points
  const pts = el.outlineMm ?? [];
  let cx = 0;
  let cy = 0;
  if (pts.length > 0) {
    cx = pts.reduce((s: number, p: { xMm: number }) => s + p.xMm, 0) / pts.length;
    cy = pts.reduce((s: number, p: { yMm: number }) => s + p.yMm, 0) / pts.length;
  }
  const label = el.name ?? 'Raum';
  const layer = layerFor('room').name;
  return `0\nTEXT\n8\n${layer}\n10\n${(cx * scale).toFixed(1)}\n20\n${(cy * scale).toFixed(1)}\n40\n300\n1\n${label}\n`;
}

// ---------------------------------------------------------------------------
// Main export function
// ---------------------------------------------------------------------------

export function exportSceneToDwg(elementsById: Record<string, Element | undefined>): string {
  // Reset handle counter for deterministic output in tests
  _handleCounter = 1;

  const scale = 1; // keep mm units (unitless DXF)
  const entities: string[] = [];

  for (const el of Object.values(elementsById)) {
    if (!el) continue;
    switch (el.kind) {
      case 'wall':
        entities.push(wallToLwPolyline(el as Extract<Element, { kind: 'wall' }>, scale));
        break;
      case 'door':
        entities.push(doorToLines(el as Extract<Element, { kind: 'door' }>, scale));
        break;
      case 'window':
        entities.push(doorToLines(el as Extract<Element, { kind: 'window' }>, scale));
        break;
      case 'floor':
        entities.push(floorToLwPolyline(el as Extract<Element, { kind: 'floor' }>, scale));
        break;
      case 'room':
        entities.push(roomToText(el as Extract<Element, { kind: 'room' }>, scale));
        break;
      // TODO: column, beam, stair, dimension
    }
  }

  const dwgContent = [
    `0\nSECTION\n2\nHEADER\n9\n$ACADVER\n1\nAC1015\n0\nENDSEC\n`,
    `0\nSECTION\n2\nTABLES\n`,
    dxfLayerTable(LAYER_MAP),
    `0\nENDSEC\n`,
    `0\nSECTION\n2\nENTITIES\n`,
    ...entities,
    `0\nENDSEC\n`,
    `0\nEOF\n`,
  ].join('');

  try {
    const blob = new Blob([dwgContent], { type: 'application/acad' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'export.dwg';
    a.click();
    URL.revokeObjectURL(url);
  } catch {
    // Not available in non-browser environments
  }

  return dwgContent;
}
