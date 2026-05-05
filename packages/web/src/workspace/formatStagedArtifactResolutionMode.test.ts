import { describe, expect, it } from 'vitest';

import { formatStagedArtifactResolutionMode } from './formatStagedArtifactResolutionMode';

describe('formatStagedArtifactResolutionMode', () => {
  it('maps known modes', () => {
    expect(formatStagedArtifactResolutionMode('local_relative')).toBe('local_relative');
    expect(formatStagedArtifactResolutionMode('github_actions')).toBe('github_actions');
  });

  it('passes through unknown string modes from the API', () => {
    expect(formatStagedArtifactResolutionMode('future_mode')).toBe('future_mode');
  });

  it('returns em dash for non-string unknown', () => {
    expect(formatStagedArtifactResolutionMode(null)).toBe('—');
    expect(formatStagedArtifactResolutionMode(1)).toBe('—');
  });
});
