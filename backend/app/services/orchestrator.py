"""Orchestrator — agentic loop that runs the full Anatomy pipeline via tool-use."""
from __future__ import annotations

import logging
from typing import Any, AsyncGenerator

from app.services.llm_client import llm_tool_loop
from app.services.tools import (
    TOOL_DEFINITIONS,
    TOOL_EXECUTORS,
    OrchestratorContext,
)

logger = logging.getLogger("anatomy.orchestrator")

ORCHESTRATOR_SYSTEM = """You are Anatomy's orchestrator — an expert AI architect that autonomously produces build-ready architecture analyses from uploaded documents.

## Your Goal
Take the user's uploaded documents and produce a complete, validated, clarified architecture analysis with a build plan and IDE-ready artifacts. Maximize reuse of proven open-source libraries.

## Available Tools

1. **run_analysis** — Extract architecture from documents (MAP-REDUCE). Only call if no analysis exists yet.
2. **run_validation** — Check structural integrity + quality scores.
3. **converge_to_readiness** — Deterministic multi-round convergence loop (clarify → auto-resolve → apply → re-validate). Pass target_score (default 80) and max_rounds (default 3). One call does everything.
4. **optimize_oss_stack** — Discover and apply open-source library recommendations via web search. Auto-applies high-confidence suggestions (compatibility ≥ 75%). Can be called standalone or as part of the full pipeline.
5. **request_human_input** — Pause for human review. Phases: analysis_review, clarify_human, plan_review, quality_gate.
6. **generate_plan** — Create build plan from analysis.
7. **generate_build_artifacts** — Generate all 12 IDE-ready vibe-coding artifacts.

## Full Pipeline Order (when running end-to-end)
analyze → validate → review → converge → oss_optimize → plan → review → artifacts

## Rules
- If analysis already exists, SKIP run_analysis
- Call ONE tool at a time
- NEVER call converge_to_readiness more than once
- NEVER call optimize_oss_stack more than once
- If converge_to_readiness returns below target, accept and continue — do NOT retry
- Be concise in your reasoning — the human sees your thinking text
- If a tool returns an error, try to recover or explain what went wrong

## IMPORTANT: Follow the user's goal
- If the user asks to call a SPECIFIC tool (e.g., "call optimize_oss_stack"), call that tool IMMEDIATELY — do NOT run the full pipeline first
- Each tool works independently — you do NOT need to run earlier pipeline steps before calling a specific tool
- Only follow the full pipeline order when the goal is to run everything end-to-end"""


async def run_orchestrator(
    project_id: str,
    project_name: str,
    goal: str | None = None,
    context: OrchestratorContext | None = None,
) -> AsyncGenerator[dict[str, Any], None]:
    """Run the full orchestration pipeline, yielding events for SSE streaming.

    Args:
        project_id: The project to orchestrate.
        project_name: Human-readable project name.
        goal: Optional custom goal (uses default if not provided).
        context: Optional pre-built context (for injecting checkpoint_event from API layer).

    Yields:
        Event dicts: thinking, tool_start, tool_result, checkpoint, complete, error.
    """
    ctx = context or OrchestratorContext(
        project_id=project_id,
        project_name=project_name,
    )

    default_goal = (
        f"Analyze the uploaded documents for project '{project_name}' and produce a complete, "
        f"build-ready architecture. Follow the full pipeline: analyze → validate → clarify → "
        f"plan → generate build artifacts. Pause for human review at key checkpoints."
    )

    resolved_goal = goal or default_goal

    # Inject existing state so the LLM knows what's already done
    state_hints: list[str] = []
    if ctx.analysis:
        state_hints.append(
            f"An analysis already exists with {len(ctx.analysis.components)} components, "
            f"{len(ctx.analysis.data_flows)} data flows, {len(ctx.analysis.gaps)} gaps, "
            f"and {len(ctx.analysis.tech_stack)} tech stack entries. "
            f"Do NOT re-run run_analysis — use the existing analysis."
        )
    if ctx.plan:
        state_hints.append("A build plan already exists.")
    if state_hints:
        resolved_goal = resolved_goal + "\n\nCurrent state:\n" + "\n".join(state_hints)

    logger.info(f"[orchestrator] Starting for project {project_id}: {resolved_goal[:100]}")

    async for event in llm_tool_loop(
        system=ORCHESTRATOR_SYSTEM,
        goal=resolved_goal,
        tools=TOOL_DEFINITIONS,
        tool_executors=TOOL_EXECUTORS,
        context=ctx,
        max_tokens=16384,
        temperature=0.2,
        max_turns=25,
        tool_timeout=900.0,
    ):
        yield event

    logger.info(f"[orchestrator] Completed for project {project_id}")
