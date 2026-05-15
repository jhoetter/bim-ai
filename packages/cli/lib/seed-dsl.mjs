function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function assertArray(value, path) {
  if (!Array.isArray(value)) throw new Error(`${path} must be an array.`);
  return value;
}

function assertString(value, path) {
  if (typeof value !== 'string' || !value.trim())
    throw new Error(`${path} must be a non-empty string.`);
  return value;
}

function assertFiniteNumber(value, path) {
  if (!Number.isFinite(value)) throw new Error(`${path} must be a finite number.`);
  return value;
}

function assertPoint(point, path) {
  if (!isObject(point) || !Number.isFinite(point.xMm) || !Number.isFinite(point.yMm)) {
    throw new Error(`${path} must be {xMm,yMm}.`);
  }
  return { xMm: point.xMm, yMm: point.yMm };
}

function assertFootprint(value, path) {
  const points = assertArray(value, path).map((point, index) =>
    assertPoint(point, `${path}[${index}]`),
  );
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

function assertHeightSample(sample, path) {
  if (
    !isObject(sample) ||
    !Number.isFinite(sample.xMm) ||
    !Number.isFinite(sample.yMm) ||
    !Number.isFinite(sample.zMm)
  ) {
    throw new Error(`${path} must be {xMm,yMm,zMm}.`);
  }
  return { xMm: sample.xMm, yMm: sample.yMm, zMm: sample.zMm };
}

function assertHeightmapGrid(grid, path) {
  if (!isObject(grid)) throw new Error(`${path} must be an object.`);
  const stepMm = assertFiniteNumber(grid.stepMm, `${path}.stepMm`);
  const rows = assertFiniteNumber(grid.rows, `${path}.rows`);
  const cols = assertFiniteNumber(grid.cols, `${path}.cols`);
  if (!Number.isInteger(rows) || rows < 1)
    throw new Error(`${path}.rows must be a positive integer.`);
  if (!Number.isInteger(cols) || cols < 1)
    throw new Error(`${path}.cols must be a positive integer.`);
  const values = assertArray(grid.values, `${path}.values`).map((value, index) =>
    assertFiniteNumber(value, `${path}.values[${index}]`),
  );
  if (values.length !== rows * cols) {
    throw new Error(`${path}.values must contain rows * cols entries.`);
  }
  return { stepMm, rows, cols, values };
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
        boundaryMm: assertFootprint(
          opening.boundaryMm,
          `$.roofs.${id}.openings.${openingId}.boundaryMm`,
        ),
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

function compileToposolids(recipe) {
  const commands = [];
  for (const toposolid of recipe.toposolids ?? []) {
    const id = assertString(toposolid.id ?? toposolid.toposolidId, '$.toposolids[].id');
    const heightSamples = assertArray(
      toposolid.heightSamples ?? [],
      `$.toposolids.${id}.heightSamples`,
    ).map((sample, index) =>
      assertHeightSample(sample, `$.toposolids.${id}.heightSamples[${index}]`),
    );
    const hasHeightmap = toposolid.heightmapGridMm != null;
    if (heightSamples.length > 0 && hasHeightmap) {
      throw new Error(`$.toposolids.${id} must not define both heightSamples and heightmapGridMm.`);
    }
    commands.push({
      type: 'CreateToposolid',
      toposolidId: id,
      name: toposolid.name ?? id,
      boundaryMm: assertFootprint(toposolid.boundaryMm, `$.toposolids.${id}.boundaryMm`),
      heightSamples,
      ...(hasHeightmap
        ? {
            heightmapGridMm: assertHeightmapGrid(
              toposolid.heightmapGridMm,
              `$.toposolids.${id}.heightmapGridMm`,
            ),
          }
        : {}),
      thicknessMm: Number.isFinite(toposolid.thicknessMm) ? toposolid.thicknessMm : 1500,
      ...(Number.isFinite(toposolid.baseElevationMm)
        ? { baseElevationMm: toposolid.baseElevationMm }
        : {}),
      defaultMaterialKey: toposolid.defaultMaterialKey ?? null,
    });

    for (const subdivision of toposolid.subdivisions ?? []) {
      const subdivisionId = assertString(subdivision.id, `$.toposolids.${id}.subdivisions[].id`);
      commands.push({
        type: 'create_toposolid_subdivision',
        id: subdivisionId,
        name: subdivision.name ?? subdivisionId,
        hostToposolidId: id,
        boundaryMm: assertFootprint(
          subdivision.boundaryMm,
          `$.toposolids.${id}.subdivisions.${subdivisionId}.boundaryMm`,
        ),
        finishCategory: subdivision.finishCategory ?? 'other',
        materialKey: assertString(
          subdivision.materialKey,
          `$.toposolids.${id}.subdivisions.${subdivisionId}.materialKey`,
        ),
      });
    }
  }
  return commands;
}

function compileGradedRegions(recipe) {
  const commands = [];
  for (const region of recipe.gradedRegions ?? []) {
    const id = assertString(region.id, '$.gradedRegions[].id');
    const targetMode = region.targetMode ?? 'flat';
    if (targetMode !== 'flat' && targetMode !== 'slope') {
      throw new Error(`$.gradedRegions.${id}.targetMode must be flat or slope.`);
    }
    if (targetMode === 'flat' && !Number.isFinite(region.targetZMm)) {
      throw new Error(`$.gradedRegions.${id}.targetZMm is required for flat mode.`);
    }
    if (targetMode === 'slope') {
      assertFiniteNumber(region.slopeAxisDeg, `$.gradedRegions.${id}.slopeAxisDeg`);
      assertFiniteNumber(region.slopeDegPercent, `$.gradedRegions.${id}.slopeDegPercent`);
    }
    commands.push({
      type: 'CreateGradedRegion',
      id,
      hostToposolidId: assertString(
        region.hostToposolidId,
        `$.gradedRegions.${id}.hostToposolidId`,
      ),
      boundaryMm: assertFootprint(region.boundaryMm, `$.gradedRegions.${id}.boundaryMm`),
      targetMode,
      ...(Number.isFinite(region.targetZMm) ? { targetZMm: region.targetZMm } : {}),
      ...(Number.isFinite(region.slopeAxisDeg) ? { slopeAxisDeg: region.slopeAxisDeg } : {}),
      ...(Number.isFinite(region.slopeDegPercent)
        ? { slopeDegPercent: region.slopeDegPercent }
        : {}),
    });
  }
  return commands;
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

function compileFeatureMacros(recipe) {
  const commands = [];
  for (const loggia of recipe.features?.loggias ?? []) {
    const id = assertString(loggia.id, '$.features.loggias[].id');
    const boundary = assertFootprint(loggia.boundaryMm, `$.features.loggias.${id}.boundaryMm`);
    if (loggia.createFloor !== false) {
      commands.push({
        type: 'createFloor',
        id: `${id}-floor`,
        name: loggia.name ?? `${id} floor`,
        levelId: assertString(loggia.levelId, `$.features.loggias.${id}.levelId`),
        boundaryMm: boundary,
        thicknessMm: Number.isFinite(loggia.floorThicknessMm) ? loggia.floorThicknessMm : 180,
        floorTypeId: loggia.floorTypeId ?? null,
        materialKey: loggia.materialKey ?? null,
        roomBounded: loggia.roomBounded === true,
      });
    }
    if (Array.isArray(loggia.railingPathMm) && loggia.railingPathMm.length >= 2) {
      commands.push({
        type: 'createRailing',
        id: `${id}-railing`,
        name: loggia.railingName ?? `${id} railing`,
        pathMm: loggia.railingPathMm.map((point, index) =>
          assertPoint(point, `$.features.loggias.${id}.railingPathMm[${index}]`),
        ),
      });
    }
  }
  for (const wrapper of recipe.features?.foldedWrappers ?? []) {
    const id = assertString(wrapper.id, '$.features.foldedWrappers[].id');
    const footprint = assertFootprint(
      wrapper.footprintMm,
      `$.features.foldedWrappers.${id}.footprintMm`,
    );
    commands.push(...wallCommandsForVolume(wrapper, footprint));
    if (wrapper.createRoof === true) {
      commands.push({
        type: 'createRoof',
        id: `${id}-roof`,
        name: wrapper.roofName ?? `${id} roof`,
        referenceLevelId: assertString(
          wrapper.referenceLevelId ?? wrapper.levelId,
          `$.features.foldedWrappers.${id}.referenceLevelId`,
        ),
        footprintMm: footprint,
        roofGeometryMode: wrapper.roofGeometryMode ?? 'flat',
        slopeDeg: Number.isFinite(wrapper.slopeDeg) ? wrapper.slopeDeg : 0,
        overhangMm: Number.isFinite(wrapper.overhangMm) ? wrapper.overhangMm : 0,
        roofTypeId: wrapper.roofTypeId ?? null,
        materialKey: wrapper.materialKey ?? null,
      });
    }
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
  if (recipe.schemaVersion !== 'seed-dsl.v0')
    throw new Error('Expected schemaVersion seed-dsl.v0.');
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
    ...compileToposolids(recipe),
    ...compileGradedRegions(recipe),
    ...compileVolumes(recipe),
    ...compileRoofs(recipe),
    ...compileRooms(recipe),
    ...compileAssets(recipe),
    ...compileMaterialAssignments(recipe),
    ...compileFeatureMacros(recipe),
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
