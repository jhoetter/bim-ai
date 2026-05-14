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
    'trimExtendToCorner',
    'moveElementsDelta',
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
      /const\s+\{[\s\S]*wallLocationLine[\s\S]*wallDrawOffsetMm[\s\S]*wallDrawRadiusMm[\s\S]*\}\s*=\s*useBimStore\.getState\(\)/,
    );
    expect(SRC).toMatch(/const\s+effectiveLocationLine\s*=/);
    expect(SRC).toMatch(/locationLine:\s*effectiveLocationLine/);
    expect(SRC).toMatch(/buildWallRadiusFillet\(/);
  });

  it('flips wall side without reversing authored wall endpoints', () => {
    expect(SRC).toContain('flipWallLocationLineSide(wallLocationLine)');
    expect(SRC).not.toMatch(/const\s+actualStart\s*=\s*reverse\s*\?\s*end\s*:\s*start/);
    expect(SRC).not.toMatch(/const\s+actualEnd\s*=\s*reverse\s*\?\s*start\s*:\s*end/);
  });

  it('wires the Offset modify tool through a selected-wall moveElementsDelta command', () => {
    expect(SRC).toContain("planTool === 'offset'");
    expect(SRC).toContain('wallOffsetMoveCommandFromPoint(');
    expect(SRC).toContain('data-testid="offset-tool-chip"');
  });

  it('snaps wall authoring points to shared wall connectivity before generic plan snaps', () => {
    expect(SRC).toContain('snapWallPointToConnectivity(');
    expect(SRC).toMatch(/planTool\s*===\s*['"]wall['"][\s\S]{0,280}snapWallPointToConnectivity/);
  });

  it('blocks wall commit outside an enabled crop region with explicit user warning', () => {
    expect(SRC).toMatch(
      /shouldBlockWallCommitOutsideCrop\(\s*activeCropState,\s*pathStart,\s*pathEnd\s*\)/,
    );
    expect(SRC).toMatch(/setWallDraftNotice\(\s*WALL_CROP_BLOCK_MESSAGE\s*\)/);
    expect(SRC).toContain('data-testid="wall-draft-notice"');
  });

  it('re-arms wall loop continuation through deterministic helper state', () => {
    expect(SRC).toMatch(/nextWallDraftAfterCommit\(\s*\{/);
    expect(SRC).toMatch(/loopMode:\s*useToolPrefs\.getState\(\)\.loopMode/);
  });

  it('clears draft preview artifacts on Escape for wall lifecycle stability', () => {
    expect(SRC).toMatch(
      /if\s*\(\s*hadDraft[\s\S]{0,300}planTool === ['"]wall['"][\s\S]{0,240}clearPreview\(\)/,
    );
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

  it('routes Room Separation sketch sessions through Pick Walls-capable SketchCanvas', () => {
    expect(SRC).toMatch(
      /planTool\s*===\s*['"]room-separation-sketch['"][\s\S]{0,180}['"]room_separation['"]/,
    );
    expect(SRC).toMatch(
      /<SketchCanvas[\s\S]{0,900}wallsForPicking=\{Object\.values\(elementsById\)/,
    );
  });

  it('renders the active level datum line and elevation badge in plan view', () => {
    expect(SRC).toContain('data-testid="plan-level-datum-line"');
    expect(SRC).toContain('data-testid="plan-level-elevation-badge"');
  });

  it('keeps Rotate on the reference-ray and typed-angle workflow', () => {
    expect(SRC).toMatch(/rotateReferenceRef/);
    expect(SRC).toMatch(/rotateDeltaAngleFromReference/);
    expect(SRC).toMatch(/parseTypedRotateAngle/);
    expect(SRC).toContain('Click end ray or type angle + Enter');
  });
});
