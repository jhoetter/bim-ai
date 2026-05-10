import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';

import { VVDialog } from './VVDialog';
import { useBimStore } from '../../state/store';

const SOURCE_UUID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

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

describe('<VVDialog /> Revit Links tab', () => {
  it('renders the Revit Links tab control', () => {
    const { getByTestId } = render(<VVDialog open={true} onClose={vi.fn()} />);
    expect(getByTestId('vv-tab-links')).toBeTruthy();
  });

  it('shows empty state when host has no link_model rows', () => {
    const { getByTestId } = render(<VVDialog open={true} onClose={vi.fn()} />);
    fireEvent.click(getByTestId('vv-tab-links'));
    expect(getByTestId('vv-links-empty')).toBeTruthy();
  });

  it('lists every link_model with a per-link visibility checkbox', () => {
    useBimStore.setState({
      modelId: 'host-model',
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
    const { getByTestId } = render(<VVDialog open={true} onClose={vi.fn()} />);
    fireEvent.click(getByTestId('vv-tab-links'));
    const row = getByTestId('vv-links-row-link-1');
    expect(row).toBeTruthy();
    const cb = getByTestId('vv-links-visible-link-1') as HTMLInputElement;
    expect(cb.checked).toBe(true);
  });

  it('toggling the per-link checkbox issues an updateLinkModel command flipping hidden', async () => {
    useBimStore.setState({
      modelId: 'host-model',
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
    const { getByTestId } = render(
      <VVDialog open={true} onClose={vi.fn()} applyCommandImpl={apply} />,
    );
    fireEvent.click(getByTestId('vv-tab-links'));
    fireEvent.click(getByTestId('vv-links-visible-link-1'));
    await Promise.resolve();
    expect(apply).toHaveBeenCalledWith(
      'host-model',
      expect.objectContaining({ type: 'updateLinkModel', linkId: 'link-1', hidden: true }),
    );
  });

  it('stores per-view imported-CAD visibility and transparency overrides', () => {
    useBimStore.setState({
      modelId: 'host-model',
      activePlanViewId: 'view-1',
      elementsById: {
        'view-1': {
          kind: 'plan_view',
          id: 'view-1',
          name: 'Level 1',
          levelId: 'lvl-1',
          categoryOverrides: {},
        },
        'dxf-1': {
          kind: 'link_dxf',
          id: 'dxf-1',
          name: 'Survey',
          levelId: 'lvl-1',
          originMm: { xMm: 0, yMm: 0 },
          linework: [],
          overlayOpacity: 0.5,
        },
      },
    });
    const { getByTestId } = render(<VVDialog open={true} onClose={vi.fn()} />);
    fireEvent.click(getByTestId('vv-tab-links'));

    fireEvent.click(getByTestId('vv-links-visible-dxf-1'));
    let view = useBimStore.getState().elementsById['view-1'];
    expect(view?.kind === 'plan_view' ? view.categoryOverrides?.['link_dxf:dxf-1'] : null).toEqual({
      visible: false,
    });

    fireEvent.change(getByTestId('vv-links-transparency-dxf-1'), { target: { value: '70' } });
    view = useBimStore.getState().elementsById['view-1'];
    expect(view?.kind === 'plan_view' ? view.categoryOverrides?.['link_dxf:dxf-1'] : null).toEqual({
      visible: false,
      projection: { transparency: 70 },
    });
  });
});
