import { describe, expect, it } from 'vitest';

import { parseCommandLine } from './parser';

describe('parseCommandLine', () => {
  it('parses room rect with level + hud origin', () => {
    const got = parseCommandLine('ROOM rect 4100 × 2750', {
      levelId: 'lvl-a',
      hudMm: { xMm: 222, yMm: 444 },
    });
    expect(got.ok).toBe(true);

    if (got.ok)
      expect(got.command).toMatchObject({
        type: 'createRoomRectangle',

        levelId: 'lvl-a',

        origin: { xMm: 222, yMm: 444 },

        widthMm: 4100,

        depthMm: 2750,
      });
  });

  it('parses bare JSON commands', () => {
    const got = parseCommandLine(' {"type":"deleteElements","elementIds":["a"]} ', {
      levelId: 'x',

      hudMm: undefined,
    });

    expect(got.ok).toBe(true);
    if (got.ok) expect(got.command.type).toBe('deleteElements');
  });
});
