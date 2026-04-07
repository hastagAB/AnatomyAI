from __future__ import annotations
import logging
from typing import AsyncGenerator
from anthropic import AsyncAnthropic
from app.config import settings
from app.models.schemas import ProjectState, ChatMessage
from app.utils.prompts import CHAT_SYSTEM

logger = logging.getLogger("anatomy.chat")


def _build_chat_context(project: ProjectState) -> str:
    parts = [f"Project: {project.name}\n"]

    # Document summaries
    parts.append("=== DOCUMENTS ===")
    for doc in project.documents:
        for chunk in doc.chunks:
            if not chunk.metadata.get("image_base64"):
                parts.append(f"--- {chunk.filename} ---\n{chunk.content[:5000]}")

    # Analysis if available
    if project.analysis:
        parts.append("\n=== ANALYSIS ===")
        parts.append(project.analysis.model_dump_json(indent=2))

    # Plan if available
    if project.plan:
        parts.append("\n=== PROJECT PLAN ===")
        parts.append(project.plan.model_dump_json(indent=2))

    return "\n".join(parts)


async def stream_chat(project: ProjectState, user_message: str) -> AsyncGenerator[str, None]:
    logger.info("Chat: processing message (%.80s...) for project %s", user_message, project.name)
    logger.info("Chat: building context (docs=%d, has_analysis=%s, has_plan=%s)",
                len(project.documents), project.analysis is not None, project.plan is not None)
    kwargs: dict = {
        "api_key": settings.llm_api_key,
        "timeout": 600.0,
        "max_retries": 3,
    }
    if settings.llm_base_url:
        kwargs["base_url"] = settings.llm_base_url
    client = AsyncAnthropic(**kwargs)

    context = _build_chat_context(project)
    logger.info("Chat: context built (%d chars), sending to LLM with %d history messages",
                len(context), len(project.chat_history[-20:]))

    # Build message history (last 20 messages for context window)
    system = f"{CHAT_SYSTEM}\n\nProject Context:\n{context}"
    messages: list[dict] = []

    history = project.chat_history[-20:]
    for msg in history:
        messages.append({"role": msg.role, "content": msg.content})

    messages.append({"role": "user", "content": user_message})

    token_count = 0
    try:
        async with client.messages.stream(
            model=settings.llm_model,
            max_tokens=16384,
            temperature=0.4,
            system=system,
            messages=messages,
        ) as stream:
            async for text in stream.text_stream:
                token_count += 1
                yield text
        logger.info("Chat: streaming complete (%d chunks yielded)", token_count)
    except Exception as e:
        logger.error("Chat: streaming failed: %s", e, exc_info=True)
        raise
