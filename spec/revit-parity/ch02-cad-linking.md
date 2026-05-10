# Chapter 2 — CAD Linking & Import

Source segment: `00:27:59 – 00:55:00`

---

## F-015 · Link CAD (DWG/DXF)

**What it does:** Insert → Link CAD establishes a live reference to an external DWG/DXF file. The linked file stays as a separate entity; if the source DWG changes on disk, it can be reloaded. The file does _not_ become part of the Revit model data, keeping file sizes small. Preferred workflow over Import CAD.

**Screenshot:**
![Link CAD dialog](file:///Users/jhoetter/Desktop/Revit%20Specs/0207_00-29-53.png)

**bim-ai status:** ✅ Available — `app/bim_ai/dxf_import.py` parses DXF geometry via `ezdxf`, `build_link_dxf_payload` wraps it into a `link_dxf` engine command, and `POST /api/models/{host_id}/import-dxf` materialises server-path linked CAD with source path/stat metadata. The linked `link_dxf` element renders as a plan underlay with origin/rotation/scale support, source metadata, reload status/messages, and Manage Links reload reparses the current source path to refresh primitives, layers, and metadata.

---

## F-016 · Import CAD

**What it does:** Insert → Import CAD permanently embeds the CAD geometry into the Revit project file. Results in larger file size. Acceptable for one-time reference drawings but makes collaboration harder.

**Screenshot:**
![Import vs Link](file:///Users/jhoetter/Desktop/Revit%20Specs/0206_00-29-37.png)

**bim-ai status:** ✅ Available — browser-uploaded DXF imports use the same geometry pipeline as F-015 but are marked `cadReferenceType: "embedded"` with filename/size metadata and preserved imported linework. Server-path DXFs are marked `linked` and remain disk-reloadable. Manage Links labels rows as Imported CAD vs Linked CAD and only offers source reparse for linked rows.

---

## F-017 · CAD Link Options (Colors / Layers / Units / Positioning)

**What it does:** The "Link CAD Formats" dialog exposes four key options:

- **Colors**: Preserve (keep original DWG colors), Black and White, or Invert.
- **Layers**: All, Visible only, or Specify (pick which layers to bring in).
- **Import units**: Auto-Detect, or explicit unit (feet, inches, mm, etc.).
- **Positioning**: Auto – Origin to Internal Origin (recommended), Auto – Center to Center, etc.

**Screenshot:**
![CAD Link Options](file:///Users/jhoetter/Desktop/Revit%20Specs/0209_00-30-10.png)

**bim-ai status:** 🟡 Partial — `ManageLinksDialog.tsx` includes a DXF Links section listing all `link_dxf` underlays with per-link opacity slider (0–100%) and color mode toggle (Black & White / Preserve original colors / Custom hex color). These settings are stored as `colorMode`, `customColor`, and `overlayOpacity` fields on each `link_dxf` element and read by `dxfUnderlay.ts`/`PlanCanvas.tsx` at render time. Layer names/colors are preserved for supported DXF primitives, native color mode applies each primitive's layer color, Manage Links can hide/show individual DXF layers per link, and DXF `$INSUNITS` scaling is preserved server-side. Missing: import-time positioning/unit override UI beyond the existing link alignment controls.

---

## F-018 · Pin / Unpin linked files

**What it does:** Selecting a linked CAD file and clicking "Pin" (or "Unpin") in the Modify ribbon locks (or unlocks) its position in the project. Pinned elements cannot be accidentally moved or deleted.

**Screenshot:**
![Pin CAD file](file:///Users/jhoetter/Desktop/Revit%20Specs/0303_01-02-56.png)

**bim-ai status:** ✅ Available — linked model and DXF underlay rows now support spatial position pin/unpin. `ManageLinksDialog.tsx` exposes a "Lock position" / "Position locked" control for both `link_model` and `link_dxf` rows, and the selected-element Inspector pin toggle also appears for both link kinds. Backend generic `pinElement` / `unpinElement` works for both models. Pinned `link_model` rows reject position, rotation, alignment, and delete operations while still allowing revision pinning/drift updates; this preserves the separate Revit-like version-lock workflow.

---

## F-019 · Query tool for DWG layer visibility

**What it does:** With a CAD file selected, clicking "Query" in the Modify | Import Symbols ribbon and then hovering over any element in the DWG opens the "Import Instance Query" dialog, showing the element's layer name. The "Hide in View" button in that dialog hides every element on that layer within the current view — without affecting other views.

**Screenshot:**
![Query Tool](file:///Users/jhoetter/Desktop/Revit%20Specs/0238_00-56-21.png)

**bim-ai status:** 🟡 Partial — DXF import now preserves each supported primitive's `layerName` plus layer color, stores a compact `dxfLayers` summary on `link_dxf`, and Manage Links lists those layers with per-link visibility checkboxes. Toggling a layer persists `hiddenLayerNames` via `updateLinkDxf`, and both 2D/3D plan underlay renderers skip hidden layer primitives. Missing: hover-pick Import Instance Query dialog, true per-view layer overrides, and DWG parsing beyond the existing DXF pipeline.

---

## F-020 · Halftone / transparency for imported categories (VG)

**What it does:** In Visibility/Graphic Overrides (VV) → "Imported Categories" tab, each linked DWG can be given a "Halftone" override, rendering it at ~50% opacity. This makes Revit-authored elements stand out on top of the trace drawing without fully hiding it.

**Screenshot:**
![Halftone Override](file:///Users/jhoetter/Desktop/Revit%20Specs/0340_01-09-17.png)

**bim-ai status:** ✅ Available — `dxfUnderlay.ts` resolves every `link_dxf` element's configured overlay style. The default of 50% opacity (halftone-equivalent) matches Revit's visual intent, and `ManageLinksDialog.tsx` exposes a per-link opacity slider (0–100%) plus color mode that persists via `updateLinkDxf`. `VVDialog.tsx` now lists imported DXF/CAD rows on the Revit Links tab with per-view visibility and transparency slider (0–100%, including full opacity), stored in the active plan view's `categoryOverrides` and honored by the Three.js plan renderer.

---

## F-021 · Align CAD with Project Base Point

**What it does:** After linking a DWG, the drawing is first unpinned, then the Move (MV) tool is used to align a known corner of the DWG plan with Revit's internal origin (Project Base Point). Project Base Point visibility is toggled on via VG → Site category. Once aligned, the DWG is re-pinned.

**Screenshot:**
![Align CAD to Base Point](file:///Users/jhoetter/Desktop/Revit%20Specs/0302_01-02-46.png)

**bim-ai status:** ✅ Available — `ManageLinksDialog.tsx` exposes three alignment modes for both `link_model` rows and `link_dxf` underlays: `origin_to_origin` ("Origin → Origin"), `project_origin` ("Project Base Point"), and `shared_coords` ("Shared Coords"). For DXF, the CAD internal origin is aligned to the host project base point or survey point, with `originMm`, `rotationDeg`, and `scaleFactor` remaining as per-link adjustments. Both the 2D canvas underlay path (`dxfUnderlay.ts`) and the live Three.js plan-render path (`PlanCanvas.tsx`) use the same transform helper, preventing drift between renderers.

---

## F-022 · Project Base Point & Survey Point

**What it does:** Revit has two coordinate origin markers: Project Base Point (project-relative zero) and Survey Point (real-world coordinate reference). Both are visible/hidden via VG → Site. The Project Base Point is the anchor used when "Origin to Internal Origin" positioning is selected in Link CAD.

**Screenshot:**
![Project Base Point](file:///Users/jhoetter/Desktop/Revit%20Specs/0134_00-15-08.png)

**bim-ai status:** ✅ Available — `project_base_point` and `survey_point` are first-class element kinds in `@bim-ai/core`. The 3D viewport renders them as visual markers (blue circled cross for PBP, green triangle for Survey Point) via `originMarkers.ts`. Plan canvas renders 2D cross-in-circle (PBP, blue) and triangle (Survey Point, green) markers at `positionMm`, gated by the VG → Site/Origin `site_origin` category. The right-rail inspector shows editable N/S / E/W coordinate fields (X/Y inputs with mm precision, blur-to-commit via `updateElementProperty`), a read-only Elevation field, and a persisted Clip/Unclip checkbox (`clipped`) when the Project Base Point or Survey Point is selected.

---

## F-023 · Work Plane assignment for linked elements

**What it does:** A linked CAD file can have its "Work Plane" (host level) changed in the Properties palette. Changing it from "Level: GF Slab Top" to "Level: GF Finished Floor" repositions the DWG at the correct height, making it visible in plan views cut at the finished floor level.

**Screenshot:**
![Work Plane assignment](file:///Users/jhoetter/Desktop/Revit%20Specs/0801_05-33-52.png)

**bim-ai status:** ✅ Available — The `link_dxf` element's `levelId` field controls which level the DXF underlay is associated with (its "work plane"). The right-rail inspector exposes an editable level dropdown (`data-testid="inspector-link-dxf-level"`) for selected DXF underlay elements, and the backend `updateElementProperty { key: "levelId" }` path validates that the target is an existing level. `ManageLinksDialog` also lists each DXF underlay with its level association. The named-reference-plane variant of Revit's Set Work Plane dialog is not modeled, but level-hosted CAD work-plane assignment is covered.

---

## F-024 · Manage Links dialog

**What it does:** The Insert tab → Manage Links shows all external links (Revit models, CAD files, IFC, PDF, images) with their load path and status. Allows reloading, unloading, removing links, or changing the linked file path.

**Screenshot:**
![Manage Links](file:///Users/jhoetter/Desktop/Revit%20Specs/0146_00-17-16.png)

**bim-ai status:** 🟡 Partial — `ManageLinksDialog.tsx` lists all `link_model` rows (delete, alignment mode, visibility mode, spatial position lock, revision pinning with drift badge + Update button) and all `link_dxf` underlays (linked/imported CAD label, loaded/unloaded status, reload status/message, source metadata, source-path change field, spatial position lock, alignment mode, opacity slider 0–100%, color mode toggle Black & White / Preserve original colors / Custom hex, and layer visibility). Linked DXF reload reparses the source file and refreshes primitives/layers. Missing: IFC / PDF / image link types.
