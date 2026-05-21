import assert from 'node:assert/strict';
import test from 'node:test';

import {
  REVERSE_BIM_VIEW_CAPTURE_RUN_SCHEMA_VERSION,
  buildReverseBimViewCaptureRunManifest,
  normalizeReverseBimViewCapturePlan,
} from './reverse-bim-view-capture-runner.mjs';

function capturePlan() {
  return {
    format: 'reverseBimViewCapturePlan_v1',
    modelId: 'model-1',
    runId: 'run-1',
    viewport: { width: 1600, height: 1000, deviceScaleFactor: 1 },
    captures: [
      {
        captureId: 'ui:plan-eg',
        evidenceKind: 'ui',
        viewId: 'plan-eg',
        viewKind: 'floor_plan',
        url: 'http://127.0.0.1:2000/?modelId=model-1&reverseBimView=plan-eg',
        path: 'tmp/reverse-bim/run-1/ui-plan-eg.png',
        evidenceRowTemplate: {
          viewId: 'plan-eg',
          kind: 'floor_plan',
          status: 'captured',
          path: 'tmp/reverse-bim/run-1/ui-plan-eg.png',
          visualChecklist: {
            required_level_not_empty: false,
            room_labels_match_source: false,
          },
        },
      },
      {
        captureId: 'overlay:eg-p1',
        evidenceKind: 'overlay',
        viewId: 'overlay-eg-p1',
        viewKind: 'floor_plan',
        sourcePageId: 'eg-p1',
        coordinateFrameId: 'frame-eg',
        url: 'http://127.0.0.1:2000/?modelId=model-1&reverseBimView=overlay-eg-p1',
        path: 'tmp/reverse-bim/run-1/overlay-eg-p1.png',
        evidenceRowTemplate: {
          viewId: 'overlay-eg-p1',
          kind: 'floor_plan',
          screenshotPath: 'tmp/reverse-bim/run-1/overlay-eg-p1.png',
          sourcePageId: 'eg-p1',
          coordinateFrameId: 'frame-eg',
          maxDeviationMm: null,
        },
      },
    ],
  };
}

test('normalizes reverse-BIM view capture plans and reports blockers', () => {
  const accepted = normalizeReverseBimViewCapturePlan(capturePlan());
  const blocked = normalizeReverseBimViewCapturePlan({
    format: 'wrong',
    captures: [{ captureId: 'ui:broken' }],
  });

  assert.equal(accepted.ok, true);
  assert.equal(accepted.plan.captures.length, 2);
  assert.equal(accepted.plan.viewport.width, 1600);
  assert.equal(blocked.ok, false);
  assert.deepEqual(
    blocked.blockers.map((row) => row.code),
    ['capture_plan_format_invalid', 'capture_url_missing', 'capture_path_missing'],
  );
});

test('manifest keeps screenshots pending review instead of auto-accepting evidence', () => {
  const plan = capturePlan();
  const manifest = buildReverseBimViewCaptureRunManifest({
    plan,
    outputDir: '/tmp/reverse-bim/run-1',
    capturedAt: '2026-05-21T00:00:00.000Z',
    results: [
      {
        ...plan.captures[0],
        status: 'captured',
        sha256: 'a'.repeat(64),
        evidenceRowTemplate: plan.captures[0].evidenceRowTemplate,
      },
      {
        ...plan.captures[1],
        status: 'captured',
        sha256: 'b'.repeat(64),
        evidenceRowTemplate: plan.captures[1].evidenceRowTemplate,
      },
    ],
  });

  assert.equal(manifest.format, REVERSE_BIM_VIEW_CAPTURE_RUN_SCHEMA_VERSION);
  assert.equal(manifest.ok, true);
  assert.equal(manifest.summary.pendingVisualReviewCount, 1);
  assert.equal(manifest.summary.pendingOverlayMetricCount, 1);
  assert.deepEqual(manifest.uiEvidenceRows[0].visualChecklist, {});
  assert.deepEqual(manifest.uiEvidenceRows[0].visualChecklistReviewRequired, [
    'required_level_not_empty',
    'room_labels_match_source',
  ]);
  assert.equal(manifest.overlayEvidenceRows[0].reviewStatus, 'pending_overlay_metric');
  assert.deepEqual(
    manifest.reviewWorklist.map((row) => row.reviewStatus),
    ['pending_ai_visual_review', 'pending_overlay_metric'],
  );
});
