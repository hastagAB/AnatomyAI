from __future__ import annotations
import uuid
import time
from sqlalchemy import (
    Column, String, Text, Integer, Float, Boolean, ForeignKey, LargeBinary,
)
from sqlalchemy.orm import DeclarativeBase, relationship


def _uuid() -> str:
    return str(uuid.uuid4())


def _now() -> float:
    return time.time()


class Base(DeclarativeBase):
    pass


class ProjectRow(Base):
    __tablename__ = "projects"

    id = Column(String, primary_key=True, default=_uuid)
    name = Column(String, nullable=False)
    created_at = Column(Float, nullable=False, default=_now)
    updated_at = Column(Float, nullable=False, default=_now, onupdate=_now)

    documents = relationship("DocumentRow", back_populates="project", cascade="all, delete-orphan")
    extractions = relationship("ExtractionRow", back_populates="project", cascade="all, delete-orphan")
    analyses = relationship("AnalysisRow", back_populates="project", cascade="all, delete-orphan")
    diagrams = relationship("DiagramRow", back_populates="project", cascade="all, delete-orphan")
    chat_messages = relationship("ChatMessageRow", back_populates="project", cascade="all, delete-orphan")
    plans = relationship("PlanRow", back_populates="project", cascade="all, delete-orphan")
    refinements = relationship("RefinementRow", back_populates="project", cascade="all, delete-orphan")


class DocumentRow(Base):
    __tablename__ = "documents"

    id = Column(String, primary_key=True, default=_uuid)
    project_id = Column(String, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    filename = Column(String, nullable=False)
    file_type = Column(String, nullable=False)
    file_size = Column(Integer, nullable=False)
    version = Column(Integer, nullable=False, default=1)
    content_hash = Column(String, nullable=False, default="")
    is_active = Column(Boolean, nullable=False, default=True)
    uploaded_at = Column(Float, nullable=False, default=_now)

    project = relationship("ProjectRow", back_populates="documents")
    chunks = relationship("DocumentChunkRow", back_populates="document", cascade="all, delete-orphan")


class DocumentChunkRow(Base):
    __tablename__ = "document_chunks"

    id = Column(String, primary_key=True, default=_uuid)
    document_id = Column(String, ForeignKey("documents.id", ondelete="CASCADE"), nullable=False)
    filename = Column(String, nullable=False)
    file_type = Column(String, nullable=False)
    content = Column(Text, nullable=False)
    metadata_json = Column(Text, nullable=False, default="{}")
    page_number = Column(Integer, nullable=True)
    embedding = Column(LargeBinary, nullable=True)

    document = relationship("DocumentRow", back_populates="chunks")


class ExtractionRow(Base):
    __tablename__ = "partial_extractions"

    id = Column(String, primary_key=True, default=_uuid)
    project_id = Column(String, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    document_names = Column(Text, nullable=False)
    data_json = Column(Text, nullable=False)
    created_at = Column(Float, nullable=False, default=_now)

    project = relationship("ProjectRow", back_populates="extractions")


class AnalysisRow(Base):
    __tablename__ = "analyses"

    id = Column(String, primary_key=True, default=_uuid)
    project_id = Column(String, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    version = Column(Integer, nullable=False, default=1)
    source = Column(String, nullable=False, default="analysis")
    data_json = Column(Text, nullable=False)
    created_at = Column(Float, nullable=False, default=_now)

    project = relationship("ProjectRow", back_populates="analyses")


class DiagramRow(Base):
    __tablename__ = "diagrams"

    id = Column(String, primary_key=True, default=_uuid)
    project_id = Column(String, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    diagram_type = Column(String, nullable=False)
    data_json = Column(Text, nullable=False)
    created_at = Column(Float, nullable=False, default=_now)

    project = relationship("ProjectRow", back_populates="diagrams")


class ChatMessageRow(Base):
    __tablename__ = "chat_messages"

    id = Column(String, primary_key=True, default=_uuid)
    project_id = Column(String, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    role = Column(String, nullable=False)
    content = Column(Text, nullable=False)
    timestamp = Column(Float, nullable=False, default=_now)

    project = relationship("ProjectRow", back_populates="chat_messages")


class PlanRow(Base):
    __tablename__ = "plans"

    id = Column(String, primary_key=True, default=_uuid)
    project_id = Column(String, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    data_json = Column(Text, nullable=False)
    created_at = Column(Float, nullable=False, default=_now)

    project = relationship("ProjectRow", back_populates="plans")


class RefinementRow(Base):
    __tablename__ = "refinements"

    id = Column(String, primary_key=True, default=_uuid)
    project_id = Column(String, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    instructions = Column(Text, nullable=False)
    search_results_json = Column(Text, nullable=False, default="[]")
    produced_version = Column(Integer, nullable=True)
    created_at = Column(Float, nullable=False, default=_now)

    project = relationship("ProjectRow", back_populates="refinements")
