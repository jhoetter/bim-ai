/** `stagedArtifactLinks_v1.resolutionMode` literals from the evidence package. */
export type StagedArtifactResolutionMode = 'local_relative' | 'github_actions';

export function formatStagedArtifactResolutionMode(mode: unknown): string {
  const normalized: StagedArtifactResolutionMode | undefined =
    mode === 'local_relative' || mode === 'github_actions' ? mode : undefined;
  switch (normalized) {
    case undefined:
      return typeof mode === 'string' ? mode : '—';
    case 'local_relative':
    case 'github_actions':
      return normalized;
    default: {
      const _exhaustive: never = normalized;
      return _exhaustive;
    }
  }
}
