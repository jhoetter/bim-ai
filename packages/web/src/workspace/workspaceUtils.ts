import type { Element } from '@bim-ai/core';
import {
  FamilyIcon,
  LevelIcon,
  PlanViewIcon,
  ScheduleViewIcon,
  SectionViewIcon,
  SheetIcon,
  OrbitViewIcon,
  WallLayerIcon,
} from '@bim-ai/ui';

import { BUILT_IN_FAMILIES } from '../families/familyCatalog';
import type { UxComment } from '../state/store';
import type { PlanTool } from '../state/storeTypes';
import type { ToolId } from '../tools/toolRegistry';
import type { LeftRailSection } from './shell';

export function mapComments(rows: Record<string, unknown>[]): UxComment[] {
  return rows.map((row) => ({
    id: String(row.id ?? ''),
    userDisplay: String(row.userDisplay ?? row.user_display ?? ''),
    body: String(row.body ?? ''),
    elementId: (row.elementId ?? row.element_id ?? null) as string | null,
    levelId: (row.levelId ?? row.level_id ?? null) as string | null,
    anchorXMm:
      row.anchorXMm !== undefined
        ? Number(row.anchorXMm)
        : row.anchor_x_mm !== undefined
          ? Number(row.anchor_x_mm)
          : null,
    anchorYMm:
      row.anchorYMm !== undefined
        ? Number(row.anchorYMm)
        : row.anchor_y_mm !== undefined
          ? Number(row.anchor_y_mm)
          : null,
    resolved: Boolean(row.resolved),
    createdAt: String(row.createdAt ?? row.created_at ?? ''),
  }));
}

export const KNOWN_PLAN_TOOLS = new Set<ToolId>([
  'select',
  'wall',
  'door',
  'window',
  'room',
  'area',
  'dimension',
  'tag',
  'floor-sketch',
  'roof-sketch',
  'room-separation-sketch',
  'plan-region',
  'area-boundary',
  'toposolid_subdivision',
  'grid',
  'mirror',
  'copy',
  'component',
]);

export function validatePlanTool(tool: ToolId): PlanTool | null {
  if (KNOWN_PLAN_TOOLS.has(tool)) return tool as PlanTool;
  return null;
}

export function planToolToToolId(tool: PlanTool): ToolId {
  if (tool === 'room_rectangle') return 'room';
  return tool as ToolId;
}

export function buildBrowserSections(elementsById: Record<string, Element>): LeftRailSection[] {
  const all = Object.values(elementsById) as Element[];
  const levels = all
    .filter((e): e is Extract<Element, { kind: 'level' }> => e.kind === 'level')
    .sort((a, b) => a.elevationMm - b.elevationMm);
  const allPlanViews = all.filter(
    (e): e is Extract<Element, { kind: 'plan_view' }> => e.kind === 'plan_view',
  );
  const planViews = allPlanViews.filter((p) => p.planViewSubtype !== 'area_plan');
  const areaPlans = allPlanViews.filter((p) => p.planViewSubtype === 'area_plan');
  const viewpoints = all.filter(
    (e): e is Extract<Element, { kind: 'viewpoint' }> => e.kind === 'viewpoint',
  );
  const sections = all.filter(
    (e): e is Extract<Element, { kind: 'section_cut' }> => e.kind === 'section_cut',
  );
  const sheets = all.filter((e): e is Extract<Element, { kind: 'sheet' }> => e.kind === 'sheet');
  const schedules = all.filter(
    (e): e is Extract<Element, { kind: 'schedule' }> => e.kind === 'schedule',
  );
  const conceptBoards = all.filter(
    (e): e is Extract<Element, { kind: 'view_concept_board' }> => e.kind === 'view_concept_board',
  );
  const levelNameById = new Map(levels.map((l) => [l.id, l.name]));
  return [
    {
      id: 'project',
      label: 'Project',
      icon: LevelIcon,
      rows: [
        {
          id: 'levels',
          label: 'Levels',
          icon: LevelIcon,
          hint: 'model datums',
          children: levels.map((l) => ({
            id: l.id,
            label: l.name,
            icon: LevelIcon,
            hint: `datum · ${l.elevationMm}mm`,
          })),
        },
      ],
    },
    {
      id: 'views',
      label: 'Views',
      icon: PlanViewIcon,
      rows: [
        {
          id: 'plans',
          label: 'Floor Plans',
          icon: PlanViewIcon,
          hint: 'saved views',
          children: planViews.map((p) => ({
            id: p.id,
            label: p.name,
            icon: PlanViewIcon,
            hint: `${levelNameById.get(p.levelId) ?? p.levelId} · view`,
          })),
        },
        {
          id: 'viewpoints',
          label: '3D Views',
          icon: OrbitViewIcon,
          hint: 'saved cameras',
          children: viewpoints.map((v) => ({
            id: v.id,
            label: v.name,
            icon: OrbitViewIcon,
            hint: 'saved view',
          })),
        },
        {
          id: 'sections',
          label: 'Sections',
          icon: SectionViewIcon,
          hint: 'cut views',
          children: sections.map((s) => ({
            id: s.id,
            label: s.name,
            icon: SectionViewIcon,
            hint: 'cut view',
          })),
        },
        ...(areaPlans.length > 0
          ? [
              {
                id: 'area-plans',
                label: 'Area Plans',
                children: areaPlans.map((p) => ({ id: p.id, label: p.name })),
              },
            ]
          : []),
      ],
    },
    {
      id: 'sheets',
      label: 'Sheets',
      icon: SheetIcon,
      rows: sheets.map((s) => ({
        id: s.id,
        label: s.name,
        icon: SheetIcon,
        hint: `${s.viewportsMm?.length ?? 0} viewports`,
      })),
    },
    {
      id: 'schedules',
      label: 'Schedules',
      icon: ScheduleViewIcon,
      rows: schedules.map((s) => ({ id: s.id, label: s.name, icon: ScheduleViewIcon })),
    },
    {
      id: 'concept',
      label: 'Concept',
      icon: PlanViewIcon,
      rows: [
        ...conceptBoards.map((board) => ({
          id: board.id,
          label: board.name,
          icon: PlanViewIcon,
          hint: `${board.attachments.length} attachments`,
        })),
        { id: 'new-concept-board', label: '+ New board', icon: PlanViewIcon },
      ],
    },
    {
      id: 'types',
      label: 'Types',
      icon: WallLayerIcon,
      rows: [
        {
          id: 'wall-types',
          label: 'Wall Types',
          children: [
            ...all
              .filter((e): e is Extract<Element, { kind: 'wall_type' }> => e.kind === 'wall_type')
              .map((t) => ({ id: t.id, label: t.name, hint: `${t.layers.length} layers` })),
            { id: 'new-wall-type', label: '+ New Wall Type' },
          ],
        },
        {
          id: 'floor-types',
          label: 'Floor Types',
          children: [
            ...all
              .filter((e): e is Extract<Element, { kind: 'floor_type' }> => e.kind === 'floor_type')
              .map((t) => ({ id: t.id, label: t.name, hint: `${t.layers.length} layers` })),
            { id: 'new-floor-type', label: '+ New Floor Type' },
          ],
        },
        {
          id: 'roof-types',
          label: 'Roof Types',
          children: [
            ...all
              .filter((e): e is Extract<Element, { kind: 'roof_type' }> => e.kind === 'roof_type')
              .map((t) => ({ id: t.id, label: t.name, hint: `${t.layers.length} layers` })),
            { id: 'new-roof-type', label: '+ New Roof Type' },
          ],
        },
      ],
    },
    {
      id: 'families',
      label: 'Families',
      icon: FamilyIcon,
      rows: (['door', 'window', 'stair', 'railing'] as const)
        .map((disc) => {
          const discLabel = (
            { door: 'Doors', window: 'Windows', stair: 'Stairs', railing: 'Railings' } as const
          )[disc];
          const customOfDisc = all.filter(
            (e): e is Extract<Element, { kind: 'family_type' }> =>
              e.kind === 'family_type' && e.discipline === disc,
          );
          const builtInRows = BUILT_IN_FAMILIES.filter((f) => f.discipline === disc).map((fam) => ({
            id: fam.id,
            label: fam.name,
            children: fam.defaultTypes.map((t) => ({ id: t.id, label: t.name })),
          }));
          const customRows = customOfDisc.map((ct) => ({
            id: ct.id,
            label: String(ct.parameters.name ?? ct.id),
            hint: 'custom',
          }));
          return {
            id: `fam-group-${disc}`,
            label: discLabel,
            children: [...builtInRows, ...customRows],
          };
        })
        .filter((g) => g.children.length > 0),
    },
  ];
}
