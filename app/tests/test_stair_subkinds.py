"""KRN-V3-10: monolithic / floating stair sub-kind tests."""

from __future__ import annotations

import pytest

from bim_ai.commands import CreateLevelCmd, CreateStairCmd, CreateWallCmd, SetStairSubKindCmd
from bim_ai.document import Document
from bim_ai.elements import StairElem, Vec2Mm
from bim_ai.engine import apply_inplace, try_commit

# ─────────────────────────── helpers ────────────────────────────────────────


def _base_doc() -> Document:
    doc = Document(revision=1, elements={})
    apply_inplace(doc, CreateLevelCmd(id="lvl-0", name="L0", elevationMm=0))
    apply_inplace(doc, CreateLevelCmd(id="lvl-1", name="L1", elevationMm=2800))
    apply_inplace(
        doc,
        CreateWallCmd(
            id="wall-1",
            levelId="lvl-0",
            start=Vec2Mm(xMm=0, yMm=0),
            end=Vec2Mm(xMm=5000, yMm=0),
        ),
    )
    return doc


def _standard_stair_cmd(**kwargs) -> CreateStairCmd:
    defaults = dict(
        id="stair-1",
        baseLevelId="lvl-0",
        topLevelId="lvl-1",
        runStartMm={"xMm": 0, "yMm": 0},
        runEndMm={"xMm": 0, "yMm": 3000},
        widthMm=1000,
    )
    defaults.update(kwargs)
    return CreateStairCmd(**defaults)


# ─────────────────────────── CreateStairCmd sub-kind tests ──────────────────


def test_create_stair_defaults_to_standard() -> None:
    """No subKind → sub_kind='standard'."""
    doc = _base_doc()
    cmd = _standard_stair_cmd()
    ok, new_doc, _, violations, _ = try_commit(doc, cmd.model_dump(by_alias=True))
    assert ok, violations
    stair = new_doc.elements["stair-1"]
    assert isinstance(stair, StairElem)
    assert stair.sub_kind == "standard"
    assert stair.monolithic_material is None
    assert stair.floating_tread_depth_mm is None
    assert stair.floating_host_wall_id is None


def test_create_stair_monolithic_with_material() -> None:
    """subKind='monolithic' + monolithicMaterial creates stair with correct fields."""
    doc = _base_doc()
    cmd = _standard_stair_cmd(subKind="monolithic", monolithicMaterial="concrete-c30")
    ok, new_doc, _, violations, _ = try_commit(doc, cmd.model_dump(by_alias=True))
    assert ok, violations
    stair = new_doc.elements["stair-1"]
    assert isinstance(stair, StairElem)
    assert stair.sub_kind == "monolithic"
    assert stair.monolithic_material == "concrete-c30"


def test_create_stair_monolithic_material_none_accepted() -> None:
    """monolithicMaterial=None is accepted — material is optional."""
    doc = _base_doc()
    cmd = _standard_stair_cmd(subKind="monolithic")
    ok, new_doc, _, violations, _ = try_commit(doc, cmd.model_dump(by_alias=True))
    assert ok, violations
    stair = new_doc.elements["stair-1"]
    assert stair.sub_kind == "monolithic"
    assert stair.monolithic_material is None


def test_create_stair_floating_with_valid_host_wall() -> None:
    """subKind='floating' + valid floatingHostWallId creates floating stair."""
    doc = _base_doc()
    cmd = _standard_stair_cmd(subKind="floating", floatingHostWallId="wall-1")
    ok, new_doc, _, violations, _ = try_commit(doc, cmd.model_dump(by_alias=True))
    assert ok, violations
    stair = new_doc.elements["stair-1"]
    assert isinstance(stair, StairElem)
    assert stair.sub_kind == "floating"
    assert stair.floating_host_wall_id == "wall-1"


def test_create_stair_floating_without_host_wall_raises() -> None:
    """subKind='floating' without floatingHostWallId raises ValueError."""
    doc = _base_doc()
    cmd = _standard_stair_cmd(subKind="floating")
    with pytest.raises(ValueError, match="floatingHostWallId"):
        apply_inplace(doc, cmd)


def test_create_stair_floating_nonexistent_host_wall_raises() -> None:
    """subKind='floating' with non-existent floatingHostWallId raises ValueError."""
    doc = _base_doc()
    cmd = _standard_stair_cmd(subKind="floating", floatingHostWallId="no-such-wall")
    with pytest.raises(ValueError, match="Wall"):
        apply_inplace(doc, cmd)


def test_create_stair_monolithic_with_floating_host_wall_raises() -> None:
    """subKind='monolithic' + floatingHostWallId raises ValueError."""
    doc = _base_doc()
    cmd = _standard_stair_cmd(subKind="monolithic", floatingHostWallId="wall-1")
    with pytest.raises(ValueError, match="monolithic"):
        apply_inplace(doc, cmd)


def test_floating_tread_depth_zero_rejected() -> None:
    """floatingTreadDepthMm=0 must be rejected by the engine validator."""
    doc = _base_doc()
    cmd = _standard_stair_cmd(
        subKind="floating",
        floatingHostWallId="wall-1",
        floatingTreadDepthMm=0,
    )
    with pytest.raises(ValueError, match="floatingTreadDepthMm"):
        apply_inplace(doc, cmd)


# ─────────────────────────── SetStairSubKindCmd tests ───────────────────────


def test_set_stair_sub_kind_standard_to_monolithic() -> None:
    """SetStairSubKindCmd changes standard → monolithic on an existing stair."""
    doc = _base_doc()
    apply_inplace(doc, _standard_stair_cmd())
    set_cmd = SetStairSubKindCmd(
        stairId="stair-1",
        subKind="monolithic",
        monolithicMaterial="concrete-c30",
    )
    ok, new_doc, _, violations, _ = try_commit(doc, set_cmd.model_dump(by_alias=True))
    assert ok, violations
    stair = new_doc.elements["stair-1"]
    assert isinstance(stair, StairElem)
    assert stair.sub_kind == "monolithic"
    assert stair.monolithic_material == "concrete-c30"


def test_set_stair_sub_kind_standard_to_floating() -> None:
    """SetStairSubKindCmd changes standard → floating with valid host wall."""
    doc = _base_doc()
    apply_inplace(doc, _standard_stair_cmd())
    set_cmd = SetStairSubKindCmd(
        stairId="stair-1",
        subKind="floating",
        floatingHostWallId="wall-1",
    )
    ok, new_doc, _, violations, _ = try_commit(doc, set_cmd.model_dump(by_alias=True))
    assert ok, violations
    stair = new_doc.elements["stair-1"]
    assert stair.sub_kind == "floating"
    assert stair.floating_host_wall_id == "wall-1"


def test_set_stair_sub_kind_non_stair_id_raises() -> None:
    """SetStairSubKindCmd with a wall (non-stair) stairId raises ValueError."""
    doc = _base_doc()
    set_cmd = SetStairSubKindCmd(stairId="wall-1", subKind="monolithic")
    with pytest.raises(ValueError, match="Stair"):
        apply_inplace(doc, set_cmd)


def test_set_stair_sub_kind_missing_stair_id_raises() -> None:
    """SetStairSubKindCmd with a non-existent stairId raises ValueError."""
    doc = _base_doc()
    set_cmd = SetStairSubKindCmd(stairId="no-such-stair", subKind="standard")
    with pytest.raises(ValueError, match="Stair"):
        apply_inplace(doc, set_cmd)


# ─────────────────────────── backward-compat regression ─────────────────────


def test_by_component_stair_round_trips_unchanged() -> None:
    """Existing by_component stair round-trips with sub_kind='standard'."""
    doc = _base_doc()
    cmd = _standard_stair_cmd()
    ok, new_doc, _, violations, _ = try_commit(doc, cmd.model_dump(by_alias=True))
    assert ok, violations
    stair = new_doc.elements["stair-1"]
    assert isinstance(stair, StairElem)
    assert stair.authoring_mode == "by_component"
    assert stair.sub_kind == "standard"
    assert stair.boundary_mm is None
    assert stair.tread_lines is None
    assert stair.total_rise_mm is None


def test_by_sketch_stair_round_trips_unchanged() -> None:
    """Existing by_sketch stair round-trips; KRN-V3-05 fields unaffected."""
    doc = _base_doc()
    cmd = CreateStairCmd(
        id="sketch-stair",
        baseLevelId="lvl-0",
        topLevelId="lvl-1",
        runStartMm={"xMm": 0, "yMm": 0},
        runEndMm={"xMm": 0, "yMm": 0},
        authoringMode="by_sketch",
        boundaryMm=[
            {"xMm": 0, "yMm": 0},
            {"xMm": 3000, "yMm": 0},
            {"xMm": 3000, "yMm": 1200},
            {"xMm": 0, "yMm": 1200},
        ],
        treadLines=[
            {"fromMm": {"xMm": 0, "yMm": i * 250}, "toMm": {"xMm": 3000, "yMm": i * 250}}
            for i in range(12)
        ],
        totalRiseMm=2800,
    )
    ok, new_doc, _, violations, _ = try_commit(doc, cmd.model_dump(by_alias=True))
    assert ok, violations
    stair = new_doc.elements["sketch-stair"]
    assert isinstance(stair, StairElem)
    assert stair.authoring_mode == "by_sketch"
    assert stair.boundary_mm is not None and len(stair.boundary_mm) == 4
    assert stair.tread_lines is not None and len(stair.tread_lines) == 12
    assert stair.total_rise_mm == pytest.approx(2800.0)
    assert stair.sub_kind == "standard"
