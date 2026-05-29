// TEST-CQ-06 — CLI bundle-export contract walker.
//
// Why this exists:
//   PR #144 shipped `applyQualityMode is not defined` and
//   `comparePngFiles is not defined` to CI. The root cause was a code
//   extraction (`initiation-export-commands.mjs` split out of `cli.mjs`)
//   that called a handful of symbols it forgot to `import`. Those calls
//   only blow up at runtime when the offending command path executes.
//
//   This test walks every `.mjs` file under `packages/cli/lib/` and, for
//   every top-level call expression inside an exported function body,
//   verifies the callee identifier is one of:
//     (a) an imported binding in the same module,
//     (b) a top-level declaration in the same file,
//     (c) a recognised JavaScript / Node.js built-in or global, or
//     (d) a function parameter of the surrounding exported function.
//
//   The walker uses a regex-driven mini-parser (acorn is not a workspace
//   dependency of @bim-ai/cli; pulling it in just for this test would
//   widen the dep footprint). The mini-parser strips comments and string
//   literals before scanning, so the heuristic is robust enough to catch
//   the original PR-#144 class of bug without false positives against
//   currently-shipping code. If false positives surface, extend the
//   `BUILTIN_GLOBALS` allowlist near the top of this file.
//
// Regression-proof procedure (executed by the test author, recorded
// here for reviewers):
//   1. Temporarily delete the `applyQualityMode` import from
//      `packages/cli/lib/initiation-export-commands.mjs`.
//   2. Run `pnpm --filter @bim-ai/cli test`.
//   3. This test fails with a violation list that includes:
//        initiation-export-commands.mjs cmdInitiationGolden -> applyQualityMode
//        initiation-export-commands.mjs cmdInitiationCheck  -> applyQualityMode
//   4. Restore the import; the test goes green again.
//
// Cross-ref: spec/trackers/code-quality-debt-tracker.md (TEST-CQ-06).

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LIB_DIR = path.join(__dirname, 'lib');

// ─── allowlists ──────────────────────────────────────────────────────────
// JavaScript / Node.js built-ins and globals that any module may call
// without an explicit import. Keep this list tight; widening it can mask
// the bug class we are catching. When extending, prefer "official global"
// per MDN / Node docs over "common library".

const BUILTIN_GLOBALS = new Set([
  // ECMAScript globals
  'Array',
  'ArrayBuffer',
  'BigInt',
  'Boolean',
  'DataView',
  'Date',
  'Error',
  'EvalError',
  'Float32Array',
  'Float64Array',
  'Function',
  'Int16Array',
  'Int32Array',
  'Int8Array',
  'JSON',
  'Map',
  'Math',
  'Number',
  'Object',
  'Promise',
  'Proxy',
  'RangeError',
  'Reflect',
  'RegExp',
  'Set',
  'String',
  'Symbol',
  'SyntaxError',
  'TypeError',
  'URIError',
  'Uint16Array',
  'Uint32Array',
  'Uint8Array',
  'Uint8ClampedArray',
  'WeakMap',
  'WeakRef',
  'WeakSet',
  // top-level functions
  'decodeURI',
  'decodeURIComponent',
  'encodeURI',
  'encodeURIComponent',
  'isFinite',
  'isNaN',
  'parseFloat',
  'parseInt',
  'structuredClone',
  'queueMicrotask',
  // Node.js globals
  'Buffer',
  'URL',
  'URLSearchParams',
  'TextEncoder',
  'TextDecoder',
  'AbortController',
  'AbortSignal',
  'Blob',
  'Headers',
  'Request',
  'Response',
  'FormData',
  'console',
  'process',
  'fetch',
  'setTimeout',
  'setInterval',
  'setImmediate',
  'clearTimeout',
  'clearInterval',
  'clearImmediate',
  // JS keywords / control flow that the regex may pick up as call-like
  // (handled by KEYWORDS_SKIP, but harmless to allow if they slip)
]);

// JavaScript keywords / control-flow tokens. These look like calls
// (`if (...)`, `for (...)`) but are not, and the parser must skip them.
const KEYWORDS_SKIP = new Set([
  'if',
  'else',
  'for',
  'while',
  'do',
  'switch',
  'case',
  'return',
  'throw',
  'new',
  'typeof',
  'instanceof',
  'in',
  'of',
  'void',
  'delete',
  'await',
  'async',
  'function',
  'class',
  'const',
  'let',
  'var',
  'try',
  'catch',
  'finally',
  'yield',
  'this',
  'super',
  'extends',
  'import',
  'export',
  'from',
  'as',
  'default',
  'break',
  'continue',
  'with',
  'static',
  'get',
  'set',
  'true',
  'false',
  'null',
  'undefined',
  'NaN',
  'Infinity',
  // arrow-function helpers
  'constructor',
]);

// ─── source scrubbing ────────────────────────────────────────────────────

/**
 * Replaces the contents of every string literal, template literal, and
 * comment in `source` with same-length whitespace, preserving line/column
 * positions for downstream regex scanning. This stops identifiers inside
 * strings (e.g. error messages mentioning `applyQualityMode`) from being
 * mistaken for call expressions.
 */
function scrubSource(source) {
  const out = [];
  let i = 0;
  const n = source.length;
  while (i < n) {
    const c = source[i];
    const next = source[i + 1];

    // line comment
    if (c === '/' && next === '/') {
      while (i < n && source[i] !== '\n') {
        out.push(source[i] === '\n' ? '\n' : ' ');
        i++;
      }
      continue;
    }
    // block comment
    if (c === '/' && next === '*') {
      out.push(' ', ' ');
      i += 2;
      while (i < n && !(source[i] === '*' && source[i + 1] === '/')) {
        out.push(source[i] === '\n' ? '\n' : ' ');
        i++;
      }
      if (i < n) {
        out.push(' ', ' ');
        i += 2;
      }
      continue;
    }
    // single- or double-quoted string
    if (c === '"' || c === "'") {
      const quote = c;
      out.push(quote);
      i++;
      while (i < n && source[i] !== quote) {
        if (source[i] === '\\' && i + 1 < n) {
          out.push(' ', ' ');
          i += 2;
          continue;
        }
        out.push(source[i] === '\n' ? '\n' : ' ');
        i++;
      }
      if (i < n) {
        out.push(quote);
        i++;
      }
      continue;
    }
    // template literal — scrub the literal parts but RECURSIVELY keep
    // expressions inside ${ ... } since those may contain real call
    // expressions we want to analyse.
    if (c === '`') {
      out.push('`');
      i++;
      while (i < n && source[i] !== '`') {
        if (source[i] === '\\' && i + 1 < n) {
          out.push(' ', ' ');
          i += 2;
          continue;
        }
        if (source[i] === '$' && source[i + 1] === '{') {
          out.push('$', '{');
          i += 2;
          let depth = 1;
          while (i < n && depth > 0) {
            const ch = source[i];
            if (ch === '{') depth++;
            else if (ch === '}') depth--;
            if (depth === 0) break;
            // Recurse into nested strings/comments inside the expression.
            // For simplicity, push as-is — keywords + identifiers inside
            // ${} are valid call sites we want to keep.
            out.push(ch);
            i++;
          }
          if (i < n) {
            out.push('}');
            i++;
          }
          continue;
        }
        out.push(source[i] === '\n' ? '\n' : ' ');
        i++;
      }
      if (i < n) {
        out.push('`');
        i++;
      }
      continue;
    }
    out.push(c);
    i++;
  }
  return out.join('');
}

// ─── import parsing ──────────────────────────────────────────────────────

/**
 * Extracts all imported binding names from the top of an ES module.
 * Handles:
 *   import x from 'mod';
 *   import * as ns from 'mod';
 *   import { a, b as c } from 'mod';
 *   import x, { a, b } from 'mod';
 *   import 'mod';
 */
function parseImports(scrubbed) {
  const names = new Set();
  const re = /import\s+([^;]+?)\s+from\s+['"][^'"]+['"]/g;
  let m;
  while ((m = re.exec(scrubbed)) !== null) {
    const clause = m[1].trim();
    // default + namespace + named possibilities
    // strip outer braces piece by piece
    const parts = clause.split(',');
    for (const rawPart of parts) {
      let part = rawPart.trim();
      if (!part) continue;
      if (part.startsWith('{')) {
        // named import group; may span multiple commas — captured here
        // because we split on commas already, so unwrap brace tokens.
        part = part.slice(1).trim();
      }
      if (part.endsWith('}')) {
        part = part.slice(0, -1).trim();
      }
      if (part.startsWith('* as ')) {
        names.add(part.slice('* as '.length).trim());
        continue;
      }
      // `foo as bar` → binding name is `bar`
      const asMatch = /^(\S+)\s+as\s+(\S+)$/.exec(part);
      if (asMatch) {
        names.add(asMatch[2]);
        continue;
      }
      // bare identifier
      if (/^[a-zA-Z_$][\w$]*$/.test(part)) {
        names.add(part);
      }
    }
  }
  return names;
}

// ─── top-level declaration parsing ───────────────────────────────────────

/**
 * Returns the set of all top-level binding names declared in `scrubbed`.
 * Top-level means: at column 0 of a line, OR following `export ` at
 * column 0. This is a heuristic but works for the codebase's
 * Prettier-formatted modules where top-level decls always start at col 0.
 *
 * Handles:
 *   function foo()        / async function foo()
 *   export function foo() / export async function foo()
 *   const foo = …         / let / var
 *   export const foo = …  / export let / export var
 *   class Foo {}          / export class Foo
 *   export { foo, bar }   (named re-exports, treated as decls too)
 */
function parseTopLevelDeclarations(scrubbed) {
  const names = new Set();
  const lines = scrubbed.split('\n');
  for (const line of lines) {
    // Skip indented lines (not top level).
    if (/^\s/.test(line)) continue;

    // function / async function (optionally exported)
    let m =
      /^(?:export\s+)?(?:async\s+)?function\s*\*?\s*([a-zA-Z_$][\w$]*)/.exec(
        line,
      );
    if (m) {
      names.add(m[1]);
      continue;
    }
    // const / let / var (optionally exported) — may declare multiple
    m = /^(?:export\s+)?(?:const|let|var)\s+(.+)$/.exec(line);
    if (m) {
      // Take all identifiers up to the first `=` or end. Strip destructuring
      // braces and brackets, then split on commas.
      const head = m[1].split('=')[0];
      const cleaned = head.replace(/[{}[\]]/g, ' ');
      for (const tok of cleaned.split(/[,\s]+/)) {
        const id = tok.trim();
        if (/^[a-zA-Z_$][\w$]*$/.test(id)) names.add(id);
      }
      continue;
    }
    // class declarations
    m = /^(?:export\s+)?class\s+([a-zA-Z_$][\w$]*)/.exec(line);
    if (m) {
      names.add(m[1]);
      continue;
    }
  }
  // `export { foo, bar as baz }` blocks may span multiple lines; capture
  // them as decls too (the original binding name is what gets called).
  const exportBlockRe = /export\s*\{\s*([^}]+)\}/g;
  let m;
  while ((m = exportBlockRe.exec(scrubbed)) !== null) {
    for (const rawPart of m[1].split(',')) {
      const part = rawPart.trim();
      if (!part) continue;
      const asMatch = /^(\S+)\s+as\s+(\S+)$/.exec(part);
      const id = asMatch ? asMatch[1] : part;
      if (/^[a-zA-Z_$][\w$]*$/.test(id)) names.add(id);
    }
  }
  return names;
}

// ─── exported-function extraction ────────────────────────────────────────

/**
 * Returns `[{ name, body, paramNames, startLine }]` for every exported
 * top-level function in `scrubbed` (both `export function` style and
 * `function …` that is later re-exported via an `export { … }` block).
 *
 * The body is extracted by brace matching from the opening `{` of the
 * function, so it includes the full set of top-level statements.
 */
function extractExportedFunctions(scrubbed, topLevelDecls, originalSource) {
  // Collect all top-level function declarations (exported or not),
  // including their span and the binding name. We'll filter to "exported"
  // afterward by checking export-style.
  const functions = [];
  const lines = scrubbed.split('\n');
  const lineStartOffsets = [0];
  for (let i = 0; i < lines.length; i++) {
    lineStartOffsets.push(lineStartOffsets[i] + lines[i].length + 1);
  }

  // Find each top-level function declaration's exact offset.
  // Pattern: optional `export `, optional `async `, `function `, name, `(`
  const funcRe =
    /^(?<exp>export\s+)?(?:async\s+)?function\s*\*?\s*(?<name>[a-zA-Z_$][\w$]*)\s*\(/gm;
  let m;
  while ((m = funcRe.exec(scrubbed)) !== null) {
    const name = m.groups.name;
    const isExported = Boolean(m.groups.exp);
    // Find opening `(` of params from match end (m.index + matched length
    // includes the `(`).
    const parenOpenIdx = m.index + m[0].length - 1;
    // Walk to matching `)`
    let depth = 1;
    let i = parenOpenIdx + 1;
    while (i < scrubbed.length && depth > 0) {
      const c = scrubbed[i];
      if (c === '(') depth++;
      else if (c === ')') depth--;
      i++;
    }
    const parenCloseIdx = i - 1;
    const paramText = scrubbed.slice(parenOpenIdx + 1, parenCloseIdx);
    const paramNames = extractParamNames(paramText);
    // Find opening `{` of body
    let braceIdx = scrubbed.indexOf('{', parenCloseIdx + 1);
    if (braceIdx < 0) continue;
    // Walk to matching `}`
    depth = 1;
    let j = braceIdx + 1;
    while (j < scrubbed.length && depth > 0) {
      const c = scrubbed[j];
      if (c === '{') depth++;
      else if (c === '}') depth--;
      j++;
    }
    const bodyEnd = j - 1;
    const body = scrubbed.slice(braceIdx + 1, bodyEnd);
    // Compute starting line number for diagnostics (1-based).
    const startLine = scrubbed.slice(0, m.index).split('\n').length;
    functions.push({
      name,
      isExported,
      body,
      bodyOffset: braceIdx + 1,
      paramNames,
      startLine,
    });
  }
  return functions;
}

function extractParamNames(paramText) {
  const names = new Set();
  // Strip default values: everything between `=` and the next top-level
  // comma. We handle this by walking and tracking depth.
  let depth = 0;
  let inDefault = false;
  let buf = '';
  const tokens = [];
  for (let i = 0; i < paramText.length; i++) {
    const c = paramText[i];
    if (c === '(' || c === '[' || c === '{') depth++;
    else if (c === ')' || c === ']' || c === '}') depth--;
    if (depth === 0 && c === ',') {
      tokens.push(buf);
      buf = '';
      inDefault = false;
      continue;
    }
    if (depth === 0 && c === '=') {
      inDefault = true;
      continue;
    }
    if (!inDefault) buf += c;
  }
  if (buf.trim()) tokens.push(buf);
  for (const tok of tokens) {
    // Strip destructuring braces/brackets and rest spread.
    const cleaned = tok.replace(/[{}[\]]/g, ' ').replace(/\.\.\./g, ' ');
    for (const piece of cleaned.split(/[,\s:]+/)) {
      const id = piece.trim();
      if (/^[a-zA-Z_$][\w$]*$/.test(id)) names.add(id);
    }
  }
  return names;
}

// ─── function-body-local declaration extraction ─────────────────────────

/**
 * Returns the set of identifier names declared anywhere inside `body`
 * via:
 *   const x = ... / let x / var x        (and destructured forms)
 *   function x() ... / async function x()
 *
 * This is intentionally not scope-aware — any decl anywhere in the body
 * is treated as visible. The walker errs on the side of false negatives
 * for missing imports (i.e. we'd rather miss a violation than raise a
 * false positive), because the contract test must stay green on
 * currently-shipping correct code.
 */
function parseBodyLocalDeclarations(body) {
  const names = new Set();
  const lines = body.split('\n');
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    // function / async function
    let m =
      /^(?:async\s+)?function\s*\*?\s*([a-zA-Z_$][\w$]*)/.exec(line);
    if (m) {
      names.add(m[1]);
      continue;
    }
    // const / let / var declarations — may declare multiple names,
    // possibly destructured.
    m = /^(?:const|let|var)\s+(.+)$/.exec(line);
    if (m) {
      const head = m[1].split('=')[0];
      const cleaned = head.replace(/[{}[\]]/g, ' ').replace(/\.\.\./g, ' ');
      for (const tok of cleaned.split(/[,\s:]+/)) {
        const id = tok.trim();
        if (/^[a-zA-Z_$][\w$]*$/.test(id)) names.add(id);
      }
      continue;
    }
    // `for (const x of …)` style — bind loop variable as local.
    m = /^for\s*\(\s*(?:const|let|var)\s+(.+?)\s+(?:of|in)\s/.exec(line);
    if (m) {
      const cleaned = m[1].replace(/[{}[\]]/g, ' ').replace(/\.\.\./g, ' ');
      for (const tok of cleaned.split(/[,\s:]+/)) {
        const id = tok.trim();
        if (/^[a-zA-Z_$][\w$]*$/.test(id)) names.add(id);
      }
      continue;
    }
    // `} catch (err) {` style — bind catch parameter.
    m = /catch\s*\(\s*([a-zA-Z_$][\w$]*)\s*\)/.exec(line);
    if (m) names.add(m[1]);
  }
  return names;
}

// ─── call-expression extraction ──────────────────────────────────────────

/**
 * Returns an array of `{ callee, line }` for every call expression in
 * `body` whose callee is a bare identifier (i.e. NOT `obj.method(...)`).
 * `bodyOffset` is the absolute offset of `body` within the original
 * scrubbed source, used to recover line numbers.
 *
 * `body` is already scrubbed (strings/comments blanked).
 */
function extractCalls(body, bodyOffset, fullScrubbed) {
  const out = [];
  // Match `identifier(` not preceded by `.` (member access) or `?.`
  // (optional chaining). We use a lookbehind-friendly pattern via a
  // capturing prefix.
  const re = /(^|[^.\w$])([a-zA-Z_$][\w$]*)\s*\(/g;
  let m;
  while ((m = re.exec(body)) !== null) {
    const callee = m[2];
    if (KEYWORDS_SKIP.has(callee)) continue;
    // The match start within the body:
    const idStartInBody = m.index + m[1].length;
    const absoluteOffset = bodyOffset + idStartInBody;
    const line = fullScrubbed.slice(0, absoluteOffset).split('\n').length;
    out.push({ callee, line });
  }
  return out;
}

// ─── per-file analysis ───────────────────────────────────────────────────

async function analyseFile(absPath) {
  const original = await fs.readFile(absPath, 'utf8');
  const scrubbed = scrubSource(original);
  const imports = parseImports(scrubbed);
  const topLevelDecls = parseTopLevelDeclarations(scrubbed);
  const functions = extractExportedFunctions(scrubbed, topLevelDecls, original);

  // Determine which functions are "exported": either annotated with
  // `export ` at decl site, OR named in an `export { ... }` block.
  const exportBlockNames = new Set();
  const exportBlockRe = /export\s*\{\s*([^}]+)\}/g;
  let m;
  while ((m = exportBlockRe.exec(scrubbed)) !== null) {
    for (const rawPart of m[1].split(',')) {
      const part = rawPart.trim();
      if (!part) continue;
      const asMatch = /^(\S+)\s+as\s+(\S+)$/.exec(part);
      const id = asMatch ? asMatch[1] : part;
      if (/^[a-zA-Z_$][\w$]*$/.test(id)) exportBlockNames.add(id);
    }
  }

  const violations = [];
  for (const fn of functions) {
    const isExported = fn.isExported || exportBlockNames.has(fn.name);
    if (!isExported) continue;
    const bodyLocals = parseBodyLocalDeclarations(fn.body);
    const calls = extractCalls(fn.body, fn.bodyOffset, scrubbed);
    for (const { callee, line } of calls) {
      if (imports.has(callee)) continue;
      if (topLevelDecls.has(callee)) continue;
      if (BUILTIN_GLOBALS.has(callee)) continue;
      if (fn.paramNames.has(callee)) continue;
      if (bodyLocals.has(callee)) continue;
      violations.push({
        file: path.basename(absPath),
        fn: fn.name,
        callee,
        line,
      });
    }
  }
  return violations;
}

// ─── test ────────────────────────────────────────────────────────────────

test('every exported function in packages/cli/lib/*.mjs only calls imported, declared, or built-in identifiers', async () => {
  const entries = await fs.readdir(LIB_DIR);
  const mjsFiles = entries
    .filter((entry) => entry.endsWith('.mjs'))
    .map((entry) => path.join(LIB_DIR, entry));
  assert.ok(mjsFiles.length > 0, `expected at least one .mjs file under ${LIB_DIR}`);

  const allViolations = [];
  for (const filePath of mjsFiles) {
    const violations = await analyseFile(filePath);
    allViolations.push(...violations);
  }

  if (allViolations.length > 0) {
    const grouped = allViolations
      .map((v) => `  ${v.file}:${v.line}  ${v.fn} -> ${v.callee}`)
      .join('\n');
    assert.fail(
      `Found ${allViolations.length} undefined-callee violation(s) in packages/cli/lib/*.mjs.\n` +
        `Each row is "file:line  exportedFn -> callee".\n` +
        `Callee is not in: imports, top-level decls, function params, or the JS/Node built-in allowlist.\n` +
        `This is the TEST-CQ-06 class of bug (e.g. PR #144's applyQualityMode / comparePngFiles).\n` +
        `Either add the missing import, declare the name locally, or — if it really is a global — extend BUILTIN_GLOBALS in this test file.\n\n` +
        grouped,
    );
  }
});
