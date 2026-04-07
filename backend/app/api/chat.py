from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sse_starlette.sse import EventSourceResponse
from app.models.schemas import ChatRequest, ChatMessage
from app.db.engine import get_db, async_session_maker
from app.db import repository as repo
from app.services.chat import stream_chat
from app.services import log_stream
import json

router = APIRouter(prefix="/api", tags=["chat"])


@router.post("/chat")
async def chat(req: ChatRequest, db: AsyncSession = Depends(get_db)):
    project = await repo.get_project_state(db, req.project_id)
    if not project:
        raise HTTPException(404, "Project not found")

    # Save user message
    await repo.add_chat_message(db, req.project_id, "user", req.message)
    log_stream.push(req.project_id, "INFO", f"Chat: user message received ({len(req.message)} chars)")

    async def event_generator():
        full_response = []
        try:
            async for chunk in stream_chat(project, req.message):
                full_response.append(chunk)
                yield {"event": "message", "data": json.dumps({"text": chunk})}

            # Save assistant response in a new session (SSE outlives the route session)
            assistant_msg = "".join(full_response)
            async with async_session_maker() as session:
                await repo.add_chat_message(session, req.project_id, "assistant", assistant_msg)
            log_stream.push(req.project_id, "INFO", f"Chat: response complete ({len(assistant_msg)} chars)")
        except Exception as e:
            log_stream.push(req.project_id, "ERROR", f"Chat failed: {e}")
            yield {"event": "error", "data": json.dumps({"error": str(e)})}
        yield {"event": "done", "data": json.dumps({"complete": True})}

    return EventSourceResponse(event_generator())


@router.get("/projects/{project_id}/chat-history")
async def get_chat_history(project_id: str, db: AsyncSession = Depends(get_db)):
    project = await repo.get_project(db, project_id)
    if not project:
        raise HTTPException(404, "Project not found")
    messages = await repo.get_chat_history(db, project_id)
    return [msg.model_dump() for msg in messages]


@router.delete("/projects/{project_id}/chat-history")
async def clear_chat_history(project_id: str, db: AsyncSession = Depends(get_db)):
    project = await repo.get_project(db, project_id)
    if not project:
        raise HTTPException(404, "Project not found")
    await repo.clear_chat_history(db, project_id)
    return {"ok": True}
