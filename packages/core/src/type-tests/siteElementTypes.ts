import type {
  ConceptSeedElem,
  Element,
  GradedRegionElem,
  HatchPatternDef,
  NeighborhoodImportSessionElem,
  NeighborhoodMassElem,
  ShaftElement,
  ToposolidElem,
  ToposolidExcavationElem,
  ToposolidPadElement,
  ToposolidSubdivisionElem,
} from '../index';

type Expect<T extends true> = T;
type Extends<A, B> = A extends B ? true : false;

type _ToposolidInElementUnion = Expect<Extends<ToposolidElem, Element>>;
type _ToposolidSubdivisionInElementUnion = Expect<Extends<ToposolidSubdivisionElem, Element>>;
type _ToposolidExcavationInElementUnion = Expect<Extends<ToposolidExcavationElem, Element>>;
type _ToposolidPadInElementUnion = Expect<Extends<ToposolidPadElement, Element>>;
type _GradedRegionInElementUnion = Expect<Extends<GradedRegionElem, Element>>;
type _ShaftInElementUnion = Expect<Extends<ShaftElement, Element>>;
type _HatchPatternInElementUnion = Expect<Extends<HatchPatternDef, Element>>;
type _NeighborhoodMassInElementUnion = Expect<Extends<NeighborhoodMassElem, Element>>;
type _NeighborhoodImportSessionInElementUnion = Expect<
  Extends<NeighborhoodImportSessionElem, Element>
>;
type _ConceptSeedInElementUnion = Expect<Extends<ConceptSeedElem, Element>>;

export {};
