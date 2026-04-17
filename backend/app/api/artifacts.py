"""Custom artifacts API — generate free-form AI analysis reports from project data."""
from __future__ import annotations

import json
import logging
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sse_starlette.sse import EventSourceResponse

from app.db.engine import get_db
from app.db import repository as repo
from app.services import log_stream
from app.services.custom_artifacts import generate_custom_artifact

logger = logging.getLogger("anatomy.api.artifacts")
router = APIRouter(prefix="/api/artifacts", tags=["artifacts"])


class ArtifactRequest(BaseModel):
    project_id: str
    prompt: str
    title: str = ""


@router.post("/generate")
async def generate_artifact(req: ArtifactRequest, db: AsyncSession = Depends(get_db)):
    project = await repo.get_project(db, req.project_id)
    if not project:
        raise HTTPException(404, "Project not found")

    analysis = await repo.get_latest_analysis(db, req.project_id)
    if not analysis:
        raise HTTPException(400, "No analysis found. Run analysis first.")

    log_stream.push(req.project_id, "INFO", f"Custom artifact generation started: {req.title or req.prompt[:60]}")

    async def event_stream():
        try:
            async for chunk in generate_custom_artifact(
                analysis=analysis,
                prompt=req.prompt,
                title=req.title,
            ):
                yield {"event": "message", "data": json.dumps(chunk)}
        except Exception as e:
            logger.error("Artifact generation failed: %s", e, exc_info=True)
            log_stream.push(req.project_id, "ERROR", f"Artifact generation failed: {e}")
            yield {"event": "error", "data": json.dumps({"error": str(e)})}
        yield {"event": "done", "data": json.dumps({"complete": True})}

    return EventSourceResponse(event_stream())
