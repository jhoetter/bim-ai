# Wave-2 Agent 6 — Family system depth (FAM-03 + FAM-05 + FAM-10)

You are **Agent 6** of eight wave-2 agents. Theme: **family system depth** — yes/no visibility binding, parameter-driven array, cross-project copy/paste. Branch `wave2-6`. Three WPs all of which depend on FAM-01 (already shipped at load-bearing slice in commit `583e726c`).

---

## 0. Pre-flight

```bash
git worktree add /Users/jhoetter/repos/bim-ai-wave2-6 wave2-6
cd /Users/jhoetter/repos/bim-ai-wave2-6
```

Read `spec/workpackage-master-tracker.md` → P4 → FAM-03, FAM-05, FAM-10 detail blocks; also read `nightshift/dayshift-fam-keystone-status.md` (or the FAM-01 commit `583e726c`) to understand what's in the FAM-01 load-bearing slice.

### Concurrent agents

Agents 7 (FAM-08 catalog) also touches family-related files. Coordinate: you own `family editor parameter visibility`, `array tool`, `clipboard`. Agent 7 owns `external catalog format` + `Component placement tool`.

### Quality gates / branch protocol / tracker / anti-laziness

Same as Agent 1. Branch `wave2-6`. End-of-shift `nightshift/wave2-6-status.md`.

---

## 1. Your assigned workpackages

Three WPs in this order: FAM-03 (smallest, builds on FAM-01) → FAM-10 (independent) → FAM-05 (largest, builds on FAM-04 + FAM-01).

### 1.1 — FAM-03: Yes/No parameters with geometry visibility binding

**Tracker:** P4 → FAM-03.

**Scope:**

1. Family parameter spec gains `type: 'boolean'` (find existing parameter type union; add 'boolean' alongside 'number', 'string'). Defaults to `false`.

2. Each family geometry node gains an optional `visibilityBinding`:

   ```ts
   visibilityBinding?: {
     paramName: string;
     whenTrue: boolean;          // default: true (visible when param is true)
   };
   ```

3. Family resolver (in `packages/web/src/families/familyResolver.ts` or wherever FAM-01's resolver lives) honors the binding: when resolving a geometry tree, skip nodes whose `visibilityBinding` evaluates to "not visible" given the current parameter values.

4. Family editor UI in `FamilyEditorWorkbench.tsx`:
   - Properties panel on a selected geometry node gains a "Visible When" dropdown listing boolean params + an "always" option
   - When a param is selected, a checkbox "Show when true" / "Show when false"

5. Tests:
   - `packages/web/src/families/familyResolver.visibilityBinding.test.ts` — geometry skipped when binding evaluates false
   - `packages/web/src/familyEditor/FamilyEditorWorkbench.visibilityBinding.test.tsx` — UI sets the binding correctly

**Acceptance.** Build a window family with a "Has Frame" yes/no parameter; bind the frame extrusion to it. In a project, toggling the parameter on a placed window instance hides/shows the frame extrusion in 3D.

**Effort:** 4-5 hours.

---

### 1.2 — FAM-10: Cross-project family / element copy-paste

**Tracker:** P4 → FAM-10.

**Scope:**

1. Clipboard payload format `bim-ai-clipboard-v1`:

   ```ts
   {
     format: 'bim-ai-clipboard-v1';
     sourceProjectId: string;
     sourceModelId: string;
     elements: Element[];
     familyDefinitions: FamilyDefinition[];
     timestamp: string;
   }
   ```

   Stored in `localStorage` under key `bim-ai:clipboard`.

2. **Cmd+C / Ctrl+C** in plan canvas + 3D viewport: when elements are selected, build the payload (selected elements + transitively-required family definitions) and write to clipboard. Show toast "Copied N elements to clipboard."

3. **Cmd+V / Ctrl+V**: read clipboard payload; if from same project, paste at cursor (offset elements relatively); if from different project, prompt for family-id collision resolution:
   - "Use Source Version" — overwrite local family definitions with source's
   - "Keep Project Version" — replace family references in pasted elements with local equivalents
   - "Rename" — rename source families with a `_imported` suffix
   - Default: "Keep Project Version"

4. **Recent Clipboard tray** — a small UI element in the workspace status bar showing the most recent clipboard contents. Click to peek (modal preview); button "Paste this".

5. **Cross-browser support** — clipboard payload also writable to `navigator.clipboard` as a JSON string with the `format: 'bim-ai-clipboard-v1'` marker so the user can paste between browser tabs/windows manually.

6. Tests:
   - `packages/web/src/clipboard/copyPaste.test.ts` — round-trip via localStorage
   - `packages/web/src/clipboard/familyCollisionResolution.test.ts` — three resolution strategies

**Acceptance.** Build a "Library" project with a custom sofa family + instance; Cmd+C the sofa instance; switch to a "House" project; Cmd+V → sofa places at cursor; the family is loaded into House.

**Effort:** 5-6 hours.

---

### 1.3 — FAM-05: Array tool (linear + radial, parameter-driven count)

**Tracker:** P4 → FAM-05.

**Scope:**

1. New family geometry node `array` per the tracker detail block:

   ```ts
   {
     kind: 'array';
     target: { kind: 'family_instance_ref'; familyId: string; ... };
     mode: 'linear' | 'radial';
     countParam: string;
     spacing:
       | { kind: 'fixed_mm'; mm: number }
       | { kind: 'fit_total'; totalLengthParam: string };
     axisStart: { xMm; yMm; zMm };
     axisEnd: { xMm; yMm; zMm };
     centerVisibilityBinding?: { paramName: string };
   }
   ```

2. Family resolver computes:
   - `count = max(1, floor(host_param_value(countParam)))`
   - For `linear`: `step = spacing.kind === 'fixed_mm' ? spacing.mm : (axisEnd - axisStart) / count`
   - For `radial`: rotate around `(axisStart + axisEnd) / 2` axis by `360 / count` degrees per instance
   - Resolve `count` copies of the target family at the computed positions

3. Family editor "Array" tool: click target instance, define axis (two clicks on canvas), set `countParam` (dropdown of available numeric params), set spacing mode + value/param. Finish creates the array node.

4. Tests:
   - `packages/web/src/families/familyResolver.array.test.ts` — linear array count = 6 produces 6 instances at correct spacing
   - `packages/web/src/families/familyResolver.array.test.ts` — radial array of count = 4 produces 90° rotation
   - `packages/web/src/familyEditor/ArrayTool.test.tsx` — UI flow

**Acceptance.** A dining-table family with 6 chairs arrayed along its long edge; changing `Width` to 2400 + recomputing produces 8 chairs at correct spacing.

**Effort:** 6-7 hours.

---

## 2. File ownership and conflict avoidance

**You own:**
- Family-resolver extensions (visibilityBinding, array node)
- `packages/web/src/familyEditor/*` extensions (Visible When dropdown, Array tool)
- Clipboard module (copy/paste handlers + payload format)
- New test files

**Shared territory:**
- `core/index.ts`, `elements.py` — minimal touches (parameter type union, family geometry node types)
- `spec/workpackage-master-tracker.md` — only your three rows

**Avoid:**
- `packages/web/src/plan/PlanCanvas.tsx` outside the Cmd+C/V handlers (Agents 2, 3, 5)
- `packages/web/src/Viewport.tsx` (Agents 1, 7)
- `packages/web/src/viewport/meshBuilders.ts` (seed-fidelity)
- `app/bim_ai/export_ifc.py` (Agent 8)

---

## 3. Go

Spawn worktree. Ship FAM-03 → FAM-10 → FAM-05.
