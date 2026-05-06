# bim-ai — Claude Code instructions

## Before every commit

Run `pnpm format` before committing. The pre-commit hook does this automatically for staged files, but running it explicitly avoids surprises.

CI runs `pnpm verify` which starts with `pnpm format:check` — unformatted files will fail the build.
