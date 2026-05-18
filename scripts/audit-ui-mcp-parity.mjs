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

const EVIDENCE_ARTIFACT_FILE_RE =
  /(^|\/)(benchmark-result|execution-evidence|live-dry-run-evidence|live-commit-evidence|committed-evidence|advisor-validation|visual-evidence|render-evidence|screenshot-evidence|export-evidence|ui-cmdk-traceability|ui-equivalence|ui-equivalent|ui-validated-replay|semantic-diff)[^/]*\.json$/i;

const BLOCKING_EVIDENCE_STATUS_RE =
  /todo|placeholder|optional|capable|expected|required|requires|missing|none|unknown|declared|fixture|traceability-only|documentation-only|docs-only|opt[-_\s]?in|stale|expired|failed|failure|error|unavailable|invalid|blank|not[-_\s]?requested|non[-_\s]?executable|skipped|deferred|stub|mock/i;

const POSITIVE_EVIDENCE_STATUS_RE =
  /live|validated|passing|passed|clean|committed|executable|nonblank|artifact|manifest|done|server-side-substitute/i;

const SIMPLE_HOUSE_MIN_SEMANTIC_COUNTS = {
  walls: 6,
  openings: 6,
  floors: 1,
  roofs: 1,
};

const M3_WORKSTREAMS = {
  sketch: 'M3-A sketch-to-BIM productization',
  export: 'M3-B documentation/export first-class pack',
  benchmark: 'M3-C benchmark parity expansion',
  transaction: 'M3-D transaction/audit hardening',
  governance: 'M3-E parity governance',
  later: 'post-M3 expert/raw backlog',
};

const M3_WAVE2_WORKSTREAMS = [
  {
    id: 'M3-F',
    label: 'Sketch IR, seed, and phase product tools',
    requiredSurfaces: [
      'sketch.ir.validate',
      'sketch.seed.compile',
      'sketch.phase.apply',
      'sketch.phase.accept',
    ],
  },
  {
    id: 'M3-G',
    label: 'Two-storey stair benchmark executable path',
    scenarioId: 'two-storey-house-with-stair',
  },
  {
    id: 'M3-H',
    label: 'Documentation/export production evidence depth',
    requiredDescriptors: [
      'document.create_drawing_set',
      'create-schedule-view',
      'export.pdf',
      'export.ifc',
      'export.gltf',
      'export.glb',
    ],
  },
  {
    id: 'M3-I',
    label: 'Transaction idempotency and workflow metadata',
  },
];

const M3_WAVE3_WORKSTREAMS = [
  {
    id: 'M3-K',
    label: 'Typed vertical-circulation MCP tools',
    requiredSurfaceGroups: [
      {
        id: 'typed-stair-authoring',
        label: 'Typed stair-between-levels authoring',
        acceptedStableIds: ['author.stair_between_levels', 'create_stair_between_levels'],
        rawFallbackCommands: ['createStair'],
      },
      {
        id: 'typed-stair-opening-authoring',
        label: 'Typed stair or shaft opening authoring',
        acceptedStableIds: [
          'opening.slab_opening',
          'opening.shaft_opening',
          'opening.shaft',
          'opening.floor_opening',
          'create_floor_opening',
          'create_slab_opening',
        ],
        rawFallbackCommands: ['createSlabOpening'],
      },
      {
        id: 'typed-railing-authoring',
        label: 'Typed railing authoring',
        acceptedStableIds: ['author.railing', 'create_railing'],
        rawFallbackCommands: ['createRailing'],
      },
    ],
  },
  {
    id: 'M3-L',
    label: 'Two-storey live advisor, visual, and export evidence',
    scenarioId: 'two-storey-house-with-stair',
  },
  {
    id: 'M3-M',
    label: 'Two-storey UI and Cmd+K executable equivalence',
    scenarioId: 'two-storey-house-with-stair',
  },
  {
    id: 'M3-N',
    label: 'Documentation/export clean artifact closure',
  },
  {
    id: 'M3-O',
    label: 'Idempotency, stale revision, and workflow evidence closure',
  },
  {
    id: 'M3-P',
    label: 'Wave 3 audit, verifier, and tracker finalization',
  },
];

const M4_WAVE1_WORKSTREAMS = [
  {
    id: 'M4-A',
    label: 'Site/context first-class MCP pack',
    domain: 'site-context',
    scenarioIds: ['site-and-context-house'],
    requiredSurfaceGroups: [
      {
        id: 'toposolid-authoring',
        label: 'Toposolid create/update authoring',
        acceptedStableIds: ['site.toposolid.upsert', 'site.create_toposolid', 'create_toposolid'],
      },
      {
        id: 'grading-property-line-georeference',
        label: 'Grading, property line, and georeference tools',
        acceptedStableIds: [
          'site.graded_region',
          'site.property_line',
          'site.base_survey_point',
          'site.sun_settings',
          'site.context_import',
        ],
      },
    ],
  },
  {
    id: 'M4-B',
    label: 'Structure and construction-lite MCP pack',
    domain: 'structure-construction',
    scenarioIds: ['structure-and-mep-lite'],
    requiredSurfaceGroups: [
      {
        id: 'structural-authoring',
        label: 'Structural column and beam authoring',
        acceptedStableIds: [
          'structure.column.place',
          'structure.beam.place',
          'author.column',
          'author.beam',
        ],
      },
      {
        id: 'construction-lite',
        label: 'Construction package, logistics, and checklist tools',
        acceptedStableIds: [
          'construction.package.create',
          'construction.logistics.create',
          'construction.qa_checklist.upsert',
        ],
      },
    ],
  },
  {
    id: 'M4-C',
    label: 'MEP-lite MCP pack',
    domain: 'mep-lite',
    scenarioIds: ['structure-and-mep-lite'],
    requiredSurfaceGroups: [
      {
        id: 'mep-route-authoring',
        label: 'Pipe, duct, and cable route authoring',
        acceptedStableIds: [
          'mep.pipe_route.create',
          'mep.duct_route.create',
          'mep.cable_route.create',
        ],
      },
      {
        id: 'mep-equipment-fixtures-openings',
        label: 'MEP equipment, fixtures, terminals, and opening requests',
        acceptedStableIds: [
          'mep.equipment.place',
          'mep.fixture.place',
          'mep.terminal.place',
          'mep.opening_request.create',
        ],
      },
    ],
  },
  {
    id: 'M4-D',
    label: 'Families, assets, materials, decals pack',
    domain: 'families-assets-materials',
    scenarioIds: ['families-assets-materials'],
    requiredSurfaceGroups: [
      {
        id: 'family-asset-catalog',
        label: 'Family type upsert, catalog query, and asset placement',
        acceptedStableIds: [
          'family.type.upsert',
          'family.catalog.query',
          'asset.place',
          'asset.kit.place',
        ],
      },
      {
        id: 'material-decal-authoring',
        label: 'PBR material update, assignment, paint, and decals',
        acceptedStableIds: [
          'material.pbr.upsert',
          'material.assign',
          'material.paint_face',
          'decal.place',
        ],
      },
    ],
  },
  {
    id: 'M4-E',
    label: 'Presentation, branded export, and advanced docs',
    domain: 'presentation-advanced-docs',
    scenarioIds: ['documentation-pack', 'presentation-pack'],
    requiredSurfaceGroups: [
      {
        id: 'presentation-pack',
        label: 'Presentation frames, branded templates, render bundle, and share/export',
        acceptedStableIds: [
          'presentation.frame.create',
          'presentation.template.apply',
          'presentation.render_bundle.create',
          'presentation.share',
        ],
      },
      {
        id: 'advanced-documentation',
        label: 'Advanced sheets, schedules, revisions, and documentation exports',
        acceptedStableIds: [
          'document.advanced_sheet.create',
          'document.schedule.advanced',
          'document.revision.create',
          'export.branded_pack',
        ],
      },
    ],
  },
];

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
  return listEvidenceArtifactFiles(dir);
}

function listEvidenceArtifactFiles(relDir, maxDepth = 6) {
  const rootAbs = path.join(ROOT, relDir);
  const files = [];
  function visit(absDir, depth) {
    if (depth > maxDepth) return;
    let entries = [];
    try {
      entries = fs.readdirSync(absDir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const absPath = path.join(absDir, entry.name);
      if (entry.isDirectory()) {
        visit(absPath, depth + 1);
      } else if (entry.isFile()) {
        const relPath = path.relative(ROOT, absPath).replaceAll(path.sep, '/');
        if (EVIDENCE_ARTIFACT_FILE_RE.test(relPath)) files.push(relPath);
      }
    }
  }
  visit(rootAbs, 0);
  return files.sort();
}

function benchmarkIdFromEvidence(value, source) {
  const candidates = [
    value?.benchmarkId,
    value?.benchmark?.id,
    value?.metadata?.benchmarkId,
    value?.uiEquivalence?.benchmarkId,
  ];
  const explicit = candidates.find((candidate) => typeof candidate === 'string' && candidate);
  if (explicit) return explicit;
  const match = source.match(/spec\/benchmarks\/([^/]+)/);
  return match?.[1] ?? '';
}

function listGeneratedEvidenceFilesForBenchmark(benchmarkId) {
  if (!benchmarkId) return [];
  return listEvidenceArtifactFiles('spec/generated')
    .filter((relPath) => relPath !== 'spec/generated/ui-mcp-parity.json')
    .filter((relPath) => {
      const value = parseJsonFile(relPath);
      const artifactBenchmarkId = benchmarkIdFromEvidence(value, relPath);
      return (
        artifactBenchmarkId === benchmarkId ||
        normalizedId(relPath).includes(normalizedId(benchmarkId))
      );
    });
}

function isBlockingEvidenceStatus(status) {
  return BLOCKING_EVIDENCE_STATUS_RE.test(String(status));
}

function isPositiveEvidenceStatus(status) {
  const text = String(status);
  return POSITIVE_EVIDENCE_STATUS_RE.test(text) && !isBlockingEvidenceStatus(text);
}

function addEvidenceSignal(signals, type, status, source, detail = '', options = {}) {
  const passes =
    typeof options.passes === 'boolean' ? options.passes : isPositiveEvidenceStatus(status);
  const signal = {
    type,
    status: String(status ?? 'unknown'),
    source,
    detail: String(detail ?? ''),
    passes,
    reason: String(options.reason ?? (passes ? '' : evidenceRejectionReason(status, detail))),
  };
  if (options.proof && typeof options.proof === 'object') signal.proof = options.proof;
  signals.push(signal);
}

function evidenceRejectionReason(status, detail = '') {
  const text = `${status ?? ''} ${detail ?? ''}`;
  if (/stub|mock/i.test(text)) return 'stub or mocked artifact is not closure evidence';
  if (/traceability-only/i.test(text))
    return 'traceability-only artifact is not executable evidence';
  if (/documentation-only|docs-only|expected|declared|fixture/i.test(text)) {
    return 'documentation or fixture metadata is not closure evidence';
  }
  if (/optional|opt[-_\s]?in|requires|required/i.test(text)) {
    return 'artifact describes an optional or not-yet-run path';
  }
  if (/placeholder|todo|not[-_\s]?requested|skipped|deferred/i.test(text)) {
    return 'artifact is a placeholder or TODO';
  }
  if (/stale|expired/i.test(text)) return 'artifact is stale';
  if (/failed|failure|error|unavailable|invalid|blank/i.test(text)) {
    return 'artifact reports failed or unavailable evidence';
  }
  if (/unknown|none|missing/i.test(text)) return 'artifact does not contain a known clean status';
  return 'artifact does not contain explicit clean/pass machine-readable evidence';
}

function statusAt(value, keys = ['status', 'mode']) {
  if (!value || typeof value !== 'object') return '';
  for (const key of keys) {
    if (typeof value[key] === 'string') return value[key];
  }
  return '';
}

function httpOk(value) {
  const status = Number(value?.httpStatus ?? value?.response?.httpStatus ?? value?.statusCode);
  return !Number.isFinite(status) || (status >= 200 && status < 300);
}

function typedBundleSurfaceOk(value, requestMode) {
  const surface = value?.publicSurface;
  if (!surface || typeof surface !== 'object') return false;
  const endpoint = String(surface.endpoint ?? surface.url ?? '');
  return (
    surface.kind === 'cmd-v3-api' &&
    String(surface.method ?? '').toUpperCase() === 'POST' &&
    /\/api\/models\/.+\/bundles($|\?)/.test(endpoint) &&
    String(surface.requestMode ?? '') === requestMode
  );
}

function finiteNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function countFromMaybeObject(value, keys = ['count', 'total']) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number' || typeof value === 'string') return finiteNumber(value);
  if (typeof value !== 'object') return null;
  for (const key of keys) {
    const parsed = finiteNumber(value[key]);
    if (parsed !== null) return parsed;
  }
  return null;
}

function normalizedKindCount(countsByKind, matchers) {
  if (!countsByKind || typeof countsByKind !== 'object' || Array.isArray(countsByKind)) return 0;
  let count = 0;
  for (const [kind, rawCount] of Object.entries(countsByKind)) {
    const normalized = normalizedId(kind);
    if (!matchers.some((matcher) => matcher.test(normalized))) continue;
    const parsed = finiteNumber(rawCount);
    if (parsed !== null) count += parsed;
  }
  return count;
}

function semanticCountsFrom(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const source =
    value.semanticCounts && typeof value.semanticCounts === 'object'
      ? value.semanticCounts
      : value.counts && typeof value.counts === 'object'
        ? value.counts
        : value;
  const countsByKind =
    source.countsByKind ??
    source.elementCountsByKind ??
    source.kindCounts ??
    source.elementsByKind ??
    null;
  const walls =
    countFromMaybeObject(source.walls) ??
    countFromMaybeObject(source.wall) ??
    normalizedKindCount(countsByKind, [/wall/]);
  const openings =
    countFromMaybeObject(source.openings) ??
    countFromMaybeObject(source.opening) ??
    (() => {
      const doors = countFromMaybeObject(source.doors) ?? countFromMaybeObject(source.door) ?? 0;
      const windows =
        countFromMaybeObject(source.windows) ?? countFromMaybeObject(source.window) ?? 0;
      const hosted = countFromMaybeObject(source.hosted);
      const fromKinds = normalizedKindCount(countsByKind, [/opening/, /door/, /window/]);
      return Math.max(doors + windows, hosted ?? 0, fromKinds);
    })();
  const floors =
    countFromMaybeObject(source.floors) ??
    countFromMaybeObject(source.floor) ??
    normalizedKindCount(countsByKind, [/floor/, /slab/]);
  const roofs =
    countFromMaybeObject(source.roofs) ??
    countFromMaybeObject(source.roof) ??
    normalizedKindCount(countsByKind, [/roof/]);

  if ([walls, openings, floors, roofs].every((count) => count === null || count === 0)) {
    return null;
  }
  return {
    walls: walls ?? 0,
    openings: openings ?? 0,
    floors: floors ?? 0,
    roofs: roofs ?? 0,
  };
}

function simpleHouseSemanticCountsOk(counts) {
  return (
    counts &&
    Object.entries(SIMPLE_HOUSE_MIN_SEMANTIC_COUNTS).every(
      ([key, minimum]) => Number(counts[key] ?? 0) >= minimum,
    )
  );
}

function collectChangedIds(value, seen = new Set()) {
  if (!value || typeof value !== 'object') return [];
  if (seen.has(value)) return [];
  seen.add(value);
  const ids = new Set();
  for (const [key, child] of Object.entries(value)) {
    if (/^changed(Element)?Ids$/i.test(key) && Array.isArray(child)) {
      for (const id of child) ids.add(String(id));
      continue;
    }
    if (child && typeof child === 'object') {
      for (const id of collectChangedIds(child, seen)) ids.add(id);
    }
  }
  return [...ids].sort();
}

function semanticProofCandidates(value, context = value) {
  const roots = [value, context].filter((item, index, items) => {
    return item && typeof item === 'object' && items.indexOf(item) === index;
  });
  const candidates = [];
  for (const root of roots) {
    candidates.push(
      ['changedModelProof', root.changedModelProof],
      ['changedSimpleHouseProof', root.changedSimpleHouseProof],
      ['simpleHouseSemanticProof', root.simpleHouseSemanticProof],
      ['simpleHouseProof', root.simpleHouseProof],
      ['committedModelProof', root.committedModelProof],
      ['semanticProof', root.semanticProof],
      ['postCommit.snapshot.summary', root.postCommit?.snapshot?.summary],
      ['snapshotSummary.snapshot', root.snapshotSummary?.snapshot],
      ['snapshotSummary', root.snapshotSummary],
      ['source.changedModelProof', root.source?.changedModelProof],
      ['source.simpleHouseSemanticProof', root.source?.simpleHouseSemanticProof],
      ['committedEvidence.changedModelProof', root.committedEvidence?.changedModelProof],
      [
        'committedEvidence.changedSimpleHouseProof',
        root.committedEvidence?.changedSimpleHouseProof,
      ],
      [
        'committedEvidence.simpleHouseSemanticProof',
        root.committedEvidence?.simpleHouseSemanticProof,
      ],
      [
        'committedEvidence.snapshotSummary.snapshot',
        root.committedEvidence?.snapshotSummary?.snapshot,
      ],
      ['committedEvidence.snapshotSummary', root.committedEvidence?.snapshotSummary],
      [
        'committedEvidence.source.changedModelProof',
        root.committedEvidence?.source?.changedModelProof,
      ],
      ['visual.changedModelProof', root.visual?.changedModelProof],
      ['visual.source.changedModelProof', root.visual?.source?.changedModelProof],
      ['exports.changedModelProof', root.exports?.changedModelProof],
      ['exports.source.changedModelProof', root.exports?.source?.changedModelProof],
    );
  }
  return candidates.filter(([, candidate]) => candidate && typeof candidate === 'object');
}

function changedSimpleHouseProof(value, context = value) {
  const changedIds = collectChangedIds({ value, context });
  if (!changedIds.length) {
    return { ok: false, changedIds, reason: 'changed ids are absent' };
  }
  for (const [source, candidate] of semanticProofCandidates(value, context)) {
    const counts = semanticCountsFrom(candidate);
    if (simpleHouseSemanticCountsOk(counts)) {
      return {
        ok: true,
        changedIds,
        counts,
        source,
      };
    }
  }
  return {
    ok: false,
    changedIds,
    reason:
      'simple-house semantic counts are absent or below expected wall/opening/floor/roof counts',
  };
}

function simpleHouseRequestProof(value, context = value) {
  const candidates = [value, context].filter(Boolean);
  const commandCounts = candidates
    .flatMap((candidate) => [
      candidate?.request?.commandCount,
      candidate?.commandCount,
      candidate?.request?.commands?.length,
      candidate?.commands?.length,
    ])
    .map(finiteNumber)
    .filter((count) => count !== null);
  const commandCount = commandCounts.length ? Math.max(...commandCounts) : 0;
  const commandTypes = [
    ...new Set(
      candidates.flatMap((candidate) => [
        ...(Array.isArray(candidate?.request?.commandTypes) ? candidate.request.commandTypes : []),
        ...(Array.isArray(candidate?.commandTypes) ? candidate.commandTypes : []),
        ...(Array.isArray(candidate?.request?.commands)
          ? candidate.request.commands.map((command) => command?.type).filter(Boolean)
          : []),
        ...(Array.isArray(candidate?.commands)
          ? candidate.commands.map((command) => command?.type).filter(Boolean)
          : []),
      ]),
    ),
  ].sort();
  const hasCoreSemanticCommands = [
    'createWallChain',
    'createFloor',
    'createRoof',
    'insertDoorOnWall',
    'insertWindowOnWall',
  ].every((type) => commandTypes.includes(type));
  const ok = commandCount >= 20 || hasCoreSemanticCommands;
  return {
    ok,
    commandCount,
    commandTypes: commandTypes.slice(0, 20),
    reason: ok ? '' : 'simple-house command count/types are absent',
  };
}

function liveExecutionRejectionReason(value, requestMode, context = value) {
  if (!value || typeof value !== 'object') return 'live execution artifact is missing or invalid';
  const status = statusAt(value);
  if (isBlockingEvidenceStatus(status)) return evidenceRejectionReason(status);
  if (value.ok !== true) return 'live execution artifact does not report ok=true';
  if (value.response?.ok === false || value.response?.bodyOk === false) {
    return 'live execution response is not ok';
  }
  if (value.validation?.ok === false) return 'live execution validation is not ok';
  if (!httpOk(value)) return 'live execution HTTP status is not successful';
  if (!typedBundleSurfaceOk(value, requestMode)) {
    return 'live execution artifact is not from the typed cmd-v3 bundle API';
  }
  const commandCount = Number(value.request?.commandCount ?? 0);
  if (!Number.isFinite(commandCount) || commandCount <= 0) {
    return 'live execution artifact does not include a command payload count';
  }
  if (requestMode === 'dry_run' && !simpleHouseRequestProof(value, context).ok) {
    return 'live dry-run artifact does not include simple-house command intent proof';
  }
  if (requestMode === 'commit') {
    const changedIds = collectChangedIds(value);
    if (!changedIds.length) {
      return 'live commit artifact does not include changed ids';
    }
    const hasCommitResponseProof =
      value.response?.applied === true ||
      value.response?.newRevision !== null ||
      changedIds.length > 0 ||
      value.response?.checkpointSnapshotId;
    if (!hasCommitResponseProof) {
      return 'live commit artifact does not include mutation proof';
    }
    if (
      value.postCommit?.commandLog?.ok !== true ||
      Number(value.postCommit?.commandLog?.summary?.entryCount ?? 0) <= 0
    ) {
      return 'live commit artifact does not include a clean post-commit command-log summary';
    }
    if (
      value.postCommit?.snapshot?.ok !== true ||
      Number(value.postCommit?.snapshot?.summary?.elementCount ?? 0) <= 0
    ) {
      return 'live commit artifact does not include a clean post-commit snapshot summary';
    }
    const proof = changedSimpleHouseProof(value, context);
    if (!proof.ok) {
      return `live commit artifact does not include changed simple-house semantic proof: ${proof.reason}`;
    }
  }
  return '';
}

function executionOk(value, requestMode = null, context = value) {
  if (!value || typeof value !== 'object') return false;
  if (requestMode) return liveExecutionRejectionReason(value, requestMode, context) === '';
  return value.ok === true && liveExecutionRejectionReason(value, 'dry_run', context) === '';
}

function validationClean(validation) {
  if (!validation || typeof validation !== 'object') return false;
  if (validation.ok === false) return false;
  if (isBlockingEvidenceStatus(statusAt(validation, ['status', 'result', 'outcome']))) return false;
  const checks =
    validation.checks && typeof validation.checks === 'object' ? validation.checks : {};
  const blocking = Number(
    checks.blockingViolationCount ??
      checks.errorViolationCount ??
      validation.blockingViolationCount ??
      validation.errorViolationCount ??
      0,
  );
  if (Number.isFinite(blocking) && blocking > 0) return false;
  const violations = validation.violations;
  if (
    Array.isArray(violations) &&
    violations.some((item) => /error|blocking/i.test(item?.severity))
  ) {
    return false;
  }
  return true;
}

function advisorClean(advisor) {
  if (!advisor || typeof advisor !== 'object') return true;
  if (advisor.ok === false) return false;
  if (isBlockingEvidenceStatus(statusAt(advisor, ['status', 'result', 'outcome']))) return false;
  const summaryStatus = advisor.summary?.status;
  if (typeof summaryStatus === 'string' && /fail|error|block/i.test(summaryStatus)) return false;
  const findings = Array.isArray(advisor.findings) ? advisor.findings : [];
  return !findings.some((item) => /error|blocking/i.test(item?.severity ?? item?.level ?? ''));
}

function semanticDiffClean(diff) {
  if (Array.isArray(diff)) return diff.length === 0;
  if (!diff || typeof diff !== 'object') return false;
  if (diff.ok === true || diff.clean === true || diff.passed === true) return true;
  if (
    Number(diff.unmatchedFixtureCommandCount ?? 0) === 0 &&
    Number(diff.unexpectedReplayCommandCount ?? 0) === 0 &&
    diff.countDeltaByCommandType &&
    typeof diff.countDeltaByCommandType === 'object' &&
    Object.values(diff.countDeltaByCommandType).every((value) => Number(value) === 0)
  ) {
    return true;
  }
  const counts = [
    diff.mismatchCount,
    diff.differenceCount,
    diff.deltaCount,
    diff.failures,
    diff.errors,
  ].filter((value) => value !== undefined);
  if (counts.length && counts.every((value) => Number(value) === 0)) return true;
  const differences = diff.differences ?? diff.diffs ?? diff.items;
  return Array.isArray(differences) && differences.length === 0;
}

function visualEvidenceClean(value, context = value) {
  if (!value || typeof value !== 'object') return false;
  if (/^(unavailable|invalid|failed|blank-artifact)$/i.test(statusAt(value))) return false;
  if (value.stale === true || value.isStale === true || value.fresh === false) return false;
  if (!changedSimpleHouseProof(value, context).ok) return false;
  const raster =
    value.sheetPrintRaster && typeof value.sheetPrintRaster === 'object'
      ? value.sheetPrintRaster
      : value;
  if (/^(unavailable|invalid|failed|blank-artifact)$/i.test(statusAt(raster))) return false;
  if (raster.pass === false || raster.ok === false || raster.nonblankProof?.ok === false) {
    return false;
  }
  const rasterText = JSON.stringify(raster);
  if (/stub|mock/i.test(rasterText)) {
    return false;
  }
  if (value.nonblankProof?.ok === true || value.sheetPrintRaster?.nonblankProof?.ok === true) {
    return true;
  }
  if (
    value.ok === true &&
    /nonblank|server-side-substitute|render|screenshot/i.test(JSON.stringify(value))
  ) {
    return true;
  }
  return false;
}

function exportEvidenceClean(value, context = value) {
  if (!value || typeof value !== 'object') return false;
  if (/^(unavailable|invalid|failed|blank-artifact)$/i.test(statusAt(value))) return false;
  if (!changedSimpleHouseProof(value, context).ok) return false;
  const candidates = [
    ...Object.values(value.manifests ?? {}),
    ...Object.values(value.artifacts ?? {}),
    value,
  ].filter((candidate) => candidate && typeof candidate === 'object');
  return candidates.some((candidate) => {
    const text = JSON.stringify(candidate);
    return (
      /artifact-returned|manifest-returned|artifact-or-manifest-returned/i.test(text) &&
      !/stub|mock|placeholder|todo|blank-artifact|invalid|failed/i.test(text)
    );
  });
}

function committedAdvisorValidationClean(value, context = value) {
  if (!value || typeof value !== 'object') return false;
  if (value.ok === false) return false;
  if (isBlockingEvidenceStatus(statusAt(value))) return false;
  if (!changedSimpleHouseProof(value, context).ok) return false;
  if (value.validationPass === true && value.advisorPass === true) return true;
  if (value.validationResult?.pass === true && value.advisorResult?.pass === true) return true;
  return validationClean(value.validation) && advisorClean(value.advisor);
}

function committedAdvisorValidationRejectionReason(value, context = value) {
  if (!value || typeof value !== 'object') {
    return 'committed advisor/validation artifact is missing or invalid';
  }
  if (value.ok === false) return 'committed advisor/validation artifact reports ok=false';
  const status = statusAt(value);
  if (isBlockingEvidenceStatus(status)) return evidenceRejectionReason(status);
  if (value.validationPass === false || value.validationResult?.pass === false) {
    return 'committed validation evidence did not pass';
  }
  if (value.advisorPass === false || value.advisorResult?.pass === false) {
    return 'committed advisor evidence did not pass';
  }
  const proof = changedSimpleHouseProof(value, context);
  if (!proof.ok) {
    return `committed advisor/validation artifact does not include changed simple-house semantic proof: ${proof.reason}`;
  }
  return 'committed advisor/validation artifact is not clean';
}

function visualEvidenceRejectionReason(value, context = value) {
  if (!value || typeof value !== 'object') return 'visual/render artifact is missing or invalid';
  const raster =
    value.sheetPrintRaster && typeof value.sheetPrintRaster === 'object'
      ? value.sheetPrintRaster
      : value;
  if (/^(unavailable|invalid|failed|blank-artifact)$/i.test(statusAt(raster))) {
    return evidenceRejectionReason(statusAt(raster));
  }
  if (raster.pass === false || raster.ok === false || raster.nonblankProof?.ok === false) {
    return 'visual/render artifact is blank, invalid, or failed';
  }
  const rasterText = JSON.stringify(raster);
  if (/stub|mock/i.test(rasterText)) return 'visual/render artifact is a stub or mocked raster';
  const proof = changedSimpleHouseProof(value, context);
  if (!proof.ok) {
    return `visual/render artifact does not include changed simple-house semantic proof: ${proof.reason}`;
  }
  return 'visual/render artifact does not include clean nonblank proof';
}

function exportEvidenceRejectionReason(value, context = value) {
  if (!value || typeof value !== 'object') return 'export artifact is missing or invalid';
  if (/^(unavailable|invalid|failed|blank-artifact)$/i.test(statusAt(value))) {
    return evidenceRejectionReason(statusAt(value));
  }
  if (/stub|mock/i.test(JSON.stringify(value))) return 'export artifact is a stub or mock';
  const proof = changedSimpleHouseProof(value, context);
  if (!proof.ok) {
    return `export artifact does not include changed simple-house semantic proof: ${proof.reason}`;
  }
  return 'export artifact/manifest evidence is unavailable or not clean';
}

function topLevelUiEvidenceBlocked(value) {
  const statuses = [
    value?.status,
    value?.pathKind,
    value?.auditClassification,
    value?.parityClaim,
    value?.freshness,
  ].filter((item) => typeof item === 'string');
  return statuses.some((status) => isBlockingEvidenceStatus(status));
}

function uiEquivalentEvidenceClean(value) {
  if (!value || typeof value !== 'object') return false;
  if (value.ok === false || value.uiEquivalentEvidence === false) return false;
  if (topLevelUiEvidenceBlocked(value)) return false;
  const status = String(value.status ?? value.pathKind ?? value.auditClassification ?? '');
  const explicitlyValidated =
    value.uiEquivalentEvidence === true ||
    /validated[-_\s]?replay|executable|passed|passing|clean|done/i.test(status);
  if (!explicitlyValidated) return false;
  const semanticDiff =
    value.semanticDiff ?? value.semanticReplayDiff ?? value.diff ?? value.replayDiff ?? null;
  if (!semanticDiffClean(semanticDiff)) return false;
  const rows = Array.isArray(value.cmdKBridgeCoverage?.rows) ? value.cmdKBridgeCoverage.rows : [];
  return !rows.some(
    (row) =>
      /blocked|activator/i.test(String(row.bridgeStatus ?? '')) &&
      row.completedByCmdK === true &&
      row.exactFixturePayloadExecutable !== false,
  );
}

function collectJsonEvidenceSignals(value, source) {
  if (!value || typeof value !== 'object') return [];
  const signals = [];
  const sourceName = path.basename(source);
  const statusText = JSON.stringify(value).slice(0, 50000);
  const execution =
    value.executionEvidence && typeof value.executionEvidence === 'object'
      ? value.executionEvidence
      : value;
  const liveDryRun =
    execution.liveDryRun && typeof execution.liveDryRun === 'object'
      ? execution.liveDryRun
      : execution;
  const liveCommit =
    execution.liveCommit && typeof execution.liveCommit === 'object'
      ? execution.liveCommit
      : execution;

  if (/execution-evidence|live-dry-run-evidence|benchmark-result/i.test(sourceName)) {
    const mode = String(liveDryRun.mode ?? execution.mode ?? value.mode ?? '');
    if (/live/i.test(mode) && /dry[-_\s]?run/i.test(mode)) {
      const requestProof = simpleHouseRequestProof(liveDryRun, value);
      const passes = executionOk(liveDryRun, 'dry_run', value);
      addEvidenceSignal(
        signals,
        'liveDryRunEvidence',
        passes ? 'live-dry-run-clean' : statusAt(liveDryRun) || mode,
        source,
        mode,
        {
          passes,
          reason: passes ? '' : liveExecutionRejectionReason(liveDryRun, 'dry_run', value),
          proof: passes
            ? {
                simpleHouseRequestProof: true,
                commandCount: requestProof.commandCount,
                commandTypes: requestProof.commandTypes,
              }
            : undefined,
        },
      );
    }
  }

  if (/execution-evidence|live-commit-evidence|benchmark-result/i.test(sourceName)) {
    const mode = String(liveCommit.mode ?? execution.mode ?? value.mode ?? '');
    if (/live/i.test(mode) && /commit/i.test(mode)) {
      const proof = changedSimpleHouseProof(liveCommit, value);
      const passes = executionOk(liveCommit, 'commit', value);
      addEvidenceSignal(
        signals,
        'liveCommitEvidence',
        passes ? 'live-commit-clean' : statusAt(liveCommit) || mode,
        source,
        mode,
        {
          passes,
          reason: passes ? '' : liveExecutionRejectionReason(liveCommit, 'commit', value),
          proof: passes
            ? {
                changedSimpleHouseModel: true,
                changedIds: proof.changedIds,
                counts: proof.counts,
                source: proof.source,
              }
            : undefined,
        },
      );
    }
  }

  if (/committed-evidence|advisor-validation|benchmark-result/i.test(sourceName)) {
    const committed =
      value.committedEvidence && typeof value.committedEvidence === 'object'
        ? value.committedEvidence
        : value;
    const committedMode = String(committed.mode ?? '');
    if (
      /committed|post[-_\s]?commit/i.test(`${committedMode} ${statusText}`) ||
      /advisor-validation/i.test(sourceName)
    ) {
      const proof = changedSimpleHouseProof(committed, value);
      const passes = committedAdvisorValidationClean(committed, value);
      addEvidenceSignal(
        signals,
        'committedAdvisorValidation',
        passes ? 'committed-advisor-validation-clean' : statusAt(committed) || 'committed-evidence',
        source,
        committedMode || 'committed advisor/validation artifact',
        {
          passes,
          reason: passes ? '' : committedAdvisorValidationRejectionReason(committed, value),
          proof: passes
            ? {
                changedSimpleHouseModel: true,
                changedIds: proof.changedIds,
                counts: proof.counts,
                source: proof.source,
              }
            : undefined,
        },
      );
    }
  }

  if (/visual|render|screenshot|committed-evidence|benchmark-result/i.test(sourceName)) {
    const visual = value.visual ?? value.committedEvidence?.visual ?? value;
    const claimsVisual = /visual|render|screenshot|nonblank|sheetPrintRaster/i.test(
      `${sourceName} ${statusText}`,
    );
    if (claimsVisual) {
      const proof = changedSimpleHouseProof(visual, value);
      const passes = visualEvidenceClean(visual, value);
      addEvidenceSignal(
        signals,
        'visualRenderEvidence',
        passes ? 'visual-render-clean' : statusAt(visual) || 'visual-evidence',
        source,
        'visual/render evidence artifact',
        {
          passes,
          reason: passes ? '' : visualEvidenceRejectionReason(visual, value),
          proof: passes
            ? {
                changedSimpleHouseModel: true,
                changedIds: proof.changedIds,
                counts: proof.counts,
                source: proof.source,
              }
            : undefined,
        },
      );
    }
  }

  if (/export|committed-evidence|benchmark-result/i.test(sourceName)) {
    const exports = value.exports ?? value.committedEvidence?.exports ?? value;
    const claimsExport = /export|ifc|gltf|glb|pdf|manifest|artifact/i.test(
      `${sourceName} ${statusText}`,
    );
    if (claimsExport) {
      const proof = changedSimpleHouseProof(exports, value);
      const passes = exportEvidenceClean(exports, value);
      addEvidenceSignal(
        signals,
        'exportEvidence',
        passes ? 'export-clean' : statusAt(exports) || 'export-evidence',
        source,
        'export evidence artifact',
        {
          passes,
          reason: passes ? '' : exportEvidenceRejectionReason(exports, value),
          proof: passes
            ? {
                changedSimpleHouseModel: true,
                changedIds: proof.changedIds,
                counts: proof.counts,
                source: proof.source,
              }
            : undefined,
        },
      );
    }
  }

  if (/ui-cmdk-traceability|ui-equivalence|ui-equivalent/i.test(sourceName)) {
    const ui =
      value.uiEquivalence && typeof value.uiEquivalence === 'object' ? value.uiEquivalence : value;
    const pathKind = String(ui.pathKind ?? ui.kind ?? ui.mode ?? ui.status ?? '');
    const semanticDiff =
      ui.semanticDiff ??
      ui.semanticReplayDiff ??
      value.semanticDiff ??
      value.semanticReplayDiff ??
      ui.diff ??
      value.diff;
    const hasBlockers =
      (Array.isArray(ui.remainingUiBlockers) && ui.remainingUiBlockers.length > 0) ||
      (Array.isArray(ui.blockers) && ui.blockers.length > 0) ||
      (Array.isArray(ui.todos) && ui.todos.length > 0) ||
      (Array.isArray(ui.remainingExitCriteria) && ui.remainingExitCriteria.length > 0);
    const passes = uiEquivalentEvidenceClean(ui);
    addEvidenceSignal(
      signals,
      'uiEquivalentPath',
      passes ? 'ui-equivalence-clean' : pathKind || statusAt(ui) || 'ui-equivalence',
      source,
      semanticDiff === undefined ? 'missing semantic diff' : 'semantic diff checked',
      {
        passes,
        reason: passes
          ? ''
          : hasBlockers
            ? 'UI-equivalence artifact still lists blockers or TODOs'
            : 'UI-equivalence artifact is not executable, clean, and semantically equal',
      },
    );
  }
  return signals;
}

function flattenEvidenceExpectations(value, prefix = '') {
  if (!value || typeof value !== 'object') return [];
  if (Array.isArray(value)) return [];
  const rows = [];
  for (const [key, child] of Object.entries(value)) {
    const id = prefix ? `${prefix}.${key}` : key;
    if (child === true || child === false) {
      rows.push({ id, status: String(child), todo: '' });
    } else if (child && typeof child === 'object') {
      if ('status' in child || 'todo' in child) {
        rows.push({
          id,
          status: String(child.status ?? 'declared'),
          todo: String(child.todo ?? ''),
        });
        continue;
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
          {
            passes: false,
            reason: 'expected-semantics metadata is documentation, not live dry-run evidence',
          },
        );
      }
      if (/live[-_\s]?commit/i.test(row.id)) {
        addEvidenceSignal(
          evidenceSignals,
          'liveCommitEvidence',
          row.status,
          expectedPath,
          row.todo,
          {
            passes: false,
            reason: 'expected-semantics metadata is documentation, not live commit evidence',
          },
        );
      }
      if (/advisor|validation|constructability/i.test(row.id)) {
        addEvidenceSignal(
          evidenceSignals,
          'committedAdvisorValidation',
          row.status,
          expectedPath,
          row.todo,
          {
            passes: false,
            reason:
              'expected-semantics metadata is documentation, not committed advisor/validation evidence',
          },
        );
      }
      if (/screenshot|visual|render/i.test(row.id)) {
        addEvidenceSignal(
          evidenceSignals,
          'visualRenderEvidence',
          row.status,
          expectedPath,
          row.todo,
          {
            passes: false,
            reason: 'expected-semantics metadata is documentation, not visual/render evidence',
          },
        );
      }
      if (/export|ifc|gltf|glb|pdf/i.test(row.id)) {
        addEvidenceSignal(evidenceSignals, 'exportEvidence', row.status, expectedPath, row.todo, {
          passes: false,
          reason: 'expected-semantics metadata is documentation, not export evidence',
        });
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
          {
            passes: false,
            reason: 'benchmark path metadata is not a clean live dry-run artifact',
          },
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
          {
            passes: false,
            reason: 'benchmark path metadata is not a clean live commit artifact',
          },
        );
      }
      if (/ui/i.test(row.id)) {
        addEvidenceSignal(evidenceSignals, 'uiEquivalentPath', row.status, expectedPath, row.todo, {
          passes: false,
          reason: 'benchmark path metadata is not executable UI-equivalence evidence',
        });
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
        {
          passes: false,
          reason: 'benchmark liveDryRun metadata is optional configuration, not run evidence',
        },
      );
    }
    const artifactPaths = [
      ...new Set([
        ...listBenchmarkEvidenceFiles(dir),
        ...listGeneratedEvidenceFilesForBenchmark(expected.benchmarkId ?? path.basename(dir)),
      ]),
    ].sort();
    for (const relPath of artifactPaths) {
      evidenceSignals.push(...collectJsonEvidenceSignals(parseJsonFile(relPath), relPath));
    }
    return {
      id: expected.benchmarkId ?? path.basename(dir),
      dir,
      expectedSemantics: fs.existsSync(path.join(ROOT, expectedPath)) ? expectedPath : '',
      commandBundle: fs.existsSync(path.join(ROOT, bundlePath)) ? bundlePath : '',
      pathStatus: pathRows,
      evidenceExpectations: evidenceRows,
      evidenceArtifactPaths: artifactPaths,
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

function descriptorMatchesStableId(row, id) {
  return [row.id, row.stableId].some((value) => normalizedId(value) === normalizedId(id));
}

function statusFromGates(gates) {
  if (gates.every((gate) => gate.passed)) return 'Done';
  if (gates.some((gate) => gate.status === 'partial' || gate.passed)) return 'Partial';
  return 'Not Started';
}

function m3Gate(id, label, passed, blocker, evidence = [], partial = false) {
  return {
    id,
    label,
    status: passed ? 'passed' : partial ? 'partial' : 'blocked',
    passed,
    blocker: passed ? '' : blocker,
    evidence,
  };
}

function sketchSurfaceEvidence(apiLedger, surfaceId) {
  const descriptor = apiLedger.find((row) => descriptorMatchesStableId(row, surfaceId));
  if (descriptor) {
    return {
      type: 'api-descriptor',
      status: descriptor.routeImplemented ? 'implemented' : 'route-mismatch',
      source: descriptor.source,
      detail: `${descriptor.id} -> ${descriptor.method} ${descriptor.path}`,
      passes: descriptor.routeImplemented,
    };
  }

  const productMap = read('spec/sketch-to-bim-product-surfaces.md');
  const text = productMap.toLowerCase();
  const mentionsSurface = text.includes(surfaceId.toLowerCase());
  const mentionsCli =
    (surfaceId === 'sketch.ir.validate' && /initiation-check|initiation-run/.test(text)) ||
    (surfaceId === 'sketch.seed.compile' && /seed-dsl compile/.test(text)) ||
    (surfaceId === 'sketch.phase.apply' && /apply-bundle/.test(text)) ||
    (surfaceId === 'sketch.phase.accept' && /fail-on-acceptance|phase acceptance/.test(text));

  return {
    type: 'product-map',
    status: mentionsCli || mentionsSurface ? 'cli-or-gap-documented' : 'missing',
    source: 'spec/sketch-to-bim-product-surfaces.md',
    detail:
      mentionsCli || mentionsSurface
        ? 'Product map documents a CLI/generic path or explicit gap, but no stable API/MCP descriptor was detected.'
        : 'No product descriptor, CLI mapping, or blocker text was detected.',
    passes: false,
  };
}

function buildM3SketchWorkstream(apiLedger) {
  const config = M3_WAVE2_WORKSTREAMS.find((row) => row.id === 'M3-F');
  const gates = config.requiredSurfaces.map((surfaceId) => {
    const evidence = [sketchSurfaceEvidence(apiLedger, surfaceId)];
    const passed = evidence.some((item) => item.passes);
    return m3Gate(
      surfaceId,
      surfaceId,
      passed,
      `No implemented stable API/MCP descriptor was detected for ${surfaceId}. CLI-only or product-map entries remain Partial evidence.`,
      evidence,
      evidence.some((item) => item.status !== 'missing'),
    );
  });
  return {
    id: config.id,
    label: config.label,
    status: statusFromGates(gates),
    gatesPassed: gates.filter((gate) => gate.passed).length,
    gatesExpected: gates.length,
    gates,
  };
}

function scenarioEvidenceStatus(scenario, key) {
  const section = scenario?.evidence?.[key];
  if (!section || typeof section !== 'object') return 'missing';
  if (section.pass === true) return 'passed';
  if (['executable', 'validated-replay'].includes(section.classification)) return 'passed';
  if (isBlockingEvidenceStatus(`${section.classification ?? ''} ${section.status ?? ''}`)) {
    return section.classification === 'traceability-only' ? 'partial' : 'missing';
  }
  if (isPositiveEvidenceStatus(section.status)) return 'passed';
  if (section.classification === 'traceability-only') return 'partial';
  if ((section.artifacts ?? []).length) return 'partial';
  return 'missing';
}

function twoStoreyArtifactPath(name) {
  return `spec/benchmarks/two-storey-house-with-stair/${name}`;
}

function explicitClosurePass(value, kind) {
  const candidates = [
    value?.m3Closure?.[kind],
    value?.m3Closure?.[kind === 'cmdK' ? 'cmdk' : kind],
    value?.[`${kind}Closure`],
    kind === 'cmdK' ? value?.cmdkClosure : null,
    kind === 'ui' ? value?.uiReplay : null,
    kind === 'cmdK' ? value?.cmdKBridgeCoverage?.closure : null,
  ].filter(Boolean);
  return candidates.some(
    (candidate) =>
      candidate.pass === true ||
      candidate.passed === true ||
      candidate.semanticFixtureEquivalent === true ||
      candidate.exactFixtureSemanticEquivalence === true,
  );
}

function blockerList(value, kind) {
  const specific =
    kind === 'cmdK'
      ? [
          ...(value?.remainingCmdKBlockers ?? []),
          ...(value?.cmdKBridgeCoverage?.blockedOrUnmappedCommandTypes ?? []),
        ]
      : [...(value?.remainingUiBlockers ?? []), ...(value?.remainingUiReplayBlockers ?? [])];
  const generic = [
    ...(value?.blockers ?? []),
    ...(value?.todos ?? []),
    ...(value?.remainingExitCriteria ?? []),
  ];
  return [...specific, ...generic].filter(Boolean);
}

function uiValidatedReplayClean(value) {
  if (!value || typeof value !== 'object') return false;
  if (isBlockingEvidenceStatus(`${value.classification ?? ''} ${value.status ?? ''}`)) return false;
  if (!/validated[-_\s]?replay|executable|passed|passing|clean|done/i.test(value.classification)) {
    return false;
  }
  const proof = value.proof ?? {};
  const fixtureCount = Number(proof.fixtureCommandCount ?? 0);
  const replayCount = Number(proof.replayCommandCount ?? 0);
  return (
    fixtureCount > 0 &&
    fixtureCount === replayCount &&
    proof.fixtureCommandSequenceSha256 &&
    proof.fixtureCommandSequenceSha256 === proof.replayCommandSequenceSha256 &&
    Number(proof.sequenceMismatchCount ?? 0) === 0 &&
    Number(proof.unmatchedFixtureCommandCount ?? 0) === 0 &&
    Number(proof.unexpectedReplayCommandCount ?? 0) === 0 &&
    (!Array.isArray(proof.payloadDigestMismatches) || proof.payloadDigestMismatches.length === 0) &&
    Array.isArray(value.inputMapping) &&
    value.inputMapping.length === fixtureCount
  );
}

function twoStoreyUiClosureEvidence(kind) {
  const equivalencePath = twoStoreyArtifactPath('ui-equivalence.json');
  const uiReplayPath = twoStoreyArtifactPath('ui-validated-replay.json');
  const tracePath = twoStoreyArtifactPath('ui-cmdk-traceability.json');
  const equivalence = parseJsonFile(equivalencePath);
  const uiReplay = parseJsonFile(uiReplayPath);
  const traceability = parseJsonFile(tracePath);
  if (!equivalence) {
    return {
      type: 'two-storey-closure',
      status: 'missing',
      source: equivalencePath,
      detail: `${kind} closure evidence artifact is missing.`,
      passes: false,
      reason: `${equivalencePath} is missing.`,
    };
  }

  const uiReplayClean = uiValidatedReplayClean(uiReplay);
  const status = String(
    kind === 'ui' && uiReplay
      ? (uiReplay.classification ?? uiReplay.status ?? '')
      : (equivalence.auditClassification ?? equivalence.pathKind ?? equivalence.status ?? ''),
  );
  const semanticDiff =
    equivalence.semanticDiff ??
    equivalence.semanticReplayDiff ??
    equivalence.diff ??
    equivalence.replayDiff;
  const semanticClean = semanticDiffClean(semanticDiff);
  const topLevelBlocked = topLevelUiEvidenceBlocked(equivalence);
  const blockers =
    kind === 'ui' && uiReplayClean ? blockerList(uiReplay, kind) : blockerList(equivalence, kind);
  const rows = Array.isArray(equivalence.cmdKBridgeCoverage?.rows)
    ? equivalence.cmdKBridgeCoverage.rows
    : [];
  const fixtureCommandTypesTotal = Number(
    equivalence.cmdKBridgeCoverage?.fixtureCommandTypesTotal ?? rows.length,
  );
  const exactCmdKRows = rows.filter(
    (row) => row.completedByCmdK === true && row.exactFixturePayloadExecutable === true,
  );
  const directPayloadCoversCommandTypes = Array.isArray(
    equivalence.cmdKBridgeCoverage?.directPayloadCoversCommandTypes,
  )
    ? equivalence.cmdKBridgeCoverage.directPayloadCoversCommandTypes
    : [];
  const exactCmdKCount = Number(
    equivalence.cmdKBridgeCoverage?.exactUiExecutableOperationCount ?? exactCmdKRows.length,
  );
  const allCmdKTypesClosed =
    fixtureCommandTypesTotal > 0 &&
    exactCmdKRows.length === fixtureCommandTypesTotal &&
    exactCmdKCount >= fixtureCommandTypesTotal;
  const directPayloadTypesClosed =
    fixtureCommandTypesTotal > 0 &&
    directPayloadCoversCommandTypes.length >= fixtureCommandTypesTotal &&
    (equivalence.cmdKBridgeCoverage?.directPayloadCommandIds ?? []).length > 0;
  const validation = equivalence.validation ?? {};
  const uiValidated =
    validation.browserAuthoredModel === true ||
    validation.exactNumericUiInputExecutable === true ||
    validation.uiValidatedReplay === true ||
    validation.exactFixtureSemanticEquivalence === true ||
    uiReplayClean ||
    explicitClosurePass(equivalence, 'ui');
  const cmdKValidated =
    explicitClosurePass(equivalence, 'cmdK') ||
    allCmdKTypesClosed ||
    directPayloadTypesClosed ||
    equivalence.cmdKBridgeCoverage?.directPayloadBridge === true ||
    equivalence.cmdKBridgeCoverage?.validatedReplay === true;
  const basePass =
    /validated[-_\s]?replay|executable|passed|passing|clean|done/i.test(status) &&
    (semanticClean || (kind === 'ui' && uiReplayClean)) &&
    (kind === 'ui' && uiReplayClean ? true : !topLevelBlocked) &&
    blockers.length === 0;
  const passes = kind === 'cmdK' ? basePass && cmdKValidated : basePass && uiValidated;
  const reasonParts = [];
  if (!/validated[-_\s]?replay|executable|passed|passing|clean|done/i.test(status)) {
    reasonParts.push(`status is ${status || 'missing'}`);
  }
  if (!semanticClean && !(kind === 'ui' && uiReplayClean)) {
    reasonParts.push('semantic replay diff is missing or not clean');
  }
  if (topLevelBlocked && !(kind === 'ui' && uiReplayClean)) {
    reasonParts.push('top-level status still contains blocking terms');
  }
  if (blockers.length) reasonParts.push(`${blockers.length} ${kind} blocker(s) remain`);
  if (kind === 'ui' && !uiValidated) {
    reasonParts.push('no browser-authored, exact numeric, or explicit M3-Q UI replay proof');
  }
  if (kind === 'cmdK' && !cmdKValidated) {
    reasonParts.push(
      'no direct payload bridge, exact Cmd+K fixture coverage, or explicit M3-R replay proof',
    );
  }
  return {
    type: 'two-storey-closure',
    status: passes ? `${kind}-closure-clean` : status || 'missing',
    source: kind === 'ui' && uiReplayClean ? uiReplayPath : equivalencePath,
    detail: [
      `${kind} closure`,
      `semanticDiff=${semanticClean || (kind === 'ui' && uiReplayClean) ? 'clean' : 'blocked'}`,
      `traceability=${traceability?.pathKind ?? traceability?.latestMachineReadableStatus ?? 'missing'}`,
      blockers.length ? `blockers=${blockers.slice(0, 5).join('; ')}` : 'blockers=none',
    ].join('; '),
    passes,
    reason: passes ? '' : reasonParts.join('; '),
    proof: passes
      ? {
          twoStoreySemanticFixtureEquivalent: true,
          kind,
          sourceWorkstream: kind === 'cmdK' ? 'M3-R' : 'M3-Q',
          replayCommandCount:
            kind === 'ui' && uiReplayClean
              ? Number(uiReplay.proof?.replayCommandCount ?? 0)
              : undefined,
          exactCmdKCommandTypes: Math.max(
            exactCmdKRows.length,
            directPayloadCoversCommandTypes.length,
          ),
          fixtureCommandTypesTotal,
        }
      : undefined,
  };
}

function twoStoreyEvidenceSignal(scenario, scenarioPath, kind) {
  if (kind === 'ui' || kind === 'cmdK') return twoStoreyUiClosureEvidence(kind);
  const status = scenarioEvidenceStatus(scenario, kind);
  return {
    type: 'scenario-evidence',
    status,
    source: scenarioPath,
    detail: `${kind}: ${scenario?.evidence?.[kind]?.classification ?? 'missing'} / ${
      scenario?.evidence?.[kind]?.status ?? 'missing'
    }`,
    passes: status === 'passed',
  };
}

function buildM3BenchmarkWorkstream() {
  const config = M3_WAVE2_WORKSTREAMS.find((row) => row.id === 'M3-G');
  const scenarioPath = `spec/benchmarks/${config.scenarioId}/scenario.json`;
  const scenario = parseJsonFile(scenarioPath);
  const hasScenario = Boolean(scenario);
  const fixtures = scenario?.fixtures ?? {};
  const runner = scenario?.runner ?? {};
  const requiredFixtureKeys = [
    'expectedSemantics',
    'mcpCliCommandBundle',
    'uiCmdKTraceability',
    'uiEquivalence',
    'liveEvidenceDirectory',
  ];
  const fixtureEvidence = requiredFixtureKeys.map((key) => ({
    type: 'scenario-fixture',
    status: fixtures[key] ? 'declared' : 'missing',
    source: scenarioPath,
    detail: `${key}: ${fixtures[key] ?? 'missing'}`,
    passes: Boolean(fixtures[key]),
  }));
  const evidenceKinds = ['ui', 'cmdK', 'mcpCli', 'advisor', 'visual', 'export', 'semanticDiff'];
  const evidenceSignals = evidenceKinds.map((kind) =>
    twoStoreyEvidenceSignal(scenario, scenarioPath, kind),
  );
  const gates = [
    m3Gate(
      'scenario-present',
      'Scenario spec present',
      hasScenario,
      `${scenarioPath} is missing.`,
      [
        {
          type: 'scenario',
          status: hasScenario ? 'present' : 'missing',
          source: scenarioPath,
          detail: scenario?.summary ?? '',
          passes: hasScenario,
        },
      ],
    ),
    m3Gate(
      'runner-executable',
      'Executable benchmark runner',
      runner.kind && runner.kind !== 'not-yet-implemented' && Boolean(runner.command),
      'Two-storey benchmark runner is not executable yet.',
      [
        {
          type: 'scenario-runner',
          status: runner.kind ?? 'missing',
          source: scenarioPath,
          detail: runner.command ?? 'no command',
          passes: runner.kind && runner.kind !== 'not-yet-implemented' && Boolean(runner.command),
        },
      ],
      hasScenario,
    ),
    m3Gate(
      'fixture-set',
      'Expected semantics and fixture artifacts',
      fixtureEvidence.every((item) => item.passes),
      'Two-storey benchmark expected semantics, MCP/CLI bundle, UI traceability, UI equivalence, or live evidence directory is missing.',
      fixtureEvidence,
      fixtureEvidence.some((item) => item.passes),
    ),
    m3Gate(
      'evidence-set',
      'Executable evidence set',
      evidenceSignals.every((item) => item.passes),
      'Two-storey benchmark lacks passing UI/Cmd+K, MCP/CLI, advisor, visual, export, or semantic-diff evidence.',
      evidenceSignals,
      evidenceSignals.some((item) => item.status === 'partial' || item.passes),
    ),
  ];
  return {
    id: config.id,
    label: config.label,
    status: statusFromGates(gates),
    gatesPassed: gates.filter((gate) => gate.passed).length,
    gatesExpected: gates.length,
    scenarioId: config.scenarioId,
    gates,
  };
}

function exportManifestKindPass(exportEvidence, key) {
  return exportEvidence?.manifests?.[key]?.pass === true;
}

function exportArtifactPass(exportEvidence, key) {
  return exportEvidence?.artifacts?.[key]?.pass === true;
}

function exportArtifactStatus(exportEvidence, key) {
  return (
    exportEvidence?.artifacts?.[key]?.status ??
    exportEvidence?.manifests?.[key]?.status ??
    'missing-or-failed'
  );
}

function exportedDocCounts(exportEvidence) {
  return (
    exportEvidence?.manifests?.gltf?.summary?.geometryProof?.counts?.counts ??
    exportEvidence?.manifests?.gltf?.body?.extensions?.BIM_AI_exportManifest_v0?.countsByKind ??
    {}
  );
}

function buildM3DocumentationExportWorkstream(apiLedger) {
  const config = M3_WAVE2_WORKSTREAMS.find((row) => row.id === 'M3-H');
  const descriptorEvidence = config.requiredDescriptors.map((id) => {
    const descriptor = apiLedger.find((row) => descriptorMatchesStableId(row, id));
    return {
      type: 'api-descriptor',
      status: descriptor
        ? descriptor.routeImplemented
          ? 'implemented'
          : 'route-mismatch'
        : 'missing',
      source: descriptor?.source ?? SOURCES.apiRegistry,
      detail: descriptor ? `${descriptor.id} -> ${descriptor.method} ${descriptor.path}` : id,
      passes: Boolean(descriptor?.routeImplemented),
    };
  });
  const exportEvidencePath =
    'spec/benchmarks/simple-single-storey-house/live-evidence/export-evidence.json';
  const exportEvidence = parseJsonFile(exportEvidencePath);
  const counts = exportedDocCounts(exportEvidence);
  const countSignals = ['sheet', 'schedule', 'placed_tag', 'dimension'].map((kind) => ({
    type: 'export-count',
    status: Number(counts[kind] ?? 0) > 0 ? 'present' : 'missing',
    source: exportEvidencePath,
    detail: `${kind}: ${counts[kind] ?? 0}`,
    passes: Number(counts[kind] ?? 0) > 0,
  }));
  const artifactSignals = [
    {
      type: 'export-artifact',
      status: exportManifestKindPass(exportEvidence, 'gltf') ? 'passed' : 'missing-or-failed',
      source: exportEvidencePath,
      detail: 'glTF/GLB manifest evidence',
      passes: exportManifestKindPass(exportEvidence, 'gltf'),
    },
    {
      type: 'export-artifact',
      status: exportManifestKindPass(exportEvidence, 'ifc') ? 'passed' : 'missing-or-failed',
      source: exportEvidencePath,
      detail: 'IFC manifest evidence',
      passes: exportManifestKindPass(exportEvidence, 'ifc'),
    },
    {
      type: 'export-artifact',
      status: exportArtifactPass(exportEvidence, 'sheetPdf') ? 'passed' : 'missing-or-failed',
      source: exportEvidencePath,
      detail: 'Sheet PDF artifact evidence',
      passes: exportArtifactPass(exportEvidence, 'sheetPdf'),
    },
  ];
  const gates = [
    m3Gate(
      'descriptor-pack',
      'Documentation/export descriptor pack',
      descriptorEvidence.every((item) => item.passes),
      'One or more documentation/export API descriptors are missing or route-mismatched.',
      descriptorEvidence,
      descriptorEvidence.some((item) => item.passes),
    ),
    m3Gate(
      'document-artifact-counts',
      'Sheet, schedule, tag, and dimension evidence',
      countSignals.every((item) => item.passes),
      'Export evidence does not include sheet, schedule, tag, and dimension counts.',
      countSignals,
      countSignals.some((item) => item.passes),
    ),
    m3Gate(
      'export-artifacts',
      'PDF, IFC, and glTF/GLB artifacts',
      artifactSignals.every((item) => item.passes),
      'Production evidence must include clean PDF, IFC, and glTF/GLB export artifacts or manifests; PDF shells alone are not enough.',
      artifactSignals,
      artifactSignals.some((item) => item.passes),
    ),
  ];
  return {
    id: config.id,
    label: config.label,
    status: statusFromGates(gates),
    gatesPassed: gates.filter((gate) => gate.passed).length,
    gatesExpected: gates.length,
    gates,
  };
}

function buildM3TransactionWorkstream() {
  const commitEvidencePath =
    'spec/benchmarks/simple-single-storey-house/live-evidence/live-commit-evidence.json';
  const commandLogPath =
    'spec/benchmarks/simple-single-storey-house/live-evidence/command-log-summary.json';
  const commitEvidence = parseJsonFile(commitEvidencePath);
  const commandLog = parseJsonFile(commandLogPath);
  const latestLog =
    commandLog?.latest?.[0] ?? commitEvidence?.postCommit?.commandLog?.summary?.latest?.[0];
  const basicMetadata = [
    {
      key: 'parentRevision',
      value: commitEvidence?.revision?.parentRevision,
      source: commitEvidencePath,
    },
    {
      key: 'newRevision',
      value: commitEvidence?.revision?.newRevision ?? commitEvidence?.revision?.revision,
      source: commitEvidencePath,
    },
    {
      key: 'changedIds',
      value: Array.isArray(commitEvidence?.changedIds) ? commitEvidence.changedIds.length : 0,
      source: commitEvidencePath,
    },
    {
      key: 'agentIdentity',
      value: latestLog?.userId,
      source: commandLogPath,
    },
    {
      key: 'commandLogRevisionAfter',
      value: latestLog?.revisionAfter ?? commitEvidence?.revision?.commandLogRevisionAfter,
      source: commandLogPath,
    },
  ].map((item) => ({
    type: 'transaction-metadata',
    status:
      item.value === undefined || item.value === null || item.value === 0 ? 'missing' : 'present',
    source: item.source,
    detail: `${item.key}: ${item.value ?? 'missing'}`,
    passes: !(item.value === undefined || item.value === null || item.value === 0),
  }));
  const idempotencySignals = [
    {
      type: 'idempotency',
      status:
        commitEvidence?.idempotency?.pass === true ||
        commitEvidence?.transaction?.idempotency?.pass === true
          ? 'passed'
          : 'missing',
      source: commitEvidencePath,
      detail: 'clientOpId or bundle digest replay dedup proof',
      passes:
        commitEvidence?.idempotency?.pass === true ||
        commitEvidence?.transaction?.idempotency?.pass === true,
    },
    {
      type: 'stale-revision',
      status:
        commitEvidence?.staleRevisionProtection?.pass === true ||
        commitEvidence?.transaction?.staleRevisionProtection?.pass === true
          ? 'passed'
          : 'missing',
      source: commitEvidencePath,
      detail: 'stale parent revision rejection proof',
      passes:
        commitEvidence?.staleRevisionProtection?.pass === true ||
        commitEvidence?.transaction?.staleRevisionProtection?.pass === true,
    },
    {
      type: 'workflow-metadata',
      status:
        commitEvidence?.workflowMetadata?.m3SketchExportImportCoverage === true ||
        commitEvidence?.transaction?.workflowMetadata?.m3SketchExportImportCoverage === true
          ? 'passed'
          : 'missing',
      source: commitEvidencePath,
      detail: 'M3 sketch/export/import workflow metadata assertions',
      passes:
        commitEvidence?.workflowMetadata?.m3SketchExportImportCoverage === true ||
        commitEvidence?.transaction?.workflowMetadata?.m3SketchExportImportCoverage === true,
    },
  ];
  const gates = [
    m3Gate(
      'basic-transaction-metadata',
      'Parent revision, changed ids, agent, and command log metadata',
      basicMetadata.every((item) => item.passes),
      'Committed evidence does not include complete basic transaction metadata.',
      basicMetadata,
      basicMetadata.some((item) => item.passes),
    ),
    m3Gate(
      'idempotent-replay',
      'Idempotent replay and stale revision gates',
      idempotencySignals.every((item) => item.passes),
      'No clean clientOpId/bundle-digest replay dedup, stale revision protection, and M3 workflow metadata proof was detected.',
      idempotencySignals,
      idempotencySignals.some((item) => item.passes),
    ),
  ];
  return {
    id: 'M3-I',
    label: 'Transaction idempotency and workflow metadata',
    status: statusFromGates(gates),
    gatesPassed: gates.filter((gate) => gate.passed).length,
    gatesExpected: gates.length,
    gates,
  };
}

function buildM3Wave2(apiLedger) {
  const workstreams = [
    buildM3SketchWorkstream(apiLedger),
    buildM3BenchmarkWorkstream(),
    buildM3DocumentationExportWorkstream(apiLedger),
    buildM3TransactionWorkstream(),
  ];
  const gates = workstreams.flatMap((workstream) =>
    workstream.gates.map((gate) => ({
      workstreamId: workstream.id,
      workstreamLabel: workstream.label,
      ...gate,
    })),
  );
  const blockers = gates
    .filter((gate) => !gate.passed)
    .map((gate) => ({
      id: `${gate.workstreamId}:${gate.id}`,
      blocker: gate.blocker,
    }));
  const status = workstreams.every((workstream) => workstream.status === 'Done')
    ? 'Done'
    : workstreams.some((workstream) => workstream.status !== 'Not Started')
      ? 'Partial'
      : 'Not Started';
  return {
    status,
    workstreams,
    gates,
    blockers,
    summary: {
      status,
      workstreamStatusCounts: countBy(workstreams, (row) => row.status),
      gatesExpected: gates.length,
      gatesPassed: gates.filter((gate) => gate.passed).length,
      blockerCount: blockers.length,
    },
  };
}

function implementedDescriptorEvidence(apiLedger, ids, sourceFallback) {
  const descriptor = apiLedger.find((row) => ids.some((id) => descriptorMatchesStableId(row, id)));
  return {
    type: 'api-descriptor',
    status: descriptor
      ? descriptor.routeImplemented
        ? 'implemented'
        : 'route-mismatch'
      : 'missing',
    source: descriptor?.source ?? sourceFallback,
    detail: descriptor
      ? `${descriptor.id} -> ${descriptor.method} ${descriptor.path}`
      : `missing stable id: ${ids.join(' or ')}`,
    passes: Boolean(descriptor?.routeImplemented),
  };
}

function rawFallbackEvidence(backendLedger, commandIds, sourceFallback) {
  const matched = backendLedger.filter((row) =>
    commandIds.some((id) => row.backendCommands.includes(id)),
  );
  return {
    type: 'raw-fallback',
    status: matched.length ? 'raw-command-only' : 'missing',
    source: matched.map((row) => row.source).join(', ') || sourceFallback,
    detail: matched.length
      ? `${commandIds.join(', ')} exists through raw apply-bundle; no typed public descriptor matched.`
      : `${commandIds.join(', ')} not detected as backend fallback commands.`,
    passes: false,
  };
}

function buildM3VerticalCirculationWorkstream(apiLedger, backendLedger) {
  const config = M3_WAVE3_WORKSTREAMS.find((row) => row.id === 'M3-K');
  const gates = config.requiredSurfaceGroups.map((group) => {
    const descriptorEvidence = implementedDescriptorEvidence(
      apiLedger,
      group.acceptedStableIds,
      SOURCES.apiRegistry,
    );
    const fallbackEvidence = rawFallbackEvidence(
      backendLedger,
      group.rawFallbackCommands,
      SOURCES.commands,
    );
    return m3Gate(
      group.id,
      group.label,
      descriptorEvidence.passes,
      `${group.label} is not exposed as an implemented first-class API/MCP descriptor; raw bundle fallback is not enough for Wave 3 typed vertical-circulation parity.`,
      [descriptorEvidence, fallbackEvidence],
      fallbackEvidence.status !== 'missing',
    );
  });
  return {
    id: config.id,
    label: config.label,
    status: statusFromGates(gates),
    gatesPassed: gates.filter((gate) => gate.passed).length,
    gatesExpected: gates.length,
    gates,
  };
}

function scenarioEvidenceSignal(scenario, scenarioPath, kind) {
  const section = scenario?.evidence?.[kind];
  let status = scenarioEvidenceStatus(scenario, kind);
  if (section?.classification === 'traceability-only') status = 'partial';
  return {
    type: 'scenario-evidence',
    status,
    source: scenarioPath,
    detail: `${kind}: ${section?.classification ?? 'missing'} / ${section?.status ?? 'missing'}`,
    passes: status === 'passed',
  };
}

function buildM3TwoStoreyEvidenceWorkstream() {
  const config = M3_WAVE3_WORKSTREAMS.find((row) => row.id === 'M3-L');
  const scenarioPath = `spec/benchmarks/${config.scenarioId}/scenario.json`;
  const scenario = parseJsonFile(scenarioPath);
  const requiredKinds = ['advisor', 'visual', 'export', 'semanticDiff'];
  const gates = requiredKinds.map((kind) => {
    const evidence = [scenarioEvidenceSignal(scenario, scenarioPath, kind)];
    return m3Gate(
      `two-storey-${kind}`,
      `Two-storey ${kind} evidence`,
      evidence.every((item) => item.passes),
      `Two-storey ${kind} evidence is not an executable or accepted pass/fail artifact yet.`,
      evidence,
      evidence.some((item) => item.status === 'partial'),
    );
  });
  return {
    id: config.id,
    label: config.label,
    status: statusFromGates(gates),
    gatesPassed: gates.filter((gate) => gate.passed).length,
    gatesExpected: gates.length,
    scenarioId: config.scenarioId,
    gates,
  };
}

function buildM3TwoStoreyUiWorkstream() {
  const config = M3_WAVE3_WORKSTREAMS.find((row) => row.id === 'M3-M');
  const requiredKinds = ['ui', 'cmdK'];
  const gates = requiredKinds.map((kind) => {
    const evidence = [twoStoreyUiClosureEvidence(kind)];
    return m3Gate(
      `two-storey-${kind}`,
      `Two-storey ${kind} executable or validated replay`,
      evidence.every((item) => item.passes),
      evidence[0]?.reason ||
        `Two-storey ${kind} path is still traceability-only or missing; activator-only Cmd+K entries cannot close semantic parity.`,
      evidence,
      evidence.some((item) => item.status !== 'missing'),
    );
  });
  return {
    id: config.id,
    label: config.label,
    status: statusFromGates(gates),
    gatesPassed: gates.filter((gate) => gate.passed).length,
    gatesExpected: gates.length,
    scenarioId: config.scenarioId,
    gates,
  };
}

function buildM3CleanExportWorkstream() {
  const config = M3_WAVE3_WORKSTREAMS.find((row) => row.id === 'M3-N');
  const exportEvidencePath =
    'spec/benchmarks/simple-single-storey-house/live-evidence/export-evidence.json';
  const exportEvidence = parseJsonFile(exportEvidencePath);
  const artifactSignals = [
    {
      id: 'clean-gltf',
      label: 'Clean glTF/GLB export manifest',
      key: 'gltf',
      passes: exportManifestKindPass(exportEvidence, 'gltf'),
    },
    {
      id: 'clean-ifc',
      label: 'Clean IFC export manifest',
      key: 'ifc',
      passes: exportManifestKindPass(exportEvidence, 'ifc'),
    },
    {
      id: 'clean-pdf',
      label: 'Clean sheet PDF artifact',
      key: 'sheetPdf',
      passes: exportArtifactPass(exportEvidence, 'sheetPdf'),
    },
  ];
  const gates = artifactSignals.map((signal) =>
    m3Gate(
      signal.id,
      signal.label,
      signal.passes,
      `${signal.label} is missing, unavailable, or failed in production evidence.`,
      [
        {
          type: 'export-artifact',
          status: signal.passes ? 'passed' : exportArtifactStatus(exportEvidence, signal.key),
          source: exportEvidencePath,
          detail: signal.label,
          passes: signal.passes,
        },
      ],
      Boolean(exportEvidence),
    ),
  );
  return {
    id: config.id,
    label: config.label,
    status: statusFromGates(gates),
    gatesPassed: gates.filter((gate) => gate.passed).length,
    gatesExpected: gates.length,
    gates,
  };
}

function buildM3WorkflowEvidenceWorkstream() {
  const config = M3_WAVE3_WORKSTREAMS.find((row) => row.id === 'M3-O');
  const commitEvidencePath =
    'spec/benchmarks/simple-single-storey-house/live-evidence/live-commit-evidence.json';
  const commitEvidence = parseJsonFile(commitEvidencePath);
  const signals = [
    {
      id: 'client-op-or-digest-replay',
      label: 'clientOpId or bundle-digest replay dedup',
      status:
        commitEvidence?.idempotency?.pass === true ||
        commitEvidence?.transaction?.idempotency?.pass === true
          ? 'passed'
          : 'missing',
      passes:
        commitEvidence?.idempotency?.pass === true ||
        commitEvidence?.transaction?.idempotency?.pass === true,
    },
    {
      id: 'stale-revision-protection',
      label: 'stale revision protection',
      status:
        commitEvidence?.staleRevisionProtection?.pass === true ||
        commitEvidence?.transaction?.staleRevisionProtection?.pass === true
          ? 'passed'
          : 'missing',
      passes:
        commitEvidence?.staleRevisionProtection?.pass === true ||
        commitEvidence?.transaction?.staleRevisionProtection?.pass === true,
    },
    {
      id: 'm3-workflow-metadata',
      label: 'M3 sketch/export/import workflow metadata',
      status:
        commitEvidence?.workflowMetadata?.m3SketchExportImportCoverage === true ||
        commitEvidence?.transaction?.workflowMetadata?.m3SketchExportImportCoverage === true
          ? 'passed'
          : 'missing',
      passes:
        commitEvidence?.workflowMetadata?.m3SketchExportImportCoverage === true ||
        commitEvidence?.transaction?.workflowMetadata?.m3SketchExportImportCoverage === true,
    },
  ];
  const gates = signals.map((signal) =>
    m3Gate(
      signal.id,
      signal.label,
      signal.passes,
      `${signal.label} proof was not detected in benchmark transaction evidence.`,
      [
        {
          type: 'transaction-evidence',
          status: signal.status,
          source: commitEvidencePath,
          detail: signal.label,
          passes: signal.passes,
        },
      ],
      Boolean(commitEvidence),
    ),
  );
  return {
    id: config.id,
    label: config.label,
    status: statusFromGates(gates),
    gatesPassed: gates.filter((gate) => gate.passed).length,
    gatesExpected: gates.length,
    gates,
  };
}

function buildM3Wave3FinalizationWorkstream(wave3Workstreams) {
  const config = M3_WAVE3_WORKSTREAMS.find((row) => row.id === 'M3-P');
  const plannedWorkstreamIds = M3_WAVE3_WORKSTREAMS.filter((row) => row.id !== 'M3-P').map(
    (row) => row.id,
  );
  const observedWorkstreamIds = new Set(wave3Workstreams.map((row) => row.id));
  const reportInputsComplete = plannedWorkstreamIds.every((id) => observedWorkstreamIds.has(id));
  const gates = [
    m3Gate(
      'wave3-workstreams-enumerated',
      'Wave 3 workstreams enumerated',
      reportInputsComplete,
      'Wave 3 audit did not enumerate every M3-K through M3-O workstream.',
      plannedWorkstreamIds.map((id) => ({
        type: 'audit-workstream',
        status: observedWorkstreamIds.has(id) ? 'present' : 'missing',
        source: 'scripts/audit-ui-mcp-parity.mjs',
        detail: id,
        passes: observedWorkstreamIds.has(id),
      })),
      wave3Workstreams.length > 0,
    ),
    m3Gate(
      'next-wave-schedule-derived',
      'Next-wave schedule derived from blockers',
      reportInputsComplete,
      'Wave 3 audit cannot derive next-wave schedule until all workstream gates are visible.',
      [
        {
          type: 'audit-report',
          status: reportInputsComplete ? 'derived' : 'incomplete',
          source: 'scripts/audit-ui-mcp-parity.mjs',
          detail:
            'Generated report ranks remaining M3-K through M3-O blockers by workstream order and gate id.',
          passes: reportInputsComplete,
        },
      ],
      wave3Workstreams.length > 0,
    ),
  ];
  return {
    id: config.id,
    label: config.label,
    status: statusFromGates(gates),
    gatesPassed: gates.filter((gate) => gate.passed).length,
    gatesExpected: gates.length,
    gates,
  };
}

function buildM3Wave3(apiLedger, backendLedger) {
  const evidenceWorkstreams = [
    buildM3VerticalCirculationWorkstream(apiLedger, backendLedger),
    buildM3TwoStoreyEvidenceWorkstream(),
    buildM3TwoStoreyUiWorkstream(),
    buildM3CleanExportWorkstream(),
    buildM3WorkflowEvidenceWorkstream(),
  ];
  const workstreams = [
    ...evidenceWorkstreams,
    buildM3Wave3FinalizationWorkstream(evidenceWorkstreams),
  ];
  const gates = workstreams.flatMap((workstream) =>
    workstream.gates.map((gate) => ({
      workstreamId: workstream.id,
      workstreamLabel: workstream.label,
      ...gate,
    })),
  );
  const blockers = gates
    .filter((gate) => !gate.passed)
    .map((gate) => ({
      id: `${gate.workstreamId}:${gate.id}`,
      blocker: gate.blocker,
    }));
  const status = workstreams.every((workstream) => workstream.status === 'Done')
    ? 'Done'
    : workstreams.some((workstream) => workstream.status !== 'Not Started')
      ? 'Partial'
      : 'Not Started';
  return {
    status,
    workstreams,
    gates,
    blockers,
    nextWaveSchedule: blockers.map((blocker, index) => ({
      order: index + 1,
      sourceBlocker: blocker.id,
      recommendedFocus: blocker.blocker,
    })),
    summary: {
      status,
      workstreamStatusCounts: countBy(workstreams, (row) => row.status),
      gatesExpected: gates.length,
      gatesPassed: gates.filter((gate) => gate.passed).length,
      blockerCount: blockers.length,
      nextWaveItemCount: blockers.length,
    },
  };
}

function m4ScenarioPath(scenarioId) {
  return `spec/benchmarks/${scenarioId}/scenario.json`;
}

function loadProfessionalBenchmarkSuite() {
  const suitePath = 'spec/benchmarks/professional-suite.json';
  const suite = parseJsonFile(suitePath);
  const scenarioIds = Array.isArray(suite?.scenarios)
    ? suite.scenarios.map((entry) => entry.scenarioId).filter(Boolean)
    : [];
  const scenarios = Object.fromEntries(
    scenarioIds.map((scenarioId) => [scenarioId, parseJsonFile(m4ScenarioPath(scenarioId))]),
  );
  return { suitePath, suite, scenarioIds, scenarios };
}

function m4ScenarioEvidenceSignal(scenarioId, kind, suiteInfo) {
  const source = m4ScenarioPath(scenarioId);
  const scenario = suiteInfo.scenarios[scenarioId];
  const entry = scenario?.evidence?.[kind];
  if (!scenario) {
    return {
      type: 'professional-scenario-evidence',
      status: 'missing',
      source,
      detail: `${scenarioId} scenario is missing.`,
      passes: false,
      reason: `${source} is missing.`,
    };
  }
  if (!entry || typeof entry !== 'object') {
    return {
      type: 'professional-scenario-evidence',
      status: 'missing',
      source,
      detail: `${kind} evidence is missing.`,
      passes: false,
      reason: `${kind} evidence is missing from ${source}.`,
    };
  }
  const status = String(entry.status ?? entry.classification ?? 'missing');
  const classification = String(entry.classification ?? 'missing');
  const passes =
    ['executable', 'validated-replay'].includes(classification) &&
    isPositiveEvidenceStatus(status) &&
    !isBlockingEvidenceStatus(status) &&
    entry.pass !== false;
  return {
    type: 'professional-scenario-evidence',
    status: passes ? 'passed' : status,
    source,
    detail: `${scenarioId}.${kind}: ${classification} / ${status}`,
    passes,
    reason: passes ? '' : evidenceRejectionReason(status, classification),
  };
}

function buildM4DomainWorkstream(config, apiLedger, suiteInfo) {
  const descriptorGates = config.requiredSurfaceGroups.map((group) => {
    const evidence = group.acceptedStableIds.map((id) =>
      implementedDescriptorEvidence(apiLedger, [id], SOURCES.apiRegistry),
    );
    const passed = evidence.some((item) => item.passes);
    return m3Gate(
      group.id,
      group.label,
      passed,
      `${group.label} lacks an implemented first-class API/MCP descriptor; raw apply-bundle reachability does not count for M4.`,
      evidence,
      evidence.some((item) => item.status !== 'missing'),
    );
  });
  const scenarioSignals = config.scenarioIds.map((scenarioId) => {
    const scenario = suiteInfo.scenarios[scenarioId];
    return {
      type: 'professional-scenario',
      status: scenario ? 'present' : 'missing',
      source: m4ScenarioPath(scenarioId),
      detail: scenario?.summary ?? `${scenarioId} scenario missing.`,
      passes: Boolean(scenario),
      reason: scenario ? '' : `${m4ScenarioPath(scenarioId)} is missing.`,
    };
  });
  const mcpCliSignals = config.scenarioIds.map((scenarioId) =>
    m4ScenarioEvidenceSignal(scenarioId, 'mcpCli', suiteInfo),
  );
  const uiSignals = config.scenarioIds.flatMap((scenarioId) => [
    m4ScenarioEvidenceSignal(scenarioId, 'ui', suiteInfo),
    m4ScenarioEvidenceSignal(scenarioId, 'cmdK', suiteInfo),
  ]);
  const qualitySignals = config.scenarioIds.flatMap((scenarioId) => [
    m4ScenarioEvidenceSignal(scenarioId, 'advisor', suiteInfo),
    m4ScenarioEvidenceSignal(scenarioId, 'visual', suiteInfo),
    m4ScenarioEvidenceSignal(scenarioId, 'export', suiteInfo),
    m4ScenarioEvidenceSignal(scenarioId, 'semanticDiff', suiteInfo),
  ]);
  const gates = [
    ...descriptorGates,
    m3Gate(
      'benchmark-scenario-fixtures',
      'Professional benchmark scenario fixtures',
      scenarioSignals.every((item) => item.passes),
      `${config.label} benchmark scenario fixture(s) are missing from the professional suite.`,
      scenarioSignals,
      scenarioSignals.some((item) => item.passes),
    ),
    m3Gate(
      'mcp-cli-benchmark-evidence',
      'MCP/CLI executable benchmark evidence',
      mcpCliSignals.every((item) => item.passes),
      `${config.label} lacks executable MCP/CLI benchmark evidence.`,
      mcpCliSignals,
      mcpCliSignals.some((item) => item.status !== 'missing'),
    ),
    m3Gate(
      'ui-cmdk-equivalence-evidence',
      'UI and Cmd+K executable or validated replay evidence',
      uiSignals.every((item) => item.passes),
      `${config.label} lacks UI/Cmd+K executable or validated replay evidence; activator-only mappings are excluded.`,
      uiSignals,
      uiSignals.some((item) => item.status !== 'missing'),
    ),
    m3Gate(
      'quality-export-semantic-evidence',
      'Advisor, visual, export, and semantic-diff evidence',
      qualitySignals.every((item) => item.passes),
      `${config.label} lacks accepted advisor, visual, export, or semantic-diff evidence.`,
      qualitySignals,
      qualitySignals.some((item) => item.status !== 'missing'),
    ),
  ];
  return {
    id: config.id,
    label: config.label,
    domain: config.domain,
    scenarioIds: config.scenarioIds,
    status: statusFromGates(gates),
    gatesPassed: gates.filter((gate) => gate.passed).length,
    gatesExpected: gates.length,
    gates,
  };
}

function buildM4AuditWorkstream(domainWorkstreams, suiteInfo) {
  const plannedWorkstreamIds = M4_WAVE1_WORKSTREAMS.map((row) => row.id);
  const observedWorkstreamIds = new Set(domainWorkstreams.map((row) => row.id));
  const suitePresent = Boolean(suiteInfo.suite);
  const suiteScenarioIds = new Set(suiteInfo.scenarioIds);
  const plannedScenarioIds = new Set(M4_WAVE1_WORKSTREAMS.flatMap((row) => row.scenarioIds));
  const scenarioCoverage = [...plannedScenarioIds].every((id) => suiteScenarioIds.has(id));
  const reportInputsComplete = plannedWorkstreamIds.every((id) => observedWorkstreamIds.has(id));
  const gates = [
    m3Gate(
      'professional-suite-manifest',
      'Professional benchmark suite manifest',
      suitePresent && scenarioCoverage,
      'Professional benchmark suite manifest is missing one or more M4 domain scenarios.',
      [
        {
          type: 'professional-suite',
          status: suitePresent ? 'present' : 'missing',
          source: suiteInfo.suitePath,
          detail: `scenario coverage ${suiteInfo.scenarioIds.length} / ${plannedScenarioIds.size}`,
          passes: suitePresent && scenarioCoverage,
        },
      ],
      suitePresent,
    ),
    m3Gate(
      'wave1-workstreams-enumerated',
      'Wave 1 domain workstreams enumerated',
      reportInputsComplete,
      'M4 audit did not enumerate every M4-A through M4-E domain workstream.',
      plannedWorkstreamIds.map((id) => ({
        type: 'audit-workstream',
        status: observedWorkstreamIds.has(id) ? 'present' : 'missing',
        source: 'scripts/audit-ui-mcp-parity.mjs',
        detail: id,
        passes: observedWorkstreamIds.has(id),
      })),
      domainWorkstreams.length > 0,
    ),
    m3Gate(
      'blocker-ledger-derived',
      'Blocker ledger and next wave schedule derived from gates',
      reportInputsComplete,
      'M4 audit cannot derive blocker ledgers until all domain workstream gates are visible.',
      [
        {
          type: 'audit-report',
          status: reportInputsComplete ? 'derived' : 'incomplete',
          source: 'scripts/audit-ui-mcp-parity.mjs',
          detail:
            'Generated M4 reports rank remaining M4-A through M4-E blockers by workstream and gate.',
          passes: reportInputsComplete,
        },
      ],
      domainWorkstreams.length > 0,
    ),
  ];
  return {
    id: 'M4-F',
    label: 'Professional benchmark suite and M4 audit gates',
    domain: 'm4-audit',
    status: statusFromGates(gates),
    gatesPassed: gates.filter((gate) => gate.passed).length,
    gatesExpected: gates.length,
    gates,
  };
}

function buildM4Wave1(apiLedger) {
  const suiteInfo = loadProfessionalBenchmarkSuite();
  const domainWorkstreams = M4_WAVE1_WORKSTREAMS.map((config) =>
    buildM4DomainWorkstream(config, apiLedger, suiteInfo),
  );
  const workstreams = [...domainWorkstreams, buildM4AuditWorkstream(domainWorkstreams, suiteInfo)];
  const gates = workstreams.flatMap((workstream) =>
    workstream.gates.map((gate) => ({
      workstreamId: workstream.id,
      workstreamLabel: workstream.label,
      ...gate,
    })),
  );
  const blockers = gates
    .filter((gate) => !gate.passed)
    .map((gate) => ({
      id: `${gate.workstreamId}:${gate.id}`,
      blocker: gate.blocker,
    }));
  const status = workstreams.every((workstream) => workstream.status === 'Done')
    ? 'Done'
    : workstreams.some((workstream) => workstream.status !== 'Not Started')
      ? 'Partial'
      : 'Not Started';
  return {
    status,
    suite: {
      source: suiteInfo.suitePath,
      suiteId: suiteInfo.suite?.suiteId ?? 'missing',
      scenarioIds: suiteInfo.scenarioIds,
    },
    workstreams,
    gates,
    blockers,
    nextWaveSchedule: blockers.map((blocker, index) => ({
      order: index + 1,
      sourceBlocker: blocker.id,
      recommendedFocus: blocker.blocker,
    })),
    summary: {
      status,
      workstreamStatusCounts: countBy(workstreams, (row) => row.status),
      gatesExpected: gates.length,
      gatesPassed: gates.filter((gate) => gate.passed).length,
      blockerCount: blockers.length,
      nextWaveItemCount: blockers.length,
    },
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
          'M3 disposition',
          'M3 priority',
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
          row.m3Promotion?.category ?? 'first-class-or-semantic',
          row.m3Promotion?.promotionPriority ?? 'none',
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

function renderRawCommandPromotionPlan(audit) {
  return [
    '# Raw Command Promotion Plan',
    sourceStamp(audit),
    'This generated M3-E plan classifies every backend command that is still agent-reachable only through raw apply-bundle. `promote-first-class` means the command should get a stable typed descriptor before it is relied on by an M3 product workflow. `expert-raw` means raw bundle access remains intentional for advanced or low-level edits. `internal` means the command should not become a public MCP surface unless another workstream explicitly changes that contract.',
    table(
      [
        'Priority',
        'Category',
        'Domain',
        'Command',
        'Workstream',
        'Gate disposition',
        'UI completion',
        'Status',
        'Rationale',
        'Source',
      ],
      audit.m3.rawCommandPromotionPlan.map((row) => [
        row.promotionPriority,
        row.category,
        row.domain,
        row.id,
        row.m3Workstream,
        row.gateDisposition,
        row.uiCompletionKind,
        row.status,
        row.rationale,
        row.source,
      ]),
    ),
    '## Descriptor Surface Governance',
    table(
      ['Disposition', 'Category', 'Descriptor', 'Tool kind', 'Kernel commands', 'Detail'],
      audit.m3.descriptorSurfaceGovernance.map((row) => [
        row.disposition,
        row.category,
        row.id,
        row.toolKind,
        row.kernelCommands.join(', ') || 'none',
        row.detail,
      ]),
    ),
    '## Cmd+K Surface Governance',
    table(
      ['Disposition', 'Category', 'Command id', 'Execution kind', 'Agent kind', 'Detail'],
      audit.m3.cmdkSurfaceGovernance
        .filter(
          (row) =>
            row.disposition !== 'tracked' ||
            !(row.matchedBackendCommands ?? []).length ||
            row.agentCompletionKind === 'none',
        )
        .map((row) => [
          row.disposition,
          row.category,
          row.id,
          row.executionKind,
          row.agentCompletionKind,
          row.detail,
        ]),
    ),
  ].join('\n\n');
}

function renderM3Wave2Report(audit) {
  const wave2 = audit.m3.wave2;
  return [
    '# M3 Wave 2 Parity Report',
    sourceStamp(audit),
    `M3 Wave 2 status: ${wave2.status}`,
    `M3 Wave 2 gates passed: ${wave2.summary.gatesPassed} / ${wave2.summary.gatesExpected}`,
    `M3 Wave 2 blockers: ${wave2.summary.blockerCount}`,
    table(
      ['Workstream', 'Label', 'Status', 'Gates', 'Blockers'],
      wave2.workstreams.map((workstream) => [
        workstream.id,
        workstream.label,
        workstream.status,
        `${workstream.gatesPassed} / ${workstream.gatesExpected}`,
        workstream.gates
          .filter((gate) => !gate.passed)
          .map((gate) => `${gate.id}: ${gate.blocker}`)
          .join('; ') || 'none',
      ]),
    ),
    '## Gates',
    table(
      ['Workstream', 'Gate', 'Status', 'Blocker', 'Evidence'],
      wave2.gates.map((gate) => [
        gate.workstreamId,
        gate.label,
        gate.status,
        gate.blocker || 'none',
        (gate.evidence ?? [])
          .map((item) => `${item.status}@${item.source}`)
          .slice(0, 6)
          .join('<br>') || 'none',
      ]),
    ),
  ].join('\n\n');
}

function renderM3Wave3Report(audit) {
  const wave3 = audit.m3.wave3;
  return [
    '# M3 Wave 3 Parity Report',
    sourceStamp(audit),
    `M3 Wave 3 status: ${wave3.status}`,
    `M3 Wave 3 gates passed: ${wave3.summary.gatesPassed} / ${wave3.summary.gatesExpected}`,
    `M3 Wave 3 blockers: ${wave3.summary.blockerCount}`,
    table(
      ['Workstream', 'Label', 'Status', 'Gates', 'Blockers'],
      wave3.workstreams.map((workstream) => [
        workstream.id,
        workstream.label,
        workstream.status,
        `${workstream.gatesPassed} / ${workstream.gatesExpected}`,
        workstream.gates
          .filter((gate) => !gate.passed)
          .map((gate) => `${gate.id}: ${gate.blocker}`)
          .join('; ') || 'none',
      ]),
    ),
    '## Gates',
    table(
      ['Workstream', 'Gate', 'Status', 'Blocker', 'Evidence'],
      wave3.gates.map((gate) => [
        gate.workstreamId,
        gate.label,
        gate.status,
        gate.blocker || 'none',
        (gate.evidence ?? [])
          .map((item) => `${item.status}@${item.source}`)
          .slice(0, 6)
          .join('<br>') || 'none',
      ]),
    ),
    '## Next Wave Schedule',
    wave3.nextWaveSchedule.length
      ? table(
          ['Order', 'Source blocker', 'Recommended focus'],
          wave3.nextWaveSchedule.map((item) => [
            item.order,
            item.sourceBlocker,
            item.recommendedFocus,
          ]),
        )
      : 'No remaining Wave 3 blockers were detected.',
  ].join('\n\n');
}

function renderM4Wave1Report(audit) {
  const wave1 = audit.m4.wave1;
  return [
    '# M4 Wave 1 Parity Report',
    sourceStamp(audit),
    `M4 status: ${audit.m4.status}`,
    `M4 Wave 1 status: ${wave1.status}`,
    `M4 Wave 1 gates passed: ${wave1.summary.gatesPassed} / ${wave1.summary.gatesExpected}`,
    `M4 Wave 1 blockers: ${wave1.summary.blockerCount}`,
    `Professional suite: ${wave1.suite.suiteId} (${wave1.suite.source})`,
    table(
      ['Workstream', 'Label', 'Status', 'Gates', 'Scenarios', 'Blockers'],
      wave1.workstreams.map((workstream) => [
        workstream.id,
        workstream.label,
        workstream.status,
        `${workstream.gatesPassed} / ${workstream.gatesExpected}`,
        (workstream.scenarioIds ?? []).join(', ') || 'none',
        workstream.gates
          .filter((gate) => !gate.passed)
          .map((gate) => `${gate.id}: ${gate.blocker}`)
          .join('; ') || 'none',
      ]),
    ),
    '## Gates',
    table(
      ['Workstream', 'Gate', 'Status', 'Blocker', 'Evidence'],
      wave1.gates.map((gate) => [
        gate.workstreamId,
        gate.label,
        gate.status,
        gate.blocker || 'none',
        (gate.evidence ?? [])
          .map((item) => `${item.status}@${item.source}`)
          .slice(0, 8)
          .join('<br>') || 'none',
      ]),
    ),
    '## Next Wave Schedule',
    wave1.nextWaveSchedule.length
      ? table(
          ['Order', 'Source blocker', 'Recommended focus'],
          wave1.nextWaveSchedule.map((item) => [
            item.order,
            item.sourceBlocker,
            item.recommendedFocus,
          ]),
        )
      : 'No remaining M4 Wave 1 blockers were detected.',
  ].join('\n\n');
}

function renderM4BlockerLedger(audit) {
  const wave1 = audit.m4.wave1;
  return [
    '# M4 Blocker Ledger',
    sourceStamp(audit),
    `M4 status: ${audit.m4.status}`,
    `M4 Wave 1 gates passed: ${wave1.summary.gatesPassed} / ${wave1.summary.gatesExpected}`,
    wave1.blockers.length
      ? table(
          ['Priority', 'Source blocker', 'Workstream', 'Blocker'],
          wave1.blockers.map((blocker) => {
            const workstreamId = blocker.id.split(':')[0];
            return ['P0', blocker.id, workstreamId, blocker.blocker];
          }),
        )
      : 'No M4 blockers were detected.',
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
    for (const artifactPath of benchmark.evidenceArtifactPaths ?? []) {
      rows.push([
        benchmark.id,
        'evidence-artifact',
        'discovered',
        'machine-readable JSON',
        artifactPath,
      ]);
    }
    return rows;
  });
  const closureRows = audit.m2.closureGates.map((gate) => [
    gate.label,
    gate.status,
    gate.evidenceCount,
    gate.blocker || 'none',
    (gate.evidence ?? [])
      .map(
        (item) =>
          `${item.benchmarkId || 'audit'}:${item.status}@${item.source || 'source'}${
            item.passes ? '' : ` (${item.reason || 'rejected'})`
          }`,
      )
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
    '## M3 Governance Summary',
    `M3 governance gates passed: ${audit.summary.m3GovernanceGatePassed} / ${audit.summary.m3GovernanceGateExpected}`,
    `Raw promotion plan: ${audit.summary.m3RawPromotionPromoteFirstClass} promote-first-class, ${audit.summary.m3RawPromotionExpertRaw} expert-raw, ${audit.summary.m3RawPromotionInternal} internal, ${audit.summary.m3RawPromotionUnclassified} unclassified`,
    `Descriptor/MCP untracked surfaces: ${audit.summary.m3DescriptorUntrackedSurfaceCount}`,
    `Cmd+K untracked unmatched surfaces: ${audit.summary.m3CmdkUntrackedSurfaceCount}`,
    table(
      ['Gate', 'Status', 'Blocker'],
      audit.m3.gates.map((gate) => [gate.label, gate.status, gate.blocker || 'none']),
    ),
    '## M3 Wave 2 Summary',
    `M3 Wave 2 status: ${audit.summary.m3Wave2Status}`,
    `M3 Wave 2 gates passed: ${audit.summary.m3Wave2GatePassed} / ${audit.summary.m3Wave2GateExpected}`,
    `M3 Wave 2 blockers: ${audit.summary.m3Wave2BlockerCount}`,
    table(
      ['Workstream', 'Status', 'Gates', 'Primary blocker'],
      audit.m3.wave2.workstreams.map((workstream) => [
        `${workstream.id} ${workstream.label}`,
        workstream.status,
        `${workstream.gatesPassed} / ${workstream.gatesExpected}`,
        workstream.gates.find((gate) => !gate.passed)?.blocker ?? 'none',
      ]),
    ),
    '## M3 Wave 3 Summary',
    `M3 Wave 3 status: ${audit.summary.m3Wave3Status}`,
    `M3 Wave 3 gates passed: ${audit.summary.m3Wave3GatePassed} / ${audit.summary.m3Wave3GateExpected}`,
    `M3 Wave 3 blockers: ${audit.summary.m3Wave3BlockerCount}`,
    `Next-wave schedule items: ${audit.summary.m3Wave3NextWaveItemCount}`,
    table(
      ['Workstream', 'Status', 'Gates', 'Primary blocker'],
      audit.m3.wave3.workstreams.map((workstream) => [
        `${workstream.id} ${workstream.label}`,
        workstream.status,
        `${workstream.gatesPassed} / ${workstream.gatesExpected}`,
        workstream.gates.find((gate) => !gate.passed)?.blocker ?? 'none',
      ]),
    ),
    table(
      ['Order', 'Source blocker', 'Recommended focus'],
      audit.m3.wave3.nextWaveSchedule.map((item) => [
        item.order,
        item.sourceBlocker,
        item.recommendedFocus,
      ]),
    ),
    '## M4 Wave 1 Summary',
    `M4 status: ${audit.summary.m4Status}`,
    `M4 Wave 1 status: ${audit.summary.m4Wave1Status}`,
    `M4 Wave 1 gates passed: ${audit.summary.m4Wave1GatePassed} / ${audit.summary.m4Wave1GateExpected}`,
    `M4 Wave 1 blockers: ${audit.summary.m4Wave1BlockerCount}`,
    `Next-wave schedule items: ${audit.summary.m4Wave1NextWaveItemCount}`,
    table(
      ['Workstream', 'Status', 'Gates', 'Primary blocker'],
      audit.m4.wave1.workstreams.map((workstream) => [
        `${workstream.id} ${workstream.label}`,
        workstream.status,
        `${workstream.gatesPassed} / ${workstream.gatesExpected}`,
        workstream.gates.find((gate) => !gate.passed)?.blocker ?? 'none',
      ]),
    ),
    table(
      ['Order', 'Source blocker', 'Recommended focus'],
      audit.m4.wave1.nextWaveSchedule.map((item) => [
        item.order,
        item.sourceBlocker,
        item.recommendedFocus,
      ]),
    ),
    table(
      ['Priority', 'Category', 'Domain', 'Command', 'Workstream', 'Rationale'],
      audit.m3.rawCommandPromotionPlan
        .filter((row) => row.category === 'promote-first-class')
        .map((row) => [
          row.promotionPriority,
          row.category,
          row.domain,
          row.id,
          row.m3Workstream,
          row.rationale,
        ]),
    ),
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
