# UI interactions (V1)

## Layout

- **Left**: Model tree (levels → walls/doors/rooms grouped).
- **Center**: Viewport — toggle 2D plan / 3D orbit; grid on plan.
- **Right**: Inspector for selected element (name, numeric params).
- **Bottom**: Violations list (filter error/warning); click → select elements.
- **Optional rail**: Comments on model (demo: thread per model).
- **Command palette** (⌘K): create wall, insert door, save viewpoint, switch mode.

## Gestures (v1 feasible)

### Plan mode

- **Select**: click picks nearest wall segment / door / room polygon.
- **Create wall**: tool → two clicks (start/end) on XY plane at active level snap-to-grid mm.
- **Move wall**: select wall → arrow keys small nudge ; or inspector delta fields.
- **Insert door**: select wall → “Insert door” → places at center (along_t=0.5) editable.

### 3D mode

- Orbit controls; selection syncs same IDs.

## Collaboration

- **Presence**: avatar color + cursor label stub (websocket broadcast).
- **Remote selection** (optional stub): highlighted outline.

## Keyboard

| Key         | Action              |
| ----------- | ------------------- |
| ⌘K / Ctrl+K | Command palette     |
| G           | Toggle grid overlay |
| 2 / 3       | 2D / 3D mode        |

## Themes

Preset CSS vars via `VITE_DESIGN_SYSTEM` at build time; runtime light/dark class on `<html>`.
