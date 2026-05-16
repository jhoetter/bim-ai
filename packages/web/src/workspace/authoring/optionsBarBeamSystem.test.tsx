import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { useBimStore } from '../../state/store';
import { OptionsBar } from './OptionsBar';

afterEach(() => {
  cleanup();
  act(() => {
    useBimStore.setState({ planTool: 'select' });
  });
});

describe('options bar — beam system tool (§9.3)', () => {
  it('renders options-bar-beam-spacing when planTool=beam-system', () => {
    act(() => {
      useBimStore.setState({ planTool: 'beam-system', beamSystemSpacingMm: 1500 });
    });
    const { getByTestId } = render(<OptionsBar />);
    const input = getByTestId('options-bar-beam-spacing') as HTMLInputElement;
    expect(input).toBeTruthy();
    expect(input.value).toBe('1500');
  });

  it('renders options-bar-beam-direction input', () => {
    act(() => {
      useBimStore.setState({ planTool: 'beam-system', beamSystemDirectionDeg: 0 });
    });
    const { getByTestId } = render(<OptionsBar />);
    const input = getByTestId('options-bar-beam-direction') as HTMLInputElement;
    expect(input).toBeTruthy();
    expect(input.value).toBe('0');
  });

  it('renders options-bar-beam-justification select', () => {
    act(() => {
      useBimStore.setState({ planTool: 'beam-system' });
    });
    const { getByTestId } = render(<OptionsBar />);
    const select = getByTestId('options-bar-beam-justification') as HTMLSelectElement;
    expect(select).toBeTruthy();
    const values = Array.from(select.options).map((o) => o.value);
    expect(values).toContain('beginning');
    expect(values).toContain('center');
    expect(values).toContain('end');
  });

  it('spacing input updates store on change', () => {
    act(() => {
      useBimStore.setState({ planTool: 'beam-system', beamSystemSpacingMm: 1500 });
    });
    const { getByTestId } = render(<OptionsBar />);
    const input = getByTestId('options-bar-beam-spacing') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '2000' } });
    expect(useBimStore.getState().beamSystemSpacingMm).toBe(2000);
  });

  it('direction input updates store on change', () => {
    act(() => {
      useBimStore.setState({ planTool: 'beam-system', beamSystemDirectionDeg: 0 });
    });
    const { getByTestId } = render(<OptionsBar />);
    const input = getByTestId('options-bar-beam-direction') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '45' } });
    expect(useBimStore.getState().beamSystemDirectionDeg).toBe(45);
  });

  it('renders nothing when planTool is not beam-system', () => {
    act(() => {
      useBimStore.setState({ planTool: 'select' });
    });
    const { container } = render(<OptionsBar />);
    expect(container.firstChild).toBeNull();
  });
});
