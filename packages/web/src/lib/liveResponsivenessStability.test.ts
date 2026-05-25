import { describe, expect, it } from 'vitest';

import {
  LIVE_INTERACTION_CONTRACT,
  LIVE_RESPONSIVENESS_SCHEMA_VERSION,
  classifyLiveResponsivenessChurnEvent,
  classifyLiveResponsiveness,
  liveResponsivenessContract,
  type LiveInteractionId,
} from './liveResponsivenessStability';

function passingInteraction(id: LiveInteractionId) {
  return {
    id,
    completed: true,
    samplesMs: [12, 24, 36],
    maxLongTaskMs: 20,
    droppedFramePercent: 1,
  };
}

describe('liveResponsivenessContract', () => {
  it('defines deterministic interaction and websocket churn acceptance', () => {
    const contract = liveResponsivenessContract();

    expect(LIVE_INTERACTION_CONTRACT.map((row) => row.id)).toEqual([
      'orbit',
      'select',
      'lens-switch',
      'advisor-open',
      'advisor-close',
    ]);
    expect(contract.interactions.every((row) => row.trackerRefs.includes('BIR-L02'))).toBe(true);
    expect(contract.interactions.every((row) => row.trackerRefs.includes('BIR-N11'))).toBe(true);
    expect(contract.websocketChurnPolicy).toEqual({
      benignViteProxySocketCodes: ['EPIPE', 'ECONNRESET'],
      actionableAppCloseCodes: [4403, 4404],
      exhaustedReconnectBudget: 'actionable',
      unknownChurn: 'actionable',
    });
  });
});

describe('classifyLiveResponsiveness', () => {
  it('passes complete live-browser metrics and keeps benign Vite reconnect noise separate', () => {
    const report = classifyLiveResponsiveness({
      targetId: 'sample-1',
      interactions: LIVE_INTERACTION_CONTRACT.map((row) => passingInteraction(row.id)),
      websocketChurn: [
        { kind: 'vite-proxy-error', code: 'EPIPE', count: 3 },
        { kind: 'vite-proxy-error', code: 'ECONNRESET', count: 2 },
        { kind: 'app-ws-close', endpoint: 'workspace', closeCode: 1006, nextAttempt: 1 },
      ],
    });

    expect(report.schemaVersion).toBe(LIVE_RESPONSIVENESS_SCHEMA_VERSION);
    expect(report.ok).toBe(true);
    expect(report.summary).toMatchObject({
      requiredInteractionCount: 5,
      interactionPassCount: 5,
      interactionFailCount: 0,
      actionableChurnCount: 0,
      benignChurnCount: 6,
      interactionOk: true,
      websocketChurnOk: true,
    });
    expect(report.websocketChurnRows.map((row) => row.classification)).toEqual([
      'benign',
      'benign',
      'benign',
    ]);
  });

  it('fails missing or over-budget interaction metrics with stable issue codes', () => {
    const report = classifyLiveResponsiveness({
      interactions: [
        {
          id: 'orbit',
          completed: true,
          samplesMs: [60, 90, 180],
          maxLongTaskMs: 140,
          droppedFramePercent: 7,
        },
      ],
      websocketChurn: [],
    });

    expect(report.ok).toBe(false);
    const orbit = report.interactionRows.find((row) => row.interaction === 'orbit');
    expect(orbit).toMatchObject({
      status: 'fail',
      issues: [
        'max_latency_over_budget',
        'p95_latency_over_budget',
        'long_task_over_budget',
        'dropped_frames_over_budget',
      ],
    });
    const select = report.interactionRows.find((row) => row.interaction === 'select');
    expect(select).toMatchObject({
      status: 'missing',
      issues: [
        'missing_interaction_metrics',
        'interaction_not_completed',
        'missing_max_latency_ms',
        'missing_p95_latency_ms',
        'missing_max_long_task_ms',
        'missing_dropped_frame_percent',
      ],
    });
  });

  it('blocks actionable websocket churn while leaving EPIPE and ECONNRESET non-blocking', () => {
    const report = classifyLiveResponsiveness({
      interactions: LIVE_INTERACTION_CONTRACT.map((row) => passingInteraction(row.id)),
      websocketChurn: [
        { kind: 'vite-proxy-error', code: 'EPIPE', count: 10 },
        { kind: 'vite-proxy-error', code: 'ECONNRESET', count: 4 },
        { kind: 'vite-proxy-error', code: 'ECONNREFUSED', count: 1 },
        { kind: 'app-ws-close', endpoint: 'presentation', closeCode: 4403, nextAttempt: 1 },
      ],
    });

    expect(report.ok).toBe(false);
    expect(report.summary).toMatchObject({
      interactionOk: true,
      websocketChurnOk: false,
      benignChurnCount: 14,
      actionableChurnCount: 2,
    });
    expect(
      report.websocketChurnRows.map((row) => [row.code, row.classification, row.shouldLog]),
    ).toEqual([
      ['EPIPE', 'benign', false],
      ['ECONNRESET', 'benign', false],
      ['ECONNREFUSED', 'actionable', true],
      [null, 'actionable', true],
    ]);
  });
});

describe('classifyLiveResponsivenessChurnEvent', () => {
  it('treats exhausted reconnect budgets and unknown churn as actionable', () => {
    expect(
      classifyLiveResponsivenessChurnEvent({
        kind: 'app-ws-close',
        endpoint: 'jobs',
        closeCode: 1006,
        nextAttempt: 12,
        maxAttempts: 10,
      }),
    ).toMatchObject({
      classification: 'actionable',
      action: 'stop',
      closeCode: 1006,
    });
    expect(classifyLiveResponsivenessChurnEvent({ kind: 'dev-server-restart' })).toMatchObject({
      classification: 'actionable',
      kind: 'dev-server-restart',
      shouldLog: true,
    });
  });
});
