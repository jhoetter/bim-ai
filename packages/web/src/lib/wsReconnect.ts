export const MAX_WS_RECONNECT_ATTEMPTS = 10;

export function reconnectDelayMs(attempt: number, random = Math.random): number {
  const safeAttempt = Math.max(1, Math.floor(attempt));
  const baseDelay = Math.min(250 * 2 ** (safeAttempt - 1), 8000);
  const jitter = baseDelay * 0.2 * (random() * 2 - 1);
  return Math.max(0, Math.round(baseDelay + jitter));
}
