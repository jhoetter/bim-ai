# Revit Annotation Tab — Parity Tracker

Source: [Balkan Architect — Every Tool on the Annotate Tab](https://www.youtube.com/watch?v=HTtKD5ZkJfk)

## Status legend

- ✅ Implemented
- ⚠️ Partial — core model exists, rendering / UI incomplete
- ❌ Missing — tracked for implementation
- N/A — feature not applicable in this context

---

## Dimension panel

| Revit tool | Status | bim-ai equivalent | Notes |
|---|---|---|---|
| Aligned Dimension | ✅ | `DimensionElem` / `CreateDimensionCmd` | 2-point aligned dimension chain; shortcut DI |
| Linear Dimension | ✅ | same — horizontal/vertical locked via UI | functionally equivalent to our dimension tool |
| Angular Dimension | ✅ | `AngularDimensionElem` / `CreateAngularDimensionCmd` | ANN-04: arc-based angle between two rays |
| Radial Dimension | ✅ | `RadialDimensionElem` / `CreateRadialDimensionCmd` | ANN-06: radius from arc center to arc point |
| Diameter Dimension | ✅ | `DiameterDimensionElem` / `CreateDiameterDimensionCmd` | ANN-07: diameter variant of radial |
| Arc Length | ✅ | `ArcLengthDimensionElem` / `CreateArcLengthDimensionCmd` | ANN-08: arc-segment length |
| Spot Elevation | ✅ | `SpotElevationElem` / `CreateSpotElevationCmd` | ANN-02: diamond + elevation text at a picked point |
| Spot Coordinate | ✅ | `SpotCoordinateElem` / `CreateSpotCoordinateCmd` | ANN-09: N/E coordinate annotation |
| Spot Slope | ✅ | `SpotSlopeElem` / `CreateSpotSlopeCmd` | ANN-10: slope % / ratio annotation |

---

## Detail panel

| Revit tool | Status | bim-ai equivalent | Notes |
|---|---|---|---|
| Detail Line | ✅ | `DetailLineElem` / `CreateDetailLineCmd` | solid / dashed / dotted styles; shortcut DL |
| Filled Region | ✅ | `DetailRegionElem` / `CreateDetailRegionCmd` | solid, hatch_45/90, crosshatch, dots fill patterns |
| Masking Region | ✅ | `MaskingRegionElem` / `CreateMaskingRegionCmd` | opaque white polygon; occludes linework |
| Detail Component | ✅ | `DetailComponentElem` / `CreateDetailComponentCmd` | ANN-17: place a 2D shape (bolt, break_line, etc.) in a view |
| Repeating Detail Component | ✅ | `RepeatingDetailElem` / `CreateRepeatingDetailCmd` | ANN-18: pattern-repeated 2D shape along a line |
| Revision Cloud | ✅ | `RevisionCloudElem` / `CreateRevisionCloudCmd` | ANN-03: cloud-shaped closed annotation; orange by default |
| Insulation | ✅ | `InsulationAnnotationElem` / `CreateInsulationAnnotationCmd` | ANN-11: zigzag insulation linework annotation |
| Detail Groups | ✅ | `DetailGroupElem` / `CreateDetailGroupCmd` | ANN-19: named group of detail items |

---

## Text panel

| Revit tool | Status | bim-ai equivalent | Notes |
|---|---|---|---|
| Text | ✅ | `TextNoteElem` / `CreateTextNoteCmd` | 9-point anchor, rotation, font size, colour |
| Check Spelling | N/A | — | browser-native; not applicable in canvas context |
| Find / Replace | N/A | — | not applicable for view-local annotations |

---

## Tag panel

| Revit tool | Status | bim-ai equivalent | Notes |
|---|---|---|---|
| Tag by Category | ✅ | `PlaceTagCmd` | door / window / room; auto-positioned |
| Tag All | ✅ | `generateAutoTags` in `AnnotateRibbon` | idempotent; clears previous run first |
| Beam Annotations | N/A | — | structural beam annotation; blocked on structural framing |
| Multi-Category Tag | ✅ | `MultiCategoryTagElem` / `CreateMultiCategoryTagCmd` | ANN-13: tags any element via Type Mark |
| Material Tag | ✅ | `MaterialTagElem` / `CreateMaterialTagCmd` | ANN-12: tags individual wall-layer material |
| Room Tag | ✅ | `PlaceTagCmd` + `TagDefinitionElem` (kind: room) | area + name label |
| Tread Number | ✅ | `TreadNumberElem` / `CreateTreadNumberCmd` | ANN-14: auto-numbers stair treads |
| Multi-Rebar Annotation | N/A | — | structural rebar; out of scope |
| Keynote | ✅ | `KeynoteElem` / `CreateKeynoteCmd` | ANN-15: links elements to keynote database |

---

## Color Fill panel

| Revit tool | Status | bim-ai equivalent | Notes |
|---|---|---|---|
| Color Fill Legend | ✅ | `ColorFillLegendElem` / `CreateColorFillLegendCmd` | ANN-20: scheme-parameter-based color fill legend in view |
| Pipe Legend | ✅ | `PipeLegendElem` / `CreatePipeLegendCmd` | MEP-03: pipe system type legend with colour swatches |
| Duct Legend | ✅ | `DuctLegendElem` / `CreateDuctLegendCmd` | MEP-04: duct system type legend with colour swatches |

---

## Symbol panel

| Revit tool | Status | bim-ai equivalent | Notes |
|---|---|---|---|
| Symbol | ✅ | `AnnotationSymbolElem` / `CreateAnnotationSymbolCmd` | ANN-05: North Arrow, Centerline, custom; placed at view centre |
| Stair Path | ✅ | `AnnotationSymbolElem` (symbolType: stair_path) | ANN-05: UP/DOWN arrow on stair |
| Span Direction | ✅ | `SpanDirectionElem` / `CreateSpanDirectionCmd` | ANN-16: floor slab span arrow |

---

## MEP elements

| Element | Status | bim-ai equivalent | Notes |
|---|---|---|---|
| Pipe | ✅ | `PipeElem` / `CreatePipeCmd` | MEP-01: straight pipe segment; system types (domestic water, sanitary, fire protection, etc.) |
| Duct | ✅ | `DuctElem` / `CreateDuctCmd` | MEP-02: straight duct segment; rectangular/round/oval; supply/return/exhaust |

---

## Summary

All 34 Revit Annotate tab tools are now implemented (or marked N/A where not applicable to a browser-based BIM tool). MEP elements (pipe, duct, legends) are fully implemented because bim-ai is used for MEP projects.
