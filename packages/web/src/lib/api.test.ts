import { describe, expect, it, vi, afterEach } from 'vitest';

import {
  ApiHttpError,
  applyCommand,
  applyCommandBundle,
  fetchConstructabilityReport,
  uploadDxfFile,
} from './api';

function mockFetchOnce(payload: { ok: boolean; status: number; statusText: string; body: string }) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: payload.ok,
      status: payload.status,
      statusText: payload.statusText,
      text: async () => payload.body,
    }),
  );
}

describe('applyCommand', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('parses success JSON', async () => {
    mockFetchOnce({
      ok: true,
      status: 200,
      statusText: 'OK',
      body: JSON.stringify({ ok: true, revision: 7, elements: { a: { kind: 'wall' } } }),
    });

    const r = await applyCommand(
      'model-a',
      { type: 'createWall' },
      { userId: 'u1', clientOpId: 'op-1' },
    );

    expect(r.revision).toBe(7);
    expect(r.elements).toEqual({ a: { kind: 'wall' } });
    expect(fetch).toHaveBeenCalledWith(
      '/api/models/model-a/commands',
      expect.objectContaining({
        method: 'POST',
        headers: { 'content-type': 'application/json' },
      }),
    );
    const init = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1] as RequestInit;
    const parsed = JSON.parse(init.body as string);
    expect(parsed.command).toEqual({ type: 'createWall' });
    expect(parsed.userId).toBe('u1');
    expect(parsed.clientOpId).toBe('op-1');
  });

  it('throws ApiHttpError with structured detail on 409', async () => {
    const detail = {
      reason: 'constraint blocked',
      replayDiagnostics: { firstBlockingCommandIndex: 2 },
    };
    mockFetchOnce({
      ok: false,
      status: 409,
      statusText: 'Conflict',
      body: JSON.stringify({ detail }),
    });

    let err: unknown;
    try {
      await applyCommand('m1', { type: 'noop' });
      expect.fail('expected throw');
    } catch (e) {
      err = e;
    }

    expect(err).toBeInstanceOf(ApiHttpError);
    const httpErr = err as ApiHttpError;
    expect(httpErr.status).toBe(409);
    expect(httpErr.detail).toEqual(detail);
    expect(httpErr.message).toBe('constraint blocked');
  });

  it('keeps raw body text in detail when response is not JSON', async () => {
    mockFetchOnce({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      body: 'boom',
    });

    let err: unknown;
    try {
      await applyCommand('m1', { type: 'noop' });
      expect.fail('expected throw');
    } catch (e) {
      err = e;
    }

    expect(err).toBeInstanceOf(ApiHttpError);
    const httpErr = err as ApiHttpError;
    expect(httpErr.status).toBe(500);
    expect(httpErr.detail).toBe('boom');
    expect(httpErr.message).toBe('500 Internal Server Error');
  });
});

describe('applyCommandBundle', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('throws ApiHttpError with structured detail on 409', async () => {
    const detail = {
      reason: 'bundle conflict',
      replayDiagnostics: { firstBlockingCommandIndex: 0 },
    };
    mockFetchOnce({
      ok: false,
      status: 409,
      statusText: 'Conflict',
      body: JSON.stringify({ detail }),
    });

    let err: unknown;
    try {
      await applyCommandBundle('m2', [{ type: 'x' }], { userId: 'u' });
      expect.fail('expected throw');
    } catch (e) {
      err = e;
    }

    expect(err).toBeInstanceOf(ApiHttpError);
    expect((err as ApiHttpError).detail).toEqual(detail);
    expect((err as ApiHttpError).message).toBe('bundle conflict');

    const init = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1] as RequestInit;
    expect(JSON.parse(init.body as string)).toEqual({
      commands: [{ type: 'x' }],
      userId: 'u',
    });
  });
});

describe('uploadDxfFile', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('sends import-time unit, positioning, and color options', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ linkDxfId: 'dxf-1', name: 'site' }),
      }),
    );

    const file = new File(['0\nSECTION\n2\nEOF'], 'site.dxf', {
      type: 'application/octet-stream',
    });
    await uploadDxfFile('model 1', file, 'lvl-1', {
      originAlignmentMode: 'shared_coords',
      unitOverride: 'meters',
      colorMode: 'custom',
      customColor: '#123456',
      overlayOpacity: 0.65,
      hiddenLayerNames: ['A-DEMO'],
    });

    expect(fetch).toHaveBeenCalledWith('/api/models/model%201/upload-dxf-file', {
      method: 'POST',
      body: expect.any(FormData),
    });
    const init = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1] as RequestInit;
    const form = init.body as FormData;
    expect(form.get('levelId')).toBe('lvl-1');
    expect(form.get('originAlignmentMode')).toBe('shared_coords');
    expect(form.get('unitOverride')).toBe('meters');
    expect(form.get('colorMode')).toBe('custom');
    expect(form.get('customColor')).toBe('#123456');
    expect(form.get('overlayOpacity')).toBe('0.65');
    expect(form.get('hiddenLayerNames')).toBe('A-DEMO');
  });
});

describe('fetchConstructabilityReport', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('fetches the model constructability-report endpoint', async () => {
    mockFetchOnce({
      ok: true,
      status: 200,
      statusText: 'OK',
      body: JSON.stringify({
        format: 'constructabilityReport_v1',
        modelId: 'model 1',
        revision: 3,
        profile: 'authoring_default',
        summary: {
          findingCount: 0,
          issueCount: 0,
          severityCounts: {},
          ruleCounts: {},
          statusCounts: {},
        },
        findings: [],
        issues: [],
      }),
    });

    const report = await fetchConstructabilityReport('model 1');

    expect(report.format).toBe('constructabilityReport_v1');
    expect(fetch).toHaveBeenCalledWith('/api/models/model%201/constructability-report', undefined);
  });
});
