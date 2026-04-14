"""Clarify API — pre-build gap analysis and resolution."""
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel
from app.db.engine import get_db
from app.db import repository as repo
from app.services.clarifier import (
    generate_clarifications, resolve_clarifications, auto_resolve_clarifications,
)
from app.services import log_stream

router = APIRouter(prefix="/api", tags=["clarify"])


class ClarifyBody(BaseModel):
    project_id: str


class ResolveBody(BaseModel):
    project_id: str
    resolutions: list[dict]  # [{id, question, answer}]


class AutoResolveBody(BaseModel):
    project_id: str
    items: list[dict]  # clarification items to auto-resolve


@router.post("/clarify")
async def clarify(body: ClarifyBody, db: AsyncSession = Depends(get_db)):
    project = await repo.get_project(db, body.project_id)
    if not project:
        raise HTTPException(404, "Project not found")
    analysis = await repo.get_latest_analysis(db, body.project_id)
    if not analysis:
        raise HTTPException(400, "Analyze the project first")

    log_stream.push(body.project_id, "INFO", "Clarification analysis started")
    try:
        result = await generate_clarifications(analysis)
        count = len(result.get("clarifications", []))

        # Add deterministic readiness score alongside LLM score
        from app.services.validator import compute_readiness_score
        readiness_info = compute_readiness_score(analysis)
        result["computed_readiness"] = readiness_info["readiness_score"]
        result["readiness_breakdown"] = readiness_info

        score = readiness_info["readiness_score"]
        log_stream.push(body.project_id, "INFO",
                        f"Clarification complete: {count} items, readiness={score}")
        return result
    except Exception as e:
        log_stream.push(body.project_id, "ERROR", f"Clarification failed: {e}")
        raise


@router.post("/clarify/auto-resolve")
async def auto_resolve(body: AutoResolveBody, db: AsyncSession = Depends(get_db)):
    """AI generates expert-level answers for unresolved clarification items."""
    project = await repo.get_project(db, body.project_id)
    if not project:
        raise HTTPException(404, "Project not found")
    analysis = await repo.get_latest_analysis(db, body.project_id)
    if not analysis:
        raise HTTPException(400, "Analyze the project first")

    log_stream.push(body.project_id, "INFO",
                    f"Auto-resolving {len(body.items)} clarification items")
    try:
        resolved = await auto_resolve_clarifications(analysis, body.items)
        log_stream.push(body.project_id, "INFO",
                        f"Auto-resolve complete: {len(resolved)} items resolved")
        return {"resolutions": resolved}
    except Exception as e:
        log_stream.push(body.project_id, "ERROR", f"Auto-resolve failed: {e}")
        raise


@router.post("/clarify/resolve")
async def resolve(body: ResolveBody, db: AsyncSession = Depends(get_db)):
    project = await repo.get_project(db, body.project_id)
    if not project:
        raise HTTPException(404, "Project not found")
    analysis = await repo.get_latest_analysis(db, body.project_id)
    if not analysis:
        raise HTTPException(400, "Analyze the project first")

    log_stream.push(body.project_id, "INFO",
                    f"Resolving {len(body.resolutions)} clarifications")
    try:
        updated = await resolve_clarifications(analysis, body.resolutions)
        version = await repo.save_analysis(db, body.project_id, updated, source="clarification")
        log_stream.push(body.project_id, "INFO",
                        f"Clarification resolve complete → analysis v{version}")
        return {
            "analysis": updated.model_dump(),
            "version": version,
            "resolved_count": len(body.resolutions),
        }
    except Exception as e:
        log_stream.push(body.project_id, "ERROR", f"Clarification resolve failed: {e}")
        raise
