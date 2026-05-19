import { MAX_WS_RECONNECT_ATTEMPTS, reconnectDelayMs } from './wsReconnect';

const BENIGN_VITE_PROXY_SOCKET_CODES = new Set(['EPIPE', 'ECONNRESET']);
const WS_READY_OPEN = 1;
const WS_READY_CLOSING = 2;
const WS_READY_CLOSED = 3;

export type WsStabilityClassification = 'benign' | 'actionable';

export interface ProxySocketErrorLike {
  code?: unknown;
  message?: unknown;
}

export interface ViteProxySocketErrorClassification {
  classification: WsStabilityClassification;
  code: string | null;
  shouldLog: boolean;
  reason: string;
}

export function classifyViteProxySocketError(
  error: ProxySocketErrorLike,
): ViteProxySocketErrorClassification {
  const code = typeof error.code === 'string' ? error.code : null;
  if (code && BENIGN_VITE_PROXY_SOCKET_CODES.has(code)) {
    return {
      classification: 'benign',
      code,
      shouldLog: false,
      reason: 'dev proxy socket closed during websocket reconnect or browser teardown',
    };
  }

  return {
    classification: 'actionable',
    code,
    shouldLog: true,
    reason: 'unexpected Vite proxy failure; keep visible for diagnosis',
  };
}

export function isBenignViteProxySocketError(error: ProxySocketErrorLike): boolean {
  return classifyViteProxySocketError(error).classification === 'benign';
}

export type AppWsEndpoint = 'workspace' | 'jobs' | 'presentation';
export type AppWsIndicatorState = 'connected' | 'reconnecting' | 'offline' | 'revoked';
export type AppWsReconnectAction = 'ignore' | 'schedule_reconnect' | 'wait_until_visible' | 'stop';

export interface AppWsCloseInput {
  endpoint: AppWsEndpoint;
  closeCode?: number;
  intentional?: boolean;
  nextAttempt: number;
  hidden?: boolean;
  maxAttempts?: number;
}

export interface AppWsReconnectDecision {
  classification: WsStabilityClassification;
  action: AppWsReconnectAction;
  nextState: AppWsIndicatorState;
  nextAttempt: number;
  delayMs: number | null;
  reason: string;
}

export function classifyAppWsClose(
  input: AppWsCloseInput,
  delayForAttempt: (attempt: number) => number = reconnectDelayMs,
): AppWsReconnectDecision {
  const nextAttempt = Math.max(1, Math.floor(input.nextAttempt));
  const maxAttempts = input.maxAttempts ?? MAX_WS_RECONNECT_ATTEMPTS;

  if (input.intentional) {
    return {
      classification: 'benign',
      action: 'ignore',
      nextState: 'offline',
      nextAttempt,
      delayMs: null,
      reason: 'component cleanup intentionally closed the websocket',
    };
  }

  if (input.closeCode === 4403) {
    return {
      classification: 'actionable',
      action: 'stop',
      nextState: input.endpoint === 'presentation' ? 'revoked' : 'offline',
      nextAttempt,
      delayMs: null,
      reason: 'server rejected websocket authorization or revoked presentation access',
    };
  }

  if (input.closeCode === 4404) {
    return {
      classification: 'actionable',
      action: 'stop',
      nextState: 'offline',
      nextAttempt,
      delayMs: null,
      reason: 'server could not resolve the websocket model',
    };
  }

  if (nextAttempt > maxAttempts) {
    return {
      classification: 'actionable',
      action: 'stop',
      nextState: 'offline',
      nextAttempt,
      delayMs: null,
      reason: 'websocket exceeded reconnect attempt budget',
    };
  }

  if (input.hidden) {
    return {
      classification: 'benign',
      action: 'wait_until_visible',
      nextState: 'reconnecting',
      nextAttempt,
      delayMs: null,
      reason: 'tab is hidden; defer reconnect to avoid background churn',
    };
  }

  return {
    classification: 'benign',
    action: 'schedule_reconnect',
    nextState: 'reconnecting',
    nextAttempt,
    delayMs: delayForAttempt(nextAttempt),
    reason: 'transient websocket close; reconnect with bounded backoff',
  };
}

export function appWsIndicatorStateForReadyState(
  readyState: number,
  current: AppWsIndicatorState,
): AppWsIndicatorState {
  if (readyState === WS_READY_OPEN) return 'connected';
  if (readyState === WS_READY_CLOSING || readyState === WS_READY_CLOSED) return 'offline';
  return current;
}
