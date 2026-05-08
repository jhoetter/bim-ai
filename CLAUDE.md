# bim-ai — Claude Code instructions

## Formatting

Prettier runs automatically after every Edit/Write via the Claude Code PostToolUse hook — no manual `pnpm format` needed.

The git pre-commit hook also re-formats staged files as a safety net. CI fails on `pnpm format:check`, so both layers must stay in place.

## Skills (claude-skills/)

Project-level skills live at `claude-skills/<name>/SKILL.md`. They encode methodology + tool catalogs for recurring complex tasks. Read the skill's frontmatter `description:` field to decide whether it applies.

**Currently shipped:**

- **`claude-skills/sketch-to-bim/SKILL.md`** — load this skill whenever a task asks you to author or extend a bim-ai BIM model from a customer sketch (line drawing, render, photo, hand sketch) plus a brief. Trigger phrases include "build a BIM model from this sketch", "seed the house from this sketch / from `spec/target-house-seed*.{md,png}`", "generate a BIM model that matches this drawing". The skill defines the phased architect's workflow — massing → skeleton → envelope → openings → interior → detail → documentation — with per-phase visual checkpoints, soundness validation, an iteration loop, and the anti-patterns that caused the 2026-05-07 seed-fidelity failure.

- **`claude-skills/watch-yt/SKILL.md`** — load this skill whenever the user shares a YouTube URL and asks you to watch, summarise, or reason about the video content. Run `python3 claude-skills/watch-yt/watch_yt.py "<URL>"` from the repo root; Gemini watches the full video and returns a granular timestamped log you can reason over.

When a task matches a skill's trigger description, **read the SKILL.md end-to-end before authoring anything**.
