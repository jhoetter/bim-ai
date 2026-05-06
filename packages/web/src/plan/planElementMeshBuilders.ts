import * as THREE from 'three';

import type { Element, WallLocationLine } from '@bim-ai/core';

import { deterministicSchemeColorHex } from './roomSchemeColor';
import {
  ux,
  uz,
  segmentDir,
  getPlanPalette,
  readToken,
  centroidMm,
  polygonAreaMm2,
  PLAN_Y,
  PLAN_WALL_CENTER_SLICE_HEIGHT_M,
  PLAN_DOOR_SWING_ARC_SEMI_MINOR_FACTOR_DEFAULT,
  PLAN_DOOR_SWING_ARC_SEMI_MINOR_FACTOR_FOCUS,
  PLAN_WINDOW_SILL_LINE_WIDTH,
} from './symbology';
import type { PlanPresentationPreset, StairPlanWireDocOverlays } from './symbology';

function planLocationLineOffsetFrac(loc: WallLocationLine): number {
  switch (loc) {
    case 'finish-face-exterior':
    case 'core-face-exterior':
      return 0.5;
    case 'finish-face-interior':
    case 'core-face-interior':
      return -0.5;
    default:
      return 0;
  }
}

export function planWallMesh(
  wall: Extract<Element, { kind: 'wall' }>,
  selectedId?: string,
  lineWeightScale = 1,
): THREE.Mesh {
  const { lenM: len, nx, nz } = segmentDir(wall);

  const sx = ux(wall.start.xMm);

  const sz = uz(wall.start.yMm);

  const angle = Math.atan2(nz, nx);

  const thick = THREE.MathUtils.clamp((wall.thicknessMm * lineWeightScale) / 1000, 0.02, 1.8);

  const locFrac = planLocationLineOffsetFrac(wall.locationLine ?? 'wall-centerline');
  const perpX = -nz * locFrac * thick;
  const perpZ = nx * locFrac * thick;

  const geom = new THREE.BoxGeometry(len, PLAN_WALL_CENTER_SLICE_HEIGHT_M, thick);

  const mat = new THREE.MeshStandardMaterial({
    roughness: 0.82,

    metalness: 0.02,

    color: (() => {
      const p = getPlanPalette();
      return wall.id === selectedId ? p.wallSelected : p.wallFill;
    })(),
  });

  const mesh = new THREE.Mesh(geom, mat);

  mesh.position.set(sx + (nx * len) / 2 + perpX, PLAN_Y, sz + (nz * len) / 2 + perpZ);

  mesh.rotation.y = -angle;

  mesh.userData.bimPickId = wall.id;

  return mesh;
}

export function doorGroupThree(
  door: Extract<Element, { kind: 'door' }>,

  wall: Extract<Element, { kind: 'wall' }>,

  selectedId?: string,

  openingFocus?: boolean,
): THREE.Group {
  const g = new THREE.Group();

  const sx = ux(wall.start.xMm);

  const sz = uz(wall.start.yMm);

  const seg = segmentDir(wall);

  const px = sx + seg.nx * seg.lenM * door.alongT;

  const pz = sz + seg.nz * seg.lenM * door.alongT;

  const width = THREE.MathUtils.clamp(door.widthMm / 1000, 0.2, Math.min(seg.lenM * 0.95, 4));

  const depth = THREE.MathUtils.clamp(wall.thicknessMm / 1000 + 0.02, 0.05, 1);

  const opening = new THREE.Mesh(
    new THREE.BoxGeometry(width, 0.04, depth),

    new THREE.MeshStandardMaterial({
      emissive: openingFocus ? 0x084c6e : 0x000000,
      emissiveIntensity: openingFocus ? 0.35 : 0,
      color: (() => {
        const p = getPlanPalette();
        return door.id === selectedId ? p.doorSelected : p.doorFill;
      })(),
    }),
  );

  opening.position.set(px, PLAN_Y + 0.025, pz);

  opening.rotation.y = Math.atan2(seg.nz, seg.nx);

  opening.userData.bimPickId = door.id;

  g.add(opening);

  const swingMinor = openingFocus
    ? PLAN_DOOR_SWING_ARC_SEMI_MINOR_FACTOR_FOCUS
    : PLAN_DOOR_SWING_ARC_SEMI_MINOR_FACTOR_DEFAULT;

  const curve = new THREE.EllipseCurve(
    0,
    0,
    width / swingMinor,

    width / swingMinor,

    Math.PI / 4,

    Math.PI / 4 + Math.PI / (openingFocus ? 1.9 : 2.2),
  );

  const arcPts = curve.getPoints(28).map((p) => new THREE.Vector3(p.x, PLAN_Y + 0.03, -p.y));

  const arcGeom = new THREE.BufferGeometry().setFromPoints(arcPts);

  const arc = new THREE.Line(
    arcGeom,

    new THREE.LineBasicMaterial({
      color: (() => {
        const p = getPlanPalette();
        return openingFocus ? p.doorSwingFocus : p.doorSwing;
      })(),
      linewidth: 1,
    }),
  );

  arc.position.set(px, 0, pz);

  arc.rotation.y = Math.atan2(seg.nz, seg.nx);

  g.add(arc);

  g.userData.bimPickId = door.id;

  return g;
}

export function planWindowMesh(
  win: Extract<Element, { kind: 'window' }>,

  wall: Extract<Element, { kind: 'wall' }>,

  selectedId?: string,

  openingFocus?: boolean,
): THREE.Group {
  const grp = new THREE.Group();

  const sx = ux(wall.start.xMm);

  const sz = uz(wall.start.yMm);

  const seg = segmentDir(wall);

  const px = sx + seg.nx * seg.lenM * win.alongT;

  const pz = sz + seg.nz * seg.lenM * win.alongT;

  const yaw = Math.atan2(seg.nz, seg.nx);

  grp.position.set(px, 0, pz);

  grp.rotation.y = yaw;

  const width = THREE.MathUtils.clamp(win.widthMm / 1000, 0.2, seg.lenM * 0.95);

  const depth = THREE.MathUtils.clamp(wall.thicknessMm / 1000 + 0.01, 0.05, 1);

  const sill = THREE.MathUtils.clamp(win.sillHeightMm / 1000, 0.08, (wall.heightMm / 1000) * 0.85);

  const h = THREE.MathUtils.clamp(win.heightMm / 1000, 0.06, wall.heightMm / 1000 - sill - 0.05);

  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(width, h, depth),

    new THREE.MeshStandardMaterial({
      transparent: true,

      opacity: openingFocus ? 0.92 : 0.55,

      color: (() => {
        const p = getPlanPalette();
        if (openingFocus) {
          return win.id === selectedId ? p.windowSelected : p.windowFill;
        }
        return win.id === selectedId ? p.windowSelectedBackline : p.windowFillBackline;
      })(),
    }),
  );

  mesh.position.set(0, sill + h / 2, 0);

  mesh.userData.bimPickId = win.id;

  grp.add(mesh);

  const sillPts = [
    new THREE.Vector3(-width / 2, sill + 0.004, depth * 0.51),

    new THREE.Vector3(width / 2, sill + 0.004, depth * 0.51),
  ];

  const sillGeom = new THREE.BufferGeometry().setFromPoints(sillPts);

  const sillLn = new THREE.Line(
    sillGeom,

    new THREE.LineBasicMaterial({
      color: (() => {
        const p = getPlanPalette();
        return openingFocus ? p.windowGlassFocus : p.windowGlass;
      })(),

      linewidth: PLAN_WINDOW_SILL_LINE_WIDTH,
    }),
  );

  sillLn.renderOrder = 2;

  grp.add(sillLn);

  grp.userData.bimPickId = win.id;

  return grp;
}

/** Match kernel `stair_riser_count_plan_proxy` (rise / riser when levels resolve). */
export function computeStairPlanRiserCount(
  stair: Extract<Element, { kind: 'stair' }>,
  elementsById?: Record<string, Element>,
): number {
  const sx = stair.runStartMm.xMm / 1000;
  const sz = stair.runStartMm.yMm / 1000;
  const ex = stair.runEndMm.xMm / 1000;
  const ez = stair.runEndMm.yMm / 1000;
  const lenM = Math.max(1e-6, Math.hypot(ex - sx, ez - sz));
  const lenMm = lenM * 1000;

  if (elementsById) {
    const bl = elementsById[stair.baseLevelId];
    const tl = elementsById[stair.topLevelId];
    if (bl?.kind === 'level' && tl?.kind === 'level') {
      const riseMm = Math.abs(tl.elevationMm - bl.elevationMm);
      if (riseMm > 1e-3) {
        const r = Math.max(stair.riserMm, 1e-6);
        const n = Math.round(riseMm / r);
        return Math.max(2, Math.min(36, n));
      }
    }
  }

  const t = Math.max(stair.treadMm, 1e-6);
  const n2 = Math.round(lenMm / t);
  return Math.max(2, Math.min(36, n2));
}

/** Footprint tread preview on the stair base level (OG plan hides it). */

export function stairPlanThree(
  stair: Extract<Element, { kind: 'stair' }>,
  elementsById?: Record<string, Element>,
  wireDoc?: StairPlanWireDocOverlays | null,
): THREE.Group | null {
  const sx = stair.runStartMm.xMm / 1000;
  const sz = stair.runStartMm.yMm / 1000;
  const ex = stair.runEndMm.xMm / 1000;
  const ez = stair.runEndMm.yMm / 1000;
  const dx = ex - sx;
  const dz = ez - sz;
  const len = Math.max(1e-6, Math.hypot(dx, dz));
  const uxDir = dx / len;
  const uzDir = dz / len;
  const px = -uzDir * (stair.widthMm / 2000);

  const pz = uxDir * (stair.widthMm / 2000);

  const g = new THREE.Group();

  const outline = [
    new THREE.Vector3(sx + px, PLAN_Y + 0.012, sz + pz),

    new THREE.Vector3(ex + px, PLAN_Y + 0.012, ez + pz),

    new THREE.Vector3(ex - px, PLAN_Y + 0.012, ez - pz),

    new THREE.Vector3(sx - px, PLAN_Y + 0.012, sz - pz),

    new THREE.Vector3(sx + px, PLAN_Y + 0.012, sz + pz),
  ];

  g.add(
    new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(outline),
      new THREE.LineBasicMaterial({
        color: getPlanPalette().dimAlt,
        transparent: true,
        opacity: 0.92,
      }),
    ),
  );

  const nSteps = computeStairPlanRiserCount(stair, elementsById);
  const stepLen = len / nSteps;

  const runOffX = uxDir * stepLen;

  const runOffZ = uzDir * stepLen;

  for (let i = 0; i <= nSteps; i++) {
    const t = sx + uxDir * stepLen * i;

    const w = sz + uzDir * stepLen * i;

    const p1 = new THREE.Vector3(t + px, PLAN_Y + 0.018, w + pz);

    const p2 = new THREE.Vector3(t - px, PLAN_Y + 0.018, w - pz);

    g.add(
      new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([p1, p2]),
        new THREE.LineBasicMaterial({
          color: getPlanPalette().hairline,
          transparent: true,
          opacity: 0.55,
        }),
      ),
    );

    if (i < nSteps) {
      const c1 = new THREE.Vector3(
        t + runOffX + px * 0.15,
        PLAN_Y + 0.018,
        w + runOffZ + pz * 0.15,
      );

      const c2 = new THREE.Vector3(
        t + runOffX - px * 0.15,
        PLAN_Y + 0.018,
        w + runOffZ - pz * 0.15,
      );

      g.add(
        new THREE.Line(
          new THREE.BufferGeometry().setFromPoints([c1, c2]),
          new THREE.LineBasicMaterial({
            color: getPlanPalette().hairlineStrong,
            transparent: true,
            opacity: 0.45,
          }),
        ),
      );
    }
  }

  if (wireDoc) {
    const mx = (sx + ex) * 0.5;
    const mz = (sz + ez) * 0.5;
    const yDoc = PLAN_Y + 0.024;
    let bx = uxDir;
    let bz = uzDir;
    if (
      wireDoc.runBearingDegCcFromPlanX !== undefined &&
      Number.isFinite(wireDoc.runBearingDegCcFromPlanX)
    ) {
      const rad = (wireDoc.runBearingDegCcFromPlanX * Math.PI) / 180;
      bx = Math.cos(rad);
      bz = Math.sin(rad);
    }
    const alen = Math.min(len, 0.55) * 0.35;
    const tip = new THREE.Vector3(mx + bx * alen * 0.45, yDoc, mz + bz * alen * 0.45);
    const tail = new THREE.Vector3(mx - bx * alen * 0.55, yDoc, mz - bz * alen * 0.55);
    const arrMat = new THREE.LineBasicMaterial({
      color: getPlanPalette().dimLine,
      transparent: true,
      opacity: 0.88,
    });
    g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([tail, tip]), arrMat));
    const perpX = -bz * 0.06;
    const perpZ = bx * 0.06;
    const b1 = new THREE.Vector3(tip.x - bx * 0.12 + perpX, yDoc, tip.z - bz * 0.12 + perpZ);
    const b2 = new THREE.Vector3(tip.x - bx * 0.12 - perpX, yDoc, tip.z - bz * 0.12 - perpZ);
    g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([tip, b1]), arrMat));
    g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([tip, b2]), arrMat));

    const ph = wireDoc.stairDocumentationPlaceholders_v0;
    if (ph?.bottomLandingFootprintBoundsMm && ph?.topLandingFootprintBoundsMm) {
      const yLand = PLAN_Y + 0.021;
      const landMat = new THREE.LineBasicMaterial({
        color: getPlanPalette().windowFillBackline,
        transparent: true,
        opacity: 0.52,
      });
      for (const b of [ph.bottomLandingFootprintBoundsMm, ph.topLandingFootprintBoundsMm]) {
        const x0 = b.minXmMm / 1000;
        const x1 = b.maxXmMm / 1000;
        const z0 = b.minYmMm / 1000;
        const z1 = b.maxYmMm / 1000;
        const ring = [
          new THREE.Vector3(x0, yLand, z0),
          new THREE.Vector3(x1, yLand, z0),
          new THREE.Vector3(x1, yLand, z1),
          new THREE.Vector3(x0, yLand, z1),
          new THREE.Vector3(x0, yLand, z0),
        ];
        g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(ring), landMat));
      }
    }

    const ann =
      wireDoc.stairPlanSectionDocumentationLabel?.trim() || wireDoc.planUpDownLabel?.trim();
    if (ann) {
      const lx = sx + uxDir * Math.min(len * 0.2, 0.35);
      const lz = sz + uzDir * Math.min(len * 0.2, 0.35);
      const tagScale = wireDoc.stairPlanSectionDocumentationLabel ? 0.62 : 0.85;
      g.add(planAnnotationLabelSprite(lx, lz, ann, stair.id, tagScale));
    }

    if (wireDoc.stairPlanBreakVisibilityToken === 'cutSplitsSpan') {
      const zx = mx - bz * (stair.widthMm / 2000) * 0.35;
      const zz = mz + bx * (stair.widthMm / 2000) * 0.35;
      const zig = 0.04;
      const p0 = new THREE.Vector3(zx - bx * zig, PLAN_Y + 0.026, zz - bz * zig);
      const p1 = new THREE.Vector3(zx + bx * zig, PLAN_Y + 0.026, zz + bz * zig);
      const p2 = new THREE.Vector3(zx + bx * zig * 2, PLAN_Y + 0.026, zz + bz * zig * 2);
      const brkMat = new THREE.LineBasicMaterial({
        color: getPlanPalette().dimWitness,
        transparent: true,
        opacity: 0.7,
      });
      g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([p0, p1]), brkMat));
      g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([p1, p2]), brkMat));
    }
  }

  g.userData.bimPickId = stair.id;

  return g;
}

export function roomMesh(
  room: Extract<Element, { kind: 'room' }>,
  presentation?: PlanPresentationPreset,
  opts?: { schemeColorHex?: string; roomFillOpacityScale?: number },
): THREE.Mesh {
  const scheme = presentation ?? 'default';

  const shape = new THREE.Shape();

  const o = room.outlineMm[0];

  if (!o) return new THREE.Mesh();

  // Shape lives in XY; rotate mesh −90°X so planar Y aligns with world −Z.

  shape.moveTo(ux(o.xMm), -uz(o.yMm));

  for (let i = 1; i < room.outlineMm.length; i++) {
    const p = room.outlineMm[i];

    if (p) shape.lineTo(ux(p.xMm), -uz(p.yMm));
  }

  shape.closePath();

  const geo = new THREE.ShapeGeometry(shape);

  const seed =
    typeof room.programmeCode === 'string' && room.programmeCode.trim()
      ? room.programmeCode.trim()
      : room.id;

  const fill =
    scheme === 'room_scheme'
      ? {
          opacity: 0.34,

          color:
            opts?.schemeColorHex && /^#[0-9a-fA-F]{6}$/.test(opts.schemeColorHex)
              ? opts.schemeColorHex
              : deterministicSchemeColorHex(seed),
        }
      : scheme === 'opening_focus'
        ? { opacity: 0.045, color: getPlanPalette().regionFillStrong }
        : {
            opacity: 0.14,

            color: getPlanPalette().regionFill,
          };

  const scale = opts?.roomFillOpacityScale ?? 1;

  const mesh = new THREE.Mesh(
    geo,

    new THREE.MeshBasicMaterial({
      color: fill.color,

      transparent: true,

      opacity: THREE.MathUtils.clamp(fill.opacity * scale, 0, 1),

      depthWrite: false,
    }),
  );

  mesh.rotation.x = -Math.PI / 2;

  mesh.position.y = PLAN_Y;

  mesh.userData.bimPickId = room.id;

  const c = centroidMm(room.outlineMm);

  mesh.userData.roomLabel = {
    cx: ux(c.xMm),
    cz: uz(c.yMm),
    name: room.name,
    areaMm2: polygonAreaMm2(room.outlineMm),
  };

  return mesh;
}

export function planAnnotationLabelSprite(
  cxM: number,
  czM: number,
  text: string,
  pickId?: string,
  fontScale = 1,
): THREE.Sprite {
  const scaleMul = Number.isFinite(fontScale) && fontScale > 0 ? fontScale : 1;
  const trimmed = text.trim().slice(0, 96);
  const safe = trimmed.length ? trimmed : '—';

  const doc = typeof globalThis.document !== 'undefined' ? globalThis.document : null;
  const emptySprite = (): THREE.Sprite => {
    const mat = new THREE.SpriteMaterial({
      color: getPlanPalette().tagBg,
      transparent: true,
      opacity: 0.92,
    });
    const sprite = new THREE.Sprite(mat);
    sprite.position.set(cxM, PLAN_Y + 0.003, czM);
    sprite.scale.set(0.08 * scaleMul, 0.03 * scaleMul, 1);
    sprite.renderOrder = 10;
    sprite.userData.planAnnotationOverlay = true;
    if (pickId) sprite.userData.bimPickId = pickId;
    return sprite;
  };
  if (!doc?.createElement) return emptySprite();

  const viteMode =
    typeof import.meta !== 'undefined' &&
    typeof (import.meta as { env?: { MODE?: string } }).env?.MODE === 'string'
      ? (import.meta as { env: { MODE: string } }).env.MODE
      : '';
  if (viteMode === 'test') return emptySprite();

  const dpr =
    typeof (globalThis as { devicePixelRatio?: number }).devicePixelRatio === 'number'
      ? (globalThis as { devicePixelRatio: number }).devicePixelRatio
      : 1;
  const fontPx = Math.round(64 * Math.min(Math.max(dpr, 1), 2));
  const size = Math.max(Math.floor(fontPx * 1.125), 32);
  const ch = Math.max(Math.floor(fontPx * 1.5625), 36);

  const canvas = doc.createElement('canvas');
  canvas.width = size;
  canvas.height = ch;
  let ctx: CanvasRenderingContext2D | null = null;
  try {
    ctx = canvas.getContext('2d');
  } catch {
    ctx = null;
  }
  if (!ctx) return emptySprite();

  ctx.globalAlpha = 0.92;
  ctx.strokeStyle = 'rgba(255,255,255,0.78)';
  ctx.fillStyle = getPlanPalette().tagText;
  ctx.lineWidth = 4;
  const pad = Math.max(12, Math.floor(fontPx / 16));
  const r = pad * 1.05;
  const wBox = canvas.width - pad * 2;
  ctx.beginPath();
  ctx.moveTo(wBox + pad, canvas.height / 2);
  ctx.arcTo(canvas.width - pad + 1e-3, canvas.height / 2, canvas.width - pad, pad, r);
  ctx.arcTo(canvas.width - pad, pad + 1e-3, canvas.width / 2, pad, r);
  ctx.arcTo(pad + 1e-3, pad, pad, canvas.height / 2, r);
  ctx.arcTo(pad, canvas.height / 2, pad, canvas.height - pad, r);
  ctx.arcTo(pad + 1e-3, canvas.height - pad, canvas.width / 2, canvas.height - pad, r);
  ctx.arcTo(canvas.width - pad, canvas.height - pad, canvas.width - pad, canvas.height / 2, r);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.globalAlpha = 1;
  ctx.font = `600 ${fontPx}px system-ui,sans-serif`;
  // Inverse of tagText for high-contrast room/tag labels on the dark pill.
  ctx.fillStyle = readToken('--color-background', '#fafafa');
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  try {
    ctx.lineWidth = 3;
    ctx.strokeText(safe, canvas.width / 2, canvas.height / 2);
  } catch {
    /* strokeText unsupported in some canvas implementations */
  }
  ctx.fillText(safe, canvas.width / 2, canvas.height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  const mat = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: true,
    depthWrite: false,
  });
  const sprite = new THREE.Sprite(mat);
  sprite.position.set(cxM, PLAN_Y + 0.003, czM);
  sprite.scale.set(0.22 * scaleMul, 0.22 * (canvas.height / canvas.width) * scaleMul, 1);
  sprite.renderOrder = 10;
  sprite.userData.planAnnotationOverlay = true;
  if (pickId) sprite.userData.bimPickId = pickId;
  return sprite;
}

export function gridLineThree(g: Extract<Element, { kind: 'grid_line' }>): THREE.Group {
  const grp = new THREE.Group();

  const pts = [
    new THREE.Vector3(ux(g.start.xMm), PLAN_Y, uz(g.start.yMm)),

    new THREE.Vector3(ux(g.end.xMm), PLAN_Y, uz(g.end.yMm)),
  ];

  grp.add(
    new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(pts),

      new THREE.LineBasicMaterial({ color: getPlanPalette().dimWitness, linewidth: 2 }),
    ),
  );

  grp.userData.bimPickId = g.id;

  grp.userData.gridLabel = g.label;

  return grp;
}

export function dimensionsThree(d: Extract<Element, { kind: 'dimension' }>): THREE.LineSegments {
  const a = new THREE.Vector3(ux(d.aMm.xMm), PLAN_Y + 0.002, uz(d.aMm.yMm));

  const b = new THREE.Vector3(ux(d.bMm.xMm), PLAN_Y + 0.002, uz(d.bMm.yMm));

  const off = new THREE.Vector3(ux(d.offsetMm.xMm), 0, uz(d.offsetMm.yMm));

  const aa = a.clone().add(off);

  const bb = b.clone().add(off);

  const arr = [
    ...a.toArray(),
    ...aa.toArray(),
    ...aa.toArray(),
    ...bb.toArray(),
    ...bb.toArray(),
    ...b.toArray(),
  ];

  const geo = new THREE.BufferGeometry();

  geo.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));

  const dimSpanMm = Math.hypot(d.bMm.xMm - d.aMm.xMm, d.bMm.yMm - d.aMm.yMm);

  const ls = new THREE.LineSegments(
    geo,

    new THREE.LineBasicMaterial({ color: getPlanPalette().wallSelected }),
  );

  ls.userData.dimensionSpanMm = dimSpanMm;

  return ls;
}
