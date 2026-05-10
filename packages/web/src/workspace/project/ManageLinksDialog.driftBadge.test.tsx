import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';

import { ManageLinksDialog } from './ManageLinksDialog';
import { useBimStore } from '../../state/store';

const SOURCE_UUID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

beforeEach(() => {
  useBimStore.setState({
    modelId: 'host-model',
    elementsById: {},
    linkSourceRevisions: {},
  });
});

afterEach(() => {
  cleanup();
});

describe('<ManageLinksDialog /> drift badge', () => {
  it('shows "+N revisions" when source has advanced past pinned revision', () => {
    useBimStore.setState({
      modelId: 'host-model',
      linkSourceRevisions: { [SOURCE_UUID]: 7 },
      elementsById: {
        'link-1': {
          kind: 'link_model',
          id: 'link-1',
          name: 'Structure',
          sourceModelId: SOURCE_UUID,
          sourceModelRevision: 5,
          positionMm: { xMm: 0, yMm: 0, zMm: 0 },
          rotationDeg: 0,
          originAlignmentMode: 'origin_to_origin',
          visibilityMode: 'host_view',
        },
      },
    });
    const { getByTestId } = render(<ManageLinksDialog open={true} onClose={vi.fn()} />);
    const badge = getByTestId('manage-links-drift-link-1');
    expect(badge.textContent).toContain('+2 revisions');
  });

  it('omits the drift badge when pinned revision matches source revision', () => {
    useBimStore.setState({
      modelId: 'host-model',
      linkSourceRevisions: { [SOURCE_UUID]: 5 },
      elementsById: {
        'link-1': {
          kind: 'link_model',
          id: 'link-1',
          name: 'Structure',
          sourceModelId: SOURCE_UUID,
          sourceModelRevision: 5,
          positionMm: { xMm: 0, yMm: 0, zMm: 0 },
          rotationDeg: 0,
          originAlignmentMode: 'origin_to_origin',
          visibilityMode: 'host_view',
        },
      },
    });
    const { queryByTestId } = render(<ManageLinksDialog open={true} onClose={vi.fn()} />);
    expect(queryByTestId('manage-links-drift-link-1')).toBeNull();
  });

  it('"Update" click sends updateLinkModel with the current source revision', async () => {
    useBimStore.setState({
      modelId: 'host-model',
      linkSourceRevisions: { [SOURCE_UUID]: 9 },
      elementsById: {
        'link-1': {
          kind: 'link_model',
          id: 'link-1',
          name: 'Structure',
          sourceModelId: SOURCE_UUID,
          sourceModelRevision: 5,
          positionMm: { xMm: 0, yMm: 0, zMm: 0 },
          rotationDeg: 0,
          originAlignmentMode: 'origin_to_origin',
          visibilityMode: 'host_view',
        },
      },
    });
    const apply = vi.fn().mockResolvedValue({ ok: true });
    const { getByTestId } = render(
      <ManageLinksDialog open={true} onClose={vi.fn()} applyCommandImpl={apply} />,
    );
    fireEvent.click(getByTestId('manage-links-update-link-1'));
    await Promise.resolve();
    expect(apply).toHaveBeenCalledWith(
      'host-model',
      expect.objectContaining({
        type: 'updateLinkModel',
        linkId: 'link-1',
        sourceModelRevision: 9,
      }),
    );
  });

  it('Pin to revision sends sourceModelRevision = current; Follow latest sends null', async () => {
    useBimStore.setState({
      modelId: 'host-model',
      linkSourceRevisions: { [SOURCE_UUID]: 4 },
      elementsById: {
        'link-1': {
          kind: 'link_model',
          id: 'link-1',
          name: 'Structure',
          sourceModelId: SOURCE_UUID,
          positionMm: { xMm: 0, yMm: 0, zMm: 0 },
          rotationDeg: 0,
          originAlignmentMode: 'origin_to_origin',
          visibilityMode: 'host_view',
        },
      },
    });
    const apply = vi.fn().mockResolvedValue({ ok: true });
    const { getByTestId, rerender } = render(
      <ManageLinksDialog open={true} onClose={vi.fn()} applyCommandImpl={apply} />,
    );
    fireEvent.click(getByTestId('manage-links-pin-link-1'));
    await Promise.resolve();
    expect(apply).toHaveBeenCalledWith(
      'host-model',
      expect.objectContaining({ type: 'updateLinkModel', sourceModelRevision: 4 }),
    );

    // Now flip the local element to "pinned at 4" so the unpin button appears.
    useBimStore.setState({
      modelId: 'host-model',
      linkSourceRevisions: { [SOURCE_UUID]: 4 },
      elementsById: {
        'link-1': {
          kind: 'link_model',
          id: 'link-1',
          name: 'Structure',
          sourceModelId: SOURCE_UUID,
          sourceModelRevision: 4,
          positionMm: { xMm: 0, yMm: 0, zMm: 0 },
          rotationDeg: 0,
          originAlignmentMode: 'origin_to_origin',
          visibilityMode: 'host_view',
        },
      },
    });
    rerender(<ManageLinksDialog open={true} onClose={vi.fn()} applyCommandImpl={apply} />);
    fireEvent.click(getByTestId('manage-links-unpin-link-1'));
    await Promise.resolve();
    expect(apply).toHaveBeenLastCalledWith(
      'host-model',
      expect.objectContaining({ type: 'updateLinkModel', sourceModelRevision: null }),
    );
  });
});
