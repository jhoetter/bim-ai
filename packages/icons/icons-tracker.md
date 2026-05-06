# @bim-ai/icons — Revit Coverage Tracker

Tracks every icon concept in Autodesk Revit against the `@bim-ai/icons` library.
✓ = implemented · ✗ = missing (not yet implemented)

Last updated: 2026-05-06 · Total icons: 218

---

## Architecture

| Revit concept            | Status | Export name           | File                   |
| ------------------------ | ------ | --------------------- | ---------------------- |
| Wall                     | ✓      | `WallIcon`            | tools                  |
| Door                     | ✓      | `DoorIcon`            | tools                  |
| Window                   | ✓      | `WindowIcon`          | tools                  |
| Floor (slab)             | ✓      | `FloorIcon`           | tools                  |
| Roof by footprint        | ✓      | `RoofIcon`            | tools                  |
| Stair                    | ✓      | `StairIcon`           | tools                  |
| Railing                  | ✓      | `RailingIcon`         | tools                  |
| Room                     | ✓      | `RoomIcon`            | tools                  |
| Curtain wall             | ✓      | `CurtainWallIcon`     | tools                  |
| Column (arch.)           | ✓      | `ColumnIcon`          | tools                  |
| Ceiling                  | ✓      | `CeilingIcon`         | architectural          |
| Opening (wall/floor)     | ✓      | `OpeningIcon`         | architectural          |
| Shaft opening            | ✓      | `ShaftOpeningIcon`    | architectural          |
| Ramp                     | ✓      | `RampIcon`            | architectural          |
| Conceptual mass          | ✓      | `MassIcon`            | architectural          |
| Curtain panel            | ✓      | `CurtainPanelIcon`    | architectural          |
| Mullion                  | ✓      | `MullionIcon`         | architectural          |
| Skylight                 | ✓      | `SkyLightIcon`        | architectural          |
| Partition wall           | ✓      | `PartitionIcon`       | architectural          |
| Wall sweep               | ✓      | `WallSweepIcon`       | architectural-extended |
| Wall reveal              | ✓      | `WallRevealIcon`      | architectural-extended |
| Component (generic)      | ✓      | `ComponentIcon`       | architectural-extended |
| Roof by extrusion        | ✓      | `RoofExtrusionIcon`   | architectural-extended |
| Roof soffit              | ✓      | `RoofSoffitIcon`      | architectural-extended |
| Fascia                   | ✓      | `FasciaIcon`          | architectural-extended |
| Gutter                   | ✓      | `GutterIcon`          | architectural-extended |
| Curtain system           | ✓      | `CurtainSystemIcon`   | architectural-extended |
| Curtain grid             | ✓      | `CurtainGridIcon`     | architectural-extended |
| Vertical opening (floor) | ✓      | `VerticalOpeningIcon` | architectural-extended |
| Dormer opening           | ✓      | `DormerOpeningIcon`   | architectural-extended |
| Face-based opening       | ✓      | `FaceOpeningIcon`     | architectural-extended |
| Room separator           | ✓      | `RoomSeparatorIcon`   | architectural-extended |
| Area boundary            | ✓      | `AreaBoundaryIcon`    | architectural-extended |
| Reference plane          | ✓      | `ReferencePlaneIcon`  | architectural-extended |
| Work plane               | ✓      | `WorkPlaneIcon`       | architectural-extended |
| Model line               | ✓      | `ModelLineIcon`       | architectural-extended |
| Model text               | ✓      | `ModelTextIcon`       | architectural-extended |
| Stair path               | ✓      | `StairPathIcon`       | architectural-extended |

---

## Structural

| Revit concept             | Status | Export name                | File                |
| ------------------------- | ------ | -------------------------- | ------------------- |
| Structural column         | ✓      | `ColumnIcon`               | tools               |
| Beam / framing            | ✓      | `BeamIcon`                 | tools               |
| Foundation (isolated)     | ✓      | `FoundationIcon`           | structural          |
| Strip footing             | ✓      | `StripFootingIcon`         | structural          |
| Truss                     | ✓      | `TrussIcon`                | structural          |
| Brace                     | ✓      | `BraceIcon`                | structural          |
| Rebar (bar reinforcement) | ✓      | `RebarIcon`                | structural          |
| Structural connection     | ✓      | `StructuralConnectionIcon` | structural          |
| Beam system               | ✓      | `BeamSystemIcon`           | structural-extended |
| Foundation slab (mat)     | ✓      | `FoundationSlabIcon`       | structural-extended |
| Slab edge                 | ✓      | `SlabEdgeIcon`             | structural-extended |
| Area reinforcement        | ✓      | `AreaReinforcementIcon`    | structural-extended |
| Path reinforcement        | ✓      | `PathReinforcementIcon`    | structural-extended |
| Fabric sheet (mesh)       | ✓      | `FabricSheetIcon`          | structural-extended |
| Shear stud                | ✓      | `ShearStudIcon`            | structural-extended |
| Anchor                    | ✓      | `AnchorIcon`               | structural-extended |
| Bolt                      | ✓      | `BoltIcon`                 | structural-extended |
| Weld                      | ✓      | `WeldIcon`                 | structural-extended |
| Analytical node           | ✓      | `AnalyticalNodeIcon`       | structural-extended |
| Structural load           | ✓      | `StructuralLoadIcon`       | structural-extended |
| Boundary condition        | ✓      | `BoundaryConditionIcon`    | structural-extended |

---

## MEP

| Revit concept               | Status | Export name               | File         |
| --------------------------- | ------ | ------------------------- | ------------ |
| Duct (rectangular)          | ✓      | `DuctRectIcon`            | mep          |
| Duct (round)                | ✓      | `DuctRoundIcon`           | mep          |
| Pipe                        | ✓      | `PipeIcon`                | mep          |
| Cable tray                  | ✓      | `CableTrayIcon`           | mep          |
| Conduit                     | ✓      | `ConduitIcon`             | mep          |
| Mechanical equipment        | ✓      | `MechanicalEquipmentIcon` | mep          |
| Plumbing fixture            | ✓      | `PlumbingFixtureIcon`     | mep          |
| Lighting fixture            | ✓      | `LightingFixtureIcon`     | mep          |
| Electrical panel            | ✓      | `ElectricalPanelIcon`     | mep          |
| Fire sprinkler              | ✓      | `FireSprinklerIcon`       | mep          |
| Diffuser / air terminal     | ✓      | `DiffuserIcon`            | mep          |
| MEP space                   | ✓      | `MepSpaceIcon`            | mep          |
| Flex duct                   | ✓      | `FlexDuctIcon`            | mep-extended |
| Duct fitting                | ✓      | `DuctFittingIcon`         | mep-extended |
| Duct accessory              | ✓      | `DuctAccessoryIcon`       | mep-extended |
| Duct insulation             | ✓      | `DuctInsulationIcon`      | mep-extended |
| Duct lining                 | ✓      | `DuctLiningIcon`          | mep-extended |
| Flex pipe                   | ✓      | `FlexPipeIcon`            | mep-extended |
| Pipe fitting                | ✓      | `PipeFittingIcon`         | mep-extended |
| Pipe accessory              | ✓      | `PipeAccessoryIcon`       | mep-extended |
| Pipe insulation             | ✓      | `PipeInsulationIcon`      | mep-extended |
| Cable tray fitting          | ✓      | `CableTrayFittingIcon`    | mep-extended |
| Conduit fitting             | ✓      | `ConduitFittingIcon`      | mep-extended |
| Electrical wire             | ✓      | `ElectricalWireIcon`      | mep-extended |
| Switch system               | ✓      | `SwitchSystemIcon`        | mep-extended |
| Lighting switch             | ✓      | `LightingSwitchIcon`      | mep-extended |
| Communication device        | ✓      | `CommunicationDeviceIcon` | mep-extended |
| Fire alarm device           | ✓      | `FireAlarmDeviceIcon`     | mep-extended |
| Data device                 | ✓      | `DataDeviceIcon`          | mep-extended |
| Nurse call                  | ✓      | `NurseCallIcon`           | mep-extended |
| Security device (camera)    | ✓      | `SecurityDeviceIcon`      | mep-extended |
| HVAC zone                   | ✓      | `HVACZoneIcon`            | mep-extended |
| Panel schedule (electrical) | ✓      | `PanelScheduleIcon`       | mep-extended |
| Duct system                 | ✓      | `DuctSystemIcon`          | mep-extended |
| Piping system               | ✓      | `PipingSystemIcon`        | mep-extended |
| Valve                       | ✓      | `ValveIcon`               | mep-extended |

---

## Views

| Revit concept             | Status | Export name                   | File           |
| ------------------------- | ------ | ----------------------------- | -------------- |
| Floor plan                | ✓      | `PlanViewIcon`                | views          |
| Section view              | ✓      | `SectionViewIcon`             | views          |
| Elevation view            | ✓      | `ElevationViewIcon`           | views          |
| 3D / orbit view           | ✓      | `OrbitViewIcon`               | views          |
| Sheet                     | ✓      | `SheetIcon`                   | views          |
| Schedule                  | ✓      | `ScheduleViewIcon`            | views          |
| Callout                   | ✓      | `CalloutIcon`                 | views          |
| Viewpoint (camera)        | ✓      | `ViewpointIcon`               | views          |
| Section box (3D)          | ✓      | `SectionBoxIcon`              | views          |
| Grid line                 | ✓      | `GridLineIcon`                | views          |
| Level                     | ✓      | `LevelIcon`                   | views          |
| Detail line               | ✓      | `DetailLineIcon`              | views          |
| Reflected ceiling plan    | ✓      | `ReflectedCeilingPlanIcon`    | views-extended |
| Structural framing plan   | ✓      | `StructuralPlanIcon`          | views-extended |
| Area plan                 | ✓      | `AreaPlanIcon`                | views-extended |
| Detail view               | ✓      | `DetailViewIcon`              | views-extended |
| Drafting view             | ✓      | `DraftingViewIcon`            | views-extended |
| Walkthrough               | ✓      | `WalkthroughIcon`             | views-extended |
| Legend                    | ✓      | `LegendIcon`                  | views-extended |
| Sheet list                | ✓      | `SheetListIcon`               | views-extended |
| Note block                | ✓      | `NoteBlockIcon`               | views-extended |
| View list                 | ✓      | `ViewListIcon`                | views-extended |
| Panel schedule view       | ✓      | `PanelScheduleViewIcon`       | views-extended |
| Graphical column schedule | ✓      | `GraphicalColumnScheduleIcon` | views-extended |
| View reference            | ✓      | `ViewReferenceIcon`           | views-extended |

---

## Annotation & Documentation

| Revit concept         | Status | Export name                | File                |
| --------------------- | ------ | -------------------------- | ------------------- |
| Linear dimension      | ✓      | `DimensionIcon`            | tools               |
| Section annotation    | ✓      | `SectionIcon`              | tools               |
| Tag (generic)         | ✓      | `TagIcon`                  | tools               |
| Revision cloud        | ✓      | `RevisionCloudIcon`        | annotation          |
| Break line            | ✓      | `BreakLineIcon`            | annotation          |
| Centre line           | ✓      | `CentreLineIcon`           | annotation          |
| Keynote               | ✓      | `KeynoteIcon`              | annotation          |
| Match line            | ✓      | `MatchLineIcon`            | annotation          |
| Scale bar             | ✓      | `ScaleBarIcon`             | annotation          |
| Area label            | ✓      | `AreaLabelIcon`            | annotation          |
| Spot elevation        | ✓      | `SpotElevationIcon`        | annotation          |
| Slope arrow           | ✓      | `SlopeArrowIcon`           | annotation          |
| Angular dimension     | ✓      | `AngularDimensionIcon`     | annotation-extended |
| Radial dimension      | ✓      | `RadialDimensionIcon`      | annotation-extended |
| Arc length dimension  | ✓      | `ArcLengthDimensionIcon`   | annotation-extended |
| Ordinal dimension     | ✓      | `OrdinalDimensionIcon`     | annotation-extended |
| Spot coordinate       | ✓      | `SpotCoordinateIcon`       | annotation-extended |
| Elevation tag         | ✓      | `ElevationTagIcon`         | annotation-extended |
| Filled region         | ✓      | `FilledRegionIcon`         | annotation-extended |
| Masking region        | ✓      | `MaskingRegionIcon`        | annotation-extended |
| Detail component      | ✓      | `DetailComponentIcon`      | annotation-extended |
| Repeating detail      | ✓      | `RepeatingDetailIcon`      | annotation-extended |
| Insulation annotation | ✓      | `InsulationAnnotationIcon` | annotation-extended |
| Text (annotation)     | ✓      | `TextAnnotationIcon`       | annotation-extended |
| Multi-category tag    | ✓      | `MultiCategoryTagIcon`     | annotation-extended |
| Material tag          | ✓      | `MaterialTagIcon`          | annotation-extended |
| Room tag              | ✓      | `RoomTagIcon`              | annotation-extended |
| Space tag             | ✓      | `SpaceTagIcon`             | annotation-extended |
| Area tag              | ✓      | `AreaTagIcon`              | annotation-extended |
| Stair tag             | ✓      | `StairTagIcon`             | annotation-extended |
| Symbol (drafting)     | ✓      | `SymbolIcon`               | annotation-extended |
| Stair path annotation | ✓      | `StairPathAnnotationIcon`  | annotation-extended |
| Reference point       | ✓      | `ReferencePointIcon`       | annotation-extended |

---

## Edit / Modify

| Revit concept       | Status | Export name           | File       |
| ------------------- | ------ | --------------------- | ---------- |
| Mirror              | ✓      | `MirrorIcon`          | edit       |
| Array (linear)      | ✓      | `ArrayLinearIcon`     | edit       |
| Array (radial)      | ✓      | `ArrayRadialIcon`     | edit       |
| Align               | ✓      | `AlignIcon`           | edit       |
| Split               | ✓      | `SplitIcon`           | edit       |
| Trim / Extend       | ✓      | `TrimExtendIcon`      | edit       |
| Void (cut geometry) | ✓      | `VoidIcon`            | edit       |
| Pin                 | ✓      | `PinIcon`             | edit       |
| Unpin               | ✓      | `UnpinIcon`           | edit       |
| Move                | ✓      | `MoveIcon`            | edit-basic |
| Copy                | ✓      | `CopyIcon`            | edit-basic |
| Rotate              | ✓      | `RotateIcon`          | edit-basic |
| Scale               | ✓      | `ScaleIcon`           | edit-basic |
| Offset              | ✓      | `OffsetIcon`          | edit-basic |
| Delete              | ✓      | `DeleteIcon`          | edit-basic |
| Join geometry       | ✓      | `JoinGeometryIcon`    | edit-basic |
| Unjoin geometry     | ✓      | `UnjoinGeometryIcon`  | edit-basic |
| Switch join order   | ✓      | `SwitchJoinOrderIcon` | edit-basic |
| Wall joins          | ✓      | `WallJoinsIcon`       | edit-basic |
| Paint material      | ✓      | `PaintMaterialIcon`   | edit-basic |
| Measure between     | ✓      | `MeasureBetweenIcon`  | edit-basic |
| Measure along       | ✓      | `MeasureAlongIcon`    | edit-basic |
| Ungroup             | ✓      | `UngroupIcon`         | edit-basic |

---

## Organization, Workflow & Data

| Revit concept         | Status | Export name           | File         |
| --------------------- | ------ | --------------------- | ------------ |
| Family                | ✓      | `FamilyIcon`          | organization |
| Family type           | ✓      | `FamilyTypeIcon`      | organization |
| Group                 | ✓      | `GroupIcon`           | organization |
| Assembly              | ✓      | `AssemblyIcon`        | organization |
| Linked model          | ✓      | `LinkedModelIcon`     | organization |
| Material              | ✓      | `MaterialIcon`        | organization |
| Wall layer / assembly | ✓      | `WallLayerIcon`       | organization |
| Phase                 | ✓      | `PhaseIcon`           | organization |
| BCF issue             | ✓      | `IssueIcon`           | organization |
| Clash                 | ✓      | `ClashIcon`           | organization |
| Validation rule       | ✓      | `ValidationRuleIcon`  | organization |
| Deviation             | ✓      | `DeviationIcon`       | organization |
| Workset               | ✓      | `WorksetIcon`         | workflow     |
| Design option         | ✓      | `DesignOptionIcon`    | workflow     |
| Revision              | ✓      | `RevisionIcon`        | workflow     |
| RFI                   | ✓      | `RFIIcon`             | workflow     |
| Submittal             | ✓      | `SubmittalIcon`       | workflow     |
| Point cloud           | ✓      | `PointCloudIcon`      | workflow     |
| Digital twin          | ✓      | `DigitalTwinIcon`     | workflow     |
| Sync to central       | ✓      | `SyncIcon`            | workflow     |
| Transmittal           | ✓      | `TransmittalIcon`     | workflow     |
| IFC export            | ✓      | `IFCIcon`             | workflow     |
| LOD                   | ✓      | `LODIcon`             | workflow     |
| Quantity takeoff      | ✓      | `QuantityTakeoffIcon` | workflow     |
| Energy model          | ✓      | `EnergyModelIcon`     | workflow     |
| Scope box             | ✓      | `ScopeBoxIcon`        | workflow     |

---

## Collaboration & Project Management

| Revit concept              | Status | Export name                    | File          |
| -------------------------- | ------ | ------------------------------ | ------------- |
| Reload latest              | ✓      | `ReloadLatestIcon`             | collaboration |
| Editing request            | ✓      | `EditingRequestIcon`           | collaboration |
| Copy/monitor               | ✓      | `CopyMonitorIcon`              | collaboration |
| Coordination review        | ✓      | `CoordinationReviewIcon`       | collaboration |
| Purge unused               | ✓      | `PurgeUnusedIcon`              | collaboration |
| Transfer project standards | ✓      | `TransferProjectStandardsIcon` | collaboration |
| Project info               | ✓      | `ProjectInfoIcon`              | collaboration |
| Project parameters         | ✓      | `ProjectParametersIcon`        | collaboration |
| Shared parameters          | ✓      | `SharedParametersIcon`         | collaboration |
| Object styles              | ✓      | `ObjectStylesIcon`             | collaboration |

---

## Site & Civil

| Revit concept   | Status | Export name         | File |
| --------------- | ------ | ------------------- | ---- |
| Topography      | ✓      | `TopoIcon`          | site |
| Property line   | ✓      | `PropertyLineIcon`  | site |
| Parking space   | ✓      | `ParkingSpaceIcon`  | site |
| Planting / tree | ✓      | `PlantingIcon`      | site |
| Road / pad      | ✓      | `RoadIcon`          | site |
| Retaining wall  | ✓      | `RetainingWallIcon` | site |
| North arrow     | ✓      | `NorthArrowIcon`    | site |

---

## Coverage summary

| Category                | Total concepts | Implemented | Coverage |
| ----------------------- | -------------- | ----------- | -------- |
| Architecture            | 39             | 39          | 100%     |
| Structural              | 21             | 21          | 100%     |
| MEP                     | 36             | 36          | 100%     |
| Views                   | 25             | 25          | 100%     |
| Annotation              | 33             | 33          | 100%     |
| Edit / Modify           | 23             | 23          | 100%     |
| Organization / Workflow | 26             | 26          | 100%     |
| Collaboration           | 10             | 10          | 100%     |
| Site                    | 7              | 7           | 100%     |
| **Total**               | **220**        | **220**     | **100%** |
