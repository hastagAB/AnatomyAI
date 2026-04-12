import traceback
import json
import logging
import asyncio
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sse_starlette.sse import EventSourceResponse
from app.db.engine import get_db
from app.db import repository as repo
from app.services.web_search import web_search, SearchResult
from app.services.refiner import refine_project_analysis
from app.services.integration_advisor import suggest_integrations
from app.services import log_stream

logger = logging.getLogger("anatomy.evolve")

router = APIRouter(prefix="/api", tags=["evolve"])


class WebSearchRequest(BaseModel):
    query: str
    max_results: int = 8


class RefineRequest(BaseModel):
    project_id: str
    instructions: str
    search_queries: list[str] = []


class IntegrationAdvisorRequest(BaseModel):
    project_id: str
    focus_area: str | None = None
    repo_urls: list[str] = []
    skip_search: bool = False


@router.post("/suggest-integrations")
async def suggest_integrations_endpoint(
    req: IntegrationAdvisorRequest, db: AsyncSession = Depends(get_db),
):
    project = await repo.get_project(db, req.project_id)
    if not project:
        raise HTTPException(404, "Project not found")

    analysis = await repo.get_latest_analysis(db, req.project_id)
    if not analysis:
        raise HTTPException(400, "No analysis found. Run analysis first.")

    log_stream.push(req.project_id, "INFO",
                    f"Integration advisor started (focus={req.focus_area or 'all'}, repos={len(req.repo_urls)})")

    async def event_generator():
        try:
            async for event in suggest_integrations(
                analysis, req.focus_area,
                skip_search=req.skip_search,
                repo_urls=req.repo_urls or None,
            ):
                yield {"event": "progress", "data": json.dumps(event)}
                if event.get("phase") == "complete" and "advice" in event:
                    count = len(event["advice"].get("suggestions", []))
                    log_stream.push(req.project_id, "INFO",
                                    f"Integration advisor complete: {count} suggestions")
                    yield {"event": "result", "data": json.dumps(event["advice"])}
                elif event.get("phase") == "error":
                    log_stream.push(req.project_id, "ERROR",
                                    f"Integration advisor failed: {event.get('error')}")
        except Exception as e:
            tb = traceback.format_exc()
            logger.error("Integration advisor error:\n%s", tb)
            log_stream.push(req.project_id, "ERROR", f"Integration advisor error: {e}")
            yield {"event": "error", "data": json.dumps({"error": str(e)})}
        yield {"event": "done", "data": json.dumps({"complete": True})}

    return EventSourceResponse(event_generator())


@router.post("/web-search")
async def search(req: WebSearchRequest):
    logger.info("Web search request: query=%r", req.query)
    try:
        results = await asyncio.to_thread(web_search, req.query, req.max_results)
        logger.info("Web search returned %d results", len(results))
        return [
            {"title": r.title, "url": r.url, "snippet": r.snippet}
            for r in results
        ]
    except Exception as e:
        logger.error("Web search failed: %s", e)
        raise HTTPException(500, f"Search failed: {e}")


@router.post("/refine")
async def refine(req: RefineRequest, db: AsyncSession = Depends(get_db)):
    project = await repo.get_project(db, req.project_id)
    if not project:
        raise HTTPException(404, "Project not found")

    analysis = await repo.get_latest_analysis(db, req.project_id)
    if not analysis:
        raise HTTPException(400, "No analysis to refine. Run analysis first.")

    # Gather web search results if queries provided
    all_search_results: list[SearchResult] = []
    if req.search_queries:
        log_stream.push(req.project_id, "INFO",
                        f"Evolve: running {len(req.search_queries)} web searches")
        for query in req.search_queries:
            try:
                results = await asyncio.to_thread(web_search, query, 5)
                all_search_results.extend(results)
            except Exception as e:
                logger.warning("Search query failed: %s - %s", query, e)
                log_stream.push(req.project_id, "WARNING", f"Search failed for: {query}")

    log_stream.push(req.project_id, "INFO",
                    f"Evolve: refining analysis (instructions={len(req.instructions)} chars)")

    async def event_generator():
        try:
            if all_search_results:
                log_stream.push(req.project_id, "INFO",
                                f"Evolve: {len(all_search_results)} search results gathered")
                yield {
                    "event": "progress",
                    "data": json.dumps({
                        "phase": "search",
                        "status": "done",
                        "results": len(all_search_results),
                    }),
                }

            async for event in refine_project_analysis(
                req.project_id, analysis, req.instructions, all_search_results or None,
            ):
                yield {"event": "progress", "data": json.dumps(event)}

                if event.get("phase") == "complete" and "analysis" in event:
                    log_stream.push(req.project_id, "INFO",
                                    f"Evolve complete → v{event.get('version')} ({event.get('components')} components)")
                    yield {
                        "event": "result",
                        "data": json.dumps(event["analysis"]),
                    }
                elif event.get("phase") == "error":
                    log_stream.push(req.project_id, "ERROR",
                                    f"Evolve refine error: {event.get('error')}")
        except Exception as e:
            tb = traceback.format_exc()
            logger.error("Refine error:\n%s", tb)
            log_stream.push(req.project_id, "ERROR", f"Evolve error: {e}")
            yield {"event": "error", "data": json.dumps({"error": str(e)})}
        yield {"event": "done", "data": json.dumps({"complete": True})}

    return EventSourceResponse(event_generator())


@router.get("/projects/{project_id}/refinements")
async def get_refinements(project_id: str, db: AsyncSession = Depends(get_db)):
    project = await repo.get_project(db, project_id)
    if not project:
        raise HTTPException(404, "Project not found")
    return await repo.get_refinements(db, project_id)


@router.get("/projects/{project_id}/analysis-versions")
async def get_analysis_versions(project_id: str, db: AsyncSession = Depends(get_db)):
    project = await repo.get_project(db, project_id)
    if not project:
        raise HTTPException(404, "Project not found")
    return await repo.get_analysis_versions(db, project_id)


@router.get("/projects/{project_id}/analysis/{version}")
async def get_analysis_by_version(
    project_id: str, version: int, db: AsyncSession = Depends(get_db),
):
    project = await repo.get_project(db, project_id)
    if not project:
        raise HTTPException(404, "Project not found")
    analysis = await repo.get_analysis_by_version(db, project_id, version)
    if not analysis:
        raise HTTPException(404, f"Analysis version {version} not found")
    return analysis.model_dump()


@router.get("/projects/{project_id}/analysis-diff")
async def get_analysis_diff(
    project_id: str,
    v1: int,
    v2: int,
    db: AsyncSession = Depends(get_db),
):
    """Compare two analysis versions, returning added/removed/changed counts."""
    project = await repo.get_project(db, project_id)
    if not project:
        raise HTTPException(404, "Project not found")

    a1 = await repo.get_analysis_by_version(db, project_id, v1)
    a2 = await repo.get_analysis_by_version(db, project_id, v2)
    if not a1 or not a2:
        raise HTTPException(404, "One or both versions not found")

    def diff_list(old: list[dict], new: list[dict], key: str) -> dict:
        old_names = {str(item.get(key, item.get("entity", ""))) for item in old}
        new_names = {str(item.get(key, item.get("entity", ""))) for item in new}
        added = new_names - old_names
        removed = old_names - new_names
        kept = old_names & new_names
        return {
            "added": sorted(added),
            "removed": sorted(removed),
            "unchanged": len(kept),
            "total_before": len(old),
            "total_after": len(new),
        }

    return {
        "v1": v1,
        "v2": v2,
        "components": diff_list(a1.components, a2.components, "name"),
        "data_flows": diff_list(a1.data_flows, a2.data_flows, "source"),
        "data_models": diff_list(a1.data_models, a2.data_models, "entity"),
        "tech_stack": diff_list(a1.tech_stack, a2.tech_stack, "technology"),
        "gaps": diff_list(a1.gaps, a2.gaps, "area"),
        "nfrs": diff_list(a1.nonfunctional_requirements, a2.nonfunctional_requirements, "description"),
        "summary_before": a1.summary,
        "summary_after": a2.summary,
    }
