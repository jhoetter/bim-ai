#!/usr/bin/env node
/**
 * Materialise `packages/cli/lib/one-family-home-commands.mjs` against an
 * empty model via the Python engine, then emit a wire-format `Snapshot`
 * JSON to `packages/web/e2e/__fixtures__/seed-target-house-snapshot.json`.
 *
 * Used as the API mock fixture in `packages/web/e2e/seed-target-house.spec.ts`
 * so each phase commit produces a deterministic visual checkpoint without
 * needing the dev server (postgres / vite) to be running.
 *
 * Usage:
 *   node scripts/build-seed-snapshot.mjs
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');

const FIXTURE_DIR = path.join(REPO_ROOT, 'packages', 'web', 'e2e', '__fixtures__');
const FIXTURE_PATH = path.join(FIXTURE_DIR, 'seed-target-house-snapshot.json');

const MODEL_ID = '00000000-0000-4000-a000-00005eed0001';

const py = path.join(REPO_ROOT, 'app', '.venv', 'bin', 'python');
if (!fs.existsSync(py)) {
  console.error(`Python venv not found at ${py}. Run \`make install\` first.`);
  process.exit(2);
}

const inline = `
import sys, json, subprocess
sys.path.insert(0, '.')
from bim_ai.document import Document
from bim_ai.engine import try_commit_bundle

proc = subprocess.run(
    ['node', '--input-type=module', '-e',
     "import { buildOneFamilyHomeCommands } from './packages/cli/lib/one-family-home-commands.mjs'; process.stdout.write(JSON.stringify(buildOneFamilyHomeCommands()));"],
    cwd='..', capture_output=True, text=True, timeout=60, check=True,
)
cmds = json.loads(proc.stdout)
ok, doc, _, violations, code = try_commit_bundle(Document(revision=0, elements={}), cmds)
if not ok or doc is None:
    blocking = [v for v in violations if getattr(v, 'blocking', False)]
    sys.stderr.write(f'commit failed (code={code}): {blocking}\\n')
    sys.exit(1)
elements = {kid: elem.model_dump(by_alias=True, mode='json') for kid, elem in doc.elements.items()}
viol_payload = [
    {
        'ruleId': v.rule_id,
        'severity': v.severity,
        'message': v.message,
        'elementIds': list(getattr(v, 'element_ids', []) or []),
        'blocking': bool(getattr(v, 'blocking', False)),
    }
    for v in violations
]
snapshot = {
    'modelId': '${MODEL_ID}',
    'revision': doc.revision,
    'elements': elements,
    'violations': viol_payload,
}
sys.stdout.write(json.dumps(snapshot))
`;

const result = spawnSync(py, ['-c', inline], {
  cwd: path.join(REPO_ROOT, 'app'),
  encoding: 'utf8',
  maxBuffer: 64 * 1024 * 1024,
});

if (result.status !== 0) {
  console.error(result.stderr || 'snapshot build failed');
  process.exit(result.status ?? 1);
}

const snap = JSON.parse(result.stdout);
fs.mkdirSync(FIXTURE_DIR, { recursive: true });
fs.writeFileSync(FIXTURE_PATH, `${JSON.stringify(snap, null, 2)}\n`);

const kindCounts = {};
for (const elem of Object.values(snap.elements)) {
  const k = (elem && /** @type {{kind?: string}} */ (elem).kind) || '?';
  kindCounts[k] = (kindCounts[k] ?? 0) + 1;
}
const blocking = snap.violations.filter((/** @type {{blocking: boolean}} */ v) => v.blocking).length;
console.log(
  `wrote ${path.relative(REPO_ROOT, FIXTURE_PATH)} — revision=${snap.revision} elements=${
    Object.keys(snap.elements).length
  } blocking=${blocking}`,
);
const sortedKinds = Object.keys(kindCounts).sort();
for (const k of sortedKinds) console.log(`  ${k}: ${kindCounts[k]}`);
