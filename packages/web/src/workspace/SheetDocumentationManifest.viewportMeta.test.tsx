import type { Element } from '@bim-ai/core';
import { act, type ReactElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';

import type { SheetTitleblockDraft } from './sheetTitleblockAuthoring';
import { SheetDocumentationManifest } from './SheetDocumentationManifest';

const tbDraft: SheetTitleblockDraft = {
  titleBlock: '',
  sheetNumber: '',
  revision: '',
  projectName: '',
  drawnBy: '',
  checkedBy: '',
  issueDate: '',
};

describe('SheetDocumentationManifest viewport metadata columns', () => {
  const containers: HTMLDivElement[] = [];

  beforeAll(() => {
    (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  });

  afterEach(() => {
    for (const c of containers) {
      c.remove();
    }
    containers.length = 0;
  });

  function renderManifest(ui: ReactElement) {
    const container = document.createElement('div');
    document.body.appendChild(container);
    containers.push(container);
    const root = createRoot(container);
    act(() => {
      root.render(ui);
    });
    return container;
  }

  it('lists label, detail number, scale, and locked state in the viewport table', () => {
    const el = renderManifest(
      <SheetDocumentationManifest
        sheet={{
          kind: 'sheet',
          id: 'sh-meta',
          name: 'Sheet Meta',
          viewportsMm: [],
        }}
        modelId={undefined}
        elementsById={{} as Record<string, Element>}
        authoring={true}
        tbDraft={tbDraft}
        vpDrafts={[
          {
            viewportId: 'vp-meta-row',
            label: 'Lobby plan',
            viewRef: 'plan:pv-lobby',
            detailNumber: '4B',
            scale: '1:100',
            viewportLocked: true,
            xMm: 10,
            yMm: 20,
            widthMm: 100,
            heightMm: 80,
            cropMinMm: null,
            cropMaxMm: null,
          },
        ]}
      />,
    );
    const table = el.querySelector('[data-testid="sheet-documentation-manifest"]');
    expect(table).toBeTruthy();
    expect(table?.textContent).toContain('Lobby plan');
    expect(table?.textContent).toContain('4B');
    expect(table?.textContent).toContain('1:100');
    expect(table?.textContent).toContain('yes');
  });
});
