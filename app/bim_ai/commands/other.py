"""Catch-all command models that don't fit cleanly in another domain.

Element lifecycle (delete/pin/restore/update-property), rooms (outline /
rect / poly / place-at-point / separation), plan regions, masking regions,
revision cloud, areas (KRN-08), reference planes (KRN-05), mirror, text-3d,
plan-canvas Modify tools (split / align / trim / wall-join), single/two-click
create (column / beam / ceiling / mass / void cut / constraint), element
moves & rotates, helper-dim column patch, tool-pref persistence.

BRT-22 split — these classes used to live in ``app/bim_ai/commands.py``.
"""

from __future__ import annotations

from typing import Any, Literal

from pydantic import AliasChoices, BaseModel, ConfigDict, Field

from bim_ai.elements import (
    ConstraintRefRow,
    ConstraintRule,
    Text3dFontFamily,
    Vec2Mm,
    Vec3Mm,
)


class DeleteElementCmd(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["deleteElement"] = "deleteElement"
    element_id: str = Field(alias="elementId")
    # VIE-07: caller may set this to bypass the pinned-element block.
    force_pin_override: bool = Field(default=False, alias="forcePinOverride")


class PinElementCmd(BaseModel):
    """VIE-07 — set pinned=True on an element."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["pinElement"] = "pinElement"
    element_id: str = Field(alias="elementId")


class UnpinElementCmd(BaseModel):
    """VIE-07 — set pinned=False on an element."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["unpinElement"] = "unpinElement"
    element_id: str = Field(alias="elementId")


class RestoreElementCmd(BaseModel):
    """Replays a persisted element snapshot (primarily undo / internal)."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["restoreElement"] = "restoreElement"
    element: dict


class DeleteElementsCmd(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["deleteElements"] = "deleteElements"
    element_ids: list[str] = Field(alias="elementIds")


class UpdateElementPropertyCmd(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["updateElementProperty"] = "updateElementProperty"
    element_id: str = Field(alias="elementId")
    key: str
    value: str | bool | int | float | dict[str, Any] | list[Any] | None = ""
    force_pin_override: bool = Field(default=False, alias="forcePinOverride")


# --- Rooms ------------------------------------------------------------------


class CreateRoomOutlineCmd(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["createRoomOutline"] = "createRoomOutline"
    id: str | None = None
    name: str = "Room"
    level_id: str = Field(alias="levelId")
    outline_mm: list[Vec2Mm] = Field(alias="outlineMm")
    programme_code: str | None = Field(default=None, alias="programmeCode")
    department: str | None = Field(default=None, alias="department")
    function_label: str | None = Field(default=None, alias="functionLabel")
    finish_set: str | None = Field(default=None, alias="finishSet")
    target_area_m2: float | None = Field(default=None, alias="targetAreaM2")


class CreateRoomRectangleCmd(BaseModel):
    """Axis-aligned rectangle: four perimeter walls plus room outline (single undo unit)."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["createRoomRectangle"] = "createRoomRectangle"
    id: str | None = Field(default=None, alias="roomId")
    name: str = "Room"
    level_id: str = Field(alias="levelId")
    origin: Vec2Mm
    width_mm: float = Field(alias="widthMm")
    depth_mm: float = Field(alias="depthMm")
    thickness_mm: float = Field(alias="thicknessMm", default=200)
    height_mm: float = Field(alias="heightMm", default=2800)
    wall_name_prefix: str = Field(alias="wallNamePrefix", default="Wall")
    programme_code: str | None = Field(default=None, alias="programmeCode")
    department: str | None = Field(default=None, alias="department")
    function_label: str | None = Field(default=None, alias="functionLabel")
    finish_set: str | None = Field(default=None, alias="finishSet")
    target_area_m2: float | None = Field(default=None, alias="targetAreaM2")


class CreateRoomPolyCmd(BaseModel):
    """Closed polygon from vertices → perimeter walls + room (single undo unit)."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["createRoomPoly"] = "createRoomPoly"
    id: str | None = Field(default=None, alias="roomId")
    name: str = "Room"
    level_id: str = Field(alias="levelId")
    vertices_mm: list[Vec2Mm] = Field(alias="verticesMm")
    thickness_mm: float = Field(alias="thicknessMm", default=200)
    height_mm: float = Field(alias="heightMm", default=2800)
    wall_name_prefix: str = Field(alias="wallNamePrefix", default="Wall")
    programme_code: str | None = Field(default=None, alias="programmeCode")
    department: str | None = Field(default=None, alias="department")
    function_label: str | None = Field(default=None, alias="functionLabel")
    finish_set: str | None = Field(default=None, alias="finishSet")
    target_area_m2: float | None = Field(default=None, alias="targetAreaM2")


class PlaceRoomAtPointCmd(BaseModel):
    """Derive and place a room by clicking inside a closed wall enclosure."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["placeRoomAtPoint"] = "placeRoomAtPoint"
    id: str
    level_id: str = Field(alias="levelId")
    click_x_mm: float = Field(alias="clickXMm")
    click_y_mm: float = Field(alias="clickYMm")
    name: str = Field(default="Room")


class CreateRoomSeparationCmd(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["createRoomSeparation"] = "createRoomSeparation"
    id: str | None = None
    name: str = "Separation"
    level_id: str = Field(alias="levelId")
    start: Vec2Mm
    end: Vec2Mm


# --- Plan regions -----------------------------------------------------------


class CreatePlanRegionCmd(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["createPlanRegion"] = "createPlanRegion"
    id: str | None = None
    name: str = "Region"
    level_id: str = Field(alias="levelId")
    outline_mm: list[Vec2Mm] = Field(alias="outlineMm")
    cut_plane_offset_mm: float = Field(alias="cutPlaneOffsetMm", default=-500)


class UpdatePlanRegionCmd(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["updatePlanRegion"] = "updatePlanRegion"
    id: str
    name: str | None = None
    outline_mm: list[Vec2Mm] | None = Field(default=None, alias="outlineMm")
    cut_plane_offset_mm: float | None = Field(default=None, alias="cutPlaneOffsetMm")


class DeletePlanRegionCmd(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["deletePlanRegion"] = "deletePlanRegion"
    id: str


class CreateJoinGeometryCmd(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["createJoinGeometry"] = "createJoinGeometry"
    id: str | None = None
    joined_element_ids: list[str] = Field(alias="joinedElementIds")
    notes: str = ""


# --- Text 3D ----------------------------------------------------------------


class CreateText3dCmd(BaseModel):
    """FAM-06: extruded 3D letterforms placed in model space."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["createText3d"] = "createText3d"
    id: str | None = None
    text: str
    font_family: Text3dFontFamily = Field(default="helvetiker", alias="fontFamily")
    font_size_mm: float = Field(default=200.0, alias="fontSizeMm", gt=0)
    depth_mm: float = Field(default=50.0, alias="depthMm", gt=0)
    position_mm: Vec3Mm = Field(alias="positionMm")
    rotation_deg: float = Field(default=0.0, alias="rotationDeg")
    material_key: str | None = Field(default=None, alias="materialKey")


# --- Mirror -----------------------------------------------------------------


class MirrorAxis(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    start_mm: Vec2Mm = Field(alias="startMm")
    end_mm: Vec2Mm = Field(alias="endMm")


class MirrorElementsCmd(BaseModel):
    """FAM-07 — reflect elements across an axis, optionally keeping originals.

    `also_copy=True` keeps the originals and adds mirrored copies (Revit's
    "Mirror — Pick Axis" with Copy option). `also_copy=False` mirrors in
    place. `asymmetric_family_type_ids` lets the caller flag families that
    should produce a `mirror_asymmetric` advisory rather than mirror cleanly
    — the warnings are returned via :func:`mirror_advisories_for_command`.
    """

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["mirrorElements"] = "mirrorElements"
    element_ids: list[str] = Field(alias="elementIds")
    axis: MirrorAxis
    also_copy: bool = Field(default=True, alias="alsoCopy")
    asymmetric_family_type_ids: list[str] = Field(
        default_factory=list, alias="asymmetricFamilyTypeIds"
    )


# --- KRN-05: project-scope reference planes ---------------------------------


class CreateReferencePlaneCmd(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["createReferencePlane"] = "createReferencePlane"
    id: str | None = None
    name: str = ""
    level_id: str = Field(alias="levelId")
    start_mm: Vec2Mm = Field(alias="startMm")
    end_mm: Vec2Mm = Field(alias="endMm")
    is_work_plane: bool = Field(default=False, alias="isWorkPlane")


class UpdateReferencePlaneCmd(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["updateReferencePlane"] = "updateReferencePlane"
    reference_plane_id: str = Field(alias="referencePlaneId")
    name: str | None = None
    start_mm: Vec2Mm | None = Field(default=None, alias="startMm")
    end_mm: Vec2Mm | None = Field(default=None, alias="endMm")
    is_work_plane: bool | None = Field(default=None, alias="isWorkPlane")


class DeleteReferencePlaneCmd(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["deleteReferencePlane"] = "deleteReferencePlane"
    reference_plane_id: str = Field(alias="referencePlaneId")


# --- KRN-08: area element ---------------------------------------------------

AreaRuleSetCmd = Literal["gross", "net", "no_rules"]
_AreaSchemeCmd = Literal["gross_building", "net", "rentable"]


class CreateAreaCmd(BaseModel):
    """KRN-08 — author an `area` polygon for legal/permit area calculations."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["createArea"] = "createArea"
    id: str | None = None
    name: str = "Area"
    level_id: str = Field(alias="levelId")
    boundary_mm: list[Vec2Mm] = Field(alias="boundaryMm")
    rule_set: AreaRuleSetCmd = Field(default="no_rules", alias="ruleSet")
    area_scheme: _AreaSchemeCmd = Field(default="gross_building", alias="areaScheme")
    apply_area_rules: bool = Field(default=True, alias="applyAreaRules")


class UpdateAreaCmd(BaseModel):
    """KRN-08 — update an existing area's name, boundary, or ruleset."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["updateArea"] = "updateArea"
    area_id: str = Field(alias="areaId")
    name: str | None = None
    boundary_mm: list[Vec2Mm] | None = Field(default=None, alias="boundaryMm")
    rule_set: AreaRuleSetCmd | None = Field(default=None, alias="ruleSet")
    area_scheme: _AreaSchemeCmd | None = Field(default=None, alias="areaScheme")


class DeleteAreaCmd(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["deleteArea"] = "deleteArea"
    area_id: str = Field(alias="areaId")


# --- KRN-10: masking region -------------------------------------------------


class CreateMaskingRegionCmd(BaseModel):
    """KRN-10 — author a view-local masking region polygon."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["createMaskingRegion"] = "createMaskingRegion"
    id: str | None = None
    host_view_id: str = Field(alias="hostViewId")
    boundary_mm: list[Vec2Mm] = Field(alias="boundaryMm")
    void_boundaries_mm: list[list[Vec2Mm]] = Field(default_factory=list, alias="voidBoundariesMm")
    fill_color: str = Field(default="#ffffff", alias="fillColor")


class CreateRevisionCloudCmd(BaseModel):
    """ANN-03 — view-local revision cloud boundary."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["createRevisionCloud"] = "createRevisionCloud"
    id: str | None = None
    host_view_id: str = Field(alias="hostViewId")
    boundary_mm: list[Vec2Mm] = Field(alias="boundaryMm")
    colour: str = Field(default="#e05000")
    stroke_mm: float = Field(default=1.0, alias="strokeMm")


class UpdateMaskingRegionCmd(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["updateMaskingRegion"] = "updateMaskingRegion"
    masking_region_id: str = Field(alias="maskingRegionId")
    boundary_mm: list[Vec2Mm] | None = Field(default=None, alias="boundaryMm")
    void_boundaries_mm: list[list[Vec2Mm]] | None = Field(default=None, alias="voidBoundariesMm")
    fill_color: str | None = Field(default=None, alias="fillColor")


class DeleteMaskingRegionCmd(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["deleteMaskingRegion"] = "deleteMaskingRegion"
    masking_region_id: str = Field(alias="maskingRegionId")


# --- EDT-04: Plan-canvas Modify tools (Split / Align / Trim / Wall-Join) ---


class SplitWallAtCmd(BaseModel):
    """EDT-04 — split a wall at a normalised position alongT into two walls.

    The original wall is replaced by two new walls that share the split
    point. Hosted openings are *not* migrated by this command (the canvas
    side of the SD tool stays out of opening reassignment for v1); the
    along-T parameter and any door/window remain anchored to whichever
    of the two resulting walls now hosts the opening.
    """

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["splitWallAt"] = "splitWallAt"
    wall_id: str = Field(alias="wallId")
    along_t: float = Field(alias="alongT", gt=0, lt=1)


class AlignElementToReferenceCmd(BaseModel):
    """EDT-04 — translate a target element (wall, column, placed_asset) so its
    near endpoint/position snaps to the reference point along the closer axis."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["alignElementToReference"] = "alignElementToReference"
    target_element_id: str = Field(
        validation_alias=AliasChoices("targetElementId", "targetWallId"),
        serialization_alias="targetElementId",
    )
    reference_mm: Vec2Mm = Field(alias="referenceMm")


class TrimElementToReferenceCmd(BaseModel):
    """EDT-04 — extend or trim ``targetWallId`` so its ``endHint`` endpoint
    lies on the infinite line of ``referenceWallId``."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["trimElementToReference"] = "trimElementToReference"
    reference_wall_id: str = Field(alias="referenceWallId")
    target_wall_id: str = Field(alias="targetWallId")
    end_hint: Literal["start", "end"] = Field(alias="endHint")


class TrimExtendToCornerCmd(BaseModel):
    """Trim or extend two walls so their centerlines meet at a corner."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["trimExtendToCorner"] = "trimExtendToCorner"
    wall_id_a: str = Field(alias="wallIdA")
    wall_id_b: str = Field(alias="wallIdB")


WallJoinVariant = Literal["miter", "butt", "square"]


class SetWallJoinVariantCmd(BaseModel):
    """EDT-04 — record the join variant for the walls meeting at a corner."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["setWallJoinVariant"] = "setWallJoinVariant"
    wall_ids: list[str] = Field(alias="wallIds")
    variant: WallJoinVariant


class SetWallJoinDisallowCmd(BaseModel):
    """F-040 — toggle the 'disallow join' flag for one endpoint of a wall."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["setWallJoinDisallow"] = "setWallJoinDisallow"
    wall_id: str = Field(alias="wallId")
    endpoint: Literal["start", "end"] = "start"
    disallow: bool = True


# --- EDT-04: Single-/two-click placement create commands -------------------


class CreateColumnCmd(BaseModel):
    """EDT-04 — single-click structural-column placement."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["createColumn"] = "createColumn"
    id: str | None = None
    name: str = "Column"
    level_id: str = Field(alias="levelId")
    position_mm: Vec2Mm = Field(alias="positionMm")
    b_mm: float = Field(alias="bMm", default=300, gt=0)
    h_mm: float = Field(alias="hMm", default=300, gt=0)
    height_mm: float = Field(alias="heightMm", default=2800, gt=0)
    rotation_deg: float = Field(default=0.0, alias="rotationDeg")
    material_key: str | None = Field(default=None, alias="materialKey")


class CreateBeamCmd(BaseModel):
    """EDT-04 — two-click structural-beam placement."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["createBeam"] = "createBeam"
    id: str | None = None
    name: str = "Beam"
    level_id: str = Field(alias="levelId")
    start_mm: Vec2Mm = Field(alias="startMm")
    end_mm: Vec2Mm = Field(alias="endMm")
    width_mm: float = Field(alias="widthMm", default=200, gt=0)
    height_mm: float = Field(alias="heightMm", default=400, gt=0)
    material_key: str | None = Field(default=None, alias="materialKey")


class CreateCeilingCmd(BaseModel):
    """EDT-04 — sketch-polygon ceiling placement on a level."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["createCeiling"] = "createCeiling"
    id: str | None = None
    name: str = "Ceiling"
    level_id: str = Field(alias="levelId")
    boundary_mm: list[Vec2Mm] = Field(alias="boundaryMm")
    height_offset_mm: float = Field(alias="heightOffsetMm", default=2700)
    thickness_mm: float = Field(alias="thicknessMm", default=20, gt=0)
    ceiling_type_id: str | None = Field(default=None, alias="ceilingTypeId")


class CreateMassCmd(BaseModel):
    """SKT-01 — in-place generic mass authored from a sketch session."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["createMass"] = "createMass"
    id: str | None = None
    name: str = "Mass"
    level_id: str = Field(alias="levelId")
    footprint_mm: list[Vec2Mm] = Field(alias="footprintMm")
    height_mm: float = Field(default=3000, alias="heightMm", gt=0)
    rotation_deg: float = Field(default=0.0, alias="rotationDeg")
    material_key: str | None = Field(default=None, alias="materialKey")


class MaterializeMassToWallsCmd(BaseModel):
    """SKB-02 — auto-extract walls + floor + roof-stub from a `mass` element.

    The engine emits one wall per footprint segment, one floor matching the
    footprint at level base, and one flat roof at level base + heightMm,
    promotes phase to ``'skeleton'`` on emitted elements, and deletes the
    source mass. Each emitted element carries an ``AgentDeviationElem`` back
    to the source mass id so the materialise step is auditable.
    """

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["materializeMassToWalls"] = "materializeMassToWalls"
    mass_id: str = Field(alias="massId")


class CreateVoidCutCmd(BaseModel):
    """SKT-01 — subtractive boolean marker against a host element.

    The element is a marker only (`VoidCutElem`); the actual CSG geometry is
    handled at render time. An `AgentDeviationElem` is co-authored by the
    engine handler so the deviation against the host is traceable.
    """

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["createVoidCut"] = "createVoidCut"
    id: str | None = None
    host_element_id: str = Field(alias="hostElementId")
    profile_mm: list[Vec2Mm] = Field(alias="profileMm")
    depth_mm: float = Field(alias="depthMm", gt=0)


class CreateConstraintCmd(BaseModel):
    """EDT-02 — author a geometric constraint between element groups.

    The padlock UI on a temp-dimension authors `equal_distance` between
    two walls; other rules are accepted shapes for forward compatibility
    but currently pass-through in the evaluator.
    """

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["createConstraint"] = "createConstraint"
    id: str | None = None
    name: str = ""
    rule: ConstraintRule
    refs_a: list[ConstraintRefRow] = Field(alias="refsA")
    refs_b: list[ConstraintRefRow] = Field(alias="refsB")
    locked_value_mm: float | None = Field(default=None, alias="lockedValueMm")
    severity: Literal["warning", "error"] = "error"


# --- Element moves / rotates ------------------------------------------------


class MoveElementCmd(BaseModel):
    """TKN-V3-01 — move a wall-hosted element (door/window) to a new tAlongHost position."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["moveElement"] = "moveElement"
    element_id: str = Field(alias="elementId")
    t_along_host: float = Field(alias="tAlongHost", ge=0.0, le=1.0)


class MoveAssetDeltaCmd(BaseModel):
    """Move a placed_asset element by a positional delta."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["moveAssetDelta"] = "moveAssetDelta"
    element_id: str = Field(alias="elementId")
    dx_mm: float = Field(alias="dxMm")
    dy_mm: float = Field(alias="dyMm")


class MoveColumnDeltaCmd(BaseModel):
    """Move a column element by a delta in X and Y."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["moveColumnDelta"] = "moveColumnDelta"
    element_id: str = Field(alias="elementId")
    dx_mm: float = Field(alias="dxMm")
    dy_mm: float = Field(alias="dyMm")


class MoveElementsDeltaCmd(BaseModel):
    """Move multiple elements by (dxMm, dyMm). Supports walls, columns, placed_assets."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["moveElementsDelta"] = "moveElementsDelta"
    element_ids: list[str] = Field(alias="elementIds")
    dx_mm: float = Field(alias="dxMm")
    dy_mm: float = Field(alias="dyMm")


class RotateElementsCmd(BaseModel):
    """Rotate one or more elements around a center point by a given angle."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["rotateElements"] = "rotateElements"
    element_ids: list[str] = Field(alias="elementIds")
    center_x_mm: float = Field(alias="centerXMm")
    center_y_mm: float = Field(alias="centerYMm")
    angle_deg: float = Field(alias="angleDeg")


class UpdateColumnCmd(BaseModel):
    """EDT-V3-06 — patch a column's cross-section from a helper dim chip."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["updateColumn"] = "updateColumn"
    id: str
    b_mm: float | None = Field(default=None, alias="bMm", gt=0)
    h_mm: float | None = Field(default=None, alias="hMm", gt=0)


# --- Tool prefs -------------------------------------------------------------


class SetToolPrefCmd(BaseModel):
    """CHR-V3-08: Store a sticky tool-modifier preference for the session.

    ``tool`` is the authoring tool name (e.g. "wall", "door", "window").
    ``pref_key`` is the modifier name (e.g. "alignment", "swingSide", "multipleMode").
    ``pref_value`` is the serialised value (always a string; booleans as "true"/"false").
    """

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    type: Literal["setToolPref"] = "setToolPref"
    tool: str
    pref_key: str = Field(alias="prefKey")
    pref_value: str = Field(alias="prefValue")
