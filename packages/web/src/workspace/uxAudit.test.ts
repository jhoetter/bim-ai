import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import '../cmdPalette/defaultCommands';
import { getRegistry, queryPalette } from '../cmdPalette/registry';
import {
  CAPABILITY_VIEW_MODES,
  evaluateCommandInMode,
  getAllCommandCapabilities,
  getCommandCapability,
  type CapabilityViewMode,
  unreachableCommandCapabilities,
} from './commandCapabilities';
import {
  prunedRibbonCommandReachabilityForMode,
  ribbonCommandReachabilityForMode,
} from './shell/RibbonBar';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');

describe('UX reachability audit', () => {
  it('uses source, screenshot, and command coverage as revamp quality gates — UX-RISK-001', () => {
    const tracker = readFileSync(resolve(repoRoot, 'spec/ux-bim-ai-rework-tracker.md'), 'utf8');
    const e2e = readFileSync(
      resolve(repoRoot, 'packages/web/e2e/ux-revamp-regression.spec.ts'),
      'utf8',
    );
    const auditRows = [...tracker.matchAll(/\| UX-AUD-\d{3} \|/g)].map((match) => match[0]);
    const requiredScreenshots = [
      '01-plan.png',
      '10-advisor-dialog.png',
      '18-element-sidebar-selected-wall.png',
      '20-keyboard-command-palette.png',
      '36-primary-dragged-to-zero.png',
      '44-active-wall-command-ownership.png',
    ];

    expect(auditRows.length).toBeGreaterThanOrEqual(20);
    for (const screenshot of requiredScreenshots) {
      expect(e2e).toContain(screenshot);
    }
    expect(getAllCommandCapabilities().length).toBeGreaterThan(20);
    expect(unreachableCommandCapabilities()).toEqual([]);
  });

  it('keeps mounted routes tied to route-state checks before legacy deletion — UX-RISK-002', () => {
    const app = readFileSync(resolve(repoRoot, 'packages/web/src/App.tsx'), 'utf8');
    const e2e = readFileSync(
      resolve(repoRoot, 'packages/web/e2e/ux-revamp-regression.spec.ts'),
      'utf8',
    );
    const routes = [...app.matchAll(/<Route path="([^"]+)"/g)].map((match) => match[1]).sort();

    expect(routes).toEqual(['/', '/family-editor', '/icons', '/p/:token'].sort());
    expect(e2e).toContain('bootWorkspace(page)');
    expect(e2e).toContain("page.goto('/p/public-ux-risk-009')");
    expect(e2e).toContain("page.goto('/family-editor')");
    expect(e2e).toContain("page.goto('/icons')");
  });

  it('keeps seeded live findings synchronized with regression evidence', () => {
    const tracker = readFileSync(resolve(repoRoot, 'spec/ux-bim-ai-rework-tracker.md'), 'utf8');
    const e2e = readFileSync(
      resolve(repoRoot, 'packages/web/e2e/ux-revamp-regression.spec.ts'),
      'utf8',
    );
    const fixedLiveRows = [
      'UX-LIVE-003',
      'UX-LIVE-004',
      'UX-LIVE-005',
      'UX-LIVE-006',
      'UX-LIVE-007',
      'UX-LIVE-008',
      'UX-LIVE-009',
      'UX-LIVE-010',
      'UX-LIVE-011',
      'UX-LIVE-012',
    ];
    const requiredEvidence = [
      'assertSemanticRegionOwnership(page)',
      '36-primary-dragged-to-zero.png',
      '01-plan.png',
      '02-3d.png',
      '04-sheet.png',
      '05-schedule.png',
      '07-agent.png',
      '18-element-sidebar-selected-wall.png',
      '10-advisor-dialog.png',
    ];

    for (const rowId of fixedLiveRows) {
      expect(tracker).toMatch(new RegExp(`\\| ${rowId} \\|.*\\| Fixed\\s+\\|`));
    }
    for (const evidence of requiredEvidence) {
      expect(e2e).toContain(evidence);
    }
  });

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

  it('keeps pure 3D viewport edits wired to semantic command dispatch', () => {
    const canvasMount = readFileSync(
      resolve(repoRoot, 'packages/web/src/workspace/viewport/CanvasMount.tsx'),
      'utf8',
    );

    expect(canvasMount).toMatch(
      /if \(mode === '3d'\)[\s\S]*<Viewport[\s\S]*onSemanticCommand={onSemanticCommand}/,
    );
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

  it('pairs pruned ribbon commands with Cmd+K reachability and availability reasons — UX-RISK-006', () => {
    const selectedElementKinds = [null, 'wall'];
    const inspectedCommandIds = new Set<string>();

    for (const mode of CAPABILITY_VIEW_MODES) {
      for (const selectedElementKind of selectedElementKinds) {
        for (const exposure of prunedRibbonCommandReachabilityForMode(mode, selectedElementKind)) {
          const capability = getCommandCapability(exposure.commandId);
          const availability = evaluateCommandInMode(exposure.commandId, mode);
          const context = `${exposure.commandId} (${exposure.label}) pruned from ${mode} via ${exposure.tabId}/${exposure.panelId}`;

          inspectedCommandIds.add(`${mode}:${exposure.commandId}`);
          expect(capability, context).toBeTruthy();
          expect(capability?.surfaces, context).toContain('cmd-k');
          expect(availability?.state, context).toBe(exposure.behavior);
          expect(exposure.behavior, context).not.toBe('direct');
          expect(exposure.disabledReason, context).toBeTruthy();
        }
      }
    }

    expect(inspectedCommandIds.size).toBeGreaterThan(0);
    expect(inspectedCommandIds).toContain('3d:tool.wall');
    expect(inspectedCommandIds).toContain('schedule:tool.dimension');
    expect(inspectedCommandIds).toContain('plan:view.3d.saved-view.save-current');
  });
});
