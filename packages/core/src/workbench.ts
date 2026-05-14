/** UI workbench presets — shared types for layouts and discipline perspectives */

export type WorkspaceLayoutPreset =
  | 'classic'
  /** Plan + orthographic 3D side-by-side */
  | 'split_plan_3d'
  /** Plan with section/elevation placeholder pane */
  | 'split_plan_section'
  /** Emphasizes issues/advisor/coord reads */
  | 'coordination'
  /** Room schedule beside plan */
  | 'schedules_focus'
  /** Schema summary + validation context for agents */
  | 'agent_review';

/** Discipline filter for Advisor and future toolbars — matches server violation tagging when present */
export type PerspectiveId =
  | 'architecture'
  | 'structure'
  | 'mep'
  | 'coordination'
  | 'fire-safety'
  | 'construction'
  /** Show all advisory rows */
  | 'agent';
