import { describe, expect, it } from 'vitest';
import {
  createProjectMaterial,
  isStandingSeamMetalKey,
  listMaterials,
  materialBaseColor,
  renameMaterial,
  resolveAllCategoryMaterials,
  resolveCategoryMaterial,
  resolveLighting,
  resolveMaterial,
  resolveSelection,
  resolveViewportPaintBundle,
  updateMaterialDefinition,
  type ElementCategoryToken,
  type TokenReader,
} from './materials';

const ALL_CATS: ElementCategoryToken[] = [
  'wall',
  'floor',
  'roof',
  'door',
  'window',
  'stair',
  'railing',
  'room',
  'site',
  'section',
  'sheet',
  'slab_edge',
];

function fakeReader(map: Record<string, string>): TokenReader {
  return {
    read(token: string): string | null {
      return map[token] ?? null;
    },
  };
}

describe('resolveCategoryMaterial — spec §15.5', () => {
  it('reads --cat-* tokens for every category', () => {
    const reader = fakeReader({
      '--cat-wall': 'hsl(220 6% 60%)',
      '--cat-floor': 'hsl(36 18% 70%)',
      '--cat-roof': 'hsl(0 18% 40%)',
      '--cat-door': 'hsl(28 30% 45%)',
      '--cat-window': 'hsl(213 60% 70%)',
      '--cat-stair': 'hsl(220 6% 35%)',
      '--cat-railing': 'hsl(220 6% 28%)',
      '--cat-room': 'hsl(150 24% 86%)',
      '--cat-site': 'hsl(80 20% 80%)',
      '--cat-section': 'hsl(0 70% 50%)',
      '--cat-sheet': 'hsl(220 6% 80%)',
    });
    const PBR_EXPECTED: Record<ElementCategoryToken, { roughness: number; metalness: number }> = {
      wall: { roughness: 0.92, metalness: 0.0 },
      floor: { roughness: 0.88, metalness: 0.0 },
      roof: { roughness: 0.85, metalness: 0.0 },
      door: { roughness: 0.72, metalness: 0.02 },
      window: { roughness: 0.05, metalness: 0.08 },
      stair: { roughness: 0.86, metalness: 0.0 },
      railing: { roughness: 0.45, metalness: 0.35 },
      room: { roughness: 0.85, metalness: 0.0 },
      site: { roughness: 0.95, metalness: 0.0 },
      section: { roughness: 0.85, metalness: 0.0 },
      sheet: { roughness: 0.85, metalness: 0.0 },
      slab_edge: { roughness: 0.6, metalness: 0.0 },
    };
    for (const cat of ALL_CATS) {
      const spec = resolveCategoryMaterial(cat, { reader });
      expect(spec.color).toBeTruthy();
      expect(spec.roughness).toBe(PBR_EXPECTED[cat].roughness);
      expect(spec.metalness).toBe(PBR_EXPECTED[cat].metalness);
      expect(spec.aoIntensity).toBe(0.4);
    }
  });

  it('falls back to documented light-theme colors when a token is missing', () => {
    const reader = fakeReader({});
    const spec = resolveCategoryMaterial('wall', { reader });
    expect(spec.color).toBe('#ddd8d0');
  });

  it('lets callers override PBR defaults', () => {
    const reader = fakeReader({});
    const spec = resolveCategoryMaterial('wall', {
      reader,
      roughness: 0.5,
      metalness: 0.1,
      aoIntensity: 0.2,
    });
    expect(spec.roughness).toBe(0.5);
    expect(spec.metalness).toBe(0.1);
    expect(spec.aoIntensity).toBe(0.2);
  });
});

describe('resolveAllCategoryMaterials', () => {
  it('returns a spec for every documented category', () => {
    const reader = fakeReader({});
    const all = resolveAllCategoryMaterials({ reader });
    for (const cat of ALL_CATS) {
      expect(all[cat]).toBeDefined();
    }
  });
});

describe('resolveLighting', () => {
  const light = resolveLighting();
  it('positions the sun at 35° elevation', () => {
    expect(light.sun.elevationDeg).toBe(35);
  });
  it('uses 2048 shadow map size', () => {
    expect(light.sun.shadowMapSize).toBe(2048);
  });
  it('declares sky + ground hemi colors', () => {
    expect(light.hemi.skyColor).toBe('#cce8f4');
    expect(light.hemi.groundColor).toBe('#d4c9a8');
  });
  it('uses a dimmer but legible dark-theme lighting profile', () => {
    const dark = resolveLighting('dark');
    expect(dark.sun.elevationDeg).toBe(35);
    expect(dark.sun.intensity).toBeLessThan(light.sun.intensity);
    expect(dark.hemi.intensity).toBeLessThan(light.hemi.intensity);
  });
});

describe('resolveSelection', () => {
  it('reads --color-accent and --draft-hover', () => {
    const reader = fakeReader({
      '--color-accent': 'hsl(214 88% 50%)',
      '--draft-hover': 'rgb(125 195 255)',
    });
    const sel = resolveSelection({ reader });
    expect(sel.selectedColor).toBe('hsl(214 88% 50%)');
    expect(sel.hoverColor).toBe('rgb(125 195 255)');
    expect(sel.selectedLineWidth).toBe(2);
    expect(sel.hoverLineWidth).toBe(1);
  });
  it('falls back to documented light-theme colors when tokens missing', () => {
    const reader = fakeReader({});
    const sel = resolveSelection({ reader });
    expect(sel.selectedColor).toContain('hsl');
    expect(sel.hoverColor).toContain('color-mix');
  });
});

describe('resolveViewportPaintBundle', () => {
  it('packages categories + lighting + selection', () => {
    const reader = fakeReader({});
    const bundle = resolveViewportPaintBundle({ reader });
    expect(Object.keys(bundle.categories).length).toBe(ALL_CATS.length);
    expect(bundle.lighting.sun.elevationDeg).toBe(35);
    expect(bundle.selection.selectedLineWidth).toBe(2);
  });
  it('threads theme through to lighting resolution', () => {
    const reader = fakeReader({});
    const bundle = resolveViewportPaintBundle({ reader, theme: 'dark' });
    expect(bundle.lighting.sun.intensity).toBe(0.72);
  });
});

describe('MAT-01 — material registry', () => {
  // Every key listed in target-house-seed.md §1.7 (Material + Colour Summary)
  // plus the legacy keys that authoring code already references must resolve.
  const REQUIRED_KEYS = [
    // Cladding
    'timber_cladding',
    'white_cladding',
    'cladding_beige_grey',
    'cladding_warm_wood',
    'cladding_dark_grey',
    // Render
    'white_render',
    'render_light_grey',
    'render_beige',
    'render_terracotta',
    // Aluminium
    'aluminium_dark_grey',
    'aluminium_natural',
    'aluminium_black',
    // Brick
    'brick_red',
    'brick_yellow',
    'brick_grey',
    // Stone
    'stone_limestone',
    'stone_slate',
    'stone_sandstone',
    // Concrete
    'concrete_smooth',
    'concrete_board_formed',
    // Glass
    'glass_clear',
    'glass_low_iron',
    'glass_fritted',
    'glass_obscured',
    // Standing-seam metal roof
    'metal_standing_seam_dark_grey',
    'metal_standing_seam_zinc',
    'metal_standing_seam_copper',
  ];

  it.each(REQUIRED_KEYS)('resolves %s to a PBR spec', (key) => {
    const spec = resolveMaterial(key);
    expect(spec).not.toBeNull();
    expect(spec!.key).toBe(key);
    expect(spec!.baseColor).toMatch(/^#[0-9a-f]{6}$/i);
    expect(spec!.roughness).toBeGreaterThanOrEqual(0);
    expect(spec!.roughness).toBeLessThanOrEqual(1);
    expect(spec!.metalness).toBeGreaterThanOrEqual(0);
    expect(spec!.metalness).toBeLessThanOrEqual(1);
    expect(spec!.category).toBeTruthy();
    expect(spec!.displayName).toBeTruthy();
  });

  it('returns null for unknown materialKeys', () => {
    expect(resolveMaterial('definitely_not_a_real_key')).toBeNull();
    expect(resolveMaterial(null)).toBeNull();
    expect(resolveMaterial(undefined)).toBeNull();
    expect(resolveMaterial('')).toBeNull();
  });

  it('falls back to neutral grey for unknown keys via materialBaseColor', () => {
    expect(materialBaseColor('definitely_not_a_real_key')).toBe('#cccccc');
    expect(materialBaseColor(null)).toBe('#cccccc');
  });

  it('listMaterials returns every registered spec', () => {
    const all = listMaterials();
    const keys = new Set(all.map((s) => s.key));
    for (const k of REQUIRED_KEYS) {
      expect(keys.has(k)).toBe(true);
    }
  });

  it('aluminium variants are flagged metal with metalness ≥ 0.5', () => {
    for (const k of ['aluminium_dark_grey', 'aluminium_natural', 'aluminium_black']) {
      const spec = resolveMaterial(k)!;
      expect(spec.category).toBe('metal');
      expect(spec.metalness).toBeGreaterThanOrEqual(0.5);
    }
  });

  it('standing-seam metal roof variants identify via isStandingSeamMetalKey', () => {
    expect(isStandingSeamMetalKey('metal_standing_seam_dark_grey')).toBe(true);
    expect(isStandingSeamMetalKey('metal_standing_seam_zinc')).toBe(true);
    expect(isStandingSeamMetalKey('metal_standing_seam_copper')).toBe(true);
    expect(isStandingSeamMetalKey('aluminium_natural')).toBe(false);
    expect(isStandingSeamMetalKey('cladding_warm_wood')).toBe(false);
    expect(isStandingSeamMetalKey(null)).toBe(false);
    expect(isStandingSeamMetalKey(undefined)).toBe(false);
  });

  it('standing-seam metal roof variants are categorised metal_roof', () => {
    for (const k of [
      'metal_standing_seam_dark_grey',
      'metal_standing_seam_zinc',
      'metal_standing_seam_copper',
    ]) {
      expect(resolveMaterial(k)!.category).toBe('metal_roof');
    }
  });

  it('stores custom material names and appearance/physical/thermal metadata', () => {
    const material = createProjectMaterial({
      displayName: 'Registry Custom Finish 907',
      baseColor: '#445566',
      category: 'render',
      source: 'family',
    });

    expect(resolveMaterial(material.key)).toMatchObject({
      displayName: 'Registry Custom Finish 907',
      baseColor: '#445566',
      category: 'render',
      source: 'family',
    });

    renameMaterial(material.key, 'Registry Renamed Finish 907');
    updateMaterialDefinition(material.key, {
      textureMapUrl: 'library/custom/registry-color',
      bumpMapUrl: 'library/custom/registry-bump',
      reflectance: 0.67,
      physical: { densityKgPerM3: 1560 },
      thermal: { conductivityWPerMK: 0.29 },
    });

    expect(resolveMaterial(material.key)).toMatchObject({
      displayName: 'Registry Renamed Finish 907',
      textureMapUrl: 'library/custom/registry-color',
      bumpMapUrl: 'library/custom/registry-bump',
      reflectance: 0.67,
      physical: { densityKgPerM3: 1560 },
      thermal: { conductivityWPerMK: 0.29 },
    });
  });

  it('includes curated appearance assets with texture and bump metadata', () => {
    const curated = listMaterials().filter((material) => material.source === 'curated_asset');
    expect(curated.length).toBeGreaterThan(12);
    expect(resolveMaterial('asset_oak_plank_satin')).toMatchObject({
      textureMapUrl: expect.stringContaining('oak'),
      bumpMapUrl: expect.stringContaining('bump'),
      category: 'timber',
    });
  });
});
