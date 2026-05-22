import type { XY } from '../index';

/**
 * TH-X-F006: source-derived view evidence attached to a section_cut /
 * elevation_view / detail (callout plan_view). Joins to the view by
 * viewElementId; status drives the project-browser evidence pill.
 */
export type SourceViewEvidenceElement = {
  kind: 'source_view_evidence';
  id: string;
  viewElementId: string;
  /**
   * Which sidebar category the view sits in. Drives the pill icon and
   * helps the project-browser dedupe one evidence row per view.
   */
  category: 'exterior' | 'detail' | 'section';
  status:
    | 'missing_source_link'
    | 'source_linked'
    | 'screenshot_captured'
    | 'overlay_compared'
    | 'findings_open'
    | 'accepted';
  sourceDocumentId?: string | null;
  sourcePage?: number | null;
  /** Optional page-region polygon in page-pixel or normalized coords. */
  sourceRegion?: XY[] | null;
  comparisonType?: 'overlay' | 'screenshot' | 'side_by_side' | 'not_applicable' | null;
  screenshotPath?: string | null;
  overlayPath?: string | null;
  findingIds?: string[];
  notes?: string | null;
  updatedAt?: string | null;
};
