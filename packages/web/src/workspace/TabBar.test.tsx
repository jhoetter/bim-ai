import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { TabBar } from './TabBar';
import type { ViewTab } from './tabsModel';

afterEach(() => {
  cleanup();
});

const tabs: ViewTab[] = [
  { id: 'plan:l0', kind: 'plan', targetId: 'l0', label: 'Plan · Level 0' },
  { id: '3d:vp1', kind: '3d', targetId: 'vp1', label: '3D · Default' },
  { id: 'sheet:a101', kind: 'sheet', targetId: 'a101', label: 'Sheet · A-101' },
];

describe('TabBar — spec §11.3', () => {
  it('renders one tab per descriptor with active state', () => {
    const { getByTestId } = render(
      <TabBar tabs={tabs} activeId="3d:vp1" onActivate={() => {}} onClose={() => {}} />,
    );
    expect(getByTestId('view-tabs')).toBeTruthy();
    expect(getByTestId('tab-activate-plan:l0')).toBeTruthy();
    expect(getByTestId('tab-activate-3d:vp1')).toBeTruthy();
    expect(getByTestId('tab-activate-sheet:a101')).toBeTruthy();
    const activeTab = getByTestId('tab-activate-3d:vp1').closest('[role="tab"]');
    expect(activeTab?.getAttribute('aria-selected')).toBe('true');
  });

  it('clicking a tab fires onActivate with the id', () => {
    const onActivate = vi.fn();
    const { getByTestId } = render(
      <TabBar tabs={tabs} activeId="plan:l0" onActivate={onActivate} onClose={() => {}} />,
    );
    fireEvent.click(getByTestId('tab-activate-3d:vp1'));
    expect(onActivate).toHaveBeenCalledWith('3d:vp1');
  });

  it('clicking ✕ fires onClose with the id', () => {
    const onClose = vi.fn();
    const { getByTestId } = render(
      <TabBar tabs={tabs} activeId="plan:l0" onActivate={() => {}} onClose={onClose} />,
    );
    fireEvent.click(getByTestId('tab-close-sheet:a101'));
    expect(onClose).toHaveBeenCalledWith('sheet:a101');
  });

  it('shows "no views open" copy when tabs is empty', () => {
    const { getByText } = render(
      <TabBar tabs={[]} activeId={null} onActivate={() => {}} onClose={() => {}} />,
    );
    expect(getByText('No views open')).toBeTruthy();
  });

  it('+ button opens add-view popover', () => {
    const onAdd = vi.fn();
    const { getByTestId } = render(
      <TabBar
        tabs={tabs}
        activeId="plan:l0"
        onActivate={() => {}}
        onClose={() => {}}
        onAdd={onAdd}
      />,
    );
    fireEvent.click(getByTestId('tab-add-button'));
    expect(getByTestId('tab-add-popover')).toBeTruthy();
    fireEvent.click(getByTestId('tab-add-section'));
    expect(onAdd).toHaveBeenCalledWith('section');
  });
});
