/** Evidence-package digest invariants readout (evidencePackageDigestInvariants_v1). */

export type DigestExcludedKeyRow = {
  key: string;
  rationale: string;
  enforcementNote?: string;
};

export type DigestInvariantsAdvisoryFinding = {
  ruleId: string;
  severity: string;
  keyName: string;
  message: string;
};

export type EvidencePackageDigestInvariantsWire = {
  format: 'evidencePackageDigestInvariants_v1';
  digestIncludedTopLevelKeys: string[];
  digestExcludedTopLevelKeys: DigestExcludedKeyRow[];
  unknownTopLevelKeys: string[];
  advisoryFindings: DigestInvariantsAdvisoryFinding[];
  evidencePackageDigestInvariantsDigestSha256: string;
};

function isExcludedKeyRow(raw: unknown): raw is DigestExcludedKeyRow {
  if (!raw || typeof raw !== 'object') return false;
  const r = raw as Record<string, unknown>;
  return typeof r.key === 'string' && typeof r.rationale === 'string';
}

function isAdvisoryFinding(raw: unknown): raw is DigestInvariantsAdvisoryFinding {
  if (!raw || typeof raw !== 'object') return false;
  const r = raw as Record<string, unknown>;
  return (
    typeof r.ruleId === 'string' &&
    typeof r.severity === 'string' &&
    typeof r.keyName === 'string' &&
    typeof r.message === 'string'
  );
}

export function parseEvidencePackageDigestInvariantsV1(
  raw: unknown,
): EvidencePackageDigestInvariantsWire | null {
  if (!raw || typeof raw !== 'object') return null;
  const m = raw as Record<string, unknown>;
  if (m.format !== 'evidencePackageDigestInvariants_v1') return null;

  const included = m.digestIncludedTopLevelKeys;
  if (!Array.isArray(included) || !included.every((x) => typeof x === 'string')) return null;

  const excluded = m.digestExcludedTopLevelKeys;
  if (!Array.isArray(excluded) || !excluded.every(isExcludedKeyRow)) return null;

  const unknown = m.unknownTopLevelKeys;
  if (!Array.isArray(unknown) || !unknown.every((x) => typeof x === 'string')) return null;

  const findings = m.advisoryFindings;
  if (!Array.isArray(findings) || !findings.every(isAdvisoryFinding)) return null;

  if (typeof m.evidencePackageDigestInvariantsDigestSha256 !== 'string') return null;

  return {
    format: 'evidencePackageDigestInvariants_v1',
    digestIncludedTopLevelKeys: [...included],
    digestExcludedTopLevelKeys: [...excluded],
    unknownTopLevelKeys: [...unknown],
    advisoryFindings: [...findings],
    evidencePackageDigestInvariantsDigestSha256: m.evidencePackageDigestInvariantsDigestSha256,
  };
}

type Props = { invariants: EvidencePackageDigestInvariantsWire | null };

export function EvidencePackageDigestInvariantsReadout({ invariants }: Props) {
  if (!invariants) return null;

  const includedCount = invariants.digestIncludedTopLevelKeys.length;
  const excludedCount = invariants.digestExcludedTopLevelKeys.length;
  const unknownCount = invariants.unknownTopLevelKeys.length;
  const digestTail = invariants.evidencePackageDigestInvariantsDigestSha256.slice(-12);

  return (
    <div
      data-testid="evidence-package-digest-invariants-readout"
      className="rounded border border-border bg-background/40 p-2"
    >
      <div className="text-[10px] font-semibold text-muted">Digest invariants</div>
      <ul className="mt-1 list-disc space-y-0.5 ps-4 text-[10px] text-muted">
        <li>
          included keys: <strong>{includedCount}</strong> · excluded:{' '}
          <strong>{excludedCount}</strong> · unknown:{' '}
          <strong className={unknownCount > 0 ? 'text-amber-600 dark:text-amber-400' : ''}>
            {unknownCount}
          </strong>
        </li>
        <li>
          invariants digest:{' '}
          <code className="text-[10px]">…{digestTail}</code>
        </li>
      </ul>
      {unknownCount > 0 ? (
        <div className="mt-2 rounded border border-amber-400/40 bg-amber-50/20 p-2 dark:bg-amber-900/10">
          <div className="text-[10px] font-semibold text-amber-700 dark:text-amber-400">
            Advisory: unknown top-level keys
          </div>
          <ul className="mt-1 list-disc space-y-0.5 ps-4 text-[10px] text-amber-700 dark:text-amber-300">
            {invariants.advisoryFindings
              .filter((f) => f.ruleId === 'evidence_package_unknown_top_level_key')
              .map((f) => (
                <li key={f.keyName}>
                  <code className="text-[10px]">{f.keyName}</code> — {f.message}
                </li>
              ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
