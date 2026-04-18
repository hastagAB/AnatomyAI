"""Tool definitions and executors for the orchestrator agent loop."""
from __future__ import annotations

import json
import logging
from dataclasses import dataclass, field
from typing import Any

import asyncio

from app.models.schemas import AnalysisResult, ProjectPlan, UploadedDocument

logger = logging.getLogger("anatomy.tools")


# ── Context object passed to all executors ───────────────────────


@dataclass
class OrchestratorContext:
    """Mutable state bag shared across tool executions within one orchestration run."""
    project_id: str
    project_name: str
    documents: list[UploadedDocument] = field(default_factory=list)
    analysis: AnalysisResult | None = None
    plan: ProjectPlan | None = None
    clarifications: list[dict] | None = None
    # Checkpoint pause/resume
    checkpoint_event: asyncio.Event = field(default_factory=asyncio.Event)
    checkpoint_response: str = ""


# ── Tool definitions (Anthropic schema format) ──────────────────
# NOTE: run_clarification, auto_resolve_clarifications, apply_resolutions are
# intentionally EXCLUDED from TOOL_DEFINITIONS. The LLM must use
# converge_to_readiness instead. The executors remain registered for internal use.

TOOL_DEFINITIONS: list[dict[str, Any]] = [
    {
        "name": "run_analysis",
        "description": (
            "Run the full map-reduce architecture analysis on all uploaded documents. "
            "Extracts components, data flows, data models, tech stack, NFRs, gaps, and layers. "
            "Returns a summary of findings. Call this first after documents are uploaded."
        ),
        "input_schema": {
            "type": "object",
            "properties": {},
            "required": [],
        },
    },
    {
        "name": "run_validation",
        "description": (
            "Run structural validation plus LLM quality gate on the current analysis. "
            "Returns integrity score (broken refs, orphans) and quality scores "
            "(completeness, consistency, specificity). Use after analysis to check quality."
        ),
        "input_schema": {
            "type": "object",
            "properties": {},
            "required": [],
        },
    },
    {
        "name": "request_human_input",
        "description": (
            "Pause the orchestration and ask the human to review or provide input. "
            "Use this for: (1) analysis review after validation, "
            "(2) plan approval, (3) quality gate decisions. "
            "The human will respond and orchestration will resume."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "phase": {
                    "type": "string",
                    "description": "Which phase: analysis_review, clarify_human, plan_review, quality_gate",
                    "enum": ["analysis_review", "clarify_human", "plan_review", "quality_gate"],
                },
                "message": {
                    "type": "string",
                    "description": "Message to show the human explaining what needs their attention",
                },
                "data": {
                    "type": "object",
                    "description": "Structured data for the checkpoint UI (items to review, scores, etc.)",
                },
            },
            "required": ["phase", "message"],
        },
    },
    {
        "name": "converge_to_readiness",
        "description": (
            "Run a deterministic convergence cycle to reach a target readiness score. "
            "Internally runs up to max_rounds of: clarify → auto-resolve ALL → apply resolutions → re-validate. "
            "Tracks resolved items across rounds to prevent reprocessing. "
            "Caps gap growth to prevent score oscillation. "
            "Returns detailed convergence summary with final readiness score. "
            "This is the ONLY tool for clarification/resolution — do NOT try to clarify manually."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "target_score": {
                    "type": "integer",
                    "description": "Target readiness score (0-100). Default: 80.",
                    "default": 80,
                },
                "max_rounds": {
                    "type": "integer",
                    "description": "Maximum convergence rounds (1-5). Default: 3.",
                    "default": 3,
                },
            },
            "required": [],
        },
    },
    {
        "name": "optimize_oss_stack",
        "description": (
            "Discover, validate, and apply open-source library recommendations for the architecture. "
            "Searches the web for current OSS landscape, checks compatibility with existing tech stack, "
            "and auto-applies high-confidence suggestions directly to the analysis. "
            "Returns a report of what was applied and what needs human review. "
            "Can be called at any point after an analysis exists."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "focus_area": {
                    "type": "string",
                    "description": "Optional focus area like 'authentication', 'caching', 'monitoring'. Leave empty for full scan.",
                },
                "min_compatibility": {
                    "type": "number",
                    "description": "Minimum compatibility score (0.0-1.0) to auto-apply. Default: 0.75.",
                    "default": 0.75,
                },
                "auto_apply": {
                    "type": "boolean",
                    "description": "Whether to automatically apply high-compatibility suggestions to the analysis. Default: true.",
                    "default": True,
                },
            },
            "required": [],
        },
    },
    {
        "name": "generate_plan",
        "description": (
            "Generate a comprehensive build plan from the current analysis. "
            "Includes phases, tasks, dependencies, risks, tech recommendations, and team suggestions. "
            "Call after convergence and OSS optimization are done."
        ),
        "input_schema": {
            "type": "object",
            "properties": {},
            "required": [],
        },
    },
    {
        "name": "generate_build_artifacts",
        "description": (
            "Generate all 12 IDE-ready vibe-coding artifacts (PRD, tech spec, implementation plan, "
            "copilot instructions, coding standards, API design, testing, security, database design, "
            "component specs, scaffold prompt, agent config). Call as the final step after plan is approved."
        ),
        "input_schema": {
            "type": "object",
            "properties": {},
            "required": [],
        },
    },
]


# ── Tool executors ──────────────────────────────────────────────


async def execute_run_analysis(input: dict, ctx: OrchestratorContext) -> str:
    from app.db.engine import async_session_maker
    from app.db import repository as repo
    from app.services.analyzer import analyze_project_chunked

    # Load documents from DB
    async with async_session_maker() as db:
        docs = await repo.get_documents(db, ctx.project_id)
        existing = await repo.get_extractions(db, ctx.project_id)

    ctx.documents = docs

    # Consume the SSE generator to completion
    result_data = None
    async for event in analyze_project_chunked(ctx.project_id, docs, existing):
        if event.get("phase") == "complete" and "analysis" in event:
            result_data = event["analysis"]
        elif event.get("phase") == "error":
            return f"Analysis failed: {event.get('error', 'unknown')}"

    if not result_data:
        return "Analysis produced no results"

    # Reload from DB to get the saved version with validation
    async with async_session_maker() as db:
        ctx.analysis = await repo.get_latest_analysis(db, ctx.project_id)

    a = ctx.analysis
    return (
        f"Analysis complete. Found {len(a.components)} components, "
        f"{len(a.data_flows)} data flows, {len(a.data_models)} data models, "
        f"{len(a.tech_stack)} tech stack entries, "
        f"{len(a.nonfunctional_requirements)} NFRs, {len(a.gaps)} gaps. "
        f"Validation score: {a.validation.score if a.validation else 'N/A'}. "
        f"Summary: {a.summary[:300]}"
    )


async def execute_run_validation(input: dict, ctx: OrchestratorContext) -> str:
    from app.db.engine import async_session_maker
    from app.db import repository as repo
    from app.services.validator import validate_analysis
    from app.services.quality_gate import run_quality_gate

    if not ctx.analysis:
        return "Error: No analysis available. Run analysis first."

    # Ensure documents are loaded (needed for quality gate)
    if not ctx.documents:
        async with async_session_maker() as db:
            ctx.documents = await repo.get_documents(db, ctx.project_id)

    # Structural validation
    validation = validate_analysis(ctx.analysis)
    ctx.analysis.validation = validation

    # Quality gate
    quality = await run_quality_gate(ctx.analysis, ctx.documents)
    ctx.analysis.quality = quality

    # Save updated analysis
    async with async_session_maker() as db:
        await repo.save_analysis(db, ctx.project_id, ctx.analysis, source="validation")

    return (
        f"Validation complete. Structural score: {validation.score}/100 "
        f"({len(validation.errors)} errors, {len(validation.warnings)} warnings). "
        f"Quality gate: completeness={quality.completeness_score}, "
        f"consistency={quality.consistency_score}, "
        f"specificity={quality.specificity_score}, "
        f"overall={quality.overall_score}. "
        f"Hallucination flags: {len(quality.hallucination_flags)}. "
        f"Missing components: {len(quality.missing_components)}. "
        f"Recommendations: {'; '.join(quality.recommendations[:3])}"
    )


async def execute_run_clarification(input: dict, ctx: OrchestratorContext) -> str:
    from app.services.clarifier import generate_clarifications

    if not ctx.analysis:
        return "Error: No analysis available. Run analysis first."

    result = await generate_clarifications(ctx.analysis)
    ctx.clarifications = result.get("clarifications", [])

    auto_count = sum(1 for c in ctx.clarifications if c.get("auto_resolvable"))
    human_count = len(ctx.clarifications) - auto_count

    return (
        f"Found {len(ctx.clarifications)} clarification items. "
        f"Readiness score: {result.get('readiness_score', 'N/A')}/100. "
        f"{auto_count} auto-resolvable, {human_count} need human input. "
        f"Blockers: {result.get('blockers_count', 0)}, "
        f"Critical: {result.get('critical_count', 0)}. "
        f"Summary: {result.get('readiness_summary', '')[:200]}"
    )


async def execute_auto_resolve(input: dict, ctx: OrchestratorContext) -> str:
    from app.services.clarifier import auto_resolve_clarifications

    if not ctx.analysis or not ctx.clarifications:
        return "Error: No clarifications available. Run clarification first."

    auto_items = [c for c in ctx.clarifications if c.get("auto_resolvable")]
    if not auto_items:
        return "No auto-resolvable items found."

    resolved = await auto_resolve_clarifications(ctx.analysis, auto_items)

    return (
        f"Auto-resolved {len(resolved)} items. "
        f"Resolutions: {json.dumps([{'id': r.get('id'), 'answer': r.get('answer', '')[:100]} for r in resolved[:5]], indent=1)}"
    )


async def execute_request_human_input(input: dict, ctx: OrchestratorContext) -> str:
    phase = input.get("phase", "general")
    message = input.get("message", "Human input needed")
    data = input.get("data", {})

    # Add context data
    if phase == "clarify_human" and ctx.clarifications:
        human_items = [c for c in ctx.clarifications if not c.get("auto_resolvable")]
        data["items"] = human_items

    if phase == "analysis_review" and ctx.analysis:
        data["components"] = len(ctx.analysis.components)
        data["data_flows"] = len(ctx.analysis.data_flows)
        data["gaps"] = len(ctx.analysis.gaps)
        data["validation_score"] = ctx.analysis.validation.score if ctx.analysis.validation else None
        data["quality_score"] = ctx.analysis.quality.overall_score if ctx.analysis.quality else None
        data["summary"] = ctx.analysis.summary[:300]

    if phase == "plan_review" and ctx.plan:
        data["phases"] = len(ctx.plan.phases)
        data["tasks"] = len(ctx.plan.tasks)
        data["risks"] = len(ctx.plan.risks)
        data["summary"] = ctx.plan.summary[:300]

    # Return checkpoint signal — llm_tool_loop handles the pause/resume
    checkpoint = {
        "phase": phase,
        "message": message,
        "data": data,
    }
    return f"__CHECKPOINT__{json.dumps(checkpoint)}"


async def execute_apply_resolutions(input: dict, ctx: OrchestratorContext) -> str:
    from app.db.engine import async_session_maker
    from app.db import repository as repo
    from app.services.clarifier import resolve_clarifications

    if not ctx.analysis:
        return "Error: No analysis available."

    resolutions = input.get("resolutions", [])
    if not resolutions:
        return "No resolutions provided."

    updated = await resolve_clarifications(ctx.analysis, resolutions)
    ctx.analysis = updated

    # Save updated analysis
    async with async_session_maker() as db:
        version = await repo.save_analysis(db, ctx.project_id, updated, source="clarify_resolve")

    return (
        f"Applied {len(resolutions)} resolutions. Analysis updated to version {version}. "
        f"Now: {len(updated.components)} components, {len(updated.gaps)} gaps. "
        f"Summary: {updated.summary[:200]}"
    )


async def execute_generate_plan(input: dict, ctx: OrchestratorContext) -> str:
    from app.db.engine import async_session_maker
    from app.db import repository as repo
    from app.services.planner import generate_plan

    if not ctx.analysis:
        return "Error: No analysis available."

    plan = await generate_plan(ctx.analysis)
    ctx.plan = plan

    async with async_session_maker() as db:
        await repo.save_plan(db, ctx.project_id, plan)

    return (
        f"Plan generated. {len(plan.phases)} phases, {len(plan.tasks)} tasks, "
        f"{len(plan.dependencies)} dependencies, {len(plan.risks)} risks, "
        f"{len(plan.tech_recommendations)} tech recommendations. "
        f"Summary: {plan.summary[:200]}"
    )


async def execute_generate_build_artifacts(input: dict, ctx: OrchestratorContext) -> str:
    from app.services.build_generator import generate_build_artifacts

    if not ctx.analysis:
        return "Error: No analysis available."
    if not ctx.plan:
        return "Error: No plan available. Generate plan first."

    artifacts = await generate_build_artifacts(ctx.analysis, ctx.plan, ctx.project_name)

    return (
        f"Generated {len(artifacts)} build artifacts: "
        f"{', '.join(list(artifacts.keys())[:8])}"
        f"{'...' if len(artifacts) > 8 else ''}"
    )


# ── Converge-to-readiness compound tool ─────────────────────────


async def execute_converge_to_readiness(input: dict, ctx: OrchestratorContext) -> str:
    """Deterministic convergence loop: clarify → auto-resolve → apply → re-validate.

    Runs a bounded number of rounds to drive readiness score toward the target.
    Tracks resolved item titles across rounds so the clarifier excludes them.
    Guarantees monotonic progress by suppressing gap inflation.
    """
    from app.db.engine import async_session_maker
    from app.db import repository as repo
    from app.services.clarifier import (
        generate_clarifications,
        auto_resolve_clarifications,
        resolve_clarifications,
    )
    from app.services.validator import validate_analysis, compute_readiness_score
    from app.services.quality_gate import run_quality_gate

    target_score = input.get("target_score", 80)
    max_rounds = min(input.get("max_rounds", 3), 5)

    if not ctx.analysis:
        return "Error: No analysis available. Run analysis first."

    # Ensure documents are loaded (needed for quality gate)
    if not ctx.documents:
        async with async_session_maker() as db:
            ctx.documents = await repo.get_documents(db, ctx.project_id)

    resolved_titles: list[str] = []  # Human-readable titles of resolved items
    resolved_ids: set[str] = set()
    round_logs: list[str] = []
    best_readiness = 0
    rounds_done = 0

    # Compute initial readiness from objective metrics
    initial_readiness = compute_readiness_score(ctx.analysis)
    readiness = initial_readiness["readiness_score"]
    best_readiness = readiness
    logger.info(f"[converge] Initial readiness: {readiness}/100 (target {target_score})")

    if readiness >= target_score:
        round_logs.append(f"Already at readiness {readiness}/100 — target {target_score} met.")
    else:
        for round_num in range(1, max_rounds + 1):
            logger.info(f"[converge] Round {round_num}/{max_rounds} — target {target_score}")

            # ── Step 1: Clarify (with resolved context) ──────────────
            clarify_result = await generate_clarifications(
                ctx.analysis,
                resolved_titles=resolved_titles if resolved_titles else None,
            )
            all_items = clarify_result.get("clarifications", [])

            # Filter out items we already resolved (by ID or similar title)
            resolved_title_set = {t.lower() for t in resolved_titles}
            new_items = [
                c for c in all_items
                if c.get("id") not in resolved_ids
                and c.get("title", "").lower() not in resolved_title_set
            ]

            logger.info(
                f"[converge] Round {round_num}: computed_readiness={readiness}, "
                f"total_items={len(all_items)}, new_items={len(new_items)}, "
                f"already_resolved={len(resolved_ids)}"
            )

            if not new_items:
                round_logs.append(
                    f"Round {round_num}: Readiness {readiness}/100 — no new items to resolve. "
                    f"All {len(resolved_ids)} previous items already addressed."
                )
                break

            blockers_left = [c for c in new_items if c.get("severity") == "blocker"]
            round_logs.append(
                f"Round {round_num}: Readiness {readiness}/100, resolving {len(new_items)} items "
                f"({len(blockers_left)} blockers, "
                f"{sum(1 for c in new_items if c.get('severity') == 'critical')} critical)"
            )

            ctx.clarifications = new_items

            # ── Step 2: Auto-resolve ALL items ───────────────────────
            for item in new_items:
                item["auto_resolvable"] = True

            resolved = await auto_resolve_clarifications(ctx.analysis, new_items)
            logger.info(f"[converge] Round {round_num}: auto-resolved {len(resolved)} items")

            if not resolved:
                round_logs.append(f"  → Auto-resolve returned 0 items, stopping.")
                break

            # ── Step 3: Apply resolutions ────────────────────────────
            resolutions = []
            for item in new_items:
                item_id = item.get("id", "")
                item_title = item.get("title", item.get("question", ""))
                answer = next(
                    (r.get("answer", "") for r in resolved if r.get("id") == item_id),
                    item.get("default_answer", "Resolved by architecture expert."),
                )
                resolutions.append({
                    "id": item_id,
                    "question": item.get("question", item_title),
                    "answer": answer,
                })
                resolved_ids.add(item_id)
                resolved_titles.append(item_title)

            original_gap_count = len(ctx.analysis.gaps)
            updated = await resolve_clarifications(ctx.analysis, resolutions)

            # ── Step 4: Hard cap — gaps can only decrease or stay flat
            if len(updated.gaps) > original_gap_count:
                logger.warning(
                    f"[converge] Gap inflation: {original_gap_count} → {len(updated.gaps)}. "
                    f"Capping to {original_gap_count}."
                )
                updated.gaps = updated.gaps[:original_gap_count]

            ctx.analysis = updated

            # ── Step 5: Re-validate and recompute readiness ──────────
            validation = validate_analysis(ctx.analysis)
            ctx.analysis.validation = validation

            # Save updated analysis
            async with async_session_maker() as db:
                await repo.save_analysis(db, ctx.project_id, ctx.analysis, source=f"converge_r{round_num}")

            # Recompute readiness deterministically
            new_readiness_info = compute_readiness_score(ctx.analysis)
            readiness = new_readiness_info["readiness_score"]
            best_readiness = max(best_readiness, readiness)
            rounds_done = round_num

            round_logs.append(
                f"  → Applied {len(resolutions)} resolutions. "
                f"Components: {len(updated.components)}, Gaps: {len(updated.gaps)}, "
                f"Validation: {validation.score}/100, Readiness: {readiness}/100"
            )

            # Check convergence after applying resolutions
            if readiness >= target_score:
                round_logs.append(
                    f"  → Target {target_score} reached! Readiness: {readiness}/100"
                )
                break

    # ── Final assessment ─────────────────────────────────────────

    # Run quality gate (LLM-based, may update quality scores used in readiness)
    quality = await run_quality_gate(ctx.analysis, ctx.documents)
    ctx.analysis.quality = quality

    # Final deterministic readiness after quality gate
    final_info = compute_readiness_score(ctx.analysis)
    final_readiness = max(final_info["readiness_score"], best_readiness)

    # Still get the clarification items for the UI (remaining open items)
    final_clarify = await generate_clarifications(
        ctx.analysis,
        resolved_titles=resolved_titles,
    )
    final_blockers = sum(1 for c in final_clarify.get("clarifications", []) if c.get("severity") == "blocker")
    final_critical = sum(1 for c in final_clarify.get("clarifications", []) if c.get("severity") == "critical")
    ctx.clarifications = final_clarify.get("clarifications", [])

    async with async_session_maker() as db:
        await repo.save_analysis(db, ctx.project_id, ctx.analysis, source="converge_final")

    # rounds_done was tracked in the loop
    summary = (
        f"Convergence complete after {rounds_done} round(s).\n"
        f"Final readiness: {final_readiness}/100 (target: {target_score}). "
        f"{'TARGET MET!' if final_readiness >= target_score else f'Gap: {target_score - final_readiness} points.'}\n"
        f"Blockers: {final_blockers}, Critical: {final_critical}.\n"
        f"Quality: overall={quality.overall_score}, completeness={quality.completeness_score}, "
        f"consistency={quality.consistency_score}, specificity={quality.specificity_score}.\n"
        f"Structural: {final_info['structural']}/100. "
        f"Gap health: {final_info['gap_health']}/100 ({final_info['gap_count']} gaps).\n"
        f"Total items resolved: {len(resolved_ids)}.\n"
        f"\nRound details:\n" + "\n".join(round_logs)
    )

    logger.info(f"[converge] Done: readiness={final_readiness}, resolved={len(resolved_ids)}")
    return summary


# ── OSS stack optimizer ─────────────────────────────────────────


async def execute_optimize_oss_stack(input: dict, ctx: OrchestratorContext) -> str:
    """Discover, validate, and apply OSS recommendations to the analysis.

    Reuses the existing integration_advisor service for discovery + web search,
    then applies high-confidence suggestions directly as analysis deltas.
    """
    from app.db.engine import async_session_maker
    from app.db import repository as repo
    from app.services.integration_advisor import suggest_integrations

    if not ctx.analysis:
        return "Error: No analysis available. Run analysis first."

    # Ensure documents are loaded
    if not ctx.documents:
        async with async_session_maker() as db:
            ctx.documents = await repo.get_documents(db, ctx.project_id)

    focus_area = input.get("focus_area") or None
    min_compat = input.get("min_compatibility", 0.75)
    auto_apply = input.get("auto_apply", True)

    logger.info(
        f"[oss_optimize] Starting: focus={focus_area}, min_compat={min_compat}, "
        f"auto_apply={auto_apply}, components={len(ctx.analysis.components)}"
    )

    # Run the integration advisor pipeline (web search + LLM analysis)
    advice_data = None
    async for event in suggest_integrations(
        analysis=ctx.analysis,
        focus_area=focus_area,
        skip_search=False,
    ):
        if event.get("phase") == "complete":
            advice_data = event.get("advice", {})
        elif event.get("phase") == "error":
            return f"OSS analysis failed: {event.get('error', 'unknown')}"

    if not advice_data:
        return "OSS analysis produced no results."

    suggestions = advice_data.get("suggestions", [])
    summary = advice_data.get("summary", "")
    build_vs_buy = advice_data.get("build_vs_buy_ratio", "")

    if not suggestions:
        return f"No OSS recommendations found. {summary}"

    # Separate auto-apply (high confidence) vs review-needed
    auto_suggestions = []
    review_suggestions = []
    for s in suggestions:
        score = s.get("compatibility_score", 0)
        effort = s.get("integration_effort", "high")
        maturity = s.get("maturity", "experimental")
        # Auto-apply if: high compatibility + not high effort + at least growing maturity
        if (
            score >= min_compat
            and effort in ("low", "medium")
            and maturity in ("growing", "mature", "established")
        ):
            auto_suggestions.append(s)
        else:
            review_suggestions.append(s)

    applied_count = 0
    applied_details: list[str] = []

    if auto_apply and auto_suggestions:
        data = ctx.analysis.model_dump()
        existing_tech = {t.get("technology", "").lower() for t in data.get("tech_stack", [])}
        existing_component_names = {c.get("name", "").lower() for c in data.get("components", [])}

        for s in auto_suggestions:
            lib_name = s.get("library_name", "")
            if lib_name.lower() in existing_tech:
                applied_details.append(f"  ✓ {lib_name}: already in tech stack (skipped)")
                continue

            # Add to tech stack
            category = _map_oss_category(s.get("category", "enhancement"))
            tech_entry = {
                "id": f"tech-oss-{len(data['tech_stack']) + 1}",
                "category": category,
                "technology": lib_name,
                "purpose": s.get("description", s.get("rationale", ""))[:120],
                "component_ids": [],
                "source_documents": [],
            }

            # Link to target components
            for target_name in s.get("target_components", []):
                for comp in data["components"]:
                    if target_name.lower() in comp.get("name", "").lower():
                        tech_entry["component_ids"].append(comp["id"])
                        break

            data["tech_stack"].append(tech_entry)

            # If it fills a gap, resolve matching gaps
            if s.get("category") == "missing_capability":
                gap_area = s.get("target_components", [""])[0].lower() if s.get("target_components") else ""
                resolved_gaps = []
                for gap in data.get("gaps", []):
                    gap_desc = gap.get("description", "").lower()
                    gap_a = gap.get("area", "").lower()
                    if gap_area and (gap_area in gap_desc or gap_area in gap_a):
                        resolved_gaps.append(gap["id"])
                if resolved_gaps:
                    data["gaps"] = [g for g in data["gaps"] if g["id"] not in resolved_gaps]
                    applied_details.append(
                        f"  ✓ {lib_name} (compat: {s.get('compatibility_score', 0):.0%}): "
                        f"added to tech stack, resolved {len(resolved_gaps)} gap(s)"
                    )
                else:
                    applied_details.append(
                        f"  ✓ {lib_name} (compat: {s.get('compatibility_score', 0):.0%}): "
                        f"added to tech stack as {category}"
                    )
            else:
                applied_details.append(
                    f"  ✓ {lib_name} (compat: {s.get('compatibility_score', 0):.0%}): "
                    f"added to tech stack as {category}"
                )

            applied_count += 1

        # Rebuild analysis from updated data
        ctx.analysis = AnalysisResult(**data)

        # Save
        async with async_session_maker() as db:
            await repo.save_analysis(db, ctx.project_id, ctx.analysis, source="oss_optimizer")

    # Build review section
    review_details: list[str] = []
    for s in review_suggestions:
        reason = []
        if s.get("compatibility_score", 0) < min_compat:
            reason.append(f"compat {s.get('compatibility_score', 0):.0%}")
        if s.get("integration_effort") == "high":
            reason.append("high effort")
        if s.get("maturity") == "experimental":
            reason.append("experimental")
        review_details.append(
            f"  ⚠ {s.get('library_name', '?')} — {s.get('description', '')[:80]} "
            f"[{', '.join(reason)}]"
        )

    result = (
        f"OSS Stack Optimization Complete.\n"
        f"Discovered {len(suggestions)} open-source opportunities.\n"
        f"Build-vs-buy: {build_vs_buy}\n\n"
    )

    if applied_count > 0:
        result += (
            f"AUTO-APPLIED ({applied_count} libraries — compatibility ≥ {min_compat:.0%}):\n"
            + "\n".join(applied_details) + "\n\n"
        )
    else:
        result += "No libraries met the auto-apply threshold.\n\n"

    if review_details:
        result += (
            f"NEEDS REVIEW ({len(review_details)} libraries):\n"
            + "\n".join(review_details) + "\n\n"
        )

    result += f"Summary: {summary}"

    logger.info(
        f"[oss_optimize] Done: {len(suggestions)} found, {applied_count} applied, "
        f"{len(review_details)} need review"
    )
    return result


def _map_oss_category(advisor_category: str) -> str:
    """Map integration advisor categories to tech_stack categories."""
    mapping = {
        "replacement": "backend",
        "enhancement": "backend",
        "missing_capability": "backend",
        "infrastructure": "infrastructure",
    }
    return mapping.get(advisor_category, "other")


# ── Executor registry ───────────────────────────────────────────

TOOL_EXECUTORS: dict[str, Any] = {
    "run_analysis": execute_run_analysis,
    "run_validation": execute_run_validation,
    "run_clarification": execute_run_clarification,
    "auto_resolve_clarifications": execute_auto_resolve,
    "request_human_input": execute_request_human_input,
    "apply_resolutions": execute_apply_resolutions,
    "generate_plan": execute_generate_plan,
    "generate_build_artifacts": execute_generate_build_artifacts,
    "converge_to_readiness": execute_converge_to_readiness,
    "optimize_oss_stack": execute_optimize_oss_stack,
}
