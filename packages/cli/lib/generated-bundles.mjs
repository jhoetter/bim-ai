import { base, fetchJsonResponse } from './api-client.mjs';
import { flagValue, hasFlag, parseNumber } from './cli-args.mjs';
import { commandsFromBundleJson } from './sketch-phase-workflows.mjs';

export function buildGeneratedBundle({ toolId, commands, parentRevision, assumptions = [] }) {
  const bundle = {
    schemaVersion: 'cmd-v3.0',
    commands,
    assumptions: [
      {
        key: 'ui-mcp-parity-cli-tool',
        value: toolId,
        confidence: 1,
        source: '@bim-ai/cli',
      },
      ...assumptions,
    ],
  };
  if (Number.isFinite(parentRevision)) bundle.parentRevision = parentRevision;
  return bundle;
}

export async function runGeneratedBundle(
  modelId,
  userId,
  bundle,
  mode,
  jsonOnly,
  { actorKind = null, dryRunEvidence = null } = {},
) {
  const endpoint = `/api/models/${encodeURIComponent(modelId)}/bundles`;
  const body = { bundle, mode, userId };
  if (actorKind) body.actorKind = actorKind;
  if (dryRunEvidence) body.dryRunEvidence = dryRunEvidence;
  if (jsonOnly) {
    console.log(JSON.stringify({ ok: true, endpoint: `POST ${endpoint}`, body }, null, 2));
    return;
  }
  const res = await fetchJsonResponse('POST', `${base}${endpoint}`, body);
  console.log(JSON.stringify(res.body, null, 2));
  if (!res.ok) process.exit(res.status === 409 ? 2 : 1);
}

export function bundleFromBlob(blob, parentRevision, toolId) {
  const bundle =
    blob && typeof blob === 'object' && blob.schemaVersion === 'cmd-v3.0'
      ? blob
      : buildGeneratedBundle({
          toolId,
          commands: commandsFromBundleJson(blob),
          parentRevision,
          assumptions: [{ key: 'cli-legacy-wrapper', value: true, confidence: 0, source: 'cli' }],
        });
  if (Number.isFinite(parentRevision)) bundle.parentRevision = parentRevision;
  return bundle;
}

export function generatedModeFromArgs(args) {
  if (hasFlag(args, '--commit') && hasFlag(args, '--dry-run')) {
    console.error('Use only one of --dry-run or --commit.');
    process.exit(1);
  }
  return hasFlag(args, '--commit') ? 'commit' : 'dry_run';
}

export function authorOptions(args) {
  return {
    mode: generatedModeFromArgs(args),
    jsonOnly: hasFlag(args, '--json'),
    parentRevision: parseNumber(flagValue(args, ['--parent-revision', '--base']), undefined),
  };
}
