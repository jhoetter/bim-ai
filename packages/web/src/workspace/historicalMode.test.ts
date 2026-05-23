/**
 * Time-travel Wave 4 — historical-mode contract for the Workspace bootstrap.
 *
 * Behaviour pinned by `spec/trackers/model-time-travel-tracker.md`:
 *
 *  1. When `?at=<commit_id>` is present alongside `?modelId=`, the snapshot
 *     loader fetches `/api/models/{id}/state?at=<commit_id>` and feeds the
 *     payload through `hydrateFromSnapshot` — **without opening a
 *     WebSocket**.
 *  2. The seed-library bootstrap is skipped (no `bootstrap()` round trip,
 *     no presence channel).
 *  3. The historical viewer is read-only — proven elsewhere by the
 *     `onSemanticCommand` guard in Workspace.tsx — and the hook reports
 *     `isHistorical: true` so the rest of the UI can render the banner /
 *     disable command buttons.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';

import { useWorkspaceSnapshot } from './useWorkspaceSnapshot';
import { useBimStore } from '../state/store';

const SAMPLE_MODEL_ID = '11111111-2222-3333-4444-555555555555';
const SAMPLE_COMMIT_ID = '01HZZZZZZZZZZZZZZZZZZZZZZZ';

const SAMPLE_HISTORICAL_PAYLOAD = {
  modelId: SAMPLE_MODEL_ID,
  at: SAMPLE_COMMIT_ID,
  revision: 7,
  document: {
    revision: 7,
    elements: {
      'wall-1': { kind: 'wall', id: 'wall-1' },
      'floor-1': { kind: 'floor', id: 'floor-1' },
    },
  },
};

class WebSocketSpy {
  static instances: WebSocketSpy[] = [];
  static reset() {
    WebSocketSpy.instances = [];
  }
  constructor(public url: string) {
    WebSocketSpy.instances.push(this);
  }
  readyState = 0;
  close() {
    /* noop */
  }
  send() {
    /* noop */
  }
  onopen: ((this: WebSocket, ev: Event) => unknown) | null = null;
  onclose: ((this: WebSocket, ev: CloseEvent) => unknown) | null = null;
  onmessage: ((this: WebSocket, ev: MessageEvent) => unknown) | null = null;
  onerror: ((this: WebSocket, ev: Event) => unknown) | null = null;
}

function withHistoricalUrl(modelId: string, commitId: string): () => void {
  const original = window.location.href;
  // jsdom honors history.pushState — use it instead of mutating location.search.
  window.history.pushState({}, '', `/?modelId=${modelId}&at=${commitId}`);
  return () => {
    window.history.pushState({}, '', original);
  };
}

describe('useWorkspaceSnapshot — historical (`?at=`) mode', () => {
  let restoreUrl: () => void;
  let originalWebSocket: typeof WebSocket;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Reset the bim store so the bootstrap effect fires on each mount
    // (the run-once gate is "elementsById is empty").
    useBimStore.setState({
      elementsById: {},
      revision: 0,
      modelId: undefined,
    });

    WebSocketSpy.reset();
    originalWebSocket = globalThis.WebSocket;
    // @ts-expect-error — test stub does not implement every WebSocket member
    globalThis.WebSocket = WebSocketSpy;

    const buildResponse = (body: unknown): Response =>
      ({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => body,
        text: async () => JSON.stringify(body),
      }) as unknown as Response;

    fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('/state?at=')) {
        return buildResponse(SAMPLE_HISTORICAL_PAYLOAD);
      }
      if (url.includes('/api/jobs')) {
        return buildResponse([]);
      }
      // /api/activity, /api/comments, /api/building-presets — return empty.
      return buildResponse({ events: [], comments: [], buildingPresets: [] });
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    restoreUrl = withHistoricalUrl(SAMPLE_MODEL_ID, SAMPLE_COMMIT_ID);
  });

  afterEach(() => {
    restoreUrl();
    globalThis.WebSocket = originalWebSocket;
    vi.restoreAllMocks();
  });

  it('reports isHistorical=true when a commit id is supplied', () => {
    const { result } = renderHook(() => useWorkspaceSnapshot(SAMPLE_COMMIT_ID));
    expect(result.current.isHistorical).toBe(true);
  });

  it('reports isHistorical=false in the default seed-library path', () => {
    const { result } = renderHook(() => useWorkspaceSnapshot(null));
    expect(result.current.isHistorical).toBe(false);
  });

  it('fetches /state?at=<commit_id> and hydrates the store without opening a websocket', async () => {
    renderHook(() => useWorkspaceSnapshot(SAMPLE_COMMIT_ID));

    // The bootstrap effect runs synchronously on mount; the state fetch is
    // async — wait for hydration to land.
    await waitFor(() => {
      expect(useBimStore.getState().modelId).toBe(SAMPLE_MODEL_ID);
    });

    // Document → store elements roundtrip.
    expect(Object.keys(useBimStore.getState().elementsById)).toEqual(
      expect.arrayContaining(['wall-1', 'floor-1']),
    );
    expect(useBimStore.getState().revision).toBe(7);

    // The state endpoint was hit at least once with the right shape.
    const stateCalls = fetchMock.mock.calls.filter((args) => {
      const url = typeof args[0] === 'string' ? args[0] : String(args[0]);
      return url.includes('/state?at=');
    });
    expect(stateCalls.length).toBeGreaterThanOrEqual(1);
    const lastStateUrl = String(stateCalls[stateCalls.length - 1]?.[0] ?? '');
    expect(lastStateUrl).toContain(`/api/models/${SAMPLE_MODEL_ID}/state`);
    expect(lastStateUrl).toContain(`at=${SAMPLE_COMMIT_ID}`);

    // Hard requirement: no websocket constructed in historical mode.
    expect(WebSocketSpy.instances.length).toBe(0);

    // Hook surface signal stays in agreement.
    // (renderHook closes over the latest result via `result.current`.)
  });

  it('does NOT fetch /snapshot — historical mode bypasses the seed-library path entirely', async () => {
    renderHook(() => useWorkspaceSnapshot(SAMPLE_COMMIT_ID));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
    });
    // Tiny grace period to ensure no late /snapshot call slipped in.
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    const snapshotCalls = fetchMock.mock.calls.filter((args) => {
      const url = typeof args[0] === 'string' ? args[0] : String(args[0]);
      return url.endsWith('/snapshot?expandLinks=true');
    });
    expect(snapshotCalls.length).toBe(0);
  });
});
