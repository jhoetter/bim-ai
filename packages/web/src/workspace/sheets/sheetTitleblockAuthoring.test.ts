import { describe, expect, it } from 'vitest';

import {
  mergedTitleblockParametersForUpsert,
  type SheetTitleblockDraft,
} from './sheetTitleblockAuthoring';

function emptyDraft(): SheetTitleblockDraft {
  return {
    titleBlock: '',

    sheetNumber: '',

    revision: '',

    revisionId: '',

    revisionDate: '',

    revisionDescription: '',

    issueStatus: '',

    projectName: '',

    drawnBy: '',

    checkedBy: '',

    issuedBy: '',

    issueDate: '',
  };
}

describe('mergedTitleblockParametersForUpsert', () => {
  it('sets managed keys and preserves unknown prior keys', () => {
    const next = mergedTitleblockParametersForUpsert(
      { vendorNote: 'keep', sheetNumber: 'old' },

      {
        ...emptyDraft(),

        sheetNumber: 'A101',

        revision: 'B',

        projectName: 'P',
      },
    );

    expect(next.vendorNote).toBe('keep');

    expect(next.sheetNumber).toBe('A101');

    expect(next.revision).toBe('B');

    expect(next.projectName).toBe('P');
  });

  it('removes managed keys when draft field is blank', () => {
    const next = mergedTitleblockParametersForUpsert(
      { sheetNumber: 'X', revision: '1' },

      { ...emptyDraft(), sheetNumber: 'X' },
    );

    expect(next.sheetNumber).toBe('X');

    expect(next.revision).toBeUndefined();
  });
});
