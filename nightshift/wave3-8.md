# Wave-3 Agent 8 — Catch-up / reserve (wave2-8 leftovers OR FED-01 polish)

You are **Agent 8** of eight wave-3 agents. Theme: **catch-up** — handle whatever the in-flight wave2-8 background sprint didn't deliver, with FED-01 polish as a fallback if wave2-8 actually finished. Branch `wave3-8`.

---

## 0. Pre-flight

```bash
cd /Users/jhoetter/repos/bim-ai
git fetch origin --quiet
git worktree add /Users/jhoetter/repos/bim-ai-wave3-8 -b wave3-8 origin/main
cd /Users/jhoetter/repos/bim-ai-wave3-8
```

Read:
- `spec/workpackage-master-tracker.md` — find what's still `open` for IFC-03, IFC-04, VIE-02
- `nightshift/wave3-README.md`

### Triage step: figure out which path you're on

Run this to see what's still open:

```bash
for wp in IFC-03 IFC-04 VIE-02; do
  state=$(grep -E "^\| $wp \|" spec/workpackage-master-tracker.md | grep -oE "\`(done|partial|open|deferred)\`" | head -1)
  echo "  $wp → $state"
done
```

- **If any of IFC-03, IFC-04, VIE-02 is still `open`:** go to **Path A** (run the wave2-8 prompt)
- **If all three are `done`:** go to **Path B** (FED-01 polish)

### Quality gates / branch protocol / tracker / anti-laziness

Standard. Branch `wave3-8`, status `nightshift/wave3-8-status.md`. Push + merge each WP individually.

---

## Path A — wave2-8 leftovers (IFC-03 + IFC-04 + VIE-02)

This is the original wave2-8 spec verbatim. Read the full prompt at `nightshift/wave2-8.md` for the detailed scope. Summary:

### IFC-03: Roof-hosted void replay

**Tracker entry:** Exchange formats → IFC-03.

Today: `slabRoofHostedVoidReplaySkipped_v0` only counts. This WP adds actual replay.

Concrete scope:
- Parse roof-hosted opening geometry in `app/bim_ai/export_ifc.py` authoritative-replay path
- Either extend `createSlabOpening` to accept `hostKind: 'roof' | 'floor'`, OR add a new `createRoofOpening` command
- Renderer: roof CSG-subtracts the opening from the roof mesh
- Update `summarize_kernel_ifc_semantic_roundtrip` and `inspect_kernel_ifc_semantics` accordingly

**Effort:** 4-5 hours.

### IFC-04: Broader QTO + materials + classifications + composites

**Tracker entry:** Exchange formats → IFC-04.

Load-bearing slice (mark `partial` if running long):
- Material assignments: `IfcMaterial` per element with `materialKey` via `IfcRelAssociatesMaterial`
- Layered wall composites: `IfcMaterialLayerSet` for walls with `wallTypeId` (FL-08)
- Broader QTO: `Qto_*BaseQuantities` (gross/net side area, perimeter, volume) for all major elements
- Classifications: `IfcClassificationReference` from optional `ifcClassificationCode` field

**Effort:** 6-8 hours.

### VIE-02: Per-element / per-family-geometry visibility per detail level

**Tracker entry:** P5 → VIE-02. Depends on FAM-01 (load-bearing already done).

Concrete scope:
- Family geometry nodes gain `visibilityByDetailLevel: { coarse?, medium?, fine? }`
- Family resolver respects it during plan projection
- Family editor: 3-checkbox row in geometry-node properties

**Effort:** 3-4 hours.

---

## Path B — FED-01 polish (if Path A is empty)

Today FED-01 is `partial` — load-bearing slice on main. This path ships the deferred polish to flip it `done`.

### FED-01 polish — flip from `partial` to `done`

**Tracker:** P1 → FED-01 detail block. Read the FED-01 commit `b05fc082` to understand what's already shipped.

**MUST ship:**

1. **Per-link visibility modes:** `link_model.visibilityMode: 'host_view' | 'linked_view'`. When `'host_view'`, the linked elements use the host model's view filters / VV. When `'linked_view'`, they use the source model's stored view definitions.

2. **Origin alignment modes beyond `origin_to_origin`:**
   - `'project_origin'`: align to project base point (KRN-06 has these — read source's PBP, transform to host's PBP)
   - `'shared_coords'`: align via the shared-coordinates system (use survey points)

3. **Revision pinning UI + drift badge:**
   - In `ManageLinksDialog.tsx`: per-link "Pin to revision N" / "Follow latest" toggle. Pin freezes at the current source revision; latest tracks live.
   - When a pinned link's source has advanced past the pinned revision, show a yellow drift badge on the link entry. Click "Update" to bump the pinned revision; tooltip lists the count of new commits.

4. **VV dialog "Revit Links" tab integration:** add a new tab to the existing `VVDialog.tsx` listing every `link_model` element and per-link visibility toggle.

5. **Project Browser left rail "Links" group:** new collapsible group listing all link_models with expand/collapse, eye toggle, drift badge.

6. **CLI subcommands:**
   - `bim-ai link --source <uuid> --pos x,y,z --align <mode>` creates a link
   - `bim-ai unlink <link_id>` deletes a link
   - `bim-ai links` lists all links in the current model with their pin/drift status

7. **Tests:**
   - `app/tests/test_link_model_visibility_mode.py`
   - `app/tests/test_link_model_alignment_modes.py`
   - `app/tests/test_link_model_revision_pinning.py`
   - `packages/web/src/workspace/ManageLinksDialog.driftBadge.test.tsx`
   - `packages/web/src/workspace/VVDialog.linksTab.test.tsx`
   - `packages/cli/cli.linkSubcommands.test.mjs`

**Acceptance.** Link a structural model into the host with `originAlignmentMode: 'project_origin'`; pin the link at revision 5; modify the source so its revision advances to 7; reopen the host; the link shows a drift badge "+2 revisions"; clicking "Update" bumps the pinned revision to 7. CLI `bim-ai links` lists this with pin status. VV dialog "Revit Links" tab toggles visibility per link.

After this WP ships, mark FED-01 in tracker as: `done in <hash> — full federation primitive including per-link visibility, all alignment modes, revision pinning UI, drift badges, CLI subcommands, VV integration, project-browser group`.

**Effort:** 7-9 hours.

---

## 2. File ownership and conflict avoidance

**You own:**
- For Path A: see wave2-8.md ownership
- For Path B: `ManageLinksDialog.tsx`, `VVDialog.tsx` (links tab only), CLI link subcommands

**Shared territory:**
- `core/index.ts`, `elements.py`, `commands.py`, `engine.py` — append additions
- `app/bim_ai/export_ifc.py` (Path A only — yours alone)
- `spec/workpackage-master-tracker.md` — only your assigned WPs

**Avoid:**
- All other agents' files

---

## 3. Go

Spawn worktree, run the triage step at the top, then take Path A or Path B. Don't try to do both — commit fully to one based on triage.
