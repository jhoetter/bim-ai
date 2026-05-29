// Initiation, export, and diff CLI commands extracted from cli.mjs.

import fs from 'node:fs/promises';
import path from 'node:path';
import {
  DEFAULT_CAPABILITY_MATRIX_PATH,
  INITIATION_MODES,
  readJsonFile,
  writeInitiationPacket,
} from './sketch-initiation.mjs';
import { base, fetchJson, fetchOkBytes, snapshot } from './api-client.mjs';
import { applyQualityMode } from './sketch-phase-workflows.mjs';
import { comparePngFiles } from './png-visual-gate.mjs';

export async function cmdInitiationGolden(manifestPath, outDir) {
  const manifest = await readJsonFile(manifestPath);
  if (
    manifest.schemaVersion !== 'sketch-to-bim-golden-suite.v0' ||
    !Array.isArray(manifest.cases)
  ) {
    throw new Error('Golden manifest must be sketch-to-bim-golden-suite.v0 with cases[].');
  }
  await fs.mkdir(outDir, { recursive: true });
  const rows = [];
  for (const [index, goldenCase] of manifest.cases.entries()) {
    const id = safeArtifactName(goldenCase.id ?? `case-${index + 1}`);
    const caseDir = path.join(outDir, id);
    const irPath = goldenCase.ir;
    const capabilityPath = goldenCase.capabilities ?? DEFAULT_CAPABILITY_MATRIX_PATH;
    const ir = applyQualityMode(await readJsonFile(irPath), goldenCase.mode);
    const matrix = await readJsonFile(capabilityPath);
    let compiledBundle = null;
    if (goldenCase.seedDslRecipe) {
      compiledBundle = compileSeedDsl(await readJsonFile(goldenCase.seedDslRecipe), {
        modelHint: goldenCase.modelHint,
      });
      await writeJsonArtifact(path.join(caseDir, 'compiled-seed-bundle.json'), compiledBundle);
    }
    const result = await writeInitiationPacket({
      ir,
      matrix,
      outDir: caseDir,
      irPath,
      capabilityMatrixPath: capabilityPath,
      modelId: goldenCase.modelId ?? null,
      evidenceRun: {
        acceptanceScope: 'preflight',
        goldenCaseId: id,
        compiledBundleCommandCount: compiledBundle?.commands?.length ?? null,
      },
    });
    let liveGoldenPlan = null;
    const liveGoldenConfig =
      goldenCase.liveGolden && typeof goldenCase.liveGolden === 'object'
        ? { ...(manifest.liveGoldenDefaults ?? {}), ...goldenCase.liveGolden }
        : null;
    if (liveGoldenConfig) {
      const liveGoldenAcceptance = {
        ...((manifest.liveGoldenDefaults ?? {}).acceptance ?? {}),
        ...(goldenCase.liveGolden?.acceptance ?? {}),
      };
      liveGoldenPlan = {
        schemaVersion: 'sketch-to-bim-live-golden-plan.v1',
        generatedAt: new Date().toISOString(),
        caseId: id,
        status: liveGoldenConfig.status ?? 'planned',
        baselinePolicy:
          liveGoldenConfig.baselinePolicy ??
          'Capture only after a live committed model exists; do not create seed artifacts from golden preflight.',
        requiredArtifacts: liveGoldenConfig.requiredArtifacts ?? [
          'live-runner-manifest.json',
          'tool-run-summary.json',
          'snapshot.json',
          'validate.json',
          'evidence-package.json',
          'advisor-warning.json',
          'advisor-info.json',
          'visual-evidence-contract.json',
          'screenshot-manifest.json',
          'visual-gate.json',
          'export-validation.json',
          'tolerance-ledger.json',
        ],
        captureCommand:
          liveGoldenConfig.captureCommand ??
          `node packages/cli/cli.mjs initiation-run --ir ${irPath} --capabilities ${capabilityPath} --model <model-id> --out <live-evidence-dir> --fail-on-acceptance`,
        acceptance: Object.keys(liveGoldenAcceptance).length
          ? liveGoldenAcceptance
          : {
              requireCurrentHead: true,
              requireAdvisorBaseline: true,
              requireVisualBaseline: true,
              requireExchangeValidation: true,
              requireToleranceLedger: true,
            },
        noSeedArtifactCreated: true,
      };
      await writeJsonArtifact(path.join(caseDir, 'live-golden-plan.json'), liveGoldenPlan);
    }
    const expected = goldenCase.expected ?? {};
    const maxErrors = Number.isFinite(expected.maxCoverageErrors) ? expected.maxCoverageErrors : 0;
    const maxBlocked = Number.isFinite(expected.maxBlockedFeatures)
      ? expected.maxBlockedFeatures
      : 0;
    const pass =
      result.summary.errorCount <= maxErrors && result.summary.blockedCount <= maxBlocked;
    rows.push({
      id,
      irPath,
      capabilityPath,
      outDir: caseDir,
      pass,
      coverageOk: result.ok,
      acceptanceOk: result.acceptance?.ok ?? null,
      commandCount: compiledBundle?.commands?.length ?? null,
      liveGoldenPlanned: Boolean(liveGoldenPlan),
      liveGoldenPlan: liveGoldenPlan ? path.join(caseDir, 'live-golden-plan.json') : null,
      summary: result.summary,
    });
  }
  const summary = {
    schemaVersion: 'sketch-to-bim-golden-suite-result.v0',
    generatedAt: new Date().toISOString(),
    manifestPath,
    caseCount: rows.length,
    passCount: rows.filter((row) => row.pass).length,
    failCount: rows.filter((row) => !row.pass).length,
    liveGoldenPlanCount: rows.filter((row) => row.liveGoldenPlanned).length,
    cases: rows,
  };
  await writeJsonArtifact(path.join(outDir, 'golden-summary.json'), summary);
  console.log(JSON.stringify(summary, null, 2));
  if (summary.failCount > 0) process.exit(2);
}

export async function cmdInitiationModes() {
  console.log(
    JSON.stringify(
      { schemaVersion: 'sketch-to-bim-initiation-modes.v0', modes: INITIATION_MODES },
      null,
      2,
    ),
  );
}

export async function cmdInitiationCheck(
  irPath,
  capabilityMatrixPath,
  outDir,
  modelId,
  live,
  qualityMode,
  failOnAcceptance,
) {
  const ir = applyQualityMode(await readJsonFile(irPath), qualityMode);
  const matrix = await readJsonFile(capabilityMatrixPath);
  let liveAdvisor = null;
  if (live) {
    if (!modelId) {
      console.error('initiation-check --live requires --model <id> or BIM_AI_MODEL_ID.');
      process.exit(1);
    }
    liveAdvisor = {
      warning: await advisorSummary(modelId, { severity: 'warning' }),
      info: await advisorSummary(modelId, { severity: 'info' }),
    };
  }
  const result = await writeInitiationPacket({
    ir,
    matrix,
    outDir,
    irPath,
    capabilityMatrixPath,
    modelId: modelId ?? null,
    liveAdvisor,
  });
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exit(2);
  if (failOnAcceptance && result.acceptance?.ok === false) process.exit(5);
}

export async function cmdInitiationCompare(actualPath, targetPath, outPath, threshold) {
  if (!actualPath || !targetPath) {
    console.error('initiation-compare requires --actual <png> --target <png>.');
    usage();
  }
  const report = await comparePngFiles(actualPath, targetPath, { threshold });
  const text = `${JSON.stringify(report, null, 2)}\n`;
  if (outPath) {
    await fs.mkdir(path.dirname(outPath), { recursive: true });
    await fs.writeFile(outPath, text, 'utf8');
  }
  process.stdout.write(text);
  if (!report.thresholdPassed) process.exit(1);
}

export async function cmdExport(kind, modelId, outPath, viewId, sheetId) {
  if (kind === 'gltf') {
    if (!modelId) usage();
    const url = `${base}/api/models/${encodeURIComponent(modelId)}/exports/model.gltf`;
    const text = await fetchOkText('GET', url);
    if (outPath && outPath !== '-') {
      await fs.writeFile(outPath, text, 'utf8');
      console.log(JSON.stringify({ ok: true, out: outPath, chars: text.length }, null, 2));
    } else {
      process.stdout.write(text);
      if (!text.endsWith('\n')) process.stdout.write('\n');
    }
    return;
  }
  if (kind === 'glb') {
    if (!modelId) usage();
    const url = `${base}/api/models/${encodeURIComponent(modelId)}/exports/model.glb`;
    const buf = await fetchOkBytes('GET', url);
    if (outPath && outPath !== '-') {
      await fs.writeFile(outPath, buf);
      console.log(JSON.stringify({ ok: true, out: outPath, bytes: buf.length }, null, 2));
    } else {
      process.stdout.write(buf);
    }
    return;
  }
  if (kind === 'ifc') {
    if (!modelId) usage();
    const url = `${base}/api/models/${encodeURIComponent(modelId)}/exports/model.ifc`;
    const buf = await fetchOkBytes('GET', url);
    if (outPath && outPath !== '-') {
      await fs.writeFile(outPath, buf);
      console.log(JSON.stringify({ ok: true, out: outPath, bytes: buf.length }, null, 2));
    } else {
      process.stdout.write(buf.toString('utf8'));
    }
    return;
  }
  if (kind === 'pdf') {
    if (!modelId) usage();
    const params = new URLSearchParams();
    if (sheetId) params.set('sheetId', sheetId);
    const qs = params.toString() ? `?${params.toString()}` : '';
    const url = `${base}/api/models/${encodeURIComponent(modelId)}/exports/sheet-preview.pdf${qs}`;
    const buf = await fetchOkBytes('GET', url);
    if (outPath && outPath !== '-') {
      await fs.writeFile(outPath, buf);
      console.log(JSON.stringify({ ok: true, out: outPath, bytes: buf.length }, null, 2));
    } else {
      process.stdout.write(buf);
    }
    return;
  }
  if (kind === 'json') {
    if (!modelId) usage();
    const snap = await fetchJson(
      'GET',
      `${base}/api/models/${encodeURIComponent(modelId)}/snapshot`,
    );
    const doc = {
      _format: 'bimAiSnapshot_v1',
      _revision: snap.revision ?? null,
      modelId: snap.modelId ?? modelId,
      revision: snap.revision ?? null,
      elements: snap.elements ?? {},
      violations: snap.violations ?? [],
    };
    const text = `${JSON.stringify(doc, null, 2)}\n`;
    if (outPath && outPath !== '-') {
      await fs.writeFile(outPath, text, 'utf8');
      console.log(
        JSON.stringify(
          {
            ok: true,
            out: outPath,
            chars: text.length,
            revision: doc.revision,
            elementCount: Object.keys(doc.elements).length,
          },
          null,
          2,
        ),
      );
    } else {
      process.stdout.write(text);
    }
    return;
  }
  // EXP-V3-01 — render-pipeline export formats
  if (
    kind === 'render-bundle' ||
    kind === 'gltf-pbr' ||
    kind === 'ifc-bundle' ||
    kind === 'metadata-only'
  ) {
    if (!modelId) usage();
    const params = new URLSearchParams({
      format: kind === 'render-bundle' ? 'metadata-only' : kind,
    });
    if (viewId) params.set('viewId', viewId);
    const url = `${base}/api/v3/models/${encodeURIComponent(modelId)}/export?${params}`;
    const json = await fetchJson('GET', url);
    const text = `${JSON.stringify(json, null, 2)}\n`;
    if (outPath && outPath !== '-') {
      await fs.writeFile(outPath, text, 'utf8');
      console.log(JSON.stringify({ ok: true, out: outPath, format: json.format }, null, 2));
    } else {
      process.stdout.write(text);
    }
    return;
  }
  console.error(
    `export ${kind}: not implemented (see spec/workpackage-master-tracker.md backlog).`,
  );
  process.exit(2);
}

export function diffToText(diff) {
  const lines = [];
  lines.push(
    `# bim-ai diff  rev ${diff.fromRevision} -> ${diff.toRevision}  (model ${diff.modelId})`,
  );
  const s = diff.summary ?? {};
  lines.push(
    `# added=${s.addedCount ?? 0} removed=${s.removedCount ?? 0} modified=${s.modifiedCount ?? 0}`,
  );
  for (const a of diff.added ?? []) {
    const name = a && typeof a.name === 'string' ? a.name : '';
    lines.push(`+ ${a?.kind ?? '?'} ${a?.id ?? '?'}${name ? ` (${name})` : ''}`);
  }
  for (const r of diff.removed ?? []) {
    const name = r && typeof r.name === 'string' ? r.name : '';
    lines.push(`- ${r?.kind ?? '?'} ${r?.id ?? '?'}${name ? ` (${name})` : ''}`);
  }
  for (const m of diff.modified ?? []) {
    lines.push(`* ${m?.kind ?? '?'} ${m?.id ?? '?'}`);
    for (const fc of m?.fieldChanges ?? []) {
      lines.push(`    ${fc.field}: ${JSON.stringify(fc.from)} -> ${JSON.stringify(fc.to)}`);
    }
  }
  return `${lines.join('\n')}\n`;
}

export async function cmdDiff(modelId, fromRev, toRev, outPath, asText, summaryOnly) {
  if (!modelId) usage();
  const params = [];
  if (fromRev != null) params.push(`fromRev=${encodeURIComponent(String(fromRev))}`);
  if (toRev != null) params.push(`toRev=${encodeURIComponent(String(toRev))}`);
  const qs = params.length ? `?${params.join('&')}` : '';
  const url = `${base}/api/models/${encodeURIComponent(modelId)}/diff${qs}`;
  const json = await fetchJson('GET', url);

  let payload = json;
  let text;
  if (asText) {
    text = diffToText(summaryOnly ? { ...json, added: [], removed: [], modified: [] } : json);
  } else {
    if (summaryOnly) {
      payload = {
        modelId: json.modelId,
        fromRevision: json.fromRevision,
        toRevision: json.toRevision,
        summary: json.summary,
      };
    }
    text = `${JSON.stringify(payload, null, 2)}\n`;
  }

  if (outPath && outPath !== '-') {
    await fs.writeFile(outPath, text, 'utf8');
    console.log(JSON.stringify({ ok: true, out: outPath, chars: text.length }, null, 2));
  } else {
    process.stdout.write(text);
  }
}

// ─── AGT-01 — closed iterative-correction agent loop ─────────────────────────

