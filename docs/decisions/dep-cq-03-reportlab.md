# DEP-CQ-03 — reportlab dependency audit

- **Tracker WP:** DEP-CQ-03 (Section 6 of `spec/trackers/code-quality-debt-tracker.md`)
- **Date:** 2026-05-29
- **Status:** Decided — KEEP `reportlab` (no migration)
- **Owner:** backend-core

## Context

`reportlab@4.5.0` is pinned in `app/pyproject.toml` as `reportlab>=4.2,<5`. The
tracker entry DEP-CQ-03 flags reportlab as a "heavy backend PDF generator" and
asks whether headless Chrome (Playwright) could replace it.

### Actual call-site inventory

```
$ rg -n "reportlab|from reportlab|import reportlab" app/
app/pyproject.toml:20:    "reportlab>=4.2,<5",
app/bim_ai/sheet_preview_pdf.py:7:from reportlab.lib.pagesizes import A4
app/bim_ai/sheet_preview_pdf.py:8:from reportlab.pdfgen import canvas as pdf_canvas
```

Only ONE module imports reportlab: `app/bim_ai/sheet_preview_pdf.py`
(~65 lines, single function `sheet_elem_to_pdf_bytes(doc, sh) -> bytes`).
It draws a deterministic one-page placemark PDF for a sheet element — title,
titleblock parameters, a horizontal separator, and a vertical listing of
viewport-export rows.

Call sites of `sheet_elem_to_pdf_bytes` (the wrapper):

- `app/bim_ai/routes/exports.py:271` — `/v3/models/{model_id}/sheets/{sheet_id}/preview.pdf` route.
- `app/bim_ai/evidence/export_documentation_evidence.py:111` — evidence-pack
  generator that emits a PDF blob alongside SVG/JSON evidence.
- `app/tests/test_documentation_export_product_pack.py:209` — product-pack
  contract test.

Note: the tracker brief names `app/bim_ai/routes/render_export.py` as the
expected call site. That module (the `/v3/models/{model_id}/export` glTF/IFC
route) does NOT use reportlab — it was confused with `routes/exports.py`. The
real reportlab user is `sheet_preview_pdf.py`, reached via `routes/exports.py`.

### What reportlab is actually doing

`sheet_preview_pdf.py` uses three primitives:

1. `canvas.Canvas` + `A4` page size — deterministic 595×842pt page.
2. `setFont` / `drawString` / `drawRightString` — Helvetica text at fixed
   pixel offsets.
3. `setStrokeColorRGB` / `line` — a single horizontal separator.

No images, no embedded fonts, no vector geometry, no PDF/A tags, no forms.

## Decision — KEEP reportlab

### Rationale

1. **Footprint is already small.** The entire reportlab surface used is
   `Canvas`, `A4`, four font/text helpers, one stroke helper. The dependency
   pulls one wheel (~2 MB) and zero native binaries. The "heavy" framing in
   the tracker entry overstates the impact — there is no bundle-budget
   pressure today because reportlab lives in the backend Python env, not the
   web bundle.

2. **Replacement cost dwarfs ongoing cost.** The two alternatives are
   non-trivial:

   - **Headless Chrome / Playwright** — would require shipping Chromium
     (~250 MB), an HTML/CSS template layer, and a subprocess lifecycle for
     each PDF render. Chromium also fluctuates rendering output across
     versions, breaking the determinism property `sheet_preview_pdf.py`
     deliberately preserves (used by `test_documentation_export_product_pack`).
   - **WeasyPrint** — pure-Python and lighter than Chrome, but pulls
     `cairo` + `pango` system libraries that bim-ai's CI runners and Docker
     images would now need. It also changes the rendering model from
     imperative (`drawString` at known coordinates) to declarative
     (HTML/CSS), which is a larger surface for layout-drift bugs in a
     contract-tested output.

3. **Determinism + contract tests.** The PDF bytes are evidence artefacts
   compared by tests in `tests/test_documentation_export_product_pack.py`.
   reportlab's `Canvas` produces byte-stable output for fixed inputs; both
   alternatives require either fuzzy comparison or a determinism shim.

4. **Mature, low-maintenance library.** reportlab 4.x has been stable since
   2024-09 with security patches landing promptly. The `>=4.2,<5` pin is
   already conservative.

5. **The tracker entry itself anticipates this answer.** DEP-CQ-03 lists the
   keep rationale verbatim: "PDF spec compliance, mature library, low cost
   to maintain."

### Consequences

- No code change. `sheet_preview_pdf.py` stays as-is.
- No follow-up WP for migration. DEP-CQ-03 closes as **decided / keep**.
- The pyproject pin `reportlab>=4.2,<5` is the long-term version policy until
  reportlab 5.x releases; at that point a new WP will track whether the
  upper bound moves to `<6`.
- If a future requirement adds significant PDF surface (multi-page layouts,
  embedded images, accessibility tags), this decision should be revisited —
  WeasyPrint becomes more attractive when the imperative-drawing API stops
  being a good fit.

### Alternatives considered

| Option                       | Bundle / runtime cost                                  | Determinism                       | Migration cost                            | Verdict          |
| ---------------------------- | ------------------------------------------------------ | --------------------------------- | ----------------------------------------- | ---------------- |
| **Keep reportlab**           | ~2 MB wheel, pure Python                               | Byte-stable                       | Zero                                      | **Chosen**       |
| Headless Chrome (Playwright) | ~250 MB Chromium + subprocess lifecycle                | Drifts across Chromium versions   | Rewrite as HTML/CSS + add Playwright dep  | Rejected         |
| WeasyPrint                   | Pure Python wheel + `cairo`/`pango` system libraries   | Drifts on layout-engine bumps     | Rewrite as HTML/CSS + add system libs     | Rejected         |
| Stop emitting PDFs entirely  | Negative cost                                          | N/A                               | Breaks `/preview.pdf` route + product pack contract | Rejected         |

## Closure

DEP-CQ-03 → **Done (keep)** in the tracker once this PR merges.
