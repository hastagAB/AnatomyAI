"""Clarifier service — identifies gaps and generates clarifying questions."""
from __future__ import annotations
import json
import logging
from app.config import settings
from app.models.schemas import AnalysisResult
from app.services.llm_client import llm_call

logger = logging.getLogger("anatomy.clarifier")


def _condense_analysis(analysis: AnalysisResult, max_chars: int = 60_000) -> str:
    """Build a condensed JSON string of the analysis for clarification prompts.

    Keeps full structure but trims verbose fields to stay within token budgets.
    """
    data: dict = {
        "summary": analysis.summary,
        "components": [
            {"id": c.id, "name": c.name, "type": c.type, "technology": c.technology, "layer": c.layer}
            for c in analysis.components
        ],
        "data_flows": [
            {"id": f.id, "source": f.source, "target": f.target, "protocol": f.protocol, "description": f.description[:120]}
            for f in analysis.data_flows
        ],
        "data_models": [
            {"id": m.id, "entity": m.entity, "attributes": len(m.attributes), "relationships": len(m.relationships)}
            for m in analysis.data_models
        ],
        "layers": [{"id": l.id, "name": l.name, "components": l.components} for l in analysis.layers],
        "tech_stack": [
            {"id": t.id, "category": t.category, "technology": t.technology, "purpose": t.purpose}
            for t in analysis.tech_stack
        ],
        "nonfunctional_requirements": [
            {"id": n.id, "category": n.category, "description": n.description[:150], "priority": n.priority}
            for n in analysis.nonfunctional_requirements
        ],
        "gaps": [
            {"id": g.id, "area": g.area, "description": g.description, "severity": g.severity, "suggestion": g.suggestion}
            for g in analysis.gaps
        ],
    }

    # Add validation/quality summaries if available
    if analysis.validation:
        data["validation"] = {
            "score": analysis.validation.score,
            "errors": len(analysis.validation.errors),
            "warnings": len(analysis.validation.warnings),
        }
    if analysis.quality:
        q = analysis.quality
        data["quality"] = {
            "overall_score": q.overall_score,
            "completeness_score": q.completeness_score,
            "consistency_score": q.consistency_score,
            "specificity_score": q.specificity_score,
            "missing_components": q.missing_components[:5],
            "vague_nfrs": q.vague_nfrs[:5],
        }

    result = json.dumps(data, indent=1)
    if len(result) > max_chars:
        # Further truncate descriptions
        for comp in data.get("components", []):
            comp.pop("technology", None)
        for flow in data.get("data_flows", []):
            flow["description"] = flow["description"][:60]
        result = json.dumps(data, indent=1)

    return result

CLARIFY_SYSTEM = """You are Anatomy, an expert software architect. Given an architecture analysis, identify the TOP gaps and ambiguities that must be resolved before development.

Return valid JSON:
{
  "clarifications": [
    {
      "id": "c-1",
      "area": "authentication|data-model|api-design|integration|infrastructure|security|performance|deployment|other",
      "severity": "blocker|critical|important|nice-to-have",
      "title": "Short title",
      "question": "The question to answer",
      "default_answer": "Expert recommendation — specific tech, config, patterns, trade-offs",
      "impact": "Risk if not clarified (1 sentence)",
      "related_components": ["affected component names"],
      "auto_resolvable": true
    }
  ],
  "readiness_score": 0-100,
  "readiness_summary": "Brief development readiness assessment (1 sentence)",
  "blockers_count": 0,
  "critical_count": 0
}

Rules:
- Return ONLY genuinely new blockers and critical issues — NOT things that were already resolved
- If the user provides a list of "ALREADY RESOLVED" topics, do NOT re-raise them or variants of them
- Return at most 8 items — only blockers and critical severity
- Set auto_resolvable=true unless it genuinely requires a human BUSINESS decision (budget, vendor choice, org structure)
- Technical decisions (which framework, what config, how to scale) are ALWAYS auto_resolvable=true
- readiness_score should reflect: 100 minus severity-weighted count of REMAINING unresolved issues
  - No blockers/critical = 85+. Only important items = 75+. A few critical = 60-75. Blockers present = below 60.
- Be specific but concise: exact tech choices, numbers, config values
- Keep default_answer under 80 words, impact under 20 words
- Order by severity (blockers first)
- Return ONLY valid JSON"""


AUTO_RESOLVE_SYSTEM = """You are Anatomy, a principal software architect making definitive architectural decisions. You are given an architecture analysis and a list of unresolved clarification items. Your job is to provide DEFINITIVE, EXPERT-LEVEL answers for each item.

Rules:
- Provide SPECIFIC, ACTIONABLE answers — not suggestions, but decisions
- Include exact technology choices, configuration values, code patterns
- Reference the existing architecture to ensure consistency
- For each answer, explain the rationale briefly
- Make decisions that a senior engineering team would approve in a design review
- Be opinionated — pick the best option, don't hedge with "it depends"
- Consider the project's existing tech stack and patterns for consistency
- Keep each answer under 50 words — be terse and precise
- Keep each rationale under 30 words

**CRITICAL JSON RULES:**
- Do NOT use literal newlines inside string values — use a single space or semicolon to separate sentences
- Do NOT use double-quotes inside string values — use single quotes instead
- Ensure ALL strings are properly terminated

Return valid JSON — an array of resolved items:
[
  {
    "id": "c-1",
    "answer": "Use bcrypt with cost factor 12 for password hashing; store sessions in Redis with 24h TTL; implement JWT refresh tokens with 7-day expiry.",
    "rationale": "bcrypt cost 12 balances security vs latency; Redis sessions enable horizontal scaling."
  }
]

Return ONLY valid JSON array."""


async def generate_clarifications(
    analysis: AnalysisResult,
    resolved_titles: list[str] | None = None,
) -> dict:
    """Generate clarification items for an analysis.

    Args:
        analysis: The current analysis to evaluate.
        resolved_titles: List of previously resolved item titles/topics to exclude.
    """
    logger.info("Clarification generation started (%d components, %d gaps, %d NFRs)",
                len(analysis.components), len(analysis.gaps), len(analysis.nonfunctional_requirements))
    analysis_json = _condense_analysis(analysis)

    # Build the user prompt with resolved context
    parts = [
        "Analyze this architecture for the top gaps and ambiguities. "
        "Focus on blockers and critical issues ONLY. Max 8 items.",
    ]

    if resolved_titles:
        parts.append(
            f"\n\nALREADY RESOLVED ({len(resolved_titles)} items) — do NOT re-raise these or variants:\n"
            + "\n".join(f"- {t}" for t in resolved_titles[:30])
        )

    parts.append(f"\n\nAnalysis:\n{analysis_json}\n\nReturn ONLY valid JSON.")
    user_prompt = "\n".join(parts)
    logger.info("Clarify: sending %d chars to LLM", len(user_prompt))

    try:
        result = await llm_call(
            system=CLARIFY_SYSTEM,
            user_prompt=user_prompt,
            token_tiers=[16384, 32768],
            retries=2,
            retry_delay=5.0,
            allow_repair=True,
        )
        count = len(result.get("clarifications", []))
        score = result.get("readiness_score", "?")
        logger.info("Clarification complete: %d items, readiness_score=%s", count, score)
        return result
    except Exception as e:
        logger.error("Clarification generation failed: %s", e, exc_info=True)
        raise


async def auto_resolve_clarifications(
    analysis: AnalysisResult,
    clarifications: list[dict],
) -> list[dict]:
    """Use AI to generate expert-level answers for unresolved clarification items."""
    logger.info("Auto-resolving %d clarification items", len(clarifications))
    analysis_json = _condense_analysis(analysis)
    items_json = json.dumps(clarifications, indent=1)
    logger.info("Auto-resolve: sending %d chars to LLM", len(analysis_json) + len(items_json))

    try:
        data = await llm_call(
            system=AUTO_RESOLVE_SYSTEM,
            user_prompt=(
                f"Provide definitive expert answers for these unresolved architecture items.\n\n"
                f"Architecture Analysis:\n{analysis_json}\n\n"
                f"Items to resolve:\n{items_json}\n\n"
                f"Return ONLY valid JSON array."
            ),
            token_tiers=[16384, 32768],
            retries=2,
            retry_delay=5.0,
            allow_repair=True,
        )
        result = data if isinstance(data, list) else data.get("items", [])
        logger.info("Auto-resolve complete: %d items resolved", len(result))
        return result
    except Exception as e:
        logger.error("Auto-resolve failed: %s", e, exc_info=True)
        raise

RESOLVE_SYSTEM = """You are Anatomy, an expert software architect. You are given a CONDENSED architecture analysis along with resolved clarification questions and answers. Return ONLY the changes needed — do NOT return the full analysis.

Return valid JSON with these DELTA sections (include only sections that need changes):
{
  "add_components": [{"name": "", "type": "service|database|api|queue|cache|gateway|ui|external|actor", "description": "", "technology": "", "layer": ""}],
  "update_components": [{"name": "existing component name", "description": "new description", "technology": "new tech"}],
  "add_data_flows": [{"source": "", "target": "", "description": "", "protocol": "", "data_format": ""}],
  "add_nfrs": [{"category": "security|performance|scalability|reliability|other", "description": "", "priority": "high|medium|low"}],
  "update_nfrs": [{"description_match": "substring of existing NFR", "new_description": "updated text", "new_priority": "high|medium|low"}],
  "add_tech_stack": [{"category": "frontend|backend|database|infrastructure|devops|testing|other", "technology": "", "purpose": ""}],
  "resolve_gaps": ["gap-id-1", "gap-id-2"],
  "summary_update": "One sentence describing what changed"
}

Rules:
- Only include sections with actual changes. Omit empty arrays.
- Keep answers terse: no long descriptions.
- resolve_gaps: list IDs of gaps that the clarifications fully address.
- Do NOT add new gaps (add_gaps). Clarification resolution should REDUCE gaps, not create new ones.
- Do NOT reproduce unchanged data.

Return ONLY valid JSON."""


async def resolve_clarifications(
    analysis: AnalysisResult,
    resolutions: list[dict],
) -> AnalysisResult:
    """Apply resolved clarifications to produce an updated analysis."""
    logger.info("Applying %d resolved clarifications to analysis", len(resolutions))
    condensed = _condense_analysis(analysis)
    resolutions_text = "\n".join(
        f"Q: {r['question']}\nA: {r['answer']}"
        for r in resolutions
    )
    logger.info("Clarify resolve: sending %d chars to LLM (condensed)", len(condensed) + len(resolutions_text))

    try:
        delta = await llm_call(
            system=RESOLVE_SYSTEM,
            user_prompt=(
                f"Apply these resolved clarifications to the architecture.\n\n"
                f"Architecture (condensed):\n{condensed}\n\n"
                f"Resolved Clarifications:\n{resolutions_text}\n\n"
                f"Return ONLY the delta JSON with changes needed."
            ),
            token_tiers=[8192, 16384],
            retries=2,
            retry_delay=5.0,
            allow_repair=True,
        )

        # Merge delta into existing analysis
        result = _apply_delta(analysis, delta)
        logger.info("Clarify resolve complete: %d components, %d gaps (was %d)",
                    len(result.components), len(result.gaps), len(analysis.gaps))
        return result
    except Exception as e:
        logger.error("Clarify resolve failed: %s", e, exc_info=True)
        raise


def _apply_delta(analysis: AnalysisResult, delta: dict) -> AnalysisResult:
    """Merge a delta dict into an existing AnalysisResult."""
    data = analysis.model_dump()

    # Add new components
    for comp in delta.get("add_components", []):
        comp.setdefault("id", f"comp-{len(data['components']) + 1}")
        data["components"].append(comp)

    # Update existing components by name match
    for upd in delta.get("update_components", []):
        name = upd.get("name", "")
        for comp in data["components"]:
            if comp.get("name", "").lower() == name.lower():
                for key in ("description", "technology", "layer", "type"):
                    if key in upd and upd[key]:
                        comp[key] = upd[key]
                break

    # Add new data flows
    for flow in delta.get("add_data_flows", []):
        flow.setdefault("id", f"flow-{len(data['data_flows']) + 1}")
        data["data_flows"].append(flow)

    # Add new NFRs
    for nfr in delta.get("add_nfrs", []):
        nfr.setdefault("id", f"nfr-{len(data['nonfunctional_requirements']) + 1}")
        data["nonfunctional_requirements"].append(nfr)

    # Update existing NFRs
    for upd in delta.get("update_nfrs", []):
        match_text = upd.get("description_match", "").lower()
        for nfr in data["nonfunctional_requirements"]:
            if match_text and match_text in nfr.get("description", "").lower():
                if upd.get("new_description"):
                    nfr["description"] = upd["new_description"]
                if upd.get("new_priority"):
                    nfr["priority"] = upd["new_priority"]
                break

    # Add tech stack items
    for tech in delta.get("add_tech_stack", []):
        tech.setdefault("id", f"tech-{len(data['tech_stack']) + 1}")
        data["tech_stack"].append(tech)

    # Resolve gaps (remove by id)
    resolved_ids = set(delta.get("resolve_gaps", []))
    if resolved_ids:
        data["gaps"] = [g for g in data["gaps"] if g.get("id") not in resolved_ids]

    # Add new gaps — but cap net growth to prevent oscillation.
    # If we resolved N gaps, allow at most N/2 new ones (net reduction guaranteed).
    new_gaps = delta.get("add_gaps", [])
    max_new = max(len(resolved_ids) // 2, 1) if resolved_ids else 0
    for gap in new_gaps[:max_new]:
        gap.setdefault("id", f"gap-{len(data['gaps']) + 1}")
        data["gaps"].append(gap)
    if len(new_gaps) > max_new:
        logger.info(
            "Gap inflation suppressed: %d new gaps requested, %d allowed (resolved %d)",
            len(new_gaps), max_new, len(resolved_ids),
        )

    # Update summary
    if delta.get("summary_update"):
        data["summary"] = data.get("summary", "") + " " + delta["summary_update"]

    return AnalysisResult(**data)
