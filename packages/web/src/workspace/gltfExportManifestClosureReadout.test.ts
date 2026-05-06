import { describe, expect, it } from 'vitest';

import {
  buildGltfExportManifestClosureReadout,
  formatGltfExportManifestClosureLines,
  isGltfExportManifestClosureV1,
  renderGltfExportManifestClosureReadout,
} from './gltfExportManifestClosureReadout';
import type {
  GltfExportManifestClosureV1,
  GltfExtensionPresenceEntry,
} from './gltfExportManifestClosureReadout';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeEntry(
  token: string,
  status: 'emitted' | 'skipped_ineligible',
  digest?: string,
): GltfExtensionPresenceEntry {
  return {
    token,
    status,
    digestSha256: status === 'emitted' ? (digest ?? 'a'.repeat(64)) : null,
    skipReasonCode: status === 'skipped_ineligible' ? 'no_eligible_elements' : null,
  };
}

function makeClosure(
  overrides?: Partial<GltfExportManifestClosureV1>,
): GltfExportManifestClosureV1 {
  const matrix: GltfExtensionPresenceEntry[] = [
    makeEntry('bim_ai_box_primitive_v0', 'emitted', 'b'.repeat(64)),
    makeEntry('bim_ai_gable_roof_v0', 'skipped_ineligible'),
    makeEntry('bim_ai_wall_corner_joins_v0', 'emitted', 'c'.repeat(64)),
    makeEntry('bim_ai_wall_corner_join_summary_v1', 'emitted', 'd'.repeat(64)),
    makeEntry('bim_ai_saved_3d_view_clip_v1', 'skipped_ineligible'),
  ];
  return {
    format: 'gltfExportManifestClosure_v1',
    extensionTokens: [
      'bim_ai_box_primitive_v0',
      'bim_ai_wall_corner_joins_v0',
      'bim_ai_wall_corner_join_summary_v1',
    ],
    extensionDigests: {
      bim_ai_box_primitive_v0: 'b'.repeat(64),
      bim_ai_wall_corner_joins_v0: 'c'.repeat(64),
      bim_ai_wall_corner_join_summary_v1: 'd'.repeat(64),
    },
    gltfExportManifestClosureDigestSha256: 'e'.repeat(64),
    extensionPresenceMatrix: matrix,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// isGltfExportManifestClosureV1
// ---------------------------------------------------------------------------

describe('isGltfExportManifestClosureV1', () => {
  it('returns true for a valid closure object', () => {
    expect(isGltfExportManifestClosureV1(makeClosure())).toBe(true);
  });

  it('returns false for null', () => {
    expect(isGltfExportManifestClosureV1(null)).toBe(false);
  });

  it('returns false for wrong format string', () => {
    expect(isGltfExportManifestClosureV1({ format: 'other' })).toBe(false);
  });

  it('returns false for a plain string', () => {
    expect(isGltfExportManifestClosureV1('gltfExportManifestClosure_v1')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// buildGltfExportManifestClosureReadout — null / undefined input
// ---------------------------------------------------------------------------

describe('buildGltfExportManifestClosureReadout — null/undefined', () => {
  it('returns empty readout when closure is null', () => {
    const r = buildGltfExportManifestClosureReadout(null);
    expect(r.format).toBe('gltfExportManifestClosureReadout_v1');
    expect(r.emittedCount).toBe(0);
    expect(r.skippedCount).toBe(0);
    expect(r.closureDigestSha256).toBeNull();
    expect(r.closureDigestShort).toBeNull();
    expect(r.rows).toHaveLength(0);
    expect(r.summary).toContain('not available');
  });

  it('returns empty readout when closure is undefined', () => {
    const r = buildGltfExportManifestClosureReadout(undefined);
    expect(r.emittedCount).toBe(0);
  });

  it('returns empty readout for invalid format string', () => {
    const r = buildGltfExportManifestClosureReadout({
      format: 'wrong',
    } as unknown as GltfExportManifestClosureV1);
    expect(r.emittedCount).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// buildGltfExportManifestClosureReadout — counts
// ---------------------------------------------------------------------------

describe('buildGltfExportManifestClosureReadout — counts', () => {
  it('counts emitted and skipped correctly', () => {
    const closure = makeClosure();
    const r = buildGltfExportManifestClosureReadout(closure);
    expect(r.emittedCount).toBe(3);
    expect(r.skippedCount).toBe(2);
  });

  it('emittedCount matches extensionTokens length', () => {
    const closure = makeClosure();
    const r = buildGltfExportManifestClosureReadout(closure);
    expect(r.emittedCount).toBe(closure.extensionTokens.length);
  });

  it('total rows equal matrix length', () => {
    const closure = makeClosure();
    const r = buildGltfExportManifestClosureReadout(closure);
    expect(r.rows).toHaveLength(closure.extensionPresenceMatrix.length);
  });
});

// ---------------------------------------------------------------------------
// buildGltfExportManifestClosureReadout — digest fields
// ---------------------------------------------------------------------------

describe('buildGltfExportManifestClosureReadout — digest fields', () => {
  it('closureDigestSha256 matches input', () => {
    const closure = makeClosure();
    const r = buildGltfExportManifestClosureReadout(closure);
    expect(r.closureDigestSha256).toBe('e'.repeat(64));
  });

  it('closureDigestShort is first 12 chars of digest', () => {
    const closure = makeClosure();
    const r = buildGltfExportManifestClosureReadout(closure);
    expect(r.closureDigestShort).toBe('e'.repeat(12));
  });

  it('emitted row has digestShort from first 12 chars', () => {
    const closure = makeClosure();
    const r = buildGltfExportManifestClosureReadout(closure);
    const boxRow = r.rows.find((row) => row.token === 'bim_ai_box_primitive_v0');
    expect(boxRow?.digestShort).toBe('b'.repeat(12));
  });

  it('skipped row has null digestShort', () => {
    const closure = makeClosure();
    const r = buildGltfExportManifestClosureReadout(closure);
    const gableRow = r.rows.find((row) => row.token === 'bim_ai_gable_roof_v0');
    expect(gableRow?.digestShort).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// buildGltfExportManifestClosureReadout — ordering
// ---------------------------------------------------------------------------

describe('buildGltfExportManifestClosureReadout — ordering', () => {
  it('rows preserve presence matrix order', () => {
    const closure = makeClosure();
    const r = buildGltfExportManifestClosureReadout(closure);
    const rowTokens = r.rows.map((row) => row.token);
    const matrixTokens = closure.extensionPresenceMatrix.map((e) => e.token);
    expect(rowTokens).toEqual(matrixTokens);
  });
});

// ---------------------------------------------------------------------------
// buildGltfExportManifestClosureReadout — summary
// ---------------------------------------------------------------------------

describe('buildGltfExportManifestClosureReadout — summary', () => {
  it('summary contains emitted and skipped counts', () => {
    const closure = makeClosure();
    const r = buildGltfExportManifestClosureReadout(closure);
    expect(r.summary).toContain('3 emitted');
    expect(r.summary).toContain('2 skipped');
  });

  it('summary contains short closure digest', () => {
    const closure = makeClosure();
    const r = buildGltfExportManifestClosureReadout(closure);
    expect(r.summary).toContain('e'.repeat(12));
  });
});

// ---------------------------------------------------------------------------
// formatGltfExportManifestClosureLines
// ---------------------------------------------------------------------------

describe('formatGltfExportManifestClosureLines', () => {
  it('first line is format identifier', () => {
    const closure = makeClosure();
    const r = buildGltfExportManifestClosureReadout(closure);
    const lines = formatGltfExportManifestClosureLines(r);
    expect(lines[0]).toBe('gltfExportManifestClosureReadout_v1');
  });

  it('emitted row line contains token and digest marker', () => {
    const closure = makeClosure();
    const r = buildGltfExportManifestClosureReadout(closure);
    const lines = formatGltfExportManifestClosureLines(r);
    const boxLine = lines.find((l) => l.includes('bim_ai_box_primitive_v0'));
    expect(boxLine).toBeDefined();
    expect(boxLine).toContain('emitted');
    expect(boxLine).toContain('digest=');
    expect(boxLine).toContain('b'.repeat(12));
  });

  it('skipped row line contains skipped_ineligible and digest=none', () => {
    const closure = makeClosure();
    const r = buildGltfExportManifestClosureReadout(closure);
    const lines = formatGltfExportManifestClosureLines(r);
    const gableLine = lines.find((l) => l.includes('bim_ai_gable_roof_v0'));
    expect(gableLine).toBeDefined();
    expect(gableLine).toContain('skipped_ineligible');
    expect(gableLine).toContain('digest=none');
  });

  it('last line is summary line', () => {
    const closure = makeClosure();
    const r = buildGltfExportManifestClosureReadout(closure);
    const lines = formatGltfExportManifestClosureLines(r);
    expect(lines[lines.length - 1]).toContain('summary:');
  });

  it('produces one line per matrix entry plus header and summary', () => {
    const closure = makeClosure();
    const r = buildGltfExportManifestClosureReadout(closure);
    const lines = formatGltfExportManifestClosureLines(r);
    // 1 header + matrix.length rows + 1 summary
    expect(lines).toHaveLength(1 + closure.extensionPresenceMatrix.length + 1);
  });

  it('null closure produces minimal lines', () => {
    const r = buildGltfExportManifestClosureReadout(null);
    const lines = formatGltfExportManifestClosureLines(r);
    expect(lines[0]).toBe('gltfExportManifestClosureReadout_v1');
    expect(lines[lines.length - 1]).toContain('summary:');
  });
});

// ---------------------------------------------------------------------------
// renderGltfExportManifestClosureReadout — data-testid
// ---------------------------------------------------------------------------

describe('renderGltfExportManifestClosureReadout', () => {
  it('sets data-testid="gltf-export-manifest-closure-readout"', () => {
    const closure = makeClosure();
    const el = renderGltfExportManifestClosureReadout(closure);
    expect(el.getAttribute('data-testid')).toBe('gltf-export-manifest-closure-readout');
  });

  it('renders a pre element with monospace content', () => {
    const closure = makeClosure();
    const el = renderGltfExportManifestClosureReadout(closure);
    const pre = el.querySelector('pre');
    expect(pre).not.toBeNull();
    expect(pre?.textContent).toContain('gltfExportManifestClosureReadout_v1');
  });

  it('null closure still renders data-testid container', () => {
    const el = renderGltfExportManifestClosureReadout(null);
    expect(el.getAttribute('data-testid')).toBe('gltf-export-manifest-closure-readout');
    expect(el.querySelector('pre')?.textContent).toContain('not available');
  });

  it('extension tokens appear in rendered output', () => {
    const closure = makeClosure();
    const el = renderGltfExportManifestClosureReadout(closure);
    const text = el.textContent ?? '';
    expect(text).toContain('bim_ai_box_primitive_v0');
    expect(text).toContain('bim_ai_wall_corner_joins_v0');
  });
});

// ---------------------------------------------------------------------------
// Digest stability under input ordering
// ---------------------------------------------------------------------------

describe('digest stability under ordering', () => {
  it('identical closures produce identical readout summaries', () => {
    const c1 = makeClosure();
    const c2 = makeClosure();
    const r1 = buildGltfExportManifestClosureReadout(c1);
    const r2 = buildGltfExportManifestClosureReadout(c2);
    expect(r1.summary).toBe(r2.summary);
    expect(r1.closureDigestSha256).toBe(r2.closureDigestSha256);
  });

  it('different closure digests produce different readout summaries', () => {
    const c1 = makeClosure();
    const c2 = makeClosure({ gltfExportManifestClosureDigestSha256: 'f'.repeat(64) });
    const r1 = buildGltfExportManifestClosureReadout(c1);
    const r2 = buildGltfExportManifestClosureReadout(c2);
    expect(r1.summary).not.toBe(r2.summary);
  });
});
