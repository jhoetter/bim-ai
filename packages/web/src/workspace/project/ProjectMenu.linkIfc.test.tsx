import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { useRef } from 'react';
import { ProjectMenu } from './ProjectMenu';

afterEach(() => {
  cleanup();
});

type ProjectMenuProps = Parameters<typeof ProjectMenu>[0];

function Harness(props: Partial<ProjectMenuProps>) {
  const anchor = useRef<HTMLButtonElement | null>(null);
  const merged: ProjectMenuProps = {
    open: true,
    onOpenChange: () => {},
    anchorRef: anchor,
    ...props,
  };
  return (
    <>
      <button ref={anchor} data-testid="anchor">
        anchor
      </button>
      <ProjectMenu {...merged} />
    </>
  );
}

describe('FED-04 — ProjectMenu IFC link entries', () => {
  it('renders Insert → Link IFC when onLinkIfc is wired', () => {
    const { getByTestId } = render(<Harness onLinkIfc={() => {}} />);
    expect(getByTestId('project-menu-link-ifc')).toBeTruthy();
  });

  it('does not render IFC entries when onLinkIfc is omitted', () => {
    const { queryByTestId } = render(<Harness />);
    expect(queryByTestId('project-menu-link-ifc')).toBeNull();
    expect(queryByTestId('project-menu-link-dxf')).toBeNull();
    expect(queryByTestId('project-menu-link-revit')).toBeNull();
  });

  it('DXF and Revit entries are present but disabled when onLinkIfc is wired', () => {
    const { getByTestId } = render(<Harness onLinkIfc={() => {}} />);
    const dxf = getByTestId('project-menu-link-dxf') as HTMLButtonElement;
    const revit = getByTestId('project-menu-link-revit') as HTMLButtonElement;
    expect(dxf.disabled).toBe(true);
    expect(revit.disabled).toBe(true);
    expect(dxf.title).toMatch(/DXF/i);
    expect(revit.title).toMatch(/Revit|OpenBIM|Forge/i);
  });

  it('clicking Link IFC opens the file picker; selecting a file fires onLinkIfc', () => {
    const onLinkIfc = vi.fn();
    const { getByTestId } = render(<Harness onLinkIfc={onLinkIfc} />);
    const trigger = getByTestId('project-menu-link-ifc');
    const input = getByTestId('project-menu-ifc-input') as HTMLInputElement;

    // Stub click() to avoid native file dialog in jsdom; just fire change.
    const clickSpy = vi.spyOn(input, 'click').mockImplementation(() => {});
    fireEvent.click(trigger);
    expect(clickSpy).toHaveBeenCalled();

    const file = new File(['ISO-10303-21'], 'demo.ifc', { type: 'application/octet-stream' });
    fireEvent.change(input, { target: { files: [file] } });
    expect(onLinkIfc).toHaveBeenCalledTimes(1);
    expect(onLinkIfc.mock.calls[0][0].name).toBe('demo.ifc');
  });
});
