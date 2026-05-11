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
    for (const commandId of ['navigate.plan', 'navigate.3d', 'theme.toggle']) {
      for (const mode of ['plan', '3d', 'sheet', 'schedule', 'agent'] as const) {
        expect(evaluateCommandInMode(commandId, mode)?.state).toBe('enabled');
      }
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
