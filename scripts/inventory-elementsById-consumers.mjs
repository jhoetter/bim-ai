import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const srcRoot = path.join(root, 'packages', 'web', 'src');

const patterns = [
  {
    id: 'store_selector_elementsById',
    severity: 'high',
    regex: /useBimStore\s*\(\s*\(?\s*\w+\s*\)?\s*=>[^)]*\.elementsById/g,
  },
  {
    id: 'store_getstate_elementsById',
    severity: 'medium',
    regex: /useBimStore\.getState\(\)\.elementsById/g,
  },
  {
    id: 'object_values_elementsById',
    severity: 'high',
    regex: /Object\.values\(\s*(?:\w+\.)?elementsById\s*\)/g,
  },
  {
    id: 'object_values_elements',
    severity: 'medium',
    regex: /Object\.values\(\s*(?:props\.)?elements\s*\)/g,
  },
];

function parseArgs(argv) {
  const out = { json: null, md: null, failAboveHigh: null };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--out-json') out.json = argv[++i];
    else if (arg === '--out-md') out.md = argv[++i];
    else if (arg === '--fail-high-above') out.failAboveHigh = Number(argv[++i]);
  }
  return out;
}

function walk(dir) {
  const files = [];
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      files.push(...walk(full));
    } else if (/\.(ts|tsx)$/.test(name) && !/\.(test|spec)\.(ts|tsx)$/.test(name)) {
      files.push(full);
    }
  }
  return files;
}

function lineNumberAt(source, index) {
  let line = 1;
  for (let i = 0; i < index; i += 1) {
    if (source.charCodeAt(i) === 10) line += 1;
  }
  return line;
}

function inventory() {
  const matches = [];
  for (const file of walk(srcRoot)) {
    const source = readFileSync(file, 'utf8');
    for (const pattern of patterns) {
      for (const match of source.matchAll(pattern.regex)) {
        matches.push({
          patternId: pattern.id,
          severity: pattern.severity,
          file: path.relative(root, file),
          line: lineNumberAt(source, match.index ?? 0),
          snippet: match[0].replace(/\s+/g, ' ').slice(0, 160),
        });
      }
    }
  }
  matches.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);
  const countsByPattern = Object.fromEntries(
    patterns.map((pattern) => [
      pattern.id,
      matches.filter((match) => match.patternId === pattern.id).length,
    ]),
  );
  const highCount = matches.filter((match) => match.severity === 'high').length;
  return {
    format: 'bimAiElementsByIdInventory_v1',
    scannedRoot: path.relative(root, srcRoot),
    countsByPattern,
    highCount,
    totalCount: matches.length,
    matches,
  };
}

function toMarkdown(report) {
  const lines = [
    '# elementsById Consumer Inventory',
    '',
    `Scanned root: \`${report.scannedRoot}\``,
    `Total matches: \`${report.totalCount}\``,
    `High severity matches: \`${report.highCount}\``,
    '',
    '| Pattern | Count |',
    '| ------- | ----: |',
    ...Object.entries(report.countsByPattern).map(
      ([pattern, count]) => `| \`${pattern}\` | ${count} |`,
    ),
    '',
    '| Severity | Pattern | Location | Snippet |',
    '| -------- | ------- | -------- | ------- |',
    ...report.matches.map(
      (match) =>
        `| ${match.severity} | \`${match.patternId}\` | \`${match.file}:${match.line}\` | \`${match.snippet.replaceAll('`', "'")}\` |`,
    ),
    '',
  ];
  return `${lines.join('\n')}\n`;
}

const args = parseArgs(process.argv.slice(2));
const report = inventory();
if (args.json) {
  const outPath = path.resolve(root, args.json);
  writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`);
}
if (args.md) {
  const outPath = path.resolve(root, args.md);
  writeFileSync(outPath, toMarkdown(report));
}
console.log(JSON.stringify(report, null, 2));

if (args.failAboveHigh !== null && report.highCount > args.failAboveHigh) {
  console.error(
    `[elementsById-inventory] high severity count ${report.highCount} exceeds ${args.failAboveHigh}`,
  );
  process.exit(1);
}
