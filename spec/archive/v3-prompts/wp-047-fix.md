# WP-047-fix — CHR-V3-08: Add CLI/REST command layer and agent-callable tests

**Branch:** feat/v3-chr-v3-08-tool-modifier-bar
**Base review:** FAIL — the frontend implementation is complete and correct; only the agent-callable backend layer is missing.

## Required reading

- spec/v3-prompts/wp-047.md (original spec — re-read end-to-end, especially §A Agent Instructions)
- packages/cli/cli.mjs (CLI surface pattern)
- app/bim_ai/commands.py (command model pattern)
- app/bim_ai/engine.py (dispatch pattern)
- app/bim_ai/tools.py (tool descriptor registration, if it exists)
- Existing tests in app/tests/cli/ and app/tests/api/ for pattern reference

## Setup

```bash
git fetch origin
git checkout feat/v3-chr-v3-08-tool-modifier-bar
git pull origin feat/v3-chr-v3-08-tool-modifier-bar
```

## The single failing criterion

The WP implementation rules state: "Modifier flips that mutate session-level toolPrefs must be
commandable and logged. Add tests at the agent-callable layer (tests/cli/, tests/api/)."

The shipped code is 100% frontend. The backend has no knowledge of toolPrefs. An external AI
agent cannot read or set tool preferences via the CLI or REST surface.

## What to add

### 1. Python command model

In `app/bim_ai/commands.py`, add:

```python
class SetToolPrefCmd(BaseModel):
    kind: Literal["SetToolPrefCmd"]
    tool: str         # e.g. "wall", "door", "window"
    pref_key: str     # e.g. "alignment", "swingSide"
    pref_value: str   # serialised value (e.g. "exterior", "right", "2")
```

Add `SetToolPrefCmd` to the `Command` union.

### 2. Engine dispatch

In `app/bim_ai/engine.py`, add a case for `SetToolPrefCmd`:
- Store the pref in the document's session metadata (or a `tool_prefs` dict on the document)
- Emit a `tool_pref_changed` activity log entry with `{tool, pref_key, pref_value}`

### 3. CLI entry (API-V3-01 requirement)

Add to `packages/cli/cli.mjs`:

```
bim-ai tool-pref set --tool <tool> --pref <key> --value <value> --model <model-id>
```

This calls `POST /api/v3/models/{id}/apply` with a single `SetToolPrefCmd` bundle.
Register the tool descriptor in the Python tool list per API-V3-01.

### 4. Agent-callable tests

Create `app/tests/api/test_tool_pref.py` with:
- `test_set_tool_pref_stores_value` — POST a SetToolPrefCmd, assert the pref is persisted.
- `test_set_tool_pref_emits_activity` — POST a SetToolPrefCmd, assert a `tool_pref_changed`
  activity entry is present in the activity log.
- `test_cli_tool_pref_round_trip` — if you can test CLI dispatch via subprocess or TestClient.

Use the real `routes_api` router and TestClient pattern.

## What NOT to change

The frontend implementation (ToolModifierBar, toolPrefsStore, all TSX/TS files) is correct
and should not be modified. Do not re-implement or alter the Zustand store — it is the UI
layer. The backend command is the agent-callable mirror of what the UI store already does.

## Verify gate

```bash
pnpm exec tsc --noEmit
pnpm test
make verify
```

## Commit and push

```bash
git add app/bim_ai/commands.py app/bim_ai/engine.py packages/cli/cli.mjs app/tests/api/test_tool_pref.py
git commit -m "fix(chr): add SetToolPrefCmd + CLI + agent-callable tests for toolPrefs per API-V3-01"
git push origin feat/v3-chr-v3-08-tool-modifier-bar
```

## Final report

Paste back: branch, final commit SHA, make verify result, and whether all three agent-callable criteria (command, CLI, tests) are now present.
