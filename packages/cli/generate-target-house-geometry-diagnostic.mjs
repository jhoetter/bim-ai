import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  buildTargetHouseGeometryDiagnostic,
  readJson,
  renderTargetHouseGeometryDiagnosticMarkdown,
  sha256File,
} from './lib/target-house-geometry-diagnostics.mjs';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const snapshotPath = resolve(
  repoRoot,
  'seed-artifacts/target-house-1/evidence/live-run-current/snapshot.json',
);
const requiredFeaturesPath = resolve(repoRoot, 'spec/generated/target-house-1-required-features.json');
const jsonReportPath = resolve(
  repoRoot,
  'seed-artifacts/target-house-1/evidence/live-run-current/target-house-geometry-diagnostic.json',
);
const markdownReportPath = resolve(
  repoRoot,
  'seed-artifacts/target-house-1/evidence/live-run-current/target-house-geometry-diagnostic.md',
);

const report = buildTargetHouseGeometryDiagnostic({
  snapshot: readJson(snapshotPath),
  requiredFeatures: readJson(requiredFeaturesPath),
  sourceDigests: {
    [snapshotPath.replace(`${repoRoot}/`, '')]: sha256File(snapshotPath),
    [requiredFeaturesPath.replace(`${repoRoot}/`, '')]: sha256File(requiredFeaturesPath),
  },
});

mkdirSync(dirname(jsonReportPath), { recursive: true });
writeFileSync(jsonReportPath, `${JSON.stringify(report, null, 2)}\n`);
writeFileSync(markdownReportPath, renderTargetHouseGeometryDiagnosticMarkdown(report));

console.log(`Wrote ${jsonReportPath.replace(`${repoRoot}/`, '')}`);
console.log(`Wrote ${markdownReportPath.replace(`${repoRoot}/`, '')}`);
