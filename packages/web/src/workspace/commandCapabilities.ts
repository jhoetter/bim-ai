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
    ...VISIBILITY_CAPABILITIES,
  ];
}

export function getCommandCapability(id: string): CommandCapability | undefined {
  return getAllCommandCapabilities().find((capability) => capability.id === id);
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
];

const VISIBILITY_CAPABILITIES: CommandCapability[] = [
  {
    id: 'visibility.plan.graphics',
    label: 'Visibility/Graphics',
    owner: 'workspace/project/VVDialog',
    group: 'visibility',
    scope: 'view',
    intendedModes: ['plan', 'plan-3d', 'section'],
    surfaces: ['ribbon', 'right-rail'],
    executionSurface: 'modal',
    preconditions: ['active-plan-view'],
    status: 'implemented',
    usabilityScore: 6,
    bridgeToMode: { '3d': 'plan' },
    notes: 'Plan-scoped VV/VG must not be presented as the 3D layer control.',
  },
  {
    id: 'visibility.3d.layers',
    label: '3D View Controls',
    owner: 'workspace/viewport/Viewport3DLayersPanel',
    group: 'visibility',
    scope: 'view',
    intendedModes: ['3d', 'plan-3d'],
    surfaces: ['right-rail'],
    executionSurface: 'right-rail',
    preconditions: [],
    status: 'implemented',
    usabilityScore: 7,
  },
];
