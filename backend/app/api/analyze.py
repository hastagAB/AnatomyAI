import asyncio
import traceback
import json
from fastapi import APIRouter, HTTPException, Query, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sse_starlette.sse import EventSourceResponse
from app.models.schemas import AnalyzeRequest
from app.db.engine import get_db
from app.db import repository as repo
from app.services.analyzer import analyze_project_chunked, _group_documents
from app.services import log_stream

router = APIRouter(prefix="/api", tags=["analyze"])


@router.post("/analyze")
async def analyze(req: AnalyzeRequest, fresh: bool = Query(False), db: AsyncSession = Depends(get_db)):
    project = await repo.get_project(db, req.project_id)
    if not project:
        raise HTTPException(404, "Project not found")

    documents = await repo.get_documents(db, req.project_id)
    if not documents:
        raise HTTPException(400, "No documents uploaded")

    if fresh:
        await repo.clear_extractions(db, req.project_id)
        await repo.clear_analysis(db, req.project_id)
        existing_extractions = []
    else:
        existing_extractions = await repo.get_extractions(db, req.project_id)

    async def event_generator():
        try:
            async for event in analyze_project_chunked(
                req.project_id, documents, existing_extractions
            ):
                yield {"event": "progress", "data": json.dumps(event)}

                if event.get("phase") == "complete" and "analysis" in event:
                    yield {
                        "event": "result",
                        "data": json.dumps(event["analysis"]),
                    }
        except Exception as e:
            tb = traceback.format_exc()
            print(f"Analysis error:\n{tb}")
            yield {
                "event": "error",
                "data": json.dumps({"error": str(e)}),
            }
        yield {"event": "done", "data": json.dumps({"complete": True})}

    return EventSourceResponse(event_generator())


@router.get("/projects/{project_id}/analysis")
async def get_analysis(project_id: str, db: AsyncSession = Depends(get_db)):
    project = await repo.get_project(db, project_id)
    if not project:
        raise HTTPException(404, "Project not found")
    analysis = await repo.get_latest_analysis(db, project_id)
    if not analysis:
        raise HTTPException(404, "No analysis available. Run analysis first.")
    return analysis.model_dump()


@router.get("/projects/{project_id}/analysis-progress")
async def get_analysis_progress(project_id: str, db: AsyncSession = Depends(get_db)):
    project = await repo.get_project(db, project_id)
    if not project:
        raise HTTPException(404, "Project not found")

    documents = await repo.get_documents(db, project_id)
    batches = _group_documents(documents) if documents else []
    extractions = await repo.get_extractions(db, project_id)
    analysis = await repo.get_latest_analysis(db, project_id)

    return {
        "extracted": len(extractions),
        "total_batches": len(batches),
        "has_analysis": analysis is not None,
        "analysis": analysis.model_dump() if analysis else None,
    }


@router.get("/projects/{project_id}/logs")
async def stream_logs(project_id: str):
    """SSE endpoint that streams real-time log entries from ALL anatomy.* loggers."""
    q = log_stream.subscribe(project_id)
    # Attach handler to root anatomy logger for this project
    handler = log_stream.attach(project_id)

    async def event_generator():
        try:
            while True:
                try:
                    entry = await asyncio.wait_for(q.get(), timeout=30)
                    yield {"event": "log", "data": json.dumps(entry)}
                except asyncio.TimeoutError:
                    # keepalive so the browser doesn't close the connection
                    yield {"event": "ping", "data": "{}"}
        except asyncio.CancelledError:
            pass
        finally:
            log_stream.detach(handler)
            log_stream.unsubscribe(project_id, q)

    return EventSourceResponse(event_generator())
