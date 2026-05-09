import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { liveTokenReader, type ElementCategoryToken, type ViewportPaintBundle } from './materials';

export const CATEGORY_FALLBACK_COLOR_HEX = '#cbd5e1';

export function categoryColorOr(
  bundle: ViewportPaintBundle | null,
  cat: ElementCategoryToken,
): string {
  return bundle?.categories[cat]?.color ?? CATEGORY_FALLBACK_COLOR_HEX;
}

export function readToken(name: string, fallback: string): string {
  const v = liveTokenReader().read(name);
  return v && v.trim().length > 0 ? v : fallback;
}

/** Resolve a CSS color token to an rgb() string that Three.js can parse.
 * CSS Color Level 4 hsl() uses spaces (e.g. "hsl(0 0% 100%)") which
 * Three.js does not support — routing through a DOM element forces the
 * browser to resolve it to "rgb(r, g, b)". */
export function readColorToken(name: string, fallback: string): string {
  if (typeof document === 'undefined') return fallback;
  try {
    const el = document.createElement('div');
    el.style.display = 'none';
    el.style.color = `var(${name}, ${fallback})`;
    document.body.appendChild(el);
    const resolved = getComputedStyle(el).color;
    document.body.removeChild(el);
    return resolved || fallback;
  } catch {
    return fallback;
  }
}

export function sunPositionFromAzEl(
  azimuthDeg: number,
  elevationDeg: number,
  radiusM = 80,
): THREE.Vector3 {
  const az = THREE.MathUtils.degToRad(azimuthDeg);
  const el = THREE.MathUtils.degToRad(elevationDeg);
  return new THREE.Vector3(
    radiusM * Math.cos(el) * Math.sin(az),
    radiusM * Math.sin(el),
    radiusM * Math.cos(el) * Math.cos(az),
  );
}

export function buildSkyEnvMap(
  renderer: THREE.WebGLRenderer,
  azimuthDeg: number,
  elevationDeg: number,
): THREE.Texture {
  const sky = new Sky();
  sky.scale.setScalar(450000);
  const u = sky.material.uniforms;
  u['turbidity'].value = 3;
  u['rayleigh'].value = 0.5;
  u['mieCoefficient'].value = 0.005;
  u['mieDirectionalG'].value = 0.8;
  const phi = THREE.MathUtils.degToRad(90 - elevationDeg);
  const theta = THREE.MathUtils.degToRad(azimuthDeg);
  u['sunPosition'].value.setFromSphericalCoords(1, phi, theta);
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  const tempScene = new THREE.Scene();
  tempScene.add(sky);
  const envTexture = pmrem.fromScene(tempScene).texture;
  pmrem.dispose();
  (sky.material as THREE.ShaderMaterial).dispose();
  sky.geometry.dispose();
  return envTexture;
}

export function addEdges(mesh: THREE.Mesh, thresholdAngleDeg = 20): THREE.LineSegments {
  const color = readToken('--draft-cut', '#1d2330');
  const edges = new THREE.EdgesGeometry(mesh.geometry, thresholdAngleDeg);
  const mat = new THREE.LineBasicMaterial({
    color,
    linewidth: 1,
    transparent: true,
    opacity: 0.38,
  });
  const lines = new THREE.LineSegments(edges, mat);
  lines.renderOrder = 1;
  lines.castShadow = false;
  lines.receiveShadow = false;
  mesh.add(lines);
  return lines;
}
