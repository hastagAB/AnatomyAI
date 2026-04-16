"""Integration Advisor — suggests open-source projects compatible with the current architecture."""
from __future__ import annotations

import asyncio
import logging
import re
from typing import AsyncGenerator

import httpx
from pydantic import BaseModel, Field, field_validator

from app.config import settings
from app.models.schemas import AnalysisResult
from app.services.llm_client import llm_call
from app.services.web_search import SearchResult, web_search
from app.utils.prompts import INTEGRATION_ADVISOR_SYSTEM

logger = logging.getLogger("anatomy.integration_advisor")


class IntegrationSuggestion(BaseModel):
    id: str = ""
    library_name: str
    library_url: str = ""
    description: str = ""
    license: str = ""
    category: str = "enhancement"
    target_components: list[str] = Field(default_factory=list)
    replaces_custom: str | None = ""
    compatibility_score: float = 0.5
    integration_effort: str = "medium"
    maturity: str = "mature"
    community_size: str = "medium"
    rationale: str = ""
    tech_alignment: list[str] = Field(default_factory=list)
    integration_steps: list[str] = Field(default_factory=list)
    risks: list[str] = Field(default_factory=list)
    estimated_savings: str = ""

    @field_validator("replaces_custom", mode="before")
    @classmethod
    def coerce_none_to_empty(cls, v: str | None) -> str:
        return v or ""


class IntegrationAdvice(BaseModel):
    suggestions: list[IntegrationSuggestion] = Field(default_factory=list)
    summary: str = ""
    build_vs_buy_ratio: str = ""


def _build_advisor_prompt(
    analysis: AnalysisResult,
    search_results: list[SearchResult] | None = None,
    focus_area: str | None = None,
    repo_context: str | None = None,
) -> str:
    parts = ["=== PROJECT ARCHITECTURE ==="]
    parts.append(analysis.model_dump_json(indent=1))

    if repo_context:
        parts.append("\n=== GITHUB REPOSITORY CONTEXT (USER-PROVIDED — MUST EVALUATE EACH) ===")
        parts.append(repo_context)
        parts.append(
            "\nIMPORTANT: The user specifically provided the repositories above. "
            "You MUST include each one as a suggestion in your output. "
            "Analyze how each repository fits the architecture, which components it targets, "
            "and what integration steps are needed. These should appear FIRST in the suggestions list."
        )

    if search_results:
        parts.append("\n=== WEB SEARCH RESULTS (current open-source landscape) ===")
        for i, r in enumerate(search_results, 1):
            parts.append(f"\n[{i}] {r.title}\n    URL: {r.url}\n    {r.snippet}")

    if focus_area:
        parts.append(f"\n=== FOCUS AREA ===\n{focus_area}")
        parts.append("Prioritize suggestions related to this area, but also include other high-impact opportunities.")
    else:
        parts.append("\nAnalyze the ENTIRE architecture and suggest all viable open-source integration opportunities.")

    parts.append("\nReturn the suggestions JSON as specified.")
    return "\n".join(parts)


def _clean_tech_names(analysis: AnalysisResult, limit: int = 3) -> str:
    """Extract short, version-free tech keywords for search queries."""
    raw = [t.technology for t in analysis.tech_stack]
    cleaned: list[str] = []
    for t in raw:
        # Split compound entries like "React 18 + TypeScript 5" or "Node.js 20 / Express 4.x"
        for part in re.split(r"[/+,]", t):
            # Strip version-like suffixes: "React 18" -> "React", "Java 21" -> "Java"
            name = re.sub(r"\s+[\d.x]+.*$", "", part.strip())
            if name and name not in cleaned and len(name) > 1:
                cleaned.append(name)
        if len(cleaned) >= limit:
            break
    return " ".join(cleaned[:limit])


def _build_search_queries(
    analysis: AnalysisResult,
    focus_area: str | None,
    repo_urls: list[str] | None = None,
) -> list[str]:
    """Generate targeted, concise search queries based on the architecture."""
    queries: list[str] = []
    tech_short = _clean_tech_names(analysis, limit=3)

    # Repo-specific queries when the user provided GitHub links
    if repo_urls:
        for url in repo_urls[:2]:
            m = _GITHUB_REPO_PATTERN.match(url.strip().rstrip("/"))
            if m:
                repo_name = m.group(2).removesuffix(".git")
                queries.append(f"{repo_name} integration tutorial getting started")
                queries.append(f"{repo_name} vs alternatives comparison")

    # Search for alternatives to specific custom components (short names only)
    custom_components = [
        c for c in analysis.components
        if c.type in ("service", "function", "other") and "custom" not in c.technology.lower()
    ]
    if custom_components:
        for comp in custom_components[:2]:
            queries.append(f"open source {comp.name} library {tech_short}")

    # Search for gap-filling projects
    if analysis.gaps:
        for gap in analysis.gaps[:2]:
            queries.append(f"open source {gap.area} library {tech_short}")

    # Focus area search
    if focus_area:
        queries.append(f"best open source {focus_area} library {tech_short}")

    # General landscape (only if no other queries)
    if not queries:
        queries.append(f"best open source libraries {tech_short} production ready")

    return queries[:5]


_GITHUB_REPO_PATTERN = re.compile(
    r"(?:https?://)?(?:www\.)?github\.com/([^/]+)/([^/\s?#]+)"
)


async def fetch_github_repo_context(repo_url: str) -> str | None:
    """Fetch README + basic metadata from a GitHub repo URL.

    Returns a formatted context string or None on failure.
    """
    m = _GITHUB_REPO_PATTERN.match(repo_url.strip().rstrip("/"))
    if not m:
        logger.warning("Invalid GitHub URL: %s", repo_url)
        return None

    owner, repo = m.group(1), m.group(2).removesuffix(".git")
    api_base = f"https://api.github.com/repos/{owner}/{repo}"
    logger.info("Fetching GitHub repo context: %s/%s", owner, repo)

    parts: list[str] = [f"GitHub Repository: {owner}/{repo}"]

    async with httpx.AsyncClient(timeout=15.0) as client:
        # Repo metadata
        try:
            resp = await client.get(api_base, headers={"Accept": "application/vnd.github.v3+json"})
            if resp.status_code == 200:
                meta = resp.json()
                parts.append(f"Description: {meta.get('description', 'N/A')}")
                parts.append(f"Language: {meta.get('language', 'N/A')}")
                parts.append(f"Stars: {meta.get('stargazers_count', '?')}")
                parts.append(f"License: {(meta.get('license') or {}).get('spdx_id', 'N/A')}")
                parts.append(f"Last pushed: {meta.get('pushed_at', 'N/A')}")
                topics = meta.get("topics", [])
                if topics:
                    parts.append(f"Topics: {', '.join(topics)}")
            else:
                logger.warning("GitHub API returned %d for %s/%s", resp.status_code, owner, repo)
        except Exception as e:
            logger.warning("GitHub metadata fetch failed: %s", e)

        # README
        try:
            resp = await client.get(
                f"{api_base}/readme",
                headers={"Accept": "application/vnd.github.v3.raw"},
            )
            if resp.status_code == 200:
                readme_text = resp.text[:12000]  # Cap at 12K chars
                parts.append(f"\n--- README ---\n{readme_text}")
                logger.info("Fetched README for %s/%s (%d chars)", owner, repo, len(readme_text))
            else:
                logger.warning("README fetch returned %d for %s/%s", resp.status_code, owner, repo)
        except Exception as e:
            logger.warning("README fetch failed: %s", e)

    if len(parts) <= 1:
        return None

    return "\n".join(parts)


async def suggest_integrations(
    analysis: AnalysisResult,
    focus_area: str | None = None,
    skip_search: bool = False,
    repo_urls: list[str] | None = None,
) -> AsyncGenerator[dict, None]:
    """Analyze architecture and suggest open-source integrations. Yields progress events."""
    logger.info("Integration advisor started (focus=%r, components=%d, tech=%d, repos=%d)",
                focus_area, len(analysis.components), len(analysis.tech_stack), len(repo_urls or []))

    # Phase 0: Fetch GitHub repo contexts
    repo_context: str | None = None
    if repo_urls:
        yield {"phase": "fetching_repos", "status": "processing", "count": len(repo_urls)}
        context_parts: list[str] = []
        for url in repo_urls:
            ctx = await fetch_github_repo_context(url)
            if ctx:
                context_parts.append(ctx)
        if context_parts:
            repo_context = "\n\n".join(context_parts)
            logger.info("Fetched context for %d/%d repos (%d chars)",
                        len(context_parts), len(repo_urls), len(repo_context))
        yield {"phase": "fetching_repos", "status": "done", "fetched": len(context_parts)}

    # Phase 1: Web search for current open-source landscape
    search_results: list[SearchResult] = []
    if not skip_search:
        queries = _build_search_queries(analysis, focus_area, repo_urls)
        logger.info("Integration advisor: running %d web searches in parallel", len(queries))
        yield {"phase": "searching", "status": "processing", "queries": len(queries)}

        async def _run_search(query: str) -> list[SearchResult]:
            try:
                return await asyncio.to_thread(web_search, query, 5)
            except Exception as e:
                logger.warning("Integration search failed for %r: %s", query, e)
                return []

        batch_results = await asyncio.gather(*[_run_search(q) for q in queries])
        for i, results in enumerate(batch_results):
            search_results.extend(results)
            logger.info("Integration search %d/%d: %d results for %r",
                        i + 1, len(queries), len(results), queries[i])

        yield {"phase": "searching", "status": "done", "total_results": len(search_results)}
        logger.info("Integration advisor: web search phase done, %d total results", len(search_results))

    # Phase 2: LLM analysis
    logger.info("Integration advisor: calling LLM for compatibility analysis")
    yield {"phase": "analyzing", "status": "processing"}

    prompt = _build_advisor_prompt(analysis, search_results or None, focus_area, repo_context)
    logger.info("Integration advisor: prompt length=%d chars", len(prompt))

    try:
        data = await llm_call(
            system=INTEGRATION_ADVISOR_SYSTEM,
            user_prompt=prompt,
            model=settings.llm_model_deep,
            max_tokens=16384,
            allow_repair=True,
        )

        advice = IntegrationAdvice(**data)
        logger.info("Integration advisor complete: %d suggestions, ratio=%s",
                    len(advice.suggestions), advice.build_vs_buy_ratio)

        yield {
            "phase": "complete",
            "status": "done",
            "advice": advice.model_dump(),
        }
    except Exception as e:
        logger.error("Integration advisor failed: %s", e, exc_info=True)
        yield {"phase": "error", "status": "failed", "error": str(e)}
