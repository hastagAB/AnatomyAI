import logging
import time
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from app.api import upload, analyze, diagrams, chat, plan, evolve, transfer, clarify, build, validate, orchestrate
from app.db.engine import engine
from app.db.models import Base
from app.config import settings

# ── Configure root anatomy logger ──────────────────────────────
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")
logging.getLogger("anatomy").setLevel(logging.INFO)
logger = logging.getLogger("anatomy.api")


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    await engine.dispose()


app = FastAPI(title="Anatomy AI", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:5174", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def log_requests(request: Request, call_next):
    """Log every API request with method, path, status, and duration."""
    if request.url.path in ("/", "/docs", "/openapi.json") or request.url.path.endswith("/logs"):
        return await call_next(request)

    start = time.time()
    response = await call_next(request)
    duration = time.time() - start

    # Extract project_id from path or body for routing to the right log stream
    path = request.url.path
    level = "ERROR" if response.status_code >= 500 else "WARNING" if response.status_code >= 400 else "INFO"
    logger.log(
        logging.getLevelName(level),
        f"{request.method} {path} → {response.status_code} ({duration:.2f}s)",
    )

    # Push to project-specific log stream if we can identify the project
    from app.services import log_stream
    project_id = request.path_params.get("project_id")
    if not project_id:
        # Try to get it from common path patterns like /api/projects/{id}/...
        parts = path.split("/")
        if "projects" in parts:
            idx = parts.index("projects")
            if idx + 1 < len(parts) and len(parts[idx + 1]) > 8:
                project_id = parts[idx + 1]
    if project_id:
        log_stream.push(project_id, level, f"{request.method} {path} → {response.status_code} ({duration:.2f}s)")

    return response

app.include_router(upload.router)
app.include_router(analyze.router)
app.include_router(diagrams.router)
app.include_router(chat.router)
app.include_router(plan.router)
app.include_router(evolve.router)
app.include_router(transfer.router)
app.include_router(clarify.router)
app.include_router(build.router)
app.include_router(validate.router)
app.include_router(orchestrate.router)

from app.api import artifacts
app.include_router(artifacts.router)


@app.get("/")
async def root():
    return {"name": "Anatomy AI", "version": "1.0.0", "status": "running"}


@app.get("/api/test-llm")
async def test_llm():
    """Diagnostic endpoint to test LLM connectivity from within uvicorn."""
    from anthropic import AsyncAnthropic

    kwargs: dict = {
        "api_key": settings.llm_api_key,
        "timeout": 180.0,
        "max_retries": 3,
    }
    if settings.llm_base_url:
        kwargs["base_url"] = settings.llm_base_url
    client = AsyncAnthropic(**kwargs)
    try:
        r = await client.messages.create(
            model=settings.llm_model,
            max_tokens=50,
            messages=[{"role": "user", "content": "Say hello"}],
        )
        return {"ok": True, "content": r.content[0].text, "model": settings.llm_model}
    except Exception as e:
        return {"ok": False, "error": str(e)}
