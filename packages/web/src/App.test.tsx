import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('./workspace/Workspace', () => ({
  Workspace: () => <div data-testid="workspace" />,
}));

vi.mock('./design-systems/IconGallery', () => ({
  IconGallery: () => <div data-testid="icon-gallery" />,
}));

vi.mock('./familyEditor/FamilyEditorWorkbench', () => ({
  FamilyEditorWorkbench: () => <div data-testid="family-editor" />,
}));

const presentationViewerSpy = vi.fn(({ token }: { token: string }) => (
  <div data-testid="presentation-viewer" data-token={token} />
));

vi.mock('./viewer/PresentationViewer', () => ({
  PresentationViewer: (props: { token: string }) => presentationViewerSpy(props),
}));

import { App } from './App';

describe('<App /> routing', () => {
  afterEach(() => {
    cleanup();
    presentationViewerSpy.mockClear();
    window.history.replaceState(null, '', '/');
  });

  it('matches shared presentation links that include a theme hash', () => {
    const token = 'fan8lkRK5oae3901usDdES4v5NjG0gLDLFM7ynmaJn8';
    window.history.replaceState(null, '', `/p/${token}#theme=light`);

    const { getByTestId } = render(<App />);

    expect(getByTestId('presentation-viewer').dataset.token).toBe(token);
    expect(presentationViewerSpy).toHaveBeenCalledWith({ token });
  });
});
