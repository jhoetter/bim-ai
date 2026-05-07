# Wave-3 Agent 3 — Editing tool de-stubs (EDT-04) + grammar polish (EDT-06)

You are **Agent 3** of eight wave-3 agents. Theme: **finish the 9 plan-canvas tool stubs + tool grammar polish**. Branch `wave3-3`.

---

## 0. Pre-flight

```bash
cd /Users/jhoetter/repos/bim-ai
git fetch origin --quiet
git worktree add /Users/jhoetter/repos/bim-ai-wave3-3 -b wave3-3 origin/main
cd /Users/jhoetter/repos/bim-ai-wave3-3
```

Read:
- `spec/workpackage-master-tracker.md` → P2 → EDT-04, EDT-06 detail blocks
- The grip protocol shipped in EDT-01 (`packages/web/src/plan/gripProtocol.ts`) and tools/toolGrammar.ts
- `nightshift/wave3-README.md`

### Quality gates / branch protocol / tracker / anti-laziness

Standard. Branch `wave3-3`. Status `nightshift/wave3-3-status.md`. Push and merge each WP individually.

---

## 1. Your assigned workpackages

Order: EDT-04 (the 9 stubs) → EDT-06 (grammar polish). Both M; both depend on EDT-01 (already partial).

### 1.1 — EDT-04: De-stub the 9 plan-canvas tools

**Tracker:** P2 → EDT-04 detail block.

**The 9 stubs in `packages/web/src/plan/PlanCanvas.tsx`:**

| Stub                       | Line  | Tool name (UI / shortcut)             | Engine command on commit              |
| -------------------------- | ----- | -------------------------------------- | ------------------------------------- |
| `splitWall`                | 1103  | Split Element (SD)                    | `SplitWallAt`                         |
| `alignElement`             | 1085  | Align (AL)                            | `AlignElementToReference`             |
| `trimElement`              | 1158  | Trim/Extend (TR)                      | `TrimElementToReference`              |
| `wall-opening`             | 924   | Wall Opening                          | `CreateWallOpening` (KRN-04 done)     |
| `wall-join`                | 1409  | Wall Joins (interactive variant)      | `SetWallJoinVariant`                  |
| `column placement`         | 1256  | Place Column                          | `CreateColumn`                        |
| `beam placement`           | 1265  | Place Beam                            | `CreateBeam`                          |
| `ceiling`                  | 1286  | Ceiling                               | `CreateCeiling`                       |
| `shaft`                    | 1243  | Shaft (slab opening)                  | `CreateSlabOpeningShaft`              |

**Per-stub shape.** Each tool follows the standard pattern:
1. User clicks tool / types shortcut → tool enters its own state (with options bar)
2. User clicks one or more reference points / elements
3. Tool emits a draft mutation that PlanCanvas renders as live preview
4. User confirms (Enter / final click) → command commits via the bundle endpoint
5. With Multiple modifier active (per EDT-06), tool stays active for next placement

**For each of the 9 stubs:**

- Replace the `console.warn('stub: ...')` with an actual command commit
- Hot-key works (find existing keyboard handler and wire)
- Tools that need engine commands (`SplitWallAt`, `AlignElementToReference`, `TrimElementToReference`, `SetWallJoinVariant`) — add commands to `app/bim_ai/commands.py` + `engine.py` first, then wire the tool
- Tools whose commands already exist (`CreateColumn`, `CreateBeam`, `CreateCeiling`, `CreateSlabOpeningShaft`, `CreateWallOpening`) — just wire the canvas tool to invoke them with the right inputs

**Specific tool flows:**

- **Split Element (SD):** click a wall → wall splits at the click point into two new walls (preserving hosted openings, distributing them by alongT)
- **Align (AL):** click reference edge → click element → element snaps so its corresponding edge matches the reference edge's plane
- **Trim/Extend (TR):** click reference element → click element → element either trims (if it overshoots) or extends (if it undershoots) to meet the reference
- **Wall Opening:** click wall → drag rectangle within wall extent → commits `CreateWallOpening`
- **Wall Joins:** right-click wall corner → "Cycle Join Variant" → cycles through Mitre / Butt / Square via `SetWallJoinVariant`
- **Place Column:** click position → commits `CreateColumn` at that XY on the active level
- **Place Beam:** click start → click end → commits `CreateBeam`
- **Ceiling:** opens SKT-01 sketch session with `elementKind: 'ceiling'` (after Agent 4's wave3-4 ships the ceiling propagation; if not yet, fall back to a click-rectangle authoring as the load-bearing slice)
- **Shaft:** click floor → drag rectangle within floor → commits `CreateSlabOpeningShaft`

**Tests:** for each tool, a vitest in `packages/web/src/plan/PlanCanvas.<tool>.test.tsx` confirming the stub `console.warn` is gone and the right command is committed.

**Acceptance.** Each of the 9 tools' stubs is replaced; hot-key works; Multiple-mode (after EDT-06 below) keeps the tool active; Esc exits.

**Effort:** ~6-7 hours (each tool is ~30-45 minutes with the protocol from EDT-01).

---

### 1.2 — EDT-06: Tool grammar polish

**Tracker:** P2 → EDT-06 detail block.

**Modifiers to add:**

1. **Chain mode** for Place Wall: continues from the last endpoint until Esc / different tool. Indicated by checkbox in the Options Bar.
2. **Multiple mode** for Insert Door / Window: stays active after first placement until Esc.
3. **Tag-on-Place** for wall / door / window: during placement, auto-generate a tag of a configurable family (wired from PLN-01 already-shipped automation).
4. **Numeric input mode while drawing**: type "5000" while drawing a wall → input field at cursor; Enter commits a 5000mm-long segment in the cursor direction; Tab switches axis.

**Tool grammar (`packages/web/src/tools/toolGrammar.ts`):** extend the state machine with:
- `chainable: boolean`
- `multipleable: boolean`
- `tagOnPlace: { enabled: boolean; tagFamilyId?: string }`
- `numericInputActive: boolean`

**Options Bar:** new component `packages/web/src/tools/OptionsBar.tsx` that appears when a tool is active, mimicking Revit's. Shows toggles for Chain / Multiple / Tag on Place plus mode-specific options (e.g. Wall location line for the wall tool).

**Tests:**
- `packages/web/src/tools/toolGrammar.modifiers.test.ts` — chain/multiple modes
- `packages/web/src/tools/numericInput.test.tsx` — typing a digit while drawing pops the input
- `packages/web/src/tools/OptionsBar.test.tsx` — options bar appears when tool active

**Acceptance.** Drawing four walls of a rectangular room takes four clicks (chain mode) instead of eight. Insert Door with Multiple stays active until Esc. Numeric input lets you draw a wall to exactly 5000mm by typing a number.

**Effort:** 4-5 hours.

---

## 2. File ownership and conflict avoidance

**You own:**
- The 9 stub branches in `PlanCanvas.tsx` (lines noted above)
- `tools/toolGrammar.ts` modifier extensions
- New `tools/OptionsBar.tsx`
- New engine commands: `SplitWallAt`, `AlignElementToReference`, `TrimElementToReference`, `SetWallJoinVariant`

**Shared territory:**
- `PlanCanvas.tsx` — Agents 2 (3D handles, but they're in 3D), 4 (sketch downstream) also touch; the 9 stub branches are well-localised so collisions are minimal
- `tools/toolRegistry.ts` — append your tool entries
- `commands.py`, `engine.py` — append your new commands
- `spec/workpackage-master-tracker.md` — EDT-04, EDT-06 only

**Avoid:**
- `Viewport.tsx` (Agent 2)
- `meshBuilders.ts` (Agent 5)
- `familyEditor/*` (Agent 7)
- `SketchCanvas.tsx` (Agent 4)

---

## 3. Go

Spawn worktree, ship EDT-04 (the 9 stubs — go down the list one at a time, push each as a separate commit), then EDT-06. Push and merge each substantive piece individually.
