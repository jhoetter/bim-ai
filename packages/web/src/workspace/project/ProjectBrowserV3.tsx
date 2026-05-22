import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { JSX, DragEvent } from 'react';
import type { DisciplineTag, Element } from '@bim-ai/core';
import { DEFAULT_DISCIPLINE_BY_KIND } from '@bim-ai/core';

import { Btn } from '@bim-ai/ui';
import { LinkedModelHifi, PhaseHifi, PlanViewHifi, ScheduleViewHifi } from '@bim-ai/icons';

import { applyCommand } from '../../lib/api';
import { useViewTemplateStore } from '../../collab/viewTemplateStore';
import {
  duplicateFamilyTypeCommand,
  ProjectBrowserFamiliesGroup,
  type ProjectBrowserFamilyTypeElement,
} from './ProjectBrowserFamiliesGroup';
import { PbCollapsibleSection, PbContextMenu, PbGroup } from './ProjectBrowserSections';

import {
  planViewBrowserHierarchyState,
  planViewProjectBrowserEvidenceLine,
  viewpointOrbit3dEvidenceLine,
} from '../../plan/planProjection';
import { NewSheetDialog } from '../../plan/NewSheetDialog';
import {
  planLevelEvidenceToken,
  scheduleProjectBrowserEvidenceLine,
  sectionCutBrowserTooltipTitle,
  sectionCutProjectBrowserEvidenceLine,
  sheetProjectBrowserEvidenceLine,
  siteProjectBrowserEvidenceLine,
} from '../evidence';
import { useBimStore } from '../../state/store';
import {
  ProjectBrowserLinkedIfcGroup,
  ProjectBrowserLinksGroup,
  ProjectBrowserSheetsGroup,
  type ProjectBrowserProps,
} from './ProjectBrowser';

type CtxMenu = {
  viewId: string;
  x: number;
  y: number;
  isSavedView?: boolean;
  isLocked?: boolean;
} | null;

/** Derive a discipline label from element tags when present. */
function disciplineLabel(el: Element): string | null {
  if ('discipline' in el && typeof (el as { discipline?: string }).discipline === 'string') {
    const d = (el as { discipline?: string }).discipline;
    if (d === 'arch') return 'Architecture';
    if (d === 'struct') return 'Structure';
    if (d === 'mep') return 'MEP';
    return d ?? null;
  }
  return null;
}

/** Group rows by discipline label (or single unlabelled group if none present). */
function groupByDiscipline<T extends Element>(rows: T[]): { label: string | null; rows: T[] }[] {
  const hasAnyDisc = rows.some((r) => disciplineLabel(r) !== null);
  if (!hasAnyDisc) return [{ label: null, rows }];
  const map = new Map<string, T[]>();
  for (const r of rows) {
    const k = disciplineLabel(r) ?? 'Other';
    const bucket = map.get(k) ?? [];
    bucket.push(r);
    map.set(k, bucket);
  }
  return [...map.entries()].map(([label, rowList]) => ({ label, rows: rowList }));
}

/**
 * CHR-V3-07 refreshed project browser.
 *
 * Width: `var(--rail-width-expanded, 240px)` / `var(--rail-width-collapsed, 36px)`.
 * Groups: Views · Schedules · Links / Imports · Phases.
 * Features: real-time search, right-click context menu, HTML5 drag-to-reorder.
 */
export function ProjectBrowserV3({
  elements,
  activeViewId,
  onActivateView,
  onRenameView,
  onDeleteView,
  onDuplicateView,
  onPropertiesView,
  onToggleLockView,
  collapsed = false,
  onSave3dView,
  onRestore3dView,
  onDelete3dView,
  onRename3dView,
  onToggleLock3dView,
  onSaveCameraView,
  onSemanticCommand,
}: ProjectBrowserProps): JSX.Element {
  const [search, setSearch] = useState('');
  const [ctxMenu, setCtxMenu] = useState<CtxMenu>(null);
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [saving3dViewInput, setSaving3dViewInput] = useState<string | null>(null);
  const [ctx3dMenu, setCtx3dMenu] = useState<{ viewId: string; x: number; y: number } | null>(null);
  const [rename3dId, setRename3dId] = useState<string | null>(null);
  const [rename3dValue, setRename3dValue] = useState('');
  // §14.5: camera views context menu
  const [ctxCameraMenu, setCtxCameraMenu] = useState<{
    viewId: string;
    x: number;
    y: number;
  } | null>(null);
  const [renameCameraId, setRenameCameraId] = useState<string | null>(null);
  const [renameCameraValue, setRenameCameraValue] = useState('');
  // Local order state for drag-reorder (maps viewId → order index override).
  const [localOrder, setLocalOrder] = useState<Record<string, number>>({});
  const dragSrc = useRef<string | null>(null);
  // §1.6.11 — Families / Groups sections collapsed by default
  const [familiesCollapsed, setFamiliesCollapsed] = useState(true);
  const [groupsCollapsed, setGroupsCollapsed] = useState(true);
  // §6.4.2 — Drafting Views section collapsed by default
  const [draftingViewsCollapsed, setDraftingViewsCollapsed] = useState(false);
  // §1.6.11 — plan view organization preset
  const [viewOrgPreset, setViewOrgPreset] = useState<'discipline' | 'level'>('discipline');
  // §1.6.11 — plan view sort order (WP-E)
  const [planViewSort, setPlanViewSort] = useState<'az' | 'za'>('az');

  // Derive groups from elements.
  const {
    viewRows,
    scheduleRows,
    linkRows,
    phaseRows,
    saved3dRows,
    cameraViewRows,
    familyRows,
    groupDefRows,
    planViewRows,
    draftingViews,
  } = useMemo(() => {
    const lower = search.toLowerCase();
    const matches = (name: string) => !lower || name.toLowerCase().includes(lower);

    const views = elements.filter(
      (e): e is Extract<Element, { kind: 'viewpoint' | 'saved_view' }> =>
        (e.kind === 'viewpoint' || e.kind === 'saved_view') &&
        matches((e as { name?: string }).name ?? e.id),
    );

    const schedules = elements.filter(
      (e): e is Extract<Element, { kind: 'schedule' }> => e.kind === 'schedule' && matches(e.name),
    );

    const links = elements.filter(
      (e) =>
        (e.kind === 'image_underlay' || e.kind === 'link_model') &&
        matches((e as { name?: string }).name ?? e.id),
    );

    const phases = elements.filter(
      (e): e is Extract<Element, { kind: 'phase' }> =>
        e.kind === 'phase' && matches((e as { name?: string }).name ?? e.id),
    );

    const saved3dAll = elements.filter(
      (e): e is Extract<Element, { kind: 'saved_3d_view' }> =>
        e.kind === 'saved_3d_view' && matches((e as { name?: string }).name ?? e.id),
    );

    // §14.5: split saved_3d_view elements by perspective flag
    const saved3d = saved3dAll.filter(
      (e) => (e as { perspective?: boolean | null }).perspective !== true,
    );
    const cameraViews = saved3dAll.filter(
      (e) => (e as { perspective?: boolean | null }).perspective === true,
    );

    // Apply local drag order overrides then sort.
    const sortedViews = [...views].sort((a, b) => {
      const oa = localOrder[a.id] ?? 0;
      const ob = localOrder[b.id] ?? 0;
      if (oa !== ob) return oa - ob;
      return ((a as { name?: string }).name ?? a.id).localeCompare(
        (b as { name?: string }).name ?? b.id,
      );
    });

    // §1.6.11 — family elements (extrusion / revolve / void / blend / sweep)
    const FAMILY_KINDS = new Set([
      'family_extrusion',
      'family_revolve',
      'family_void',
      'family_blend',
      'family_sweep',
    ]);
    const familyRows = elements.filter((e) => FAMILY_KINDS.has(e.kind));

    // §1.6.11 — group definitions (instances counted via group_instance kind)
    const groupDefRows = elements.filter((e) => e.kind === 'group_definition');

    // §1.6.11 — plan views for the Floor Plans section (WP-E: sort controlled by planViewSort)
    // §6.4.2: exclude drafting views from the Floor Plans section
    const planViewRows = elements
      .filter(
        (e): e is Extract<Element, { kind: 'plan_view' }> =>
          e.kind === 'plan_view' && e.planViewSubtype !== 'drafting' && matches(e.name ?? e.id),
      )
      .sort((a, b) => {
        const nameA = a.name ?? a.id;
        const nameB = b.name ?? b.id;
        return planViewSort === 'az' ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
      });

    // §6.4.2: drafting views — plan_view elements with planViewSubtype='drafting'
    const draftingViews = elements.filter(
      (e): e is Extract<Element, { kind: 'plan_view' }> =>
        e.kind === 'plan_view' && e.planViewSubtype === 'drafting' && matches(e.name ?? e.id),
    );

    return {
      viewRows: sortedViews,
      scheduleRows: schedules,
      linkRows: links,
      phaseRows: phases,
      saved3dRows: saved3d,
      cameraViewRows: cameraViews,
      familyRows,
      groupDefRows,
      planViewRows,
      draftingViews,
    };
  }, [elements, search, localOrder, planViewSort]);

  const closeCtx = useCallback(() => setCtxMenu(null), []);

  const handleRowRightClick = (viewId: string, x: number, y: number) => {
    const el = elements.find((e) => e.id === viewId);
    const isSavedView = (el as { kind?: string } | undefined)?.kind === 'saved_view';
    const isLocked = isSavedView ? !!(el as { isLocked?: boolean } | undefined)?.isLocked : false;
    setCtxMenu({ viewId, x, y, isSavedView, isLocked });
  };

  const startRename = (viewId: string, currentName: string) => {
    setRenameId(viewId);
    setRenameValue(currentName);
    setCtxMenu(null);
  };

  const commitRename = (viewId: string) => {
    if (renameValue.trim()) onRenameView(viewId, renameValue.trim());
    setRenameId(null);
  };

  // HTML5 drag-to-reorder helpers.
  const onDragStart = (viewId: string) => {
    dragSrc.current = viewId;
  };

  const onDragOver = (e: DragEvent<HTMLLIElement>) => {
    e.preventDefault();
  };

  const onDrop = (targetId: string) => {
    const srcId = dragSrc.current;
    if (!srcId || srcId === targetId) return;
    const ids = viewRows.map((v) => v.id);
    const srcIdx = ids.indexOf(srcId);
    const tgtIdx = ids.indexOf(targetId);
    const reordered = [...ids];
    reordered.splice(srcIdx, 1);
    reordered.splice(tgtIdx, 0, srcId);
    const next: Record<string, number> = {};
    reordered.forEach((id, i) => {
      next[id] = i;
    });
    setLocalOrder(next);
    dragSrc.current = null;
  };

  const railStyle: React.CSSProperties = {
    width: collapsed ? 'var(--rail-width-collapsed, 36px)' : 'var(--rail-width-expanded, 240px)',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
  };

  const viewGroups = groupByDiscipline(viewRows);

  // §1.6.11: level-grouped plan views for "By Level" org preset
  const levelGroupedViews = useMemo(() => {
    if (viewOrgPreset !== 'level') return null;
    const byLevel: Record<string, typeof planViewRows> = {};
    for (const pv of planViewRows) {
      const levelId = pv.levelId ?? 'unassigned';
      if (!byLevel[levelId]) byLevel[levelId] = [];
      byLevel[levelId].push(pv);
    }
    return byLevel;
  }, [planViewRows, viewOrgPreset]);

  if (collapsed) {
    const collapsedGroups = [
      { id: 'views', label: 'Views', count: viewRows.length, Icon: PlanViewHifi },
      { id: 'schedules', label: 'Schedules', count: scheduleRows.length, Icon: ScheduleViewHifi },
      { id: 'links', label: 'Links / Imports', count: linkRows.length, Icon: LinkedModelHifi },
      { id: 'phases', label: 'Phases', count: phaseRows.length, Icon: PhaseHifi },
    ];
    return (
      <div
        style={{
          ...railStyle,
          alignItems: 'center',
          gap: 'var(--space-1)',
          paddingTop: 'var(--space-2)',
        }}
        data-collapsed="true"
        aria-label="Project browser (collapsed)"
      >
        {collapsedGroups.map(({ id, label, count, Icon }) => {
          const isActive =
            (id === 'views' && viewRows.some((row) => row.id === activeViewId)) ||
            (id === 'schedules' && scheduleRows.some((row) => row.id === activeViewId));
          return (
            <button
              key={id}
              type="button"
              aria-label={`${label}${count ? `, ${count} items` : ''}`}
              title={`${label}${count ? ` · ${count}` : ''}`}
              data-testid={`pb-collapsed-${id}`}
              data-active={isActive ? 'true' : 'false'}
              onClick={() => {
                const first =
                  id === 'views'
                    ? viewRows[0]
                    : id === 'schedules'
                      ? scheduleRows[0]
                      : id === 'links'
                        ? linkRows[0]
                        : phaseRows[0];
                if (first) onActivateView(first.id);
              }}
              style={{
                width: 32,
                height: 32,
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md, 6px)',
                background: isActive ? 'var(--color-accent-soft)' : 'var(--color-surface)',
                color: 'var(--color-foreground)',
                cursor: count > 0 ? 'pointer' : 'default',
                opacity: count > 0 ? 1 : 0.45,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
              }}
              disabled={count === 0}
            >
              <Icon size={22} aria-hidden="true" />
              {isActive ? (
                <span
                  aria-hidden="true"
                  style={{
                    position: 'absolute',
                    left: -1,
                    top: 6,
                    bottom: 6,
                    width: 2,
                    borderRadius: 2,
                    background: 'var(--color-accent)',
                  }}
                />
              ) : null}
            </button>
          );
        })}
      </div>
    );
  }

  const getLevelName = (levelId: string): string => {
    if (levelId === 'unassigned') return 'Unassigned';
    const lvl = elements.find((el) => el.id === levelId && el.kind === 'level');
    return lvl ? ((lvl as { name?: string }).name ?? levelId) : levelId;
  };

  return (
    <div style={railStyle} aria-label="Project browser">
      {/* Search */}
      <div
        style={{
          padding: 'var(--space-2) var(--space-3)',
          borderBottom: '1px solid var(--color-border)',
        }}
      >
        <input
          data-testid="browser-search-input"
          type="search"
          placeholder="Search project…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search project browser"
          style={{
            width: '100%',
            background: 'var(--color-background)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-sm, 4px)',
            color: 'var(--color-foreground)',
            fontSize: 'var(--text-sm, 12.5px)',
            padding: 'var(--space-1) var(--space-2)',
          }}
        />
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-1) 0' }} onClick={closeCtx}>
        {/* Views group */}
        {viewRows.length > 0 ? (
          <PbGroup label="Views">
            {viewGroups.map((grp) => (
              <div key={grp.label ?? '__all__'}>
                {grp.label ? (
                  <div
                    style={{
                      paddingLeft: 'var(--space-3)',
                      paddingTop: 'var(--space-1)',
                      fontSize: 'var(--text-sm, 12.5px)',
                      color: 'var(--color-muted-foreground)',
                      fontWeight: 600,
                      letterSpacing: 'var(--text-eyebrow-tracking, 0.04em)',
                      textTransform: 'uppercase',
                    }}
                    data-discipline-group={grp.label}
                  >
                    {grp.label}
                  </div>
                ) : null}
                <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                  {grp.rows.map((view) => {
                    const name = (view as { name?: string }).name ?? view.id;
                    const isActive = view.id === activeViewId;
                    return (
                      <li
                        key={view.id}
                        draggable
                        onDragStart={() => onDragStart(view.id)}
                        onDragOver={onDragOver}
                        onDrop={() => onDrop(view.id)}
                        data-testid={`pb-view-row-${view.id}`}
                      >
                        {renameId === view.id ? (
                          <input
                            autoFocus
                            type="text"
                            value={renameValue}
                            onChange={(e) => setRenameValue(e.target.value)}
                            onBlur={() => commitRename(view.id)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') commitRename(view.id);
                              if (e.key === 'Escape') setRenameId(null);
                            }}
                            style={{
                              width: '100%',
                              padding: 'var(--space-0-5) var(--space-2)',
                              fontSize: 'var(--text-sm, 12.5px)',
                              background: 'var(--color-background)',
                              color: 'var(--color-foreground)',
                              border: '1px solid var(--color-accent)',
                            }}
                          />
                        ) : (
                          <button
                            type="button"
                            data-active={isActive ? 'true' : 'false'}
                            style={{
                              width: '100%',
                              textAlign: 'left',
                              padding: 'var(--space-0-5) var(--space-3)',
                              fontSize: 'var(--text-sm, 12.5px)',
                              color: 'var(--color-foreground)',
                              background: isActive ? 'var(--color-accent-soft)' : 'transparent',
                              border: 'none',
                              cursor: 'pointer',
                            }}
                            onClick={() => onActivateView(view.id)}
                            onContextMenu={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleRowRightClick(view.id, e.clientX, e.clientY);
                            }}
                          >
                            {name}
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </PbGroup>
        ) : null}

        {/* §1.6.11 — Floor Plans group with org preset */}
        {planViewRows.length > 0 ? (
          <div style={{ marginBottom: 'var(--space-2)' }} data-pb-group="Floor Plans">
            <div
              style={{
                padding: 'var(--space-1) var(--space-3)',
                fontSize: 'var(--text-sm, 12.5px)',
                color: 'var(--color-muted-foreground)',
                letterSpacing: 'var(--text-eyebrow-tracking, 0.04em)',
                textTransform: 'uppercase',
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-1)',
              }}
            >
              <span>Floor Plans</span>
              <button
                data-testid="browser-plan-views-sort-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  setPlanViewSort((s) => (s === 'az' ? 'za' : 'az'));
                }}
                title={planViewSort === 'az' ? 'Sort Z→A' : 'Sort A→Z'}
                style={{
                  fontSize: 9,
                  padding: '1px 4px',
                  border: '1px solid var(--color-border)',
                  borderRadius: 2,
                  background: 'transparent',
                  cursor: 'pointer',
                  marginLeft: 4,
                  color: 'inherit',
                }}
              >
                {planViewSort === 'az' ? 'A↑' : 'Z↑'}
              </button>
              <select
                data-testid="browser-view-org-preset"
                value={viewOrgPreset}
                onChange={(e) => setViewOrgPreset(e.target.value as 'discipline' | 'level')}
                onClick={(e) => e.stopPropagation()}
                style={{
                  marginLeft: 'auto',
                  fontSize: 'var(--text-xs, 10px)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-sm, 4px)',
                  padding: '0 var(--space-1)',
                  background: 'var(--color-background)',
                  color: 'var(--color-foreground)',
                  cursor: 'pointer',
                }}
              >
                <option value="discipline">By Discipline</option>
                <option value="level">By Level</option>
              </select>
            </div>
            {viewOrgPreset === 'level' && levelGroupedViews
              ? Object.entries(levelGroupedViews)
                  .sort(([a], [b]) => a.localeCompare(b))
                  .map(([levelId, views]) => (
                    <div key={levelId} data-testid={`browser-level-group-${levelId}`}>
                      <div
                        style={{
                          padding: 'var(--space-0-5) var(--space-3)',
                          fontSize: 'var(--text-xs, 10px)',
                          fontWeight: 600,
                          color: 'var(--color-muted-foreground)',
                        }}
                      >
                        {getLevelName(levelId)}
                      </div>
                      <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                        {views.map((pv) => (
                          <li key={pv.id}>
                            <button
                              type="button"
                              data-testid={`browser-view-row-${pv.id}`}
                              style={{
                                width: '100%',
                                textAlign: 'left',
                                padding: 'var(--space-0-5) var(--space-4)',
                                fontSize: 'var(--text-sm, 12.5px)',
                                color: 'var(--color-foreground)',
                                background:
                                  pv.id === activeViewId
                                    ? 'var(--color-accent-soft)'
                                    : 'transparent',
                                border: 'none',
                                cursor: 'pointer',
                              }}
                              onClick={() => onActivateView(pv.id)}
                            >
                              {(pv as { name?: string }).name ?? pv.id}
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))
              : planViewRows.map((pv) => {
                  const discLabel = disciplineLabel(pv);
                  return (
                    <div key={pv.id}>
                      <button
                        type="button"
                        data-testid={`browser-view-row-${pv.id}`}
                        style={{
                          width: '100%',
                          textAlign: 'left',
                          padding: 'var(--space-0-5) var(--space-3)',
                          fontSize: 'var(--text-sm, 12.5px)',
                          color: 'var(--color-foreground)',
                          background:
                            pv.id === activeViewId ? 'var(--color-accent-soft)' : 'transparent',
                          border: 'none',
                          cursor: 'pointer',
                        }}
                        onClick={() => onActivateView(pv.id)}
                        title={discLabel ?? undefined}
                      >
                        {(pv as { name?: string }).name ?? pv.id}
                      </button>
                    </div>
                  );
                })}
          </div>
        ) : null}

        {/* §6.4.2: Drafting Views section */}
        <PbCollapsibleSection
          label={`Drafting Views${draftingViews.length > 0 ? ` (${draftingViews.length})` : ''}`}
          collapsed={draftingViewsCollapsed}
          onToggle={() => setDraftingViewsCollapsed((v) => !v)}
          testId="browser-drafting-views-section"
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: '0 var(--space-3) var(--space-1)',
            }}
          >
            <button
              type="button"
              data-testid="browser-new-drafting-view-btn"
              onClick={() =>
                void onSemanticCommand?.({
                  type: 'createDraftingView',
                  name: `Detail ${draftingViews.length + 1}`,
                })
              }
              style={{
                fontSize: 10,
                padding: '2px 6px',
                border: '1px solid var(--color-border)',
                borderRadius: 2,
                background: 'transparent',
                cursor: 'pointer',
                color: 'inherit',
              }}
            >
              + Draft
            </button>
          </div>
          {draftingViews.length === 0 ? (
            <div
              style={{
                padding: 'var(--space-1) var(--space-4)',
                fontSize: 'var(--text-sm, 12.5px)',
                color: 'var(--color-muted-foreground)',
                fontStyle: 'italic',
              }}
            >
              No drafting views
            </div>
          ) : (
            draftingViews.map((pv) => (
              <div
                key={pv.id}
                data-testid={`browser-drafting-view-${pv.id}`}
                style={{
                  padding: 'var(--space-0-5) var(--space-4)',
                  fontSize: 'var(--text-sm, 12.5px)',
                  color: 'var(--color-foreground)',
                  cursor: 'pointer',
                  background: pv.id === activeViewId ? 'var(--color-accent-soft)' : 'transparent',
                }}
                onClick={() => onActivateView(pv.id)}
              >
                {pv.name ?? pv.id}
              </div>
            ))
          )}
        </PbCollapsibleSection>

        {/* 3D Views group */}
        <PbGroup label="3D Views">
          {saving3dViewInput !== null ? (
            <input
              autoFocus
              type="text"
              placeholder="View name…"
              value={saving3dViewInput}
              onChange={(e) => setSaving3dViewInput(e.target.value)}
              onBlur={() => setSaving3dViewInput(null)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  if (saving3dViewInput.trim()) onSave3dView?.(saving3dViewInput.trim());
                  setSaving3dViewInput(null);
                }
                if (e.key === 'Escape') setSaving3dViewInput(null);
              }}
              style={{
                width: '100%',
                padding: 'var(--space-1) var(--space-2)',
                fontSize: 'var(--text-sm, 12.5px)',
                background: 'var(--color-background)',
                color: 'var(--color-foreground)',
                border: '1px solid var(--color-accent)',
              }}
            />
          ) : (
            <button
              type="button"
              data-testid="browser-save-3d-view"
              onClick={() => setSaving3dViewInput('')}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: 'var(--space-0-5) var(--space-3)',
                fontSize: 'var(--text-sm, 12.5px)',
                color: 'var(--color-accent)',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              + Save Current View
            </button>
          )}
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {saved3dRows.map((v) => {
              const vAny = v as {
                id: string;
                name?: string;
                locked?: boolean | null;
              };
              const name = vAny.name ?? vAny.id;
              const locked = vAny.locked === true;
              return (
                <li key={vAny.id} data-testid={`pb-3d-view-row-${vAny.id}`}>
                  {rename3dId === vAny.id ? (
                    <input
                      autoFocus
                      type="text"
                      value={rename3dValue}
                      onChange={(e) => setRename3dValue(e.target.value)}
                      onBlur={() => {
                        if (rename3dValue.trim()) onRename3dView?.(vAny.id, rename3dValue.trim());
                        setRename3dId(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          if (rename3dValue.trim()) onRename3dView?.(vAny.id, rename3dValue.trim());
                          setRename3dId(null);
                        }
                        if (e.key === 'Escape') setRename3dId(null);
                      }}
                      style={{
                        width: '100%',
                        padding: 'var(--space-0-5) var(--space-2)',
                        fontSize: 'var(--text-sm, 12.5px)',
                        background: 'var(--color-background)',
                        color: 'var(--color-foreground)',
                        border: '1px solid var(--color-accent)',
                      }}
                    />
                  ) : (
                    <button
                      type="button"
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        padding: 'var(--space-0-5) var(--space-3)',
                        fontSize: 'var(--text-sm, 12.5px)',
                        color: 'var(--color-foreground)',
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--space-1)',
                      }}
                      onDoubleClick={() => onRestore3dView?.(vAny.id)}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setCtx3dMenu({ viewId: vAny.id, x: e.clientX, y: e.clientY });
                      }}
                    >
                      {locked ? (
                        <span data-testid={`pb-3d-lock-icon-${vAny.id}`} aria-label="locked">
                          🔒
                        </span>
                      ) : null}
                      {name}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </PbGroup>

        {/* 3D views context menu */}
        {ctx3dMenu ? (
          <div
            data-testid="pb-3d-context-menu"
            style={{
              position: 'fixed',
              left: ctx3dMenu.x,
              top: ctx3dMenu.y,
              background: 'var(--color-background)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-sm, 4px)',
              zIndex: 9999,
              minWidth: 120,
              padding: 'var(--space-1) 0',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              data-testid="pb-3d-ctx-restore"
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: 'var(--space-1) var(--space-3)',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                fontSize: 'var(--text-sm, 12.5px)',
              }}
              onClick={() => {
                onRestore3dView?.(ctx3dMenu.viewId);
                setCtx3dMenu(null);
              }}
            >
              Restore
            </button>
            <button
              type="button"
              data-testid="pb-3d-ctx-rename"
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: 'var(--space-1) var(--space-3)',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                fontSize: 'var(--text-sm, 12.5px)',
              }}
              onClick={() => {
                const el = saved3dRows.find((e) => e.id === ctx3dMenu.viewId);
                setRename3dValue((el as { name?: string } | undefined)?.name ?? '');
                setRename3dId(ctx3dMenu.viewId);
                setCtx3dMenu(null);
              }}
            >
              Rename
            </button>
            <button
              type="button"
              data-testid="pb-3d-ctx-delete"
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: 'var(--space-1) var(--space-3)',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                fontSize: 'var(--text-sm, 12.5px)',
              }}
              onClick={() => {
                onDelete3dView?.(ctx3dMenu.viewId);
                setCtx3dMenu(null);
              }}
            >
              Delete
            </button>
            <button
              type="button"
              data-testid="pb-3d-ctx-lock"
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: 'var(--space-1) var(--space-3)',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                fontSize: 'var(--text-sm, 12.5px)',
              }}
              onClick={() => {
                onToggleLock3dView?.(ctx3dMenu.viewId);
                setCtx3dMenu(null);
              }}
            >
              Lock / Unlock
            </button>
          </div>
        ) : null}

        {/* §14.5 — Camera Views group */}
        <div data-testid="browser-camera-views-group">
          <PbGroup label={`Camera Views (${cameraViewRows.length})`}>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {cameraViewRows.map((v) => {
                const vAny = v as { id: string; name?: string };
                const camName = vAny.name ?? vAny.id;
                return (
                  <li key={vAny.id} data-testid={`browser-camera-view-${vAny.id}`}>
                    {renameCameraId === vAny.id ? (
                      <input
                        autoFocus
                        type="text"
                        value={renameCameraValue}
                        onChange={(e) => setRenameCameraValue(e.target.value)}
                        onBlur={() => {
                          if (renameCameraValue.trim())
                            onRename3dView?.(vAny.id, renameCameraValue.trim());
                          setRenameCameraId(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            if (renameCameraValue.trim())
                              onRename3dView?.(vAny.id, renameCameraValue.trim());
                            setRenameCameraId(null);
                          }
                          if (e.key === 'Escape') setRenameCameraId(null);
                        }}
                        style={{
                          width: '100%',
                          padding: 'var(--space-0-5) var(--space-2)',
                          fontSize: 'var(--text-sm, 12.5px)',
                          background: 'var(--color-background)',
                          color: 'var(--color-foreground)',
                          border: '1px solid var(--color-accent)',
                        }}
                      />
                    ) : (
                      <button
                        type="button"
                        style={{
                          width: '100%',
                          textAlign: 'left',
                          padding: 'var(--space-0-5) var(--space-3)',
                          fontSize: 'var(--text-sm, 12.5px)',
                          color: 'var(--color-foreground)',
                          background: 'transparent',
                          border: 'none',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 'var(--space-1)',
                        }}
                        onDoubleClick={() => onRestore3dView?.(vAny.id)}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setCtxCameraMenu({ viewId: vAny.id, x: e.clientX, y: e.clientY });
                        }}
                      >
                        📷 {camName}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
            <button
              type="button"
              data-testid="browser-save-camera-view"
              onClick={() => onSaveCameraView?.()}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: 'var(--space-0-5) var(--space-3)',
                fontSize: 'var(--text-sm, 12.5px)',
                color: 'var(--color-accent)',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              + Save current camera
            </button>
          </PbGroup>
        </div>

        {/* Camera views context menu */}
        {ctxCameraMenu ? (
          <div
            data-testid="pb-camera-context-menu"
            style={{
              position: 'fixed',
              left: ctxCameraMenu.x,
              top: ctxCameraMenu.y,
              background: 'var(--color-background)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-sm, 4px)',
              zIndex: 9999,
              minWidth: 120,
              padding: 'var(--space-1) 0',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              data-testid="pb-camera-ctx-restore"
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: 'var(--space-1) var(--space-3)',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                fontSize: 'var(--text-sm, 12.5px)',
              }}
              onClick={() => {
                onRestore3dView?.(ctxCameraMenu.viewId);
                setCtxCameraMenu(null);
              }}
            >
              Restore
            </button>
            <button
              type="button"
              data-testid="pb-camera-ctx-rename"
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: 'var(--space-1) var(--space-3)',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                fontSize: 'var(--text-sm, 12.5px)',
              }}
              onClick={() => {
                const el = cameraViewRows.find((e) => e.id === ctxCameraMenu.viewId);
                setRenameCameraValue((el as { name?: string } | undefined)?.name ?? '');
                setRenameCameraId(ctxCameraMenu.viewId);
                setCtxCameraMenu(null);
              }}
            >
              Rename
            </button>
            <button
              type="button"
              data-testid="pb-camera-ctx-delete"
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: 'var(--space-1) var(--space-3)',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                fontSize: 'var(--text-sm, 12.5px)',
              }}
              onClick={() => {
                onDelete3dView?.(ctxCameraMenu.viewId);
                setCtxCameraMenu(null);
              }}
            >
              Delete
            </button>
          </div>
        ) : null}

        {/* Schedules group */}
        {scheduleRows.length > 0 ? (
          <PbGroup label="Schedules">
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {scheduleRows.map((s) => (
                <li key={s.id} data-testid={`pb-schedule-row-${s.id}`}>
                  <button
                    type="button"
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: 'var(--space-0-5) var(--space-3)',
                      fontSize: 'var(--text-sm, 12.5px)',
                      color: 'var(--color-foreground)',
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                    }}
                    onClick={() => onActivateView(s.id)}
                  >
                    {s.name}
                  </button>
                </li>
              ))}
            </ul>
          </PbGroup>
        ) : null}

        {/* Links / Imports group */}
        {linkRows.length > 0 ? (
          <PbGroup label="Links / Imports">
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {linkRows.map((l) => {
                const name = (l as { name?: string }).name ?? l.id;
                return (
                  <li key={l.id} data-testid={`pb-link-row-${l.id}`}>
                    <button
                      type="button"
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        padding: 'var(--space-0-5) var(--space-3)',
                        fontSize: 'var(--text-sm, 12.5px)',
                        color: 'var(--color-foreground)',
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                      }}
                      onClick={() => onActivateView(l.id)}
                    >
                      {name}
                    </button>
                  </li>
                );
              })}
            </ul>
          </PbGroup>
        ) : null}

        {/* Phases group */}
        {phaseRows.length > 0 ? (
          <PbGroup label="Phases">
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {phaseRows.map((p) => {
                const name = (p as { name?: string }).name ?? p.id;
                return (
                  <li key={p.id} data-testid={`pb-phase-row-${p.id}`}>
                    <div
                      style={{
                        padding: 'var(--space-0-5) var(--space-3)',
                        fontSize: 'var(--text-sm, 12.5px)',
                        color: 'var(--color-foreground)',
                      }}
                    >
                      {name}
                    </div>
                  </li>
                );
              })}
            </ul>
          </PbGroup>
        ) : null}

        {/* §1.6.11 — Families */}
        <PbCollapsibleSection
          label={`Families (${familyRows.length})`}
          collapsed={familiesCollapsed}
          onToggle={() => setFamiliesCollapsed((v) => !v)}
          testId="pb-section-families"
        >
          {(['Structural', 'Voids', 'Revolves'] as const).map((grpLabel) => {
            const grpRows = familyRows.filter((e) =>
              grpLabel === 'Structural'
                ? ['family_extrusion', 'family_blend', 'family_sweep'].includes(e.kind)
                : grpLabel === 'Voids'
                  ? e.kind === 'family_void'
                  : e.kind === 'family_revolve',
            );
            if (grpRows.length === 0) return null;
            return (
              <div key={grpLabel}>
                <div
                  style={{
                    padding: 'var(--space-0-5) var(--space-3)',
                    fontSize: 'var(--text-xs, 10px)',
                    color: 'var(--color-muted-foreground)',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                  }}
                >
                  {grpLabel}
                </div>
                <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                  {grpRows.map((ft) => (
                    <li key={ft.id} data-testid={`pb-family-${ft.id}`}>
                      <button
                        type="button"
                        style={{
                          width: '100%',
                          textAlign: 'left',
                          padding: 'var(--space-0-5) var(--space-4)',
                          fontSize: 'var(--text-sm, 12.5px)',
                          color: 'var(--color-foreground)',
                          background: 'transparent',
                          border: 'none',
                          cursor: 'pointer',
                        }}
                        onDoubleClick={() => {
                          /* open family editor */
                        }}
                      >
                        🧩 {(ft as { name?: string }).name ?? ft.kind}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </PbCollapsibleSection>

        {/* §1.6.11 — Groups */}
        <PbCollapsibleSection
          label={`Groups (${groupDefRows.length})`}
          collapsed={groupsCollapsed}
          onToggle={() => setGroupsCollapsed((v) => !v)}
          testId="browser-groups-section"
        >
          {groupDefRows.length === 0 ? (
            <div
              data-testid="browser-groups-empty"
              style={{
                padding: 'var(--space-1) var(--space-3)',
                fontSize: 'var(--text-sm, 12.5px)',
                color: 'var(--color-muted-foreground)',
                fontStyle: 'italic',
              }}
            >
              No groups defined
            </div>
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {groupDefRows.map((gd) => {
                const instCount = elements.filter(
                  (e) =>
                    e.kind === 'group_instance' &&
                    (e as { groupDefinitionId?: string }).groupDefinitionId === gd.id,
                ).length;
                return (
                  <li key={gd.id} data-testid={`browser-group-row-${gd.id}`}>
                    <button
                      type="button"
                      onClick={() =>
                        void onSemanticCommand?.({
                          type: 'selectGroupElements',
                          groupDefinitionId: gd.id,
                        })
                      }
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        padding: 'var(--space-0-5) var(--space-3)',
                        fontSize: 'var(--text-sm, 12.5px)',
                        color: 'var(--color-foreground)',
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--space-2)',
                      }}
                    >
                      <span>⬡</span>
                      <span style={{ flex: 1 }}>{(gd as { name?: string }).name ?? 'Group'}</span>
                      <span
                        style={{
                          color: 'var(--color-muted-foreground)',
                          fontSize: 'var(--text-xs, 10px)',
                        }}
                        data-testid={`pb-group-instance-count-${gd.id}`}
                      >
                        ×{instCount}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </PbCollapsibleSection>

        {viewRows.length === 0 &&
        scheduleRows.length === 0 &&
        linkRows.length === 0 &&
        phaseRows.length === 0 ? (
          <div
            style={{
              padding: 'var(--space-3)',
              fontSize: 'var(--text-sm, 12.5px)',
              color: 'var(--color-muted-foreground)',
            }}
          >
            {search ? 'No matches.' : 'No views yet.'}
          </div>
        ) : null}
      </div>

      {/* Right-click context menu */}
      {ctxMenu ? (
        <PbContextMenu
          x={ctxMenu.x}
          y={ctxMenu.y}
          onClose={closeCtx}
          onRename={() => {
            const el = elements.find((e) => e.id === ctxMenu.viewId);
            startRename(ctxMenu.viewId, (el as { name?: string })?.name ?? '');
          }}
          onDuplicate={() => {
            onDuplicateView(ctxMenu.viewId);
            closeCtx();
          }}
          onDelete={() => {
            onDeleteView(ctxMenu.viewId);
            closeCtx();
          }}
          onProperties={
            onPropertiesView
              ? () => {
                  onPropertiesView(ctxMenu.viewId);
                  closeCtx();
                }
              : undefined
          }
          onLockToggle={
            onToggleLockView && ctxMenu.isSavedView
              ? () => {
                  onToggleLockView(ctxMenu.viewId);
                  closeCtx();
                }
              : undefined
          }
          isLocked={ctxMenu.isLocked}
        />
      ) : null}
    </div>
  );
}
