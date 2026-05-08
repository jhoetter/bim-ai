#!/usr/bin/env python3
"""Watch a YouTube video and return granular timestamped descriptions via Gemini."""

from __future__ import annotations

import argparse
import os
import sys

from dotenv import load_dotenv
from google import genai
from google.genai import types

load_dotenv()

_PROMPT = """\
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


def watch(youtube_url: str, api_key: str, model: str = "gemini-2.5-flash") -> str:
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
            _PROMPT,
        ],
    )
    return response.text


def main() -> None:
    parser = argparse.ArgumentParser(description="Timestamped YouTube video description via Gemini")
    parser.add_argument("url", help="YouTube video URL")
    parser.add_argument("--model", default="gemini-2.5-flash", help="Gemini model to use")
    args = parser.parse_args()

    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        print("ERROR: GEMINI_API_KEY not set", file=sys.stderr)
        sys.exit(1)

    result = watch(args.url, api_key, model=args.model)
    print(result)


if __name__ == "__main__":
    main()
