import { useMemo, useState, type JSX } from 'react';

import { listMaterials, type MaterialPbrSpec } from '../viewport/materials';

function materialMatches(material: MaterialPbrSpec, query: string, category: string): boolean {
  const q = query.trim().toLowerCase();
  const categoryOk = !category || material.category === category;
  if (!categoryOk) return false;
  if (!q) return true;
  return (
    material.displayName.toLowerCase().includes(q) ||
    material.key.toLowerCase().includes(q) ||
    material.category.toLowerCase().includes(q)
  );
}

export type MaterialBrowserDialogProps = {
  title?: string;
  actionLabel?: string;
  currentKey?: string | null;
  onAssign: (materialKey: string) => void;
  onClose: () => void;
};

export function MaterialBrowserDialog({
  title = 'Material Browser',
  actionLabel = 'Assign',
  currentKey,
  onAssign,
  onClose,
}: MaterialBrowserDialogProps): JSX.Element {
  const materials = useMemo(() => listMaterials(), []);
  const categories = useMemo(
    () => Array.from(new Set(materials.map((material) => material.category))).sort(),
    [materials],
  );
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [activeTab, setActiveTab] = useState<'appearance' | 'graphics' | 'physical' | 'thermal'>(
    'appearance',
  );
  const filtered = materials.filter((material) => materialMatches(material, query, category));

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
    >
      <div className="max-h-[80vh] w-full max-w-3xl overflow-hidden rounded border border-border bg-surface shadow-lg">
        <header className="flex items-center gap-2 border-b border-border px-3 py-2">
          <h2 className="text-sm font-semibold">{title}</h2>
          <button type="button" className="ml-auto text-xs underline" onClick={onClose}>
            Close
          </button>
        </header>
        <div className="flex flex-wrap gap-2 border-b border-border p-3 text-xs">
          {(['appearance', 'graphics', 'physical', 'thermal'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              aria-pressed={activeTab === tab}
              disabled={tab === 'physical' || tab === 'thermal'}
              className={
                activeTab === tab
                  ? 'rounded border border-accent bg-accent/15 px-2 py-1'
                  : 'rounded border border-border px-2 py-1 disabled:opacity-40'
              }
              onClick={() => setActiveTab(tab)}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
          <input
            aria-label="Search materials"
            className="ml-auto min-w-48 rounded border border-border px-2 py-1"
            value={query}
            placeholder="Search"
            onChange={(e) => setQuery(e.target.value)}
          />
          <select
            aria-label="Material category"
            className="rounded border border-border px-2 py-1"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="">All categories</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>
        <div className="max-h-[56vh] overflow-y-auto p-3">
          <ul className="grid gap-2 sm:grid-cols-2">
            {filtered.map((material) => (
              <li
                key={material.key}
                className="flex items-center gap-3 rounded border border-border p-2"
                data-testid={`material-row-${material.key}`}
              >
                <span
                  className="h-8 w-8 shrink-0 rounded border border-border"
                  style={{ backgroundColor: material.baseColor }}
                  aria-hidden="true"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{material.displayName}</span>
                  <span className="block truncate text-[10px] text-muted">
                    {material.category} · R{material.roughness.toFixed(2)} · M
                    {material.metalness.toFixed(2)}
                  </span>
                  <span className="block truncate font-mono text-[10px] text-muted">
                    {material.key}
                  </span>
                </span>
                <button
                  type="button"
                  data-testid={`material-assign-${material.key}`}
                  className="rounded border border-border px-2 py-1 text-xs hover:bg-surface-strong"
                  disabled={currentKey === material.key}
                  onClick={() => onAssign(material.key)}
                >
                  {currentKey === material.key ? 'Current' : actionLabel}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
