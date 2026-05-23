/**
 * Time-travel Wave 4 — iter-picker helpers.
 *
 * The iter-picker promotes a paged commit log filtered by
 * `testhouse_house` into a one-button-per-iter strip whose click target
 * is the historical Workspace viewer. These helpers are pure and easy to
 * cover; the full dashboard render uses them via the React component.
 */
import { describe, expect, it } from 'vitest';

import {
  dominantModelId,
  historicalViewerUrl,
  lastCommitPerIter,
} from './AgentHouseDashboard';
import type { CommitListItem, SessionSummary } from './types';

function session(model: string | null, house: string | null = 'alpha'): SessionSummary {
  return {
    session_id: Math.random().toString(36).slice(2),
    path: '',
    size_bytes: 0,
    first_ts: null,
    last_ts: null,
    user_messages: 0,
    assistant_messages: 0,
    tool_calls: 0,
    sub_agent_dispatches: 0,
    tool_call_counts_by_name: {},
    inferred_model_id: model,
    inferred_house: house,
    inferred_iteration: null,
    git_branch: null,
    parse_errors: 0,
  };
}

function commit(
  commitId: string,
  iter: number | undefined,
  createdAt: string,
  phase?: string,
): CommitListItem {
  return {
    commitId,
    modelId: 'model-1',
    parentCommitId: null,
    firstRevision: 1,
    lastRevision: 2,
    state: 'closed',
    summary: '',
    context: {
      testhouse_iter:
        iter === undefined
          ? undefined
          : { house: 'alpha', iter, phase: phase ?? 'exterior' },
    },
    createdAt,
    closedAt: createdAt,
    snapshotId: 1,
  };
}

describe('dominantModelId', () => {
  it('returns the most-frequent inferred_model_id across sessions', () => {
    const sessions = [
      session('mid-A'),
      session('mid-B'),
      session('mid-A'),
      session('mid-A'),
      session(null),
    ];
    expect(dominantModelId(sessions)).toBe('mid-A');
  });

  it('returns null when no session has a model id', () => {
    expect(dominantModelId([session(null), session(null)])).toBeNull();
  });

  it('returns null for an empty list', () => {
    expect(dominantModelId([])).toBeNull();
  });
});

describe('lastCommitPerIter', () => {
  it('picks the first (= newest, API returns newest-first) commit per iter', () => {
    // API contract: commits are sorted by created_at DESC.
    const commits = [
      commit('c5', 5, '2026-05-20T15:00Z', 'openings'),
      commit('c5b', 5, '2026-05-20T14:00Z', 'walls'),
      commit('c3', 3, '2026-05-18T10:00Z', 'walls'),
      commit('c3b', 3, '2026-05-18T09:00Z', 'walls'),
      commit('c1', 1, '2026-05-15T08:00Z', 'walls'),
    ];
    const out = lastCommitPerIter(commits);
    expect(out.map((e) => [e.iter, e.commit.commitId, e.commitCount])).toEqual([
      [1, 'c1', 1],
      [3, 'c3', 2],
      [5, 'c5', 2],
    ]);
  });

  it('ignores commits without testhouse_iter.iter', () => {
    const commits = [
      commit('c-untagged', undefined, '2026-05-20T15:00Z'),
      commit('c3', 3, '2026-05-18T10:00Z'),
    ];
    const out = lastCommitPerIter(commits);
    expect(out.map((e) => e.iter)).toEqual([3]);
  });

  it('emits an empty list when nothing is tagged', () => {
    expect(lastCommitPerIter([])).toEqual([]);
  });
});

describe('historicalViewerUrl', () => {
  it('builds /?modelId=&at= so the Workspace bootstrap honors both', () => {
    const url = historicalViewerUrl('mid-7', '01HCOMMITID');
    expect(url).toContain('modelId=mid-7');
    expect(url).toContain('at=01HCOMMITID');
    expect(url.startsWith('/?')).toBe(true);
  });

  it('url-encodes ids so unexpected characters do not break the link', () => {
    const url = historicalViewerUrl('mid 7', '01H&A=B');
    expect(url).toContain('modelId=mid+7');
    expect(url).toContain('at=01H%26A%3DB');
  });

  it('is safe to drop directly into an iframe src on the same origin', () => {
    // The dashboard iframe loads this URL relative to /agents/houses/:house/...
    // — the leading '/?' guarantees the browser resolves against the
    // current origin's root, not against the dashboard path.
    expect(historicalViewerUrl('m', 'c').startsWith('/?')).toBe(true);
  });
});
