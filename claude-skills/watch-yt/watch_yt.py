#!/usr/bin/env python3
"""Watch a YouTube video and return granular timestamped descriptions via Gemini.

Short videos (≤60 min): YouTube URL passed directly — no download.
Long videos (>60 min):  split into ~55-min chunks, each downloaded, uploaded to
                        Gemini Files API, and analysed in parallel. Chunk results
                        are cached to disk so an interrupted job can resume from
                        where it left off.

Optional --screenshots flag extracts a frame at every timestamp by seeking
directly in the stream — no full download required. Stream URLs are
automatically re-fetched on expiry so very long screenshot jobs don't stall.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
import tempfile
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

from dotenv import load_dotenv
from google import genai
from google.genai import types

load_dotenv()

# Keep each chunk safely under Gemini 2.5 Flash's 1M-token context limit
# (~258 tokens/sec → 1M tokens ≈ 64 min; use 55 min to leave headroom).
_CHUNK_SECS     = 55 * 60
_UPLOAD_WORKERS = 4   # parallel Gemini chunk upload+analyse jobs
_FRAME_WORKERS  = 8   # parallel ffmpeg screenshot extractions
_MAX_RETRIES    = 5
_BASE_BACKOFF   = 60  # seconds — for rate-limit exponential backoff

_TEXT_PROMPT = """\
Watch this video carefully and produce a granular, timestamped breakdown
of exactly what is shown and heard.

Format each entry as:
  [HH:MM:SS] <concise description of what is happening>

Rules:
- Use real video timestamps (hours:minutes:seconds), not invented ones.
- Write a new entry every time the scene, topic, speaker, or action changes.
- Be specific: name visible UI elements, code, text on screen, spoken concepts.
- Cover the full video from start to finish.
- Do not summarise — give a dense, step-by-step log a developer could use to
  find any moment without watching the video themselves.
"""

_JSON_PROMPT = """\
Watch this video carefully and produce a granular, timestamped breakdown
of exactly what is shown and heard.

Respond with a JSON array only — no markdown, no extra text.
Each element must have exactly these keys:
  "ts"   : timestamp as "HH:MM:SS"
  "desc" : concise description of what is happening at that moment

Rules:
- Use real video timestamps (hours:minutes:seconds), not invented ones.
- Write a new entry every time the scene, topic, speaker, or action changes.
- Be specific: name visible UI elements, code, text on screen, spoken concepts.
- Cover the full video from start to finish.
- Do not summarise — give a dense, step-by-step log a developer could use to
  find any moment without watching the video themselves.

Example output:
[
  {"ts": "00:00:00", "desc": "Title card appears — ..."},
  {"ts": "00:00:12", "desc": "Speaker introduces ..."}
]
"""

# ── timestamp helpers ─────────────────────────────────────────────────────────

def _ts_to_seconds(ts: str) -> float:
    parts = ts.split(":")
    if len(parts) == 3:
        return int(parts[0]) * 3600 + int(parts[1]) * 60 + float(parts[2])
    if len(parts) == 2:
        return int(parts[0]) * 60 + float(parts[1])
    return float(parts[0])


def _seconds_to_ts(secs: float) -> str:
    secs = int(secs)
    h, rem = divmod(secs, 3600)
    m, s   = divmod(rem, 60)
    return f"{h:02d}:{m:02d}:{s:02d}"


def _parse_json_entries(raw: str) -> list[dict]:
    raw = re.sub(r"^```[^\n]*\n?", "", raw.strip())
    raw = re.sub(r"\n?```$",       "", raw.strip())
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        # Regex fallback: salvage entries even when surrounding array is malformed.
        matches = re.findall(
            r'\{\s*"ts"\s*:\s*"([^"]+)"\s*,\s*"desc"\s*:\s*"((?:[^"\\]|\\.)*)"\s*\}', raw
        )
        if matches:
            return [{"ts": ts, "desc": desc} for ts, desc in matches]
        raise

# ── yt-dlp helpers ────────────────────────────────────────────────────────────

def _clean_url(youtube_url: str) -> str:
    """Strip playlist/index params — keep only the bare video URL."""
    import urllib.parse as _up
    p  = _up.urlparse(youtube_url)
    qs = {k: v for k, v in _up.parse_qs(p.query).items() if k == "v"}
    return _up.urlunparse(p._replace(query=_up.urlencode(qs, doseq=True)))


def _get_duration(youtube_url: str) -> float:
    result = subprocess.run(
        ["yt-dlp", "--quiet", "--print", "duration", youtube_url],
        check=True, capture_output=True, text=True,
    )
    return float(result.stdout.strip())


def _get_stream_url(youtube_url: str) -> str:
    result = subprocess.run(
        ["yt-dlp", "--quiet", "-f", "bestvideo[ext=mp4]/bestvideo", "--get-url", youtube_url],
        check=True, capture_output=True, text=True,
    )
    return result.stdout.strip().splitlines()[0]

# ── Gemini rate-limit helpers (ported from hof-video/rater.py) ────────────────

def _is_rate_limit(exc: Exception) -> bool:
    txt = str(exc)
    return "429" in txt or "RESOURCE_EXHAUSTED" in txt


def _parse_retry_delay(exc: Exception) -> float | None:
    txt = str(exc)
    m = re.search(r"retry\s+in\s+([\d.]+)s", txt, re.IGNORECASE)
    if m:
        return float(m.group(1))
    m = re.search(r"retryDelay.*?'(\d+)s'", txt)
    if m:
        return float(m.group(1))
    return None


def _gemini_generate(client: genai.Client, model: str, contents: list) -> str:
    """generate_content with exponential back-off on rate-limit errors."""
    last_exc: Exception | None = None
    for attempt in range(_MAX_RETRIES):
        try:
            response = client.models.generate_content(model=model, contents=contents)
            return response.text
        except Exception as exc:
            if not _is_rate_limit(exc):
                raise
            last_exc = exc
            delay = _parse_retry_delay(exc) or (_BASE_BACKOFF * (2 ** attempt))
            delay  = min(delay + 5, 300)
            print(
                f"  Gemini rate-limited (attempt {attempt+1}/{_MAX_RETRIES}), "
                f"waiting {delay:.0f}s …",
                file=sys.stderr,
            )
            time.sleep(delay)
    raise last_exc  # type: ignore[misc]


def _wait_for_file_active(client: genai.Client, name: str, timeout: int = 300) -> None:
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        f = client.files.get(name=name)
        if f.state == "ACTIVE":
            return
        time.sleep(3)
    raise TimeoutError(f"Gemini file {name} never became ACTIVE")

# ── Gemini call wrappers ──────────────────────────────────────────────────────

def _gemini_youtube(youtube_url: str, api_key: str, model: str, prompt: str) -> str:
    """Analyse a short video via its YouTube URL — no upload needed."""
    client   = genai.Client(api_key=api_key)
    contents = [
        types.Part(file_data=types.FileData(file_uri=youtube_url, mime_type="video/mp4")),
        prompt,
    ]
    return _gemini_generate(client, model, contents)


def _gemini_file(file_path: Path, api_key: str, model: str, prompt: str) -> str:
    """Upload a local video file to Gemini Files API and analyse it."""
    client = genai.Client(api_key=api_key)
    print(f"  uploading {file_path.name} …", file=sys.stderr)
    uploaded = client.files.upload(
        file=str(file_path),
        config=types.UploadFileConfig(mime_type="video/mp4"),
    )
    _wait_for_file_active(client, uploaded.name)
    contents = [
        types.Part(file_data=types.FileData(file_uri=uploaded.uri, mime_type="video/mp4")),
        prompt,
    ]
    try:
        return _gemini_generate(client, model, contents)
    finally:
        try:
            client.files.delete(name=uploaded.name)
        except Exception:
            pass


def _parse_with_retry(fetch_fn, label: str = "") -> list[dict]:
    for attempt in range(3):
        if attempt:
            print(
                f"  JSON parse failed{' for ' + label if label else ''} "
                f"(attempt {attempt+1}/3), retrying …",
                file=sys.stderr,
            )
        raw = fetch_fn()
        try:
            return _parse_json_entries(raw)
        except json.JSONDecodeError:
            if attempt == 2:
                raise

# ── chunk caching ─────────────────────────────────────────────────────────────

def _chunk_cache_path(out_dir: Path, i: int) -> Path:
    return out_dir / ".chunks" / f"chunk_{i:03d}.json"

# ── short-video path (<= 60 min) ──────────────────────────────────────────────

def _analyse_short(youtube_url: str, api_key: str, model: str, want_json: bool) -> list[dict] | str:
    prompt = _JSON_PROMPT if want_json else _TEXT_PROMPT
    if want_json:
        return _parse_with_retry(lambda: _gemini_youtube(youtube_url, api_key, model, prompt))
    return _gemini_youtube(youtube_url, api_key, model, prompt)

# ── long-video path (> 60 min) ────────────────────────────────────────────────

def _download_chunk(youtube_url: str, start: float, end: float, dest: Path) -> Path:
    out_tmpl = str(dest / "chunk.%(ext)s")
    section  = f"*{_seconds_to_ts(start)}-{_seconds_to_ts(end)}"
    subprocess.run(
        [
            "yt-dlp", "--quiet",
            "-f", "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best",
            "--download-sections", section,
            # No --force-keyframes-at-cuts: avoids slow re-encoding at boundaries;
            # a few seconds of slop is irrelevant for Gemini analysis.
            "-o", out_tmpl,
            youtube_url,
        ],
        check=True,
    )
    return next(dest.glob("chunk.*"))


def _analyse_chunk(
    youtube_url: str,
    api_key: str,
    model: str,
    chunk_idx: int,
    start_secs: float,
    end_secs: float,
    tmp_root: Path,
    out_dir: Path | None,
) -> list[dict]:
    # Resume: return cached result if available
    if out_dir is not None:
        cache = _chunk_cache_path(out_dir, chunk_idx)
        if cache.exists():
            print(f"  chunk {chunk_idx+1}: resuming from cache", file=sys.stderr)
            return json.loads(cache.read_text())

    chunk_dir = tmp_root / f"chunk_{chunk_idx:03d}"
    chunk_dir.mkdir()
    print(
        f"  chunk {chunk_idx+1}: downloading {_seconds_to_ts(start_secs)}–{_seconds_to_ts(end_secs)} …",
        file=sys.stderr,
    )
    chunk_path = _download_chunk(youtube_url, start_secs, end_secs, chunk_dir)

    entries = _parse_with_retry(
        lambda: _gemini_file(chunk_path, api_key, model, _JSON_PROMPT),
        label=f"chunk {chunk_idx+1}",
    )

    # Offset timestamps from chunk-relative to absolute
    for e in entries:
        abs_secs = _ts_to_seconds(e["ts"]) + start_secs
        e["ts"]  = _seconds_to_ts(abs_secs)

    # Persist so a restart can skip this chunk
    if out_dir is not None:
        cache = _chunk_cache_path(out_dir, chunk_idx)
        cache.parent.mkdir(parents=True, exist_ok=True)
        cache.write_text(json.dumps(entries))

    return entries


def _analyse_long(
    youtube_url: str,
    api_key: str,
    model: str,
    duration: float,
    out_dir: Path | None = None,
) -> list[dict]:
    starts = list(range(0, int(duration), _CHUNK_SECS))
    n      = len(starts)
    print(
        f"Video is {_seconds_to_ts(duration)} long → "
        f"splitting into {n} chunks of ~{_CHUNK_SECS//60} min",
        file=sys.stderr,
    )

    with tempfile.TemporaryDirectory() as tmp:
        tmp_root = Path(tmp)

        with ThreadPoolExecutor(max_workers=_UPLOAD_WORKERS) as pool:
            futures = {
                pool.submit(
                    _analyse_chunk,
                    youtube_url, api_key, model,
                    i, start, min(start + _CHUNK_SECS, duration),
                    tmp_root, out_dir,
                ): i
                for i, start in enumerate(starts)
            }
            chunk_results: dict[int, list[dict]] = {}
            for fut in as_completed(futures):
                i = futures[fut]
                chunk_results[i] = fut.result()
                print(f"  chunk {i+1}/{n} done ({len(chunk_results[i])} entries)", file=sys.stderr)

    all_entries: list[dict] = []
    for i in range(n):
        all_entries.extend(chunk_results[i])
    all_entries.sort(key=lambda e: _ts_to_seconds(e["ts"]))
    return all_entries

# ── screenshot extraction ─────────────────────────────────────────────────────

def _extract_screenshots(
    entries: list[dict],
    stream_url: str,
    youtube_url: str,
    out_dir: Path,
) -> None:
    print(f"Extracting {len(entries)} screenshots in parallel …", file=sys.stderr)

    # Mutable box so threads can share a refreshed URL without a global.
    url_box = [stream_url]

    def _grab(args: tuple) -> tuple[int, str]:
        i, entry = args
        secs     = _ts_to_seconds(entry["ts"])
        safe_ts  = entry["ts"].replace(":", "-")
        out_png  = out_dir / f"{i+1:04d}_{safe_ts}.png"

        for attempt in range(2):
            result = subprocess.run(
                ["ffmpeg", "-loglevel", "error",
                 "-ss", str(secs), "-i", url_box[0],
                 "-frames:v", "1", "-q:v", "2", str(out_png)],
            )
            if result.returncode == 0:
                return i, out_png.name
            if attempt == 0:
                # Likely an expired CDN URL — re-fetch and retry once
                print(f"  stream URL may have expired, re-fetching …", file=sys.stderr)
                url_box[0] = _get_stream_url(youtube_url)

        raise subprocess.CalledProcessError(result.returncode, "ffmpeg")

    results: dict[int, str] = {}
    with ThreadPoolExecutor(max_workers=_FRAME_WORKERS) as pool:
        futures = {pool.submit(_grab, (i, e)): i for i, e in enumerate(entries)}
        for fut in as_completed(futures):
            i, name = fut.result()
            results[i] = name
            print(f"  [{entries[i]['ts']}] → {name}", file=sys.stderr)

    for i, entry in enumerate(entries):
        entry["screenshot"] = results[i]

# ── public API ────────────────────────────────────────────────────────────────

def watch(youtube_url: str, api_key: str, model: str = "gemini-2.5-flash") -> str:
    duration = _get_duration(youtube_url)
    if duration <= _CHUNK_SECS:
        return _gemini_youtube(youtube_url, api_key, model, _TEXT_PROMPT)
    entries = _analyse_long(youtube_url, api_key, model, duration)
    return "\n".join(f"[{e['ts']}] {e['desc']}" for e in entries)


def watch_with_screenshots(
    youtube_url: str,
    api_key: str,
    out_dir: Path,
    model: str = "gemini-2.5-flash",
) -> str:
    out_dir.mkdir(parents=True, exist_ok=True)
    duration = _get_duration(youtube_url)

    if duration <= _CHUNK_SECS:
        print("Asking Gemini to analyse the video …", file=sys.stderr)
        entries = _analyse_short(youtube_url, api_key, model, want_json=True)
    else:
        entries = _analyse_long(youtube_url, api_key, model, duration, out_dir=out_dir)

    print("Resolving stream URL …", file=sys.stderr)
    stream_url = _get_stream_url(youtube_url)
    _extract_screenshots(entries, stream_url, youtube_url, out_dir)

    lines = []
    for entry in entries:
        lines.append(f"[{entry['ts']}] {entry['desc']}")
        lines.append(f"         → {entry.get('screenshot', '')}")
    log_text = "\n".join(lines)
    (out_dir / "log.txt").write_text(log_text)

    print(f"\nScreenshots + log written to: {out_dir.resolve()}", file=sys.stderr)
    return log_text

# ── CLI ───────────────────────────────────────────────────────────────────────

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

    url = _clean_url(args.url)
    if args.screenshots:
        result = watch_with_screenshots(url, api_key, Path(args.screenshots), model=args.model)
    else:
        result = watch(url, api_key, model=args.model)

    print(result)


if __name__ == "__main__":
    main()
