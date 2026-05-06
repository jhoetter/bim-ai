# bim-ai — Claude Code instructions

## Formatting

Prettier runs automatically after every Edit/Write via the Claude Code PostToolUse hook — no manual `pnpm format` needed.

The git pre-commit hook also re-formats staged files as a safety net. CI fails on `pnpm format:check`, so both layers must stay in place.
