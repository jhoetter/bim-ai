import * as THREE from 'three';
import type { Element } from '@bim-ai/core';
import { PLAN_Y } from './symbology';

type ToposolidElem = Extract<Element, { kind: 'toposolid' }>;

const CONTROL_POINT_COLOR = '#8B6914';
const CONTROL_POINT_RADIUS_MM = 150;

export function terrainControlPointsPlanThree(topo: ToposolidElem): THREE.Group {
  const group = new THREE.Group();
  group.userData.bimPickId = topo.id;

  const samples = topo.heightSamples;
  if (!samples || samples.length === 0) return group;

  const color = new THREE.Color(CONTROL_POINT_COLOR);

  for (let i = 0; i < samples.length; i++) {
    const s = samples[i]!;
    const r = CONTROL_POINT_RADIUS_MM / 1000;

    const geo = new THREE.CircleGeometry(r, 16);
    const mat = new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(s.xMm / 1000, PLAN_Y + 0.01, s.yMm / 1000);
    mesh.rotation.x = -Math.PI / 2;
    mesh.userData.bimPickId = topo.id;
    mesh.userData.heightSampleIndex = i;
    group.add(mesh);

    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 32;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = CONTROL_POINT_COLOR;
      ctx.font = 'bold 20px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(s.zMm), 32, 16);
    }
    const tex = new THREE.CanvasTexture(canvas);
    const spriteMat = new THREE.SpriteMaterial({ map: tex, depthTest: false });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.position.set(s.xMm / 1000, PLAN_Y + 0.02, s.yMm / 1000 - r * 1.8);
    sprite.scale.set(0.6, 0.3, 1);
    sprite.userData.bimPickId = topo.id;
    sprite.userData.heightSampleIndex = i;
    group.add(sprite);
  }

  return group;
}
