# Chapter 2 — CAD Linking & Import

Source segment: `00:27:59 – 00:55:00`

---

## F-015 · Link CAD (DWG/DXF)

**What it does:** Insert → Link CAD establishes a live reference to an external DWG/DXF file. The linked file stays as a separate entity; if the source DWG changes on disk, it can be reloaded. The file does *not* become part of the Revit model data, keeping file sizes small. Preferred workflow over Import CAD.

**Screenshot:**
![Link CAD dialog](file:///Users/jhoetter/Desktop/Revit%20Specs/0207_00-29-53.png)

**bim-ai status:** 🟡 Partial — backend is fully implemented: `app/bim_ai/dxf_import.py` parses DXF geometry via `ezdxf`, `build_link_dxf_payload` wraps it into a `link_dxf` engine command, and `POST /api/models/{host_id}/import-dxf` materialises the element. The resulting `link_dxf` element renders as a desaturated grey underlay on the plan canvas with origin/rotation/scale support. The frontend file-picker in ProjectMenu is currently **disabled** (button is stubbed with a "on the roadmap" tooltip that redirects users to Link Model instead). No live reload on source-file change.

---

## F-016 · Import CAD

**What it does:** Insert → Import CAD permanently embeds the CAD geometry into the Revit project file. Results in larger file size. Acceptable for one-time reference drawings but makes collaboration harder.

**Screenshot:**
![Import vs Link](file:///Users/jhoetter/Desktop/Revit%20Specs/0206_00-29-37.png)

**bim-ai status:** 🟡 Partial — same backend as F-015 (`import-dxf` API). bim-ai uses a single `link_dxf` element kind that behaves like a link (the parsed linework is stored in the element, not as a separate file reference), so the linked vs. embedded distinction does not exist today. Frontend file-picker is also disabled (same stub as F-015).

---

## F-017 · CAD Link Options (Colors / Layers / Units / Positioning)

**What it does:** The "Link CAD Formats" dialog exposes four key options:
- **Colors**: Preserve (keep original DWG colors), Black and White, or Invert.
- **Layers**: All, Visible only, or Specify (pick which layers to bring in).
- **Import units**: Auto-Detect, or explicit unit (feet, inches, mm, etc.).
- **Positioning**: Auto – Origin to Internal Origin (recommended), Auto – Center to Center, etc.

**Screenshot:**
![CAD Link Options](file:///Users/jhoetter/Desktop/Revit%20Specs/0209_00-30-10.png)

**bim-ai status:** ❌ Not available — DXF import has no layer/color/positioning filter UI.

---

## F-018 · Pin / Unpin linked files

**What it does:** Selecting a linked CAD file and clicking "Pin" (or "Unpin") in the Modify ribbon locks (or unlocks) its position in the project. Pinned elements cannot be accidentally moved or deleted.

**Screenshot:**
![Pin CAD file](file:///Users/jhoetter/Desktop/Revit%20Specs/0303_01-02-56.png)

**bim-ai status:** 🟡 Partial — `ManageLinksDialog.tsx` implements **revision pinning**: each `link_model` row can be pinned to a specific snapshot revision, preventing automatic advancement. The UI shows the pinned revision number, a yellow drift badge when the source has moved past it, and a one-click "Update" button to bump to head. Pin / Unpin actions are wired to backend commands. This covers the *version-lock* intent of Revit pinning but not the *spatial position lock* (elements can still be moved/deleted regardless of pin state).

---

## F-019 · Query tool for DWG layer visibility

**What it does:** With a CAD file selected, clicking "Query" in the Modify | Import Symbols ribbon and then hovering over any element in the DWG opens the "Import Instance Query" dialog, showing the element's layer name. The "Hide in View" button in that dialog hides every element on that layer within the current view — without affecting other views.

**Screenshot:**
![Query Tool](file:///Users/jhoetter/Desktop/Revit%20Specs/0238_00-56-21.png)

**bim-ai status:** ❌ Not available — the DXF linework is stored as flat primitives (lines/polylines/arcs); DXF layer metadata is not preserved in the `link_dxf` element, so there is no layer name to query or toggle. No per-layer visibility UI exists in ManageLinksDialog or VVDialog.

---

## F-020 · Halftone / transparency for imported categories (VG)

**What it does:** In Visibility/Graphic Overrides (VV) → "Imported Categories" tab, each linked DWG can be given a "Halftone" override, rendering it at ~50% opacity. This makes Revit-authored elements stand out on top of the trace drawing without fully hiding it.

**Screenshot:**
![Halftone Override](file:///Users/jhoetter/Desktop/Revit%20Specs/0340_01-09-17.png)

**bim-ai status:** 🟡 Partial — `packages/web/src/plan/dxfUnderlay.ts` hardcodes `DXF_UNDERLAY_OPACITY = 0.5` and applies it via `ctx.globalAlpha` when rendering every `link_dxf` element. All DXF underlays are automatically rendered at 50 % opacity (halftone-equivalent), matching Revit's visual intent. However, the value is a compile-time constant — there is no per-link or per-view opacity slider in VG / ManageLinksDialog, and no full-opacity mode.

---

## F-021 · Align CAD with Project Base Point

**What it does:** After linking a DWG, the drawing is first unpinned, then the Move (MV) tool is used to align a known corner of the DWG plan with Revit's internal origin (Project Base Point). Project Base Point visibility is toggled on via VG → Site category. Once aligned, the DWG is re-pinned.

**Screenshot:**
![Align CAD to Base Point](file:///Users/jhoetter/Desktop/Revit%20Specs/0302_01-02-46.png)

**bim-ai status:** ❌ Not available — no explicit coordinate alignment workflow.

---

## F-022 · Project Base Point & Survey Point

**What it does:** Revit has two coordinate origin markers: Project Base Point (project-relative zero) and Survey Point (real-world coordinate reference). Both are visible/hidden via VG → Site. The Project Base Point is the anchor used when "Origin to Internal Origin" positioning is selected in Link CAD.

**Screenshot:**
![Project Base Point](file:///Users/jhoetter/Desktop/Revit%20Specs/0134_00-15-08.png)

**bim-ai status:** ❌ Not available.

---

## F-023 · Work Plane assignment for linked elements

**What it does:** A linked CAD file can have its "Work Plane" (host level) changed in the Properties palette. Changing it from "Level: GF Slab Top" to "Level: GF Finished Floor" repositions the DWG at the correct height, making it visible in plan views cut at the finished floor level.

**Screenshot:**
![Work Plane assignment](file:///Users/jhoetter/Desktop/Revit%20Specs/0801_05-33-52.png)

**bim-ai status:** ❌ Not available.

---

## F-024 · Manage Links dialog

**What it does:** The Insert tab → Manage Links shows all external links (Revit models, CAD files, IFC, PDF, images) with their load path and status. Allows reloading, unloading, removing links, or changing the linked file path.

**Screenshot:**
![Manage Links](file:///Users/jhoetter/Desktop/Revit%20Specs/0146_00-17-16.png)

**bim-ai status:** 🟡 Partial — `ManageLinksDialog.tsx` lists all `link_model` rows with per-row controls for delete, alignment mode (origin-to-origin / project base point / shared coords), visibility mode (host view / linked view), and revision pinning with drift badge + "Update" button. Missing: `link_dxf` / IFC / PDF / image link types are not listed (ManageLinksDialog only queries `link_model` elements); no file-path change workflow.
