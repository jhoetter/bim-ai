# WP-040-fix — DSC-V3-01: Remove IMG scope creep, add ToolDescriptor, discipline radio, tests

**Branch:** feat/v3-dsc-v3-01-discipline-tags
**Base review:** FAIL (see wp-040.md for original spec)
**Fix target:** Branch was started from the IMG branch instead of main, dragging in ~1,700 lines of unrelated IMG code. Clean it, then close the three remaining gaps.

## Required reading

- spec/v3-prompts/wp-040.md (original spec — re-read end-to-end)
- app/bim_ai/api/registry.py (tool descriptor registration)
- packages/web/src/inspector/InspectorDisciplineDropdown.tsx (or wherever the dropdown lives)
- app/tests/api/ (agent-callable test pattern)

## Setup

```bash
git fetch origin
git checkout feat/v3-dsc-v3-01-discipline-tags
git pull origin feat/v3-dsc-v3-01-discipline-tags
git log --oneline origin/main..HEAD
```

You will see two commits: one IMG commit (ac7f6bb6) and one DSC commit (ba80cbbc).
The IMG commit does not belong here. Remove it:

```bash
# Rebase only the DSC commit onto main, dropping the inherited IMG commit:
git rebase --onto origin/main ac7f6bb6 HEAD
# ac7f6bb6 is the IMG commit; --onto main means "replay commits after ac7f6bb6 onto main"
git push --force-with-lease origin feat/v3-dsc-v3-01-discipline-tags
```

If the rebase has conflicts (commands.py, elements.py, engine.py, routes_api.py all touched by
both), keep only DSC-relevant additions: `discipline` field on element types,
`SetElementDisciplineCmd`, `DEFAULT_DISCIPLINE_BY_KIND`, `InspectorDisciplineDropdown`, and the
`element-set-discipline` CLI entry. Remove IMG-specific code: `TraceImageCmd`, pipeline imports,
`ImageTraceDropZone.tsx`, `img-trace` ToolDescriptor, and the IMG route handler.

## Failures to fix (after removing IMG scope creep)

### 1. Missing ToolDescriptor for SetElementDiscipline (API-V3-01 violation)

Add a `ToolDescriptor` entry to `app/bim_ai/api/registry.py` for `set-element-discipline`:
- name: `"set-element-discipline"`
- description: `"Set the discipline tag (arch / struct / mep / site / gen) on one or more elements"`
- parameters JSON schema: `{ elementIds: string[], discipline: "arch"|"struct"|"mep"|"site"|"gen" }`
- commandKind: `"SetElementDisciplineCmd"`

### 2. "Default for this kind" radio missing from Inspector dropdown

The spec states "three options + a 'default for this kind' radio." In
`InspectorDisciplineDropdown.tsx`, below the three discipline `<option>` or radio buttons, add a
fourth option: "Default for kind" (value = `null`). When selected, the command should pass
`discipline: null` and the engine should reset the element's discipline to
`DEFAULT_DISCIPLINE_BY_KIND[element.kind]`.

### 3. No agent-callable layer tests

Create `app/tests/api/test_discipline_tags.py` with:
- `test_set_discipline_via_api` — POST a SetElementDisciplineCmd bundle to
  `POST /api/v3/models/{id}/apply`, assert the element's discipline is updated.
- `test_reset_to_default` — POST with `discipline: null`, assert the element returns to
  `DEFAULT_DISCIPLINE_BY_KIND` value.

Use the real `routes_api` router and TestClient pattern.

### 4. DEFAULT_DISCIPLINE_BY_KIND: add the missing kinds

Per the spec table, add these stubs (the kinds don't exist in the kernel yet, but the lookup
table should be complete so future kernel additions don't need to touch DSC-V3-01 code):
```python
"brace":      "struct",
"foundation": "struct",
"duct":       "mep",
"pipe":       "mep",
"fixture":    "mep",
```

Mirror these additions in `packages/core/src/index.ts` `DEFAULT_DISCIPLINE_BY_KIND` const.

### 5. ToposolidElem discipline field

Add `discipline: Optional[Discipline] = None` to `ToposolidElem` in `elements.py`
(and the corresponding TypeScript type in `packages/core/src/index.ts`).
This enables `setElementDiscipline` to be called on toposolid elements.

## Verify gate

```bash
pnpm exec tsc --noEmit
pnpm test
make verify
```

## Commit and push

```bash
git add <specific files only>
git commit -m "fix(dsc): remove IMG scope creep, add ToolDescriptor, discipline radio, API tests"
git push --force-with-lease origin feat/v3-dsc-v3-01-discipline-tags
```

## Final report

Paste back: branch, final commit SHA (after rebase), make verify result, which of the 5 gaps are closed.
