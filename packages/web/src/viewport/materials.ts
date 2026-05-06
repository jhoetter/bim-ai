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
  | 'sheet';

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
};

const FALLBACK_CATEGORY_COLOR: Record<ElementCategoryToken, string> = {
  wall: 'hsl(220 6% 60%)',
  floor: 'hsl(36 18% 70%)',
  roof: 'hsl(0 18% 40%)',
  door: 'hsl(28 30% 45%)',
  window: 'hsl(213 60% 70%)',
  stair: 'hsl(220 6% 35%)',
  railing: 'hsl(220 6% 28%)',
  room: 'hsl(150 24% 86%)',
  site: 'hsl(80 20% 80%)',
  section: 'hsl(0 70% 50%)',
  sheet: 'hsl(220 6% 80%)',
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
  wall: { roughness: 0.8, metalness: 0.0 },
  floor: { roughness: 0.9, metalness: 0.0 },
  roof: { roughness: 0.85, metalness: 0.0 },
  door: { roughness: 0.7, metalness: 0.0 },
  window: { roughness: 0.6, metalness: 0.05 },
  stair: { roughness: 0.85, metalness: 0.0 },
  railing: { roughness: 0.35, metalness: 0.65 },
  room: { roughness: 0.85, metalness: 0.0 },
  site: { roughness: 0.95, metalness: 0.0 },
  section: { roughness: 0.85, metalness: 0.0 },
  sheet: { roughness: 0.85, metalness: 0.0 },
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
      skyColor: '#d3e2ff',
      groundColor: '#d8d3c4',
    },
    ssao: {
      kernelRadius: 0.25,
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
