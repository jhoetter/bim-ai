#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const ROOT = process.cwd();
const UNKNOWN = 'unknown';

const SOURCES = {
  commands: 'app/bim_ai/commands.py',
  apiRegistry: 'app/bim_ai/api/registry.py',
  apiRoutesGlob: 'app/bim_ai/routes_*.py',
  cmdk: 'packages/web/src/cmdPalette/defaultCommands.ts',
  capabilities: 'packages/web/src/workspace/commandCapabilities.ts',
  toolRegistry: 'packages/web/src/tools/toolRegistry.ts',
  seedDsl: 'packages/cli/lib/seed-dsl.mjs',
  queryResolve: 'app/bim_ai/query_resolve.py',
  semanticAuthoring: 'app/bim_ai/semantic_authoring.py',
  benchmarkRoot: 'spec/benchmarks',
};

const M2_FIRST_PACK_TOOLS = [
  'model.show',
  'model.dry_run',
  'model.commit_bundle',
  'query.elements',
  'query.hosts',
  'query.levels',
  'query.types',
  'query.views',
  'query.nearest_wall',
  'query.enclosed_loops',
  'resolve.active_or_default_level',
  'resolve.wall_by_line',
  'resolve.room_boundary',
  'resolve.host_face',
  'resolve.family_type',
  'author.wall',
  'author.wall_chain',
  'author.floor_from_boundary',
  'author.floor_from_walls',
  'opening.door_on_wall',
  'opening.window_on_wall',
  'author.roof_from_walls',
  'opening.roof_opening',
  'author.stair_between_levels',
  'author.rooms_from_outlines',
  'view.save_3d',
  'document.sheet_with_views',
  'qa.advisor',
];

const M2_WAVE2_TOOLS = [
  'model.dry_run',
  'model.commit_bundle',
  'query.nearest_wall',
  'author.wall',
  'opening.roof_opening',
  'view.save_3d',
  'qa.advisor',
];

const M2_CLOSURE_GATES = [
  {
    id: 'firstPackSurfaces',
    label: 'First-pack surfaces',
    blocker: 'M2 first-pack surfaces are not all present.',
  },
  {
    id: 'liveDryRunEvidence',
    label: 'Live dry-run evidence',
    blocker: 'No clean live typed dry-run benchmark evidence was detected.',
  },
  {
    id: 'liveCommitEvidence',
    label: 'Live commit evidence',
    blocker: 'No live typed commit benchmark evidence was detected.',
  },
  {
    id: 'committedAdvisorValidation',
    label: 'Committed advisor/validation',
    blocker: 'No committed-model advisor or validation evidence was detected.',
  },
  {
    id: 'visualRenderEvidence',
    label: 'Visual/render evidence',
    blocker: 'No nonblank visual/render evidence was detected.',
  },
  {
    id: 'exportEvidence',
    label: 'Export evidence',
    blocker: 'No export artifact or manifest evidence was detected.',
  },
  {
    id: 'uiEquivalentPath',
    label: 'UI-equivalent path',
    blocker: 'No executable or validated UI/Cmd+K equivalent path was detected.',
  },
];

const BENCHMARK_COMMAND_TOOL_MARKERS = new Map([
  ['createWall', ['author.wall']],
  ['createWallChain', ['author.wall_chain']],
  ['createRoofOpening', ['opening.roof_opening']],
  ['saveViewpoint', ['view.save_3d']],
]);

function read(relPath) {
  try {
    return fs.readFileSync(path.join(ROOT, relPath), 'utf8');
  } catch {
    return '';
  }
}

function mkdirp(relPath) {
  fs.mkdirSync(path.join(ROOT, relPath), { recursive: true });
}

function parseArgs(argv) {
  const args = {
    out: 'spec/generated/ui-mcp-parity.json',
    generatedDir: 'spec/generated',
  };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--out') args.out = argv[++i];
    else if (argv[i] === '--generated-dir') args.generatedDir = argv[++i];
    else if (argv[i] === '--help' || argv[i] === '-h') {
      console.log(
        'Usage: node scripts/audit-ui-mcp-parity.mjs --out spec/generated/ui-mcp-parity.json',
      );
      process.exit(0);
    }
  }
  args.generatedDir = path.dirname(args.out);
  return args;
}

function lineNumber(source, index) {
  return source.slice(0, index).split('\n').length;
}

function findMatchingParen(source, openIndex) {
  let depth = 0;
  let quote = null;
  let triple = null;
  let escaped = false;
  for (let i = openIndex; i < source.length; i++) {
    const ch = source[i];
    const next3 = source.slice(i, i + 3);
    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (triple && next3 === triple) {
        i += 2;
        quote = null;
        triple = null;
      } else if (!triple && ch === quote) {
        quote = null;
      }
      continue;
    }
    if (next3 === '"""' || next3 === "'''") {
      quote = ch;
      triple = next3;
      i += 2;
      continue;
    }
    if (ch === '/' && source[i + 1] === '/') {
      const nextLine = source.indexOf('\n', i + 2);
      i = nextLine < 0 ? source.length : nextLine;
      continue;
    }
    if (ch === '/' && source[i + 1] === '*') {
      const commentEnd = source.indexOf('*/', i + 2);
      i = commentEnd < 0 ? source.length : commentEnd + 1;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      quote = ch;
      continue;
    }
    if (ch === '(' || ch === '{' || ch === '[') depth++;
    if (ch === ')' || ch === '}' || ch === ']') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function collectCallBlocks(source, callName) {
  const blocks = [];
  let from = 0;
  while (from < source.length) {
    const start = source.indexOf(`${callName}(`, from);
    if (start < 0) break;
    const open = start + callName.length;
    const close = findMatchingParen(source, open);
    if (close < 0) break;
    blocks.push({ block: source.slice(start, close + 1), start, line: lineNumber(source, start) });
    from = close + 1;
  }
  return blocks;
}

function extractStringProp(block, prop) {
  return block.match(new RegExp(`\\b${prop}\\s*[:=]\\s*['"\`]([^'"\`]+)['"\`]`))?.[1] ?? null;
}

function extractArrayProp(block, prop) {
  const match = block.match(new RegExp(`\\b${prop}\\s*[:=]\\s*\\[([\\s\\S]*?)\\]`));
  if (!match) return null;
  return [...match[1].matchAll(/['"`]([^'"`]+)['"`]/g)].map((m) => m[1]);
}

function extractListishProp(block, prop) {
  const match = block.match(
    new RegExp(`\\b${prop}\\s*[:=]\\s*(\\[[\\s\\S]*?\\]|\\([\\s\\S]*?\\))`),
  );
  if (!match) return null;
  return [...match[1].matchAll(/['"`]([^'"`]+)['"`]/g)].map((m) => m[1]);
}

function extractBoolProp(block, prop) {
  const match = block.match(new RegExp(`\\b${prop}\\s*[:=]\\s*(True|False|true|false)`));
  if (!match) return null;
  return /^true$/i.test(match[1]);
}

function mdEscape(value) {
  return String(value ?? UNKNOWN)
    .replaceAll('|', '\\|')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizedId(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

function hasNormalized(values, candidate) {
  const key = normalizedId(candidate);
  return values.some((value) => normalizedId(value) === key);
}

function domainFor(id) {
  const v = String(id).toLowerCase();
  const rules = [
    ['wall', 'wall'],
    ['door', 'opening'],
    ['window', 'opening'],
    ['opening', 'opening'],
    ['floor', 'floor'],
    ['roof', 'roof'],
    ['stair', 'stair'],
    ['rail', 'railing'],
    ['room', 'room-area'],
    ['area', 'room-area'],
    ['schedule', 'schedule'],
    ['sheet', 'sheet'],
    ['view', 'view'],
    ['section', 'view'],
    ['elevation', 'view'],
    ['dimension', 'annotation'],
    ['tag', 'annotation'],
    ['material', 'material'],
    ['family', 'family'],
    ['asset', 'asset'],
    ['link', 'link-import'],
    ['ifc', 'link-import'],
    ['dxf', 'link-import'],
    ['toposolid', 'site'],
    ['site', 'site'],
    ['terrain', 'site'],
    ['mep', 'mep'],
    ['pipe', 'mep'],
    ['duct', 'mep'],
    ['fixture', 'mep'],
    ['presentation', 'presentation-export'],
    ['export', 'presentation-export'],
    ['brand', 'presentation-export'],
    ['issue', 'qa-review'],
    ['clash', 'qa-review'],
    ['construct', 'qa-review'],
    ['validation', 'qa-review'],
  ];
  return rules.find(([needle]) => v.includes(needle))?.[1] ?? 'general';
}

function priorityFor(domain) {
  if (
    [
      'wall',
      'opening',
      'floor',
      'roof',
      'stair',
      'room-area',
      'view',
      'sheet',
      'schedule',
    ].includes(domain)
  ) {
    return 'P0';
  }
  if (
    [
      'annotation',
      'material',
      'family',
      'site',
      'link-import',
      'qa-review',
      'presentation-export',
    ].includes(domain)
  ) {
    return 'P1';
  }
  return 'P2';
}

function parseBackendCommands() {
  const source = read(SOURCES.commands);
  const classes = [];
  const classMatches = [...source.matchAll(/^class\s+(\w+Cmd)\(BaseModel\):/gm)];
  for (let i = 0; i < classMatches.length; i++) {
    const match = classMatches[i];
    const start = match.index ?? 0;
    const end = classMatches[i + 1]?.index ?? source.length;
    const block = source.slice(start, end);
    const discriminator = block.match(/\btype:\s*Literal\["([^"]+)"\]/)?.[1];
    if (!discriminator) continue;
    const fields = [...block.matchAll(/^\s{4}([a-zA-Z_]\w*)\s*:/gm)]
      .map((m) => m[1])
      .filter((name) => name !== 'model_config');
    classes.push({
      discriminator,
      className: match[1],
      domain: domainFor(discriminator),
      fields,
      source: `${SOURCES.commands}:${lineNumber(source, start)}`,
    });
  }
  const unionBlock =
    source.match(/Command\s*=\s*Annotated\[\s*([\s\S]*?)\s*,\s*Field\(/)?.[1] ?? '';
  const unionClasses = new Set([...unionBlock.matchAll(/\b(\w+Cmd)\b/g)].map((m) => m[1]));
  return classes
    .map((cmd) => ({
      ...cmd,
      inCommandUnion: unionClasses.size ? unionClasses.has(cmd.className) : true,
    }))
    .sort(
      (a, b) => a.domain.localeCompare(b.domain) || a.discriminator.localeCompare(b.discriminator),
    );
}

function parseSeedDslCommands() {
  const source = read(SOURCES.seedDsl);
  return new Set([...source.matchAll(/\btype:\s*['"`]([^'"`]+)['"`]/g)].map((m) => m[1]));
}

function parseToolIds() {
  const source = read(SOURCES.toolRegistry);
  const union = source.match(/export type ToolId\s*=\s*([\s\S]*?);/)?.[1] ?? '';
  return new Set([...union.matchAll(/\|\s*['"`]([^'"`]+)['"`]/g)].map((m) => m[1]));
}

function parseCapabilities() {
  const source = read(SOURCES.capabilities);
  const capabilityIds = parseExplicitCapabilityIdMap(source);
  const agentEquivalents = parseExplicitAgentEquivalentMap(source);
  const result = new Map();
  for (const block of collectObjectBlocksById(source)) {
    const id = extractStringProp(block.block, 'id');
    if (!id) continue;
    const agentEquivalent =
      extractAgentEquivalent(block.block) ??
      agentEquivalents.get(id) ??
      (id.startsWith('tool.')
        ? {
            completionKind: 'browser-automation',
            toolId: '',
            notes:
              'Cmd+K activates the interactive tool; completion still requires user or browser-driven canvas gestures.',
          }
        : null);
    result.set(id, {
      id,
      capabilityId: extractStringProp(block.block, 'capabilityId') ?? capabilityIds.get(id) ?? id,
      label: extractStringProp(block.block, 'label') ?? UNKNOWN,
      owner: extractStringProp(block.block, 'owner') ?? UNKNOWN,
      group: extractStringProp(block.block, 'group') ?? UNKNOWN,
      scope: extractStringProp(block.block, 'scope') ?? UNKNOWN,
      surfaces: extractArrayProp(block.block, 'surfaces') ?? [],
      executionSurface: extractStringProp(block.block, 'executionSurface') ?? UNKNOWN,
      preconditions: extractArrayProp(block.block, 'preconditions') ?? [],
      requiredContext:
        extractArrayProp(block.block, 'requiredContext') ??
        extractArrayProp(block.block, 'preconditions') ??
        [],
      executionKind: extractStringProp(block.block, 'executionKind') ?? UNKNOWN,
      resultKind: extractStringProp(block.block, 'resultKind') ?? UNKNOWN,
      agentEquivalent,
      status: extractStringProp(block.block, 'status') ?? UNKNOWN,
      source: `${SOURCES.capabilities}:${block.line}`,
    });
  }
  for (const toolId of parseToolIds()) {
    const id = `tool.${toolId}`;
    if (!result.has(id)) {
      result.set(id, {
        id,
        capabilityId: id,
        label: toolId,
        owner: 'tools/toolRegistry',
        group: UNKNOWN,
        scope: 'view',
        surfaces: ['ribbon', 'cmd-k'],
        executionSurface: 'canvas',
        preconditions: [],
        requiredContext: [],
        executionKind: 'activates-tool',
        resultKind: 'tool-activation',
        agentEquivalent: {
          completionKind: 'browser-automation',
          toolId: '',
          notes:
            'Cmd+K activates the interactive tool; completion still requires user or browser-driven canvas gestures.',
        },
        status: 'implemented',
        source: SOURCES.toolRegistry,
      });
    }
  }
  return result;
}

function collectObjectBlocksById(source) {
  const blocks = [];
  for (const match of source.matchAll(/\{\s*\n\s*id:\s*['"`][^'"`]+['"`]/g)) {
    const open = match.index ?? 0;
    const close = findMatchingParen(source, open);
    if (close > open)
      blocks.push({ block: source.slice(open, close + 1), line: lineNumber(source, open) });
  }
  return blocks;
}

function collectPythonDict(source, name) {
  const start = source.indexOf(`${name}:`);
  if (start < 0) return new Map();
  const open = source.indexOf('{', start);
  if (open < 0) return new Map();
  const close = findMatchingParen(source, open);
  if (close < 0) return new Map();
  const block = source.slice(open, close + 1);
  const result = new Map();
  for (const match of block.matchAll(/["']([^"']+)["']\s*:\s*(\([^\)]*\)|\[[^\]]*\])/g)) {
    result.set(
      match[1],
      [...match[2].matchAll(/["']([^"']+)["']/g)].map((m) => m[1]),
    );
  }
  return result;
}

function parseRegistryDefaults() {
  const source = read(SOURCES.apiRegistry);
  return {
    kernelCommandsByTool: collectPythonDict(source, '_KERNEL_COMMANDS_BY_TOOL'),
    resourceGroupsByTool: collectPythonDict(source, '_RESOURCE_GROUPS_BY_TOOL'),
  };
}

function parseExplicitCapabilityIdMap(source) {
  const fnStart = source.indexOf('function productCapabilityIdForCommand');
  if (fnStart < 0) return new Map();
  const explicitStart = source.indexOf('const explicit', fnStart);
  const open = source.indexOf('{', explicitStart);
  const close = open >= 0 ? findMatchingParen(source, open) : -1;
  if (close < 0) return new Map();
  const block = source.slice(open, close + 1);
  return new Map(
    [...block.matchAll(/['"`]([^'"`]+)['"`]\s*:\s*['"`]([^'"`]+)['"`]/g)].map((m) => [m[1], m[2]]),
  );
}

function parseExplicitAgentEquivalentMap(source) {
  const fnStart = source.indexOf('function agentEquivalentForCommand');
  if (fnStart < 0) return new Map();
  const explicitStart = source.indexOf('const explicit', fnStart);
  const open = source.indexOf('{', explicitStart);
  const close = open >= 0 ? findMatchingParen(source, open) : -1;
  if (close < 0) return new Map();
  const block = source.slice(open + 1, close);
  const result = new Map();
  for (const match of block.matchAll(/['"`]([^'"`]+)['"`]\s*:\s*\{/g)) {
    const entryOpen = (match.index ?? 0) + match[0].lastIndexOf('{');
    const entryClose = findMatchingParen(block, entryOpen);
    if (entryClose < 0) continue;
    const entryBlock = block.slice(entryOpen, entryClose + 1);
    result.set(match[1], extractAgentEquivalent(entryBlock));
  }
  return result;
}

function extractAgentEquivalent(block) {
  const agentBlockMatch = block.match(/\bagentEquivalent\s*[:=]\s*\{/);
  const agentBlock =
    agentBlockMatch && agentBlockMatch.index !== undefined
      ? (() => {
          const open = agentBlockMatch.index + agentBlockMatch[0].lastIndexOf('{');
          const close = findMatchingParen(block, open);
          return close > open ? block.slice(open, close + 1) : block;
        })()
      : block;
  const completionKind = extractStringProp(agentBlock, 'completionKind');
  if (!completionKind) return null;
  return {
    completionKind,
    toolId: extractStringProp(agentBlock, 'toolId') ?? '',
    notes: extractStringProp(agentBlock, 'notes') ?? '',
  };
}

function parseCmdkEntries() {
  const source = read(SOURCES.cmdk);
  return collectCallBlocks(source, 'registerCommand')
    .map(({ block, line }) => {
      const id = extractStringProp(block, 'id') ?? UNKNOWN;
      const dispatchTypes = [...block.matchAll(/\btype:\s*['"`]([^'"`]+)['"`]/g)].map((m) => m[1]);
      const startedTools = [
        ...block.matchAll(/startPlanTool\([^,]+,\s*['"`]([^'"`]+)['"`]\)/g),
      ].map((m) => m[1]);
      const invokes = [...block.matchAll(/\bctx\.([a-zA-Z_]\w*)\?\./g)].map((m) => m[1]);
      const invokeBody =
        block.match(/\binvoke\s*:\s*(?:\([^)]*\)|\w+)\s*=>\s*([\s\S]*?)\n\s*[,}]/)?.[1] ?? block;
      const executionKind = inferCmdkExecutionKind(id, block, dispatchTypes, startedTools, invokes);
      return {
        id,
        capabilityId: extractStringProp(block, 'capabilityId') ?? '',
        label: extractStringProp(block, 'label') ?? UNKNOWN,
        category: extractStringProp(block, 'category') ?? UNKNOWN,
        keywords: extractArrayProp(block, 'keywords') ?? [],
        executionKind,
        resultKind: extractStringProp(block, 'resultKind') ?? UNKNOWN,
        requiredContext: extractArrayProp(block, 'requiredContext') ?? [],
        agentEquivalentMetadata: extractAgentEquivalent(block),
        dispatchCommandTypes: dispatchTypes,
        startedTools,
        contextCallbacks: [...new Set(invokes)],
        agentEquivalent: dispatchTypes.length
          ? dispatchTypes.join(', ')
          : startedTools.length
            ? 'raw-command required'
            : UNKNOWN,
        source: `${SOURCES.cmdk}:${line}`,
        parserNotes:
          invokeBody.includes('buildBoundaryWallPlan') ||
          invokeBody.includes('dispatchSelectedWallCommand')
            ? 'Command type may be produced by helper; direct type extraction can be incomplete.'
            : '',
      };
    })
    .sort((a, b) => a.id.localeCompare(b.id));
}

function inferCmdkExecutionKind(id, block, dispatchTypes, startedTools, invokes) {
  if (block.includes('startPlanTool') || startedTools.length) return 'activates-tool';
  if (block.includes('dispatchCommand') || dispatchTypes.length)
    return block.includes('bundle') ? 'commits-bundle' : 'commits-command';
  if (id.startsWith('navigate.') || block.includes('navigateMode') || block.includes('openElement'))
    return 'navigates';
  if (
    invokes.some((name) => /^open[A-Z]/.test(name)) ||
    block.includes('Open ') ||
    block.includes('open')
  )
    return 'opens-dialog';
  if (block.includes('setTheme') || block.includes('setLanguage') || block.includes('toggle'))
    return 'local-ui-only';
  return UNKNOWN;
}

function parseApiDescriptors() {
  const source = read(SOURCES.apiRegistry);
  const registryDefaults = parseRegistryDefaults();
  return collectCallBlocks(source, 'ToolDescriptor')
    .map(({ block, line }) => {
      const id = extractStringProp(block, 'name') ?? UNKNOWN;
      const restMatch = block.match(
        /restEndpoint\s*=\s*RestEndpoint\(\s*method\s*=\s*["']([^"']+)["']\s*,\s*path\s*=\s*["']([^"']+)["']/,
      );
      const inputTitle =
        block.match(/inputSchema\s*=\s*\{[\s\S]*?["']title["']\s*:\s*["']([^"']+)["']/)?.[1] ??
        UNKNOWN;
      const outputTitle =
        block.match(/outputSchema\s*=\s*\{[\s\S]*?["']title["']\s*:\s*["']([^"']+)["']/)?.[1] ??
        UNKNOWN;
      const exitCodes = [...block.matchAll(/["']([a-zA-Z_][\w-]*)["']\s*:\s*ExitCode\(/g)].map(
        (m) => m[1],
      );
      const kernelCommands =
        extractListishProp(block, 'kernelCommands') ??
        registryDefaults.kernelCommandsByTool.get(id) ??
        [];
      const resourceGroups =
        extractListishProp(block, 'resourceGroups') ??
        registryDefaults.resourceGroupsByTool.get(id) ??
        (kernelCommands.length ? ['kernel-command'] : []);
      const sideEffects = extractStringProp(block, 'sideEffects') ?? UNKNOWN;
      const category = extractStringProp(block, 'category') ?? UNKNOWN;
      return {
        id,
        stableId: extractStringProp(block, 'stableId') ?? id,
        category,
        sideEffects,
        mutability:
          extractStringProp(block, 'mutability') ??
          (category === 'query' || category === 'introspection'
            ? 'read'
            : category === 'transform'
              ? 'transform'
              : sideEffects === 'enqueues-job'
                ? 'job'
                : 'write'),
        implementationStatus: extractStringProp(block, 'implementationStatus') ?? 'implemented',
        transport:
          extractStringProp(block, 'transport') ?? (id === 'collab-ws' ? 'websocket' : 'http'),
        requiresBrowser: extractBoolProp(block, 'requiresBrowser') ?? false,
        createsExternalAssets:
          extractBoolProp(block, 'createsExternalAssets') ?? sideEffects === 'enqueues-job',
        exportsData:
          extractBoolProp(block, 'exportsData') ?? (id.includes('export') || id.endsWith('-pdf')),
        method: restMatch?.[1] ?? UNKNOWN,
        path: restMatch?.[2] ?? UNKNOWN,
        inputSchema: inputTitle,
        outputSchema: outputTitle,
        cliExample: extractStringProp(block, 'cliExample') ?? UNKNOWN,
        exitCodes,
        kernelCommands,
        resourceGroups,
        uiFeatures:
          extractListishProp(block, 'uiFeatures') ??
          resourceGroups.map((group) => `group:${group}`),
        agentSafetyNotes: extractStringProp(block, 'agentSafetyNotes') ?? '',
        source: `${SOURCES.apiRegistry}:${line}`,
      };
    })
    .sort((a, b) => a.id.localeCompare(b.id));
}

function parseImplementedRoutes() {
  const files = fs
    .readdirSync(path.join(ROOT, 'app/bim_ai'), { withFileTypes: true })
    .filter((entry) => entry.isFile() && /^routes_.*\.py$/.test(entry.name))
    .map((entry) => `app/bim_ai/${entry.name}`);
  const routes = [];
  for (const relPath of files) {
    const source = read(relPath);
    for (const match of source.matchAll(
      /@(\w+_router)\.(get|post|put|delete|patch|websocket)\(\s*["']([^"']+)["']/g,
    )) {
      const router = match[1];
      const method = match[2] === 'websocket' ? 'WEBSOCKET' : match[2].toUpperCase();
      const routePath = match[3];
      const prefix = router === 'api_router' ? '/api' : '/api';
      routes.push({
        method,
        path: normalizeRoute(`${prefix}${routePath}`),
        source: `${relPath}:${lineNumber(source, match.index ?? 0)}`,
      });
    }
  }
  return routes;
}

function stableToolIdFromRoute(route) {
  const path = route.path.replace('/api/models/{}/', '');
  if (path === 'qa/advisor') return 'qa.advisor';
  const match = path.match(/^(query|resolve)\/(.+)$/);
  if (!match) return null;
  const name = match[2].replace(/-/g, '_');
  if (match[1] === 'query' && name === 'summary') return 'model.show';
  return `${match[1]}.${name}`;
}

function parseQueryResolveSurfaces(implementedRoutes) {
  const source = read(SOURCES.queryResolve);
  const helpers = [...source.matchAll(/^def\s+((?:query|resolve)_[a-zA-Z_]\w*)\s*\(/gm)].map(
    (match) => ({
      id: match[1].replace(/^query_/, 'query.').replace(/^resolve_/, 'resolve.'),
      kind: match[1].startsWith('query_') ? 'query-helper' : 'resolve-helper',
      source: `${SOURCES.queryResolve}:${lineNumber(source, match.index ?? 0)}`,
    }),
  );
  const routes = implementedRoutes
    .map((route) => {
      const id = stableToolIdFromRoute(route);
      return id
        ? {
            id,
            kind:
              id.startsWith('query.') || id === 'model.show'
                ? 'query-route'
                : id.startsWith('resolve.')
                  ? 'resolve-route'
                  : 'qa-route',
            source: route.source,
          }
        : null;
    })
    .filter(Boolean);
  return [...helpers, ...routes].sort(
    (a, b) => a.id.localeCompare(b.id) || a.kind.localeCompare(b.kind),
  );
}

function parseSemanticAuthoringSurfaces() {
  const source = read(SOURCES.semanticAuthoring);
  if (!source) return [];
  const operationBlock =
    source.match(/SUPPORTED_OPERATIONS:\s*tuple\[str,\s*\.\.\.\]\s*=\s*\(([\s\S]*?)\)/)?.[1] ?? '';
  const operationMap = {
    wall: 'author.wall',
    wall_chain: 'author.wall_chain',
    floor_from_boundary: 'author.floor_from_boundary',
    floor_from_wall_segments: 'author.floor_from_walls',
    door_on_wall: 'opening.door_on_wall',
    window_on_wall: 'opening.window_on_wall',
    roof_opening: 'opening.roof_opening',
    roof_from_boundary: 'author.roof_from_boundary',
    roof_from_wall_segments: 'author.roof_from_walls',
    room_outline: 'author.rooms_from_outlines',
    stair_between_levels: 'author.stair_between_levels',
    plan_view: 'view.plan',
    save_3d: 'view.save_3d',
    save_3d_view: 'view.save_3d',
    sheet_with_viewports: 'document.sheet_with_views',
    advisor: 'qa.advisor',
    qa_advisor: 'qa.advisor',
  };
  const operations = [...operationBlock.matchAll(/["']([^"']+)["']/g)]
    .map((match) => operationMap[match[1]] ?? `author.${match[1]}`)
    .map((id) => ({
      id,
      kind: 'semantic-authoring-helper',
      source: SOURCES.semanticAuthoring,
    }));
  const builderMatch = source.match(/^def\s+(build_semantic_authoring_bundle)\s*\(/m);
  const builder = builderMatch
    ? [
        {
          id: 'author.semantic_bundle',
          kind: 'semantic-authoring-helper',
          source: `${SOURCES.semanticAuthoring}:${lineNumber(source, builderMatch.index ?? 0)}`,
        },
      ]
    : [];
  return [...operations, ...builder].sort((a, b) => a.id.localeCompare(b.id));
}

function parseSemanticRouteAliases() {
  const source = read('app/bim_ai/routes_api.py');
  const start = source.indexOf('_SEMANTIC_SURFACE_ALIASES');
  if (start < 0) return [];
  const open = source.indexOf('{', start);
  const close = open >= 0 ? findMatchingParen(source, open) : -1;
  if (close < 0) return [];
  const block = source.slice(open, close + 1);
  return [...block.matchAll(/["']([^"']+)["']\s*:/g)]
    .map((match) => ({
      id: match[1],
      kind: 'semantic-authoring-route',
      source: `app/bim_ai/routes_api.py:${lineNumber(source, start)}`,
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

function parseJsonFile(relPath) {
  try {
    return JSON.parse(read(relPath));
  } catch {
    return null;
  }
}

function listBenchmarkDirs() {
  const root = path.join(ROOT, SOURCES.benchmarkRoot);
  try {
    return fs
      .readdirSync(root, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => `${SOURCES.benchmarkRoot}/${entry.name}`)
      .sort();
  } catch {
    return [];
  }
}

function listBenchmarkEvidenceFiles(dir) {
  const absDir = path.join(ROOT, dir);
  try {
    return fs
      .readdirSync(absDir, { withFileTypes: true })
      .filter((entry) => entry.isFile() && /\.json$/i.test(entry.name))
      .map((entry) => `${dir}/${entry.name}`)
      .filter((relPath) =>
        /(^|\/)(benchmark-result|execution-evidence|advisor|validation|visual|render|screenshot|export|ui-equivalence|ui-equivalent)[^/]*\.json$/i.test(
          relPath,
        ),
      )
      .sort();
  } catch {
    return [];
  }
}

function isBlockingEvidenceStatus(status) {
  return /todo|placeholder|optional|capable|expected|required|requires|missing|none|unknown|declared|fixture|traceability-only|opt[-_\s]?in/i.test(
    String(status),
  );
}

function isPositiveEvidenceStatus(status) {
  const text = String(status);
  return (
    /live|validated|passing|passed|clean|committed|executable|nonblank|artifact|manifest|done/i.test(
      text,
    ) && !isBlockingEvidenceStatus(text)
  );
}

function addEvidenceSignal(signals, type, status, source, detail = '') {
  signals.push({
    type,
    status: String(status ?? 'unknown'),
    source,
    detail: String(detail ?? ''),
    passes: isPositiveEvidenceStatus(status),
  });
}

function collectJsonEvidenceSignals(value, source) {
  if (!value || typeof value !== 'object') return [];
  const signals = [];
  const execution =
    value.executionEvidence && typeof value.executionEvidence === 'object'
      ? value.executionEvidence
      : value;
  const mode = String(execution.mode ?? value.mode ?? '');
  const ok = execution.ok === true || value.ok === true;
  if (ok && /live/i.test(mode) && /dry[-_\s]?run/i.test(mode)) {
    addEvidenceSignal(signals, 'liveDryRunEvidence', 'live-validated', source, mode);
  }
  if (ok && /live/i.test(mode) && /commit/i.test(mode)) {
    addEvidenceSignal(signals, 'liveCommitEvidence', 'live-validated', source, mode);
  }
  const statusText = JSON.stringify(value).slice(0, 20000);
  if (
    /committed|post[-_\s]?commit/i.test(statusText) &&
    /advisor|validation|constructability/i.test(statusText) &&
    !/remainingExitCriteria|todo/i.test(statusText)
  ) {
    addEvidenceSignal(signals, 'committedAdvisorValidation', 'committed-evidence', source);
  }
  if (
    /nonblank|screenshot|visual|render/i.test(statusText) &&
    !/placeholder|todo|remainingExitCriteria/i.test(statusText)
  ) {
    addEvidenceSignal(signals, 'visualRenderEvidence', 'nonblank-evidence', source);
  }
  if (
    /export|ifc|gltf|glb|pdf/i.test(statusText) &&
    /artifact|manifest|validated|live|passed|done/i.test(statusText) &&
    !/placeholder|todo|remainingExitCriteria/i.test(statusText)
  ) {
    addEvidenceSignal(signals, 'exportEvidence', 'export-evidence', source);
  }
  if (
    /ui[-_\s]?equivalent|cmd\+k|playwright|semantic diff/i.test(statusText) &&
    /validated|passing|passed|executable|done/i.test(statusText) &&
    !/placeholder|todo|remainingExitCriteria/i.test(statusText)
  ) {
    addEvidenceSignal(signals, 'uiEquivalentPath', 'ui-equivalent-validated', source);
  }
  return signals;
}

function flattenEvidenceExpectations(value, prefix = '') {
  if (!value || typeof value !== 'object') return [];
  const rows = [];
  for (const [key, child] of Object.entries(value)) {
    const id = prefix ? `${prefix}.${key}` : key;
    if (child === true || child === false || typeof child === 'string') {
      rows.push({ id, status: String(child), todo: '' });
    } else if (child && typeof child === 'object') {
      if ('status' in child || 'todo' in child) {
        rows.push({
          id,
          status: String(child.status ?? 'declared'),
          todo: String(child.todo ?? ''),
        });
      }
      rows.push(...flattenEvidenceExpectations(child, id));
    }
  }
  return rows;
}

function parseBenchmarkEvidence() {
  return listBenchmarkDirs().map((dir) => {
    const expectedPath = `${dir}/expected-semantics.json`;
    const bundlePath = `${dir}/mcp-cli-command-bundle.json`;
    const expected = parseJsonFile(expectedPath) ?? {};
    const bundle = parseJsonFile(bundlePath) ?? {};
    const commands = Array.isArray(bundle.commands) ? bundle.commands : [];
    const commandTypes = [...new Set(commands.map((cmd) => cmd?.type).filter(Boolean))].sort();
    const toolMarkers = [];
    for (const commandType of commandTypes) {
      for (const toolId of BENCHMARK_COMMAND_TOOL_MARKERS.get(commandType) ?? []) {
        toolMarkers.push({
          toolId,
          marker: commandType,
          status: 'fixture-command',
          source: bundlePath,
          live: false,
          note: 'Command appears in deterministic MCP/CLI fixture; this is not live typed execution evidence.',
        });
      }
    }
    const paths = expected.paths && typeof expected.paths === 'object' ? expected.paths : {};
    const pathRows = Object.entries(paths).map(([id, value]) => ({
      id,
      status: String(value?.status ?? 'unknown'),
      todo: String(value?.todo ?? ''),
    }));
    const evidenceRows = flattenEvidenceExpectations(expected.evidenceExpectations ?? {});
    const evidenceSignals = [];
    for (const row of evidenceRows) {
      if (row.id === 'advisor') {
        toolMarkers.push({
          toolId: 'qa.advisor',
          marker: 'advisor evidence expectation',
          status: row.status,
          source: expectedPath,
          live: row.status === 'live' || row.status === 'validated',
          note: row.todo || 'Advisor evidence expectation declared by benchmark.',
        });
      }
      if (/(^|\.)(todo|artifacts?)(\.|$)/i.test(row.id)) continue;
      if (/live[-_\s]?dry[-_\s]?run/i.test(row.id)) {
        addEvidenceSignal(
          evidenceSignals,
          'liveDryRunEvidence',
          row.status,
          expectedPath,
          row.todo,
        );
      }
      if (/live[-_\s]?commit/i.test(row.id)) {
        addEvidenceSignal(
          evidenceSignals,
          'liveCommitEvidence',
          row.status,
          expectedPath,
          row.todo,
        );
      }
      if (/advisor|validation|constructability/i.test(row.id)) {
        addEvidenceSignal(
          evidenceSignals,
          'committedAdvisorValidation',
          row.status,
          expectedPath,
          row.todo,
        );
      }
      if (/screenshot|visual|render/i.test(row.id)) {
        addEvidenceSignal(
          evidenceSignals,
          'visualRenderEvidence',
          row.status,
          expectedPath,
          row.todo,
        );
      }
      if (/export|ifc|gltf|glb|pdf/i.test(row.id)) {
        addEvidenceSignal(evidenceSignals, 'exportEvidence', row.status, expectedPath, row.todo);
      }
    }
    for (const row of pathRows) {
      if (
        /live[-_\s]?dry[-_\s]?run|dry[-_\s]?run.*live/i.test(row.status) &&
        isPositiveEvidenceStatus(row.status)
      ) {
        toolMarkers.push({
          toolId: 'model.dry_run',
          marker: `${row.id} path status`,
          status: row.status,
          source: expectedPath,
          live: true,
          note: row.todo || 'Benchmark path declares live dry-run evidence.',
        });
      }
      if (/live[-_\s]?dry[-_\s]?run|dry[-_\s]?run.*live/i.test(row.status)) {
        addEvidenceSignal(
          evidenceSignals,
          'liveDryRunEvidence',
          row.status,
          expectedPath,
          row.todo,
        );
      }
      if (
        /live[-_\s]?commit|commit.*live/i.test(row.status) &&
        isPositiveEvidenceStatus(row.status)
      ) {
        toolMarkers.push({
          toolId: 'model.commit_bundle',
          marker: `${row.id} path status`,
          status: row.status,
          source: expectedPath,
          live: true,
          note: row.todo || 'Benchmark path declares live commit evidence.',
        });
      }
      if (/live[-_\s]?commit|commit.*live/i.test(row.status)) {
        addEvidenceSignal(
          evidenceSignals,
          'liveCommitEvidence',
          row.status,
          expectedPath,
          row.todo,
        );
      }
      if (/ui/i.test(row.id)) {
        addEvidenceSignal(evidenceSignals, 'uiEquivalentPath', row.status, expectedPath, row.todo);
      }
    }
    const mcpCliPath = paths.mcpCli && typeof paths.mcpCli === 'object' ? paths.mcpCli : {};
    const liveDryRun = mcpCliPath.liveDryRun;
    if (liveDryRun && typeof liveDryRun === 'object') {
      addEvidenceSignal(
        evidenceSignals,
        'liveDryRunEvidence',
        liveDryRun.status,
        expectedPath,
        liveDryRun.mode ? `mode=${liveDryRun.mode}` : '',
      );
    }
    for (const relPath of listBenchmarkEvidenceFiles(dir)) {
      evidenceSignals.push(...collectJsonEvidenceSignals(parseJsonFile(relPath), relPath));
    }
    return {
      id: expected.benchmarkId ?? path.basename(dir),
      dir,
      expectedSemantics: fs.existsSync(path.join(ROOT, expectedPath)) ? expectedPath : '',
      commandBundle: fs.existsSync(path.join(ROOT, bundlePath)) ? bundlePath : '',
      pathStatus: pathRows,
      evidenceExpectations: evidenceRows,
      commandTypes,
      toolMarkers: toolMarkers.sort((a, b) => a.toolId.localeCompare(b.toolId)),
      evidenceSignals: evidenceSignals.sort(
        (a, b) => a.type.localeCompare(b.type) || a.source.localeCompare(b.source),
      ),
      uiEquivalentStatus: String(paths.ui?.status ?? 'unknown'),
      uiEquivalentTodo: String(paths.ui?.todo ?? ''),
      liveEvidence: toolMarkers.some((marker) => marker.live),
    };
  });
}

function normalizeRoute(routePath) {
  return (
    routePath
      .replace(/\{[^}]+\}/g, '{}')
      .replace(/\/+/g, '/')
      .replace(/\/$/, '') || '/'
  );
}

function routeMatches(descriptor, implementedRoutes) {
  const descriptorPath = normalizeRoute(descriptor.path);
  const descriptorPaths = new Set([descriptorPath]);
  if (
    descriptorPath === normalizeRoute('/api/v3/models/{modelId}/bundles') ||
    descriptorPath === normalizeRoute('/api/models/{modelId}/bundles')
  ) {
    descriptorPaths.add(normalizeRoute('/api/models/{model_id}/bundles'));
  }
  return (
    implementedRoutes.find(
      (route) =>
        (route.method === descriptor.method ||
          (descriptor.id === 'collab-ws' && route.method === 'WEBSOCKET')) &&
        descriptorPaths.has(route.path),
    ) ?? null
  );
}

function commandStem(value) {
  return String(value)
    .replace(/Cmd$/, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .toLowerCase()
    .split(/\s+/)
    .filter(
      (part) =>
        part &&
        ![
          'cmd',
          'create',
          'update',
          'upsert',
          'set',
          'delete',
          'move',
          'insert',
          'apply',
          'model',
          'models',
          'bundle',
          'bundles',
          'api',
          'v3',
        ].includes(part),
    );
}

function roughMatch(a, b) {
  const aParts = commandStem(a).filter((part) => part.length > 2);
  const bParts = commandStem(b).filter((part) => part.length > 2);
  if (!aParts.length || !bParts.length) return false;
  const aSet = new Set(aParts);
  const matches = bParts.filter((part) => aSet.has(part)).length;
  const smaller = Math.min(aParts.length, bParts.length);
  return matches >= Math.min(2, smaller);
}

function descriptorMatchesCommand(descriptor, command) {
  return hasNormalized(descriptor.kernelCommands ?? [], command.discriminator);
}

function descriptorToolKind(descriptor) {
  if ((descriptor.kernelCommands ?? []).includes('*')) return 'raw-apply-bundle';
  if (descriptor.category === 'query' || descriptor.category === 'introspection') return 'query';
  if (descriptor.stableId?.startsWith('resolve.') || descriptor.id.startsWith('resolve-'))
    return 'resolve';
  if (
    descriptor.stableId?.startsWith('author.') ||
    descriptor.stableId?.startsWith('opening.') ||
    descriptor.id.startsWith('author-') ||
    descriptor.id.startsWith('opening-') ||
    (descriptor.resourceGroups ?? []).some((group) => group.includes('author'))
  ) {
    return 'semantic-authoring';
  }
  if ((descriptor.kernelCommands ?? []).length) return 'typed-kernel-tool';
  return 'typed-tool';
}

function isQueryDescriptor(descriptor) {
  const values = [
    descriptor.id,
    descriptor.stableId,
    descriptor.category,
    ...(descriptor.resourceGroups ?? []),
  ].map(String);
  return (
    descriptor.category === 'query' ||
    descriptor.category === 'introspection' ||
    values.some((value) => value.startsWith('query') || value.includes('snapshot'))
  );
}

function isResolveDescriptor(descriptor) {
  return [descriptor.id, descriptor.stableId, ...(descriptor.resourceGroups ?? [])].some((value) =>
    /(^|[-_.])resolve($|[-_.])|resolver|host-face|nearest-wall|active-or-default/i.test(
      String(value),
    ),
  );
}

function isSemanticAuthoringDescriptor(descriptor) {
  return (
    descriptorToolKind(descriptor) === 'semantic-authoring' ||
    [descriptor.id, descriptor.stableId, ...(descriptor.resourceGroups ?? [])].some((value) =>
      /(^|[-_.])(author|opening)($|[-_.])|wall-chain|from-boundary|from-walls|hosted/i.test(
        String(value),
      ),
    )
  );
}

function descriptorSupportsBundleMode(descriptor, mode) {
  if (descriptor.id !== 'apply-bundle' && descriptor.stableId !== 'apply-bundle') return false;
  return (
    descriptor.routeImplemented && descriptor.cliExample.includes(`--${mode.replace('_', '-')}`)
  );
}

function implementedRouteForStableId(id, implementedRoutes) {
  const expected = {
    'model.dry_run': [
      ['POST', '/api/models/{}/commands/dry-run'],
      ['POST', '/api/models/{}/commands/bundle/dry-run'],
    ],
    'model.commit_bundle': [
      ['POST', '/api/models/{}/commands/bundle'],
      ['POST', '/api/models/{}/bundles'],
    ],
  }[id];
  if (!expected) return null;
  return (
    implementedRoutes.find((route) =>
      expected.some(([method, routePath]) => route.method === method && route.path === routePath),
    ) ?? null
  );
}

function benchmarkMarkersForTool(benchmarkEvidence, toolId) {
  return benchmarkEvidence.flatMap((benchmark) =>
    benchmark.toolMarkers
      .filter((marker) => marker.toolId === toolId)
      .map((marker) => ({
        benchmarkId: benchmark.id,
        ...marker,
      })),
  );
}

function benchmarkSignalsForGate(benchmarkEvidence, gateId) {
  return benchmarkEvidence.flatMap((benchmark) =>
    (benchmark.evidenceSignals ?? [])
      .filter((signal) => signal.type === gateId)
      .map((signal) => ({
        benchmarkId: benchmark.id,
        ...signal,
      })),
  );
}

function buildM2ClosureGates(firstPack, benchmarkEvidence) {
  const surfaceMissing = firstPack.filter((row) => row.status !== 'present');
  return M2_CLOSURE_GATES.map((gate) => {
    if (gate.id === 'firstPackSurfaces') {
      return {
        id: gate.id,
        label: gate.label,
        status: surfaceMissing.length ? 'blocked' : 'passed',
        passed: surfaceMissing.length === 0,
        evidenceCount: firstPack.length - surfaceMissing.length,
        blocker: surfaceMissing.length
          ? `${gate.blocker} Missing/partial: ${surfaceMissing.map((row) => row.id).join(', ')}.`
          : '',
        evidence: firstPack
          .filter((row) => row.status === 'present')
          .map((row) => ({
            benchmarkId: '',
            type: gate.id,
            status: row.status,
            source: row.source,
            detail: row.id,
            passes: true,
          })),
      };
    }
    const signals = benchmarkSignalsForGate(benchmarkEvidence, gate.id);
    const passing = signals.filter((signal) => signal.passes);
    return {
      id: gate.id,
      label: gate.label,
      status: passing.length ? 'passed' : signals.length ? 'blocked' : 'missing',
      passed: passing.length > 0,
      evidenceCount: passing.length,
      blocker: passing.length ? '' : gate.blocker,
      evidence: signals,
    };
  });
}

function m2ExpectedStatus(expected, descriptors, surfaces, implementedRoutes, benchmarkEvidence) {
  const match = descriptors.find(
    (descriptor) =>
      normalizedId(descriptor.id) === normalizedId(expected) ||
      normalizedId(descriptor.stableId) === normalizedId(expected),
  );
  const surface = surfaces.find(
    (candidate) => normalizedId(candidate.id) === normalizedId(expected),
  );
  const transactionRoute = implementedRouteForStableId(expected, implementedRoutes);
  const transactionDescriptor =
    expected === 'model.dry_run'
      ? descriptors.find((descriptor) => descriptorSupportsBundleMode(descriptor, 'dry_run'))
      : expected === 'model.commit_bundle'
        ? descriptors.find((descriptor) => descriptorSupportsBundleMode(descriptor, 'commit'))
        : null;
  const benchmarkMarkers = benchmarkMarkersForTool(benchmarkEvidence, expected);
  const benchmarkLiveMarkers = benchmarkMarkers.filter((marker) => marker.live);
  const status =
    match || surface
      ? 'present'
      : transactionDescriptor || transactionRoute
        ? 'partial'
        : benchmarkLiveMarkers.length
          ? 'evidence-only'
          : 'missing';
  const fallbackSource =
    surface?.source ??
    transactionDescriptor?.source ??
    transactionRoute?.source ??
    benchmarkMarkers[0]?.source ??
    '';
  const fallbackSurface = surface
    ? surface.kind
    : transactionDescriptor
      ? 'transaction-descriptor-mode'
      : transactionRoute
        ? 'transaction-route'
        : benchmarkMarkers.length
          ? 'benchmark-marker'
          : '';
  return {
    id: expected,
    status,
    descriptor: match?.id ?? '',
    stableId: match?.stableId ?? '',
    surface: fallbackSurface,
    source: fallbackSource,
    toolKind: match
      ? descriptorToolKind(match)
      : surface
        ? surface.kind
        : transactionDescriptor || transactionRoute
          ? 'transaction-mode'
          : benchmarkMarkers.length
            ? 'benchmark-marker'
            : 'missing',
    benchmarkEvidence: benchmarkMarkers,
    notes: match
      ? descriptorToolKind(match) === 'raw-apply-bundle'
        ? 'Dedicated descriptor detected, but it still exposes bundle-shaped payloads rather than semantic authoring inputs.'
        : ''
      : transactionDescriptor || transactionRoute
        ? 'Detected through existing transaction route/apply-bundle mode; not a dedicated first-class MCP descriptor.'
        : benchmarkMarkers.length
          ? 'Benchmark fixture exposes marker(s), but no live first-class surface was detected.'
          : '',
  };
}

function buildM2Summary(
  apiLedger,
  cmdkLedger,
  optionalSurfaces,
  implementedRoutes,
  benchmarkEvidence,
) {
  const queryDescriptors = apiLedger.filter(isQueryDescriptor);
  const resolveDescriptors = apiLedger.filter(isResolveDescriptor);
  const semanticAuthoringDescriptors = apiLedger.filter(isSemanticAuthoringDescriptor);
  const querySurfaces = optionalSurfaces.filter(
    (surface) => surface.id === 'model.show' || surface.id.startsWith('query.'),
  );
  const resolveSurfaces = optionalSurfaces.filter((surface) => surface.id.startsWith('resolve.'));
  const semanticAuthoringSurfaces = optionalSurfaces.filter(
    (surface) => surface.kind === 'semantic-authoring-helper',
  );
  const rawApplyBundleDescriptors = apiLedger.filter(
    (descriptor) => descriptorToolKind(descriptor) === 'raw-apply-bundle',
  );
  const typedMutatingDescriptors = apiLedger.filter(
    (descriptor) =>
      descriptorToolKind(descriptor) !== 'raw-apply-bundle' &&
      descriptor.routeImplemented &&
      descriptor.mutability !== 'read' &&
      descriptor.mutability !== 'transform',
  );
  const semanticCmdkSurfaces = cmdkLedger.filter(
    (row) => row.agentCompletionKind === 'semantic-macro' || row.agentToolId,
  );
  const firstPack = M2_FIRST_PACK_TOOLS.map((id) =>
    m2ExpectedStatus(id, apiLedger, optionalSurfaces, implementedRoutes, benchmarkEvidence),
  );
  const wave2 = M2_WAVE2_TOOLS.map((id) =>
    m2ExpectedStatus(id, apiLedger, optionalSurfaces, implementedRoutes, benchmarkEvidence),
  );
  const closureGates = buildM2ClosureGates(firstPack, benchmarkEvidence);
  const closureBlockers = closureGates
    .filter((gate) => !gate.passed)
    .map((gate) => ({ id: gate.id, label: gate.label, blocker: gate.blocker }));
  return {
    firstPackExpectedCount: firstPack.length,
    firstPackPresentCount: firstPack.filter((row) => row.status === 'present').length,
    firstPackPartialCount: firstPack.filter((row) => row.status === 'partial').length,
    firstPackEvidenceOnlyCount: firstPack.filter((row) => row.status === 'evidence-only').length,
    firstPackBenchmarkMarkerCount: firstPack.filter((row) => row.benchmarkEvidence.length).length,
    wave2ExpectedCount: wave2.length,
    wave2PresentCount: wave2.filter((row) => row.status === 'present').length,
    wave2PartialCount: wave2.filter((row) => row.status === 'partial').length,
    wave2EvidenceOnlyCount: wave2.filter((row) => row.status === 'evidence-only').length,
    wave2BenchmarkMarkerCount: wave2.filter((row) => row.benchmarkEvidence.length).length,
    queryDescriptorCount: queryDescriptors.length + querySurfaces.length,
    resolveDescriptorCount: resolveDescriptors.length + resolveSurfaces.length,
    semanticAuthoringDescriptorCount:
      semanticAuthoringDescriptors.length + semanticAuthoringSurfaces.length,
    typedMutatingDescriptorCount: typedMutatingDescriptors.length,
    rawApplyBundleDescriptorCount: rawApplyBundleDescriptors.length,
    semanticCmdkSurfaceCount: semanticCmdkSurfaces.length,
    closureGateCount: closureGates.length,
    closureGatePassedCount: closureGates.filter((gate) => gate.passed).length,
    closureStatus: closureBlockers.length ? 'Partial' : 'Done',
    closureBlockerCount: closureBlockers.length,
    firstPack,
    wave2,
    closureGates,
    closureBlockers,
    queryDescriptors: queryDescriptors.map((row) => row.id).sort(),
    resolveDescriptors: resolveDescriptors.map((row) => row.id).sort(),
    semanticAuthoringDescriptors: semanticAuthoringDescriptors.map((row) => row.id).sort(),
    querySurfaces: querySurfaces.map((row) => `${row.id} (${row.kind})`).sort(),
    resolveSurfaces: resolveSurfaces.map((row) => `${row.id} (${row.kind})`).sort(),
    semanticAuthoringSurfaces: semanticAuthoringSurfaces
      .map((row) => `${row.id} (${row.kind})`)
      .sort(),
    semanticCmdkSurfaces: semanticCmdkSurfaces.map((row) => row.id).sort(),
  };
}

function buildAudit() {
  const backendCommands = parseBackendCommands();
  const seedCommands = parseSeedDslCommands();
  const capabilities = parseCapabilities();
  const cmdkEntries = parseCmdkEntries();
  const apiDescriptors = parseApiDescriptors();
  const implementedRoutes = parseImplementedRoutes();
  const benchmarkEvidence = parseBenchmarkEvidence();
  const optionalM2Surfaces = [
    ...parseQueryResolveSurfaces(implementedRoutes),
    ...parseSemanticAuthoringSurfaces(),
    ...parseSemanticRouteAliases(),
  ];
  const descriptorsWithRoutes = apiDescriptors.map((descriptor) => {
    const route = routeMatches(descriptor, implementedRoutes);
    return {
      ...descriptor,
      routeImplemented: Boolean(route),
      routeSource: route?.source ?? '',
    };
  });

  const typedDescriptorByCommand = new Map();
  for (const cmd of backendCommands) {
    const metadataMatches = descriptorsWithRoutes.filter(
      (descriptor) =>
        descriptor.id !== 'apply-bundle' &&
        !(descriptor.kernelCommands ?? []).includes('*') &&
        descriptorMatchesCommand(descriptor, cmd),
    );
    const heuristicMatches = descriptorsWithRoutes.filter((descriptor) => {
      if (descriptor.id === 'apply-bundle' || (descriptor.kernelCommands ?? []).includes('*')) {
        return false;
      }
      if ((descriptor.kernelCommands ?? []).length) return false;
      return (
        roughMatch(cmd.discriminator, descriptor.id) ||
        roughMatch(cmd.discriminator, descriptor.cliExample)
      );
    });
    const matches = metadataMatches.length ? metadataMatches : heuristicMatches;
    typedDescriptorByCommand.set(
      cmd.discriminator,
      matches.map((match) => ({
        id: match.id,
        matchKind: metadataMatches.length ? 'registry-metadata' : 'heuristic',
        toolKind: descriptorToolKind(match),
      })),
    );
  }

  const cmdkByCommand = new Map();
  for (const entry of cmdkEntries) {
    for (const type of entry.dispatchCommandTypes) {
      if (!cmdkByCommand.has(type)) cmdkByCommand.set(type, []);
      cmdkByCommand.get(type).push(entry.id);
    }
  }
  for (const cmd of backendCommands) {
    for (const entry of cmdkEntries) {
      if (entry.dispatchCommandTypes.length) continue;
      if (entry.startedTools.some((tool) => roughMatch(cmd.discriminator, tool))) {
        if (!cmdkByCommand.has(cmd.discriminator)) cmdkByCommand.set(cmd.discriminator, []);
        cmdkByCommand.get(cmd.discriminator).push(entry.id);
      }
    }
  }

  const backendLedger = backendCommands.map((cmd) => {
    const cmdkIds = [...new Set(cmdkByCommand.get(cmd.discriminator) ?? [])].sort();
    const cmdkRows = cmdkIds
      .map((id) => cmdkEntries.find((entry) => entry.id === id))
      .filter(Boolean);
    const capabilityRows = cmdkIds.map((id) => capabilities.get(id)).filter(Boolean);
    const typedDescriptorMatches = typedDescriptorByCommand.get(cmd.discriminator) ?? [];
    const typedDescriptors = typedDescriptorMatches.map((match) => match.id);
    const hasActivator = cmdkRows.some((row) => row.executionKind === 'activates-tool');
    const hasDirectUi = cmdkRows.some(
      (row) => row.executionKind === 'commits-command' || row.executionKind === 'commits-bundle',
    );
    const uiCompletionKind = hasDirectUi
      ? 'direct'
      : hasActivator
        ? 'interactive-gesture'
        : cmdkIds.length
          ? UNKNOWN
          : 'none';
    const agentCompletionKind = typedDescriptors.length
      ? 'typed-tool'
      : seedCommands.has(cmd.discriminator)
        ? 'semantic-macro'
        : 'raw-command';
    return {
      capabilityId: `kernel.${cmd.domain}.${cmd.discriminator}`,
      backendCommands: [cmd.discriminator],
      backendClass: cmd.className,
      elementDocumentKinds: [cmd.domain],
      uiSurface: capabilityRows.flatMap((row) => row.surfaces ?? []).length
        ? [...new Set(capabilityRows.flatMap((row) => row.surfaces ?? []))]
        : cmdkIds.length
          ? ['cmd-k']
          : [],
      uiCompletionKind,
      cmdkEntries: cmdkIds,
      cmdkExecutionKind: cmdkRows.length
        ? [...new Set(cmdkRows.map((row) => row.executionKind))]
        : ['none'],
      agentSurface: typedDescriptors.length
        ? typedDescriptors
        : seedCommands.has(cmd.discriminator)
          ? ['seed-dsl']
          : ['apply-bundle'],
      agentCompletionKind,
      contextRequirements: inferContextRequirements(cmd),
      agentContextSubstitute: typedDescriptors.length
        ? 'descriptor input schema'
        : seedCommands.has(cmd.discriminator)
          ? 'seed recipe inputs'
          : 'explicit raw command payload',
      readQuerySupport: descriptorsWithRoutes.some((descriptor) => descriptor.category === 'query')
        ? 'partial'
        : UNKNOWN,
      dryRunSupport: 'raw-command dry-run',
      commitSupport: 'commands/bundle',
      undoCollabSupport: 'commit route expected',
      evidence: [],
      priority: priorityFor(cmd.domain),
      status: parityStatus(uiCompletionKind, agentCompletionKind),
      ownerSpecLink: 'spec/ui-mcp-parity-tracker.md#milestone-1-workstreams',
      source: cmd.source,
      parserNotes: [
        cmd.inCommandUnion
          ? ''
          : 'Command class has a discriminator but was not found in Command union.',
        typedDescriptors.length
          ? typedDescriptorMatches.every((match) => match.matchKind === 'registry-metadata')
            ? ''
            : 'First-class descriptor matched by fallback text heuristic; registry kernelCommands metadata is preferred.'
          : 'No first-class descriptor matched by registry metadata or heuristic.',
        cmdkIds.length
          ? ''
          : 'No Cmd+K entry matched by direct command type or tool-name heuristic.',
      ].filter(Boolean),
    };
  });

  const cmdkLedger = cmdkEntries.map((entry) => {
    const capability = capabilities.get(entry.id);
    const agentEquivalent = entry.agentEquivalentMetadata ?? capability?.agentEquivalent ?? null;
    const matchedBackendCommands = [
      ...new Set([
        ...entry.dispatchCommandTypes,
        ...backendCommands
          .filter((cmd) => entry.startedTools.some((tool) => roughMatch(cmd.discriminator, tool)))
          .map((cmd) => cmd.discriminator),
      ]),
    ].sort();
    return {
      ...entry,
      capabilityId: entry.capabilityId || capability?.capabilityId || capability?.id || UNKNOWN,
      executionKind: capability?.executionKind ?? entry.executionKind,
      surfaces: capability?.surfaces ?? (entry.id !== UNKNOWN ? ['cmd-k'] : []),
      requiredContext: entry.requiredContext.length
        ? entry.requiredContext
        : (capability?.requiredContext ?? []),
      resultKind:
        entry.resultKind !== UNKNOWN ? entry.resultKind : (capability?.resultKind ?? UNKNOWN),
      agentCompletionKind: agentEquivalent?.completionKind ?? 'none',
      agentToolId: agentEquivalent?.toolId ?? '',
      agentNotes: agentEquivalent?.notes ?? '',
      uiCompletionKind:
        (capability?.executionKind ?? entry.executionKind) === 'activates-tool'
          ? 'interactive-gesture'
          : (capability?.executionKind ?? entry.executionKind) === 'commits-command' ||
              (capability?.executionKind ?? entry.executionKind) === 'commits-bundle'
            ? 'direct'
            : (capability?.executionKind ?? entry.executionKind) === 'opens-dialog'
              ? 'modal-submit'
              : (capability?.executionKind ?? entry.executionKind) === 'navigates'
                ? 'read-only'
                : UNKNOWN,
      matchedBackendCommands,
      agentEquivalent: matchedBackendCommands.length
        ? matchedBackendCommands.join(', ')
        : agentEquivalent?.toolId || entry.agentEquivalent,
      parserNotes: [
        entry.parserNotes,
        capability ? '' : 'No command capability metadata found.',
      ].filter(Boolean),
    };
  });

  const apiLedger = descriptorsWithRoutes.map((descriptor) => ({
    ...descriptor,
    toolKind: descriptorToolKind(descriptor),
    matchedBackendCommands: backendCommands
      .filter(
        (cmd) =>
          descriptorMatchesCommand(descriptor, cmd) ||
          (!(descriptor.kernelCommands ?? []).length &&
            (roughMatch(cmd.discriminator, descriptor.id) ||
              roughMatch(cmd.discriminator, descriptor.cliExample))),
      )
      .map((cmd) => cmd.discriminator),
    parserNotes: descriptor.routeImplemented
      ? []
      : ['Descriptor endpoint path did not match an implemented FastAPI route exactly.'],
  }));

  const m2 = buildM2Summary(
    apiLedger,
    cmdkLedger,
    optionalM2Surfaces,
    implementedRoutes,
    benchmarkEvidence,
  );

  const gaps = [
    ...m2.closureBlockers.map((gate) => ({
      priority: 'P0',
      domain: 'm2-closure',
      kind: 'm2-closure-gate-blocked',
      id: gate.id,
      status: 'Gap',
      detail: gate.blocker,
    })),
    ...m2.firstPack
      .filter((row) => row.status === 'missing' || row.status === 'evidence-only')
      .map((row) => ({
        priority: row.id.startsWith('query.') || row.id.startsWith('resolve.') ? 'P0' : 'P1',
        domain: domainFor(row.id),
        kind:
          row.status === 'evidence-only' ? 'm2-first-pack-evidence-only' : 'm2-first-pack-missing',
        id: row.id,
        status: 'Gap',
        detail:
          row.status === 'evidence-only'
            ? 'Benchmark evidence marker exists, but no first-class descriptor/helper surface was detected.'
            : 'M2 first-pack tool was not found by descriptor id, stableId, route, or helper surface.',
      })),
    ...(m2.queryDescriptorCount
      ? []
      : [
          {
            priority: 'P0',
            domain: 'query',
            kind: 'm2-query-coverage',
            id: 'query.*',
            status: 'Gap',
            detail: 'No query descriptors were detected; agents lack typed discovery surfaces.',
          },
        ]),
    ...(m2.resolveDescriptorCount
      ? []
      : [
          {
            priority: 'P0',
            domain: 'resolve',
            kind: 'm2-resolve-coverage',
            id: 'resolve.*',
            status: 'Gap',
            detail: 'No resolver descriptors were detected for UI context replacement.',
          },
        ]),
    ...(m2.semanticAuthoringDescriptorCount
      ? []
      : [
          {
            priority: 'P0',
            domain: 'authoring',
            kind: 'm2-semantic-authoring',
            id: 'author.*',
            status: 'Gap',
            detail: 'No semantic authoring descriptors were detected.',
          },
        ]),
    ...backendLedger
      .filter((row) => row.uiCompletionKind === 'none' || row.agentCompletionKind === 'raw-command')
      .map((row) => ({
        priority: row.priority,
        domain: row.elementDocumentKinds[0],
        kind: row.uiCompletionKind === 'none' ? 'backend-without-ui' : 'raw-agent-only',
        id: row.backendCommands[0],
        status: row.status,
        detail:
          row.uiCompletionKind === 'none'
            ? 'Backend command has no matched Cmd+K/UI surface.'
            : 'Backend command is agent-reachable only through raw apply-bundle.',
      })),
    ...cmdkLedger
      .filter((row) => row.executionKind === 'activates-tool')
      .map((row) => ({
        priority: priorityFor(domainFor(row.id)),
        domain: domainFor(row.id),
        kind: 'cmdk-activator-only',
        id: row.id,
        status: 'UI-only',
        detail: 'Cmd+K entry activates an interactive tool and is not a complete agent operation.',
      })),
    ...apiLedger
      .filter((row) => !row.routeImplemented)
      .map((row) => ({
        priority: 'P1',
        domain: domainFor(row.id),
        kind: 'descriptor-route-mismatch',
        id: row.id,
        status: 'Gap',
        detail: `${row.method} ${row.path} did not match implemented routes.`,
      })),
  ].sort(
    (a, b) =>
      a.priority.localeCompare(b.priority) ||
      a.domain.localeCompare(b.domain) ||
      a.id.localeCompare(b.id),
  );

  return {
    generatedAt: new Date().toISOString(),
    sourceOfIntent: 'spec/ui-mcp-parity-tracker.md',
    sources: SOURCES,
    parserLimitations: [
      'TypeScript and Python are parsed with balanced-block and regex extraction; no AST/typechecker is invoked.',
      'Cmd+K commands produced through helper functions can have incomplete backend command matching.',
      'API descriptor to backend-command matching prefers ToolDescriptor kernelCommands metadata and falls back to descriptor id / CLI example text only when metadata is absent.',
      'Registry stableId, resourceGroups, and kernelCommands defaults are parsed statically from registry.py; dynamic registration outside this file is not executed.',
      'Query/resolve route and semantic authoring helper detection is name-based and optional; missing M2 modules produce zero detected surfaces without failing the audit.',
      'M2 first-pack coverage is matched by normalized descriptor id or stableId, so aliases are recognized but semantic equivalence is not proven.',
      'Route integrity normalizes FastAPI path params, known legacy bundle aliases, and websocket endpoints.',
      'UI surfaces from dynamically built tool capabilities are inferred from toolRegistry as ribbon and cmd-k.',
      'Unknown or missing metadata is emitted as "unknown" rather than guessed.',
      'Benchmark evidence markers are traceability signals only unless they explicitly declare live typed dry-run/commit execution.',
      'M2 closure gates classify benchmark statuses conservatively: todo, placeholder, optional, fixture, and capable statuses remain blockers even when they mention live execution.',
      'Optional M2-K/L/M evidence artifacts are discovered only as JSON files in benchmark directories with names containing benchmark-result, execution-evidence, advisor, validation, visual, render, screenshot, export, ui-equivalence, or ui-equivalent.',
    ],
    summary: {
      backendCommandCount: backendLedger.length,
      cmdkEntryCount: cmdkLedger.length,
      cmdkDuplicateIdCount: duplicateIds(cmdkLedger).length,
      cmdkDuplicateIds: duplicateIds(cmdkLedger),
      apiDescriptorCount: apiLedger.length,
      implementedRouteCount: implementedRoutes.length,
      backendCommandsWithoutMatchedUi: backendLedger.filter(
        (row) => row.uiCompletionKind === 'none',
      ).length,
      backendCommandsRawAgentOnly: backendLedger.filter(
        (row) => row.agentCompletionKind === 'raw-command',
      ).length,
      backendCommandsTypedAgentTool: backendLedger.filter(
        (row) => row.agentCompletionKind === 'typed-tool',
      ).length,
      m2FirstPackPresent: m2.firstPackPresentCount,
      m2FirstPackExpected: m2.firstPackExpectedCount,
      m2FirstPackPartial: m2.firstPackPartialCount,
      m2FirstPackEvidenceOnly: m2.firstPackEvidenceOnlyCount,
      m2FirstPackBenchmarkMarkers: m2.firstPackBenchmarkMarkerCount,
      m2Wave2Present: m2.wave2PresentCount,
      m2Wave2Expected: m2.wave2ExpectedCount,
      m2Wave2Partial: m2.wave2PartialCount,
      m2Wave2EvidenceOnly: m2.wave2EvidenceOnlyCount,
      m2Wave2BenchmarkMarkers: m2.wave2BenchmarkMarkerCount,
      m2QueryDescriptorCount: m2.queryDescriptorCount,
      m2ResolveDescriptorCount: m2.resolveDescriptorCount,
      m2SemanticAuthoringDescriptorCount: m2.semanticAuthoringDescriptorCount,
      m2TypedMutatingDescriptorCount: m2.typedMutatingDescriptorCount,
      m2RawApplyBundleDescriptorCount: m2.rawApplyBundleDescriptorCount,
      m2ClosureStatus: m2.closureStatus,
      m2ClosureGatePassed: m2.closureGatePassedCount,
      m2ClosureGateExpected: m2.closureGateCount,
      m2ClosureBlockerCount: m2.closureBlockerCount,
      m2LiveDryRunEvidence: m2.closureGates.find((gate) => gate.id === 'liveDryRunEvidence')
        ?.passed,
      m2LiveCommitEvidence: m2.closureGates.find((gate) => gate.id === 'liveCommitEvidence')
        ?.passed,
      m2CommittedAdvisorValidation: m2.closureGates.find(
        (gate) => gate.id === 'committedAdvisorValidation',
      )?.passed,
      m2VisualRenderEvidence: m2.closureGates.find((gate) => gate.id === 'visualRenderEvidence')
        ?.passed,
      m2ExportEvidence: m2.closureGates.find((gate) => gate.id === 'exportEvidence')?.passed,
      m2UiEquivalentPath: m2.closureGates.find((gate) => gate.id === 'uiEquivalentPath')?.passed,
      cmdkActivatorOnlyCount: cmdkLedger.filter((row) => row.executionKind === 'activates-tool')
        .length,
      apiDescriptorRouteMismatchCount: apiLedger.filter((row) => !row.routeImplemented).length,
    },
    m2,
    benchmarkEvidence,
    backendCommands: backendLedger,
    cmdkEntries: cmdkLedger,
    apiDescriptors: apiLedger,
    gaps,
  };
}

function inferContextRequirements(cmd) {
  const fieldText = cmd.fields.join(' ');
  const requirements = [];
  if (/level/i.test(fieldText)) requirements.push('level');
  if (/wall_id|host_wall/i.test(fieldText)) requirements.push('host wall');
  if (/roof_id|host_roof/i.test(fieldText)) requirements.push('host roof');
  if (/element_id|selected/i.test(fieldText)) requirements.push('element id');
  if (/view_id|plan_view/i.test(fieldText)) requirements.push('view');
  if (/sheet_id/i.test(fieldText)) requirements.push('sheet');
  if (/material/i.test(fieldText)) requirements.push('material');
  if (/family_type/i.test(fieldText)) requirements.push('family type');
  return requirements.length ? requirements : [UNKNOWN];
}

function parityStatus(uiCompletionKind, agentCompletionKind) {
  const hasUi = uiCompletionKind !== 'none';
  const hasAgent = agentCompletionKind !== 'none';
  if (hasUi && agentCompletionKind === 'typed-tool' && uiCompletionKind === 'direct')
    return 'Usable';
  if (hasUi && hasAgent) return 'Usable';
  if (hasUi) return 'UI-only';
  if (hasAgent) return 'Agent-only';
  return 'Gap';
}

async function formatForFile(relPath, content) {
  try {
    const prettier = await import('prettier');
    const filePath = path.join(ROOT, relPath);
    const config = (await prettier.resolveConfig(filePath)) ?? {};
    return await prettier.format(content, { ...config, filepath: filePath });
  } catch {
    return content;
  }
}

async function writeJson(relPath, value) {
  const content = `${JSON.stringify(value, null, 2)}\n`;
  fs.writeFileSync(path.join(ROOT, relPath), await formatForFile(relPath, content));
}

async function writeMarkdown(relPath, content) {
  const raw = `${content.trimEnd()}\n`;
  fs.writeFileSync(path.join(ROOT, relPath), await formatForFile(relPath, raw));
}

function table(headers, rows) {
  const header = `| ${headers.join(' | ')} |`;
  const divider = `| ${headers.map(() => '---').join(' | ')} |`;
  const body = rows.map((row) => `| ${row.map(mdEscape).join(' | ')} |`);
  return [header, divider, ...body].join('\n');
}

function renderBackendLedger(audit) {
  const groups = groupBy(audit.backendCommands, (row) => row.elementDocumentKinds[0] ?? 'general');
  const sections = [`# Backend Command Ledger`, sourceStamp(audit)];
  for (const [domain, rows] of [...groups.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    sections.push(
      `## ${domain}`,
      table(
        [
          'Command',
          'Class',
          'UI completion',
          'Cmd+K',
          'Agent surface',
          'Agent kind',
          'Status',
          'Source',
        ],
        rows.map((row) => [
          row.backendCommands.join(', '),
          row.backendClass,
          row.uiCompletionKind,
          row.cmdkEntries.join(', ') || 'none',
          row.agentSurface.join(', '),
          row.agentCompletionKind,
          row.status,
          row.source,
        ]),
      ),
    );
  }
  return sections.join('\n\n');
}

function groupBy(rows, keyFn) {
  const groups = new Map();
  for (const row of rows) {
    const key = keyFn(row);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  return groups;
}

function renderCmdkLedger(audit) {
  return [
    '# Cmd+K Execution Ledger',
    sourceStamp(audit),
    table(
      [
        'Command id',
        'Label',
        'Category',
        'Execution kind',
        'UI completion',
        'Backend commands',
        'Agent kind',
        'Agent tool',
        'Agent equivalent',
        'Source',
      ],
      audit.cmdkEntries.map((row) => [
        row.id,
        row.label,
        row.category,
        row.executionKind,
        row.uiCompletionKind,
        row.matchedBackendCommands.join(', ') || 'none',
        row.agentCompletionKind,
        row.agentToolId || 'none',
        row.agentEquivalent,
        row.source,
      ]),
    ),
  ].join('\n\n');
}

function renderApiLedger(audit) {
  return [
    '# API Descriptor Ledger',
    sourceStamp(audit),
    table(
      [
        'Descriptor',
        'Stable id',
        'Tool kind',
        'Category',
        'Method',
        'Path',
        'Route implemented',
        'Side effects',
        'Kernel commands',
        'Resource groups',
        'Input schema',
        'Output schema',
        'Backend commands',
        'Source',
      ],
      audit.apiDescriptors.map((row) => [
        row.id,
        row.stableId,
        row.toolKind,
        row.category,
        row.method,
        row.path,
        row.routeImplemented ? 'yes' : 'no',
        row.sideEffects,
        row.kernelCommands.join(', ') || 'none',
        row.resourceGroups.join(', ') || 'none',
        row.inputSchema,
        row.outputSchema,
        row.matchedBackendCommands.join(', ') || 'none',
        row.source,
      ]),
    ),
  ].join('\n\n');
}

function renderGapReport(audit) {
  const m2TableHeaders = [
    'M2 tool',
    'Status',
    'Descriptor',
    'Stable id',
    'Surface',
    'Tool kind',
    'Evidence',
    'Notes',
  ];
  const m2TableRow = (row) => [
    row.id,
    row.status,
    row.descriptor || 'none',
    row.stableId || 'none',
    row.surface || 'none',
    row.toolKind,
    (row.benchmarkEvidence ?? [])
      .map((marker) => `${marker.benchmarkId}:${marker.status}`)
      .join(', ') || 'none',
    row.notes || 'none',
  ];
  const benchmarkRows = audit.benchmarkEvidence.flatMap((benchmark) => {
    const rows = [
      [
        benchmark.id,
        'ui-equivalent',
        benchmark.uiEquivalentStatus,
        benchmark.uiEquivalentTodo || 'none',
        benchmark.expectedSemantics || benchmark.dir,
      ],
    ];
    for (const marker of benchmark.toolMarkers) {
      rows.push([benchmark.id, marker.toolId, marker.status, marker.note || 'none', marker.source]);
    }
    return rows;
  });
  const closureRows = audit.m2.closureGates.map((gate) => [
    gate.label,
    gate.status,
    gate.evidenceCount,
    gate.blocker || 'none',
    (gate.evidence ?? [])
      .map((item) => `${item.benchmarkId || 'audit'}:${item.status}@${item.source || 'source'}`)
      .join(', ') || 'none',
  ]);
  const sections = [
    '# Parity Gap Report',
    sourceStamp(audit),
    `Backend commands without matched UI: ${audit.summary.backendCommandsWithoutMatchedUi}`,
    `Backend commands raw-agent-only: ${audit.summary.backendCommandsRawAgentOnly}`,
    `Backend commands with first-class typed agent tools: ${audit.summary.backendCommandsTypedAgentTool}`,
    `Cmd+K activator-only entries: ${audit.summary.cmdkActivatorOnlyCount}`,
    `Cmd+K duplicate ids detected: ${audit.summary.cmdkDuplicateIdCount}${
      audit.summary.cmdkDuplicateIds.length ? ` (${audit.summary.cmdkDuplicateIds.join(', ')})` : ''
    }`,
    `API descriptor route mismatches: ${audit.summary.apiDescriptorRouteMismatchCount}`,
    '## M2 Audit Summary',
    `M2 first-pack surfaces present: ${audit.summary.m2FirstPackPresent} / ${audit.summary.m2FirstPackExpected}`,
    `M2 first-pack partial surfaces: ${audit.summary.m2FirstPackPartial}`,
    `M2 first-pack evidence-only markers: ${audit.summary.m2FirstPackEvidenceOnly}`,
    `M2 first-pack benchmark trace markers: ${audit.summary.m2FirstPackBenchmarkMarkers}`,
    `M2 closure status: ${audit.summary.m2ClosureStatus}`,
    `M2 closure gates passed: ${audit.summary.m2ClosureGatePassed} / ${audit.summary.m2ClosureGateExpected}`,
    `M2 closure blockers: ${audit.summary.m2ClosureBlockerCount}`,
    `Query surfaces detected: ${audit.summary.m2QueryDescriptorCount}`,
    `Resolve surfaces detected: ${audit.summary.m2ResolveDescriptorCount}`,
    `Semantic authoring surfaces detected: ${audit.summary.m2SemanticAuthoringDescriptorCount}`,
    `Typed mutating descriptors detected: ${audit.summary.m2TypedMutatingDescriptorCount}`,
    `Raw apply-bundle descriptors detected: ${audit.summary.m2RawApplyBundleDescriptorCount}`,
    '### M2 Closure Gates',
    table(['Gate', 'Status', 'Passing evidence', 'Blocker', 'Evidence'], closureRows),
    table(m2TableHeaders, audit.m2.firstPack.map(m2TableRow)),
    '## M2 Wave 2 Audit',
    `Wave 2 surfaces present: ${audit.summary.m2Wave2Present} / ${audit.summary.m2Wave2Expected}`,
    `Wave 2 partial surfaces: ${audit.summary.m2Wave2Partial}`,
    `Wave 2 evidence-only markers: ${audit.summary.m2Wave2EvidenceOnly}`,
    `Wave 2 benchmark trace markers: ${audit.summary.m2Wave2BenchmarkMarkers}`,
    'Partial means the audit found a lower-level transaction route or mode, but not a dedicated first-class Wave 2 descriptor/helper. Evidence-only means a benchmark fixture references the behavior without proving live typed execution.',
    table(m2TableHeaders, audit.m2.wave2.map(m2TableRow)),
    '### Benchmark Traceability',
    benchmarkRows.length
      ? table(['Benchmark', 'Trace item', 'Status', 'Detail', 'Source'], benchmarkRows)
      : 'No benchmark traceability files were detected.',
    '### Detected M2 Surfaces',
    table(
      ['Surface', 'Descriptors'],
      [
        ['query', [...audit.m2.queryDescriptors, ...audit.m2.querySurfaces].join(', ') || 'none'],
        [
          'resolve',
          [...audit.m2.resolveDescriptors, ...audit.m2.resolveSurfaces].join(', ') || 'none',
        ],
        [
          'semantic authoring',
          [...audit.m2.semanticAuthoringDescriptors, ...audit.m2.semanticAuthoringSurfaces].join(
            ', ',
          ) || 'none',
        ],
        ['semantic Cmd+K helpers', audit.m2.semanticCmdkSurfaces.join(', ') || 'none'],
      ],
    ),
    '## Gap Ledger',
    table(
      ['Priority', 'Domain', 'Kind', 'Id', 'Status', 'Detail'],
      audit.gaps.map((gap) => [gap.priority, gap.domain, gap.kind, gap.id, gap.status, gap.detail]),
    ),
    '## Parser limitations',
    audit.parserLimitations.map((item) => `- ${item}`).join('\n'),
  ];
  return sections.join('\n\n');
}

function sourceStamp(audit) {
  return `Generated by \`node scripts/audit-ui-mcp-parity.mjs --out spec/generated/ui-mcp-parity.json\` at ${audit.generatedAt}. Source of intent: \`${audit.sourceOfIntent}\`.`;
}

function assertUniqueIds(label, rows) {
  const duplicates = duplicateIds(rows);
  if (duplicates.length) {
    throw new Error(`${label} contains duplicate ids: ${duplicates.sort().join(', ')}`);
  }
}

function duplicateIds(rows) {
  const seen = new Set();
  const duplicates = new Set();
  for (const row of rows) {
    if (seen.has(row.id)) duplicates.add(row.id);
    seen.add(row.id);
  }
  return [...duplicates].sort();
}

function validateAudit(audit) {
  assertUniqueIds('API descriptor ledger', audit.apiDescriptors);
  if (audit.m2.firstPack.length !== M2_FIRST_PACK_TOOLS.length) {
    throw new Error('M2 first-pack summary length drifted from the expected tool list.');
  }
  if (audit.summary.m2RawApplyBundleDescriptorCount > audit.summary.apiDescriptorCount) {
    throw new Error('M2 raw apply-bundle count exceeds total API descriptors.');
  }
  if (
    audit.summary.m2ClosureStatus === 'Done' &&
    audit.m2.closureGates.some((gate) => !gate.passed)
  ) {
    throw new Error('M2 closure cannot be Done while any closure gate is blocked.');
  }
}

async function main() {
  const args = parseArgs(process.argv);
  mkdirp(path.dirname(args.out));
  const audit = buildAudit();
  validateAudit(audit);
  await writeJson(args.out, audit);
  await writeMarkdown(
    path.join(args.generatedDir, 'backend-command-ledger.md'),
    renderBackendLedger(audit),
  );
  await writeMarkdown(
    path.join(args.generatedDir, 'cmdk-execution-ledger.md'),
    renderCmdkLedger(audit),
  );
  await writeMarkdown(
    path.join(args.generatedDir, 'api-descriptor-ledger.md'),
    renderApiLedger(audit),
  );
  await writeMarkdown(path.join(args.generatedDir, 'parity-gap-report.md'), renderGapReport(audit));
  console.log(
    `Wrote ${args.out} and ledgers to ${args.generatedDir} ` +
      `(${audit.summary.backendCommandCount} backend commands, ${audit.summary.cmdkEntryCount} Cmd+K entries, ${audit.summary.apiDescriptorCount} API descriptors).`,
  );
}

await main();
