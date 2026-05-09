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
export function resolveLighting(): LightingSpec {
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
      intensity: 0.45,
      skyColor: '#e0d8cc',
      groundColor: '#c8c0b0',
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
  return {
    categories: resolveAllCategoryMaterials(options),
    lighting: resolveLighting(),
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
  /** Optional plan/section hatch pattern label. */
  hatchPattern?: string;
  /** Human label for schedules / UI. */
  displayName: string;
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
};

/** Resolve a `materialKey` to its PBR spec, or null if unknown. */
export function resolveMaterial(materialKey: string | null | undefined): MaterialPbrSpec | null {
  if (!materialKey) return null;
  return MATERIAL_REGISTRY[materialKey] ?? null;
}

/** Read-only view of every registered material spec. */
export function listMaterials(): MaterialPbrSpec[] {
  return Object.values(MATERIAL_REGISTRY);
}

/** Cheap base-colour lookup (legacy callers); falls back to neutral grey. */
export function materialBaseColor(materialKey: string | null | undefined): string {
  return resolveMaterial(materialKey)?.baseColor ?? '#cccccc';
}

/** True when a `materialKey` is a standing-seam metal roof variant. */
export function isStandingSeamMetalKey(materialKey: string | null | undefined): boolean {
  if (!materialKey) return false;
  return materialKey.startsWith('metal_standing_seam_');
}
