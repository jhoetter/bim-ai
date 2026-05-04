import { describe, expect, it } from 'vitest';

import { scheduleSortKeyChoices } from './SchedulePanel';

describe('scheduleSortKeyChoices', () => {
  it('includes opening computed keys for doors and windows', () => {
    expect(scheduleSortKeyChoices('doors')).toEqual(
      expect.arrayContaining(['hostHeightMm', 'roughOpeningAreaM2']),
    );
    expect(scheduleSortKeyChoices('windows')).toEqual(
      expect.arrayContaining([
        'sillMm',
        'roughOpeningAreaM2',
        'openingAreaM2',
        'aspectRatio',
        'headHeightMm',
      ]),
    );
  });
});
