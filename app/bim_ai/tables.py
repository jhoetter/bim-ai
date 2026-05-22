import uuid
from datetime import datetime

from sqlalchemy import (
    BigInteger,
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    """SQLAlchemy declarative base."""


class ProjectRecord(Base):
    __tablename__ = "bim_projects"

    id: Mapped[uuid.UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True)
    slug: Mapped[str] = mapped_column(String(128), nullable=False, unique=True)
    title: Mapped[str] = mapped_column(String(256), nullable=False)

    models: Mapped[list["ModelRecord"]] = relationship(back_populates="project")


class ModelRecord(Base):
    __tablename__ = "bim_models"
    __table_args__ = (UniqueConstraint("project_id", "slug", name="uq_bim_model_project_slug"),)

    id: Mapped[uuid.UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True)
    project_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("bim_projects.id"), index=True)
    slug: Mapped[str] = mapped_column(String(128), nullable=False)
    revision: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    document: Mapped[dict] = mapped_column(JSONB, nullable=False)

    project: Mapped["ProjectRecord"] = relationship(back_populates="models")


class UndoStackRecord(Base):
    __tablename__ = "bim_undo_stack"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    model_id: Mapped[uuid.UUID] = mapped_column(PGUUID(as_uuid=True), index=True)

    user_id: Mapped[str] = mapped_column(String(256), index=True)

    revision_after: Mapped[int] = mapped_column(Integer, nullable=False)

    forward_commands: Mapped[list] = mapped_column(JSONB, nullable=False)

    undo_commands: Mapped[list] = mapped_column(JSONB, nullable=False)

    transaction_metadata: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    # Time-travel: groups consecutive transactions into a named commit with
    # agent context. Nullable so existing rows do not need backfill.
    commit_id: Mapped[str | None] = mapped_column(
        String(26),
        ForeignKey("bim_model_commits.commit_id"),
        nullable=True,
        index=True,
    )

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class RedoStackRecord(Base):
    __tablename__ = "bim_redo_stack"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    model_id: Mapped[uuid.UUID] = mapped_column(PGUUID(as_uuid=True), index=True)

    user_id: Mapped[str] = mapped_column(String(256), index=True)

    revision_after: Mapped[int] = mapped_column(Integer, nullable=False)

    forward_commands: Mapped[list] = mapped_column(JSONB, nullable=False)

    transaction_metadata: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class CommentRecord(Base):
    __tablename__ = "bim_comments"

    id: Mapped[uuid.UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True)

    model_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("bim_models.id"), index=True)

    user_display: Mapped[str] = mapped_column(String(256), nullable=False)

    body: Mapped[str] = mapped_column(Text, nullable=False)

    element_id: Mapped[str | None] = mapped_column(String(128), nullable=True)

    level_id: Mapped[str | None] = mapped_column(String(128), nullable=True)

    anchor_x_mm: Mapped[float | None] = mapped_column(Float, nullable=True)

    anchor_y_mm: Mapped[float | None] = mapped_column(Float, nullable=True)

    resolved: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class ActivityRowRecord(Base):
    __tablename__ = "activity_rows"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    model_id: Mapped[str] = mapped_column(
        PGUUID(as_uuid=False), ForeignKey("bim_models.id", ondelete="CASCADE"), index=True
    )
    author_id: Mapped[str] = mapped_column(String, nullable=False)
    kind: Mapped[str] = mapped_column(String, nullable=False)
    payload: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    ts: Mapped[int] = mapped_column(BigInteger, nullable=False, index=True)
    parent_snapshot_id: Mapped[str | None] = mapped_column(String, nullable=True)
    result_snapshot_id: Mapped[str | None] = mapped_column(String, nullable=True)


class MilestoneRecord(Base):
    __tablename__ = "milestones"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    model_id: Mapped[str] = mapped_column(
        PGUUID(as_uuid=False), ForeignKey("bim_models.id", ondelete="CASCADE"), index=True
    )
    name: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str | None] = mapped_column(String, nullable=True)
    snapshot_id: Mapped[str] = mapped_column(String, nullable=False)
    author_id: Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[int] = mapped_column(BigInteger, nullable=False)


class RoleAssignmentRecord(Base):
    __tablename__ = "role_assignments"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    model_id: Mapped[str] = mapped_column(
        PGUUID(as_uuid=False), ForeignKey("bim_models.id", ondelete="CASCADE"), index=True
    )
    subject_kind: Mapped[str] = mapped_column(String, nullable=False)
    subject_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    role: Mapped[str] = mapped_column(String, nullable=False)
    granted_by: Mapped[str] = mapped_column(String, nullable=False)
    granted_at: Mapped[int] = mapped_column(BigInteger, nullable=False)
    expires_at: Mapped[int | None] = mapped_column(BigInteger, nullable=True)


class ModelCommitRecord(Base):
    """Git-like commit grouping a contiguous range of bim_undo_stack rows.

    See spec/model-time-travel-tracker.md for the methodology and lifecycle.
    """

    __tablename__ = "bim_model_commits"

    # ULID, 26-char Crockford base32. Monotonic, human-copyable, sortable.
    commit_id: Mapped[str] = mapped_column(String(26), primary_key=True)

    model_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("bim_models.id"), index=True, nullable=False
    )

    # NULL for the very first commit on a model; otherwise points at the
    # immediately preceding closed commit. Not uniquely-indexed: the schema
    # permits forks even though the v1 API forbids creating them.
    parent_commit_id: Mapped[str | None] = mapped_column(
        ForeignKey("bim_model_commits.commit_id"), nullable=True, index=True
    )

    # Inclusive bounds resolved from bim_undo_stack.revision_after.
    first_revision: Mapped[int] = mapped_column(Integer, nullable=False)
    last_revision: Mapped[int] = mapped_column(Integer, nullable=False)

    # 'open' | 'closed' | 'aborted'.
    state: Mapped[str] = mapped_column(String(16), nullable=False, default="open")

    summary: Mapped[str] = mapped_column(Text, nullable=False, default="")

    # Free-form agent context. Conventional fields documented in the tracker:
    # sessionId, agentId, methodologyVersion, commandSchemaVersion,
    # iterationLabel, phaseId, sliceId, runId, source, toolCallIds, factIds,
    # outputDir, houseName, userId.
    context: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Set on close (skipped for aborted commits per resolved decision #6).
    snapshot_id: Mapped[int | None] = mapped_column(
        ForeignKey("bim_model_snapshots.id"), nullable=True
    )


class ModelSnapshotRecord(Base):
    """Full bim_models.document JSONB captured at a commit boundary."""

    __tablename__ = "bim_model_snapshots"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)

    model_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("bim_models.id"), index=True, nullable=False
    )
    commit_id: Mapped[str] = mapped_column(
        ForeignKey("bim_model_commits.commit_id"), nullable=False, unique=True
    )
    revision: Mapped[int] = mapped_column(Integer, nullable=False)

    document: Mapped[dict] = mapped_column(JSONB, nullable=False)

    # SHA-256 over canonical_transaction_digest()-style serialization
    # (json.dumps(..., sort_keys=True, separators=(",", ":"))). Enables
    # content-addressed dedup for no-op or near-identical commits.
    document_sha256: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    document_size_bytes: Mapped[int] = mapped_column(BigInteger, nullable=False)

    # Lightweight index of doc contents: { element_kind: count }. Lets the
    # log/dashboard show element counts without parsing the full JSONB.
    element_counts: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class PublicLinkRecord(Base):
    __tablename__ = "public_links"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    model_id: Mapped[str] = mapped_column(
        PGUUID(as_uuid=False), ForeignKey("bim_models.id", ondelete="CASCADE"), index=True
    )
    token: Mapped[str] = mapped_column(String, unique=True, index=True, nullable=False)
    created_by: Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[int] = mapped_column(BigInteger, nullable=False)
    expires_at: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    password_hash: Mapped[str | None] = mapped_column(String, nullable=True)
    is_revoked: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    display_name: Mapped[str | None] = mapped_column(String, nullable=True)
    open_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    # OUT-V3-01: durable flags (replaces in-memory _presentation_data dict)
    allow_measurement: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    allow_comment: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    page_scope_ids: Mapped[str | None] = mapped_column(String, nullable=True)  # JSON-encoded list
