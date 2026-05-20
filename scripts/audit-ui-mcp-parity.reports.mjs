import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import { READINESS_ADJACENT_SURFACES } from './audit-ui-mcp-parity.config.mjs';

const ROOT = process.cwd();
const UNKNOWN = 'unknown';

function mdEscape(value) {
  return String(value ?? UNKNOWN)
    .replaceAll('|', '\\|')
    .replace(/\s+/g, ' ')
    .trim();
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

export async function writeJson(relPath, value) {
  const content = `${JSON.stringify(value, null, 2)}\n`;
  fs.writeFileSync(path.join(ROOT, relPath), await formatForFile(relPath, content));
}

export async function writeMarkdown(relPath, content) {
  const raw = `${content.trimEnd()}\n`;
  fs.writeFileSync(path.join(ROOT, relPath), await formatForFile(relPath, raw));
}

function table(headers, rows) {
  const header = `| ${headers.join(' | ')} |`;
  const divider = `| ${headers.map(() => '---').join(' | ')} |`;
  const body = rows.map((row) => `| ${row.map(mdEscape).join(' | ')} |`);
  return [header, divider, ...body].join('\n');
}

export function renderBackendLedger(audit) {
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

export function renderCmdkLedger(audit) {
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

function readinessSurfaceRows(apiDescriptors) {
  const descriptorRows = apiDescriptors
    .filter(
      (row) =>
        row.id.startsWith('sketch.') ||
        row.id.startsWith('qa.') ||
        row.id.startsWith('export.') ||
        row.id.startsWith('query.') ||
        row.id.startsWith('resolve.') ||
        row.id.startsWith('commands.schema.') ||
        row.id === 'model-show' ||
        row.id === 'model.summary' ||
        row.id === 'model.command_log' ||
        row.id === 'evidence.package',
    )
    .map((row) => ({
      id: row.id,
      stableId: row.stableId,
      surfaceStatus: row.surfaceStatus,
      canonicalTransport: row.canonicalTransport,
      path: row.path,
      notes: row.surfaceNotes,
      source: row.source,
    }));
  const rowsById = new Map();
  for (const row of [...descriptorRows, ...READINESS_ADJACENT_SURFACES]) {
    if (!rowsById.has(row.id)) rowsById.set(row.id, row);
  }
  return [...rowsById.values()].sort((a, b) => a.id.localeCompare(b.id));
}

export function renderApiLedger(audit) {
  const readinessRows = readinessSurfaceRows(audit.apiDescriptors);
  return [
    '# API Descriptor Ledger',
    sourceStamp(audit),
    '## Sketch Readiness Surface Status',
    'Execution status is product-facing: `executable` means the named API route/descriptor can be called directly; `contract-only` means the descriptor documents a blocked or future route; `CLI-only` means the CLI is the canonical public transport; `skill-local` means the operation is helper/browser automation and not a public product surface.',
    table(
      ['Tool', 'Status', 'Canonical transport', 'Path', 'Notes', 'Source'],
      readinessRows.map((row) => [
        row.id,
        row.surfaceStatus,
        row.canonicalTransport,
        row.path || 'none',
        row.notes || 'none',
        row.source,
      ]),
    ),
    '## SKB B08-B11 Audit',
    `B08 model resource coverage: ${audit.skb.summary.b08ResourceExecutable}/${audit.skb.summary.b08ResourceExpected} executable.`,
    table(
      [
        'Resource',
        'Status',
        'Descriptor',
        'Required route',
        'Route implemented',
        'Notes',
        'Source',
      ],
      audit.skb.resources.map((row) => [
        row.id,
        row.status,
        row.descriptor || 'none',
        row.requiredRoute,
        row.routeImplemented ? 'yes' : 'no',
        row.notes || 'none',
        row.source || 'none',
      ]),
    ),
    `B09 command schema export coverage: ${audit.skb.summary.b09CommandSchemaExecutable}/${audit.skb.summary.b09CommandSchemaExpected} executable. Examples: ${audit.skb.summary.b09CommandSchemaExamples}/${audit.skb.summary.b09CommandSchemaCommandCount}; raw/semantic mappings: ${audit.skb.summary.b09CommandSchemaMappings}/${audit.skb.summary.b09CommandSchemaCommandCount}; raw/expert explicit: ${audit.skb.commandSchemaMetadata.rawExpertCount}; typed/semantic mapped: ${audit.skb.commandSchemaMetadata.mappedCount}.`,
    table(
      ['Surface', 'Status', 'Descriptor', 'Required route', 'Route implemented', 'Notes', 'Source'],
      audit.skb.commandSchemas.map((row) => [
        row.id,
        row.status,
        row.descriptor || 'none',
        row.requiredRoute,
        row.routeImplemented ? 'yes' : 'no',
        row.notes || 'none',
        row.source || 'none',
      ]),
    ),
    table(
      ['Metadata contract', 'Value'],
      [
        ['export inspection', audit.skb.commandSchemaMetadata.status],
        ['commands covered', audit.skb.summary.b09CommandSchemaCommandCount],
        ['generated examples', audit.skb.summary.b09CommandSchemaExamples],
        ['unavailable examples', audit.skb.summary.b09CommandSchemaUnavailableExamples],
        ['raw/semantic mappings', audit.skb.summary.b09CommandSchemaMappings],
        ['typed or semantic descriptor mappings', audit.skb.commandSchemaMetadata.mappedCount],
        ['explicit raw/expert commands', audit.skb.commandSchemaMetadata.rawExpertCount],
      ],
    ),
    `B10 query/resolve coverage: ${audit.skb.summary.b10QueryResolveExecutable}/${audit.skb.summary.b10QueryResolveExpected} executable.`,
    table(
      ['Surface', 'Status', 'Descriptor', 'Route implemented', 'Notes', 'Source'],
      audit.skb.queryResolve.map((row) => [
        row.id,
        row.status,
        row.descriptor || 'none',
        row.routeImplemented ? 'yes' : 'no',
        row.notes || 'none',
        row.source || 'none',
      ]),
    ),
    `B11 Cmd+K agent-equivalence metadata: ${audit.skb.summary.b11CmdkMappedEntryCount}/${audit.skb.cmdkEquivalence.entryCount} entries mapped; ${audit.skb.summary.b11CmdkActivatorMappedEntryCount}/${audit.skb.summary.b11CmdkActivatorEntryCount} activator entries mapped.`,
    table(
      ['Metric', 'Value'],
      [
        ['unmapped activator count', audit.skb.cmdkEquivalence.unmappedActivatorIds.length],
        [
          'unmapped activator ids',
          audit.skb.cmdkEquivalence.unmappedActivatorIds.slice(0, 50).join(', ') || 'none',
        ],
        [
          'sample mapped entries',
          audit.skb.cmdkEquivalence.sampleMappedEntries.join(', ') || 'none',
        ],
      ],
    ),
    '## Descriptor Ledger',
    table(
      [
        'Descriptor',
        'Stable id',
        'Agent status',
        'Canonical transport',
        'Tool kind',
        'Category',
        'Implementation',
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
        row.surfaceStatus,
        row.canonicalTransport,
        row.toolKind,
        row.category,
        row.implementationStatus,
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

export function renderRawCommandPromotionPlan(audit) {
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

export function renderM3Wave2Report(audit) {
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

export function renderM3Wave3Report(audit) {
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

export function renderM4Wave1Report(audit) {
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

export function renderM4BlockerLedger(audit) {
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

export function renderGapReport(audit) {
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
