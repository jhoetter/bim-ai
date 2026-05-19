import { describe, expect, it } from 'vitest';

import {
  appWsIndicatorStateForReadyState,
  classifyAppWsClose,
  classifyViteProxySocketError,
  isBenignViteProxySocketError,
} from './wsStability';

describe('classifyViteProxySocketError', () => {
  it('treats dev proxy EPIPE and ECONNRESET as benign websocket reconnect noise', () => {
    expect(classifyViteProxySocketError({ code: 'EPIPE' })).toMatchObject({
      classification: 'benign',
      shouldLog: false,
    });
    expect(classifyViteProxySocketError({ code: 'ECONNRESET' })).toMatchObject({
      classification: 'benign',
      shouldLog: false,
    });
    expect(isBenignViteProxySocketError({ code: 'ECONNRESET' })).toBe(true);
  });

  it('keeps unexpected proxy errors actionable and visible', () => {
    expect(classifyViteProxySocketError({ code: 'ECONNREFUSED' })).toMatchObject({
      classification: 'actionable',
      shouldLog: true,
    });
    expect(classifyViteProxySocketError({ message: 'socket hang up' })).toMatchObject({
      classification: 'actionable',
      code: null,
      shouldLog: true,
    });
  });
});

describe('classifyAppWsClose', () => {
  it('classifies transient closes as benign reconnects with bounded backoff', () => {
    expect(
      classifyAppWsClose(
        { endpoint: 'workspace', closeCode: 1006, nextAttempt: 3 },
        (attempt) => attempt * 100,
      ),
    ).toMatchObject({
      classification: 'benign',
      action: 'schedule_reconnect',
      nextState: 'reconnecting',
      nextAttempt: 3,
      delayMs: 300,
    });
  });

  it('defers reconnects while hidden so background tabs do not churn state', () => {
    expect(
      classifyAppWsClose({ endpoint: 'workspace', closeCode: 1006, nextAttempt: 1, hidden: true }),
    ).toMatchObject({
      classification: 'benign',
      action: 'wait_until_visible',
      nextState: 'reconnecting',
      delayMs: null,
    });
  });

  it('marks exhausted reconnect budgets as actionable offline state', () => {
    expect(
      classifyAppWsClose({
        endpoint: 'jobs',
        closeCode: 1006,
        nextAttempt: 11,
        maxAttempts: 10,
      }),
    ).toMatchObject({
      classification: 'actionable',
      action: 'stop',
      nextState: 'offline',
    });
  });

  it('marks auth and missing-model closes as actionable instead of reconnect loops', () => {
    expect(
      classifyAppWsClose({ endpoint: 'presentation', closeCode: 4403, nextAttempt: 1 }),
    ).toMatchObject({
      classification: 'actionable',
      action: 'stop',
      nextState: 'revoked',
    });
    expect(
      classifyAppWsClose({ endpoint: 'workspace', closeCode: 4404, nextAttempt: 1 }),
    ).toMatchObject({
      classification: 'actionable',
      action: 'stop',
      nextState: 'offline',
    });
  });
});

describe('appWsIndicatorStateForReadyState', () => {
  it('does not flicker connected state while a replacement socket is still connecting', () => {
    expect(appWsIndicatorStateForReadyState(0, 'connected')).toBe('connected');
    expect(appWsIndicatorStateForReadyState(1, 'offline')).toBe('connected');
    expect(appWsIndicatorStateForReadyState(3, 'connected')).toBe('offline');
  });
});
