import { describe, expect, it } from 'vitest';

import { seedModelsFromBootstrap } from './useWorkspaceSnapshot';

describe('seedModelsFromBootstrap', () => {
  it('lists only canonical seed-library project models', () => {
    const rows = seedModelsFromBootstrap({
      projects: [
        {
          id: 'ordinary-project',
          slug: 'm2-wave5-1234abcd',
          title: 'M2 Wave 5 disposable local evidence project',
          models: [{ id: 'old-local-model', slug: 'old-local', revision: 9 }],
        },
        {
          id: '892ee9f7-307c-5e40-a838-3bc64b5f5f92',
          slug: 'seeds',
          title: 'Seed Library',
          seedLibrary: true,
          kind: 'seed-library',
          models: [{ id: 'seed-target-house-1', slug: 'target-house-1', revision: 42 }],
        },
      ],
    });

    expect(rows).toEqual([
      {
        id: 'seed-target-house-1',
        slug: 'target-house-1',
        label: 'Seed Library / target-house-1',
        projectTitle: 'Seed Library',
        revision: 42,
      },
    ]);
  });
});
