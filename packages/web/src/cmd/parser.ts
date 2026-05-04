/**
 * Lightweight command-bar grammar (CLI + in-app `: ` bar share this).
 */

export type ParseResult =
  | { ok: true; command: Record<string, unknown> }
  | { ok: false; error: string };

function num(s: string) {
  const n = Number(s);
  if (Number.isNaN(n)) return null;

  return n;
}

/** e.g. `room rect 4500x3200` at optional origin */
export function parseCommandLine(
  raw: string,
  ctx: { levelId?: string | undefined; hudMm?: { xMm: number; yMm: number } | undefined },
): ParseResult {
  const line = raw.trim().toLowerCase().replace(/\s+/g, ' ');

  if (!line.length) return { ok: false, error: 'empty' };

  const rect = /^room\s+rect\s+(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)/iu.exec(raw.trim());

  if (rect && ctx.levelId) {
    const w = num(rect[1] ?? '');

    const h = num(rect[2] ?? '');
    if (w === null || h === null || w < 100 || h < 100)
      return { ok: false, error: 'bad dimensions' };
    const o = ctx.hudMm ?? { xMm: 0, yMm: 0 };
    return {
      ok: true,
      command: {
        type: 'createRoomRectangle',
        levelId: ctx.levelId,
        origin: { xMm: o.xMm, yMm: o.yMm },

        widthMm: w,

        depthMm: h,
      },
    };
  }

  const del = /^del(?:ete)?\s+(.+)$/i.exec(raw.trim());

  if (del) {
    const ids = (del[1] ?? '').split(/[\s,]+/).filter(Boolean);

    if (ids.length) return { ok: true, command: { type: 'deleteElements', elementIds: ids } };
  }

  try {
    const asJson = JSON.parse(raw);

    if (asJson && typeof asJson === 'object' && 'type' in asJson)
      return { ok: true, command: asJson as Record<string, unknown> };
  } catch {
    /* not json */
  }

  return { ok: false, error: `unknown phrase: "${raw.slice(0, 120)}"` };
}
