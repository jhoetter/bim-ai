import * as THREE from 'three';

import type { MaterialPbrSpec } from './materials';
import type { MaterialUvTransform } from './threeMaterialFactory';

export type ProceduralMaterialMaps = {
  map: THREE.DataTexture;
  bumpMap: THREE.DataTexture;
  roughnessMap: THREE.DataTexture;
};

const cache = new Map<string, ProceduralMaterialMaps>();

function hash2(x: number, y: number, seed: number): number {
  let n = x * 374761393 + y * 668265263 + seed * 2147483647;
  n = (n ^ (n >> 13)) * 1274126177;
  return ((n ^ (n >> 16)) >>> 0) / 4294967295;
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const value = Number.parseInt(
    clean.length === 3
      ? clean
          .split('')
          .map((ch) => `${ch}${ch}`)
          .join('')
      : clean,
    16,
  );
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function clampByte(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function put(data: Uint8Array, index: number, r: number, g: number, b: number, a = 255): void {
  data[index] = clampByte(r);
  data[index + 1] = clampByte(g);
  data[index + 2] = clampByte(b);
  data[index + 3] = clampByte(a);
}

function transformKey(transform?: MaterialUvTransform): string {
  return JSON.stringify(transform ?? {});
}

function cacheKey(spec: MaterialPbrSpec, size: number, transform?: MaterialUvTransform): string {
  return `${spec.key}:${spec.category}:${size}:${transformKey(transform)}`;
}

function applyTransform(texture: THREE.DataTexture, transform?: MaterialUvTransform): void {
  texture.wrapS = transform?.wrapS ?? THREE.RepeatWrapping;
  texture.wrapT = transform?.wrapT ?? THREE.RepeatWrapping;
  if (transform?.repeat) texture.repeat.set(transform.repeat.u, transform.repeat.v);
  if (transform?.offset) texture.offset.set(transform.offset.u, transform.offset.v);
  if (typeof transform?.rotationRad === 'number') {
    texture.center.set(0.5, 0.5);
    texture.rotation = transform.rotationRad;
  }
}

function makeTexture(
  name: string,
  data: Uint8Array,
  size: number,
  colorSpace: THREE.ColorSpace,
  transform?: MaterialUvTransform,
): THREE.DataTexture {
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  texture.name = name;
  texture.colorSpace = colorSpace;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  applyTransform(texture, transform);
  return texture;
}

export function createProceduralMaterialMaps(
  spec: MaterialPbrSpec | null,
  transform?: MaterialUvTransform,
  size = 256,
): ProceduralMaterialMaps | null {
  if (!spec || spec.category === 'glass' || spec.category === 'air') return null;
  const key = cacheKey(spec, size, transform);
  const cached = cache.get(key);
  if (cached) return cached;

  const albedo = new Uint8Array(size * size * 4);
  const bump = new Uint8Array(size * size * 4);
  const roughness = new Uint8Array(size * size * 4);
  const [baseR, baseG, baseB] = hexToRgb(spec.baseColor);
  const seed = [...spec.key].reduce((sum, ch) => sum + ch.charCodeAt(0), 0);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const nx = x / size;
      const ny = y / size;
      let variation = (hash2(x >> 1, y >> 1, seed) - 0.5) * 10;
      let height = 128;
      let rough = spec.roughness * 255;

      if (spec.category === 'brick') {
        const brickW = size / 4;
        const brickH = size / 8;
        const row = Math.floor(y / brickH);
        const localX = (x + (row % 2) * (brickW / 2)) % brickW;
        const localY = y % brickH;
        const mortar = localX < 2 || localY < 2;
        variation += mortar ? 18 : (hash2(row, Math.floor(localX / 4), seed) - 0.5) * 14;
        height = mortar ? 74 : 176;
        rough = mortar ? 235 : 215;
      } else if (spec.category === 'timber') {
        const grain = Math.sin((nx * 20 + hash2(0, y, seed) * 2) * Math.PI);
        variation += grain * 18 + (hash2(x >> 2, y, seed) - 0.5) * 10;
        height = 132 + grain * 34;
        rough = 170 + Math.abs(grain) * 24;
      } else if (spec.category === 'cladding') {
        const boardEdge = x < 3 || x >= size - 3;
        const grain = Math.sin((ny * 18 + hash2(x >> 4, 0, seed) * 1.5) * Math.PI);
        const boardTone = (hash2(x >> 4, 0, seed) - 0.5) * 30;
        const slowTone = (hash2(x >> 5, y >> 5, seed) - 0.5) * 9;
        variation += boardEdge ? -42 : boardTone + slowTone + grain * 7;
        height = boardEdge ? 52 : 148 + grain * 12;
        rough = boardEdge ? 242 : 196 + Math.abs(grain) * 18;
      } else if (spec.category === 'concrete' || spec.category === 'render') {
        variation += (hash2(x >> 1, y >> 1, seed) - 0.5) * 14;
        height = 124 + (hash2(x, y, seed) - 0.5) * 18;
        rough = 220 + (hash2(x >> 2, y >> 2, seed) - 0.5) * 12;
      } else if (spec.category === 'stone') {
        const blockX = Math.floor(nx * 5);
        const blockY = Math.floor(ny * 4);
        const joint = x % Math.floor(size / 5) < 2 || y % Math.floor(size / 4) < 2;
        variation += (hash2(blockX, blockY, seed) - 0.5) * 42;
        height = joint ? 82 : 158 + (hash2(x, y, seed) - 0.5) * 24;
        rough = joint ? 230 : 190;
      } else if (spec.category === 'metal_roof') {
        const seam = x % Math.max(4, Math.floor(size / 8)) < 2;
        variation += seam ? 34 : Math.sin(nx * Math.PI * 10) * 6;
        height = seam ? 210 : 126;
        rough = 115;
      } else if (spec.category === 'plaster') {
        variation += (hash2(x, y, seed) - 0.5) * 8;
        height = 128 + (hash2(x, y, seed) - 0.5) * 8;
        rough = 230;
      }

      put(albedo, i, baseR + variation, baseG + variation, baseB + variation);
      put(bump, i, height, height, height);
      put(roughness, i, rough, rough, rough);
    }
  }

  const maps = {
    map: makeTexture(
      `${spec.key}:procedural:albedo`,
      albedo,
      size,
      THREE.SRGBColorSpace,
      transform,
    ),
    bumpMap: makeTexture(`${spec.key}:procedural:bump`, bump, size, THREE.NoColorSpace, transform),
    roughnessMap: makeTexture(
      `${spec.key}:procedural:roughness`,
      roughness,
      size,
      THREE.NoColorSpace,
      transform,
    ),
  };
  cache.set(key, maps);
  return maps;
}

export function clearProceduralMaterialCache(): void {
  for (const maps of cache.values()) {
    maps.map.dispose();
    maps.bumpMap.dispose();
    maps.roughnessMap.dispose();
  }
  cache.clear();
}
