import type {
  Element,
  FamilyBlendElement,
  FamilyComponentElement,
  FamilyConstraintElem,
  FamilyDefinitionElement,
  FamilyExtrusionElement,
  FamilyInstanceElement,
  FamilyOpeningCutElement,
  FamilyParameterElement,
  FamilyReferencePlaneElement,
  FamilyRevolveElement,
  FamilySweepElement,
  FamilySweptBlendElement,
  FamilyTypeElement,
  FamilyVoidElement,
} from '../index';

type AssertAssignable<T extends Element> = T;

type _FamilyTypeInElement = AssertAssignable<FamilyTypeElement>;
type _FamilyInstanceInElement = AssertAssignable<FamilyInstanceElement>;
type _FamilyExtrusionInElement = AssertAssignable<FamilyExtrusionElement>;
type _FamilyBlendInElement = AssertAssignable<FamilyBlendElement>;
type _FamilySweepInElement = AssertAssignable<FamilySweepElement>;
type _FamilySweptBlendInElement = AssertAssignable<FamilySweptBlendElement>;
type _FamilyRevolveInElement = AssertAssignable<FamilyRevolveElement>;
type _FamilyVoidInElement = AssertAssignable<FamilyVoidElement>;
type _FamilyOpeningCutInElement = AssertAssignable<FamilyOpeningCutElement>;
type _FamilyComponentInElement = AssertAssignable<FamilyComponentElement>;
type _FamilyReferencePlaneInElement = AssertAssignable<FamilyReferencePlaneElement>;
type _FamilyDefinitionInElement = AssertAssignable<FamilyDefinitionElement>;
type _FamilyParameterInElement = AssertAssignable<FamilyParameterElement>;
type _FamilyConstraintInElement = AssertAssignable<FamilyConstraintElem>;

export {};
