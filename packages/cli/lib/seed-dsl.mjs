function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function assertArray(value, path) {
  if (!Array.isArray(value)) throw new Error(`${path} must be an array.`);
  return value;
}

function assertString(value, path) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${path} must be a non-empty string.`);
  return value;
}

function assertPoint(point, path) {
  if (!isObject(point) || !Number.isFinite(point.xMm) || !Number.isFinite(point.yMm)) {
    throw new Error(`${path} must be {xMm,yMm}.`);
  }
  return { xMm: point.xMm, yMm: point.yMm };
}

function assertFootprint(value, path) {
  const points = assertArray(value, path).map((point, index) => assertPoint(point, `${path}[${index}]`));
  if (points.length < 3) throw new Error(`${path} must contain at least three points.`);
  return points;
}

function areaM2(points) {
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    area += a.xMm * b.yMm - b.xMm * a.yMm;
  }
  return Number((Math.abs(area) / 2_000_000).toFixed(2));
}

function wallCommandsForVolume(volume, footprint) {
  const commands = [];
  const levelId = assertString(volume.levelId, `volumes.${volume.id}.levelId`);
  const heightMm = Number.isFinite(volume.wallHeightMm) ? volume.wallHeightMm : 3000;
  const thicknessMm = Number.isFinite(volume.wallThicknessMm) ? volume.wallThicknessMm : 200;
  for (let i = 0; i < footprint.length; i++) {
    const start = footprint[i];
    const end = footprint[(i + 1) % footprint.length];
    commands.push({
      type: 'createWall',
      id: `${volume.id}-wall-${String(i + 1).padStart(2, '0')}`,
      name: `${volume.name ?? volume.id} wall ${i + 1}`,
      levelId,
      start,
      end,
      thicknessMm,
      heightMm,
      wallTypeId: volume.wallTypeId ?? null,
      materialKey: volume.materialKey ?? null,
      isCurtainWall: volume.isCurtainWall === true,
    });
  }
  return commands;
}

function compileLevels(recipe) {
  return assertArray(recipe.levels ?? [], '$.levels').map((level, index) => ({
    type: 'createLevel',
    id: assertString(level.id, `$.levels[${index}].id`),
    name: level.name ?? level.id,
    elevationMm: Number.isFinite(level.elevationMm) ? level.elevationMm : 0,
    alsoCreatePlanView: level.alsoCreatePlanView !== false,
    ...(level.planViewId ? { planViewId: level.planViewId } : {}),
  }));
}

function compileTypes(recipe) {
  const commands = [];
  for (const wallType of recipe.types?.wallTypes ?? []) {
    commands.push({
      type: wallType.upsert === false ? 'createWallType' : 'upsertWallType',
      id: assertString(wallType.id, '$.types.wallTypes[].id'),
      name: wallType.name ?? wallType.id,
      layers: assertArray(wallType.layers ?? [], `$.types.wallTypes.${wallType.id}.layers`),
      basisLine: wallType.basisLine ?? 'center',
    });
  }
  for (const floorType of recipe.types?.floorTypes ?? []) {
    commands.push({
      type: 'upsertFloorType',
      id: assertString(floorType.id, '$.types.floorTypes[].id'),
      name: floorType.name ?? floorType.id,
      layers: assertArray(floorType.layers ?? [], `$.types.floorTypes.${floorType.id}.layers`),
    });
  }
  for (const roofType of recipe.types?.roofTypes ?? []) {
    commands.push({
      type: 'upsertRoofType',
      id: assertString(roofType.id, '$.types.roofTypes[].id'),
      name: roofType.name ?? roofType.id,
      layers: assertArray(roofType.layers ?? [], `$.types.roofTypes.${roofType.id}.layers`),
    });
  }
  return commands;
}

function compileVolumes(recipe) {
  const commands = [];
  for (const volume of recipe.volumes ?? []) {
    const id = assertString(volume.id, '$.volumes[].id');
    const footprint = assertFootprint(volume.footprintMm, `$.volumes.${id}.footprintMm`);
    if (volume.createFloor !== false) {
      commands.push({
        type: 'createFloor',
        id: `${id}-floor`,
        name: `${volume.name ?? id} floor`,
        levelId: assertString(volume.levelId, `$.volumes.${id}.levelId`),
        boundaryMm: footprint,
        thicknessMm: Number.isFinite(volume.floorThicknessMm) ? volume.floorThicknessMm : 220,
        floorTypeId: volume.floorTypeId ?? null,
        materialKey: volume.materialKey ?? null,
        roomBounded: volume.roomBounded === true,
      });
    }
    if (volume.createWalls !== false) commands.push(...wallCommandsForVolume(volume, footprint));
  }
  return commands;
}

function compileRoofs(recipe) {
  const commands = [];
  for (const roof of recipe.roofs ?? []) {
    const id = assertString(roof.id, '$.roofs[].id');
    commands.push({
      type: 'createRoof',
      id,
      name: roof.name ?? id,
      referenceLevelId: assertString(roof.referenceLevelId, `$.roofs.${id}.referenceLevelId`),
      footprintMm: assertFootprint(roof.footprintMm, `$.roofs.${id}.footprintMm`),
      roofGeometryMode: roof.roofGeometryMode ?? 'mass_box',
      slopeDeg: Number.isFinite(roof.slopeDeg) ? roof.slopeDeg : 25,
      overhangMm: Number.isFinite(roof.overhangMm) ? roof.overhangMm : 400,
      ridgeOffsetTransverseMm: roof.ridgeOffsetTransverseMm ?? null,
      eaveHeightLeftMm: roof.eaveHeightLeftMm ?? null,
      eaveHeightRightMm: roof.eaveHeightRightMm ?? null,
      roofTypeId: roof.roofTypeId ?? null,
      materialKey: roof.materialKey ?? null,
    });
    for (const opening of roof.openings ?? []) {
      const openingId = assertString(opening.id, `$.roofs.${id}.openings[].id`);
      commands.push({
        type: 'createRoofOpening',
        id: openingId,
        name: opening.name ?? openingId,
        hostRoofId: id,
        boundaryMm: assertFootprint(opening.boundaryMm, `$.roofs.${id}.openings.${openingId}.boundaryMm`),
      });
    }
  }
  return commands;
}

function compileRooms(recipe) {
  return (recipe.rooms ?? []).map((room, index) => {
    const outlineMm = assertFootprint(room.outlineMm, `$.rooms[${index}].outlineMm`);
    return {
      type: 'createRoomOutline',
      id: room.id ?? `room-${String(index + 1).padStart(2, '0')}`,
      name: room.name ?? `Room ${index + 1}`,
      levelId: assertString(room.levelId, `$.rooms[${index}].levelId`),
      outlineMm,
      programmeCode: room.programmeCode ?? null,
      functionLabel: room.functionLabel ?? null,
      finishSet: room.finishSet ?? null,
      targetAreaM2: Number.isFinite(room.targetAreaM2) ? room.targetAreaM2 : areaM2(outlineMm),
    };
  });
}

function compileAssets(recipe) {
  const commands = [];
  for (const asset of recipe.assets ?? []) {
    const id = assertString(asset.id, '$.assets[].id');
    commands.push({
      type: 'IndexAsset',
      id,
      name: asset.name ?? id,
      assetKind: asset.assetKind ?? 'block_2d',
      category: assertString(asset.category, `$.assets.${id}.category`),
      tags: Array.isArray(asset.tags) ? asset.tags : [],
      disciplineTags: Array.isArray(asset.disciplineTags) ? asset.disciplineTags : ['arch'],
      thumbnailKind: asset.thumbnailKind ?? 'schematic_plan',
      thumbnailWidthMm: asset.thumbnailWidthMm ?? null,
      thumbnailHeightMm: asset.thumbnailHeightMm ?? null,
      planSymbolKind: asset.planSymbolKind ?? asset.symbolKind ?? 'generic',
      renderProxyKind: asset.renderProxyKind ?? asset.symbolKind ?? 'generic',
      paramSchema: asset.paramSchema ?? null,
      description: asset.description ?? null,
    });
  }
  for (const placement of recipe.placedAssets ?? []) {
    const id = placement.id ?? null;
    const assetId = assertString(placement.assetId, `$.placedAssets.${id ?? 'item'}.assetId`);
    commands.push({
      type: 'PlaceAsset',
      id,
      name: placement.name ?? null,
      assetId,
      levelId: assertString(placement.levelId, `$.placedAssets.${assetId}.levelId`),
      positionMm: assertPoint(placement.positionMm, `$.placedAssets.${assetId}.positionMm`),
      rotationDeg: Number.isFinite(placement.rotationDeg) ? placement.rotationDeg : 0,
      paramValues: isObject(placement.paramValues) ? placement.paramValues : {},
      hostElementId: placement.hostElementId ?? null,
    });
  }
  return commands;
}

function compileMaterialAssignments(recipe) {
  const commands = [];
  for (const assignment of recipe.materialAssignments ?? []) {
    const elementId = assertString(assignment.elementId, '$.materialAssignments[].elementId');
    commands.push({
      type: 'updateElementProperty',
      elementId,
      key: 'materialKey',
      value: assertString(assignment.materialKey, `$.materialAssignments.${elementId}.materialKey`),
    });
  }
  return commands;
}

function compileViewpoints(recipe) {
  return (recipe.viewpoints ?? []).map((viewpoint, index) => ({
    type: 'saveViewpoint',
    id: viewpoint.id ?? `view-${String(index + 1).padStart(2, '0')}`,
    name: viewpoint.name ?? viewpoint.id ?? `View ${index + 1}`,
    mode: viewpoint.mode ?? 'orbit_3d',
    camera: viewpoint.camera,
    hiddenSemanticKinds3d: viewpoint.hiddenSemanticKinds3d ?? [],
    cutawayStyle: viewpoint.cutawayStyle ?? null,
  }));
}

export function compileSeedDsl(recipe, options = {}) {
  if (!isObject(recipe)) throw new Error('Seed DSL recipe must be a JSON object.');
  if (recipe.schemaVersion !== 'seed-dsl.v0') throw new Error('Expected schemaVersion seed-dsl.v0.');
  const commands = [];
  if (recipe.projectBasePoint !== false) {
    commands.push({
      type: 'createProjectBasePoint',
      id: recipe.projectBasePoint?.id ?? 'seed-project-base-point',
      positionMm: recipe.projectBasePoint?.positionMm ?? { xMm: 0, yMm: 0, zMm: 0 },
      angleToTrueNorthDeg: recipe.projectBasePoint?.angleToTrueNorthDeg ?? 0,
    });
  }
  commands.push(
    ...compileTypes(recipe),
    ...compileLevels(recipe),
    ...compileVolumes(recipe),
    ...compileRoofs(recipe),
    ...compileRooms(recipe),
    ...compileAssets(recipe),
    ...compileMaterialAssignments(recipe),
    ...compileViewpoints(recipe),
    ...(recipe.commands ?? []),
  );

  return {
    schemaVersion: 'cmd-v3.0',
    parentRevision: recipe.parentRevision ?? null,
    targetOptionId: recipe.targetOptionId ?? null,
    assumptions: [
      {
        key: 'seed-dsl-recipe',
        value: recipe.id ?? options.modelHint ?? 'seed-dsl',
        confidence: 1,
        source: 'bim-ai seed-dsl compile',
      },
      ...(recipe.assumptions ?? []),
    ],
    commands,
    meta: {
      generatedBy: '@bim-ai/cli seed-dsl compile',
      recipeId: recipe.id ?? null,
      modelIdPlaceholder: options.modelHint ?? '${BIM_AI_MODEL_ID}',
      intent: recipe.intent ?? null,
      materialIntent: recipe.materialIntent ?? [],
      documentationIntent: recipe.documentation ?? null,
    },
  };
}
