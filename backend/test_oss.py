"""Quick smoke-test for the agentic orchestrator."""

import asyncio
import sys

from app.config import settings
from app.services.orchestrator import Orchestrator


async def main(project_id: str) -> None:
    print(f"Running orchestrator for project {project_id}")
    print(f"LLM provider: {settings.llm_provider}")
    print(f"LLM model: {settings.llm_model}")

    orchestrator = Orchestrator(project_id)
    async for event in orchestrator.run("Analyze the architecture and generate diagrams"):
        print(f"[{event.get('type', 'unknown')}] {event.get('message', '')}")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python test_oss.py <project_id>")
        sys.exit(1)
    asyncio.run(main(sys.argv[1]))
"""Quick test: run optimize_oss_stack via orchestrator."""
import asyncio
import sys
from app.services.orchestrator import run_orchestrator
from app.services.tools import OrchestratorContext
from app.db.engine import async_session_maker
from app.db import repository as repo


async def test():
    if len(sys.argv) < 2:
        print("Usage: python test_oss.py <project-id>")
        return
    pid = sys.argv[1]
    async with async_session_maker() as db:
        project = await repo.get_project(db, pid)
        analysis = await repo.get_latest_analysis(db, pid)

    ctx = OrchestratorContext(
        project_id=pid,
        project_name=project.name,
        checkpoint_event=asyncio.Event(),
    )
    if analysis:
        ctx.analysis = analysis
        print(f"Analysis loaded: {len(analysis.components)} components")
    else:
        print("NO ANALYSIS FOUND")
        return

    goal = (
        "Call optimize_oss_stack to analyze the current architecture and discover "
        "open-source libraries. Auto-apply high-confidence suggestions. Show results."
    )

    async for event in run_orchestrator(pid, project.name, goal=goal, context=ctx):
        etype = event.get("type", "?")
        content = str(event)[:300]
        print(f"EVENT [{etype}]: {content}")


if __name__ == "__main__":
    asyncio.run(test())
