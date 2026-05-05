# Prompt 2 - Room Programme Workflow And Unbounded Room Evidence V1

## Mission

Promote room programme data from a passive derivation into an authoritative workflow with unbounded-room detection, programme/department metadata, and schedule/legend parity evidence.

## Target Workpackages

- WP-B06 (Rooms and room separation) — currently partial ~60%
- WP-C04 (Room color schemes and legends) — currently partial ~55%

## Scope

### Backend (`app/bim_ai/`)

1. **Unbounded room detection** — extend `room_derivation.py`:
   - `detect_unbounded_rooms_v1(doc)` → list of room element IDs where the room boundary is open (not fully enclosed by walls/room separations).
   - Add `unboundedRoomIds` field to existing room derivation output.
   - Advisor rule `room_boundary_open` in `constraints.py` (warning severity).

2. **Programme/department metadata** — extend room elements:
   - `department` and `programmeGroup` optional string properties on room elements.
   - `updateElementProperty` support for setting these.
   - Schedule derivation (`schedule_derivation.py`) includes these columns for room schedules.

3. **Room colour scheme legend deterministic evidence** — extend `room_color_scheme_override_evidence.py`:
   - `roomColourSchemeLegendEvidence_v1(doc)` returns a deterministic legend manifest: scheme name → sorted list of (colour, room name, area) tuples with a digest.
   - Evidence is emitted on `GET .../evidence` alongside existing room colour scheme data.

4. **Room schedule parity** — extend `schedule_derivation.py`:
   - Room schedule rows include `department`, `programmeGroup`, `isBoundaryOpen` columns.
   - Filter rules support filtering by `department` and `programmeGroup`.

### Tests

5. `test_room_programme_unbounded_evidence.py`:
   - Create rooms with open boundary → verify `unboundedRoomIds` detection.
   - Set department/programmeGroup → verify schedule rows include them.
   - Verify colour scheme legend evidence determinism (same doc → same digest).
   - Verify advisor `room_boundary_open` fires for unbounded rooms.

## Non-goals

- Automatic room boundary closure/repair.
- Room separation line editing UI.
- Multi-scheme comparison or scheme authoring workflow.

## Validation

```bash
cd app && .venv/bin/ruff check bim_ai tests
cd app && .venv/bin/pytest tests/test_room_programme_unbounded_evidence.py tests/test_constraints_room_programme_consistency.py tests/test_schedule_derivation.py -x -v
cd packages/web && pnpm typecheck
```

## Tracker And Git

- Update `spec/revit-production-parity-workpackage-tracker.md`: Recent Sprint Ledger + WP-B06, WP-C04 rows.
- Create branch `prompt-2-room-programme-unbounded` from `main`.
- Commit and push. Do not open a pull request.
