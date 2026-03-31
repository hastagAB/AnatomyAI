from __future__ import annotations
import json
import uuid
import time
from sqlalchemy import select, delete, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.models import (
    ProjectRow, DocumentRow, DocumentChunkRow, ExtractionRow,
    AnalysisRow, DiagramRow, ChatMessageRow, PlanRow, RefinementRow,
)
from app.models.schemas import (
    ProjectState, UploadedDocument, DocumentChunk, AnalysisResult,
    PartialExtraction, DiagramData, ChatMessage, ProjectPlan, FileType,
    Component, DataFlow, DataModel, Layer, TechStackEntry, NFR, Gap,
)


def _migrate_analysis(data: dict) -> AnalysisResult:
    """Migrate old list[dict] analysis data to typed AnalysisResult.

    Old format: {"components": [{"name": "...", "type": "...", ...}], ...}
    New format: {"components": [{"id": "comp-1", "name": "...", ...}], ...}

    Gracefully handles both old and new formats.
    """
    def _ensure_id(items: list, prefix: str) -> list:
        for i, item in enumerate(items):
            if isinstance(item, dict) and not item.get("id"):
                item["id"] = f"{prefix}-{i + 1}"
        return items

    if isinstance(data.get("components"), list):
        _ensure_id(data["components"], "comp")
    if isinstance(data.get("data_flows"), list):
        _ensure_id(data["data_flows"], "flow")
        # Backfill source_id/target_id from source/target names if missing
        comp_name_to_id = {}
        for c in data.get("components", []):
            if isinstance(c, dict):
                comp_name_to_id[c.get("name", "")] = c.get("id", "")
        for f in data.get("data_flows", []):
            if isinstance(f, dict):
                if not f.get("source_id") and f.get("source"):
                    f["source_id"] = comp_name_to_id.get(f["source"], "")
                if not f.get("target_id") and f.get("target"):
                    f["target_id"] = comp_name_to_id.get(f["target"], "")
    if isinstance(data.get("data_models"), list):
        _ensure_id(data["data_models"], "model")
    if isinstance(data.get("layers"), list):
        _ensure_id(data["layers"], "layer")
    if isinstance(data.get("tech_stack"), list):
        _ensure_id(data["tech_stack"], "tech")
    if isinstance(data.get("nonfunctional_requirements"), list):
        _ensure_id(data["nonfunctional_requirements"], "nfr")
    if isinstance(data.get("gaps"), list):
        _ensure_id(data["gaps"], "gap")

    return AnalysisResult(**data)


def _migrate_extraction(data: dict) -> PartialExtraction:
    """Migrate old extraction data to typed PartialExtraction."""
    def _ensure_id(items: list, prefix: str) -> list:
        for i, item in enumerate(items):
            if isinstance(item, dict) and not item.get("id"):
                item["id"] = f"{prefix}-{i + 1}"
        return items

    for key, prefix in [
        ("components", "comp"), ("data_flows", "flow"), ("data_models", "model"),
        ("tech_stack", "tech"), ("nonfunctional_requirements", "nfr"), ("gaps", "gap"),
    ]:
        if isinstance(data.get(key), list):
            _ensure_id(data[key], prefix)

    return PartialExtraction(**data)


# ── Project ─────────────────────────────────────────────────────────

async def create_project(db: AsyncSession, name: str) -> ProjectRow:
    row = ProjectRow(id=str(uuid.uuid4()), name=name)
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return row


async def get_project(db: AsyncSession, project_id: str) -> ProjectRow | None:
    return await db.get(ProjectRow, project_id)


async def list_projects(db: AsyncSession) -> list[dict]:
    stmt = (
        select(
            ProjectRow.id,
            ProjectRow.name,
            ProjectRow.created_at,
            func.count(DocumentRow.id).label("document_count"),
        )
        .outerjoin(DocumentRow, (DocumentRow.project_id == ProjectRow.id) & (DocumentRow.is_active == True))
        .group_by(ProjectRow.id)
    )
    rows = (await db.execute(stmt)).all()

    result = []
    for r in rows:
        analysis_exists = (await db.execute(
            select(AnalysisRow.id).where(AnalysisRow.project_id == r.id).limit(1)
        )).scalar_one_or_none()
        result.append({
            "id": r.id,
            "name": r.name,
            "document_count": r.document_count,
            "has_analysis": analysis_exists is not None,
            "created_at": r.created_at,
        })
    return result


async def delete_project(db: AsyncSession, project_id: str):
    row = await db.get(ProjectRow, project_id)
    if row:
        await db.delete(row)
        await db.commit()


# ── Documents ────────────────────────────────────────────────────────

async def add_document(
    db: AsyncSession,
    project_id: str,
    doc: UploadedDocument,
) -> DocumentRow:
    doc_row = DocumentRow(
        id=doc.id,
        project_id=project_id,
        filename=doc.filename,
        file_type=doc.file_type.value,
        file_size=doc.file_size,
        uploaded_at=doc.uploaded_at,
    )
    db.add(doc_row)

    for chunk in doc.chunks:
        chunk_row = DocumentChunkRow(
            id=chunk.id,
            document_id=doc.id,
            filename=chunk.filename,
            file_type=chunk.file_type.value,
            content=chunk.content,
            metadata_json=json.dumps(chunk.metadata),
            page_number=chunk.page_number,
        )
        db.add(chunk_row)

    await db.commit()
    return doc_row


async def get_documents(db: AsyncSession, project_id: str) -> list[UploadedDocument]:
    stmt = (
        select(DocumentRow)
        .where(DocumentRow.project_id == project_id, DocumentRow.is_active == True)
        .options(selectinload(DocumentRow.chunks))
    )
    rows = (await db.execute(stmt)).scalars().all()

    docs = []
    for r in rows:
        chunks = [
            DocumentChunk(
                id=c.id,
                filename=c.filename,
                file_type=FileType(c.file_type),
                content=c.content,
                metadata=json.loads(c.metadata_json) if c.metadata_json else {},
                page_number=c.page_number,
            )
            for c in r.chunks
        ]
        docs.append(UploadedDocument(
            id=r.id,
            filename=r.filename,
            file_type=FileType(r.file_type),
            file_size=r.file_size,
            chunks=chunks,
            uploaded_at=r.uploaded_at,
        ))
    return docs


async def remove_document(db: AsyncSession, project_id: str, doc_id: str):
    stmt = delete(DocumentRow).where(
        DocumentRow.id == doc_id, DocumentRow.project_id == project_id
    )
    await db.execute(stmt)
    await db.commit()


# ── Partial Extractions ──────────────────────────────────────────────

async def save_extraction(
    db: AsyncSession,
    project_id: str,
    extraction: PartialExtraction,
):
    row = ExtractionRow(
        id=str(uuid.uuid4()),
        project_id=project_id,
        document_names=extraction.document_name,
        data_json=extraction.model_dump_json(),
        created_at=time.time(),
    )
    db.add(row)
    await db.commit()


async def get_extractions(db: AsyncSession, project_id: str) -> list[PartialExtraction]:
    stmt = (
        select(ExtractionRow)
        .where(ExtractionRow.project_id == project_id)
        .order_by(ExtractionRow.created_at)
    )
    rows = (await db.execute(stmt)).scalars().all()
    return [_migrate_extraction(json.loads(r.data_json)) for r in rows]


async def clear_extractions(db: AsyncSession, project_id: str):
    await db.execute(
        delete(ExtractionRow).where(ExtractionRow.project_id == project_id)
    )
    await db.commit()


# ── Analysis ─────────────────────────────────────────────────────────

async def save_analysis(
    db: AsyncSession,
    project_id: str,
    analysis: AnalysisResult,
    source: str = "analysis",
) -> int:
    # Get next version number
    stmt = select(func.coalesce(func.max(AnalysisRow.version), 0)).where(
        AnalysisRow.project_id == project_id
    )
    current_version = (await db.execute(stmt)).scalar_one()
    new_version = current_version + 1

    row = AnalysisRow(
        id=str(uuid.uuid4()),
        project_id=project_id,
        version=new_version,
        source=source,
        data_json=analysis.model_dump_json(),
        created_at=time.time(),
    )
    db.add(row)
    await db.commit()
    return new_version


async def get_latest_analysis(db: AsyncSession, project_id: str) -> AnalysisResult | None:
    stmt = (
        select(AnalysisRow)
        .where(AnalysisRow.project_id == project_id)
        .order_by(AnalysisRow.version.desc())
        .limit(1)
    )
    row = (await db.execute(stmt)).scalar_one_or_none()
    if not row:
        return None
    return _migrate_analysis(json.loads(row.data_json))


async def get_analysis_versions(db: AsyncSession, project_id: str) -> list[dict]:
    stmt = (
        select(AnalysisRow)
        .where(AnalysisRow.project_id == project_id)
        .order_by(AnalysisRow.version.desc())
    )
    rows = (await db.execute(stmt)).scalars().all()
    versions = []
    for r in rows:
        data = json.loads(r.data_json)
        versions.append({
            "version": r.version,
            "source": r.source,
            "summary": data.get("summary", ""),
            "components": len(data.get("components", [])),
            "data_flows": len(data.get("data_flows", [])),
            "gaps": len(data.get("gaps", [])),
            "tech_stack": len(data.get("tech_stack", [])),
            "created_at": r.created_at,
        })
    return versions


async def get_analysis_by_version(
    db: AsyncSession, project_id: str, version: int,
) -> AnalysisResult | None:
    stmt = select(AnalysisRow).where(
        AnalysisRow.project_id == project_id,
        AnalysisRow.version == version,
    )
    row = (await db.execute(stmt)).scalar_one_or_none()
    if not row:
        return None
    return _migrate_analysis(json.loads(row.data_json))


async def clear_analysis(db: AsyncSession, project_id: str):
    await db.execute(
        delete(AnalysisRow).where(AnalysisRow.project_id == project_id)
    )
    await db.commit()


# ── Diagrams ─────────────────────────────────────────────────────────

async def save_diagram(
    db: AsyncSession,
    project_id: str,
    diagram_type: str,
    diagram: DiagramData,
):
    # Upsert: delete existing, insert new
    await db.execute(
        delete(DiagramRow).where(
            DiagramRow.project_id == project_id,
            DiagramRow.diagram_type == diagram_type,
        )
    )
    row = DiagramRow(
        id=str(uuid.uuid4()),
        project_id=project_id,
        diagram_type=diagram_type,
        data_json=diagram.model_dump_json(),
        created_at=time.time(),
    )
    db.add(row)
    await db.commit()


async def get_diagram(
    db: AsyncSession, project_id: str, diagram_type: str,
) -> DiagramData | None:
    stmt = select(DiagramRow).where(
        DiagramRow.project_id == project_id,
        DiagramRow.diagram_type == diagram_type,
    )
    row = (await db.execute(stmt)).scalar_one_or_none()
    if not row:
        return None
    return DiagramData(**json.loads(row.data_json))


async def list_diagrams(db: AsyncSession, project_id: str) -> dict:
    stmt = select(DiagramRow).where(DiagramRow.project_id == project_id)
    rows = (await db.execute(stmt)).scalars().all()
    result = {}
    for r in rows:
        data = DiagramData(**json.loads(r.data_json))
        result[r.diagram_type] = {
            "title": data.title,
            "node_count": len(data.nodes),
            "edge_count": len(data.edges),
        }
    return result


async def get_all_diagrams(db: AsyncSession, project_id: str) -> dict:
    """Return full diagram data for all generated diagrams."""
    stmt = select(DiagramRow).where(DiagramRow.project_id == project_id)
    rows = (await db.execute(stmt)).scalars().all()
    result = {}
    for r in rows:
        result[r.diagram_type] = json.loads(r.data_json)
    return result


# ── Chat ─────────────────────────────────────────────────────────────

async def add_chat_message(
    db: AsyncSession, project_id: str, role: str, content: str,
):
    row = ChatMessageRow(
        id=str(uuid.uuid4()),
        project_id=project_id,
        role=role,
        content=content,
        timestamp=time.time(),
    )
    db.add(row)
    await db.commit()


async def get_chat_history(db: AsyncSession, project_id: str) -> list[ChatMessage]:
    stmt = (
        select(ChatMessageRow)
        .where(ChatMessageRow.project_id == project_id)
        .order_by(ChatMessageRow.timestamp)
    )
    rows = (await db.execute(stmt)).scalars().all()
    return [
        ChatMessage(role=r.role, content=r.content, timestamp=r.timestamp)
        for r in rows
    ]


async def clear_chat_history(db: AsyncSession, project_id: str):
    await db.execute(
        delete(ChatMessageRow).where(ChatMessageRow.project_id == project_id)
    )
    await db.commit()


# ── Plan ─────────────────────────────────────────────────────────────

async def save_plan(db: AsyncSession, project_id: str, plan: ProjectPlan):
    # Upsert: delete existing, insert new
    await db.execute(
        delete(PlanRow).where(PlanRow.project_id == project_id)
    )
    row = PlanRow(
        id=str(uuid.uuid4()),
        project_id=project_id,
        data_json=plan.model_dump_json(),
        created_at=time.time(),
    )
    db.add(row)
    await db.commit()


async def get_plan(db: AsyncSession, project_id: str) -> ProjectPlan | None:
    stmt = (
        select(PlanRow)
        .where(PlanRow.project_id == project_id)
        .order_by(PlanRow.created_at.desc())
        .limit(1)
    )
    row = (await db.execute(stmt)).scalar_one_or_none()
    if not row:
        return None
    return ProjectPlan(**json.loads(row.data_json))


# ── Full Project State (for services) ────────────────────────────────

async def get_project_state(db: AsyncSession, project_id: str) -> ProjectState | None:
    project = await db.get(ProjectRow, project_id)
    if not project:
        return None

    documents = await get_documents(db, project_id)
    analysis = await get_latest_analysis(db, project_id)
    extractions = await get_extractions(db, project_id)
    chat_history = await get_chat_history(db, project_id)
    plan = await get_plan(db, project_id)

    # Load diagrams as dict
    stmt = select(DiagramRow).where(DiagramRow.project_id == project_id)
    diagram_rows = (await db.execute(stmt)).scalars().all()
    diagrams = {
        r.diagram_type: DiagramData(**json.loads(r.data_json))
        for r in diagram_rows
    }

    return ProjectState(
        id=project.id,
        name=project.name,
        documents=documents,
        analysis=analysis,
        partial_extractions=extractions,
        diagrams=diagrams,
        plan=plan,
        chat_history=chat_history,
        created_at=project.created_at,
    )


# ── Refinements ──────────────────────────────────────────────────────

async def save_refinement(
    db: AsyncSession,
    project_id: str,
    instructions: str,
    search_results: list[dict],
    produced_version: int | None = None,
):
    row = RefinementRow(
        id=str(uuid.uuid4()),
        project_id=project_id,
        instructions=instructions,
        search_results_json=json.dumps(search_results),
        produced_version=produced_version,
        created_at=time.time(),
    )
    db.add(row)
    await db.commit()


async def get_refinements(db: AsyncSession, project_id: str) -> list[dict]:
    stmt = (
        select(RefinementRow)
        .where(RefinementRow.project_id == project_id)
        .order_by(RefinementRow.created_at)
    )
    rows = (await db.execute(stmt)).scalars().all()
    return [
        {
            "id": r.id,
            "instructions": r.instructions,
            "search_results": json.loads(r.search_results_json),
            "produced_version": r.produced_version,
            "created_at": r.created_at,
        }
        for r in rows
    ]
