from __future__ import annotations
import logging
from app.models.schemas import (
    DiagramType, DiagramData, DiagramNode, DiagramEdge, AnalysisResult,
)
from app.services.llm_client import llm_call
from app.utils.prompts import DIAGRAM_SYSTEM

logger = logging.getLogger("anatomy.diagrams")


DIAGRAM_TYPE_LABELS = {
    DiagramType.SYSTEM_CONTEXT: "System Context (C4 Level 1)",
    DiagramType.CONTAINER: "Container Diagram (C4 Level 2)",
    DiagramType.COMPONENT: "Component Diagram (C4 Level 3)",
    DiagramType.HLD: "High-Level Design",
    DiagramType.LLD: "Low-Level Design",
    DiagramType.DATA_FLOW: "Data Flow Diagram",
    DiagramType.ER_DIAGRAM: "Entity-Relationship Diagram",
    DiagramType.SEQUENCE: "Sequence Diagram",
    DiagramType.DEPLOYMENT: "Deployment Diagram",
    DiagramType.TECH_STACK: "Technology Stack",
    DiagramType.RUNTIME_FLOW: "Runtime Flow Architecture",
}


async def generate_diagram(analysis: AnalysisResult, diagram_type: DiagramType) -> DiagramData:
    logger.info("Diagram generation started: type=%s (%d components)",
                diagram_type.value, len(analysis.components))
    analysis_json = analysis.model_dump_json()
    label = DIAGRAM_TYPE_LABELS.get(diagram_type, diagram_type.value)
    logger.info("Diagram: sending %d chars to LLM for %s", len(analysis_json), label)

    try:
        data = await llm_call(
            system=DIAGRAM_SYSTEM,
            user_prompt=f"Generate a **{label}** diagram based on this project analysis:\n\n{analysis_json}\n\nReturn ONLY valid JSON.",
            max_tokens=16384,
            temperature=0.4,
        )

        nodes = [DiagramNode(**n) for n in data.get("nodes", [])]
        edges = [DiagramEdge(**e) for e in data.get("edges", [])]
        logger.info("Diagram generation complete: %s → %d nodes, %d edges",
                    diagram_type.value, len(nodes), len(edges))

        return DiagramData(
            diagram_type=diagram_type,
            title=data.get("title", label),
            description=data.get("description", ""),
            nodes=nodes,
            edges=edges,
        )
    except Exception as e:
        logger.error("Diagram generation failed for %s: %s", diagram_type.value, e, exc_info=True)
        raise
