#!/usr/bin/env node

import assert from 'node:assert/strict';
import test from 'node:test';
import { spawnSync } from 'node:child_process';

import { buildReport, renderMarkdown } from './code-quality-report.mjs';

test('code quality report emits scorecard sections from tracked repo state', () => {
  const report = buildReport();

  assert.equal(report.schemaVersion, 'code-quality-report.v1');
  assert.ok(report.grade.numeric >= 0);
  assert.ok(report.tracker.total >= 20);
  assert.ok(report.gates.frontend.typecheckScript?.includes('tsc'));
  assert.equal(report.gates.backendCoverage.configured, true);
  assert.equal(report.gates.backendCoverage.failUnder, 65);
  assert.equal(report.maintainability.budgetConfig.path, 'spec/code-quality-budgets.json');
  assert.ok(report.maintainability.budgetConfig.ownershipCount > 0);
  assert.ok(report.maintainability.largestFiles.length > 0);
  assert.equal(typeof report.repositoryHygiene.trackedArtifactCount, 'number');
  assert.equal(report.waivers.activeCount >= 0, true);
});

test('code quality report markdown includes grade, budgets, hygiene, and waivers', () => {
  const markdown = renderMarkdown(buildReport());

  assert.match(markdown, /Code Quality Grade:/);
  assert.match(markdown, /## Maintainability Budgets/);
  assert.match(markdown, /## Repository Hygiene/);
  assert.match(markdown, /## Waivers/);
});

test('code quality report CLI supports JSON and release threshold checks', () => {
  const jsonRun = spawnSync(
    process.execPath,
    ['scripts/code-quality-report.mjs', '--json', '--fail-below', 'C'],
    { encoding: 'utf8' },
  );

  assert.equal(jsonRun.status, 0, jsonRun.stderr);
  const parsed = JSON.parse(jsonRun.stdout);
  assert.equal(parsed.schemaVersion, 'code-quality-report.v1');
  assert.ok(parsed.grade.numeric >= 6);

  const strictRun = spawnSync(
    process.execPath,
    ['scripts/code-quality-report.mjs', '--json', '--fail-below', 'A+'],
    { encoding: 'utf8' },
  );
  assert.notEqual(strictRun.status, 0);
  assert.match(strictRun.stderr, /below threshold A\+/);
});
