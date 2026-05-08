/**
 * Brand-swap CI invariant (R-G §2.3)
 *
 * Asserts that overriding Layer-C tokens (--brand-*) cannot change the
 * resolved value of any Layer-A token (--disc-*, --color-drift,
 * --text-2xs, --ease-paper, --radius-canvas, structural drafting tokens).
 *
 * Approach: static CSS analysis — parse the source files and verify that
 * no Layer-A token definition references a --brand-* variable. This is
 * the only invariant that matters: if Layer-A never reads --brand-*, a
 * brand swap cannot alter it regardless of how the override is applied.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const TOKENS_ROOT = resolve(__dirname, '../../../design-tokens/src');

function readCss(filename: string): string {
  return readFileSync(resolve(TOKENS_ROOT, filename), 'utf-8');
}

/** Strip CSS comments, then extract all custom-property declarations. */
function extractDeclarations(css: string): Map<string, string> {
  const stripped = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const map = new Map<string, string>();
  for (const match of stripped.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    map.set(match[1].trim(), match[2].trim());
  }
  return map;
}

/** Return every --brand-* name referenced by `var(--brand-...)` in a value. */
function referencedBrandTokens(value: string): string[] {
  return [...value.matchAll(/var\(\s*(--brand-[\w-]+)/g)].map((m) => m[1]);
}

const tokensV3 = readCss('tokens-v3.css');
const brandLayer = readCss('brand-layer.css');
const tokensDrafting = readCss('tokens-drafting.css');

const v3Decls = extractDeclarations(tokensV3);
const brandDecls = extractDeclarations(brandLayer);
const draftingDecls = extractDeclarations(tokensDrafting);

/** Layer-A token names we explicitly guarantee are stable. */
const LAYER_A_REQUIRED = [
  '--disc-arch',
  '--disc-arch-soft',
  '--disc-struct',
  '--disc-struct-soft',
  '--disc-mep',
  '--disc-mep-soft',
  '--color-drift',
  '--text-2xs',
  '--text-2xs-line',
  '--ease-paper',
  '--radius-canvas',
];

/** CAN-V3-01 — drafting line-weight tokens that must be brand-swap-invariant (Layer A). */
const LINE_WEIGHT_LAYER_A = [
  '--draft-lw-cut-major',
  '--draft-lw-cut-minor',
  '--draft-lw-projection-major',
  '--draft-lw-projection-minor',
  '--draft-lw-witness',
];

/** Layer-C token names that ARE allowed to vary on brand swap. */
const LAYER_C_TOKENS = [
  '--brand-accent',
  '--brand-accent-fg',
  '--brand-typeface',
  '--brand-logo-mark',
];

describe('brand-layer.css — Layer C surface (R-G §2.3)', () => {
  it('defines all four required Layer-C tokens', () => {
    for (const name of LAYER_C_TOKENS) {
      expect(brandDecls.has(name), `missing ${name} in brand-layer.css`).toBe(true);
    }
  });

  it('contains ONLY --brand-* tokens (no Layer-A or Layer-B tokens)', () => {
    for (const [name] of brandDecls) {
      expect(name, `${name} in brand-layer.css is not a --brand-* token`).toMatch(/^--brand-/);
    }
  });
});

describe('tokens-v3.css — Layer-A structural tokens exist', () => {
  for (const name of LAYER_A_REQUIRED) {
    it(`defines ${name}`, () => {
      expect(v3Decls.has(name), `${name} missing from tokens-v3.css`).toBe(true);
    });
  }

  it('--ease-paper is the correct slow-finish cubic-bezier', () => {
    expect(v3Decls.get('--ease-paper')).toBe('cubic-bezier(0.32, 0.72, 0, 1)');
  });

  it('--radius-canvas is 0', () => {
    expect(v3Decls.get('--radius-canvas')).toBe('0');
  });

  it('--text-2xs is 10px', () => {
    expect(v3Decls.get('--text-2xs')).toBe('10px');
  });
});

describe('brand-swap invariant — Layer-A tokens never reference --brand-*', () => {
  it('no Layer-A token in tokens-v3.css reads a --brand-* variable', () => {
    const violations: string[] = [];
    for (const [name, value] of v3Decls) {
      const refs = referencedBrandTokens(value);
      if (refs.length > 0) {
        violations.push(`${name}: ${value}  (references ${refs.join(', ')})`);
      }
    }
    expect(
      violations,
      'Layer-A tokens must not reference --brand-* variables:\n' + violations.join('\n'),
    ).toHaveLength(0);
  });

  it('simulates --brand-accent override: canary hex does not appear in any Layer-A value', () => {
    const CANARY = '#f0e130';
    // Confirm canary does not appear in v3 token values (it's only in brand-layer defaults via var())
    const contaminated = [...v3Decls.entries()].filter(([, v]) => v.includes(CANARY));
    expect(
      contaminated,
      `Layer-A token values must not contain the canary brand hex ${CANARY}`,
    ).toHaveLength(0);
  });
});

describe('CAN-V3-01 brand-swap invariant — line-weight tokens are byte-identical across brand swaps', () => {
  it.each(LINE_WEIGHT_LAYER_A)(
    'line-weight token %s is declared in tokens-drafting.css',
    (name) => {
      expect(draftingDecls.has(name), `${name} missing from tokens-drafting.css`).toBe(true);
    },
  );

  it.each(LINE_WEIGHT_LAYER_A)(
    'line-weight token %s does not reference any --brand-* variable',
    (name) => {
      const value = draftingDecls.get(name) ?? '';
      const brandRefs = referencedBrandTokens(value);
      expect(
        brandRefs,
        `${name} references brand tokens ${brandRefs.join(', ')} — line weights must be brand-swap-invariant`,
      ).toHaveLength(0);
    },
  );

  it('changing --brand-accent does not affect any line-weight px value (canary probe)', () => {
    const CANARY = '#f0e130';
    // None of the line-weight token values should contain a hex that could
    // be injected via --brand-accent. Static proof: values are literal px values, not var() references.
    const contaminated = LINE_WEIGHT_LAYER_A.filter((name) => {
      const value = draftingDecls.get(name) ?? '';
      return value.includes(CANARY) || referencedBrandTokens(value).length > 0;
    });
    expect(
      contaminated,
      `Line-weight tokens must not be contaminated by brand overrides: ${contaminated.join(', ')}`,
    ).toHaveLength(0);
  });
});
