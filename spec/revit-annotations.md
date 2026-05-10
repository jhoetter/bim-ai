# Revit Annotation Tab — Parity Tracker

Source: [Balkan Architect — Every Tool on the Annotate Tab](https://www.youtube.com/watch?v=HTtKD5ZkJfk)

## Status legend

- ✅ Implemented
- ⚠️ Partial — core model exists, rendering / UI incomplete
- ❌ Missing — tracked for implementation
- 🚫 N/A — MEP, structural-rebar, or browser-native; not in bim-ai scope

---

## Dimension panel

| Revit tool | Status | bim-ai equivalent | Notes |
|---|---|---|---|
| Aligned Dimension | ✅ | `DimensionElem` / `CreateDimensionCmd` | 2-point aligned dimension chain; shortcut DI |
| Linear Dimension | ✅ | same — horizontal/vertical locked via UI | functionally equivalent to our dimension tool |
| Angular Dimension | ❌ | — | measures angle between two lines; tracked in `ann/angular-dimension` |
| Radial Dimension | ❌ | — | radius of circular/arc walls; low priority |
| Diameter Dimension | ❌ | — | diameter variant; low priority |
| Arc Length | ❌ | — | arc-segment length; low priority |
| Spot Elevation | ❌ | — | diamond + elevation text at a picked point; tracked in `ann/spot-elevation` |
| Spot Coordinate | ❌ | — | N/E coordinate annotation; lower priority |
| Spot Slope | ❌ | — | slope % / ratio annotation; lower priority |

---

## Detail panel

| Revit tool | Status | bim-ai equivalent | Notes |
|---|---|---|---|
| Detail Line | ✅ | `DetailLineElem` / `CreateDetailLineCmd` | solid / dashed / dotted styles; shortcut DL |
| Filled Region | ✅ | `DetailRegionElem` / `CreateDetailRegionCmd` | solid, hatch_45/90, crosshatch, dots fill patterns |
| Masking Region | ✅ | `MaskingRegionElem` / `CreateMaskingRegionCmd` | opaque white polygon; occludes linework |
| Detail Component | ❌ | — | place a 2D family instance in a view; blocked on family library |
| Repeating Detail Component | ❌ | — | pattern-repeated 2D family; blocked on family library |
| Revision Cloud | ❌ | — | cloud-shaped boundary; tracked in `ann/revision-cloud` |
| Insulation | ❌ | — | zigzag insulation linework annotation; lower priority |
| Detail Groups | ❌ | — | named group of detail items; lower priority |

---

## Text panel

| Revit tool | Status | bim-ai equivalent | Notes |
|---|---|---|---|
| Text | ✅ | `TextNoteElem` / `CreateTextNoteCmd` | 9-point anchor, rotation, font size, colour |
| Check Spelling | 🚫 | — | browser-native; not applicable in canvas context |
| Find / Replace | 🚫 | — | not applicable for view-local annotations |

---

## Tag panel

| Revit tool | Status | bim-ai equivalent | Notes |
|---|---|---|---|
| Tag by Category | ✅ | `PlaceTagCmd` | door / window / room; auto-positioned |
| Tag All | ✅ | `generateAutoTags` in `AnnotateRibbon` | idempotent; clears previous run first |
| Beam Annotations | 🚫 | — | structural beam annotation; out of scope |
| Multi-Category Tag | ❌ | — | tags any element via Type Mark; lower priority |
| Material Tag | ❌ | — | tags individual wall-layer material; lower priority |
| Room Tag | ✅ | `PlaceTagCmd` + `TagDefinitionElem` (kind: room) | area + name label |
| Tread Number | ❌ | — | auto-numbers stair treads; lower priority |
| Multi-Rebar Annotation | 🚫 | — | structural rebar; out of scope |
| Keynote | ❌ | — | links elements to keynote database; lower priority |

---

## Color Fill panel

| Revit tool | Status | bim-ai equivalent | Notes |
|---|---|---|---|
| Color Fill Legend | ⚠️ | `RoomColorSchemeElem` / `UpsertRoomColorSchemeCmd` | colors rooms in plan; no separate legend viewport yet |
| Pipe Legend | 🚫 | — | MEP; out of scope |
| Duct Legend | 🚫 | — | MEP; out of scope |

---

## Symbol panel

| Revit tool | Status | bim-ai equivalent | Notes |
|---|---|---|---|
| Symbol | ❌ | — | North Arrow, Centerline, etc.; tracked in `ann/annotation-symbol` |
| Stair Path | ❌ | — | UP/DOWN arrow on stair; tracked in `ann/annotation-symbol` |
| Span Direction | ❌ | — | floor slab span arrow; lower priority |

---

## Implementation branches

| Branch | Feature | Status |
|---|---|---|
| `ann/spot-elevation` | `SpotElevationElem` — diamond + elevation label at a point | done |
| `ann/revision-cloud` | `RevisionCloudElem` — cloud-shaped closed annotation | done |
| `ann/angular-dimension` | `AngularDimensionElem` — arc-based angle measurement | done |
| `ann/annotation-symbol` | `AnnotationSymbolElem` — North Arrow, Stair Path, Centerline | done |
