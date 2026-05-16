import type { TFunction } from 'i18next';
import type { LensMode } from '@bim-ai/core';

import {
  MODIFY_TOOL_IDS,
  getToolRegistry,
  type ToolDefinition,
  type ToolId,
  type WorkspaceMode,
} from '../tools/toolRegistry';
import {
  getAuthoringCommandContract,
  type AuthoringCommandKind,
  type AuthoringCompletionBehavior,
} from '../tools/authoringCommandContract';

export const CAPABILITY_VIEW_MODES = [
  'plan',
  '3d',
  'section',
  'sheet',
  'schedule',
] as const satisfies readonly WorkspaceMode[];

export type CapabilityViewMode = (typeof CAPABILITY_VIEW_MODES)[number];
export type CapabilityLensMode = LensMode;

export type CommandSurface =
  | 'header'
  | 'ribbon'
  | 'cmd-k'
  | 'primary-sidebar'
  | 'secondary-sidebar'
  | 'element-sidebar'
  | 'canvas-context'
  | 'canvas'
  | 'footer'
  | 'dialog';

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
  | 'header'
  | 'ribbon'
  | 'primary-sidebar'
  | 'secondary-sidebar'
  | 'element-sidebar'
  | 'canvas'
  | 'footer'
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
  lifecycleKind?: AuthoringCommandKind;
  completionBehavior?: AuthoringCompletionBehavior;
  previewSemantics?: string;
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
  lensMode: CapabilityLensMode = 'all',
): CommandAvailability | null {
  const capability = getCommandCapability(commandId);
  if (!capability) return null;
  if (capability.intendedModes.includes(mode)) {
    const lensDisabledReason = lensDisabledReasonForCommand(commandId, lensMode);
    if (lensDisabledReason) {
      return {
        state: 'disabled',
        capability,
        reason: lensDisabledReason,
      };
    }
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

const LENS_DISABLED_COMMANDS: Record<'structure' | 'mep', { ids: Set<string>; reason: string }> = {
  structure: {
    ids: new Set([
      'tool.room',
      'tool.area',
      'tool.component',
      'tool.door',
      'tool.window',
      'view.3d.wall.insert-door',
      'view.3d.wall.insert-window',
    ]),
    reason:
      'Unavailable in Structure lens: switch to Architecture lens for architectural room/opening authoring.',
  },
  mep: {
    ids: new Set([
      'tool.wall',
      'tool.door',
      'tool.window',
      'tool.floor',
      'tool.roof',
      'tool.room',
      'tool.area',
      'tool.stair',
      'tool.railing',
      'tool.component',
      'tool.wall-opening',
      'tool.shaft',
      'tool.column',
      'tool.beam',
      'tool.ceiling',
      'tool.grid',
      'tool.reference-plane',
      'tool.property-line',
      'tool.area-boundary',
      'tool.toposolid_subdivision',
      'view.3d.wall.insert-door',
      'view.3d.wall.insert-window',
      'view.3d.wall.insert-opening',
      'generate.walls-from-boundary',
    ]),
    reason:
      'Unavailable in MEP lens: switch to Architecture or Structure lens for envelope/structural authoring.',
  },
};

function lensDisabledReasonForCommand(
  commandId: string,
  lensMode: CapabilityLensMode,
): string | undefined {
  if (lensMode !== 'structure' && lensMode !== 'mep') return undefined;
  const lensRules = LENS_DISABLED_COMMANDS[lensMode];
  if (!lensRules) return undefined;
  return lensRules.ids.has(commandId) ? lensRules.reason : undefined;
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
    case 'section':
      return 'Section';
    case 'sheet':
      return 'Sheet';
    case 'schedule':
      return 'Schedule';
  }
}

function buildToolCapabilities(): CommandCapability[] {
  return Object.values(getToolRegistry(IDENTITY_T)).map((tool) => {
    const contract = getAuthoringCommandContract(tool.id);
    if (!contract) {
      throw new Error(
        `[commandCapabilities] No authoring contract found for tool "${tool.id}". Add it to AUTHORING_COMMAND_CONTRACTS in authoringCommandContract.ts.`,
      );
    }
    return {
      id: `tool.${tool.id}`,
      label: labelForTool(tool),
      owner: 'tools/toolRegistry',
      group: groupForTool(tool.id),
      scope: 'view',
      intendedModes: [...tool.modes],
      surfaces: ['ribbon', 'cmd-k'],
      executionSurface: executionSurfaceForTool(tool),
      preconditions: [...new Set([...preconditionsForTool(tool.id), ...contract.requiredContext])],
      status: 'implemented',
      usabilityScore: 8,
      lifecycleKind: contract.kind,
      completionBehavior: contract.completionBehavior,
      previewSemantics: contract.previewSemantics,
      bridgeToMode: bridgeModesForTool(tool),
      notes: tool.tooltip,
    };
  });
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
  if (tool.modes.includes('sheet') || tool.modes.includes('schedule')) return 'canvas';
  return 'canvas';
}

function preconditionsForTool(toolId: ToolId): string[] {
  switch (toolId) {
    case 'door':
    case 'window':
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
  if (!tool.modes.includes('plan')) return undefined;
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
    surfaces: ['cmd-k', 'primary-sidebar'],
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
    surfaces: ['cmd-k', 'primary-sidebar'],
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
    surfaces: ['cmd-k', 'primary-sidebar'],
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
    surfaces: ['cmd-k', 'primary-sidebar'],
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
    surfaces: ['cmd-k', 'primary-sidebar'],
    executionSurface: 'global',
    preconditions: [],
    status: 'implemented',
    usabilityScore: 8,
  },
  {
    id: 'navigate.architecture',
    label: 'Switch lens: Architecture',
    owner: 'cmdPalette/defaultCommands',
    group: 'navigate',
    scope: 'universal',
    intendedModes: [...CAPABILITY_VIEW_MODES],
    surfaces: ['cmd-k', 'primary-sidebar'],
    executionSurface: 'primary-sidebar',
    preconditions: [],
    status: 'implemented',
    usabilityScore: 8,
  },
  {
    id: 'navigate.structure',
    label: 'Switch lens: Structure',
    owner: 'cmdPalette/defaultCommands',
    group: 'navigate',
    scope: 'universal',
    intendedModes: [...CAPABILITY_VIEW_MODES],
    surfaces: ['cmd-k', 'primary-sidebar'],
    executionSurface: 'primary-sidebar',
    preconditions: [],
    status: 'implemented',
    usabilityScore: 8,
  },
  {
    id: 'navigate.mep',
    label: 'Switch lens: MEP',
    owner: 'cmdPalette/defaultCommands',
    group: 'navigate',
    scope: 'universal',
    intendedModes: [...CAPABILITY_VIEW_MODES],
    surfaces: ['cmd-k', 'primary-sidebar'],
    executionSurface: 'primary-sidebar',
    preconditions: [],
    status: 'implemented',
    usabilityScore: 8,
  },
  {
    id: 'navigate.coordination',
    label: 'Switch lens: Coordination',
    owner: 'cmdPalette/defaultCommands',
    group: 'navigate',
    scope: 'universal',
    intendedModes: [...CAPABILITY_VIEW_MODES],
    surfaces: ['cmd-k', 'primary-sidebar'],
    executionSurface: 'primary-sidebar',
    preconditions: [],
    status: 'implemented',
    usabilityScore: 8,
  },
  {
    id: 'navigate.fire-safety',
    label: 'Switch lens: Fire Safety',
    owner: 'cmdPalette/defaultCommands',
    group: 'navigate',
    scope: 'universal',
    intendedModes: [...CAPABILITY_VIEW_MODES],
    surfaces: ['cmd-k', 'primary-sidebar'],
    executionSurface: 'primary-sidebar',
    preconditions: [],
    status: 'implemented',
    usabilityScore: 8,
  },
  {
    id: 'navigate.energy',
    label: 'Switch lens: Energieberatung',
    owner: 'cmdPalette/defaultCommands',
    group: 'navigate',
    scope: 'universal',
    intendedModes: [...CAPABILITY_VIEW_MODES],
    surfaces: ['cmd-k', 'primary-sidebar'],
    executionSurface: 'primary-sidebar',
    preconditions: [],
    status: 'implemented',
    usabilityScore: 8,
  },
  {
    id: 'navigate.construction-lens',
    label: 'Switch lens: Bauausfuehrung',
    owner: 'cmdPalette/defaultCommands',
    group: 'navigate',
    scope: 'universal',
    intendedModes: [...CAPABILITY_VIEW_MODES],
    surfaces: ['cmd-k', 'primary-sidebar'],
    executionSurface: 'primary-sidebar',
    preconditions: [],
    status: 'implemented',
    usabilityScore: 8,
  },
  {
    id: 'navigate.sustainability',
    label: 'Switch lens: Sustainability / LCA',
    owner: 'cmdPalette/defaultCommands',
    group: 'navigate',
    scope: 'universal',
    intendedModes: [...CAPABILITY_VIEW_MODES],
    surfaces: ['cmd-k', 'primary-sidebar'],
    executionSurface: 'primary-sidebar',
    preconditions: [],
    status: 'implemented',
    usabilityScore: 8,
  },
  {
    id: 'navigate.cost-quantity',
    label: 'Switch lens: Cost and Quantity',
    owner: 'cmdPalette/defaultCommands',
    group: 'navigate',
    scope: 'universal',
    intendedModes: [...CAPABILITY_VIEW_MODES],
    surfaces: ['cmd-k', 'primary-sidebar'],
    executionSurface: 'primary-sidebar',
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
    surfaces: ['cmd-k', 'secondary-sidebar'],
    executionSurface: 'secondary-sidebar',
    preconditions: [],
    status: 'implemented',
    usabilityScore: 8,
  },
  {
    id: 'view.phase.existing',
    label: 'Set view phase: Existing',
    owner: 'cmdPalette/defaultCommands',
    group: 'view',
    scope: 'view',
    intendedModes: [...CAPABILITY_VIEW_MODES],
    surfaces: ['cmd-k', 'secondary-sidebar'],
    executionSurface: 'secondary-sidebar',
    preconditions: [],
    status: 'implemented',
    usabilityScore: 8,
  },
  {
    id: 'view.phase.new',
    label: 'Set view phase: New Construction',
    owner: 'cmdPalette/defaultCommands',
    group: 'view',
    scope: 'view',
    intendedModes: [...CAPABILITY_VIEW_MODES],
    surfaces: ['cmd-k', 'secondary-sidebar'],
    executionSurface: 'secondary-sidebar',
    preconditions: [],
    status: 'implemented',
    usabilityScore: 8,
  },
  {
    id: 'view.plan.detail.coarse',
    label: 'Plan Detail: Coarse',
    owner: 'cmdPalette/defaultCommands',
    group: 'view',
    scope: 'view',
    intendedModes: ['plan', 'section'],
    surfaces: ['cmd-k', 'secondary-sidebar'],
    executionSurface: 'secondary-sidebar',
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
    intendedModes: ['plan', 'section'],
    surfaces: ['cmd-k', 'secondary-sidebar'],
    executionSurface: 'secondary-sidebar',
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
    intendedModes: ['plan', 'section'],
    surfaces: ['cmd-k', 'secondary-sidebar'],
    executionSurface: 'secondary-sidebar',
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
    surfaces: ['cmd-k'],
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
    surfaces: ['cmd-k'],
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
    surfaces: ['cmd-k'],
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
    surfaces: ['cmd-k'],
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
    surfaces: ['cmd-k'],
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
    surfaces: ['cmd-k'],
    executionSurface: 'global',
    preconditions: [],
    status: 'implemented',
    usabilityScore: 8,
  },
  {
    id: 'project.open-menu',
    label: 'Open Project Menu',
    owner: 'workspace/WorkspaceLeftRail',
    group: 'system',
    scope: 'universal',
    intendedModes: [...CAPABILITY_VIEW_MODES],
    surfaces: ['cmd-k', 'primary-sidebar'],
    executionSurface: 'primary-sidebar',
    preconditions: [],
    status: 'implemented',
    usabilityScore: 8,
  },
  {
    id: 'project.open-settings',
    label: 'Open Project Setup',
    owner: 'workspace/WorkspaceLeftRail',
    group: 'system',
    scope: 'model',
    intendedModes: [...CAPABILITY_VIEW_MODES],
    surfaces: ['cmd-k', 'primary-sidebar'],
    executionSurface: 'primary-sidebar',
    preconditions: [],
    status: 'implemented',
    usabilityScore: 8,
  },
  {
    id: 'view.create.floor-plan',
    label: 'Create Floor Plan',
    owner: 'workspace/WorkspaceLeftRail',
    group: 'document',
    scope: 'model',
    intendedModes: [...CAPABILITY_VIEW_MODES],
    surfaces: ['cmd-k', 'primary-sidebar'],
    executionSurface: 'primary-sidebar',
    preconditions: ['has-level'],
    status: 'implemented',
    usabilityScore: 8,
  },
  {
    id: 'view.create.3d-view',
    label: 'Create 3D Saved View',
    owner: 'workspace/WorkspaceLeftRail',
    group: 'document',
    scope: 'view',
    intendedModes: [...CAPABILITY_VIEW_MODES],
    surfaces: ['cmd-k', 'primary-sidebar'],
    executionSurface: 'primary-sidebar',
    preconditions: ['3d-camera-pose'],
    status: 'implemented',
    usabilityScore: 8,
  },
  {
    id: 'view.create.section',
    label: 'Create Section View',
    owner: 'workspace/WorkspaceLeftRail',
    group: 'document',
    scope: 'view',
    intendedModes: [...CAPABILITY_VIEW_MODES],
    surfaces: ['cmd-k', 'primary-sidebar'],
    executionSurface: 'primary-sidebar',
    preconditions: [],
    status: 'implemented',
    usabilityScore: 8,
  },
  {
    id: 'view.create.sheet',
    label: 'Create Sheet',
    owner: 'workspace/WorkspaceLeftRail',
    group: 'document',
    scope: 'model',
    intendedModes: [...CAPABILITY_VIEW_MODES],
    surfaces: ['cmd-k', 'primary-sidebar'],
    executionSurface: 'primary-sidebar',
    preconditions: [],
    status: 'implemented',
    usabilityScore: 8,
  },
  {
    id: 'view.create.schedule',
    label: 'Create Schedule',
    owner: 'workspace/WorkspaceLeftRail',
    group: 'document',
    scope: 'model',
    intendedModes: [...CAPABILITY_VIEW_MODES],
    surfaces: ['cmd-k', 'primary-sidebar'],
    executionSurface: 'primary-sidebar',
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
    surfaces: ['cmd-k', 'primary-sidebar'],
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
    surfaces: ['cmd-k', 'primary-sidebar'],
    executionSurface: 'modal',
    preconditions: [],
    status: 'implemented',
    usabilityScore: 8,
  },
  {
    id: 'project.share-presentation',
    label: 'Share Project',
    owner: 'workspace/share/SharePresentationModal',
    group: 'system',
    scope: 'universal',
    intendedModes: [...CAPABILITY_VIEW_MODES],
    surfaces: ['cmd-k', 'header'],
    executionSurface: 'modal',
    preconditions: ['presentation-pages'],
    status: 'implemented',
    usabilityScore: 8,
  },
  {
    id: 'project.manage-links',
    label: 'Manage Project Links',
    owner: 'workspace/project/ManageLinksDialog',
    group: 'system',
    scope: 'model',
    intendedModes: [...CAPABILITY_VIEW_MODES],
    surfaces: ['cmd-k', 'primary-sidebar'],
    executionSurface: 'modal',
    preconditions: [],
    status: 'implemented',
    usabilityScore: 8,
  },
  {
    id: 'project.import.ifc',
    label: 'Import IFC Link',
    owner: 'workspace/project/ProjectMenu',
    group: 'system',
    scope: 'model',
    intendedModes: [...CAPABILITY_VIEW_MODES],
    surfaces: ['cmd-k', 'primary-sidebar'],
    executionSurface: 'modal',
    preconditions: [],
    status: 'implemented',
    usabilityScore: 8,
    notes: 'Cmd+K bridges to project resources where file-picker ownership lives.',
  },
  {
    id: 'project.import.dxf',
    label: 'Import DXF Underlay',
    owner: 'workspace/project/ProjectMenu',
    group: 'system',
    scope: 'model',
    intendedModes: [...CAPABILITY_VIEW_MODES],
    surfaces: ['cmd-k', 'primary-sidebar'],
    executionSurface: 'modal',
    preconditions: [],
    status: 'implemented',
    usabilityScore: 8,
    notes: 'Cmd+K bridges to project resources where DXF options and file-picker live.',
  },
  {
    id: 'library.open-family',
    label: 'Open Family Library',
    owner: 'families/FamilyLibraryPanel',
    group: 'system',
    scope: 'universal',
    intendedModes: [...CAPABILITY_VIEW_MODES],
    surfaces: ['cmd-k', 'ribbon', 'secondary-sidebar'],
    executionSurface: 'modal',
    preconditions: [],
    status: 'implemented',
    usabilityScore: 8,
  },
  {
    id: 'library.open-material-browser',
    label: 'Open Material Browser',
    owner: 'familyEditor/MaterialBrowserDialog',
    group: 'system',
    scope: 'model',
    intendedModes: [...CAPABILITY_VIEW_MODES],
    surfaces: ['cmd-k', 'primary-sidebar', 'element-sidebar'],
    executionSurface: 'modal',
    preconditions: [],
    status: 'implemented',
    usabilityScore: 8,
  },
  {
    id: 'library.open-appearance-asset-browser',
    label: 'Open Appearance Asset Browser',
    owner: 'familyEditor/AppearanceAssetBrowserDialog',
    group: 'system',
    scope: 'model',
    intendedModes: [...CAPABILITY_VIEW_MODES],
    surfaces: ['cmd-k', 'primary-sidebar', 'element-sidebar'],
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
    surfaces: ['cmd-k'],
    executionSurface: 'modal',
    preconditions: [],
    status: 'implemented',
    usabilityScore: 8,
  },
  {
    id: 'help.replay-onboarding-tour',
    label: 'Replay Onboarding Tour',
    owner: 'onboarding/OnboardingTour',
    group: 'system',
    scope: 'universal',
    intendedModes: [...CAPABILITY_VIEW_MODES],
    surfaces: ['cmd-k', 'primary-sidebar'],
    executionSurface: 'modal',
    preconditions: [],
    status: 'implemented',
    usabilityScore: 8,
  },
  {
    id: 'tabs.close-inactive',
    label: 'Close Inactive Views',
    owner: 'workspace/shell/TabBar',
    group: 'system',
    scope: 'universal',
    intendedModes: [...CAPABILITY_VIEW_MODES],
    surfaces: ['cmd-k', 'header'],
    executionSurface: 'global',
    preconditions: [],
    status: 'implemented',
    usabilityScore: 8,
    notes: 'Header tab overflow menu plus Cmd+K fallback.',
  },
  {
    id: 'tabs.split.left',
    label: 'Split Active View Left',
    owner: 'workspace/Workspace',
    group: 'system',
    scope: 'view',
    intendedModes: [...CAPABILITY_VIEW_MODES],
    surfaces: ['cmd-k'],
    executionSurface: 'canvas',
    preconditions: ['active-view'],
    status: 'implemented',
    usabilityScore: 8,
  },
  {
    id: 'tabs.split.right',
    label: 'Split Active View Right',
    owner: 'workspace/Workspace',
    group: 'system',
    scope: 'view',
    intendedModes: [...CAPABILITY_VIEW_MODES],
    surfaces: ['cmd-k'],
    executionSurface: 'canvas',
    preconditions: ['active-view'],
    status: 'implemented',
    usabilityScore: 8,
  },
  {
    id: 'tabs.split.top',
    label: 'Split Active View Top',
    owner: 'workspace/Workspace',
    group: 'system',
    scope: 'view',
    intendedModes: [...CAPABILITY_VIEW_MODES],
    surfaces: ['cmd-k'],
    executionSurface: 'canvas',
    preconditions: ['active-view'],
    status: 'implemented',
    usabilityScore: 8,
  },
  {
    id: 'tabs.split.bottom',
    label: 'Split Active View Bottom',
    owner: 'workspace/Workspace',
    group: 'system',
    scope: 'view',
    intendedModes: [...CAPABILITY_VIEW_MODES],
    surfaces: ['cmd-k'],
    executionSurface: 'canvas',
    preconditions: ['active-view'],
    status: 'implemented',
    usabilityScore: 8,
  },
  {
    id: 'shell.toggle-primary-sidebar',
    label: 'Toggle Primary Sidebar',
    owner: 'workspace/Workspace',
    group: 'system',
    scope: 'universal',
    intendedModes: [...CAPABILITY_VIEW_MODES],
    surfaces: ['cmd-k', 'header'],
    executionSurface: 'header',
    preconditions: [],
    status: 'implemented',
    usabilityScore: 8,
  },
  {
    id: 'shell.toggle-element-sidebar',
    label: 'Toggle Element Sidebar',
    owner: 'workspace/Workspace',
    group: 'system',
    scope: 'universal',
    intendedModes: [...CAPABILITY_VIEW_MODES],
    surfaces: ['cmd-k', 'element-sidebar'],
    executionSurface: 'element-sidebar',
    preconditions: ['has-selection'],
    status: 'implemented',
    usabilityScore: 8,
  },
  {
    id: 'advisor.open',
    label: 'Open Advisor',
    owner: 'workspace/shell/StatusBar',
    group: 'review',
    scope: 'model',
    intendedModes: [...CAPABILITY_VIEW_MODES],
    surfaces: ['cmd-k', 'footer'],
    executionSurface: 'modal',
    preconditions: [],
    status: 'implemented',
    usabilityScore: 8,
  },
  {
    id: 'jobs.open',
    label: 'Open Jobs',
    owner: 'jobs/JobsPanel',
    group: 'system',
    scope: 'model',
    intendedModes: [...CAPABILITY_VIEW_MODES],
    surfaces: ['cmd-k', 'footer'],
    executionSurface: 'modal',
    preconditions: [],
    status: 'implemented',
    usabilityScore: 8,
  },
  {
    id: 'milestone.open',
    label: 'Open Milestone Dialog',
    owner: 'workspace/project/ProjectMenu',
    group: 'system',
    scope: 'model',
    intendedModes: [...CAPABILITY_VIEW_MODES],
    surfaces: ['cmd-k', 'primary-sidebar'],
    executionSurface: 'modal',
    preconditions: [],
    status: 'implemented',
    usabilityScore: 8,
  },
  {
    id: 'advisor.apply-first-fix',
    label: 'Apply First Advisor Fix',
    owner: 'advisor/AdvisorPanel',
    group: 'review',
    scope: 'model',
    intendedModes: [...CAPABILITY_VIEW_MODES],
    surfaces: ['cmd-k', 'dialog'],
    executionSurface: 'modal',
    preconditions: ['advisor-finding-with-quick-fix'],
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
    surfaces: ['cmd-k', 'ribbon'],
    executionSurface: 'canvas',
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
    surfaces: ['cmd-k', 'ribbon'],
    executionSurface: 'canvas',
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
    surfaces: ['cmd-k', 'ribbon'],
    executionSurface: 'canvas',
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
    surfaces: ['cmd-k', 'ribbon', 'secondary-sidebar'],
    executionSurface: 'secondary-sidebar',
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
    surfaces: ['cmd-k', 'ribbon'],
    executionSurface: 'canvas',
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
    surfaces: ['cmd-k', 'ribbon'],
    executionSurface: 'canvas',
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
    surfaces: ['cmd-k', 'ribbon'],
    executionSurface: 'canvas',
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
    surfaces: ['cmd-k', 'ribbon', 'header'],
    executionSurface: 'modal',
    preconditions: ['active-sheet', 'presentation-pages'],
    status: 'implemented',
    usabilityScore: 8,
  },
  {
    id: 'sheet.review.comment-mode',
    label: 'Sheet Review: Comment Mode',
    owner: 'plan/SheetReviewSurface',
    group: 'review',
    scope: 'view',
    intendedModes: ['sheet'],
    surfaces: ['cmd-k', 'ribbon'],
    executionSurface: 'ribbon',
    preconditions: ['active-sheet'],
    status: 'implemented',
    usabilityScore: 8,
  },
  {
    id: 'sheet.review.markup-mode',
    label: 'Sheet Review: Markup Mode',
    owner: 'plan/SheetReviewSurface',
    group: 'review',
    scope: 'view',
    intendedModes: ['sheet'],
    surfaces: ['cmd-k', 'ribbon'],
    executionSurface: 'ribbon',
    preconditions: ['active-sheet'],
    status: 'implemented',
    usabilityScore: 8,
  },
  {
    id: 'sheet.review.resolve-mode',
    label: 'Sheet Review: Resolve Mode',
    owner: 'plan/SheetReviewSurface',
    group: 'review',
    scope: 'view',
    intendedModes: ['sheet'],
    surfaces: ['cmd-k', 'ribbon'],
    executionSurface: 'ribbon',
    preconditions: ['active-sheet'],
    status: 'implemented',
    usabilityScore: 8,
  },
  {
    id: 'sheet.review.markup-shape.freehand',
    label: 'Sheet Review: Markup Shape Freehand',
    owner: 'plan/SheetReviewSurface',
    group: 'review',
    scope: 'view',
    intendedModes: ['sheet'],
    surfaces: ['cmd-k', 'ribbon'],
    executionSurface: 'ribbon',
    preconditions: ['active-sheet', 'markup-mode'],
    status: 'implemented',
    usabilityScore: 8,
  },
  {
    id: 'sheet.review.markup-shape.arrow',
    label: 'Sheet Review: Markup Shape Arrow',
    owner: 'plan/SheetReviewSurface',
    group: 'review',
    scope: 'view',
    intendedModes: ['sheet'],
    surfaces: ['cmd-k', 'ribbon'],
    executionSurface: 'ribbon',
    preconditions: ['active-sheet', 'markup-mode'],
    status: 'implemented',
    usabilityScore: 8,
  },
  {
    id: 'sheet.review.markup-shape.cloud',
    label: 'Sheet Review: Markup Shape Cloud',
    owner: 'plan/SheetReviewSurface',
    group: 'review',
    scope: 'view',
    intendedModes: ['sheet'],
    surfaces: ['cmd-k', 'ribbon'],
    executionSurface: 'ribbon',
    preconditions: ['active-sheet', 'markup-mode'],
    status: 'implemented',
    usabilityScore: 8,
  },
  {
    id: 'sheet.review.markup-shape.text',
    label: 'Sheet Review: Markup Shape Text',
    owner: 'plan/SheetReviewSurface',
    group: 'review',
    scope: 'view',
    intendedModes: ['sheet'],
    surfaces: ['cmd-k', 'ribbon'],
    executionSurface: 'ribbon',
    preconditions: ['active-sheet', 'markup-mode'],
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
    surfaces: ['cmd-k', 'ribbon'],
    executionSurface: 'ribbon',
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
    surfaces: ['cmd-k', 'secondary-sidebar'],
    executionSurface: 'secondary-sidebar',
    preconditions: ['active-section'],
    status: 'implemented',
    usabilityScore: 8,
  },
  {
    id: 'section.open-3d-context',
    label: 'Section: Open 3D Context',
    owner: 'workspace/Workspace',
    group: 'navigate',
    scope: 'view',
    intendedModes: ['section'],
    surfaces: ['cmd-k', 'canvas'],
    executionSurface: 'canvas',
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
    surfaces: ['cmd-k', 'ribbon', 'secondary-sidebar'],
    executionSurface: 'secondary-sidebar',
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
    surfaces: ['cmd-k', 'ribbon', 'secondary-sidebar'],
    executionSurface: 'secondary-sidebar',
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
    intendedModes: ['3d'],
    surfaces: ['cmd-k', 'secondary-sidebar'],
    executionSurface: 'canvas',
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
    intendedModes: ['3d'],
    surfaces: ['cmd-k', 'secondary-sidebar'],
    executionSurface: 'canvas',
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
    intendedModes: ['3d'],
    surfaces: ['cmd-k', 'secondary-sidebar'],
    executionSurface: 'canvas',
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
    intendedModes: ['3d'],
    surfaces: ['cmd-k', 'secondary-sidebar'],
    executionSurface: 'canvas',
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
    intendedModes: ['3d'],
    surfaces: ['cmd-k', 'secondary-sidebar'],
    executionSurface: 'canvas',
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
    intendedModes: ['3d'],
    surfaces: ['cmd-k', 'secondary-sidebar'],
    executionSurface: 'canvas',
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
    intendedModes: ['3d'],
    surfaces: ['cmd-k', 'secondary-sidebar'],
    executionSurface: 'canvas',
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
    intendedModes: ['3d'],
    surfaces: ['cmd-k', 'secondary-sidebar'],
    executionSurface: 'canvas',
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
    intendedModes: ['3d'],
    surfaces: ['cmd-k', 'secondary-sidebar'],
    executionSurface: 'canvas',
    preconditions: ['active-viewpoint'],
    status: 'implemented',
    usabilityScore: 8,
  },
  {
    id: 'view.3d.measure.ribbon-bridge',
    label: '3D: Measure (Ribbon Bridge)',
    owner: 'workspace/shell/RibbonBar',
    group: 'view',
    scope: 'view',
    intendedModes: ['3d'],
    surfaces: ['ribbon', 'cmd-k'],
    executionSurface: 'canvas',
    preconditions: [],
    status: 'implemented',
    usabilityScore: 8,
    notes: 'Starts Measure from the 3D ribbon and bridges to plan measurement mode.',
  },
  {
    id: 'view.3d.sun-settings',
    label: '3D: Sun Settings',
    owner: 'workspace/WorkspaceRightRail',
    group: 'view',
    scope: 'view',
    intendedModes: ['3d'],
    surfaces: ['cmd-k', 'secondary-sidebar'],
    executionSurface: 'secondary-sidebar',
    preconditions: [],
    status: 'implemented',
    usabilityScore: 8,
  },
  {
    id: 'display.render.shaded',
    label: 'Render: Shaded',
    owner: 'cmdPalette/defaultCommands',
    group: 'view',
    scope: 'view',
    intendedModes: ['3d'],
    surfaces: ['cmd-k', 'secondary-sidebar'],
    executionSurface: 'canvas',
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
    intendedModes: ['3d'],
    surfaces: ['cmd-k', 'secondary-sidebar'],
    executionSurface: 'canvas',
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
    intendedModes: ['3d'],
    surfaces: ['cmd-k', 'secondary-sidebar'],
    executionSurface: 'canvas',
    preconditions: [],
    status: 'implemented',
    usabilityScore: 8,
  },
  {
    id: 'display.render.high-fidelity',
    label: 'Render: High Fidelity',
    owner: 'cmdPalette/defaultCommands',
    group: 'view',
    scope: 'view',
    intendedModes: ['3d'],
    surfaces: ['cmd-k', 'secondary-sidebar'],
    executionSurface: 'canvas',
    preconditions: [],
    status: 'implemented',
    usabilityScore: 8,
    notes: 'Switches to the high-quality raster PBR fallback with soft shadow filtering.',
  },
];

const EDIT_3D_CAPABILITIES: CommandCapability[] = [
  {
    id: 'generate.walls-from-boundary',
    label: 'Create Walls from Boundary',
    owner: 'geometry/boundaryWallGeneration',
    group: 'author',
    scope: 'selection',
    intendedModes: ['plan', '3d'],
    surfaces: ['cmd-k', 'element-sidebar'],
    executionSurface: 'element-sidebar',
    preconditions: ['selected-floor-or-room-boundary'],
    status: 'implemented',
    usabilityScore: 8,
    lifecycleKind: 'modify',
    completionBehavior: 'select-after-commit',
    previewSemantics:
      'Selected floor/room boundary is converted into a previewed wall-chain payload with conflict markers before commit.',
  },
  {
    id: 'view.3d.wall.insert-door',
    label: '3D: Insert Door on Selected Wall',
    owner: 'cmdPalette/defaultCommands',
    group: 'author',
    scope: 'selection',
    intendedModes: ['3d'],
    surfaces: ['cmd-k', 'ribbon', 'element-sidebar', 'canvas-context'],
    executionSurface: 'ribbon',
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
    intendedModes: ['3d'],
    surfaces: ['cmd-k', 'ribbon', 'element-sidebar', 'canvas-context'],
    executionSurface: 'ribbon',
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
    intendedModes: ['3d'],
    surfaces: ['cmd-k', 'ribbon', 'element-sidebar', 'canvas-context'],
    executionSurface: 'ribbon',
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
    intendedModes: ['3d'],
    surfaces: ['cmd-k', 'element-sidebar', 'canvas-context'],
    executionSurface: 'element-sidebar',
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
    intendedModes: ['3d'],
    surfaces: ['cmd-k', 'element-sidebar', 'canvas-context'],
    executionSurface: 'element-sidebar',
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
    intendedModes: ['plan', '3d', 'section'],
    surfaces: ['cmd-k'],
    executionSurface: 'global',
    preconditions: [],
    status: 'implemented',
    usabilityScore: 8,
    notes:
      'Routes to plan VV/VG in plan-like views and to secondary-sidebar 3D View Controls in 3D.',
  },
  {
    id: 'visibility.plan.graphics',
    label: 'Visibility/Graphics',
    owner: 'workspace/project/VVDialog',
    group: 'visibility',
    scope: 'view',
    intendedModes: ['plan', 'section'],
    surfaces: ['cmd-k', 'ribbon', 'secondary-sidebar'],
    executionSurface: 'modal',
    preconditions: ['active-plan-view'],
    status: 'implemented',
    usabilityScore: 8,
    bridgeToMode: { '3d': 'plan' },
    notes: 'Plan-scoped VV/VG must not be presented as the 3D layer control.',
  },
  {
    id: 'display.reveal-hidden',
    label: 'Reveal Hidden Elements',
    owner: 'cmdPalette/defaultCommands',
    group: 'visibility',
    scope: 'view',
    intendedModes: ['plan', '3d', 'section'],
    surfaces: ['cmd-k', 'secondary-sidebar'],
    executionSurface: 'global',
    preconditions: [],
    status: 'implemented',
    usabilityScore: 8,
  },
  {
    id: 'display.neighborhood',
    label: 'Toggle Neighborhood Masses',
    owner: 'cmdPalette/defaultCommands',
    group: 'visibility',
    scope: 'view',
    intendedModes: ['3d'],
    surfaces: ['cmd-k', 'secondary-sidebar'],
    executionSurface: 'canvas',
    preconditions: [],
    status: 'implemented',
    usabilityScore: 8,
  },
  {
    id: 'visibility.3d.layers',
    label: '3D View Controls',
    owner: 'workspace/viewport/Viewport3DLayersPanel',
    group: 'visibility',
    scope: 'view',
    intendedModes: ['3d'],
    surfaces: ['cmd-k', 'secondary-sidebar'],
    executionSurface: 'secondary-sidebar',
    preconditions: [],
    status: 'implemented',
    usabilityScore: 8,
  },
  {
    id: 'visibility.3d.show-all-categories',
    label: '3D: Show All Categories',
    owner: 'cmdPalette/defaultCommands',
    group: 'visibility',
    scope: 'view',
    intendedModes: ['3d'],
    surfaces: ['cmd-k'],
    executionSurface: 'canvas',
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
    intendedModes: ['3d'],
    surfaces: ['cmd-k'],
    executionSurface: 'canvas',
    preconditions: [],
    status: 'implemented',
    usabilityScore: 8,
  },
  {
    id: 'clipboard.paste-to-levels',
    label: 'Paste Aligned to Selected Levels',
    owner: 'clipboard/PasteToLevelsDialog',
    group: 'modify',
    scope: 'view',
    intendedModes: ['plan'],
    surfaces: ['cmd-k'],
    executionSurface: 'modal',
    preconditions: ['has-selection'],
    status: 'implemented',
    usabilityScore: 8,
  },
];
