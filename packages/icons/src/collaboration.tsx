/**
 * Collaboration & project management icons.
 *
 * Covers worksharing operations (reload, editing request), monitoring
 * (copy/monitor, coordination review), project cleanup (purge unused),
 * standards transfer, and project settings (info, parameters, styles).
 */
import { bimIcon } from './icon';

// ── Reload latest: circular refresh/reload arrows ────────────────────────────
export const ReloadLatestIcon = bimIcon(
  'ReloadLatestIcon',
  <path d="M4 12A8 8 0 0 1 20 8 M20 8L17 5L20 8H17 M20 12A8 8 0 0 1 4 16 M4 16L7 19L4 16H7" />,
);

// ── Editing request: locked document with pencil — request to own element ─────
export const EditingRequestIcon = bimIcon(
  'EditingRequestIcon',
  <>
    <path d="M4 3H16V21H4z M8 8H12 M8 12H12 M8 16H12" />
    <path d="M17 3L21 7L14 14L11 15L12 12z" />
  </>,
);

// ── Copy/monitor: two elements linked by a monitoring connection ──────────────
export const CopyMonitorIcon = bimIcon(
  'CopyMonitorIcon',
  <path d="M3 8H11V16H3z M13 4H21V12H13z M11 12L13 8" />,
);

// ── Coordination review: flagged items with review check mark ────────────────
export const CoordinationReviewIcon = bimIcon(
  'CoordinationReviewIcon',
  <>
    <path d="M4 3H20V21H4z" />
    <path d="M8 8H14 M8 12H14 M8 16H14" />
    <path d="M16 8L18 10L22 6" />
  </>,
);

// ── Purge unused: trash can with sweep lines indicating cleanup ───────────────
export const PurgeUnusedIcon = bimIcon(
  'PurgeUnusedIcon',
  <path d="M9 3H15 M5 6H19 M6 6L7 21H17L18 6 M3 12L8 8 M5 10L10 6" />,
);

// ── Transfer project standards: arrow moving settings between two documents ───
export const TransferProjectStandardsIcon = bimIcon(
  'TransferProjectStandardsIcon',
  <path d="M3 5H11V19H3z M13 5H21V19H13z M11 12H13 M14 10L16 12L14 14" />,
);

// ── Project info: building outline with information indicator ─────────────────
export const ProjectInfoIcon = bimIcon(
  'ProjectInfoIcon',
  <>
    <path d="M4 21H16V10H10V7L13 4L16 7V10H16V21" />
    <circle cx="19" cy="6" r="3" />
    <path d="M19 5V5 M19 7V9" />
  </>,
);

// ── Project parameters: settings document with key–value parameter rows ───────
export const ProjectParametersIcon = bimIcon(
  'ProjectParametersIcon',
  <path d="M4 3H20V21H4z M8 8H11 M13 8H18 M8 12H10 M12 12H18 M8 16H11 M13 16H18" />,
);

// ── Shared parameters: two overlapping documents sharing a common file ────────
export const SharedParametersIcon = bimIcon(
  'SharedParametersIcon',
  <path d="M3 4H13V18H3z M11 4V18 M11 8H19V22H9V18H11" />,
);

// ── Object styles: three stacked style bars representing element style rules ──
export const ObjectStylesIcon = bimIcon(
  'ObjectStylesIcon',
  <path d="M3 5H21V9H3z M3 11H21V15H3z M3 17H21V21H3z" />,
);
