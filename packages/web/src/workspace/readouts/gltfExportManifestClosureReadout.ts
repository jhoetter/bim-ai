/**
 * gltfExportManifestClosureReadout_v1
 *
 * Workspace readout for the gltfExportManifestClosure_v1 payload emitted by the
 * glTF export manifest. Enumerates extension tokens with presence status and
 * per-extension digest summary.
 *
 * Backend source: export_gltf.py `build_gltf_export_manifest_closure_v1`
 * data-testid: "gltf-export-manifest-closure-readout"
 */

export type GltfExtensionPresenceStatus = 'emitted' | 'skipped_ineligible';

export type GltfExtensionPresenceEntry = {
  token: string;
  status: GltfExtensionPresenceStatus;
  digestSha256: string | null;
  skipReasonCode: string | null;
};

export type GltfExportManifestClosureV1 = {
  format: 'gltfExportManifestClosure_v1';
  extensionTokens: string[];
  extensionDigests: Record<string, string>;
  gltfExportManifestClosureDigestSha256: string;
  extensionPresenceMatrix: GltfExtensionPresenceEntry[];
};

export function isGltfExportManifestClosureV1(v: unknown): v is GltfExportManifestClosureV1 {
  return (
    typeof v === 'object' &&
    v !== null &&
    (v as Record<string, unknown>)['format'] === 'gltfExportManifestClosure_v1'
  );
}

export type GltfClosureReadoutRow = {
  token: string;
  status: GltfExtensionPresenceStatus;
  /** First 12 hex chars of digestSha256, or null if not emitted. */
  digestShort: string | null;
};

export type GltfExportManifestClosureReadout = {
  format: 'gltfExportManifestClosureReadout_v1';
  emittedCount: number;
  skippedCount: number;
  closureDigestSha256: string | null;
  /** First 12 hex chars of the total closure digest, or null if unavailable. */
  closureDigestShort: string | null;
  rows: GltfClosureReadoutRow[];
  summary: string;
};

export function buildGltfExportManifestClosureReadout(
  closure: GltfExportManifestClosureV1 | null | undefined,
): GltfExportManifestClosureReadout {
  if (!closure || !isGltfExportManifestClosureV1(closure)) {
    return {
      format: 'gltfExportManifestClosureReadout_v1',
      emittedCount: 0,
      skippedCount: 0,
      closureDigestSha256: null,
      closureDigestShort: null,
      rows: [],
      summary: 'gltfExportManifestClosure_v1 not available.',
    };
  }

  const matrix = closure.extensionPresenceMatrix ?? [];
  const emittedCount = matrix.filter((e) => e.status === 'emitted').length;
  const skippedCount = matrix.filter((e) => e.status === 'skipped_ineligible').length;

  const rows: GltfClosureReadoutRow[] = matrix.map((entry) => ({
    token: entry.token,
    status: entry.status,
    digestShort: entry.digestSha256 ? entry.digestSha256.slice(0, 12) : null,
  }));

  const closureDigestSha256 = closure.gltfExportManifestClosureDigestSha256;
  const closureDigestShort = closureDigestSha256 ? closureDigestSha256.slice(0, 12) : null;

  const summary =
    `gltfExportManifestClosure_v1: ${emittedCount} emitted, ${skippedCount} skipped` +
    (closureDigestShort ? ` — closure=${closureDigestShort}…` : '');

  return {
    format: 'gltfExportManifestClosureReadout_v1',
    emittedCount,
    skippedCount,
    closureDigestSha256,
    closureDigestShort,
    rows,
    summary,
  };
}

export function formatGltfExportManifestClosureLines(
  readout: GltfExportManifestClosureReadout,
): string[] {
  const lines: string[] = [];
  lines.push('gltfExportManifestClosureReadout_v1');
  for (const r of readout.rows) {
    const digest = r.digestShort ? `digest=${r.digestShort}…` : 'digest=none';
    lines.push(`${r.status} ${r.token} [${digest}]`);
  }
  lines.push(`summary: ${readout.summary}`);
  return lines;
}

/**
 * Render a container element with data-testid="gltf-export-manifest-closure-readout"
 * for Workspace surfaces.
 */
export function renderGltfExportManifestClosureReadout(
  closure: GltfExportManifestClosureV1 | null | undefined,
): HTMLDivElement {
  const readout = buildGltfExportManifestClosureReadout(closure);
  const lines = formatGltfExportManifestClosureLines(readout);

  const container = document.createElement('div');
  container.setAttribute('data-testid', 'gltf-export-manifest-closure-readout');

  const pre = document.createElement('pre');
  pre.style.fontFamily = 'monospace';
  pre.style.fontSize = '9px';
  pre.textContent = lines.join('\n');
  container.appendChild(pre);
  return container;
}
