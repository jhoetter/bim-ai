import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { afterEach, describe, it, expect, vi } from 'vitest';
import { GlobalParamsDialog, evalFormulaMm, applyGlobalParamCommand } from './GlobalParamsDialog';
import type { Element } from '@bim-ai/core';

afterEach(() => {
  cleanup();
});

// ---------------------------------------------------------------------------
// Unit tests for evalFormulaMm
// ---------------------------------------------------------------------------

describe('evalFormulaMm', () => {
  it('evaluates simple addition', () => {
    expect(evalFormulaMm('3000 + 500')).toBe(3500);
  });

  it('evaluates multiplication', () => {
    expect(evalFormulaMm('2 * 1500')).toBe(3000);
  });

  it('evaluates parenthesised expression', () => {
    expect(evalFormulaMm('(1000 + 200) * 2')).toBe(2400);
  });

  it('returns NaN for invalid expression', () => {
    expect(evalFormulaMm('abc')).toBeNaN();
  });

  it('strips non-numeric chars before evaluating', () => {
    expect(evalFormulaMm('alert(1); 42')).toBeNaN();
  });
});

// ---------------------------------------------------------------------------
// Unit tests for applyGlobalParamCommand
// ---------------------------------------------------------------------------

describe('applyGlobalParamCommand', () => {
  const base = [{ id: 'p1', name: 'floorHeight', formula: '3000', valueMm: 3000 }];

  it('addGlobalParam stores the param', () => {
    const result = applyGlobalParamCommand([], {
      type: 'addGlobalParam',
      id: 'p2',
      name: 'wallHeight',
      formula: '3000 + 500',
      valueMm: 3500,
    });
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe('p2');
    expect(result[0]?.valueMm).toBe(3500);
  });

  it('addGlobalParam evaluates formula to valueMm', () => {
    const result = applyGlobalParamCommand([], {
      type: 'addGlobalParam',
      id: 'p3',
      name: 'test',
      formula: '3000 + 500',
      valueMm: 3500,
    });
    expect(result[0]?.valueMm).toBe(3500);
  });

  it('updateGlobalParam changes formula and valueMm', () => {
    const result = applyGlobalParamCommand(base, {
      type: 'updateGlobalParam',
      id: 'p1',
      formula: '2500 + 100',
      valueMm: 2600,
    });
    expect(result[0]?.formula).toBe('2500 + 100');
    expect(result[0]?.valueMm).toBe(2600);
  });

  it('deleteGlobalParam removes the param', () => {
    const result = applyGlobalParamCommand(base, { type: 'deleteGlobalParam', id: 'p1' });
    expect(result).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Dialog rendering tests
// ---------------------------------------------------------------------------

function makeProjectSettings(
  params: Array<{ id: string; name: string; formula: string; valueMm: number }>,
): Element {
  return {
    kind: 'project_settings',
    id: 'ps-1',
    globalParams: params,
  } as unknown as Element;
}

describe('GlobalParamsDialog', () => {
  it('renders a row for each globalParam', () => {
    const elements: Record<string, Element> = {
      'ps-1': makeProjectSettings([
        { id: 'p1', name: 'floorHeight', formula: '3000', valueMm: 3000 },
        { id: 'p2', name: 'wallThick', formula: '200 + 50', valueMm: 250 },
      ]),
    };
    render(
      <GlobalParamsDialog
        open
        onClose={vi.fn()}
        elementsById={elements}
        onSemanticCommand={vi.fn()}
      />,
    );
    expect(screen.getByTestId('global-param-row-p1')).toBeTruthy();
    expect(screen.getByTestId('global-param-row-p2')).toBeTruthy();
  });

  it('dispatches addGlobalParam on button click', async () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    render(
      <GlobalParamsDialog open onClose={vi.fn()} elementsById={{}} onSemanticCommand={dispatch} />,
    );
    fireEvent.change(screen.getByTestId('new-param-name'), { target: { value: 'myParam' } });
    fireEvent.change(screen.getByTestId('new-param-formula'), { target: { value: '1000' } });
    fireEvent.click(screen.getByTestId('add-param-button'));
    await vi.waitFor(() => expect(dispatch).toHaveBeenCalled());
    const cmd = dispatch.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(cmd.type).toBe('addGlobalParam');
    expect(cmd.name).toBe('myParam');
    expect(cmd.formula).toBe('1000');
  });

  it('does not render when closed', () => {
    render(
      <GlobalParamsDialog
        open={false}
        onClose={vi.fn()}
        elementsById={{}}
        onSemanticCommand={vi.fn()}
      />,
    );
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
