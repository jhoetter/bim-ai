import type { XY } from '@bim-ai/core';

export type WireRecord = Record<string, unknown>;

function asWireRecord(raw: unknown): WireRecord {
  return raw && typeof raw === 'object' ? (raw as WireRecord) : {};
}

export function coerceNumber(raw: unknown, defaultValue = 0): number {
  const value = Number(raw);
  return Number.isFinite(value) ? value : defaultValue;
}

export function coerceXY(raw: unknown): XY {
  const record = asWireRecord(raw);
  return {
    xMm: coerceNumber(record.xMm ?? record.x_mm, 0),
    yMm: coerceNumber(record.yMm ?? record.y_mm, 0),
  };
}

export function coerceXYZ(raw: unknown): { xMm: number; yMm: number; zMm: number } {
  const record = asWireRecord(raw);
  return {
    xMm: coerceNumber(record.xMm ?? record.x_mm, 0),
    yMm: coerceNumber(record.yMm ?? record.y_mm, 0),
    zMm: coerceNumber(record.zMm ?? record.z_mm, 0),
  };
}

export function coerceLoop(raw: WireRecord, camelKey: string, snakeKey: string): XY[] {
  const arr = raw[camelKey] ?? raw[snakeKey];
  if (!Array.isArray(arr)) return [];
  return arr.map(coerceXY);
}
