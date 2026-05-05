import { describe, expect, it } from 'vitest';

import { summarizeArtifactUploadManifestV1 } from './artifactUploadManifestReadout';

describe('summarizeArtifactUploadManifestV1', () => {
  it('returns empty for unknown shapes', () => {
    expect(summarizeArtifactUploadManifestV1(null)).toEqual([]);
    expect(summarizeArtifactUploadManifestV1({ format: 'other' })).toEqual([]);
  });

  it('summarizes default-off CI omission', () => {
    const lines = summarizeArtifactUploadManifestV1({
      format: 'artifactUploadManifest_v1',
      uploadEligible: false,
      sideEffectsEnabled: false,
      sideEffectsReason: 'Staged CI correlation hints are disabled by default.',
      resolutionMode: 'local_relative',
      ciProviderHint_v1: {
        format: 'ciProviderHint_v1',
        provider: 'github_actions',
        omittedReason: 'Non-secret GitHub Actions correlation omitted.',
      },
      contentDigests: {
        format: 'artifactUploadContentDigests_v1',
        packageSemanticDigestSha256: 'a'.repeat(64),
      },
      expectedArtifacts: [{ id: 'x' }, { id: 'y' }],
    });
    expect(lines.some((ln) => ln.includes('Upload eligible'))).toBe(true);
    expect(lines.some((ln) => ln.includes('Side-effect hints: off'))).toBe(true);
    expect(lines.some((ln) => ln.includes('local_relative'))).toBe(true);
    expect(lines.some((ln) => ln.includes('CI provider hint: omitted'))).toBe(true);
    expect(lines.some((ln) => ln.includes('Package digest (tail):'))).toBe(true);
    expect(lines.some((ln) => ln.includes('Expected artifact rows: 2'))).toBe(true);
  });

  it('summarizes GitHub Actions hint when present', () => {
    const lines = summarizeArtifactUploadManifestV1({
      format: 'artifactUploadManifest_v1',
      uploadEligible: false,
      sideEffectsEnabled: true,
      sideEffectsReason: 'opt-in',
      resolutionMode: 'github_actions',
      ciProviderHint_v1: {
        format: 'ciProviderHint_v1',
        provider: 'github_actions',
        repository: 'org/repo',
        runId: '99',
        runArtifactsWebUrl: 'https://github.com/org/repo/actions/runs/99#artifacts',
      },
      contentDigests: {
        format: 'artifactUploadContentDigests_v1',
        packageSemanticDigestSha256: 'b'.repeat(64),
        artifactIngestManifestDigestSha256: 'c'.repeat(64),
      },
      expectedArtifacts: [],
    });
    expect(lines.some((ln) => ln.includes('Side-effect hints: on'))).toBe(true);
    expect(lines.some((ln) => ln.includes('org/repo'))).toBe(true);
    expect(lines.some((ln) => ln.includes('run 99'))).toBe(true);
    expect(lines.some((ln) => ln.includes('Ingest manifest digest (tail):'))).toBe(true);
    expect(lines.some((ln) => ln.includes('Expected artifact rows: 0'))).toBe(true);
  });
});
