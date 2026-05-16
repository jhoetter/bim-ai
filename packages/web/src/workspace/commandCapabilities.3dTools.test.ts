import { describe, expect, it } from 'vitest';

import { getToolRegistry } from '../tools/toolRegistry';
import { capabilityIdForTool, evaluateCommandInMode } from './commandCapabilities';

const tIdentity = ((key: string) => key) as never;

describe('3D tool activation coverage', () => {
  it('no evaluateCommandInMode call returns undefined for any registered tool in plan or 3d mode', () => {
    const tools = Object.values(getToolRegistry(tIdentity));

    for (const tool of tools) {
      const commandId = capabilityIdForTool(tool.id);

      const planResult = evaluateCommandInMode(commandId, 'plan');
      expect(planResult, `${commandId} returned undefined/null in plan mode`).not.toBeUndefined();
      expect(planResult, `${commandId} returned null in plan mode`).not.toBeNull();

      const result3d = evaluateCommandInMode(commandId, '3d');
      expect(result3d, `${commandId} returned undefined/null in 3d mode`).not.toBeUndefined();
      expect(result3d, `${commandId} returned null in 3d mode`).not.toBeNull();
    }
  });

  it('tools declared 3d-capable are enabled in 3d mode', () => {
    const tools = Object.values(getToolRegistry(tIdentity));
    const threeDTools = tools.filter((tool) => tool.modes.includes('3d'));

    expect(threeDTools.length, 'expected at least one 3D-capable tool').toBeGreaterThan(0);

    for (const tool of threeDTools) {
      const commandId = capabilityIdForTool(tool.id);
      const result = evaluateCommandInMode(commandId, '3d');
      expect(
        result?.state,
        `${commandId} (modes: ${tool.modes.join(', ')}) should be enabled in 3d mode`,
      ).toBe('enabled');
    }
  });

  it('plan-only tools are not enabled in 3d mode', () => {
    const tools = Object.values(getToolRegistry(tIdentity));
    const planOnlyTools = tools.filter((tool) => !tool.modes.includes('3d'));

    expect(planOnlyTools.length, 'expected at least one plan-only tool').toBeGreaterThan(0);

    for (const tool of planOnlyTools) {
      const commandId = capabilityIdForTool(tool.id);
      const result = evaluateCommandInMode(commandId, '3d');
      expect(
        result?.state,
        `${commandId} (modes: ${tool.modes.join(', ')}) should not be enabled in 3d mode`,
      ).not.toBe('enabled');
    }
  });
});
