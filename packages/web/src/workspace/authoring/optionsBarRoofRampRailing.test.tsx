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

describe('OptionsBar roof/ramp/railing options — §1.6.6', () => {
  it('renders roof base offset and slope inputs when roof tool active', () => {
    act(() => {
      useBimStore.setState({ planTool: 'roof', elementsById: {} });
    });
    const { getByTestId } = render(<OptionsBar />);
    expect(getByTestId('options-roof-base-offset')).toBeTruthy();
    expect(getByTestId('options-roof-slope')).toBeTruthy();
  });

  it('renders roof options when roof-sketch tool active', () => {
    act(() => {
      useBimStore.setState({ planTool: 'roof-sketch', elementsById: {} });
    });
    const { getByTestId } = render(<OptionsBar />);
    expect(getByTestId('options-roof-base-offset')).toBeTruthy();
    expect(getByTestId('options-roof-slope')).toBeTruthy();
  });

  it('renders roof options when roof-by-extrusion tool active', () => {
    act(() => {
      useBimStore.setState({ planTool: 'roof-by-extrusion', elementsById: {} });
    });
    const { getByTestId } = render(<OptionsBar />);
    expect(getByTestId('options-roof-base-offset')).toBeTruthy();
    expect(getByTestId('options-roof-slope')).toBeTruthy();
  });

  it('renders ramp width and slope inputs when ramp tool active', () => {
    act(() => {
      useBimStore.setState({ planTool: 'ramp', elementsById: {} });
    });
    const { getByTestId } = render(<OptionsBar />);
    expect(getByTestId('options-ramp-width')).toBeTruthy();
    expect(getByTestId('options-ramp-slope')).toBeTruthy();
  });

  it('renders railing height and follow-slope checkbox when railing tool active', () => {
    act(() => {
      useBimStore.setState({ planTool: 'railing', elementsById: {} });
    });
    const { getByTestId } = render(<OptionsBar />);
    expect(getByTestId('options-railing-height')).toBeTruthy();
    expect(getByTestId('options-railing-follow-slope')).toBeTruthy();
  });

  it('does not render roof options when wall tool active', () => {
    act(() => {
      useBimStore.setState({ planTool: 'wall', elementsById: {} });
    });
    const { queryByTestId } = render(<OptionsBar />);
    expect(queryByTestId('options-roof-base-offset')).toBeNull();
    expect(queryByTestId('options-roof-slope')).toBeNull();
  });

  it('does not render ramp options when wall tool active', () => {
    act(() => {
      useBimStore.setState({ planTool: 'wall', elementsById: {} });
    });
    const { queryByTestId } = render(<OptionsBar />);
    expect(queryByTestId('options-ramp-width')).toBeNull();
    expect(queryByTestId('options-ramp-slope')).toBeNull();
  });

  it('does not render railing options when wall tool active', () => {
    act(() => {
      useBimStore.setState({ planTool: 'wall', elementsById: {} });
    });
    const { queryByTestId } = render(<OptionsBar />);
    expect(queryByTestId('options-railing-height')).toBeNull();
    expect(queryByTestId('options-railing-follow-slope')).toBeNull();
  });
});
