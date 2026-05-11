import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import '../cmdPalette/defaultCommands';
import { getRegistry } from '../cmdPalette/registry';
import {
  evaluateCommandInMode,
  getCommandCapability,
  type CapabilityViewMode,
} from './commandCapabilities';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');

describe('UX reachability audit', () => {
  it('keeps mounted Cmd+K commands registered in the capability graph', () => {
    const missing = getRegistry()
      .filter((entry) => !entry.id.startsWith('view.'))
      .filter((entry) => !getCommandCapability(entry.id))
      .map((entry) => entry.id);

    expect(missing).toEqual([]);
  });

  it('does not reintroduce perspective-only palette filtering in Workspace', () => {
    const workspace = readFileSync(
      resolve(repoRoot, 'packages/web/src/workspace/Workspace.tsx'),
      'utf8',
    );

    expect(workspace).not.toContain('planToolsForPerspective');
    expect(workspace).not.toContain('paletteToolAllowlistForPerspective');
  });

  it('keeps high-risk plan authoring commands bridged outside plan-capable views', () => {
    const nonPlanModes: CapabilityViewMode[] = ['3d', 'sheet', 'schedule', 'agent'];

    for (const mode of nonPlanModes) {
      for (const commandId of ['tool.wall', 'tool.door', 'tool.window', 'tool.dimension']) {
        expect(evaluateCommandInMode(commandId, mode)?.state).toBe('bridge');
      }
    }
  });

  it('keeps 3D controls unavailable in non-3D-only views instead of silently invoking them', () => {
    for (const mode of ['plan', 'sheet', 'schedule', 'agent'] as CapabilityViewMode[]) {
      expect(evaluateCommandInMode('view.3d.fit', mode)?.state).toBe('disabled');
      expect(evaluateCommandInMode('visibility.3d.hide-all-categories', mode)?.state).toBe(
        'disabled',
      );
    }
  });
});
