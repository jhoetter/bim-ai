import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import '../cmdPalette/defaultCommands';
import { getRegistry, queryPalette } from '../cmdPalette/registry';
import {
  CAPABILITY_VIEW_MODES,
  evaluateCommandInMode,
  getCommandCapability,
  type CapabilityViewMode,
} from './commandCapabilities';
import { ribbonCommandReachabilityForMode } from './shell/RibbonBar';

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
    expect(
      existsSync(resolve(repoRoot, 'packages/web/src/workspace/planToolsByPerspective.ts')),
    ).toBe(false);
  });

  it('keeps Cmd+K on the mounted capability-backed implementation only', () => {
    const workspace = readFileSync(
      resolve(repoRoot, 'packages/web/src/workspace/Workspace.tsx'),
      'utf8',
    );

    expect(workspace).toContain("'../cmdPalette/CommandPalette'");
    expect(existsSync(resolve(repoRoot, 'packages/web/src/cmd/CommandPalette.tsx'))).toBe(false);
    expect(existsSync(resolve(repoRoot, 'packages/web/src/cmd/commandPaletteSources.ts'))).toBe(
      false,
    );
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

  it('registers selected-wall 3D edit commands as 3D-only selection commands', () => {
    for (const commandId of [
      'view.3d.wall.insert-door',
      'view.3d.wall.insert-window',
      'view.3d.wall.insert-opening',
      'view.3d.wall.generate-section',
      'view.3d.wall.generate-elevation',
    ]) {
      expect(evaluateCommandInMode(commandId, '3d')?.state).toBe('enabled');
      expect(evaluateCommandInMode(commandId, 'plan')?.state).toBe('disabled');
      expect(getCommandCapability(commandId)?.preconditions).toContain('selected-wall');
    }
  });

  it('keeps every mounted capability-backed Cmd+K result labeled with a context badge', () => {
    for (const activeMode of ['plan', '3d', 'sheet', 'schedule', 'agent'] as CapabilityViewMode[]) {
      const results = queryPalette(
        '',
        { selectedElementIds: [], activeViewId: null, activeMode },
        {},
      ).filter((entry) => !entry.id.startsWith('view.'));

      expect(results.length).toBeGreaterThan(0);
      for (const entry of results) {
        expect(entry.badge, `${entry.id} in ${activeMode}`).toBeTruthy();
      }
    }
  });

  it('keeps mounted ribbon commands from becoming enabled dead buttons', () => {
    const selectedElementKinds = [null, 'wall'];
    let inspected = 0;

    for (const mode of CAPABILITY_VIEW_MODES) {
      for (const selectedElementKind of selectedElementKinds) {
        for (const exposure of ribbonCommandReachabilityForMode(mode, selectedElementKind)) {
          inspected += 1;
          const availability = evaluateCommandInMode(exposure.commandId, mode);
          const context = `${exposure.commandId} (${exposure.label}) in ${mode} via ${exposure.tabId}/${exposure.panelId}`;

          expect(availability, context).not.toBeNull();
          if (exposure.behavior === 'direct') {
            expect(availability?.state, context).toBe('enabled');
          } else {
            expect(exposure.disabledReason, context).toBeTruthy();
          }
        }
      }
    }

    expect(inspected).toBeGreaterThan(0);
  });
});
