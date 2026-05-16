import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { StatusBar } from './shell/StatusBar';
import i18n from '../i18n';

function renderWithI18n(ui: React.ReactElement) {
  return render(<I18nextProvider i18n={i18n}>{ui}</I18nextProvider>);
}

const baseLevel = { id: 'lvl-ground', label: 'Ground' };

afterEach(() => {
  cleanup();
});

describe('StatusBar — §1.6.9', () => {
  it('renders status-bar element', () => {
    const { getByTestId } = renderWithI18n(<StatusBar level={baseLevel} />);
    expect(getByTestId('status-bar')).toBeTruthy();
  });

  it('shows click-to-select hint when no tool active', () => {
    const { getByTestId } = renderWithI18n(<StatusBar level={baseLevel} planTool={null} />);
    expect(getByTestId('status-bar-hint').textContent).toContain('Click to select');
  });

  it('shows wall idle hint when planTool=wall phase=idle', () => {
    const { getByTestId } = renderWithI18n(
      <StatusBar level={baseLevel} planTool="wall" toolPhase="idle" />,
    );
    expect(getByTestId('status-bar-hint').textContent).toContain('Click to start wall');
  });

  it('shows wall drawing hint when planTool=wall phase=drawing', () => {
    const { getByTestId } = renderWithI18n(
      <StatusBar level={baseLevel} planTool="wall" toolPhase="drawing" />,
    );
    expect(getByTestId('status-bar-hint').textContent).toContain('Click next point');
  });

  it('shows "1 element selected" when selectedCount=1', () => {
    const { getByTestId } = renderWithI18n(<StatusBar level={baseLevel} selectionCount={1} />);
    expect(getByTestId('status-bar-selection').textContent).toContain('1 element selected');
  });

  it('shows "3 elements selected" when selectedCount=3', () => {
    const { getByTestId } = renderWithI18n(<StatusBar level={baseLevel} selectionCount={3} />);
    expect(getByTestId('status-bar-selection').textContent).toContain('3 elements selected');
  });

  it('does not render status-bar-selection when selectedCount is 0', () => {
    const { queryByTestId } = renderWithI18n(<StatusBar level={baseLevel} selectionCount={0} />);
    expect(queryByTestId('status-bar-selection')).toBeNull();
  });

  it('shows hovered element kind hint in select mode', () => {
    const { getByTestId } = renderWithI18n(
      <StatusBar level={baseLevel} planTool={null} hoveredElementKind="wall" />,
    );
    expect(getByTestId('status-bar-hint').textContent).toContain('wall');
    expect(getByTestId('status-bar-hint').textContent).toContain('click to select');
  });
});
