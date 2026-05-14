import { useState, type JSX } from 'react';
import type { Element } from '@bim-ai/core';

import {
  createProjectMaterial,
  DEFAULT_PROJECT_MATERIAL_COLOR,
  listMaterials,
  renameMaterial,
  updateMaterialDefinition,
  type MaterialCategoryKind,
  type MaterialPbrSpec,
} from '../viewport/materials';

type MaterialTab = 'appearance' | 'graphics' | 'physical' | 'thermal';

const MATERIAL_TABS: MaterialTab[] = ['appearance', 'graphics', 'physical', 'thermal'];

function materialMatches(material: MaterialPbrSpec, query: string, category: string): boolean {
  const q = query.trim().toLowerCase();
  const categoryOk = !category || material.category === category;
  if (!categoryOk) return false;
  if (!q) return true;
  return (
    material.displayName.toLowerCase().includes(q) ||
    material.key.toLowerCase().includes(q) ||
    material.category.toLowerCase().includes(q) ||
    Boolean(material.textureMapUrl?.toLowerCase().includes(q)) ||
    Boolean(material.bumpMapUrl?.toLowerCase().includes(q))
  );
}

function parseNumber(value: string, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export type MaterialBrowserDialogProps = {
  title?: string;
  actionLabel?: string;
  currentKey?: string | null;
  mode?: 'material' | 'appearanceAsset';
  elementsById?: Record<string, Element>;
  onAssign: (materialKey: string) => void;
  onClose: () => void;
};

export function MaterialBrowserDialog({
  title = 'Material Browser',
  actionLabel = 'Assign',
  currentKey,
  mode = 'material',
  elementsById,
  onAssign,
  onClose,
}: MaterialBrowserDialogProps): JSX.Element {
  const [, setRevision] = useState(0);
  const materials = listMaterials(elementsById);
  const categories = Array.from(new Set(materials.map((material) => material.category))).sort();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [activeTab, setActiveTab] = useState<MaterialTab>('appearance');
  const [selectedKey, setSelectedKey] = useState<string | null>(currentKey ?? null);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('New Material');
  const [newColor, setNewColor] = useState(DEFAULT_PROJECT_MATERIAL_COLOR);
  const [newCategory, setNewCategory] = useState<MaterialCategoryKind>('placeholder');
  const [renameKey, setRenameKey] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const filtered = materials.filter((material) => materialMatches(material, query, category));
  const filtering = Boolean(query.trim() || category);
  const selected =
    filtered.find((material) => material.key === selectedKey) ??
    (!filtering ? materials.find((material) => material.key === currentKey) : null) ??
    filtered[0] ??
    materials[0] ??
    null;

  function refresh(nextSelectedKey?: string) {
    if (nextSelectedKey) setSelectedKey(nextSelectedKey);
    setRevision((prev) => prev + 1);
  }

  function createMaterial() {
    const material = createProjectMaterial({
      displayName: newName,
      baseColor: newColor,
      category: newCategory,
      source: 'family',
    });
    setShowCreate(false);
    setQuery('');
    refresh(material.key);
  }

  function saveRename(material: MaterialPbrSpec) {
    const renamed = renameMaterial(material.key, renameValue);
    if (!renamed) return;
    setRenameKey(null);
    refresh(renamed.key);
  }

  function patchSelected(patch: Parameters<typeof updateMaterialDefinition>[1]) {
    if (!selected) return;
    updateMaterialDefinition(selected.key, patch);
    refresh(selected.key);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
    >
      <div className="max-h-[86vh] w-full max-w-5xl overflow-hidden rounded border border-border bg-surface shadow-lg">
        <header className="flex items-center gap-2 border-b border-border px-3 py-2">
          <h2 className="text-sm font-semibold">{title}</h2>
          <button
            type="button"
            className="ml-auto rounded border border-border px-2 py-1 text-xs hover:bg-surface-strong"
            onClick={() => setShowCreate((value) => !value)}
          >
            Create material
          </button>
          <button type="button" className="text-xs underline" onClick={onClose}>
            Close
          </button>
        </header>
        <div className="flex flex-wrap gap-2 border-b border-border p-3 text-xs">
          {MATERIAL_TABS.map((tab) => (
            <button
              key={tab}
              type="button"
              aria-pressed={activeTab === tab}
              className={
                activeTab === tab
                  ? 'rounded border border-accent bg-accent/15 px-2 py-1'
                  : 'rounded border border-border px-2 py-1 hover:bg-surface-strong'
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
        {showCreate ? (
          <div className="grid gap-2 border-b border-border p-3 text-xs sm:grid-cols-[1fr_auto_auto_auto]">
            <input
              aria-label="New material name"
              className="rounded border border-border px-2 py-1"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
            <select
              aria-label="New material category"
              className="rounded border border-border px-2 py-1"
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value as MaterialCategoryKind)}
            >
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
            <input
              aria-label="New material color"
              type="color"
              className="h-8 rounded border border-border"
              value={newColor}
              onChange={(e) => setNewColor(e.target.value)}
            />
            <button
              type="button"
              className="rounded border border-border px-2 py-1 hover:bg-surface-strong"
              onClick={createMaterial}
            >
              Create
            </button>
          </div>
        ) : null}
        <div className="grid max-h-[62vh] grid-cols-1 overflow-hidden md:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="overflow-y-auto p-3">
            <ul className="grid gap-2 sm:grid-cols-2">
              {filtered.map((material) => (
                <li
                  key={material.key}
                  className={
                    selected?.key === material.key
                      ? 'flex items-center gap-3 rounded border border-accent bg-accent/10 p-2'
                      : 'flex items-center gap-3 rounded border border-border p-2'
                  }
                  data-testid={`material-row-${material.key}`}
                >
                  <button
                    type="button"
                    aria-label={`Select ${material.displayName}`}
                    className="h-8 w-8 shrink-0 rounded border border-border"
                    style={{ backgroundColor: material.baseColor }}
                    onClick={() => setSelectedKey(material.key)}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                      {material.displayName}
                    </span>
                    <span className="block truncate text-[10px] text-muted">
                      {material.category} · R{material.roughness.toFixed(2)} · M
                      {material.metalness.toFixed(2)} · Ref
                      {(material.reflectance ?? 0).toFixed(2)}
                    </span>
                    <span className="block truncate font-mono text-[10px] text-muted">
                      {material.key}
                    </span>
                    {mode === 'appearanceAsset' ? (
                      <span className="block truncate text-[10px] text-muted">
                        texture {material.textureMapUrl ?? 'none'} · bump{' '}
                        {material.bumpMapUrl ?? material.normalMapUrl ?? 'none'}
                      </span>
                    ) : null}
                    {renameKey === material.key ? (
                      <span className="mt-1 flex gap-1">
                        <input
                          aria-label={`Rename ${material.displayName}`}
                          className="min-w-0 flex-1 rounded border border-border px-1 py-0.5 text-xs"
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                        />
                        <button
                          type="button"
                          className="rounded border border-border px-1 text-xs"
                          onClick={() => saveRename(material)}
                        >
                          Save
                        </button>
                      </span>
                    ) : null}
                  </span>
                  <span className="flex shrink-0 flex-col gap-1">
                    <button
                      type="button"
                      data-testid={`material-assign-${material.key}`}
                      className="rounded border border-border px-2 py-1 text-xs hover:bg-surface-strong"
                      disabled={currentKey === material.key}
                      onClick={() => onAssign(material.key)}
                    >
                      {currentKey === material.key ? 'Current' : actionLabel}
                    </button>
                    <button
                      type="button"
                      data-testid={`material-rename-${material.key}`}
                      className="rounded border border-border px-2 py-1 text-xs hover:bg-surface-strong"
                      onClick={() => {
                        setSelectedKey(material.key);
                        setRenameKey(material.key);
                        setRenameValue(material.displayName);
                      }}
                    >
                      Rename
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <MaterialMetadataPanel
            material={selected}
            activeTab={activeTab}
            mode={mode}
            onPatch={patchSelected}
          />
        </div>
      </div>
    </div>
  );
}

function MaterialMetadataPanel({
  material,
  activeTab,
  mode,
  onPatch,
}: {
  material: MaterialPbrSpec | null;
  activeTab: MaterialTab;
  mode: 'material' | 'appearanceAsset';
  onPatch: (patch: Parameters<typeof updateMaterialDefinition>[1]) => void;
}): JSX.Element {
  if (!material) {
    return (
      <aside className="border-l border-border p-3 text-xs text-muted">No material selected</aside>
    );
  }

  return (
    <aside className="overflow-y-auto border-l border-border p-3 text-xs">
      <section
        aria-label={`${activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} material metadata`}
      >
        <div className="mb-2 font-mono text-[10px] text-muted">{material.key}</div>
        {activeTab === 'appearance' ? (
          <div className="space-y-2">
            <label className="grid gap-1">
              <span>Appearance color</span>
              <input
                aria-label="Appearance color"
                type="color"
                value={material.baseColor}
                onChange={(e) => onPatch({ baseColor: e.target.value })}
              />
            </label>
            <label className="grid gap-1">
              <span>Roughness</span>
              <input
                aria-label="Roughness"
                type="number"
                min={0}
                max={1}
                step={0.01}
                value={material.roughness}
                onChange={(e) =>
                  onPatch({ roughness: parseNumber(e.target.value, material.roughness) })
                }
              />
            </label>
            <label className="grid gap-1">
              <span>Metalness</span>
              <input
                aria-label="Metalness"
                type="number"
                min={0}
                max={1}
                step={0.01}
                value={material.metalness}
                onChange={(e) =>
                  onPatch({ metalness: parseNumber(e.target.value, material.metalness) })
                }
              />
            </label>
            {mode === 'appearanceAsset' ? (
              <>
                <label className="grid gap-1">
                  <span>Texture map metadata</span>
                  <input
                    aria-label="Texture map metadata"
                    value={material.textureMapUrl ?? ''}
                    onChange={(e) => onPatch({ textureMapUrl: e.target.value })}
                  />
                </label>
                <label className="grid gap-1">
                  <span>Bump map metadata</span>
                  <input
                    aria-label="Bump map metadata"
                    value={material.bumpMapUrl ?? material.normalMapUrl ?? ''}
                    onChange={(e) => onPatch({ bumpMapUrl: e.target.value })}
                  />
                </label>
                <label className="grid gap-1">
                  <span>Reflectance</span>
                  <input
                    aria-label="Reflectance"
                    type="number"
                    min={0}
                    max={1}
                    step={0.01}
                    value={material.reflectance ?? 0}
                    onChange={(e) =>
                      onPatch({
                        reflectance: parseNumber(e.target.value, material.reflectance ?? 0),
                      })
                    }
                  />
                </label>
              </>
            ) : null}
          </div>
        ) : null}
        {activeTab === 'graphics' ? (
          <div className="space-y-2">
            <label className="flex items-center gap-2">
              <input
                aria-label="Use render appearance"
                type="checkbox"
                checked={material.graphics?.useRenderAppearance ?? true}
                onChange={(e) =>
                  onPatch({
                    graphics: {
                      ...material.graphics,
                      useRenderAppearance: e.target.checked,
                    },
                  })
                }
              />
              <span>Use render appearance</span>
            </label>
            <label className="grid gap-1">
              <span>Surface pattern</span>
              <input
                aria-label="Surface pattern"
                value={material.graphics?.surfacePattern ?? ''}
                onChange={(e) =>
                  onPatch({ graphics: { ...material.graphics, surfacePattern: e.target.value } })
                }
              />
            </label>
            <label className="grid gap-1">
              <span>Cut pattern</span>
              <input
                aria-label="Cut pattern"
                value={material.graphics?.cutPattern ?? ''}
                onChange={(e) =>
                  onPatch({ graphics: { ...material.graphics, cutPattern: e.target.value } })
                }
              />
            </label>
          </div>
        ) : null}
        {activeTab === 'physical' ? (
          <div className="space-y-2">
            <label className="grid gap-1">
              <span>Material class</span>
              <input
                aria-label="Material class"
                value={material.physical?.materialClass ?? ''}
                onChange={(e) =>
                  onPatch({ physical: { ...material.physical, materialClass: e.target.value } })
                }
              />
            </label>
            <label className="grid gap-1">
              <span>Density kg/m3</span>
              <input
                aria-label="Density kg/m3"
                type="number"
                value={material.physical?.densityKgPerM3 ?? 0}
                onChange={(e) =>
                  onPatch({
                    physical: {
                      ...material.physical,
                      densityKgPerM3: parseNumber(
                        e.target.value,
                        material.physical?.densityKgPerM3 ?? 0,
                      ),
                    },
                  })
                }
              />
            </label>
            <label className="grid gap-1">
              <span>Compressive strength MPa</span>
              <input
                aria-label="Compressive strength MPa"
                type="number"
                value={material.physical?.compressiveStrengthMpa ?? 0}
                onChange={(e) =>
                  onPatch({
                    physical: {
                      ...material.physical,
                      compressiveStrengthMpa: parseNumber(
                        e.target.value,
                        material.physical?.compressiveStrengthMpa ?? 0,
                      ),
                    },
                  })
                }
              />
            </label>
          </div>
        ) : null}
        {activeTab === 'thermal' ? (
          <div className="space-y-2">
            <label className="grid gap-1">
              <span>Conductivity W/mK</span>
              <input
                aria-label="Conductivity W/mK"
                type="number"
                step={0.01}
                value={material.thermal?.conductivityWPerMK ?? 0}
                onChange={(e) =>
                  onPatch({
                    thermal: {
                      ...material.thermal,
                      conductivityWPerMK: parseNumber(
                        e.target.value,
                        material.thermal?.conductivityWPerMK ?? 0,
                      ),
                    },
                  })
                }
              />
            </label>
            <label className="grid gap-1">
              <span>Specific heat J/kgK</span>
              <input
                aria-label="Specific heat J/kgK"
                type="number"
                value={material.thermal?.specificHeatJPerKgK ?? 0}
                onChange={(e) =>
                  onPatch({
                    thermal: {
                      ...material.thermal,
                      specificHeatJPerKgK: parseNumber(
                        e.target.value,
                        material.thermal?.specificHeatJPerKgK ?? 0,
                      ),
                    },
                  })
                }
              />
            </label>
            <label className="grid gap-1">
              <span>Thermal resistance m2K/W</span>
              <input
                aria-label="Thermal resistance m2K/W"
                type="number"
                step={0.01}
                value={material.thermal?.thermalResistanceM2KPerW ?? 0}
                onChange={(e) =>
                  onPatch({
                    thermal: {
                      ...material.thermal,
                      thermalResistanceM2KPerW: parseNumber(
                        e.target.value,
                        material.thermal?.thermalResistanceM2KPerW ?? 0,
                      ),
                    },
                  })
                }
              />
            </label>
          </div>
        ) : null}
      </section>
    </aside>
  );
}
