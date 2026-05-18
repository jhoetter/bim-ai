#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';

const REPO_ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const TRUTHY = new Set(['1', 'true', 'yes', 'on']);

function envEnabled(name) {
  return TRUTHY.has(String(process.env[name] ?? '').toLowerCase());
}

function runCheck(label, command, args, options = {}) {
  console.log(`\n${label}`);
  console.log(`$ ${[command, ...args].join(' ')}`);
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? REPO_ROOT,
    env: { ...process.env, ...(options.env ?? {}) },
    stdio: 'inherit',
  });
  if (result.error) {
    console.error(`${label} failed to start: ${result.error.message}`);
    process.exit(1);
  }
  if (result.status !== 0) {
    console.error(`${label} failed with exit code ${result.status}.`);
    process.exit(result.status ?? 1);
  }
}

function summarize(text) {
  const value = String(text ?? '');
  return value.length > 500 ? `${value.slice(0, 497)}...` : value;
}

function evidenceLooksSynthetic(evidence) {
  const text = [evidence?.status, evidence?.source, evidence?.detail, evidence?.reason]
    .filter(Boolean)
    .join(' ');
  return /todo|placeholder|traceability-only|documentation-only|docs-only|stub|mock|unavailable|invalid|blank|not[-_\s]?requested|skipped|failed|error|missing|required/i.test(
    text,
  );
}

function hasMachineReadableEvidence(evidence) {
  return ['artifacts', 'proof', 'evidence', 'metrics', 'validation'].some((key) => {
    const value = evidence?.[key];
    if (Array.isArray(value)) return value.length > 0;
    if (value && typeof value === 'object') return Object.keys(value).length > 0;
    return typeof value === 'string' && value.trim().length > 0;
  });
}

function invalidPassingM4ScenarioEvidence(wave1) {
  return (wave1.workstreams ?? []).flatMap((workstream) =>
    (workstream.gates ?? []).flatMap((gate) =>
      (gate.evidence ?? [])
        .filter(
          (evidence) =>
            evidence.type === 'professional-scenario-evidence' && evidence.passes === true,
        )
        .filter(
          (evidence) =>
            !['executable', 'validated-replay'].includes(evidence.classification) ||
            evidence.status !== 'passed' ||
            !hasMachineReadableEvidence(evidence),
        )
        .map(
          (evidence) =>
            `${workstream.id}:${gate.id}: ${evidence.scenarioId ?? evidence.source}.${evidence.kind ?? 'unknown'} classification=${evidence.classification ?? 'missing'} status=${evidence.status ?? 'missing'}`,
        ),
    ),
  );
}

function reportM4AuditStatus() {
  const auditPath = path.join(REPO_ROOT, 'spec', 'generated', 'ui-mcp-parity.json');
  const audit = JSON.parse(fs.readFileSync(auditPath, 'utf8'));
  const wave1 = audit.m4?.wave1;
  if (!wave1) {
    console.error('Generated audit is missing m4.wave1.');
    return 1;
  }

  console.log(
    `M4 status: ${audit.m4?.status ?? 'Unknown'}; Wave 1 ${wave1.status}; gates ${wave1.summary.gatesPassed} / ${wave1.summary.gatesExpected}; blockers ${wave1.summary.blockerCount}.`,
  );
  for (const workstream of wave1.workstreams ?? []) {
    console.log(
      `- ${workstream.id}: ${workstream.status} (${workstream.gatesPassed} / ${workstream.gatesExpected} gates)`,
    );
    for (const gate of workstream.gates ?? []) {
      if (!gate.passed) console.log(`  - ${gate.id}: ${summarize(gate.blocker)}`);
    }
  }

  const requiredWorkstreams = ['M4-A', 'M4-B', 'M4-C', 'M4-D', 'M4-E', 'M4-F'];
  const workstreamsById = new Map((wave1.workstreams ?? []).map((row) => [row.id, row]));
  const missingWorkstreams = requiredWorkstreams.filter((id) => !workstreamsById.has(id));
  if (missingWorkstreams.length) {
    console.error(`M4 Wave 1 audit is missing workstreams: ${missingWorkstreams.join(', ')}.`);
    return 1;
  }

  const auditWorkstream = workstreamsById.get('M4-F');
  if (auditWorkstream?.status !== 'Done') {
    console.error('M4-F audit gates must be Done so domain blockers are generated reliably.');
    return 1;
  }

  const doneWorkstreamsWithSyntheticEvidence = (wave1.workstreams ?? []).flatMap((workstream) => {
    if (workstream.status !== 'Done') return [];
    return (workstream.gates ?? []).flatMap((gate) =>
      (gate.evidence ?? [])
        .filter((evidence) => evidence.passes === true && evidenceLooksSynthetic(evidence))
        .map((evidence) => `${workstream.id}:${gate.id}: ${evidence.status}@${evidence.source}`),
    );
  });
  if (doneWorkstreamsWithSyntheticEvidence.length) {
    console.error('M4 audit accepted placeholder-style evidence in a Done workstream:');
    for (const item of doneWorkstreamsWithSyntheticEvidence) console.error(`- ${item}`);
    return 1;
  }

  const invalidScenarioEvidence = invalidPassingM4ScenarioEvidence(wave1);
  if (invalidScenarioEvidence.length) {
    console.error(
      'M4 audit accepted scenario evidence without executable/validated-replay machine-readable proof:',
    );
    for (const item of invalidScenarioEvidence) console.error(`- ${item}`);
    return 1;
  }

  const unfinishedDomains = ['M4-A', 'M4-B', 'M4-C', 'M4-D', 'M4-E'].filter(
    (id) => workstreamsById.get(id)?.status !== 'Done',
  );
  if (audit.m4?.status === 'Done' && unfinishedDomains.length) {
    console.error(
      `M4 cannot be Done while these domain packs are unfinished: ${unfinishedDomains.join(', ')}.`,
    );
    return 1;
  }
  if (envEnabled('BIM_AI_M4_REQUIRE_DONE') && audit.m4?.status !== 'Done') {
    console.error(
      'BIM_AI_M4_REQUIRE_DONE is set, but generated audit evidence does not mark M4 Done.',
    );
    return 1;
  }
  if (audit.m4?.status !== 'Done') {
    console.log(
      'M4 remains Partial unless BIM_AI_M4_REQUIRE_DONE=1 is set and all generated domain-pack gates pass.',
    );
  }
  return 0;
}

runCheck('M4 script syntax checks', 'node', ['--check', 'scripts/audit-ui-mcp-parity.mjs']);
runCheck('M4 verifier syntax check', 'node', ['--check', 'scripts/verify-m4-parity.mjs']);
runCheck('UI/MCP parity audit generation', 'pnpm', ['audit:ui-mcp-parity']);

const status = reportM4AuditStatus();
if (status !== 0) process.exit(status);

console.log('\nverify:m4-parity PASS');
