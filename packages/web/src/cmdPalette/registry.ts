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

  if (!input.trim()) {
    return [...available].sort((a, b) => (recency[b.id] ?? 0) - (recency[a.id] ?? 0));
  }

  const targets = available.map((e) => ({
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
