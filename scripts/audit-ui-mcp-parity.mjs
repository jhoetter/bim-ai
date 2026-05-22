#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import {
  BENCHMARK_COMMAND_TOOL_MARKERS,
  BLOCKING_EVIDENCE_STATUS_RE,
  CLI_ONLY_DESCRIPTOR_IDS,
  EVIDENCE_ARTIFACT_FILE_RE,
  M2_CLOSURE_GATES,
  M2_FIRST_PACK_TOOLS,
  M2_WAVE2_TOOLS,
  M3_WAVE2_WORKSTREAMS,
  M3_WAVE3_WORKSTREAMS,
  M3_WORKSTREAMS,
  M4_DYNAMIC_DESCRIPTOR_IDS,
  M4_WAVE1_WORKSTREAMS,
  POSITIVE_EVIDENCE_STATUS_RE,
  SIMPLE_HOUSE_MIN_SEMANTIC_COUNTS,
  SOURCES,
  SURFACE_EXECUTION_STATUSES,
} from './audit-ui-mcp-parity.config.mjs';
import {
  changedSimpleHouseProof,
  evidenceRejectionReason,
  isBlockingEvidenceStatus,
  isPositiveEvidenceStatus,
  parseBenchmarkEvidence,
  parseJsonFile,
  semanticDiffClean,
  statusAt,
  topLevelUiEvidenceBlocked,
} from './audit-ui-mcp-parity.evidence.mjs';
import { buildSkbReadinessAudit } from './audit-ui-mcp-parity.readiness.mjs';
import {
  buildM3Wave2,
  buildM3Wave3,
  buildM4Wave1,
} from './audit-ui-mcp-parity.workstreams.mjs';
import {
  renderApiLedger,
  renderBackendLedger,
  renderCmdkLedger,
  renderGapReport,
  renderM3Wave2Report,
  renderM3Wave3Report,
  renderM4BlockerLedger,
  renderM4Wave1Report,
  renderRawCommandPromotionPlan,
  writeJson,
  writeMarkdown,
} from './audit-ui-mcp-parity.reports.mjs';

const ROOT = process.cwd();
const UNKNOWN = 'unknown';

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
  const parsed = collectCallBlocks(source, 'ToolDescriptor')
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
        unsupportedReason: extractStringProp(block, 'unsupportedReason') ?? '',
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
    .filter((descriptor) => descriptor.id !== UNKNOWN);
  const parsedIds = new Set(parsed.map((descriptor) => descriptor.id));
  const dynamicFallbacks = [...M4_DYNAMIC_DESCRIPTOR_IDS]
    .filter((id) => !parsedIds.has(id))
    .filter(
      (id) =>
        registryDefaults.kernelCommandsByTool.has(id) ||
        registryDefaults.resourceGroupsByTool.has(id),
    )
    .map((id) => {
      const semanticSurface =
        id.startsWith('structure.') || id.startsWith('construction.') || id.startsWith('mep.');
      const querySurface = id.endsWith('.query') || id === 'asset.query';
      return {
        id,
        stableId: id,
        category: querySurface ? 'query' : 'mutation',
        sideEffects: querySurface ? 'none' : 'mutates-kernel',
        mutability: querySurface ? 'read' : 'write',
        implementationStatus: 'implemented',
        unsupportedReason: '',
        transport: 'http',
        requiresBrowser: false,
        createsExternalAssets: id.includes('export'),
        exportsData: id.includes('export'),
        method: querySurface ? 'GET' : 'POST',
        path: querySurface
          ? '/api/v3/catalog'
          : semanticSurface
            ? '/api/semantic-authoring/{surface_id}'
            : '/api/models/{model_id}/bundles',
        inputSchema: UNKNOWN,
        outputSchema: UNKNOWN,
        cliExample: UNKNOWN,
        exitCodes: [],
        kernelCommands: registryDefaults.kernelCommandsByTool.get(id) ?? [],
        resourceGroups:
          registryDefaults.resourceGroupsByTool.get(id) ??
          (registryDefaults.kernelCommandsByTool.has(id) ? ['kernel-command'] : []),
        uiFeatures: (registryDefaults.resourceGroupsByTool.get(id) ?? []).map(
          (group) => `group:${group}`,
        ),
        agentSafetyNotes: 'Statically expanded from registry defaults for dynamic M4 registration.',
        source: `${SOURCES.apiRegistry}:dynamic-default:${id}`,
      };
    });
  return [...parsed, ...dynamicFallbacks].sort((a, b) => a.id.localeCompare(b.id));
}

function parseImplementedRoutes() {
  const files = fs
    .readdirSync(path.join(ROOT, 'app/bim_ai'), { withFileTypes: true })
    .filter((entry) => entry.isFile() && /^routes_.*\.py$/.test(entry.name))
    .map((entry) => `app/bim_ai/${entry.name}`);
  const routes = [];
  for (const relPath of files) {
    const source = read(relPath);
    const routerPrefixes = new Map();
    for (const prefixMatch of source.matchAll(
      /(\w+_router)\s*=\s*APIRouter\(\s*prefix\s*=\s*["']([^"']*)["']/g,
    )) {
      routerPrefixes.set(prefixMatch[1], prefixMatch[2]);
    }
    for (const match of source.matchAll(
      /@(\w+_router)\.(get|post|put|delete|patch|websocket)\(\s*["']([^"']+)["']/g,
    )) {
      const router = match[1];
      const method = match[2] === 'websocket' ? 'WEBSOCKET' : match[2].toUpperCase();
      const routePath = match[3];
      const localPrefix = routerPrefixes.get(router) ?? '';
      const prefix = router === 'api_router' ? localPrefix || '/api' : `/api${localPrefix}`;
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

function cliCommandLabel(cliExample) {
  const value = String(cliExample || '').trim();
  if (!value || value === UNKNOWN) return '';
  if (value.startsWith('bim-ai ')) {
    return `CLI \`${value.split(/\s+/).slice(0, 4).join(' ')}\``;
  }
  return value.startsWith('curl ') ? `HTTP ${value}` : value;
}

function descriptorSurfaceStatus(descriptor) {
  if (descriptor.requiresBrowser) return 'skill-local';
  if (CLI_ONLY_DESCRIPTOR_IDS.has(descriptor.id)) return 'CLI-only';
  if (descriptor.implementationStatus !== 'implemented') return 'contract-only';
  if (!descriptor.routeImplemented) {
    return descriptor.cliExample?.startsWith('bim-ai ') ? 'CLI-only' : 'contract-only';
  }
  return 'executable';
}

function descriptorCanonicalTransport(descriptor) {
  if (descriptor.id === 'sketch.phase.apply') {
    return 'CLI `bim-ai sketch phase apply`; transaction API `POST /api/models/{model_id}/bundles`';
  }
  if (descriptor.id === 'sketch.seed.compile') {
    return 'CLI `bim-ai sketch seed compile`; API route is a 501 contract until server-hosted';
  }
  const cli = cliCommandLabel(descriptor.cliExample);
  if (descriptorSurfaceStatus(descriptor) === 'executable') {
    return `${descriptor.method} ${descriptor.path}${cli ? `; ${cli}` : ''}`;
  }
  if (descriptorSurfaceStatus(descriptor) === 'CLI-only') return cli || 'CLI';
  if (descriptorSurfaceStatus(descriptor) === 'skill-local') return 'Skill-local helper';
  return descriptor.unsupportedReason || 'Descriptor contract only';
}

function descriptorSurfaceNotes(descriptor) {
  if (descriptor.id === 'sketch.phase.apply') {
    return 'Sketch wrapper is contract-only; the blessed commit path is the generic bundle transaction route.';
  }
  if (descriptor.id === 'sketch.seed.compile') {
    return 'Compiler currently lives in packages/cli/lib/seed-dsl.mjs; use CLI/sidecar compiler.';
  }
  return descriptor.unsupportedReason || descriptor.agentSafetyNotes || '';
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

function formatSignalReason(signal) {
  const status = signal.status ? `status=${signal.status}` : 'status=unknown';
  const reason = signal.reason || evidenceRejectionReason(signal.status, signal.detail);
  const detail = signal.detail ? ` detail=${signal.detail}` : '';
  return `${signal.benchmarkId || 'audit'}:${signal.source || 'unknown source'} ${status}${detail} (${reason})`;
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
        blockerDetails: surfaceMissing.map(
          (row) => `${row.id}: ${row.status}; source=${row.source || 'none'}`,
        ),
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
    const rejected = signals.filter((signal) => !signal.passes);
    const blockerDetails = rejected.map(formatSignalReason);
    const blocker = passing.length
      ? ''
      : blockerDetails.length
        ? `${gate.blocker} Rejected evidence: ${blockerDetails.join('; ')}.`
        : gate.blocker;
    return {
      id: gate.id,
      label: gate.label,
      status: passing.length ? 'passed' : signals.length ? 'blocked' : 'missing',
      passed: passing.length > 0,
      evidenceCount: passing.length,
      blocker,
      blockerDetails,
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
    .map((gate) => ({
      id: gate.id,
      label: gate.label,
      blocker: gate.blocker,
      blockerDetails: gate.blockerDetails ?? [],
    }));
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
    surfaceStatus: descriptorSurfaceStatus(descriptor),
    canonicalTransport: descriptorCanonicalTransport(descriptor),
    surfaceNotes: descriptorSurfaceNotes(descriptor),
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
  const skb = buildSkbReadinessAudit(apiLedger, cmdkLedger);

  for (const row of backendLedger) {
    row.m3Promotion =
      row.agentCompletionKind === 'raw-command' ? classifyRawCommandForM3(row) : null;
  }

  const m3 = buildM3Governance(backendLedger, cmdkLedger, apiLedger);
  const m3Wave2 = buildM3Wave2(apiLedger);
  const m3Wave3 = buildM3Wave3(apiLedger, backendLedger);
  const m4Wave1 = buildM4Wave1(apiLedger);

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
    ...m3Wave2.blockers.map((gate) => ({
      priority: 'P0',
      domain: 'm3-wave2',
      kind: 'm3-wave2-gate-blocked',
      id: gate.id,
      status: 'Gap',
      detail: gate.blocker,
    })),
    ...m3Wave3.blockers.map((gate) => ({
      priority: 'P0',
      domain: 'm3-wave3',
      kind: 'm3-wave3-gate-blocked',
      id: gate.id,
      status: 'Gap',
      detail: gate.blocker,
    })),
    ...m4Wave1.blockers.map((gate) => ({
      priority: 'P0',
      domain: 'm4-wave1',
      kind: 'm4-wave1-gate-blocked',
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
            : `Backend command is agent-reachable only through raw apply-bundle; M3 disposition: ${row.m3Promotion.category} (${row.m3Promotion.rationale}).`,
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
      'Benchmark expected-semantics markers are documentation signals only; M2 closure gates require clean machine-readable artifact JSON.',
      'M2 closure gates classify evidence statuses conservatively: todo, placeholder, optional, fixture, stale, failed, traceability-only, and capable statuses remain blockers even when they mention live execution.',
      'Wave 6 closure evidence must carry simple-house semantic proof: live dry-run needs command intent, and commit/advisor/visual/export artifacts need changed ids plus committed wall/opening/floor/roof counts.',
      'M2 evidence artifacts are discovered as matching JSON files below benchmark directories and spec/generated; docs, traceability-only files, and generated audit ledgers are not passing evidence.',
      'M3 Wave 2 gates are evidence aggregators only: CLI-only mappings, scenario seeds, traceability-only UI files, PDF shells, and generic transaction metadata can make a workstream Partial but not Done.',
      'M3 Wave 3 gates are evidence aggregators only: raw vertical-circulation bundles, traceability-only two-storey UI/Cmd+K artifacts, unavailable export artifacts, and generic transaction metadata can make a workstream Partial but not Done.',
      'M4 Wave 1 gates are domain-pack aggregators only: raw apply-bundle reachability, Cmd+K activators, and placeholder professional scenarios are blockers until first-class descriptors and executable or validated replay evidence land.',
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
      skbB08ResourceExecutable: skb.summary.b08ResourceExecutable,
      skbB08ResourceExpected: skb.summary.b08ResourceExpected,
      skbB09CommandSchemaExecutable: skb.summary.b09CommandSchemaExecutable,
      skbB09CommandSchemaExpected: skb.summary.b09CommandSchemaExpected,
      skbB09CommandSchemaExamples: skb.summary.b09CommandSchemaExamples,
      skbB09CommandSchemaMappings: skb.summary.b09CommandSchemaMappings,
      skbB09CommandSchemaCommandCount: skb.summary.b09CommandSchemaCommandCount,
      skbB10QueryResolveExecutable: skb.summary.b10QueryResolveExecutable,
      skbB10QueryResolveExpected: skb.summary.b10QueryResolveExpected,
      skbB11CmdkMappedEntryCount: skb.summary.b11CmdkMappedEntryCount,
      skbB11CmdkActivatorMappedEntryCount: skb.summary.b11CmdkActivatorMappedEntryCount,
      skbB11CmdkActivatorEntryCount: skb.summary.b11CmdkActivatorEntryCount,
      cmdkActivatorOnlyCount: cmdkLedger.filter((row) => row.executionKind === 'activates-tool')
        .length,
      apiDescriptorRouteMismatchCount: apiLedger.filter((row) => !row.routeImplemented).length,
      m3RawPromotionPromoteFirstClass: m3.summary.rawPromotionByCategory['promote-first-class'],
      m3RawPromotionExpertRaw: m3.summary.rawPromotionByCategory['expert-raw'],
      m3RawPromotionInternal: m3.summary.rawPromotionByCategory.internal,
      m3RawPromotionUnclassified: m3.summary.rawPromotionByCategory.unclassified,
      m3GovernanceGatePassed: m3.summary.gatesPassed,
      m3GovernanceGateExpected: m3.summary.gatesExpected,
      m3DescriptorUntrackedSurfaceCount: m3.summary.descriptorUntrackedSurfaceCount,
      m3CmdkUntrackedSurfaceCount: m3.summary.cmdkUntrackedSurfaceCount,
      m3Wave2Status: m3Wave2.status,
      m3Wave2GatePassed: m3Wave2.summary.gatesPassed,
      m3Wave2GateExpected: m3Wave2.summary.gatesExpected,
      m3Wave2BlockerCount: m3Wave2.summary.blockerCount,
      m3Wave3Status: m3Wave3.status,
      m3Wave3GatePassed: m3Wave3.summary.gatesPassed,
      m3Wave3GateExpected: m3Wave3.summary.gatesExpected,
      m3Wave3BlockerCount: m3Wave3.summary.blockerCount,
      m3Wave3NextWaveItemCount: m3Wave3.summary.nextWaveItemCount,
      m4Status: m4Wave1.status === 'Done' ? 'Done' : 'Partial',
      m4Wave1Status: m4Wave1.status,
      m4Wave1GatePassed: m4Wave1.summary.gatesPassed,
      m4Wave1GateExpected: m4Wave1.summary.gatesExpected,
      m4Wave1BlockerCount: m4Wave1.summary.blockerCount,
      m4Wave1NextWaveItemCount: m4Wave1.summary.nextWaveItemCount,
    },
    m2,
    m3: {
      ...m3,
      wave2: m3Wave2,
      wave3: m3Wave3,
      status:
        m3Wave2.status === 'Done' &&
        m3Wave3.status === 'Done' &&
        m3.summary.gatesPassed === m3.summary.gatesExpected
          ? 'Done'
          : m3Wave2.status === 'Not Started' && m3Wave3.status === 'Not Started'
            ? 'Partial'
            : 'Partial',
    },
    m4: {
      status: m4Wave1.status === 'Done' ? 'Done' : 'Partial',
      wave1: m4Wave1,
    },
    skb,
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

function commandName(row) {
  return row.backendCommands?.[0] ?? row.id ?? UNKNOWN;
}

function classifyRawCommandForM3(row) {
  const id = commandName(row);
  const domain = row.elementDocumentKinds?.[0] ?? domainFor(id);
  const starts = (prefix) => id.toLowerCase().startsWith(prefix.toLowerCase());
  const key = normalizedId(id);
  const hasKey = (...parts) => parts.some((part) => key.includes(normalizedId(part)));
  const result = (category, promotionPriority, m3Workstream, rationale) => ({
    category,
    promotionPriority,
    m3Workstream,
    gateDisposition:
      category === 'promote-first-class'
        ? 'tracked-promotion'
        : category === 'expert-raw'
          ? 'intentional-raw'
          : category === 'internal'
            ? 'internal-only'
            : 'unclassified',
    rationale,
  });

  if (
    hasKey(
      'agentAssumption',
      'agentDeviation',
      'bcfTopic',
      'monitored',
      'autoGenerated',
      'selectionSet',
      'conceptSeed',
      'frame',
      'kitComponent',
      'propertyDefinition',
    )
  ) {
    return result(
      'internal',
      'P3',
      M3_WORKSTREAMS.transaction,
      'Audit, generated-content, skill-plumbing, or internal bookkeeping command; keep out of public MCP until a typed product workflow requires it.',
    );
  }

  if (
    hasKey(
      'imageUnderlay',
      'savedView',
      'underlay',
      'traceImage',
      'gradedRegion',
      'toposolid',
      'site',
    )
  ) {
    return result(
      'promote-first-class',
      'P1',
      M3_WORKSTREAMS.sketch,
      'Sketch/site workflow command with user-visible lifecycle semantics that should not rely on opaque bundle payloads.',
    );
  }

  if (
    [
      'wall',
      'opening',
      'room-area',
      'stair',
      'sheet',
      'schedule',
      'view',
      'annotation',
      'qa-review',
    ].includes(domain)
  ) {
    const priority = ['wall', 'opening', 'room-area', 'stair'].includes(domain) ? 'P0' : 'P1';
    const workstream =
      domain === 'sheet' || domain === 'schedule' || domain === 'view' || domain === 'annotation'
        ? M3_WORKSTREAMS.export
        : domain === 'qa-review'
          ? M3_WORKSTREAMS.benchmark
          : M3_WORKSTREAMS.governance;
    return result(
      'promote-first-class',
      priority,
      workstream,
      'High-value authoring, documentation, review, or benchmark workflow command; agents need semantic inputs and stable typed descriptors.',
    );
  }

  if (domain === 'floor' || domain === 'roof' || domain === 'railing' || domain === 'mep') {
    return result(
      'promote-first-class',
      domain === 'mep' ? 'P1' : 'P2',
      domain === 'mep' ? M3_WORKSTREAMS.benchmark : M3_WORKSTREAMS.later,
      'Domain authoring command is user-visible and should be promoted when its workflow enters the product pack.',
    );
  }

  if (domain === 'link-import') {
    return result(
      'promote-first-class',
      'P1',
      M3_WORKSTREAMS.export,
      'Import/link lifecycle affects documentation/export parity and should be exposed through typed descriptors before broad agent use.',
    );
  }

  if (domain === 'family' || domain === 'asset') {
    return result(
      'expert-raw',
      'P2',
      M3_WORKSTREAMS.later,
      'Family/asset edits remain expert operations until a family authoring pack defines stable semantic inputs.',
    );
  }

  if (
    hasKey(
      'delete',
      'restore',
      'move',
      'rotate',
      'mirror',
      'align',
      'trim',
      'pin',
      'unpin',
      'phase',
      'option',
      'override',
      'join',
      'cut',
      'constraint',
      'settings',
      'sun',
      'survey',
      'basePoint',
      'propertyLine',
      'referencePlane',
    ) ||
    starts('set') ||
    starts('update') ||
    starts('upsert')
  ) {
    return result(
      'expert-raw',
      'P2',
      M3_WORKSTREAMS.transaction,
      'Low-level edit/control primitive; leave raw for expert bundles while transaction, undo, and audit semantics are hardened.',
    );
  }

  if (
    hasKey(
      'beam',
      'column',
      'cableTray',
      'ceiling',
      'detail',
      'gridLine',
      'maskingRegion',
      'mass',
      'revisionCloud',
      'spot',
      'textNote',
      'text3d',
      'sweep',
      'void',
      'soffit',
      'dormer',
      'balcony',
      'decal',
      'keynote',
      'repeatingDetail',
      'colorFillLegend',
      'treadNumber',
      'span',
      'insulation',
      'callout',
      'annotationSymbol',
      'edgeProfileRun',
      'planRegion',
    )
  ) {
    return result(
      'expert-raw',
      'P2',
      M3_WORKSTREAMS.later,
      'Specialized authoring surface outside the M3 first-class product packs; keep reachable for expert bundles and revisit with workflow evidence.',
    );
  }

  return result(
    'unclassified',
    'P0',
    M3_WORKSTREAMS.governance,
    'No M3 promotion policy matched this raw-agent-only command; add an explicit policy before landing the surface.',
  );
}

function classifyDescriptorForM3(row, backendCommandIds) {
  if (row.id === UNKNOWN) {
    return {
      disposition: 'tracked',
      category: 'parser-placeholder',
      detail:
        'Static descriptor parser emitted an unknown placeholder; excluded from public surface governance until it has a stable id.',
      unknownKernelCommands: [],
    };
  }
  const kernelCommands = (row.kernelCommands ?? []).filter((id) => id !== '*');
  const backendCommandList = [...backendCommandIds];
  const unknownKernelCommands = kernelCommands.filter(
    (id) => !backendCommandIds.has(id) && !hasNormalized(backendCommandList, id),
  );
  if (!row.routeImplemented) {
    return {
      disposition: 'untracked',
      category: 'descriptor-route-mismatch',
      detail: `${row.method} ${row.path} has no matching implemented route.`,
      unknownKernelCommands,
    };
  }
  if (unknownKernelCommands.length) {
    return {
      disposition: 'untracked',
      category: 'unknown-kernel-command',
      detail: `Descriptor references unknown kernel command(s): ${unknownKernelCommands.join(', ')}.`,
      unknownKernelCommands,
    };
  }
  if ((row.kernelCommands ?? []).includes('*')) {
    return {
      disposition: 'tracked',
      category: 'raw-transaction',
      detail: 'Wildcard descriptor intentionally exposes bundle-shaped raw command execution.',
      unknownKernelCommands,
    };
  }
  if (kernelCommands.length || row.matchedBackendCommands.length) {
    return {
      disposition: 'tracked',
      category: 'kernel-backed-tool',
      detail:
        'Descriptor maps to documented backend command metadata or a matched command heuristic.',
      unknownKernelCommands,
    };
  }
  if (row.category === 'query' || row.category === 'introspection') {
    return {
      disposition: 'tracked',
      category: 'read-only-resource',
      detail: 'Read/query descriptor is intentionally not mapped to a mutating kernel command.',
      unknownKernelCommands,
    };
  }
  if (row.mutability === 'transform' || row.toolKind === 'typed-tool') {
    return {
      disposition: 'tracked',
      category: 'typed-non-kernel-tool',
      detail: 'Typed route-level tool does not apply a kernel command directly.',
      unknownKernelCommands,
    };
  }
  return {
    disposition: 'untracked',
    category: 'undocumented-public-surface',
    detail:
      'Public descriptor is neither query/introspection, raw transaction, typed non-kernel tool, nor kernel-backed.',
    unknownKernelCommands,
  };
}

function classifyCmdkForM3(row) {
  const id = row.id ?? UNKNOWN;
  const text = `${id} ${row.category ?? ''} ${row.executionKind ?? ''}`.toLowerCase();
  const prefix = id.split('.')[0];
  const tracked = (category, disposition, detail, workstream = M3_WORKSTREAMS.governance) => ({
    category,
    disposition,
    detail,
    workstream,
  });
  if ((row.matchedBackendCommands ?? []).length || row.agentCompletionKind !== 'none') {
    return tracked(
      'covered',
      'tracked',
      'Cmd+K entry already maps to a backend command or declares an agent equivalent.',
    );
  }
  if (row.executionKind === 'activates-tool' || prefix === 'tool') {
    return tracked(
      'interactive-tool-activator',
      'intentional-ui-or-raw',
      'Interactive canvas tools remain browser/UI activators unless M3 promotes their underlying command to a semantic descriptor.',
    );
  }
  if (
    /^(navigate|display|visibility|theme|tabs|shell|help|settings|jobs|milestone|library|manage)$/.test(
      prefix,
    ) ||
    /^view\.(3d|app|browser|canvas|dynamic|help|quick|ribbon|start)/i.test(id)
  ) {
    return tracked(
      'ui-navigation-or-shell',
      'ui-only',
      'Navigation, shell, display, help, or local preference entry is intentionally UI-only for M3 governance.',
    );
  }
  if (/^(file|project|sheet|schedule|section|annotate|analysis|advisor|view)$/.test(prefix)) {
    return tracked(
      'm3-product-candidate',
      'tracked-promotion',
      'Product-facing Cmd+K surface lacks a backend command match and is tracked for the M3 documentation, benchmark, or project workflow packs.',
      M3_WORKSTREAMS.export,
    );
  }
  if (/^(family|modify|model|selection|clipboard|structural)$/.test(prefix)) {
    return tracked(
      'expert-workflow-candidate',
      'intentional-ui-or-raw',
      'Advanced modeling/editing entry is documented as UI/raw until a typed workflow pack defines stable agent semantics.',
      M3_WORKSTREAMS.later,
    );
  }
  return tracked(
    'unclassified',
    'untracked',
    'No M3 Cmd+K governance policy matched this unmatched palette entry.',
  );
}

function buildM3Governance(backendLedger, cmdkLedger, apiLedger) {
  const rawCommandPromotionPlan = backendLedger
    .filter((row) => row.agentCompletionKind === 'raw-command')
    .map((row) => ({
      id: commandName(row),
      domain: row.elementDocumentKinds[0] ?? domainFor(commandName(row)),
      uiCompletionKind: row.uiCompletionKind,
      status: row.status,
      source: row.source,
      ...row.m3Promotion,
    }))
    .sort(
      (a, b) =>
        a.promotionPriority.localeCompare(b.promotionPriority) ||
        a.category.localeCompare(b.category) ||
        a.domain.localeCompare(b.domain) ||
        a.id.localeCompare(b.id),
    );

  const backendCommandIds = new Set(backendLedger.flatMap((row) => row.backendCommands));
  const descriptorSurfaceGovernance = apiLedger
    .map((row) => ({
      id: row.id,
      stableId: row.stableId,
      category: row.category,
      toolKind: row.toolKind,
      method: row.method,
      path: row.path,
      routeImplemented: row.routeImplemented,
      kernelCommands: row.kernelCommands,
      matchedBackendCommands: row.matchedBackendCommands,
      ...classifyDescriptorForM3(row, backendCommandIds),
    }))
    .sort((a, b) => a.id.localeCompare(b.id));

  const cmdkSurfaceGovernance = cmdkLedger
    .map((row) => ({
      id: row.id,
      category: row.category,
      executionKind: row.executionKind,
      uiCompletionKind: row.uiCompletionKind,
      matchedBackendCommands: row.matchedBackendCommands,
      agentCompletionKind: row.agentCompletionKind,
      agentToolId: row.agentToolId,
      ...classifyCmdkForM3(row),
    }))
    .sort((a, b) => a.id.localeCompare(b.id));

  const rawUnclassified = rawCommandPromotionPlan.filter((row) => row.category === 'unclassified');
  const descriptorUntracked = descriptorSurfaceGovernance.filter(
    (row) => row.disposition === 'untracked',
  );
  const cmdkUntracked = cmdkSurfaceGovernance.filter((row) => row.disposition === 'untracked');
  const gates = [
    {
      id: 'raw-command-promotion-classification',
      label: 'Raw command promotion classification',
      status: rawUnclassified.length ? 'blocked' : 'passed',
      passed: rawUnclassified.length === 0,
      blocker: rawUnclassified.length
        ? `${rawUnclassified.length} raw-agent-only command(s) lack an M3 promotion disposition: ${rawUnclassified
            .slice(0, 25)
            .map((row) => row.id)
            .join(', ')}${rawUnclassified.length > 25 ? ', ...' : ''}.`
        : '',
    },
    {
      id: 'descriptor-public-surface-tracking',
      label: 'Descriptor/MCP public surface tracking',
      status: descriptorUntracked.length ? 'blocked' : 'passed',
      passed: descriptorUntracked.length === 0,
      blocker: descriptorUntracked.length
        ? `${descriptorUntracked.length} descriptor surface(s) are route-mismatched or undocumented: ${descriptorUntracked
            .map((row) => row.id)
            .join(', ')}.`
        : '',
    },
    {
      id: 'cmdk-unmatched-surface-tracking',
      label: 'Cmd+K unmatched surface tracking',
      status: cmdkUntracked.length ? 'blocked' : 'passed',
      passed: cmdkUntracked.length === 0,
      blocker: cmdkUntracked.length
        ? `${cmdkUntracked.length} unmatched Cmd+K surface(s) lack an M3 governance disposition: ${cmdkUntracked
            .slice(0, 25)
            .map((row) => row.id)
            .join(', ')}${cmdkUntracked.length > 25 ? ', ...' : ''}.`
        : '',
    },
  ];

  const rawPromotionByCategory = countBy(rawCommandPromotionPlan, (row) => row.category);
  for (const category of ['promote-first-class', 'expert-raw', 'internal', 'unclassified']) {
    rawPromotionByCategory[category] ??= 0;
  }

  return {
    summary: {
      rawPromotionByCategory,
      rawPromotionByPriority: countBy(rawCommandPromotionPlan, (row) => row.promotionPriority),
      rawPromotionByWorkstream: countBy(rawCommandPromotionPlan, (row) => row.m3Workstream),
      descriptorSurfaceByDisposition: countBy(
        descriptorSurfaceGovernance,
        (row) => row.disposition,
      ),
      cmdkSurfaceByDisposition: countBy(cmdkSurfaceGovernance, (row) => row.disposition),
      descriptorUntrackedSurfaceCount: descriptorUntracked.length,
      cmdkUntrackedSurfaceCount: cmdkUntracked.length,
      gatesExpected: gates.length,
      gatesPassed: gates.filter((gate) => gate.passed).length,
    },
    gates,
    rawCommandPromotionPlan,
    descriptorSurfaceGovernance,
    cmdkSurfaceGovernance,
  };
}

function countBy(rows, keyFn) {
  const counts = {};
  for (const row of rows) {
    const key = keyFn(row) || UNKNOWN;
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

function assertUniqueIds(label, rows, options = {}) {
  const filteredRows = options.ignoreUnknown ? rows.filter((row) => row.id !== UNKNOWN) : rows;
  const duplicates = duplicateIds(filteredRows);
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
  assertUniqueIds('API descriptor ledger', audit.apiDescriptors, { ignoreUnknown: true });
  for (const row of audit.apiDescriptors) {
    if (!SURFACE_EXECUTION_STATUSES.has(row.surfaceStatus)) {
      throw new Error(`API descriptor ${row.id} has invalid surface status: ${row.surfaceStatus}`);
    }
  }
  const descriptorById = new Map(audit.apiDescriptors.map((row) => [row.id, row]));
  const requiredReadinessStatuses = new Map([
    ['sketch.ir.validate', 'executable'],
    ['sketch.seed.compile', 'CLI-only'],
    ['sketch.phase.apply', 'CLI-only'],
    ['sketch.phase.accept', 'executable'],
    ['qa.advisor', 'executable'],
    ['qa.constructability', 'executable'],
  ]);
  for (const [id, expectedStatus] of requiredReadinessStatuses) {
    const descriptor = descriptorById.get(id);
    if (!descriptor) {
      throw new Error(`Readiness descriptor ${id} is missing from the API ledger.`);
    }
    if (descriptor.surfaceStatus !== expectedStatus) {
      throw new Error(
        `Readiness descriptor ${id} expected status ${expectedStatus}, got ${descriptor.surfaceStatus}.`,
      );
    }
  }
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
  const blockedM3Gates = audit.m3.gates.filter((gate) => !gate.passed);
  if (blockedM3Gates.length) {
    throw new Error(
      `M3 parity governance gates blocked: ${blockedM3Gates
        .map((gate) => `${gate.id}: ${gate.blocker}`)
        .join('; ')}`,
    );
  }
  if (audit.m4.status === 'Done' && audit.m4.wave1.gates.some((gate) => !gate.passed)) {
    throw new Error('M4 cannot be Done while any Wave 1 gate is blocked.');
  }
  const m4Audit = audit.m4.wave1.workstreams.find((workstream) => workstream.id === 'M4-F');
  if (!m4Audit) {
    throw new Error('M4 Wave 1 audit workstream M4-F is missing.');
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
  await writeMarkdown(
    path.join(args.generatedDir, 'raw-command-promotion-plan.md'),
    renderRawCommandPromotionPlan(audit),
  );
  await writeMarkdown(
    path.join(args.generatedDir, 'm3-wave2-report.md'),
    renderM3Wave2Report(audit),
  );
  await writeMarkdown(
    path.join(args.generatedDir, 'm3-wave3-report.md'),
    renderM3Wave3Report(audit),
  );
  await writeMarkdown(
    path.join(args.generatedDir, 'm4-wave1-report.md'),
    renderM4Wave1Report(audit),
  );
  await writeMarkdown(
    path.join(args.generatedDir, 'm4-blocker-ledger.md'),
    renderM4BlockerLedger(audit),
  );
  await writeMarkdown(path.join(args.generatedDir, 'parity-gap-report.md'), renderGapReport(audit));
  console.log(
    `Wrote ${args.out} and ledgers to ${args.generatedDir} ` +
      `(${audit.summary.backendCommandCount} backend commands, ${audit.summary.cmdkEntryCount} Cmd+K entries, ${audit.summary.apiDescriptorCount} API descriptors).`,
  );
}

await main();
