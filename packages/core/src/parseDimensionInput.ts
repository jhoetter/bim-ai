export type ParsedDimensionInput = {
  ok: true;
  mm: number;
  sourceUnit: 'mm' | 'm' | 'ft-in';
};

export type InvalidDimensionInput = {
  ok: false;
  reason: 'empty' | 'invalid';
};

export type DimensionInputParseResult = ParsedDimensionInput | InvalidDimensionInput;

const FEET_INCH_RE = /^\s*(-?\d+(?:\.\d+)?)\s*'\s*(?:(\d+(?:\.\d+)?)\s*(?:"|in)?)?\s*$/i;
const NUMBER_UNIT_RE = /^\s*(-?\d+(?:[.,]\d+)?)\s*(mm|millimeter|millimeters|m|meter|meters)?\s*$/i;

export function parseDimensionInput(input: string): DimensionInputParseResult {
  const raw = input.trim();
  if (!raw) return { ok: false, reason: 'empty' };

  const ft = FEET_INCH_RE.exec(raw);
  if (ft) {
    const feet = Number(ft[1]);
    const inches = ft[2] == null ? 0 : Number(ft[2]);
    if (Number.isFinite(feet) && Number.isFinite(inches)) {
      return { ok: true, mm: feet * 304.8 + inches * 25.4, sourceUnit: 'ft-in' };
    }
  }

  const match = NUMBER_UNIT_RE.exec(raw);
  if (!match) return { ok: false, reason: 'invalid' };

  const n = Number(match[1]!.replace(',', '.'));
  if (!Number.isFinite(n)) return { ok: false, reason: 'invalid' };
  const unit = (match[2] ?? '').toLowerCase();
  if (unit === 'm' || unit === 'meter' || unit === 'meters') {
    return { ok: true, mm: n * 1000, sourceUnit: 'm' };
  }
  if (unit === 'mm' || unit === 'millimeter' || unit === 'millimeters') {
    return { ok: true, mm: n, sourceUnit: 'mm' };
  }

  // Bare decimals are metres; bare integers are millimetres. This preserves
  // the existing "5400" workflow while making "5.4" mean 5.4 m.
  return {
    ok: true,
    mm: raw.includes('.') || raw.includes(',') ? n * 1000 : n,
    sourceUnit: raw.includes('.') || raw.includes(',') ? 'm' : 'mm',
  };
}
