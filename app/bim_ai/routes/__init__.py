"""Route packages (BRT-30).

Each `routes/<name>.py` exposes an APIRouter that main.py mounts via
include_router. The eager `from bim_ai.routes.<name> import router` style
is intentionally NOT used here — see BRT-33's circular-import learnings.
"""
