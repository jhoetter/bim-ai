import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { evaluateTargetHouseCleanPassGate } from './lib/target-house-clean-pass-gate.mjs';

const GENERATED_AT = '2026-05-19T12:00:00.000Z';

function tempEvidenceDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'target-house-clean-gate-'));
}

function writeJson(dir, relativePath, value) {
  const filePath = path.join(dir, relativePath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function writeBaseEvidence(dir) {
  writeJson(dir, 'validate.json', {
    checks: { errorViolationCount: 0, blockingViolationCount: 0 },
    violations: [],
  });
  writeJson(dir, 'advisor-error.json', { total: 0, groups: [] });
  writeJson(dir, 'advisor-warning.json', { total: 0, groups: [] });
  writeJson(dir, 'constructability-report.json', {
    body: { summary: { findingCount: 0 }, findings: [], issues: [] },
  });
  writeJson(dir, 'evidence-package.json', {
    deterministic3dViewEvidence: [{ viewpointId: 'main_front_left' }],
  });
  writeJson(dir, 'tolerance-ledger.json', {
    schemaVersion: 'sketch.tolerance-ledger.v1',
    ok: true,
    tolerances: [],
  });
}

test('passes when Advisor, validation, constructability, and renderer evidence are clean', () => {
  const dir = tempEvidenceDir();
  writeBaseEvidence(dir);

  const result = evaluateTargetHouseCleanPassGate({ evidenceDir: dir, generatedAt: GENERATED_AT });

  assert.equal(result.ok, true);
  assert.equal(result.schemaVersion, 'target-house.clean-pass-gate.v1');
  assert.equal(result.summary.blockerCount, 0);
});

test('reads constructability findings from the report body, not response envelope metadata', () => {
  const dir = tempEvidenceDir();
  writeBaseEvidence(dir);
  writeJson(dir, 'constructability-report.json', {
    ok: true,
    status: 200,
    severity: 'error',
    code: 'room_access_invalid_subject',
    body: {
      format: 'constructabilityReport_v1',
      summary: { findingCount: 0 },
      findings: [],
      issues: [],
    },
  });

  const result = evaluateTargetHouseCleanPassGate({ evidenceDir: dir, generatedAt: GENERATED_AT });

  assert.equal(result.ok, true);
  assert.equal(result.p0Errors.some((row) => row.code === 'room_access_invalid_subject'), false);
});

test('fails on validation error even when Advisor is clean', () => {
  const dir = tempEvidenceDir();
  writeBaseEvidence(dir);
  writeJson(dir, 'validate.json', {
    violations: [
      {
        code: 'physical_wall_outside_envelope',
        severity: 'error',
        elementIds: ['wall-1'],
        message: 'Wall is outside the supported envelope.',
      },
    ],
  });

  const result = evaluateTargetHouseCleanPassGate({ evidenceDir: dir, generatedAt: GENERATED_AT });

  assert.equal(result.ok, false);
  assert.equal(result.summary.p0ErrorCount, 1);
  assert.equal(result.blockers[0].blockerKind, 'p0_error');
});

test('fails on renderer blocker status in evidence package', () => {
  const dir = tempEvidenceDir();
  writeBaseEvidence(dir);
  writeJson(dir, 'evidence-package.json', {
    deterministicSheetEvidence: [
      {
        sheetId: 'sheet-a101',
        sheetPrintRasterPrintContract_v3: {
          fullRasterExportStatus: 'unsupported_full_raster_renderer_unavailable',
        },
      },
    ],
  });

  const result = evaluateTargetHouseCleanPassGate({ evidenceDir: dir, generatedAt: GENERATED_AT });

  assert.equal(result.ok, false);
  assert.equal(result.summary.rendererBlockerCount, 1);
  assert.equal(result.blockers[0].blockerKind, 'renderer_blocker');
});

test('does not block optional full raster unavailable when deterministic sheet surrogate evidence is complete', () => {
  const dir = tempEvidenceDir();
  writeBaseEvidence(dir);
  const svgSha = 'a'.repeat(64);
  const pngSha = 'b'.repeat(64);
  const listingSha = 'c'.repeat(64);
  writeJson(dir, 'evidence-package.json', {
    deterministicSheetEvidence: [
      {
        sheetId: 'sheet-a101',
        sheetPrintRasterIngest_v1: {
          contract: 'sheetPrintRasterPrintSurrogate_v2',
          svgContentSha256: svgSha,
          placeholderPngSha256: pngSha,
        },
        sheetPrintRasterPrintContract_v3: {
          format: 'sheetPrintRasterPrintContract_v3',
          surrogateVersion: 'sheetPrintRasterPrintSurrogate_v2',
          fullRasterExportStatus: 'unsupported_full_raster_renderer_unavailable',
          svgContentSha256: svgSha,
          pngByteSha256: pngSha,
          exportListingParityDigestMatch: true,
          layoutBandsMm: [
            { viewportId: 'vp-ground', xMm: 0, yMm: 0, widthMm: 100, heightMm: 80 },
          ],
          viewportSegmentCorrelation: [
            {
              viewportId: 'vp-ground',
              segmentCorrelationDigestSha256: 'd'.repeat(64),
            },
          ],
          checks: [
            { id: 'png_ihdr_wh', ok: true },
            { id: 'png_wh_surrogate_v2', ok: true },
            { id: 'png_rgb8', ok: true },
            { id: 'surrogate_png_bytes_match_v2', ok: true },
          ],
          valid: true,
        },
        viewportEvidenceHints_v0: [
          { viewportId: 'vp-ground', planProjectionSegment: 'planPrim[w=1]' },
        ],
        sheetExportArtifactManifest_v1: {
          format: 'sheetExportArtifactManifest_v1',
          exportListingParityDigestMatch: true,
          svgListingDigestSha256: listingSha,
          pdfListingDigestSha256: listingSha,
          artifacts: [
            {
              artifactName: 'sheet-preview.svg',
              mimeType: 'image/svg+xml',
              digestSha256: svgSha,
            },
            {
              artifactName: 'sheet-print-raster.png',
              mimeType: 'image/png',
              digestSha256: pngSha,
              surrogateContract: 'sheetPrintRasterPrintSurrogate_v2',
              fullRasterExportStatus: 'unsupported_full_raster_renderer_unavailable',
            },
          ],
          ciBaselineCorrelation: {
            surrogateContract: 'sheetPrintRasterPrintSurrogate_v2',
            fullRasterExportStatus: 'unsupported_full_raster_renderer_unavailable',
            svgDigestSha256: svgSha,
            pngDigestSha256: pngSha,
            exportListingDigestSha256: listingSha,
          },
        },
      },
    ],
  });

  const result = evaluateTargetHouseCleanPassGate({ evidenceDir: dir, generatedAt: GENERATED_AT });

  assert.equal(result.ok, true);
  assert.equal(result.summary.rendererBlockerCount, 0);
});

test('fails Advisor warnings without a complete matching tolerance ledger row', () => {
  const dir = tempEvidenceDir();
  writeBaseEvidence(dir);
  writeJson(dir, 'live/advisor-warning.json', {
    total: 1,
    groups: [
      {
        code: 'room_without_door_access',
        severity: 'warning',
        count: 1,
        elementIds: ['room-1'],
        messages: ['Room has no door midpoint on or inside its boundary.'],
      },
    ],
  });

  const result = evaluateTargetHouseCleanPassGate({ evidenceDir: dir, generatedAt: GENERATED_AT });

  assert.equal(result.ok, false);
  assert.equal(result.summary.warningCount, 1);
  assert.equal(result.unresolvedWarnings[0].missingTolerance[0], 'ledgerRow');
});

test('allows Advisor warnings only with explicit tolerance owner, expiry, reason, and evidence', () => {
  const dir = tempEvidenceDir();
  writeBaseEvidence(dir);
  writeJson(dir, 'advisor-warning.json', {
    total: 1,
    groups: [
      {
        code: 'room_without_door_access',
        severity: 'warning',
        count: 1,
        elementIds: ['room-1'],
        messages: ['Room has no door midpoint on or inside its boundary.'],
      },
    ],
  });
  writeJson(dir, 'tolerance-ledger.json', {
    schemaVersion: 'sketch.tolerance-ledger.v1',
    ok: true,
    tolerances: [
      {
        id: 'tol-room-access-phase-1',
        affectedFindingCodes: ['room_without_door_access'],
        reason: 'Door access is accepted for concept phase only.',
        owner: 'worker-c',
        expiryCondition: 'Resolve before accepted target-house seed.',
        evidenceLinks: ['evidence/tolerances/room-access.md'],
      },
    ],
  });

  const result = evaluateTargetHouseCleanPassGate({ evidenceDir: dir, generatedAt: GENERATED_AT });

  assert.equal(result.ok, true);
  assert.equal(result.summary.toleratedWarningGroupCount, 1);
  assert.equal(result.unresolvedWarnings.length, 0);
});
