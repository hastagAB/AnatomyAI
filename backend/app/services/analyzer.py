from __future__ import annotations
import asyncio
import json
import logging
from typing import AsyncGenerator
from anthropic import AsyncAnthropic
from app.config import settings
from app.models.schemas import (
    AnalysisResult, PartialExtraction, UploadedDocument,
)
from app.utils.prompts import EXTRACTION_SYSTEM, SYNTHESIS_SYSTEM

MAX_RETRIES = 3
RETRY_DELAY = 10  # seconds between retries
MAX_CONCURRENT_BATCHES = 1  # sequential to avoid MaaS throttling
MAX_DEEPENING_PASSES = 2    # max targeted re-extraction passes

logger = logging.getLogger("anatomy.analyzer")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")
_fh = logging.FileHandler("analyzer.log", mode="a")
_fh.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(message)s"))
logger.addHandler(_fh)


def _get_async_client() -> AsyncAnthropic:
    kwargs: dict = {
        "api_key": settings.llm_api_key,
        "timeout": 600.0,
        "max_retries": 3,
    }
    if settings.llm_base_url:
        kwargs["base_url"] = settings.llm_base_url
    return AsyncAnthropic(**kwargs)


def _parse_json_response(text: str | None) -> dict:
    if not text:
        raise ValueError("Model returned empty response")
    if "```json" in text:
        text = text.split("```json")[1].split("```")[0]
    elif "```" in text:
        text = text.split("```")[1].split("```")[0]
    return json.loads(text.strip())


def _build_doc_content(doc: UploadedDocument) -> str:
    """Build a text representation of a single document's chunks."""
    parts = []
    for chunk in doc.chunks:
        if chunk.metadata.get("image_base64"):
            parts.append(f"[Image: {chunk.filename}]")
        else:
            parts.append(chunk.content)
    return "\n".join(parts)


def _group_documents(documents: list[UploadedDocument]) -> list[list[UploadedDocument]]:
    """Group documents into batches that fit comfortably in a single LLM call.

    Strategy: each batch should be under ~120K chars (~30K tokens).
    Large docs get their own batch; small docs are packed together.
    """
    MAX_BATCH_CHARS = 60_000
    batches: list[list[UploadedDocument]] = []
    current_batch: list[UploadedDocument] = []
    current_size = 0

    for doc in documents:
        doc_size = sum(len(c.content) for c in doc.chunks)
        if doc_size > MAX_BATCH_CHARS:
            # Large doc gets its own batch (will be truncated by the caller)
            if current_batch:
                batches.append(current_batch)
                current_batch = []
                current_size = 0
            batches.append([doc])
        elif current_size + doc_size > MAX_BATCH_CHARS:
            batches.append(current_batch)
            current_batch = [doc]
            current_size = doc_size
        else:
            current_batch.append(doc)
            current_size += doc_size

    if current_batch:
        batches.append(current_batch)

    return batches


def _repair_truncated_json(text: str) -> dict | None:
    """Try to salvage a JSON object from a truncated response."""
    # Strip markdown fences if present
    if "```json" in text:
        text = text.split("```json")[1].split("```")[0]
    elif "```" in text:
        text = text.split("```")[1].split("```")[0]
    text = text.strip()

    # Try progressively closing the JSON
    for suffix in ["", "}", "]}", "\"]}",  "\"]}", "]}}", "\"]}}"]:
        try:
            return json.loads(text + suffix)
        except json.JSONDecodeError:
            continue

    # Last resort: find the last valid top-level key and close there
    # Truncate at the last complete key-value pair
    last_brace = text.rfind("}")
    if last_brace > 0:
        # Try closing from there
        candidate = text[:last_brace + 1]
        for suffix in ["", "}", "]}", "]}}"]:
            try:
                return json.loads(candidate + suffix)
            except json.JSONDecodeError:
                continue
    return None


# Token limits: start at 16384, escalate on max_tokens truncation
EXTRACT_TOKEN_TIERS = [16384, 32768, 49152]


def _sanitize_extraction_data(data: dict) -> dict:
    """Replace None values with empty strings in LLM-returned extraction data.

    The LLM sometimes returns null for optional string fields like 'technology',
    but Pydantic requires str (not None). Fix them up to avoid validation errors.
    """
    str_defaults = {
        "id": "", "name": "", "type": "service", "description": "", "technology": "",
        "layer": "", "source": "", "target": "", "source_id": "", "target_id": "",
        "protocol": "", "data_format": "", "entity": "", "category": "", "purpose": "",
        "priority": "", "target_value": "", "measurement": "", "area": "", "severity": "",
        "suggestion": "",
    }
    for key in ("components", "data_flows", "data_models", "tech_stack",
                "nonfunctional_requirements", "gaps"):
        items = data.get(key)
        if not isinstance(items, list):
            continue
        for item in items:
            if not isinstance(item, dict):
                continue
            for field, default in str_defaults.items():
                if field in item and item[field] is None:
                    item[field] = default
    return data


async def extract_batch(docs: list[UploadedDocument]) -> PartialExtraction:
    """MAP phase: extract architectural facts from a batch of documents. Retries on failure."""
    client = _get_async_client()

    doc_names = [d.filename for d in docs]
    content_parts = []
    for doc in docs:
        text = _build_doc_content(doc)
        if len(text) > 60_000:
            text = text[:60_000] + "\n[...truncated]"
        content_parts.append(f"=== Document: {doc.filename} ===\n{text}")

    combined = "\n\n".join(content_parts)

    last_error = None
    for attempt in range(1, MAX_RETRIES + 1):
        # Escalate token budget on each retry
        max_tokens = EXTRACT_TOKEN_TIERS[min(attempt - 1, len(EXTRACT_TOKEN_TIERS) - 1)]
        try:
            response = await client.messages.create(
                model=settings.llm_model,
                max_tokens=max_tokens,
                temperature=0.3,
                system=EXTRACTION_SYSTEM,
                messages=[
                    {"role": "user", "content": f"Extract architectural information from these documents:\n\n{combined}\n\nReturn ONLY valid JSON."},
                ],
            )

            raw = response.content[0].text if response.content else None
            stop_reason = response.stop_reason
            logger.info(f"[extract] attempt {attempt} | {', '.join(doc_names)[:60]} | stop={stop_reason} | len={len(raw) if raw else 0} | max_tokens={max_tokens}")

            if not raw:
                raise ValueError("Model returned empty response")

            # If truncated, try to repair the JSON before giving up
            if stop_reason == "max_tokens":
                logger.warning(f"[extract] Response truncated at {max_tokens} tokens, attempting JSON repair...")
                data = _repair_truncated_json(raw)
                if data:
                    logger.info(f"[extract] JSON repair succeeded — {len(data.get('components', []))} components recovered")
                    data = _sanitize_extraction_data(data)
                    return PartialExtraction(
                        document_name=", ".join(doc_names),
                        **{k: v for k, v in data.items() if k in PartialExtraction.model_fields},
                    )
                # Repair failed — retry with higher token budget
                raise ValueError(f"Truncated response (stop_reason=max_tokens) and JSON repair failed")

            data = _parse_json_response(raw)
            data = _sanitize_extraction_data(data)
            return PartialExtraction(
                document_name=", ".join(doc_names),
                **{k: v for k, v in data.items() if k in PartialExtraction.model_fields},
            )
        except Exception as e:
            last_error = e
            logger.error(f"[extract] attempt {attempt} FAILED: {type(e).__name__}: {e}", exc_info=True)
            if attempt < MAX_RETRIES:
                await asyncio.sleep(RETRY_DELAY * attempt)

    raise last_error  # type: ignore[misc]


async def synthesize_extractions(extractions: list[PartialExtraction]) -> AnalysisResult:
    """REDUCE phase: merge all partial extractions into one unified analysis. Retries on failure."""
    client = _get_async_client()

    extraction_dicts = [e.model_dump() for e in extractions]
    extraction_json = json.dumps(extraction_dicts, indent=1)

    last_error = None
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            response = await client.messages.create(
                model=settings.llm_model_deep,
                max_tokens=32768,
                temperature=0.3,
                system=SYNTHESIS_SYSTEM,
                messages=[
                    {"role": "user", "content": f"Synthesize these {len(extractions)} partial extractions into one unified architecture analysis:\n\n{extraction_json}\n\nReturn ONLY valid JSON."},
                ],
            )

            raw = response.content[0].text if response.content else None
            stop_reason = response.stop_reason
            logger.info(f"[synthesize] attempt {attempt} | stop={stop_reason} | len={len(raw) if raw else 0}")

            if not raw or stop_reason == "max_tokens":
                raise ValueError(f"Empty/truncated response (stop_reason={stop_reason})")

            data = _parse_json_response(raw)
            data = _sanitize_extraction_data(data)
            return AnalysisResult(**data)
        except Exception as e:
            last_error = e
            logger.error(f"[synthesize] attempt {attempt} FAILED: {type(e).__name__}: {e}")
            if attempt < MAX_RETRIES:
                await asyncio.sleep(RETRY_DELAY * attempt)

    raise last_error  # type: ignore[misc]


async def analyze_project_chunked(
    project_id: str,
    documents: list[UploadedDocument],
    existing_extractions: list[PartialExtraction],
) -> AsyncGenerator[dict, None]:
    """Full map-reduce analysis with parallel extraction and progress streaming.

    - Runs up to MAX_CONCURRENT_BATCHES extractions in parallel
    - Resumes from saved partial_extractions (skips completed batches)
    - Retries failed batches up to MAX_RETRIES
    - Skips batches that still fail after retries
    - Saves after every successful batch
    - Synthesizes whatever was extracted (even if some batches failed)
    """
    from app.db.engine import async_session_maker
    from app.db import repository as repo
    from app.services import log_stream

    # Attach live log handler so subscribers see analyzer logs in real-time
    log_handler = log_stream.attach(project_id)

    batches = _group_documents(documents)
    total_batches = len(batches)
    failed_batches: list[str] = []

    logger.info(f"[pipeline] Starting analysis for project {project_id}: {len(documents)} docs → {total_batches} batches")

    # Track all extractions (existing + new)
    all_extractions = list(existing_extractions)

    # Check for already-completed extractions (resume support)
    extracted_names = {e.document_name for e in existing_extractions}

    # Emit cached batches first
    pending: list[tuple[int, list[UploadedDocument], str]] = []
    for i, batch in enumerate(batches):
        batch_name = ", ".join(d.filename for d in batch)
        if batch_name in extracted_names:
            yield {
                "phase": "extract",
                "current": i + 1,
                "total": total_batches,
                "docs": [d.filename for d in batch],
                "status": "cached",
            }
        else:
            pending.append((i, batch, batch_name))

    # Parallel extraction of pending batches
    if pending:
        semaphore = asyncio.Semaphore(MAX_CONCURRENT_BATCHES)
        progress_queue: asyncio.Queue[dict] = asyncio.Queue()

        async def _extract_one(idx: int, batch: list[UploadedDocument], batch_name: str):
            logger.info(f"[pipeline] Queuing batch {idx+1}/{total_batches}: {batch_name[:80]}")
            await progress_queue.put({
                "phase": "extract",
                "current": idx + 1,
                "total": total_batches,
                "docs": [d.filename for d in batch],
                "status": "processing",
            })
            async with semaphore:
                try:
                    logger.info(f"[pipeline] Extracting batch {idx+1}/{total_batches}...")
                    extraction = await extract_batch(batch)
                    all_extractions.append(extraction)
                    # Save extraction to DB
                    async with async_session_maker() as db:
                        await repo.save_extraction(db, project_id, extraction)
                    logger.info(f"[pipeline] Batch {idx+1} done — found {len(extraction.components)} components")
                    await progress_queue.put({
                        "phase": "extract",
                        "current": idx + 1,
                        "total": total_batches,
                        "docs": [d.filename for d in batch],
                        "status": "done",
                        "components_found": len(extraction.components),
                    })
                except Exception as e:
                    logger.error(f"[pipeline] Batch {idx+1} failed after retries: {type(e).__name__}: {e}")
                    failed_batches.append(batch_name)
                    await progress_queue.put({
                        "phase": "extract",
                        "current": idx + 1,
                        "total": total_batches,
                        "docs": [d.filename for d in batch],
                        "status": "failed",
                        "error": str(e),
                    })

        # Launch all tasks
        tasks = [
            asyncio.create_task(_extract_one(idx, batch, name))
            for idx, batch, name in pending
        ]

        # Stream progress events as they arrive
        finished = 0
        while finished < len(tasks):
            event = await progress_queue.get()
            yield event
            if event.get("status") in ("done", "failed"):
                finished += 1

        # Ensure all tasks are done (they should be)
        await asyncio.gather(*tasks, return_exceptions=True)

    # Synthesis phase — only if we have at least some extractions
    if not all_extractions:
        logger.error("[pipeline] All batches failed. No data to synthesize.")
        yield {"phase": "error", "status": "failed", "error": "All batches failed. No data to synthesize."}
        log_stream.detach(log_handler)
        return

    logger.info(f"[pipeline] Starting synthesis of {len(all_extractions)} extractions ({len(failed_batches)} failed batches skipped)")

    yield {
        "phase": "synthesize",
        "status": "processing",
        "extractions": len(all_extractions),
        "failed": len(failed_batches),
    }

    try:
        result = await synthesize_extractions(all_extractions)

        # Run structural validation
        from app.services.validator import validate_analysis
        validation_report = validate_analysis(result)
        result.validation = validation_report
        logger.info(
            f"[pipeline] Validation: score={validation_report.score}, "
            f"errors={len(validation_report.errors)}, warnings={len(validation_report.warnings)}"
        )

        # ── Multi-pass deepening ─────────────────────────────────────
        DEEPENING_ERROR_CODES = {"BROKEN_FLOW_SOURCE", "BROKEN_FLOW_TARGET", "ORPHAN_COMPONENT", "BROKEN_GAP_REF"}
        for depth_pass in range(1, MAX_DEEPENING_PASSES + 1):
            actionable = [e for e in validation_report.errors if e.code in DEEPENING_ERROR_CODES]
            if not actionable:
                logger.info(f"[deepen] pass {depth_pass} — no actionable errors, skipping")
                break

            logger.info(f"[deepen] pass {depth_pass}/{MAX_DEEPENING_PASSES} — {len(actionable)} actionable errors")
            yield {
                "phase": "deepen",
                "pass": depth_pass,
                "status": "processing",
                "actionable_errors": len(actionable),
            }

            # Build a targeted prompt listing what needs fixing
            issue_lines = [f"- [{e.code}] {e.message}" for e in actionable[:30]]
            existing_ids = [f"{c.id}: {c.name}" for c in result.components]
            deepen_prompt = (
                "The previous extraction has structural issues. "
                "Re-read the documents and provide ONLY the missing or corrected entities.\n\n"
                f"## Known components\n" + "\n".join(existing_ids) + "\n\n"
                f"## Issues to resolve\n" + "\n".join(issue_lines) + "\n\n"
                "Focus on:\n"
                "1. Components referenced in flows but not yet extracted\n"
                "2. Missing data_flows connecting orphan components\n"
                "3. Corrected source_id / target_id values using the known component IDs above\n\n"
                "Return the same JSON schema (components, data_flows, data_models, tech_stack, nonfunctional_requirements, gaps). "
                "Only include NEW or CORRECTED entities. Return ONLY valid JSON."
            )

            # Combine all document content (truncated) for re-extraction
            doc_parts = []
            for doc in documents:
                text = _build_doc_content(doc)
                if len(text) > 30_000:
                    text = text[:30_000] + "\n[...truncated]"
                doc_parts.append(f"=== {doc.filename} ===\n{text}")
            combined_docs = "\n\n".join(doc_parts)

            try:
                client = _get_async_client()
                response = await client.messages.create(
                    model=settings.llm_model,
                    max_tokens=16384,
                    temperature=0.2,
                    system=EXTRACTION_SYSTEM,
                    messages=[{"role": "user", "content": f"{deepen_prompt}\n\n{combined_docs}"}],
                )
                raw = response.content[0].text if response.content else None
                if raw:
                    data = _parse_json_response(raw)
                    patch = PartialExtraction(
                        document_name=f"_deepening_pass_{depth_pass}",
                        **{k: v for k, v in data.items() if k in PartialExtraction.model_fields},
                    )
                    all_extractions.append(patch)
                    logger.info(
                        f"[deepen] pass {depth_pass} extracted {len(patch.components)} components, "
                        f"{len(patch.data_flows)} flows"
                    )

                    # Re-synthesize with the patch included
                    result = await synthesize_extractions(all_extractions)
                    validation_report = validate_analysis(result)
                    result.validation = validation_report
                    logger.info(
                        f"[deepen] pass {depth_pass} post-validation: score={validation_report.score}, "
                        f"errors={len(validation_report.errors)}"
                    )

                    yield {
                        "phase": "deepen",
                        "pass": depth_pass,
                        "status": "done",
                        "new_components": len(patch.components),
                        "validation_score": validation_report.score,
                    }
                else:
                    logger.warning(f"[deepen] pass {depth_pass} returned empty response, stopping")
                    break
            except Exception as e:
                logger.warning(f"[deepen] pass {depth_pass} failed: {e}, continuing with current result")
                break

        # Save analysis to DB
        async with async_session_maker() as db:
            await repo.save_analysis(db, project_id, result)

        logger.info(f"[pipeline] Analysis complete: {len(result.components)} components, {len(result.data_flows)} flows, {len(result.gaps)} gaps")

        yield {
            "phase": "complete",
            "status": "done",
            "analysis": result.model_dump(),
            "summary": result.summary,
            "components": len(result.components),
            "data_flows": len(result.data_flows),
            "gaps": len(result.gaps),
            "failed_batches": len(failed_batches),
        }
    except Exception as e:
        logger.error(f"[pipeline] Synthesis failed: {e}")
        yield {
            "phase": "error",
            "status": "failed",
            "error": f"Synthesis failed: {e}",
            "extractions_saved": len(all_extractions),
        }
    finally:
        log_stream.detach(log_handler)

