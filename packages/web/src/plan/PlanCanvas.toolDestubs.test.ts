/**
 * EDT-04 — verify the 9 plan-canvas tool stubs are de-stubbed in
 * PlanCanvas.tsx. The canvas itself depends on three.js + DOM and is
 * cumbersome to mount in JSDOM, so this test asserts at the source-file
 * level that the previous `console.warn('stub: …')` lines are gone and
 * that each tool now dispatches the correct semantic command.
 *
 * If a future refactor moves these dispatches into helper modules, the
 * regex anchors below should be updated to point at the new locations.
 */

import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SRC = readFileSync(path.join(__dirname, 'PlanCanvas.tsx'), 'utf8');

describe('EDT-04 — plan-canvas tool de-stubs', () => {
  it('removes every "stub:" console.warn from PlanCanvas.tsx', () => {
    expect(SRC).not.toMatch(/console\.warn\(\s*'stub:/);
  });

  const expectedCommandTypes = [
    'splitWallAt',
    'alignElementToReference',
    'trimElementToReference',
    'setWallJoinVariant',
    'createWallOpening',
    'createColumn',
    'createBeam',
    'createCeiling',
    'createSlabOpening',
  ];

  for (const cmdType of expectedCommandTypes) {
    it(`emits the ${cmdType} semantic command on tool commit`, () => {
      const pattern = new RegExp(
        String.raw`onSemanticCommand\(\s*\{\s*type:\s*['"]` + cmdType + String.raw`['"]`,
      );
      expect(SRC).toMatch(pattern);
    });
  }

  it('keeps splitWallAt guarded against the wall endpoints (alongT 0 / 1)', () => {
    // The split tool must not emit splitWallAt with endpoint alongT — engine rejects gt(0)/lt(1).
    expect(SRC).toMatch(/nearest\.alongT\s*>\s*0\.\d+\s*&&\s*nearest\.alongT\s*<\s*0\.9/);
  });

  it('routes the Shaft tool to createSlabOpening with isShaft=true', () => {
    // Shaft is a slab opening with the shaft flag set.
    expect(SRC).toMatch(/type:\s*['"]createSlabOpening['"][\s\S]{0,400}isShaft:\s*true/);
  });

  it('uses the visible wall options-bar state for wall location and offset', () => {
    expect(SRC).toMatch(
      /const\s+\{[\s\S]*wallLocationLine[\s\S]*wallDrawOffsetMm[\s\S]*\}\s*=\s*useBimStore\.getState\(\)/,
    );
    expect(SRC).toMatch(/locationLine:\s*wallLocationLine/);
  });

  it('cycles the visible wall location-line setting with Tab while the wall tool is active', () => {
    expect(SRC).toMatch(/ev\.key\s*===\s*['"]Tab['"][\s\S]{0,80}planTool\s*===\s*['"]wall['"]/);
    expect(SRC).toMatch(/setWallLocationLine\(cycleWallLocationLine\(st\.wallLocationLine\)\)/);
  });

  it('passes the Wall-Join variant through unchanged from the reducer effect', () => {
    expect(SRC).toMatch(
      /type:\s*['"]setWallJoinVariant['"][\s\S]{0,200}variant:\s*effect\.commitJoin\.variant/,
    );
  });
});
