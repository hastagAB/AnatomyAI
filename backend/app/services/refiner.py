from __future__ import annotations
from typing import AsyncGenerator
from app.config import settings
from app.models.schemas import AnalysisResult
from app.services.llm_client import llm_call
from app.services.web_search import SearchResult
from app.utils.prompts import REFINE_SYSTEM
import logging

logger = logging.getLogger("anatomy.refiner")


def _build_refine_prompt(
    current_analysis: AnalysisResult,
    instructions: str,
    search_results: list[SearchResult] | None = None,
) -> str:
    parts = ["=== CURRENT ANALYSIS ==="]
    parts.append(current_analysis.model_dump_json(indent=1))

    if search_results:
        parts.append("\n=== WEB SEARCH RESULTS ===")
        for i, r in enumerate(search_results, 1):
            parts.append(f"\n[{i}] {r.title}\n    URL: {r.url}\n    {r.snippet}")

    parts.append(f"\n=== REFINEMENT INSTRUCTIONS ===\n{instructions}")
    parts.append("\nProduce the COMPLETE updated analysis JSON incorporating these changes. Return ONLY valid JSON.")
    return "\n".join(parts)


async def refine_analysis(
    current_analysis: AnalysisResult,
    instructions: str,
    search_results: list[SearchResult] | None = None,
) -> AnalysisResult:
    logger.info("Starting analysis refinement with %d search results", len(search_results or []))
    logger.info("Refinement instructions: %.120s...", instructions)
    prompt = _build_refine_prompt(current_analysis, instructions, search_results)
    logger.info("Calling LLM for refinement (prompt len=%d chars)", len(prompt))

    data = await llm_call(
        system=REFINE_SYSTEM,
        user_prompt=prompt,
        model=settings.llm_model_deep,
        token_tiers=[32768, 49152],
        allow_repair=True,
    )
    result = AnalysisResult(**data)
    logger.info("Refinement complete: %d components, %d flows, %d gaps",
                len(result.components), len(result.data_flows), len(result.gaps))
    return result


async def refine_project_analysis(
    project_id: str,
    current_analysis: AnalysisResult,
    instructions: str,
    search_results: list[SearchResult] | None = None,
) -> AsyncGenerator[dict, None]:
    from app.db.engine import async_session_maker
    from app.db import repository as repo

    logger.info("[project:%s] Starting evolve pipeline (instructions=%.80s...)", project_id, instructions)

    # Step 1: web search info
    if search_results:
        logger.info("[project:%s] Evolve has %d web search results as context", project_id, len(search_results))
        yield {
            "phase": "context",
            "status": "done",
            "search_results": len(search_results),
        }

    # Step 2: refine
    logger.info("[project:%s] Evolve: calling LLM for refinement", project_id)
    yield {"phase": "refine", "status": "processing"}

    try:
        result = await refine_analysis(
            current_analysis, instructions, search_results,
        )

        # Save as new analysis version and link refinement
        logger.info("[project:%s] Evolve: saving new analysis version", project_id)
        async with async_session_maker() as db:
            new_version = await repo.save_analysis(db, project_id, result, source="evolve")
            await repo.save_refinement(
                db, project_id, instructions,
                [{"title": r.title, "url": r.url, "snippet": r.snippet} for r in search_results] if search_results else [],
                produced_version=new_version,
            )

        logger.info("[project:%s] Evolve complete → version %d (%d components, %d flows, %d gaps)",
                    project_id, new_version, len(result.components), len(result.data_flows), len(result.gaps))
        yield {
            "phase": "complete",
            "status": "done",
            "analysis": result.model_dump(),
            "version": new_version,
            "summary": result.summary,
            "components": len(result.components),
            "data_flows": len(result.data_flows),
            "gaps": len(result.gaps),
        }
    except Exception as e:
        logger.error("[project:%s] Evolve failed: %s", project_id, e, exc_info=True)
        yield {"phase": "error", "status": "failed", "error": str(e)}
