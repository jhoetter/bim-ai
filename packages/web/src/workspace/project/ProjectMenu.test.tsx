import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { useRef } from 'react';
import { ProjectMenu } from './ProjectMenu';

afterEach(() => {
  cleanup();
});

function Harness({
  open,
  onOpenChange,
  ...rest
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
} & Partial<Parameters<typeof ProjectMenu>[0]>) {
  const anchor = useRef<HTMLButtonElement | null>(null);
  return (
    <>
      <button ref={anchor} data-testid="anchor">
        anchor
      </button>
      <ProjectMenu open={open} onOpenChange={onOpenChange} anchorRef={anchor} {...rest} />
    </>
  );
}

describe('<ProjectMenu /> — T-03', () => {
  it('renders nothing when closed', () => {
    const { queryByTestId } = render(<Harness open={false} onOpenChange={() => {}} />);
    expect(queryByTestId('project-menu')).toBeNull();
  });

  it('renders the standard menu items when open', () => {
    const { getByTestId } = render(
      <Harness
        open={true}
        onOpenChange={() => {}}
        onOpenMaterialBrowser={() => {}}
        onOpenAppearanceAssetBrowser={() => {}}
      />,
    );
    expect(getByTestId('project-menu')).toBeTruthy();
    expect(getByTestId('project-menu-insert-seed')).toBeTruthy();
    expect(getByTestId('project-menu-save-snapshot')).toBeTruthy();
    expect(getByTestId('project-menu-save-milestone')).toBeTruthy();
    expect(getByTestId('project-menu-open-material-browser')).toBeTruthy();
    expect(getByTestId('project-menu-open-appearance-asset-browser')).toBeTruthy();
    expect(getByTestId('project-menu-save-as-options')).toBeTruthy();
    expect(getByTestId('project-menu-open-snapshot')).toBeTruthy();
    expect(getByTestId('project-menu-new-clear')).toBeTruthy();
  });

  it('renders recent project rows', () => {
    const { getByTestId } = render(
      <Harness
        open={true}
        onOpenChange={() => {}}
        recent={[
          { id: 'r1', label: 'Project Alpha' },
          { id: 'r2', label: 'Project Beta' },
        ]}
      />,
    );
    expect(getByTestId('project-menu-recent-r1')).toBeTruthy();
    expect(getByTestId('project-menu-recent-r2')).toBeTruthy();
  });

  it('renders seeded project rows and switches by model id', () => {
    const onOpenChange = vi.fn();
    const onPickSeedModel = vi.fn();
    const { getByTestId, getByText } = render(
      <Harness
        open={true}
        onOpenChange={onOpenChange}
        seedModels={[
          { id: 'm1', slug: 'target-house-1', label: 'Seed Library / target-house-1', revision: 1 },
          { id: 'm2', slug: 'villa-2', label: 'Seed Library / villa-2', revision: 4 },
        ]}
        activeSeedModelId="m2"
        onPickSeedModel={onPickSeedModel}
      />,
    );
    expect(getByTestId('project-menu-seed-target-house-1')).toBeTruthy();
    expect(getByText('active')).toBeTruthy();
    fireEvent.click(getByTestId('project-menu-seed-target-house-1'));
    expect(onPickSeedModel).toHaveBeenCalledWith('m1');
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('clicking a menu item closes the menu and fires the callback', () => {
    const onOpenChange = vi.fn();
    const onInsertSeed = vi.fn();
    const { getByTestId } = render(
      <Harness open={true} onOpenChange={onOpenChange} onInsertSeed={onInsertSeed} />,
    );
    fireEvent.click(getByTestId('project-menu-insert-seed'));
    expect(onInsertSeed).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('routes Save milestone through the project resources menu', () => {
    const onOpenChange = vi.fn();
    const onOpenMilestone = vi.fn();
    const { getByTestId } = render(
      <Harness open={true} onOpenChange={onOpenChange} onOpenMilestone={onOpenMilestone} />,
    );

    fireEvent.click(getByTestId('project-menu-save-milestone'));
    expect(onOpenMilestone).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('renders print exports when a model id is available', () => {
    const onOpenChange = vi.fn();
    const modelId = 'model/with space';
    const { getByTestId, unmount } = render(
      <Harness open={true} onOpenChange={onOpenChange} modelId={modelId} />,
    );

    const link = getByTestId('project-menu-export-stl') as HTMLAnchorElement;
    expect(link.textContent).toContain('3D print STL');
    expect(link.getAttribute('href')).toBe(
      `/api/models/${encodeURIComponent(modelId)}/exports/model.stl`,
    );
    expect(link.getAttribute('download')).toBe('model.stl');

    link.addEventListener('click', (event) => event.preventDefault());
    fireEvent.click(link);
    expect(onOpenChange).toHaveBeenCalledWith(false);

    const threeMfLink = getByTestId('project-menu-export-3mf') as HTMLAnchorElement;
    expect(threeMfLink.textContent).toContain('3D print 3MF');
    expect(threeMfLink.getAttribute('href')).toBe(
      `/api/models/${encodeURIComponent(modelId)}/exports/model.3mf`,
    );
    expect(threeMfLink.getAttribute('download')).toBe('model.3mf');

    unmount();
    const closed = render(<Harness open={true} onOpenChange={() => {}} />);
    expect(closed.queryByTestId('project-menu-export-stl')).toBeNull();
    expect(closed.queryByTestId('project-menu-export-3mf')).toBeNull();
  });

  it('routes material and appearance resources through the project menu owner', () => {
    const onOpenChange = vi.fn();
    const onOpenMaterialBrowser = vi.fn();
    const onOpenAppearanceAssetBrowser = vi.fn();
    const { getByTestId } = render(
      <Harness
        open={true}
        onOpenChange={onOpenChange}
        onOpenMaterialBrowser={onOpenMaterialBrowser}
        onOpenAppearanceAssetBrowser={onOpenAppearanceAssetBrowser}
      />,
    );

    fireEvent.click(getByTestId('project-menu-open-material-browser'));
    expect(onOpenMaterialBrowser).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(false);

    fireEvent.click(getByTestId('project-menu-open-appearance-asset-browser'));
    expect(onOpenAppearanceAssetBrowser).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('Escape closes the menu', () => {
    const onOpenChange = vi.fn();
    render(<Harness open={true} onOpenChange={onOpenChange} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('edits Save As Options maximum backups', () => {
    const onSaveAsMaximumBackupsChange = vi.fn();
    const { getByTestId } = render(
      <Harness
        open={true}
        onOpenChange={() => {}}
        saveAsMaximumBackups={12}
        onSaveAsMaximumBackupsChange={onSaveAsMaximumBackupsChange}
      />,
    );
    fireEvent.click(getByTestId('project-menu-save-as-options'));
    const input = getByTestId('project-menu-maximum-backups') as HTMLInputElement;
    expect(input.value).toBe('12');
    fireEvent.change(input, { target: { value: '150' } });
    fireEvent.click(getByTestId('project-menu-save-as-options-apply'));
    expect(onSaveAsMaximumBackupsChange).toHaveBeenCalledWith(99);
  });

  it('does not render replay tour item when onReplayTour is omitted', () => {
    const { queryByTestId } = render(<Harness open={true} onOpenChange={() => {}} />);
    expect(queryByTestId('project-menu-replay-tour')).toBeNull();
  });

  it('renders replay tour item when onReplayTour is provided and fires callback', () => {
    const onOpenChange = vi.fn();
    const onReplayTour = vi.fn();
    const { getByTestId } = render(
      <Harness open={true} onOpenChange={onOpenChange} onReplayTour={onReplayTour} />,
    );
    expect(getByTestId('project-menu-replay-tour')).toBeTruthy();
    fireEvent.click(getByTestId('project-menu-replay-tour'));
    expect(onReplayTour).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
