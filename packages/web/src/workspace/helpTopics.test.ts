import { describe, expect, it } from 'vitest';
import { HELP_TOPICS, searchHelpTopics } from './helpTopics';

describe('In-product help search — §1.6.4', () => {
  it('has at least 20 help topics', () => {
    expect(HELP_TOPICS.length).toBeGreaterThanOrEqual(20);
  });

  it('each topic has required fields', () => {
    for (const t of HELP_TOPICS) {
      expect(t.id).toBeTruthy();
      expect(t.title).toBeTruthy();
      expect(t.summary).toBeTruthy();
      expect(Array.isArray(t.keywords)).toBe(true);
    }
  });

  it('searchHelpTopics returns all for empty query', () => {
    expect(searchHelpTopics('').length).toBe(HELP_TOPICS.length);
  });

  it('searchHelpTopics finds wall topic', () => {
    const results = searchHelpTopics('wall');
    expect(results.some((t) => t.id === 'wall')).toBe(true);
  });

  it('searchHelpTopics returns empty for unknown query', () => {
    const results = searchHelpTopics('xyznonexistent999');
    expect(results.length).toBe(0);
  });
});
