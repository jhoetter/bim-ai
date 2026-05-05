/** Deterministic readout for ifc_manifest_v0.ifcExchangeManifestClosure_v0. */

export type IfcExchangeManifestClosureWire = {
  schemaVersion?: number;
  authoritativeProductsAlignmentToken?: string;
  unsupportedClassAlignmentToken?: string;
  idsPointerCoverageAlignmentToken?: string;
  ifcExchangeManifestClosureDigestSha256?: string;
};

function tokenLabel(token: string | undefined): string {
  if (!token) return '—';
  switch (token) {
    case 'aligned':
      return 'aligned';
    case 'unavailable_offline':
      return 'unavailable (offline)';
    case 'replay_missing_products':
      return 'drift: replay missing products';
    case 'preview_missing_products':
      return 'drift: preview missing products';
    case 'class_set_drift':
      return 'drift: unsupported class set mismatch';
    case 'coverage_drift':
      return 'drift: IDS pointer coverage incomplete';
    default:
      return token;
  }
}

/** Returns deterministic readout lines for the closure's three alignment tokens and digest. */
export function formatIfcExchangeManifestClosureLines(
  raw: IfcExchangeManifestClosureWire | null | undefined,
): string[] {
  if (!raw || typeof raw !== 'object') return [];

  const lines: string[] = [];

  lines.push(
    `Authoritative products: ${tokenLabel(raw.authoritativeProductsAlignmentToken)}`,
  );
  lines.push(
    `Unsupported classes: ${tokenLabel(raw.unsupportedClassAlignmentToken)}`,
  );
  lines.push(
    `IDS pointer coverage: ${tokenLabel(raw.idsPointerCoverageAlignmentToken)}`,
  );

  const digest = raw.ifcExchangeManifestClosureDigestSha256;
  if (typeof digest === 'string' && /^[a-f0-9]{64}$/i.test(digest)) {
    lines.push(`Closure digest (tail): ${digest.slice(-12).toLowerCase()}`);
  }

  return lines;
}

/** Returns true if any alignment token indicates drift (advisory should fire). */
export function ifcExchangeManifestClosureHasDrift(
  raw: IfcExchangeManifestClosureWire | null | undefined,
): boolean {
  if (!raw) return false;
  const DRIFT_FREE = new Set(['aligned', 'unavailable_offline', undefined, null, '']);
  return (
    !DRIFT_FREE.has(raw.authoritativeProductsAlignmentToken) ||
    !DRIFT_FREE.has(raw.unsupportedClassAlignmentToken) ||
    !DRIFT_FREE.has(raw.idsPointerCoverageAlignmentToken)
  );
}
