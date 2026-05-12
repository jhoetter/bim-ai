import type { Element } from '@bim-ai/core';
import {
  OrbitViewHifi,
  PlanViewHifi,
  ScheduleViewHifi,
  SectionViewHifi,
  SheetHifi,
} from '@bim-ai/icons';

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

export function buildPrimaryNavigationSections(
  elementsById: Record<string, Element>,
): LeftRailSection[] {
  const all = Object.values(elementsById) as Element[];
  const levels = all
    .filter((e): e is Extract<Element, { kind: 'level' }> => e.kind === 'level')
    .sort((a, b) => a.elevationMm - b.elevationMm);
  const allPlanViews = all.filter(
    (e): e is Extract<Element, { kind: 'plan_view' }> => e.kind === 'plan_view',
  );
  const planViews = allPlanViews.filter((p) => p.planViewSubtype !== 'area_plan');
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
      id: 'concept',
      label: 'Concept',
      icon: PlanViewHifi,
      rows: conceptBoards.map((board) => ({
        id: board.id,
        label: board.name,
        icon: PlanViewHifi,
        hint: `${board.attachments.length} attachments`,
      })),
    },
    {
      id: 'floor-plans',
      label: 'Floor Plans',
      icon: PlanViewHifi,
      rows: planViews.map((p) => ({
        id: p.id,
        label: p.name,
        icon: PlanViewHifi,
        hint: `${levelNameById.get(p.levelId) ?? p.levelId}`,
      })),
    },
    {
      id: '3d-views',
      label: '3D Views',
      icon: OrbitViewHifi,
      rows: viewpoints.map((v) => ({
        id: v.id,
        label: v.name,
        icon: OrbitViewHifi,
        hint: 'saved camera',
      })),
    },
    {
      id: 'sections',
      label: 'Sections',
      icon: SectionViewHifi,
      rows: sections.map((s) => ({
        id: s.id,
        label: s.name,
        icon: SectionViewHifi,
        hint: 'cut view',
      })),
    },
    {
      id: 'sheets',
      label: 'Sheets',
      icon: SheetHifi,
      rows: sheets.map((s) => ({
        id: s.id,
        label: s.name,
        icon: SheetHifi,
        hint: `${s.viewportsMm?.length ?? 0} viewports`,
      })),
    },
    {
      id: 'schedules',
      label: 'Schedules',
      icon: ScheduleViewHifi,
      rows: schedules.map((s) => ({ id: s.id, label: s.name, icon: ScheduleViewHifi })),
    },
  ];
}
