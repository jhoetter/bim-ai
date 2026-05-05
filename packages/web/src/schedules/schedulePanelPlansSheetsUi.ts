/** Pure helpers for registry schedule panel (plans/sheets tabs) — testable empty-state routing. */

export type RegistryModelTab = 'floors' | 'roofs' | 'stairs' | 'plans' | 'sheets';

export const MSG_OPEN_SAVED_MODEL = 'Open a saved model to load server schedules.';

export const MSG_NO_ROWS = 'No rows in this schedule.';

export const MSG_LOADING = 'Loading schedule…';

export const MSG_NO_SHEET_ELEMENTS = 'No sheet elements yet.';

export function scheduleCategoryScheduleNoun(tab: RegistryModelTab): string {
  switch (tab) {
    case 'plans': {
      return 'plan view';
    }

    case 'floors': {
      return 'floor';
    }

    case 'roofs': {
      return 'roof';
    }

    case 'stairs': {
      return 'stair';
    }

    case 'sheets': {
      return 'sheet';
    }

    default: {
      const exhaustive: never = tab;
      return exhaustive;
    }
  }
}

export function noScheduleElementMessage(tab: RegistryModelTab): string {
  return `No ${scheduleCategoryScheduleNoun(tab)} schedule element in this model.`;
}

/** When there is no model id, sheets may still show a local list; other tabs ask to open a model. */
export function registryNoModelMode(sheetElementCount: number): 'openModel' | 'sheetsLocal' | 'noSheets' {
  if (sheetElementCount > 0) return 'sheetsLocal';
  return 'noSheets';
}
