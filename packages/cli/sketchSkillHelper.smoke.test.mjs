import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '../..');
const HELPER = path.join(ROOT, 'claude-skills/sketch-to-bim/sketch_bim.py');
const ADVISOR_RULE_FILES = [
  'app/bim_ai/constructability_advisories.py',
  'app/bim_ai/constructability_report.py',
  'app/bim_ai/constraints_metadata.py',
  'packages/web/src/advisor/advisorViolationContext.ts',
  'packages/web/src/advisor/perspectiveFilter.ts',
];

function runHelper(args) {
  return new Promise((resolve) => {
    const child = spawn('python3', [HELPER, ...args], { cwd: ROOT, env: process.env });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (c) => {
      stdout += c.toString();
    });
    child.stderr.on('data', (c) => {
      stderr += c.toString();
    });
    child.on('exit', (code) => resolve({ code, stdout, stderr }));
  });
}

function startJsonServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      res.statusCode = 200;
      res.setHeader('content-type', 'application/json');
      if (req.url?.endsWith('/snapshot')) {
        res.end(JSON.stringify({ modelId: 'model-1', revision: 3, elements: {} }));
        return;
      }
      res.end(JSON.stringify({ ok: true }));
    });
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      resolve({ server, base: `http://127.0.0.1:${addr.port}` });
    });
  });
}

async function writeJson(filePath, payload) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

async function sha256(filePath) {
  const bytes = await fs.readFile(filePath);
  return createHash('sha256').update(bytes).digest('hex');
}

async function digestFiles(paths) {
  const h = createHash('sha256');
  for (const relPath of [...paths].sort()) {
    h.update(relPath);
    h.update('\0');
    h.update(await sha256(path.join(ROOT, relPath)));
    h.update('\0');
  }
  return h.digest('hex');
}

test('sketch helper doctor, tools, archetypes, compile validation, phase accept, and stale check smoke', async () => {
  const { server, base } = await startJsonServer();
  try {
    const doctor = await runHelper(['doctor', '--base-url', base, '--web-url', base]);
    assert.equal(doctor.code, 0, doctor.stderr);
    const doctorPayload = JSON.parse(doctor.stdout);
    assert.equal(doctorPayload.filesOk, true);
    assert.equal(doctorPayload.liveOk, true);

    const tools = await runHelper(['tools']);
    assert.equal(tools.code, 0, tools.stderr);
    const toolsPayload = JSON.parse(tools.stdout);
    assert.equal(toolsPayload.skill, 'sketch-to-bim');
    assert.ok(toolsPayload.tools.some((tool) => tool.command === 'stale-check'));

    const archetypes = await runHelper(['archetypes', '--query', 'modern']);
    assert.equal(archetypes.code, 0, archetypes.stderr);
    const archetypePayload = JSON.parse(archetypes.stdout);
    assert.ok(
      archetypePayload.archetypes.some((row) => row.id === 'modern-two-storey-wrapper-house'),
    );

    const missingCompile = await runHelper([
      'compile',
      '--seed',
      'skb-helper-smoke-missing',
      '--recipe',
      'spec/examples/does-not-exist.recipe.json',
    ]);
    assert.notEqual(missingCompile.code, 0);
    assert.match(missingCompile.stderr, /does-not-exist\.recipe\.json|ENOENT|no such file/i);

    const phaseDir = await fs.mkdtemp(path.join(os.tmpdir(), 'skb-helper-phase-'));
    await writeJson(path.join(phaseDir, 'evidence-manifest.json'), { ok: true });
    await writeJson(path.join(phaseDir, 'advisor-warning.json'), { total: 0, violations: [] });
    await writeJson(path.join(phaseDir, 'advisor-info.json'), { total: 1, violations: [] });
    await writeJson(path.join(phaseDir, 'advisor-error.json'), { total: 0, violations: [] });
    await writeJson(path.join(phaseDir, 'constructability-report.json'), { ok: true });
    await writeJson(path.join(phaseDir, 'visual-evidence-contract.json'), { ok: true });
    await writeJson(path.join(phaseDir, 'finding-dispositions.json'), {
      findings: [
        { source: 'advisor', severity: 'info', code: 'reviewed', disposition: 'reviewed' },
      ],
    });
    await writeJson(path.join(phaseDir, 'screenshot-manifest.json'), { screenshots: [] });
    await writeJson(path.join(phaseDir, 'semantic-checklist.json'), {
      checks: [{ viewId: 'main', verdict: 'pass' }],
    });
    await fs.writeFile(path.join(phaseDir, 'visual-readout.md'), 'ok\n', 'utf8');
    await fs.writeFile(path.join(phaseDir, 'corrections.md'), 'none\n', 'utf8');
    await writeJson(path.join(phaseDir, 'issue-ledger.json'), { entries: [] });
    const phaseAccept = await runHelper(['phase-accept', '--phase', 'shell', '--dir', phaseDir]);
    assert.equal(phaseAccept.code, 0, phaseAccept.stderr);
    const phasePayload = JSON.parse(phaseAccept.stdout);
    assert.equal(phasePayload.ok, true);
    assert.equal(phasePayload.findingDispositions.countsByDisposition.reviewed, 1);

    const seed = `skb-helper-smoke-${Date.now()}`;
    const seedDir = path.join(ROOT, 'seed-artifacts', seed);
    const evidenceDir = path.join(seedDir, 'evidence');
    const currentDir = path.join(evidenceDir, 'live-run-current');
    try {
      const bundlePath = path.join(seedDir, 'bundle.json');
      const irPath = path.join(evidenceDir, 'sketch-ir.json');
      const capabilitiesPath = path.join(ROOT, 'spec/sketch-to-bim-capability-matrix.json');
      await writeJson(bundlePath, { schemaVersion: 'cmd-v3.0', commands: [] });
      await writeJson(irPath, { schemaVersion: 'sketch-understanding-ir.v0' });
      await writeJson(path.join(currentDir, 'tool-run-summary.json'), {
        modelId: 'model-1',
        modelRevision: 3,
        gitHead: doctorPayload.gitHead,
        bundleSha256: await sha256(bundlePath),
        irSha256: await sha256(irPath),
        capabilitiesPath: 'spec/sketch-to-bim-capability-matrix.json',
        capabilitiesSha256: await sha256(capabilitiesPath),
        advisorRuleFiles: ADVISOR_RULE_FILES,
        advisorRuleDigest: await digestFiles(ADVISOR_RULE_FILES),
      });
      const fresh = await runHelper(['stale-check', '--seed', seed, '--base-url', base]);
      assert.equal(fresh.code, 0, fresh.stderr);
      assert.equal(JSON.parse(fresh.stdout).ok, true);

      await writeJson(bundlePath, { schemaVersion: 'cmd-v3.0', commands: [{ type: 'noop' }] });
      const stale = await runHelper(['stale-check', '--seed', seed, '--base-url', base]);
      assert.equal(stale.code, 4);
      const stalePayload = JSON.parse(stale.stdout);
      assert.equal(stalePayload.ok, false);
      assert.ok(stalePayload.stale.bundleSha256);
    } finally {
      await fs.rm(seedDir, { recursive: true, force: true });
    }
  } finally {
    server.close();
  }
});

test('active sketch skill files do not default normal runs to archived workflow paths', async () => {
  const activeFiles = [
    'claude-skills/sketch-to-bim/SKILL.md',
    'claude-skills/sketch-to-bim/sketch_bim.py',
    'claude-skills/sketch-to-bim/tools.json',
  ];
  const forbidden = [
    /spec\/archive\/sketch-to-bim-capability-matrix\.json/,
    /spec\/archive\/sketch-to-bim-methodology\.md/,
    /spec\/archive\/sketch-to-bim-process-audit-tracker\.md/,
    /spec\/archive\/sketch-to-bim-archetypes\.json/,
  ];
  const hits = [];
  for (const file of activeFiles) {
    const text = await fs.readFile(path.join(ROOT, file), 'utf8');
    for (const pattern of forbidden) {
      if (pattern.test(text)) hits.push(`${file}: ${pattern}`);
    }
  }
  assert.deepEqual(hits, []);
});
