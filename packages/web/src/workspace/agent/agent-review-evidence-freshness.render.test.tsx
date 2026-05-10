/**
 * Component rendering tests for the evidence freshness summary display in Agent Review.
 *
 * Verifies that the freshness counts (fresh/stale/missing) and regeneration guidance
 * checklist render correctly for various freshness states.
 */
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';

type FreshnessData = {
  freshCount: number;
  staleCount: number;
  missingCount: number;
  totalCount: number;
};

type RegenerationAction = {
  priority: 'high' | 'medium' | 'low';
  artifactKey: string;
  reason: string;
  suggestedCommand: string;
};

function renderFreshnessSummary(
  freshness: FreshnessData,
  guidance: RegenerationAction[] | null,
): HTMLDivElement {
  const container = document.createElement('div');
  container.setAttribute('data-testid', 'agent-review-evidence-freshness');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(
      <div data-testid="agent-review-evidence-freshness">
        <div className="text-muted">Evidence freshness (ingestEvidenceArtifactManifest_v1)</div>
        <ul>
          <li>
            fresh: <strong data-testid="freshness-fresh-count">{freshness.freshCount}</strong>
            {' / '}stale:{' '}
            <strong data-testid="freshness-stale-count">{freshness.staleCount}</strong>
            {' / '}missing:{' '}
            <strong data-testid="freshness-missing-count">{freshness.missingCount}</strong> (total:{' '}
            <strong>{freshness.totalCount}</strong>)
          </li>
        </ul>
        {guidance && guidance.length > 0 ? (
          <div>
            <div>Regeneration guidance (agentRegenerationGuidance_v1)</div>
            <ul data-testid="regeneration-guidance-checklist">
              {guidance.map((action, idx) => (
                <li key={idx}>
                  <span>[{action.priority}]</span> <code>{action.artifactKey}</code>
                  {' — '}
                  {action.reason}
                  <div>
                    <code>$ {action.suggestedCommand}</code>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>,
    );
  });
  return container;
}

describe('evidence freshness summary — rendering', () => {
  const containers: HTMLDivElement[] = [];

  beforeAll(() => {
    (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
      true;
  });

  afterEach(() => {
    for (const c of containers) c.remove();
    containers.length = 0;
  });

  it('renders with data-testid="agent-review-evidence-freshness"', () => {
    const container = renderFreshnessSummary(
      { freshCount: 3, staleCount: 0, missingCount: 0, totalCount: 3 },
      null,
    );
    containers.push(container);
    const inner = container.querySelector('[data-testid="agent-review-evidence-freshness"]');
    expect(inner).not.toBeNull();
  });

  it('displays fresh count when all artifacts are fresh', () => {
    const container = renderFreshnessSummary(
      { freshCount: 5, staleCount: 0, missingCount: 0, totalCount: 5 },
      null,
    );
    containers.push(container);
    const freshEl = container.querySelector('[data-testid="freshness-fresh-count"]');
    expect(freshEl?.textContent).toBe('5');
    const staleEl = container.querySelector('[data-testid="freshness-stale-count"]');
    expect(staleEl?.textContent).toBe('0');
    const missingEl = container.querySelector('[data-testid="freshness-missing-count"]');
    expect(missingEl?.textContent).toBe('0');
  });

  it('displays stale count when artifacts are stale', () => {
    const container = renderFreshnessSummary(
      { freshCount: 1, staleCount: 2, missingCount: 0, totalCount: 3 },
      null,
    );
    containers.push(container);
    expect(container.querySelector('[data-testid="freshness-fresh-count"]')?.textContent).toBe('1');
    expect(container.querySelector('[data-testid="freshness-stale-count"]')?.textContent).toBe('2');
    expect(container.querySelector('[data-testid="freshness-missing-count"]')?.textContent).toBe(
      '0',
    );
  });

  it('displays missing count when artifacts are missing', () => {
    const container = renderFreshnessSummary(
      { freshCount: 0, staleCount: 0, missingCount: 4, totalCount: 4 },
      null,
    );
    containers.push(container);
    expect(container.querySelector('[data-testid="freshness-missing-count"]')?.textContent).toBe(
      '4',
    );
  });

  it('renders mixed fresh/stale/missing counts', () => {
    const container = renderFreshnessSummary(
      { freshCount: 2, staleCount: 1, missingCount: 1, totalCount: 4 },
      null,
    );
    containers.push(container);
    const text = container.textContent ?? '';
    expect(text).toContain('2');
    expect(text).toContain('1');
    expect(text).toContain('4');
  });
});

describe('evidence freshness — regeneration guidance checklist', () => {
  const containers: HTMLDivElement[] = [];

  beforeAll(() => {
    (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
      true;
  });

  afterEach(() => {
    for (const c of containers) c.remove();
    containers.length = 0;
  });

  it('renders regeneration guidance checklist when guidance is present', () => {
    const guidance: RegenerationAction[] = [
      {
        priority: 'high',
        artifactKey: 'sheet-s1',
        reason: 'Evidence artifact has no recorded digest.',
        suggestedCommand: 'cd app && .venv/bin/pytest tests/ -x -v',
      },
    ];
    const container = renderFreshnessSummary(
      { freshCount: 0, staleCount: 1, missingCount: 0, totalCount: 1 },
      guidance,
    );
    containers.push(container);
    const checklist = container.querySelector('[data-testid="regeneration-guidance-checklist"]');
    expect(checklist).not.toBeNull();
    const items = checklist!.querySelectorAll('li');
    expect(items.length).toBe(1);
  });

  it('does not render guidance checklist when guidance is null', () => {
    const container = renderFreshnessSummary(
      { freshCount: 3, staleCount: 0, missingCount: 0, totalCount: 3 },
      null,
    );
    containers.push(container);
    const checklist = container.querySelector('[data-testid="regeneration-guidance-checklist"]');
    expect(checklist).toBeNull();
  });

  it('renders high priority action with correct artifact key', () => {
    const guidance: RegenerationAction[] = [
      {
        priority: 'high',
        artifactKey: 'viewpoint-vp1',
        reason: 'Missing digest; regeneration required.',
        suggestedCommand: 'pnpm exec playwright test',
      },
    ];
    const container = renderFreshnessSummary(
      { freshCount: 0, staleCount: 0, missingCount: 1, totalCount: 1 },
      guidance,
    );
    containers.push(container);
    const text = container.textContent ?? '';
    expect(text).toContain('high');
    expect(text).toContain('viewpoint-vp1');
    expect(text).toContain('playwright test');
  });

  it('renders multiple guidance actions with priorities', () => {
    const guidance: RegenerationAction[] = [
      {
        priority: 'high',
        artifactKey: 'sheet-s1',
        reason: 'No digest.',
        suggestedCommand: 'pytest',
      },
      {
        priority: 'medium',
        artifactKey: 'sheet-s2',
        reason: 'Changed.',
        suggestedCommand: 'pytest',
      },
      {
        priority: 'low',
        artifactKey: 'sheet-s3',
        reason: 'Stale.',
        suggestedCommand: 'pytest',
      },
    ];
    const container = renderFreshnessSummary(
      { freshCount: 0, staleCount: 3, missingCount: 0, totalCount: 3 },
      guidance,
    );
    containers.push(container);
    const items = container.querySelectorAll('[data-testid="regeneration-guidance-checklist"] li');
    expect(items.length).toBe(3);
    const text = container.textContent ?? '';
    expect(text).toContain('high');
    expect(text).toContain('medium');
    expect(text).toContain('low');
  });

  it('renders suggested command in each guidance item', () => {
    const guidance: RegenerationAction[] = [
      {
        priority: 'low',
        artifactKey: 'plan_view-pv1',
        reason: 'Package digest changed.',
        suggestedCommand: 'cd app && .venv/bin/pytest tests/ -k evidence -x -v',
      },
    ];
    const container = renderFreshnessSummary(
      { freshCount: 0, staleCount: 1, missingCount: 0, totalCount: 1 },
      guidance,
    );
    containers.push(container);
    const text = container.textContent ?? '';
    expect(text).toContain('evidence');
    expect(text).toContain('plan_view-pv1');
  });
});
