/**
 * §1.6.11 — ProjectBrowserV3 Groups subtree tests.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import type { Element } from '@bim-ai/core';
import { ProjectBrowserV3 } from './ProjectBrowser';

afterEach(() => {
  cleanup();
});

function makeGroupDefinition(id: string, name: string): Element {
  return { kind: 'group_definition', id, name, elementIds: [] } as unknown as Element;
}

function makeGroupInstance(id: string, groupDefinitionId: string): Element {
  return { kind: 'group_instance', id, groupDefinitionId } as unknown as Element;
}

const groupDef1 = makeGroupDefinition('gd-01', 'Kitchen Unit');
const groupDef2 = makeGroupDefinition('gd-02', 'Bathroom Set');
const instance1a = makeGroupInstance('gi-01a', 'gd-01');
const instance1b = makeGroupInstance('gi-01b', 'gd-01');
const instance2a = makeGroupInstance('gi-02a', 'gd-02');

function makeProps(elements: Element[] = [], onSemanticCommand?: ReturnType<typeof vi.fn>) {
  return {
    elements,
    activeViewId: null as string | null,
    onActivateView: vi.fn(),
    onRenameView: vi.fn(),
    onDeleteView: vi.fn(),
    onDuplicateView: vi.fn(),
    onSemanticCommand,
  };
}

function expandGroups(container: HTMLElement): void {
  const section = container.querySelector('[data-testid="browser-groups-section"]');
  if (!section) throw new Error('browser-groups-section not found');
  const toggleBtn = section.querySelector('button') as HTMLElement;
  fireEvent.click(toggleBtn);
}

describe('ProjectBrowser Groups subtree — §1.6.11', () => {
  it('renders the browser-groups-section header', () => {
    const { getByTestId } = render(<ProjectBrowserV3 {...makeProps()} />);
    expect(getByTestId('browser-groups-section')).toBeTruthy();
  });

  it('shows browser-groups-empty when no group definitions exist', () => {
    const { container, getByTestId } = render(<ProjectBrowserV3 {...makeProps()} />);
    expandGroups(container);
    expect(getByTestId('browser-groups-empty')).toBeTruthy();
  });

  it('shows one row per group_definition when expanded', () => {
    const props = makeProps([groupDef1, groupDef2, instance1a, instance2a]);
    const { container, getByTestId } = render(<ProjectBrowserV3 {...props} />);
    expandGroups(container);
    expect(getByTestId('browser-group-row-gd-01')).toBeTruthy();
    expect(getByTestId('browser-group-row-gd-02')).toBeTruthy();
  });

  it('shows instance count for each group definition', () => {
    const props = makeProps([groupDef1, groupDef2, instance1a, instance1b, instance2a]);
    const { container, getByTestId } = render(<ProjectBrowserV3 {...props} />);
    expandGroups(container);
    expect(getByTestId('pb-group-instance-count-gd-01').textContent).toContain('2');
    expect(getByTestId('pb-group-instance-count-gd-02').textContent).toContain('1');
  });

  it('Groups section is collapsed by default', () => {
    const props = makeProps([groupDef1]);
    const { getByTestId, queryByTestId } = render(<ProjectBrowserV3 {...props} />);
    expect(getByTestId('browser-groups-section')).toBeTruthy();
    expect(queryByTestId('browser-group-row-gd-01')).toBeNull();
  });

  it('shows 0 instance count for group with no instances', () => {
    const props = makeProps([groupDef1]);
    const { container, getByTestId } = render(<ProjectBrowserV3 {...props} />);
    expandGroups(container);
    expect(getByTestId('pb-group-instance-count-gd-01').textContent).toContain('0');
  });

  it('displays group definition name in the row', () => {
    const props = makeProps([groupDef1]);
    const { container, getByText } = render(<ProjectBrowserV3 {...props} />);
    expandGroups(container);
    expect(getByText('Kitchen Unit')).toBeTruthy();
  });

  it('clicking a group row fires onSemanticCommand with selectGroupElements', () => {
    const onSemanticCommand = vi.fn();
    const props = makeProps([groupDef1], onSemanticCommand);
    const { container, getByTestId } = render(<ProjectBrowserV3 {...props} />);
    expandGroups(container);
    const row = getByTestId('browser-group-row-gd-01');
    const btn = row.querySelector('button') as HTMLElement;
    fireEvent.click(btn);
    expect(onSemanticCommand).toHaveBeenCalledWith({
      type: 'selectGroupElements',
      groupDefinitionId: 'gd-01',
    });
  });
});
