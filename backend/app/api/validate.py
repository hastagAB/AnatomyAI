"""Validate API — structural validation and quality gate for analysis."""
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel

from app.db.engine import get_db
from app.db import repository as repo
from app.services.validator import validate_analysis
from app.services.quality_gate import run_quality_gate

router = APIRouter(prefix="/api", tags=["validate"])


class ValidateBody(BaseModel):
    project_id: str


@router.post("/analyze/validate")
async def validate(body: ValidateBody, db: AsyncSession = Depends(get_db)):
    """Run structural validation + LLM quality gate on the latest analysis."""
    project = await repo.get_project(db, body.project_id)
    if not project:
        raise HTTPException(404, "Project not found")

    analysis = await repo.get_latest_analysis(db, body.project_id)
    if not analysis:
        raise HTTPException(400, "Analyze the project first")

    # Structural validation
    validation_report = validate_analysis(analysis)
    analysis.validation = validation_report

    # LLM quality gate
    documents = await repo.get_documents(db, body.project_id)
    quality_report = await run_quality_gate(analysis, documents)
    analysis.quality = quality_report

    # Save updated analysis with reports
    version = await repo.save_analysis(db, body.project_id, analysis, source="validation")

    return {
        "validation": validation_report.model_dump(),
        "quality": quality_report.model_dump(),
        "version": version,
    }
