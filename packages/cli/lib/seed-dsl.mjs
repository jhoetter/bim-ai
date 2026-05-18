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

function assertPointPath(value, path) {
  const points = assertArray(value, path).map((point, index) =>
    assertPoint(point, `${path}[${index}]`),
  );
  if (points.length < 2) throw new Error(`${path} must contain at least two points.`);
  return points;
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

function wallCommandForSegment(wall, path, defaults = {}) {
  const id = assertString(wall.id, `${path}.id`);
  return {
    type: 'createWall',
    id,
    name: wall.name ?? id,
    levelId: assertString(wall.levelId ?? defaults.levelId, `${path}.levelId`),
    start: assertPoint(wall.start ?? wall.startMm, `${path}.start`),
    end: assertPoint(wall.end ?? wall.endMm, `${path}.end`),
    thicknessMm: Number.isFinite(wall.thicknessMm)
      ? wall.thicknessMm
      : Number.isFinite(defaults.thicknessMm)
        ? defaults.thicknessMm
        : 200,
    heightMm: Number.isFinite(wall.heightMm)
      ? wall.heightMm
      : Number.isFinite(defaults.heightMm)
        ? defaults.heightMm
        : 3000,
    wallTypeId: wall.wallTypeId ?? defaults.wallTypeId ?? null,
    materialKey: wall.materialKey ?? defaults.materialKey ?? null,
    isCurtainWall: wall.isCurtainWall === true,
  };
}

function openingCommandForHostedWall(opening, path) {
  const kind = opening.kind ?? opening.type ?? 'door';
  const id = opening.id ?? null;
  if (kind === 'door' || kind === 'access_door') {
    return {
      type: 'insertDoorOnWall',
      ...(id ? { id } : {}),
      name: opening.name ?? 'Door',
      wallId: assertString(opening.wallId ?? opening.hostWallId, `${path}.wallId`),
      alongT: Number.isFinite(opening.alongT) ? opening.alongT : 0.5,
      widthMm: Number.isFinite(opening.widthMm) ? opening.widthMm : 900,
      ...(opening.familyTypeId ? { familyTypeId: opening.familyTypeId } : {}),
    };
  }
  if (kind === 'window' || kind === 'glazing') {
    return {
      type: 'insertWindowOnWall',
      ...(id ? { id } : {}),
      name: opening.name ?? 'Window',
      wallId: assertString(opening.wallId ?? opening.hostWallId, `${path}.wallId`),
      alongT: Number.isFinite(opening.alongT) ? opening.alongT : 0.5,
      widthMm: Number.isFinite(opening.widthMm) ? opening.widthMm : 1200,
      sillHeightMm: Number.isFinite(opening.sillHeightMm) ? opening.sillHeightMm : 900,
      heightMm: Number.isFinite(opening.heightMm) ? opening.heightMm : 1500,
      ...(opening.familyTypeId ? { familyTypeId: opening.familyTypeId } : {}),
    };
  }
  if (kind === 'wall_opening' || kind === 'void') {
    return {
      type: 'createWallOpening',
      ...(id ? { id } : {}),
      name: opening.name ?? 'Wall opening',
      hostWallId: assertString(opening.wallId ?? opening.hostWallId, `${path}.wallId`),
      alongTStart: Number.isFinite(opening.alongTStart) ? opening.alongTStart : 0.4,
      alongTEnd: Number.isFinite(opening.alongTEnd) ? opening.alongTEnd : 0.6,
      sillHeightMm: Number.isFinite(opening.sillHeightMm) ? opening.sillHeightMm : 0,
      headHeightMm: Number.isFinite(opening.headHeightMm) ? opening.headHeightMm : 2100,
    };
  }
  throw new Error(
    `${path}.kind must be door, access_door, window, glazing, wall_opening, or void.`,
  );
}

function sweepCommandForFeature(sweep, path, defaults = {}) {
  const id = assertString(sweep.id, `${path}.id`);
  return {
    type: 'createSweep',
    id,
    name: sweep.name ?? id,
    levelId: assertString(sweep.levelId ?? defaults.levelId, `${path}.levelId`),
    pathMm: assertArray(sweep.pathMm ?? [], `${path}.pathMm`),
    profileMm: assertArray(sweep.profileMm ?? [], `${path}.profileMm`),
    profilePlane: sweep.profilePlane ?? 'work_plane',
    materialKey: sweep.materialKey ?? defaults.materialKey ?? null,
  };
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
  const typeIntentCommands = (typeId, kind, row, assignmentKey) => {
    const intent = {
      kind,
      role: row.role ?? row.exteriorInteriorRole ?? null,
      totalThicknessMm: row.totalThicknessMm ?? row.thicknessMm ?? null,
      uValueWPerM2K: row.uValueWPerM2K ?? null,
      fireRating: row.fireRating ?? row.fire ?? null,
      acousticRating: row.acousticRating ?? row.acoustic ?? null,
      classification: row.classification ?? null,
      ifcEntityIntent: row.ifcEntityIntent ?? null,
      scheduleCategory: row.scheduleCategory ?? null,
    };
    const hasIntent = Object.values(intent).some((value) => value != null);
    const out = hasIntent
      ? [{ type: 'updateElementProperty', elementId: typeId, key: 'bimTypeIntent', value: intent }]
      : [];
    for (const elementId of row.assignToElementIds ?? []) {
      out.push({
        type: 'updateElementProperty',
        elementId: assertString(elementId, `$.types.${kind}.${typeId}.assignToElementIds[]`),
        key: assignmentKey,
        value: typeId,
      });
    }
    return out;
  };
  for (const wallType of recipe.types?.wallTypes ?? []) {
    const id = assertString(wallType.id, '$.types.wallTypes[].id');
    commands.push({
      type: wallType.upsert === false ? 'createWallType' : 'upsertWallType',
      id,
      name: wallType.name ?? id,
      layers: assertArray(wallType.layers ?? [], `$.types.wallTypes.${wallType.id}.layers`),
      basisLine: wallType.basisLine ?? 'center',
    });
    commands.push(...typeIntentCommands(id, 'wallTypes', wallType, 'wallTypeId'));
  }
  for (const floorType of recipe.types?.floorTypes ?? []) {
    const id = assertString(floorType.id, '$.types.floorTypes[].id');
    commands.push({
      type: 'upsertFloorType',
      id,
      name: floorType.name ?? id,
      layers: assertArray(floorType.layers ?? [], `$.types.floorTypes.${floorType.id}.layers`),
    });
    commands.push(...typeIntentCommands(id, 'floorTypes', floorType, 'floorTypeId'));
  }
  for (const roofType of recipe.types?.roofTypes ?? []) {
    const id = assertString(roofType.id, '$.types.roofTypes[].id');
    commands.push({
      type: 'upsertRoofType',
      id,
      name: roofType.name ?? id,
      layers: assertArray(roofType.layers ?? [], `$.types.roofTypes.${roofType.id}.layers`),
    });
    commands.push(...typeIntentCommands(id, 'roofTypes', roofType, 'roofTypeId'));
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
  const commands = [];
  for (const [index, room] of (recipe.rooms ?? []).entries()) {
    const outlineMm = assertFootprint(room.outlineMm, `$.rooms[${index}].outlineMm`);
    const id = room.id ?? `room-${String(index + 1).padStart(2, '0')}`;
    commands.push({
      type: 'createRoomOutline',
      id,
      name: room.name ?? `Room ${index + 1}`,
      levelId: assertString(room.levelId, `$.rooms[${index}].levelId`),
      outlineMm,
      programmeCode: room.programmeCode ?? null,
      functionLabel: room.functionLabel ?? null,
      finishSet: room.finishSet ?? null,
      targetAreaM2: Number.isFinite(room.targetAreaM2) ? room.targetAreaM2 : areaM2(outlineMm),
    });
    commands.push(...roomMetadataCommands(id, room));
  }
  return commands;
}

function roomMetadataCommands(roomId, room) {
  const value = {
    number: room.number ?? null,
    occupancyUse: room.occupancyUse ?? null,
    boundingStatus: room.boundingStatus ?? null,
    access: isObject(room.access) ? room.access : null,
    schedule: isObject(room.schedule) ? room.schedule : null,
    classification: isObject(room.classification) ? room.classification : null,
    ifcEntityIntent: room.ifcEntityIntent ?? room.classification?.ifcEntityIntent ?? null,
  };
  if (!Object.values(value).some((item) => item != null)) return [];
  return [{ type: 'updateElementProperty', elementId: roomId, key: 'roomBimIntent', value }];
}

function compileRoomProgrammes(recipe) {
  const commands = [];
  for (const programme of recipe.features?.roomProgrammes ?? []) {
    const id = assertString(programme.id, '$.features.roomProgrammes[].id');
    const levelId = assertString(programme.levelId, `$.features.roomProgrammes.${id}.levelId`);
    for (const room of programme.rooms ?? []) {
      const roomId = room.id ?? room.roomId ?? `${id}-room-${commands.length + 1}`;
      const outlineMm = assertFootprint(
        room.outlineMm ?? room.verticesMm,
        `$.features.roomProgrammes.${id}.rooms.${roomId}.outlineMm`,
      );
      if (room.createBoundaryWalls === true) {
        commands.push({
          type: 'createRoomPoly',
          roomId,
          name: room.name ?? roomId,
          levelId: room.levelId ?? levelId,
          verticesMm: outlineMm,
          thicknessMm: Number.isFinite(room.wallThicknessMm)
            ? room.wallThicknessMm
            : Number.isFinite(programme.wallThicknessMm)
              ? programme.wallThicknessMm
              : 120,
          heightMm: Number.isFinite(room.wallHeightMm)
            ? room.wallHeightMm
            : Number.isFinite(programme.wallHeightMm)
              ? programme.wallHeightMm
              : 2800,
          wallNamePrefix: room.wallNamePrefix ?? `${room.name ?? roomId} wall`,
          programmeCode: room.programmeCode ?? null,
          department: room.department ?? programme.department ?? null,
          functionLabel: room.functionLabel ?? null,
          finishSet: room.finishSet ?? null,
          targetAreaM2: Number.isFinite(room.targetAreaM2) ? room.targetAreaM2 : areaM2(outlineMm),
        });
      } else {
        commands.push({
          type: 'createRoomOutline',
          id: roomId,
          name: room.name ?? roomId,
          levelId: room.levelId ?? levelId,
          outlineMm,
          programmeCode: room.programmeCode ?? null,
          department: room.department ?? programme.department ?? null,
          functionLabel: room.functionLabel ?? null,
          finishSet: room.finishSet ?? null,
          targetAreaM2: Number.isFinite(room.targetAreaM2) ? room.targetAreaM2 : areaM2(outlineMm),
        });
      }
      commands.push(...roomMetadataCommands(roomId, room));
    }
    for (const door of programme.doors ?? []) {
      commands.push(
        openingCommandForHostedWall(
          door,
          `$.features.roomProgrammes.${id}.doors.${door.id ?? 'item'}`,
        ),
      );
    }
    for (const stair of programme.stairs ?? []) {
      const stairId = stair.id ?? null;
      commands.push({
        type: 'createStair',
        ...(stairId ? { id: stairId } : {}),
        name: stair.name ?? 'Stair',
        baseLevelId: assertString(
          stair.baseLevelId ?? programme.baseLevelId ?? levelId,
          `$.features.roomProgrammes.${id}.stairs.${stairId ?? 'item'}.baseLevelId`,
        ),
        topLevelId: assertString(
          stair.topLevelId ?? programme.topLevelId,
          `$.features.roomProgrammes.${id}.stairs.${stairId ?? 'item'}.topLevelId`,
        ),
        runStartMm: assertPoint(
          stair.runStartMm,
          `$.features.roomProgrammes.${id}.stairs.${stairId ?? 'item'}.runStartMm`,
        ),
        runEndMm: assertPoint(
          stair.runEndMm,
          `$.features.roomProgrammes.${id}.stairs.${stairId ?? 'item'}.runEndMm`,
        ),
        widthMm: Number.isFinite(stair.widthMm) ? stair.widthMm : 1000,
        riserMm: Number.isFinite(stair.riserMm) ? stair.riserMm : 175,
        treadMm: Number.isFinite(stair.treadMm) ? stair.treadMm : 275,
      });
    }
    for (const opening of programme.slabOpenings ?? []) {
      const openingId = opening.id ?? null;
      commands.push({
        type: 'createSlabOpening',
        ...(openingId ? { id: openingId } : {}),
        name: opening.name ?? 'Slab opening',
        hostFloorId: assertString(
          opening.hostFloorId,
          `$.features.roomProgrammes.${id}.slabOpenings.${openingId ?? 'item'}.hostFloorId`,
        ),
        boundaryMm: assertFootprint(
          opening.boundaryMm,
          `$.features.roomProgrammes.${id}.slabOpenings.${openingId ?? 'item'}.boundaryMm`,
        ),
        isShaft: opening.isShaft === true,
      });
    }
  }
  return commands;
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

function compileToposolidExcavations(recipe) {
  const commands = [];
  for (const excavation of recipe.toposolidExcavations ?? []) {
    const id = assertString(excavation.id, '$.toposolidExcavations[].id');
    const cutMode = excavation.cutMode ?? 'to_bottom_of_cutter';
    if (!['to_top_of_cutter', 'to_bottom_of_cutter', 'custom_depth'].includes(cutMode)) {
      throw new Error(`$.toposolidExcavations.${id}.cutMode is invalid.`);
    }
    if (cutMode === 'custom_depth' && !Number.isFinite(excavation.customDepthMm)) {
      throw new Error(
        `$.toposolidExcavations.${id}.customDepthMm is required for custom_depth mode.`,
      );
    }
    commands.push({
      type: 'CreateToposolidExcavation',
      id,
      hostToposolidId: assertString(
        excavation.hostToposolidId,
        `$.toposolidExcavations.${id}.hostToposolidId`,
      ),
      cutterElementId: assertString(
        excavation.cutterElementId,
        `$.toposolidExcavations.${id}.cutterElementId`,
      ),
      cutMode,
      offsetMm: Number.isFinite(excavation.offsetMm) ? excavation.offsetMm : 0,
      ...(Number.isFinite(excavation.customDepthMm)
        ? { customDepthMm: excavation.customDepthMm }
        : {}),
      ...(Number.isFinite(excavation.estimatedVolumeM3)
        ? { estimatedVolumeM3: excavation.estimatedVolumeM3 }
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
    const scheduleMetadata = {
      typeId: asset.typeId ?? id,
      scheduleCategory: asset.scheduleCategory ?? null,
      evidenceRole: asset.evidenceRole ?? null,
      ifcEntityIntent: asset.ifcEntityIntent ?? null,
    };
    if (Object.values(scheduleMetadata).some((value) => value != null)) {
      commands.push({
        type: 'updateElementProperty',
        elementId: id,
        key: 'assetScheduleMetadata',
        value: scheduleMetadata,
      });
    }
  }
  for (const placement of recipe.placedAssets ?? []) {
    const id = placement.id ?? null;
    const assetId = assertString(placement.assetId, `$.placedAssets.${id ?? 'item'}.assetId`);
    const paramValues = isObject(placement.paramValues) ? { ...placement.paramValues } : {};
    for (const [key, value] of Object.entries({
      roomId: placement.roomId ?? placement.roomAssociation ?? null,
      scheduleCategory: placement.scheduleCategory ?? null,
      evidenceRole: placement.evidenceRole ?? null,
      typeId: placement.typeId ?? assetId,
    })) {
      if (value != null && paramValues[key] == null) paramValues[key] = value;
    }
    commands.push({
      type: 'PlaceAsset',
      id,
      name: placement.name ?? null,
      assetId,
      levelId: assertString(placement.levelId, `$.placedAssets.${assetId}.levelId`),
      positionMm: assertPoint(placement.positionMm, `$.placedAssets.${assetId}.positionMm`),
      rotationDeg: Number.isFinite(placement.rotationDeg) ? placement.rotationDeg : 0,
      paramValues,
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
  for (const terrace of recipe.features?.roofTerraces ?? []) {
    const id = assertString(terrace.id, '$.features.roofTerraces[].id');
    const boundary = assertFootprint(
      terrace.boundaryMm,
      `$.features.roofTerraces.${id}.boundaryMm`,
    );
    const hostRoofId = terrace.hostRoofId ?? terrace.roofId;
    if (hostRoofId && terrace.createRoofOpening !== false) {
      commands.push({
        type: 'createRoofOpening',
        id: terrace.openingId ?? `${id}-roof-opening`,
        name: terrace.openingName ?? `${terrace.name ?? id} roof opening`,
        hostRoofId,
        boundaryMm: boundary,
      });
    }
    if (terrace.createFloor !== false) {
      commands.push({
        type: 'createFloor',
        id: terrace.floorId ?? `${id}-floor`,
        name: terrace.floorName ?? `${terrace.name ?? id} occupied floor`,
        levelId: assertString(terrace.levelId, `$.features.roofTerraces.${id}.levelId`),
        boundaryMm: boundary,
        thicknessMm: Number.isFinite(terrace.floorThicknessMm) ? terrace.floorThicknessMm : 160,
        floorTypeId: terrace.floorTypeId ?? null,
        materialKey: terrace.floorMaterialKey ?? terrace.materialKey ?? null,
        roomBounded: terrace.roomBounded === true,
      });
    }
    for (const wall of terrace.returnWalls ?? []) {
      commands.push(
        wallCommandForSegment(wall, `$.features.roofTerraces.${id}.returnWalls.${wall.id}`, {
          levelId: terrace.levelId,
          thicknessMm: terrace.returnWallThicknessMm ?? terrace.wallThicknessMm ?? 200,
          heightMm: terrace.returnWallHeightMm ?? terrace.wallHeightMm ?? 1100,
          wallTypeId: terrace.wallTypeId,
          materialKey: terrace.returnMaterialKey ?? terrace.materialKey,
        }),
      );
    }
    if (Array.isArray(terrace.railingPathMm) && terrace.railingPathMm.length >= 2) {
      commands.push({
        type: 'createRailing',
        id: terrace.railingId ?? `${id}-railing`,
        name: terrace.railingName ?? `${id} railing`,
        pathMm: assertPointPath(
          terrace.railingPathMm,
          `$.features.roofTerraces.${id}.railingPathMm`,
        ),
        ...(terrace.balusterPattern ? { balusterPattern: terrace.balusterPattern } : {}),
      });
    }
    for (const opening of terrace.accessOpenings ?? []) {
      commands.push(
        openingCommandForHostedWall(
          opening,
          `$.features.roofTerraces.${id}.accessOpenings.${opening.id ?? 'item'}`,
        ),
      );
    }
  }
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
    for (const wall of loggia.returnWalls ?? []) {
      commands.push(
        wallCommandForSegment(wall, `$.features.loggias.${id}.returnWalls.${wall.id}`, {
          levelId: loggia.levelId,
          thicknessMm: loggia.returnWallThicknessMm ?? loggia.wallThicknessMm ?? 200,
          heightMm: loggia.returnWallHeightMm ?? loggia.wallHeightMm ?? 2800,
          wallTypeId: loggia.wallTypeId,
          materialKey: loggia.returnMaterialKey ?? loggia.materialKey,
        }),
      );
    }
    for (const wall of loggia.recessedFacadeWalls ?? []) {
      commands.push(
        wallCommandForSegment(wall, `$.features.loggias.${id}.recessedFacadeWalls.${wall.id}`, {
          levelId: loggia.levelId,
          thicknessMm: loggia.facadeWallThicknessMm ?? 160,
          heightMm: loggia.facadeWallHeightMm ?? loggia.wallHeightMm ?? 2800,
          wallTypeId: loggia.facadeWallTypeId ?? loggia.wallTypeId,
          materialKey: loggia.facadeMaterialKey ?? loggia.materialKey,
        }),
      );
    }
    for (const opening of loggia.accessOpenings ?? []) {
      commands.push(
        openingCommandForHostedWall(
          opening,
          `$.features.loggias.${id}.accessOpenings.${opening.id ?? 'item'}`,
        ),
      );
    }
    for (const opening of loggia.bayOpenings ?? []) {
      commands.push(
        openingCommandForHostedWall(
          opening,
          `$.features.loggias.${id}.bayOpenings.${opening.id ?? 'item'}`,
        ),
      );
    }
  }
  for (const rhythm of recipe.features?.facadeRhythms ?? []) {
    const id = assertString(rhythm.id, '$.features.facadeRhythms[].id');
    const hostWallId = assertString(rhythm.hostWallId, `$.features.facadeRhythms.${id}.hostWallId`);
    for (const bay of rhythm.bays ?? rhythm.openings ?? []) {
      const bayId = assertString(bay.id, `$.features.facadeRhythms.${id}.bays[].id`);
      const opening = {
        ...bay,
        id: bayId,
        wallId: hostWallId,
        alongT: Number.isFinite(bay.centerT) ? bay.centerT : bay.alongT,
      };
      commands.push(
        openingCommandForHostedWall(opening, `$.features.facadeRhythms.${id}.bays.${bayId}`),
      );
      const scheduleMetadata = {
        featureId: id,
        bayId,
        scheduleCategory: bay.scheduleCategory ?? (opening.kind === 'door' ? 'door' : 'window'),
        evidenceRole: bay.evidenceRole ?? rhythm.evidenceRole ?? null,
        typeId: bay.typeId ?? bay.familyTypeId ?? null,
      };
      commands.push({
        type: 'updateElementProperty',
        elementId: bayId,
        key: 'openingScheduleMetadata',
        value: scheduleMetadata,
      });
    }
    for (const mullion of rhythm.mullionProxies ?? []) {
      commands.push(
        sweepCommandForFeature(
          mullion,
          `$.features.facadeRhythms.${id}.mullionProxies.${mullion.id}`,
          {
            levelId: rhythm.levelId,
            materialKey: mullion.materialKey ?? rhythm.mullionMaterialKey ?? rhythm.materialKey,
          },
        ),
      );
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
    const attachRoofId =
      wrapper.attachWallTopsToRoofId ??
      (wrapper.attachWallTopsToRoof === true && wrapper.createRoof === true ? `${id}-roof` : null);
    if (attachRoofId) {
      for (let i = 0; i < footprint.length; i++) {
        commands.push({
          type: 'attachWallTopToRoof',
          wallId: `${id}-wall-${String(i + 1).padStart(2, '0')}`,
          roofId: attachRoofId,
        });
      }
    }
    for (const wall of wrapper.returnWalls ?? []) {
      commands.push(
        wallCommandForSegment(wall, `$.features.foldedWrappers.${id}.returnWalls.${wall.id}`, {
          levelId: wrapper.levelId,
          thicknessMm: wrapper.returnWallThicknessMm ?? wrapper.wallThicknessMm ?? 200,
          heightMm: wrapper.returnWallHeightMm ?? wrapper.wallHeightMm ?? 3000,
          wallTypeId: wrapper.wallTypeId,
          materialKey: wrapper.materialKey,
        }),
      );
    }
    for (const sweep of wrapper.fasciaSweeps ?? []) {
      commands.push(
        sweepCommandForFeature(sweep, `$.features.foldedWrappers.${id}.fasciaSweeps.${sweep.id}`, {
          levelId: wrapper.levelId,
          materialKey: wrapper.materialKey,
        }),
      );
    }
  }
  return commands;
}

function compileDocumentation(recipe) {
  const doc = recipe.documentation;
  if (!doc || !isObject(doc)) return [];
  const commands = [];
  const sheetViewports = new Map();
  const addViewport = (sheetId, viewport) => {
    if (!sheetId) return;
    const rows = sheetViewports.get(sheetId) ?? [];
    rows.push(viewport);
    sheetViewports.set(sheetId, rows);
  };

  for (const view of doc.views ?? []) {
    const id = assertString(view.id, '$.documentation.views[].id');
    const kind = view.kind ?? view.type;
    if (kind === 'elevation') {
      commands.push({
        type: 'createElevationView',
        id,
        name: view.name ?? id,
        direction: view.direction ?? 'north',
        ...(Number.isFinite(view.customAngleDeg) ? { customAngleDeg: view.customAngleDeg } : {}),
        ...(view.cropMinMm
          ? { cropMinMm: assertPoint(view.cropMinMm, `$.documentation.views.${id}.cropMinMm`) }
          : {}),
        ...(view.cropMaxMm
          ? { cropMaxMm: assertPoint(view.cropMaxMm, `$.documentation.views.${id}.cropMaxMm`) }
          : {}),
        scale: Number.isFinite(view.scale) ? view.scale : 100,
        ...(view.planDetailLevel ? { planDetailLevel: view.planDetailLevel } : {}),
      });
    } else if (kind === 'section') {
      commands.push({
        type: 'createSectionCut',
        id,
        name: view.name ?? id,
        lineStartMm: assertPoint(view.lineStartMm, `$.documentation.views.${id}.lineStartMm`),
        lineEndMm: assertPoint(view.lineEndMm, `$.documentation.views.${id}.lineEndMm`),
        cropDepthMm: Number.isFinite(view.cropDepthMm) ? view.cropDepthMm : 8500,
      });
    }
  }

  for (const sheet of doc.sheets ?? []) {
    const id = assertString(sheet.id, '$.documentation.sheets[].id');
    commands.push({
      type: 'upsertSheet',
      id,
      name: sheet.name ?? id,
      ...(sheet.titleBlock ? { titleBlock: sheet.titleBlock } : {}),
      ...(Number.isFinite(sheet.paperWidthMm) ? { paperWidthMm: sheet.paperWidthMm } : {}),
      ...(Number.isFinite(sheet.paperHeightMm) ? { paperHeightMm: sheet.paperHeightMm } : {}),
      ...(isObject(sheet.titleblockParameters)
        ? { titleblockParameters: sheet.titleblockParameters }
        : {}),
    });
    for (const viewport of sheet.viewports ?? []) addViewport(id, viewport);
  }

  for (const schedule of doc.schedules ?? []) {
    const id = assertString(schedule.id, '$.documentation.schedules[].id');
    commands.push({
      type: 'upsertSchedule',
      id,
      name: schedule.name ?? id,
      sheetId: schedule.sheetId ?? null,
      filters: isObject(schedule.filters)
        ? schedule.filters
        : schedule.category
          ? { category: schedule.category }
          : {},
      grouping: isObject(schedule.grouping) ? schedule.grouping : {},
    });
    if (schedule.placeOnSheet) {
      addViewport(assertString(schedule.sheetId, `$.documentation.schedules.${id}.sheetId`), {
        viewportId: schedule.viewportId ?? `vp-${id}`,
        viewRef: `schedule:${id}`,
        label: schedule.name ?? id,
        xMm: Number.isFinite(schedule.xMm) ? schedule.xMm : 20,
        yMm: Number.isFinite(schedule.yMm) ? schedule.yMm : 190,
        widthMm: Number.isFinite(schedule.widthMm) ? schedule.widthMm : 160,
        heightMm: Number.isFinite(schedule.heightMm) ? schedule.heightMm : 70,
      });
    }
  }

  for (const scheduleView of doc.scheduleViews ?? []) {
    const id = assertString(scheduleView.id, '$.documentation.scheduleViews[].id');
    commands.push({
      type: 'create_schedule_view',
      id,
      name: scheduleView.name ?? id,
      category: assertString(scheduleView.category, `$.documentation.scheduleViews.${id}.category`),
      columns: Array.isArray(scheduleView.columns) ? scheduleView.columns : [],
      ...(scheduleView.filterExpr ? { filterExpr: scheduleView.filterExpr } : {}),
      ...(scheduleView.sortKey ? { sortKey: scheduleView.sortKey } : {}),
      ...(scheduleView.sortDir ? { sortDir: scheduleView.sortDir } : {}),
    });
  }

  for (const [sheetId, viewportsMm] of sheetViewports) {
    commands.push({ type: 'upsertSheetViewports', sheetId, viewportsMm });
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
    viewerClipCapElevMm: viewpoint.viewerClipCapElevMm ?? null,
    viewerClipFloorElevMm: viewpoint.viewerClipFloorElevMm ?? null,
    planOverlayEnabled: viewpoint.planOverlayEnabled === true,
    planOverlaySourcePlanViewId: viewpoint.planOverlaySourcePlanViewId ?? null,
    evidenceRole: viewpoint.evidenceRole ?? null,
    featureIds: Array.isArray(viewpoint.featureIds) ? viewpoint.featureIds : [],
  }));
}

function compileGeoreference(recipe) {
  const geo = recipe.georeference;
  if (!geo) return [];
  if (!isObject(geo)) throw new Error('$.georeference must be an object.');
  const anchorLat = assertFiniteNumber(geo.anchorLat, '$.georeference.anchorLat');
  const anchorLon = assertFiniteNumber(geo.anchorLon, '$.georeference.anchorLon');
  const contextRadiusM = assertFiniteNumber(
    geo.contextRadiusM ?? 300,
    '$.georeference.contextRadiusM',
  );
  if (anchorLat < -90 || anchorLat > 90)
    throw new Error('$.georeference.anchorLat must be in [-90, 90].');
  if (anchorLon < -180 || anchorLon > 180)
    throw new Error('$.georeference.anchorLon must be in [-180, 180].');
  if (contextRadiusM < 50 || contextRadiusM > 1000)
    throw new Error('$.georeference.contextRadiusM must be in [50, 1000].');
  return [
    {
      type: 'updateElementProperty',
      elementId: 'project_settings',
      key: 'georeference',
      value: { anchorLat, anchorLon, contextRadiusM },
    },
  ];
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
    ...compileGeoreference(recipe),
    ...compileTypes(recipe),
    ...compileLevels(recipe),
    ...compileToposolids(recipe),
    ...compileGradedRegions(recipe),
    ...compileVolumes(recipe),
    ...compileToposolidExcavations(recipe),
    ...compileRoofs(recipe),
    ...compileRooms(recipe),
    ...compileRoomProgrammes(recipe),
    ...compileAssets(recipe),
    ...compileMaterialAssignments(recipe),
    ...compileFeatureMacros(recipe),
    ...compileViewpoints(recipe),
    ...compileDocumentation(recipe),
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
