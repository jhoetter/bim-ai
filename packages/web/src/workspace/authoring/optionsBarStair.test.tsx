import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { useBimStore } from '../../state/store';
import { OptionsBar } from './OptionsBar';

afterEach(() => {
  cleanup();
  act(() => {
    useBimStore.setState({
      planTool: 'select',
      elementsById: {},
      stairDrawBaseLevelId: null,
      stairDrawTopLevelId: null,
      stairDrawWidthMm: 1200,
      stairDrawRunWidthMm: 250,
    });
  });
});

describe('options bar — stair tool (§1.6.8)', () => {
  it('renders options-bar-stair-base-level when planTool=stair', () => {
    act(() => {
      useBimStore.setState({
        planTool: 'stair',
        elementsById: {
          'lv-1': { kind: 'level', id: 'lv-1', name: 'Ground', elevationMm: 0 },
          'lv-2': { kind: 'level', id: 'lv-2', name: 'Level 1', elevationMm: 3000 },
        },
      });
    });
    const { getByTestId } = render(<OptionsBar />);
    expect(getByTestId('options-bar-stair-base-level')).toBeTruthy();
  });

  it('renders options-bar-stair-top-level', () => {
    act(() => {
      useBimStore.setState({
        planTool: 'stair',
        elementsById: {
          'lv-1': { kind: 'level', id: 'lv-1', name: 'Ground', elevationMm: 0 },
          'lv-2': { kind: 'level', id: 'lv-2', name: 'Level 1', elevationMm: 3000 },
        },
      });
    });
    const { getByTestId } = render(<OptionsBar />);
    expect(getByTestId('options-bar-stair-top-level')).toBeTruthy();
  });

  it('renders options-bar-stair-width', () => {
    act(() => {
      useBimStore.setState({ planTool: 'stair', elementsById: {} });
    });
    const { getByTestId } = render(<OptionsBar />);
    expect(getByTestId('options-bar-stair-width')).toBeTruthy();
  });

  it('renders options-bar-stair-run-width', () => {
    act(() => {
      useBimStore.setState({ planTool: 'stair', elementsById: {} });
    });
    const { getByTestId } = render(<OptionsBar />);
    expect(getByTestId('options-bar-stair-run-width')).toBeTruthy();
  });

  it('updates stairDrawWidthMm in store when width input changes', () => {
    act(() => {
      useBimStore.setState({ planTool: 'stair', elementsById: {}, stairDrawWidthMm: 1200 });
    });
    const { getByRole } = render(<OptionsBar />);
    const input = getByRole('spinbutton', { name: /stair width/i });
    fireEvent.change(input, { target: { value: '1500' } });
    expect(useBimStore.getState().stairDrawWidthMm).toBe(1500);
  });

  it('updates stairDrawRunWidthMm in store when run width input changes', () => {
    act(() => {
      useBimStore.setState({ planTool: 'stair', elementsById: {}, stairDrawRunWidthMm: 250 });
    });
    const { getByRole } = render(<OptionsBar />);
    const input = getByRole('spinbutton', { name: /stair run width/i });
    fireEvent.change(input, { target: { value: '280' } });
    expect(useBimStore.getState().stairDrawRunWidthMm).toBe(280);
  });
});
