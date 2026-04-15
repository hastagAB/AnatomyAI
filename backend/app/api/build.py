"""Build API — generate and download IDE-ready vibe-coding artifacts."""
from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel
from app.db.engine import get_db
from app.db import repository as repo
from app.services.build_generator import generate_build_artifacts, package_artifacts_zip
from app.services import log_stream

router = APIRouter(prefix="/api", tags=["build"])


class BuildGenerateBody(BaseModel):
    project_id: str


@router.post("/build/generate")
async def gen_artifacts(body: BuildGenerateBody, db: AsyncSession = Depends(get_db)):
    project = await repo.get_project(db, body.project_id)
    if not project:
        raise HTTPException(404, "Project not found")
    analysis = await repo.get_latest_analysis(db, body.project_id)
    if not analysis:
        raise HTTPException(400, "Analyze the project first")
    plan = await repo.get_plan(db, body.project_id)
    if not plan:
        raise HTTPException(400, "Generate a build plan first")

    log_stream.push(body.project_id, "INFO", "Build artifacts generation started")
    try:
        artifacts = await generate_build_artifacts(analysis, plan, project.name)
        log_stream.push(body.project_id, "INFO",
                        f"Build artifacts complete: {len(artifacts)} files generated")
        return {"artifacts": artifacts, "file_count": len(artifacts)}
    except Exception as e:
        log_stream.push(body.project_id, "ERROR", f"Build artifacts generation failed: {e}")
        raise


@router.post("/build/download")
async def download_artifacts(body: BuildGenerateBody, db: AsyncSession = Depends(get_db)):
    project = await repo.get_project(db, body.project_id)
    if not project:
        raise HTTPException(404, "Project not found")
    analysis = await repo.get_latest_analysis(db, body.project_id)
    if not analysis:
        raise HTTPException(400, "Analyze the project first")
    plan = await repo.get_plan(db, body.project_id)
    if not plan:
        raise HTTPException(400, "Generate a build plan first")

    log_stream.push(body.project_id, "INFO", "Build artifacts download started")
    try:
        artifacts = await generate_build_artifacts(analysis, plan, project.name)
        buf = package_artifacts_zip(artifacts, project.name)
        log_stream.push(body.project_id, "INFO",
                        f"Build artifacts packaged: {len(artifacts)} files in ZIP")
    except Exception as e:
        log_stream.push(body.project_id, "ERROR", f"Build artifacts download failed: {e}")
        raise

    safe_name = project.name.replace(" ", "-").replace("/", "_")[:50]
    filename = f"{safe_name}-build-artifacts.zip"

    return StreamingResponse(
        buf,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
