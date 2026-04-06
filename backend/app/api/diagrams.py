from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.schemas import DiagramRequest, DiagramType
from app.db.engine import get_db
from app.db import repository as repo
from app.services.diagram_gen import generate_diagram
from app.services import log_stream

router = APIRouter(prefix="/api", tags=["diagrams"])


@router.post("/diagrams/generate")
async def gen_diagram(req: DiagramRequest, db: AsyncSession = Depends(get_db)):
    project = await repo.get_project(db, req.project_id)
    if not project:
        raise HTTPException(404, "Project not found")
    analysis = await repo.get_latest_analysis(db, req.project_id)
    if not analysis:
        raise HTTPException(400, "Project must be analyzed first")

    log_stream.push(req.project_id, "INFO", f"Diagram generation started: {req.diagram_type.value}")
    try:
        diagram = await generate_diagram(analysis, req.diagram_type)
        await repo.save_diagram(db, req.project_id, req.diagram_type.value, diagram)
        log_stream.push(req.project_id, "INFO",
                        f"Diagram complete: {req.diagram_type.value} → {len(diagram.nodes)} nodes, {len(diagram.edges)} edges")
        return diagram.model_dump()
    except Exception as e:
        log_stream.push(req.project_id, "ERROR", f"Diagram generation failed ({req.diagram_type.value}): {e}")
        raise


@router.get("/projects/{project_id}/diagrams/{diagram_type}")
async def get_diagram(project_id: str, diagram_type: str, db: AsyncSession = Depends(get_db)):
    project = await repo.get_project(db, project_id)
    if not project:
        raise HTTPException(404, "Project not found")
    diagram = await repo.get_diagram(db, project_id, diagram_type)
    if not diagram:
        raise HTTPException(404, "Diagram not generated yet")
    return diagram.model_dump()


@router.get("/projects/{project_id}/diagrams")
async def list_diagrams(project_id: str, db: AsyncSession = Depends(get_db)):
    project = await repo.get_project(db, project_id)
    if not project:
        raise HTTPException(404, "Project not found")
    return await repo.list_diagrams(db, project_id)


@router.get("/diagram-types")
async def list_diagram_types():
    return [
        {"value": dt.value, "label": dt.value.replace("_", " ").title()}
        for dt in DiagramType
    ]
