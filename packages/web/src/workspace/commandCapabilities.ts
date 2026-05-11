import type { TFunction } from 'i18next';

import {
  MODIFY_TOOL_IDS,
  getToolRegistry,
  type ToolDefinition,
  type ToolId,
  type WorkspaceMode,
} from '../tools/toolRegistry';

export const CAPABILITY_VIEW_MODES = [
  'plan',
  '3d',
  'plan-3d',
  'section',
  'sheet',
  'schedule',
  'agent',
  'concept',
] as const satisfies readonly WorkspaceMode[];

export type CapabilityViewMode = (typeof CAPABILITY_VIEW_MODES)[number];

export type CommandSurface =
  | 'topbar'
  | 'ribbon'
  | 'floating-palette'
  | 'cmd-k'
  | 'left-rail'
  | 'right-rail'
  | 'canvas-context'
  | 'sheet-canvas'
  | 'schedule-grid'
  | 'statusbar';

export type CommandGroup =
  | 'author'
  | 'modify'
  | 'view'
  | 'navigate'
  | 'visibility'
  | 'document'
  | 'review'
  | 'system';

export type ExecutionSurface =
  | 'plan-canvas'
  | 'viewport-3d'
  | 'sheet-canvas'
  | 'schedule-grid'
  | 'right-rail'
  | 'modal'
  | 'global';

export type CapabilityStatus = 'implemented' | 'partial' | 'planned';

export interface CommandCapability {
  id: string;
  label: string;
  owner: string;
  group: CommandGroup;
  scope: 'universal' | 'view' | 'selection' | 'model';
  intendedModes: CapabilityViewMode[];
  surfaces: CommandSurface[];
  executionSurface: ExecutionSurface;
  preconditions: string[];
  status: CapabilityStatus;
  usabilityScore: number;
  bridgeToMode?: Partial<Record<CapabilityViewMode, CapabilityViewMode>>;
  notes?: string;
}

export type CommandAvailability =
  | { state: 'enabled'; capability: CommandCapability }
  | {
      state: 'bridge';
      capability: CommandCapability;
      targetMode: CapabilityViewMode;
      reason: string;
    }
  | { state: 'disabled'; capability: CommandCapability; reason: string };

export interface CommandExposure {
  commandId: string;
  mode: CapabilityViewMode;
  surface: CommandSurface;
  behavior: 'direct' | 'bridge' | 'disabled';
}

export interface CommandExposureViolation {
  exposure: CommandExposure;
  expected: CommandAvailability['state'];
  reason: string;
}

const IDENTITY_T = ((key: string) => key) as unknown as TFunction;

export function getAllCommandCapabilities(): CommandCapability[] {
  return [
    ...buildToolCapabilities(),
    ...NAVIGATION_CAPABILITIES,
    ...SYSTEM_CAPABILITIES,
    ...SCHEDULE_CAPABILITIES,
    ...SHEET_CAPABILITIES,
    ...SECTION_CAPABILITIES,
    ...VIEW_3D_CAPABILITIES,
    ...EDIT_3D_CAPABILITIES,
    ...VISIBILITY_CAPABILITIES,
  ];
}

export function getCommandCapability(id: string): CommandCapability | undefined {
  return getAllCommandCapabilities().find((capability) => capability.id === id);
}

export function capabilityIdForTool(toolId: ToolId): string {
  return `tool.${toolId}`;
}

export function commandModeBadge(availability: CommandAvailability): string {
  if (availability.state === 'disabled') return 'Unavailable';
  if (availability.state === 'bridge') return formatCapabilityMode(availability.targetMode);
  if (availability.capability.scope === 'universal') return 'Universal';
  if (availability.capability.intendedModes.length === CAPABILITY_VIEW_MODES.length) {
    return 'Universal';
  }
  return availability.capability.intendedModes.map(formatCapabilityMode).join(' / ');
}

export function evaluateCommandInMode(
  commandId: string,
  mode: CapabilityViewMode,
): CommandAvailability | null {
  const capability = getCommandCapability(commandId);
  if (!capability) return null;
  if (capability.intendedModes.includes(mode)) {
    return { state: 'enabled', capability };
  }
  const targetMode = capability.bridgeToMode?.[mode];
  if (targetMode) {
    return {
      state: 'bridge',
      capability,
      targetMode,
      reason: `${capability.label} runs in ${formatCapabilityMode(targetMode)}, not ${formatCapabilityMode(mode)}.`,
    };
  }
  return {
    state: 'disabled',
    capability,
    reason: `${capability.label} is unavailable in ${formatCapabilityMode(mode)}.`,
  };
}

export function auditCommandExposures(
  exposures: readonly CommandExposure[],
): CommandExposureViolation[] {
  const violations: CommandExposureViolation[] = [];
  for (const exposure of exposures) {
    const availability = evaluateCommandInMode(exposure.commandId, exposure.mode);
    if (!availability) {
      violations.push({
        exposure,
        expected: 'disabled',
        reason: `No capability is registered for ${exposure.commandId}.`,
      });
      continue;
    }
    if (availability.state === 'enabled') continue;
    if (availability.state === 'bridge' && exposure.behavior === 'bridge') continue;
    if (availability.state === 'disabled' && exposure.behavior === 'disabled') continue;
    violations.push({
      exposure,
      expected: availability.state,
      reason: availability.reason,
    });
  }
  return violations;
}

export function unreachableCommandCapabilities(): CommandCapability[] {
  return getAllCommandCapabilities().filter(
    (capability) => capability.surfaces.length === 0 || capability.intendedModes.length === 0,
  );
}

export function formatCapabilityMode(mode: CapabilityViewMode): string {
  switch (mode) {
    case 'plan':
      return 'Plan';
    case '3d':
      return '3D';
    case 'plan-3d':
      return 'Plan + 3D';
    case 'section':
      return 'Section';
    case 'sheet':
      return 'Sheet';
    case 'schedule':
      return 'Schedule';
    case 'agent':
      return 'Agent Review';
    case 'concept':
      return 'Concept';
  }
}

function buildToolCapabilities(): CommandCapability[] {
  return Object.values(getToolRegistry(IDENTITY_T)).map((tool) => ({
    id: `tool.${tool.id}`,
    label: labelForTool(tool),
    owner: 'tools/toolRegistry',
    group: groupForTool(tool.id),
    scope: 'view',
    intendedModes: [...tool.modes],
    surfaces: ['floating-palette', 'ribbon', 'cmd-k'],
    executionSurface: executionSurfaceForTool(tool),
    preconditions: preconditionsForTool(tool.id),
    status: tool.modes.includes('3d') && tool.id !== 'select' ? 'partial' : 'implemented',
    usabilityScore: tool.modes.includes('3d') && tool.id !== 'select' ? 6 : 7,
    bridgeToMode: bridgeModesForTool(tool),
    notes: tool.tooltip,
  }));
}

function labelForTool(tool: ToolDefinition): string {
  if (!tool.label.startsWith('tools.')) return tool.label;
  return tool.id
    .split(/[-_]/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function groupForTool(toolId: ToolId): CommandGroup {
  if (MODIFY_TOOL_IDS.has(toolId)) return 'modify';
  if (toolId === 'select' || toolId === 'query' || toolId === 'measure') return 'view';
  if (toolId === 'dimension' || toolId === 'tag') return 'document';
  return 'author';
}

function executionSurfaceForTool(tool: ToolDefinition): ExecutionSurface {
  if (tool.modes.length === 1 && tool.modes[0] === '3d') return 'viewport-3d';
  if (tool.modes.includes('3d') && !tool.modes.includes('plan')) return 'viewport-3d';
  if (tool.modes.includes('sheet')) return 'sheet-canvas';
  if (tool.modes.includes('schedule')) return 'schedule-grid';
  return 'plan-canvas';
}

function preconditionsForTool(toolId: ToolId): string[] {
  switch (toolId) {
    case 'floor':
    case 'roof':
    case 'dimension':
      return ['has-wall'];
    case 'railing':
      return ['has-floor-or-wall'];
    case 'move':
    case 'copy':
    case 'rotate':
    case 'mirror':
    case 'align':
      return ['has-selection'];
    default:
      return [];
  }
}

function bridgeModesForTool(
  tool: ToolDefinition,
): Partial<Record<CapabilityViewMode, CapabilityViewMode>> | undefined {
  if (!tool.modes.includes('plan') && !tool.modes.includes('plan-3d')) return undefined;
  const bridge: Partial<Record<CapabilityViewMode, CapabilityViewMode>> = {};
  for (const mode of CAPABILITY_VIEW_MODES) {
    if (!tool.modes.includes(mode)) bridge[mode] = 'plan';
  }
  return Object.keys(bridge).length ? bridge : undefined;
}

const NAVIGATION_CAPABILITIES: CommandCapability[] = [
  {
    id: 'navigate.plan',
    label: 'Go to Plan',
    owner: 'cmdPalette/defaultCommands',
    group: 'navigate',
    scope: 'universal',
    intendedModes: [...CAPABILITY_VIEW_MODES],
    surfaces: ['cmd-k', 'topbar', 'ribbon', 'left-rail'],
    executionSurface: 'global',
    preconditions: [],
    status: 'implemented',
    usabilityScore: 8,
  },
  {
    id: 'navigate.plan-3d',
    label: 'Go to Plan + 3D',
    owner: 'cmdPalette/defaultCommands',
    group: 'navigate',
    scope: 'universal',
    intendedModes: [...CAPABILITY_VIEW_MODES],
    surfaces: ['cmd-k', 'topbar', 'ribbon', 'left-rail'],
    executionSurface: 'global',
    preconditions: [],
    status: 'implemented',
    usabilityScore: 8,
  },
  {
    id: 'navigate.3d',
    label: 'Go to 3D',
    owner: 'cmdPalette/defaultCommands',
    group: 'navigate',
    scope: 'universal',
    intendedModes: [...CAPABILITY_VIEW_MODES],
    surfaces: ['cmd-k', 'topbar', 'ribbon', 'left-rail'],
    executionSurface: 'global',
    preconditions: [],
    status: 'implemented',
    usabilityScore: 8,
  },
  {
    id: 'navigate.section',
    label: 'Go to Section',
    owner: 'cmdPalette/defaultCommands',
    group: 'navigate',
    scope: 'universal',
    intendedModes: [...CAPABILITY_VIEW_MODES],
    surfaces: ['cmd-k', 'topbar', 'ribbon', 'left-rail'],
    executionSurface: 'global',
    preconditions: [],
    status: 'implemented',
    usabilityScore: 8,
  },
  {
    id: 'navigate.sheet',
    label: 'Go to Sheet',
    owner: 'cmdPalette/defaultCommands',
    group: 'navigate',
    scope: 'universal',
    intendedModes: [...CAPABILITY_VIEW_MODES],
    surfaces: ['cmd-k', 'topbar', 'ribbon', 'left-rail'],
    executionSurface: 'global',
    preconditions: [],
    status: 'implemented',
    usabilityScore: 8,
  },
  {
    id: 'navigate.schedule',
    label: 'Go to Schedule',
    owner: 'cmdPalette/defaultCommands',
    group: 'navigate',
    scope: 'universal',
    intendedModes: [...CAPABILITY_VIEW_MODES],
    surfaces: ['cmd-k', 'topbar', 'ribbon', 'left-rail'],
    executionSurface: 'global',
    preconditions: [],
    status: 'implemented',
    usabilityScore: 8,
  },
  {
    id: 'navigate.agent',
    label: 'Go to Agent Review',
    owner: 'cmdPalette/defaultCommands',
    group: 'navigate',
    scope: 'universal',
    intendedModes: [...CAPABILITY_VIEW_MODES],
    surfaces: ['cmd-k', 'topbar', 'ribbon', 'left-rail'],
    executionSurface: 'global',
    preconditions: [],
    status: 'implemented',
    usabilityScore: 8,
  },
  {
    id: 'navigate.concept',
    label: 'Go to Concept Board',
    owner: 'cmdPalette/defaultCommands',
    group: 'navigate',
    scope: 'universal',
    intendedModes: [...CAPABILITY_VIEW_MODES],
    surfaces: ['cmd-k', 'topbar', 'left-rail'],
    executionSurface: 'global',
    preconditions: [],
    status: 'implemented',
    usabilityScore: 8,
  },
  {
    id: 'navigate.architecture',
    label: 'Switch to Architecture perspective',
    owner: 'cmdPalette/defaultCommands',
    group: 'navigate',
    scope: 'universal',
    intendedModes: [...CAPABILITY_VIEW_MODES],
    surfaces: ['cmd-k', 'left-rail'],
    executionSurface: 'global',
    preconditions: [],
    status: 'implemented',
    usabilityScore: 8,
  },
  {
    id: 'navigate.structure',
    label: 'Switch to Structure perspective',
    owner: 'cmdPalette/defaultCommands',
    group: 'navigate',
    scope: 'universal',
    intendedModes: [...CAPABILITY_VIEW_MODES],
    surfaces: ['cmd-k', 'left-rail'],
    executionSurface: 'global',
    preconditions: [],
    status: 'implemented',
    usabilityScore: 8,
  },
  {
    id: 'navigate.mep',
    label: 'Switch to MEP perspective',
    owner: 'cmdPalette/defaultCommands',
    group: 'navigate',
    scope: 'universal',
    intendedModes: [...CAPABILITY_VIEW_MODES],
    surfaces: ['cmd-k', 'left-rail'],
    executionSurface: 'global',
    preconditions: [],
    status: 'implemented',
    usabilityScore: 8,
  },
  {
    id: 'view.phase.demolition',
    label: 'Set view phase: Demolition',
    owner: 'cmdPalette/defaultCommands',
    group: 'view',
    scope: 'view',
    intendedModes: [...CAPABILITY_VIEW_MODES],
    surfaces: ['cmd-k'],
    executionSurface: 'global',
    preconditions: [],
    status: 'implemented',
    usabilityScore: 7,
  },
  {
    id: 'view.phase.existing',
    label: 'Set view phase: Existing',
    owner: 'cmdPalette/defaultCommands',
    group: 'view',
    scope: 'view',
    intendedModes: [...CAPABILITY_VIEW_MODES],
    surfaces: ['cmd-k'],
    executionSurface: 'global',
    preconditions: [],
    status: 'implemented',
    usabilityScore: 7,
  },
  {
    id: 'view.phase.new',
    label: 'Set view phase: New Construction',
    owner: 'cmdPalette/defaultCommands',
    group: 'view',
    scope: 'view',
    intendedModes: [...CAPABILITY_VIEW_MODES],
    surfaces: ['cmd-k'],
    executionSurface: 'global',
    preconditions: [],
    status: 'implemented',
    usabilityScore: 7,
  },
  {
    id: 'view.plan.detail.coarse',
    label: 'Plan Detail: Coarse',
    owner: 'cmdPalette/defaultCommands',
    group: 'view',
    scope: 'view',
    intendedModes: ['plan', 'plan-3d', 'section'],
    surfaces: ['cmd-k'],
    executionSurface: 'plan-canvas',
    preconditions: ['active-plan-view'],
    status: 'implemented',
    usabilityScore: 8,
  },
  {
    id: 'view.plan.detail.medium',
    label: 'Plan Detail: Medium',
    owner: 'cmdPalette/defaultCommands',
    group: 'view',
    scope: 'view',
    intendedModes: ['plan', 'plan-3d', 'section'],
    surfaces: ['cmd-k'],
    executionSurface: 'plan-canvas',
    preconditions: ['active-plan-view'],
    status: 'implemented',
    usabilityScore: 8,
  },
  {
    id: 'view.plan.detail.fine',
    label: 'Plan Detail: Fine',
    owner: 'cmdPalette/defaultCommands',
    group: 'view',
    scope: 'view',
    intendedModes: ['plan', 'plan-3d', 'section'],
    surfaces: ['cmd-k'],
    executionSurface: 'plan-canvas',
    preconditions: ['active-plan-view'],
    status: 'implemented',
    usabilityScore: 8,
  },
];

const SYSTEM_CAPABILITIES: CommandCapability[] = [
  {
    id: 'theme.toggle',
    label: 'Toggle Theme',
    owner: 'cmdPalette/defaultCommands',
    group: 'system',
    scope: 'universal',
    intendedModes: [...CAPABILITY_VIEW_MODES],
    surfaces: ['cmd-k', 'topbar'],
    executionSurface: 'global',
    preconditions: [],
    status: 'implemented',
    usabilityScore: 8,
  },
  {
    id: 'theme.light',
    label: 'Switch Theme: Light',
    owner: 'cmdPalette/defaultCommands',
    group: 'system',
    scope: 'universal',
    intendedModes: [...CAPABILITY_VIEW_MODES],
    surfaces: ['cmd-k', 'topbar'],
    executionSurface: 'global',
    preconditions: [],
    status: 'implemented',
    usabilityScore: 8,
  },
  {
    id: 'theme.dark',
    label: 'Switch Theme: Dark',
    owner: 'cmdPalette/defaultCommands',
    group: 'system',
    scope: 'universal',
    intendedModes: [...CAPABILITY_VIEW_MODES],
    surfaces: ['cmd-k', 'topbar'],
    executionSurface: 'global',
    preconditions: [],
    status: 'implemented',
    usabilityScore: 8,
  },
  {
    id: 'settings.language.toggle',
    label: 'Toggle Language',
    owner: 'cmdPalette/defaultCommands',
    group: 'system',
    scope: 'universal',
    intendedModes: [...CAPABILITY_VIEW_MODES],
    surfaces: ['cmd-k', 'topbar'],
    executionSurface: 'global',
    preconditions: [],
    status: 'implemented',
    usabilityScore: 8,
  },
  {
    id: 'settings.language.en',
    label: 'Language: English',
    owner: 'cmdPalette/defaultCommands',
    group: 'system',
    scope: 'universal',
    intendedModes: [...CAPABILITY_VIEW_MODES],
    surfaces: ['cmd-k', 'topbar'],
    executionSurface: 'global',
    preconditions: [],
    status: 'implemented',
    usabilityScore: 8,
  },
  {
    id: 'settings.language.de',
    label: 'Language: Deutsch',
    owner: 'cmdPalette/defaultCommands',
    group: 'system',
    scope: 'universal',
    intendedModes: [...CAPABILITY_VIEW_MODES],
    surfaces: ['cmd-k', 'topbar'],
    executionSurface: 'global',
    preconditions: [],
    status: 'implemented',
    usabilityScore: 8,
  },
  {
    id: 'project.open-menu',
    label: 'Open Project Menu',
    owner: 'workspace/shell/TopBar',
    group: 'system',
    scope: 'universal',
    intendedModes: [...CAPABILITY_VIEW_MODES],
    surfaces: ['cmd-k', 'topbar', 'ribbon'],
    executionSurface: 'global',
    preconditions: [],
    status: 'implemented',
    usabilityScore: 8,
  },
  {
    id: 'project.save-snapshot',
    label: 'Save Snapshot',
    owner: 'workspace/project/ProjectMenu',
    group: 'system',
    scope: 'universal',
    intendedModes: [...CAPABILITY_VIEW_MODES],
    surfaces: ['cmd-k', 'topbar'],
    executionSurface: 'global',
    preconditions: [],
    status: 'implemented',
    usabilityScore: 8,
  },
  {
    id: 'project.restore-snapshot',
    label: 'Restore Snapshot',
    owner: 'workspace/project/ProjectMenu',
    group: 'system',
    scope: 'universal',
    intendedModes: [...CAPABILITY_VIEW_MODES],
    surfaces: ['cmd-k', 'topbar'],
    executionSurface: 'modal',
    preconditions: [],
    status: 'implemented',
    usabilityScore: 8,
  },
  {
    id: 'project.share-presentation',
    label: 'Share Presentation',
    owner: 'workspace/share/SharePresentationModal',
    group: 'system',
    scope: 'universal',
    intendedModes: [...CAPABILITY_VIEW_MODES],
    surfaces: ['cmd-k', 'topbar'],
    executionSurface: 'modal',
    preconditions: ['presentation-pages'],
    status: 'implemented',
    usabilityScore: 8,
  },
  {
    id: 'library.open-family',
    label: 'Open Family Library',
    owner: 'families/FamilyLibraryPanel',
    group: 'system',
    scope: 'universal',
    intendedModes: [...CAPABILITY_VIEW_MODES],
    surfaces: ['cmd-k', 'ribbon', 'left-rail'],
    executionSurface: 'modal',
    preconditions: [],
    status: 'implemented',
    usabilityScore: 8,
  },
  {
    id: 'help.keyboard-shortcuts',
    label: 'Open Keyboard Shortcuts',
    owner: 'cmd/CheatsheetModal',
    group: 'system',
    scope: 'universal',
    intendedModes: [...CAPABILITY_VIEW_MODES],
    surfaces: ['cmd-k', 'topbar', 'ribbon'],
    executionSurface: 'modal',
    preconditions: [],
    status: 'implemented',
    usabilityScore: 8,
  },
  {
    id: 'tabs.close-inactive',
    label: 'Close Inactive Views',
    owner: 'workspace/shell/TopBar',
    group: 'system',
    scope: 'universal',
    intendedModes: [...CAPABILITY_VIEW_MODES],
    surfaces: ['cmd-k', 'topbar'],
    executionSurface: 'global',
    preconditions: [],
    status: 'implemented',
    usabilityScore: 8,
  },
  {
    id: 'shell.toggle-left-rail',
    label: 'Toggle Left Rail',
    owner: 'workspace/Workspace',
    group: 'system',
    scope: 'universal',
    intendedModes: [...CAPABILITY_VIEW_MODES],
    surfaces: ['cmd-k', 'topbar'],
    executionSurface: 'global',
    preconditions: [],
    status: 'implemented',
    usabilityScore: 8,
  },
  {
    id: 'shell.toggle-right-rail',
    label: 'Toggle Right Rail',
    owner: 'workspace/Workspace',
    group: 'system',
    scope: 'universal',
    intendedModes: [...CAPABILITY_VIEW_MODES],
    surfaces: ['cmd-k', 'right-rail'],
    executionSurface: 'global',
    preconditions: [],
    status: 'implemented',
    usabilityScore: 8,
  },
];

const SCHEDULE_CAPABILITIES: CommandCapability[] = [
  {
    id: 'schedule.open-selected-row',
    label: 'Schedule: Open Selected Row',
    owner: 'workspace/ModeShells',
    group: 'document',
    scope: 'selection',
    intendedModes: ['schedule'],
    surfaces: ['cmd-k', 'schedule-grid'],
    executionSurface: 'schedule-grid',
    preconditions: ['active-schedule', 'selected-schedule-row'],
    status: 'implemented',
    usabilityScore: 8,
  },
  {
    id: 'schedule.place-on-sheet',
    label: 'Schedule: Place on Sheet',
    owner: 'workspace/ModeShells',
    group: 'document',
    scope: 'view',
    intendedModes: ['schedule'],
    surfaces: ['cmd-k', 'schedule-grid'],
    executionSurface: 'sheet-canvas',
    preconditions: ['active-schedule', 'available-sheet'],
    status: 'implemented',
    usabilityScore: 8,
  },
  {
    id: 'schedule.duplicate',
    label: 'Schedule: Duplicate',
    owner: 'workspace/ModeShells',
    group: 'document',
    scope: 'view',
    intendedModes: ['schedule'],
    surfaces: ['cmd-k', 'schedule-grid'],
    executionSurface: 'schedule-grid',
    preconditions: ['active-schedule'],
    status: 'implemented',
    usabilityScore: 8,
  },
  {
    id: 'schedule.open-controls',
    label: 'Schedule: Sort, Filter, Group, Columns',
    owner: 'schedules/SchedulePanel',
    group: 'view',
    scope: 'view',
    intendedModes: ['schedule'],
    surfaces: ['cmd-k', 'schedule-grid'],
    executionSurface: 'schedule-grid',
    preconditions: ['active-schedule'],
    status: 'implemented',
    usabilityScore: 8,
  },
];

const SHEET_CAPABILITIES: CommandCapability[] = [
  {
    id: 'sheet.place-recommended-views',
    label: 'Sheet: Place Recommended Views',
    owner: 'workspace/sheets/sheetRecommendedViewports',
    group: 'document',
    scope: 'view',
    intendedModes: ['sheet'],
    surfaces: ['cmd-k', 'sheet-canvas'],
    executionSurface: 'sheet-canvas',
    preconditions: ['active-sheet', 'placeable-views'],
    status: 'implemented',
    usabilityScore: 8,
  },
  {
    id: 'sheet.edit-titleblock',
    label: 'Sheet: Edit Titleblock',
    owner: 'workspace/sheets/sheetTitleblockAuthoring',
    group: 'document',
    scope: 'view',
    intendedModes: ['sheet'],
    surfaces: ['cmd-k', 'sheet-canvas'],
    executionSurface: 'sheet-canvas',
    preconditions: ['active-sheet'],
    status: 'implemented',
    usabilityScore: 8,
  },
  {
    id: 'sheet.edit-viewports',
    label: 'Sheet: Edit Viewports',
    owner: 'workspace/sheets/sheetViewportAuthoring',
    group: 'document',
    scope: 'view',
    intendedModes: ['sheet'],
    surfaces: ['cmd-k', 'sheet-canvas'],
    executionSurface: 'sheet-canvas',
    preconditions: ['active-sheet'],
    status: 'implemented',
    usabilityScore: 8,
  },
  {
    id: 'sheet.export-share',
    label: 'Sheet: Export / Share',
    owner: 'workspace/share/SharePresentationModal',
    group: 'document',
    scope: 'view',
    intendedModes: ['sheet'],
    surfaces: ['cmd-k', 'sheet-canvas'],
    executionSurface: 'modal',
    preconditions: ['active-sheet', 'presentation-pages'],
    status: 'implemented',
    usabilityScore: 8,
  },
];

const SECTION_CAPABILITIES: CommandCapability[] = [
  {
    id: 'section.place-on-sheet',
    label: 'Section: Place on Sheet',
    owner: 'workspace/sheets/SectionPlaceholderPane',
    group: 'document',
    scope: 'view',
    intendedModes: ['section'],
    surfaces: ['cmd-k'],
    executionSurface: 'sheet-canvas',
    preconditions: ['active-section', 'available-sheet'],
    status: 'implemented',
    usabilityScore: 8,
  },
  {
    id: 'section.open-source-plan',
    label: 'Section: Open Source Plan',
    owner: 'workspace/Workspace',
    group: 'navigate',
    scope: 'view',
    intendedModes: ['section'],
    surfaces: ['cmd-k'],
    executionSurface: 'global',
    preconditions: ['active-section'],
    status: 'implemented',
    usabilityScore: 8,
  },
  {
    id: 'section.crop-depth.increase',
    label: 'Section: Increase Far Clip',
    owner: 'cmdPalette/defaultCommands',
    group: 'view',
    scope: 'view',
    intendedModes: ['section'],
    surfaces: ['cmd-k'],
    executionSurface: 'plan-canvas',
    preconditions: ['active-section'],
    status: 'implemented',
    usabilityScore: 8,
  },
  {
    id: 'section.crop-depth.decrease',
    label: 'Section: Decrease Far Clip',
    owner: 'cmdPalette/defaultCommands',
    group: 'view',
    scope: 'view',
    intendedModes: ['section'],
    surfaces: ['cmd-k'],
    executionSurface: 'plan-canvas',
    preconditions: ['active-section'],
    status: 'implemented',
    usabilityScore: 8,
  },
];

const VIEW_3D_CAPABILITIES: CommandCapability[] = [
  {
    id: 'view.3d.fit',
    label: '3D: Fit Model',
    owner: 'cmdPalette/defaultCommands',
    group: 'view',
    scope: 'view',
    intendedModes: ['3d', 'plan-3d'],
    surfaces: ['cmd-k', 'right-rail'],
    executionSurface: 'viewport-3d',
    preconditions: [],
    status: 'implemented',
    usabilityScore: 8,
  },
  {
    id: 'view.3d.reset-camera',
    label: '3D: Reset Camera',
    owner: 'cmdPalette/defaultCommands',
    group: 'view',
    scope: 'view',
    intendedModes: ['3d', 'plan-3d'],
    surfaces: ['cmd-k', 'right-rail'],
    executionSurface: 'viewport-3d',
    preconditions: [],
    status: 'implemented',
    usabilityScore: 8,
  },
  {
    id: 'view.3d.projection.orthographic',
    label: '3D: Orthographic Projection',
    owner: 'cmdPalette/defaultCommands',
    group: 'view',
    scope: 'view',
    intendedModes: ['3d', 'plan-3d'],
    surfaces: ['cmd-k', 'right-rail'],
    executionSurface: 'viewport-3d',
    preconditions: [],
    status: 'implemented',
    usabilityScore: 8,
  },
  {
    id: 'view.3d.projection.perspective',
    label: '3D: Perspective Projection',
    owner: 'cmdPalette/defaultCommands',
    group: 'view',
    scope: 'view',
    intendedModes: ['3d', 'plan-3d'],
    surfaces: ['cmd-k', 'right-rail'],
    executionSurface: 'viewport-3d',
    preconditions: [],
    status: 'implemented',
    usabilityScore: 8,
  },
  {
    id: 'view.3d.walk.toggle',
    label: '3D: Toggle Walk Mode',
    owner: 'cmdPalette/defaultCommands',
    group: 'view',
    scope: 'view',
    intendedModes: ['3d', 'plan-3d'],
    surfaces: ['cmd-k', 'right-rail'],
    executionSurface: 'viewport-3d',
    preconditions: [],
    status: 'implemented',
    usabilityScore: 8,
  },
  {
    id: 'view.3d.section-box.toggle',
    label: '3D: Toggle Section Box',
    owner: 'cmdPalette/defaultCommands',
    group: 'view',
    scope: 'view',
    intendedModes: ['3d', 'plan-3d'],
    surfaces: ['cmd-k', 'right-rail'],
    executionSurface: 'viewport-3d',
    preconditions: [],
    status: 'implemented',
    usabilityScore: 8,
  },
  {
    id: 'view.3d.saved-view.save-current',
    label: '3D: Save Current Viewpoint',
    owner: 'cmdPalette/defaultCommands',
    group: 'view',
    scope: 'view',
    intendedModes: ['3d', 'plan-3d'],
    surfaces: ['cmd-k'],
    executionSurface: 'viewport-3d',
    preconditions: ['current-3d-camera-pose'],
    status: 'implemented',
    usabilityScore: 8,
  },
  {
    id: 'view.3d.saved-view.reset',
    label: '3D: Reset to Saved Viewpoint',
    owner: 'cmdPalette/defaultCommands',
    group: 'view',
    scope: 'view',
    intendedModes: ['3d', 'plan-3d'],
    surfaces: ['cmd-k', 'right-rail'],
    executionSurface: 'viewport-3d',
    preconditions: ['active-viewpoint'],
    status: 'implemented',
    usabilityScore: 8,
  },
  {
    id: 'view.3d.saved-view.update',
    label: '3D: Update Saved Viewpoint',
    owner: 'cmdPalette/defaultCommands',
    group: 'view',
    scope: 'view',
    intendedModes: ['3d', 'plan-3d'],
    surfaces: ['cmd-k', 'right-rail'],
    executionSurface: 'viewport-3d',
    preconditions: ['active-viewpoint'],
    status: 'implemented',
    usabilityScore: 8,
  },
  {
    id: 'display.render.shaded',
    label: 'Render: Shaded',
    owner: 'cmdPalette/defaultCommands',
    group: 'view',
    scope: 'view',
    intendedModes: ['3d', 'plan-3d'],
    surfaces: ['cmd-k', 'right-rail'],
    executionSurface: 'viewport-3d',
    preconditions: [],
    status: 'implemented',
    usabilityScore: 8,
  },
  {
    id: 'display.render.wireframe',
    label: 'Render: Wireframe',
    owner: 'cmdPalette/defaultCommands',
    group: 'view',
    scope: 'view',
    intendedModes: ['3d', 'plan-3d'],
    surfaces: ['cmd-k', 'right-rail'],
    executionSurface: 'viewport-3d',
    preconditions: [],
    status: 'implemented',
    usabilityScore: 8,
  },
  {
    id: 'display.render.consistent-colors',
    label: 'Render: Consistent Colors',
    owner: 'cmdPalette/defaultCommands',
    group: 'view',
    scope: 'view',
    intendedModes: ['3d', 'plan-3d'],
    surfaces: ['cmd-k', 'right-rail'],
    executionSurface: 'viewport-3d',
    preconditions: [],
    status: 'implemented',
    usabilityScore: 8,
  },
];

const EDIT_3D_CAPABILITIES: CommandCapability[] = [
  {
    id: 'view.3d.wall.insert-door',
    label: '3D: Insert Door on Selected Wall',
    owner: 'cmdPalette/defaultCommands',
    group: 'author',
    scope: 'selection',
    intendedModes: ['3d', 'plan-3d'],
    surfaces: ['cmd-k', 'right-rail', 'canvas-context'],
    executionSurface: 'viewport-3d',
    preconditions: ['selected-wall'],
    status: 'implemented',
    usabilityScore: 8,
  },
  {
    id: 'view.3d.wall.insert-window',
    label: '3D: Insert Window on Selected Wall',
    owner: 'cmdPalette/defaultCommands',
    group: 'author',
    scope: 'selection',
    intendedModes: ['3d', 'plan-3d'],
    surfaces: ['cmd-k', 'right-rail', 'canvas-context'],
    executionSurface: 'viewport-3d',
    preconditions: ['selected-wall'],
    status: 'implemented',
    usabilityScore: 8,
  },
  {
    id: 'view.3d.wall.insert-opening',
    label: '3D: Insert Opening on Selected Wall',
    owner: 'cmdPalette/defaultCommands',
    group: 'author',
    scope: 'selection',
    intendedModes: ['3d', 'plan-3d'],
    surfaces: ['cmd-k', 'right-rail', 'canvas-context'],
    executionSurface: 'viewport-3d',
    preconditions: ['selected-wall'],
    status: 'implemented',
    usabilityScore: 8,
  },
  {
    id: 'view.3d.wall.generate-section',
    label: '3D: Generate Section from Selected Wall',
    owner: 'cmdPalette/defaultCommands',
    group: 'document',
    scope: 'selection',
    intendedModes: ['3d', 'plan-3d'],
    surfaces: ['cmd-k', 'right-rail', 'canvas-context'],
    executionSurface: 'viewport-3d',
    preconditions: ['selected-wall'],
    status: 'implemented',
    usabilityScore: 8,
  },
  {
    id: 'view.3d.wall.generate-elevation',
    label: '3D: Generate Elevation from Selected Wall',
    owner: 'cmdPalette/defaultCommands',
    group: 'document',
    scope: 'selection',
    intendedModes: ['3d', 'plan-3d'],
    surfaces: ['cmd-k', 'right-rail', 'canvas-context'],
    executionSurface: 'viewport-3d',
    preconditions: ['selected-wall'],
    status: 'implemented',
    usabilityScore: 8,
  },
];

const VISIBILITY_CAPABILITIES: CommandCapability[] = [
  {
    id: 'visibility.active-controls',
    label: 'Open Active View Visibility Controls',
    owner: 'cmdPalette/defaultCommands',
    group: 'visibility',
    scope: 'view',
    intendedModes: ['plan', '3d', 'plan-3d', 'section'],
    surfaces: ['cmd-k'],
    executionSurface: 'global',
    preconditions: [],
    status: 'implemented',
    usabilityScore: 8,
    notes: 'Routes to plan VV/VG in plan-like views and to right-rail 3D View Controls in 3D.',
  },
  {
    id: 'visibility.plan.graphics',
    label: 'Visibility/Graphics',
    owner: 'workspace/project/VVDialog',
    group: 'visibility',
    scope: 'view',
    intendedModes: ['plan', 'plan-3d', 'section'],
    surfaces: ['cmd-k', 'ribbon', 'right-rail'],
    executionSurface: 'modal',
    preconditions: ['active-plan-view'],
    status: 'implemented',
    usabilityScore: 7,
    bridgeToMode: { '3d': 'plan' },
    notes: 'Plan-scoped VV/VG must not be presented as the 3D layer control.',
  },
  {
    id: 'display.reveal-hidden',
    label: 'Reveal Hidden Elements',
    owner: 'cmdPalette/defaultCommands',
    group: 'visibility',
    scope: 'view',
    intendedModes: ['plan', 'plan-3d', '3d', 'section'],
    surfaces: ['cmd-k', 'right-rail'],
    executionSurface: 'global',
    preconditions: [],
    status: 'implemented',
    usabilityScore: 7,
  },
  {
    id: 'display.neighborhood',
    label: 'Toggle Neighborhood Masses',
    owner: 'cmdPalette/defaultCommands',
    group: 'visibility',
    scope: 'view',
    intendedModes: ['3d', 'plan-3d'],
    surfaces: ['cmd-k', 'right-rail'],
    executionSurface: 'viewport-3d',
    preconditions: [],
    status: 'implemented',
    usabilityScore: 7,
  },
  {
    id: 'visibility.3d.layers',
    label: '3D View Controls',
    owner: 'workspace/viewport/Viewport3DLayersPanel',
    group: 'visibility',
    scope: 'view',
    intendedModes: ['3d', 'plan-3d'],
    surfaces: ['cmd-k', 'right-rail'],
    executionSurface: 'right-rail',
    preconditions: [],
    status: 'implemented',
    usabilityScore: 7,
  },
  {
    id: 'visibility.3d.show-all-categories',
    label: '3D: Show All Categories',
    owner: 'cmdPalette/defaultCommands',
    group: 'visibility',
    scope: 'view',
    intendedModes: ['3d', 'plan-3d'],
    surfaces: ['cmd-k'],
    executionSurface: 'viewport-3d',
    preconditions: [],
    status: 'implemented',
    usabilityScore: 8,
  },
  {
    id: 'visibility.3d.hide-all-categories',
    label: '3D: Hide All Categories',
    owner: 'cmdPalette/defaultCommands',
    group: 'visibility',
    scope: 'view',
    intendedModes: ['3d', 'plan-3d'],
    surfaces: ['cmd-k'],
    executionSurface: 'viewport-3d',
    preconditions: [],
    status: 'implemented',
    usabilityScore: 8,
  },
];
