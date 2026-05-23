/**
 * PERF-I06: audit `new THREE.*` allocations across the viewport
 * mesh builders + Viewport.tsx and report candidates for shared
 * geometry / material caches.
 *
 * Outputs are mirrored after the PERF-G01 elementsById inventory:
 * - JSON at spec/generated/three-allocations-inventory.json
 * - Markdown at spec/generated/three-allocations-inventory.md
 *
 * High-severity patterns indicate allocations inside loops or build
 * functions called per-element (likely sharable). Medium-severity is
 * single-call-site allocation (less likely to repeat).
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const scanRoots = [
  path.join(root, 'packages', 'web', 'src', 'viewport'),
  path.join(root, 'packages', 'web', 'src', 'Viewport.tsx'),
];

const patterns = [
  {
    id: 'material_alloc',
    severity: 'high',
    regex:
      /new THREE\.(MeshStandardMaterial|MeshBasicMaterial|MeshLambertMaterial|MeshPhongMaterial|LineBasicMaterial|LineDashedMaterial|PointsMaterial|SpriteMaterial|ShaderMaterial|ShadowMaterial)/g,
  },
  {
    id: 'geometry_alloc',
    severity: 'high',
    regex:
      /new THREE\.(BoxGeometry|SphereGeometry|CylinderGeometry|ConeGeometry|PlaneGeometry|CircleGeometry|TorusGeometry|TetrahedronGeometry|OctahedronGeometry|IcosahedronGeometry|DodecahedronGeometry|RingGeometry|BufferGeometry)/g,
  },
  {
    id: 'texture_alloc',
    severity: 'medium',
    regex: /new THREE\.(Texture|CanvasTexture|DataTexture|VideoTexture)/g,
  },
];

function parseArgs(argv) {
  const out = { json: null, md: null };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--out-json') out.json = argv[++i];
    else if (arg === '--out-md') out.md = argv[++i];
  }
  return out;
}

function walk(target) {
  const stat = statSync(target);
  if (stat.isFile())
    return /\.(ts|tsx)$/.test(target) && !/\.(test|spec)\.(ts|tsx)$/.test(target) ? [target] : [];
  const files = [];
  for (const name of readdirSync(target)) {
    files.push(...walk(path.join(target, name)));
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
  for (const scanRoot of scanRoots) {
    for (const file of walk(scanRoot)) {
      const source = readFileSync(file, 'utf8');
      for (const pattern of patterns) {
        for (const match of source.matchAll(pattern.regex)) {
          matches.push({
            patternId: pattern.id,
            severity: pattern.severity,
            kind: match[1],
            file: path.relative(root, file),
            line: lineNumberAt(source, match.index ?? 0),
            snippet: match[0],
          });
        }
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
  const countsByKind = matches.reduce((acc, match) => {
    acc[match.kind] = (acc[match.kind] ?? 0) + 1;
    return acc;
  }, {});
  return {
    format: 'bimAiThreeAllocationsInventory_v1',
    scannedRoots: scanRoots.map((r) => path.relative(root, r)),
    countsByPattern,
    countsByKind,
    totalCount: matches.length,
    matches,
  };
}

function toMarkdown(report) {
  const lines = [
    '# THREE.js allocation inventory (PERF-I06)',
    '',
    `Scanned roots: ${report.scannedRoots.map((r) => `\`${r}\``).join(', ')}`,
    `Total allocations: \`${report.totalCount}\``,
    '',
    '## By pattern',
    '',
    '| Pattern | Count |',
    '| ------- | ----: |',
    ...Object.entries(report.countsByPattern).map(
      ([pattern, count]) => `| \`${pattern}\` | ${count} |`,
    ),
    '',
    '## By kind',
    '',
    '| Kind | Count |',
    '| ---- | ----: |',
    ...Object.entries(report.countsByKind)
      .sort((a, b) => b[1] - a[1])
      .map(([kind, count]) => `| \`${kind}\` | ${count} |`),
    '',
    '## Per-call-site',
    '',
    '| Severity | Kind | Location |',
    '| -------- | ---- | -------- |',
    ...report.matches.map(
      (match) => `| ${match.severity} | \`${match.kind}\` | \`${match.file}:${match.line}\` |`,
    ),
    '',
  ];
  return `${lines.join('\n')}\n`;
}

const args = parseArgs(process.argv.slice(2));
const report = inventory();
if (args.json) {
  writeFileSync(path.resolve(root, args.json), `${JSON.stringify(report, null, 2)}\n`);
}
if (args.md) {
  writeFileSync(path.resolve(root, args.md), toMarkdown(report));
}
console.log(`THREE allocations: ${report.totalCount}`);
console.log(`  by pattern: ${JSON.stringify(report.countsByPattern)}`);
console.log(
  `  top kinds: ${JSON.stringify(
    Object.fromEntries(
      Object.entries(report.countsByKind)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5),
    ),
  )}`,
);
