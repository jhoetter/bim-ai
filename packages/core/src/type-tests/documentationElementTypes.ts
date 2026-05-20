import type { Element, Sheet, TitleblockType, WindowLegendView } from '../index';

type AssertAssignable<T extends Element> = T;

type _SheetInElement = AssertAssignable<Sheet>;
type _TitleblockTypeInElement = AssertAssignable<TitleblockType>;
type _WindowLegendViewInElement = AssertAssignable<WindowLegendView>;

export {};
