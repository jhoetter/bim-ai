

export function parseAlignMode(s, fallback = 'origin_to_origin') {
  if (s === 'origin_to_origin' || s === 'project_origin' || s === 'shared_coords') return s;
  if (s == null) return fallback;
  console.error(
    `Unknown --align value: '${s}'. Use origin_to_origin | project_origin | shared_coords.`,
  );
  process.exit(1);
}

export function parsePosTriple(s) {
  if (!s) {
    console.error('--pos x,y,z required');
    process.exit(1);
  }
  const parts = String(s)
    .split(',')
    .map((t) => Number(t.trim()));
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) {
    console.error(`Invalid --pos value: '${s}'. Expected three comma-separated numbers (mm).`);
    process.exit(1);
  }
  return { xMm: parts[0], yMm: parts[1], zMm: parts[2] };
}

export function parsePosPair(s, flagName = '--pos') {
  if (!s) {
    console.error(`${flagName} x,y required`);
    process.exit(1);
  }
  const parts = String(s)
    .split(',')
    .map((t) => Number(t.trim()));
  if (parts.length !== 2 || parts.some((n) => !Number.isFinite(n))) {
    console.error(`Invalid ${flagName} value: '${s}'. Expected two comma-separated numbers (mm).`);
    process.exit(1);
  }
  return { xMm: parts[0], yMm: parts[1] };
}

export function flagValue(args, names) {
  const list = Array.isArray(names) ? names : [names];
  for (const name of list) {
    const eq = args.find((arg) => arg.startsWith(`${name}=`));
    if (eq) return eq.slice(name.length + 1);
    const idx = args.indexOf(name);
    if (idx !== -1 && args[idx + 1] && !args[idx + 1].startsWith('--')) return args[idx + 1];
  }
  return undefined;
}

export function hasFlag(args, name) {
  return args.includes(name);
}

export function parseCsv(value) {
  if (!value) return [];
  return String(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export function parseNumber(value, fallback) {
  if (value == null || value === '') return fallback;
  const n = Number(value);
  if (!Number.isFinite(n)) {
    console.error(`Invalid number: ${value}`);
    process.exit(1);
  }
  return n;
}

export function parseJsonObjectFlag(value, flagName) {
  if (!value) return undefined;
  try {
    const parsed = JSON.parse(value);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('object');
    return parsed;
  } catch {
    console.error(`${flagName} must be a JSON object.`);
    process.exit(1);
  }
}

export function parseJsonArrayFlag(value, flagName) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) throw new Error('array');
    return parsed;
  } catch {
    console.error(`${flagName} must be a JSON array.`);
    process.exit(1);
  }
}

export function point2FromPair(value) {
  if (Array.isArray(value)) return { xMm: Number(value[0]), yMm: Number(value[1]) };
  if (value && typeof value === 'object') {
    return { xMm: Number(value.xMm ?? value.x), yMm: Number(value.yMm ?? value.y) };
  }
  const parts = String(value)
    .split(',')
    .map((part) => Number(part.trim()));
  return { xMm: parts[0], yMm: parts[1] };
}

export function parsePoint2List(value, flagName = '--points') {
  if (!value) {
    console.error(`${flagName} required.`);
    process.exit(1);
  }
  let rawPoints;
  if (String(value).trim().startsWith('[')) {
    try {
      rawPoints = JSON.parse(value);
    } catch {
      console.error(`${flagName} must be JSON or "x,y;x,y;...".`);
      process.exit(1);
    }
  } else {
    rawPoints = String(value)
      .split(';')
      .map((part) => part.trim())
      .filter(Boolean);
  }
  const points = rawPoints.map(point2FromPair);
  if (
    points.length < 2 ||
    points.some((point) => !Number.isFinite(point.xMm) || !Number.isFinite(point.yMm))
  ) {
    console.error(`${flagName} must contain at least two valid x/y mm points.`);
    process.exit(1);
  }
  return points;
}

export function samePoint2(a, b) {
  return a && b && a.xMm === b.xMm && a.yMm === b.yMm;
}
