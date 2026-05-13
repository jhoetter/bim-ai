import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { TabBar } from './TabBar';
import type { ViewTab } from '../tabsModel';
import i18n from '../../i18n';

function renderWithI18n(ui: React.ReactElement) {
  return render(ui, {
    wrapper: ({ children }) => <I18nextProvider i18n={i18n}>{children}</I18nextProvider>,
  });
}

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
    const { getByTestId } = renderWithI18n(
      <TabBar tabs={tabs} activeId="3d:vp1" onActivate={() => {}} onClose={() => {}} />,
    );
    expect(getByTestId('view-tabs')).toBeTruthy();
    expect(getByTestId('tab-activate-plan:l0')).toBeTruthy();
    expect(getByTestId('tab-activate-3d:vp1')).toBeTruthy();
    expect(getByTestId('tab-activate-sheet:a101')).toBeTruthy();
    const activeTab = getByTestId('tab-activate-3d:vp1').closest('[role="tab"]');
    expect(activeTab?.getAttribute('aria-selected')).toBe('true');
  });

  it('shows clear active/focused/shown state badges', () => {
    const { getByTestId } = renderWithI18n(
      <TabBar
        tabs={tabs}
        activeId="3d:vp1"
        focusedPaneTabId="plan:l0"
        tabPaneAssignments={{ 'plan:l0': ['pane-a'], '3d:vp1': ['pane-b', 'pane-c'] }}
        onActivate={() => {}}
        onClose={() => {}}
      />,
    );
    expect(getByTestId('tab-badge-active-3d:vp1').textContent).toContain('Active');
    expect(getByTestId('tab-badge-shown-3d:vp1').textContent).toContain('2 panes');
    expect(getByTestId('tab-badge-focused-plan:l0').textContent).toContain('Focused pane');
    expect(getByTestId('tab-badge-shown-plan:l0').textContent).toContain('Shown');
  });

  it('clicking a tab fires onActivate with the id', () => {
    const onActivate = vi.fn();
    const { getByTestId } = renderWithI18n(
      <TabBar tabs={tabs} activeId="plan:l0" onActivate={onActivate} onClose={() => {}} />,
    );
    fireEvent.click(getByTestId('tab-activate-3d:vp1'));
    expect(onActivate).toHaveBeenCalledWith('3d:vp1');
  });

  it('activates from the full tab surface and keyboard', () => {
    const onActivate = vi.fn();
    const { getByTestId } = renderWithI18n(
      <TabBar tabs={tabs} activeId="plan:l0" onActivate={onActivate} onClose={() => {}} />,
    );
    const tab = getByTestId('tab-activate-3d:vp1').closest('[role="tab"]') as HTMLElement;
    fireEvent.click(tab);
    fireEvent.keyDown(tab, { key: 'Enter' });
    fireEvent.keyDown(tab, { key: ' ' });
    expect(onActivate).toHaveBeenCalledTimes(3);
    expect(onActivate).toHaveBeenLastCalledWith('3d:vp1');
  });

  it('clicking ✕ fires onClose with the id', () => {
    const onClose = vi.fn();
    const { getByTestId } = renderWithI18n(
      <TabBar tabs={tabs} activeId="plan:l0" onActivate={() => {}} onClose={onClose} />,
    );
    fireEvent.click(getByTestId('tab-close-sheet:a101'));
    expect(onClose).toHaveBeenCalledWith('sheet:a101');
  });

  it('shows "no views open" copy when tabs is empty', () => {
    const { getByText } = renderWithI18n(
      <TabBar tabs={[]} activeId={null} onActivate={() => {}} onClose={() => {}} />,
    );
    expect(getByText('No views open')).toBeTruthy();
  });

  it('drag from one tab to another fires onReorder with the indices (T-05)', () => {
    const onReorder = vi.fn();
    const { getByTestId } = renderWithI18n(
      <TabBar
        tabs={tabs}
        activeId="plan:l0"
        onActivate={() => {}}
        onClose={() => {}}
        onReorder={onReorder}
      />,
    );
    const src = getByTestId('tab-activate-plan:l0').closest('[role="tab"]') as HTMLElement;
    const dst = getByTestId('tab-activate-sheet:a101').closest('[role="tab"]') as HTMLElement;
    expect(src.getAttribute('draggable')).toBe('true');
    const dt = {
      effectAllowed: 'all',
      dropEffect: 'none',
      setData: () => {},
      getData: () => '0',
    };
    fireEvent.dragStart(src, { dataTransfer: dt });
    fireEvent.dragOver(dst, { dataTransfer: dt });
    fireEvent.drop(dst, { dataTransfer: dt });
    expect(onReorder).toHaveBeenCalledWith(0, 2);
  });

  it('emits tab drag lifecycle callbacks for canvas split dropzones', () => {
    const onTabDragStart = vi.fn();
    const onTabDragEnd = vi.fn();
    const { getByTestId } = renderWithI18n(
      <TabBar
        tabs={tabs}
        activeId="plan:l0"
        onActivate={() => {}}
        onClose={() => {}}
        onTabDragStart={onTabDragStart}
        onTabDragEnd={onTabDragEnd}
      />,
    );
    const src = getByTestId('tab-activate-plan:l0').closest('[role="tab"]') as HTMLElement;
    const dt = {
      effectAllowed: 'all',
      dropEffect: 'none',
      setData: () => {},
      getData: () => '',
    };
    fireEvent.dragStart(src, { dataTransfer: dt });
    fireEvent.dragEnd(src);
    expect(onTabDragStart).toHaveBeenCalledWith('plan:l0');
    expect(onTabDragEnd).toHaveBeenCalledOnce();
  });

  it('+ button opens add-view popover', () => {
    const onAdd = vi.fn();
    const { getByTestId } = renderWithI18n(
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

  it('keeps close-inactive views in tab overflow, not as persistent header chrome', () => {
    const onCloseInactive = vi.fn();
    const { getByTestId, queryByTestId } = renderWithI18n(
      <TabBar
        tabs={tabs}
        activeId="plan:l0"
        onActivate={() => {}}
        onClose={() => {}}
        onCloseInactive={onCloseInactive}
      />,
    );

    expect(queryByTestId('close-inactive-tabs')).toBeNull();
    fireEvent.click(getByTestId('tab-overflow-button'));
    expect(getByTestId('tab-overflow-menu')).toBeTruthy();
    fireEvent.click(getByTestId('close-inactive-tabs'));

    expect(onCloseInactive).toHaveBeenCalledTimes(1);
    expect(queryByTestId('tab-overflow-menu')).toBeNull();
  });
});
