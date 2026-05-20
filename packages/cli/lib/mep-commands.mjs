import {
  flagValue,
  parseCsv,
  parseJsonArrayFlag,
  parseJsonObjectFlag,
  parseNumber,
  parsePoint2List,
  point2FromPair,
} from './cli-args.mjs';
import { authorOptions, buildGeneratedBundle, runGeneratedBundle } from './generated-bundles.mjs';

function applyOptionalMepRouteFlags(command, args) {
  const id = flagValue(args, '--id');
  const name = flagValue(args, '--name');
  const systemName = flagValue(args, '--system-name');
  const flowDirection = flagValue(args, '--flow');
  const serviceLevel = flagValue(args, '--service-level');
  const clearanceZone = parseJsonObjectFlag(
    flagValue(args, '--clearance-zone'),
    '--clearance-zone',
  );
  const maintainAccessZone = parseJsonObjectFlag(
    flagValue(args, '--maintain-access-zone'),
    '--maintain-access-zone',
  );
  const connectors = parseJsonArrayFlag(flagValue(args, '--connectors'), '--connectors');
  const colour = flagValue(args, ['--colour', '--color']);
  if (id) command.id = id;
  if (name) command.name = name;
  if (systemName) command.systemName = systemName;
  if (flowDirection) command.flowDirection = flowDirection;
  if (serviceLevel) command.serviceLevel = serviceLevel;
  if (clearanceZone) command.clearanceZone = clearanceZone;
  if (maintainAccessZone) command.maintainAccessZone = maintainAccessZone;
  if (connectors.length) command.connectors = connectors;
  if (colour) command.colour = colour;
}

export async function cmdMep(modelId, userId, sub, args) {
  const opts = authorOptions(args);
  let command;
  let toolId;
  if (sub === 'pipe-route' || sub === 'duct-route' || sub === 'cable-tray') {
    const levelId = flagValue(args, '--level');
    const line = parsePoint2List(flagValue(args, ['--line', '--route']), '--line');
    if (!levelId) {
      console.error(`mep ${sub} requires --level <id>.`);
      process.exit(1);
    }
    if (line.length !== 2) {
      console.error(`mep ${sub} requires --line "x,y;x,y".`);
      process.exit(1);
    }
    const baseRoute = {
      levelId,
      startMm: line[0],
      endMm: line[1],
      elevationMm: parseNumber(flagValue(args, '--elevation'), 0),
      systemType: flagValue(args, '--system') ?? (sub === 'cable-tray' ? 'electrical' : 'other'),
    };
    if (sub === 'pipe-route') {
      command = {
        type: 'createPipe',
        ...baseRoute,
        diameterMm: parseNumber(flagValue(args, '--diameter'), 25),
      };
      const insulation = flagValue(args, '--insulation');
      const materialKey = flagValue(args, '--material-key');
      if (insulation) command.insulation = insulation;
      if (materialKey) command.materialKey = materialKey;
      toolId = 'mep.pipe_route';
    } else if (sub === 'duct-route') {
      command = {
        type: 'createDuct',
        ...baseRoute,
        widthMm: parseNumber(flagValue(args, '--width'), 300),
        heightMm: parseNumber(flagValue(args, '--height'), 200),
        shape: flagValue(args, '--shape') ?? 'rectangular',
      };
      const insulation = flagValue(args, '--insulation');
      if (insulation) command.insulation = insulation;
      toolId = 'mep.duct_route';
    } else {
      command = {
        type: 'createCableTray',
        ...baseRoute,
        name: flagValue(args, '--name') ?? 'Cable tray',
        widthMm: parseNumber(flagValue(args, '--width'), 200),
        heightMm: parseNumber(flagValue(args, '--height'), 60),
      };
      toolId = 'mep.cable_tray';
    }
    applyOptionalMepRouteFlags(command, args);
  } else if (sub === 'equipment' || sub === 'fixture' || sub === 'terminal') {
    const levelId = flagValue(args, '--level');
    const positionMm = point2FromPair(flagValue(args, '--position'));
    if (!levelId) {
      console.error(`mep ${sub} requires --level <id>.`);
      process.exit(1);
    }
    if (!Number.isFinite(positionMm.xMm) || !Number.isFinite(positionMm.yMm)) {
      console.error(`mep ${sub} requires --position x,y.`);
      process.exit(1);
    }
    command = {
      type:
        sub === 'equipment'
          ? 'createMepEquipment'
          : sub === 'fixture'
            ? 'createFixture'
            : 'createMepTerminal',
      levelId,
      positionMm,
      name:
        flagValue(args, '--name') ??
        (sub === 'equipment' ? 'MEP Equipment' : sub === 'fixture' ? 'Fixture' : 'MEP Terminal'),
      systemType:
        flagValue(args, '--system') ??
        (sub === 'fixture' ? 'domestic_water' : sub === 'terminal' ? 'hvac_supply' : 'other'),
    };
    const id = flagValue(args, '--id');
    const systemName = flagValue(args, '--system-name');
    const connectors = parseJsonArrayFlag(flagValue(args, '--connectors'), '--connectors');
    if (id) command.id = id;
    if (systemName) command.systemName = systemName;
    if (connectors.length) command.connectors = connectors;
    if (sub === 'equipment') {
      command.elevationMm = parseNumber(flagValue(args, '--elevation'), 0);
      const equipmentType = flagValue(args, '--equipment-type');
      const familyTypeId = flagValue(args, ['--family-type', '--type']);
      const serviceLevel = flagValue(args, '--service-level');
      const clearanceZone = parseJsonObjectFlag(
        flagValue(args, '--clearance-zone'),
        '--clearance-zone',
      );
      const maintainAccessZone = parseJsonObjectFlag(
        flagValue(args, '--maintain-access-zone'),
        '--maintain-access-zone',
      );
      const electricalLoadW = parseNumber(flagValue(args, '--electrical-load'), undefined);
      if (equipmentType) command.equipmentType = equipmentType;
      if (familyTypeId) command.familyTypeId = familyTypeId;
      if (serviceLevel) command.serviceLevel = serviceLevel;
      if (clearanceZone) command.clearanceZone = clearanceZone;
      if (maintainAccessZone) command.maintainAccessZone = maintainAccessZone;
      if (Number.isFinite(electricalLoadW)) command.electricalLoadW = electricalLoadW;
      toolId = 'mep.equipment';
    } else if (sub === 'fixture') {
      const roomId = flagValue(args, '--room');
      const fixtureType = flagValue(args, '--fixture-type');
      const electricalLoadW = parseNumber(flagValue(args, '--electrical-load'), undefined);
      if (roomId) command.roomId = roomId;
      if (fixtureType) command.fixtureType = fixtureType;
      if (Number.isFinite(electricalLoadW)) command.electricalLoadW = electricalLoadW;
      toolId = 'mep.fixture';
    } else {
      const roomId = flagValue(args, '--room');
      const terminalKind = flagValue(args, '--terminal-kind');
      const flowDirection = flagValue(args, '--flow');
      const serviceLevel = flagValue(args, '--service-level');
      if (roomId) command.roomId = roomId;
      if (terminalKind) command.terminalKind = terminalKind;
      if (flowDirection) command.flowDirection = flowDirection;
      if (serviceLevel) command.serviceLevel = serviceLevel;
      toolId = 'mep.terminal';
    }
  } else if (sub === 'opening-request') {
    const hostElementId = flagValue(args, ['--host', '--host-element']);
    if (!hostElementId) {
      console.error('mep opening-request requires --host <id>.');
      process.exit(1);
    }
    command = {
      type: 'createMepOpeningRequest',
      hostElementId,
      name: flagValue(args, '--name') ?? 'MEP opening request',
      requesterElementIds: parseCsv(flagValue(args, ['--requester', '--requesters'])),
      openingKind: flagValue(args, '--opening-kind') ?? 'wall',
      clearanceMm: parseNumber(flagValue(args, '--clearance'), 50),
      systemType: flagValue(args, '--system') ?? 'other',
    };
    const id = flagValue(args, '--id');
    const levelId = flagValue(args, '--level');
    const position = flagValue(args, '--position');
    const widthMm = parseNumber(flagValue(args, '--width'), undefined);
    const heightMm = parseNumber(flagValue(args, '--height'), undefined);
    const diameterMm = parseNumber(flagValue(args, '--diameter'), undefined);
    const systemName = flagValue(args, '--system-name');
    if (id) command.id = id;
    if (levelId) command.levelId = levelId;
    if (position) command.positionMm = point2FromPair(position);
    if (Number.isFinite(widthMm)) command.widthMm = widthMm;
    if (Number.isFinite(heightMm)) command.heightMm = heightMm;
    if (Number.isFinite(diameterMm)) command.diameterMm = diameterMm;
    if (systemName) command.systemName = systemName;
    toolId = 'mep.opening_request';
  } else {
    console.error(
      `Unknown mep subcommand: ${sub ?? '(none)'}. Use pipe-route | duct-route | cable-tray | equipment | fixture | terminal | opening-request.`,
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
