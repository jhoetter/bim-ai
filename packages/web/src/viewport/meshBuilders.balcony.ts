import * as THREE from 'three';
import type { Element } from '@bim-ai/core';

import type { ViewportPaintBundle } from './materials';
import { addEdges } from './sceneHelpers';
import { yawForPlanSegment } from './planSegmentOrientation';

/**
 * Issue #64 — MF-render-7: BalconyElem authored but not visible in any
 * cardinal capture. Root cause was that `makeBalconyMesh` silently returned
 * an empty `THREE.Group` whenever the host wall lookup failed (missing wall,
 * wrong `kind`, or a wall added to the scene after the balcony was authored).
 * The dispatcher still inserted that empty group into the scene, so no
 * geometry — not even wireframe edges — was ever rendered for the balcony.
 *
 * The fix:
 *   1. Emit a deduped `console.warn` whenever the geometry path bails out so
 *      future regressions are visible instead of silently invisible.
 *   2. When the wall is missing, still author a small placeholder slab at the
 *      balcony's declared elevation so the user has a visible witness (and
 *      can pick it up in the inspector) instead of staring at an empty hole
 *      on the facade.
 *
 * Issue #75 — MF-render-8: the (2) placeholder fallback was rendering as a
 * realistic-looking floating cantilever deck at the world origin, hugely
 * misleading on cardinal captures (looks like a real balcony with no host).
 * The fallback is now an INVISIBLE placeholder Group — geometry is still
 * authored at the balcony's declared elevation so the element is still
 * pickable, but every mesh has `visible = false` AND the group carries
 * `userData.isAuthoringPlaceholder = true` so dispatchers / hit-testers can
 * differentiate it from real balcony geometry. The deduped warn still fires.
 */
const _warnedBalconyEmptyIds = new Set<string>();

/** TEST-ONLY: reset the warning dedupe so tests can assert the warning fires. */
export function _resetEmptyBalconyWarningsForTests(): void {
  _warnedBalconyEmptyIds.clear();
}

function warnEmptyBalcony(id: string, reason: string): void {
  if (_warnedBalconyEmptyIds.has(id)) return;
  _warnedBalconyEmptyIds.add(id);
  console.warn(
    `[meshBuilders.balcony] balcony "${id}" produced no visible geometry: ${reason}. ` +
      `The balcony slab will not appear in any view. See issue #64.`,
  );
}

export function makeBalconyMesh(
  balcony: Extract<Element, { kind: 'balcony' }>,
  elementsById: Record<string, Element>,
  paint: ViewportPaintBundle | null,
): THREE.Group {
  const group = new THREE.Group();
  group.userData.bimPickId = balcony.id;

  const wall = elementsById[balcony.wallId];
  const wallOk = wall?.kind === 'wall';

  // Resolve plan-axis frame from the wall when possible; otherwise fall back
  // to a near-origin placeholder so the balcony still has *some* geometry in
  // the scene. The deduped warn below makes the misconfiguration visible.
  // Issue #75: the placeholder geometry must NOT be visible — it was being
  // mistaken for a real cantilever deck floating at the world origin. We tag
  // the group with `userData.isAuthoringPlaceholder = true` and mark every
  // mesh `visible = false` at the end of this function when wallOk is false.
  let sx: number;
  let sz: number;
  let dx: number;
  let dz: number;
  if (wallOk) {
    sx = wall.start.xMm / 1000;
    sz = wall.start.yMm / 1000;
    const ex = wall.end.xMm / 1000;
    const ez = wall.end.yMm / 1000;
    dx = ex - sx;
    dz = ez - sz;
  } else {
    warnEmptyBalcony(
      balcony.id,
      `host wall "${balcony.wallId}" missing or not a wall element (invisible placeholder rendered — see issue #75)`,
    );
    group.userData.isAuthoringPlaceholder = true;
    // Placeholder span: a 1m wide deck floating at the balcony's elevation.
    sx = 0;
    sz = 0;
    dx = 1;
    dz = 0;
  }

  const lenRaw = Math.hypot(dx, dz);
  if (!Number.isFinite(lenRaw) || lenRaw < 0.001) {
    warnEmptyBalcony(
      balcony.id,
      `host wall "${balcony.wallId}" has degenerate length (lenRaw=${lenRaw})`,
    );
  }
  const len = Math.max(0.001, Number.isFinite(lenRaw) ? lenRaw : 0.001);
  const ux = dx / len;
  const uz = dz / len;
  const nx = uz;
  const nz = -ux;
  const yaw = yawForPlanSegment(dx, dz);

  const elevM = Number.isFinite(balcony.elevationMm) ? balcony.elevationMm / 1000 : 0;
  const projM = THREE.MathUtils.clamp((balcony.projectionMm ?? 650) / 1000, 0.1, 3);
  const slabH = THREE.MathUtils.clamp((balcony.slabThicknessMm ?? 150) / 1000, 0.05, 0.5);
  const balH = THREE.MathUtils.clamp((balcony.balustradeHeightMm ?? 1050) / 1000, 0, 2);

  const slabCy = elevM - slabH / 2;
  const slabCx = sx + dx / 2 + (nx * projM) / 2;
  const slabCz = sz + dz / 2 + (nz * projM) / 2;
  const slabMat = new THREE.MeshStandardMaterial({
    color: '#a87a44',
    roughness: 0.85,
    envMapIntensity: 0.15,
  });
  const slab = new THREE.Mesh(new THREE.BoxGeometry(len, slabH, projM), slabMat);
  slab.position.set(slabCx, slabCy, slabCz);
  slab.rotation.y = yaw;
  addEdges(slab);
  group.add(slab);

  if (balH > 0.01) {
    const glassMat = new THREE.MeshStandardMaterial({
      color: 0xb0d8e8,
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
      roughness: 0.05,
      metalness: 0.05,
      envMapIntensity: 0.5,
      side: THREE.DoubleSide,
    });
    const balThick = 0.025;
    const outerCx = sx + dx / 2 + nx * projM;
    const outerCz = sz + dz / 2 + nz * projM;
    const balGlass = new THREE.Mesh(new THREE.BoxGeometry(len, balH, balThick), glassMat);
    balGlass.position.set(outerCx, elevM + balH / 2, outerCz);
    balGlass.rotation.y = yaw;
    addEdges(balGlass);
    group.add(balGlass);
  }

  // Defensive: if for any reason the group still ended up empty, log so future
  // regressions in this builder are surfaced rather than silently invisible.
  if (group.children.length === 0) {
    warnEmptyBalcony(balcony.id, 'group has zero children after build');
  }

  // Issue #75: when the host wall is missing, hide every mesh in the group so
  // the placeholder is not mistaken for real balcony geometry. We still keep
  // the meshes (with the placeholder flag set above) so the element remains
  // selectable in the inspector.
  if (!wallOk) {
    group.visible = false;
    group.traverse((node) => {
      node.visible = false;
    });
  }

  void paint;
  return group;
}
