import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import { useBimStore } from '../../state/store';
import { OptionsBar } from './OptionsBar';

afterEach(() => {
  cleanup();
  act(() => {
    useBimStore.setState({ planTool: 'select', elementsById: {} });
  });
});

describe('options bar — floor tool (§1.6.8)', () => {
  it('renders options-bar-floor-type select when planTool=floor', () => {
    act(() => {
      useBimStore.setState({ planTool: 'floor', elementsById: {} });
    });
    const { getByTestId } = render(<OptionsBar />);
    expect(getByTestId('options-bar-floor-type')).toBeTruthy();
  });

  it('renders options-bar-floor-level select', () => {
    act(() => {
      useBimStore.setState({
        planTool: 'floor',
        elementsById: {
          'lv-1': { kind: 'level', id: 'lv-1', name: 'L1', elevationMm: 0 },
        },
      });
    });
    const { getByTestId } = render(<OptionsBar />);
    expect(getByTestId('options-bar-floor-level')).toBeTruthy();
  });

  it('renders options-bar-floor-offset input', () => {
    act(() => {
      useBimStore.setState({ planTool: 'floor', elementsById: {} });
    });
    const { getByTestId } = render(<OptionsBar />);
    expect(getByTestId('options-bar-floor-offset')).toBeTruthy();
  });

  it('also shows floor controls for floor-sketch tool', () => {
    act(() => {
      useBimStore.setState({ planTool: 'floor-sketch', elementsById: {} });
    });
    const { getByTestId } = render(<OptionsBar />);
    expect(getByTestId('options-bar-floor-type')).toBeTruthy();
    expect(getByTestId('options-bar-floor-offset')).toBeTruthy();
  });
});
