import { describe, expect, it } from 'vitest';

import '../cmdPalette/defaultCommands';
import { getRegistry } from '../cmdPalette/registry';
import {
  getAuthoringCommandContract,
  type AuthoringCommandKind,
} from '../tools/authoringCommandContract';
import { getToolRegistry } from '../tools/toolRegistry';
import { ribbonCommandMetadataForMode } from './shell/RibbonBar';
import {
  CAPABILITY_VIEW_MODES,
  auditCommandExposures,
  evaluateCommandInMode,
  getAllCommandCapabilities,
  getCommandCapability,
  unreachableCommandCapabilities,
} from './commandCapabilities';

const tIdentity = ((key: string) => key) as never;

describe('command capability graph', () => {
  it('registers every tool registry entry as an auditable command capability', () => {
    const capabilities = new Set(getAllCommandCapabilities().map((capability) => capability.id));
    for (const toolId of Object.keys(getToolRegistry(tIdentity))) {
      expect(capabilities.has(`tool.${toolId}`)).toBe(true);
    }
  });

  it('declares a canonical authoring lifecycle contract for every tool command — WP-NEXT-40', () => {
    const lifecycleKinds: AuthoringCommandKind[] = [
      'line',
      'sketch',
      'hosted',
      'point',
      'modify',
      'review',
      'document',
      'resource',
    ];

    for (const tool of Object.values(getToolRegistry(tIdentity))) {
      const contract = getAuthoringCommandContract(tool.id);
      expect(contract.toolId).toBe(tool.id);
      expect(lifecycleKinds).toContain(contract.kind);
      expect(contract.validModes).toEqual(tool.modes);
      expect(contract.previewSemantics.length, tool.id).toBeGreaterThan(12);
      expect(contract.defaultAfterCancel).toBe('select');
      const capability = getCommandCapability(`tool.${tool.id}`);
      expect(capability?.lifecycleKind, tool.id).toBe(contract.kind);
      expect(capability?.completionBehavior, tool.id).toBe(contract.completionBehavior);
      expect(capability?.previewSemantics, tool.id).toBe(contract.previewSemantics);
    }
  });

  it('registers every Cmd+K command capability in the command palette registry — WP-NEXT-40', () => {
    const paletteIds = new Set(getRegistry().map((entry) => entry.id));
    const missing = getAllCommandCapabilities()
      .filter((capability) => capability.surfaces.includes('cmd-k'))
      .filter((capability) => !paletteIds.has(capability.id))
      .map((capability) => capability.id)
      .sort();

    expect(missing).toEqual([]);
  });

  it('gives every visible ribbon command executable, disabled, or bridge metadata — WP-NEXT-40', () => {
    const rows = CAPABILITY_VIEW_MODES.flatMap((mode) =>
      ribbonCommandMetadataForMode(mode, 'wall').map((row) => ({
        mode,
        commandKey: row.commandKey,
        commandId: row.commandId,
        behavior: row.behavior,
      })),
    );

    expect(rows.filter((row) => row.behavior === 'missing-metadata')).toEqual([]);
    expect(rows.some((row) => row.commandId === 'tool.wall' && row.behavior === 'direct')).toBe(
      true,
    );
    expect(rows.some((row) => row.commandId === 'project.manage-links')).toBe(true);
    expect(rows.some((row) => row.commandId === 'advisor.open')).toBe(true);
  });

  it('has unique command ids and no unreachable registered commands', () => {
    const capabilities = getAllCommandCapabilities();
    expect(new Set(capabilities.map((capability) => capability.id)).size).toBe(capabilities.length);
    expect(unreachableCommandCapabilities()).toEqual([]);
  });

  it('keeps the runtime graph free of partial or low-scored tracked commands', () => {
    const incomplete = getAllCommandCapabilities()
      .filter((capability) => capability.status !== 'implemented' || capability.usabilityScore < 8)
      .map((capability) => ({
        id: capability.id,
        status: capability.status,
        usabilityScore: capability.usabilityScore,
      }));

    expect(incomplete).toEqual([]);
  });

  it('uses only canonical revamp command surfaces — UX-WP-09', () => {
    const legacySurfaces = new Set([
      'topbar',
      'left-rail',
      'right-rail',
      'floating-palette',
      'sheet-canvas',
      'schedule-grid',
      'statusbar',
    ]);
    const stale = getAllCommandCapabilities().flatMap((capability) =>
      capability.surfaces
        .filter((surface) => legacySurfaces.has(surface))
        .map((surface) => ({ id: capability.id, surface })),
    );

    expect(stale).toEqual([]);
    expect(getCommandCapability('tool.wall')?.surfaces).toEqual(['ribbon', 'cmd-k']);
  });

  it('keeps Cmd+K as the global fallback for every tracked command — UX-RISK-012', () => {
    const withoutCmdK = getAllCommandCapabilities()
      .filter((capability) => !capability.surfaces.includes('cmd-k'))
      .map((capability) => capability.id);

    expect(withoutCmdK).toEqual([]);
  });

  it('covers every modal/dialog command with canonical trigger ownership — UX-RISK-005', () => {
    const dialogTriggers = new Map<string, readonly string[]>([
      ['project.restore-snapshot', ['cmd-k', 'primary-sidebar']],
      ['project.share-presentation', ['cmd-k', 'header']],
      ['project.manage-links', ['cmd-k', 'primary-sidebar']],
      ['project.import.ifc', ['cmd-k', 'primary-sidebar']],
      ['project.import.dxf', ['cmd-k', 'primary-sidebar']],
      ['library.open-family', ['cmd-k', 'ribbon', 'secondary-sidebar']],
      ['library.open-material-browser', ['cmd-k', 'primary-sidebar', 'element-sidebar']],
      ['library.open-appearance-asset-browser', ['cmd-k', 'primary-sidebar', 'element-sidebar']],
      ['help.keyboard-shortcuts', ['cmd-k']],
      ['help.replay-onboarding-tour', ['cmd-k', 'primary-sidebar']],
      ['advisor.open', ['cmd-k', 'footer']],
      ['jobs.open', ['cmd-k', 'footer']],
      ['milestone.open', ['cmd-k', 'primary-sidebar']],
      ['advisor.apply-first-fix', ['cmd-k', 'dialog']],
      ['sheet.export-share', ['cmd-k', 'ribbon', 'header']],
      ['visibility.plan.graphics', ['cmd-k', 'ribbon', 'secondary-sidebar']],
    ] as const);
    const modalCapabilities = getAllCommandCapabilities()
      .filter((capability) => capability.executionSurface === 'modal')
      .sort((a, b) => a.id.localeCompare(b.id));

    expect(modalCapabilities.map((capability) => capability.id)).toEqual(
      [...dialogTriggers.keys()].sort(),
    );
    for (const capability of modalCapabilities) {
      expect(capability.surfaces, capability.id).toEqual(dialogTriggers.get(capability.id));
      expect(capability.surfaces, capability.id).toContain('cmd-k');
    }
  });

  it('supports direct 3D drafting for core hosted and structural tools', () => {
    const direct3dToolIds = Object.values(getToolRegistry(tIdentity))
      .filter((tool) => tool.modes.includes('3d'))
      .map((tool) => tool.id);

    expect(new Set(direct3dToolIds)).toEqual(
      new Set([
        'select',
        'wall',
        'door',
        'window',
        'floor',
        'roof',
        'stair',
        'railing',
        'room',
        'area',
        'grid',
        'reference-plane',
        'wall-opening',
        'shaft',
        'column',
        'beam',
        'ceiling',
        'component',
      ]),
    );
    expect(evaluateCommandInMode('tool.floor', '3d')?.state).toBe('enabled');
    expect(evaluateCommandInMode('tool.roof', '3d')?.state).toBe('enabled');
    expect(evaluateCommandInMode('tool.stair', '3d')?.state).toBe('enabled');
    expect(evaluateCommandInMode('tool.railing', '3d')?.state).toBe('enabled');
    expect(evaluateCommandInMode('tool.room', '3d')?.state).toBe('enabled');
    expect(evaluateCommandInMode('tool.area', '3d')?.state).toBe('enabled');
    expect(evaluateCommandInMode('tool.grid', '3d')?.state).toBe('enabled');
    expect(evaluateCommandInMode('tool.reference-plane', '3d')?.state).toBe('enabled');
    expect(evaluateCommandInMode('tool.column', '3d')?.state).toBe('enabled');
    expect(evaluateCommandInMode('tool.beam', '3d')?.state).toBe('enabled');
    expect(evaluateCommandInMode('tool.ceiling', '3d')?.state).toBe('enabled');
    expect(evaluateCommandInMode('tool.shaft', '3d')?.state).toBe('enabled');
    expect(evaluateCommandInMode('tool.door', '3d')?.state).toBe('enabled');
    expect(evaluateCommandInMode('tool.window', '3d')?.state).toBe('enabled');
    expect(evaluateCommandInMode('tool.wall-opening', '3d')?.state).toBe('enabled');
    expect(evaluateCommandInMode('tool.component', '3d')?.state).toBe('enabled');
  });

  it('marks non-3D plan tools as bridge commands outside their execution surface', () => {
    const availability = evaluateCommandInMode('tool.property-line', '3d');
    expect(availability?.state).toBe('bridge');
    if (availability?.state === 'bridge') {
      expect(availability.targetMode).toBe('plan');
      expect(availability.reason).toContain('Plan');
    }
    expect(evaluateCommandInMode('tool.wall', '3d')?.state).toBe('enabled');
    expect(evaluateCommandInMode('tool.floor', '3d')?.state).toBe('enabled');
    expect(evaluateCommandInMode('tool.roof', '3d')?.state).toBe('enabled');
  });

  it('applies lens-specific gating reasons for discipline-scoped authoring commands', () => {
    const structureRoom = evaluateCommandInMode('tool.room', 'plan', 'structure');
    expect(structureRoom?.state).toBe('disabled');
    if (structureRoom?.state === 'disabled') {
      expect(structureRoom.reason).toContain('Structure lens');
    }

    const mepWall = evaluateCommandInMode('tool.wall', 'plan', 'mep');
    expect(mepWall?.state).toBe('disabled');
    if (mepWall?.state === 'disabled') {
      expect(mepWall.reason).toContain('MEP lens');
    }

    expect(evaluateCommandInMode('tool.wall', 'plan', 'architecture')?.state).toBe('enabled');
    expect(evaluateCommandInMode('tool.wall', 'plan', 'all')?.state).toBe('enabled');
  });

  it('keeps universal navigation and system commands enabled in every view', () => {
    for (const commandId of [
      'navigate.plan',
      'navigate.3d',
      'navigate.architecture',
      'navigate.structure',
      'navigate.mep',
      'theme.toggle',
      'settings.language.toggle',
      'shell.toggle-primary-sidebar',
      'project.open-settings',
      'view.create.floor-plan',
      'view.create.3d-view',
      'view.create.section',
      'view.create.sheet',
      'view.create.schedule',
      'project.manage-links',
      'project.import.ifc',
      'project.import.dxf',
      'library.open-material-browser',
      'library.open-appearance-asset-browser',
      'help.replay-onboarding-tour',
      'advisor.open',
      'jobs.open',
      'milestone.open',
    ]) {
      for (const mode of ['plan', '3d', 'sheet', 'schedule'] as const) {
        expect(evaluateCommandInMode(commandId, mode)?.state).toBe('enabled');
      }
    }
  });

  it('tracks 3D view and visibility commands as active only in 3D-capable views', () => {
    expect(evaluateCommandInMode('view.3d.fit', '3d')?.state).toBe('enabled');
    expect(evaluateCommandInMode('view.3d.sun-settings', '3d')?.state).toBe('enabled');
    expect(evaluateCommandInMode('visibility.3d.hide-all-categories', '3d')?.state).toBe('enabled');
    expect(evaluateCommandInMode('view.3d.fit', 'plan')?.state).toBe('disabled');
    expect(evaluateCommandInMode('view.3d.sun-settings', 'plan')?.state).toBe('disabled');
  });

  it('tracks active saved-viewpoint commands as 3D-capable only', () => {
    for (const commandId of [
      'view.3d.saved-view.save-current',
      'view.3d.saved-view.reset',
      'view.3d.saved-view.update',
    ]) {
      expect(evaluateCommandInMode(commandId, '3d')?.state).toBe('enabled');
      expect(evaluateCommandInMode(commandId, 'plan')?.state).toBe('disabled');
    }
  });

  it('routes active visibility controls to plan-like and 3D-capable views only', () => {
    expect(evaluateCommandInMode('visibility.active-controls', 'plan')?.state).toBe('enabled');
    expect(evaluateCommandInMode('visibility.active-controls', '3d')?.state).toBe('enabled');
    expect(evaluateCommandInMode('visibility.active-controls', 'section')?.state).toBe('enabled');
    expect(evaluateCommandInMode('visibility.active-controls', 'sheet')?.state).toBe('disabled');
  });

  it('maps expanded command reachability rows to canonical owners — UX-CMD-001 through UX-CMD-020', () => {
    expect(getCommandCapability('navigate.plan')?.surfaces).toEqual(['cmd-k', 'primary-sidebar']);
    expect(getCommandCapability('navigate.architecture')?.surfaces).toEqual([
      'cmd-k',
      'primary-sidebar',
    ]);
    expect(getCommandCapability('navigate.structure')?.surfaces).toEqual([
      'cmd-k',
      'primary-sidebar',
    ]);
    expect(getCommandCapability('navigate.mep')?.surfaces).toEqual(['cmd-k', 'primary-sidebar']);
    expect(getCommandCapability('tool.wall')?.surfaces).toEqual(['ribbon', 'cmd-k']);
    expect(getCommandCapability('tool.door')?.preconditions).toContain('has-wall');
    expect(getCommandCapability('tool.dimension')?.surfaces).toEqual(['ribbon', 'cmd-k']);
    expect(getCommandCapability('view.3d.sun-settings')?.surfaces).toEqual([
      'cmd-k',
      'secondary-sidebar',
    ]);
    expect(getCommandCapability('visibility.plan.graphics')?.surfaces).toEqual([
      'cmd-k',
      'ribbon',
      'secondary-sidebar',
    ]);
    expect(getCommandCapability('view.3d.wall.insert-door')?.surfaces).toEqual([
      'cmd-k',
      'ribbon',
      'element-sidebar',
      'canvas-context',
    ]);
    expect(getCommandCapability('project.manage-links')?.surfaces).toEqual([
      'cmd-k',
      'primary-sidebar',
    ]);
    expect(getCommandCapability('project.open-settings')?.surfaces).toEqual([
      'cmd-k',
      'primary-sidebar',
    ]);
    expect(getCommandCapability('view.create.floor-plan')?.surfaces).toEqual([
      'cmd-k',
      'primary-sidebar',
    ]);
    expect(getCommandCapability('project.import.ifc')?.surfaces).toEqual([
      'cmd-k',
      'primary-sidebar',
    ]);
    expect(getCommandCapability('project.import.dxf')?.surfaces).toEqual([
      'cmd-k',
      'primary-sidebar',
    ]);
    expect(getCommandCapability('library.open-material-browser')?.surfaces).toEqual([
      'cmd-k',
      'primary-sidebar',
      'element-sidebar',
    ]);
    expect(getCommandCapability('library.open-appearance-asset-browser')?.surfaces).toEqual([
      'cmd-k',
      'primary-sidebar',
      'element-sidebar',
    ]);
    expect(getCommandCapability('advisor.open')?.surfaces).toEqual(['cmd-k', 'footer']);
    expect(getCommandCapability('jobs.open')?.surfaces).toEqual(['cmd-k', 'footer']);
    expect(getCommandCapability('milestone.open')?.surfaces).toEqual(['cmd-k', 'primary-sidebar']);
    expect(getCommandCapability('advisor.apply-first-fix')?.preconditions).toEqual([
      'advisor-finding-with-quick-fix',
    ]);
    expect(getCommandCapability('project.share-presentation')?.surfaces).toEqual([
      'cmd-k',
      'header',
    ]);
    expect(getCommandCapability('tabs.close-inactive')?.surfaces).toEqual(['cmd-k', 'header']);
    expect(getCommandCapability('shell.toggle-primary-sidebar')?.surfaces).toEqual([
      'cmd-k',
      'header',
    ]);
    expect(getCommandCapability('help.keyboard-shortcuts')?.surfaces).toEqual(['cmd-k']);
    expect(getCommandCapability('help.replay-onboarding-tour')?.surfaces).toEqual([
      'cmd-k',
      'primary-sidebar',
    ]);
  });

  it('tracks sheet workflow commands as sheet-only document commands', () => {
    for (const commandId of [
      'sheet.place-recommended-views',
      'sheet.edit-titleblock',
      'sheet.edit-viewports',
      'sheet.export-share',
      'sheet.review.comment-mode',
      'sheet.review.markup-mode',
      'sheet.review.resolve-mode',
      'sheet.review.markup-shape.freehand',
      'sheet.review.markup-shape.arrow',
      'sheet.review.markup-shape.cloud',
      'sheet.review.markup-shape.text',
    ]) {
      expect(evaluateCommandInMode(commandId, 'sheet')?.state).toBe('enabled');
      expect(evaluateCommandInMode(commandId, 'plan')?.state).toBe('disabled');
    }
  });

  it('tracks section workflow commands as section-only commands', () => {
    for (const commandId of [
      'section.place-on-sheet',
      'section.open-source-plan',
      'section.open-3d-context',
      'section.crop-depth.increase',
      'section.crop-depth.decrease',
    ]) {
      expect(evaluateCommandInMode(commandId, 'section')?.state).toBe('enabled');
      expect(evaluateCommandInMode(commandId, 'plan')?.state).toBe('disabled');
    }
  });

  it('detects dead direct command exposure in invalid views', () => {
    expect(
      auditCommandExposures([
        { commandId: 'tool.property-line', mode: '3d', surface: 'ribbon', behavior: 'direct' },
      ]),
    ).toHaveLength(1);

    expect(
      auditCommandExposures([
        { commandId: 'tool.property-line', mode: '3d', surface: 'ribbon', behavior: 'bridge' },
        {
          commandId: 'visibility.plan.graphics',
          mode: 'sheet',
          surface: 'ribbon',
          behavior: 'disabled',
        },
      ]),
    ).toEqual([]);
  });
});
