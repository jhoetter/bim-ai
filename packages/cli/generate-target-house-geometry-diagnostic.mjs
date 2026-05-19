import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  buildTargetHouseGeometryDiagnostic,
  readJson,
  renderTargetHouseGeometryDiagnosticMarkdown,
} from './lib/target-house-geometry-diagnostics.mjs';
import { resolveTargetHouseSnapshotInput } from './lib/target-house-package-inputs.mjs';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const seed = 'target-house-1';
const snapshotInput = resolveTargetHouseSnapshotInput({ repoRoot, seed });
const requiredFeaturesPath = snapshotInput.context.requiredFeaturesPath;
const jsonReportPath = resolve(
  repoRoot,
  'seed-artifacts/target-house-1/evidence/live-run-current/target-house-geometry-diagnostic.json',
);
const markdownReportPath = resolve(
  repoRoot,
  'seed-artifacts/target-house-1/evidence/live-run-current/target-house-geometry-diagnostic.md',
);

const report = buildTargetHouseGeometryDiagnostic({
  snapshot: snapshotInput.snapshot,
  requiredFeatures: readJson(requiredFeaturesPath),
  sourceDigests: snapshotInput.sourceDigests,
  snapshotSource: snapshotInput.snapshotSource,
});

mkdirSync(dirname(jsonReportPath), { recursive: true });
writeFileSync(jsonReportPath, `${JSON.stringify(report, null, 2)}\n`);
writeFileSync(markdownReportPath, renderTargetHouseGeometryDiagnosticMarkdown(report));

console.log(`Wrote ${jsonReportPath.replace(`${repoRoot}/`, '')}`);
console.log(`Wrote ${markdownReportPath.replace(`${repoRoot}/`, '')}`);
if (!snapshotInput.snapshotSource.liveEvidenceFresh) {
  console.log('Used materialized seed-bundle snapshot because live-run-current evidence is stale.');
}
