import { type JSX, useEffect, useRef, useState } from 'react';
import { ICON_SIZE, Icons } from '@bim-ai/ui';
import {
  coerceCheckpointRetentionLimit,
  MAX_CHECKPOINT_RETENTION_LIMIT,
  MIN_CHECKPOINT_RETENTION_LIMIT,
} from '../../state/backupRetention';
import type { DxfImportOptions } from '../../lib/api';

const DXF_DEFAULT_CUSTOM_COLOR = ['#', '7f', '7f', '7f'].join('');

/**
 * Project-name dropdown — spec §11.1, T-03.
 *
 * Anchored under the project-name pill in TopBar. Items:
 *   - Recent projects (last 5, from localStorage)
 *   - Insert seed house (re-runs the bootstrap)
 *   - Save snapshot to disk (downloads the current store as JSON)
 *   - Restore snapshot from disk (file picker → onRestore)
 *   - New (clear) — wipes the current store
 *
 * The component is presentational: callers wire each item to a real
 * handler. Click-outside + Escape close the menu.
 */

export interface ProjectMenuItemRecent {
  id: string;
  label: string;
}

export interface ProjectMenuSeedModel {
  id: string;
  label: string;
  slug: string;
  revision: number;
}

export interface ProjectMenuProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Anchor element for positioning. */
  anchorRef: React.RefObject<HTMLElement | null>;
  recent?: ProjectMenuItemRecent[];
  onPickRecent?: (id: string) => void;
  seedModels?: ProjectMenuSeedModel[];
  activeSeedModelId?: string | null;
  onPickSeedModel?: (id: string) => void;
  onInsertSeed?: () => void;
  onSaveSnapshot?: () => void;
  modelId?: string | null;
  onOpenMilestone?: () => void;
  onOpenMaterialBrowser?: () => void;
  onOpenAppearanceAssetBrowser?: () => void;
  onOpenProjectSetup?: () => void;
  saveAsMaximumBackups?: number;
  onSaveAsMaximumBackupsChange?: (maximumBackups: number) => void;
  onRestoreSnapshot?: (file: File) => void;
  onNewClear?: () => void;
  /** Replay the onboarding tour from the beginning (spec §24). */
  onReplayTour?: () => void;
  /** F4: open the Project Units dialog. */
  onOpenProjectUnits?: () => void;
  /** F1: open the Phase Manager dialog. */
  onManagePhases?: () => void;
  /** F1 (WP-F): open the Global Parameters dialog. */
  onOpenGlobalParams?: () => void;
  /** F3: open the Project Information dialog. */
  onOpenProjectInfo?: () => void;
  /** FED-01: open the Manage Links dialog (Insert → Link Model). */
  onManageLinks?: () => void;
  /** FED-04: import an IFC file as a shadow-model link. */
  onLinkIfc?: (file: File) => void;
  /** FED-04: import a DXF site plan as a `link_dxf` underlay element. */
  onLinkDxf?: (file: File, options: DxfImportOptions) => void;
  /** E1: trigger IFC 2x3 export and download. */
  onExportIfc?: () => void;
  /** E2: trigger DXF export for a given level and units. */
  onExportDxf?: (opts: { levelId?: string; units: 'mm' | 'm' }) => void;
  /** E2: levels available for DXF export selection. */
  exportLevels?: { id: string; name: string }[];
  /** §12.4.3: trigger DWG export (DXF with AC1015 header, .dwg extension). */
  onExportDwg?: () => void;
  /** Optional project name used as default download filename. */
  projectName?: string;
}

export function ProjectMenu({
  open,
  onOpenChange,
  anchorRef,
  recent,
  onPickRecent,
  seedModels,
  activeSeedModelId,
  onPickSeedModel,
  onInsertSeed,
  onSaveSnapshot,
  modelId,
  onOpenMilestone,
  onOpenMaterialBrowser,
  onOpenAppearanceAssetBrowser,
  onOpenProjectSetup,
  saveAsMaximumBackups,
  onSaveAsMaximumBackupsChange,
  onRestoreSnapshot,
  onNewClear,
  onReplayTour,
  onOpenProjectUnits,
  onManagePhases,
  onOpenGlobalParams,
  onOpenProjectInfo,
  onManageLinks,
  onLinkIfc,
  onLinkDxf,
  onExportIfc,
  onExportDxf,
  onExportDwg,
  exportLevels,
  projectName: _projectName,
}: ProjectMenuProps): JSX.Element | null {
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const ifcInputRef = useRef<HTMLInputElement | null>(null);
  const dxfInputRef = useRef<HTMLInputElement | null>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const [saveAsOptionsOpen, setSaveAsOptionsOpen] = useState(false);
  const [dxfOptionsOpen, setDxfOptionsOpen] = useState(false);
  const [dxfExportOpen, setDxfExportOpen] = useState(false);
  const [dxfExportLevelId, setDxfExportLevelId] = useState<string | undefined>(undefined);
  const [dxfExportUnits, setDxfExportUnits] = useState<'mm' | 'm'>('mm');
  const [dxfImportOptions, setDxfImportOptions] = useState<DxfImportOptions>({
    originAlignmentMode: 'origin_to_origin',
    unitOverride: 'source',
    colorMode: 'black_white',
    customColor: DXF_DEFAULT_CUSTOM_COLOR,
    overlayOpacity: 0.5,
  });
  const [maximumBackupsDraft, setMaximumBackupsDraft] = useState(
    String(coerceCheckpointRetentionLimit(saveAsMaximumBackups)),
  );

  // Position the popover under the anchor.
  useEffect(() => {
    if (!open) return;
    const anchor = anchorRef.current;
    if (!anchor) return;
    const rect = anchor.getBoundingClientRect();
    setPos({ left: rect.left, top: rect.bottom + 4 });
  }, [open, anchorRef]);

  useEffect(() => {
    if (!open) {
      setSaveAsOptionsOpen(false);
      return;
    }
    setMaximumBackupsDraft(String(coerceCheckpointRetentionLimit(saveAsMaximumBackups)));
  }, [open, saveAsMaximumBackups]);

  // Click-outside + Escape close.
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent): void => {
      const t = e.target as Node;
      if (popoverRef.current?.contains(t)) return;
      if (anchorRef.current?.contains(t)) return;
      onOpenChange(false);
    };
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onOpenChange(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onOpenChange, anchorRef]);

  // Auto-focus first enabled menu item on open.
  useEffect(() => {
    if (!pos) return;
    const first = popoverRef.current?.querySelector<HTMLElement>(
      '[role="menuitem"]:not([disabled])',
    );
    first?.focus();
  }, [pos]);

  if (!open || !pos) return null;

  return (
    <div
      ref={popoverRef}
      role="menu"
      aria-label="Project menu"
      data-testid="project-menu"
      style={{
        position: 'fixed',
        left: pos.left,
        top: pos.top,
        zIndex: 50,
        minWidth: 240,
      }}
      className="rounded-md border border-border bg-surface shadow-elev-3"
      onKeyDown={(e) => {
        const items = Array.from(
          popoverRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])') ??
            [],
        );
        const idx = items.indexOf(document.activeElement as HTMLElement);
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          items[(idx + 1) % items.length]?.focus();
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          items[(idx - 1 + items.length) % items.length]?.focus();
        }
      }}
    >
      {recent && recent.length > 0 ? (
        <>
          <div
            className="px-3 pb-1 pt-2 text-[10px] uppercase text-muted"
            style={{ letterSpacing: '0.06em' }}
          >
            Recent
          </div>
          <ul className="flex flex-col">
            {recent.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    onOpenChange(false);
                    onPickRecent?.(p.id);
                  }}
                  data-testid={`project-menu-recent-${p.id}`}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-foreground hover:bg-surface-strong"
                >
                  <Icons.evidence size={ICON_SIZE.chrome} aria-hidden="true" />
                  <span className="truncate">{p.label}</span>
                </button>
              </li>
            ))}
          </ul>
          <div className="my-1 border-t border-border" />
        </>
      ) : null}
      {seedModels && seedModels.length > 0 ? (
        <>
          <div
            className="px-3 pb-1 pt-2 text-[10px] uppercase text-muted"
            style={{ letterSpacing: '0.06em' }}
          >
            Seeded projects
          </div>
          <ul className="flex flex-col">
            {seedModels.map((model) => (
              <li key={model.id}>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    onOpenChange(false);
                    onPickSeedModel?.(model.id);
                  }}
                  data-testid={`project-menu-seed-${model.slug}`}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-foreground hover:bg-surface-strong"
                >
                  <Icons.evidence size={ICON_SIZE.chrome} aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate">{model.label}</span>
                  {model.id === activeSeedModelId ? (
                    <span className="text-[10px] text-muted">active</span>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
          <div className="my-1 border-t border-border" />
        </>
      ) : null}
      <ul className="flex flex-col">
        <MenuItem
          label="Insert seed house"
          icon="agent"
          testId="project-menu-insert-seed"
          onClick={() => {
            onOpenChange(false);
            onInsertSeed?.();
          }}
        />
        <MenuItem
          label="Save snapshot to disk"
          icon="evidence"
          testId="project-menu-save-snapshot"
          onClick={() => {
            onOpenChange(false);
            onSaveSnapshot?.();
          }}
        />
        <MenuItem
          label="Save milestone…"
          icon="saveViewpoint"
          testId="project-menu-save-milestone"
          onClick={() => {
            onOpenChange(false);
            onOpenMilestone?.();
          }}
        />
        {modelId ? (
          <>
            <MenuLink
              label="Export → 3D print STL"
              icon="externalLink"
              testId="project-menu-export-stl"
              href={`/api/models/${encodeURIComponent(modelId)}/exports/model.stl`}
              download="model.stl"
              onClick={() => {
                onOpenChange(false);
              }}
            />
            <MenuLink
              label="Export → 3D print 3MF"
              icon="externalLink"
              testId="project-menu-export-3mf"
              href={`/api/models/${encodeURIComponent(modelId)}/exports/model.3mf`}
              download="model.3mf"
              onClick={() => {
                onOpenChange(false);
              }}
            />
          </>
        ) : null}
        {onExportIfc ? (
          <MenuItem
            label="Export → IFC 2x3…"
            icon="externalLink"
            testId="project-menu-export-ifc"
            onClick={() => {
              onOpenChange(false);
              onExportIfc();
            }}
          />
        ) : null}
        {onExportDxf ? (
          <>
            <MenuItem
              label="Export → DXF/DWG…"
              icon="externalLink"
              testId="project-menu-export-dxf"
              onClick={() => setDxfExportOpen((v) => !v)}
            />
            {dxfExportOpen ? (
              <li
                className="border-y border-border bg-surface-strong px-3 py-2"
                data-testid="project-menu-dxf-export-options"
              >
                <div className="grid grid-cols-1 gap-2 text-xs">
                  {exportLevels && exportLevels.length > 0 ? (
                    <label className="flex flex-col gap-1">
                      Level
                      <select
                        value={dxfExportLevelId ?? ''}
                        data-testid="project-menu-dxf-export-level"
                        onChange={(e) => setDxfExportLevelId(e.currentTarget.value || undefined)}
                        onKeyDown={(e) => e.stopPropagation()}
                        className="h-7 rounded border border-border bg-surface px-2 text-xs text-foreground"
                      >
                        <option value="">All levels</option>
                        {exportLevels.map((l) => (
                          <option key={l.id} value={l.id}>
                            {l.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}
                  <label className="flex flex-col gap-1">
                    Units
                    <select
                      value={dxfExportUnits}
                      data-testid="project-menu-dxf-export-units"
                      onChange={(e) => setDxfExportUnits(e.currentTarget.value as 'mm' | 'm')}
                      onKeyDown={(e) => e.stopPropagation()}
                      className="h-7 rounded border border-border bg-surface px-2 text-xs text-foreground"
                    >
                      <option value="mm">mm</option>
                      <option value="m">m</option>
                    </select>
                  </label>
                  <p className="text-[10px] text-muted">
                    DWG: open the DXF in any CAD tool (BricsCAD, Teigha) and save as DWG — the
                    geometry is identical.
                  </p>
                  <button
                    type="button"
                    role="menuitem"
                    data-testid="project-menu-dxf-export-submit"
                    onClick={() => {
                      onExportDxf({ levelId: dxfExportLevelId, units: dxfExportUnits });
                      setDxfExportOpen(false);
                      onOpenChange(false);
                    }}
                    className="mt-1 rounded border border-border px-2 py-1 text-xs text-foreground hover:bg-surface"
                  >
                    Export
                  </button>
                </div>
              </li>
            ) : null}
          </>
        ) : null}
        {onExportDwg ? (
          <MenuItem
            label="Export → DWG (R2000)…"
            icon="externalLink"
            testId="export-dwg-button"
            onClick={() => {
              onOpenChange(false);
              onExportDwg();
            }}
          />
        ) : null}
        {onOpenMaterialBrowser || onOpenAppearanceAssetBrowser ? (
          <>
            <div className="my-1 border-t border-border" />
            {onOpenMaterialBrowser ? (
              <MenuItem
                label="Resources → Materials…"
                icon="settings"
                testId="project-menu-open-material-browser"
                onClick={() => {
                  onOpenChange(false);
                  onOpenMaterialBrowser();
                }}
              />
            ) : null}
            {onOpenAppearanceAssetBrowser ? (
              <MenuItem
                label="Resources → Appearance Assets…"
                icon="settings"
                testId="project-menu-open-appearance-asset-browser"
                onClick={() => {
                  onOpenChange(false);
                  onOpenAppearanceAssetBrowser();
                }}
              />
            ) : null}
          </>
        ) : null}
        {onOpenProjectSetup ? (
          <MenuItem
            label="Project Setup..."
            icon="settings"
            testId="project-menu-open-project-setup"
            onClick={() => {
              onOpenChange(false);
              onOpenProjectSetup();
            }}
          />
        ) : null}
        {onOpenProjectUnits ? (
          <MenuItem
            label="Project Units..."
            icon="settings"
            testId="project-menu-open-project-units"
            onClick={() => {
              onOpenChange(false);
              onOpenProjectUnits();
            }}
          />
        ) : null}
        {onManagePhases ? (
          <MenuItem
            label="Manage Phases..."
            icon="settings"
            testId="project-menu-manage-phases"
            onClick={() => {
              onOpenChange(false);
              onManagePhases();
            }}
          />
        ) : null}
        {onOpenGlobalParams ? (
          <MenuItem
            label="Global Parameters..."
            icon="settings"
            testId="project-menu-global-params"
            onClick={() => {
              onOpenChange(false);
              onOpenGlobalParams();
            }}
          />
        ) : null}
        {onOpenProjectInfo ? (
          <MenuItem
            label="Project Information..."
            icon="settings"
            testId="project-menu-open-project-info"
            onClick={() => {
              onOpenChange(false);
              onOpenProjectInfo();
            }}
          />
        ) : null}
        <MenuItem
          label="Save As Options…"
          icon="settings"
          testId="project-menu-save-as-options"
          onClick={() => {
            setSaveAsOptionsOpen((value) => !value);
          }}
        />
        {saveAsOptionsOpen ? (
          <li className="border-y border-border bg-surface-strong px-3 py-2">
            <label className="flex flex-col gap-1 text-xs text-foreground">
              <span>Maximum backups</span>
              <input
                aria-label="Maximum backups"
                data-testid="project-menu-maximum-backups"
                type="number"
                min={MIN_CHECKPOINT_RETENTION_LIMIT}
                max={MAX_CHECKPOINT_RETENTION_LIMIT}
                step={1}
                value={maximumBackupsDraft}
                onChange={(e) => setMaximumBackupsDraft(e.currentTarget.value)}
                onKeyDown={(e) => {
                  e.stopPropagation();
                }}
                className="h-7 rounded border border-border bg-surface px-2 text-xs text-foreground"
              />
            </label>
            <div className="mt-2 flex items-center justify-between gap-2">
              <span className="text-[10px] text-muted">
                Applies to retained snapshots and rolling export slots.
              </span>
              <button
                type="button"
                role="menuitem"
                data-testid="project-menu-save-as-options-apply"
                className="rounded border border-border px-2 py-1 text-xs text-foreground hover:bg-surface"
                onClick={() => {
                  const next = coerceCheckpointRetentionLimit(maximumBackupsDraft);
                  setMaximumBackupsDraft(String(next));
                  onSaveAsMaximumBackupsChange?.(next);
                  setSaveAsOptionsOpen(false);
                }}
              >
                Apply
              </button>
            </div>
          </li>
        ) : null}
        <MenuItem
          label="Open snapshot from disk…"
          icon="externalLink"
          testId="project-menu-open-snapshot"
          onClick={() => fileInputRef.current?.click()}
        />
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          style={{ display: 'none' }}
          data-testid="project-menu-file-input"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f && onRestoreSnapshot) onRestoreSnapshot(f);
            onOpenChange(false);
            e.target.value = '';
          }}
        />
        {onManageLinks ? (
          <>
            <div className="my-1 border-t border-border" />
            <MenuItem
              label="Insert → Link Model…"
              icon="externalLink"
              testId="project-menu-manage-links"
              onClick={() => {
                onOpenChange(false);
                onManageLinks();
              }}
            />
          </>
        ) : null}
        {onLinkIfc ? (
          <>
            <MenuItem
              label="Insert → Link IFC…"
              icon="externalLink"
              testId="project-menu-link-ifc"
              onClick={() => {
                ifcInputRef.current?.click();
              }}
            />
            <input
              ref={ifcInputRef}
              type="file"
              accept=".ifc,application/x-step,application/octet-stream"
              style={{ display: 'none' }}
              data-testid="project-menu-ifc-input"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onLinkIfc(f);
                onOpenChange(false);
                e.target.value = '';
              }}
            />
            {onLinkDxf ? (
              <>
                <MenuItem
                  label="Insert → Link DXF…"
                  icon="externalLink"
                  testId="project-menu-link-dxf"
                  onClick={() => {
                    setDxfOptionsOpen((value) => !value);
                  }}
                />
                {dxfOptionsOpen ? (
                  <li
                    className="border-y border-border bg-surface-strong px-3 py-2"
                    data-testid="project-menu-dxf-options"
                  >
                    <div className="grid grid-cols-1 gap-2 text-xs">
                      <label className="flex flex-col gap-1">
                        Position
                        <select
                          value={dxfImportOptions.originAlignmentMode}
                          data-testid="project-menu-dxf-align"
                          onChange={(e) => {
                            const originAlignmentMode = e.currentTarget
                              .value as DxfImportOptions['originAlignmentMode'];
                            setDxfImportOptions((prev) => ({
                              ...prev,
                              originAlignmentMode,
                            }));
                          }}
                          onKeyDown={(e) => e.stopPropagation()}
                          className="h-7 rounded border border-border bg-surface px-2 text-xs text-foreground"
                        >
                          <option value="origin_to_origin">Origin to Origin</option>
                          <option value="project_origin">Project Base Point</option>
                          <option value="shared_coords">Shared Coordinates</option>
                        </select>
                      </label>
                      <label className="flex flex-col gap-1">
                        Units
                        <select
                          value={dxfImportOptions.unitOverride}
                          data-testid="project-menu-dxf-units"
                          onChange={(e) => {
                            const unitOverride = e.currentTarget
                              .value as DxfImportOptions['unitOverride'];
                            setDxfImportOptions((prev) => ({
                              ...prev,
                              unitOverride,
                            }));
                          }}
                          onKeyDown={(e) => e.stopPropagation()}
                          className="h-7 rounded border border-border bg-surface px-2 text-xs text-foreground"
                        >
                          <option value="source">Auto ($INSUNITS)</option>
                          <option value="unitless">Unitless</option>
                          <option value="millimeters">Millimeters</option>
                          <option value="centimeters">Centimeters</option>
                          <option value="meters">Meters</option>
                          <option value="inches">Inches</option>
                          <option value="feet">Feet</option>
                        </select>
                      </label>
                      <label className="flex flex-col gap-1">
                        Color
                        <select
                          value={dxfImportOptions.colorMode}
                          data-testid="project-menu-dxf-colormode"
                          onChange={(e) => {
                            const colorMode = e.currentTarget
                              .value as DxfImportOptions['colorMode'];
                            setDxfImportOptions((prev) => ({
                              ...prev,
                              colorMode,
                            }));
                          }}
                          onKeyDown={(e) => e.stopPropagation()}
                          className="h-7 rounded border border-border bg-surface px-2 text-xs text-foreground"
                        >
                          <option value="black_white">Black &amp; white</option>
                          <option value="native">Preserve original colors</option>
                          <option value="custom">Custom</option>
                        </select>
                      </label>
                      {dxfImportOptions.colorMode === 'custom' ? (
                        <label className="flex items-center justify-between gap-2">
                          <span>Custom color</span>
                          <input
                            type="color"
                            value={dxfImportOptions.customColor ?? DXF_DEFAULT_CUSTOM_COLOR}
                            data-testid="project-menu-dxf-color"
                            onChange={(e) => {
                              const customColor = e.currentTarget.value;
                              setDxfImportOptions((prev) => ({
                                ...prev,
                                customColor,
                              }));
                            }}
                            onKeyDown={(e) => e.stopPropagation()}
                            className="h-7 w-10 rounded border border-border bg-surface"
                          />
                        </label>
                      ) : null}
                      <label className="flex items-center gap-2">
                        <span>Opacity</span>
                        <input
                          type="range"
                          min={0}
                          max={100}
                          step={1}
                          value={Math.round((dxfImportOptions.overlayOpacity ?? 0.5) * 100)}
                          data-testid="project-menu-dxf-opacity"
                          onChange={(e) => {
                            const overlayOpacity = Number(e.currentTarget.value) / 100;
                            setDxfImportOptions((prev) => ({
                              ...prev,
                              overlayOpacity,
                            }));
                          }}
                          onKeyDown={(e) => e.stopPropagation()}
                          className="min-w-0 flex-1"
                        />
                        <span className="w-8 text-right font-mono text-[10px] text-muted">
                          {Math.round((dxfImportOptions.overlayOpacity ?? 0.5) * 100)}%
                        </span>
                      </label>
                      <button
                        type="button"
                        role="menuitem"
                        data-testid="project-menu-dxf-choose-file"
                        onClick={() => dxfInputRef.current?.click()}
                        className="mt-1 rounded border border-border px-2 py-1 text-xs text-foreground hover:bg-surface"
                      >
                        Choose DXF…
                      </button>
                    </div>
                    <input
                      ref={dxfInputRef}
                      type="file"
                      accept=".dxf,application/dxf,application/octet-stream"
                      style={{ display: 'none' }}
                      data-testid="project-menu-dxf-input"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) onLinkDxf(f, dxfImportOptions);
                        onOpenChange(false);
                        e.target.value = '';
                      }}
                    />
                  </li>
                ) : null}
              </>
            ) : (
              <MenuItem
                label="Insert → Link DXF (deferred)"
                icon="externalLink"
                testId="project-menu-link-dxf"
                disabled
                tooltip="DXF underlay import is on the roadmap. Today, link a bim-ai shadow model directly via Insert → Link Model… instead."
                onClick={() => {
                  /* disabled */
                }}
              />
            )}
            <MenuItem
              label="Insert → Link Revit (deferred)"
              icon="externalLink"
              testId="project-menu-link-revit"
              disabled
              tooltip="Revit (.rvt) is out of scope until OpenBIM/Forge stabilises. Customers can pre-convert to IFC and use Insert → Link IFC."
              onClick={() => {
                /* disabled */
              }}
            />
          </>
        ) : null}
        <div className="my-1 border-t border-border" />
        <MenuItem
          label="New (clear)"
          icon="close"
          testId="project-menu-new-clear"
          onClick={() => {
            onOpenChange(false);
            onNewClear?.();
          }}
        />
        {onReplayTour ? (
          <>
            <div className="my-1 border-t border-border" />
            <MenuItem
              label="Replay onboarding tour"
              icon="agent"
              testId="project-menu-replay-tour"
              onClick={() => {
                onOpenChange(false);
                onReplayTour();
              }}
            />
          </>
        ) : null}
      </ul>
    </div>
  );
}

function MenuItem({
  label,
  icon,
  testId,
  onClick,
  disabled,
  tooltip,
}: {
  label: string;
  icon: keyof typeof Icons;
  testId: string;
  onClick: () => void;
  disabled?: boolean;
  tooltip?: string;
}): JSX.Element {
  const Icon = Icons[icon];
  return (
    <li>
      <button
        type="button"
        role="menuitem"
        onClick={onClick}
        data-testid={testId}
        disabled={disabled}
        title={tooltip}
        className={[
          'flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs',
          disabled
            ? 'text-muted opacity-60 cursor-not-allowed'
            : 'text-foreground hover:bg-surface-strong',
        ].join(' ')}
      >
        {Icon ? <Icon size={ICON_SIZE.chrome} aria-hidden="true" /> : null}
        <span>{label}</span>
      </button>
    </li>
  );
}

function MenuLink({
  label,
  icon,
  testId,
  href,
  download,
  onClick,
}: {
  label: string;
  icon: keyof typeof Icons;
  testId: string;
  href: string;
  download?: string;
  onClick?: () => void;
}): JSX.Element {
  const Icon = Icons[icon];
  return (
    <li>
      <a
        role="menuitem"
        href={href}
        download={download}
        onClick={onClick}
        data-testid={testId}
        className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-foreground hover:bg-surface-strong"
      >
        {Icon ? <Icon size={ICON_SIZE.chrome} aria-hidden="true" /> : null}
        <span>{label}</span>
      </a>
    </li>
  );
}
