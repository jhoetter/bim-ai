import fuzzysort from 'fuzzysort';

export type PaletteCategory = 'command' | 'navigate' | 'select';

export type PaletteEntry = {
  id: string;
  label: string;
  keywords?: string[];
  shortcut?: string;
  category: PaletteCategory;
  invoke: (context: PaletteContext) => void;
  isAvailable?: (context: PaletteContext) => boolean;
};

export type PaletteContext = {
  selectedElementIds: string[];
  activeViewId: string | null;
  /** Active workspace mode, if the host shell knows it. */
  activeMode?: string;
  /** Navigate through the same tab/mode path as the main workspace chrome. */
  navigateMode?: (mode: 'plan' | '3d' | 'section' | 'sheet' | 'schedule' | 'agent') => void;
  /** Start a plan-canvas tool, switching to a valid tool surface if needed. */
  startPlanTool?: (toolId: string) => void;
  /** Set the app theme while keeping host UI state in sync. */
  setTheme?: (theme: 'light' | 'dark') => void;
  /** Toggle the current app theme while keeping host UI state in sync. */
  toggleTheme?: () => void;
  /** Callback to open a model element (plan view, sheet, schedule, etc.) as a tab. */
  openElement?: (id: string) => void;
  /** Dynamic navigable views/sheets/schedules to surface in the palette. */
  views?: Array<{ id: string; label: string; keywords: string }>;
};

const _registry: PaletteEntry[] = [];

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
  const available = _registry.filter((e) => !e.isAvailable || e.isAvailable(context));

  const viewEntries: PaletteEntry[] = (context.views ?? []).map((v) => ({
    id: `view.${v.id}`,
    label: v.label,
    keywords: [v.keywords],
    category: 'navigate' as const,
    invoke: (ctx) => ctx.openElement?.(v.id),
  }));

  const all = [...available, ...viewEntries];

  if (!input.trim()) {
    return [...all].sort((a, b) => (recency[b.id] ?? 0) - (recency[a.id] ?? 0));
  }

  const targets = all.map((e) => ({
    entry: e,
    searchable: [e.label, ...(e.keywords ?? [])].join(' '),
  }));

  const results = fuzzysort.go(input, targets, {
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
