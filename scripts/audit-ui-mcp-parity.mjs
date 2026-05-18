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
};

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

function mdEscape(value) {
  return String(value ?? UNKNOWN)
    .replaceAll('|', '\\|')
    .replace(/\s+/g, ' ')
    .trim();
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
  const result = new Map();
  for (const block of collectObjectBlocksById(source)) {
    const id = extractStringProp(block.block, 'id');
    if (!id) continue;
    result.set(id, {
      id,
      label: extractStringProp(block.block, 'label') ?? UNKNOWN,
      owner: extractStringProp(block.block, 'owner') ?? UNKNOWN,
      group: extractStringProp(block.block, 'group') ?? UNKNOWN,
      scope: extractStringProp(block.block, 'scope') ?? UNKNOWN,
      surfaces: extractArrayProp(block.block, 'surfaces') ?? [],
      executionSurface: extractStringProp(block.block, 'executionSurface') ?? UNKNOWN,
      preconditions: extractArrayProp(block.block, 'preconditions') ?? [],
      status: extractStringProp(block.block, 'status') ?? UNKNOWN,
      source: `${SOURCES.capabilities}:${block.line}`,
    });
  }
  for (const toolId of parseToolIds()) {
    const id = `tool.${toolId}`;
    if (!result.has(id)) {
      result.set(id, {
        id,
        label: toolId,
        owner: 'tools/toolRegistry',
        group: UNKNOWN,
        scope: 'view',
        surfaces: ['ribbon', 'cmd-k'],
        executionSurface: 'canvas',
        preconditions: [],
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
        label: extractStringProp(block, 'label') ?? UNKNOWN,
        category: extractStringProp(block, 'category') ?? UNKNOWN,
        keywords: extractArrayProp(block, 'keywords') ?? [],
        executionKind,
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
  return collectCallBlocks(source, 'ToolDescriptor')
    .map(({ block, line }) => {
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
      return {
        id: extractStringProp(block, 'name') ?? UNKNOWN,
        category: extractStringProp(block, 'category') ?? UNKNOWN,
        sideEffects: extractStringProp(block, 'sideEffects') ?? UNKNOWN,
        method: restMatch?.[1] ?? UNKNOWN,
        path: restMatch?.[2] ?? UNKNOWN,
        inputSchema: inputTitle,
        outputSchema: outputTitle,
        cliExample: extractStringProp(block, 'cliExample') ?? UNKNOWN,
        exitCodes,
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

function buildAudit() {
  const backendCommands = parseBackendCommands();
  const seedCommands = parseSeedDslCommands();
  const capabilities = parseCapabilities();
  const cmdkEntries = parseCmdkEntries();
  const apiDescriptors = parseApiDescriptors();
  const implementedRoutes = parseImplementedRoutes();
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
    const matches = descriptorsWithRoutes.filter((descriptor) => {
      if (descriptor.id === 'apply-bundle') return false;
      return (
        roughMatch(cmd.discriminator, descriptor.id) ||
        roughMatch(cmd.discriminator, descriptor.cliExample)
      );
    });
    typedDescriptorByCommand.set(
      cmd.discriminator,
      matches.map((match) => match.id),
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
    const typedDescriptors = typedDescriptorByCommand.get(cmd.discriminator) ?? [];
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
        typedDescriptors.length ? '' : 'No first-class descriptor matched by heuristic.',
        cmdkIds.length
          ? ''
          : 'No Cmd+K entry matched by direct command type or tool-name heuristic.',
      ].filter(Boolean),
    };
  });

  const cmdkLedger = cmdkEntries.map((entry) => {
    const capability = capabilities.get(entry.id);
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
      capabilityId: capability?.id ?? UNKNOWN,
      surfaces: capability?.surfaces ?? (entry.id !== UNKNOWN ? ['cmd-k'] : []),
      uiCompletionKind:
        entry.executionKind === 'activates-tool'
          ? 'interactive-gesture'
          : entry.executionKind === 'commits-command' || entry.executionKind === 'commits-bundle'
            ? 'direct'
            : entry.executionKind === 'opens-dialog'
              ? 'modal-submit'
              : entry.executionKind === 'navigates'
                ? 'read-only'
                : UNKNOWN,
      matchedBackendCommands,
      agentEquivalent: matchedBackendCommands.length
        ? matchedBackendCommands.join(', ')
        : entry.agentEquivalent,
      parserNotes: [
        entry.parserNotes,
        capability ? '' : 'No command capability metadata found.',
      ].filter(Boolean),
    };
  });

  const apiLedger = descriptorsWithRoutes.map((descriptor) => ({
    ...descriptor,
    matchedBackendCommands: backendCommands
      .filter(
        (cmd) =>
          roughMatch(cmd.discriminator, descriptor.id) ||
          roughMatch(cmd.discriminator, descriptor.cliExample),
      )
      .map((cmd) => cmd.discriminator),
    parserNotes: descriptor.routeImplemented
      ? []
      : ['Descriptor endpoint path did not match an implemented FastAPI route exactly.'],
  }));

  const gaps = [
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
      'API descriptor to backend-command matching is heuristic by descriptor id and CLI example text.',
      'Route integrity normalizes FastAPI path params, known legacy bundle aliases, and websocket endpoints.',
      'UI surfaces from dynamically built tool capabilities are inferred from toolRegistry as ribbon and cmd-k.',
      'Unknown or missing metadata is emitted as "unknown" rather than guessed.',
    ],
    summary: {
      backendCommandCount: backendLedger.length,
      cmdkEntryCount: cmdkLedger.length,
      apiDescriptorCount: apiLedger.length,
      implementedRouteCount: implementedRoutes.length,
      backendCommandsWithoutMatchedUi: backendLedger.filter(
        (row) => row.uiCompletionKind === 'none',
      ).length,
      backendCommandsRawAgentOnly: backendLedger.filter(
        (row) => row.agentCompletionKind === 'raw-command',
      ).length,
      cmdkActivatorOnlyCount: cmdkLedger.filter((row) => row.executionKind === 'activates-tool')
        .length,
      apiDescriptorRouteMismatchCount: apiLedger.filter((row) => !row.routeImplemented).length,
    },
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
        'Category',
        'Method',
        'Path',
        'Route implemented',
        'Side effects',
        'Input schema',
        'Output schema',
        'Backend commands',
        'Source',
      ],
      audit.apiDescriptors.map((row) => [
        row.id,
        row.category,
        row.method,
        row.path,
        row.routeImplemented ? 'yes' : 'no',
        row.sideEffects,
        row.inputSchema,
        row.outputSchema,
        row.matchedBackendCommands.join(', ') || 'none',
        row.source,
      ]),
    ),
  ].join('\n\n');
}

function renderGapReport(audit) {
  const sections = [
    '# Parity Gap Report',
    sourceStamp(audit),
    `Backend commands without matched UI: ${audit.summary.backendCommandsWithoutMatchedUi}`,
    `Backend commands raw-agent-only: ${audit.summary.backendCommandsRawAgentOnly}`,
    `Cmd+K activator-only entries: ${audit.summary.cmdkActivatorOnlyCount}`,
    `API descriptor route mismatches: ${audit.summary.apiDescriptorRouteMismatchCount}`,
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

async function main() {
  const args = parseArgs(process.argv);
  mkdirp(path.dirname(args.out));
  const audit = buildAudit();
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
