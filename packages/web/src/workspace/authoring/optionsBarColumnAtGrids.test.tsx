import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import { useBimStore } from '../../state/store';
import { OptionsBar } from './OptionsBar';

afterEach(() => {
  cleanup();
  act(() => {
    useBimStore.setState({
      planTool: 'select',
      elementsById: {},
      columnAtGridsSelectedIds: [],
    });
  });
});

describe('options bar — column at grids — §9.1.2', () => {
  it('renders options-column-at-grids-type select with column types', () => {
    act(() => {
      useBimStore.setState({
        planTool: 'column-at-grids',
        elementsById: {},
        columnAtGridsSelectedIds: [],
      });
    });
    const { getByTestId } = render(<OptionsBar />);
    const select = getByTestId('options-column-at-grids-type');
    expect(select.tagName.toLowerCase()).toBe('select');
  });

  it('renders options-column-at-grids-level select with levels', () => {
    act(() => {
      useBimStore.setState({
        planTool: 'column-at-grids',
        elementsById: {
          'lvl-1': {
            kind: 'level',
            id: 'lvl-1',
            name: 'Level 1',
            elevationMm: 0,
          },
          'lvl-2': {
            kind: 'level',
            id: 'lvl-2',
            name: 'Level 2',
            elevationMm: 3000,
          },
        },
        columnAtGridsSelectedIds: [],
      });
    });
    const { getByTestId, getByText } = render(<OptionsBar />);
    const select = getByTestId('options-column-at-grids-level');
    expect(select.tagName.toLowerCase()).toBe('select');
    expect(getByText('Level 1')).toBeTruthy();
    expect(getByText('Level 2')).toBeTruthy();
  });

  it('renders options-column-at-grids-count showing 0 when no grids selected', () => {
    act(() => {
      useBimStore.setState({
        planTool: 'column-at-grids',
        elementsById: {},
        columnAtGridsSelectedIds: [],
      });
    });
    const { getByTestId } = render(<OptionsBar />);
    const count = getByTestId('options-column-at-grids-count');
    expect(count.textContent).toContain('0');
  });
});
