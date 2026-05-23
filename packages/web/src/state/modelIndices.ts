import type { Element } from '@bim-ai/core';

type ElementOfKind<K extends Element['kind']> = Extract<Element, { kind: K }>;

export type ModelIndices = {
  all: readonly Element[];
  levels: readonly ElementOfKind<'level'>[];
  walls: readonly ElementOfKind<'wall'>[];
  wallsByLevel: Readonly<Record<string, readonly ElementOfKind<'wall'>[]>>;
  roomsByLevel: Readonly<Record<string, readonly ElementOfKind<'room'>[]>>;
  floorsByLevel: Readonly<Record<string, readonly ElementOfKind<'floor'>[]>>;
  columns: readonly ElementOfKind<'column'>[];
  columnsByLevel: Readonly<Record<string, readonly ElementOfKind<'column'>[]>>;
  placedAssetsByLevel: Readonly<Record<string, readonly ElementOfKind<'placed_asset'>[]>>;
  beams: readonly ElementOfKind<'beam'>[];
  openingsByWall: Readonly<
    Record<string, readonly (ElementOfKind<'door'> | ElementOfKind<'window'>)[]>
  >;
  planViews: readonly ElementOfKind<'plan_view'>[];
  schedules: readonly ElementOfKind<'schedule'>[];
  sheets: readonly ElementOfKind<'sheet'>[];
  /** PERF-G03 finishing: extra view-surface indices the command palette consumes. */
  viewpoints: readonly ElementOfKind<'viewpoint'>[];
  savedViews: readonly ElementOfKind<'saved_view'>[];
  sectionCuts: readonly ElementOfKind<'section_cut'>[];
  viewTemplates: readonly ElementOfKind<'view_template'>[];
  projectSettings: ElementOfKind<'project_settings'> | null;
  projectBasePoint: ElementOfKind<'project_base_point'> | null;
  selectableIds: readonly string[];
};

export const EMPTY_MODEL_INDICES: ModelIndices = Object.freeze({
  all: Object.freeze([]) as readonly Element[],
  levels: Object.freeze([]) as readonly ElementOfKind<'level'>[],
  walls: Object.freeze([]) as readonly ElementOfKind<'wall'>[],
  wallsByLevel: Object.freeze({}) as Record<string, ElementOfKind<'wall'>[]>,
  roomsByLevel: Object.freeze({}) as Record<string, ElementOfKind<'room'>[]>,
  floorsByLevel: Object.freeze({}) as Record<string, ElementOfKind<'floor'>[]>,
  columns: Object.freeze([]) as readonly ElementOfKind<'column'>[],
  columnsByLevel: Object.freeze({}) as Record<string, ElementOfKind<'column'>[]>,
  placedAssetsByLevel: Object.freeze({}) as Record<string, ElementOfKind<'placed_asset'>[]>,
  beams: Object.freeze([]) as readonly ElementOfKind<'beam'>[],
  openingsByWall: Object.freeze({}) as Record<
    string,
    Array<ElementOfKind<'door'> | ElementOfKind<'window'>>
  >,
  planViews: Object.freeze([]) as readonly ElementOfKind<'plan_view'>[],
  schedules: Object.freeze([]) as readonly ElementOfKind<'schedule'>[],
  sheets: Object.freeze([]) as readonly ElementOfKind<'sheet'>[],
  viewpoints: Object.freeze([]) as readonly ElementOfKind<'viewpoint'>[],
  savedViews: Object.freeze([]) as readonly ElementOfKind<'saved_view'>[],
  sectionCuts: Object.freeze([]) as readonly ElementOfKind<'section_cut'>[],
  viewTemplates: Object.freeze([]) as readonly ElementOfKind<'view_template'>[],
  projectSettings: null,
  projectBasePoint: null,
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
  const walls: ElementOfKind<'wall'>[] = [];
  const wallsByLevel: Record<string, ElementOfKind<'wall'>[]> = {};
  const roomsByLevel: Record<string, ElementOfKind<'room'>[]> = {};
  const floorsByLevel: Record<string, ElementOfKind<'floor'>[]> = {};
  const columns: ElementOfKind<'column'>[] = [];
  const columnsByLevel: Record<string, ElementOfKind<'column'>[]> = {};
  const placedAssetsByLevel: Record<string, ElementOfKind<'placed_asset'>[]> = {};
  const beams: ElementOfKind<'beam'>[] = [];
  const openingsByWall: Record<string, Array<ElementOfKind<'door'> | ElementOfKind<'window'>>> = {};
  const planViews: ElementOfKind<'plan_view'>[] = [];
  const schedules: ElementOfKind<'schedule'>[] = [];
  const sheets: ElementOfKind<'sheet'>[] = [];
  const viewpoints: ElementOfKind<'viewpoint'>[] = [];
  const savedViews: ElementOfKind<'saved_view'>[] = [];
  const sectionCuts: ElementOfKind<'section_cut'>[] = [];
  const viewTemplates: ElementOfKind<'view_template'>[] = [];
  let projectSettings: ElementOfKind<'project_settings'> | null = null;
  let projectBasePoint: ElementOfKind<'project_base_point'> | null = null;

  for (const element of all) {
    switch (element.kind) {
      case 'level':
        levels.push(element);
        break;
      case 'wall':
        walls.push(element);
        pushByKey(wallsByLevel, element.levelId, element);
        break;
      case 'room':
        pushByKey(roomsByLevel, element.levelId, element);
        break;
      case 'floor':
        pushByKey(floorsByLevel, element.levelId, element);
        break;
      case 'column':
        columns.push(element);
        pushByKey(columnsByLevel, element.levelId, element);
        break;
      case 'placed_asset':
        pushByKey(placedAssetsByLevel, element.levelId, element);
        break;
      case 'beam':
        beams.push(element);
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
      case 'viewpoint':
        viewpoints.push(element);
        break;
      case 'saved_view':
        savedViews.push(element);
        break;
      case 'section_cut':
        sectionCuts.push(element);
        break;
      case 'view_template':
        viewTemplates.push(element);
        break;
      case 'project_settings':
        projectSettings = element;
        break;
      case 'project_base_point':
        projectBasePoint = element;
        break;
      default:
        break;
    }
  }

  levels.sort((a, b) => a.elevationMm - b.elevationMm || a.id.localeCompare(b.id));
  walls.sort(byNameThenId);
  columns.sort(byNameThenId);
  beams.sort(byNameThenId);
  planViews.sort(byNameThenId);
  schedules.sort(byNameThenId);
  sheets.sort(byNameThenId);
  viewpoints.sort(byNameThenId);
  savedViews.sort(byNameThenId);
  sectionCuts.sort(byNameThenId);
  viewTemplates.sort(byNameThenId);
  for (const values of Object.values(wallsByLevel)) values.sort(byNameThenId);
  for (const values of Object.values(roomsByLevel)) values.sort(byNameThenId);
  for (const values of Object.values(floorsByLevel)) values.sort(byNameThenId);
  for (const values of Object.values(columnsByLevel)) values.sort(byNameThenId);
  for (const values of Object.values(placedAssetsByLevel)) values.sort(byNameThenId);
  for (const values of Object.values(openingsByWall)) values.sort(byNameThenId);

  return {
    all,
    levels,
    walls,
    wallsByLevel,
    roomsByLevel,
    floorsByLevel,
    columns,
    columnsByLevel,
    placedAssetsByLevel,
    beams,
    openingsByWall,
    planViews,
    schedules,
    sheets,
    viewpoints,
    savedViews,
    sectionCuts,
    viewTemplates,
    projectSettings,
    projectBasePoint,
    selectableIds: all.map((element) => element.id).sort(),
  };
}
