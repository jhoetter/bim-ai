#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');
const SETUP_PATH = 'packages/web/src/test/setup.ts';

const BROWSER_ONLY_PATTERNS = [
  {
    code: 'real_webgl_renderer_in_vitest',
    pattern: /\bnew\s+(?:THREE\.)?WebGLRenderer\s*\(/g,
    detail: 'Real WebGLRenderer construction belongs in Playwright/browser tests.',
  },
  {
    code: 'render_target_pixel_readback_in_vitest',
    pattern: /\breadRenderTargetPixels\s*\(/g,
    detail: 'Pixel readback belongs in Playwright/browser tests.',
  },
  {
    code: 'playwright_screenshot_in_vitest',
    pattern: /\b(?:page\.)?screenshot\s*\(/g,
    detail: 'Screenshot evidence belongs under packages/web/e2e.',
  },
  {
    code: 'playwright_to_have_screenshot_in_vitest',
    pattern: /\btoHaveScreenshot\s*\(/g,
    detail: 'Screenshot assertions belong under packages/web/e2e.',
  },
];

function parseArgs(argv) {
  const args = { json: false };
  for (const arg of argv) {
    if (arg === '--') continue;
    if (arg === '--json') args.json = true;
    else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return args;
}

function printHelp() {
  console.log(`Usage: node scripts/check-frontend-test-environments.mjs [--json]

Checks that Vitest/jsdom tests do not construct real browser rendering surfaces
and that the shared jsdom setup owns canvas mocking/noise policy.`);
}

function runGit(args) {
  const result = spawnSync('git', args, { cwd: REPO_ROOT, encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(`git ${args.join(' ')} failed: ${result.stderr || result.stdout}`);
  }
  return result.stdout;
}

function trackedFiles() {
  return runGit(['ls-files'])
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

function readText(path) {
  return readFileSync(join(REPO_ROOT, path), 'utf8');
}

function isVitestPath(path) {
  return (
    path.startsWith('packages/web/src/') &&
    /\.(?:test|spec)\.[tj]sx?$/.test(path) &&
    path !== SETUP_PATH
  );
}

function isPlaywrightPath(path) {
  return path.startsWith('packages/web/e2e/') && /\.spec\.ts$/.test(path);
}

function lineStarts(text) {
  const starts = [0];
  for (let index = 0; index < text.length; index += 1) {
    if (text[index] === '\n') starts.push(index + 1);
  }
  return starts;
}

function locationForIndex(starts, index) {
  let low = 0;
  let high = starts.length - 1;
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    if (starts[mid] <= index) low = mid + 1;
    else high = mid - 1;
  }
  return { line: high + 1, column: index - starts[high] + 1 };
}

function scanVitestFiles(files) {
  const violations = [];
  for (const path of files.filter(isVitestPath)) {
    const text = readText(path);
    const starts = lineStarts(text);
    for (const rule of BROWSER_ONLY_PATTERNS) {
      for (const match of text.matchAll(rule.pattern)) {
        violations.push({
          code: rule.code,
          path,
          ...locationForIndex(starts, match.index ?? 0),
          detail: rule.detail,
        });
      }
    }
  }
  violations.sort((a, b) => a.path.localeCompare(b.path) || a.line - b.line);
  return violations;
}

function setupPolicy() {
  const text = readText(SETUP_PATH);
  return {
    path: SETUP_PATH,
    hasCanvasMock: text.includes('installCanvasContextMock'),
    rejectsNon2dCanvas: text.includes("type !== '2d'") && text.includes('return null'),
    failsJsdomCanvasNoise: text.includes('HTMLCanvasElement.prototype.getContext'),
  };
}

function buildReport() {
  const files = trackedFiles();
  const violations = scanVitestFiles(files);
  const setup = setupPolicy();
  const playwrightFiles = files.filter(isPlaywrightPath);
  const pass =
    violations.length === 0 &&
    setup.hasCanvasMock &&
    setup.rejectsNon2dCanvas &&
    setup.failsJsdomCanvasNoise &&
    playwrightFiles.length > 0;
  return {
    schemaVersion: 'frontend-test-environments.v1',
    vitestJsdom: {
      checkedFileCount: files.filter(isVitestPath).length,
      violations,
    },
    setup,
    playwright: {
      browserSpecCount: playwrightFiles.length,
      browserSpecs: playwrightFiles,
    },
    pass,
  };
}

function renderMarkdown(report) {
  const lines = [];
  lines.push('# Frontend Test Environment Report');
  lines.push('');
  lines.push(
    `Result: **${report.pass ? 'pass' : 'fail'}**; Vitest files ${report.vitestJsdom.checkedFileCount}; browser specs ${report.playwright.browserSpecCount}; violations ${report.vitestJsdom.violations.length}.`,
  );
  lines.push('');
  lines.push('| Code | Location | Detail |');
  lines.push('| ---- | -------- | ------ |');
  for (const violation of report.vitestJsdom.violations) {
    lines.push(
      `| ${violation.code} | ${violation.path}:${violation.line}:${violation.column} | ${escapeCell(violation.detail)} |`,
    );
  }
  if (report.vitestJsdom.violations.length === 0) lines.push('| - | - | - |');
  lines.push('');
  return `${lines.join('\n')}\n`;
}

function escapeCell(value) {
  return String(value).replaceAll('|', '\\|').replaceAll('\n', ' ');
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const report = buildReport();
  process.stdout.write(args.json ? `${JSON.stringify(report, null, 2)}\n` : renderMarkdown(report));
  if (!report.pass) process.exit(1);
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
