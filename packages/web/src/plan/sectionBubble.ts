/**
 * Section view head bubbles — §6.1.6
 *
 * Builds THREE.js bubble meshes (filled circles) at both endpoints of a
 * section cut line in the plan view.
 */
import * as THREE from 'three';

import type { Element } from '@bim-ai/core';

import { PLAN_Y, ux, uz } from './symbology';

/** Radius of the head bubble in scene units (200 mm = 0.2 m). */
export const SECTION_BUBBLE_RADIUS = 0.2;

/** Default bubble colour (dark blue, matching Revit convention). */
export const SECTION_BUBBLE_COLOR = '#1d4ed8';

/**
 * Build a group containing two bubble meshes — one at each endpoint of the
 * section cut line.  The arrowhead end (= lineEndMm by convention) gets a
 * filled circle; the reference/tail end (= lineStartMm) gets an unfilled
 * (wire-frame) circle.
 *
 * Returned meshes carry `userData` that tests can inspect:
 *   - `sectionBubble: true`
 *   - `sectionViewId: string` (the section_cut element id)
 *   - `bubbleEnd: 'arrow' | 'tail'`
 */
export function sectionCutBubbles(
  sc: Extract<Element, { kind: 'section_cut' }>,
  colorHex: string = SECTION_BUBBLE_COLOR,
): THREE.Group {
  const grp = new THREE.Group();
  grp.userData.sectionBubblesFor = sc.id;

  const Y = PLAN_Y + 0.003;

  const endpoints: Array<{ xMm: number; yMm: number; end: 'tail' | 'arrow' }> = [
    { xMm: sc.lineStartMm.xMm, yMm: sc.lineStartMm.yMm, end: 'tail' },
    { xMm: sc.lineEndMm.xMm, yMm: sc.lineEndMm.yMm, end: 'arrow' },
  ];

  for (const { xMm, yMm, end } of endpoints) {
    const worldX = ux(xMm);
    const worldZ = uz(yMm);

    if (end === 'arrow') {
      // Filled bubble at the arrowhead end
      const geo = new THREE.CircleGeometry(SECTION_BUBBLE_RADIUS, 16);
      const mat = new THREE.MeshBasicMaterial({ color: colorHex, side: THREE.DoubleSide });
      const bubble = new THREE.Mesh(geo, mat);
      bubble.position.set(worldX, Y, worldZ);
      bubble.rotation.x = -Math.PI / 2;
      bubble.userData.sectionBubble = true;
      bubble.userData.sectionViewId = sc.id;
      bubble.userData.bubbleEnd = 'arrow';
      grp.add(bubble);
    } else {
      // Open (ring) bubble at the tail / reference end
      const geo = new THREE.RingGeometry(SECTION_BUBBLE_RADIUS * 0.82, SECTION_BUBBLE_RADIUS, 16);
      const mat = new THREE.MeshBasicMaterial({
        color: colorHex,
        side: THREE.DoubleSide,
      });
      const bubble = new THREE.Mesh(geo, mat);
      bubble.position.set(worldX, Y, worldZ);
      bubble.rotation.x = -Math.PI / 2;
      bubble.userData.sectionBubble = true;
      bubble.userData.sectionViewId = sc.id;
      bubble.userData.bubbleEnd = 'tail';
      grp.add(bubble);
    }
  }

  return grp;
}
