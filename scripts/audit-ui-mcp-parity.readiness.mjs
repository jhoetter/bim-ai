import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import {
  SKB_B08_REQUIRED_RESOURCES,
  SKB_B09_COMMAND_SCHEMA_SURFACES,
  SKB_B10_REQUIRED_QUERY_RESOLVE,
  SOURCES,
} from './audit-ui-mcp-parity.config.mjs';

const ROOT = process.cwd();

function read(relPath) {
  try {
    return fs.readFileSync(path.join(ROOT, relPath), 'utf8');
  } catch {
    return '';
  }
}

function normalizedId(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

function findDescriptorByAcceptedId(apiDescriptors, acceptedIds) {
  return apiDescriptors.find((row) =>
    acceptedIds.some(
      (id) =>
        normalizedId(row.id) === normalizedId(id) ||
        normalizedId(row.stableId) === normalizedId(id),
    ),
  );
}

function skbSurfaceCoverage(requiredRows, apiDescriptors) {
  return requiredRows.map((required) => {
    const descriptor = findDescriptorByAcceptedId(apiDescriptors, required.acceptedIds);
    return {
      id: required.id,
      requiredRoute: required.requiredRoute,
      descriptor: descriptor?.id ?? '',
      stableId: descriptor?.stableId ?? '',
      status: descriptor
        ? descriptor.surfaceStatus === 'executable'
          ? 'executable'
          : descriptor.surfaceStatus
        : 'missing',
      routeImplemented: descriptor?.routeImplemented ?? false,
      source: descriptor?.source ?? '',
      notes: descriptor?.surfaceNotes ?? '',
    };
  });
}

function inspectCommandSchemaMetadataExport() {
  const script = `
import json
from bim_ai.command_schemas import export_command_schemas

catalog = export_command_schemas()
metadata = list(catalog.get("metadata", {}).values())
print(json.dumps({
    "status": "ok",
    "commandCount": catalog.get("commandCount", 0),
    "generatedExampleCount": sum(1 for row in metadata if row.get("example") is not None and row.get("exampleStatus") != "todo"),
    "unavailableExampleCount": sum(1 for row in metadata if row.get("example") is None or row.get("exampleStatus") == "todo"),
    "mappingCount": sum(1 for row in metadata if row.get("rawSemanticMapping") and row.get("mappingStatus") in {"mapped", "explicit-raw-expert"}),
    "mappedCount": sum(1 for row in metadata if row.get("mappingStatus") == "mapped"),
    "rawExpertCount": sum(1 for row in metadata if row.get("mappingStatus") == "explicit-raw-expert"),
}))
`.trim();
  for (const bin of ['python', 'python3']) {
    try {
      return JSON.parse(
        execFileSync(bin, ['-c', script], {
          cwd: ROOT,
          encoding: 'utf8',
          stdio: ['ignore', 'pipe', 'pipe'],
        }),
      );
    } catch {
      // Try the next interpreter, then fall back to a static contract check.
    }
  }

  const source = read(SOURCES.commandSchemas);
  const hasExampleContract =
    source.includes('_validated_example') &&
    source.includes('"exampleStatus": example_status') &&
    !source.includes('"exampleStatus": "todo"');
  const hasMappingContract =
    source.includes('"rawSemanticMapping": mapping') &&
    source.includes('explicit-raw-expert') &&
    source.includes('"descriptorMappings"');
  return {
    status: hasExampleContract && hasMappingContract ? 'static-contract' : 'missing',
    commandCount: 0,
    generatedExampleCount: 0,
    unavailableExampleCount: hasExampleContract ? 0 : 1,
    mappingCount: 0,
    mappedCount: 0,
    rawExpertCount: 0,
  };
}

export function buildSkbReadinessAudit(apiDescriptors, cmdkLedger) {
  const resources = skbSurfaceCoverage(SKB_B08_REQUIRED_RESOURCES, apiDescriptors);
  const commandSchemas = skbSurfaceCoverage(SKB_B09_COMMAND_SCHEMA_SURFACES, apiDescriptors);
  const commandSchemaMetadata = inspectCommandSchemaMetadataExport();
  const queryResolve = SKB_B10_REQUIRED_QUERY_RESOLVE.map((id) => {
    const descriptor = findDescriptorByAcceptedId(apiDescriptors, [id]);
    return {
      id,
      descriptor: descriptor?.id ?? '',
      status: descriptor
        ? descriptor.surfaceStatus === 'executable'
          ? 'executable'
          : descriptor.surfaceStatus
        : 'missing',
      routeImplemented: descriptor?.routeImplemented ?? false,
      source: descriptor?.source ?? '',
      notes: descriptor?.surfaceNotes ?? '',
    };
  });
  const cmdkMappedRows = cmdkLedger.filter(
    (row) => row.agentToolId || row.agentCompletionKind !== 'none',
  );
  const cmdkActivatorRows = cmdkLedger.filter((row) => row.executionKind === 'activates-tool');
  const cmdkActivatorMappedRows = cmdkActivatorRows.filter(
    (row) => row.agentToolId || row.agentCompletionKind !== 'none',
  );
  return {
    resources,
    commandSchemas,
    commandSchemaMetadata,
    queryResolve,
    cmdkEquivalence: {
      entryCount: cmdkLedger.length,
      mappedEntryCount: cmdkMappedRows.length,
      activatorEntryCount: cmdkActivatorRows.length,
      mappedActivatorEntryCount: cmdkActivatorMappedRows.length,
      unmappedActivatorIds: cmdkActivatorRows
        .filter((row) => !(row.agentToolId || row.agentCompletionKind !== 'none'))
        .map((row) => row.id)
        .sort(),
      sampleMappedEntries: cmdkMappedRows
        .slice(0, 25)
        .map((row) => `${row.id} -> ${row.agentToolId || row.agentCompletionKind}`),
    },
    summary: {
      b08ResourceExecutable: resources.filter((row) => row.status === 'executable').length,
      b08ResourceExpected: resources.length,
      b09CommandSchemaExecutable: commandSchemas.filter((row) => row.status === 'executable')
        .length,
      b09CommandSchemaExpected: commandSchemas.length,
      b09CommandSchemaExamples: commandSchemaMetadata.generatedExampleCount,
      b09CommandSchemaMappings: commandSchemaMetadata.mappingCount,
      b09CommandSchemaCommandCount: commandSchemaMetadata.commandCount,
      b09CommandSchemaUnavailableExamples: commandSchemaMetadata.unavailableExampleCount,
      b10QueryResolveExecutable: queryResolve.filter((row) => row.status === 'executable').length,
      b10QueryResolveExpected: queryResolve.length,
      b11CmdkMappedEntryCount: cmdkMappedRows.length,
      b11CmdkActivatorMappedEntryCount: cmdkActivatorMappedRows.length,
      b11CmdkActivatorEntryCount: cmdkActivatorRows.length,
    },
  };
}
