"""IMG-V3-01 — Hough line detection → contour fitting → room segmentation.

Pure deterministic CV. No random seeds, no probabilistic models.
All output is sorted for byte-identical reproducibility.
"""

from __future__ import annotations

from pathlib import Path

import numpy as np

from bim_ai.img.types import Advisory, OpeningHint, PointMm, RoomRegion, WallSegment

_EDGE_DENSITY_LOW_CONTRAST_THRESHOLD = 0.001
_MIN_ROOM_AREA_PX2 = 400
_HOUGH_THRESHOLD = 30
_HOUGH_MIN_LINE_LENGTH = 15
_HOUGH_MAX_LINE_GAP = 8


def _det_id(prefix: str, index: int) -> str:
    return f"{prefix}-{index:04d}"


def _load_edge_array(edges_path: str | Path) -> np.ndarray | None:
    """Load edge image as a 2-D uint8 numpy array. Returns None on failure."""
    path = str(edges_path)
    try:
        import cv2  # type: ignore[import-not-found]

        arr = cv2.imread(path, cv2.IMREAD_GRAYSCALE)
        return arr  # may be None if file unreadable
    except ImportError:
        pass
    try:
        from PIL import Image

        with Image.open(path) as img:
            return np.array(img.convert("L"), dtype=np.uint8)
    except Exception:
        return None


def _hough_walls(
    edges: np.ndarray,
    scale_mm_per_px: float,
) -> tuple[list[WallSegment], list[Advisory]]:
    """Detect wall line segments from an edge image.

    Tries cv2.HoughLinesP first, then skimage standard Hough, then returns
    empty list with advisory.  All outputs are sorted for determinism.
    """
    advisories: list[Advisory] = []
    h, w = edges.shape

    # ── cv2 path ──────────────────────────────────────────────────────────────
    try:
        import cv2  # type: ignore[import-not-found]

        lines_raw = cv2.HoughLinesP(
            edges,
            rho=1,
            theta=np.pi / 180.0,
            threshold=_HOUGH_THRESHOLD,
            minLineLength=_HOUGH_MIN_LINE_LENGTH,
            maxLineGap=_HOUGH_MAX_LINE_GAP,
        )
        lines_list: list[list[int]] = []
        if lines_raw is not None:
            lines_list = [line[0].tolist() for line in lines_raw]
        lines_list.sort()
        walls = [
            WallSegment(
                id=_det_id("wall", idx),
                aMm=PointMm(x=x1 * scale_mm_per_px, y=y1 * scale_mm_per_px),
                bMm=PointMm(x=x2 * scale_mm_per_px, y=y2 * scale_mm_per_px),
            )
            for idx, (x1, y1, x2, y2) in enumerate(lines_list)
        ]
        return walls, advisories
    except ImportError:
        pass

    # ── skimage standard Hough (deterministic accumulator) ────────────────────
    try:
        from skimage.transform import hough_line, hough_line_peaks

        tested_angles = np.linspace(-np.pi / 2, np.pi / 2, 180, endpoint=False)
        h_space, angles, distances = hough_line(edges, theta=tested_angles)
        accum_thresh = max(1, int(h_space.max() * 0.3)) if h_space.max() > 0 else 1
        _, pk_angles, pk_dists = hough_line_peaks(
            h_space,
            angles,
            distances,
            threshold=accum_thresh,
            min_distance=9,
            min_angle=10,
        )
        # Convert (rho, theta) lines to pixel segments clipped to image bounds.
        segments: list[tuple[int, int, int, int]] = []
        for angle, dist in zip(pk_angles, pk_dists, strict=False):
            cos_a, sin_a = np.cos(angle), np.sin(angle)
            if abs(sin_a) > 1e-6:
                y0 = int(round((dist - 0 * cos_a) / sin_a))
                y1 = int(round((dist - (w - 1) * cos_a) / sin_a))
                x0, x1_coord = 0, w - 1
            else:
                x0 = int(round(dist / cos_a))
                x1_coord = x0
                y0, y1 = 0, h - 1
            segments.append((x0, y0, x1_coord, y1))
        segments.sort()
        walls = [
            WallSegment(
                id=_det_id("wall", idx),
                aMm=PointMm(x=x0 * scale_mm_per_px, y=y0 * scale_mm_per_px),
                bMm=PointMm(x=x1c * scale_mm_per_px, y=y1 * scale_mm_per_px),
            )
            for idx, (x0, y0, x1c, y1) in enumerate(segments)
        ]
        return walls, advisories
    except ImportError:
        pass

    advisories.append(Advisory(code="opencv_unavailable"))
    return [], advisories


def recover_rooms(
    edges_path: str | Path,
    scale_mm_per_px: float,
    image_width_px: int,
    image_height_px: int,
) -> tuple[list[RoomRegion], list[WallSegment], list[OpeningHint], list[Advisory]]:
    """Detect walls, rooms, and openings from a pre-computed edge image.

    Returns (rooms, walls, openings, advisories).
    All geometry is returned in mm using scale_mm_per_px.
    """
    advisories: list[Advisory] = []

    edges = _load_edge_array(edges_path)
    if edges is None:
        return (
            _synthetic_boundary_room(image_width_px, image_height_px, scale_mm_per_px),
            [],
            [],
            [Advisory(code="edge_image_unreadable")],
        )

    h, w = edges.shape
    total_px = max(1, w * h)
    edge_px_count = int((edges > 0).sum())
    edge_density = edge_px_count / float(total_px)

    if edge_density < _EDGE_DENSITY_LOW_CONTRAST_THRESHOLD:
        advisories.append(Advisory(code="low_contrast_image"))
        return (
            _synthetic_boundary_room(image_width_px, image_height_px, scale_mm_per_px),
            [],
            [],
            advisories,
        )

    walls, hough_advisories = _hough_walls(edges, scale_mm_per_px)
    advisories.extend(hough_advisories)

    if not walls:
        advisories.append(Advisory(code="no_walls_detected"))
        return (
            _synthetic_boundary_room(image_width_px, image_height_px, scale_mm_per_px),
            [],
            [],
            advisories,
        )

    # ── Contour-based room segmentation ──────────────────────────────────────
    rooms = _segment_rooms(edges, walls, scale_mm_per_px, image_width_px, image_height_px)

    # ── Opening detection (gaps in nearly-parallel wall pairs) ───────────────
    openings = _detect_openings(walls)

    return rooms, walls, openings, advisories


def _segment_rooms(
    edges: np.ndarray,
    walls: list[WallSegment],
    scale_mm_per_px: float,
    image_width_px: int,
    image_height_px: int,
) -> list[RoomRegion]:
    """Segment rooms using contour detection on a wall-mask.

    Falls back to a single boundary room if cv2 is not available.
    """
    try:
        import cv2  # type: ignore[import-not-found]

        h, w = edges.shape
        mask = np.zeros((h, w), dtype=np.uint8)
        for seg in walls:
            x1 = int(seg.a_mm.x / scale_mm_per_px)
            y1 = int(seg.a_mm.y / scale_mm_per_px)
            x2 = int(seg.b_mm.x / scale_mm_per_px)
            y2 = int(seg.b_mm.y / scale_mm_per_px)
            cv2.line(mask, (x1, y1), (x2, y2), 255, 2)

        inv = cv2.bitwise_not(mask)
        contours, _ = cv2.findContours(inv, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)

        room_polys: list[tuple[float, list[tuple[int, int]]]] = []
        for cnt in contours:
            area = float(cv2.contourArea(cnt))
            if area < _MIN_ROOM_AREA_PX2:
                continue
            epsilon = 0.02 * cv2.arcLength(cnt, True)
            approx = cv2.approxPolyDP(cnt, epsilon, True)
            pts = [(int(p[0][0]), int(p[0][1])) for p in approx]
            if len(pts) < 3:
                continue
            room_polys.append((area, pts))

        room_polys.sort(key=lambda t: (-t[0], t[1]))
        rooms: list[RoomRegion] = [
            RoomRegion(
                id=_det_id("room", idx),
                polygonMm=[
                    PointMm(x=px * scale_mm_per_px, y=py * scale_mm_per_px)
                    for px, py in pts
                ],
                detectedAreaMm2=area_px2 * scale_mm_per_px * scale_mm_per_px,
            )
            for idx, (area_px2, pts) in enumerate(room_polys)
        ]
        if not rooms:
            rooms = _synthetic_boundary_room(image_width_px, image_height_px, scale_mm_per_px)
        return rooms
    except ImportError:
        return _synthetic_boundary_room(image_width_px, image_height_px, scale_mm_per_px)


def _detect_openings(walls: list[WallSegment]) -> list[OpeningHint]:
    """Detect potential door/window openings as short wall segments whose
    midpoint lies near a longer wall. Pure geometry; fully deterministic.
    """
    if len(walls) < 2:
        return []

    import math

    def seg_len(w: WallSegment) -> float:
        dx = w.b_mm.x - w.a_mm.x
        dy = w.b_mm.y - w.a_mm.y
        return math.sqrt(dx * dx + dy * dy)

    def midpoint(w: WallSegment) -> tuple[float, float]:
        return ((w.a_mm.x + w.b_mm.x) / 2.0, (w.a_mm.y + w.b_mm.y) / 2.0)

    def pt_to_seg_dist(
        px: float, py: float, ax: float, ay: float, bx: float, by: float
    ) -> float:
        dx, dy = bx - ax, by - ay
        length_sq = dx * dx + dy * dy
        if length_sq < 1e-9:
            return math.sqrt((px - ax) ** 2 + (py - ay) ** 2)
        t = max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / length_sq))
        return math.sqrt((px - (ax + t * dx)) ** 2 + (py - (ay + t * dy)) ** 2)

    openings: list[OpeningHint] = []
    for i, short_w in enumerate(walls):
        short_len = seg_len(short_w)
        if short_len > 1200:
            continue
        mx, my = midpoint(short_w)
        for j, long_w in enumerate(walls):
            if i == j:
                continue
            if seg_len(long_w) < short_len * 2:
                continue
            dist = pt_to_seg_dist(
                mx, my, long_w.a_mm.x, long_w.a_mm.y, long_w.b_mm.x, long_w.b_mm.y
            )
            if dist < 300:
                dx = long_w.b_mm.x - long_w.a_mm.x
                dy = long_w.b_mm.y - long_w.a_mm.y
                long_len = math.sqrt(dx * dx + dy * dy)
                if long_len < 1e-9:
                    continue
                t = ((mx - long_w.a_mm.x) * dx + (my - long_w.a_mm.y) * dy) / (
                    long_len * long_len
                )
                t = max(0.0, min(1.0, t))
                kind: str = "door" if short_len < 1000 else "window"
                openings.append(
                    OpeningHint(
                        id=_det_id("opening", len(openings)),
                        hostWallId=long_w.id,
                        tAlongWall=t,
                        widthMm=short_len,
                        kindHint=kind,  # type: ignore[arg-type]
                    )
                )
                break

    openings.sort(key=lambda o: (o.host_wall_id, o.t_along_wall))
    for idx, o in enumerate(openings):
        openings[idx] = OpeningHint(
            id=_det_id("opening", idx),
            hostWallId=o.host_wall_id,
            tAlongWall=o.t_along_wall,
            widthMm=o.width_mm,
            kindHint=o.kind_hint,
        )
    return openings


def _synthetic_boundary_room(
    width_px: int, height_px: int, scale_mm_per_px: float
) -> list[RoomRegion]:
    """Return a single room polygon that covers the full image boundary.

    Used as a degraded-but-sane fallback for low-contrast or degenerate images.
    """
    w_mm = width_px * scale_mm_per_px
    h_mm = height_px * scale_mm_per_px
    return [
        RoomRegion(
            id="room-0000",
            polygonMm=[
                PointMm(x=0.0, y=0.0),
                PointMm(x=w_mm, y=0.0),
                PointMm(x=w_mm, y=h_mm),
                PointMm(x=0.0, y=h_mm),
            ],
            detectedAreaMm2=w_mm * h_mm,
        )
    ]
