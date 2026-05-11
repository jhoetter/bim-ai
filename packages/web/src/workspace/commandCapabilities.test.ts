import { describe, expect, it } from 'vitest';

import { getToolRegistry } from '../tools/toolRegistry';
import {
  auditCommandExposures,
  evaluateCommandInMode,
  getAllCommandCapabilities,
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

  it('has unique command ids and no unreachable registered commands', () => {
    const capabilities = getAllCommandCapabilities();
    expect(new Set(capabilities.map((capability) => capability.id)).size).toBe(capabilities.length);
    expect(unreachableCommandCapabilities()).toEqual([]);
  });

  it('marks plan tools as bridge commands outside their execution surface', () => {
    const availability = evaluateCommandInMode('tool.wall', '3d');
    expect(availability?.state).toBe('bridge');
    if (availability?.state === 'bridge') {
      expect(availability.targetMode).toBe('plan');
      expect(availability.reason).toContain('Plan');
    }
  });

  it('keeps universal navigation and system commands enabled in every view', () => {
    for (const commandId of [
      'navigate.plan',
      'navigate.3d',
      'navigate.concept',
      'theme.toggle',
      'settings.language.toggle',
      'shell.toggle-left-rail',
      'shell.toggle-right-rail',
    ]) {
      for (const mode of ['plan', '3d', 'sheet', 'schedule', 'agent'] as const) {
        expect(evaluateCommandInMode(commandId, mode)?.state).toBe('enabled');
      }
    }
  });

  it('tracks 3D view and visibility commands as active only in 3D-capable views', () => {
    expect(evaluateCommandInMode('view.3d.fit', '3d')?.state).toBe('enabled');
    expect(evaluateCommandInMode('visibility.3d.hide-all-categories', 'plan-3d')?.state).toBe(
      'enabled',
    );
    expect(evaluateCommandInMode('view.3d.fit', 'plan')?.state).toBe('disabled');
  });

  it('routes active visibility controls to plan-like and 3D-capable views only', () => {
    expect(evaluateCommandInMode('visibility.active-controls', 'plan')?.state).toBe('enabled');
    expect(evaluateCommandInMode('visibility.active-controls', '3d')?.state).toBe('enabled');
    expect(evaluateCommandInMode('visibility.active-controls', 'section')?.state).toBe('enabled');
    expect(evaluateCommandInMode('visibility.active-controls', 'sheet')?.state).toBe('disabled');
  });

  it('tracks sheet workflow commands as sheet-only document commands', () => {
    for (const commandId of [
      'sheet.place-recommended-views',
      'sheet.edit-titleblock',
      'sheet.edit-viewports',
      'sheet.export-share',
    ]) {
      expect(evaluateCommandInMode(commandId, 'sheet')?.state).toBe('enabled');
      expect(evaluateCommandInMode(commandId, 'plan')?.state).toBe('disabled');
    }
  });

  it('tracks section workflow commands as section-only commands', () => {
    for (const commandId of [
      'section.place-on-sheet',
      'section.open-source-plan',
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
        { commandId: 'tool.wall', mode: '3d', surface: 'ribbon', behavior: 'direct' },
      ]),
    ).toHaveLength(1);

    expect(
      auditCommandExposures([
        { commandId: 'tool.wall', mode: '3d', surface: 'ribbon', behavior: 'bridge' },
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
