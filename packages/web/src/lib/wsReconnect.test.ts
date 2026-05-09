import { describe, expect, it } from 'vitest';

import { reconnectDelayMs } from './wsReconnect';

describe('reconnectDelayMs', () => {
  it('backs off exponentially with bounded jitter', () => {
    expect(reconnectDelayMs(1, () => 0.5)).toBe(250);
    expect(reconnectDelayMs(2, () => 0.5)).toBe(500);
    expect(reconnectDelayMs(10, () => 0.5)).toBe(8000);
  });

  it('clamps low attempts and never returns a negative delay', () => {
    expect(reconnectDelayMs(0, () => 0)).toBe(200);
  });
});
