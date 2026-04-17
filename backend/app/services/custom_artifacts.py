"""Custom artifact generation service — free-form AI analysis over project data."""
from __future__ import annotations

import logging
from typing import AsyncGenerator

from app.models.schemas import AnalysisResult
from app.services.llm_client import get_llm_client
from app.config import settings

logger = logging.getLogger("anatomy.artifacts")

ARTIFACT_SYSTEM = """You are Anatomy, an expert AI software architect. You have been given a complete architecture analysis for a project. The user will ask you a specific analytical question or request a custom report.

Your job:
- Provide a thorough, well-structured analysis based on the project data
- Use markdown formatting with clear headings, bullet points, and tables where appropriate
- Be specific — reference actual components, technologies, and data flows from the analysis
- Give actionable recommendations with clear pros/cons
- If comparing options, use a decision matrix or comparison table
- Keep the analysis focused and practical, not generic

Always base your response on the actual project data provided. Do not make up technologies or components that aren't in the analysis."""


def _condense_for_artifact(analysis: AnalysisResult) -> str:
    """Build a condensed analysis context for the artifact prompt."""
    sections: list[str] = []

    sections.append(f"## Project Summary\n{analysis.summary[:800]}")

    comps = []
    for c in analysis.components:
        desc = (c.description or "")[:100]
        comps.append(f"- **{c.name}** ({c.type}, {c.technology}): {desc}")
    sections.append(f"## Components ({len(analysis.components)})\n" + "\n".join(comps))

    techs = [f"- {t.technology} ({t.category}): {t.purpose}" for t in analysis.tech_stack]
    sections.append(f"## Tech Stack ({len(analysis.tech_stack)})\n" + "\n".join(techs))

    flows = [f"- {f.source} → {f.target}: {f.description[:80]}" for f in analysis.data_flows[:40]]
    if len(analysis.data_flows) > 40:
        flows.append(f"  ...and {len(analysis.data_flows) - 40} more flows")
    sections.append(f"## Data Flows ({len(analysis.data_flows)})\n" + "\n".join(flows))

    gaps = [f"- [{g.severity}] {g.area}: {g.description[:100]}" for g in analysis.gaps]
    sections.append(f"## Gaps ({len(analysis.gaps)})\n" + "\n".join(gaps))

    nfrs = [f"- [{n.category}] {n.description[:100]}" for n in analysis.nonfunctional_requirements]
    sections.append(f"## NFRs ({len(analysis.nonfunctional_requirements)})\n" + "\n".join(nfrs))

    if analysis.quality:
        q = analysis.quality
        sections.append(
            f"## Quality Scores\nCompleteness: {q.completeness_score}, "
            f"Consistency: {q.consistency_score}, Specificity: {q.specificity_score}, "
            f"Overall: {q.overall_score}"
        )

    return "\n\n".join(sections)


async def generate_custom_artifact(
    *,
    analysis: AnalysisResult,
    prompt: str,
    title: str = "",
) -> AsyncGenerator[dict, None]:
    """Stream a custom analysis artifact as markdown chunks."""
    logger.info("Custom artifact: prompt=%s...", prompt[:80])

    condensed = _condense_for_artifact(analysis)
    logger.info("Custom artifact: %d chars context, streaming response", len(condensed))

    yield {"type": "progress", "message": "Analyzing project data..."}

    client = get_llm_client()
    model = settings.llm_model

    user_msg = (
        f"Based on the following project architecture analysis, please respond to this request:\n\n"
        f"**Request:** {prompt}\n\n"
        f"---\n\n"
        f"# Project Architecture Analysis\n\n{condensed}"
    )

    try:
        collected = ""
        async with client.messages.stream(
            model=model,
            max_tokens=16384,
            temperature=0.3,
            system=ARTIFACT_SYSTEM,
            messages=[{"role": "user", "content": user_msg}],
        ) as stream:
            async for text in stream.text_stream:
                collected += text
                yield {"type": "chunk", "content": text}

        yield {
            "type": "complete",
            "content": collected,
            "title": title or prompt[:60],
        }
        logger.info("Custom artifact complete: %d chars", len(collected))

    except Exception as e:
        logger.error("Custom artifact streaming failed: %s", e, exc_info=True)
        yield {"type": "error", "message": str(e)}
