#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';

const REPO_ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const APP_DIR = path.join(REPO_ROOT, 'app');
const PYTHON =
  process.env.PYTHON ??
  (fs.existsSync(path.join(APP_DIR, '.venv', 'bin', 'python'))
    ? path.join(APP_DIR, '.venv', 'bin', 'python')
    : 'python3');
const TRUTHY = new Set(['1', 'true', 'yes', 'on']);

function envEnabled(name) {
  return TRUTHY.has(String(process.env[name] ?? '').toLowerCase());
}

function benchmarkEvidenceArgs(extraArgs = []) {
  const args = ['benchmark:simple-house', '--mode', 'live', '--json'];
  if (process.env.BIM_AI_M2_EVIDENCE_OUT_DIR) {
    args.push('--out-dir', process.env.BIM_AI_M2_EVIDENCE_OUT_DIR);
  }
  return [...args, ...extraArgs];
}

function liveRunnerArgs(extraArgs = []) {
  const args = ['scripts/benchmarks/simple-house-live-evidence.mjs', '--json'];
  if (process.env.BIM_AI_M2_EVIDENCE_OUT_DIR) {
    args.push('--out-dir', process.env.BIM_AI_M2_EVIDENCE_OUT_DIR);
  }
  if (process.env.BIM_AI_BASE_URL) args.push('--base-url', process.env.BIM_AI_BASE_URL);
  if (process.env.BIM_AI_PROJECT_ID) args.push('--project-id', process.env.BIM_AI_PROJECT_ID);
  if (process.env.BIM_AI_TEMPLATE_ID) args.push('--template-id', process.env.BIM_AI_TEMPLATE_ID);
  return [...args, ...extraArgs];
}

function requiredEnvMissing(names) {
  return names.filter((name) => !process.env[name]);
}

function summarizeBlocker(text) {
  const value = String(text ?? '');
  return value.length > 500 ? `${value.slice(0, 497)}...` : value;
}

function passingEvidenceLooksSynthetic(evidence) {
  const text = [evidence?.status, evidence?.source, evidence?.detail, evidence?.reason]
    .filter(Boolean)
    .join(' ');
  return /todo|placeholder|fixture|traceability-only|documentation-only|docs-only|optional|stub|mock|unavailable|invalid|blank|not[-_\s]?requested|skipped|failed|error/i.test(
    text,
  );
}

function reportM2AuditClosure() {
  const auditPath = path.join(REPO_ROOT, 'spec', 'generated', 'ui-mcp-parity.json');
  const audit = JSON.parse(fs.readFileSync(auditPath, 'utf8'));
  const m2 = audit.m2 ?? {};
  const firstPackExpected = m2.firstPackExpectedCount ?? 0;
  const firstPackPresent = m2.firstPackPresentCount ?? 0;
  const closureStatus = m2.closureStatus ?? 'Unknown';
  const passedGates = m2.closureGatePassedCount ?? 0;
  const gateCount = m2.closureGateCount ?? 0;

  console.log(
    `M2 audit status: ${closureStatus}; first-pack ${firstPackPresent} / ${firstPackExpected}; closure gates ${passedGates} / ${gateCount}.`,
  );

  for (const blocker of m2.closureBlockers ?? []) {
    console.log(`- ${blocker.id}: ${summarizeBlocker(blocker.blocker)}`);
  }

  if (firstPackPresent !== firstPackExpected) {
    console.error('M2 first-pack surface coverage regressed.');
    return 1;
  }

  const syntheticPassingEvidence = (m2.closureGates ?? []).flatMap((gate) =>
    (gate.evidence ?? [])
      .filter((evidence) => evidence.passes === true && passingEvidenceLooksSynthetic(evidence))
      .map((evidence) => `${gate.id}: ${evidence.status}@${evidence.source ?? 'unknown'}`),
  );
  if (syntheticPassingEvidence.length) {
    console.error('M2 audit accepted placeholder/stub-style evidence as passing:');
    for (const item of syntheticPassingEvidence) console.error(`- ${item}`);
    return 1;
  }

  if (envEnabled('BIM_AI_M2_REQUIRE_DONE') && closureStatus !== 'Done') {
    console.error(
      'BIM_AI_M2_REQUIRE_DONE is set, but generated audit evidence does not mark M2 Done.',
    );
    return 1;
  }

  if (closureStatus !== 'Done') {
    console.log(
      'M2 remains Partial unless BIM_AI_M2_REQUIRE_DONE=1 is set for a strict release gate.',
    );
  }

  return 0;
}

const checks = [
  {
    label: 'M2 verifier format check',
    command: 'pnpm',
    args: [
      'exec',
      'prettier',
      '--check',
      'scripts/verify-m2-parity.mjs',
      'spec/ui-mcp-parity-tracker.md',
    ],
  },
  {
    label: 'M2 script syntax checks',
    command: 'node',
    args: ['--check', 'scripts/audit-ui-mcp-parity.mjs'],
  },
  {
    label: 'Benchmark script syntax check',
    command: 'node',
    args: ['--check', 'scripts/benchmarks/simple-house.mjs'],
  },
  {
    label: 'Live evidence runner syntax check',
    command: 'node',
    args: ['--check', 'scripts/benchmarks/simple-house-live-evidence.mjs'],
  },
  {
    label: 'Local live target syntax check',
    command: 'node',
    args: ['--check', 'scripts/benchmarks/simple-house-local-live-target.mjs'],
  },
  {
    label: 'Architecture guard',
    command: 'pnpm',
    args: ['architecture'],
  },
  {
    label: 'Backend focused M2 tests',
    command: PYTHON,
    cwd: APP_DIR,
    env: { PYTHONPATH: '.' },
    args: [
      '-m',
      'pytest',
      'tests/test_api_v3_registry.py',
      'tests/test_query_resolve.py',
      'tests/api/test_apply_bundle_route.py',
      'tests/cmd/test_apply_bundle_engine.py',
      'tests/cmd/test_apply_bundle_types.py',
      'tests/test_command_schemas.py',
      'tests/test_create_wall_chain.py',
      'tests/test_create_roof_opening.py',
      'tests/test_saved_3d_view_clip_evidence.py',
      'tests/test_constructability_report.py',
      '--no-cov',
      '-q',
    ],
  },
  {
    label: 'CLI M2 parity tests',
    command: 'pnpm',
    args: ['--filter', '@bim-ai/cli', 'test'],
  },
  {
    label: 'UI simple-house traceability tests',
    command: 'pnpm',
    args: [
      '--filter',
      '@bim-ai/web',
      'exec',
      'vitest',
      'run',
      'src/cmdPalette/defaultCommands.test.ts',
      'src/cmdPalette/simpleHouseUiTraceability.test.ts',
    ],
  },
  {
    label: 'Simple-house benchmark offline/live-stub tests',
    command: 'node',
    args: ['--test', 'scripts/benchmarks/simple-house.test.mjs'],
  },
  {
    label: 'Simple-house live evidence runner tests',
    command: 'node',
    args: ['--test', 'scripts/benchmarks/simple-house-live-evidence.test.mjs'],
  },
  {
    label: 'Simple-house local live target tests',
    command: 'node',
    args: ['--test', 'scripts/benchmarks/simple-house-local-live-target.test.mjs'],
  },
  {
    label: 'Simple-house offline smoke command',
    command: 'pnpm',
    args: ['benchmark:simple-house', '--mode', 'offline'],
  },
  {
    label: 'Optional live simple-house dry-run evidence',
    command: 'pnpm',
    args: benchmarkEvidenceArgs(),
    optionalEnv: 'BIM_AI_M2_LIVE_DRY_RUN',
    requiredEnv: ['BIM_AI_BASE_URL', 'BIM_AI_MODEL_ID'],
    skipReason:
      'Set BIM_AI_M2_LIVE_DRY_RUN=1 with BIM_AI_BASE_URL and BIM_AI_MODEL_ID to run the live dry-run benchmark.',
  },
  {
    label: 'Optional disposable live evidence runner',
    command: 'node',
    args: liveRunnerArgs(),
    optionalEnv: 'BIM_AI_M2_LIVE_DISPOSABLE',
    requiredEnv: ['BIM_AI_BASE_URL', 'BIM_AI_PROJECT_ID'],
    skipReason:
      'Set BIM_AI_M2_LIVE_DISPOSABLE=1 with BIM_AI_BASE_URL and BIM_AI_PROJECT_ID to create a disposable target and collect live dry-run evidence.',
  },
  {
    label: 'Optional committed-model evidence collection',
    command: 'pnpm',
    args: benchmarkEvidenceArgs(['--collect-committed-evidence']),
    optionalEnv: 'BIM_AI_M2_COLLECT_COMMITTED_EVIDENCE',
    requiredEnv: ['BIM_AI_BASE_URL', 'BIM_AI_MODEL_ID'],
    skipReason:
      'Set BIM_AI_M2_COLLECT_COMMITTED_EVIDENCE=1 with BIM_AI_BASE_URL and BIM_AI_MODEL_ID to read committed advisor/validation/visual/export evidence.',
  },
  {
    label: 'Optional live simple-house commit evidence',
    command: 'pnpm',
    args: benchmarkEvidenceArgs(['--commit-live']),
    optionalEnv: 'BIM_AI_M2_LIVE_COMMIT',
    requiredEnv: ['BIM_AI_BASE_URL', 'BIM_AI_MODEL_ID'],
    skipReason:
      'Set BIM_AI_M2_LIVE_COMMIT=1 with BIM_AI_BASE_URL and BIM_AI_MODEL_ID to run the mutating live commit benchmark.',
  },
  {
    label: 'UI/MCP parity audit generation',
    command: 'pnpm',
    args: ['audit:ui-mcp-parity'],
  },
  {
    label: 'M2 audit closure status report',
    run: reportM2AuditClosure,
  },
];

function shellLine(check) {
  if (check.run) return '<internal audit status check>';
  const cwd =
    check.cwd && check.cwd !== REPO_ROOT ? `cd ${path.relative(REPO_ROOT, check.cwd)} && ` : '';
  const env = check.env
    ? `${Object.entries(check.env)
        .map(([key, value]) => `${key}=${value}`)
        .join(' ')} `
    : '';
  return `${cwd}${env}${[check.command, ...check.args].join(' ')}`;
}

for (const [index, check] of checks.entries()) {
  console.log(`\n[${index + 1}/${checks.length}] ${check.label}`);
  if (check.optionalEnv && !envEnabled(check.optionalEnv)) {
    console.log(`SKIP: ${check.skipReason}`);
    continue;
  }
  const missingEnv = check.requiredEnv ? requiredEnvMissing(check.requiredEnv) : [];
  if (missingEnv.length) {
    console.error(
      `\n${check.label} is enabled but missing required environment variable(s): ${missingEnv.join(
        ', ',
      )}.`,
    );
    process.exit(1);
  }
  console.log(`$ ${shellLine(check)}`);
  if (check.run) {
    const status = check.run();
    if (status !== 0) process.exit(status);
    continue;
  }
  const result = spawnSync(check.command, check.args, {
    cwd: check.cwd ?? REPO_ROOT,
    env: { ...process.env, ...(check.env ?? {}) },
    stdio: 'inherit',
  });

  if (result.error) {
    console.error(`\n${check.label} failed to start: ${result.error.message}`);
    process.exit(1);
  }
  if (result.status !== 0) {
    console.error(`\n${check.label} failed with exit code ${result.status}.`);
    process.exit(result.status ?? 1);
  }
}

console.log('\nverify:m2-parity PASS');
