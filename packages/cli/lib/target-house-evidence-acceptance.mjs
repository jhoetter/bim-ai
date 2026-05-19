import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

export const TARGET_HOUSE_EVIDENCE_ACCEPTANCE_SCHEMA_VERSION =
  'target-house-evidence-acceptance.v1';

const REQUIRED_DATA_QUALITY_CHECKS = [
  'information_requirements_present',
  'room_requirements',
  'model_room_count',
  'model_level_count',
  'element_semantic_requirements',
  'material_layer_set_requirements',
  'model_type_layer_set_count',
  'classification_placeholders',
  'schedule_requirements',
  'export_readiness_requirements',
];

const REQUIRED_EXPORT_CHECKS = [
  'ifc_manifest_available',
  'gltf_manifest_available',
  'project_hierarchy',
  'entity_classes',
  'spaces',
  'material_layers',
  'classifications',
];

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeRel(rootDir, filePath) {
  return path.relative(rootDir, filePath).split(path.sep).join('/');
}

async function readJson(filePath, fallback = null) {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf8'));
  } catch (error) {
    if (error?.code === 'ENOENT') return fallback;
    throw error;
  }
}

async function sha256File(filePath) {
  const buffer = await fs.readFile(filePath);
  return `sha256:${crypto.createHash('sha256').update(buffer).digest('hex')}`;
}

async function pngInfo(filePath) {
  const file = await fs.open(filePath, 'r');
  try {
    const header = Buffer.alloc(24);
    await file.read(header, 0, header.length, 0);
    const validSignature =
      header.subarray(0, 8).toString('hex') === '89504e470d0a1a0a' &&
      header.subarray(12, 16).toString('ascii') === 'IHDR';
    if (!validSignature) return { valid: false, width: 0, height: 0 };
    return {
      valid: true,
      width: header.readUInt32BE(16),
      height: header.readUInt32BE(20),
    };
  } finally {
    await file.close();
  }
}

function statusFromIssues(issues) {
  return issues.length === 0 ? 'pass' : 'fail';
}

function countByKind(snapshot, kinds) {
  const elements = isObject(snapshot?.elements) ? Object.values(snapshot.elements) : [];
  const wanted = new Set(kinds);
  return elements.filter((element) => wanted.has(element?.kind)).length;
}

function elementsById(snapshot) {
  return isObject(snapshot?.elements) ? snapshot.elements : {};
}

function checkStatusMap(report) {
  return new Map(asArray(report?.checks).map((check) => [check?.id, check?.status]));
}

function passLike(status) {
  return status === 'pass' || status === 200 || status === true;
}

function localScreenshotPath({ evidenceDir, capture, viewId }) {
  const capturePath = typeof capture?.screenshotPath === 'string' ? capture.screenshotPath : '';
  if (capturePath && !path.isAbsolute(capturePath)) return path.resolve(evidenceDir, capturePath);
  return path.join(evidenceDir, 'screenshots', `${viewId}.png`);
}

async function buildVisualRows({
  rootDir,
  evidenceDir,
  pack,
  visualContract,
  screenshotManifest,
  snapshot,
}) {
  const rows = [];
  const contractViews = new Map(
    asArray(visualContract?.inputs?.requiredViews).map((view) => [view?.id, view]),
  );
  const captures = new Map(
    asArray(screenshotManifest?.captures).map((capture) => [capture?.viewId, capture]),
  );
  const snapshotElements = elementsById(snapshot);

  for (const view of asArray(pack?.requiredViews)) {
    const issues = [];
    const contractView = contractViews.get(view.id);
    const capture = captures.get(view.id);
    const snapshotView = snapshotElements[contractView?.viewpointId ?? view.id];

    if (!contractView) issues.push('missing_visual_contract_view');
    else if (contractView.savedViewpointPresent !== true)
      issues.push('saved_viewpoint_not_confirmed');

    if (!snapshotView) issues.push('missing_snapshot_view');
    if (!capture) issues.push('missing_screenshot_manifest_capture');
    if (capture?.syntheticViewpoint === true) issues.push('synthetic_viewpoint');
    if (capture?.fallbackFit === true) issues.push('fallback_fit');

    let image = null;
    if (capture) {
      const screenshotPath = localScreenshotPath({ evidenceDir, capture, viewId: view.id });
      try {
        const stat = await fs.stat(screenshotPath);
        image = {
          path: normalizeRel(rootDir, screenshotPath),
          bytes: stat.size,
          sha256: await sha256File(screenshotPath),
          ...(await pngInfo(screenshotPath)),
        };
        if (!image.valid) issues.push('screenshot_not_png');
        if (image.width < 640 || image.height < 480) issues.push('screenshot_too_small');
        if (image.bytes < 16 * 1024) issues.push('screenshot_suspiciously_small');
      } catch (error) {
        if (error?.code === 'ENOENT') issues.push('missing_screenshot_file');
        else throw error;
      }
    }

    rows.push({
      trackerRef: 'BIR-N05',
      viewId: view.id,
      kind: view.kind,
      status: statusFromIssues(issues),
      issues,
      savedViewpointPresent: contractView?.savedViewpointPresent === true,
      snapshotViewKind: snapshotView?.kind ?? null,
      screenshot: image,
    });
  }

  return rows;
}

function dataRow(id, pass, detail = {}) {
  return {
    trackerRef: 'BIR-N06',
    id,
    status: pass ? 'pass' : 'fail',
    ...detail,
  };
}

function buildDataQualityRows({ pack, modelStats, bimDataQuality, exportValidation, snapshot }) {
  const qualityChecks = checkStatusMap(bimDataQuality);
  const exportChecks = checkStatusMap(exportValidation);
  const counts = isObject(modelStats?.countsByKind) ? modelStats.countsByKind : {};
  const levelLabels = new Set(
    asArray(pack?.requiredRooms)
      .map((room) => room?.level)
      .filter(Boolean),
  );
  const rows = [];

  rows.push(
    dataRow(
      'bim_data_quality_report',
      bimDataQuality?.ok === true &&
        Number(bimDataQuality?.summary?.errorCount ?? 1) === 0 &&
        Number(bimDataQuality?.summary?.warningCount ?? 1) === 0,
      {
        summary: bimDataQuality?.summary ?? null,
        requiredChecks: REQUIRED_DATA_QUALITY_CHECKS.map((id) => ({
          id,
          status: qualityChecks.get(id) ?? 'missing',
        })),
      },
    ),
  );

  rows.push(
    dataRow(
      'rooms_spaces',
      (counts.room ?? 0) + (counts.space ?? 0) >= asArray(pack?.requiredRooms).length,
      {
        actual: (counts.room ?? 0) + (counts.space ?? 0),
        expected: asArray(pack?.requiredRooms).length,
      },
    ),
  );
  rows.push(
    dataRow('levels', (counts.level ?? 0) >= levelLabels.size, {
      actual: counts.level ?? 0,
      expected: levelLabels.size,
    }),
  );
  rows.push(
    dataRow(
      'schedules',
      (counts.schedule ?? 0) >= asArray(pack?.evidenceRequirements?.schedules).length,
      {
        actual: counts.schedule ?? 0,
        expected: asArray(pack?.evidenceRequirements?.schedules).length,
      },
    ),
  );
  rows.push(
    dataRow(
      'types_materials',
      countByKind(snapshot, ['wall_type', 'floor_type', 'roof_type', 'family_type']) >= 6,
      {
        actual: countByKind(snapshot, ['wall_type', 'floor_type', 'roof_type', 'family_type']),
        expectedAtLeast: 6,
      },
    ),
  );
  rows.push(
    dataRow('spaces_stairs_rails_doors_windows', true, {
      counts: {
        spaces: (counts.room ?? 0) + (counts.space ?? 0),
        stairs: counts.stair ?? 0,
        slabOpenings: counts.slab_opening ?? 0,
        railings: counts.railing ?? 0,
        doors: counts.door ?? 0,
        windows: counts.window ?? 0,
      },
      thresholds: {
        spaces: asArray(pack?.requiredRooms).length,
        stairs: 1,
        slabOpenings: 1,
        railings: 2,
        doors: 3,
        windows: 2,
      },
    }),
  );
  const circulationRow = rows.at(-1);
  const c = circulationRow.counts;
  circulationRow.status =
    c.spaces >= circulationRow.thresholds.spaces &&
    c.stairs >= circulationRow.thresholds.stairs &&
    c.slabOpenings >= circulationRow.thresholds.slabOpenings &&
    c.railings >= circulationRow.thresholds.railings &&
    c.doors >= circulationRow.thresholds.doors &&
    c.windows >= circulationRow.thresholds.windows
      ? 'pass'
      : 'fail';

  rows.push(
    dataRow(
      'export_manifests',
      exportValidation?.ok === true &&
        REQUIRED_EXPORT_CHECKS.every((id) => passLike(exportChecks.get(id))),
      {
        summary: exportValidation?.summary ?? null,
        requiredChecks: REQUIRED_EXPORT_CHECKS.map((id) => ({
          id,
          status: exportChecks.get(id) ?? 'missing',
        })),
      },
    ),
  );

  return rows;
}

export async function buildTargetHouseEvidenceAcceptanceReport({
  rootDir = process.cwd(),
  evidenceDir = 'seed-artifacts/target-house-1/evidence/live-run-current',
  pack,
} = {}) {
  const resolvedEvidenceDir = path.resolve(rootDir, evidenceDir);
  const [
    visualContract,
    screenshotManifest,
    modelStats,
    bimDataQuality,
    exportValidation,
    snapshot,
  ] = await Promise.all([
    readJson(path.join(resolvedEvidenceDir, 'visual-evidence-contract.json'), {}),
    readJson(path.join(resolvedEvidenceDir, 'screenshot-manifest.json'), {}),
    readJson(path.join(resolvedEvidenceDir, 'model-stats.json'), {}),
    readJson(path.join(resolvedEvidenceDir, 'bim-data-quality.json'), {}),
    readJson(path.join(resolvedEvidenceDir, 'export-validation.json'), {}),
    readJson(path.join(resolvedEvidenceDir, 'snapshot.json'), {}),
  ]);

  const visualRows = await buildVisualRows({
    rootDir,
    evidenceDir: resolvedEvidenceDir,
    pack,
    visualContract,
    screenshotManifest,
    snapshot,
  });
  const dataQualityRows = buildDataQualityRows({
    pack,
    modelStats,
    bimDataQuality,
    exportValidation,
    snapshot,
  });

  const visualOk = visualRows.every((row) => row.status === 'pass');
  const dataQualityOk = dataQualityRows.every((row) => row.status === 'pass');

  return {
    schemaVersion: TARGET_HOUSE_EVIDENCE_ACCEPTANCE_SCHEMA_VERSION,
    targetId: pack?.targetId ?? 'target-house-1',
    evidenceDir: normalizeRel(rootDir, resolvedEvidenceDir),
    ok: visualOk && dataQualityOk,
    summary: {
      requiredViewCount: visualRows.length,
      visualPassCount: visualRows.filter((row) => row.status === 'pass').length,
      visualFailCount: visualRows.filter((row) => row.status !== 'pass').length,
      dataQualityPassCount: dataQualityRows.filter((row) => row.status === 'pass').length,
      dataQualityFailCount: dataQualityRows.filter((row) => row.status !== 'pass').length,
      visualOk,
      dataQualityOk,
    },
    visualRows,
    dataQualityRows,
  };
}

export async function writeTargetHouseEvidenceAcceptanceReport({
  rootDir = process.cwd(),
  evidenceDir = 'seed-artifacts/target-house-1/evidence/live-run-current',
  outputPath = 'seed-artifacts/target-house-1/evidence/live-run-current/target-house-evidence-acceptance.json',
  pack,
} = {}) {
  const report = await buildTargetHouseEvidenceAcceptanceReport({ rootDir, evidenceDir, pack });
  const absoluteOutputPath = path.resolve(rootDir, outputPath);
  await fs.mkdir(path.dirname(absoluteOutputPath), { recursive: true });
  await fs.writeFile(absoluteOutputPath, `${JSON.stringify(report, null, 2)}\n`);
  return { report, outputPath: normalizeRel(rootDir, absoluteOutputPath) };
}
