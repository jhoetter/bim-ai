from __future__ import annotations

import json
import os
import sys

from bim_ai.reverse_bim_openai_reader import run_openai_reader_assignment


def main() -> int:
    try:
        assignment_request = json.load(sys.stdin)
        response = run_openai_reader_assignment(
            assignment_request,
            model=os.environ.get("OPENAI_READER_MODEL"),
            timeout_seconds=int(os.environ.get("OPENAI_READER_TIMEOUT_SECONDS") or "300"),
            max_images=(
                int(os.environ["OPENAI_READER_MAX_IMAGES"])
                if os.environ.get("OPENAI_READER_MAX_IMAGES")
                else None
            ),
        )
    except Exception as exc:
        print(str(exc), file=sys.stderr)
        return 1
    print(json.dumps(response, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
