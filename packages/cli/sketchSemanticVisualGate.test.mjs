import test from 'node:test';
import assert from 'node:assert/strict';

import {
  SEMANTIC_VISUAL_CATEGORIES,
  SKETCH_SEMANTIC_VISUAL_GATE_SCHEMA_VERSION,
  evaluateSketchSemanticVisualGate,
} from './lib/sketch-semantic-visual-gate.mjs';

const GENERATED_AT = '2026-05-19T10:00:00.000Z';

function checklistWithCheck(check = {}, item = {}) {
  return {
    schemaVersion: 'sketch-to-bim-visual-checklist.v0',
    items: [
      {
        id: 'front:facade_rhythm',
        viewId: 'front',
        featureId: 'facade_rhythm',
        category: 'facade_rhythm',
        required: true,
        evidencePaths: ['evidence/front.png'],
        semanticChecks: [
          {
            id: 'window_bay_rhythm_matches',
            required: true,
            prompt: 'Window bay rhythm matches the source sketch.',
            ...check,
          },
        ],
        ...item,
      },
    ],
  };
}

function completeTolerance(overrides = {}) {
  return {
    schemaVersion: 'sketch.tolerance-ledger.v1',
    ok: true,
    tolerances: [
      {
        id: 'tol-window-rhythm',
        affectedCheckIds: ['window_bay_rhythm_matches'],
        reason: 'Source sketch facade rhythm is intentionally simplified for this phase.',
        owner: 'worker-d',
        expiryCondition: 'Resolve during facade detailing phase.',
        evidenceLinks: ['evidence/tolerances/facade-rhythm.md'],
        ...overrides,
      },
    ],
  };
}

test('unchecked required checklist item blocks with evidence paths and notes', () => {
  const result = evaluateSketchSemanticVisualGate({
    checklist: checklistWithCheck({
      status: 'unchecked',
      notes: 'Needs visual read after screenshot refresh.',
      evidence: ['evidence/front-readout.md'],
    }),
    generatedAt: GENERATED_AT,
    phaseId: 'p3',
  });

  assert.equal(result.schemaVersion, SKETCH_SEMANTIC_VISUAL_GATE_SCHEMA_VERSION);
  assert.equal(result.generatedAt, GENERATED_AT);
  assert.equal(result.phaseId, 'p3');
  assert.equal(result.ok, false);
  assert.equal(result.summary.checklistRequiredCount, 1);
  assert.equal(result.summary.checklistUncheckedCount, 1);
  assert.equal(result.summary.blockerCount, 1);
  assert.equal(result.blockers[0].blockerCode, 'required_check_unchecked');
  assert.equal(result.blockers[0].category, 'facade_rhythm');
  assert.deepEqual(result.blockers[0].evidencePaths, [
    'evidence/front.png',
    'evidence/front-readout.md',
  ]);
  assert.ok(result.blockers[0].notes.includes('Needs visual read after screenshot refresh.'));
});

test('failed required checklist item blocks in the inferred roof cutout category', () => {
  const result = evaluateSketchSemanticVisualGate({
    checklist: checklistWithCheck(
      {
        id: 'roof_cutout_present',
        status: 'fail',
        notes: 'Roof terrace is metadata-only; no visible void.',
      },
      {
        id: 'roof:roof_terrace_cutout',
        category: undefined,
        featureId: 'roof_terrace_cutout',
        prompt: 'Confirm roof terrace cutout is visible.',
      },
    ),
    generatedAt: GENERATED_AT,
  });

  assert.equal(result.ok, false);
  assert.equal(result.summary.checklistFailCount, 1);
  assert.equal(result.blockers[0].blockerCode, 'required_check_failed');
  assert.equal(result.blockers[0].category, 'roof_cutout');
  assert.ok(result.blockers[0].notes.some((note) => note.includes('Roof terrace is metadata-only')));
});

test('tolerated checklist item passes only with matching complete ledger row', () => {
  const result = evaluateSketchSemanticVisualGate({
    checklist: checklistWithCheck({
      status: 'tolerated',
      toleranceId: 'tol-window-rhythm',
      notes: 'Accepted phase tolerance.',
    }),
    toleranceLedger: completeTolerance(),
    generatedAt: GENERATED_AT,
  });

  assert.equal(result.ok, true);
  assert.equal(result.summary.checklistPassCount, 1);
  assert.equal(result.summary.blockerCount, 0);
  assert.equal(result.checklist[0].result, 'pass');
  assert.equal(result.checklist[0].tolerance.id, 'tol-window-rhythm');
  assert.deepEqual(result.checklist[0].tolerance.missing, []);
});

test('unchecked checklist item can pass from deterministic acceptance evidence and feature trace', () => {
  const result = evaluateSketchSemanticVisualGate({
    checklist: checklistWithCheck({ status: 'unchecked' }),
    evidence: {
      // Field name is the legacy engine contract (see sketch-semantic-visual-gate.mjs).
      targetHouseEvidenceAcceptance: {
        ok: true,
        visualRows: [
          {
            viewId: 'front',
            status: 'pass',
            screenshot: { path: 'evidence/screenshots/front.png' },
          },
        ],
        dataQualityRows: [{ id: 'bim_data_quality_report', status: 'pass' }],
      },
      requiredFeatures: [
        {
          id: 'facade_rhythm',
          phaseId: 'P4',
          requiredViewIds: ['front'],
          requiredElementIds: ['front-window-1'],
          sourceRefs: ['spec/samples/sample-house-sketch-ir.draft.json#features'],
        },
      ],
    },
    generatedAt: GENERATED_AT,
  });

  assert.equal(result.ok, true);
  assert.equal(result.summary.checklistPassCount, 1);
  assert.equal(result.summary.checklistUncheckedCount, 0);
  assert.equal(result.checklist[0].status, 'evidence_pass');
  assert.equal(result.checklist[0].featureTrace.featureId, 'facade_rhythm');
});

test('invalid checklist row disposition passes only with reason and evidence', () => {
  const result = evaluateSketchSemanticVisualGate({
    checklist: checklistWithCheck({
      status: 'invalid_checklist_row',
      notes: 'Generated row is stale for this feature/view contract.',
      evidencePath: 'evidence/semantic-disposition.json',
    }),
    generatedAt: GENERATED_AT,
  });

  assert.equal(result.ok, true);
  assert.equal(result.summary.checklistInvalidCount, 1);
  assert.equal(result.summary.blockerCount, 0);
  assert.equal(result.checklist[0].result, 'invalid');
});

test('invalid checklist row disposition blocks when incomplete', () => {
  const result = evaluateSketchSemanticVisualGate({
    checklist: checklistWithCheck(
      {
        status: 'invalid_checklist_row',
        notes: 'Generated row is stale for this feature/view contract.',
      },
      { evidencePaths: [] },
    ),
    generatedAt: GENERATED_AT,
  });

  assert.equal(result.ok, false);
  assert.equal(result.summary.checklistFailCount, 1);
  assert.equal(result.blockers[0].blockerCode, 'invalid_checklist_disposition_incomplete');
  assert.deepEqual(result.blockers[0].dispositionMissing, ['evidencePaths']);
});

test('unresolved drift blocks when current phase differs from source reference', () => {
  const result = evaluateSketchSemanticVisualGate({
    checklist: { items: [] },
    driftRows: [
      {
        id: 'front-silhouette-drift',
        category: 'silhouette',
        current: 'flat parapet box',
        sourceReference: 'asymmetric folded gable silhouette',
        evidencePaths: ['evidence/front.png', 'evidence/source-front.png'],
        notes: 'Main roof line no longer matches the source read.',
      },
    ],
    generatedAt: GENERATED_AT,
  });

  assert.equal(result.ok, false);
  assert.equal(result.summary.driftRowCount, 1);
  assert.equal(result.summary.driftBlockCount, 1);
  assert.equal(result.blockers[0].blockerCode, 'unresolved_visual_drift');
  assert.equal(result.blockers[0].category, 'silhouette');
  assert.deepEqual(result.blockers[0].evidencePaths, [
    'evidence/front.png',
    'evidence/source-front.png',
  ]);
});

test('all-pass case covers required categories without blockers', () => {
  const result = evaluateSketchSemanticVisualGate({
    checklist: {
      items: SEMANTIC_VISUAL_CATEGORIES.map((category) => ({
        id: `item:${category}`,
        category,
        required: true,
        evidencePaths: [`evidence/${category}.png`],
        semanticChecks: [
          {
            id: `check:${category}`,
            required: true,
            status: 'pass',
            notes: `${category} verified against source readout.`,
          },
        ],
      })),
    },
    driftRows: SEMANTIC_VISUAL_CATEGORIES.map((category) => ({
      id: `drift:${category}`,
      category,
      current: `${category}: source-aligned`,
      previous: `${category}: source-aligned`,
      evidencePaths: [`evidence/${category}-drift.md`],
    })),
    generatedAt: GENERATED_AT,
  });

  assert.equal(result.ok, true);
  assert.equal(result.summary.checklistRequiredCount, SEMANTIC_VISUAL_CATEGORIES.length);
  assert.equal(result.summary.checklistPassCount, SEMANTIC_VISUAL_CATEGORIES.length);
  assert.equal(result.summary.driftPassCount, SEMANTIC_VISUAL_CATEGORIES.length);
  assert.equal(result.summary.blockerCount, 0);
  for (const category of SEMANTIC_VISUAL_CATEGORIES) {
    assert.equal(result.summary.checklistByCategory[category], 1);
    assert.equal(result.summary.driftByCategory[category], 1);
  }
});
