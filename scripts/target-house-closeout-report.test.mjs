import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  buildTargetHouseCloseoutReport,
  writeTargetHouseCloseoutReport,
} from './target-house-closeout-report.mjs';

async function writeJson(file, value) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

async function makeMinimalFixture() {
  const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'target-house-closeout-'));
  const seed = 'target-house-1';
  const evidenceDir = path.join(repoRoot, 'seed-artifacts', seed, 'evidence', 'live-run-current');
  const requiredFeaturesPath = path.join(
    repoRoot,
    'spec',
    'generated',
    `${seed}-required-features.json`,
  );
  await fs.mkdir(path.join(repoRoot, 'spec', 'generated'), { recursive: true });
  await fs.writeFile(
    path.join(repoRoot, 'spec', 'generated', 'renderer-support-matrix.md'),
    '# Renderer Support Matrix\n\nDigest: `rsm-fixture`\n',
    'utf8',
  );

  await writeJson(requiredFeaturesPath, {
    schemaVersion: 'target-house-acceptance-required-features.v1',
    sourceDigests: {
      'spec/target-house/target-house-1-sketch-ir.draft.json': 'sha256:sketch',
      'spec/target-house/target-house-1-bim-information-requirements.md': 'sha256:bir',
    },
    requiredViews: [
      {
        id: 'main_front_left',
        kind: '3d',
        purpose: 'Primary sketch matched view.',
      },
      {
        id: 'wire_diagnostic',
        kind: 'diagnostic',
        purpose: 'Wire diagnostic view.',
      },
    ],
    requiredFeatures: [
      {
        id: 'roof_terrace_cutout',
        phaseId: 'P3',
        priority: 'critical',
        requiredElementIds: [],
        semanticSelectors: ['roof:opening', 'floor:terrace'],
        requiredViewIds: ['main_front_left', 'wire_diagnostic'],
        evidenceTypes: ['screenshot', 'wire_diagnostic', 'constructability_report'],
        sourceRefs: ['spec/target-house/target-house-1-sketch-ir.draft.json#features'],
      },
      {
        id: 'documentation_evidence_set',
        phaseId: 'P7',
        priority: 'required',
        requiredElementIds: ['view:main_front_left'],
        semanticSelectors: [],
        requiredViewIds: ['main_front_left'],
        evidenceTypes: ['export_manifest', 'provenance_manifest', 'tolerance_ledger'],
        sourceRefs: ['spec/target-house/target-house-1-sketch-ir.draft.json#features'],
      },
    ],
  });

  await writeJson(path.join(evidenceDir, 'tool-run-summary.json'), {
    schemaVersion: 'sketch-to-bim.tool-run.v1',
    gitHead: 'fixture-head',
    bundleSha256: 'fixture-bundle',
    advisorRuleDigest: 'fixture-advisor-rules',
    capabilitiesSha256: 'fixture-capabilities',
  });
  await writeJson(path.join(evidenceDir, 'evidence-manifest.json'), {
    schemaVersion: 'sketch.evidence.collection.v1',
    currentHead: { gitHead: 'fixture-head' },
    artifacts: {},
  });
  await writeJson(path.join(evidenceDir, 'snapshot.json'), {
    modelId: 'fixture-model',
    revision: 1,
    elements: {
      roof: { id: 'roof', kind: 'roof' },
    },
  });
  await writeJson(path.join(evidenceDir, 'target-house-evidence-acceptance.json'), {
    schemaVersion: 'target-house-evidence-acceptance.v1',
    ok: true,
    summary: {
      requiredViewCount: 2,
      visualPassCount: 2,
      visualFailCount: 0,
      dataQualityPassCount: 1,
      dataQualityFailCount: 0,
    },
    visualRows: [
      {
        viewId: 'main_front_left',
        kind: '3d',
        status: 'pass',
        savedViewpointPresent: true,
        screenshot: {
          path: 'seed-artifacts/target-house-1/evidence/live-run-current/screenshots/main.png',
          sha256: 'sha256:main',
        },
      },
      {
        viewId: 'wire_diagnostic',
        kind: 'diagnostic',
        status: 'pass',
        savedViewpointPresent: true,
        screenshot: {
          path: 'seed-artifacts/target-house-1/evidence/live-run-current/screenshots/wire.png',
          sha256: 'sha256:wire',
        },
      },
    ],
  });
  await writeJson(path.join(evidenceDir, 'acceptance-gates.json'), {
    schemaVersion: 'sketch-to-bim-acceptance-gates.v0',
    ok: false,
    summary: {
      blockerCount: 1,
      semanticVisualRequiredCount: 1,
      semanticVisualFailureCount: 1,
      visualFailCount: 0,
      visualNeedsReviewCount: 0,
    },
    semanticVisual: {
      summary: {
        requiredCount: 1,
        passCount: 0,
        failureCount: 1,
      },
      failures: [
        {
          featureId: 'roof_terrace_cutout',
          viewId: 'main_front_left',
          checkId: 'roof_cutout_present',
          status: 'unchecked',
          message: 'Roof opening is a visible cutout.',
        },
      ],
    },
  });
  await writeJson(path.join(evidenceDir, 'advisor-all.json'), {
    modelId: 'fixture-model',
    revision: 1,
    total: 0,
    groups: [],
  });
  await writeJson(path.join(evidenceDir, 'constructability-report.json'), {
    ok: true,
    body: {
      format: 'constructabilityReport_v1',
      summary: {
        findingCount: 0,
        issueCount: 0,
        severityCounts: {},
      },
    },
  });
  await writeJson(path.join(evidenceDir, 'target-house-geometry-diagnostic.json'), {
    schemaVersion: 'target-house-current-geometry-diagnostic.v1',
    summary: {
      total: 1,
      byCategory: {
        detached_or_flying: 1,
      },
      bySeverity: {
        error: 1,
      },
    },
    findings: [
      {
        category: 'detached_or_flying',
        code: 'geometry.wall_detached_endpoint',
        severity: 'error',
        elementIds: ['roof'],
        message: 'Fixture detached endpoint.',
      },
    ],
  });
  await writeJson(path.join(evidenceDir, 'visual-gate.json'), {
    schemaVersion: 'sketch-to-bim-visual-gate.v0',
    summary: {
      captureCount: 2,
      passCount: 2,
      needsReviewCount: 0,
      failCount: 0,
      blockingFailureCount: 0,
    },
  });
  await writeJson(path.join(evidenceDir, 'bim-data-quality.json'), {
    schemaVersion: 'sketch.bim-data-quality.v1',
    ok: true,
    summary: {
      passCount: 1,
      warningCount: 0,
      errorCount: 0,
      plannedCount: 0,
    },
  });
  await writeJson(path.join(evidenceDir, 'export-validation.json'), {
    schemaVersion: 'sketch.exchange-validation.v1',
    ok: true,
    summary: {
      passCount: 1,
      warningCount: 0,
      errorCount: 0,
      plannedCount: 1,
    },
  });
  await writeJson(path.join(evidenceDir, 'tolerance-ledger.json'), {
    schemaVersion: 'sketch.tolerance-ledger.v1',
    ok: true,
    summary: {
      findingCount: 0,
      toleranceCount: 0,
      blockingFindingCount: 0,
      incompleteToleranceCount: 0,
    },
  });
  await writeJson(path.join(evidenceDir, 'screenshot-manifest.json'), {
    schemaVersion: 'sketch-to-bim-screenshot-manifest.v0',
    captures: [
      {
        viewId: 'main_front_left',
        viewKind: '3d',
        screenshotPath: 'screenshots/main.png',
        purpose: 'Primary sketch matched view.',
        syntheticViewpoint: false,
      },
      {
        viewId: 'wire_diagnostic',
        viewKind: 'diagnostic',
        screenshotPath: 'screenshots/wire.png',
        purpose: 'Wire diagnostic view.',
        syntheticViewpoint: false,
      },
    ],
  });
  await writeJson(path.join(evidenceDir, `${seed}-performance-evidence.json`), {
    schemaVersion: 'target-house-performance-evidence.v1',
    evidenceDigestSha256: 'fixture-performance',
    interactions: [
      {
        interaction: 'orbit',
        accepted: true,
        estimatedMs: 8,
        budgetMs: 16.7,
        budgetRatio: 0.48,
        status: 'within_budget',
      },
    ],
    summary: {
      ok: true,
      maxBudgetRatio: 0.48,
      overBudgetInteractions: [],
    },
  });
  await writeJson(path.join(evidenceDir, `${seed}-final-closeout-manifest.json`), {
    schemaVersion: 'target-house-final-closeout-manifest.v1',
    manifestDigestSha256: 'fixture-manifest',
    status: {
      ready: false,
      blockers: ['acceptance_gates'],
      status: 'blocked_acceptance_gates',
    },
  });

  return { repoRoot, seed, evidenceDir, requiredFeaturesPath };
}

test('target-house closeout report ties minimal fixture evidence into a blocked narrative', async () => {
  const fixture = await makeMinimalFixture();
  const result = await buildTargetHouseCloseoutReport(fixture);

  assert.equal(result.lineage.schemaVersion, 'target-house-closeout-report.v1.lineage');
  assert.equal(result.lineage.ready, false);
  assert.equal(result.lineage.summaries.advisor.advisoryClear, true);
  assert.equal(result.lineage.summaries.geometry.bySeverity.error, 1);
  assert.equal(result.lineage.summaries.visual.semanticVisualFailureCount, 1);
  assert.equal(result.lineage.featureCoverageDashboard.requiredFeatureCount, 2);
  assert.equal(result.lineage.featureCoverageDashboard.openFindingCount, 1);
  assert.equal(result.lineage.featureCoverageDashboard.rows[0].rendererSupport.status, 'matrix_linked');
  assert.equal(
    result.lineage.featureCoverageDashboard.rows[0].elementCoverageStatus,
    'semantic_selectors_only',
  );
  assert.ok(result.lineage.blockers.some((blocker) => blocker.code === 'acceptance_gates'));
  assert.ok(result.lineage.blockers.some((blocker) => blocker.code === 'geometry_diagnostic_errors'));

  assert.match(result.markdown, /No Advisor findings is not target-house acceptance/);
  assert.match(result.markdown, /Feature Coverage Dashboard/);
  assert.match(result.markdown, /roof-opening:matrix_linked/);
  assert.match(result.markdown, /roof_terrace_cutout/);
  assert.match(result.markdown, /roof:opening, floor:terrace/);
  assert.match(result.markdown, /geometry\.wall_detached_endpoint/);
  assert.match(result.markdown, /sha256:fixture-bundle/);
});

test('target-house closeout report writer emits deterministic markdown and lineage json', async () => {
  const fixture = await makeMinimalFixture();
  const first = await writeTargetHouseCloseoutReport(fixture);
  const second = await writeTargetHouseCloseoutReport(fixture);

  assert.equal(first.markdown, second.markdown);
  assert.deepEqual(first.lineage, second.lineage);
  assert.equal(first.outPath, 'seed-artifacts/target-house-1/evidence/live-run-current/target-house-closeout-report.md');
  assert.equal(
    first.lineageOutPath,
    'seed-artifacts/target-house-1/evidence/live-run-current/target-house-closeout-lineage.json',
  );

  const markdown = await fs.readFile(path.join(fixture.repoRoot, first.outPath), 'utf8');
  const lineage = JSON.parse(await fs.readFile(path.join(fixture.repoRoot, first.lineageOutPath), 'utf8'));
  assert.equal(markdown, first.markdown);
  assert.equal(lineage.lineageDigestSha256, first.lineage.lineageDigestSha256);
});
