"""Project export / import — ZIP-based transfer between Anatomy instances."""
from __future__ import annotations
import io
import json
import os
import time
import uuid
import zipfile

from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db.engine import get_db
from app.db import repository as repo
from app.db.models import (
    ExtractionRow, AnalysisRow, DiagramRow, PlanRow,
    ChatMessageRow, RefinementRow,
)
from sqlalchemy import select

router = APIRouter(prefix="/api", tags=["transfer"])

MANIFEST_VERSION = 1


# ── Export ───────────────────────────────────────────────────────────

@router.get("/projects/{project_id}/export")
async def export_project(project_id: str, db: AsyncSession = Depends(get_db)):
    project = await repo.get_project(db, project_id)
    if not project:
        raise HTTPException(404, "Project not found")

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        # 1. Manifest
        manifest = {
            "version": MANIFEST_VERSION,
            "exported_at": time.time(),
            "project_id": project.id,
            "project_name": project.name,
        }
        zf.writestr("manifest.json", json.dumps(manifest, indent=2))

        # 2. Project metadata
        zf.writestr("project.json", json.dumps({
            "id": project.id,
            "name": project.name,
            "created_at": project.created_at,
            "updated_at": project.updated_at,
        }, indent=2))

        # 3. Documents + chunks
        documents = await repo.get_documents(db, project_id)
        docs_data = []
        for d in documents:
            doc_dict = {
                "id": d.id,
                "filename": d.filename,
                "file_type": d.file_type.value,
                "file_size": d.file_size,
                "uploaded_at": d.uploaded_at,
                "chunks": [
                    {
                        "id": c.id,
                        "filename": c.filename,
                        "file_type": c.file_type.value,
                        "content": c.content,
                        "metadata": c.metadata,
                        "page_number": c.page_number,
                    }
                    for c in d.chunks
                ],
            }
            docs_data.append(doc_dict)
        zf.writestr("documents.json", json.dumps(docs_data, indent=1))

        # 4. Partial extractions (raw JSON rows)
        ext_rows = (await db.execute(
            select(ExtractionRow)
            .where(ExtractionRow.project_id == project_id)
            .order_by(ExtractionRow.created_at)
        )).scalars().all()
        extractions_data = [
            {"document_names": r.document_names, "data_json": r.data_json, "created_at": r.created_at}
            for r in ext_rows
        ]
        zf.writestr("extractions.json", json.dumps(extractions_data, indent=1))

        # 5. Analysis versions
        analysis_rows = (await db.execute(
            select(AnalysisRow)
            .where(AnalysisRow.project_id == project_id)
            .order_by(AnalysisRow.version)
        )).scalars().all()
        analyses_data = [
            {"version": r.version, "source": r.source, "data_json": r.data_json, "created_at": r.created_at}
            for r in analysis_rows
        ]
        zf.writestr("analyses.json", json.dumps(analyses_data, indent=1))

        # 6. Diagrams
        diagram_rows = (await db.execute(
            select(DiagramRow).where(DiagramRow.project_id == project_id)
        )).scalars().all()
        diagrams_data = [
            {"diagram_type": r.diagram_type, "data_json": r.data_json, "created_at": r.created_at}
            for r in diagram_rows
        ]
        zf.writestr("diagrams.json", json.dumps(diagrams_data, indent=1))

        # 7. Plan
        plan_rows = (await db.execute(
            select(PlanRow).where(PlanRow.project_id == project_id)
        )).scalars().all()
        plans_data = [
            {"data_json": r.data_json, "created_at": r.created_at}
            for r in plan_rows
        ]
        zf.writestr("plan.json", json.dumps(plans_data, indent=1))

        # 8. Refinements
        refinement_rows = (await db.execute(
            select(RefinementRow).where(RefinementRow.project_id == project_id)
        )).scalars().all()
        refinements_data = [
            {
                "instructions": r.instructions,
                "search_results_json": r.search_results_json,
                "produced_version": r.produced_version,
                "created_at": r.created_at,
            }
            for r in refinement_rows
        ]
        zf.writestr("refinements.json", json.dumps(refinements_data, indent=1))

        # 9. Original upload files (if they exist on disk)
        upload_dir = settings.upload_dir
        if os.path.isdir(upload_dir):
            for fname in os.listdir(upload_dir):
                fpath = os.path.join(upload_dir, fname)
                # Only include files belonging to this project's documents
                doc_ids = {d.id for d in documents}
                if any(fname.startswith(did) for did in doc_ids) or _file_belongs_to_project(fname, documents):
                    zf.write(fpath, f"uploads/{fname}")

    buf.seek(0)
    safe_name = project.name.replace(" ", "-").replace("/", "_")[:50]
    filename = f"anatomy-{safe_name}.zip"

    return StreamingResponse(
        buf,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


def _file_belongs_to_project(fname: str, documents) -> bool:
    """Check if an upload file matches any document filename."""
    # Upload files are saved as {uuid}_{original_filename}
    # Try matching the part after the first underscore
    parts = fname.split("_", 1)
    if len(parts) < 2:
        return False
    original_name = parts[1]
    return any(d.filename == original_name for d in documents)


# ── Import ───────────────────────────────────────────────────────────

@router.post("/projects/import")
async def import_project(file: UploadFile = File(...), db: AsyncSession = Depends(get_db)):
    content = await file.read()
    if len(content) > 500 * 1024 * 1024:  # 500 MB safety limit
        raise HTTPException(413, "File too large (max 500 MB)")

    try:
        zf = zipfile.ZipFile(io.BytesIO(content))
    except zipfile.BadZipFile:
        raise HTTPException(400, "Invalid ZIP file")

    # Validate manifest
    if "manifest.json" not in zf.namelist():
        raise HTTPException(400, "Missing manifest.json — not an Anatomy export")
    manifest = json.loads(zf.read("manifest.json"))
    if manifest.get("version") != MANIFEST_VERSION:
        raise HTTPException(400, f"Unsupported export version: {manifest.get('version')}")

    # Generate a new project ID to avoid collisions
    new_project_id = str(uuid.uuid4())
    old_to_new_doc_ids: dict[str, str] = {}
    old_to_new_chunk_ids: dict[str, str] = {}

    # 1. Read project metadata
    project_data = json.loads(zf.read("project.json"))
    project_name = project_data.get("name", "Imported Project")

    from app.db.models import (
        ProjectRow, DocumentRow, DocumentChunkRow,
        ExtractionRow, AnalysisRow, DiagramRow, PlanRow, RefinementRow,
    )

    # 2. Create project
    now = time.time()
    project_row = ProjectRow(
        id=new_project_id,
        name=project_name,
        created_at=project_data.get("created_at", now),
        updated_at=now,
    )
    db.add(project_row)

    # 3. Import documents + chunks
    if "documents.json" in zf.namelist():
        docs_data = json.loads(zf.read("documents.json"))
        for doc in docs_data:
            new_doc_id = str(uuid.uuid4())
            old_to_new_doc_ids[doc["id"]] = new_doc_id

            doc_row = DocumentRow(
                id=new_doc_id,
                project_id=new_project_id,
                filename=doc["filename"],
                file_type=doc["file_type"],
                file_size=doc["file_size"],
                uploaded_at=doc.get("uploaded_at", now),
            )
            db.add(doc_row)

            for chunk in doc.get("chunks", []):
                new_chunk_id = str(uuid.uuid4())
                old_to_new_chunk_ids[chunk["id"]] = new_chunk_id

                chunk_row = DocumentChunkRow(
                    id=new_chunk_id,
                    document_id=new_doc_id,
                    filename=chunk["filename"],
                    file_type=chunk["file_type"],
                    content=chunk["content"],
                    metadata_json=json.dumps(chunk.get("metadata", {})),
                    page_number=chunk.get("page_number"),
                )
                db.add(chunk_row)

    # 4. Import extractions
    if "extractions.json" in zf.namelist():
        for ext in json.loads(zf.read("extractions.json")):
            db.add(ExtractionRow(
                id=str(uuid.uuid4()),
                project_id=new_project_id,
                document_names=ext["document_names"],
                data_json=ext["data_json"],
                created_at=ext.get("created_at", now),
            ))

    # 5. Import analyses
    if "analyses.json" in zf.namelist():
        for a in json.loads(zf.read("analyses.json")):
            db.add(AnalysisRow(
                id=str(uuid.uuid4()),
                project_id=new_project_id,
                version=a["version"],
                source=a["source"],
                data_json=a["data_json"],
                created_at=a.get("created_at", now),
            ))

    # 6. Import diagrams
    if "diagrams.json" in zf.namelist():
        for d in json.loads(zf.read("diagrams.json")):
            db.add(DiagramRow(
                id=str(uuid.uuid4()),
                project_id=new_project_id,
                diagram_type=d["diagram_type"],
                data_json=d["data_json"],
                created_at=d.get("created_at", now),
            ))

    # 7. Import plan
    if "plan.json" in zf.namelist():
        for p in json.loads(zf.read("plan.json")):
            db.add(PlanRow(
                id=str(uuid.uuid4()),
                project_id=new_project_id,
                data_json=p["data_json"],
                created_at=p.get("created_at", now),
            ))

    # 8. Import refinements
    if "refinements.json" in zf.namelist():
        for r in json.loads(zf.read("refinements.json")):
            db.add(RefinementRow(
                id=str(uuid.uuid4()),
                project_id=new_project_id,
                instructions=r["instructions"],
                search_results_json=r["search_results_json"],
                produced_version=r.get("produced_version"),
                created_at=r.get("created_at", now),
            ))

    # 9. Restore upload files to disk
    upload_dir = settings.upload_dir
    os.makedirs(upload_dir, exist_ok=True)
    for name in zf.namelist():
        if name.startswith("uploads/") and not name.endswith("/"):
            fname = name.split("/", 1)[1]
            target = os.path.join(upload_dir, fname)
            if not os.path.exists(target):
                with open(target, "wb") as f:
                    f.write(zf.read(name))

    await db.commit()

    return {
        "id": new_project_id,
        "name": project_name,
        "message": f"Project '{project_name}' imported successfully",
    }
