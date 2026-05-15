import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { useBimStore } from '../../state/store';
import {
  OptionsBar,
  setActiveComponentAssetId,
  setActiveComponentFamilyTypeId,
} from './OptionsBar';

afterEach(() => {
  cleanup();
  setActiveComponentAssetId(null);
  setActiveComponentFamilyTypeId(null);
  act(() => {
    useBimStore.setState({
      planTool: 'select',
      elementsById: {},
      wallLocationLine: 'wall-centerline',
      wallDrawOffsetMm: 0,
      wallDrawRadiusMm: null,
      floorBoundaryOffsetMm: 0,
    });
  });
});

describe('OptionsBar', () => {
  it('renders nothing when activeTool is select', () => {
    useBimStore.setState({ planTool: 'select' });
    const { container } = render(<OptionsBar />);
    expect(container.firstChild).toBeNull();
  });

  it('renders Wall Centerline control when activeTool is wall', () => {
    act(() => {
      useBimStore.setState({ planTool: 'wall', wallLocationLine: 'wall-centerline' });
    });
    const { getByText } = render(<OptionsBar />);
    expect(getByText('Wall Centerline')).toBeTruthy();
  });

  it('keeps discipline workspace switching out of tool options rows — UX-R-011', () => {
    act(() => {
      useBimStore.setState({ planTool: 'wall' });
    });
    const { queryByTestId, queryByRole } = render(<OptionsBar />);
    expect(queryByTestId('options-bar-discipline-scope')).toBeNull();
    expect(queryByRole('combobox', { name: /discipline workspace/i })).toBeNull();
  });

  it('clicking Finish Face: Exterior calls setWallLocationLine', () => {
    act(() => {
      useBimStore.setState({ planTool: 'wall', wallLocationLine: 'wall-centerline' });
    });
    const { getByRole } = render(<OptionsBar />);
    const select = getByRole('combobox', { name: /wall location line/i });
    fireEvent.change(select, { target: { value: 'finish-face-exterior' } });
    expect(useBimStore.getState().wallLocationLine).toBe('finish-face-exterior');
  });

  it('updates the wall baseline offset from the wall options bar', () => {
    act(() => {
      useBimStore.setState({ planTool: 'wall', wallDrawOffsetMm: 0 });
    });
    const { getByRole } = render(<OptionsBar />);
    const input = getByRole('spinbutton', { name: /wall baseline offset/i });
    fireEvent.change(input, { target: { value: '150' } });
    expect(useBimStore.getState().wallDrawOffsetMm).toBe(150);
  });

  it('enables and updates the wall corner radius from the wall options bar', () => {
    act(() => {
      useBimStore.setState({ planTool: 'wall', wallDrawRadiusMm: null });
    });
    const { getByRole } = render(<OptionsBar />);
    fireEvent.click(getByRole('checkbox', { name: /enable wall corner radius/i }));
    expect(useBimStore.getState().wallDrawRadiusMm).toBe(500);
    fireEvent.change(getByRole('spinbutton', { name: /wall corner radius/i }), {
      target: { value: '900' },
    });
    expect(useBimStore.getState().wallDrawRadiusMm).toBe(900);
  });

  it('renders Boundary Offset control when activeTool is floor', () => {
    act(() => {
      useBimStore.setState({ planTool: 'floor' });
    });
    const { getByText } = render(<OptionsBar />);
    expect(getByText('Boundary Offset:')).toBeTruthy();
  });

  it('keeps floor type and boundary offset options visible in canonical floor sketch mode', () => {
    act(() => {
      useBimStore.setState({ planTool: 'floor-sketch' });
    });
    const { getByText, getByTestId } = render(<OptionsBar />);
    expect(getByText('Boundary Offset:')).toBeTruthy();
    expect(getByTestId('options-bar-floor-type')).toBeTruthy();
  });

  it('lists generic family_type rows in the component Type selector', () => {
    act(() => {
      useBimStore.setState({
        planTool: 'component',
        elementsById: {
          'ft-chair-600': {
            kind: 'family_type',
            id: 'ft-chair-600',
            name: '600 x 600 Chair',
            familyId: 'fam:furniture:chair',
            discipline: 'generic',
            parameters: { name: '600 x 600 Chair' },
          },
          'ft-door': {
            kind: 'family_type',
            id: 'ft-door',
            name: 'Door',
            familyId: 'fam:door',
            discipline: 'door',
            parameters: { name: 'Door' },
          },
        },
      });
    });

    const { getByRole, queryByText } = render(<OptionsBar />);

    expect(getByRole('combobox', { name: /component family type/i })).toBeTruthy();
    expect(queryByText('600 x 600 Chair')).toBeTruthy();
    expect(queryByText('Door')).toBeNull();
  });
});
