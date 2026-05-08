---
name: watch-yt
description: Use this skill whenever the user asks Claude to "watch a video", "look at this YouTube link", "describe what happens in this video", or hands over a YouTube URL and wants to know its content. The skill runs a tiny Python script that passes the URL to Gemini, which watches the full video and returns a granular timestamped log (one entry per scene/topic/action change). Use the output to answer the user's question — summarise, find a moment, or reason over the content.
---

# Watch-YT — let Gemini watch a YouTube video for you

You cannot watch videos yourself. This skill delegates that to Gemini via a one-shot Python script and hands you back a dense, timestamped transcript you can reason over.

## When to use

Trigger phrases:
- "watch this video": `https://www.youtube.com/watch?v=…`
- "what happens in this YT link"
- "describe the video at [URL]"
- "summarise this YouTube video"
- any message containing a YouTube URL where the user wants content information

## How to run

```bash
# Text log only (fast)
python3 claude-skills/watch-yt/watch_yt.py "<YOUTUBE_URL>"

# Text log + frame screenshots extracted at every timestamp
python3 claude-skills/watch-yt/watch_yt.py "<YOUTUBE_URL>" --screenshots /tmp/my-video
```

Run from the repo root (`/Users/jhoetter/repos/bim-ai`). The script reads
`GEMINI_API_KEY` from `.env` automatically.

Optional flags:
- `--model gemini-2.5-pro` — higher quality analysis on complex videos
- `--screenshots <dir>` — also download the video (via yt-dlp) and extract a
  PNG frame at every timestamp with ffmpeg; writes `log.txt` + numbered PNGs

## What you get back

**Text mode** — a plain-text timestamped log:

```
[00:00] Intro screen — title card "Building a BIM Model from Scratch"
[00:12] Speaker introduces themselves, explains the agenda for the session
[01:05] Opens the bim-ai dev environment; shows the empty canvas
...
```

**Screenshot mode** — the same log plus a directory of numbered PNGs:

```
/tmp/my-video/
  001_00-00.png
  002_00-12.png
  003_01-05.png
  ...
  log.txt
```

## What to do with it

- **Summarise**: condense the log into a paragraph for the user.
- **Find a moment**: locate the timestamp where X happens and report it.
- **Answer a question**: reason over the log to answer content questions.
- **Use in downstream tasks**: if the video is a tutorial relevant to the
  current code task, extract relevant steps from the log and apply them.

## Dependencies

- `google-genai>=1.65.0` — already in the conda env on this machine.
- `python-dotenv` — for `.env` loading.
- `GEMINI_API_KEY` in `.env` — see `.env.example` for the variable name.

## Limitations

- Gemini can watch videos up to ~1 hour reliably; very long videos may be
  truncated.
- Private or age-restricted YouTube videos will fail with a permissions error.
- Timestamp precision is ±5 s on fast-paced content; verify exact frames
  manually if precision matters.
