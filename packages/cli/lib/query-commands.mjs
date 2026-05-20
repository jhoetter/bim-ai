import { base, fetchJson, fetchJsonResponse } from './api-client.mjs';
import { flagValue, parseCsv, parseJsonObjectFlag, parseNumber } from './cli-args.mjs';

export function queryGeometrySummary(element) {
  if (!element || typeof element !== 'object') return null;
  if (element.kind === 'wall' && element.start && element.end) {
    return {
      representation: 'line_extrusion',
      startMm: [element.start.xMm, element.start.yMm],
      endMm: [element.end.xMm, element.end.yMm],
      heightMm: element.heightMm ?? null,
      thicknessMm: element.thicknessMm ?? null,
    };
  }
  const boundary = element.boundaryMm ?? element.footprintMm ?? element.outlineMm;
  if (Array.isArray(boundary)) {
    return {
      representation: 'plan_boundary',
      boundaryMm: boundary.map((point) => [point.xMm ?? point[0], point.yMm ?? point[1]]),
      thicknessMm: element.thicknessMm ?? null,
    };
  }
  if (element.camera) return { representation: 'camera', camera: element.camera };
  return null;
}

export function bboxForElement(element) {
  const points = [];
  if (element?.start) points.push(element.start);
  if (element?.end) points.push(element.end);
  for (const key of ['boundaryMm', 'footprintMm', 'outlineMm']) {
    if (Array.isArray(element?.[key])) points.push(...element[key]);
  }
  if (!points.length) return null;
  const xs = points.map((point) => Number(point.xMm ?? point[0])).filter(Number.isFinite);
  const ys = points.map((point) => Number(point.yMm ?? point[1])).filter(Number.isFinite);
  if (!xs.length || !ys.length) return null;
  const z0 = Number(element.elevationMm ?? element.baseElevationMm ?? 0);
  const z1 = z0 + Number(element.heightMm ?? element.thicknessMm ?? 0);
  return [Math.min(...xs), Math.min(...ys), z0, Math.max(...xs), Math.max(...ys), z1];
}

export function bboxIntersects(a, b) {
  if (!a || !b || a.length !== 6 || b.length !== 6) return false;
  return (
    a[0] <= b[3] && a[3] >= b[0] && a[1] <= b[4] && a[4] >= b[1] && a[2] <= b[5] && a[5] >= b[2]
  );
}

export function bboxContains(a, b) {
  if (!a || !b || a.length !== 6 || b.length !== 6) return false;
  return (
    a[0] <= b[0] && a[1] <= b[1] && a[2] <= b[2] && a[3] >= b[3] && a[4] >= b[4] && a[5] >= b[5]
  );
}

export function elementMatchesQuery(element, filter) {
  if (filter.ids?.length && !filter.ids.includes(element.id)) return false;
  if (filter.kinds?.length && !filter.kinds.includes(element.kind)) return false;
  if (
    filter.levelIds?.length &&
    !filter.levelIds.includes(element.levelId ?? element.referenceLevelId)
  )
    return false;
  if (filter.typeIds?.length) {
    const ids = [
      element.typeId,
      element.wallTypeId,
      element.floorTypeId,
      element.roofTypeId,
      element.familyTypeId,
    ].filter(Boolean);
    if (!ids.some((id) => filter.typeIds.includes(id))) return false;
  }
  if (filter.createdBy && element.createdBy !== filter.createdBy) return false;
  if (filter.text) {
    const text = JSON.stringify([
      element.id,
      element.name,
      element.kind,
      element.mark ?? '',
    ]).toLowerCase();
    if (!text.includes(String(filter.text).toLowerCase())) return false;
  }
  if (filter.properties) {
    for (const [key, expected] of Object.entries(filter.properties)) {
      if (element[key] !== expected) return false;
    }
  }
  const bbox = bboxForElement(element);
  if (filter.bboxIntersectsMm && !bboxIntersects(bbox, filter.bboxIntersectsMm)) return false;
  if (filter.bboxContainsMm && !bboxContains(filter.bboxContainsMm, bbox)) return false;
  return true;
}

export function projectElementForQuery(element, include) {
  const row = {
    id: element.id,
    kind: element.kind,
    name: element.name ?? null,
    levelId: element.levelId ?? element.referenceLevelId ?? null,
    typeId:
      element.typeId ??
      element.wallTypeId ??
      element.floorTypeId ??
      element.roofTypeId ??
      element.familyTypeId ??
      null,
    bboxMm: bboxForElement(element),
  };
  if (include.includes('geometrySummary')) row.geometrySummary = queryGeometrySummary(element);
  if (include.includes('hostRefs')) {
    row.hostRefs = {
      wallId: element.wallId ?? element.hostWallId ?? null,
      floorId: element.hostFloorId ?? null,
      roofId: element.hostRoofId ?? null,
    };
  }
  if (include.includes('scheduleSummary')) {
    row.scheduleSummary = {
      mark: element.mark ?? null,
      familyTypeId: element.familyTypeId ?? null,
      roomId: element.roomId ?? null,
    };
  }
  if (include.includes('raw')) row.raw = element;
  return row;
}

export async function cmdQuerySummary(modelId) {
  const json = await fetchJson('GET', `${base}/api/models/${encodeURIComponent(modelId)}/summary`);
  console.log(JSON.stringify(json, null, 2));
}

export async function cmdQueryElements(modelId, args) {
  const snap = await fetchJson('GET', `${base}/api/models/${encodeURIComponent(modelId)}/snapshot`);
  const elements = snap.elements && typeof snap.elements === 'object' ? snap.elements : {};
  const filter = {
    ids: parseCsv(flagValue(args, '--ids')),
    kinds: parseCsv(flagValue(args, ['--kinds', '--kind'])),
    levelIds: parseCsv(flagValue(args, ['--level-ids', '--level'])),
    typeIds: parseCsv(flagValue(args, ['--type-ids', '--type'])),
    createdBy: flagValue(args, '--created-by'),
    text: flagValue(args, '--text'),
    properties: parseJsonObjectFlag(flagValue(args, '--properties'), '--properties'),
  };
  const bboxIntersectsArg = flagValue(args, '--bbox-intersects');
  const bboxContainsArg = flagValue(args, '--bbox-contains');
  if (bboxIntersectsArg) filter.bboxIntersectsMm = parseCsv(bboxIntersectsArg).map(Number);
  if (bboxContainsArg) filter.bboxContainsMm = parseCsv(bboxContainsArg).map(Number);
  const include = parseCsv(flagValue(args, '--include') ?? 'geometrySummary,hostRefs');
  const limit = parseNumber(flagValue(args, '--limit'), 50);
  const rows = Object.values(elements)
    .filter((element) => element && typeof element === 'object')
    .filter((element) => elementMatchesQuery(element, filter))
    .slice(0, limit)
    .map((element) => projectElementForQuery(element, include));
  console.log(
    JSON.stringify(
      {
        ok: true,
        modelId,
        revision: snap.revision,
        data: { elements: rows },
        warnings: [],
        nextCursor: null,
      },
      null,
      2,
    ),
  );
}

export async function cmdQueryLevels(modelId, args) {
  const snap = await fetchJson('GET', `${base}/api/models/${encodeURIComponent(modelId)}/snapshot`);
  const elements = snap.elements && typeof snap.elements === 'object' ? snap.elements : {};
  const include = parseCsv(flagValue(args, '--include'));
  const planViews = Object.values(elements).filter((e) => e?.kind === 'plan_view');
  const levels = Object.values(elements)
    .filter((e) => e?.kind === 'level')
    .map((level) => ({
      id: level.id,
      name: level.name ?? null,
      elevationMm: level.elevationMm ?? null,
      ...(include.includes('planViews')
        ? { planViewIds: planViews.filter((v) => v.levelId === level.id).map((v) => v.id) }
        : {}),
      ...(include.includes('constraints')
        ? {
            constraints: {
              usedByElementCount: Object.values(elements).filter(
                (e) => e?.levelId === level.id || e?.referenceLevelId === level.id,
              ).length,
            },
          }
        : {}),
    }));
  console.log(
    JSON.stringify({ ok: true, modelId, revision: snap.revision, data: { levels } }, null, 2),
  );
}

export async function cmdQueryTypes(modelId, args) {
  const snap = await fetchJson('GET', `${base}/api/models/${encodeURIComponent(modelId)}/snapshot`);
  const elements = snap.elements && typeof snap.elements === 'object' ? snap.elements : {};
  const categories = parseCsv(flagValue(args, ['--categories', '--category']));
  const kinds = parseCsv(flagValue(args, ['--kinds', '--kind']));
  const text = flagValue(args, '--text');
  const types = Object.values(elements)
    .filter((e) => e && typeof e === 'object')
    .filter((e) => String(e.kind ?? '').includes('type') || ['material', 'family'].includes(e.kind))
    .filter(
      (e) =>
        !categories.length ||
        categories.includes(e.category ?? String(e.kind).replace(/_?type$/, '')),
    )
    .filter((e) => !kinds.length || kinds.includes(e.kind))
    .filter((e) => !text || JSON.stringify(e).toLowerCase().includes(String(text).toLowerCase()))
    .map((e) => ({
      id: e.id,
      kind: e.kind,
      category: e.category ?? String(e.kind).replace(/_?type$/, ''),
      name: e.name ?? null,
      parameters: e.parameters ?? {
        thicknessMm: e.thicknessMm ?? undefined,
        widthMm: e.widthMm ?? undefined,
        heightMm: e.heightMm ?? undefined,
      },
      materialIds: e.materialIds ?? [],
    }));
  console.log(
    JSON.stringify({ ok: true, modelId, revision: snap.revision, data: { types } }, null, 2),
  );
}

export async function cmdQueryViews(modelId, args) {
  const snap = await fetchJson('GET', `${base}/api/models/${encodeURIComponent(modelId)}/snapshot`);
  const elements = snap.elements && typeof snap.elements === 'object' ? snap.elements : {};
  const kinds = parseCsv(flagValue(args, ['--kinds', '--kind']));
  const levelIds = parseCsv(flagValue(args, ['--level-ids', '--level']));
  const text = flagValue(args, '--text');
  const viewKinds = new Set([
    'plan_view',
    'viewpoint',
    'saved_view',
    'section_view',
    'elevation_view',
    'sheet',
    'schedule',
    'view_template',
  ]);
  const views = Object.values(elements)
    .filter((e) => e && typeof e === 'object' && viewKinds.has(e.kind))
    .filter((e) => !kinds.length || kinds.includes(e.kind))
    .filter((e) => !levelIds.length || levelIds.includes(e.levelId))
    .filter(
      (e) =>
        !text ||
        JSON.stringify([e.id, e.name, e.kind]).toLowerCase().includes(String(text).toLowerCase()),
    )
    .map((e) => ({
      id: e.id,
      kind: e.kind,
      name: e.name ?? null,
      levelId: e.levelId ?? null,
      scale: e.scale ?? null,
      raw: e,
    }));
  console.log(
    JSON.stringify({ ok: true, modelId, revision: snap.revision, data: { views } }, null, 2),
  );
}

export async function cmdQueryHosts(modelId, args) {
  await cmdQueryElements(modelId, [
    '--kind',
    flagValue(args, '--host-kind') ?? 'wall',
    '--include',
    'geometrySummary,hostRefs,raw',
    '--level',
    flagValue(args, '--level') ?? '',
  ]);
}

export async function cmdResolveViaBackend(modelId, toolId, routePath, payload) {
  // M2 backend resolver routes:
  // POST /api/models/{model_id}/resolve/wall-by-line
  // POST /api/models/{model_id}/resolve/host-face
  const endpoint = `/api/models/${encodeURIComponent(modelId)}/resolve/${routePath}`;
  const url = `${base}${endpoint}`;
  const res = await fetchJsonResponse('POST', url, payload);
  if (res.ok) {
    console.log(JSON.stringify(res.body, null, 2));
    return;
  }
  if (res.status === 404 || res.status === 405) {
    console.error(
      JSON.stringify(
        {
          ok: false,
          code: 'backend_route_missing',
          toolId,
          endpoint: `POST /api/models/{model_id}/resolve/${routePath}`,
          status: res.status,
          message: 'Backend resolver route is not available yet; CLI command shape is ready.',
        },
        null,
        2,
      ),
    );
    process.exit(2);
  }
  console.error(JSON.stringify({ status: res.status, body: res.body }, null, 2));
  process.exit(1);
}

export async function cmdQueryViaBackend(modelId, toolId, routePath, payload) {
  const endpoint = `/api/models/${encodeURIComponent(modelId)}/query/${routePath}`;
  const url = `${base}${endpoint}`;
  const res = await fetchJsonResponse('POST', url, payload);
  if (res.ok) {
    console.log(JSON.stringify(res.body, null, 2));
    return;
  }
  if (res.status === 404 || res.status === 405) {
    console.error(
      JSON.stringify(
        {
          ok: false,
          code: 'backend_route_missing',
          toolId,
          endpoint: `POST /api/models/{model_id}/query/${routePath}`,
          status: res.status,
          message: 'Backend query route is not available yet; CLI command shape is ready.',
        },
        null,
        2,
      ),
    );
    process.exit(2);
  }
  console.error(JSON.stringify({ status: res.status, body: res.body }, null, 2));
  process.exit(1);
}
