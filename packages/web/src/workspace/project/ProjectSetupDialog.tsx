import { type JSX, useEffect, useMemo, useState } from 'react';

import type { Element } from '@bim-ai/core';

type CommandDispatcher = (cmd: Record<string, unknown>) => void | Promise<void>;

type SetupStatus = 'ready' | 'missing' | 'partial';
type SetupSectionKey =
  | 'project-info'
  | 'units'
  | 'levels'
  | 'grids'
  | 'positioning'
  | 'sun'
  | 'phases'
  | 'links'
  | 'templates'
  | 'standards';

const LENGTH_UNITS = [
  ['millimeter', 'Millimeters'],
  ['centimeter', 'Centimeters'],
  ['meter', 'Meters'],
  ['inch', 'Inches'],
  ['foot', 'Feet'],
] as const;

const LOCALES = [
  ['en-US', 'English (US)'],
  ['en-GB', 'English (UK)'],
  ['de-DE', 'Deutsch (DE)'],
] as const;

const DAYLIGHT_SAVING_OPTIONS = [
  ['auto', 'Auto'],
  ['on', 'On'],
  ['off', 'Off'],
] as const;

function slugToken(input: string): string {
  return (
    input
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 32) || 'level'
  );
}

function statusFor(ok: boolean, partial = false): SetupStatus {
  if (ok) return 'ready';
  return partial ? 'partial' : 'missing';
}

function statusLabel(status: SetupStatus): string {
  if (status === 'ready') return 'Ready';
  if (status === 'partial') return 'Partial';
  return 'Missing';
}

function StatusPill({ status }: { status: SetupStatus }): JSX.Element {
  const cls =
    status === 'ready'
      ? 'border-emerald-700/40 bg-emerald-950/20 text-emerald-700'
      : status === 'partial'
        ? 'border-amber-700/40 bg-amber-950/20 text-amber-700'
        : 'border-red-700/40 bg-red-950/20 text-red-700';
  return (
    <span className={`rounded border px-1.5 py-0.5 text-[10px] font-medium ${cls}`}>
      {statusLabel(status)}
    </span>
  );
}

function setupItem(key: SetupSectionKey, label: string, detail: string, status: SetupStatus) {
  return { key, label, detail, status };
}

export function ProjectSetupDialog({
  open,
  onClose,
  elementsById,
  modelId,
  revision,
  onSemanticCommand,
  onOpenManageLinks,
}: {
  open: boolean;
  onClose: () => void;
  elementsById: Record<string, Element>;
  modelId?: string | null;
  revision?: number | null;
  onSemanticCommand: CommandDispatcher;
  onOpenManageLinks?: () => void;
}): JSX.Element | null {
  const all = useMemo(() => Object.values(elementsById) as Element[], [elementsById]);
  const projectSettings =
    elementsById.project_settings?.kind === 'project_settings'
      ? elementsById.project_settings
      : all.find(
          (e): e is Extract<Element, { kind: 'project_settings' }> => e.kind === 'project_settings',
        );
  const levels = useMemo(
    () =>
      all
        .filter((e): e is Extract<Element, { kind: 'level' }> => e.kind === 'level')
        .sort((a, b) => a.elevationMm - b.elevationMm || a.id.localeCompare(b.id)),
    [all],
  );
  const planViews = useMemo(
    () => all.filter((e): e is Extract<Element, { kind: 'plan_view' }> => e.kind === 'plan_view'),
    [all],
  );
  const grids = useMemo(
    () => all.filter((e): e is Extract<Element, { kind: 'grid_line' }> => e.kind === 'grid_line'),
    [all],
  );
  const phases = useMemo(
    () => all.filter((e): e is Extract<Element, { kind: 'phase' }> => e.kind === 'phase'),
    [all],
  );
  const projectBasePoint = all.find(
    (e): e is Extract<Element, { kind: 'project_base_point' }> => e.kind === 'project_base_point',
  );
  const surveyPoint = all.find(
    (e): e is Extract<Element, { kind: 'survey_point' }> => e.kind === 'survey_point',
  );
  const sunSettings = all.find(
    (e): e is Extract<Element, { kind: 'sun_settings' }> => e.kind === 'sun_settings',
  );
  const links = all.filter(
    (e) => e.kind === 'link_model' || e.kind === 'link_dxf' || e.kind === 'link_external',
  );

  const [infoDraft, setInfoDraft] = useState({
    name: '',
    projectNumber: '',
    clientName: '',
    projectAddress: '',
    projectStatus: '',
    lengthUnit: 'millimeter',
    angularUnitDeg: 'degree',
    displayLocale: 'en-US',
  });
  const [storeyDraft, setStoreyDraft] = useState({
    count: '3',
    baseElevationMm: '0',
    floorToFloorMm: '3000',
    namePrefix: 'Level',
  });
  const [levelDrafts, setLevelDrafts] = useState<
    Record<string, { name: string; elevationMm: string }>
  >({});
  const [gridDraft, setGridDraft] = useState({
    xCount: '4',
    yCount: '4',
    spacingMm: '6000',
    extentMm: '24000',
    originX: '0',
    originY: '0',
  });
  const [sunDraft, setSunDraft] = useState({
    latitudeDeg: '48.14',
    longitudeDeg: '11.58',
    dateIso: new Date().toISOString().slice(0, 10),
    hours: '14',
    minutes: '0',
    daylightSavingStrategy: 'auto',
    contextRadiusM: '300',
  });
  const [geoSearchDraft, setGeoSearchDraft] = useState('');
  const [geoSearchBusy, setGeoSearchBusy] = useState(false);
  const [phaseDraft, setPhaseDraft] = useState({
    name: 'New Construction',
  });
  const [positionDraft, setPositionDraft] = useState({
    baseX: '0',
    baseY: '0',
    angleToTrueNorthDeg: '0',
    surveyX: '0',
    surveyY: '0',
    surveyElevationMm: '0',
  });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<SetupSectionKey>('project-info');

  useEffect(() => {
    if (!open) return;
    setInfoDraft({
      name: projectSettings?.name ?? '',
      projectNumber: projectSettings?.projectNumber ?? '',
      clientName: projectSettings?.clientName ?? '',
      projectAddress: projectSettings?.projectAddress ?? '',
      projectStatus: projectSettings?.projectStatus ?? '',
      lengthUnit: projectSettings?.lengthUnit ?? 'millimeter',
      angularUnitDeg: projectSettings?.angularUnitDeg ?? 'degree',
      displayLocale: projectSettings?.displayLocale ?? 'en-US',
    });
    const first = levels[0];
    const second = levels[1];
    setStoreyDraft({
      count: String(Math.max(levels.length, 3)),
      baseElevationMm: String(first?.elevationMm ?? 0),
      floorToFloorMm: String(
        second && first ? Math.max(1, Math.round(second.elevationMm - first.elevationMm)) : 3000,
      ),
      namePrefix: 'Level',
    });
    setLevelDrafts(
      Object.fromEntries(
        levels.map((level) => [
          level.id,
          {
            name: level.name,
            elevationMm: String(Math.round(level.elevationMm)),
          },
        ]),
      ),
    );
    setPositionDraft({
      baseX: String(projectBasePoint?.positionMm.xMm ?? 0),
      baseY: String(projectBasePoint?.positionMm.yMm ?? 0),
      angleToTrueNorthDeg: String(projectBasePoint?.angleToTrueNorthDeg ?? 0),
      surveyX: String(surveyPoint?.positionMm.xMm ?? 0),
      surveyY: String(surveyPoint?.positionMm.yMm ?? 0),
      surveyElevationMm: String(surveyPoint?.sharedElevationMm ?? 0),
    });
    setSunDraft({
      latitudeDeg: String(sunSettings?.latitudeDeg ?? 48.14),
      longitudeDeg: String(sunSettings?.longitudeDeg ?? 11.58),
      dateIso: sunSettings?.dateIso ?? new Date().toISOString().slice(0, 10),
      hours: String(sunSettings?.timeOfDay.hours ?? 14),
      minutes: String(sunSettings?.timeOfDay.minutes ?? 0),
      daylightSavingStrategy: sunSettings?.daylightSavingStrategy ?? 'auto',
      contextRadiusM: String(projectSettings?.georeference?.contextRadiusM ?? 300),
    });
    setPhaseDraft({ name: 'New Construction' });
    setMessage(null);
  }, [open, projectSettings, levels, projectBasePoint, surveyPoint, sunSettings]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const planViewsByLevel = new Map<string, number>();
  for (const view of planViews) {
    if (view.planViewSubtype === 'area_plan') continue;
    planViewsByLevel.set(view.levelId, (planViewsByLevel.get(view.levelId) ?? 0) + 1);
  }

  const checklist = [
    setupItem(
      'project-info',
      'Project info',
      projectSettings?.name || projectSettings?.projectNumber || projectSettings?.clientName
        ? `${projectSettings?.name ?? 'Unnamed project'}${projectSettings?.projectNumber ? ` - ${projectSettings.projectNumber}` : ''}`
        : 'Name, number, client, address',
      statusFor(
        Boolean(
          projectSettings?.name || projectSettings?.projectNumber || projectSettings?.clientName,
        ),
      ),
    ),
    setupItem(
      'units',
      'Units',
      `${projectSettings?.lengthUnit ?? 'millimeter'} - ${projectSettings?.displayLocale ?? 'en-US'}`,
      statusFor(Boolean(projectSettings)),
    ),
    setupItem(
      'levels',
      'Levels / storeys',
      `${levels.length} levels - ${levels.filter((l) => planViewsByLevel.has(l.id)).length} with plans`,
      statusFor(
        levels.length > 0 && levels.every((l) => planViewsByLevel.has(l.id)),
        levels.length > 0,
      ),
    ),
    setupItem('grids', 'Grids', `${grids.length} grid lines`, statusFor(grids.length > 0)),
    setupItem(
      'positioning',
      'Positioning',
      projectBasePoint && surveyPoint
        ? `PBP ${projectBasePoint.positionMm.xMm}, ${projectBasePoint.positionMm.yMm} - True North ${projectBasePoint.angleToTrueNorthDeg} deg`
        : 'Project Base Point and Survey Point',
      statusFor(Boolean(projectBasePoint && surveyPoint), Boolean(projectBasePoint || surveyPoint)),
    ),
    setupItem(
      'sun',
      'Location / sun',
      sunSettings
        ? `${sunSettings.latitudeDeg.toFixed(4)}, ${sunSettings.longitudeDeg.toFixed(4)}`
        : 'Latitude, longitude, time',
      statusFor(Boolean(sunSettings)),
    ),
    setupItem(
      'phases',
      'Phases',
      `${phases.length} phases`,
      statusFor(phases.length >= 2, phases.length > 0),
    ),
    setupItem('links', 'Links', `${links.length} linked/imported resources`, statusFor(true)),
    setupItem(
      'templates',
      'Templates',
      'Project template source and save-as-template flow',
      statusFor(false),
    ),
    setupItem(
      'standards',
      'Standards',
      `${all.filter((e) => e.kind === 'view_template').length} view templates, ${all.filter((e) => e.kind === 'hatch_pattern_def').length} hatch patterns`,
      statusFor(
        all.some((e) => e.kind === 'view_template'),
        all.some((e) => e.kind === 'hatch_pattern_def'),
      ),
    ),
  ];
  const activeIndex = Math.max(
    0,
    checklist.findIndex((item) => item.key === activeSection),
  );
  const activeItem = checklist[activeIndex] ?? checklist[0];
  const readyCount = checklist.filter((item) => item.status === 'ready').length;
  const needsWorkCount = checklist.length - readyCount;
  const nextNeedsWork = checklist.find((item) => item.status !== 'ready');
  const canGoPrevious = activeIndex > 0;
  const canGoNext = activeIndex < checklist.length - 1;
  const goPrevious = () => {
    if (canGoPrevious) setActiveSection(checklist[activeIndex - 1].key);
  };
  const goNext = () => {
    if (canGoNext) setActiveSection(checklist[activeIndex + 1].key);
  };

  async function runCommands(commands: Record<string, unknown>[], done: string) {
    setBusy(true);
    setMessage(null);
    try {
      for (const cmd of commands) {
        await onSemanticCommand(cmd);
      }
      setMessage(done);
    } finally {
      setBusy(false);
    }
  }

  async function saveProjectInfo() {
    const sid = projectSettings?.id ?? 'project_settings';
    const commands: Record<string, unknown>[] = projectSettings
      ? []
      : [
          {
            type: 'upsertProjectSettings',
            id: sid,
            lengthUnit: infoDraft.lengthUnit,
            angularUnitDeg: infoDraft.angularUnitDeg,
            displayLocale: infoDraft.displayLocale,
          },
        ];
    const fields: Array<[string, string]> = [
      ['name', infoDraft.name],
      ['projectNumber', infoDraft.projectNumber],
      ['clientName', infoDraft.clientName],
      ['projectAddress', infoDraft.projectAddress],
      ['projectStatus', infoDraft.projectStatus],
      ['lengthUnit', infoDraft.lengthUnit],
      ['angularUnitDeg', infoDraft.angularUnitDeg],
      ['displayLocale', infoDraft.displayLocale],
    ];
    for (const [key, value] of fields) {
      commands.push({ type: 'updateElementProperty', elementId: sid, key, value });
    }
    await runCommands(commands, 'Project information and units updated.');
  }

  async function generateStoreys() {
    const count = Math.max(1, Math.min(80, Math.floor(Number(storeyDraft.count) || 1)));
    const base = Number(storeyDraft.baseElevationMm);
    const step = Number(storeyDraft.floorToFloorMm);
    if (!Number.isFinite(base) || !Number.isFinite(step) || step <= 0) {
      setMessage('Storey setup needs numeric base elevation and positive floor-to-floor height.');
      return;
    }
    const commands: Record<string, unknown>[] = [];
    const generatedLevelIds: string[] = [];
    const newlyCreatedLevelIds = new Set<string>();
    const prefix = storeyDraft.namePrefix.trim() || 'Level';
    const stamp = Date.now().toString(36);
    for (let index = 0; index < count; index += 1) {
      const existing = levels[index];
      const levelId = existing?.id ?? `lvl-${slugToken(prefix)}-${index + 1}-${stamp}`;
      const levelName = index === 0 ? 'Ground Floor' : `${prefix} ${index + 1}`;
      const elevationMm = Math.round(base + index * step);
      generatedLevelIds.push(levelId);
      if (existing) {
        if (existing.name !== levelName) {
          commands.push({
            type: 'updateElementProperty',
            elementId: existing.id,
            key: 'name',
            value: levelName,
          });
        }
        if (Math.abs(existing.elevationMm - elevationMm) > 0.5) {
          commands.push({
            type: 'moveLevelElevation',
            levelId: existing.id,
            elevationMm,
          });
        }
      } else {
        newlyCreatedLevelIds.add(levelId);
        commands.push({
          type: 'createLevel',
          id: levelId,
          name: levelName,
          elevationMm,
          alsoCreatePlanView: true,
        });
      }
    }
    for (const levelId of generatedLevelIds) {
      if (!newlyCreatedLevelIds.has(levelId) && !planViewsByLevel.has(levelId)) {
        const level = levels.find((l) => l.id === levelId);
        commands.push({
          type: 'upsertPlanView',
          id: `pv-${slugToken(level?.name ?? levelId)}-${stamp}`,
          name: `${level?.name ?? levelId} plan`,
          levelId,
          planViewSubtype: 'floor_plan',
          discipline: 'architecture',
        });
      }
    }
    if (commands.length === 0) {
      setMessage('Storeys already match the requested setup.');
      return;
    }
    await runCommands(commands, `Generated ${count} storeys and ensured floor plans.`);
  }

  function draftForLevel(level: Extract<Element, { kind: 'level' }>) {
    return (
      levelDrafts[level.id] ?? {
        name: level.name,
        elevationMm: String(Math.round(level.elevationMm)),
      }
    );
  }

  function updateLevelDraft(
    levelId: string,
    patch: Partial<{ name: string; elevationMm: string }>,
  ) {
    setLevelDrafts((drafts) => ({
      ...drafts,
      [levelId]: {
        name: drafts[levelId]?.name ?? levels.find((level) => level.id === levelId)?.name ?? '',
        elevationMm:
          drafts[levelId]?.elevationMm ??
          String(Math.round(levels.find((level) => level.id === levelId)?.elevationMm ?? 0)),
        ...patch,
      },
    }));
  }

  function draftElevation(level: Extract<Element, { kind: 'level' }>): number {
    const value = Number(draftForLevel(level).elevationMm);
    return Number.isFinite(value) ? value : NaN;
  }

  function heightAbovePrevious(index: number): string {
    if (index === 0) return '';
    const previous = draftElevation(levels[index - 1]);
    const current = draftElevation(levels[index]);
    if (!Number.isFinite(previous) || !Number.isFinite(current)) return '';
    return String(Math.round(current - previous));
  }

  function updateHeightAbovePrevious(index: number, value: string) {
    const level = levels[index];
    const previous = levels[index - 1];
    if (!level || !previous) return;
    if (!value.trim()) {
      updateLevelDraft(level.id, { elevationMm: '' });
      return;
    }
    const previousElevation = draftElevation(previous);
    const height = Number(value);
    if (!Number.isFinite(previousElevation) || !Number.isFinite(height)) {
      updateLevelDraft(level.id, { elevationMm: value });
      return;
    }
    updateLevelDraft(level.id, { elevationMm: String(Math.round(previousElevation + height)) });
  }

  async function saveLevelTable() {
    const commands: Record<string, unknown>[] = [];
    const stamp = Date.now().toString(36);
    for (const level of levels) {
      const draft = draftForLevel(level);
      const name = draft.name.trim();
      const elevationMm = Number(draft.elevationMm);
      if (!name || !Number.isFinite(elevationMm)) {
        setMessage('Each level needs a name and numeric elevation.');
        return;
      }
      if (name !== level.name) {
        commands.push({
          type: 'updateElementProperty',
          elementId: level.id,
          key: 'name',
          value: name,
        });
      }
      if (Math.abs(level.elevationMm - elevationMm) > 0.5) {
        commands.push({
          type: 'moveLevelElevation',
          levelId: level.id,
          elevationMm: Math.round(elevationMm),
        });
      }
      if (!planViewsByLevel.has(level.id)) {
        commands.push({
          type: 'upsertPlanView',
          id: `pv-${slugToken(name)}-${stamp}`,
          name: `${name} plan`,
          levelId: level.id,
          planViewSubtype: 'floor_plan',
          discipline: 'architecture',
        });
      }
    }
    if (commands.length === 0) {
      setMessage('Level table already matches the model.');
      return;
    }
    await runCommands(commands, 'Level table updated.');
  }

  function alphaLabel(index: number): string {
    let n = index + 1;
    let label = '';
    while (n > 0) {
      n -= 1;
      label = String.fromCharCode(65 + (n % 26)) + label;
      n = Math.floor(n / 26);
    }
    return label;
  }

  async function generateGridSystem() {
    const xCount = Math.max(0, Math.min(60, Math.floor(Number(gridDraft.xCount) || 0)));
    const yCount = Math.max(0, Math.min(60, Math.floor(Number(gridDraft.yCount) || 0)));
    const spacing = Number(gridDraft.spacingMm);
    const extent = Number(gridDraft.extentMm);
    const originX = Number(gridDraft.originX);
    const originY = Number(gridDraft.originY);
    if (
      ![spacing, extent, originX, originY].every(Number.isFinite) ||
      spacing <= 0 ||
      extent <= 0
    ) {
      setMessage('Grid setup needs numeric origin, positive spacing, and positive extent.');
      return;
    }
    if (xCount + yCount <= 0) {
      setMessage('Grid setup needs at least one grid line.');
      return;
    }
    const commands: Record<string, unknown>[] = [];
    const stamp = Date.now().toString(36);
    for (let index = 0; index < xCount; index += 1) {
      const x = Math.round(originX + index * spacing);
      const label = String(index + 1);
      commands.push({
        type: 'createGridLine',
        id: `grid-x-${label}-${stamp}`,
        name: `Grid ${label}`,
        label,
        start: { xMm: x, yMm: Math.round(originY) },
        end: { xMm: x, yMm: Math.round(originY + extent) },
      });
    }
    for (let index = 0; index < yCount; index += 1) {
      const y = Math.round(originY + index * spacing);
      const label = alphaLabel(index);
      commands.push({
        type: 'createGridLine',
        id: `grid-y-${label.toLowerCase()}-${stamp}`,
        name: `Grid ${label}`,
        label,
        start: { xMm: Math.round(originX), yMm: y },
        end: { xMm: Math.round(originX + extent), yMm: y },
      });
    }
    await runCommands(commands, `Generated ${xCount + yCount} grid lines.`);
  }

  async function savePositioning() {
    const commands: Record<string, unknown>[] = [];
    const baseX = Number(positionDraft.baseX);
    const baseY = Number(positionDraft.baseY);
    const angle = Number(positionDraft.angleToTrueNorthDeg);
    const surveyX = Number(positionDraft.surveyX);
    const surveyY = Number(positionDraft.surveyY);
    const surveyElevation = Number(positionDraft.surveyElevationMm);
    if (![baseX, baseY, angle, surveyX, surveyY, surveyElevation].every(Number.isFinite)) {
      setMessage('Positioning fields must be numeric.');
      return;
    }
    if (projectBasePoint) {
      commands.push({
        type: 'updateElementProperty',
        elementId: projectBasePoint.id,
        key: 'positionMm',
        value: { xMm: baseX, yMm: baseY, zMm: projectBasePoint.positionMm.zMm },
      });
      commands.push({
        type: 'rotateProjectBasePoint',
        angleToTrueNorthDeg: angle,
      });
    } else {
      commands.push({
        type: 'createProjectBasePoint',
        id: 'project_base_point',
        positionMm: { xMm: baseX, yMm: baseY, zMm: 0 },
        angleToTrueNorthDeg: angle,
      });
    }
    if (surveyPoint) {
      commands.push({
        type: 'moveSurveyPoint',
        positionMm: { xMm: surveyX, yMm: surveyY, zMm: surveyPoint.positionMm.zMm },
        sharedElevationMm: surveyElevation,
      });
    } else {
      commands.push({
        type: 'createSurveyPoint',
        id: 'survey_point',
        positionMm: { xMm: surveyX, yMm: surveyY, zMm: 0 },
        sharedElevationMm: surveyElevation,
      });
    }
    await runCommands(commands, 'Positioning updated.');
  }

  async function saveSunSettings() {
    const latitude = Number(sunDraft.latitudeDeg);
    const longitude = Number(sunDraft.longitudeDeg);
    const hours = Math.max(0, Math.min(23, Math.floor(Number(sunDraft.hours) || 0)));
    const minutes = Math.max(0, Math.min(59, Math.floor(Number(sunDraft.minutes) || 0)));
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || !sunDraft.dateIso.trim()) {
      setMessage('Location setup needs numeric latitude, longitude, and a date.');
      return;
    }
    const radiusM = Math.min(1000, Math.max(50, Number(sunDraft.contextRadiusM) || 300));
    const payload = {
      latitudeDeg: latitude,
      longitudeDeg: longitude,
      dateIso: sunDraft.dateIso,
      timeOfDay: { hours, minutes },
      daylightSavingStrategy: sunDraft.daylightSavingStrategy,
    };
    const sid = projectSettings?.id ?? 'project_settings';
    await runCommands(
      [
        sunSettings
          ? { type: 'updateSunSettings', ...payload }
          : { type: 'createSunSettings', id: 'sun_settings', ...payload },
        {
          type: 'updateElementProperty',
          elementId: sid,
          key: 'georeference',
          value: { anchorLat: latitude, anchorLon: longitude, contextRadiusM: radiusM },
        },
      ],
      'Location and sun settings updated.',
    );
  }

  async function handleGeoSearch() {
    const q = geoSearchDraft.trim();
    if (!q) return;
    setGeoSearchBusy(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1`,
        { headers: { 'Accept-Language': 'en' } },
      );
      const results = (await res.json()) as Array<{ lat: string; lon: string }>;
      const first = results[0];
      if (first) {
        setSunDraft((d) => ({
          ...d,
          latitudeDeg: parseFloat(first.lat).toFixed(6),
          longitudeDeg: parseFloat(first.lon).toFixed(6),
        }));
      } else {
        setMessage('No results found for that address.');
      }
    } catch {
      setMessage('Address search failed.');
    } finally {
      setGeoSearchBusy(false);
    }
  }

  async function createDefaultPhases() {
    const existingNames = new Set(phases.map((phase) => phase.name.trim().toLowerCase()));
    const commands: Record<string, unknown>[] = [];
    if (!existingNames.has('existing')) {
      commands.push({ type: 'createPhase', id: 'phase-existing', name: 'Existing', ord: 0 });
    }
    if (!existingNames.has('new construction')) {
      commands.push({
        type: 'createPhase',
        id: 'phase-new',
        name: 'New Construction',
        ord: Math.max(1, phases.length),
      });
    }
    if (commands.length === 0) {
      setMessage('Default phases already exist.');
      return;
    }
    await runCommands(commands, 'Default phases created.');
  }

  async function createPhase() {
    const name = phaseDraft.name.trim();
    if (!name) {
      setMessage('Phase name is required.');
      return;
    }
    await runCommands(
      [
        {
          type: 'createPhase',
          id: `phase-${slugToken(name)}-${Date.now().toString(36)}`,
          name,
          ord: phases.length,
        },
      ],
      `Phase "${name}" created.`,
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/20 p-4 sm:items-center"
      data-testid="project-setup-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="project-setup-title"
        data-testid="project-setup-dialog"
        className="flex h-[min(820px,calc(100vh-32px))] w-full max-w-6xl flex-col rounded border border-border bg-surface shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div>
            <h2 id="project-setup-title" className="text-sm font-semibold text-foreground">
              Project Setup
            </h2>
            <p className="text-[11px] text-muted">
              {modelId ? `Model ${modelId} - Rev ${revision ?? 0}` : 'Local project'} - Levels,
              units, coordinates, phases, and setup health
            </p>
          </div>
          <button
            type="button"
            data-testid="project-setup-close"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded border border-border text-muted hover:bg-surface-2 hover:text-foreground"
            aria-label="Close project setup"
          >
            x
          </button>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 gap-0 overflow-hidden lg:grid-cols-[280px_1fr]">
          <aside className="min-h-0 overflow-auto border-b border-border p-3 lg:border-r lg:border-b-0">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="text-[11px] font-semibold uppercase text-muted">Setup Checklist</div>
              <div className="font-mono text-[10px] text-muted">
                {readyCount}/{checklist.length}
              </div>
            </div>
            <div className="mb-3 h-1.5 overflow-hidden rounded bg-muted/20">
              <div
                className="h-full bg-accent"
                style={{ width: `${Math.round((readyCount / checklist.length) * 100)}%` }}
              />
            </div>
            {nextNeedsWork ? (
              <button
                type="button"
                className="mb-3 w-full rounded border border-border bg-surface px-2 py-1.5 text-left text-[11px] font-medium text-foreground hover:bg-surface-strong"
                onClick={() => setActiveSection(nextNeedsWork.key)}
              >
                Next incomplete: {nextNeedsWork.label}
              </button>
            ) : null}
            <div className="space-y-2">
              {checklist.map((item, index) => {
                const active = item.key === activeSection;
                return (
                  <button
                    type="button"
                    key={item.key}
                    className={`w-full rounded border p-2 text-left ${
                      active
                        ? 'border-accent bg-accent/10'
                        : 'border-border bg-background hover:bg-surface-strong'
                    }`}
                    aria-current={active ? 'step' : undefined}
                    onClick={() => setActiveSection(item.key)}
                    data-active={active ? 'true' : 'false'}
                    data-testid={`project-setup-check-${slugToken(item.label)}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="font-mono text-[10px] text-muted">
                          {String(index + 1).padStart(2, '0')}
                        </span>
                        <span className="truncate text-xs font-medium text-foreground">
                          {item.label}
                        </span>
                      </div>
                      <StatusPill status={item.status} />
                    </div>
                    <div className="mt-1 text-[10px] leading-snug text-muted">{item.detail}</div>
                  </button>
                );
              })}
            </div>
          </aside>

          <main className="min-h-0 overflow-auto p-4">
            <div className="mx-auto flex max-w-3xl flex-col gap-4">
              <div className="rounded border border-border bg-background px-3 py-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-[10px] font-semibold uppercase text-muted">
                      Step {activeIndex + 1} of {checklist.length}
                    </div>
                    <h3 className="mt-0.5 text-sm font-semibold text-foreground">
                      {activeItem.label}
                    </h3>
                    <p className="mt-1 text-[11px] text-muted">{activeItem.detail}</p>
                  </div>
                  <StatusPill status={activeItem.status} />
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={!canGoPrevious}
                    className="rounded border border-border px-2 py-1 text-xs text-foreground hover:bg-surface-strong disabled:opacity-40"
                    onClick={goPrevious}
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    disabled={!canGoNext}
                    className="rounded border border-border px-2 py-1 text-xs text-foreground hover:bg-surface-strong disabled:opacity-40"
                    onClick={goNext}
                  >
                    Next
                  </button>
                  {nextNeedsWork ? (
                    <button
                      type="button"
                      className="rounded border border-border bg-surface px-2 py-1 text-xs text-foreground hover:bg-surface-strong"
                      onClick={() => setActiveSection(nextNeedsWork.key)}
                    >
                      Go to next incomplete
                    </button>
                  ) : null}
                  <div className="ml-auto self-center text-[10px] text-muted">
                    {needsWorkCount} item{needsWorkCount === 1 ? '' : 's'} need work
                  </div>
                </div>
              </div>
              {activeSection === 'project-info' || activeSection === 'units' ? (
                <section className="rounded border border-border bg-background p-3">
                  <h3 className="text-xs font-semibold text-foreground">Project Info & Units</h3>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <SetupInput
                      label="Project name"
                      value={infoDraft.name}
                      onChange={(name) => setInfoDraft((d) => ({ ...d, name }))}
                    />
                    <SetupInput
                      label="Project number"
                      value={infoDraft.projectNumber}
                      onChange={(projectNumber) => setInfoDraft((d) => ({ ...d, projectNumber }))}
                    />
                    <SetupInput
                      label="Client"
                      value={infoDraft.clientName}
                      onChange={(clientName) => setInfoDraft((d) => ({ ...d, clientName }))}
                    />
                    <SetupInput
                      label="Status"
                      value={infoDraft.projectStatus}
                      onChange={(projectStatus) => setInfoDraft((d) => ({ ...d, projectStatus }))}
                    />
                    <label className="flex flex-col gap-1 text-[11px] text-muted sm:col-span-2">
                      Address
                      <textarea
                        value={infoDraft.projectAddress}
                        onChange={(e) =>
                          setInfoDraft((d) => ({ ...d, projectAddress: e.currentTarget.value }))
                        }
                        className="min-h-16 rounded border border-border bg-surface px-2 py-1 text-xs text-foreground"
                      />
                    </label>
                    <SetupSelect
                      label="Length unit"
                      value={infoDraft.lengthUnit}
                      options={LENGTH_UNITS}
                      onChange={(lengthUnit) => setInfoDraft((d) => ({ ...d, lengthUnit }))}
                    />
                    <SetupSelect
                      label="Locale"
                      value={infoDraft.displayLocale}
                      options={LOCALES}
                      onChange={(displayLocale) => setInfoDraft((d) => ({ ...d, displayLocale }))}
                    />
                  </div>
                  <SetupButton busy={busy} onClick={() => void saveProjectInfo()}>
                    Save Project Info
                  </SetupButton>
                </section>
              ) : null}

              {activeSection === 'levels' ? (
                <section className="rounded border border-border bg-background p-3">
                  <h3 className="text-xs font-semibold text-foreground">Levels / Storeys</h3>
                  <div className="mt-3 grid gap-2 sm:grid-cols-4">
                    <SetupInput
                      label="Storeys"
                      value={storeyDraft.count}
                      type="number"
                      onChange={(count) => setStoreyDraft((d) => ({ ...d, count }))}
                    />
                    <SetupInput
                      label="Base elev. mm"
                      value={storeyDraft.baseElevationMm}
                      type="number"
                      onChange={(baseElevationMm) =>
                        setStoreyDraft((d) => ({ ...d, baseElevationMm }))
                      }
                    />
                    <SetupInput
                      label="Floor-to-floor mm"
                      value={storeyDraft.floorToFloorMm}
                      type="number"
                      onChange={(floorToFloorMm) =>
                        setStoreyDraft((d) => ({ ...d, floorToFloorMm }))
                      }
                    />
                    <SetupInput
                      label="Name prefix"
                      value={storeyDraft.namePrefix}
                      onChange={(namePrefix) => setStoreyDraft((d) => ({ ...d, namePrefix }))}
                    />
                  </div>
                  <div className="mt-3 max-h-64 overflow-auto rounded border border-border">
                    <table className="w-full border-collapse text-left text-[11px]">
                      <thead className="bg-muted/30 text-muted">
                        <tr>
                          <th className="p-1.5">Level name</th>
                          <th className="p-1.5 text-right">Elevation mm</th>
                          <th className="p-1.5 text-right">Height above</th>
                          <th className="p-1.5 text-right">Plans</th>
                        </tr>
                      </thead>
                      <tbody>
                        {levels.map((level, index) => {
                          const draft = draftForLevel(level);
                          return (
                            <tr key={level.id} className="border-t border-border">
                              <td className="p-1.5 align-top">
                                <input
                                  aria-label={`Level name ${level.name}`}
                                  value={draft.name}
                                  onChange={(event) =>
                                    updateLevelDraft(level.id, { name: event.currentTarget.value })
                                  }
                                  className="h-7 w-full rounded border border-border bg-surface px-2 text-[11px] font-medium text-foreground"
                                />
                                <div className="mt-1 font-mono text-[9px] text-muted">
                                  {level.id}
                                </div>
                              </td>
                              <td className="p-1.5 align-top">
                                <input
                                  aria-label={`Elevation mm ${level.name}`}
                                  type="number"
                                  value={draft.elevationMm}
                                  onChange={(event) =>
                                    updateLevelDraft(level.id, {
                                      elevationMm: event.currentTarget.value,
                                    })
                                  }
                                  className="ml-auto h-7 w-28 rounded border border-border bg-surface px-2 text-right font-mono text-[11px] text-foreground"
                                />
                              </td>
                              <td className="p-1.5 align-top">
                                {index === 0 ? (
                                  <div className="h-7 rounded border border-transparent px-2 py-1 text-right text-[11px] text-muted">
                                    Base
                                  </div>
                                ) : (
                                  <input
                                    aria-label={`Height above previous ${level.name}`}
                                    type="number"
                                    value={heightAbovePrevious(index)}
                                    onChange={(event) =>
                                      updateHeightAbovePrevious(index, event.currentTarget.value)
                                    }
                                    className="ml-auto h-7 w-28 rounded border border-border bg-surface px-2 text-right font-mono text-[11px] text-foreground"
                                  />
                                )}
                              </td>
                              <td className="p-1.5 text-right align-top font-mono">
                                {planViewsByLevel.get(level.id) ?? 0}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <SetupButton busy={busy} onClick={() => void saveLevelTable()}>
                      Save Level Table
                    </SetupButton>
                    <SetupButton busy={busy} onClick={() => void generateStoreys()}>
                      Apply Storey Setup
                    </SetupButton>
                  </div>
                </section>
              ) : null}

              {activeSection === 'grids' ? (
                <section className="rounded border border-border bg-background p-3">
                  <h3 className="text-xs font-semibold text-foreground">Grid System</h3>
                  <div className="mt-3 grid gap-2 sm:grid-cols-3">
                    <SetupInput
                      label="X grid count"
                      value={gridDraft.xCount}
                      type="number"
                      onChange={(xCount) => setGridDraft((d) => ({ ...d, xCount }))}
                    />
                    <SetupInput
                      label="Y grid count"
                      value={gridDraft.yCount}
                      type="number"
                      onChange={(yCount) => setGridDraft((d) => ({ ...d, yCount }))}
                    />
                    <SetupInput
                      label="Spacing mm"
                      value={gridDraft.spacingMm}
                      type="number"
                      onChange={(spacingMm) => setGridDraft((d) => ({ ...d, spacingMm }))}
                    />
                    <SetupInput
                      label="Extent mm"
                      value={gridDraft.extentMm}
                      type="number"
                      onChange={(extentMm) => setGridDraft((d) => ({ ...d, extentMm }))}
                    />
                    <SetupInput
                      label="Origin X mm"
                      value={gridDraft.originX}
                      type="number"
                      onChange={(originX) => setGridDraft((d) => ({ ...d, originX }))}
                    />
                    <SetupInput
                      label="Origin Y mm"
                      value={gridDraft.originY}
                      type="number"
                      onChange={(originY) => setGridDraft((d) => ({ ...d, originY }))}
                    />
                  </div>
                  <div className="mt-3 max-h-36 overflow-auto rounded border border-border">
                    <table className="w-full border-collapse text-left text-[11px]">
                      <thead className="bg-muted/30 text-muted">
                        <tr>
                          <th className="p-1.5">Label</th>
                          <th className="p-1.5">Name</th>
                          <th className="p-1.5 text-right">Span</th>
                        </tr>
                      </thead>
                      <tbody>
                        {grids.length > 0 ? (
                          grids.map((grid) => (
                            <tr key={grid.id} className="border-t border-border">
                              <td className="p-1.5 font-mono text-foreground">
                                {grid.label || grid.name}
                              </td>
                              <td className="p-1.5 text-foreground">{grid.name}</td>
                              <td className="p-1.5 text-right font-mono">
                                {Math.round(
                                  Math.hypot(
                                    grid.end.xMm - grid.start.xMm,
                                    grid.end.yMm - grid.start.yMm,
                                  ),
                                )}{' '}
                                mm
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td className="p-2 text-muted" colSpan={3}>
                              No grid lines yet.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                  <SetupButton busy={busy} onClick={() => void generateGridSystem()}>
                    Generate Grid System
                  </SetupButton>
                </section>
              ) : null}

              {activeSection === 'positioning' ? (
                <section className="rounded border border-border bg-background p-3">
                  <h3 className="text-xs font-semibold text-foreground">Positioning</h3>
                  <div className="mt-3 grid gap-2 sm:grid-cols-3">
                    <SetupInput
                      label="PBP E/W mm"
                      value={positionDraft.baseX}
                      type="number"
                      onChange={(baseX) => setPositionDraft((d) => ({ ...d, baseX }))}
                    />
                    <SetupInput
                      label="PBP N/S mm"
                      value={positionDraft.baseY}
                      type="number"
                      onChange={(baseY) => setPositionDraft((d) => ({ ...d, baseY }))}
                    />
                    <SetupInput
                      label="True North deg"
                      value={positionDraft.angleToTrueNorthDeg}
                      type="number"
                      onChange={(angleToTrueNorthDeg) =>
                        setPositionDraft((d) => ({ ...d, angleToTrueNorthDeg }))
                      }
                    />
                    <SetupInput
                      label="Survey E/W mm"
                      value={positionDraft.surveyX}
                      type="number"
                      onChange={(surveyX) => setPositionDraft((d) => ({ ...d, surveyX }))}
                    />
                    <SetupInput
                      label="Survey N/S mm"
                      value={positionDraft.surveyY}
                      type="number"
                      onChange={(surveyY) => setPositionDraft((d) => ({ ...d, surveyY }))}
                    />
                    <SetupInput
                      label="Shared elev. mm"
                      value={positionDraft.surveyElevationMm}
                      type="number"
                      onChange={(surveyElevationMm) =>
                        setPositionDraft((d) => ({ ...d, surveyElevationMm }))
                      }
                    />
                  </div>
                  <SetupButton busy={busy} onClick={() => void savePositioning()}>
                    Save Positioning
                  </SetupButton>
                </section>
              ) : null}

              {activeSection === 'sun' ? (
                <section className="rounded border border-border bg-background p-3">
                  <h3 className="text-xs font-semibold text-foreground">Location / Sun</h3>

                  <div className="mt-2 flex gap-1.5">
                    <input
                      className="flex-1 rounded border border-border bg-surface px-2 py-1 text-[11px] text-foreground placeholder:text-muted focus:border-accent focus:outline-none"
                      type="text"
                      placeholder="Search address to fill lat / lon…"
                      value={geoSearchDraft}
                      onChange={(e) => setGeoSearchDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') void handleGeoSearch();
                      }}
                    />
                    <button
                      type="button"
                      className="rounded border border-border bg-surface px-2.5 py-1 text-[11px] text-muted hover:border-accent hover:text-accent disabled:opacity-40"
                      disabled={geoSearchBusy || !geoSearchDraft.trim()}
                      onClick={() => void handleGeoSearch()}
                    >
                      {geoSearchBusy ? '…' : 'Find'}
                    </button>
                  </div>

                  <div className="mt-2 grid gap-2 sm:grid-cols-3">
                    <SetupInput
                      label="Latitude deg"
                      value={sunDraft.latitudeDeg}
                      type="number"
                      onChange={(latitudeDeg) => setSunDraft((d) => ({ ...d, latitudeDeg }))}
                    />
                    <SetupInput
                      label="Longitude deg"
                      value={sunDraft.longitudeDeg}
                      type="number"
                      onChange={(longitudeDeg) => setSunDraft((d) => ({ ...d, longitudeDeg }))}
                    />
                    <SetupInput
                      label="Sun date"
                      value={sunDraft.dateIso}
                      onChange={(dateIso) => setSunDraft((d) => ({ ...d, dateIso }))}
                    />
                    <SetupInput
                      label="Hour"
                      value={sunDraft.hours}
                      type="number"
                      onChange={(hours) => setSunDraft((d) => ({ ...d, hours }))}
                    />
                    <SetupInput
                      label="Minute"
                      value={sunDraft.minutes}
                      type="number"
                      onChange={(minutes) => setSunDraft((d) => ({ ...d, minutes }))}
                    />
                    <SetupSelect
                      label="Daylight saving"
                      value={sunDraft.daylightSavingStrategy}
                      options={DAYLIGHT_SAVING_OPTIONS}
                      onChange={(daylightSavingStrategy) =>
                        setSunDraft((d) => ({ ...d, daylightSavingStrategy }))
                      }
                    />
                    <SetupSelect
                      label="Context radius"
                      value={sunDraft.contextRadiusM}
                      options={[
                        ['100', '100 m'],
                        ['300', '300 m'],
                        ['500', '500 m'],
                        ['1000', '1000 m'],
                      ]}
                      onChange={(contextRadiusM) => setSunDraft((d) => ({ ...d, contextRadiusM }))}
                    />
                  </div>
                  <p className="mt-1.5 text-[10px] text-muted">
                    Lat / lon sets both sun simulation and the OSM site context radius around the
                    house in the 3D viewer.
                  </p>
                  <SetupButton busy={busy} onClick={() => void saveSunSettings()}>
                    Save Location / Sun
                  </SetupButton>
                </section>
              ) : null}

              {activeSection === 'phases' ? (
                <section className="rounded border border-border bg-background p-3">
                  <h3 className="text-xs font-semibold text-foreground">Phases</h3>
                  <div className="mt-3 max-h-36 overflow-auto rounded border border-border">
                    <table className="w-full border-collapse text-left text-[11px]">
                      <thead className="bg-muted/30 text-muted">
                        <tr>
                          <th className="p-1.5">Order</th>
                          <th className="p-1.5">Phase</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...phases]
                          .sort((a, b) => a.ord - b.ord || a.name.localeCompare(b.name))
                          .map((phase) => (
                            <tr key={phase.id} className="border-t border-border">
                              <td className="p-1.5 font-mono text-muted">{phase.ord}</td>
                              <td className="p-1.5 text-foreground">{phase.name}</td>
                            </tr>
                          ))}
                        {phases.length === 0 ? (
                          <tr>
                            <td className="p-2 text-muted" colSpan={2}>
                              No project phases yet.
                            </td>
                          </tr>
                        ) : null}
                      </tbody>
                    </table>
                  </div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]">
                    <SetupInput
                      label="New phase name"
                      value={phaseDraft.name}
                      onChange={(name) => setPhaseDraft({ name })}
                    />
                    <div className="flex items-end gap-2">
                      <SetupButton busy={busy} onClick={() => void createPhase()}>
                        Add Phase
                      </SetupButton>
                    </div>
                  </div>
                  <SetupButton busy={busy} onClick={() => void createDefaultPhases()}>
                    Create Default Phases
                  </SetupButton>
                </section>
              ) : null}

              {activeSection === 'links' ||
              activeSection === 'templates' ||
              activeSection === 'standards' ? (
                <section className="rounded border border-border bg-background p-3">
                  <h3 className="text-xs font-semibold text-foreground">
                    Linked Resources & Standards
                  </h3>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
                    <Metric label="Grid lines" value={String(grids.length)} />
                    <Metric label="Phases" value={String(phases.length)} />
                    <Metric
                      label="View templates"
                      value={String(all.filter((e) => e.kind === 'view_template').length)}
                    />
                    <Metric label="Links/imports" value={String(links.length)} />
                  </div>
                  <div className="mt-3 text-[10px] leading-snug text-muted">
                    Standards already exist in separate material, visibility, view-template, hatch,
                    and type-layer tools. This setup surface tracks whether the project foundation
                    is present before modeling.
                  </div>
                  {onOpenManageLinks ? (
                    <button
                      type="button"
                      className="mt-3 rounded border border-border px-2 py-1 text-xs hover:bg-surface-strong"
                      onClick={onOpenManageLinks}
                    >
                      Manage Links
                    </button>
                  ) : null}
                </section>
              ) : null}
            </div>
            {message ? (
              <div
                className="mt-4 rounded border border-border bg-muted/20 px-3 py-2 text-xs text-foreground"
                data-testid="project-setup-message"
              >
                {message}
              </div>
            ) : null}
          </main>
        </div>
      </div>
    </div>
  );
}

function SetupInput({
  label,
  value,
  onChange,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: 'text' | 'number';
}): JSX.Element {
  return (
    <label className="flex flex-col gap-1 text-[11px] text-muted">
      {label}
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.currentTarget.value)}
        className="h-8 rounded border border-border bg-surface px-2 text-xs text-foreground"
      />
    </label>
  );
}

function SetupSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly (readonly [string, string])[];
  onChange: (value: string) => void;
}): JSX.Element {
  return (
    <label className="flex flex-col gap-1 text-[11px] text-muted">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.currentTarget.value)}
        className="h-8 rounded border border-border bg-surface px-2 text-xs text-foreground"
      >
        {options.map(([optionValue, labelText]) => (
          <option key={optionValue} value={optionValue}>
            {labelText}
          </option>
        ))}
      </select>
    </label>
  );
}

function SetupButton({
  busy,
  onClick,
  children,
}: {
  busy: boolean;
  onClick: () => void;
  children: string;
}): JSX.Element {
  return (
    <button
      type="button"
      disabled={busy}
      onClick={onClick}
      className="mt-3 rounded border border-border bg-surface px-3 py-1.5 text-xs font-medium text-foreground hover:bg-surface-strong disabled:cursor-wait disabled:opacity-60"
    >
      {busy ? 'Applying...' : children}
    </button>
  );
}

function Metric({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="rounded border border-border bg-surface p-2">
      <div className="text-[10px] uppercase text-muted">{label}</div>
      <div className="mt-1 font-mono text-sm text-foreground">{value}</div>
    </div>
  );
}
