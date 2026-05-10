from __future__ import annotations

from bim_ai.commands import TraceImageCmd


def handle_trace_image_cmd(cmd: TraceImageCmd) -> dict:
    """Run the deterministic CV pipeline on the base64-encoded image in cmd."""
    import base64
    import os
    import tempfile

    from bim_ai.img.pipeline import trace

    image_bytes = base64.b64decode(cmd.image_b64)
    with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as fh:
        fh.write(image_bytes)
        tmp_path = fh.name
    try:
        layout = trace(tmp_path, archetype_hint=cmd.archetype_hint)
    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass
    return layout.model_dump(by_alias=True)
