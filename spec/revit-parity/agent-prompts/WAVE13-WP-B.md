# Wave 13 — WP-B: Project Information Dialog (§2.1.1)

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).
This prompt is self-contained — start here.

---

## Repo orientation

```
packages/core/src/index.ts                               — project_settings element type
packages/web/src/workspace/Workspace.tsx                 — command handlers, ribbon buttons
packages/web/src/workspace/sheets/SheetCanvas.tsx        — sheet title block rendering
packages/web/src/cmdPalette/defaultCommands.ts           — palette commands
packages/web/src/workspace/inspector/InspectorContent.tsx — project_settings inspector
```

Tests: co-located `*.test.ts` — run `pnpm test --filter @bim-ai/web`.
Prettier runs automatically after every Edit/Write.
**Shared-file rule**: before editing `toolGrammar.ts`, `toolRegistry.ts`, `core/index.ts`, or
`PlanCanvas.tsx`, run `git pull --rebase origin main` first.

---

## What already exists — DO NOT rebuild

Read ALL of these before writing anything:

- `core/index.ts` — find `project_settings` element. Confirm these fields already exist: `name`, `projectNumber`, `clientName`, `projectAddress`, `projectStatus`, `authorName`, `issueDate`, `checkDate`, `projectDescription`. Do NOT add them again.
- `Workspace.tsx` — find how `project_settings` is updated (look for `update_project_settings` or similar). Find how other modal dialogs (e.g. `DimensionStyleDialog`, `VisibilityGraphicsDialog`) are opened — use the exact same pattern (a boolean state flag + conditional render in JSX).
- `SheetCanvas.tsx` — find how the title block currently retrieves project name, client name, author name. These likely read from `project_settings` or are hardcoded. Update them to use the full project info fields.
- `defaultCommands.ts` — search for `manage.project-information`. If it exists, do NOT add it again.
- `InspectorContent.tsx` — find `case 'project_settings'`. Read what fields are already shown. Do NOT duplicate them — only ADD the missing info fields if they are absent.

---

## Tasks

### A — ProjectInfoDialog component

Create `packages/web/src/workspace/ProjectInfoDialog.tsx`:

A modal dialog with a two-column form layout. Fields (all dispatch `update_element_property` for the `project_settings` element when blurred):

| Field | data-testid | Type |
|-------|-------------|------|
| Project name | `project-info-name` | text input |
| Project number | `project-info-number` | text input |
| Client name | `project-info-client` | text input |
| Project address | `project-info-address` | textarea (3 rows) |
| Project status | `project-info-status` | text input |
| Author name | `project-info-author` | text input |
| Issue date | `project-info-issue-date` | date input |
| Check date | `project-info-check-date` | date input |
| Description | `project-info-description` | textarea (3 rows) |

Use the same modal wrapper pattern as `DimensionStyleDialog.tsx` or `VisibilityGraphicsDialog.tsx` — read those first, copy their shell exactly.

Props:
```ts
interface ProjectInfoDialogProps {
  projectSettings: Extract<Element, { kind: 'project_settings' }>;
  onPropertyChange: (key: string, value: unknown) => void;
  onClose: () => void;
}
```

Close button (`data-testid="project-info-close"`) fires `onClose`.

### B — Wire into Workspace

In `Workspace.tsx`:
- Add `const [showProjectInfo, setShowProjectInfo] = useState(false)`
- In the JSX, render `<ProjectInfoDialog>` when `showProjectInfo` is true, using `onClose={() => setShowProjectInfo(false)}`
- Add a ribbon button or menu item with `data-testid="ribbon-project-info"` that sets `showProjectInfo(true)`

### C — Palette command

In `defaultCommands.ts`, register (only if not already present):
```ts
registerCommand({
  id: 'manage.project-information',
  label: 'Project Information',
  keywords: ['project info', 'name', 'number', 'client', 'address', 'author'],
  category: 'command',
  invoke: (ctx) => ctx.openProjectInfo?.(),
});
```

Add `openProjectInfo?: () => void` to `PaletteContext` if not already present.

### D — Title block wiring

In `SheetCanvas.tsx`, find where the title block fields are rendered (look for project name, client name, etc. being drawn as SVG text or similar). Update them to read from the `project_settings` element fields:
- `titleBlockProjectName` → `projectSettings.name`
- `titleBlockProjectNumber` → `projectSettings.projectNumber`
- `titleBlockClient` → `projectSettings.clientName`
- `titleBlockAuthor` → `projectSettings.authorName`
- `titleBlockDate` → `projectSettings.issueDate`

If the sheet already reads these fields, verify the mapping is correct and do NOT change it.

### E — Tests

Write `packages/web/src/workspace/projectInfoDialog.test.tsx`:
```ts
describe('project information dialog — §2.1.1', () => {
  it('renders project-info-name input with current project name', () => { ... });
  it('renders project-info-number input', () => { ... });
  it('name input blur dispatches onPropertyChange for name', () => { ... });
  it('project-info-close button calls onClose', () => { ... });
  it('renders project-info-address textarea', () => { ... });
});
```

---

## Commit and push

After tests pass (`pnpm test --filter @bim-ai/web`):
```
git add -p
git commit -m "feat(wave13/B): project information dialog (§2.1.1)"
git push origin main
```

## Success criterion

`pnpm test --filter @bim-ai/web` — all tests pass including the new ones.
