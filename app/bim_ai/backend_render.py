from __future__ import annotations

import json
import os
import shutil
import subprocess
import tempfile
import textwrap
from dataclasses import dataclass
from pathlib import Path
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from bim_ai.document import Document
from bim_ai.export_gltf import document_to_glb_bytes


class BackendRenderUnavailable(RuntimeError):
    pass


class BackendRenderVectorM(BaseModel):
    model_config = ConfigDict(extra="ignore")

    x: float
    y: float
    z: float


class BackendRenderCamera(BaseModel):
    model_config = ConfigDict(extra="ignore")

    position: BackendRenderVectorM
    target: BackendRenderVectorM
    up: BackendRenderVectorM = Field(default_factory=lambda: BackendRenderVectorM(x=0, y=1, z=0))
    fov_deg: float = Field(default=45, alias="fovDeg", ge=15, le=90)


class BackendRenderRequest(BaseModel):
    model_config = ConfigDict(extra="ignore", populate_by_name=True)

    width: int = Field(default=1600, ge=320, le=4096)
    height: int = Field(default=1000, ge=240, le=4096)
    samples: int = Field(default=1024, ge=16, le=4096)
    timeout_seconds: int = Field(default=300, alias="timeoutSeconds", ge=30, le=1800)
    engine: Literal["cycles"] = "cycles"
    camera: BackendRenderCamera | None = None


@dataclass(frozen=True, slots=True)
class BackendRenderResult:
    png: bytes
    renderer: str
    device: str
    samples: int
    width: int
    height: int


def resolve_blender_path() -> str | None:
    configured = os.environ.get("BIM_AI_BLENDER_PATH")
    if configured and Path(configured).exists():
        return configured

    on_path = shutil.which("blender")
    if on_path:
        return on_path

    candidates = [
        "/Applications/Blender.app/Contents/MacOS/Blender",
        str(Path.home() / "Applications/Blender.app/Contents/MacOS/Blender"),
    ]
    for candidate in candidates:
        if Path(candidate).exists():
            return candidate
    return None


def backend_render_capability() -> dict[str, object]:
    blender_path = resolve_blender_path()
    return {
        "available": blender_path is not None,
        "renderer": "blender-cycles" if blender_path else None,
        "path": blender_path,
        "supportsGpu": blender_path is not None,
        "supportsCpu": blender_path is not None,
        "requires": None if blender_path else "Install Blender or set BIM_AI_BLENDER_PATH.",
    }


def viewer_y_up_to_blender_z_up(vec: BackendRenderVectorM) -> dict[str, float]:
    return {"x": float(vec.x), "y": -float(vec.z), "z": float(vec.y)}


def _render_options(settings: BackendRenderRequest) -> dict[str, object]:
    payload = settings.model_dump(by_alias=True)
    if settings.camera is None:
        payload["camera"] = None
    else:
        payload["camera"] = {
            **settings.camera.model_dump(by_alias=True),
            "position": viewer_y_up_to_blender_z_up(settings.camera.position),
            "target": viewer_y_up_to_blender_z_up(settings.camera.target),
            "up": viewer_y_up_to_blender_z_up(settings.camera.up),
            "coordinateSpace": "blender_z_up",
        }
    return payload


def build_blender_cycles_script(
    *,
    glb_path: str,
    output_path: str,
    metadata_path: str,
    settings: BackendRenderRequest,
) -> str:
    options_json = json.dumps(_render_options(settings), sort_keys=True)
    return textwrap.dedent(
        f"""
        import json
        import math
        import sys

        import bpy
        from mathutils import Vector

        GLB_PATH = {glb_path!r}
        OUTPUT_PATH = {output_path!r}
        METADATA_PATH = {metadata_path!r}
        OPTIONS = json.loads({options_json!r})

        def write_metadata(meta):
            with open(METADATA_PATH, "w", encoding="utf-8") as fh:
                json.dump(meta, fh, sort_keys=True)

        def clear_scene():
            bpy.ops.object.select_all(action="SELECT")
            bpy.ops.object.delete()

        def set_material(obj, color, roughness=0.75):
            mat = bpy.data.materials.new(obj.name + "_mat")
            mat.use_nodes = True
            bsdf = mat.node_tree.nodes.get("Principled BSDF")
            if bsdf:
                bsdf.inputs["Base Color"].default_value = color
                bsdf.inputs["Roughness"].default_value = roughness
            obj.data.materials.append(mat)

        def mesh_bounds():
            points = []
            for obj in bpy.context.scene.objects:
                if obj.type == "MESH":
                    points.extend(obj.matrix_world @ Vector(corner) for corner in obj.bound_box)
            if not points:
                return Vector((-5, 0, -5)), Vector((5, 4, 5))
            lo = Vector((min(p.x for p in points), min(p.y for p in points), min(p.z for p in points)))
            hi = Vector((max(p.x for p in points), max(p.y for p in points), max(p.z for p in points)))
            return lo, hi

        def look_at(camera, target, up):
            direction = target - camera.location
            if direction.length < 1e-6:
                direction = Vector((0, -1, -0.25))
            camera.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()

        def enable_cycles(scene):
            scene.render.engine = "CYCLES"
            scene.cycles.samples = int(OPTIONS["samples"])
            scene.cycles.preview_samples = min(64, int(OPTIONS["samples"]))
            scene.cycles.use_denoising = True
            scene.cycles.max_bounces = 8
            scene.cycles.diffuse_bounces = 4
            scene.cycles.glossy_bounces = 4
            scene.cycles.transparent_max_bounces = 8
            try:
                scene.cycles.denoiser = "OPENIMAGEDENOISE"
            except Exception:
                pass

            device = "CPU"
            prefs = bpy.context.preferences.addons.get("cycles")
            if prefs:
                cycles_prefs = prefs.preferences
                for compute_type in ("METAL", "OPTIX", "CUDA", "HIP", "ONEAPI"):
                    try:
                        cycles_prefs.compute_device_type = compute_type
                        cycles_prefs.get_devices()
                        gpu_devices = [dev for dev in cycles_prefs.devices if dev.type != "CPU"]
                        if gpu_devices:
                            for dev in cycles_prefs.devices:
                                dev.use = dev.type != "CPU"
                            scene.cycles.device = "GPU"
                            device = compute_type
                            break
                    except Exception:
                        continue
            return device

        def configure_color(scene):
            scene.render.film_transparent = False
            scene.view_settings.view_transform = "Filmic"
            scene.view_settings.look = "Medium High Contrast"
            scene.view_settings.exposure = 0
            scene.view_settings.gamma = 1
            world = scene.world or bpy.data.worlds.new("World")
            scene.world = world
            world.color = (0.78, 0.86, 0.94)

        def add_lighting(center, radius):
            bpy.ops.object.light_add(type="SUN", location=(center.x - radius, center.y + radius, center.z + radius))
            sun = bpy.context.object
            sun.name = "BIM AI Sun"
            sun.data.energy = 2.8
            sun.rotation_euler = (math.radians(42), 0, math.radians(-35))

            bpy.ops.object.light_add(type="AREA", location=(center.x - radius * 0.55, center.y + radius * 1.35, center.z - radius * 0.8))
            area = bpy.context.object
            area.name = "BIM AI Softbox"
            area.data.energy = max(350, radius * radius * 16)
            area.data.size = max(6, radius * 1.2)

        def add_camera(center, radius):
            bpy.ops.object.camera_add()
            camera = bpy.context.object
            request_camera = OPTIONS.get("camera")
            if request_camera:
                pos = request_camera["position"]
                target = request_camera["target"]
                up = request_camera.get("up") or {{"x": 0, "y": 1, "z": 0}}
                camera.location = (float(pos["x"]), float(pos["y"]), float(pos["z"]))
                look_at(camera, Vector((float(target["x"]), float(target["y"]), float(target["z"]))), Vector((float(up["x"]), float(up["y"]), float(up["z"]))))
                camera.data.sensor_fit = "VERTICAL"
                camera.data.angle_y = math.radians(min(100.0, float(request_camera.get("fovDeg") or 45) * 1.08))
            else:
                camera.location = center + Vector((radius * 1.18, radius * 0.62, radius * 1.05))
                look_at(camera, center, Vector((0, 1, 0)))
                camera.data.lens = 35
            camera.data.clip_end = max(1000, radius * 30)
            camera.data.dof.use_dof = False
            bpy.context.scene.camera = camera

        def add_ground(lo, hi, center, radius):
            bpy.ops.mesh.primitive_plane_add(size=max(radius * 4.0, 12), location=(center.x, lo.y - 0.015, center.z))
            ground = bpy.context.object
            ground.name = "BIM AI matte ground"
            set_material(ground, (0.82, 0.82, 0.78, 1), 0.9)

        clear_scene()
        bpy.ops.import_scene.gltf(filepath=GLB_PATH)

        scene = bpy.context.scene
        scene.render.resolution_x = int(OPTIONS["width"])
        scene.render.resolution_y = int(OPTIONS["height"])
        scene.render.resolution_percentage = 100
        scene.render.image_settings.file_format = "PNG"
        scene.render.filepath = OUTPUT_PATH

        lo, hi = mesh_bounds()
        center = (lo + hi) * 0.5
        radius = max((hi - lo).length * 0.5, 4.0)
        add_ground(lo, hi, center, radius)
        add_lighting(center, radius)
        add_camera(center, radius)
        configure_color(scene)
        device = enable_cycles(scene)

        write_metadata({{
            "renderer": "blender-cycles",
            "device": device,
            "samples": int(OPTIONS["samples"]),
            "width": int(OPTIONS["width"]),
            "height": int(OPTIONS["height"]),
        }})
        bpy.ops.render.render(write_still=True)
        """
    ).strip()


def render_document_backend_png(
    doc: Document,
    settings: BackendRenderRequest,
    *,
    blender_path: str | None = None,
) -> BackendRenderResult:
    blender = blender_path or resolve_blender_path()
    if blender is None:
        raise BackendRenderUnavailable("Blender is not available for backend Cycles rendering.")

    with tempfile.TemporaryDirectory(prefix="bim-ai-render-") as tmpdir:
        tmp = Path(tmpdir)
        glb_path = tmp / "model.glb"
        output_path = tmp / "render.png"
        metadata_path = tmp / "metadata.json"
        script_path = tmp / "render_scene.py"
        glb_path.write_bytes(document_to_glb_bytes(doc))
        script_path.write_text(
            build_blender_cycles_script(
                glb_path=str(glb_path),
                output_path=str(output_path),
                metadata_path=str(metadata_path),
                settings=settings,
            ),
            encoding="utf-8",
        )

        proc = subprocess.run(
            [blender, "--background", "--python", str(script_path)],
            check=False,
            capture_output=True,
            text=True,
            timeout=settings.timeout_seconds,
        )
        if proc.returncode != 0:
            tail = "\n".join((proc.stderr or proc.stdout or "").splitlines()[-20:])
            raise BackendRenderUnavailable(f"Blender render failed: {tail}")
        if not output_path.exists():
            raise BackendRenderUnavailable("Blender completed without producing a PNG render.")

        meta = {}
        if metadata_path.exists():
            meta = json.loads(metadata_path.read_text(encoding="utf-8"))
        return BackendRenderResult(
            png=output_path.read_bytes(),
            renderer=str(meta.get("renderer") or "blender-cycles"),
            device=str(meta.get("device") or "unknown"),
            samples=int(meta.get("samples") or settings.samples),
            width=int(meta.get("width") or settings.width),
            height=int(meta.get("height") or settings.height),
        )
