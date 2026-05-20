import type {
  Element,
  FloorTypeElement,
  LevelElement,
  ProjectSettingsElement,
  RoofTypeElement,
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
