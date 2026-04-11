from __future__ import annotations
import logging
from dataclasses import dataclass
from duckduckgo_search import DDGS

logger = logging.getLogger("anatomy.web_search")


@dataclass
class SearchResult:
    title: str
    url: str
    snippet: str


def web_search(query: str, max_results: int = 8) -> list[SearchResult]:
    logger.info("Web search: query=%r max_results=%d", query, max_results)
    try:
        ddgs = DDGS()
        raw = list(ddgs.text(query, max_results=max_results))
        logger.info("Web search returned %d results for %r", len(raw), query)
    except Exception as e:
        logger.warning("Web search failed for %r: %s", query, e)
        raw = []

    if not raw:
        logger.info("No results, retrying with site-scoped query for %r", query)
        try:
            ddgs = DDGS()
            raw = list(ddgs.text(f"{query} site:github.com OR site:reddit.com", max_results=max_results))
            logger.info("Retry returned %d results for %r", len(raw), query)
        except Exception as e:
            logger.warning("Retry search also failed for %r: %s", query, e)
            raw = []

    results = [
        SearchResult(
            title=r.get("title", ""),
            url=r.get("href", ""),
            snippet=r.get("body", ""),
        )
        for r in raw
    ]
    logger.info("Web search complete: %d results for %r", len(results), query)
    return results
