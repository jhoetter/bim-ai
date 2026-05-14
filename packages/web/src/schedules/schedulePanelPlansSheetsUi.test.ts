import { describe, expect, it } from 'vitest';

import {
  MSG_LOADING,
  MSG_NO_ROWS,
  MSG_NO_SHEET_ELEMENTS,
  MSG_OPEN_SAVED_MODEL,
  noScheduleElementMessage,
  registryNoModelMode,
} from './schedulePanelPlansSheetsUi';

describe('schedulePanelPlansSheetsUi', () => {
  it('registryNoModelMode routes sheets local list vs empty', () => {
    expect(registryNoModelMode(0)).toBe('noSheets');
    expect(registryNoModelMode(2)).toBe('sheetsLocal');
  });

  it('noScheduleElementMessage uses category noun', () => {
    expect(noScheduleElementMessage('plans')).toContain('plan view');
    expect(noScheduleElementMessage('views')).toContain('view list');
    expect(noScheduleElementMessage('finishes')).toContain('finish');
    expect(noScheduleElementMessage('sheets')).toContain('sheet');
    expect(noScheduleElementMessage('floors')).toContain('floor');
    expect(noScheduleElementMessage('assemblies')).toContain('material assembly');
  });

  it('exports stable copy for loading / no rows / open model / no sheet elements', () => {
    expect(MSG_OPEN_SAVED_MODEL.length).toBeGreaterThan(5);
    expect(MSG_LOADING).toBe('Loading schedule…');
    expect(MSG_NO_ROWS).toBe('No rows in this schedule.');
    expect(MSG_NO_SHEET_ELEMENTS).toBe('No sheet elements yet.');
  });
});
