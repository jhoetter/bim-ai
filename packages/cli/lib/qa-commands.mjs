import { base, fetchJson } from './api-client.mjs';
import { advisorSummary } from './advisor-summary.mjs';
import { flagValue, hasFlag, parseCsv } from './cli-args.mjs';

export async function cmdAdvisor(modelId, { output = 'text', severity = null } = {}) {
  const summary = await advisorSummary(modelId, { severity });

  if (output === 'json') {
    console.log(JSON.stringify(summary, null, 2));
    return;
  }

  console.log(
    `advisor model=${summary.modelId} revision=${summary.revision} findings=${summary.total}`,
  );
  for (const g of summary.groups) {
    const ids = g.elementIds.length ? ` ids=${g.elementIds.join(',')}` : '';
    console.log(`${g.severity}\t${g.code}\t${g.count}${ids}`);
    for (const msg of g.messages) console.log(`  ${msg}`);
  }
}

export async function cmdIntegrity(modelId, userId, args) {
  const output = flagValue(args, '--output') ?? (hasFlag(args, '--json') ? 'json' : 'json');
  const changed = parseCsv(flagValue(args, ['--changed-ids', '--changedElementIds']));
  const qs = new URLSearchParams();
  if (changed.length) qs.set('changedElementIds', changed.join(','));
  const report = await fetchJson(
    'GET',
    `${base}/api/models/${encodeURIComponent(modelId)}/qa/integrity-preflight${
      qs.toString() ? `?${qs}` : ''
    }`,
  );
  const proposalIds = parseCsv(flagValue(args, ['--proposal-id', '--proposal-ids']));
  const wantsFixDryRun = hasFlag(args, '--dry-run-fixes');
  const wantsFixCommit = hasFlag(args, '--commit-fixes');
  if (wantsFixDryRun || wantsFixCommit) {
    const proposals = (report?.remediation?.proposals ?? []).filter(
      (proposal) => !proposalIds.length || proposalIds.includes(String(proposal.proposalId)),
    );
    const dryRuns = [];
    const commits = [];
    for (const proposal of proposals) {
      const commands = Array.isArray(proposal.commands) ? proposal.commands : [];
      const dryRun = await fetchJson(
        'POST',
        `${base}/api/models/${encodeURIComponent(modelId)}/commands/bundle/dry-run`,
        { commands, userId },
      );
      dryRuns.push({ proposalId: proposal.proposalId, ...dryRun });
      if (wantsFixCommit) {
        if (!dryRun.ok) {
          commits.push({
            proposalId: proposal.proposalId,
            ok: false,
            skipped: true,
            reason: 'dry_run_failed',
          });
          continue;
        }
        const commit = await fetchJson(
          'POST',
          `${base}/api/models/${encodeURIComponent(modelId)}/commands/bundle`,
          { commands, userId },
        );
        commits.push({ proposalId: proposal.proposalId, ...commit });
      }
    }
    const after = wantsFixCommit
      ? await fetchJson(
          'GET',
          `${base}/api/models/${encodeURIComponent(modelId)}/qa/integrity-preflight`,
        )
      : null;
    console.log(
      JSON.stringify(
        {
          format: wantsFixCommit
            ? 'integrityRemediationCommit_v1'
            : 'integrityRemediationDryRun_v1',
          modelId,
          proposalIds: proposals.map((proposal) => proposal.proposalId),
          dryRuns,
          commits,
          recapturedEvidence: after,
        },
        null,
        2,
      ),
    );
    return;
  }
  if (output === 'json') {
    console.log(JSON.stringify(report, null, 2));
    return;
  }
  console.log(
    `integrity model=${report.modelId ?? modelId} revision=${report.revision} findings=${
      report.summary?.findingCount ?? 0
    } blockers=${report.summary?.blockingFindingCount ?? 0}`,
  );
  for (const finding of report.findings ?? []) {
    const ids = (finding.elementIds ?? []).length ? ` ids=${finding.elementIds.join(',')}` : '';
    console.log(`${finding.severity}\t${finding.ruleId}${ids}`);
    if (finding.message) console.log(`  ${finding.message}`);
  }
}

export async function cmdProfileComparison(modelId, args) {
  const profiles = parseCsv(flagValue(args, '--profiles'));
  const changed = parseCsv(flagValue(args, ['--changed-ids', '--changedElementIds']));
  const qs = new URLSearchParams();
  if (profiles.length) qs.set('profiles', profiles.join(','));
  if (changed.length) qs.set('changedElementIds', changed.join(','));
  const payload = await fetchJson(
    'GET',
    `${base}/api/models/${encodeURIComponent(modelId)}/qa/profile-comparison${
      qs.toString() ? `?${qs}` : ''
    }`,
  );
  console.log(JSON.stringify(payload, null, 2));
}

export async function cmdAdvisorRules(args) {
  const output = flagValue(args, '--output') ?? (hasFlag(args, '--json') ? 'json' : 'text');
  const profile = flagValue(args, '--profile');
  const surface = flagValue(args, '--surface');
  const qs = new URLSearchParams();
  if (profile) qs.set('profile', profile);
  if (surface) qs.set('surface', surface);
  const payload = await fetchJson(
    'GET',
    `${base}/api/v3/advisor-rules${qs.toString() ? `?${qs}` : ''}`,
  );
  if (output === 'json') {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }
  console.log(
    `advisor-rules schema=${payload.schemaVersion} rules=${payload.summary?.ruleCount ?? 0}`,
  );
  for (const rule of payload.rules ?? []) {
    const profiles = Array.isArray(rule.profiles) ? rule.profiles.join(',') : '';
    const surfaces = Array.isArray(rule.surfaces) ? rule.surfaces.join(',') : '';
    console.log(`${rule.severity}\t${rule.ruleId}\t${rule.discipline}\t${profiles}\t${surfaces}`);
  }
}
