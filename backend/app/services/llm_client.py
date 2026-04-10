"""Shared LLM client utilities — single source for client init, JSON parsing, retry logic, tool-use."""
from __future__ import annotations

import asyncio
import json
import logging
import re
import time
from typing import Any, AsyncGenerator, Callable, Awaitable

from anthropic import AsyncAnthropic

from app.config import settings

logger = logging.getLogger("anatomy.llm")


def get_llm_client() -> AsyncAnthropic:
    """Return a configured AsyncAnthropic client."""
    kwargs: dict = {
        "api_key": settings.llm_api_key,
        "timeout": 600.0,
        "max_retries": 2,
    }
    if settings.llm_base_url:
        kwargs["base_url"] = settings.llm_base_url
    return AsyncAnthropic(**kwargs)


def _sanitize_json_strings(text: str) -> str:
    """Fix common LLM JSON issues: unescaped control chars inside string values."""
    # Replace literal unescaped control characters inside JSON string values.
    # Tracks whether we're inside a quoted string, handling escaped quotes
    # and escaped backslashes correctly (e.g. \\" ends the string).
    out: list[str] = []
    in_string = False
    i = 0
    n = len(text)
    while i < n:
        ch = text[i]
        if not in_string:
            if ch == '"':
                in_string = True
            out.append(ch)
        else:
            if ch == '\\' and i + 1 < n:
                # Escaped character — emit both and skip next
                out.append(ch)
                out.append(text[i + 1])
                i += 2
                continue
            elif ch == '"':
                in_string = False
                out.append(ch)
            elif ch == '\n':
                out.append('\\n')
            elif ch == '\r':
                out.append('\\r')
            elif ch == '\t':
                out.append('\\t')
            elif ord(ch) < 0x20:
                # Other control characters
                out.append(f'\\u{ord(ch):04x}')
            else:
                out.append(ch)
        i += 1
    return ''.join(out)


def _extract_json_objects(text: str) -> list[dict] | None:
    """Last-resort extractor: pull individual JSON objects from malformed text using brace matching."""
    objects: list[dict] = []
    i = 0
    n = len(text)
    while i < n:
        if text[i] == '{':
            depth = 0
            start = i
            in_str = False
            j = i
            while j < n:
                ch = text[j]
                if in_str:
                    if ch == '\\' and j + 1 < n:
                        j += 2
                        continue
                    if ch == '"':
                        in_str = False
                elif ch == '"':
                    in_str = True
                elif ch == '{':
                    depth += 1
                elif ch == '}':
                    depth -= 1
                    if depth == 0:
                        candidate = text[start:j + 1]
                        candidate = _sanitize_json_strings(candidate)
                        try:
                            obj = json.loads(candidate)
                            if isinstance(obj, dict) and 'id' in obj:
                                objects.append(obj)
                        except json.JSONDecodeError:
                            pass
                        break
                j += 1
        i += 1
    return objects if objects else None


def parse_json_response(text: str | None) -> dict | list:
    """Extract and parse JSON from LLM output, stripping markdown fences."""
    if not text:
        raise ValueError("Model returned empty response")
    if "```json" in text:
        text = text.split("```json")[1].split("```")[0]
    elif "```" in text:
        text = text.split("```")[1].split("```")[0]
    text = text.strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        # Try sanitizing control chars inside strings and retry
        sanitized = _sanitize_json_strings(text)
        try:
            return json.loads(sanitized)
        except json.JSONDecodeError:
            pass
        # Last resort: extract individual JSON objects via brace-matching
        extracted = _extract_json_objects(text)
        if extracted is not None:
            logger.info("[llm] Extracted %d JSON objects from malformed response", len(extracted))
            return extracted
        raise


def repair_truncated_json(text: str) -> dict | None:
    """Try to salvage a JSON object from a truncated LLM response."""
    if "```json" in text:
        text = text.split("```json")[1].split("```")[0]
    elif "```" in text:
        text = text.split("```")[1].split("```")[0]
    text = _sanitize_json_strings(text.strip())

    for suffix in ["", "}", "]}", "\"]}",  "\"]}", "]}}", "\"]}}"]:
        try:
            return json.loads(text + suffix)
        except json.JSONDecodeError:
            continue

    last_brace = text.rfind("}")
    if last_brace > 0:
        candidate = text[:last_brace + 1]
        for suffix in ["", "}", "]}", "]}}"]:
            try:
                return json.loads(candidate + suffix)
            except json.JSONDecodeError:
                continue

    # Last resort: extract individual objects
    extracted = _extract_json_objects(text)
    if extracted is not None:
        logger.info("[llm] Repair extracted %d JSON objects from malformed response", len(extracted))
        return extracted
    return None


async def llm_call(
    *,
    system: str,
    user_prompt: str,
    model: str | None = None,
    max_tokens: int = 32768,
    temperature: float = 0.3,
    parse_json: bool = True,
    retries: int = 3,
    retry_delay: float = 10.0,
    token_tiers: list[int] | None = None,
    allow_repair: bool = False,
) -> dict | str:
    """Make an LLM call with retry logic, optional JSON parsing, and truncation repair.

    Args:
        system: System prompt.
        user_prompt: User message content.
        model: Model name (defaults to settings.llm_model).
        max_tokens: Max completion tokens.
        temperature: Sampling temperature.
        parse_json: If True, parse response as JSON.
        retries: Max retry attempts.
        retry_delay: Base delay between retries (multiplied by attempt).
        token_tiers: Escalating token budgets per retry (overrides max_tokens).
        allow_repair: If True, attempt JSON repair on truncated responses.

    Returns:
        Parsed dict if parse_json=True, raw text otherwise.
    """
    client = get_llm_client()
    resolved_model = model or settings.llm_model

    last_error: Exception | None = None
    for attempt in range(1, retries + 1):
        current_max_tokens = (
            token_tiers[min(attempt - 1, len(token_tiers) - 1)]
            if token_tiers
            else max_tokens
        )
        logger.info("[llm] attempt %d/%d: model=%s, max_tokens=%d, prompt_len=%d",
                     attempt, retries, resolved_model, current_max_tokens, len(user_prompt))
        try:
            t0 = time.time()
            response = await client.messages.create(
                model=resolved_model,
                max_tokens=current_max_tokens,
                temperature=temperature,
                system=system,
                messages=[{"role": "user", "content": user_prompt}],
            )
            elapsed = time.time() - t0

            raw = response.content[0].text if response.content else None
            stop_reason = response.stop_reason
            usage = getattr(response, 'usage', None)
            input_tokens = getattr(usage, 'input_tokens', '?') if usage else '?'
            output_tokens = getattr(usage, 'output_tokens', '?') if usage else '?'

            logger.info("[llm] response in %.1fs: stop=%s, input_tokens=%s, output_tokens=%s, response_len=%d",
                         elapsed, stop_reason, input_tokens, output_tokens, len(raw or ''))

            if not raw:
                raise ValueError("Model returned empty response")

            if stop_reason == "max_tokens":
                if allow_repair and parse_json:
                    repaired = repair_truncated_json(raw)
                    if repaired:
                        logger.info(f"[llm] JSON repair succeeded on truncated response")
                        return repaired
                raise ValueError(
                    f"Truncated response (stop_reason=max_tokens, tokens={current_max_tokens})"
                )

            if parse_json:
                try:
                    return parse_json_response(raw)
                except (json.JSONDecodeError, ValueError):
                    if allow_repair:
                        repaired = repair_truncated_json(raw)
                        if repaired:
                            logger.info("[llm] JSON repair succeeded on malformed response")
                            return repaired
                    raise
            return raw

        except Exception as e:
            last_error = e
            logger.warning(
                f"[llm] attempt {attempt}/{retries} failed: {type(e).__name__}: {e}"
            )
            if attempt < retries:
                await asyncio.sleep(retry_delay * attempt)

    raise last_error  # type: ignore[misc]


# Type alias for tool executor: async fn(input_dict, context) -> str
ToolExecutor = Callable[[dict[str, Any], Any], Awaitable[str]]


async def llm_tool_loop(
    *,
    system: str,
    goal: str,
    tools: list[dict[str, Any]],
    tool_executors: dict[str, ToolExecutor],
    context: Any = None,
    model: str | None = None,
    max_tokens: int = 4096,
    temperature: float = 0.3,
    max_turns: int = 25,
    tool_timeout: float = 300.0,
) -> AsyncGenerator[dict[str, Any], None]:
    """Run an agentic tool-use loop, yielding events for each step.

    The LLM decides which tools to call. We execute them and feed results back
    until the LLM emits end_turn or the turn limit is reached.

    Yields dicts with:
      {"type": "thinking", "content": "..."} — LLM reasoning text
      {"type": "tool_start", "tool": "name", "input": {...}, "call_id": "..."}
      {"type": "tool_result", "tool": "name", "result": "...", "call_id": "...", "duration": float}
      {"type": "checkpoint", ...}  — forwarded from special tool executors
      {"type": "complete", "content": "..."} — final LLM text
      {"type": "error", "message": "..."}
    """
    client = get_llm_client()
    resolved_model = model or settings.llm_model
    messages: list[dict[str, Any]] = [
        {"role": "user", "content": goal},
    ]

    for turn in range(1, max_turns + 1):
        logger.info(
            f"[tool_loop] turn {turn}/{max_turns}, "
            f"tool_count={len(tools)}, tool_names={[t.get('name') for t in tools]}, "
            f"msg_count={len(messages)}, goal_len={len(goal)}"
        )
        try:
            response = await client.messages.create(
                model=resolved_model,
                max_tokens=max_tokens,
                temperature=temperature,
                system=system,
                messages=messages,
                tools=tools,
            )
        except Exception as e:
            logger.error(f"[tool_loop] LLM call failed: {e}")
            yield {"type": "error", "message": f"LLM call failed: {e}"}
            return

        logger.info(
            f"[tool_loop] response: stop={response.stop_reason}, "
            f"blocks={len(response.content)}, "
            f"types={[b.type for b in response.content]}, "
            f"usage=in:{getattr(response.usage, 'input_tokens', '?')}/out:{getattr(response.usage, 'output_tokens', '?')}"
        )

        # Collect assistant content blocks
        assistant_content = []
        tool_uses = []
        for block in response.content:
            if block.type == "text" and block.text:
                assistant_content.append(block)
                yield {"type": "thinking", "content": block.text}
            elif block.type == "tool_use":
                assistant_content.append(block)
                tool_uses.append(block)

        # Append assistant turn to conversation
        messages.append({"role": "assistant", "content": assistant_content})

        # If no tool calls → model is done
        if response.stop_reason != "tool_use" or not tool_uses:
            # Extract final text
            final_text = " ".join(
                b.text for b in response.content if b.type == "text" and b.text
            )
            yield {"type": "complete", "content": final_text}
            return

        # Execute each tool call and collect results
        tool_results = []
        for tool_use in tool_uses:
            tool_name = tool_use.name
            tool_input = tool_use.input
            call_id = tool_use.id

            yield {
                "type": "tool_start",
                "tool": tool_name,
                "input": tool_input,
                "call_id": call_id,
            }

            executor = tool_executors.get(tool_name)
            if not executor:
                error_msg = f"Unknown tool: {tool_name}"
                logger.warning(f"[tool_loop] {error_msg}")
                tool_results.append({
                    "type": "tool_result",
                    "tool_use_id": call_id,
                    "content": [{"type": "text", "text": error_msg}],
                    "is_error": True,
                })
                yield {
                    "type": "tool_result",
                    "tool": tool_name,
                    "result": error_msg,
                    "call_id": call_id,
                    "error": True,
                    "duration": 0,
                }
                continue

            t0 = time.time()
            try:
                result_str = await asyncio.wait_for(
                    executor(tool_input, context),
                    timeout=tool_timeout,
                )
                duration = time.time() - t0

                # Check if executor returned a checkpoint signal
                if result_str.startswith("__CHECKPOINT__"):
                    checkpoint_data = json.loads(result_str[14:])
                    logger.info(
                        f"[tool_loop] {tool_name} yielded checkpoint (phase={checkpoint_data.get('phase')}), waiting for human input..."
                    )
                    yield {"type": "checkpoint", **checkpoint_data}
                    # Pause: wait for external resume via context's asyncio.Event
                    if hasattr(context, "checkpoint_event"):
                        context.checkpoint_event.clear()
                        await context.checkpoint_event.wait()
                    # After resume, use the response as the tool result
                    resume_data = getattr(context, "checkpoint_response", "{}")
                    logger.info(f"[tool_loop] {tool_name} resumed after checkpoint")
                    tool_results.append({
                        "type": "tool_result",
                        "tool_use_id": call_id,
                        "content": [{"type": "text", "text": f"Human responded: {resume_data}"}],
                    })
                    yield {
                        "type": "tool_result",
                        "tool": tool_name,
                        "result": resume_data,
                        "call_id": call_id,
                        "duration": time.time() - t0,
                    }
                else:
                    logger.info(
                        f"[tool_loop] {tool_name} completed in {duration:.1f}s"
                    )
                    tool_results.append({
                        "type": "tool_result",
                        "tool_use_id": call_id,
                        "content": [{"type": "text", "text": result_str}],
                    })
                    yield {
                        "type": "tool_result",
                        "tool": tool_name,
                        "result": result_str,
                        "call_id": call_id,
                        "duration": duration,
                    }

            except asyncio.TimeoutError:
                duration = time.time() - t0
                error_msg = f"Tool '{tool_name}' timed out after {tool_timeout:.0f}s"
                logger.error(f"[tool_loop] {error_msg}")
                tool_results.append({
                    "type": "tool_result",
                    "tool_use_id": call_id,
                    "content": [{"type": "text", "text": f"Error: {error_msg}. Try a simpler approach or skip this step."}],
                    "is_error": True,
                })
                yield {
                    "type": "tool_result",
                    "tool": tool_name,
                    "result": error_msg,
                    "call_id": call_id,
                    "error": True,
                    "duration": duration,
                }
            except Exception as e:
                duration = time.time() - t0
                error_msg = f"{type(e).__name__}: {e}"
                logger.error(f"[tool_loop] {tool_name} failed: {error_msg}")
                tool_results.append({
                    "type": "tool_result",
                    "tool_use_id": call_id,
                    "content": [{"type": "text", "text": f"Error: {error_msg}"}],
                    "is_error": True,
                })
                yield {
                    "type": "tool_result",
                    "tool": tool_name,
                    "result": error_msg,
                    "call_id": call_id,
                    "error": True,
                    "duration": duration,
                }

        # Append tool results to conversation
        messages.append({"role": "user", "content": tool_results})

    # Exceeded max turns
    yield {
        "type": "error",
        "message": f"Orchestrator exceeded {max_turns} turn limit",
    }
