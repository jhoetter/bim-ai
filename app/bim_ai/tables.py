import uuid
from datetime import datetime

from sqlalchemy import BigInteger, Boolean, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint
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

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class RedoStackRecord(Base):
    __tablename__ = "bim_redo_stack"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    model_id: Mapped[uuid.UUID] = mapped_column(PGUUID(as_uuid=True), index=True)

    user_id: Mapped[str] = mapped_column(String(256), index=True)

    revision_after: Mapped[int] = mapped_column(Integer, nullable=False)

    forward_commands: Mapped[list] = mapped_column(JSONB, nullable=False)

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
        String, ForeignKey("bim_models.id", ondelete="CASCADE"), index=True
    )
    author_id: Mapped[str] = mapped_column(String, nullable=False)
    kind: Mapped[str] = mapped_column(String, nullable=False)
    payload: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    ts: Mapped[int] = mapped_column(BigInteger, nullable=False, index=True)
    parent_snapshot_id: Mapped[str | None] = mapped_column(String, nullable=True)
    result_snapshot_id: Mapped[str | None] = mapped_column(String, nullable=True)


class RoleAssignmentRecord(Base):
    __tablename__ = "role_assignments"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    model_id: Mapped[str] = mapped_column(
        String, ForeignKey("bim_models.id", ondelete="CASCADE"), index=True
    )
    subject_kind: Mapped[str] = mapped_column(String, nullable=False)
    subject_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    role: Mapped[str] = mapped_column(String, nullable=False)
    granted_by: Mapped[str] = mapped_column(String, nullable=False)
    granted_at: Mapped[int] = mapped_column(BigInteger, nullable=False)
    expires_at: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
