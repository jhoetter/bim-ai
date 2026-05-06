import { describe, expect, it } from 'vitest';

import { scheduleSortKeyChoices } from './SchedulePanel';

describe('scheduleSortKeyChoices', () => {
  it('includes plan sheet cross-ref keys and sheet plan view labels', () => {
    expect(scheduleSortKeyChoices('plans')).toEqual(
      expect.arrayContaining(['sheetId', 'sheetName']),
    );
    expect(scheduleSortKeyChoices('sheets')).toEqual(expect.arrayContaining(['planViewNames']));
  });

  it('includes opening computed keys for doors and windows', () => {
    expect(scheduleSortKeyChoices('doors')).toEqual(
      expect.arrayContaining([
        'hostHeightMm',
        'roughOpeningAreaM2',
        'roughOpeningWidthMm',
        'roughOpeningHeightMm',
        'hostWallTypeDisplay',
      ]),
    );
    expect(scheduleSortKeyChoices('windows')).toEqual(
      expect.arrayContaining([
        'sillMm',
        'roughOpeningAreaM2',
        'openingAreaM2',
        'aspectRatio',
        'headHeightMm',
        'roughOpeningWidthMm',
        'roughOpeningHeightMm',
        'hostWallTypeDisplay',
      ]),
    );
  });
});
