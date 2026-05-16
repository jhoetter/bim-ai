import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  ManageGlobalParamsDialog,
  applyGlobalParamCmd,
  type SimpleGlobalParam,
} from './ManageGlobalParamsDialog';

afterEach(() => {
  cleanup();
});

const baseParams: SimpleGlobalParam[] = [
  { id: 'p1', name: 'floorHeight', value: 3000, unit: 'mm' },
  { id: 'p2', name: 'siteAngle', value: 45, unit: 'deg' },
];

describe('global parameters — §3.8', () => {
  it('upsert_global_param adds new param to project_settings', () => {
    const newParam: SimpleGlobalParam = { id: 'p3', name: 'wallThick', value: 200, unit: 'mm' };
    const result = applyGlobalParamCmd([], {
      type: 'upsert_global_param',
      param: newParam,
    });
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: 'p3', name: 'wallThick', value: 200, unit: 'mm' });
  });

  it('upsert_global_param updates existing param in place', () => {
    const updated: SimpleGlobalParam = { ...baseParams[0]!, value: 3500 };
    const result = applyGlobalParamCmd(baseParams, {
      type: 'upsert_global_param',
      param: updated,
    });
    expect(result).toHaveLength(2);
    expect(result[0]?.value).toBe(3500);
  });

  it('delete_global_param removes param by id', () => {
    const result = applyGlobalParamCmd(baseParams, {
      type: 'delete_global_param',
      paramId: 'p1',
    });
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe('p2');
  });

  it('ManageGlobalParamsDialog renders params from store', () => {
    render(
      React.createElement(ManageGlobalParamsDialog, {
        isOpen: true,
        params: baseParams,
        onUpsertParam: vi.fn(),
        onDeleteParam: vi.fn(),
        onClose: vi.fn(),
      }),
    );
    expect(screen.getByTestId('global-param-row-p1')).toBeTruthy();
    expect(screen.getByTestId('global-param-row-p2')).toBeTruthy();
  });

  it('Add Parameter button appends a new row', () => {
    const onUpsert = vi.fn();
    render(
      React.createElement(ManageGlobalParamsDialog, {
        isOpen: true,
        params: [],
        onUpsertParam: onUpsert,
        onDeleteParam: vi.fn(),
        onClose: vi.fn(),
      }),
    );
    fireEvent.change(screen.getByTestId('new-param-name'), { target: { value: 'myParam' } });
    fireEvent.change(screen.getByTestId('new-param-value'), { target: { value: '1500' } });
    fireEvent.click(screen.getByTestId('global-params-add'));
    expect(onUpsert).toHaveBeenCalledOnce();
    const arg = onUpsert.mock.calls[0]![0] as SimpleGlobalParam;
    expect(arg.name).toBe('myParam');
    expect(arg.value).toBe(1500);
  });
});
