# WP-045-fix — OUT-V3-01: Add CLI surface, fix durable storage, fix allowMeasurement/Comment, add WS revoke test

**Branch:** feat/v3-out-v3-01-live-web-link
**Base review:** FAIL (see wp-045.md for original spec)
**Fix target:** Four gaps. The implementation is structurally sound; these are gaps in the CLI surface, data durability, response completeness, and test coverage.

## Required reading

- spec/v3-prompts/wp-045.md (original spec — re-read end-to-end)
- packages/cli/cli.mjs (CLI surface)
- app/bim_ai/routes_api.py (presentation routes)
- app/bim_ai/document.py and app/bim_ai/elements.py (PublicLinkRecord model)
- app/tests/test_out_v3_01.py (existing tests)

## Setup

```bash
git fetch origin
git checkout feat/v3-out-v3-01-live-web-link
git pull origin feat/v3-out-v3-01-live-web-link
```

## CONFLICT WARNING

Other branches (feat/v3-img-v3-01-image-to-layout, feat/v3-mrk-v3-03-sheet-review) contain
copies of these same presentation routes. When those branches are eventually fixed, their
workers will remove those duplicate routes. Do not worry about those other branches — focus
only on making this branch correct. Merge conflicts will be resolved at merge time.

## Failures to fix

### 1. CLI `bim-ai publish --link` missing (API-V3-01 hard requirement)

Add to `packages/cli/cli.mjs`:
- `bim-ai publish --link --model <model-id> [--display-name <str>] [--allow-measurement] [--allow-comment]`
  → calls `POST /api/v3/models/{id}/presentations`, prints the returned URL
- `bim-ai publish --revoke <link-id>` → calls `POST /api/v3/presentations/{id}/revoke`
- `bim-ai publish --list --model <model-id>` → calls `GET /api/v3/models/{id}/presentations`,
  prints each link's URL and revocation status

Register JSON schema tool descriptors in `app/bim_ai/tools.py` (or wherever tool descriptors
live) per API-V3-01 contract.

### 2. `allowMeasurement` and `allowComment` not returned by `GET /p/:token`

The `resolve_presentation_token` function in `routes_api.py` looks up only the `PublicLinkRecord`
but not the extra flags. Fix this by:
- Adding `allow_measurement: bool = True` and `allow_comment: bool = True` as columns to
  `PublicLinkRecord` (with Alembic migration or equivalent for the in-process DB).
- Reading them from the record in `resolve_presentation_token` and including them in the
  JSON response body alongside `modelId`, `revision`, `elements`, and `wsUrl`.

### 3. `_presentation_data` in-memory dict — not durable

Replace `_presentation_data` (a process-level Python dict keyed by `link_id`) with the DB
columns added in item 2 above. After this fix, `allow_measurement`, `allow_comment`, and
`page_scope_ids` must all be stored in the `PublicLinkRecord` row — not in a Python dict.

### 4. Active-session WS revoke-push test missing

The WP's acceptance criterion ("incognito viewer shows 'presentation revoked' in <1 s") requires
a test that opens a WS connection and then revokes the link while the connection is open.
Add to `app/tests/test_out_v3_01.py`:

```python
async def test_revoke_pushes_to_active_ws_session():
    # 1. Create a presentation link
    # 2. Connect a WS client to /p/{token}/ws
    # 3. Call POST /presentations/{id}/revoke
    # 4. Assert the WS client received {"type": "revoked"} within 1 s
    # 5. Assert the WS connection is subsequently closed
```

Use `pytest-anyio` / `httpx` / `starlette.testclient.TestClient` patterns consistent with
the existing test suite.

### 5. rgba() literals in `SharePresentationModal.tsx`

Replace `rgba(0,0,0,0.4)` and `rgba(0,0,0,0.24)` in the modal backdrop and box-shadow
with CSS token variables: `var(--color-overlay)` and `var(--shadow-modal)` respectively.
Add these tokens to `tokens-v3.css` if they don't exist yet (with the same rgba values as
their defaults, so the visual output is unchanged).

## Verify gate

```bash
pnpm exec tsc --noEmit
pnpm test
make verify
```

## Commit and push

```bash
git add <specific files only>
git commit -m "fix(out): add CLI surface, durable storage, allowMeasurement/Comment, WS revoke test, remove rgba literals"
git push origin feat/v3-out-v3-01-live-web-link
```

## Final report

Paste back: branch, final commit SHA, make verify result, which of the 5 gaps are closed.
