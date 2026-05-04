import { describe, expect, it } from 'vitest';

import { extractPlanAnnotationHints } from './planProjectionWire';

describe('extractPlanAnnotationHints', () => {
  it('defaults both flags false when absent', () => {
    expect(extractPlanAnnotationHints(undefined)).toEqual({
      openingTagsVisible: false,
      roomLabelsVisible: false,
    });
    expect(extractPlanAnnotationHints({})).toEqual({
      openingTagsVisible: false,
      roomLabelsVisible: false,
    });
  });

  it('reads camelCase and snake_case', () => {
    expect(
      extractPlanAnnotationHints({
        planAnnotationHints: { openingTagsVisible: true, roomLabelsVisible: false },
      }),
    ).toEqual({ openingTagsVisible: true, roomLabelsVisible: false });
    expect(
      extractPlanAnnotationHints({
        plan_annotation_hints: { opening_tags_visible: 'true', room_labels_visible: false },
      }),
    ).toEqual({ openingTagsVisible: true, roomLabelsVisible: false });
  });
});
