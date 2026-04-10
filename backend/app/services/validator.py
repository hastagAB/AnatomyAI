"""Structural validator — checks integrity of AnalysisResult after extraction/synthesis."""
from __future__ import annotations

import logging

from app.models.schemas import (
    AnalysisResult,
    ValidationReport,
    ValidationError,
    ValidationWarning,
)

logger = logging.getLogger("anatomy.validator")


def validate_analysis(analysis: AnalysisResult) -> ValidationReport:
    """Run structural integrity checks on an AnalysisResult.

    Checks:
    - Data flow source_id/target_id reference existing component IDs
    - Gap related_component_ids reference existing components
    - Layer component lists reference existing components
    - No orphan components (zero inbound + zero outbound flows)
    - No duplicate component names
    - NFRs have specific target_value
    - Tech stack entries link to at least one component
    """
    errors: list[ValidationError] = []
    warnings: list[ValidationWarning] = []

    component_ids = {c.id for c in analysis.components}
    component_names: dict[str, int] = {}

    # ── Duplicate component names ────────────────────────────────────
    for c in analysis.components:
        component_names[c.name] = component_names.get(c.name, 0) + 1
    for name, count in component_names.items():
        if count > 1:
            warnings.append(ValidationWarning(
                code="DUPLICATE_COMPONENT_NAME",
                message=f"Component name '{name}' appears {count} times",
                entity_type="component",
            ))

    # ── Data flow reference integrity ────────────────────────────────
    flow_sources: set[str] = set()
    flow_targets: set[str] = set()
    for f in analysis.data_flows:
        if f.source_id and f.source_id not in component_ids:
            errors.append(ValidationError(
                code="BROKEN_FLOW_SOURCE",
                message=f"Data flow '{f.id}' source_id '{f.source_id}' not found in components",
                entity_id=f.id,
                entity_type="data_flow",
            ))
        if f.target_id and f.target_id not in component_ids:
            errors.append(ValidationError(
                code="BROKEN_FLOW_TARGET",
                message=f"Data flow '{f.id}' target_id '{f.target_id}' not found in components",
                entity_id=f.id,
                entity_type="data_flow",
            ))
        if f.source_id:
            flow_sources.add(f.source_id)
        if f.target_id:
            flow_targets.add(f.target_id)

    # ── Orphan components (no flows) ─────────────────────────────────
    connected = flow_sources | flow_targets
    for c in analysis.components:
        if c.id not in connected and c.type not in ("actor", "external"):
            warnings.append(ValidationWarning(
                code="ORPHAN_COMPONENT",
                message=f"Component '{c.name}' ({c.id}) has no data flows",
                entity_id=c.id,
                entity_type="component",
            ))

    # ── Gap reference integrity ──────────────────────────────────────
    for g in analysis.gaps:
        for ref_id in g.related_component_ids:
            if ref_id not in component_ids:
                warnings.append(ValidationWarning(
                    code="BROKEN_GAP_REF",
                    message=f"Gap '{g.id}' references unknown component '{ref_id}'",
                    entity_id=g.id,
                    entity_type="gap",
                ))

    # ── Layer reference integrity ────────────────────────────────────
    for layer in analysis.layers:
        for comp_ref in layer.components:
            if comp_ref not in component_ids:
                # Layers may reference by name (old format) — only warn if not matching any name
                comp_names_set = {c.name for c in analysis.components}
                if comp_ref not in comp_names_set:
                    warnings.append(ValidationWarning(
                        code="BROKEN_LAYER_REF",
                        message=f"Layer '{layer.name}' references unknown component '{comp_ref}'",
                        entity_id=layer.id,
                        entity_type="layer",
                    ))

    # ── NFR specificity ──────────────────────────────────────────────
    for nfr in analysis.nonfunctional_requirements:
        if not nfr.target_value:
            warnings.append(ValidationWarning(
                code="VAGUE_NFR",
                message=f"NFR '{nfr.id}' ({nfr.description[:60]}) has no target_value",
                entity_id=nfr.id,
                entity_type="nfr",
            ))

    # ── Tech stack linkage ───────────────────────────────────────────
    for tech in analysis.tech_stack:
        if not tech.component_ids:
            warnings.append(ValidationWarning(
                code="UNLINKED_TECH",
                message=f"Tech '{tech.technology}' ({tech.id}) not linked to any component",
                entity_id=tech.id,
                entity_type="tech_stack",
            ))
        for ref_id in tech.component_ids:
            if ref_id not in component_ids:
                warnings.append(ValidationWarning(
                    code="BROKEN_TECH_REF",
                    message=f"Tech '{tech.technology}' references unknown component '{ref_id}'",
                    entity_id=tech.id,
                    entity_type="tech_stack",
                ))

    # ── Compute score ────────────────────────────────────────────────
    # Start at 100, deduct for issues.
    # Errors (broken refs) are serious; warnings (orphans, vague NFRs) are minor.
    # Cap warning deduction at 30 so cosmetic issues don't tank the score.
    score = 100
    score -= len(errors) * 10
    warning_deduction = min(len(warnings) * 1, 30)  # 1pt each, max 30
    score -= warning_deduction
    score = max(0, min(100, score))

    return ValidationReport(errors=errors, warnings=warnings, score=score)


def compute_readiness_score(analysis: AnalysisResult) -> dict:
    """Compute a deterministic readiness score from objective metrics.

    Unlike the LLM-generated readiness_score, this is:
    - Deterministic (same input → same output)
    - Monotonically increasing as issues are resolved
    - Not subject to LLM scoring variance

    Formula (weighted average):
      Structural quality  20%  — validation score
      Completeness        25%  — quality gate completeness
      Consistency         20%  — quality gate consistency
      Specificity         15%  — quality gate specificity
      Gap health          10%  — fewer gaps = higher score
      Blocker freedom     10%  — no blockers = 100

    Returns dict with overall score and breakdown.
    """
    # Structural validation
    if analysis.validation:
        structural = analysis.validation.score
    else:
        structural = validate_analysis(analysis).score

    # Quality gate scores (use defaults if not yet computed)
    if analysis.quality:
        completeness = analysis.quality.completeness_score
        consistency = analysis.quality.consistency_score
        specificity = analysis.quality.specificity_score
    else:
        # Estimate from structural metrics when quality gate hasn't run yet
        n_comps = len(analysis.components)
        n_flows = len(analysis.data_flows)
        n_nfrs = len(analysis.nonfunctional_requirements)
        n_tech = len(analysis.tech_stack)

        # Rough heuristics: a well-formed analysis has 20+ components,
        # 15+ flows, 10+ NFRs, 10+ tech entries
        completeness = min(100, int(
            (min(n_comps, 30) / 30 * 40) +
            (min(n_flows, 20) / 20 * 30) +
            (min(n_nfrs, 15) / 15 * 15) +
            (min(n_tech, 15) / 15 * 15)
        ))
        consistency = structural  # proxy
        specificity = min(100, int(
            sum(1 for nfr in analysis.nonfunctional_requirements if nfr.target_value)
            / max(len(analysis.nonfunctional_requirements), 1) * 100
        ))

    # Gap health: 0 gaps → 100, each gap deducts 10, floor at 30
    gap_score = max(30, 100 - len(analysis.gaps) * 10)

    # Blocker freedom: based on critical gaps (severity high/critical)
    critical_gaps = sum(
        1 for g in analysis.gaps
        if g.severity in ("high", "critical", "blocker")
    )
    blocker_score = max(0, 100 - critical_gaps * 25)

    # Weighted average
    readiness = int(
        structural * 0.20 +
        completeness * 0.25 +
        consistency * 0.20 +
        specificity * 0.15 +
        gap_score * 0.10 +
        blocker_score * 0.10
    )

    readiness = max(0, min(100, readiness))

    breakdown = {
        "readiness_score": readiness,
        "structural": structural,
        "completeness": completeness,
        "consistency": consistency,
        "specificity": specificity,
        "gap_health": gap_score,
        "blocker_freedom": blocker_score,
        "gap_count": len(analysis.gaps),
        "component_count": len(analysis.components),
    }

    logger.info(
        f"[readiness] score={readiness}: structural={structural}, "
        f"completeness={completeness}, consistency={consistency}, "
        f"specificity={specificity}, gap_health={gap_score}, "
        f"blocker_freedom={blocker_score}"
    )

    return breakdown
