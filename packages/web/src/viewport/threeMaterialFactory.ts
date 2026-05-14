import * as THREE from 'three';
import type { Element } from '@bim-ai/core';

import { resolveMaterial, type MaterialPbrSpec } from './materials';
import { createProceduralMaterialMaps } from './proceduralMaterials';

export type ThreeMaterialUsage =
  | 'wallExterior'
  | 'wallInterior'
  | 'floorTop'
  | 'roofTop'
  | 'openingFrame'
  | 'structural'
  | 'mass'
  | 'generic';

export type MaterialTextureKind =
  | 'albedo'
  | 'normal'
  | 'bump'
  | 'roughness'
  | 'metalness'
  | 'height';

export type MaterialUvTransform = {
  repeat?: { u: number; v: number };
  offset?: { u: number; v: number };
  rotationRad?: number;
  wrapS?: THREE.Wrapping;
  wrapT?: THREE.Wrapping;
};

export type MaterialTextureManagerOptions = {
  loader?: Pick<THREE.TextureLoader, 'load'>;
  maxAnisotropy?: number;
  assetUrlResolver?: (assetIdOrUrl: string) => string;
};

export type ThreeMaterialFactoryOptions = {
  elementsById?: Record<string, Element>;
  usage?: ThreeMaterialUsage;
  fallbackColor?: string;
  fallbackRoughness?: number;
  fallbackMetalness?: number;
  fallbackPaint?: { color?: string; roughness?: number; metalness?: number } | null;
  side?: THREE.Side;
  depthWrite?: boolean;
  transparent?: boolean;
  opacity?: number;
  uvTransform?: MaterialUvTransform;
  textureManager?: MaterialTextureManager;
};

export type MaterialUvExtent = {
  uMm: number;
  vMm: number;
};

type LegacyFactoryOptions = {
  fallbackRoughness?: number;
  fallbackMetalness?: number;
};

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function stableTransformKey(transform: MaterialUvTransform | undefined): string {
  if (!transform) return 'default';
  return [
    transform.repeat ? `${transform.repeat.u}:${transform.repeat.v}` : '',
    transform.offset ? `${transform.offset.u}:${transform.offset.v}` : '',
    transform.rotationRad ?? '',
    transform.wrapS ?? '',
    transform.wrapT ?? '',
  ].join('|');
}

function defaultAssetUrlResolver(assetIdOrUrl: string): string {
  if (/^(https?:|data:|blob:|\/)/.test(assetIdOrUrl)) return assetIdOrUrl;
  return `/materials/${assetIdOrUrl}`;
}

function defaultUvScaleFor(spec: MaterialPbrSpec | null): MaterialUvExtent | null {
  switch (spec?.category) {
    case 'brick':
      return { uMm: 215, vMm: 75 };
    case 'timber':
      return { uMm: 1200, vMm: 180 };
    case 'stone':
      return { uMm: 600, vMm: 300 };
    case 'metal_roof':
      return { uMm: 600, vMm: 1000 };
    case 'concrete':
    case 'plaster':
    case 'render':
      return { uMm: 1000, vMm: 1000 };
    default:
      return spec?.uvScaleMm ?? null;
  }
}

export function materialUvTransformForExtent(
  materialKey: string | null | undefined,
  options: {
    elementsById?: Record<string, Element>;
    extentMm: MaterialUvExtent;
  },
): MaterialUvTransform | undefined {
  const spec = resolveMaterial(materialKey, options.elementsById);
  const scale = spec?.uvScaleMm ?? defaultUvScaleFor(spec);
  if (!scale || scale.uMm <= 0 || scale.vMm <= 0) return undefined;
  return {
    repeat: {
      u: Math.max(1e-6, options.extentMm.uMm / scale.uMm),
      v: Math.max(1e-6, options.extentMm.vMm / scale.vMm),
    },
    offset: spec?.uvOffsetMm
      ? {
          u: spec.uvOffsetMm.uMm / scale.uMm,
          v: spec.uvOffsetMm.vMm / scale.vMm,
        }
      : undefined,
    rotationRad:
      typeof spec?.uvRotationDeg === 'number' ? THREE.MathUtils.degToRad(spec.uvRotationDeg) : 0,
  };
}

export function applyMaterialUvTransform(
  texture: THREE.Texture,
  transform?: MaterialUvTransform,
): THREE.Texture {
  texture.wrapS = transform?.wrapS ?? THREE.RepeatWrapping;
  texture.wrapT = transform?.wrapT ?? THREE.RepeatWrapping;
  if (transform?.repeat) texture.repeat.set(transform.repeat.u, transform.repeat.v);
  if (transform?.offset) texture.offset.set(transform.offset.u, transform.offset.v);
  if (typeof transform?.rotationRad === 'number') {
    texture.center.set(0.5, 0.5);
    texture.rotation = transform.rotationRad;
  }
  return texture;
}

export class MaterialTextureManager {
  private readonly loader: Pick<THREE.TextureLoader, 'load'>;
  private readonly cache = new Map<string, THREE.Texture>();
  private readonly maxAnisotropy: number;
  private readonly assetUrlResolver: (assetIdOrUrl: string) => string;

  constructor(options: MaterialTextureManagerOptions = {}) {
    this.loader = options.loader ?? new THREE.TextureLoader();
    this.maxAnisotropy = Math.max(1, options.maxAnisotropy ?? 1);
    this.assetUrlResolver = options.assetUrlResolver ?? defaultAssetUrlResolver;
  }

  load(
    assetIdOrUrl: string | null | undefined,
    kind: MaterialTextureKind,
    transform?: MaterialUvTransform,
  ): THREE.Texture | null {
    if (!assetIdOrUrl) return null;
    const url = this.assetUrlResolver(assetIdOrUrl);
    const key = `${kind}:${url}:${stableTransformKey(transform)}`;
    const cached = this.cache.get(key);
    if (cached) return cached;

    const texture = this.loader.load(url);
    texture.name = assetIdOrUrl;
    texture.colorSpace = kind === 'albedo' ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    applyMaterialUvTransform(texture, transform);
    texture.anisotropy = this.maxAnisotropy;
    this.cache.set(key, texture);
    return texture;
  }

  dispose(): void {
    for (const texture of this.cache.values()) texture.dispose();
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }
}

export const defaultMaterialTextureManager = new MaterialTextureManager();

function envMapIntensityFor(spec: MaterialPbrSpec | null, usage: ThreeMaterialUsage): number {
  if (!spec) return usage === 'structural' ? 0.75 : 1;
  if (spec.category === 'glass') return 1.2;
  if (spec.category === 'render' || spec.category === 'cladding') return 0.15;
  if (usage === 'openingFrame' || usage === 'structural') return 0.45;
  return 1;
}

function isPhysicalMaterial(spec: MaterialPbrSpec | null, opacity: number): boolean {
  return !!spec && (spec.category === 'glass' || opacity < 1);
}

function normalizeOptions(
  fallbackColorOrOptions: string | ThreeMaterialFactoryOptions | undefined,
  maybeOptions: LegacyFactoryOptions | ThreeMaterialFactoryOptions,
): ThreeMaterialFactoryOptions {
  if (typeof fallbackColorOrOptions === 'string' || fallbackColorOrOptions == null) {
    const opts = maybeOptions as ThreeMaterialFactoryOptions;
    return { ...opts, fallbackColor: fallbackColorOrOptions ?? opts.fallbackColor };
  }
  return fallbackColorOrOptions;
}

export function makeThreeMaterialForKey(
  materialKey: string | null | undefined,
  fallbackColorOrOptions: string | ThreeMaterialFactoryOptions = '#cccccc',
  maybeOptions: LegacyFactoryOptions | ThreeMaterialFactoryOptions = {},
): THREE.Material {
  const opts = normalizeOptions(fallbackColorOrOptions, maybeOptions);
  const usage = opts.usage ?? 'generic';
  const spec = resolveMaterial(materialKey, opts.elementsById);
  const manager = opts.textureManager ?? defaultMaterialTextureManager;
  const fallbackColor = opts.fallbackColor ?? opts.fallbackPaint?.color ?? '#cccccc';
  const roughness = clamp01(
    spec?.roughness ?? opts.fallbackRoughness ?? opts.fallbackPaint?.roughness ?? 0.7,
  );
  const metalness = clamp01(
    spec?.metalness ?? opts.fallbackMetalness ?? opts.fallbackPaint?.metalness ?? 0,
  );
  const opacity = clamp01(opts.opacity ?? (spec?.category === 'glass' ? 0.38 : 1));
  const side = opts.side ?? (spec?.category === 'glass' ? THREE.DoubleSide : THREE.FrontSide);
  const depthWrite = opts.depthWrite ?? !(spec?.category === 'glass' || opacity < 1);
  const transparent = (opts.transparent ?? spec?.category === 'glass') || opacity < 1;
  const color = new THREE.Color(spec?.baseColor ?? fallbackColor);
  const proceduralMaps =
    spec && !spec.textureMapUrl ? createProceduralMaterialMaps(spec, opts.uvTransform) : null;
  const map = manager.load(spec?.textureMapUrl, 'albedo', opts.uvTransform) ?? proceduralMaps?.map;
  const normalMap = manager.load(spec?.normalMapUrl, 'normal', opts.uvTransform);
  const bumpMap = normalMap
    ? null
    : (manager.load(spec?.bumpMapUrl, 'bump', opts.uvTransform) ?? proceduralMaps?.bumpMap);
  const roughnessMap =
    manager.load(spec?.roughnessMapUrl, 'roughness', opts.uvTransform) ??
    proceduralMaps?.roughnessMap;
  const metalnessMap = manager.load(spec?.metalnessMapUrl, 'metalness', opts.uvTransform);

  const common: THREE.MeshStandardMaterialParameters = {
    color,
    roughness,
    metalness,
    side,
    transparent,
    opacity,
    depthWrite,
    envMapIntensity: envMapIntensityFor(spec, usage),
  };
  if (map) common.map = map;
  if (roughnessMap) common.roughnessMap = roughnessMap;
  if (metalnessMap) common.metalnessMap = metalnessMap;
  if (normalMap) common.normalMap = normalMap;
  if (bumpMap) common.bumpMap = bumpMap;

  const material = isPhysicalMaterial(spec, opacity)
    ? new THREE.MeshPhysicalMaterial({
        ...common,
        transmission: spec?.category === 'glass' ? (spec.key.includes('spandrel') ? 0.35 : 0.9) : 0,
        thickness: spec?.category === 'glass' ? 0.012 : 0,
        ior: spec?.category === 'glass' ? 1.5 : 1.45,
      })
    : new THREE.MeshStandardMaterial(common);

  material.userData.materialKey = materialKey ?? null;
  material.userData.materialUsage = usage;
  material.userData.materialResolved = !!spec;
  return material;
}
