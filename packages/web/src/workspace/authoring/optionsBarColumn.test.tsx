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
      columnDrawHeightMm: 3000,
      columnDrawWidthMm: 300,
      columnDrawDepthMm: 300,
    });
  });
});

describe('options bar — column tool (§1.6.8)', () => {
  it('renders options-bar-column-height when planTool=column', () => {
    act(() => {
      useBimStore.setState({ planTool: 'column', elementsById: {} });
    });
    const { getByTestId } = render(<OptionsBar />);
    expect(getByTestId('options-bar-column-height')).toBeTruthy();
  });

  it('renders options-bar-column-width', () => {
    act(() => {
      useBimStore.setState({ planTool: 'column', elementsById: {} });
    });
    const { getByTestId } = render(<OptionsBar />);
    expect(getByTestId('options-bar-column-width')).toBeTruthy();
  });

  it('renders options-bar-column-depth', () => {
    act(() => {
      useBimStore.setState({ planTool: 'column', elementsById: {} });
    });
    const { getByTestId } = render(<OptionsBar />);
    expect(getByTestId('options-bar-column-depth')).toBeTruthy();
  });

  it('renders options-bar-column-level select', () => {
    act(() => {
      useBimStore.setState({
        planTool: 'column',
        elementsById: {
          'lv-1': { kind: 'level', id: 'lv-1', name: 'Ground', elevationMm: 0 },
        },
      });
    });
    const { getByTestId } = render(<OptionsBar />);
    expect(getByTestId('options-bar-column-level')).toBeTruthy();
  });

  it('updates columnDrawHeightMm in store when height input changes', () => {
    act(() => {
      useBimStore.setState({ planTool: 'column', elementsById: {}, columnDrawHeightMm: 3000 });
    });
    const { getByRole } = render(<OptionsBar />);
    const input = getByRole('spinbutton', { name: /column height/i });
    fireEvent.change(input, { target: { value: '4000' } });
    expect(useBimStore.getState().columnDrawHeightMm).toBe(4000);
  });

  it('updates columnDrawWidthMm in store when width input changes', () => {
    act(() => {
      useBimStore.setState({ planTool: 'column', elementsById: {}, columnDrawWidthMm: 300 });
    });
    const { getByRole } = render(<OptionsBar />);
    const input = getByRole('spinbutton', { name: /column width/i });
    fireEvent.change(input, { target: { value: '400' } });
    expect(useBimStore.getState().columnDrawWidthMm).toBe(400);
  });

  it('updates columnDrawDepthMm in store when depth input changes', () => {
    act(() => {
      useBimStore.setState({ planTool: 'column', elementsById: {}, columnDrawDepthMm: 300 });
    });
    const { getByRole } = render(<OptionsBar />);
    const input = getByRole('spinbutton', { name: /column depth/i });
    fireEvent.change(input, { target: { value: '500' } });
    expect(useBimStore.getState().columnDrawDepthMm).toBe(500);
  });
});
