import { gzipSync } from 'node:zlib';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const distDir = path.join(root, 'packages', 'web', 'dist');
const indexHtmlPath = path.join(distDir, 'index.html');

const budgets = {
  entryJsGzipBytes: 200 * 1024,
  largestJsGzipBytes: 750 * 1024,
  totalJsGzipBytes: 1_500 * 1024,
};

function fail(message) {
  console.error(`[bundle-budget] ${message}`);
  process.exit(1);
}

function walkFiles(dir) {
  const files = [];
  for (const name of readdirSync(dir)) {
    const fullPath = path.join(dir, name);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      files.push(...walkFiles(fullPath));
    } else {
      files.push(fullPath);
    }
  }
  return files;
}

function gzipBytes(filePath) {
  return gzipSync(readFileSync(filePath)).byteLength;
}

if (!statSync(distDir, { throwIfNoEntry: false })?.isDirectory()) {
  fail(`missing ${path.relative(root, distDir)}; run pnpm --filter @bim-ai/web build first`);
}
if (!statSync(indexHtmlPath, { throwIfNoEntry: false })?.isFile()) {
  fail(`missing ${path.relative(root, indexHtmlPath)}; Vite build output is incomplete`);
}

const indexHtml = readFileSync(indexHtmlPath, 'utf8');
const entryMatch = indexHtml.match(/<script[^>]+type="module"[^>]+src="([^"]+\.js)"/);
if (!entryMatch) {
  fail('could not identify the module entry script in dist/index.html');
}

const entryPath = path.join(distDir, entryMatch[1].replace(/^\//, ''));
const jsFiles = walkFiles(distDir).filter((file) => file.endsWith('.js'));
if (jsFiles.length === 0) {
  fail('no JavaScript chunks found in packages/web/dist');
}

const chunks = jsFiles
  .map((file) => ({
    file: path.relative(root, file),
    bytes: statSync(file).size,
    gzipBytes: gzipBytes(file),
  }))
  .sort((a, b) => b.gzipBytes - a.gzipBytes);

const entry = chunks.find((chunk) => path.resolve(root, chunk.file) === entryPath);
if (!entry) {
  fail(`entry chunk ${path.relative(root, entryPath)} was not found in dist assets`);
}

const totalJsGzipBytes = chunks.reduce((sum, chunk) => sum + chunk.gzipBytes, 0);
const largest = chunks[0];
const report = {
  format: 'bimAiBundleBudget_v1',
  budgets,
  entry,
  largest,
  totalJsGzipBytes,
  chunkCount: chunks.length,
  topChunks: chunks.slice(0, 8),
};

console.log(JSON.stringify(report, null, 2));

const failures = [];
if (entry.gzipBytes > budgets.entryJsGzipBytes) {
  failures.push(`entry gzip ${entry.gzipBytes} > ${budgets.entryJsGzipBytes}`);
}
if (largest.gzipBytes > budgets.largestJsGzipBytes) {
  failures.push(`largest chunk gzip ${largest.gzipBytes} > ${budgets.largestJsGzipBytes}`);
}
if (totalJsGzipBytes > budgets.totalJsGzipBytes) {
  failures.push(`total JS gzip ${totalJsGzipBytes} > ${budgets.totalJsGzipBytes}`);
}

if (failures.length > 0) {
  fail(failures.join('; '));
}
