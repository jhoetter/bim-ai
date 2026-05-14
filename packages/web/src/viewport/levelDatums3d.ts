import * as THREE from 'three';
import type { Element } from '@bim-ai/core';
import { resolve3dDraftLevel } from './authoring3d';

export type LevelDatum3dRow = {
  id: string;
  name: string;
  elevationMm: number;
  active: boolean;
  hidden: boolean;
};

export type LevelDatum3dBounds = {
  min: { x: number; z: number };
  max: { x: number; z: number };
};

export function selectableLevelDatumId(object: THREE.Object3D): string | null {
  const levelId = object.userData.levelDatumId;
  if (typeof levelId !== 'string') return null;
  return object.userData.levelDatumKind === 'active-plane' ? null : levelId;
}

export function resolveLevelDatum3dRows(
  elementsById: Record<string, Element>,
  activeLevelId: string | undefined,
  levelHidden: Record<string, boolean>,
): LevelDatum3dRow[] {
  const levels = Object.values(elementsById)
    .filter((el): el is Extract<Element, { kind: 'level' }> => el.kind === 'level')
    .map((level) => ({ id: level.id, elevationMm: level.elevationMm, name: level.name }))
    .sort((a, b) => a.elevationMm - b.elevationMm);
  const active = resolve3dDraftLevel(levels, activeLevelId);

  return levels.map((level) => ({
    ...level,
    active: active?.id === level.id,
    hidden: Boolean(levelHidden[level.id]),
  }));
}

export function levelDatumBoundsFromBox(
  box:
    | {
        min: { x: number; z: number };
        max: { x: number; z: number };
      }
    | null
    | undefined,
): LevelDatum3dBounds {
  const fallbackHalfM = 8;
  const minX = box?.min.x;
  const maxX = box?.max.x;
  const minZ = box?.min.z;
  const maxZ = box?.max.z;
  if (
    typeof minX !== 'number' ||
    typeof maxX !== 'number' ||
    typeof minZ !== 'number' ||
    typeof maxZ !== 'number' ||
    !Number.isFinite(minX) ||
    !Number.isFinite(maxX) ||
    !Number.isFinite(minZ) ||
    !Number.isFinite(maxZ) ||
    maxX - minX < 0.5 ||
    maxZ - minZ < 0.5
  ) {
    return {
      min: { x: -fallbackHalfM, z: -fallbackHalfM },
      max: { x: fallbackHalfM, z: fallbackHalfM },
    };
  }

  const span = Math.max(maxX - minX, maxZ - minZ, fallbackHalfM);
  const pad = Math.max(1.5, span * 0.14);
  return {
    min: { x: minX - pad, z: minZ - pad },
    max: { x: maxX + pad, z: maxZ + pad },
  };
}

export function makeLevelDatum3dGroup(
  rows: readonly LevelDatum3dRow[],
  bounds: LevelDatum3dBounds,
): THREE.Group {
  const group = new THREE.Group();
  group.name = 'revit-like-level-datums-3d';
  group.userData.revitLevelDatum3d = true;

  const visibleRows = rows.filter((row) => !row.hidden || row.active);
  const width = bounds.max.x - bounds.min.x;
  const depth = bounds.max.z - bounds.min.z;
  const headX = bounds.max.x + Math.max(0.55, width * 0.03);
  const tick = Math.max(0.28, Math.min(0.65, width * 0.035));

  for (const row of visibleRows) {
    const y = row.elevationMm / 1000;
    const active = row.active;
    const lineColor = active ? 0x2563eb : 0x64748b;
    const lineMaterial = new THREE.LineBasicMaterial({
      color: lineColor,
      transparent: true,
      opacity: active ? 0.95 : 0.52,
      depthTest: false,
    });
    const lineGeometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(bounds.min.x, y, bounds.min.z),
      new THREE.Vector3(bounds.max.x, y, bounds.min.z),
      new THREE.Vector3(bounds.max.x, y, bounds.max.z),
      new THREE.Vector3(bounds.min.x, y, bounds.max.z),
      new THREE.Vector3(bounds.min.x, y, bounds.min.z),
    ]);
    const outline = new THREE.Line(lineGeometry, lineMaterial);
    outline.renderOrder = active ? 62 : 60;
    outline.userData.levelDatumId = row.id;
    outline.userData.levelDatumKind = 'extent';
    group.add(outline);

    const headMaterial = new THREE.LineBasicMaterial({
      color: lineColor,
      transparent: true,
      opacity: active ? 1 : 0.72,
      depthTest: false,
    });
    const headGeometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(bounds.max.x, y, bounds.min.z),
      new THREE.Vector3(headX, y, bounds.min.z),
      new THREE.Vector3(headX, y - tick * 0.32, bounds.min.z),
      new THREE.Vector3(headX + tick, y, bounds.min.z),
      new THREE.Vector3(headX, y + tick * 0.32, bounds.min.z),
      new THREE.Vector3(headX, y, bounds.min.z),
    ]);
    const head = new THREE.Line(headGeometry, headMaterial);
    head.renderOrder = active ? 63 : 61;
    head.userData.levelDatumId = row.id;
    head.userData.levelDatumKind = 'head';
    group.add(head);

    const label = makeLevelHeadSprite(row, active);
    if (label) {
      label.position.set(headX + tick + 0.18, y, bounds.min.z);
      label.renderOrder = active ? 64 : 62;
      label.userData.levelDatumId = row.id;
      label.userData.levelDatumKind = 'label';
      group.add(label);
    }
    const headHitTarget = makeLevelHeadHitTarget(row.id);
    headHitTarget.position.set(headX + tick + 0.2, y, bounds.min.z);
    headHitTarget.renderOrder = active ? 65 : 63;
    group.add(headHitTarget);

    if (active) {
      const plane = new THREE.Mesh(
        new THREE.PlaneGeometry(width, depth),
        new THREE.MeshBasicMaterial({
          color: 0x2563eb,
          transparent: true,
          opacity: 0.12,
          side: THREE.DoubleSide,
          depthWrite: false,
        }),
      );
      plane.position.set((bounds.min.x + bounds.max.x) / 2, y, (bounds.min.z + bounds.max.z) / 2);
      plane.rotation.x = -Math.PI / 2;
      plane.renderOrder = 59;
      plane.userData.levelDatumId = row.id;
      plane.userData.levelDatumKind = 'active-plane';
      group.add(plane);
    }
  }

  return group;
}

function makeLevelHeadHitTarget(levelId: string): THREE.Sprite {
  const mat = new THREE.SpriteMaterial({
    transparent: true,
    opacity: 0,
    depthTest: false,
    depthWrite: false,
  });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(4.2, 1.25, 1);
  sprite.userData.levelDatumId = levelId;
  sprite.userData.levelDatumKind = 'head-hit-target';
  return sprite;
}

function makeLevelHeadSprite(row: LevelDatum3dRow, active: boolean): THREE.Sprite | null {
  if (typeof document === 'undefined') return null;
  if (typeof navigator !== 'undefined' && navigator.userAgent.toLowerCase().includes('jsdom')) {
    return null;
  }

  const canvas = document.createElement('canvas');
  canvas.width = 384;
  canvas.height = 96;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const bg = active ? '#dbeafe' : '#f8fafc';
  const fg = active ? '#1d4ed8' : '#334155';
  const stroke = active ? '#2563eb' : '#64748b';
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = bg;
  roundRect(ctx, 8, 10, 368, 76, 12);
  ctx.fill();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = active ? 4 : 2;
  ctx.stroke();
  ctx.fillStyle = fg;
  ctx.font = '600 24px ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.fillText(row.name, 28, 44);
  ctx.font = '500 18px ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.fillText(`${(row.elevationMm / 1000).toFixed(2)} m`, 28, 70);

  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  const mat = new THREE.SpriteMaterial({
    map: tex,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(2.8, 0.7, 1);
  return sprite;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}
