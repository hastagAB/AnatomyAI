"""Build artifact generator — produces IDE-ready vibe-coding artifacts."""
from __future__ import annotations
import io
import logging
import zipfile
from app.config import settings
from app.models.schemas import AnalysisResult, ProjectPlan
from app.services.llm_client import llm_call

logger = logging.getLogger("anatomy.build")

ARTIFACTS_SYSTEM = """You are Anatomy, an expert software architect and vibe-coding specialist. Given a fully clarified architecture analysis and build plan, generate professional IDE-ready artifacts that allow ANY developer to build this entire product using AI-assisted coding (vibe coding).

Generate ALL of the following artifacts as a JSON object where keys are file paths and values are file contents:

1. **PRD (Product Requirements Document)** — `docs/PRD.md`
   - Complete product requirements with user stories, acceptance criteria
   - Functional and non-functional requirements
   - Success metrics

2. **Technical Specification** — `docs/TECH-SPEC.md`
   - Architecture overview, system design
   - API contracts with request/response schemas
   - Data models with field types and constraints
   - Integration points and protocols
   - Error handling strategy
   - Security model

3. **Implementation Plan** — `docs/IMPLEMENTATION-PLAN.md`
   - Phase-by-phase build order
   - Task breakdown with dependencies
   - File/folder structure to create
   - Which tasks can be parallelized

4. **Copilot Instructions** — `.github/copilot-instructions.md`
   - Project conventions, naming patterns, code style
   - Architecture decisions and rationale
   - Testing requirements
   - Error handling patterns
   - Security practices to follow

5. **Coding Standards** — `.instructions/coding-standards.instructions.md`
   - Language-specific conventions
   - File organization rules
   - Import ordering, naming conventions
   - Comment and documentation standards

6. **API Design Instructions** — `.instructions/api-design.instructions.md`
   - REST/GraphQL conventions
   - Endpoint naming, versioning
   - Error response format
   - Authentication patterns

7. **Testing Instructions** — `.instructions/testing.instructions.md`
   - Test file naming and organization
   - Unit test patterns (AAA: Arrange-Act-Assert)
   - Integration test strategy
   - Coverage requirements
   - Mock/stub conventions

8. **Security Instructions** — `.instructions/security.instructions.md`
   - Input validation rules
   - Authentication/authorization patterns
   - Secret management
   - OWASP Top 10 mitigations specific to this project

9. **Database Design** — `docs/DATABASE-DESIGN.md`
   - Complete schema with all tables/collections
   - Indexes, constraints, migrations
   - Seed data requirements

10. **Component Specs** — One file per major component: `specs/{component-name}.prompt.md`
    - Each component gets a detailed spec that can be used as a prompt
    - Include: purpose, interfaces, dependencies, implementation details, tests to write
    - Format as a vibe-coding prompt that produces working code

11. **Project Skeleton Prompt** — `prompts/scaffold.prompt.md`
    - A single prompt that generates the entire project scaffold
    - Package.json / requirements.txt / go.mod etc.
    - Directory structure
    - Config files (tsconfig, eslint, docker, CI/CD)

12. **Agent Mode Config** — `.github/agents/builder.agent.md`
    - Custom agent definition for building this specific project
    - Tools it should use, files it should reference
    - Build verification steps

Return valid JSON where keys are file paths and values are the complete file content as strings:
{
  "docs/PRD.md": "# Product Requirements Document\\n...",
  "docs/TECH-SPEC.md": "# Technical Specification\\n...",
  ...
}

Make every artifact COMPLETE, SPECIFIC, and ACTIONABLE. No placeholders like "TBD" or "to be defined". Use the analysis data to fill in every detail. Each file should be production-quality — as if written by a senior architect who spent a week on it.

Return ONLY valid JSON."""


async def generate_build_artifacts(
    analysis: AnalysisResult,
    plan: ProjectPlan,
    project_name: str,
) -> dict[str, str]:
    """Generate all IDE-ready vibe-coding artifacts from analysis + plan."""
    logger.info("Build artifacts generation started for project '%s'", project_name)
    logger.info("Build: analysis has %d components, plan has %d phases, %d tasks",
                len(analysis.components), len(plan.phases), len(plan.tasks))
    analysis_json = analysis.model_dump_json()
    plan_json = plan.model_dump_json()
    logger.info("Build: sending %d chars (analysis=%d, plan=%d) to LLM",
                len(analysis_json) + len(plan_json), len(analysis_json), len(plan_json))

    try:
        artifacts = await llm_call(
            system=ARTIFACTS_SYSTEM,
            user_prompt=(
                f"Project: {project_name}\n\n"
                f"Architecture Analysis:\n{analysis_json}\n\n"
                f"Build Plan:\n{plan_json}\n\n"
                f"Generate ALL vibe-coding artifacts. Return ONLY valid JSON."
            ),
            model=settings.llm_model_deep,
            max_tokens=65536,
        )
        logger.info("Build artifacts complete: %d files generated for '%s'",
                    len(artifacts), project_name)
        for path in sorted(artifacts.keys()):
            logger.info("Build artifact: %s (%d chars)", path, len(str(artifacts[path])))
        return artifacts
    except Exception as e:
        logger.error("Build artifacts generation failed for '%s': %s", project_name, e, exc_info=True)
        raise


def package_artifacts_zip(artifacts: dict[str, str], project_name: str) -> io.BytesIO:
    """Package all generated artifacts into a downloadable ZIP."""
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for path, content in sorted(artifacts.items()):
            zf.writestr(path, content)

        # Add a README at the root
        readme = f"""# {project_name} — Build Artifacts

Generated by **Anatomy AI**.

## What's Inside

This archive contains everything you need to build this project using AI-assisted (vibe) coding.

### Quick Start

1. Extract this ZIP into your project root
2. Open in VS Code with GitHub Copilot
3. Read `docs/IMPLEMENTATION-PLAN.md` for the build order
4. Use the `.instructions/` files — Copilot will auto-apply them
5. Use `specs/*.prompt.md` files as prompts for each component
6. Start with `prompts/scaffold.prompt.md` to generate the project skeleton

### File Guide

| Path | Purpose |
|------|---------|
| `docs/PRD.md` | Product requirements, user stories, acceptance criteria |
| `docs/TECH-SPEC.md` | Architecture, API contracts, data models, security |
| `docs/IMPLEMENTATION-PLAN.md` | Phase-by-phase build order with task breakdown |
| `docs/DATABASE-DESIGN.md` | Complete database schema, migrations, indexes |
| `.github/copilot-instructions.md` | Project-wide Copilot context |
| `.github/agents/builder.agent.md` | Custom Copilot agent for building this project |
| `.instructions/*.instructions.md` | Coding standards, API, testing, security conventions |
| `specs/*.prompt.md` | Per-component build prompts |
| `prompts/scaffold.prompt.md` | Project scaffold generation prompt |
"""
        zf.writestr("README.md", readme)

    buf.seek(0)
    return buf
