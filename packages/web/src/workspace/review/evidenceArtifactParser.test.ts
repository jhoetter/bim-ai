import { describe, expect, it } from 'vitest';

import { parseEvidenceArtifact, parseRoomCandidates } from './evidenceArtifactParser';

// ─── parseEvidenceArtifact ────────────────────────────────────────────────────

describe('parseEvidenceArtifact — null / empty input', () => {
  it('returns empty summary for null', () => {
    const r = parseEvidenceArtifact(null, 1);
    expect(r.semanticDigestPrefix16).toBeNull();
    expect(r.sheetRows).toEqual([]);
    expect(r.mismatchNotes).toEqual([]);
    expect(r.reviewActions).toEqual([]);
  });

  it('returns empty summary for empty string', () => {
    const r = parseEvidenceArtifact('', 1);
    expect(r.sheetRows).toEqual([]);
    expect(r.mismatchNotes).toEqual([]);
  });
});

describe('parseEvidenceArtifact — invalid JSON', () => {
  it('returns mismatch note on malformed JSON', () => {
    const r = parseEvidenceArtifact('{bad json', 1);
    expect(r.mismatchNotes).toContain('Could not parse evidence JSON for artifact summary.');
    expect(r.sheetRows).toEqual([]);
  });
});

describe('parseEvidenceArtifact — digest fields', () => {
  it('extracts semanticDigestPrefix16', () => {
    const payload = { semanticDigestPrefix16: 'abc123' };
    const r = parseEvidenceArtifact(JSON.stringify(payload), 1);
    expect(r.semanticDigestPrefix16).toBe('abc123');
  });

  it('extracts 12-char tail from semanticDigestSha256', () => {
    const fullHash = 'a'.repeat(52) + 'b'.repeat(12);
    const payload = { semanticDigestSha256: fullHash };
    const r = parseEvidenceArtifact(JSON.stringify(payload), 1);
    expect(r.semanticDigestSha256Full).toBe(fullHash);
    expect(r.semanticDigestSha256Tail).toBe('b'.repeat(12));
  });

  it('uses short hash as-is when < 12 chars', () => {
    const payload = { semanticDigestSha256: 'short' };
    const r = parseEvidenceArtifact(JSON.stringify(payload), 1);
    expect(r.semanticDigestSha256Tail).toBe('short');
  });

  it('sets digest fields null when absent', () => {
    const r = parseEvidenceArtifact(JSON.stringify({}), 1);
    expect(r.semanticDigestPrefix16).toBeNull();
    expect(r.semanticDigestSha256Tail).toBeNull();
    expect(r.semanticDigestSha256Full).toBeNull();
  });
});

describe('parseEvidenceArtifact — modelRevision', () => {
  it('reads modelRevision as number', () => {
    const r = parseEvidenceArtifact(JSON.stringify({ modelRevision: 42 }), 42);
    expect(r.modelRevision).toBe(42);
  });

  it('falls back to revision field', () => {
    const r = parseEvidenceArtifact(JSON.stringify({ revision: 7 }), 7);
    expect(r.modelRevision).toBe(7);
  });

  it('parses numeric string modelRevision', () => {
    const r = parseEvidenceArtifact(JSON.stringify({ modelRevision: '15' }), 15);
    expect(r.modelRevision).toBe(15);
  });

  it('sets modelRevision null when not a number', () => {
    const r = parseEvidenceArtifact(JSON.stringify({ modelRevision: null }), 1);
    expect(r.modelRevision).toBeNull();
  });
});

describe('parseEvidenceArtifact — payload envelope variants', () => {
  it('reads from nested payload key', () => {
    const doc = { payload: { semanticDigestPrefix16: 'nested' } };
    const r = parseEvidenceArtifact(JSON.stringify(doc), 1);
    expect(r.semanticDigestPrefix16).toBe('nested');
  });

  it('reads from evidencePackage key', () => {
    const doc = { evidencePackage: { semanticDigestPrefix16: 'pkg' } };
    const r = parseEvidenceArtifact(JSON.stringify(doc), 1);
    expect(r.semanticDigestPrefix16).toBe('pkg');
  });

  it('reads from flat root when no wrapper', () => {
    const doc = { semanticDigestPrefix16: 'flat' };
    const r = parseEvidenceArtifact(JSON.stringify(doc), 1);
    expect(r.semanticDigestPrefix16).toBe('flat');
  });
});

describe('parseEvidenceArtifact — sheetRows', () => {
  const makeSheet = (overrides: Record<string, unknown> = {}) => ({
    sheetId: 's1',
    sheetName: 'A-001',
    playwrightSuggestedFilenames: {
      pngViewport: 'viewport.png',
      pngFullSheet: 'full.png',
    },
    correlation: {
      suggestedEvidenceBundleEvidencePackageJson: 'bundle.json',
    },
    ...overrides,
  });

  it('maps sheetId and sheetName', () => {
    const payload = { deterministicSheetEvidence: [makeSheet()] };
    const r = parseEvidenceArtifact(JSON.stringify(payload), 1);
    expect(r.sheetRows[0]?.sheetId).toBe('s1');
    expect(r.sheetRows[0]?.sheetName).toBe('A-001');
  });

  it('maps pngViewport and pngFullSheet', () => {
    const payload = { deterministicSheetEvidence: [makeSheet()] };
    const r = parseEvidenceArtifact(JSON.stringify(payload), 1);
    expect(r.sheetRows[0]?.pngViewport).toBe('viewport.png');
    expect(r.sheetRows[0]?.pngFullSheet).toBe('full.png');
  });

  it('maps bundleJson from correlation', () => {
    const payload = { deterministicSheetEvidence: [makeSheet()] };
    const r = parseEvidenceArtifact(JSON.stringify(payload), 1);
    expect(r.sheetRows[0]?.bundleJson).toBe('bundle.json');
  });

  it('adds mismatch note when sheet missing PNG hints', () => {
    const sheet = makeSheet();
    delete (sheet as Record<string, unknown>).playwrightSuggestedFilenames;
    const payload = { deterministicSheetEvidence: [sheet] };
    const r = parseEvidenceArtifact(JSON.stringify(payload), 1);
    expect(r.mismatchNotes.some((n) => n.includes('s1') && n.includes('missing'))).toBe(true);
  });

  it('supports snake_case sheetId fallback', () => {
    const sheet = { sheet_id: 's2', sheet_name: 'B-001' };
    const payload = { deterministicSheetEvidence: [sheet] };
    const r = parseEvidenceArtifact(JSON.stringify(payload), 1);
    expect(r.sheetRows[0]?.sheetId).toBe('s2');
    expect(r.sheetRows[0]?.sheetName).toBe('B-001');
  });

  it('extracts placeholderPngSha256Tail from sheetPrintRasterIngest_v1', () => {
    const ph = 'a'.repeat(52) + 'c'.repeat(12);
    const sheet = makeSheet({ sheetPrintRasterIngest_v1: { placeholderPngSha256: ph } });
    const payload = { deterministicSheetEvidence: [sheet] };
    const r = parseEvidenceArtifact(JSON.stringify(payload), 1);
    expect(r.sheetRows[0]?.placeholderPngSha256Tail).toBe('c'.repeat(12));
  });
});

describe('parseEvidenceArtifact — view3dRows', () => {
  it('maps viewpointId', () => {
    const payload = {
      deterministic3dViewEvidence: [
        {
          viewpointId: 'vp1',
          viewpointName: 'Front',
          playwrightSuggestedFilenames: { pngViewport: 'vp1.png' },
          correlation: {},
        },
      ],
    };
    const r = parseEvidenceArtifact(JSON.stringify(payload), 1);
    expect(r.view3dRows[0]?.viewpointId).toBe('vp1');
    expect(r.view3dRows[0]?.viewpointName).toBe('Front');
    expect(r.view3dRows[0]?.pngViewport).toBe('vp1.png');
  });

  it('adds mismatch note when viewpoint missing pngViewport', () => {
    const payload = {
      deterministic3dViewEvidence: [{ viewpointId: 'vp2', correlation: {} }],
    };
    const r = parseEvidenceArtifact(JSON.stringify(payload), 1);
    expect(r.mismatchNotes.some((n) => n.includes('vp2') && n.includes('missing'))).toBe(true);
  });
});

describe('parseEvidenceArtifact — planViewRows', () => {
  it('maps planViewId, name, levelId, planPresentation', () => {
    const payload = {
      deterministicPlanViewEvidence: [
        {
          planViewId: 'pv1',
          name: 'Level 1 Plan',
          levelId: 'lvl1',
          planPresentation: 'architectural',
          playwrightSuggestedFilenames: { pngPlanCanvas: 'plan.png' },
          correlation: {},
        },
      ],
    };
    const r = parseEvidenceArtifact(JSON.stringify(payload), 1);
    const row = r.planViewRows[0];
    expect(row?.planViewId).toBe('pv1');
    expect(row?.name).toBe('Level 1 Plan');
    expect(row?.levelId).toBe('lvl1');
    expect(row?.planPresentation).toBe('architectural');
    expect(row?.pngPlanCanvas).toBe('plan.png');
  });
});

describe('parseEvidenceArtifact — sectionCutRows', () => {
  it('maps sectionCutId and pngSectionViewport', () => {
    const payload = {
      deterministicSectionCutEvidence: [
        {
          sectionCutId: 'sc1',
          name: 'East Cut',
          projectionWireHref: '/wires/sc1.json',
          playwrightSuggestedFilenames: { pngSectionViewport: 'sc1.png' },
          correlation: {},
        },
      ],
    };
    const r = parseEvidenceArtifact(JSON.stringify(payload), 1);
    const row = r.sectionCutRows[0];
    expect(row?.sectionCutId).toBe('sc1');
    expect(row?.name).toBe('East Cut');
    expect(row?.projectionWireHref).toBe('/wires/sc1.json');
    expect(row?.pngSectionViewport).toBe('sc1.png');
  });
});

describe('parseEvidenceArtifact — closureHints', () => {
  it('parses all closureHints fields', () => {
    const payload = {
      agentEvidenceClosureHints: {
        playwrightEvidenceSpecRelPath: 'e2e/evidence.spec.ts',
        suggestedRegenerationCommands: ['pnpm evidence:generate'],
        ciArtifactRelativePaths: ['artifacts/screenshots'],
        ciEnvPlaceholderHints: ['CI_TOKEN'],
      },
    };
    const r = parseEvidenceArtifact(JSON.stringify(payload), 1);
    expect(r.closureHints?.playwrightSpec).toBe('e2e/evidence.spec.ts');
    expect(r.closureHints?.commands).toEqual(['pnpm evidence:generate']);
    expect(r.closureHints?.ciPaths).toEqual(['artifacts/screenshots']);
    expect(r.closureHints?.envHints).toEqual(['CI_TOKEN']);
  });

  it('sets closureHints null when absent', () => {
    const r = parseEvidenceArtifact(JSON.stringify({}), 1);
    expect(r.closureHints).toBeNull();
  });
});

describe('parseEvidenceArtifact — closureReview', () => {
  const makeClosureReview = (overrides: Record<string, unknown> = {}) => ({
    primaryScreenshotArtifactCount: 3,
    expectedDeterministicPngBasenames: ['a.png', 'b.png'],
    correlationDigestConsistency: {
      isFullyConsistent: true,
      staleRowsRelativeToPackageDigest: [],
      rowsMissingCorrelationDigest: [],
    },
    ...overrides,
  });

  it('parses primaryCount and basenames', () => {
    const payload = { evidenceClosureReview_v1: makeClosureReview() };
    const r = parseEvidenceArtifact(JSON.stringify(payload), 1);
    expect(r.closureReview?.primaryCount).toBe(3);
    expect(r.closureReview?.basenames).toEqual(['a.png', 'b.png']);
  });

  it('parses correlationFullyConsistent true', () => {
    const payload = { evidenceClosureReview_v1: makeClosureReview() };
    const r = parseEvidenceArtifact(JSON.stringify(payload), 1);
    expect(r.closureReview?.correlationFullyConsistent).toBe(true);
  });

  it('parses correlationFullyConsistent false', () => {
    const cr = makeClosureReview({
      correlationDigestConsistency: { isFullyConsistent: false },
    });
    const r = parseEvidenceArtifact(JSON.stringify({ evidenceClosureReview_v1: cr }), 1);
    expect(r.closureReview?.correlationFullyConsistent).toBe(false);
  });

  it('counts stale and missing rows', () => {
    const cr = makeClosureReview({
      correlationDigestConsistency: {
        isFullyConsistent: false,
        staleRowsRelativeToPackageDigest: ['r1'],
        rowsMissingCorrelationDigest: ['r2', 'r3'],
      },
    });
    const r = parseEvidenceArtifact(JSON.stringify({ evidenceClosureReview_v1: cr }), 1);
    expect(r.closureReview?.staleRowCount).toBe(1);
    expect(r.closureReview?.missingDigestRowCount).toBe(2);
  });

  it('parses pixelDiffExpectation fields', () => {
    const cr = makeClosureReview({
      pixelDiffExpectation: {
        status: 'pass',
        diffArtifactBasenameSuffix: '-diff',
        thresholdPolicy_v1: {
          enforcement: 'hard',
          mismatchPixelRatioFailAbove: 0.05,
        },
      },
    });
    const r = parseEvidenceArtifact(JSON.stringify({ evidenceClosureReview_v1: cr }), 1);
    expect(r.closureReview?.pixelDiffStatus).toBe('pass');
    expect(r.closureReview?.pixelDiffSuffix).toBe('-diff');
    expect(r.closureReview?.pixelDiffThresholdEnforcement).toBe('hard');
    expect(r.closureReview?.pixelMismatchRatioFailAbove).toBe(0.05);
  });

  it('sets closureReview null when absent', () => {
    const r = parseEvidenceArtifact(JSON.stringify({}), 1);
    expect(r.closureReview).toBeNull();
  });
});

describe('parseEvidenceArtifact — diffFixLoop', () => {
  it('parses needsFixLoop and blockerCodes when format matches', () => {
    const payload = {
      evidenceDiffIngestFixLoop_v1: {
        format: 'evidence_diff_ingest_fix_loop_v1',
        needsFixLoop: true,
        blockerCodes: ['MISSING_BASELINE', 'STALE_DIGEST'],
      },
    };
    const r = parseEvidenceArtifact(JSON.stringify(payload), 1);
    expect(r.diffFixLoop?.needsFixLoop).toBe(true);
    expect(r.diffFixLoop?.blockerCodes).toEqual(['MISSING_BASELINE', 'STALE_DIGEST']);
  });

  it('ignores block when format does not match', () => {
    const payload = {
      evidenceDiffIngestFixLoop_v1: {
        format: 'wrong_format',
        needsFixLoop: true,
      },
    };
    const r = parseEvidenceArtifact(JSON.stringify(payload), 1);
    expect(r.diffFixLoop).toBeNull();
  });

  it('sets diffFixLoop null when absent', () => {
    const r = parseEvidenceArtifact(JSON.stringify({}), 1);
    expect(r.diffFixLoop).toBeNull();
  });
});

describe('parseEvidenceArtifact — performanceGate', () => {
  it('parses gateClosed, enforcement, probeKind', () => {
    const payload = {
      evidenceReviewPerformanceGate_v1: {
        format: 'evidenceReviewPerformanceGate_v1',
        gateClosed: true,
        enforcement: 'hard',
        probeKind: 'lighthouse',
        blockerCodesEcho: ['LCP_BUDGET'],
      },
    };
    const r = parseEvidenceArtifact(JSON.stringify(payload), 1);
    expect(r.performanceGate?.gateClosed).toBe(true);
    expect(r.performanceGate?.enforcement).toBe('hard');
    expect(r.performanceGate?.probeKind).toBe('lighthouse');
    expect(r.performanceGate?.blockerCodesEcho).toEqual(['LCP_BUDGET']);
  });

  it('sets performanceGate null when absent', () => {
    const r = parseEvidenceArtifact(JSON.stringify({}), 1);
    expect(r.performanceGate).toBeNull();
  });
});

describe('parseEvidenceArtifact — mismatchNotes', () => {
  it('adds revision mismatch note when evidence revision differs from store', () => {
    const payload = { modelRevision: 5 };
    const r = parseEvidenceArtifact(JSON.stringify(payload), 10);
    expect(
      r.mismatchNotes.some(
        (n) => n.includes('modelRevision') && n.includes('5') && n.includes('10'),
      ),
    ).toBe(true);
  });

  it('no revision mismatch note when revisions match', () => {
    const payload = { modelRevision: 5 };
    const r = parseEvidenceArtifact(JSON.stringify(payload), 5);
    expect(r.mismatchNotes.filter((n) => n.includes('modelRevision'))).toHaveLength(0);
  });

  it('adds prefix mismatch note for sheet with wrong correlation prefix', () => {
    const sheetWithWrongPrefix = {
      sheetId: 'sX',
      sheetName: 'X-001',
      playwrightSuggestedFilenames: { pngViewport: 'x.png', pngFullSheet: 'xf.png' },
      correlation: { semanticDigestPrefix16: 'wrong-prefix' },
    };
    const payload = {
      semanticDigestPrefix16: 'correct-prefix',
      deterministicSheetEvidence: [sheetWithWrongPrefix],
    };
    const r = parseEvidenceArtifact(JSON.stringify(payload), 1);
    expect(r.mismatchNotes.some((n) => n.includes('sX') && n.includes('wrong-prefix'))).toBe(true);
  });
});

describe('parseEvidenceArtifact — evidenceFreshness', () => {
  it('computes freshness from closureReview counts', () => {
    const cr = {
      primaryScreenshotArtifactCount: 10,
      expectedDeterministicPngBasenames: [],
      correlationDigestConsistency: {
        staleRowsRelativeToPackageDigest: ['a', 'b'],
        rowsMissingCorrelationDigest: ['c'],
      },
    };
    const r = parseEvidenceArtifact(JSON.stringify({ evidenceClosureReview_v1: cr }), 1);
    expect(r.evidenceFreshness?.totalCount).toBe(10);
    expect(r.evidenceFreshness?.staleCount).toBe(2);
    expect(r.evidenceFreshness?.missingCount).toBe(1);
    expect(r.evidenceFreshness?.freshCount).toBe(7);
  });

  it('sets evidenceFreshness null when no closureReview', () => {
    const r = parseEvidenceArtifact(JSON.stringify({}), 1);
    expect(r.evidenceFreshness).toBeNull();
  });
});

describe('parseEvidenceArtifact — regenerationGuidance', () => {
  it('parses regeneration actions array', () => {
    const payload = {
      agentRegenerationGuidance_v1: {
        actions: [
          {
            priority: 'high',
            artifactKey: 'screenshots',
            reason: 'Baseline missing',
            suggestedCommand: 'pnpm playwright test',
          },
        ],
      },
    };
    const r = parseEvidenceArtifact(JSON.stringify(payload), 1);
    expect(r.regenerationGuidance).toHaveLength(1);
    expect(r.regenerationGuidance?.[0]?.priority).toBe('high');
    expect(r.regenerationGuidance?.[0]?.artifactKey).toBe('screenshots');
  });

  it('filters out actions with empty artifactKey', () => {
    const payload = {
      agentRegenerationGuidance_v1: {
        actions: [{ priority: 'low', artifactKey: '', reason: 'x', suggestedCommand: 'y' }],
      },
    };
    const r = parseEvidenceArtifact(JSON.stringify(payload), 1);
    expect(r.regenerationGuidance).toHaveLength(0);
  });

  it('sets regenerationGuidance null when absent', () => {
    const r = parseEvidenceArtifact(JSON.stringify({}), 1);
    expect(r.regenerationGuidance).toBeNull();
  });
});

describe('parseEvidenceArtifact — suggestedBasenameHint', () => {
  it('reads suggestedEvidenceArtifactBasename', () => {
    const payload = { suggestedEvidenceArtifactBasename: 'evidence-2026-05-06.json' };
    const r = parseEvidenceArtifact(JSON.stringify(payload), 1);
    expect(r.suggestedBasenameHint).toBe('evidence-2026-05-06.json');
  });

  it('sets suggestedBasenameHint null when absent', () => {
    const r = parseEvidenceArtifact(JSON.stringify({}), 1);
    expect(r.suggestedBasenameHint).toBeNull();
  });
});

describe('parseEvidenceArtifact — lifecycleSignal and agentFollowThrough', () => {
  it('captures evidenceLifecycleSignal_v1 as object', () => {
    const payload = { evidenceLifecycleSignal_v1: { stage: 'review' } };
    const r = parseEvidenceArtifact(JSON.stringify(payload), 1);
    expect(r.lifecycleSignal).toEqual({ stage: 'review' });
  });

  it('captures evidenceAgentFollowThrough_v1 as object', () => {
    const payload = { evidenceAgentFollowThrough_v1: { approved: true } };
    const r = parseEvidenceArtifact(JSON.stringify(payload), 1);
    expect(r.agentFollowThrough).toEqual({ approved: true });
  });

  it('sets both null when absent', () => {
    const r = parseEvidenceArtifact(JSON.stringify({}), 1);
    expect(r.lifecycleSignal).toBeNull();
    expect(r.agentFollowThrough).toBeNull();
  });
});

// ─── parseRoomCandidates ──────────────────────────────────────────────────────

describe('parseRoomCandidates — null / empty', () => {
  it('returns null for null input', () => {
    expect(parseRoomCandidates(null)).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(parseRoomCandidates('')).toBeNull();
  });

  it('returns null for invalid JSON', () => {
    expect(parseRoomCandidates('{bad')).toBeNull();
  });
});

describe('parseRoomCandidates — parsing', () => {
  const candidatePayload = (cands: unknown[]) => JSON.stringify({ candidates: cands });

  it('returns empty array when candidates is empty', () => {
    expect(parseRoomCandidates(candidatePayload([]))).toEqual([]);
  });

  it('returns empty array when candidates key absent', () => {
    expect(parseRoomCandidates(JSON.stringify({}))).toEqual([]);
  });

  it('maps candidateId to id', () => {
    const result = parseRoomCandidates(candidatePayload([{ candidateId: 'cand-1' }]));
    expect(result?.[0]?.id).toBe('cand-1');
  });

  it('falls back id to em-dash when candidateId absent', () => {
    const result = parseRoomCandidates(candidatePayload([{}]));
    expect(result?.[0]?.id).toBe('—');
  });

  it('maps approxAreaM2 to area', () => {
    const result = parseRoomCandidates(candidatePayload([{ approxAreaM2: 25.5 }]));
    expect(result?.[0]?.area).toBe(25.5);
  });

  it('sets area null when approxAreaM2 absent', () => {
    const result = parseRoomCandidates(candidatePayload([{}]));
    expect(result?.[0]?.area).toBeNull();
  });

  it('maps levelName to level', () => {
    const result = parseRoomCandidates(candidatePayload([{ levelName: 'Ground Floor' }]));
    expect(result?.[0]?.level).toBe('Ground Floor');
  });

  it('defaults level to empty string when absent', () => {
    const result = parseRoomCandidates(candidatePayload([{}]));
    expect(result?.[0]?.level).toBe('');
  });

  it('maps perimeterApproxM to perimeter', () => {
    const result = parseRoomCandidates(candidatePayload([{ perimeterApproxM: 18.4 }]));
    expect(result?.[0]?.perimeter).toBe(18.4);
  });

  it('counts warnings', () => {
    const result = parseRoomCandidates(
      candidatePayload([{ warnings: [{ code: 'W1' }, { code: 'W2' }] }]),
    );
    expect(result?.[0]?.warnCount).toBe(2);
  });

  it('sets warnCount 0 when no warnings', () => {
    const result = parseRoomCandidates(candidatePayload([{}]));
    expect(result?.[0]?.warnCount).toBe(0);
  });

  it('maps classificationHints schemeColorHint to hint', () => {
    const result = parseRoomCandidates(
      candidatePayload([{ classificationHints: { schemeColorHint: '#ff0000' } }]),
    );
    expect(result?.[0]?.hint).toBe('#ff0000');
  });

  it('defaults hint to empty string when absent', () => {
    const result = parseRoomCandidates(candidatePayload([{}]));
    expect(result?.[0]?.hint).toBe('');
  });

  it('maps first comparisonToAuthoredRooms entry to bestRoomId and bestIou', () => {
    const result = parseRoomCandidates(
      candidatePayload([
        {
          comparisonToAuthoredRooms: [
            { roomId: 'room-42', iouApprox: 0.85 },
            { roomId: 'room-99', iouApprox: 0.4 },
          ],
        },
      ]),
    );
    expect(result?.[0]?.bestRoomId).toBe('room-42');
    expect(result?.[0]?.bestIou).toBe(0.85);
  });

  it('sets bestRoomId empty and bestIou null when no comparison', () => {
    const result = parseRoomCandidates(candidatePayload([{}]));
    expect(result?.[0]?.bestRoomId).toBe('');
    expect(result?.[0]?.bestIou).toBeNull();
  });

  it('maps multiple candidates', () => {
    const result = parseRoomCandidates(
      candidatePayload([
        { candidateId: 'c1', approxAreaM2: 10 },
        { candidateId: 'c2', approxAreaM2: 20 },
      ]),
    );
    expect(result).toHaveLength(2);
    expect(result?.[0]?.id).toBe('c1');
    expect(result?.[1]?.id).toBe('c2');
  });
});
