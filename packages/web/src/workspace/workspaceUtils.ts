import type { Element } from '@bim-ai/core';
import {
  OrbitViewIcon,
  PlanViewIcon,
  ProjectInfoIcon,
  ScheduleViewIcon,
  SectionViewIcon,
  SheetIcon,
} from '@bim-ai/icons';

import type { UxComment } from '../state/store';
import type { PlanTool } from '../state/storeTypes';
import type { ToolId, WorkspaceMode } from '../tools/toolRegistry';
import type { LeftRailSection } from './shell';
import { readSheetIntent, sheetIntentLabel } from './sheets/sheetIntent';

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
  'query',
  'wall',
  'floor',
  'roof',
  'door',
  'window',
  'stair',
  'railing',
  'room',
  'area',
  'dimension',
  'section',
  'elevation',
  'tag',
  'reference-plane',
  'property-line',
  'floor-sketch',
  'roof-sketch',
  'room-separation-sketch',
  'masking-region',
  'plan-region',
  'align',
  'split',
  'trim',
  'trim-extend',
  'offset',
  'wall-join',
  'wall-opening',
  'shaft',
  'duct',
  'pipe',
  'cable-tray',
  'mep-equipment',
  'fixture',
  'mep-terminal',
  'mep-opening-request',
  'column',
  'beam',
  'ceiling',
  'area-boundary',
  'toposolid_subdivision',
  'measure',
  'mirror',
  'move',
  'rotate',
  'grid',
  'copy',
  'component',
]);

export function validatePlanTool(tool: ToolId): PlanTool | null {
  if (KNOWN_PLAN_TOOLS.has(tool)) return tool as PlanTool;
  return null;
}

export function canonicalPlanToolForMode(tool: ToolId, mode: WorkspaceMode): PlanTool | null {
  const planTool = validatePlanTool(tool);
  if (!planTool) return null;
  if (tool === 'floor') return mode === '3d' ? 'floor' : 'floor-sketch';
  if (tool === 'roof') return mode === '3d' ? 'roof' : 'roof-sketch';
  return planTool;
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
  const savedViews = all.filter(
    (e): e is Extract<Element, { kind: 'saved_view' }> => e.kind === 'saved_view',
  );
  const sections = all.filter(
    (e): e is Extract<Element, { kind: 'section_cut' }> => e.kind === 'section_cut',
  );
  const sheets = all.filter((e): e is Extract<Element, { kind: 'sheet' }> => e.kind === 'sheet');
  const schedules = all.filter(
    (e): e is Extract<Element, { kind: 'schedule' }> => e.kind === 'schedule',
  );
  const projectSettings = all.find(
    (e): e is Extract<Element, { kind: 'project_settings' }> => e.kind === 'project_settings',
  );
  const levelNameById = new Map(levels.map((l) => [l.id, l.name]));
  return [
    ...(projectSettings
      ? [
          {
            id: 'project',
            label: 'Project',
            icon: ProjectInfoIcon,
            rows: [
              {
                id: projectSettings.id,
                label: 'Project settings',
                icon: ProjectInfoIcon,
                hint: projectSettings.displayLocale ?? 'global settings',
                renamable: false,
              },
            ],
          },
        ]
      : []),
    {
      id: 'floor-plans',
      label: 'Floor Plans',
      icon: PlanViewIcon,
      rows: planViews.map((p) => ({
        id: p.id,
        label: p.name,
        icon: PlanViewIcon,
        hint: `${levelNameById.get(p.levelId) ?? p.levelId}`,
        renamable: true,
      })),
    },
    {
      id: '3d-views',
      label: '3D Views',
      icon: OrbitViewIcon,
      rows: [...viewpoints, ...savedViews]
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((v) => ({
          id: v.id,
          label: v.name,
          icon: OrbitViewIcon,
          hint: v.kind === 'saved_view' ? 'saved 3D snapshot' : 'saved camera',
          renamable: true,
        })),
    },
    {
      id: 'sections',
      label: 'Sections',
      icon: SectionViewIcon,
      rows: sections.map((s) => ({
        id: s.id,
        label: s.name,
        icon: SectionViewIcon,
        hint: 'cut view',
        renamable: true,
      })),
    },
    {
      id: 'sheets',
      label: 'Sheets',
      icon: SheetIcon,
      rows: sheets.map((s) => ({
        id: s.id,
        label: s.name,
        icon: SheetIcon,
        hint: `${sheetIntentLabel(readSheetIntent(s))} · ${s.viewportsMm?.length ?? 0} viewports`,
        renamable: true,
      })),
    },
    {
      id: 'schedules',
      label: 'Schedules',
      icon: ScheduleViewIcon,
      rows: schedules.map((s) => ({
        id: s.id,
        label: s.name,
        icon: ScheduleViewIcon,
        renamable: true,
      })),
    },
  ];
}
