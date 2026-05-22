#!/usr/bin/env node

import { existsSync, readFileSync } from 'node:fs';
import { dirname, extname, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');
const TODAY = process.env.SECURITY_HYGIENE_TODAY ?? new Date().toISOString().slice(0, 10);
const WAIVERS_PATH = 'spec/security-waivers.json';

const TEXT_EXTENSIONS = new Set([
  '.cjs',
  '.css',
  '.env',
  '.html',
  '.js',
  '.json',
  '.jsx',
  '.md',
  '.mjs',
  '.py',
  '.toml',
  '.ts',
  '.tsx',
  '.txt',
  '.yaml',
  '.yml',
]);

const SKIP_PATTERNS = [
  /^app\/uv\.lock$/,
  /^pnpm-lock\.yaml$/,
  /^spec\/generated\//,
  /^spec\/archive\//,
  /^packages\/[^/]+\/dist\//,
  /^packages\/[^/]+\/coverage\//,
  /^packages\/web\/playwright-report\//,
  /^packages\/web\/test-results\//,
];

const SECRET_PATTERNS = [
  {
    code: 'private_key_material',
    severity: 'P0',
    pattern: new RegExp('-----BEGIN (?:RSA |DSA |EC |OPENSSH |PGP )?' + 'PRIVATE KEY-----', 'g'),
  },
  {
    code: 'aws_access_key_id',
    severity: 'P0',
    pattern: /\bAKIA[0-9A-Z]{16}\b/g,
  },
  {
    code: 'github_personal_access_token',
    severity: 'P0',
    pattern: /\bghp_[A-Za-z0-9_]{36,}\b/g,
  },
  {
    code: 'slack_token',
    severity: 'P0',
    pattern: /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/g,
  },
];

const HISTORY_SECRET_PATTERNS = [
  {
    code: 'history_private_key_material',
    severity: 'P0',
    pattern: new RegExp('-----BEGIN .*' + 'PRIVATE KEY-----'),
  },
  {
    code: 'history_aws_access_key_id',
    severity: 'P0',
    pattern: /\bAKIA[0-9A-Z]{16}\b/,
  },
  {
    code: 'history_github_personal_access_token',
    severity: 'P0',
    pattern: /\bghp_[A-Za-z0-9_]{36,}\b/,
  },
  {
    code: 'history_slack_token',
    severity: 'P0',
    pattern: /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/,
  },
];

const ENV_SECRET_RE =
  /\b(AWS_SECRET_ACCESS_KEY|OPENAI_API_KEY|ANTHROPIC_API_KEY|HOF_SUBAPP_JWT_SECRET)\s*=\s*['"]?([^'"\s#]+)/g;
const PLACEHOLDER_VALUE_RE =
  /^(example|placeholder|changeme|change-me|dummy|test|unset|your_|<|\$\{|\.\.\.)/i;

const BROWSER_UNSAFE_PATTERNS = [
  {
    code: 'react_dangerously_set_inner_html',
    severity: 'P1',
    pattern: /dangerouslySetInnerHTML/g,
  },
  {
    code: 'dom_inner_html_assignment',
    severity: 'P1',
    pattern: /\.innerHTML\s*=/g,
  },
  {
    code: 'dynamic_eval',
    severity: 'P1',
    pattern: /\beval\s*\(/g,
  },
  {
    code: 'dynamic_function_constructor',
    severity: 'P1',
    pattern: /\bnew\s+Function\s*\(/g,
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
  console.log(`Usage: node scripts/check-security-hygiene.mjs [--json]

Scans tracked repository files for high-signal secret patterns and browser
dangerous APIs. Intentional exceptions must be listed in ${WAIVERS_PATH} with
owner, reason, expiry, trackerId, and replacementPlan.`);
}

function runGit(args) {
  const result = spawnSync('git', args, { cwd: REPO_ROOT, encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(`git ${args.join(' ')} failed: ${result.stderr || result.stdout}`);
  }
  return result.stdout;
}

function runGitAllowNoMatches(args) {
  const result = spawnSync('git', args, { cwd: REPO_ROOT, encoding: 'utf8', timeout: 10_000 });
  if (result.signal) return '';
  if (result.status !== 0 && result.status !== 1) {
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

function shouldScan(path) {
  if (SKIP_PATTERNS.some((pattern) => pattern.test(path))) return false;
  const ext = extname(path);
  if (TEXT_EXTENSIONS.has(ext)) return true;
  return path.includes('.env');
}

function readText(path) {
  return readFileSync(join(REPO_ROOT, path), 'utf8');
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
  const line = high + 1;
  const column = index - starts[high] + 1;
  return { line, column };
}

function lineTextAt(text, starts, line) {
  const start = starts[line - 1] ?? 0;
  const next = starts[line] ?? text.length + 1;
  return text.slice(start, next).trim();
}

function isCommentOnlyLine(line) {
  return (
    line.startsWith('//') ||
    line.startsWith('*') ||
    line.startsWith('/*') ||
    line.startsWith('#') ||
    line.startsWith('<!--')
  );
}

function makeFinding({ code, severity, path, line, column, match, detail }) {
  return {
    code,
    severity,
    path,
    line,
    column,
    match: sanitizeMatch(match),
    detail,
  };
}

function sanitizeMatch(match) {
  if (match.length <= 12) return match;
  return `${match.slice(0, 6)}...${match.slice(-4)}`;
}

function scanFiles(files) {
  const findings = [];
  for (const path of files) {
    if (!shouldScan(path)) continue;
    let text;
    try {
      text = readText(path);
    } catch {
      continue;
    }
    const starts = lineStarts(text);
    for (const rule of SECRET_PATTERNS) {
      for (const match of text.matchAll(rule.pattern)) {
        const loc = locationForIndex(starts, match.index ?? 0);
        findings.push(
          makeFinding({
            code: rule.code,
            severity: rule.severity,
            path,
            ...loc,
            match: match[0],
            detail: 'High-signal credential pattern found in a tracked file.',
          }),
        );
      }
    }
    for (const match of text.matchAll(ENV_SECRET_RE)) {
      const value = match[2] ?? '';
      if (PLACEHOLDER_VALUE_RE.test(value)) continue;
      const loc = locationForIndex(starts, match.index ?? 0);
      findings.push(
        makeFinding({
          code: 'env_secret_assignment',
          severity: 'P0',
          path,
          ...loc,
          match: match[0],
          detail: `${match[1]} appears to be assigned a concrete value.`,
        }),
      );
    }
    if (path.startsWith('packages/web/src/') && !isTestPath(path)) {
      for (const rule of BROWSER_UNSAFE_PATTERNS) {
        for (const match of text.matchAll(rule.pattern)) {
          const loc = locationForIndex(starts, match.index ?? 0);
          const line = lineTextAt(text, starts, loc.line);
          if (isCommentOnlyLine(line)) continue;
          findings.push(
            makeFinding({
              code: rule.code,
              severity: rule.severity,
              path,
              ...loc,
              match: match[0],
              detail: 'Browser-dangerous API requires explicit security review.',
            }),
          );
        }
      }
    }
  }
  findings.sort((a, b) => {
    const severity = severityRank(a.severity) - severityRank(b.severity);
    if (severity !== 0) return severity;
    return a.path.localeCompare(b.path) || a.line - b.line || a.code.localeCompare(b.code);
  });
  return findings;
}

function scanHistory() {
  const findings = [];
  const excludePaths = [
    ':(exclude)scripts/check-security-hygiene.mjs',
    ':(exclude)spec/security-waivers.json',
    ':(exclude)spec/methodology/security-dependency-policy.md',
  ];
  const result = spawnSync(
    'git',
    ['log', '--all', '--max-count=75', '--patch', '--no-ext-diff', '--', '.', ...excludePaths],
    { cwd: REPO_ROOT, encoding: 'utf8', timeout: 10_000, maxBuffer: 50 * 1024 * 1024 },
  );
  if (result.signal) return findings;
  if (result.status !== 0) {
    throw new Error(`git log history probe failed: ${result.stderr || result.stdout}`);
  }
  let commit = null;
  const seen = new Set();
  for (const line of result.stdout.split('\n')) {
    const commitMatch = line.match(/^commit ([0-9a-f]{40})$/);
    if (commitMatch) {
      commit = commitMatch[1];
      continue;
    }
    if (!commit) continue;
    for (const rule of HISTORY_SECRET_PATTERNS) {
      if (!rule.pattern.test(line)) continue;
      const key = `${rule.code}:${commit}`;
      if (seen.has(key)) continue;
      seen.add(key);
      findings.push({
        code: rule.code,
        severity: rule.severity,
        commit,
        detail: 'High-signal credential pattern found in git history.',
      });
    }
  }
  findings.sort((a, b) => a.code.localeCompare(b.code) || a.commit.localeCompare(b.commit));
  return findings;
}

function isTestPath(path) {
  return (
    /\.test\.[tj]sx?$/.test(path) ||
    /\.spec\.[tj]sx?$/.test(path) ||
    path.includes('/__tests__/') ||
    path.includes('/tests/')
  );
}

function severityRank(severity) {
  return severity === 'P0' ? 0 : severity === 'P1' ? 1 : severity === 'P2' ? 2 : 3;
}

function loadWaivers() {
  if (!existsSync(join(REPO_ROOT, WAIVERS_PATH))) {
    return { path: WAIVERS_PATH, waivers: [], active: [], expired: [], missing: true, invalid: [] };
  }
  const parsed = JSON.parse(readText(WAIVERS_PATH));
  const waivers = Array.isArray(parsed.waivers) ? parsed.waivers : [];
  const today = new Date(`${TODAY}T00:00:00Z`);
  const active = [];
  const expired = [];
  const invalid = [];
  for (const waiver of waivers) {
    const missing = [
      'id',
      'check',
      'code',
      'path',
      'owner',
      'reason',
      'trackerId',
      'created',
      'expires',
      'severity',
      'replacementPlan',
    ].filter((key) => typeof waiver[key] !== 'string' || waiver[key].trim() === '');
    if (missing.length > 0) {
      invalid.push({ id: waiver.id ?? '(missing id)', missing });
      continue;
    }
    const daysUntilExpiry = Math.floor(
      (new Date(`${waiver.expires}T00:00:00Z`) - today) / 86_400_000,
    );
    const row = { ...waiver, daysUntilExpiry };
    if (daysUntilExpiry < 0) expired.push(row);
    else active.push(row);
  }
  return { path: WAIVERS_PATH, waivers, active, expired, missing: false, invalid };
}

function waiverMatchesFinding(waiver, finding) {
  if (waiver.check !== 'security-hygiene') return false;
  if (waiver.code !== finding.code) return false;
  if (waiver.path !== finding.path) return false;
  if (typeof waiver.line === 'number' && waiver.line !== finding.line) return false;
  if (typeof waiver.match === 'string' && waiver.match !== finding.match) return false;
  return true;
}

function classifyFindings(findings, waivers) {
  return findings.map((finding) => {
    const waiver = waivers.active.find((candidate) => waiverMatchesFinding(candidate, finding));
    return waiver
      ? { ...finding, waiverId: waiver.id, waived: true }
      : { ...finding, waived: false };
  });
}

function buildReport() {
  const waivers = loadWaivers();
  const findings = classifyFindings(scanFiles(trackedFiles()), waivers);
  const historyFindings = scanHistory();
  const unwaivedFindings = findings.filter((finding) => !finding.waived);
  const blockingWaiverErrors = [...waivers.expired, ...waivers.invalid];
  return {
    schemaVersion: 'security-hygiene.v1',
    generatedAt: `${TODAY}T00:00:00.000Z`,
    waivers: {
      path: waivers.path,
      activeCount: waivers.active.length,
      expiredCount: waivers.expired.length,
      invalidCount: waivers.invalid.length,
      active: waivers.active,
      expired: waivers.expired,
      invalid: waivers.invalid,
    },
    findings: {
      total: findings.length,
      waived: findings.filter((finding) => finding.waived).length,
      unwaived: unwaivedFindings.length,
      rows: findings,
    },
    historyFindings: {
      total: historyFindings.length,
      rows: historyFindings,
    },
    pass:
      unwaivedFindings.length === 0 &&
      historyFindings.length === 0 &&
      blockingWaiverErrors.length === 0,
  };
}

function renderMarkdown(report) {
  const lines = [];
  lines.push('# Security Hygiene Report');
  lines.push('');
  lines.push(`Generated: ${report.generatedAt}`);
  lines.push('');
  lines.push(
    `Result: **${report.pass ? 'pass' : 'fail'}**; findings ${report.findings.total}; unwaived ${report.findings.unwaived}; history findings ${report.historyFindings.total}; active waivers ${report.waivers.activeCount}; expired waivers ${report.waivers.expiredCount}; invalid waivers ${report.waivers.invalidCount}.`,
  );
  lines.push('');
  lines.push('| Severity | Code | Waiver | Location | Detail |');
  lines.push('| -------- | ---- | ------ | -------- | ------ |');
  for (const row of report.findings.rows) {
    lines.push(
      `| ${row.severity} | ${row.code} | ${row.waiverId ?? '-'} | ${row.path}:${row.line}:${row.column} | ${escapeCell(row.detail)} |`,
    );
  }
  if (report.findings.rows.length === 0) lines.push('| - | - | - | - | - |');
  lines.push('');
  lines.push('## History Secret Probe');
  lines.push('');
  lines.push('| Severity | Code | Commit | Detail |');
  lines.push('| -------- | ---- | ------ | ------ |');
  for (const row of report.historyFindings.rows) {
    lines.push(`| ${row.severity} | ${row.code} | ${row.commit} | ${escapeCell(row.detail)} |`);
  }
  if (report.historyFindings.rows.length === 0) lines.push('| - | - | - | - |');
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
