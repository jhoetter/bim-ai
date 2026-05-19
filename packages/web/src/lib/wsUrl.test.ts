import { describe, expect, it } from 'vitest';

import { resolveApiWsBase } from './wsUrl';

describe('resolveApiWsBase', () => {
  it('uses the API dev port directly in dev mode', () => {
    expect(
      resolveApiWsBase({
        location: { protocol: 'http:', hostname: '127.0.0.1', host: '127.0.0.1:2000' },
        dev: true,
        apiPort: '8500',
      }),
    ).toBe('ws://127.0.0.1:8500');
  });

  it('uses same-origin websockets outside dev mode', () => {
    expect(
      resolveApiWsBase({
        location: { protocol: 'https:', hostname: 'app.example.test', host: 'app.example.test' },
        dev: false,
        apiPort: '8500',
      }),
    ).toBe('wss://app.example.test');
  });

  it('honors an explicit websocket base override', () => {
    expect(
      resolveApiWsBase({
        location: { protocol: 'http:', hostname: '127.0.0.1', host: '127.0.0.1:2000' },
        dev: true,
        apiPort: '8500',
        apiWsBase: 'ws://api.local.test:9000/',
      }),
    ).toBe('ws://api.local.test:9000');
  });
});
