# bim-ai — Claude Code instructions

## Scope: this is the modeling software, period

bim-ai is the engine — MCP surface, geometry kernel, viewer, IFC, constraint
checks, the Postgres `bim_models` store. **Reverse-BIM ingestion, reader
subagents, IR construction, bundle building from semantic intent, grading
loops, testhouse driver scripts — none of that lives here anymore.** It all
moved to [`bim-agent`](https://github.com/jhoetter/bim-agent) in the
2026-05-25 clean-separation work (see `bim-agent/spec/trackers/
bim-ai-bim-agent-clean-separation-tracker.md`).

If a task involves reading a house's PDFs, computing source facts, choosing
which CMD-V3 commands to emit, or scoring a rendered model against source
elevations — you're in the wrong repo. Switch your session to bim-agent.

## NON-NEGOTIABLE: open the screenshots before you grade

After every iter / build that produces ortho captures, you MUST use the Read tool to open the actual PNGs and look at them, not just the structured element counts. Pattern-matching "looks like a house" from the silhouette has repeatedly missed real defects (duplicate stacked roofs, dormers in wrong location, sub-grade walls, materials swapped per level, etc.).

Minimum eye-pass per house:
- North + south + east + west cardinal shaded captures (4 PNGs)
- At least one wireframe (`-wireframe.png`) for a view where the shaded version looks "off" — wireframe exposes interior geometry the shaded view hides
- For multi-level houses: confirm exactly ONE main roof. Element-count `roofs=2` is always a bug.

If a defect is visible in the screenshot but not in the element counts, file it as a `from: bim-agent` GH issue and embed the screenshot via a `raw.githubusercontent.com/jhoetter/bim-ai/main/evidence/...` URL.

## CI-parity checks

Before pushing, follow the relevant checklist in `AGENTS.md`. It records the
exact CI commands and pinned tool versions, including Node 20 + `pnpm@9.15.4`
for JavaScript/governance and Python 3.12 + `uv` for backend checks.

## Formatting

Prettier runs automatically after every Edit/Write via the Claude Code PostToolUse hook — no manual `pnpm format` needed.

The git pre-commit hook also re-formats staged files as a safety net. CI fails on `pnpm format:check`, so both layers must stay in place.

## Skills (claude-skills/)

Project-level skills live at `claude-skills/<name>/SKILL.md`. Read the skill's frontmatter `description:` field to decide whether it applies.

**Currently shipped:**

- **`claude-skills/watch-yt/SKILL.md`** — load this skill whenever the user shares a YouTube URL and asks you to watch, summarise, or reason about the video content. Run `python3 claude-skills/watch-yt/watch_yt.py "<URL>"` from the repo root; Gemini watches the full video and returns a granular timestamped log you can reason over.

The previous `sketch-to-bim` and `hybrid-reverse-bim` skills were methodology-heavy (architect's workflow, multi-pass reverse-BIM ingestion) and moved to bim-agent in the 2026-05-25 clean-separation work.
