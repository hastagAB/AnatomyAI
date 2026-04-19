"""Real-time log streaming for the Anatomy platform.

Provides a per-project asyncio queue that captures Python logging
records from ALL anatomy.* loggers and makes them available via SSE.
"""
from __future__ import annotations

import asyncio
import logging
import time
from collections import defaultdict


# ── Per-project subscriber queues ──────────────────────────────
_subscribers: dict[str, list[asyncio.Queue]] = defaultdict(list)

# ── Global subscribers (all projects) ──────────────────────────
_global_handlers: dict[str, logging.Handler] = {}


class _ProjectLogHandler(logging.Handler):
    """Pushes formatted log records into every subscriber queue for a project."""

    def __init__(self, project_id: str):
        super().__init__()
        self.project_id = project_id

    def emit(self, record: logging.LogRecord):
        entry = {
            "ts": record.created,
            "level": record.levelname,
            "msg": self.format(record),
        }
        for q in _subscribers.get(self.project_id, []):
            try:
                q.put_nowait(entry)
            except asyncio.QueueFull:
                pass  # drop oldest-unread if consumer is too slow


# ── Public helpers ─────────────────────────────────────────────

def subscribe(project_id: str) -> asyncio.Queue:
    """Create a new subscriber queue for the given project."""
    q: asyncio.Queue = asyncio.Queue(maxsize=2000)
    _subscribers[project_id].append(q)
    return q


def unsubscribe(project_id: str, q: asyncio.Queue) -> None:
    """Remove a subscriber queue."""
    try:
        _subscribers[project_id].remove(q)
    except ValueError:
        pass
    if not _subscribers[project_id]:
        del _subscribers[project_id]


def attach(project_id: str) -> _ProjectLogHandler:
    """Attach a log handler to the root anatomy logger for this project.

    Captures logs from ALL anatomy.* loggers (analyzer, llm, orchestrator,
    tools, quality_gate, refiner, etc.).
    """
    handler = _ProjectLogHandler(project_id)
    handler.setFormatter(logging.Formatter("%(name)s %(levelname)s %(message)s"))
    # Attach to root "anatomy" logger — all child loggers propagate here
    logging.getLogger("anatomy").addHandler(handler)
    _global_handlers[project_id] = handler
    return handler


def detach(handler: _ProjectLogHandler) -> None:
    """Remove the handler from the root anatomy logger."""
    logging.getLogger("anatomy").removeHandler(handler)
    _global_handlers.pop(handler.project_id, None)


def push(project_id: str, level: str, msg: str) -> None:
    """Manually push a log entry (for pipeline-level messages)."""
    entry = {"ts": time.time(), "level": level, "msg": msg}
    for q in _subscribers.get(project_id, []):
        try:
            q.put_nowait(entry)
        except asyncio.QueueFull:
            pass
