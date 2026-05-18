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
  if (
    ['scenario', 'scenario-runner', 'scenario-fixture', 'scenario-evidence'].includes(
      evidence?.type,
    ) &&
    /^(present|passed|node-script|declared)$/i.test(String(evidence?.status ?? ''))
  ) {
    return /todo|placeholder|traceability-only|documentation-only|docs-only|stub|mock|unavailable|invalid|blank|not[-_\s]?requested|skipped|failed|error|missing|required/i.test(
      [evidence?.detail, evidence?.reason].filter(Boolean).join(' '),
    );
  }
  const text = [evidence?.status, evidence?.detail, evidence?.reason].filter(Boolean).join(' ');
  return /todo|placeholder|fixture|traceability-only|documentation-only|docs-only|optional|stub|mock|unavailable|invalid|blank|not[-_\s]?requested|skipped|failed|error|missing|required/i.test(
    text,
  );
}

function m3ClosureEvidenceHasProof(workstream, gate, evidence) {
  if (workstream.id !== 'M3-M') return true;
  if (!['two-storey-ui', 'two-storey-cmdK'].includes(gate.id)) return true;
  return (
    evidence?.proof?.twoStoreySemanticFixtureEquivalent === true &&
    evidence.proof.kind === (gate.id === 'two-storey-cmdK' ? 'cmdK' : 'ui')
  );
}

function reportM3AuditStatus() {
  const auditPath = path.join(REPO_ROOT, 'spec', 'generated', 'ui-mcp-parity.json');
  const audit = JSON.parse(fs.readFileSync(auditPath, 'utf8'));
  const wave2 = audit.m3?.wave2;
  const wave3 = audit.m3?.wave3;
  if (!wave2) {
    console.error('Generated audit is missing m3.wave2.');
    return 1;
  }
  if (!wave3) {
    console.error('Generated audit is missing m3.wave3.');
    return 1;
  }

  console.log(
    `M3 status: ${audit.m3?.status ?? 'Unknown'}; Wave 2 ${wave2.status}; gates ${wave2.summary.gatesPassed} / ${wave2.summary.gatesExpected}; Wave 3 ${wave3.status}; gates ${wave3.summary.gatesPassed} / ${wave3.summary.gatesExpected}.`,
  );
  for (const workstream of [...(wave2.workstreams ?? []), ...(wave3.workstreams ?? [])]) {
    console.log(
      `- ${workstream.id}: ${workstream.status} (${workstream.gatesPassed} / ${workstream.gatesExpected} gates)`,
    );
    for (const gate of workstream.gates ?? []) {
      if (!gate.passed) console.log(`  - ${gate.id}: ${summarize(gate.blocker)}`);
    }
  }

  const doneWorkstreamsWithSyntheticEvidence = [
    ...(wave2.workstreams ?? []),
    ...(wave3.workstreams ?? []),
  ].flatMap((workstream) => {
    if (workstream.status !== 'Done') return [];
    return (workstream.gates ?? []).flatMap((gate) =>
      (gate.evidence ?? [])
        .filter((evidence) => evidence.passes === true && evidenceLooksSynthetic(evidence))
        .map((evidence) => `${workstream.id}:${gate.id}: ${evidence.status}@${evidence.source}`),
    );
  });
  if (doneWorkstreamsWithSyntheticEvidence.length) {
    console.error('M3 audit accepted synthetic or placeholder evidence in a Done workstream:');
    for (const item of doneWorkstreamsWithSyntheticEvidence) console.error(`- ${item}`);
    return 1;
  }

  const missingClosureProof = [...(wave2.workstreams ?? []), ...(wave3.workstreams ?? [])].flatMap(
    (workstream) =>
      (workstream.gates ?? []).flatMap((gate) =>
        (gate.evidence ?? [])
          .filter((evidence) => evidence.passes === true)
          .filter((evidence) => !m3ClosureEvidenceHasProof(workstream, gate, evidence))
          .map((evidence) => `${workstream.id}:${gate.id}: ${evidence.status}@${evidence.source}`),
      ),
  );
  if (missingClosureProof.length) {
    console.error('M3 audit accepted two-storey closure evidence without semantic proof:');
    for (const item of missingClosureProof) console.error(`- ${item}`);
    return 1;
  }

  const requiredDone = ['M3-F', 'M3-G', 'M3-H', 'M3-I', 'M3-K', 'M3-L', 'M3-M', 'M3-N', 'M3-O'];
  const workstreamsById = new Map(
    [...(wave2.workstreams ?? []), ...(wave3.workstreams ?? [])].map((workstream) => [
      workstream.id,
      workstream,
    ]),
  );
  const unfinished = requiredDone.filter((id) => workstreamsById.get(id)?.status !== 'Done');
  if (audit.m3?.status === 'Done' && unfinished.length) {
    console.error(
      `M3 cannot be Done while these workstreams are unfinished: ${unfinished.join(', ')}.`,
    );
    return 1;
  }
  if (
    (wave2.status === 'Done' || wave3.status === 'Done') &&
    audit.m3?.status !== 'Done' &&
    !unfinished.length
  ) {
    console.error('M3 status drifted from generated Wave 2/Wave 3 Done evidence.');
    return 1;
  }
  if (envEnabled('BIM_AI_M3_REQUIRE_DONE') && (audit.m3?.status !== 'Done' || unfinished.length)) {
    console.error(
      'BIM_AI_M3_REQUIRE_DONE is set, but generated audit evidence does not mark M3 Done.',
    );
    return 1;
  }
  if (audit.m3?.status !== 'Done') {
    console.log(
      'M3 remains Partial unless BIM_AI_M3_REQUIRE_DONE=1 is set for a strict release gate.',
    );
  }
  return 0;
}

runCheck('M3 script syntax checks', 'node', ['--check', 'scripts/audit-ui-mcp-parity.mjs']);
runCheck('M3 verifier syntax check', 'node', ['--check', 'scripts/verify-m3-parity.mjs']);
runCheck('UI/MCP parity audit generation', 'pnpm', ['audit:ui-mcp-parity']);

const status = reportM3AuditStatus();
if (status !== 0) process.exit(status);

console.log('\nverify:m3-parity PASS');
