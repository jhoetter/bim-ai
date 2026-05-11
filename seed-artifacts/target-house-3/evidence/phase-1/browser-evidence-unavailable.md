# Browser Evidence Unavailable

Command:

```bash
python3 claude-skills/sketch-to-bim/sketch_bim.py browser-evidence --seed target-house-3 --phase 1 --model 9bb9a145-d9ce-5a2f-a748-bb5be3301b30
```

Result:

```text
page.waitForSelector: Timeout 30000ms exceeded.
waiting for locator('[data-testid="app-shell"]') to be visible
```

Root cause observed in the Playwright failure screenshot: Vite parse error in `packages/web/src/workspace/Workspace.tsx` at line 132 due to `<<<<<<< Updated upstream`.
