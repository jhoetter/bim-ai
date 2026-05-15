from __future__ import annotations

import pytest

from bim_ai import backend_render
from bim_ai.backend_render import (
    BackendRenderCamera,
    BackendRenderRequest,
    BackendRenderUnavailable,
    BackendRenderVectorM,
)
from bim_ai.document import Document


def test_backend_render_capability_reports_configured_blender(monkeypatch, tmp_path) -> None:
    blender = tmp_path / "blender"
    blender.write_text("#!/bin/sh\n", encoding="utf-8")
    monkeypatch.setenv("BIM_AI_BLENDER_PATH", str(blender))

    capability = backend_render.backend_render_capability()

    assert capability["available"] is True
    assert capability["renderer"] == "blender-cycles"
    assert capability["supportsGpu"] is True
    assert capability["supportsCpu"] is True


def test_backend_render_capability_reports_missing_blender(monkeypatch) -> None:
    monkeypatch.delenv("BIM_AI_BLENDER_PATH", raising=False)
    monkeypatch.setattr(backend_render.shutil, "which", lambda _name: None)
    monkeypatch.setattr(backend_render.Path, "exists", lambda _self: False)

    capability = backend_render.backend_render_capability()

    assert capability["available"] is False
    assert capability["requires"] == "Install Blender or set BIM_AI_BLENDER_PATH."


def test_blender_cycles_script_enables_gpu_denoised_path() -> None:
    settings = BackendRenderRequest(
        width=1920,
        height=1200,
        samples=2048,
        camera=BackendRenderCamera(
            position=BackendRenderVectorM(x=1, y=2, z=3),
            target=BackendRenderVectorM(x=0, y=1, z=0),
            up=BackendRenderVectorM(x=0, y=1, z=0),
            fovDeg=50,
        ),
    )

    script = backend_render.build_blender_cycles_script(
        glb_path="/tmp/model.glb",
        output_path="/tmp/render.png",
        metadata_path="/tmp/meta.json",
        settings=settings,
    )

    assert '"samples": 2048' in script
    assert 'scene.cycles.use_denoising = True' in script
    assert '"OPENIMAGEDENOISE"' in script
    assert '"METAL"' in script
    assert 'bpy.ops.import_scene.gltf' in script
    assert 'camera.data.sensor_fit = "VERTICAL"' in script
    assert 'camera.data.angle_y = math.radians(float(request_camera.get("fovDeg") or 45))' in script
    assert "BIM AI matte ground" not in script
    assert '"position": {"x": 1.0, "y": -3.0, "z": 2.0}' in script
    assert '"target": {"x": 0.0, "y": -0.0, "z": 1.0}' in script
    assert '"up": {"x": 0.0, "y": -0.0, "z": 1.0}' in script


def test_viewer_camera_vectors_are_converted_to_blender_import_space() -> None:
    converted = backend_render.viewer_y_up_to_blender_z_up(
        BackendRenderVectorM(x=12.5, y=3.0, z=-8.25)
    )

    assert converted == {"x": 12.5, "y": 8.25, "z": 3.0}


def test_backend_render_raises_when_no_renderer(monkeypatch) -> None:
    monkeypatch.setattr(backend_render, "resolve_blender_path", lambda: None)

    with pytest.raises(BackendRenderUnavailable, match="Blender is not available"):
        backend_render.render_document_backend_png(Document(revision=1, elements={}), BackendRenderRequest())
