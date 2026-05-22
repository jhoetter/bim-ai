#!/usr/bin/env node

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, extname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CONFIG_PATH = 'spec/governance/ui-quality-budgets.json';

function parseArgs(argv) {
  return {
    json: argv.includes('--json'),
    skipDist: argv.includes('--skip-dist'),
  };
}

function readJson(path) {
  return JSON.parse(readFileSync(join(REPO_ROOT, path), 'utf8'));
}

function readText(path) {
  return readFileSync(join(REPO_ROOT, path), 'utf8');
}

function walkFiles(dir) {
  const abs = join(REPO_ROOT, dir);
  if (!existsSync(abs)) return [];
  const out = [];
  const visit = (path) => {
    const stat = statSync(path);
    if (stat.isDirectory()) {
      for (const child of readdirSync(path)) visit(join(path, child));
    } else {
      out.push({ path: relative(REPO_ROOT, path), bytes: stat.size });
    }
  };
  visit(abs);
  return out;
}

function missingTokens(text, tokens) {
  return tokens.filter((token) => !text.includes(token));
}

function kb(bytes) {
  return Number((bytes / 1024).toFixed(1));
}

function bundleSummary(config, skipDist) {
  const budgets = config.bundleBudgets;
  const files = walkFiles(budgets.distDir);
  if (files.length === 0) {
    return {
      checked: false,
      ok: skipDist,
      reason: skipDist ? 'dist check skipped' : `${budgets.distDir} is missing or empty`,
      totals: null,
      violations: skipDist ? [] : [`${budgets.distDir} is missing or empty; run pnpm build first`],
    };
  }
  const jsFiles = files.filter((file) => extname(file.path) === '.js');
  const cssFiles = files.filter((file) => extname(file.path) === '.css');
  const totalJsKb = kb(jsFiles.reduce((sum, file) => sum + file.bytes, 0));
  const totalCssKb = kb(cssFiles.reduce((sum, file) => sum + file.bytes, 0));
  const totalAssetKb = kb(files.reduce((sum, file) => sum + file.bytes, 0));
  const largestJs = jsFiles.reduce((max, file) => (file.bytes > max.bytes ? file : max), {
    path: null,
    bytes: 0,
  });
  const largestJsKb = kb(largestJs.bytes);
  const totals = {
    totalJsKb,
    totalCssKb,
    totalAssetKb,
    largestJsKb,
    largestJsPath: largestJs.path,
  };
  const violations = [];
  if (totalJsKb > budgets.maxTotalJsKb) {
    violations.push(`total JS ${totalJsKb}KB exceeds ${budgets.maxTotalJsKb}KB`);
  }
  if (largestJsKb > budgets.maxLargestJsKb) {
    violations.push(`largest JS ${largestJsKb}KB exceeds ${budgets.maxLargestJsKb}KB`);
  }
  if (totalCssKb > budgets.maxTotalCssKb) {
    violations.push(`total CSS ${totalCssKb}KB exceeds ${budgets.maxTotalCssKb}KB`);
  }
  if (totalAssetKb > budgets.maxTotalAssetKb) {
    violations.push(`total dist assets ${totalAssetKb}KB exceeds ${budgets.maxTotalAssetKb}KB`);
  }
  return { checked: true, ok: violations.length === 0, reason: null, totals, violations };
}

function buildReport({ skipDist }) {
  const config = readJson(CONFIG_PATH);
  const smokeText = readText(config.playwrightSmoke.path);
  const visualText = readText(config.visualBaselines.playwrightConfig);
  const missingWorkflowTokens = missingTokens(
    smokeText,
    config.playwrightSmoke.requiredWorkflowTokens,
  );
  const missingBudgetKeys = missingTokens(smokeText, config.playwrightSmoke.requiredBudgetKeys);
  const missingAccessibilityTokens = missingTokens(
    smokeText,
    config.playwrightSmoke.accessibilityContractTokens,
  );
  const missingVisualTokens = missingTokens(visualText, config.visualBaselines.requiredTokens);
  const bundle = bundleSummary(config, skipDist);
  const violations = [
    ...missingWorkflowTokens.map((token) => `cockpit smoke missing workflow token: ${token}`),
    ...missingBudgetKeys.map((token) => `cockpit smoke missing timing budget key: ${token}`),
    ...missingAccessibilityTokens.map(
      (token) => `cockpit smoke missing accessibility contract token: ${token}`,
    ),
    ...missingVisualTokens.map((token) => `playwright config missing visual token: ${token}`),
    ...bundle.violations,
  ];
  return {
    schemaVersion: 'ui-quality-budgets.v1',
    configPath: CONFIG_PATH,
    owner: config.owner,
    trackerId: config.trackerId,
    ok: violations.length === 0,
    smoke: {
      path: config.playwrightSmoke.path,
      missingWorkflowTokens,
      missingBudgetKeys,
      missingAccessibilityTokens,
    },
    visualBaselines: {
      path: config.visualBaselines.playwrightConfig,
      missingVisualTokens,
    },
    bundle,
    violations,
  };
}

function renderText(report) {
  if (report.ok) {
    const bundle = report.bundle.checked
      ? `bundle JS ${report.bundle.totals.totalJsKb}KB, largest ${report.bundle.totals.largestJsKb}KB`
      : report.bundle.reason;
    return `UI quality budgets OK (${bundle})\n`;
  }
  return `UI quality budgets failed:\n${report.violations.map((v) => `- ${v}`).join('\n')}\n`;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const report = buildReport(args);
  process.stdout.write(args.json ? `${JSON.stringify(report, null, 2)}\n` : renderText(report));
  if (!report.ok) process.exit(1);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

export { buildReport };
