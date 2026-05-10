import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';

import { ManageLinksDialog } from './ManageLinksDialog';
import { useBimStore } from '../../state/store';

beforeEach(() => {
  useBimStore.setState({
    modelId: 'host-model',
    elementsById: {},
  });
});

afterEach(() => {
  cleanup();
});

describe('<ManageLinksDialog />', () => {
  it('renders nothing when closed', () => {
    const { queryByTestId } = render(<ManageLinksDialog open={false} onClose={vi.fn()} />);
    expect(queryByTestId('manage-links-dialog')).toBeNull();
  });

  it('shows the empty state when no link_model rows exist', () => {
    const { getByTestId } = render(<ManageLinksDialog open={true} onClose={vi.fn()} />);
    expect(getByTestId('manage-links-empty')).toBeTruthy();
  });

  it('lists existing link_model rows and offers a Delete button per row', () => {
    useBimStore.setState({
      modelId: 'host-model',
      elementsById: {
        'link-1': {
          kind: 'link_model',
          id: 'link-1',
          name: 'Structure',
          sourceModelId: '11111111-1111-1111-1111-111111111111',
          positionMm: { xMm: 0, yMm: 0, zMm: 0 },
          rotationDeg: 0,
          originAlignmentMode: 'origin_to_origin',
        },
      },
    });
    const { getByTestId } = render(<ManageLinksDialog open={true} onClose={vi.fn()} />);
    expect(getByTestId('manage-links-row-link-1')).toBeTruthy();
    expect(getByTestId('manage-links-delete-link-1')).toBeTruthy();
  });

  it('dispatches createLinkModel via the apply override when Add Link is clicked', async () => {
    const apply = vi.fn().mockResolvedValue({ ok: true });
    const { getByTestId } = render(
      <ManageLinksDialog open={true} onClose={vi.fn()} applyCommandImpl={apply} />,
    );
    fireEvent.change(getByTestId('manage-links-source-input'), {
      target: { value: '22222222-2222-2222-2222-222222222222' },
    });
    fireEvent.change(getByTestId('manage-links-pos-x'), { target: { value: '500' } });
    fireEvent.click(getByTestId('manage-links-add'));
    await waitFor(() => expect(apply).toHaveBeenCalledTimes(1));
    const [modelArg, cmdArg] = apply.mock.calls[0]!;
    expect(modelArg).toBe('host-model');
    expect(cmdArg).toMatchObject({
      type: 'createLinkModel',
      sourceModelId: '22222222-2222-2222-2222-222222222222',
      positionMm: { xMm: 500, yMm: 0, zMm: 0 },
      originAlignmentMode: 'origin_to_origin',
    });
  });

  it('rejects an empty source UUID with an inline error', async () => {
    const apply = vi.fn();
    const { getByTestId } = render(
      <ManageLinksDialog open={true} onClose={vi.fn()} applyCommandImpl={apply} />,
    );
    fireEvent.click(getByTestId('manage-links-add'));
    await waitFor(() => expect(getByTestId('manage-links-error')).toBeTruthy());
    expect(apply).not.toHaveBeenCalled();
  });

  it('dispatches deleteLinkModel via the apply override when Delete is clicked', async () => {
    useBimStore.setState({
      modelId: 'host-model',
      elementsById: {
        'link-2': {
          kind: 'link_model',
          id: 'link-2',
          name: 'L2',
          sourceModelId: '33333333-3333-3333-3333-333333333333',
          positionMm: { xMm: 0, yMm: 0, zMm: 0 },
          rotationDeg: 0,
          originAlignmentMode: 'origin_to_origin',
        },
      },
    });
    const apply = vi.fn().mockResolvedValue({ ok: true });
    const { getByTestId } = render(
      <ManageLinksDialog open={true} onClose={vi.fn()} applyCommandImpl={apply} />,
    );
    fireEvent.click(getByTestId('manage-links-delete-link-2'));
    await waitFor(() => expect(apply).toHaveBeenCalledTimes(1));
    expect(apply.mock.calls[0]![1]).toMatchObject({ type: 'deleteLinkModel', linkId: 'link-2' });
  });

  it('dispatches pinElement/unpinElement for linked model position locks', async () => {
    useBimStore.setState({
      modelId: 'host-model',
      elementsById: {
        'link-3': {
          kind: 'link_model',
          id: 'link-3',
          name: 'L3',
          sourceModelId: '44444444-4444-4444-4444-444444444444',
          positionMm: { xMm: 0, yMm: 0, zMm: 0 },
          rotationDeg: 0,
          originAlignmentMode: 'origin_to_origin',
        },
      },
    });
    const apply = vi.fn().mockResolvedValue({ ok: true });
    const { getByTestId, rerender } = render(
      <ManageLinksDialog open={true} onClose={vi.fn()} applyCommandImpl={apply} />,
    );
    fireEvent.click(getByTestId('manage-links-position-pin-link-3'));
    await waitFor(() =>
      expect(apply).toHaveBeenCalledWith('host-model', {
        type: 'pinElement',
        elementId: 'link-3',
      }),
    );

    useBimStore.setState({
      modelId: 'host-model',
      elementsById: {
        'link-3': {
          kind: 'link_model',
          id: 'link-3',
          name: 'L3',
          sourceModelId: '44444444-4444-4444-4444-444444444444',
          positionMm: { xMm: 0, yMm: 0, zMm: 0 },
          rotationDeg: 0,
          originAlignmentMode: 'origin_to_origin',
          pinned: true,
        },
      },
    });
    rerender(<ManageLinksDialog open={true} onClose={vi.fn()} applyCommandImpl={apply} />);
    fireEvent.click(getByTestId('manage-links-position-pin-link-3'));
    await waitFor(() =>
      expect(apply).toHaveBeenLastCalledWith('host-model', {
        type: 'unpinElement',
        elementId: 'link-3',
      }),
    );
  });

  it('dispatches pinElement for DXF underlay position locks', async () => {
    useBimStore.setState({
      modelId: 'host-model',
      elementsById: {
        'dxf-1': {
          kind: 'link_dxf',
          id: 'dxf-1',
          name: 'Site',
          levelId: 'lvl-1',
          originMm: { xMm: 0, yMm: 0 },
          rotationDeg: 0,
          scaleFactor: 1,
          linework: [],
        },
      },
    });
    const apply = vi.fn().mockResolvedValue({ ok: true });
    const { getByTestId } = render(
      <ManageLinksDialog open={true} onClose={vi.fn()} applyCommandImpl={apply} />,
    );
    fireEvent.click(getByTestId('manage-dxf-links-position-pin-dxf-1'));
    await waitFor(() =>
      expect(apply).toHaveBeenCalledWith('host-model', {
        type: 'pinElement',
        elementId: 'dxf-1',
      }),
    );
  });

  it('dispatches updateLinkDxf when the DXF alignment mode changes', async () => {
    useBimStore.setState({
      modelId: 'host-model',
      elementsById: {
        'dxf-2': {
          kind: 'link_dxf',
          id: 'dxf-2',
          name: 'Survey',
          levelId: 'lvl-1',
          originMm: { xMm: 0, yMm: 0 },
          originAlignmentMode: 'origin_to_origin',
          rotationDeg: 0,
          scaleFactor: 1,
          linework: [],
        },
      },
    });
    const apply = vi.fn().mockResolvedValue({ ok: true });
    const { getByTestId } = render(
      <ManageLinksDialog open={true} onClose={vi.fn()} applyCommandImpl={apply} />,
    );
    fireEvent.change(getByTestId('manage-dxf-links-align-dxf-2'), {
      target: { value: 'project_origin' },
    });
    await waitFor(() =>
      expect(apply).toHaveBeenCalledWith('host-model', {
        type: 'updateLinkDxf',
        linkId: 'dxf-2',
        originAlignmentMode: 'project_origin',
      }),
    );
  });

  it('lists DXF layers and toggles hiddenLayerNames per layer', async () => {
    useBimStore.setState({
      modelId: 'host-model',
      elementsById: {
        'dxf-3': {
          kind: 'link_dxf',
          id: 'dxf-3',
          name: 'Query layers',
          levelId: 'lvl-1',
          originMm: { xMm: 0, yMm: 0 },
          rotationDeg: 0,
          scaleFactor: 1,
          dxfLayers: [
            { name: 'A-WALL', color: 'red', primitiveCount: 2 },
            { name: 'A-DOOR', color: 'lime', primitiveCount: 1 },
          ],
          hiddenLayerNames: ['A-DOOR'],
          linework: [],
        },
      },
    });
    const apply = vi.fn().mockResolvedValue({ ok: true });
    const { getByTestId } = render(
      <ManageLinksDialog open={true} onClose={vi.fn()} applyCommandImpl={apply} />,
    );

    expect(getByTestId('manage-dxf-links-layers-dxf-3')).toBeTruthy();
    expect(
      (getByTestId('manage-dxf-links-layer-visible-dxf-3-A-DOOR') as HTMLInputElement).checked,
    ).toBe(false);
    fireEvent.click(getByTestId('manage-dxf-links-layer-visible-dxf-3-A-WALL'));
    await waitFor(() =>
      expect(apply).toHaveBeenCalledWith('host-model', {
        type: 'updateLinkDxf',
        linkId: 'dxf-3',
        hiddenLayerNames: ['A-DOOR', 'A-WALL'],
      }),
    );
  });
});
