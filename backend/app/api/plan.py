from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.engine import get_db
from app.db import repository as repo
from app.services.planner import generate_plan
from app.services import log_stream
from pydantic import BaseModel

router = APIRouter(prefix="/api", tags=["plan"])


class PlanGenerateBody(BaseModel):
    project_id: str


@router.post("/plan/generate")
async def gen_plan(body: PlanGenerateBody, db: AsyncSession = Depends(get_db)):
    project = await repo.get_project(db, body.project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")
    analysis = await repo.get_latest_analysis(db, body.project_id)
    if analysis is None:
        raise HTTPException(status_code=400, detail="Analyze the project first")

    log_stream.push(body.project_id, "INFO", "Plan generation started")
    try:
        result = await generate_plan(analysis)
        await repo.save_plan(db, body.project_id, result)
        log_stream.push(body.project_id, "INFO",
                        f"Plan generation complete: {len(result.phases)} phases, {len(result.tasks)} tasks")
        return result.model_dump()
    except Exception as e:
        log_stream.push(body.project_id, "ERROR", f"Plan generation failed: {e}")
        raise


@router.get("/projects/{project_id}/plan")
async def get_plan(project_id: str, db: AsyncSession = Depends(get_db)):
    project = await repo.get_project(db, project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")
    plan = await repo.get_plan(db, project_id)
    if plan is None:
        raise HTTPException(status_code=404, detail="Plan not generated yet")
    return plan.model_dump()
