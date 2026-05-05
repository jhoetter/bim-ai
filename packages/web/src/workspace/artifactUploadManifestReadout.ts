/** Concise Agent Review lines for evidence-package artifactUploadManifest_v1 (contract-only). */

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, Math.max(0, max - 1))}…`;
}

export function summarizeArtifactUploadManifestV1(raw: unknown): string[] {
  if (!raw || typeof raw !== 'object') return [];
  const m = raw as Record<string, unknown>;
  if (m.format !== 'artifactUploadManifest_v1') return [];

  const lines: string[] = [];

  lines.push(
    `Upload eligible: ${m.uploadEligible === false ? 'no (API contract-only)' : String(m.uploadEligible)}`,
  );

  const sideOn = m.sideEffectsEnabled === true;
  const sr = typeof m.sideEffectsReason === 'string' ? m.sideEffectsReason : '';
  lines.push(
    `Side-effect hints: ${sideOn ? 'on' : 'off'}${sr ? ` — ${truncate(sr, 140)}` : ''}`,
  );

  const rm = typeof m.resolutionMode === 'string' ? m.resolutionMode : null;
  if (rm) {
    lines.push(`Resolution mode: ${rm}`);
  }

  const hint = m.ciProviderHint_v1;
  if (hint && typeof hint === 'object') {
    const h = hint as Record<string, unknown>;
    const om = h.omittedReason;
    if (typeof om === 'string' && om.trim()) {
      lines.push(`CI provider hint: omitted — ${truncate(om.trim(), 120)}`);
    } else {
      const repo = typeof h.repository === 'string' ? h.repository : '';
      const runId = typeof h.runId === 'string' ? h.runId : '';
      const url = typeof h.runArtifactsWebUrl === 'string' ? h.runArtifactsWebUrl : '';
      const tail = url ? ` · ${truncate(url, 72)}` : '';
      lines.push(`CI provider hint: github_actions · ${repo} · run ${runId}${tail}`);
    }
  }

  const cds = m.contentDigests;
  if (cds && typeof cds === 'object') {
    const c = cds as Record<string, unknown>;
    const pkg = c.packageSemanticDigestSha256;
    if (typeof pkg === 'string' && /^[a-f0-9]{64}$/i.test(pkg)) {
      const tail = pkg.slice(-12).toLowerCase();
      lines.push(`Package digest (tail): ${tail}`);
    }
    const ing = c.artifactIngestManifestDigestSha256;
    if (typeof ing === 'string' && /^[a-f0-9]{64}$/i.test(ing)) {
      lines.push(`Ingest manifest digest (tail): ${ing.slice(-12).toLowerCase()}`);
    }
  }

  const exp = m.expectedArtifacts;
  if (Array.isArray(exp)) {
    lines.push(`Expected artifact rows: ${exp.length}`);
  }

  return lines;
}
