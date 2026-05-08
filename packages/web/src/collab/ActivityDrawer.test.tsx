import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, act } from '@testing-library/react';
import { ActivityDrawer } from './ActivityDrawer';
import { useActivityStore } from './activityStore';
import { useActivityDrawerStore } from './activityDrawerStore';
import type { ActivityRow } from '@bim-ai/core';

const ROW_A: ActivityRow = {
  id: 'row-aaa',
  modelId: 'model-1',
  authorId: 'alice',
  kind: 'commit',
  payload: { commandCount: 3 },
  ts: Date.now() - 60_000,
  parentSnapshotId: 'snap-parent-aaa',
};

const ROW_B: ActivityRow = {
  id: 'row-bbb',
  modelId: 'model-1',
  authorId: 'bob',
  kind: 'comment_created',
  payload: {},
  ts: Date.now() - 120_000,
};

beforeEach(() => {
  useActivityStore.setState({ rows: [ROW_A, ROW_B], loading: false, modelId: 'model-1' });
  useActivityStore.getState().fetchMore = vi.fn().mockResolvedValue(undefined);
  useActivityStore.getState().restore = vi.fn().mockResolvedValue({ ...ROW_A, id: 'restored' });
});

afterEach(() => {
  cleanup();
  useActivityDrawerStore.setState({ isOpen: false, lastSeenAt: 0 });
});

describe('ActivityDrawer', () => {
  it('renders as closed by default — drawer is translated off-screen', () => {
    const { getByTestId } = render(
      <ActivityDrawer isOpen={false} onClose={() => {}} modelId="model-1" />,
    );
    const drawer = getByTestId('activity-drawer');
    expect(drawer.style.transform).toBe('translateX(100%)');
  });

  it('renders as open when isOpen=true', () => {
    const { getByTestId } = render(<ActivityDrawer isOpen onClose={() => {}} modelId="model-1" />);
    const drawer = getByTestId('activity-drawer');
    expect(drawer.style.transform).toBe('translateX(0)');
  });

  it('shows latest activity rows when open', () => {
    const { getAllByTestId } = render(
      <ActivityDrawer isOpen onClose={() => {}} modelId="model-1" />,
    );
    expect(getAllByTestId('activity-drawer-row').length).toBe(2);
  });

  it('Esc closes the drawer', () => {
    const onClose = vi.fn();
    render(<ActivityDrawer isOpen onClose={onClose} modelId="model-1" />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('clicking outside (close button) closes the drawer', () => {
    const onClose = vi.fn();
    const { getByLabelText } = render(
      <ActivityDrawer isOpen onClose={onClose} modelId="model-1" />,
    );
    fireEvent.click(getByLabelText('Close activity drawer'));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('clicking a row shows the time-travel banner', () => {
    const { getAllByTestId, getByTestId } = render(
      <ActivityDrawer isOpen onClose={() => {}} modelId="model-1" />,
    );
    fireEvent.click(getAllByTestId('activity-drawer-row')[0]);
    expect(getByTestId('activity-drawer-travel-banner')).toBeTruthy();
    expect(getByTestId('activity-drawer-restore-chip')).toBeTruthy();
  });

  it('clicking [Restore] chip calls restore()', async () => {
    const { getAllByTestId, getByTestId } = render(
      <ActivityDrawer isOpen onClose={() => {}} modelId="model-1" />,
    );
    fireEvent.click(getAllByTestId('activity-drawer-row')[0]);
    await act(async () => {
      fireEvent.click(getByTestId('activity-drawer-restore-chip'));
    });
    expect(useActivityStore.getState().restore).toHaveBeenCalledWith('model-1', 'row-aaa');
  });

  it('filter chip "Mine" filters to authorId === selfId', () => {
    const { getByTestId, getAllByTestId } = render(
      <ActivityDrawer isOpen onClose={() => {}} modelId="model-1" selfId="alice" />,
    );
    fireEvent.click(getByTestId('activity-filter-mine'));
    const visibleRows = getAllByTestId('activity-drawer-row');
    expect(visibleRows.length).toBe(1);
  });

  it('filter chip "Comments" shows only comment rows', () => {
    const { getByTestId, getAllByTestId } = render(
      <ActivityDrawer isOpen onClose={() => {}} modelId="model-1" />,
    );
    fireEvent.click(getByTestId('activity-filter-comments'));
    const visibleRows = getAllByTestId('activity-drawer-row');
    expect(visibleRows.length).toBe(1);
  });

  it('filter chip "Commits" shows only commit rows', () => {
    const { getByTestId, getAllByTestId } = render(
      <ActivityDrawer isOpen onClose={() => {}} modelId="model-1" />,
    );
    fireEvent.click(getByTestId('activity-filter-commits'));
    const visibleRows = getAllByTestId('activity-drawer-row');
    expect(visibleRows.length).toBe(1);
  });
});

describe('activityDrawerStore', () => {
  it('toggle opens when closed', () => {
    useActivityDrawerStore.setState({ isOpen: false, lastSeenAt: 0 });
    useActivityDrawerStore.getState().toggle();
    expect(useActivityDrawerStore.getState().isOpen).toBe(true);
    expect(useActivityDrawerStore.getState().lastSeenAt).toBeGreaterThan(0);
  });

  it('toggle closes when open', () => {
    useActivityDrawerStore.setState({ isOpen: true, lastSeenAt: 1000 });
    useActivityDrawerStore.getState().toggle();
    expect(useActivityDrawerStore.getState().isOpen).toBe(false);
  });

  it('unread count: rows newer than lastSeenAt are counted as unread', () => {
    const lastSeenAt = Date.now() - 90_000;
    useActivityDrawerStore.setState({ isOpen: false, lastSeenAt });
    useActivityStore.setState({ rows: [ROW_A, ROW_B], loading: false, modelId: 'model-1' });
    const { lastSeenAt: lsa } = useActivityDrawerStore.getState();
    const { rows } = useActivityStore.getState();
    const unread = rows.filter((r) => r.ts > lsa).length;
    // ROW_A is 60s ago, ROW_B is 120s ago; lastSeenAt is 90s ago → only ROW_A is unread
    expect(unread).toBe(1);
  });
});
