/**
 * PERF-M04: render-count regression harness.
 *
 * Renders a tiny component twice through the renderer; asserts the
 * window probe sees exactly the expected count. Future regressions
 * that double-render the same surface flip this assertion.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import * as React from 'react';

import { readRenderCountProbe, resetRenderCountProbe, useRenderCount } from '@bim-ai/web-state';

function Probe({ name, value }: { name: string; value: number }): React.ReactElement {
  useRenderCount(name);
  return React.createElement('span', null, String(value));
}

describe('useRenderCount probe', () => {
  afterEach(() => {
    cleanup();
    resetRenderCountProbe();
  });

  it('records exactly one sample per render', () => {
    resetRenderCountProbe();
    (window as { __BIM_AI_RECORD_RENDER_COUNTS__?: boolean }).__BIM_AI_RECORD_RENDER_COUNTS__ =
      true;
    const { rerender } = render(React.createElement(Probe, { name: 'M04Probe', value: 1 }));
    rerender(React.createElement(Probe, { name: 'M04Probe', value: 2 }));
    rerender(React.createElement(Probe, { name: 'M04Probe', value: 3 }));
    const samples = readRenderCountProbe();
    // initial render + 2 rerenders = 3 effect-applied counts on the window probe
    expect(samples['M04Probe']?.count).toBe(3);
  });

  it('isolates names so unrelated panes do not bump each other', () => {
    resetRenderCountProbe();
    (window as { __BIM_AI_RECORD_RENDER_COUNTS__?: boolean }).__BIM_AI_RECORD_RENDER_COUNTS__ =
      true;
    render(React.createElement(Probe, { name: 'Alpha', value: 1 }));
    render(React.createElement(Probe, { name: 'Beta', value: 1 }));
    const samples = readRenderCountProbe();
    expect(samples['Alpha']?.count).toBe(1);
    expect(samples['Beta']?.count).toBe(1);
  });
});
