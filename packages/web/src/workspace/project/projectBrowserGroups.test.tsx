/**
 * §1.6.11 — ProjectBrowser Groups section tests.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import type { Element } from '@bim-ai/core';
import { ProjectBrowserV3 } from './ProjectBrowser';

afterEach(() => {
  cleanup();
});

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeGroupDefinition(id: string, name: string): Element {
  return {
    kind: 'group_definition',
    id,
    name,
  } as unknown as Element;
}

function makeGroupInstance(id: string, groupDefinitionId: string): Element {
  return {
    kind: 'group_instance',
    id,
    groupDefinitionId,
  } as unknown as Element;
}

const groupDef1 = makeGroupDefinition('gd-01', 'Kitchen Unit');
const groupDef2 = makeGroupDefinition('gd-02', 'Bathroom Set');

const instance1a = makeGroupInstance('gi-01a', 'gd-01');
const instance1b = makeGroupInstance('gi-01b', 'gd-01');
const instance2a = makeGroupInstance('gi-02a', 'gd-02');

function makeProps(elements: Element[] = []) {
  return {
    elements,
    activeViewId: null as string | null,
    onActivateView: vi.fn(),
    onRenameView: vi.fn(),
    onDeleteView: vi.fn(),
    onDuplicateView: vi.fn(),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ProjectBrowser groups section — §1.6.11', () => {
  it('renders pb-section-groups', () => {
    const { getByTestId } = render(<ProjectBrowserV3 {...makeProps()} />);
    expect(getByTestId('pb-section-groups')).toBeTruthy();
  });

  it('shows one leaf per group_definition when expanded', () => {
    const props = makeProps([groupDef1, groupDef2, instance1a, instance2a]);
    const { getByTestId } = render(<ProjectBrowserV3 {...props} />);
    // Expand the section
    const toggle = getByTestId('pb-section-groups').querySelector('button') as HTMLElement;
    fireEvent.click(toggle);
    expect(getByTestId('pb-group-gd-01')).toBeTruthy();
    expect(getByTestId('pb-group-gd-02')).toBeTruthy();
  });

  it('shows instance count label ×N for each group definition', () => {
    const props = makeProps([groupDef1, groupDef2, instance1a, instance1b, instance2a]);
    const { getByTestId } = render(<ProjectBrowserV3 {...props} />);
    const toggle = getByTestId('pb-section-groups').querySelector('button') as HTMLElement;
    fireEvent.click(toggle);
    // groupDef1 has 2 instances, groupDef2 has 1 instance
    expect(getByTestId('pb-group-instance-count-gd-01').textContent).toBe('×2');
    expect(getByTestId('pb-group-instance-count-gd-02').textContent).toBe('×1');
  });

  it('pb-section-groups is collapsed by default', () => {
    const props = makeProps([groupDef1]);
    const { getByTestId, queryByTestId } = render(<ProjectBrowserV3 {...props} />);
    expect(getByTestId('pb-section-groups')).toBeTruthy();
    expect(queryByTestId('pb-group-gd-01')).toBeNull();
  });

  it('shows ×0 instance count for group_definition with no instances', () => {
    const props = makeProps([groupDef1]);
    const { getByTestId } = render(<ProjectBrowserV3 {...props} />);
    const toggle = getByTestId('pb-section-groups').querySelector('button') as HTMLElement;
    fireEvent.click(toggle);
    expect(getByTestId('pb-group-instance-count-gd-01').textContent).toBe('×0');
  });

  it('displays group definition name in the leaf', () => {
    const props = makeProps([groupDef1]);
    const { getByTestId, getByText } = render(<ProjectBrowserV3 {...props} />);
    const toggle = getByTestId('pb-section-groups').querySelector('button') as HTMLElement;
    fireEvent.click(toggle);
    expect(getByText('Kitchen Unit')).toBeTruthy();
  });
});
