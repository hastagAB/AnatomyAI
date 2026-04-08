from __future__ import annotations
import json
import logging
from app.models.schemas import AnalysisResult, ProjectPlan
from app.services.llm_client import llm_call
from app.utils.prompts import PLAN_SYSTEM

logger = logging.getLogger("anatomy.planner")


def _condense_analysis(analysis: AnalysisResult) -> str:
    """Build a condensed analysis summary to keep the prompt under ~40K chars."""
    sections: list[str] = []

    sections.append(f"## Summary\n{analysis.summary[:500]}")

    # Components: name, type, tech, description (truncated)
    comps = []
    for c in analysis.components:
        desc = (c.description or "")[:80]
        comps.append(f"- **{c.name}** ({c.type}, {c.technology}): {desc}")
    sections.append(f"## Components ({len(analysis.components)})\n" + "\n".join(comps))

    # Tech stack: name, version, category
    techs = [f"- {t.technology} ({t.category}): {t.purpose}" for t in analysis.tech_stack]
    sections.append(f"## Tech Stack ({len(analysis.tech_stack)})\n" + "\n".join(techs))

    # Data flows: condensed
    flows = [f"- {f.source} → {f.target}: {f.description[:60]}" for f in analysis.data_flows[:30]]
    if len(analysis.data_flows) > 30:
        flows.append(f"  ...and {len(analysis.data_flows) - 30} more flows")
    sections.append(f"## Data Flows ({len(analysis.data_flows)})\n" + "\n".join(flows))

    # Gaps
    gaps = [f"- [{g.severity}] {g.area}: {g.description[:80]}" for g in analysis.gaps]
    sections.append(f"## Gaps ({len(analysis.gaps)})\n" + "\n".join(gaps))

    # NFRs: condensed
    nfrs = []
    for n in analysis.nonfunctional_requirements:
        nfrs.append(f"- [{n.category}] {n.description[:80]}")
    sections.append(f"## NFRs ({len(analysis.nonfunctional_requirements)})\n" + "\n".join(nfrs))

    # Quality scores if available
    if analysis.quality:
        q = analysis.quality
        sections.append(
            f"## Quality Scores\nCompleteness: {q.completeness_score}, "
            f"Consistency: {q.consistency_score}, Specificity: {q.specificity_score}, "
            f"Overall: {q.overall_score}"
        )

    return "\n\n".join(sections)


async def generate_plan(analysis: AnalysisResult) -> ProjectPlan:
    logger.info("Plan generation started (%d components, %d flows, %d gaps)",
                len(analysis.components), len(analysis.data_flows), len(analysis.gaps))

    condensed = _condense_analysis(analysis)
    logger.info("Plan: sending %d chars (condensed) to LLM", len(condensed))

    try:
        data = await llm_call(
            system=PLAN_SYSTEM,
            user_prompt=(
                f"Create a comprehensive build plan for this project.\n\n"
                f"Analysis:\n{condensed}\n\n"
                f"Return ONLY valid JSON."
            ),
            max_tokens=32768,
            temperature=0.4,
            token_tiers=[32768, 49152],
            allow_repair=True,
        )
        plan = ProjectPlan(**data)
        logger.info("Plan generation complete: %d phases, %d tasks, %d risks",
                    len(plan.phases), len(plan.tasks), len(plan.risks))
        return plan
    except Exception as e:
        logger.error("Plan generation failed: %s", e, exc_info=True)
        raise
