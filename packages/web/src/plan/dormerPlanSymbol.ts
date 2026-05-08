import * as THREE from 'three';

import type { Element } from '@bim-ai/core';

import { getPlanPalette } from './symbology';

type DormerElement = Extract<Element, { kind: 'dormer' }>;
type RoofElement = Extract<Element, { kind: 'roof' }>;
type Vec2Mm = { xMm: number; yMm: number };

const PLAN_Y_FLOOR = 0;

/**
 * KRN-14: compute the four-corner CCW polygon of the dormer footprint in
 * plan coordinates (mm). Mirror of `dormerFootprintMm` in viewport/dormerMesh.ts
 * but expressed as a list of vertices.
 */
export function dormerFootprintVerticesMm(dormer: DormerElement, hostRoof: RoofElement): Vec2Mm[] {
  const xs = hostRoof.footprintMm.map((p) => p.xMm);
  const ys = hostRoof.footprintMm.map((p) => p.yMm);
  const minRx = Math.min(...xs);
  const maxRx = Math.max(...xs);
  const minRy = Math.min(...ys);
  const maxRy = Math.max(...ys);
  const cx = (minRx + maxRx) / 2;
  const cy = (minRy + maxRy) / 2;
  const spanX = maxRx - minRx;
  const spanY = maxRy - minRy;
  const ridgeAlongX =
    hostRoof.ridgeAxis === 'x' ? true : hostRoof.ridgeAxis === 'z' ? false : spanX >= spanY;
  const dx = ridgeAlongX ? dormer.positionOnRoof.alongRidgeMm : dormer.positionOnRoof.acrossRidgeMm;
  const dy = ridgeAlongX ? dormer.positionOnRoof.acrossRidgeMm : dormer.positionOnRoof.alongRidgeMm;
  const centreX = cx + dx;
  const centreY = cy + dy;
  const halfW = dormer.widthMm / 2;
  const halfD = dormer.depthMm / 2;
  let minX: number;
  let maxX: number;
  let minY: number;
  let maxY: number;
  if (ridgeAlongX) {
    minX = centreX - halfW;
    maxX = centreX + halfW;
    minY = centreY - halfD;
    maxY = centreY + halfD;
  } else {
    minX = centreX - halfD;
    maxX = centreX + halfD;
    minY = centreY - halfW;
    maxY = centreY + halfW;
  }
  return [
    { xMm: minX, yMm: minY },
    { xMm: maxX, yMm: minY },
    { xMm: maxX, yMm: maxY },
    { xMm: minX, yMm: maxY },
  ];
}

/**
 * KRN-14: render the dormer plan symbol — dashed footprint outline + "DR"
 * label centred on the footprint — onto a Canvas2D context.
 *
 * Caller is responsible for filtering by level (the plan view should only
 * call this on the host-roof reference level).
 */
export function renderDormerPlanSymbol(
  ctx: CanvasRenderingContext2D,
  dormer: DormerElement,
  hostRoof: RoofElement,
  worldToScreen: (xy: Vec2Mm) => [number, number],
): void {
  const verts = dormerFootprintVerticesMm(dormer, hostRoof);
  if (verts.length < 3) return;

  ctx.save();
  ctx.lineWidth = 1.0;
  ctx.strokeStyle = '#666';
  ctx.setLineDash([6, 4]);
  ctx.beginPath();
  for (let i = 0; i < verts.length; i++) {
    const [px, py] = worldToScreen(verts[i]);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.stroke();
  ctx.setLineDash([]);

  const cx = verts.reduce((acc, v) => acc + v.xMm, 0) / verts.length;
  const cy = verts.reduce((acc, v) => acc + v.yMm, 0) / verts.length;
  const [lx, ly] = worldToScreen({ xMm: cx, yMm: cy });
  ctx.fillStyle = '#444';
  ctx.font = '12px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('DR', lx, ly);
  ctx.restore();
}

/**
 * KRN-14: three.js plan-symbology Group for a dormer — dashed outline +
 * "DR" label sprite. Returns null when the host roof is missing or the
 * active level doesn't match the host's reference level.
 */
export function dormerPlanGroup(
  dormer: DormerElement,
  elementsById: Record<string, Element>,
  activeLevelId: string | null | undefined,
  yOffset: number = PLAN_Y_FLOOR + 0.018,
): THREE.Group | null {
  const host = elementsById[dormer.hostRoofId];
  if (!host || host.kind !== 'roof') return null;
  if (activeLevelId && host.referenceLevelId !== activeLevelId) return null;

  const palette = getPlanPalette();
  const verts = dormerFootprintVerticesMm(dormer, host);
  if (verts.length < 3) return null;

  const g = new THREE.Group();
  const worldPts = verts.map((p) => new THREE.Vector3(p.xMm / 1000, yOffset, -p.yMm / 1000));
  worldPts.push(worldPts[0]);
  const outlineMat = new THREE.LineDashedMaterial({
    color: palette.dimAlt,
    transparent: true,
    opacity: 0.85,
    dashSize: 0.12,
    gapSize: 0.08,
  });
  const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(worldPts), outlineMat);
  line.computeLineDistances();
  g.add(line);

  const cxMm = verts.reduce((acc, v) => acc + v.xMm, 0) / verts.length;
  const cyMm = verts.reduce((acc, v) => acc + v.yMm, 0) / verts.length;
  try {
    const labelCanvas = document.createElement('canvas');
    labelCanvas.width = 64;
    labelCanvas.height = 32;
    const ctx = labelCanvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#444';
      ctx.font = 'bold 20px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('DR', 32, 16);
      const tex = new THREE.CanvasTexture(labelCanvas);
      const spriteMat = new THREE.SpriteMaterial({ map: tex, transparent: true });
      const sprite = new THREE.Sprite(spriteMat);
      sprite.position.set(cxMm / 1000, yOffset + 0.001, -cyMm / 1000);
      sprite.scale.set(0.6, 0.3, 1);
      g.add(sprite);
    }
  } catch {
    // jsdom test env doesn't implement HTMLCanvasElement.getContext —
    // outline still renders, label is the only thing skipped.
  }

  g.userData.bimPickId = dormer.id;
  return g;
}
