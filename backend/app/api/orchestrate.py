"""Orchestrator API — SSE streaming endpoint for agentic pipeline execution."""
from __future__ import annotations

import asyncio
import json
import logging
from dataclasses import dataclass, field
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from sse_starlette.sse import EventSourceResponse

from app.services.orchestrator import run_orchestrator
from app.services.tools import OrchestratorContext

logger = logging.getLogger("anatomy.api.orchestrate")
router = APIRouter(prefix="/api/orchestrate", tags=["orchestrate"])


# ── In-memory session store ─────────────────────────────────────

@dataclass
class OrchestratorSession:
    project_id: str
    task: asyncio.Task | None = None
    events: list[dict] = field(default_factory=list)
    checkpoint_event: asyncio.Event = field(default_factory=asyncio.Event)
    checkpoint_response: str = ""
    context: Any = None  # OrchestratorContext ref for pause/resume


_sessions: dict[str, OrchestratorSession] = {}


# ── Request models ──────────────────────────────────────────────

class StartRequest(BaseModel):
    project_id: str
    goal: str | None = None


class ResumeRequest(BaseModel):
    action: str  # "continue", "revise", "skip"
    data: dict[str, Any] | None = None


# ── SSE endpoint ────────────────────────────────────────────────

@router.post("")
async def start_orchestration(req: StartRequest):
    """Start orchestration for a project. Returns SSE stream of events."""
    from app.db.engine import async_session_maker
    from app.db import repository as repo

    # Check project exists
    async with async_session_maker() as db:
        project = await repo.get_project(db, req.project_id)
    if not project:
        raise HTTPException(404, "Project not found")

    # Cancel any existing session for this project
    existing = _sessions.get(req.project_id)
    if existing and existing.task and not existing.task.done():
        existing.task.cancel()

    session = OrchestratorSession(project_id=req.project_id)
    _sessions[req.project_id] = session

    # Build shared context — the session's checkpoint_event is used by llm_tool_loop
    ctx = OrchestratorContext(
        project_id=req.project_id,
        project_name=project.name,
        checkpoint_event=session.checkpoint_event,
    )
    session.context = ctx

    # Pre-load existing analysis so orchestrator knows to skip run_analysis
    async with async_session_maker() as db:
        existing_analysis = await repo.get_latest_analysis(db, req.project_id)
        if existing_analysis:
            ctx.analysis = existing_analysis

    async def event_stream():
        event_queue: asyncio.Queue[dict | None] = asyncio.Queue()

        async def _run():
            try:
                async for event in run_orchestrator(
                    project_id=req.project_id,
                    project_name=project.name,
                    goal=req.goal,
                    context=ctx,
                ):
                    # Always record to session.events so polling works
                    # even if the SSE stream dies during a checkpoint wait
                    session.events.append(event)
                    await event_queue.put(event)

            except asyncio.CancelledError:
                ev = {"type": "cancelled"}
                session.events.append(ev)
                await event_queue.put(ev)
            except Exception as e:
                logger.error(f"[orchestrate] Error: {e}", exc_info=True)
                ev = {"type": "error", "message": str(e)}
                session.events.append(ev)
                await event_queue.put(ev)
            finally:
                await event_queue.put(None)  # sentinel

        session.task = asyncio.create_task(_run())

        try:
            while True:
                event = await event_queue.get()
                if event is None:
                    break
                # Events already in session.events (appended by _run)
                yield {"event": "message", "data": json.dumps(event)}
        except (asyncio.CancelledError, GeneratorExit):
            # SSE connection died (client disconnect / timeout).
            # _run() task stays alive and keeps recording to session.events
            # so the frontend polling fallback can pick up remaining events.
            logger.info(
                f"[orchestrate] SSE stream closed for {req.project_id}, "
                "background task continues"
            )
            return

        # Natural completion — clean up session
        if req.project_id in _sessions:
            del _sessions[req.project_id]

    return EventSourceResponse(event_stream(), ping=15)


@router.post("/{project_id}/resume")
async def resume_orchestration(project_id: str, req: ResumeRequest):
    """Resume orchestration after a checkpoint."""
    session = _sessions.get(project_id)
    if not session:
        raise HTTPException(404, "No active orchestration for this project")

    # Store the response and wake up the orchestrator
    response_data = json.dumps({
        "action": req.action,
        "data": req.data or {},
    })
    session.checkpoint_response = response_data
    # Bridge response to the shared OrchestratorContext so llm_tool_loop reads it
    if session.context is not None:
        session.context.checkpoint_response = response_data
    session.checkpoint_event.set()

    # Push a checkpoint_resumed event so SSE stream forwards it to the frontend
    resumed_event = {
        "type": "checkpoint_resumed",
        "action": req.action,
        "message": f"Resumed with action: {req.action}",
    }
    session.events.append(resumed_event)

    return {"status": "resumed", "action": req.action}


@router.get("/{project_id}/status")
async def get_orchestration_status(project_id: str):
    """Get current orchestration status and events."""
    session = _sessions.get(project_id)
    if not session:
        return {"active": False, "events": []}

    return {
        "active": session.task is not None and not session.task.done(),
        "events": session.events,
        "event_count": len(session.events),
    }


@router.post("/{project_id}/cancel")
async def cancel_orchestration(project_id: str):
    """Cancel an active orchestration."""
    session = _sessions.get(project_id)
    if not session or not session.task:
        raise HTTPException(404, "No active orchestration")

    session.task.cancel()
    if project_id in _sessions:
        del _sessions[project_id]

    return {"status": "cancelled"}
