import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';

import { ManageLinksDialog } from './project/ManageLinksDialog';
import { useBimStore } from '../state/store';

type IfcLinkEl = Extract<
  ReturnType<typeof useBimStore.getState>['elementsById'][string],
  { kind: 'link_ifc' }
>;

function makeIfcLink(overrides: Partial<IfcLinkEl> = {}): IfcLinkEl {
  return {
    kind: 'link_ifc',
    id: 'ifc-link-1',
    name: 'structure.ifc',
    ifcContent: 'ISO-10303-21;',
    linkedElements: [],
    visible: true,
    ...overrides,
  } as IfcLinkEl;
}

beforeEach(() => {
  useBimStore.setState({ modelId: 'model-1', elementsById: {} });
});

afterEach(() => {
  cleanup();
});

describe('ManageLinksDialog IFC section — §12.1.1', () => {
  it('renders the Link IFC button', () => {
    const { getByTestId } = render(
      <ManageLinksDialog open={true} onClose={vi.fn()} onSemanticCommand={vi.fn()} />,
    );
    expect(getByTestId('link-ifc-btn')).toBeTruthy();
  });

  it('renders a list row for each link_ifc element', () => {
    const link = makeIfcLink();
    useBimStore.setState({ elementsById: { [link.id]: link } });
    const { getByTestId } = render(
      <ManageLinksDialog open={true} onClose={vi.fn()} onSemanticCommand={vi.fn()} />,
    );
    expect(getByTestId(`link-ifc-row-${link.id}`)).toBeTruthy();
  });

  it('visibility checkbox is checked when link is visible', () => {
    const link = makeIfcLink({ visible: true });
    useBimStore.setState({ elementsById: { [link.id]: link } });
    const { getByTestId } = render(
      <ManageLinksDialog open={true} onClose={vi.fn()} onSemanticCommand={vi.fn()} />,
    );
    const checkbox = getByTestId(`link-ifc-visible-${link.id}`) as HTMLInputElement;
    expect(checkbox.checked).toBe(true);
  });

  it('clicking Remove calls onSemanticCommand removeIfcLink', () => {
    const link = makeIfcLink();
    useBimStore.setState({ elementsById: { [link.id]: link } });
    const onCmd = vi.fn();
    const { getByTestId } = render(
      <ManageLinksDialog open={true} onClose={vi.fn()} onSemanticCommand={onCmd} />,
    );
    fireEvent.click(getByTestId(`link-ifc-remove-${link.id}`));
    expect(onCmd).toHaveBeenCalledWith({ type: 'removeIfcLink', linkId: link.id });
  });
});
