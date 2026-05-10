import { type JSX, useEffect, useMemo, useState } from 'react';
import { Icons, ICON_SIZE, type IconName } from '@bim-ai/ui';

import type { ToolId } from '../../tools/toolRegistry';
import type { WorkspaceMode } from './TopBar';

type RibbonTabId =
  | 'architecture'
  | 'structure'
  | 'steel'
  | 'precast'
  | 'systems'
  | 'insert'
  | 'annotate'
  | 'analyze'
  | 'massing-site'
  | 'collaborate'
  | 'view'
  | 'manage'
  | 'add-ins'
  | 'modify';

type RibbonCommand =
  | { type: 'tool'; id: ToolId; label: string; icon: IconName; testId?: string }
  | { type: 'mode'; id: WorkspaceMode; label: string; icon: IconName; testId?: string }
  | { type: 'action'; id: RibbonActionId; label: string; icon: IconName; testId?: string };

type RibbonActionId =
  | 'command-palette'
  | 'visibility-graphics'
  | 'family-library'
  | 'project-menu'
  | 'settings';

interface RibbonPanel {
  id: string;
  label: string;
  commands: RibbonCommand[];
  flyoutCommands?: RibbonCommand[];
}

interface RibbonTab {
  id: RibbonTabId;
  label: string;
  contextual?: boolean;
  panels: RibbonPanel[];
}

export interface RibbonBarProps {
  activeToolId?: ToolId;
  selectedElementKind?: string | null;
  onToolSelect?: (id: ToolId) => void;
  onModeChange?: (mode: WorkspaceMode) => void;
  onOpenCommandPalette?: () => void;
  onOpenVisibilityGraphics?: () => void;
  onOpenFamilyLibrary?: () => void;
  onOpenProjectMenu?: () => void;
  onOpenSettings?: () => void;
}

const RIBBON_HIDDEN_COMMANDS_STORAGE_KEY = 'bim-ai.ribbon.hiddenCommands.v1';

export function RibbonBar({
  activeToolId,
  selectedElementKind,
  onToolSelect,
  onModeChange,
  onOpenCommandPalette,
  onOpenVisibilityGraphics,
  onOpenFamilyLibrary,
  onOpenProjectMenu,
  onOpenSettings,
}: RibbonBarProps): JSX.Element {
  const [activeTabId, setActiveTabId] = useState<RibbonTabId>('architecture');
  const [minimized, setMinimized] = useState(false);
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [openFlyoutPanelId, setOpenFlyoutPanelId] = useState<string | null>(null);
  const [hiddenCommandKeys, setHiddenCommandKeys] = useState<Set<string>>(
    () => new Set(readHiddenRibbonCommandKeys()),
  );
  const tabs = useMemo(() => buildRibbonTabs(selectedElementKind), [selectedElementKind]);
  const activeTab = tabs.find((tab) => tab.id === activeTabId) ?? tabs[0]!;
  const activeCommands = useMemo(() => collectTabCommands(activeTab), [activeTab]);

  useEffect(() => {
    writeHiddenRibbonCommandKeys([...hiddenCommandKeys]);
  }, [hiddenCommandKeys]);

  function runCommand(command: RibbonCommand): void {
    if (command.type === 'tool') {
      onToolSelect?.(command.id);
      return;
    }
    if (command.type === 'mode') {
      onModeChange?.(command.id);
      return;
    }
    const actions: Record<RibbonActionId, (() => void) | undefined> = {
      'command-palette': onOpenCommandPalette,
      'visibility-graphics': onOpenVisibilityGraphics,
      'family-library': onOpenFamilyLibrary,
      'project-menu': onOpenProjectMenu,
      settings: onOpenSettings,
    };
    actions[command.id]?.();
  }

  function commandVisible(command: RibbonCommand): boolean {
    return !hiddenCommandKeys.has(commandKey(command));
  }

  function setCommandVisible(command: RibbonCommand, visible: boolean): void {
    setHiddenCommandKeys((prev) => {
      const next = new Set(prev);
      const key = commandKey(command);
      if (visible) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return (
    <section
      aria-label="Ribbon"
      data-testid="ribbon-bar"
      className="border-b border-border bg-surface"
    >
      <div className="flex items-end gap-2 px-3 pt-1">
        <div
          role="tablist"
          aria-label="Ribbon tabs"
          data-testid="ribbon-tabs"
          className="flex min-w-0 flex-1 items-end gap-0.5 overflow-x-auto"
        >
          {tabs.map((tab) => {
            const active = tab.id === activeTab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                data-testid={`ribbon-tab-${tab.id}`}
                data-contextual={tab.contextual ? 'true' : 'false'}
                onClick={() => {
                  setActiveTabId(tab.id);
                  setMinimized(false);
                  setCustomizeOpen(false);
                  setOpenFlyoutPanelId(null);
                }}
                className={[
                  'h-7 whitespace-nowrap rounded-t-md px-3 text-xs font-semibold transition-colors',
                  active
                    ? 'bg-background text-foreground shadow-[inset_0_2px_0_0_var(--color-accent)]'
                    : tab.contextual
                      ? 'text-accent hover:bg-background'
                      : 'text-muted hover:bg-background hover:text-foreground',
                ].join(' ')}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          aria-label="Customize ribbon"
          aria-expanded={customizeOpen}
          data-testid="ribbon-toggle-customize"
          onClick={() => {
            setCustomizeOpen((v) => !v);
            setOpenFlyoutPanelId(null);
          }}
          className="mb-0.5 flex h-6 w-6 items-center justify-center rounded border border-border bg-background text-muted hover:text-foreground"
        >
          <Icons.settings size={ICON_SIZE.chrome} aria-hidden="true" />
        </button>
        <button
          type="button"
          aria-label={minimized ? 'Restore ribbon panels' : 'Minimize ribbon panels'}
          aria-expanded={!minimized}
          data-testid="ribbon-toggle-minimize"
          onClick={() => setMinimized((v) => !v)}
          className="mb-0.5 flex h-6 w-6 items-center justify-center rounded border border-border bg-background text-muted hover:text-foreground"
        >
          {minimized ? (
            <Icons.disclosureOpen size={ICON_SIZE.chrome} aria-hidden="true" />
          ) : (
            <Icons.disclosureClosed size={ICON_SIZE.chrome} aria-hidden="true" />
          )}
        </button>
      </div>
      {customizeOpen ? (
        <div
          data-testid="ribbon-customize-menu"
          className="border-t border-border bg-background px-3 py-2 text-xs text-foreground"
        >
          <div className="mb-1 font-semibold">Customize {activeTab.label}</div>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {activeCommands.map((command) => (
              <label
                key={commandKey(command)}
                className="flex items-center gap-1.5 whitespace-nowrap text-muted"
              >
                <input
                  type="checkbox"
                  checked={commandVisible(command)}
                  onChange={(e) => setCommandVisible(command, e.target.checked)}
                />
                <span>{command.label}</span>
              </label>
            ))}
          </div>
        </div>
      ) : null}
      {!minimized ? (
        <div
          data-testid="ribbon-panels"
          className="flex min-h-[58px] items-stretch gap-2 overflow-x-auto bg-background px-3 py-1.5"
        >
          {activeTab.panels.map((panel) => {
            const visibleCommands = panel.commands.filter(commandVisible);
            const visibleFlyoutCommands = (panel.flyoutCommands ?? []).filter(commandVisible);
            const flyoutId = `${activeTab.id}:${panel.id}`;
            return (
              <div
                key={panel.id}
                role="group"
                aria-label={panel.label}
                className="relative flex min-w-fit items-stretch gap-1 border-r border-border pr-2 last:border-r-0"
              >
                {visibleCommands.map((command) => (
                  <RibbonButton
                    key={`${command.type}:${command.id}`}
                    command={command}
                    active={command.type === 'tool' && command.id === activeToolId}
                    onClick={() => runCommand(command)}
                  />
                ))}
                {visibleFlyoutCommands.length > 0 ? (
                  <div className="relative flex items-center">
                    <button
                      type="button"
                      aria-label={`${panel.label} panel flyout`}
                      aria-expanded={openFlyoutPanelId === flyoutId}
                      data-testid={`ribbon-panel-flyout-${panel.id}`}
                      onClick={() =>
                        setOpenFlyoutPanelId((current) => (current === flyoutId ? null : flyoutId))
                      }
                      className="flex h-12 w-7 items-center justify-center rounded-md text-muted hover:bg-surface hover:text-foreground"
                    >
                      <Icons.disclosureOpen size={ICON_SIZE.chrome} aria-hidden="true" />
                    </button>
                    {openFlyoutPanelId === flyoutId ? (
                      <div
                        role="menu"
                        data-testid={`ribbon-flyout-menu-${panel.id}`}
                        className="absolute right-0 top-12 z-30 min-w-48 rounded border border-border bg-surface p-1 shadow-lg"
                      >
                        {visibleFlyoutCommands.map((command) => {
                          const Icon = Icons[command.icon] ?? Icons.commandPalette;
                          return (
                            <button
                              key={`${command.type}:${command.id}`}
                              type="button"
                              role="menuitem"
                              data-testid={`ribbon-flyout-command-${command.testId ?? command.id}`}
                              onClick={() => {
                                runCommand(command);
                                setOpenFlyoutPanelId(null);
                              }}
                              className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs text-foreground hover:bg-background"
                            >
                              <Icon size={ICON_SIZE.chrome} aria-hidden="true" />
                              <span>{command.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                ) : null}
                <div className="flex min-w-14 items-end justify-center px-1 pb-0.5 text-[10px] font-medium text-muted">
                  {panel.label}
                </div>
              </div>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}

function RibbonButton({
  command,
  active,
  onClick,
}: {
  command: RibbonCommand;
  active: boolean;
  onClick: () => void;
}): JSX.Element {
  const Icon = Icons[command.icon] ?? Icons.commandPalette;
  return (
    <button
      type="button"
      data-testid={command.testId ?? `ribbon-command-${command.id}`}
      aria-pressed={command.type === 'tool' ? active : undefined}
      title={command.label}
      onClick={onClick}
      className={[
        'flex h-12 min-w-14 flex-col items-center justify-center gap-0.5 rounded-md px-2 text-[11px] font-medium transition-colors',
        active
          ? 'bg-accent text-accent-foreground'
          : 'text-foreground hover:bg-surface hover:text-foreground',
      ].join(' ')}
    >
      <Icon size={ICON_SIZE.toolPalette} aria-hidden="true" />
      <span className="max-w-20 truncate">{command.label}</span>
    </button>
  );
}

function buildRibbonTabs(selectedElementKind?: string | null): RibbonTab[] {
  const tabs: RibbonTab[] = [
    {
      id: 'architecture',
      label: 'Architecture',
      panels: [
        {
          id: 'build',
          label: 'Build',
          commands: [
            tool('wall', 'Wall', 'wall'),
            tool('door', 'Door', 'door'),
            tool('window', 'Window', 'window'),
            tool('component', 'Component', 'family'),
          ],
        },
        {
          id: 'room',
          label: 'Room',
          commands: [tool('room', 'Room', 'room'), tool('ceiling', 'Ceiling', 'ceiling')],
        },
        {
          id: 'circulation',
          label: 'Circulation',
          commands: [tool('stair', 'Stair', 'stair'), tool('railing', 'Railing', 'railing')],
        },
      ],
    },
    {
      id: 'structure',
      label: 'Structure',
      panels: [
        {
          id: 'structure',
          label: 'Structure',
          commands: [
            tool('column', 'Column', 'column'),
            tool('beam', 'Beam', 'beam'),
            tool('floor', 'Floor', 'floor'),
            tool('roof', 'Roof', 'roof'),
          ],
        },
        {
          id: 'openings',
          label: 'Openings',
          commands: [
            tool('wall-opening', 'Opening', 'wall-opening'),
            tool('shaft', 'Shaft', 'shaft'),
          ],
        },
      ],
    },
    {
      id: 'steel',
      label: 'Steel',
      panels: [
        {
          id: 'steel-structure',
          label: 'Structure',
          commands: [tool('beam', 'Beam', 'beam'), tool('column', 'Column', 'column')],
        },
        {
          id: 'connections',
          label: 'Connections',
          commands: [
            action('command-palette', 'Connections', 'commandPalette'),
            action('settings', 'Steel Settings', 'settings'),
          ],
        },
      ],
    },
    {
      id: 'precast',
      label: 'Precast',
      panels: [
        {
          id: 'precast-elements',
          label: 'Elements',
          commands: [
            tool('wall', 'Wall Panel', 'wall'),
            tool('floor', 'Slab', 'floor'),
            tool('beam', 'Beam', 'beam'),
          ],
        },
        {
          id: 'assemblies',
          label: 'Assemblies',
          commands: [
            action('command-palette', 'Assemblies', 'assembly'),
            action('settings', 'Precast Settings', 'settings'),
          ],
        },
      ],
    },
    {
      id: 'systems',
      label: 'Systems',
      panels: [
        {
          id: 'mechanical',
          label: 'Mechanical',
          commands: [
            tool('shaft', 'Shaft', 'shaft'),
            tool('wall-opening', 'Opening', 'wall-opening'),
          ],
        },
        {
          id: 'coordination',
          label: 'Coordination',
          commands: [
            action('visibility-graphics', 'System VG', 'layerOn'),
            action('command-palette', 'Systems Cmd', 'commandPalette'),
          ],
        },
      ],
    },
    {
      id: 'insert',
      label: 'Insert',
      panels: [
        {
          id: 'load',
          label: 'Load',
          commands: [
            action('family-library', 'Load Family', 'family'),
            tool('component', 'Component', 'family'),
          ],
        },
        {
          id: 'link',
          label: 'Link',
          commands: [
            action('project-menu', 'Project Files', 'linkedModel'),
            action('command-palette', 'Import/Link', 'commandPalette'),
          ],
        },
      ],
    },
    {
      id: 'annotate',
      label: 'Annotate',
      panels: [
        {
          id: 'dimension',
          label: 'Dimension',
          commands: [
            tool('dimension', 'Aligned', 'dimension'),
            tool('measure', 'Measure', 'measure'),
          ],
        },
        {
          id: 'tags',
          label: 'Tags',
          commands: [tool('tag', 'Tag by Category', 'tag')],
        },
        {
          id: 'datum',
          label: 'Datum',
          commands: [
            tool('grid', 'Grid', 'gridLine'),
            tool('reference-plane', 'Ref Plane', 'gridLine'),
          ],
        },
      ],
    },
    {
      id: 'analyze',
      label: 'Analyze',
      panels: [
        {
          id: 'inquiry',
          label: 'Inquiry',
          commands: [
            tool('measure', 'Measure', 'measure'),
            action('visibility-graphics', 'Graphics', 'layerOn'),
          ],
        },
        {
          id: 'coordination',
          label: 'Coordination',
          commands: [
            action('command-palette', 'Checks', 'clash'),
            action('settings', 'Rules', 'validationRule'),
          ],
        },
      ],
    },
    {
      id: 'massing-site',
      label: 'Massing & Site',
      panels: [
        {
          id: 'site',
          label: 'Site',
          commands: [
            tool('property-line', 'Property Line', 'detailLine'),
            tool('toposolid_subdivision', 'Topo Subdivision', 'grid'),
          ],
        },
        {
          id: 'datum',
          label: 'Datum',
          commands: [
            tool('reference-plane', 'Ref Plane', 'level'),
            tool('grid', 'Grid', 'gridLine'),
          ],
        },
      ],
    },
    {
      id: 'collaborate',
      label: 'Collaborate',
      panels: [
        {
          id: 'coordination',
          label: 'Coordinate',
          commands: [
            action('project-menu', 'Project', 'settings'),
            action('command-palette', 'Issues', 'issue'),
          ],
        },
        {
          id: 'team',
          label: 'Team',
          commands: [
            action('settings', 'Account', 'collaborators'),
            action('visibility-graphics', 'Worksets', 'layerOn'),
          ],
        },
      ],
    },
    {
      id: 'view',
      label: 'View',
      panels: [
        {
          id: 'create',
          label: 'Create',
          commands: [
            tool('section', 'Section', 'sectionView'),
            tool('elevation', 'Elevation', 'elevationView'),
          ],
        },
        {
          id: 'switch',
          label: 'Switch',
          commands: [
            mode('plan', 'Plan', 'planView'),
            mode('3d', '3D', 'orbitView'),
            mode('sheet', 'Sheet', 'sheet'),
            mode('schedule', 'Schedule', 'schedule'),
          ],
        },
        {
          id: 'graphics',
          label: 'Graphics',
          commands: [action('visibility-graphics', 'VV/VG', 'layerOn')],
          flyoutCommands: [
            action('command-palette', 'More View Commands', 'commandPalette', 'view-more'),
            action('settings', 'Graphic Display Options', 'settings', 'view-gdo'),
          ],
        },
      ],
    },
    {
      id: 'manage',
      label: 'Manage',
      panels: [
        {
          id: 'project',
          label: 'Project',
          commands: [
            action('project-menu', 'Project', 'settings'),
            action('family-library', 'Load Family', 'family'),
          ],
        },
        {
          id: 'tools',
          label: 'Tools',
          commands: [
            action('command-palette', 'Commands', 'commandPalette'),
            action('settings', 'Help', 'settings'),
          ],
        },
      ],
    },
    {
      id: 'add-ins',
      label: 'Add-Ins',
      panels: [
        {
          id: 'automation',
          label: 'Automation',
          commands: [
            action('command-palette', 'Commands', 'commandPalette'),
            action('settings', 'Add-In Settings', 'settings'),
          ],
        },
      ],
    },
  ];

  if (selectedElementKind) {
    tabs.push({
      id: 'modify',
      label: `Modify | ${formatKind(selectedElementKind)}`,
      contextual: true,
      panels: [
        {
          id: 'selection',
          label: 'Selection',
          commands: [
            tool('select', 'Select', 'select'),
            tool('move', 'Move', 'move'),
            tool('copy', 'Copy', 'copy'),
          ],
        },
        {
          id: 'edit',
          label: 'Edit',
          commands: [
            tool('rotate', 'Rotate', 'rotate'),
            tool('mirror', 'Mirror', 'mirror'),
            tool('align', 'Align', 'align'),
            tool('trim-extend', 'Trim/Extend', 'trim'),
          ],
        },
      ],
    });
  }

  return tabs;
}

function collectTabCommands(tab: RibbonTab): RibbonCommand[] {
  const byKey = new Map<string, RibbonCommand>();
  for (const panel of tab.panels) {
    for (const command of [...panel.commands, ...(panel.flyoutCommands ?? [])]) {
      byKey.set(commandKey(command), command);
    }
  }
  return [...byKey.values()];
}

function commandKey(command: RibbonCommand): string {
  return `${command.type}:${command.id}:${command.testId ?? ''}`;
}

function readHiddenRibbonCommandKeys(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(RIBBON_HIDDEN_COMMANDS_STORAGE_KEY) ?? '[]',
    );
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

function writeHiddenRibbonCommandKeys(keys: string[]): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(RIBBON_HIDDEN_COMMANDS_STORAGE_KEY, JSON.stringify(keys.sort()));
}

function tool(id: ToolId, label: string, icon: IconName, testId?: string): RibbonCommand {
  return { type: 'tool', id, label, icon, testId };
}

function mode(id: WorkspaceMode, label: string, icon: IconName, testId?: string): RibbonCommand {
  return { type: 'mode', id, label, icon, testId };
}

function action(id: RibbonActionId, label: string, icon: IconName, testId?: string): RibbonCommand {
  return { type: 'action', id, label, icon, testId };
}

function formatKind(kind: string): string {
  return kind
    .split(/[_-]/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}
