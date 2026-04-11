"""Quality Gate Agent — LLM-powered validation of analysis against source documents."""
from __future__ import annotations

import logging

from app.config import settings
from app.models.schemas import AnalysisResult, QualityReport, UploadedDocument
from app.services.llm_client import llm_call

logger = logging.getLogger("anatomy.quality_gate")

QUALITY_GATE_SYSTEM = """You are Anatomy's Quality Gate — an expert architecture reviewer. You are given:
1. An architecture analysis (components, flows, models, tech stack, NFRs, gaps)
2. Summaries of the source documents it was extracted from

Your job is to VALIDATE the analysis against the source material and score its quality.

Evaluate these dimensions:

**Completeness (0-100)**: Are all components, data flows, and integrations from the documents captured?
- Check: Every service/database/API mentioned in docs appears in components
- Check: Major data flows between systems are captured
- Check: Key data entities are modeled

**Consistency (0-100)**: Is the analysis internally consistent?
- Check: Data flow source/target reference real components
- Check: Tech stack matches component technologies
- Check: Layers properly categorize components

**Specificity (0-100)**: Are NFRs, descriptions, and gaps specific enough to act on?
- Check: NFRs have measurable target values (not "high performance" but "< 200ms p99")
- Check: Gaps have actionable suggestions
- Check: Component descriptions explain what they do, not just what they are

Return valid JSON:
{
  "completeness_score": 0-100,
  "consistency_score": 0-100,
  "specificity_score": 0-100,
  "overall_score": 0-100,
  "hallucination_flags": ["Component X mentioned in analysis but not found in any source document"],
  "missing_components": ["Service Y mentioned in doc Z but not in analysis"],
  "vague_nfrs": ["NFR 'high availability' lacks a specific uptime target"],
  "recommendations": ["Add data flow between Service A and Database B as described in doc.md"],
  "summary": "Brief assessment of analysis quality"
}

Be precise. Only flag genuine issues, not stylistic preferences. The overall_score should be the weighted average: completeness 40%, consistency 30%, specificity 30%."""


async def run_quality_gate(
    analysis: AnalysisResult,
    documents: list[UploadedDocument],
) -> QualityReport:
    """Validate an analysis against its source documents using LLM."""
    # Build document summaries (not full text — just enough for validation)
    doc_summaries = []
    for doc in documents:
        text_parts = []
        for chunk in doc.chunks:
            if not chunk.metadata.get("image_base64"):
                text_parts.append(chunk.content[:2000])
        combined = "\n".join(text_parts)[:4000]
        doc_summaries.append(f"=== {doc.filename} ===\n{combined}")

    docs_text = "\n\n".join(doc_summaries)

    # Exclude validation/quality from the JSON to avoid self-reference
    analysis_dict = analysis.model_dump(exclude={"validation", "quality"})

    user_prompt = (
        f"Validate this architecture analysis against the source documents.\n\n"
        f"=== ANALYSIS ===\n{__import__('json').dumps(analysis_dict, indent=1)}\n\n"
        f"=== SOURCE DOCUMENTS ===\n{docs_text}\n\n"
        f"Return ONLY valid JSON."
    )

    data = await llm_call(
        system=QUALITY_GATE_SYSTEM,
        user_prompt=user_prompt,
        model=settings.llm_model,
        max_tokens=16384,
        temperature=0.3,
        retries=2,
    )

    return QualityReport(**data)
