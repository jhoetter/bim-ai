import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  RENDERER_SUPPORT_MATRIX,
  createRendererDiagnostic,
  createRendererDiagnosticPacket,
  createUnsupportedCutDiagnostic,
  isModelInvalidIssue,
  isRendererIssue,
  renderRendererSupportMatrixMarkdown,
  rendererSupportMatrixDigest,
  summarizeRendererDiagnostics,
} from './rendererDiagnostics';

describe('renderer diagnostics contract — BIR-I02/BIR-I07', () => {
  it('normalizes identifiers and keeps renderer issues separate from model-invalid issues', () => {
    const rendererDiagnostic = createUnsupportedCutDiagnostic({
      code: 'renderer.roof_opening.unsupported',
      feature: 'roof-opening',
      message: 'Asymmetric gable roof opening has no supported visual cut path.',
      elementIds: ['roof-1', 'opening-1', 'roof-1'],
      viewId: 'view-3d',
      trackerItems: ['BIR-I02', 'BIR-I07', 'BIR-I02'],
    });
    const modelDiagnostic = createRendererDiagnostic({
      ruleId: 'hosted_door_not_embedded',
      code: 'model.hosted_door.detached',
      severity: 'error',
      issueClass: 'model-invalid',
      rendererArea: 'viewport-3d',
      feature: 'wall-cut',
      message: 'Door host is detached from the physical wall topology.',
      elementIds: 'door-1',
      viewId: 'view-3d',
      trackerItems: 'BIR-I07',
    });

    expect(rendererDiagnostic.format).toBe('rendererDiagnostic_v1');
    expect(rendererDiagnostic.ruleId).toBe('renderer_unsupported_cut');
    expect(rendererDiagnostic.issueClass).toBe('renderer-unsupported');
    expect(rendererDiagnostic.elementIds).toEqual(['opening-1', 'roof-1']);
    expect(rendererDiagnostic.trackerItems).toEqual(['BIR-I02', 'BIR-I07']);
    expect(isRendererIssue(rendererDiagnostic)).toBe(true);
    expect(isModelInvalidIssue(rendererDiagnostic)).toBe(false);
    expect(isRendererIssue(modelDiagnostic)).toBe(false);
    expect(isModelInvalidIssue(modelDiagnostic)).toBe(true);
  });

  it('summarizes diagnostics by severity and issue class', () => {
    const diagnostics = [
      createUnsupportedCutDiagnostic({
        code: 'renderer.slab_opening.unsupported',
        feature: 'slab-opening',
        message: 'Slab opening has no viewport cut path.',
        elementIds: ['slab-1', 'opening-1'],
      }),
      createRendererDiagnostic({
        ruleId: 'renderer_degraded_material',
        code: 'renderer.material.fallback',
        severity: 'warning',
        issueClass: 'renderer-degraded',
        rendererArea: 'materials',
        feature: 'material-resolution',
        message: 'Material fell back to category color.',
        elementIds: ['wall-1'],
        trackerItems: ['BIR-I06', 'BIR-I07'],
      }),
      createRendererDiagnostic({
        ruleId: 'host_wall_outside_envelope',
        code: 'model.host_wall.outside_envelope',
        severity: 'error',
        issueClass: 'model-invalid',
        rendererArea: 'viewport-3d',
        feature: 'wall-cut',
        message: 'Host wall is outside the floor envelope.',
        elementIds: ['wall-2'],
        trackerItems: ['BIR-I07'],
      }),
    ];

    expect(summarizeRendererDiagnostics(diagnostics)).toEqual({
      total: 3,
      bySeverity: { error: 2, warning: 1, info: 0 },
      byIssueClass: {
        'model-invalid': 1,
        'renderer-unsupported': 1,
        'renderer-failed': 0,
        'renderer-degraded': 1,
      },
      rendererIssues: 2,
      modelInvalidIssues: 1,
    });
  });

  it('captures persistence context for evidence packages', () => {
    const diagnostic = createUnsupportedCutDiagnostic({
      code: 'renderer.wall_cut.failed',
      feature: 'wall-cut',
      message: 'Wall CSG failed during evidence capture.',
      elementIds: ['wall-1', 'door-1'],
      evidence: {
        modelRevision: 42,
        gitHead: 'abc1234',
        rendererBuild: 'web-test',
        supportMatrixDigest: rendererSupportMatrixDigest(),
        screenshotPath: 'evidence/wall-cut.png',
        source: 'sketch-acceptance',
      },
      trackerItems: ['BIR-I02', 'BIR-I06', 'BIR-I07'],
    });
    const packet = createRendererDiagnosticPacket({
      diagnostics: [diagnostic],
      generatedAtIso: '2026-05-19T00:00:00.000Z',
      modelRevision: 42,
      viewId: 'view-3d',
      gitHead: 'abc1234',
      rendererBuild: 'web-test',
    });

    expect(packet.format).toBe('rendererDiagnosticPacket_v1');
    expect(packet.supportMatrixDigest).toMatch(/^rsm-[0-9a-f]{8}$/);
    expect(packet.diagnostics[0]?.evidence).toMatchObject({
      modelRevision: 42,
      screenshotPath: 'evidence/wall-cut.png',
      source: 'sketch-acceptance',
    });
  });
});

describe('renderer support matrix — BIR-I01/BIR-I06', () => {
  it('covers the core target feature classes with diagnostic codes and tracker ids', () => {
    const features = new Set(RENDERER_SUPPORT_MATRIX.map((entry) => entry.feature));

    expect([...features]).toEqual(
      expect.arrayContaining([
        'wall-cut',
        'roof-opening',
        'slab-opening',
        'stair-geometry',
        'railing-geometry',
        'room-visualization',
        'family-instance',
        'asset-instance',
        'material-resolution',
        'sheet-viewport',
        'export-preview',
      ]),
    );
    for (const entry of RENDERER_SUPPORT_MATRIX) {
      expect(entry.diagnosticCodes.length, entry.id).toBeGreaterThan(0);
      expect(entry.limitations.length, entry.id).toBeGreaterThan(0);
      expect(entry.trackerItems, entry.id).toContain('BIR-I01');
      expect(
        entry.trackerItems.includes('BIR-I06') || entry.trackerItems.includes('BIR-I02'),
        entry.id,
      ).toBe(true);
      expect(
        Object.values(entry.surface).every((status) =>
          ['supported', 'partial', 'unsupported', 'not_applicable'].includes(status),
        ),
        entry.id,
      ).toBe(true);
    }
  });

  it('renders a deterministic markdown support matrix and keeps the generated spec file in sync', () => {
    const markdown = renderRendererSupportMatrixMarkdown();
    const generatedPath = resolve(process.cwd(), '../../spec/generated/renderer-support-matrix.md');
    const generated = readFileSync(generatedPath, 'utf8');

    expect(markdown).toContain('Digest: `rsm-');
    expect(markdown).toContain('`rsm-roof-openings`');
    expect(markdown).toContain('renderer.roof_opening.unsupported');
    expect(markdown).toContain('model-invalid');
    expect(generated.trimEnd()).toBe(markdown.trimEnd());
  });
});
