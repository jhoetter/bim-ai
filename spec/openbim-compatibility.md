# Open BIM & Revit stance

Marketing copy: pursue **Revit-compatible workflows early** and **native RVT I/O later** via an explicit bridge.

## Integration ladder

1. **JSON command bundles + snapshots** — canonical authoring + deterministic tests (`bim-ai snapshot`, bundles, CLI).
2. **IFC import/export** — professional exchange once core geometry semantics stabilize.
3. **BCF** — portable coordination issues referencing viewpoints/elements.
4. **IDS** — requirements validation riding on IFC payloads.
5. **glTF** — lightweight viz / gamer-style viewers outside CAD.
6. **RVT bridge** — safest when delivered as plugin, Autodesk cloud conversion, or customer-specific pipeline—not by attempting opaque binary support first.

## Engineering notes

- Web + CLI must stay symmetric: anything the UI edits must be reproducible via API commands logged in undo stacks.
- Exporters stub through CLI (`bim-ai export`) until backends exist—see roadmap issues instead of pretending parity.
- **IDS / IFC read-back (kernel):** Authoring-side IDS checks stay in `constraints.evaluate` (cleanroom rules on family types). Exported IFC semantics are summarized by **`inspect_kernel_ifc_semantics()`** ([`export_ifc.py`](../app/bim_ai/export_ifc.py)) — storeys, hosted products, `Pset_*` identity + space programme fields, `Qto_*` templates, and kernel geometry skip counts. See [ifc-export-wp-x03-slice.md](./ifc-export-wp-x03-slice.md) § *IFC semantic inspection matrix*. Full IDS fixture exchange and import/replay remain out of scope for that helper.
