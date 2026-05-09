import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const tokensRoot = resolve(here, '../../../design-tokens/src');

function readTokens(file: string): string {
  return readFileSync(resolve(tokensRoot, file), 'utf8');
}

const tokensDefault = readTokens('tokens-default.css');
const tokensDark = readTokens('tokens-dark.css');
const tokensDrafting = readTokens('tokens-drafting.css');

const lightChrome = [
  '--color-background',
  '--color-foreground',
  '--color-surface',
  '--color-surface-strong',
  '--color-surface-muted',
  '--color-border',
  '--color-border-strong',
  '--color-muted-foreground',
  '--color-accent',
  '--color-accent-foreground',
  '--color-accent-soft',
  '--color-success',
  '--color-warning',
  '--color-danger',
  '--color-info',
  '--color-ring',
];

const spacing = [
  '--space-0',
  '--space-1',
  '--space-2',
  '--space-3',
  '--space-4',
  '--space-5',
  '--space-6',
  '--space-7',
  '--space-8',
  '--space-10',
  '--space-12',
];

const radius = [
  '--radius-xs',
  '--radius-sm',
  '--radius-md',
  '--radius-lg',
  '--radius-xl',
  '--radius-pill',
];

const typography = [
  '--font-sans',
  '--font-mono',
  '--text-xs',
  '--text-sm',
  '--text-base',
  '--text-md',
  '--text-lg',
  '--text-xl',
  '--text-mono-xs',
  '--text-mono-sm',
];

const elevation = ['--elev-0', '--elev-1', '--elev-2', '--elev-3'];

const motion = [
  '--motion-fast',
  '--motion-base',
  '--motion-slow',
  '--ease-out',
  '--ease-in-out',
  '--ease-snap',
];

const drafting = [
  '--draft-paper',
  '--draft-grid-major',
  '--draft-grid-minor',
  '--draft-construction-blue',
  '--draft-witness',
  '--draft-cut',
  '--draft-projection',
  '--draft-hidden',
  '--draft-selection',
  '--draft-hover',
  '--draft-snap',
];

const categories = [
  '--cat-wall',
  '--cat-floor',
  '--cat-roof',
  '--cat-door',
  '--cat-window',
  '--cat-stair',
  '--cat-railing',
  '--cat-room',
  '--cat-site',
  '--cat-section',
  '--cat-sheet',
  '--plan-wall',
  '--plan-floor',
  '--plan-door',
  '--plan-stair',
  '--plan-railing',
];

const lineWeights = [
  '--draft-lw-cut-major',
  '--draft-lw-cut-minor',
  '--draft-lw-projection-major',
  '--draft-lw-projection-minor',
  '--draft-lw-hidden',
  '--draft-lw-witness',
  '--draft-lw-construction',
];

describe('design tokens — §9 (default light)', () => {
  it.each(lightChrome)('declares chrome token %s', (token) => {
    expect(tokensDefault).toContain(`${token}:`);
  });

  it.each(spacing)('declares spacing token %s', (token) => {
    expect(tokensDefault).toContain(`${token}:`);
  });

  it.each(radius)('declares radius token %s', (token) => {
    expect(tokensDefault).toContain(`${token}:`);
  });

  it.each(typography)('declares typography token %s', (token) => {
    expect(tokensDefault).toContain(`${token}:`);
  });

  it.each(elevation)('declares elevation token %s', (token) => {
    expect(tokensDefault).toContain(`${token}:`);
  });

  it.each(motion)('declares motion token %s', (token) => {
    expect(tokensDefault).toContain(`${token}:`);
  });
});

describe('design tokens — §9 (dark overrides)', () => {
  it('targets data-theme="dark" and .dark', () => {
    expect(tokensDark).toContain("[data-theme='dark']");
    expect(tokensDark).toContain('.dark');
  });

  it.each(lightChrome)('overrides chrome token %s in dark', (token) => {
    expect(tokensDark).toContain(`${token}:`);
  });
});

describe('design tokens — §9.2 / §9.3 / §9.10 (drafting)', () => {
  it.each(drafting)('declares drafting token %s', (token) => {
    expect(tokensDrafting).toContain(`${token}:`);
  });

  it.each(categories)('declares category token %s', (token) => {
    expect(tokensDrafting).toContain(`${token}:`);
  });

  it.each(lineWeights)('declares line-weight token %s', (token) => {
    expect(tokensDrafting).toContain(`${token}:`);
  });

  it('also declares dark variants of category tokens', () => {
    const darkBlock = tokensDrafting.split("data-theme='dark'")[1] ?? '';
    for (const token of categories) {
      expect(darkBlock).toContain(`${token}:`);
    }
  });
});

describe('design tokens — conservative palette (chrome coverage)', () => {
  const tokensConservative = readTokens('conservative/tokens-conservative.css');

  it.each(lightChrome)('overrides chrome token %s in conservative palette', (token) => {
    expect(tokensConservative).toContain(`${token}:`);
  });

  it('overrides --font-sans in conservative palette', () => {
    expect(tokensConservative).toContain('--font-sans:');
  });

  it('provides dark overrides for chrome tokens in conservative palette', () => {
    const darkBlock =
      tokensConservative.split("data-theme='dark'")[1] ??
      tokensConservative.split('prefers-color-scheme: dark')[1] ??
      '';
    for (const token of [
      '--color-background',
      '--color-foreground',
      '--color-border',
      '--color-accent',
    ]) {
      expect(darkBlock).toContain(`${token}:`);
    }
  });
});

describe('tokens-default — backwards-compat aliases', () => {
  it.each([
    '--background',
    '--foreground',
    '--surface',
    '--border',
    '--accent',
    '--accent-foreground',
    '--ring',
    '--muted-foreground',
  ])('keeps legacy alias %s', (token) => {
    expect(tokensDefault).toContain(`${token}:`);
  });
});
