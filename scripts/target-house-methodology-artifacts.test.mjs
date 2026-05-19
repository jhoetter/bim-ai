import assert from 'node:assert/strict';
import test from 'node:test';

import { buildMethodologyDashboardPayload } from './target-house-methodology-artifacts.mjs';

test('methodology dashboard keeps sketch acceptance separate from normal Advisor', () => {
  const dashboard = buildMethodologyDashboardPayload({
    seed: 'target-house-1',
    phase: 'p1-p7-all',
    phasePacket: { ok: true },
    sourceFeatureMap: {
      rows: [
        { featureId: 'roof_terrace_cutout', resolvedElementIds: ['roof-cut', 'terrace-floor'] },
        { featureId: 'documentation_evidence_set', resolvedElementIds: ['view-main'] },
      ],
    },
    assumptionLedger: { assumptions: [{ id: 'a1', disposition: 'accepted' }] },
    semanticChecklist: {
      checks: [
        { featureId: 'roof_terrace_cutout', verdict: 'pass' },
        { featureId: 'documentation_evidence_set', verdict: 'pass' },
      ],
    },
    issueLedger: {
      entries: [
        { code: 'renderer.roof_cut_verified' },
        { code: 'geometry.envelope_closed' },
        { code: 'evidence.current_head' },
      ],
    },
    evidenceFreshness: { summary: { staleCount: 0, missingCount: 0 } },
    finalCloseoutManifest: {
      rehearsalGate: { ok: true },
      status: { ready: true, blockers: [] },
    },
    artifactRows: [{ path: 'phase-packet.json' }],
  });

  assert.equal(dashboard.schemaVersion, 'target-house-methodology-dashboard.v1');
  assert.equal(dashboard.acceptanceLayer, 'sketch_methodology_not_normal_advisor');
  assert.equal(dashboard.ok, true);
  assert.equal(dashboard.summary.blockingRowCount, 0);
  assert.deepEqual(
    dashboard.rows.map((row) => row.trackerId),
    ['BIR-M07', 'BIR-M08', 'BIR-M09', 'BIR-M10', 'BIR-T01', 'BIR-T04', 'BIR-T05', 'BIR-U06', 'BIR-W04', 'BIR-O04', 'BIR-N10'],
  );
  assert.equal(
    dashboard.rows.find((row) => row.trackerId === 'BIR-M08').summary.taxonomyCounts.renderer,
    1,
  );
});

test('methodology dashboard reports closeout and feature blockers as row evidence', () => {
  const dashboard = buildMethodologyDashboardPayload({
    seed: 'target-house-1',
    phase: 'p1-p7-all',
    phasePacket: { ok: true },
    sourceFeatureMap: {
      rows: [
        { featureId: 'roof_terrace_cutout', resolvedElementIds: ['roof-cut'] },
        { featureId: 'loggia_recess' },
      ],
    },
    semanticChecklist: { checks: [{ featureId: 'loggia_recess', verdict: 'fail' }] },
    issueLedger: { entries: [] },
    evidenceFreshness: { summary: { staleCount: 1, missingCount: 0 } },
    finalCloseoutManifest: {
      rehearsalGate: { ok: false },
      status: { ready: false, blockers: ['acceptance_rehearsal_gate'] },
    },
    artifactRows: [{ path: 'phase-packet.json' }],
  });

  assert.equal(dashboard.ok, false);
  assert.equal(dashboard.rows.find((row) => row.trackerId === 'BIR-M07').ok, false);
  assert.equal(dashboard.rows.find((row) => row.trackerId === 'BIR-T01').ok, false);
  assert.equal(dashboard.rows.find((row) => row.trackerId === 'BIR-T04').ok, false);
  assert.deepEqual(dashboard.rows.find((row) => row.trackerId === 'BIR-N10').summary.blockers, [
    'acceptance_rehearsal_gate',
  ]);
});
