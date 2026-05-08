#!/usr/bin/env python3
"""Watch a YouTube video and return granular timestamped descriptions via Gemini.

Optional --screenshots flag resolves the direct stream URL via yt-dlp and lets
ffmpeg seek to each timestamp in the stream — no full download required.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

from dotenv import load_dotenv
from google import genai
from google.genai import types

load_dotenv()

_TEXT_PROMPT = """\
Watch this YouTube video carefully and produce a granular, timestamped breakdown
of exactly what is shown and heard.

Format each entry as:
  [MM:SS] <concise description of what is happening>

Rules:
- Use real video timestamps (minutes:seconds), not invented ones.
- Write a new entry every time the scene, topic, speaker, or action changes.
- Be specific: name visible UI elements, code, text on screen, spoken concepts.
- Cover the full video from start to finish.
- Do not summarise — give a dense, step-by-step log a developer could use to
  find any moment without watching the video themselves.
"""

_JSON_PROMPT = """\
Watch this YouTube video carefully and produce a granular, timestamped breakdown
of exactly what is shown and heard.

Respond with a JSON array only — no markdown, no extra text.
Each element must have exactly these keys:
  "ts"   : timestamp as "MM:SS"
  "desc" : concise description of what is happening at that moment

Rules:
- Use real video timestamps (minutes:seconds), not invented ones.
- Write a new entry every time the scene, topic, speaker, or action changes.
- Be specific: name visible UI elements, code, text on screen, spoken concepts.
- Cover the full video from start to finish.
- Do not summarise — give a dense, step-by-step log a developer could use to
  find any moment without watching the video themselves.

Example output:
[
  {"ts": "00:00", "desc": "Title card appears — ..."},
  {"ts": "00:12", "desc": "Speaker introduces ..."}
]
"""


def _ts_to_seconds(ts: str) -> float:
    parts = ts.split(":")
    if len(parts) == 2:
        return int(parts[0]) * 60 + float(parts[1])
    return float(parts[0])


def _call_gemini(youtube_url: str, api_key: str, model: str, prompt: str) -> str:
    client = genai.Client(api_key=api_key)
    response = client.models.generate_content(
        model=model,
        contents=[
            types.Part(
                file_data=types.FileData(
                    file_uri=youtube_url,
                    mime_type="video/mp4",
                )
            ),
            prompt,
        ],
    )
    return response.text


def watch(youtube_url: str, api_key: str, model: str = "gemini-2.5-flash") -> str:
    return _call_gemini(youtube_url, api_key, model, _TEXT_PROMPT)


def _get_stream_url(youtube_url: str) -> str:
    """Return the direct video stream URL without downloading anything."""
    result = subprocess.run(
        [
            "yt-dlp",
            "--quiet",
            "-f", "bestvideo[ext=mp4]/bestvideo",
            "--get-url",
            youtube_url,
        ],
        check=True,
        capture_output=True,
        text=True,
    )
    return result.stdout.strip().splitlines()[0]


def watch_with_screenshots(
    youtube_url: str,
    api_key: str,
    out_dir: Path,
    model: str = "gemini-2.5-flash",
) -> str:
    """Run Gemini analysis, then extract frames by seeking in the stream — no full download."""
    out_dir.mkdir(parents=True, exist_ok=True)

    # 1. Ask Gemini for structured JSON (retry once on parse failure)
    entries: list[dict] = []
    for attempt in range(2):
        if attempt:
            print("JSON parse failed, retrying Gemini …", file=sys.stderr)
        else:
            print("Asking Gemini to analyse the video …", file=sys.stderr)
        raw = _call_gemini(youtube_url, api_key, model, _JSON_PROMPT)
        raw = re.sub(r"^```[^\n]*\n?", "", raw.strip())
        raw = re.sub(r"\n?```$", "", raw.strip())
        try:
            entries = json.loads(raw)
            break
        except json.JSONDecodeError:
            if attempt == 1:
                raise

    # 2. Resolve the direct stream URL (fast — no download)
    print("Resolving stream URL …", file=sys.stderr)
    stream_url = _get_stream_url(youtube_url)

    # 3. Extract frames in parallel — each ffmpeg only fetches the nearby stream segment
    print(f"Extracting {len(entries)} screenshots in parallel …", file=sys.stderr)

    def _extract_frame(args: tuple) -> tuple[int, str]:
        i, entry = args
        secs = _ts_to_seconds(entry["ts"])
        safe_ts = entry["ts"].replace(":", "-")
        out_png = out_dir / f"{i+1:03d}_{safe_ts}.png"
        subprocess.run(
            [
                "ffmpeg", "-loglevel", "error",
                "-ss", str(secs),
                "-i", stream_url,
                "-frames:v", "1",
                "-q:v", "2",
                str(out_png),
            ],
            check=True,
        )
        return i, out_png.name

    results: dict[int, str] = {}
    with ThreadPoolExecutor(max_workers=8) as pool:
        futures = {pool.submit(_extract_frame, (i, e)): i for i, e in enumerate(entries)}
        for fut in as_completed(futures):
            i, name = fut.result()
            results[i] = name
            print(f"  [{entries[i]['ts']}] → {name}", file=sys.stderr)

    for i, entry in enumerate(entries):
        entry["screenshot"] = results[i]

    # 4. Write text log
    lines = []
    for entry in entries:
        lines.append(f"[{entry['ts']}] {entry['desc']}")
        lines.append(f"         → {entry.get('screenshot', '')}")
    log_text = "\n".join(lines)
    (out_dir / "log.txt").write_text(log_text)

    print(f"\nScreenshots + log written to: {out_dir.resolve()}", file=sys.stderr)
    return log_text


def main() -> None:
    parser = argparse.ArgumentParser(description="Timestamped YouTube video description via Gemini")
    parser.add_argument("url", help="YouTube video URL")
    parser.add_argument("--model", default="gemini-2.5-flash", help="Gemini model to use")
    parser.add_argument(
        "--screenshots",
        metavar="OUTPUT_DIR",
        help="Also extract frame screenshots into this directory (requires yt-dlp + ffmpeg)",
    )
    args = parser.parse_args()

    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        print("ERROR: GEMINI_API_KEY not set", file=sys.stderr)
        sys.exit(1)

    if args.screenshots:
        result = watch_with_screenshots(
            args.url, api_key, Path(args.screenshots), model=args.model
        )
    else:
        result = watch(args.url, api_key, model=args.model)

    print(result)


if __name__ == "__main__":
    main()
