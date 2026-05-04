# Reviewer summary — production parity batch (`e04c4bd`)

## Baseline

- **Commit:** `e04c4bd` on `main`.
- **Python CI:** green (ruff + pytest + IFC extras).
- **JS / Playwright CI:** `e04c4bd` hit `pnpm/action-setup` version drift (fixed by inferring pnpm from [`package.json`](../package.json) — see [.github/workflows/ci.yml](../.github/workflows/ci.yml)) and **`vite preview` proxying `/api` and `/ws` to `:8500`**, which broke mocked E2E. Mitigations:
  - [`packages/web/playwright.config.ts`](../packages/web/playwright.config.ts) sets **`webServer.env`** (`PREVIEW_NO_PROXY=1`, `VITE_E2E_DISABLE_WS=true`) and **`rm -rf dist && vite build`** before `vite preview` so tests never reuse **`pnpm verify`'s prod `dist/`** (which would otherwise open a real WebSocket and hit the dead `:8500` proxy). [`Workspace.tsx`](../packages/web/src/Workspace.tsx) skips the model socket when `VITE_E2E_DISABLE_WS` is baked into that E2E bundle.
  - [`packages/web/vite.config.ts`](../packages/web/vite.config.ts) sets **`preview.proxy` to an explicit `{}`** when `PREVIEW_NO_PROXY` / `E2E_NO_API_PROXY` is set (omitting `preview.proxy` lets Vite merge `server.proxy` into preview on some versions, resurrecting `:8500` forwards).
  - Evidence **`toHaveScreenshot`** baselines are namespaced **per Playwright `{platform}`** (`darwin/` vs `linux/`) — GitHub `ubuntu-latest` is **amd64**. Regenerate `linux/` after UI changes affecting screenshots:

```bash
docker run --platform linux/amd64 --rm -v \"$PWD:/workspace\" -w /workspace \\
  mcr.microsoft.com/playwright:v1.53.2-jammy \\
  bash -lc 'cd /workspace && find . -name node_modules -type d -prune -exec rm -rf {} + && \\
    corepack enable && corepack prepare pnpm@9.15.4 --activate && pnpm install && \\
    cd packages/web && pnpm exec playwright install chromium --with-deps && \\
    CI=true pnpm exec playwright test e2e/evidence-baselines.spec.ts --update-snapshots'
```

**Do not bind-mount `.pnpm-store` into the workspace** — keep the default global store location or `.pnpm-store/` is gitignored since `pnpm install` inside Docker recreated it under the repo.

## What shipped (high level)

- **Saved views:** Plan/orbit viewpoints editable and persisted via semantic property updates (`updateElementProperty`).
- **Sheets:** Replayable viewport authoring (`upsertSheetViewports`), `SheetCanvas` + authoring UI; keyed remount to keep viewport drafts in sync without invalid React patterns.
- **Sections / graphics:** Richer section-style SVG preview wiring; continued plan/projection and symbology work.
- **Schedules:** Optional grouping metadata on schedule filter upserts; toolbar sort/group; door/window `materialKey` in model + derivation + persisted column registry; property updates on doors/windows for type/material.
- **Validation:** Room programme consistency constraint (+ tests).
- **Open BIM:** IFC fills with optional material finish; export + read-back test when `ifcopenshell` is installed.
- **Agent / evidence:** Stronger mismatch notes where sheet/3D evidence rows lack expected PNG refs; Playwright/evidence correlation hints unchanged in CI.

## Collaboration flow (recommended)

- **Truth branch:** **`main`** is the integration line; optional PRs for review cadence only.
- **Next features:** Branch from **`main` after CI is fully green**:

  ```bash
  git checkout main && git pull
  git checkout -b parity/<topic-short-name>
  ```

## Review focus

- Prefer behavior + regression tests touched in `app/tests/` for schedules, IFC, constraints, sheet viewports, and door material updates.
- Web: hooks correctness in [`packages/web/src/workspace/SheetCanvas.tsx`](../packages/web/src/workspace/SheetCanvas.tsx); sheet authoring in [`packages/web/src/workspace/sheetViewportAuthoring.tsx`](../packages/web/src/workspace/sheetViewportAuthoring.tsx).
