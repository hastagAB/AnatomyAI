from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.schemas import UploadedDocument
from app.db.engine import get_db
from app.db import repository as repo
from app.services.parser import parse_file, detect_file_type
from app.utils.file_utils import save_upload
from app.services import log_stream

router = APIRouter(prefix="/api", tags=["upload"])


@router.post("/projects")
async def create_project(name: str = "Untitled Project", db: AsyncSession = Depends(get_db)):
    row = await repo.create_project(db, name=name)
    log_stream.push(row.id, "INFO", f"Project created: '{row.name}'")
    return {"id": row.id, "name": row.name}


@router.get("/projects")
async def list_projects(db: AsyncSession = Depends(get_db)):
    return await repo.list_projects(db)


@router.get("/projects/{project_id}")
async def get_project(project_id: str, db: AsyncSession = Depends(get_db)):
    project = await repo.get_project(db, project_id)
    if not project:
        raise HTTPException(404, "Project not found")

    documents = await repo.get_documents(db, project_id)
    analysis = await repo.get_latest_analysis(db, project_id)
    plan = await repo.get_plan(db, project_id)
    diagram_summary = await repo.list_diagrams(db, project_id)
    all_diagrams = await repo.get_all_diagrams(db, project_id)
    chat_messages = await repo.get_chat_history(db, project_id)

    return {
        "id": project.id,
        "name": project.name,
        "documents": [
            {
                "id": d.id,
                "filename": d.filename,
                "file_type": d.file_type,
                "file_size": d.file_size,
                "chunk_count": len(d.chunks),
            }
            for d in documents
        ],
        "has_analysis": analysis is not None,
        "analysis": analysis.model_dump() if analysis else None,
        "has_plan": plan is not None,
        "plan": plan.model_dump() if plan else None,
        "diagram_types": list(diagram_summary.keys()),
        "diagrams": all_diagrams,
        "chat_messages": [msg.model_dump() for msg in chat_messages],
        "created_at": project.created_at,
    }


@router.post("/projects/{project_id}/upload")
async def upload_files(project_id: str, files: list[UploadFile] = File(...), db: AsyncSession = Depends(get_db)):
    project = await repo.get_project(db, project_id)
    if not project:
        raise HTTPException(404, "Project not found")

    log_stream.push(project_id, "INFO", f"Uploading {len(files)} file(s)")
    uploaded = []
    for file in files:
        content = await file.read()
        file_path = save_upload(content, file.filename)
        file_type = detect_file_type(file.filename)
        chunks = parse_file(file_path, file.filename)

        doc = UploadedDocument(
            filename=file.filename,
            file_type=file_type,
            file_size=len(content),
            chunks=chunks,
        )
        await repo.add_document(db, project_id, doc)
        log_stream.push(project_id, "INFO",
                        f"Uploaded: {file.filename} ({file_type}, {len(content)} bytes, {len(chunks)} chunks)")
        uploaded.append({
            "id": doc.id,
            "filename": doc.filename,
            "file_type": doc.file_type,
            "chunks": len(chunks),
        })

    all_docs = await repo.get_documents(db, project_id)
    log_stream.push(project_id, "INFO", f"Upload complete: {len(uploaded)} new, {len(all_docs)} total documents")
    return {"uploaded": uploaded, "total_documents": len(all_docs)}


@router.delete("/projects/{project_id}/documents/{doc_id}")
async def remove_document(project_id: str, doc_id: str, db: AsyncSession = Depends(get_db)):
    project = await repo.get_project(db, project_id)
    if not project:
        raise HTTPException(404, "Project not found")
    await repo.remove_document(db, project_id, doc_id)
    log_stream.push(project_id, "INFO", f"Document removed: {doc_id}")
    return {"ok": True}


@router.delete("/projects/{project_id}")
async def delete_project(project_id: str, db: AsyncSession = Depends(get_db)):
    project = await repo.get_project(db, project_id)
    if not project:
        raise HTTPException(404, "Project not found")
    await repo.delete_project(db, project_id)
    return {"ok": True}
