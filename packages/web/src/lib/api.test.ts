import { afterEach, describe, expect, it, vi } from 'vitest';

import { ApiHttpError, applyCommand, applyCommandBundle } from './api';

const conflictDetail = {
  reason: 'Grid G-1 is degenerate',
  replayDiagnostics: {
    blockingViolationRuleIds: ['grid_degenerate'],
    firstBlockingCommandIndex: 2,
  },
};

function mockFetchJson(status: number, statusText: string, body: unknown) {
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(JSON.stringify(body), {
      status,
      statusText,
      headers: { 'content-type': 'application/json' },
    }),
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('command api replay diagnostics', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('preserves structured 409 detail for applyCommand', async () => {
    const fetchMock = mockFetchJson(409, 'Conflict', { detail: conflictDetail });

    await expect(
      applyCommand(
        'model/a',
        { type: 'createGrid', id: 'G-1' },
        { userId: 'reviewer', clientOpId: 'op-1' },
      ),
    ).rejects.toMatchObject({
      name: 'ApiHttpError',
      status: 409,
      message: conflictDetail.reason,
      detail: conflictDetail,
    } satisfies Partial<ApiHttpError>);

    expect(fetchMock).toHaveBeenCalledWith('/api/models/model%2Fa/commands', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        command: { type: 'createGrid', id: 'G-1' },
        clientOpId: 'op-1',
        userId: 'reviewer',
      }),
    });
  });

  it('preserves structured 409 detail for applyCommandBundle', async () => {
    mockFetchJson(409, 'Conflict', { detail: conflictDetail });

    await expect(
      applyCommandBundle('model-a', [{ type: 'createGrid', id: 'G-1' }], {
        userId: 'reviewer',
      }),
    ).rejects.toMatchObject({
      status: 409,
      message: conflictDetail.reason,
      detail: conflictDetail,
    } satisfies Partial<ApiHttpError>);
  });
});
