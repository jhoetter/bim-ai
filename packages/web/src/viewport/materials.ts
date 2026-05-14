/**
 * 3D viewport materials & lighting — spec §15.5.
 *
 * Centralised material + light spec resolved from CSS tokens. Token names
 * come from `@bim-ai/design-tokens/tokens-drafting.css` so a theme switch
 * triggers a deterministic rebuild from the live `:root` computed style.
 *
 * Three.js material/light objects are constructed inside Viewport.tsx —
 * this module returns plain JSON so it can be unit-tested without a
 * renderer (jsdom has no WebGL).
 */

import type { Element, MaterialElem } from '@bim-ai/core';

export type ElementCategoryToken =
  | 'wall'
  | 'floor'
  | 'roof'
  | 'door'
  | 'window'
  | 'stair'
  | 'railing'
  | 'room'
  | 'site'
  | 'section'
  | 'sheet'
  | 'slab_edge';

export interface CategoryMaterialSpec {
  category: ElementCategoryToken;
  /** CSS color string sourced from the corresponding `--cat-*` token. */
  color: string;
  roughness: number;
  metalness: number;
  /** Ambient occlusion strength baked into the material. */
  aoIntensity: number;
}

export interface LightingSpec {
  /** DirectionalLight aligned to project north. */
  sun: {
    intensity: number;
    azimuthDeg: number;
    elevationDeg: number;
    /** sRGB hex string. */
    color: string;
    shadowMapSize: number;
  };
  /** Hemisphere light split between sky and ground. */
  hemi: {
    intensity: number;
    skyColor: string;
    groundColor: string;
  };
  ssao: {
    kernelRadius: number;
    minDistance: number;
    maxDistance: number;
  };
}

export interface SelectionSpec {
  /** Edge color used for the selected element overlay (`--color-accent`). */
  selectedColor: string;
  selectedLineWidth: number;
  /** Edge color for the hover halo (`--draft-hover`). */
  hoverColor: string;
  hoverLineWidth: number;
}

const CATEGORY_TOKEN: Record<ElementCategoryToken, string> = {
  wall: '--cat-wall',
  floor: '--cat-floor',
  roof: '--cat-roof',
  door: '--cat-door',
  window: '--cat-window',
  stair: '--cat-stair',
  railing: '--cat-railing',
  room: '--cat-room',
  site: '--cat-site',
  section: '--cat-section',
  sheet: '--cat-sheet',
  slab_edge: '--cat-slab-edge',
};

const FALLBACK_CATEGORY_COLOR: Record<ElementCategoryToken, string> = {
  wall: '#ddd8d0',
  floor: '#cfc9be',
  roof: 'hsl(0 18% 40%)',
  door: '#b8a898',
  window: 'hsl(213 60% 70%)',
  stair: '#c4bdb4',
  railing: '#a89e96',
  room: 'hsl(150 24% 86%)',
  site: 'hsl(80 20% 80%)',
  section: 'hsl(0 70% 50%)',
  sheet: 'hsl(220 6% 80%)',
  slab_edge: '#9a9a92',
};

export interface TokenReader {
  /** Read a CSS custom property from the live document. */
  read(token: string): string | null;
}

/** Default reader: pulls from `document.documentElement` computed style.
 * Tests inject a fake reader. */
export function liveTokenReader(): TokenReader {
  return {
    read(token: string): string | null {
      if (typeof document === 'undefined') return null;
      try {
        const value = getComputedStyle(document.documentElement).getPropertyValue(token).trim();
        return value || null;
      } catch {
        return null;
      }
    },
  };
}

export interface ResolveOptions {
  reader?: TokenReader;
  /** Active app theme, used to keep lighting physically plausible in dark UI mode. */
  theme?: 'light' | 'dark';
  /** Override the spec'd PBR defaults (used by tests). */
  roughness?: number;
  metalness?: number;
  aoIntensity?: number;
}

const DEFAULT_PBR = { roughness: 0.85, metalness: 0, aoIntensity: 0.4 } as const;

const PER_CATEGORY_PBR: Record<ElementCategoryToken, { roughness: number; metalness: number }> = {
  wall: { roughness: 0.92, metalness: 0.0 }, // warm matte plaster
  floor: { roughness: 0.88, metalness: 0.0 }, // polished concrete
  roof: { roughness: 0.85, metalness: 0.0 }, // clay tile
  door: { roughness: 0.72, metalness: 0.02 }, // brushed wood
  window: { roughness: 0.05, metalness: 0.08 }, // near-perfect glass
  stair: { roughness: 0.86, metalness: 0.0 }, // concrete stair
  railing: { roughness: 0.45, metalness: 0.35 }, // brushed metal
  room: { roughness: 0.85, metalness: 0.0 },
  site: { roughness: 0.95, metalness: 0.0 },
  section: { roughness: 0.85, metalness: 0.0 },
  sheet: { roughness: 0.85, metalness: 0.0 },
  slab_edge: { roughness: 0.6, metalness: 0.0 },
};

/** Resolve a category material spec from the live tokens.
 *
 * Falls back to the documented light-theme colors when a token is
 * missing (e.g. SSR / jsdom without a stylesheet attached). */
export function resolveCategoryMaterial(
  category: ElementCategoryToken,
  options: ResolveOptions = {},
): CategoryMaterialSpec {
  const reader = options.reader ?? liveTokenReader();
  const token = CATEGORY_TOKEN[category];
  const color = reader.read(token) ?? FALLBACK_CATEGORY_COLOR[category];

  const rawR = reader.read(`--cat-${category}-roughness`);
  const cssRoughness = rawR !== null && !Number.isNaN(parseFloat(rawR)) ? parseFloat(rawR) : null;

  const rawM = reader.read(`--cat-${category}-metalness`);
  const cssMetalness = rawM !== null && !Number.isNaN(parseFloat(rawM)) ? parseFloat(rawM) : null;

  return {
    category,
    color,
    roughness: options.roughness ?? cssRoughness ?? PER_CATEGORY_PBR[category].roughness,
    metalness: options.metalness ?? cssMetalness ?? PER_CATEGORY_PBR[category].metalness,
    aoIntensity: options.aoIntensity ?? DEFAULT_PBR.aoIntensity,
  };
}

export function resolveAllCategoryMaterials(
  options: ResolveOptions = {},
): Record<ElementCategoryToken, CategoryMaterialSpec> {
  const out = {} as Record<ElementCategoryToken, CategoryMaterialSpec>;
  for (const cat of Object.keys(CATEGORY_TOKEN) as ElementCategoryToken[]) {
    out[cat] = resolveCategoryMaterial(cat, options);
  }
  return out;
}

/** §15.5 sun + hemisphere lighting spec. */
export function resolveLighting(theme: 'light' | 'dark' = 'light'): LightingSpec {
  if (theme === 'dark') {
    return {
      sun: {
        intensity: 0.72,
        azimuthDeg: 145,
        elevationDeg: 35,
        color: '#f4f1e7',
        shadowMapSize: 2048,
      },
      hemi: {
        intensity: 0.42,
        skyColor: '#8ca8b6',
        groundColor: '#5b5547',
      },
      ssao: {
        kernelRadius: 0.14,
        minDistance: 0.001,
        maxDistance: 0.14,
      },
    };
  }
  return {
    sun: {
      // 35° elevation per spec; project-north azimuth handled by caller.
      intensity: 0.85,
      azimuthDeg: 145,
      elevationDeg: 35,
      color: '#fff8ec',
      shadowMapSize: 2048,
    },
    hemi: {
      intensity: 0.6,
      skyColor: '#cce8f4',
      groundColor: '#d4c9a8',
    },
    ssao: {
      kernelRadius: 0.12,
      minDistance: 0.001,
      maxDistance: 0.12,
    },
  };
}

/** §15.5 selection + hover edge overlay. Reads `--color-accent` and
 * `--draft-hover` from tokens. */
export function resolveSelection(options: ResolveOptions = {}): SelectionSpec {
  const reader = options.reader ?? liveTokenReader();
  const selectedColor = reader.read('--color-accent') ?? 'hsl(214 88% 50%)';
  const hoverColor =
    reader.read('--draft-hover') ?? 'color-mix(in srgb, hsl(214 88% 50%) 60%, hsl(0 0% 100%))';
  return {
    selectedColor,
    selectedLineWidth: 2,
    hoverColor,
    hoverLineWidth: 1,
  };
}

/** Convenience: read every paint a renderer needs to rebuild materials
 * after a theme switch. */
export interface ViewportPaintBundle {
  categories: Record<ElementCategoryToken, CategoryMaterialSpec>;
  lighting: LightingSpec;
  selection: SelectionSpec;
}

export function resolveViewportPaintBundle(options: ResolveOptions = {}): ViewportPaintBundle {
  const theme = options.theme ?? 'light';
  return {
    categories: resolveAllCategoryMaterials(options),
    lighting: resolveLighting(theme),
    selection: resolveSelection(options),
  };
}

// ─── MAT-01 — material-key registry ──────────────────────────────────────
// Per-`materialKey` PBR catalog. Category materials (above) drive the
// fallback colour/roughness for an element kind; individual elements can
// override with a `materialKey` from this registry to pick a specific
// finish (cladding species, render colour, metal type, etc.).

/** High-level grouping used by UI filters and plan/section hatch lookup. */
export type MaterialCategoryKind =
  | 'cladding'
  | 'render'
  | 'metal'
  | 'metal_roof'
  | 'brick'
  | 'stone'
  | 'concrete'
  | 'glass'
  | 'timber'
  | 'membrane'
  | 'plaster'
  | 'placeholder'
  | 'air';

export type MaterialProjectionKind =
  | 'box'
  | 'wall-face'
  | 'planar-xz'
  | 'planar-xy'
  | 'cylindrical'
  | 'generated';

export interface MaterialPbrSpec {
  /** Stable lookup key — matches `materialKey` on element shapes. */
  key: string;
  /** Hex base colour (sRGB). */
  baseColor: string;
  /** PBR roughness (0=mirror, 1=fully rough). */
  roughness: number;
  /** PBR metalness (0=dielectric, 1=metal). */
  metalness: number;
  category: MaterialCategoryKind;
  /** Optional URL to a normal map texture (deferred — used by future PRs). */
  normalMapUrl?: string;
  /** Appearance asset texture metadata, kept authorable even before texture loading. */
  textureMapUrl?: string;
  /** Optional URL to a roughness map texture. */
  roughnessMapUrl?: string;
  /** Optional URL to a metalness map texture. */
  metalnessMapUrl?: string;
  /** Appearance asset bump/normal metadata shown by the Asset Browser. */
  bumpMapUrl?: string;
  /** Optional high-detail height/displacement map texture. */
  heightMapUrl?: string;
  opacity?: number;
  transmission?: number;
  /** Real-world texture tile size in millimetres. */
  uvScaleMm?: { uMm: number; vMm: number };
  /** Texture rotation applied after projection. */
  uvRotationDeg?: number;
  /** Real-world texture offset in millimetres. */
  uvOffsetMm?: { uMm: number; vMm: number };
  /** Preferred projection basis for generated UVs and texture repeats. */
  projection?: MaterialProjectionKind;
  /** Approximate appearance reflectance for browser editing/readback. */
  reflectance?: number;
  /** Optional plan/section hatch pattern label. */
  hatchPattern?: string;
  /** Human label for schedules / UI. */
  displayName: string;
  source?: 'builtin' | 'curated_asset' | 'project' | 'family';
  graphics?: {
    useRenderAppearance?: boolean;
    surfacePattern?: string;
    surfacePatternColor?: string;
    cutPattern?: string;
    cutPatternColor?: string;
    shadedColor?: string;
    transparency?: number;
  };
  physical?: {
    materialClass?: string;
    densityKgPerM3?: number;
    compressiveStrengthMpa?: number;
    manufacturer?: string;
    comments?: string;
  };
  thermal?: {
    conductivityWPerMK?: number;
    specificHeatJPerKgK?: number;
    thermalResistanceM2KPerW?: number;
  };
}

export type MaterialCreateInput = {
  displayName: string;
  baseColor?: string;
  category?: MaterialCategoryKind;
  source?: 'project' | 'family';
};

export type MaterialUpdatePatch = Partial<
  Omit<MaterialPbrSpec, 'key' | 'category' | 'source'> & {
    category: MaterialCategoryKind;
  }
>;

export const DEFAULT_PROJECT_MATERIAL_COLOR = '#b8b2a8';

export type MaterialElementLookup = Record<string, Element> | null | undefined;

const DEFAULT_MATERIAL_METADATA = {
  graphics: {
    useRenderAppearance: true,
    surfacePattern: 'Solid fill',
    cutPattern: 'By material',
  },
  physical: {
    materialClass: 'Generic',
    densityKgPerM3: 1200,
  },
  thermal: {
    conductivityWPerMK: 0.35,
    specificHeatJPerKgK: 900,
    thermalResistanceM2KPerW: 0.12,
  },
} satisfies Pick<MaterialPbrSpec, 'graphics' | 'physical' | 'thermal'>;

function withDefaultMetadata(spec: MaterialPbrSpec): MaterialPbrSpec {
  return {
    ...spec,
    source: spec.source ?? 'builtin',
    reflectance: spec.reflectance ?? Math.max(0, Math.min(1, 1 - spec.roughness)),
    graphics: { ...DEFAULT_MATERIAL_METADATA.graphics, ...spec.graphics },
    physical: { ...DEFAULT_MATERIAL_METADATA.physical, ...spec.physical },
    thermal: { ...DEFAULT_MATERIAL_METADATA.thermal, ...spec.thermal },
  };
}

const MATERIAL_CATEGORY_KINDS = new Set<MaterialCategoryKind>([
  'cladding',
  'render',
  'metal',
  'metal_roof',
  'brick',
  'stone',
  'concrete',
  'glass',
  'timber',
  'membrane',
  'plaster',
  'placeholder',
  'air',
]);

function coerceMaterialCategory(category: string | null | undefined): MaterialCategoryKind {
  return category && MATERIAL_CATEGORY_KINDS.has(category as MaterialCategoryKind)
    ? (category as MaterialCategoryKind)
    : 'placeholder';
}

function materialElementToPbrSpec(material: MaterialElem): MaterialPbrSpec {
  const appearance = material.appearance;
  const graphics = material.graphics;
  const physical = material.physical;
  const thermal = material.thermal;
  const baseColor =
    appearance?.baseColor ??
    material.albedoColor ??
    graphics?.shadedColor ??
    DEFAULT_PROJECT_MATERIAL_COLOR;
  const roughness =
    typeof appearance?.roughness === 'number'
      ? Math.max(0, Math.min(1, appearance.roughness))
      : 0.72;
  const metalness =
    typeof appearance?.metalness === 'number' ? Math.max(0, Math.min(1, appearance.metalness)) : 0;

  return withDefaultMetadata({
    key: material.id,
    displayName: material.name || material.id,
    source: material.source ?? 'project',
    category: coerceMaterialCategory(material.category),
    baseColor,
    roughness,
    metalness,
    textureMapUrl: appearance?.albedoMapId ?? material.albedoMapId,
    normalMapUrl: appearance?.normalMapId ?? material.normalMapId,
    roughnessMapUrl: appearance?.roughnessMapId ?? undefined,
    metalnessMapUrl: appearance?.metallicMapId ?? undefined,
    bumpMapUrl: appearance?.heightMapId ?? material.heightMapId,
    heightMapUrl: appearance?.heightMapId ?? material.heightMapId,
    uvScaleMm: appearance?.uvScaleMm ?? material.uvScaleMm,
    uvRotationDeg: appearance?.uvRotationDeg ?? material.uvRotationDeg,
    uvOffsetMm: appearance?.uvOffsetMm,
    projection: appearance?.projection,
    reflectance: appearance?.reflectance,
    opacity: appearance?.opacity,
    transmission: appearance?.transmission,
    hatchPattern: material.hatchPatternId,
    graphics: {
      useRenderAppearance: graphics?.useRenderAppearance,
      shadedColor: graphics?.shadedColor ?? material.albedoColor ?? baseColor,
      transparency: graphics?.transparency,
      surfacePattern: graphics?.surfacePatternId ?? material.hatchPatternId ?? undefined,
      surfacePatternColor: graphics?.surfacePatternColor,
      cutPattern: graphics?.cutPatternId ?? material.hatchPatternId ?? undefined,
      cutPatternColor: graphics?.cutPatternColor,
    },
    physical: physical
      ? {
          materialClass: physical.materialClass,
          densityKgPerM3: physical.densityKgPerM3,
          compressiveStrengthMpa: physical.compressiveStrengthMpa,
          manufacturer: physical.manufacturer,
          comments: physical.comments,
        }
      : undefined,
    thermal: thermal
      ? {
          conductivityWPerMK: thermal.conductivityWPerMK,
          specificHeatJPerKgK: thermal.specificHeatJPerKgK,
          thermalResistanceM2KPerW: thermal.thermalResistanceM2KPerW,
        }
      : undefined,
  });
}

function resolveMaterialElement(
  materialKey: string | null | undefined,
  elementsById?: MaterialElementLookup,
): MaterialElem | null {
  if (!materialKey || !elementsById) return null;
  const element = elementsById[materialKey];
  return element?.kind === 'material' ? element : null;
}

export function materialDefinitionToThreeSpec(definition: MaterialPbrSpec): MaterialPbrSpec {
  return withDefaultMetadata(definition);
}

export function materialDefinitionToGraphicsSpec(
  definition: MaterialPbrSpec,
): NonNullable<MaterialPbrSpec['graphics']> & { hatchPattern?: string } {
  const spec = withDefaultMetadata(definition);
  return {
    ...spec.graphics,
    hatchPattern: spec.hatchPattern,
  };
}

function materialSlug(label: string): string {
  return (
    label
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'material'
  );
}

const MATERIAL_REGISTRY: Record<string, MaterialPbrSpec> = {
  // ── existing default keys (preserved for legacy authoring) ────────────
  timber_cladding: {
    key: 'timber_cladding',
    baseColor: '#7c5b3b',
    roughness: 0.85,
    metalness: 0,
    category: 'cladding',
    displayName: 'Timber cladding',
  },
  white_cladding: {
    key: 'white_cladding',
    baseColor: '#f4f4f0',
    roughness: 0.92,
    metalness: 0,
    category: 'cladding',
    displayName: 'White cladding',
  },
  white_render: {
    key: 'white_render',
    baseColor: '#f4f4f0',
    roughness: 0.92,
    metalness: 0,
    category: 'render',
    displayName: 'White render',
  },
  // Existing wall-layer keys used by wallTypeCatalog — registered here so
  // every materialKey referenced anywhere in the app resolves to a spec.
  timber_frame_insulation: {
    key: 'timber_frame_insulation',
    baseColor: '#d6b675',
    roughness: 0.95,
    metalness: 0,
    category: 'timber',
    displayName: 'Timber frame + insulation',
  },
  timber_stud: {
    key: 'timber_stud',
    baseColor: '#cf9b56',
    roughness: 0.9,
    metalness: 0,
    category: 'timber',
    displayName: 'Timber stud',
  },
  vcl_membrane: {
    key: 'vcl_membrane',
    baseColor: '#b9c0c8',
    roughness: 0.7,
    metalness: 0,
    category: 'membrane',
    displayName: 'VCL membrane',
  },
  plasterboard: {
    key: 'plasterboard',
    baseColor: '#ece8de',
    roughness: 0.92,
    metalness: 0,
    category: 'plaster',
    displayName: 'Plasterboard',
  },
  plaster: {
    key: 'plaster',
    baseColor: '#efe9d8',
    roughness: 0.92,
    metalness: 0,
    category: 'plaster',
    displayName: 'Plaster',
  },
  masonry_brick: {
    key: 'masonry_brick',
    baseColor: '#a45a3f',
    roughness: 0.9,
    metalness: 0,
    category: 'brick',
    hatchPattern: 'brick',
    displayName: 'Masonry brick',
  },
  masonry_block: {
    key: 'masonry_block',
    baseColor: '#bcb6a8',
    roughness: 0.9,
    metalness: 0,
    category: 'brick',
    hatchPattern: 'block',
    displayName: 'Masonry block',
  },
  air: {
    key: 'air',
    baseColor: '#ffffff',
    roughness: 1,
    metalness: 0,
    category: 'air',
    displayName: 'Air gap',
  },

  // ── MAT-01 cladding variants (target-house §1.7) ──────────────────────
  cladding_beige_grey: {
    key: 'cladding_beige_grey',
    baseColor: '#c4b59a',
    roughness: 0.85,
    metalness: 0,
    category: 'cladding',
    displayName: 'Beige-grey cladding',
  },
  cladding_warm_wood: {
    key: 'cladding_warm_wood',
    baseColor: '#a87a44',
    roughness: 0.85,
    metalness: 0,
    category: 'cladding',
    displayName: 'Warm wood cladding',
  },
  cladding_dark_grey: {
    key: 'cladding_dark_grey',
    baseColor: '#3a3d3f',
    roughness: 0.85,
    metalness: 0,
    category: 'cladding',
    displayName: 'Dark-grey cladding',
  },

  // ── MAT-01 render variants ───────────────────────────────────────────
  render_light_grey: {
    key: 'render_light_grey',
    baseColor: '#cfd0cd',
    roughness: 0.92,
    metalness: 0,
    category: 'render',
    displayName: 'Light-grey render',
  },
  render_beige: {
    key: 'render_beige',
    baseColor: '#d8c8a8',
    roughness: 0.92,
    metalness: 0,
    category: 'render',
    displayName: 'Beige render',
  },
  render_terracotta: {
    key: 'render_terracotta',
    baseColor: '#a85432',
    roughness: 0.92,
    metalness: 0,
    category: 'render',
    displayName: 'Terracotta render',
  },

  // ── MAT-01 aluminium variants ────────────────────────────────────────
  aluminium_dark_grey: {
    key: 'aluminium_dark_grey',
    baseColor: '#3d4042',
    roughness: 0.3,
    metalness: 0.6,
    category: 'metal',
    displayName: 'Dark-grey aluminium',
  },
  aluminium_natural: {
    key: 'aluminium_natural',
    baseColor: '#a8acaf',
    roughness: 0.2,
    metalness: 0.85,
    category: 'metal',
    displayName: 'Natural aluminium',
  },
  aluminium_black: {
    key: 'aluminium_black',
    baseColor: '#1c1d1e',
    roughness: 0.4,
    metalness: 0.55,
    category: 'metal',
    displayName: 'Black aluminium',
  },

  // ── MAT-01 brick variants ────────────────────────────────────────────
  brick_red: {
    key: 'brick_red',
    baseColor: '#8a3a26',
    roughness: 0.9,
    metalness: 0,
    category: 'brick',
    hatchPattern: 'brick',
    displayName: 'Red brick',
  },
  brick_yellow: {
    key: 'brick_yellow',
    baseColor: '#c5a857',
    roughness: 0.9,
    metalness: 0,
    category: 'brick',
    hatchPattern: 'brick',
    displayName: 'Yellow brick',
  },
  brick_grey: {
    key: 'brick_grey',
    baseColor: '#7a7873',
    roughness: 0.9,
    metalness: 0,
    category: 'brick',
    hatchPattern: 'brick',
    displayName: 'Grey brick',
  },

  // ── MAT-01 stone variants ────────────────────────────────────────────
  stone_limestone: {
    key: 'stone_limestone',
    baseColor: '#d8d0bc',
    roughness: 0.88,
    metalness: 0,
    category: 'stone',
    hatchPattern: 'stone',
    displayName: 'Limestone',
  },
  stone_slate: {
    key: 'stone_slate',
    baseColor: '#3e3a35',
    roughness: 0.7,
    metalness: 0,
    category: 'stone',
    hatchPattern: 'stone',
    displayName: 'Slate',
  },
  stone_sandstone: {
    key: 'stone_sandstone',
    baseColor: '#b89968',
    roughness: 0.88,
    metalness: 0,
    category: 'stone',
    hatchPattern: 'stone',
    displayName: 'Sandstone',
  },

  // ── MAT-01 concrete variants ─────────────────────────────────────────
  concrete_smooth: {
    key: 'concrete_smooth',
    baseColor: '#9c9a94',
    roughness: 0.7,
    metalness: 0,
    category: 'concrete',
    hatchPattern: 'concrete',
    displayName: 'Smooth concrete',
  },
  concrete_board_formed: {
    key: 'concrete_board_formed',
    baseColor: '#a8a59c',
    roughness: 0.85,
    metalness: 0,
    category: 'concrete',
    hatchPattern: 'concrete',
    displayName: 'Board-formed concrete',
  },

  // ── MAT-01 glass variants ────────────────────────────────────────────
  glass_clear: {
    key: 'glass_clear',
    baseColor: '#b8d6e6',
    roughness: 0.05,
    metalness: 0,
    category: 'glass',
    displayName: 'Clear glass',
  },
  glass_low_iron: {
    key: 'glass_low_iron',
    baseColor: '#d2e6ee',
    roughness: 0.05,
    metalness: 0,
    category: 'glass',
    displayName: 'Low-iron glass',
  },
  glass_fritted: {
    key: 'glass_fritted',
    baseColor: '#dfe6ea',
    roughness: 0.35,
    metalness: 0,
    category: 'glass',
    displayName: 'Fritted glass',
  },
  glass_obscured: {
    key: 'glass_obscured',
    baseColor: '#e6ecef',
    roughness: 0.55,
    metalness: 0,
    category: 'glass',
    displayName: 'Obscured glass',
  },

  // ── MAT-01 standing-seam metal roof variants ─────────────────────────
  metal_standing_seam_dark_grey: {
    key: 'metal_standing_seam_dark_grey',
    baseColor: '#3a3d3f',
    roughness: 0.35,
    metalness: 0.7,
    category: 'metal_roof',
    displayName: 'Standing-seam metal — dark grey',
  },
  metal_standing_seam_zinc: {
    key: 'metal_standing_seam_zinc',
    baseColor: '#7a7d80',
    roughness: 0.35,
    metalness: 0.7,
    category: 'metal_roof',
    displayName: 'Standing-seam metal — zinc',
  },
  metal_standing_seam_copper: {
    key: 'metal_standing_seam_copper',
    baseColor: '#b86b3c',
    roughness: 0.35,
    metalness: 0.7,
    category: 'metal_roof',
    displayName: 'Standing-seam metal — copper',
  },

  // Placeholder for unloaded / unresolved family instances (KRN-09 forward dep).
  placeholder_unloaded: {
    key: 'placeholder_unloaded',
    baseColor: '#ff66cc',
    roughness: 0.6,
    metalness: 0,
    category: 'placeholder',
    displayName: 'Placeholder (unloaded)',
  },

  // Curated appearance assets exposed by the Revit-style Asset Browser.
  asset_oak_plank_satin: {
    key: 'asset_oak_plank_satin',
    baseColor: '#b8894d',
    roughness: 0.42,
    metalness: 0,
    category: 'timber',
    displayName: 'Oak plank - satin',
    textureMapUrl: 'library/wood/oak-plank-satin-albedo',
    bumpMapUrl: 'library/wood/oak-plank-satin-bump',
    reflectance: 0.58,
    hatchPattern: 'wood',
    source: 'curated_asset',
    physical: { materialClass: 'Wood', densityKgPerM3: 710, manufacturer: 'bim-ai library' },
    thermal: { conductivityWPerMK: 0.17, specificHeatJPerKgK: 1600 },
  },
  asset_walnut_veneer_matte: {
    key: 'asset_walnut_veneer_matte',
    baseColor: '#5d3928',
    roughness: 0.62,
    metalness: 0,
    category: 'timber',
    displayName: 'Walnut veneer - matte',
    textureMapUrl: 'library/wood/walnut-veneer-matte-albedo',
    bumpMapUrl: 'library/wood/walnut-veneer-matte-bump',
    reflectance: 0.38,
    hatchPattern: 'wood',
    source: 'curated_asset',
    physical: { materialClass: 'Wood', densityKgPerM3: 650 },
    thermal: { conductivityWPerMK: 0.16, specificHeatJPerKgK: 1500 },
  },
  asset_birch_plywood: {
    key: 'asset_birch_plywood',
    baseColor: '#d5b77e',
    roughness: 0.55,
    metalness: 0,
    category: 'timber',
    displayName: 'Birch plywood',
    textureMapUrl: 'library/wood/birch-plywood-albedo',
    bumpMapUrl: 'library/wood/birch-plywood-bump',
    reflectance: 0.45,
    hatchPattern: 'plywood',
    source: 'curated_asset',
    physical: { materialClass: 'Wood panel', densityKgPerM3: 680 },
    thermal: { conductivityWPerMK: 0.13, specificHeatJPerKgK: 1700 },
  },
  asset_polished_concrete_warm: {
    key: 'asset_polished_concrete_warm',
    baseColor: '#aaa49a',
    roughness: 0.28,
    metalness: 0,
    category: 'concrete',
    displayName: 'Polished concrete - warm',
    textureMapUrl: 'library/concrete/polished-warm-albedo',
    bumpMapUrl: 'library/concrete/polished-warm-bump',
    reflectance: 0.72,
    hatchPattern: 'concrete',
    source: 'curated_asset',
    physical: { materialClass: 'Concrete', densityKgPerM3: 2400, compressiveStrengthMpa: 35 },
    thermal: { conductivityWPerMK: 1.4, specificHeatJPerKgK: 880 },
  },
  asset_board_form_concrete_fine: {
    key: 'asset_board_form_concrete_fine',
    baseColor: '#918b82',
    roughness: 0.76,
    metalness: 0,
    category: 'concrete',
    displayName: 'Board form concrete - fine grain',
    textureMapUrl: 'library/concrete/board-form-fine-albedo',
    bumpMapUrl: 'library/concrete/board-form-fine-bump',
    reflectance: 0.24,
    hatchPattern: 'concrete',
    source: 'curated_asset',
    physical: { materialClass: 'Concrete', densityKgPerM3: 2350, compressiveStrengthMpa: 30 },
    thermal: { conductivityWPerMK: 1.35, specificHeatJPerKgK: 880 },
  },
  asset_cast_concrete_light: {
    key: 'asset_cast_concrete_light',
    baseColor: '#c7c2b8',
    roughness: 0.68,
    metalness: 0,
    category: 'concrete',
    displayName: 'Cast concrete - light',
    textureMapUrl: 'library/concrete/cast-light-albedo',
    bumpMapUrl: 'library/concrete/cast-light-bump',
    reflectance: 0.32,
    hatchPattern: 'concrete',
    source: 'curated_asset',
    physical: { materialClass: 'Concrete', densityKgPerM3: 2300, compressiveStrengthMpa: 25 },
    thermal: { conductivityWPerMK: 1.25, specificHeatJPerKgK: 880 },
  },
  asset_brick_running_red: {
    key: 'asset_brick_running_red',
    baseColor: '#944834',
    roughness: 0.88,
    metalness: 0,
    category: 'brick',
    displayName: 'Brick running bond - red',
    textureMapUrl: 'library/masonry/brick-running-red-albedo',
    bumpMapUrl: 'library/masonry/brick-running-red-bump',
    reflectance: 0.12,
    hatchPattern: 'brick',
    source: 'curated_asset',
    physical: { materialClass: 'Masonry', densityKgPerM3: 1800 },
    thermal: { conductivityWPerMK: 0.77, specificHeatJPerKgK: 840 },
  },
  asset_brick_stack_grey: {
    key: 'asset_brick_stack_grey',
    baseColor: '#74716c',
    roughness: 0.86,
    metalness: 0,
    category: 'brick',
    displayName: 'Brick stack bond - grey',
    textureMapUrl: 'library/masonry/brick-stack-grey-albedo',
    bumpMapUrl: 'library/masonry/brick-stack-grey-bump',
    reflectance: 0.14,
    hatchPattern: 'brick',
    source: 'curated_asset',
    physical: { materialClass: 'Masonry', densityKgPerM3: 1750 },
    thermal: { conductivityWPerMK: 0.72, specificHeatJPerKgK: 840 },
  },
  asset_limestone_honed: {
    key: 'asset_limestone_honed',
    baseColor: '#cfc6ad',
    roughness: 0.5,
    metalness: 0,
    category: 'stone',
    displayName: 'Limestone - honed',
    textureMapUrl: 'library/stone/limestone-honed-albedo',
    bumpMapUrl: 'library/stone/limestone-honed-bump',
    reflectance: 0.5,
    hatchPattern: 'stone',
    source: 'curated_asset',
    physical: { materialClass: 'Stone', densityKgPerM3: 2550 },
    thermal: { conductivityWPerMK: 1.3, specificHeatJPerKgK: 910 },
  },
  asset_slate_cleft: {
    key: 'asset_slate_cleft',
    baseColor: '#34383a',
    roughness: 0.74,
    metalness: 0,
    category: 'stone',
    displayName: 'Slate - cleft',
    textureMapUrl: 'library/stone/slate-cleft-albedo',
    bumpMapUrl: 'library/stone/slate-cleft-bump',
    reflectance: 0.2,
    hatchPattern: 'stone',
    source: 'curated_asset',
    physical: { materialClass: 'Stone', densityKgPerM3: 2700 },
    thermal: { conductivityWPerMK: 2.0, specificHeatJPerKgK: 760 },
  },
  asset_stainless_brushed: {
    key: 'asset_stainless_brushed',
    baseColor: '#b7b8b5',
    roughness: 0.24,
    metalness: 0.9,
    category: 'metal',
    displayName: 'Stainless steel - brushed',
    textureMapUrl: 'library/metal/stainless-brushed-albedo',
    bumpMapUrl: 'library/metal/stainless-brushed-brush-lines',
    reflectance: 0.76,
    source: 'curated_asset',
    physical: { materialClass: 'Metal', densityKgPerM3: 8000 },
    thermal: { conductivityWPerMK: 16, specificHeatJPerKgK: 500 },
  },
  asset_anodized_black: {
    key: 'asset_anodized_black',
    baseColor: '#151617',
    roughness: 0.36,
    metalness: 0.7,
    category: 'metal',
    displayName: 'Anodized aluminium - black',
    textureMapUrl: 'library/metal/anodized-black-albedo',
    bumpMapUrl: 'library/metal/anodized-black-bump',
    reflectance: 0.64,
    source: 'curated_asset',
    physical: { materialClass: 'Metal', densityKgPerM3: 2700 },
    thermal: { conductivityWPerMK: 205, specificHeatJPerKgK: 900 },
  },
  asset_copper_patina: {
    key: 'asset_copper_patina',
    baseColor: '#4e8b7d',
    roughness: 0.7,
    metalness: 0.55,
    category: 'metal_roof',
    displayName: 'Copper roof - aged patina',
    textureMapUrl: 'library/roof/copper-patina-albedo',
    bumpMapUrl: 'library/roof/copper-patina-bump',
    reflectance: 0.3,
    source: 'curated_asset',
    physical: { materialClass: 'Metal roofing', densityKgPerM3: 8940 },
    thermal: { conductivityWPerMK: 385, specificHeatJPerKgK: 385 },
  },
  asset_clear_glass_double: {
    key: 'asset_clear_glass_double',
    baseColor: '#c8e4f1',
    roughness: 0.02,
    metalness: 0,
    category: 'glass',
    displayName: 'Clear glass - double glazed',
    textureMapUrl: 'library/glass/clear-double-transmission',
    bumpMapUrl: 'library/glass/clear-double-wave',
    reflectance: 0.98,
    source: 'curated_asset',
    physical: { materialClass: 'Glass', densityKgPerM3: 2500 },
    thermal: { conductivityWPerMK: 0.8, specificHeatJPerKgK: 840, thermalResistanceM2KPerW: 0.35 },
  },
  asset_spandrel_glass_grey: {
    key: 'asset_spandrel_glass_grey',
    baseColor: '#79828a',
    roughness: 0.18,
    metalness: 0,
    category: 'glass',
    displayName: 'Spandrel glass - grey',
    textureMapUrl: 'library/glass/spandrel-grey-albedo',
    bumpMapUrl: 'library/glass/spandrel-grey-bump',
    reflectance: 0.82,
    source: 'curated_asset',
    physical: { materialClass: 'Glass', densityKgPerM3: 2500 },
    thermal: { conductivityWPerMK: 0.9, specificHeatJPerKgK: 840 },
  },
  asset_acoustic_plaster_white: {
    key: 'asset_acoustic_plaster_white',
    baseColor: '#eee9df',
    roughness: 0.96,
    metalness: 0,
    category: 'plaster',
    displayName: 'Acoustic plaster - white',
    textureMapUrl: 'library/plaster/acoustic-white-albedo',
    bumpMapUrl: 'library/plaster/acoustic-white-bump',
    reflectance: 0.04,
    hatchPattern: 'plaster',
    source: 'curated_asset',
    physical: { materialClass: 'Plaster', densityKgPerM3: 950 },
    thermal: { conductivityWPerMK: 0.22, specificHeatJPerKgK: 1000 },
  },
  asset_epdm_membrane_black: {
    key: 'asset_epdm_membrane_black',
    baseColor: '#202020',
    roughness: 0.8,
    metalness: 0,
    category: 'membrane',
    displayName: 'EPDM membrane - black',
    textureMapUrl: 'library/membrane/epdm-black-albedo',
    bumpMapUrl: 'library/membrane/epdm-black-bump',
    reflectance: 0.2,
    hatchPattern: 'membrane',
    source: 'curated_asset',
    physical: { materialClass: 'Membrane', densityKgPerM3: 1100 },
    thermal: { conductivityWPerMK: 0.25, specificHeatJPerKgK: 1900 },
  },
};

function nextMaterialKey(displayName: string): string {
  const base = `project_${materialSlug(displayName)}`;
  if (!MATERIAL_REGISTRY[base]) return base;
  let suffix = 2;
  while (MATERIAL_REGISTRY[`${base}_${suffix}`]) suffix += 1;
  return `${base}_${suffix}`;
}

export function createProjectMaterial(input: MaterialCreateInput): MaterialPbrSpec {
  const displayName = input.displayName.trim() || 'New Material';
  const key = nextMaterialKey(displayName);
  const spec = withDefaultMetadata({
    key,
    baseColor: input.baseColor ?? DEFAULT_PROJECT_MATERIAL_COLOR,
    roughness: 0.72,
    metalness: 0,
    category: input.category ?? 'placeholder',
    displayName,
    source: input.source ?? 'project',
  });
  MATERIAL_REGISTRY[key] = spec;
  return spec;
}

export function renameMaterial(materialKey: string, displayName: string): MaterialPbrSpec | null {
  const existing = MATERIAL_REGISTRY[materialKey];
  const nextName = displayName.trim();
  if (!existing || !nextName) return null;
  MATERIAL_REGISTRY[materialKey] = { ...existing, displayName: nextName };
  return withDefaultMetadata(MATERIAL_REGISTRY[materialKey]);
}

export function updateMaterialDefinition(
  materialKey: string,
  patch: MaterialUpdatePatch,
): MaterialPbrSpec | null {
  const existing = MATERIAL_REGISTRY[materialKey];
  if (!existing) return null;
  MATERIAL_REGISTRY[materialKey] = withDefaultMetadata({
    ...existing,
    ...patch,
    graphics: { ...existing.graphics, ...patch.graphics },
    physical: { ...existing.physical, ...patch.physical },
    thermal: { ...existing.thermal, ...patch.thermal },
  });
  return MATERIAL_REGISTRY[materialKey];
}

/** Resolve a `materialKey` to its canonical material definition, or null if unknown. */
export function resolveMaterialDefinition(
  materialKey: string | null | undefined,
  elementsById?: MaterialElementLookup,
): MaterialPbrSpec | null {
  if (!materialKey) return null;
  const materialElement = resolveMaterialElement(materialKey, elementsById);
  if (materialElement) return materialElementToPbrSpec(materialElement);
  const spec = MATERIAL_REGISTRY[materialKey];
  return spec ? withDefaultMetadata(spec) : null;
}

/** Resolve a `materialKey` to its PBR spec, or null if unknown. */
export function resolveMaterial(
  materialKey: string | null | undefined,
  elementsById?: MaterialElementLookup,
): MaterialPbrSpec | null {
  return resolveMaterialDefinition(materialKey, elementsById);
}

/** Read-only view of every registered material spec. */
export function listMaterialDefinitions(elementsById?: MaterialElementLookup): MaterialPbrSpec[] {
  const materialMap = new Map<string, MaterialPbrSpec>();
  for (const material of Object.values(MATERIAL_REGISTRY)) {
    materialMap.set(material.key, withDefaultMetadata(material));
  }
  if (elementsById) {
    for (const element of Object.values(elementsById)) {
      if (element.kind === 'material') {
        const spec = materialElementToPbrSpec(element);
        materialMap.set(spec.key, spec);
      }
    }
  }
  return [...materialMap.values()];
}

/** Read-only view of every registered material spec. */
export function listMaterials(elementsById?: MaterialElementLookup): MaterialPbrSpec[] {
  return listMaterialDefinitions(elementsById);
}

/** Cheap base-colour lookup (legacy callers); falls back to neutral grey. */
export function materialBaseColor(
  materialKey: string | null | undefined,
  elementsById?: MaterialElementLookup,
): string {
  return resolveMaterial(materialKey, elementsById)?.baseColor ?? '#cccccc';
}

export interface ResolvedWallSurfaceMaterial {
  baseColor: string;
  roughness: number;
  metalness: number;
  envMapIntensity: number;
  claddingBoards: {
    color: string;
    boardWidthMm: number;
    gapMm: number;
  } | null;
}

/**
 * Shared wall material appearance for direct wall meshes and async CSG
 * replacement meshes. Keep render/cladding env intensity low so authored
 * base colours are not washed out by the sky environment.
 */
export function resolveWallSurfaceMaterial(
  materialKey: string | null | undefined,
  paint: ViewportPaintBundle | null | undefined,
  elementsById?: MaterialElementLookup,
): ResolvedWallSurfaceMaterial {
  const spec = resolveMaterial(materialKey, elementsById);
  const isWhite = materialKey === 'white_cladding' || materialKey === 'white_render';
  const isRenderOrCladding = spec?.category === 'render' || spec?.category === 'cladding';
  const baseColor =
    spec?.baseColor ?? (isWhite ? '#f4f4f0' : (paint?.categories.wall.color ?? '#ddd8d0'));
  const roughness =
    spec?.roughness ?? (isWhite ? 0.92 : (paint?.categories.wall.roughness ?? 0.85));
  const metalness = spec?.metalness ?? paint?.categories.wall.metalness ?? 0.0;

  let claddingBoards: ResolvedWallSurfaceMaterial['claddingBoards'] = null;
  if (materialKey === 'white_cladding') {
    claddingBoards = { color: '#f4f4f0', boardWidthMm: 120, gapMm: 10 };
  } else if (materialKey === 'timber_cladding') {
    claddingBoards = { color: spec?.baseColor ?? '#8B6340', boardWidthMm: 120, gapMm: 10 };
  } else if (spec?.category === 'cladding') {
    claddingBoards = { color: spec.baseColor, boardWidthMm: 250, gapMm: 12 };
  }

  return {
    baseColor,
    roughness,
    metalness,
    envMapIntensity: isWhite || isRenderOrCladding ? 0.15 : 1.0,
    claddingBoards,
  };
}

/** True when a `materialKey` is a standing-seam metal roof variant. */
export function isStandingSeamMetalKey(materialKey: string | null | undefined): boolean {
  if (!materialKey) return false;
  return materialKey.startsWith('metal_standing_seam_');
}
