import { flagValue, parseJsonArrayFlag, parseJsonObjectFlag, parseNumber, parsePosPair } from './cli-args.mjs';
import { authorOptions, buildGeneratedBundle, runGeneratedBundle } from './generated-bundles.mjs';

export async function cmdFamily(modelId, userId, sub, args) {
  const opts = authorOptions(args);
  let command;
  let toolId;
  if (sub === 'upsert-type') {
    const id = flagValue(args, '--id');
    if (!id) {
      console.error('family upsert-type requires --id <family-type-id>.');
      process.exit(1);
    }
    command = {
      type: 'upsertFamilyType',
      id,
      discipline: flagValue(args, '--discipline') ?? 'generic',
      parameters: parseJsonObjectFlag(flagValue(args, '--parameters'), '--parameters') ?? {},
    };
    const name = flagValue(args, '--name');
    const familyId = flagValue(args, '--family-id');
    const catalogSource = parseJsonObjectFlag(
      flagValue(args, '--catalog-source'),
      '--catalog-source',
    );
    if (name) command.name = name;
    if (familyId) command.familyId = familyId;
    if (catalogSource) command.catalogSource = catalogSource;
    toolId = 'family.upsert_type';
  } else if (sub === 'place-instance') {
    const familyTypeId = flagValue(args, ['--family-type', '--type']);
    if (!familyTypeId) {
      console.error('family place-instance requires --family-type <id>.');
      process.exit(1);
    }
    const posArg = flagValue(args, '--pos');
    const positionMm =
      posArg != null
        ? parsePosPair(posArg, '--pos')
        : {
            xMm: parseNumber(flagValue(args, '--x'), undefined),
            yMm: parseNumber(flagValue(args, '--y'), undefined),
          };
    if (!Number.isFinite(positionMm.xMm) || !Number.isFinite(positionMm.yMm)) {
      console.error('family place-instance requires --pos x,y or --x <n> --y <n>.');
      process.exit(1);
    }
    command = {
      type: 'placeFamilyInstance',
      familyTypeId,
      positionMm,
      rotationDeg: parseNumber(flagValue(args, '--rotation'), 0),
      paramValues: parseJsonObjectFlag(flagValue(args, '--param-values'), '--param-values') ?? {},
    };
    const id = flagValue(args, '--id');
    const name = flagValue(args, '--name');
    const levelId = flagValue(args, '--level');
    const hostViewId = flagValue(args, '--host-view');
    const hostElementId = flagValue(args, '--host-element');
    const hostAlongT = flagValue(args, '--host-along-t');
    if (id) command.id = id;
    if (name) command.name = name;
    if (levelId) command.levelId = levelId;
    if (hostViewId) command.hostViewId = hostViewId;
    if (hostElementId) command.hostElementId = hostElementId;
    if (hostAlongT != null) command.hostAlongT = parseNumber(hostAlongT, undefined);
    toolId = 'family.place_instance';
  } else {
    console.error(
      `Unknown family subcommand: ${sub ?? '(none)'}. Use upsert-type | place-instance.`,
    );
    process.exit(1);
  }
  const bundle = buildGeneratedBundle({
    toolId,
    commands: [command],
    parentRevision: opts.parentRevision,
  });
  await runGeneratedBundle(modelId, userId, bundle, opts.mode, opts.jsonOnly);
}

export async function cmdMaterial(modelId, userId, sub, args) {
  const opts = authorOptions(args);
  let command;
  let toolId;
  if (sub === 'update-pbr') {
    const id = flagValue(args, '--id');
    if (!id) {
      console.error('material update-pbr requires --id <material-id>.');
      process.exit(1);
    }
    command = { type: 'update_material_pbr', id };
    const fields = [
      ['--name', 'name'],
      ['--albedo-color', 'albedoColor'],
      ['--albedo-map', 'albedoMapId'],
      ['--normal-map', 'normalMapId'],
      ['--roughness-map', 'roughnessMapId'],
      ['--metallic-map', 'metallicMapId'],
      ['--height-map', 'heightMapId'],
      ['--hatch-pattern', 'hatchPatternId'],
    ];
    for (const [flag, key] of fields) {
      const value = flagValue(args, flag);
      if (value != null) command[key] = value;
    }
    const uvScale = parseJsonObjectFlag(flagValue(args, '--uv-scale'), '--uv-scale');
    if (uvScale) command.uvScaleMm = uvScale;
    const uvRotation = flagValue(args, '--uv-rotation');
    if (uvRotation != null) command.uvRotationDeg = parseNumber(uvRotation, undefined);
    toolId = 'material.upsert_pbr';
  } else if (sub === 'assign') {
    const elementId = flagValue(args, '--element');
    const materialKey = flagValue(args, '--material');
    if (!elementId || !materialKey) {
      console.error('material assign requires --element <id> --material <material-key>.');
      process.exit(1);
    }
    command = {
      type: 'set_element_prop',
      elementId,
      key: 'materialKey',
      value: materialKey,
    };
    toolId = 'material.assign';
  } else if (sub === 'paint-face') {
    const elementId = flagValue(args, '--element');
    const faceKind = flagValue(args, '--face');
    const materialKey = flagValue(args, '--material');
    if (!elementId || !faceKind || !materialKey) {
      console.error('material paint-face requires --element <id> --face <kind> --material <key>.');
      process.exit(1);
    }
    const override = {
      faceKind,
      materialKey,
      source: flagValue(args, '--source') ?? 'paint',
    };
    const generatedFaceId = flagValue(args, '--generated-face-id');
    const uvScale = parseJsonObjectFlag(flagValue(args, '--uv-scale'), '--uv-scale');
    const uvOffset = parseJsonObjectFlag(flagValue(args, '--uv-offset'), '--uv-offset');
    const uvRotation = flagValue(args, '--uv-rotation');
    if (generatedFaceId) override.generatedFaceId = generatedFaceId;
    if (uvScale) override.uvScaleMm = uvScale;
    if (uvOffset) override.uvOffsetMm = uvOffset;
    if (uvRotation != null) override.uvRotationDeg = parseNumber(uvRotation, undefined);
    command = {
      type: 'set_element_prop',
      elementId,
      key: 'faceMaterialOverrides',
      value: [override],
    };
    toolId = 'material.paint_face';
  } else {
    console.error(
      `Unknown material subcommand: ${sub ?? '(none)'}. Use update-pbr | assign | paint-face.`,
    );
    process.exit(1);
  }
  const bundle = buildGeneratedBundle({
    toolId,
    commands: [command],
    parentRevision: opts.parentRevision,
  });
  await runGeneratedBundle(modelId, userId, bundle, opts.mode, opts.jsonOnly);
}

export async function cmdDecal(modelId, userId, sub, args) {
  const opts = authorOptions(args);
  if (sub !== 'create') {
    console.error(`Unknown decal subcommand: ${sub ?? '(none)'}. Use create.`);
    process.exit(1);
  }
  const parentElementId = flagValue(args, '--parent');
  const imageAssetId = flagValue(args, '--image-asset');
  if (!parentElementId || !imageAssetId) {
    console.error('decal create requires --parent <element-id> --image-asset <image-asset-id>.');
    process.exit(1);
  }
  const command = {
    type: 'create_decal',
    parentElementId,
    parentSurface: flagValue(args, '--surface') ?? 'front',
    imageAssetId,
    uvRect: parseJsonObjectFlag(flagValue(args, '--uv-rect'), '--uv-rect') ?? {
      u0: 0,
      v0: 0,
      u1: 1,
      v1: 1,
    },
    opacity: parseNumber(flagValue(args, '--opacity'), 1),
  };
  const id = flagValue(args, '--id');
  if (id) command.id = id;
  const bundle = buildGeneratedBundle({
    toolId: 'decal.create',
    commands: [command],
    parentRevision: opts.parentRevision,
  });
  await runGeneratedBundle(modelId, userId, bundle, opts.mode, opts.jsonOnly);
}

export async function cmdPlaceKitchenKit(modelId, userId, args) {
  const opts = authorOptions(args);
  const id = flagValue(args, '--id');
  const hostWallId = flagValue(args, ['--host-wall', '--hostWallId']);
  if (!id || !hostWallId) {
    console.error('place-kitchen-kit requires --id <id> --host-wall <wall-id>.');
    process.exit(1);
  }
  const command = {
    type: 'place_kit',
    id,
    kitId: flagValue(args, '--kit-id') ?? 'kitchen_modular',
    hostWallId,
    startMm: parseNumber(flagValue(args, '--start'), parseNumber(flagValue(args, '--startMm'), 0)),
    endMm: parseNumber(
      flagValue(args, '--end'),
      parseNumber(flagValue(args, '--endMm'), undefined),
    ),
    components: parseJsonArrayFlag(flagValue(args, '--components'), '--components'),
    countertopDepthMm: parseNumber(flagValue(args, '--countertop-depth'), 600),
  };
  const countertopMaterialId = flagValue(args, '--countertop-material');
  if (!Number.isFinite(command.endMm)) {
    console.error('place-kitchen-kit requires --end <mm>.');
    process.exit(1);
  }
  if (countertopMaterialId) command.countertopMaterialId = countertopMaterialId;
  const bundle = buildGeneratedBundle({
    toolId: 'place-kitchen-kit',
    commands: [command],
    parentRevision: opts.parentRevision,
  });
  await runGeneratedBundle(modelId, userId, bundle, opts.mode, opts.jsonOnly);
}
