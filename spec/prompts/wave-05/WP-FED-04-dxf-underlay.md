# WP-FED-04 — DXF underlay (closeout)

## Branch

`feat/wave-05-fed-04-dxf-underlay`

## Goal

Ship the DXF half of FED-04. Today the IFC import path is shipped (commit `6c2ee24f`). The "Insert → Link DXF" menu entry is present but disabled with a tooltip; this WP wires it. Result: a customer drops a 2D DXF site plan, bim-ai parses linework, materialises a `link_dxf` element, and renders the linework as a plan-canvas underlay on the active level. Revit `.rvt` import stays out of scope (per the WP's existing OpenBIM stance).

## Done rule

(a) New element kind `link_dxf` ships in core + Pydantic, with `linkId`, `levelId`, `originMm`, `rotationDeg`, `scaleFactor`, `linework[]` (lines + polylines + arcs from the DXF), and `pinned`.
(b) New backend route `POST /api/models/{host_id}/import-dxf?file=<path>` parses with `ezdxf`, materialises the `link_dxf` element on the host model, and returns `{ linkedElementId }`.
(c) ProjectMenu's "Insert → Link DXF…" entry is enabled and opens a file picker; on select, dispatches the import; the new element renders as a plan underlay.
(d) Plan canvas renders `link_dxf` linework as desaturated grey strokes underneath authored geometry on the same level.
(e) Tracker row for FED-04 flips from `partial` → `done`, deferred-scope text trimmed to "Revit `.rvt` import out of scope (OpenBIM stance) + long-import progress polish".

---

## File 1 — `app/bim_ai/elements.py`

Add `LinkDxfElem` Pydantic class:

- `kind: Literal['link_dxf'] = 'link_dxf'`
- `id`, `name` (default `"DXF Underlay"`), `level_id` (alias `levelId`), `origin_mm` (alias `originMm`, `Vec2Mm`), `rotation_deg` (alias `rotationDeg`, default 0)
- `scale_factor` (alias `scaleFactor`, default 1.0, gt 0) — handles unit conversions in the DXF
- `linework: list[DxfLineworkPrim]` (alias `linework`)
- `pinned` (default False)

Where `DxfLineworkPrim` is a discriminated union over:

- `{ kind: 'line', start: Vec2Mm, end: Vec2Mm }`
- `{ kind: 'polyline', points: list[Vec2Mm], closed: bool }`
- `{ kind: 'arc', center: Vec2Mm, radius_mm: float, start_deg: float, end_deg: float }`

Register `LinkDxfElem` in the `Element` discriminated union and append `'link_dxf'` to the central `ELEMENT_KIND_NAMES` list.

## File 2 — `app/bim_ai/dxf_import.py` (new)

```python
def parse_dxf_to_linework(path: Path) -> list[dict]: ...
def build_link_dxf_payload(file_path, level_id, origin_mm, rotation_deg, scale_factor) -> dict: ...
```

`parse_dxf_to_linework` uses `ezdxf.readfile`; iterates the modelspace; emits dicts in the `DxfLineworkPrim` shape. Skip 3D-only entities, hatches, and text. Convert arcs to centre+radius+angles. Use the DXF unit hint (`$INSUNITS`) to auto-scale to mm.

## File 3 — `app/bim_ai/routes_api.py`

Add route handler:

```python
@router.post("/api/models/{host_id}/import-dxf")
async def import_dxf(host_id: str, file: UploadFile, level_id: str, ...): ...
```

Persists the upload, parses via `parse_dxf_to_linework`, runs a single `createLinkDxf` engine command on the host, returns `{ linkedElementId }`.

## File 4 — `app/bim_ai/commands.py` (and engine.py)

Add `CreateLinkDxfCmd` Pydantic class with the same fields as `LinkDxfElem` minus `kind`, plus an `id`. Add a `case CreateLinkDxfCmd():` branch in `try_commit_bundle`.

## File 5 — `packages/core/src/index.ts`

Append `'link_dxf'` to `ElemKind`, add the matching shape to `Element`, and add `CreateLinkDxfCmd` to the engine command union.

## File 6 — `packages/web/src/plan/PlanCanvas.tsx`

Add a render layer for `link_dxf` elements that match the active level. Renders linework as grey strokes (1px, 50% opacity) beneath authored geometry. Use a new helper `packages/web/src/plan/dxfUnderlay.ts`:

```ts
export function renderDxfUnderlay(
  ctx: CanvasRenderingContext2D,
  link: LinkDxfElement,
  worldToScreen: (xy: Vec2Mm) => [number, number],
): void;
```

Wire it as a separate `renderUnderlays(ctx)` call **before** the existing element-render loop.

## File 7 — `packages/web/src/projectMenu/ProjectMenu.tsx` (or wherever Insert → Link is)

Enable the "Link DXF…" entry. On click, open a `<input type=file accept=".dxf">`; on select, POST to `/api/models/<hostId>/import-dxf`; on success, refresh the model + open `ManageLinksDialog` with the new entry highlighted (mirroring the IFC flow).

## Tests

`app/tests/test_dxf_import.py` (new):

- `test_parse_dxf_lines` — feed a simple LINE-only fixture, assert linework count + coords.
- `test_parse_dxf_polylines` — POLYLINE round-trip.
- `test_parse_dxf_skips_3d_entities` — `3DFACE` excluded.
- `test_parse_dxf_units_scaling` — `$INSUNITS=1` (inches) converts to mm.

`app/tests/test_create_link_dxf_command.py` (new): apply the command, assert element shape.

`packages/web/src/plan/dxfUnderlay.test.ts` (new): render to a mock canvas, assert stroke calls.

## Validation

```bash
cd app && .venv/bin/ruff check bim_ai/dxf_import.py bim_ai/elements.py bim_ai/routes_api.py bim_ai/commands.py bim_ai/engine.py
cd app && .venv/bin/pytest tests/test_dxf_import.py tests/test_create_link_dxf_command.py
cd packages/web && pnpm typecheck
cd packages/web && pnpm exec vitest run src/plan/dxfUnderlay.test.ts
```

## Tracker

Flip FED-04 row from `partial` → `done`. Replace deferred-scope text with: "Revit `.rvt` import remains out of scope (OpenBIM stance — Forge/Speckle path); long-import progress polish is a separate UX WP."

## Phase 2 — Chain into FED-03 (canvas drift badge)

Once Phase 1 (everything above) is complete and `feat/wave-05-fed-04-dxf-underlay` is pushed, **continue working** in the same agent session and do FED-03 next. Reasoning: FED-03 adds a canvas overlay layer in the same `PlanCanvas.tsx` region this WP just touched. Doing it in the same agent — branched off the FED-04 tip rather than off main — avoids the trivial append conflict and lets the user kick off all five wave-5 prompts in parallel.

Steps:

1. **Branch off the FED-04 tip you just pushed** (NOT off `main`):
   ```bash
   git checkout -b feat/wave-05-fed-03-canvas-badge feat/wave-05-fed-04-dxf-underlay
   ```
2. Open `spec/prompts/wave-05/WP-FED-03-canvas-badge.md` and execute it end to end. Treat that file's Done rule as authoritative for Phase 2; ignore its "Sequencing" section header — the chaining handles ordering.
3. Run that prompt's Validation block; all checks must pass.
4. Update `spec/workpackage-master-tracker.md` to flip the FED-03 row from `partial` → `done` (separately from the FED-04 flip you already committed).
5. Commit on the FED-03 branch with a `feat(fed): FED-03 closeout — ...` message and `Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>`.
6. `git push origin feat/wave-05-fed-03-canvas-badge`.

### Final report (covers both phases)

When you finish, report **both** branches in one summary:

- `feat/wave-05-fed-04-dxf-underlay` — what shipped, validation results, branch SHA.
- `feat/wave-05-fed-03-canvas-badge` — what shipped, validation results, branch SHA.

### Merge order for the user

The user merges FED-04 first, then FED-03. The FED-03 branch is a descendant of FED-04, so its merge is a fast-forward (or trivial three-way merge) once FED-04 is on main.

## Non-goals

- Hatches, text, dimensions, layers — DXF entities outside lines/polylines/arcs are skipped silently. A follow-up WP can broaden coverage.
- Import-progress UI / cancellation.
- Revit `.rvt` import.
