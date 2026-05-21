import type { Element } from '@bim-ai/core';

type ElementOfKind<K extends Element['kind']> = Extract<Element, { kind: K }>;

export type ModelIndices = {
  all: readonly Element[];
  levels: readonly ElementOfKind<'level'>[];
  wallsByLevel: Readonly<Record<string, readonly ElementOfKind<'wall'>[]>>;
  roomsByLevel: Readonly<Record<string, readonly ElementOfKind<'room'>[]>>;
  openingsByWall: Readonly<
    Record<string, readonly (ElementOfKind<'door'> | ElementOfKind<'window'>)[]>
  >;
  planViews: readonly ElementOfKind<'plan_view'>[];
  schedules: readonly ElementOfKind<'schedule'>[];
  sheets: readonly ElementOfKind<'sheet'>[];
  projectSettings: ElementOfKind<'project_settings'> | null;
  selectableIds: readonly string[];
};

export const EMPTY_MODEL_INDICES: ModelIndices = Object.freeze({
  all: Object.freeze([]) as readonly Element[],
  levels: Object.freeze([]) as readonly ElementOfKind<'level'>[],
  wallsByLevel: Object.freeze({}) as Record<string, ElementOfKind<'wall'>[]>,
  roomsByLevel: Object.freeze({}) as Record<string, ElementOfKind<'room'>[]>,
  openingsByWall: Object.freeze({}) as Record<
    string,
    Array<ElementOfKind<'door'> | ElementOfKind<'window'>>
  >,
  planViews: Object.freeze([]) as readonly ElementOfKind<'plan_view'>[],
  schedules: Object.freeze([]) as readonly ElementOfKind<'schedule'>[],
  sheets: Object.freeze([]) as readonly ElementOfKind<'sheet'>[],
  projectSettings: null,
  selectableIds: Object.freeze([]) as readonly string[],
});

function pushByKey<T>(index: Record<string, T[]>, key: string | undefined, item: T): void {
  if (!key) return;
  (index[key] ??= []).push(item);
}

function byNameThenId(a: { name?: string; id: string }, b: { name?: string; id: string }): number {
  return (a.name ?? '').localeCompare(b.name ?? '') || a.id.localeCompare(b.id);
}

export function buildModelIndices(elementsById: Record<string, Element>): ModelIndices {
  const all = Object.values(elementsById);
  const levels: ElementOfKind<'level'>[] = [];
  const wallsByLevel: Record<string, ElementOfKind<'wall'>[]> = {};
  const roomsByLevel: Record<string, ElementOfKind<'room'>[]> = {};
  const openingsByWall: Record<string, Array<ElementOfKind<'door'> | ElementOfKind<'window'>>> = {};
  const planViews: ElementOfKind<'plan_view'>[] = [];
  const schedules: ElementOfKind<'schedule'>[] = [];
  const sheets: ElementOfKind<'sheet'>[] = [];
  let projectSettings: ElementOfKind<'project_settings'> | null = null;

  for (const element of all) {
    switch (element.kind) {
      case 'level':
        levels.push(element);
        break;
      case 'wall':
        pushByKey(wallsByLevel, element.levelId, element);
        break;
      case 'room':
        pushByKey(roomsByLevel, element.levelId, element);
        break;
      case 'door':
      case 'window':
        pushByKey(openingsByWall, element.wallId, element);
        break;
      case 'plan_view':
        planViews.push(element);
        break;
      case 'schedule':
        schedules.push(element);
        break;
      case 'sheet':
        sheets.push(element);
        break;
      case 'project_settings':
        projectSettings = element;
        break;
      default:
        break;
    }
  }

  levels.sort((a, b) => a.elevationMm - b.elevationMm || a.id.localeCompare(b.id));
  planViews.sort(byNameThenId);
  schedules.sort(byNameThenId);
  sheets.sort(byNameThenId);
  for (const values of Object.values(wallsByLevel)) values.sort(byNameThenId);
  for (const values of Object.values(roomsByLevel)) values.sort(byNameThenId);
  for (const values of Object.values(openingsByWall)) values.sort(byNameThenId);

  return {
    all,
    levels,
    wallsByLevel,
    roomsByLevel,
    openingsByWall,
    planViews,
    schedules,
    sheets,
    projectSettings,
    selectableIds: all.map((element) => element.id).sort(),
  };
}
