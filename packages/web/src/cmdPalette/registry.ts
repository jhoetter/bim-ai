import fuzzysort from 'fuzzysort';

import {
  commandModeBadge,
  evaluateCommandInMode,
  type CapabilityViewMode,
  type CommandAvailability,
} from '../workspace/commandCapabilities';

export type PaletteCategory = 'command' | 'navigate' | 'select';
export type PaletteSourceKind = 'command' | 'tool' | 'view' | 'element' | 'setting' | 'agent';

export type PaletteEntry = {
  id: string;
  label: string;
  keywords?: string[];
  shortcut?: string;
  category: PaletteCategory;
  invoke: (context: PaletteContext) => void;
  isAvailable?: (context: PaletteContext) => boolean;
  availability?: CommandAvailability;
  badge?: string;
  disabledReason?: string;
  bridged?: boolean;
  sourceKind?: PaletteSourceKind;
};

export type PaletteContext = {
  selectedElementIds: string[];
  activeViewId: string | null;
  /** Active workspace mode, if the host shell knows it. */
  activeMode?: CapabilityViewMode;
  /** Navigate through the same tab/mode path as the main workspace chrome. */
  navigateMode?: (
    mode: 'plan' | '3d' | 'plan-3d' | 'section' | 'sheet' | 'schedule' | 'agent' | 'concept',
  ) => void;
  /** Start a plan-canvas tool, switching to a valid tool surface if needed. */
  startPlanTool?: (toolId: string) => void;
  /** Set the app theme while keeping host UI state in sync. */
  setTheme?: (theme: 'light' | 'dark') => void;
  /** Toggle the current app theme while keeping host UI state in sync. */
  toggleTheme?: () => void;
  /** Set the current UI language while keeping host i18n state in sync. */
  setLanguage?: (language: 'en' | 'de') => void;
  /** Callback to open a model element (plan view, sheet, schedule, etc.) as a tab. */
  openElement?: (id: string) => void;
  /** Dispatches semantic model commands from command-palette actions. */
  dispatchCommand?: (cmd: Record<string, unknown>) => void;
  openProjectMenu?: () => void;
  saveSnapshot?: () => void;
  openRestoreSnapshot?: () => void;
  sharePresentation?: () => void;
  hasPresentationPages?: boolean;
  openFamilyLibrary?: () => void;
  openKeyboardShortcuts?: () => void;
  openPlanVisibilityGraphics?: () => void;
  open3dViewControls?: () => void;
  openActiveVisibilityControls?: () => void;
  closeInactiveViews?: () => void;
  toggleLeftRail?: () => void;
  toggleRightRail?: () => void;
  /** Dynamic navigable views/sheets/schedules to surface in the palette. */
  views?: Array<{ id: string; label: string; keywords: string }>;
};

const _registry: PaletteEntry[] = [];

type ParsedPaletteInput = {
  needle: string;
  sourceKind: PaletteSourceKind | null;
};

const PREFIX_SOURCE_KIND: Record<string, PaletteSourceKind> = {
  '>': 'tool',
  '@': 'view',
  ':': 'setting',
};

function parsePaletteInput(input: string): ParsedPaletteInput {
  const trimmed = input.trim();
  const sourceKind = trimmed ? (PREFIX_SOURCE_KIND[trimmed[0]!] ?? null) : null;
  return {
    needle: sourceKind ? trimmed.slice(1).trim() : input,
    sourceKind,
  };
}

function inferredSourceKind(entry: PaletteEntry): PaletteSourceKind {
  if (entry.sourceKind) return entry.sourceKind;
  if (entry.id.startsWith('tool.')) return 'tool';
  if (entry.id.startsWith('navigate.') || entry.id.startsWith('view.')) return 'view';
  if (entry.id.startsWith('settings.') || entry.id.startsWith('theme.')) return 'setting';
  if (
    entry.id.startsWith('shell.') ||
    entry.id.startsWith('project.') ||
    entry.id.startsWith('library.') ||
    entry.id.startsWith('help.') ||
    entry.id.startsWith('tabs.') ||
    entry.id.startsWith('visibility.')
  ) {
    return 'setting';
  }
  if (entry.category === 'select') return 'element';
  return 'command';
}

function matchesSourceKind(entry: PaletteEntry, sourceKind: PaletteSourceKind | null): boolean {
  if (!sourceKind) return true;
  return inferredSourceKind(entry) === sourceKind;
}

export function registerCommand(entry: PaletteEntry): void {
  _registry.push(entry);
}

/** Exposed only for tests — do not call in production code. */
export function _clearRegistry(): void {
  _registry.length = 0;
}

export function getRegistry(): readonly PaletteEntry[] {
  return _registry;
}

export function queryPalette(
  input: string,
  context: PaletteContext,
  recency: Record<string, number>,
): PaletteEntry[] {
  const parsed = parsePaletteInput(input);
  const activeMode = context.activeMode;
  const resolvedRegistry = _registry
    .map((entry): PaletteEntry | null => {
      const availability = activeMode ? evaluateCommandInMode(entry.id, activeMode) : null;
      const locallyUnavailable = entry.isAvailable ? !entry.isAvailable(context) : false;
      if (availability) {
        return {
          ...entry,
          availability,
          badge: commandModeBadge(availability),
          disabledReason:
            availability.state === 'disabled'
              ? availability.reason
              : locallyUnavailable
                ? 'Requires the right selection or view context.'
                : undefined,
          bridged: availability.state === 'bridge',
        };
      }
      if (entry.isAvailable && !entry.isAvailable(context)) return null;
      return entry;
    })
    .filter((entry): entry is PaletteEntry => Boolean(entry));

  const viewEntries: PaletteEntry[] = (context.views ?? []).map((v) => ({
    id: `view.${v.id}`,
    label: v.label,
    keywords: [v.keywords],
    category: 'navigate' as const,
    sourceKind: 'view' as const,
    badge: 'Open View',
    invoke: (ctx) => ctx.openElement?.(v.id),
  }));

  const all = [...resolvedRegistry, ...viewEntries].filter((entry) =>
    matchesSourceKind(entry, parsed.sourceKind),
  );

  if (!parsed.needle.trim()) {
    return [...all].sort((a, b) => (recency[b.id] ?? 0) - (recency[a.id] ?? 0));
  }

  const targets = all.map((e) => ({
    entry: e,
    searchable: [e.label, ...(e.keywords ?? [])].join(' '),
  }));

  const results = fuzzysort.go(parsed.needle, targets, {
    key: 'searchable',
    threshold: -10000,
    all: false,
  });

  const scored = Array.from(results).map((r) => ({
    entry: r.obj.entry,
    score: r.score + (recency[r.obj.entry.id] ?? 0),
  }));
  scored.sort((a, b) => b.score - a.score);

  return scored.map((s) => s.entry);
}
