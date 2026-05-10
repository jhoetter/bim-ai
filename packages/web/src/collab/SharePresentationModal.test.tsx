import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SharePresentationModal } from './SharePresentationModal';

const modelId = 'model-1';

describe('<SharePresentationModal />', () => {
  const writeText = vi.fn();
  const fetchSpy = vi.fn();

  beforeEach(() => {
    writeText.mockReset();
    fetchSpy.mockReset();
    vi.stubGlobal('fetch', fetchSpy);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('copies an existing presentation link without creating a new one', async () => {
    fetchSpy.mockResolvedValue(
      new Response(
        JSON.stringify({
          presentations: [
            {
              id: 'link-1',
              modelId,
              token: 'existing-token',
              createdBy: 'local-dev',
              createdAt: 1715300000000,
              isRevoked: false,
              openCount: 3,
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const { findAllByText } = render(
      <SharePresentationModal modelId={modelId} open onClose={vi.fn()} />,
    );

    await waitFor(async () => expect(await findAllByText('Copy link')).toHaveLength(2));
    const copyButtons = await findAllByText('Copy link');
    fireEvent.click(copyButtons[1]);

    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/p/existing-token`);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('reactivates inactive presentation links from the existing row', async () => {
    fetchSpy
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            presentations: [
              {
                id: 'link-1',
                modelId,
                token: 'existing-token',
                createdBy: 'local-dev',
                createdAt: 1715300000000,
                isRevoked: true,
                openCount: 0,
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ activatedAt: 1715300001000 }), { status: 200 }),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ presentations: [] }), { status: 200 }));

    const { findByText } = render(
      <SharePresentationModal modelId={modelId} open onClose={vi.fn()} />,
    );

    fireEvent.click(await findByText('Activate'));

    await waitFor(() =>
      expect(fetchSpy).toHaveBeenCalledWith(
        `/api/models/${modelId}/presentations/link-1/activate`,
        {
          method: 'POST',
        },
      ),
    );
  });
});
