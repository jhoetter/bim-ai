import type * as React from 'react';

export {
  Icons,
  IconLabels,
  ICON_SIZE,
  StairsIcon,
  type BimIconComponent,
  type IconName,
  // BIM-native icons (all phases)
  WallIcon,
  DoorIcon,
  WindowIcon,
  FloorIcon,
  RoofIcon,
  StairIcon,
  RailingIcon,
  RoomIcon,
  DimensionIcon,
  SectionIcon,
  TagIcon,
  CurtainWallIcon,
  ColumnIcon,
  BeamIcon,
  PlanViewIcon,
  SectionViewIcon,
  ElevationViewIcon,
  OrbitViewIcon,
  SheetIcon,
  ScheduleViewIcon,
  CalloutIcon,
  ViewpointIcon,
  SectionBoxIcon,
  GridLineIcon,
  LevelIcon,
  DetailLineIcon,
  FamilyIcon,
  FamilyTypeIcon,
  GroupIcon,
  AssemblyIcon,
  LinkedModelIcon,
  MaterialIcon,
  WallLayerIcon,
  PhaseIcon,
  IssueIcon,
  ClashIcon,
  ValidationRuleIcon,
  DeviationIcon,
} from './icons';

export function Panel(props: React.PropsWithChildren<{ title: string }>) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-3 shadow-sm">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">
        {props.title}
      </div>
      <div className="text-sm">{props.children}</div>
    </div>
  );
}

export function Btn({
  variant,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'quiet' }) {
  const quiet = variant === 'quiet';
  return (
    <button
      {...props}
      className={[
        'rounded-md px-3 py-1 text-sm outline-none ring-ring transition-colors',
        quiet
          ? 'bg-transparent text-accent hover:bg-background'
          : 'bg-accent text-accent-foreground hover:opacity-90',
        className ?? '',
      ]
        .filter(Boolean)
        .join(' ')}
    />
  );
}

/**
 * HofOS embed host contract version.
 *
 * Previously lived in `@bim-ai/hofos-ui`, which was a thin re-export package
 * over `@bim-ai/ui` + `@bim-ai/design-tokens`. Folded into `@bim-ai/ui` in
 * ARCH-CQ-04 so external consumers can pull the embed contract and UI
 * primitives from a single package via subpath exports.
 */
export const BIM_HOFOS_UI_EMBED_VERSION = '0.1.0';
