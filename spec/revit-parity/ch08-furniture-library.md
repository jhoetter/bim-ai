# Chapter 8 — Project Furniture Library

Source segment: `04:35:00 – 04:38:48`

---

## F-087 · Project Furniture Library (warehouse .rvt)

**What it does:** Creating a dedicated blank Revit project file as a "furniture warehouse". All bespoke parametric families (chairs, tables, sofas, etc.) are loaded and placed in this one file at various type configurations. This `.rvt` becomes a visual catalogue — open it, select and copy a family configuration, paste it into the working project. No internet or external library required; the warehouse travels with the project.

**Screenshot:**
![Furniture Library project](file:///Users/jhoetter/Desktop/Revit%20Specs/0735_04-36-52.png)

**bim-ai status:** ❌ Not available — bim-ai has a `family_catalog_format.py` and `family_catalogs/` directory suggesting a catalog concept, but no interactive warehouse-style `.rvt` project library workflow.

---

## F-088 · Dimension text repositioning

**What it does:** Selecting a dimension and then clicking-and-dragging its text label moves the text away from cluttered areas while keeping the witness lines anchored. Double-clicking resets text to default position. Used in the family editor reference plane layout to prevent overlapping dimension labels.

**Screenshot:**
![Dimension text reposition](file:///Users/jhoetter/Desktop/Revit%20Specs/0699_04-35-13.png)

**bim-ai status:** ✅ Implemented — Dimension elements support a `textOffsetMm` field: the text label position can be offset from the default midpoint via the inspector ("Text offset X/Y" inputs + Reset) or by dragging the circular text-label grip handle on the canvas when a dimension is selected. The grip provider projects label drag deltas onto the dimension-line axis so the label stays aligned with the measured span. Double-clicking the text grip emits `updateElementProperty { key: 'textOffsetMm', value: null }` to reset the label to its default midpoint. The measurement value is rendered as a sprite label at the resulting position.

---

## F-089 · Array parameters (Array_Length_Width)

**What it does:** In parametric table families, an "Array_Length_Width" parameter controls the number of chair slots along each side of the table, linked to an array count constraint. When the table width changes, the array automatically adjusts the number of chairs that fit.

**Screenshot:**
![Array parameter](file:///Users/jhoetter/Desktop/Revit%20Specs/0728_04-36-10.png)

**bim-ai status:** ❌ Not available — bim-ai has no array/pattern tool for elements.

---

## F-090 · File Save Options (Max backups)

**What it does:** File → Save As → Options opens "File Save Options" where "Maximum backups" controls how many `.0001.rvt`, `.0002.rvt`, etc. backup files Revit keeps per family or project. Setting it to 1 reduces disk usage for course exercise files and personal family libraries.

**Screenshot:**
![File Save Options](file:///Users/jhoetter/Desktop/Revit%20Specs/0566_03-44-29.png)

**bim-ai status:** ❌ Not applicable (bim-ai uses a database model, not file-based with rolling backups).
