import { describe, expect, it } from 'vitest';
import {
  resolveAllCategoryMaterials,
  resolveCategoryMaterial,
  resolveLighting,
  resolveSelection,
  resolveViewportPaintBundle,
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
    expect(spec.color).toContain('hsl');
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
    expect(light.hemi.skyColor).toBe('#d3e2ff');
    expect(light.hemi.groundColor).toBe('#d8d3c4');
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
});
