import type {
  Element,
  DimensionElement,
  FloorTypeElement,
  GridLineElement,
  LevelElement,
  ProjectSettingsElement,
  RoofTypeElement,
  RoomElement,
  RoomColorSchemeElement,
  WallTypeElement,
} from '../index';

type AssertAssignable<T extends Element> = T;

type _ProjectSettingsInElement = AssertAssignable<ProjectSettingsElement>;
type _RoomColorSchemeInElement = AssertAssignable<RoomColorSchemeElement>;
type _WallTypeInElement = AssertAssignable<WallTypeElement>;
type _FloorTypeInElement = AssertAssignable<FloorTypeElement>;
type _RoofTypeInElement = AssertAssignable<RoofTypeElement>;
type _LevelInElement = AssertAssignable<LevelElement>;
type _RoomInElement = AssertAssignable<RoomElement>;
type _GridLineInElement = AssertAssignable<GridLineElement>;
type _DimensionInElement = AssertAssignable<DimensionElement>;
