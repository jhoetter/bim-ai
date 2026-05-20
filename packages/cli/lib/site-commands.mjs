import { flagValue, hasFlag, parseJsonArrayFlag, parseJsonObjectFlag, parseNumber, parsePoint2List, parsePosTriple, point2FromPair } from './cli-args.mjs';
import { authorOptions, buildGeneratedBundle, runGeneratedBundle } from './generated-bundles.mjs';

export function withOptionalNumber(command, key, value) {
  if (value != null) command[key] = parseNumber(value, undefined);
}

export function withOptionalString(command, key, value) {
  if (value != null && value !== '') command[key] = value;
}

export function siteBundle(toolId, commands, opts) {
  return buildGeneratedBundle({
    toolId,
    commands,
    parentRevision: opts.parentRevision,
    assumptions: [
      {
        key: 'site-context-first-class-surface',
        value: true,
        confidence: 1,
        source: '@bim-ai/cli',
      },
    ],
  });
}

export function commandForSiteGradedRegion(sub, args) {
  if (sub === 'create') {
    const hostToposolidId = flagValue(args, ['--host-toposolid', '--hostToposolidId']);
    const boundaryMm = parsePoint2List(flagValue(args, ['--boundary', '--points']), '--boundary');
    if (!hostToposolidId) {
      console.error('site graded-region create requires --host-toposolid <id>.');
      process.exit(1);
    }
    const command = {
      type: 'CreateGradedRegion',
      hostToposolidId,
      boundaryMm,
      targetMode: flagValue(args, '--target-mode') ?? flagValue(args, '--targetMode') ?? 'flat',
    };
    withOptionalString(command, 'id', flagValue(args, '--id'));
    withOptionalNumber(command, 'targetZMm', flagValue(args, ['--target-z', '--targetZMm']));
    withOptionalNumber(
      command,
      'slopeAxisDeg',
      flagValue(args, ['--slope-axis', '--slopeAxisDeg']),
    );
    withOptionalNumber(
      command,
      'slopeDegPercent',
      flagValue(args, ['--slope-percent', '--slopeDegPercent']),
    );
    return command;
  }
  if (sub === 'update') {
    const id = flagValue(args, '--id') ?? args.find((a) => !String(a).startsWith('-'));
    if (!id) {
      console.error('site graded-region update requires <id> or --id <id>.');
      process.exit(1);
    }
    const command = { type: 'UpdateGradedRegion', id };
    const boundary = flagValue(args, ['--boundary', '--points']);
    if (boundary) command.boundaryMm = parsePoint2List(boundary, '--boundary');
    withOptionalString(command, 'targetMode', flagValue(args, ['--target-mode', '--targetMode']));
    withOptionalNumber(command, 'targetZMm', flagValue(args, ['--target-z', '--targetZMm']));
    withOptionalNumber(
      command,
      'slopeAxisDeg',
      flagValue(args, ['--slope-axis', '--slopeAxisDeg']),
    );
    withOptionalNumber(
      command,
      'slopeDegPercent',
      flagValue(args, ['--slope-percent', '--slopeDegPercent']),
    );
    return command;
  }
  if (sub === 'delete') {
    const id = flagValue(args, '--id') ?? args.find((a) => !String(a).startsWith('-'));
    if (!id) {
      console.error('site graded-region delete requires <id> or --id <id>.');
      process.exit(1);
    }
    return { type: 'DeleteGradedRegion', id };
  }
  console.error(
    `Unknown site graded-region subcommand: ${sub ?? '(none)'}. Use create | update | delete.`,
  );
  process.exit(1);
}

export function commandForSitePropertyLine(sub, args) {
  if (sub === 'create') {
    const line = parsePoint2List(flagValue(args, ['--line', '--points']), '--line');
    if (line.length !== 2) {
      console.error('site property-line create requires --line "x,y;x,y".');
      process.exit(1);
    }
    const command = { type: 'createPropertyLine', startMm: line[0], endMm: line[1] };
    withOptionalString(command, 'id', flagValue(args, '--id'));
    withOptionalString(command, 'name', flagValue(args, '--name'));
    withOptionalNumber(command, 'setbackMm', flagValue(args, '--setback'));
    withOptionalString(command, 'classification', flagValue(args, '--classification'));
    const bearingTable = parseJsonObjectFlag(flagValue(args, '--bearing-table'), '--bearing-table');
    if (bearingTable) {
      command.authoringMode = 'bearing_table';
      command.bearingTable = bearingTable;
    }
    return command;
  }
  if (sub === 'update') {
    const propertyLineId = flagValue(args, '--id') ?? args.find((a) => !String(a).startsWith('-'));
    if (!propertyLineId) {
      console.error('site property-line update requires <id> or --id <id>.');
      process.exit(1);
    }
    const command = { type: 'updatePropertyLine', propertyLineId };
    const lineArg = flagValue(args, ['--line', '--points']);
    if (lineArg) {
      const line = parsePoint2List(lineArg, '--line');
      if (line.length !== 2) {
        console.error('site property-line update --line must contain exactly two points.');
        process.exit(1);
      }
      command.startMm = line[0];
      command.endMm = line[1];
    }
    withOptionalString(command, 'name', flagValue(args, '--name'));
    withOptionalNumber(command, 'setbackMm', flagValue(args, '--setback'));
    withOptionalString(command, 'classification', flagValue(args, '--classification'));
    const bearingTable = parseJsonObjectFlag(flagValue(args, '--bearing-table'), '--bearing-table');
    if (bearingTable) {
      command.authoringMode = 'bearing_table';
      command.bearingTable = bearingTable;
    }
    return command;
  }
  if (sub === 'delete') {
    const propertyLineId = flagValue(args, '--id') ?? args.find((a) => !String(a).startsWith('-'));
    if (!propertyLineId) {
      console.error('site property-line delete requires <id> or --id <id>.');
      process.exit(1);
    }
    return { type: 'deletePropertyLine', propertyLineId };
  }
  console.error(
    `Unknown site property-line subcommand: ${sub ?? '(none)'}. Use create | update | delete.`,
  );
  process.exit(1);
}

export function commandForSiteToposolidExcavation(sub, args) {
  if (sub === 'create') {
    const hostToposolidId = flagValue(args, ['--host-toposolid', '--hostToposolidId']);
    const cutterElementId = flagValue(args, ['--cutter', '--cutterElementId']);
    if (!hostToposolidId || !cutterElementId) {
      console.error('site excavation create requires --host-toposolid <id> --cutter <id>.');
      process.exit(1);
    }
    const command = {
      type: 'CreateToposolidExcavation',
      hostToposolidId,
      cutterElementId,
      cutMode: flagValue(args, ['--cut-mode', '--cutMode']) ?? 'to_bottom_of_cutter',
      offsetMm: parseNumber(flagValue(args, ['--offset', '--offsetMm']), 0),
    };
    withOptionalString(command, 'id', flagValue(args, '--id'));
    withOptionalNumber(
      command,
      'customDepthMm',
      flagValue(args, ['--custom-depth', '--customDepthMm']),
    );
    withOptionalNumber(
      command,
      'estimatedVolumeM3',
      flagValue(args, ['--estimated-volume', '--estimatedVolumeM3']),
    );
    return command;
  }
  if (sub === 'update') {
    const id = flagValue(args, '--id') ?? args.find((a) => !String(a).startsWith('-'));
    if (!id) {
      console.error('site excavation update requires <id> or --id <id>.');
      process.exit(1);
    }
    const command = { type: 'UpdateToposolidExcavation', id };
    withOptionalString(command, 'cutMode', flagValue(args, ['--cut-mode', '--cutMode']));
    withOptionalNumber(command, 'offsetMm', flagValue(args, ['--offset', '--offsetMm']));
    withOptionalNumber(
      command,
      'customDepthMm',
      flagValue(args, ['--custom-depth', '--customDepthMm']),
    );
    withOptionalNumber(
      command,
      'estimatedVolumeM3',
      flagValue(args, ['--estimated-volume', '--estimatedVolumeM3']),
    );
    return command;
  }
  if (sub === 'delete') {
    const id = flagValue(args, '--id') ?? args.find((a) => !String(a).startsWith('-'));
    if (!id) {
      console.error('site excavation delete requires <id> or --id <id>.');
      process.exit(1);
    }
    return { type: 'DeleteToposolidExcavation', id };
  }
  console.error(
    `Unknown site excavation subcommand: ${sub ?? '(none)'}. Use create | update | delete.`,
  );
  process.exit(1);
}

export function commandForSiteSubdivision(sub, args) {
  if (sub === 'update') {
    const id = flagValue(args, '--id') ?? args.find((a) => !String(a).startsWith('-'));
    if (!id) {
      console.error('site subdivision update requires <id> or --id <id>.');
      process.exit(1);
    }
    const command = { type: 'update_toposolid_subdivision', id };
    const boundary = flagValue(args, ['--boundary', '--points']);
    if (boundary) command.boundaryMm = parsePoint2List(boundary, '--boundary');
    withOptionalString(command, 'name', flagValue(args, '--name'));
    withOptionalString(
      command,
      'finishCategory',
      flagValue(args, ['--finish-category', '--finishCategory']),
    );
    withOptionalString(
      command,
      'materialKey',
      flagValue(args, ['--material-key', '--materialKey']),
    );
    return command;
  }
  if (sub === 'delete') {
    const id = flagValue(args, '--id') ?? args.find((a) => !String(a).startsWith('-'));
    if (!id) {
      console.error('site subdivision delete requires <id> or --id <id>.');
      process.exit(1);
    }
    return { type: 'delete_toposolid_subdivision', id };
  }
  console.error(`Unknown site subdivision subcommand: ${sub ?? '(none)'}. Use update | delete.`);
  process.exit(1);
}

export function commandForSiteBasePoint(sub, args) {
  if (sub === 'create') {
    const command = {
      type: 'createProjectBasePoint',
      positionMm: parsePosTriple(flagValue(args, ['--position', '--pos']) ?? '0,0,0'),
      angleToTrueNorthDeg: parseNumber(flagValue(args, ['--true-north', '--angle']), 0),
      clipped: hasFlag(args, '--clipped'),
    };
    withOptionalString(command, 'id', flagValue(args, '--id'));
    return command;
  }
  if (sub === 'move') {
    return {
      type: 'moveProjectBasePoint',
      positionMm: parsePosTriple(flagValue(args, ['--position', '--pos'])),
    };
  }
  if (sub === 'rotate') {
    return {
      type: 'rotateProjectBasePoint',
      angleToTrueNorthDeg: parseNumber(flagValue(args, ['--true-north', '--angle']), undefined),
    };
  }
  console.error(
    `Unknown site base-point subcommand: ${sub ?? '(none)'}. Use create | move | rotate.`,
  );
  process.exit(1);
}

export function commandForSiteSurveyPoint(sub, args) {
  if (sub === 'create') {
    const command = {
      type: 'createSurveyPoint',
      positionMm: parsePosTriple(flagValue(args, ['--position', '--pos']) ?? '0,0,0'),
      sharedElevationMm: parseNumber(flagValue(args, ['--shared-elevation', '--elevation']), 0),
      clipped: hasFlag(args, '--clipped'),
    };
    withOptionalString(command, 'id', flagValue(args, '--id'));
    return command;
  }
  if (sub === 'move') {
    const command = {
      type: 'moveSurveyPoint',
      positionMm: parsePosTriple(flagValue(args, ['--position', '--pos'])),
    };
    withOptionalNumber(
      command,
      'sharedElevationMm',
      flagValue(args, ['--shared-elevation', '--elevation']),
    );
    return command;
  }
  console.error(`Unknown site survey-point subcommand: ${sub ?? '(none)'}. Use create | move.`);
  process.exit(1);
}

export function commandForSiteSunSettings(sub, args) {
  if (sub !== 'create' && sub !== 'update') {
    console.error(`Unknown site sun-settings subcommand: ${sub ?? '(none)'}. Use create | update.`);
    process.exit(1);
  }
  const command = { type: sub === 'create' ? 'createSunSettings' : 'updateSunSettings' };
  if (sub === 'create') withOptionalString(command, 'id', flagValue(args, '--id'));
  withOptionalNumber(command, 'latitudeDeg', flagValue(args, ['--lat', '--latitude']));
  withOptionalNumber(command, 'longitudeDeg', flagValue(args, ['--lon', '--longitude']));
  withOptionalString(command, 'dateIso', flagValue(args, ['--date', '--date-iso']));
  const time = flagValue(args, '--time');
  if (time) {
    const [hours, minutes] = time.split(':').map((part) => Number(part));
    if (!Number.isInteger(hours) || !Number.isInteger(minutes)) {
      console.error('site sun-settings --time must be HH:MM.');
      process.exit(1);
    }
    command.timeOfDay = { hours, minutes };
  }
  withOptionalString(
    command,
    'daylightSavingStrategy',
    flagValue(args, ['--daylight-saving', '--daylightSavingStrategy']),
  );
  return command;
}

export function commandsForSiteSetup(args) {
  const referenceLevelId = flagValue(args, ['--reference-level', '--level']);
  const boundaryMm = parsePoint2List(flagValue(args, ['--boundary', '--points']), '--boundary');
  if (!referenceLevelId) {
    console.error('site setup requires --reference-level <id>.');
    process.exit(1);
  }
  if (boundaryMm.length < 3) {
    console.error('site setup --boundary must contain at least three points.');
    process.exit(1);
  }
  const siteId = flagValue(args, '--site-id') ?? 'site-context';
  const toposolidId = flagValue(args, '--toposolid-id') ?? `${siteId}-toposolid`;
  const projectBasePointId = flagValue(args, '--project-base-point-id') ?? `${siteId}-pbp`;
  const surveyPointId = flagValue(args, '--survey-point-id') ?? `${siteId}-survey`;
  const sunSettingsId = flagValue(args, '--sun-settings-id') ?? `${siteId}-sun`;
  const commands = [
    {
      type: 'createProjectBasePoint',
      id: projectBasePointId,
      positionMm: parsePosTriple(flagValue(args, '--project-base-point') ?? '0,0,0'),
      angleToTrueNorthDeg: parseNumber(flagValue(args, ['--true-north', '--angle']), 0),
    },
    {
      type: 'createSurveyPoint',
      id: surveyPointId,
      positionMm: parsePosTriple(flagValue(args, '--survey-point') ?? '0,0,0'),
      sharedElevationMm: parseNumber(flagValue(args, '--shared-elevation'), 0),
    },
    {
      type: 'createSunSettings',
      id: sunSettingsId,
      latitudeDeg: parseNumber(flagValue(args, ['--lat', '--latitude']), 48.13),
      longitudeDeg: parseNumber(flagValue(args, ['--lon', '--longitude']), 11.58),
      dateIso: flagValue(args, ['--date', '--date-iso']) ?? '2026-06-21',
      timeOfDay: { hours: 14, minutes: 30 },
      daylightSavingStrategy:
        flagValue(args, ['--daylight-saving', '--daylightSavingStrategy']) ?? 'auto',
    },
    {
      type: 'upsertSite',
      id: siteId,
      name: flagValue(args, '--site-name') ?? 'Site context',
      referenceLevelId,
      boundaryMm,
      padThicknessMm: parseNumber(flagValue(args, '--pad-thickness'), 80),
      baseOffsetMm: parseNumber(flagValue(args, '--base-offset'), 0),
      northDegCwFromPlanX: parseNumber(flagValue(args, ['--true-north', '--angle']), 0),
      contextObjects: parseJsonArrayFlag(flagValue(args, '--context-objects'), '--context-objects'),
    },
    {
      type: 'CreateToposolid',
      toposolidId,
      name: flagValue(args, '--toposolid-name') ?? 'Site terrain',
      boundaryMm,
      thicknessMm: parseNumber(flagValue(args, '--toposolid-thickness'), 1500),
      baseElevationMm: parseNumber(flagValue(args, '--base-elevation'), 0),
    },
  ];
  const time = flagValue(args, '--time');
  if (time) {
    const [hours, minutes] = time.split(':').map((part) => Number(part));
    if (!Number.isInteger(hours) || !Number.isInteger(minutes)) {
      console.error('site setup --time must be HH:MM.');
      process.exit(1);
    }
    commands[2].timeOfDay = { hours, minutes };
  }
  const propertyLines = parseJsonArrayFlag(flagValue(args, '--property-lines'), '--property-lines');
  for (const [index, line] of propertyLines.entries()) {
    commands.push({
      type: 'createPropertyLine',
      id: line.id ?? `${siteId}-property-${index + 1}`,
      name: line.name ?? '',
      startMm: point2FromPair(line.startMm ?? line.start),
      endMm: point2FromPair(line.endMm ?? line.end),
      ...(line.setbackMm != null ? { setbackMm: Number(line.setbackMm) } : {}),
      ...(line.classification ? { classification: line.classification } : {}),
    });
  }
  return commands;
}

export async function cmdSite(modelId, userId, domain, sub, args) {
  const opts = authorOptions(args);
  let command;
  let toolId;
  if (domain === 'setup') {
    const commands = commandsForSiteSetup(args);
    const bundle = siteBundle('site.setup_georeference', commands, opts);
    await runGeneratedBundle(modelId, userId, bundle, opts.mode, opts.jsonOnly);
    return;
  }
  if (domain === 'graded-region') {
    command = commandForSiteGradedRegion(sub, args);
    toolId = `site.graded_region_${sub}`;
  } else if (domain === 'property-line') {
    command = commandForSitePropertyLine(sub, args);
    toolId = `site.property_line_${sub}`;
  } else if (domain === 'excavation' || domain === 'toposolid-excavation') {
    command = commandForSiteToposolidExcavation(sub, args);
    toolId = `site.toposolid_excavation_${sub}`;
  } else if (domain === 'subdivision' || domain === 'toposolid-subdivision') {
    command = commandForSiteSubdivision(sub, args);
    toolId = `site.toposolid_subdivision_${sub}`;
  } else if (domain === 'base-point') {
    command = commandForSiteBasePoint(sub, args);
    toolId = `site.project_base_point_${sub}`;
  } else if (domain === 'survey-point') {
    command = commandForSiteSurveyPoint(sub, args);
    toolId = `site.survey_point_${sub}`;
  } else if (domain === 'sun-settings') {
    command = commandForSiteSunSettings(sub, args);
    toolId = `site.sun_settings_${sub}`;
  } else {
    console.error(
      `Unknown site subcommand: ${domain ?? '(none)'}. Use setup | graded-region | property-line | excavation | subdivision | base-point | survey-point | sun-settings.`,
    );
    process.exit(1);
  }
  const bundle = siteBundle(toolId, [command], opts);
  await runGeneratedBundle(modelId, userId, bundle, opts.mode, opts.jsonOnly);
}
