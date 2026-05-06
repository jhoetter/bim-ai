import { useState, useMemo, useCallback } from 'react';
import type { BimIcon } from '@bim-ai/icons';
import {
  WallIcon, DoorIcon, WindowIcon, FloorIcon, RoofIcon, StairIcon, RailingIcon,
  RoomIcon, DimensionIcon, SectionIcon, TagIcon, CurtainWallIcon, ColumnIcon, BeamIcon,
  PlanViewIcon, SectionViewIcon, ElevationViewIcon, OrbitViewIcon, SheetIcon,
  ScheduleViewIcon, CalloutIcon, ViewpointIcon, SectionBoxIcon, GridLineIcon,
  LevelIcon, DetailLineIcon,
  FamilyIcon, FamilyTypeIcon, GroupIcon, AssemblyIcon, LinkedModelIcon, MaterialIcon,
  WallLayerIcon, PhaseIcon, IssueIcon, ClashIcon, ValidationRuleIcon, DeviationIcon,
  DuctRectIcon, DuctRoundIcon, PipeIcon, CableTrayIcon, ConduitIcon,
  MechanicalEquipmentIcon, PlumbingFixtureIcon, LightingFixtureIcon,
  ElectricalPanelIcon, FireSprinklerIcon, DiffuserIcon, MepSpaceIcon,
  FoundationIcon, StripFootingIcon, TrussIcon, BraceIcon, RebarIcon,
  StructuralConnectionIcon,
  CeilingIcon, OpeningIcon, ShaftOpeningIcon, RampIcon, MassIcon, CurtainPanelIcon,
  MullionIcon, SkyLightIcon, PartitionIcon,
  TopoIcon, PropertyLineIcon, ParkingSpaceIcon, PlantingIcon, RoadIcon,
  RetainingWallIcon, NorthArrowIcon,
  RevisionCloudIcon, BreakLineIcon, CentreLineIcon, KeynoteIcon, MatchLineIcon,
  ScaleBarIcon, AreaLabelIcon, SpotElevationIcon, SlopeArrowIcon,
  WorksetIcon, DesignOptionIcon, RevisionIcon, RFIIcon, SubmittalIcon,
  PointCloudIcon, DigitalTwinIcon, SyncIcon, TransmittalIcon, IFCIcon,
  LODIcon, QuantityTakeoffIcon, EnergyModelIcon, ScopeBoxIcon,
  MirrorIcon, ArrayLinearIcon, ArrayRadialIcon, AlignIcon, SplitIcon,
  TrimExtendIcon, VoidIcon, PinIcon, UnpinIcon,
} from '@bim-ai/icons';

type IconEntry = { name: string; export: string; Icon: BimIcon };
type Section = { label: string; icons: IconEntry[] };

const SECTIONS: Section[] = [
  {
    label: 'Drawing tools',
    icons: [
      { name: 'Wall', export: 'WallIcon', Icon: WallIcon },
      { name: 'Door', export: 'DoorIcon', Icon: DoorIcon },
      { name: 'Window', export: 'WindowIcon', Icon: WindowIcon },
      { name: 'Floor', export: 'FloorIcon', Icon: FloorIcon },
      { name: 'Roof', export: 'RoofIcon', Icon: RoofIcon },
      { name: 'Stair', export: 'StairIcon', Icon: StairIcon },
      { name: 'Railing', export: 'RailingIcon', Icon: RailingIcon },
      { name: 'Room', export: 'RoomIcon', Icon: RoomIcon },
      { name: 'Dimension', export: 'DimensionIcon', Icon: DimensionIcon },
      { name: 'Section', export: 'SectionIcon', Icon: SectionIcon },
      { name: 'Tag', export: 'TagIcon', Icon: TagIcon },
      { name: 'Curtain wall', export: 'CurtainWallIcon', Icon: CurtainWallIcon },
      { name: 'Column', export: 'ColumnIcon', Icon: ColumnIcon },
      { name: 'Beam', export: 'BeamIcon', Icon: BeamIcon },
    ],
  },
  {
    label: 'Architectural',
    icons: [
      { name: 'Ceiling', export: 'CeilingIcon', Icon: CeilingIcon },
      { name: 'Opening', export: 'OpeningIcon', Icon: OpeningIcon },
      { name: 'Shaft opening', export: 'ShaftOpeningIcon', Icon: ShaftOpeningIcon },
      { name: 'Ramp', export: 'RampIcon', Icon: RampIcon },
      { name: 'Mass', export: 'MassIcon', Icon: MassIcon },
      { name: 'Curtain panel', export: 'CurtainPanelIcon', Icon: CurtainPanelIcon },
      { name: 'Mullion', export: 'MullionIcon', Icon: MullionIcon },
      { name: 'Skylight', export: 'SkyLightIcon', Icon: SkyLightIcon },
      { name: 'Partition', export: 'PartitionIcon', Icon: PartitionIcon },
    ],
  },
  {
    label: 'MEP',
    icons: [
      { name: 'Duct (rect)', export: 'DuctRectIcon', Icon: DuctRectIcon },
      { name: 'Duct (round)', export: 'DuctRoundIcon', Icon: DuctRoundIcon },
      { name: 'Pipe', export: 'PipeIcon', Icon: PipeIcon },
      { name: 'Cable tray', export: 'CableTrayIcon', Icon: CableTrayIcon },
      { name: 'Conduit', export: 'ConduitIcon', Icon: ConduitIcon },
      { name: 'Mech. equipment', export: 'MechanicalEquipmentIcon', Icon: MechanicalEquipmentIcon },
      { name: 'Plumbing fixture', export: 'PlumbingFixtureIcon', Icon: PlumbingFixtureIcon },
      { name: 'Lighting fixture', export: 'LightingFixtureIcon', Icon: LightingFixtureIcon },
      { name: 'Electrical panel', export: 'ElectricalPanelIcon', Icon: ElectricalPanelIcon },
      { name: 'Fire sprinkler', export: 'FireSprinklerIcon', Icon: FireSprinklerIcon },
      { name: 'Diffuser', export: 'DiffuserIcon', Icon: DiffuserIcon },
      { name: 'MEP space', export: 'MepSpaceIcon', Icon: MepSpaceIcon },
    ],
  },
  {
    label: 'Structural',
    icons: [
      { name: 'Foundation', export: 'FoundationIcon', Icon: FoundationIcon },
      { name: 'Strip footing', export: 'StripFootingIcon', Icon: StripFootingIcon },
      { name: 'Truss', export: 'TrussIcon', Icon: TrussIcon },
      { name: 'Brace', export: 'BraceIcon', Icon: BraceIcon },
      { name: 'Rebar', export: 'RebarIcon', Icon: RebarIcon },
      { name: 'Struct. connection', export: 'StructuralConnectionIcon', Icon: StructuralConnectionIcon },
    ],
  },
  {
    label: 'Views & annotations',
    icons: [
      { name: 'Plan view', export: 'PlanViewIcon', Icon: PlanViewIcon },
      { name: 'Section view', export: 'SectionViewIcon', Icon: SectionViewIcon },
      { name: 'Elevation view', export: 'ElevationViewIcon', Icon: ElevationViewIcon },
      { name: '3D / orbit', export: 'OrbitViewIcon', Icon: OrbitViewIcon },
      { name: 'Sheet', export: 'SheetIcon', Icon: SheetIcon },
      { name: 'Schedule', export: 'ScheduleViewIcon', Icon: ScheduleViewIcon },
      { name: 'Callout', export: 'CalloutIcon', Icon: CalloutIcon },
      { name: 'Viewpoint', export: 'ViewpointIcon', Icon: ViewpointIcon },
      { name: 'Section box', export: 'SectionBoxIcon', Icon: SectionBoxIcon },
      { name: 'Grid line', export: 'GridLineIcon', Icon: GridLineIcon },
      { name: 'Level', export: 'LevelIcon', Icon: LevelIcon },
      { name: 'Detail line', export: 'DetailLineIcon', Icon: DetailLineIcon },
    ],
  },
  {
    label: 'Annotation & documentation',
    icons: [
      { name: 'Revision cloud', export: 'RevisionCloudIcon', Icon: RevisionCloudIcon },
      { name: 'Break line', export: 'BreakLineIcon', Icon: BreakLineIcon },
      { name: 'Centre line', export: 'CentreLineIcon', Icon: CentreLineIcon },
      { name: 'Keynote', export: 'KeynoteIcon', Icon: KeynoteIcon },
      { name: 'Match line', export: 'MatchLineIcon', Icon: MatchLineIcon },
      { name: 'Scale bar', export: 'ScaleBarIcon', Icon: ScaleBarIcon },
      { name: 'Area label', export: 'AreaLabelIcon', Icon: AreaLabelIcon },
      { name: 'Spot elevation', export: 'SpotElevationIcon', Icon: SpotElevationIcon },
      { name: 'Slope arrow', export: 'SlopeArrowIcon', Icon: SlopeArrowIcon },
    ],
  },
  {
    label: 'Site & civil',
    icons: [
      { name: 'Topography', export: 'TopoIcon', Icon: TopoIcon },
      { name: 'Property line', export: 'PropertyLineIcon', Icon: PropertyLineIcon },
      { name: 'Parking space', export: 'ParkingSpaceIcon', Icon: ParkingSpaceIcon },
      { name: 'Planting / tree', export: 'PlantingIcon', Icon: PlantingIcon },
      { name: 'Road', export: 'RoadIcon', Icon: RoadIcon },
      { name: 'Retaining wall', export: 'RetainingWallIcon', Icon: RetainingWallIcon },
      { name: 'North arrow', export: 'NorthArrowIcon', Icon: NorthArrowIcon },
    ],
  },
  {
    label: 'Organization & coordination',
    icons: [
      { name: 'Family', export: 'FamilyIcon', Icon: FamilyIcon },
      { name: 'Family type', export: 'FamilyTypeIcon', Icon: FamilyTypeIcon },
      { name: 'Group', export: 'GroupIcon', Icon: GroupIcon },
      { name: 'Assembly', export: 'AssemblyIcon', Icon: AssemblyIcon },
      { name: 'Linked model', export: 'LinkedModelIcon', Icon: LinkedModelIcon },
      { name: 'Material', export: 'MaterialIcon', Icon: MaterialIcon },
      { name: 'Wall layer', export: 'WallLayerIcon', Icon: WallLayerIcon },
      { name: 'Phase', export: 'PhaseIcon', Icon: PhaseIcon },
      { name: 'Issue', export: 'IssueIcon', Icon: IssueIcon },
      { name: 'Clash', export: 'ClashIcon', Icon: ClashIcon },
      { name: 'Validation rule', export: 'ValidationRuleIcon', Icon: ValidationRuleIcon },
      { name: 'Deviation', export: 'DeviationIcon', Icon: DeviationIcon },
    ],
  },
  {
    label: 'Workflow & data',
    icons: [
      { name: 'Workset', export: 'WorksetIcon', Icon: WorksetIcon },
      { name: 'Design option', export: 'DesignOptionIcon', Icon: DesignOptionIcon },
      { name: 'Revision', export: 'RevisionIcon', Icon: RevisionIcon },
      { name: 'RFI', export: 'RFIIcon', Icon: RFIIcon },
      { name: 'Submittal', export: 'SubmittalIcon', Icon: SubmittalIcon },
      { name: 'Point cloud', export: 'PointCloudIcon', Icon: PointCloudIcon },
      { name: 'Digital twin', export: 'DigitalTwinIcon', Icon: DigitalTwinIcon },
      { name: 'Sync', export: 'SyncIcon', Icon: SyncIcon },
      { name: 'Transmittal', export: 'TransmittalIcon', Icon: TransmittalIcon },
      { name: 'IFC', export: 'IFCIcon', Icon: IFCIcon },
      { name: 'LOD', export: 'LODIcon', Icon: LODIcon },
      { name: 'Qty takeoff', export: 'QuantityTakeoffIcon', Icon: QuantityTakeoffIcon },
      { name: 'Energy model', export: 'EnergyModelIcon', Icon: EnergyModelIcon },
      { name: 'Scope box', export: 'ScopeBoxIcon', Icon: ScopeBoxIcon },
    ],
  },
  {
    label: 'Edit operations',
    icons: [
      { name: 'Mirror', export: 'MirrorIcon', Icon: MirrorIcon },
      { name: 'Array (linear)', export: 'ArrayLinearIcon', Icon: ArrayLinearIcon },
      { name: 'Array (radial)', export: 'ArrayRadialIcon', Icon: ArrayRadialIcon },
      { name: 'Align', export: 'AlignIcon', Icon: AlignIcon },
      { name: 'Split', export: 'SplitIcon', Icon: SplitIcon },
      { name: 'Trim / extend', export: 'TrimExtendIcon', Icon: TrimExtendIcon },
      { name: 'Void', export: 'VoidIcon', Icon: VoidIcon },
      { name: 'Pin', export: 'PinIcon', Icon: PinIcon },
      { name: 'Unpin', export: 'UnpinIcon', Icon: UnpinIcon },
    ],
  },
];

const ALL_ICONS = SECTIONS.flatMap((s) => s.icons);

const SIZES = [16, 18, 20, 24, 32] as const;
type Size = (typeof SIZES)[number];

const STROKE_WIDTHS = [1, 1.5, 2] as const;
type StrokeWidth = (typeof STROKE_WIDTHS)[number];

function IconCard({
  entry,
  size,
  strokeWidth,
}: {
  entry: IconEntry;
  size: Size;
  strokeWidth: StrokeWidth;
}) {
  const [copied, setCopied] = useState(false);

  const handleClick = useCallback(() => {
    const text = `import { ${entry.export} } from '@bim-ai/icons'`;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    });
  }, [entry.export]);

  return (
    <button
      onClick={handleClick}
      title={`Click to copy import for ${entry.export}`}
      className="group relative flex flex-col items-center gap-2 rounded-lg border border-border bg-surface p-4 text-center transition-all hover:border-accent hover:bg-accent-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      {copied && (
        <span className="absolute inset-0 flex items-center justify-center rounded-lg bg-accent text-xs font-medium text-accent-foreground">
          Copied!
        </span>
      )}
      <entry.Icon
        size={size}
        strokeWidth={strokeWidth}
        className="text-foreground transition-colors group-hover:text-accent"
      />
      <span className="max-w-full truncate text-[11px] text-muted-foreground">{entry.name}</span>
      <span className="absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-foreground px-1.5 py-0.5 font-mono text-[10px] text-background opacity-0 transition-opacity group-hover:opacity-100">
        {entry.export}
      </span>
    </button>
  );
}

export function IconGallery() {
  const [query, setQuery] = useState('');
  const [size, setSize] = useState<Size>(24);
  const [strokeWidth, setStrokeWidth] = useState<StrokeWidth>(1.5);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return null;
    return ALL_ICONS.filter(
      (e) => e.name.toLowerCase().includes(q) || e.export.toLowerCase().includes(q),
    );
  }, [query]);

  const totalCount = ALL_ICONS.length;

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* sticky header */}
      <div className="sticky top-0 z-10 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto max-w-5xl px-6 py-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-base font-semibold">@bim-ai/icons</h1>
              <p className="text-[11px] text-muted-foreground">{totalCount} BIM-native icons</p>
            </div>

            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search icons…"
              className="h-8 w-56 rounded-md border border-border bg-surface px-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent"
            />

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-muted-foreground">size</span>
                <div className="flex rounded-md border border-border">
                  {SIZES.map((s, i) => (
                    <button
                      key={s}
                      onClick={() => setSize(s)}
                      className={[
                        'px-2 py-0.5 text-[11px] font-mono transition-colors',
                        s === size ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground',
                        i === 0 ? 'rounded-l-sm' : '',
                        i === SIZES.length - 1 ? 'rounded-r-sm' : '',
                      ].filter(Boolean).join(' ')}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-muted-foreground">stroke</span>
                <div className="flex rounded-md border border-border">
                  {STROKE_WIDTHS.map((sw, i) => (
                    <button
                      key={sw}
                      onClick={() => setStrokeWidth(sw)}
                      className={[
                        'px-2 py-0.5 text-[11px] font-mono transition-colors',
                        sw === strokeWidth ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground',
                        i === 0 ? 'rounded-l-sm' : '',
                        i === STROKE_WIDTHS.length - 1 ? 'rounded-r-sm' : '',
                      ].filter(Boolean).join(' ')}
                    >
                      {sw}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-6 py-8">
        {filtered !== null ? (
          <div>
            <p className="mb-4 text-[11px] text-muted-foreground">
              {filtered.length === 0
                ? 'No icons match.'
                : `${filtered.length} result${filtered.length === 1 ? '' : 's'}`}
            </p>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(100px,1fr))] gap-2">
              {filtered.map((entry) => (
                <IconCard key={entry.export} entry={entry} size={size} strokeWidth={strokeWidth} />
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-10">
            {SECTIONS.map((section) => (
              <section key={section.label}>
                <div className="mb-3 flex items-center gap-3">
                  <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                    {section.label}
                  </h2>
                  <span className="text-[11px] text-muted-foreground/60">{section.icons.length}</span>
                </div>
                <div className="grid grid-cols-[repeat(auto-fill,minmax(100px,1fr))] gap-2">
                  {section.icons.map((entry) => (
                    <IconCard key={entry.export} entry={entry} size={size} strokeWidth={strokeWidth} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}

        <div className="mt-12 rounded-lg border border-border bg-surface p-5">
          <p className="mb-2 text-xs font-semibold text-muted-foreground">Usage</p>
          <pre className="overflow-x-auto rounded bg-surface-strong p-3 font-mono text-[12px] text-foreground">
            {`import { WallIcon, DuctRectIcon, FoundationIcon } from '@bim-ai/icons'\n\n<WallIcon size={18} strokeWidth={1.5} className="text-stone-600" />`}
          </pre>
          <p className="mt-3 text-[11px] text-muted-foreground">
            Click any icon to copy its import statement. All icons accept{' '}
            <code className="rounded bg-surface-strong px-1 font-mono">size</code>,{' '}
            <code className="rounded bg-surface-strong px-1 font-mono">strokeWidth</code>, and any SVG attribute.
          </p>
        </div>
      </div>
    </div>
  );
}
